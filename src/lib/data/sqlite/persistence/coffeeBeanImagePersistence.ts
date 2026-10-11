import { nanoid } from 'nanoid';
import { stripCoffeeBeanImages } from '@/lib/coffee-beans/imageRecords';
import { shouldSkipDestructiveReplace } from '@/lib/core/safeReplace';
import type { CoffeeBeanPersistence } from '@/lib/data/contracts';
import {
  createImageObjectKey,
  parseImageRelativePath,
  toImageRelativePath,
  type NativeImageFileStore,
} from '@/lib/data/images/nativeImageFileStore';
import {
  classifyPersistentImageString,
  type PersistentImageSource,
} from '@/lib/data/images/persistentImageSource';
import {
  decodeImageDataUrl,
  type ImageBinary,
} from '@/lib/data/images/imageBinary';
import { createImageThumbnailDataUrl } from '@/lib/images/thumbnail';
import type { CoffeeBean } from '@/types/app';
import { encodeCoffeeBean } from '../codecs';
import {
  decodeCoffeeBeanImageMetadata,
  encodeCoffeeBeanImageMetadata,
  type CoffeeBeanImageMetadata,
} from '../imageMetadata';
import type { CoffeeBeanImageMetadataRow } from '../schemaV1';
import type { SqliteDriver, SqliteExecutor } from '../driver';
import {
  listCoffeeBeanImageMetadata as listBeanImageMetadata,
  replaceCoffeeBeanImageMetadata as replaceBeanImageMetadata,
} from '../imageMetadataExecutor';
import {
  clearCoffeeBeans,
  countCoffeeBeans,
  deleteCoffeeBean,
  deleteManyCoffeeBeans,
  listCoffeeBeans,
  saveCoffeeBean,
  upsertManyCoffeeBeans,
} from '../repositories/coffeeBean';

const BEAN_IMAGE_COLUMNS =
  'image_id, bean_id, slot, variant, source_kind, relative_path, mime_type, size_bytes, sha256, external_url, updated_at_ms';
const REFERENCE_QUERY_BATCH_SIZE = 400;

type ImageSide = 'front' | 'back';
type ImageField = 'image' | 'backImage';

type SidePatch =
  | { kind: 'absent' }
  | { kind: 'undefined' }
  | { kind: 'clear' }
  | { kind: 'file'; dataUrl: string; binary: ImageBinary }
  | { kind: 'external'; url: string };

type ReplaceSource =
  | { kind: 'file'; dataUrl: string; mimeType: string; sizeBytes: number }
  | { kind: 'external'; url: string };

interface SideRows {
  original?: CoffeeBeanImageMetadata;
  thumbnail?: CoffeeBeanImageMetadata;
}

interface PlannedFile {
  objectKey: string;
  metadata: Extract<CoffeeBeanImageMetadata, { sourceKind: 'file' }>;
  dataUrl: string;
  bytes?: Uint8Array;
  optionalThumbnail: boolean;
}

interface IdentityAllocator {
  nextImageId(): string;
  nextObjectKey(): { objectKey: string; relativePath: string };
}

interface CoffeeBeanMutationCoordinator {
  withShared<T>(work: () => Promise<T>): Promise<T>;
  withExclusive<T>(work: () => Promise<T>): Promise<T>;
  withOwners<T>(ids: readonly string[], work: () => Promise<T>): Promise<T>;
}

export interface SqliteCoffeeBeanPersistenceOptions {
  imageIdFactory?: () => string;
  objectKeyFactory?: () => string;
  now?: () => number;
  thumbnailGenerator?: (dataUrl: string) => Promise<string | undefined>;
  onCleanupError?: (message: string) => void;
}

const coordinatorByDriver = new WeakMap<
  SqliteDriver,
  CoffeeBeanMutationCoordinator
>();

function createMutationCoordinator(): CoffeeBeanMutationCoordinator {
  type DatasetRequest = {
    mode: 'shared' | 'exclusive';
    grant: (release: () => void) => void;
  };

  let activeReaders = 0;
  let activeWriter = false;
  const datasetQueue: DatasetRequest[] = [];
  const ownerTails = new Map<string, Promise<void>>();

  const releaseShared = (): void => {
    activeReaders -= 1;
    drainDatasetQueue();
  };
  const releaseExclusive = (): void => {
    activeWriter = false;
    drainDatasetQueue();
  };

  function drainDatasetQueue(): void {
    if (activeWriter) return;

    if (activeReaders > 0) {
      while (datasetQueue[0]?.mode === 'shared') {
        const request = datasetQueue.shift();
        if (!request) return;
        activeReaders += 1;
        request.grant(releaseShared);
      }
      return;
    }

    const first = datasetQueue.shift();
    if (!first) return;
    if (first.mode === 'exclusive') {
      activeWriter = true;
      first.grant(releaseExclusive);
      return;
    }

    activeReaders = 1;
    first.grant(releaseShared);
    while (datasetQueue[0]?.mode === 'shared') {
      const request = datasetQueue.shift();
      if (!request) return;
      activeReaders += 1;
      request.grant(releaseShared);
    }
  }

  function acquireDataset(mode: 'shared' | 'exclusive'): Promise<() => void> {
    return new Promise(resolve => {
      const request: DatasetRequest = { mode, grant: resolve };
      if (
        datasetQueue.length === 0 &&
        !activeWriter &&
        (mode === 'shared' || activeReaders === 0)
      ) {
        if (mode === 'shared') activeReaders += 1;
        else activeWriter = true;
        request.grant(mode === 'shared' ? releaseShared : releaseExclusive);
        return;
      }

      datasetQueue.push(request);
    });
  }

  async function withDatasetLock<T>(
    mode: 'shared' | 'exclusive',
    work: () => Promise<T>
  ): Promise<T> {
    const release = await acquireDataset(mode);
    try {
      return await work();
    } finally {
      release();
    }
  }

  async function withOwner<T>(id: string, work: () => Promise<T>): Promise<T> {
    const previous = ownerTails.get(id) ?? Promise.resolve();
    let release = (): void => undefined;
    const current = new Promise<void>(resolve => {
      release = resolve;
    });
    ownerTails.set(id, current);
    await previous;
    try {
      return await work();
    } finally {
      release();
      if (ownerTails.get(id) === current) ownerTails.delete(id);
    }
  }

  async function withOwnersInOrder<T>(
    ids: readonly string[],
    index: number,
    work: () => Promise<T>
  ): Promise<T> {
    if (index >= ids.length) return work();
    return withOwner(ids[index], () => withOwnersInOrder(ids, index + 1, work));
  }

  return {
    withShared: work => withDatasetLock('shared', work),
    withExclusive: work => withDatasetLock('exclusive', work),
    withOwners: (ids, work) =>
      withDatasetLock('shared', () =>
        withOwnersInOrder(Array.from(new Set(ids)).sort(), 0, work)
      ),
  };
}

function coordinatorFor(driver: SqliteDriver): CoffeeBeanMutationCoordinator {
  let coordinator = coordinatorByDriver.get(driver);
  if (!coordinator) {
    coordinator = createMutationCoordinator();
    coordinatorByDriver.set(driver, coordinator);
  }
  return coordinator;
}

function hasOwn(bean: CoffeeBean, field: ImageField): boolean {
  return Object.prototype.hasOwnProperty.call(bean, field);
}

function sideField(side: ImageSide): ImageField {
  return side === 'front' ? 'image' : 'backImage';
}

function sideValue(bean: CoffeeBean, side: ImageSide): unknown {
  return bean[sideField(side)];
}

function sideRows(
  metadata: readonly CoffeeBeanImageMetadata[],
  side: ImageSide
): SideRows {
  const rows: SideRows = {};
  for (const row of metadata) {
    if (row.slot !== side) continue;
    if (row.variant === 'original') {
      if (rows.original) {
        throw new Error(
          `Duplicate CoffeeBean image original metadata for ${row.beanId}/${side}`
        );
      }
      rows.original = row;
    } else {
      if (rows.thumbnail) {
        throw new Error(
          `Duplicate CoffeeBean image thumbnail metadata for ${row.beanId}/${side}`
        );
      }
      rows.thumbnail = row;
    }
  }
  return rows;
}

function validateStoredPaths(
  metadata: readonly CoffeeBeanImageMetadata[]
): void {
  for (const row of metadata) {
    if (row.sourceKind === 'file') parseImageRelativePath(row.relativePath);
  }
}

function createIdentityAllocator(
  imageIdFactory: () => string,
  objectKeyFactory: () => string,
  existing: readonly CoffeeBeanImageMetadata[]
): IdentityAllocator {
  const imageIds = new Set(existing.map(row => row.imageId));
  const objectKeys = new Set<string>();
  for (const row of existing) {
    if (row.sourceKind === 'file') {
      objectKeys.add(parseImageRelativePath(row.relativePath));
    }
  }

  return {
    nextImageId() {
      const imageId = imageIdFactory();
      if (typeof imageId !== 'string' || imageId.length === 0) {
        throw new TypeError('Image ID factory returned an invalid ID');
      }
      if (imageIds.has(imageId)) {
        throw new Error('Image ID factory returned a duplicate ID');
      }
      imageIds.add(imageId);
      return imageId;
    },
    nextObjectKey() {
      const objectKey = objectKeyFactory();
      const relativePath = toImageRelativePath(objectKey);
      if (objectKeys.has(objectKey)) {
        throw new Error('Image object key factory returned a duplicate key');
      }
      objectKeys.add(objectKey);
      return { objectKey, relativePath };
    },
  };
}

function parseSavePatch(bean: CoffeeBean, side: ImageSide): SidePatch {
  const field = sideField(side);
  if (!hasOwn(bean, field)) return { kind: 'absent' };

  const value = sideValue(bean, side);
  if (value === undefined) return { kind: 'undefined' };
  if (value === '') return { kind: 'clear' };
  if (typeof value !== 'string') {
    throw new TypeError(`CoffeeBean ${field} must be a string or undefined`);
  }

  const source = classifyPersistentImageString(value);
  return source.kind === 'file-data-url'
    ? { kind: 'file', dataUrl: value, binary: source.binary }
    : { kind: 'external', url: source.url };
}

function parseReplaceSource(
  value: unknown,
  field: ImageField
): ReplaceSource | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new TypeError(`CoffeeBean ${field} must be a string or undefined`);
  }
  const source: PersistentImageSource = classifyPersistentImageString(value);
  return source.kind === 'file-data-url'
    ? {
        kind: 'file',
        dataUrl: value,
        mimeType: source.binary.mimeType,
        sizeBytes: source.binary.bytes.byteLength,
      }
    : { kind: 'external', url: source.url };
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

async function fileSourceIsUnchanged(
  existing: CoffeeBeanImageMetadata | undefined,
  incoming: { mimeType: string; sizeBytes: number; bytes: Uint8Array },
  fileStore: NativeImageFileStore
): Promise<boolean> {
  if (
    !existing ||
    existing.sourceKind !== 'file' ||
    existing.mimeType !== incoming.mimeType ||
    existing.sizeBytes !== incoming.sizeBytes
  ) {
    return false;
  }

  const objectKey = parseImageRelativePath(existing.relativePath);
  const storedBytes = await fileStore.read(objectKey);
  if (storedBytes.byteLength !== existing.sizeBytes) {
    throw new Error(
      `CoffeeBean image file size does not match metadata for ${existing.imageId}`
    );
  }
  return sameBytes(storedBytes, incoming.bytes);
}

function updateMetadataTimestamp<T extends CoffeeBeanImageMetadata>(
  row: T,
  updatedAt: number
): T {
  return { ...row, updatedAt } as T;
}

function fileRow(
  beanId: string,
  slot: ImageSide,
  variant: 'original' | 'thumbnail',
  updatedAt: number,
  dataUrl: string,
  binary: ImageBinary,
  identity: IdentityAllocator,
  optionalThumbnail = false
): {
  metadata: Extract<CoffeeBeanImageMetadata, { sourceKind: 'file' }>;
  write: PlannedFile;
} {
  const { objectKey, relativePath } = identity.nextObjectKey();
  const metadata: Extract<CoffeeBeanImageMetadata, { sourceKind: 'file' }> = {
    imageId: identity.nextImageId(),
    beanId,
    slot,
    variant,
    sourceKind: 'file',
    relativePath,
    mimeType: binary.mimeType,
    sizeBytes: binary.bytes.byteLength,
    updatedAt,
  };
  return {
    metadata,
    write: {
      objectKey,
      metadata,
      dataUrl,
      bytes: binary.bytes,
      optionalThumbnail,
    },
  };
}

function externalRow(
  beanId: string,
  slot: ImageSide,
  url: string,
  updatedAt: number,
  identity: IdentityAllocator
): Extract<CoffeeBeanImageMetadata, { sourceKind: 'external' }> {
  return {
    imageId: identity.nextImageId(),
    beanId,
    slot,
    variant: 'original',
    sourceKind: 'external',
    externalUrl: url,
    updatedAt,
  };
}

function validateDesiredMetadata(
  metadata: readonly CoffeeBeanImageMetadata[]
): void {
  const imageIds = new Set<string>();
  const logicalKeys = new Set<string>();
  for (const row of metadata) {
    encodeCoffeeBeanImageMetadata(row);
    if (imageIds.has(row.imageId)) {
      throw new Error(`Duplicate desired CoffeeBean image ID: ${row.imageId}`);
    }
    imageIds.add(row.imageId);
    const key = JSON.stringify([row.beanId, row.slot, row.variant]);
    if (logicalKeys.has(key)) {
      throw new Error(`Duplicate desired CoffeeBean image source: ${key}`);
    }
    logicalKeys.add(key);
  }
}

async function listAllCoffeeBeanImageMetadata(
  executor: SqliteExecutor
): Promise<CoffeeBeanImageMetadata[]> {
  const rows = await executor.query(
    `SELECT ${BEAN_IMAGE_COLUMNS} FROM coffee_bean_images
     ORDER BY bean_id ASC, CASE slot WHEN 'front' THEN 0 ELSE 1 END ASC,
       CASE variant WHEN 'original' THEN 0 ELSE 1 END ASC, image_id ASC`
  );
  return rows.map(row =>
    decodeCoffeeBeanImageMetadata(row as unknown as CoffeeBeanImageMetadataRow)
  );
}

function metadataByOwner(
  metadata: readonly CoffeeBeanImageMetadata[]
): Map<string, CoffeeBeanImageMetadata[]> {
  const result = new Map<string, CoffeeBeanImageMetadata[]>();
  for (const row of metadata) {
    const ownerRows = result.get(row.beanId) ?? [];
    ownerRows.push(row);
    result.set(row.beanId, ownerRows);
  }
  return result;
}

function filePaths(metadata: readonly CoffeeBeanImageMetadata[]): string[] {
  return metadata.flatMap(row =>
    row.sourceKind === 'file' ? [row.relativePath] : []
  );
}

function replacedFilePaths(
  previous: readonly CoffeeBeanImageMetadata[],
  next: readonly CoffeeBeanImageMetadata[]
): string[] {
  const nextPaths = new Set(filePaths(next));
  return Array.from(new Set(filePaths(previous))).filter(
    path => !nextPaths.has(path)
  );
}

function hasRollbackDiagnostic(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    Object.prototype.hasOwnProperty.call(error, 'rollbackDiagnostic')
  );
}

async function findReferencedImagePaths(
  executor: SqliteExecutor,
  relativePaths: readonly string[]
): Promise<Set<string>> {
  const candidates = Array.from(new Set(relativePaths));
  for (const path of candidates) parseImageRelativePath(path);
  const referenced = new Set<string>();

  for (
    let offset = 0;
    offset < candidates.length;
    offset += REFERENCE_QUERY_BATCH_SIZE
  ) {
    const batch = candidates.slice(offset, offset + REFERENCE_QUERY_BATCH_SIZE);
    const placeholders = batch.map(() => '?').join(', ');
    const rows = await executor.query(
      `SELECT relative_path FROM coffee_bean_images
       WHERE source_kind = 'file' AND relative_path IN (${placeholders})
       UNION
       SELECT relative_path FROM brewing_note_images
       WHERE source_kind = 'file' AND relative_path IN (${placeholders})`,
      [...batch, ...batch]
    );
    for (const row of rows) {
      const path = row.relative_path;
      if (typeof path !== 'string') {
        throw new Error('Image path reference query returned an invalid path');
      }
      referenced.add(path);
    }
  }
  return referenced;
}

function createCleanupReporter(
  onCleanupError?: (message: string) => void
): (message: string) => void {
  return message => {
    try {
      if (onCleanupError) onCleanupError(message);
      else console.warn(`[CoffeeBeanImagePersistence] ${message}`);
    } catch {
      // Diagnostics must never replace the operation's primary result.
    }
  };
}

async function deleteCreatedObjectsBestEffort(
  fileStore: NativeImageFileStore,
  created: readonly { relativePath: string }[],
  reportCleanupError: (message: string) => void
): Promise<void> {
  for (const object of created) {
    try {
      await fileStore.delete(parseImageRelativePath(object.relativePath));
    } catch {
      reportCleanupError('Failed to remove a newly written image object');
    }
  }
}

async function cleanupUnreferencedPaths(
  driver: SqliteDriver,
  fileStore: NativeImageFileStore,
  relativePaths: readonly string[],
  reportCleanupError: (message: string) => void
): Promise<void> {
  const candidates = Array.from(new Set(relativePaths));
  if (candidates.length === 0) return;

  let referenced: Set<string>;
  try {
    // Resolve every reference query before deleting any object. A failed
    // read-back therefore leaves the whole candidate set intact.
    referenced = await findReferencedImagePaths(driver, candidates);
  } catch {
    reportCleanupError(
      'Could not verify image references; files were retained'
    );
    return;
  }

  for (const relativePath of candidates) {
    if (referenced.has(relativePath)) continue;
    try {
      await fileStore.delete(parseImageRelativePath(relativePath));
    } catch {
      reportCleanupError('Failed to remove a superseded image object');
    }
  }
}

async function assertPlannedObjectsAbsent(
  fileStore: NativeImageFileStore,
  plans: readonly PlannedFile[]
): Promise<void> {
  for (const plan of plans) {
    if (await fileStore.exists(plan.objectKey)) {
      throw new Error('Generated image object key already exists');
    }
  }
}

async function writePlannedObjects(
  fileStore: NativeImageFileStore,
  plans: readonly PlannedFile[],
  reportCleanupError: (message: string) => void
): Promise<{
  created: Array<{ objectKey: string; relativePath: string }>;
  failedOptionalImageIds: Set<string>;
}> {
  const created: Array<{ objectKey: string; relativePath: string }> = [];
  const failedOptionalImageIds = new Set<string>();
  const authoritative = plans.filter(plan => !plan.optionalThumbnail);
  const optional = plans.filter(plan => plan.optionalThumbnail);

  for (const plan of authoritative) {
    try {
      const bytes = plan.bytes ?? decodeImageDataUrl(plan.dataUrl).bytes;
      await fileStore.write(plan.objectKey, bytes);
      created.push({
        objectKey: plan.objectKey,
        relativePath: plan.metadata.relativePath,
      });
    } catch (error) {
      await deleteCreatedObjectsBestEffort(
        fileStore,
        created,
        reportCleanupError
      );
      throw error;
    }
  }

  for (const plan of optional) {
    try {
      const bytes = plan.bytes ?? decodeImageDataUrl(plan.dataUrl).bytes;
      await fileStore.write(plan.objectKey, bytes);
      created.push({
        objectKey: plan.objectKey,
        relativePath: plan.metadata.relativePath,
      });
    } catch {
      failedOptionalImageIds.add(plan.metadata.imageId);
      reportCleanupError(
        'Thumbnail file write failed; original image was kept'
      );
    }
  }

  return { created, failedOptionalImageIds };
}

async function compensateTransactionFailure(
  driver: SqliteDriver,
  fileStore: NativeImageFileStore,
  created: readonly { objectKey: string; relativePath: string }[],
  supersededPaths: readonly string[],
  error: unknown,
  reportCleanupError: (message: string) => void
): Promise<void> {
  if (hasRollbackDiagnostic(error)) {
    reportCleanupError(
      'SQLite rollback status is uncertain; file objects were retained'
    );
    return;
  }

  await cleanupUnreferencedPaths(
    driver,
    fileStore,
    [...created.map(object => object.relativePath), ...supersededPaths],
    reportCleanupError
  );
}

async function verifyMetadataRows(
  metadata: readonly CoffeeBeanImageMetadata[],
  plans: readonly PlannedFile[]
): Promise<void> {
  validateDesiredMetadata(metadata);
  const allIds = new Set(metadata.map(row => row.imageId));
  for (const plan of plans) {
    if (!allIds.has(plan.metadata.imageId)) {
      throw new Error('Planned file is not present in desired image metadata');
    }
  }
}

function fileMetadataWithTimestamp(
  original: Extract<CoffeeBeanImageMetadata, { sourceKind: 'file' }>,
  updatedAt: number
): Extract<CoffeeBeanImageMetadata, { sourceKind: 'file' }> {
  return { ...original, updatedAt };
}

function originalRows(metadata: readonly CoffeeBeanImageMetadata[]): string[] {
  return filePaths(metadata);
}

export function createSqliteCoffeeBeanPersistence(
  driver: SqliteDriver,
  fileStore: NativeImageFileStore,
  options: SqliteCoffeeBeanPersistenceOptions = {}
): CoffeeBeanPersistence {
  const imageIdFactory = options.imageIdFactory ?? nanoid;
  const objectKeyFactory = options.objectKeyFactory ?? createImageObjectKey;
  const now = options.now ?? Date.now;
  const thumbnailGenerator =
    options.thumbnailGenerator ?? createImageThumbnailDataUrl;
  const reportCleanupError = createCleanupReporter(options.onCleanupError);
  const coordinator = coordinatorFor(driver);

  async function planSaveSide(
    beanId: string,
    side: ImageSide,
    patch: SidePatch,
    existing: SideRows,
    updatedAt: number,
    generateThumbnails: boolean,
    identity: IdentityAllocator
  ): Promise<{ metadata: CoffeeBeanImageMetadata[]; writes: PlannedFile[] }> {
    if (patch.kind === 'absent') {
      return {
        metadata: [existing.original, existing.thumbnail]
          .filter((row): row is CoffeeBeanImageMetadata => row !== undefined)
          .map(row => updateMetadataTimestamp(row, updatedAt)),
        writes: [],
      };
    }
    if (patch.kind === 'clear') return { metadata: [], writes: [] };

    if (patch.kind === 'undefined') {
      return {
        metadata: [existing.original, existing.thumbnail]
          .filter((row): row is CoffeeBeanImageMetadata => row !== undefined)
          .map(row => updateMetadataTimestamp(row, updatedAt)),
        writes: [],
      };
    }

    if (patch.kind === 'external') {
      if (
        existing.original?.sourceKind === 'external' &&
        existing.original.externalUrl === patch.url
      ) {
        return {
          metadata: [updateMetadataTimestamp(existing.original, updatedAt)],
          writes: [],
        };
      }
      return {
        metadata: [externalRow(beanId, side, patch.url, updatedAt, identity)],
        writes: [],
      };
    }

    const unchanged = await fileSourceIsUnchanged(
      existing.original,
      {
        mimeType: patch.binary.mimeType,
        sizeBytes: patch.binary.bytes.byteLength,
        bytes: patch.binary.bytes,
      },
      fileStore
    );
    if (unchanged && existing.original?.sourceKind === 'file') {
      const metadata: CoffeeBeanImageMetadata[] = [
        fileMetadataWithTimestamp(existing.original, updatedAt),
      ];
      if (existing.thumbnail) {
        metadata.push(updateMetadataTimestamp(existing.thumbnail, updatedAt));
      }
      return { metadata, writes: [] };
    }

    const original = fileRow(
      beanId,
      side,
      'original',
      updatedAt,
      patch.dataUrl,
      patch.binary,
      identity
    );
    const metadata: CoffeeBeanImageMetadata[] = [original.metadata];
    const writes = [original.write];

    if (!generateThumbnails) {
      if (existing.thumbnail) {
        metadata.push(updateMetadataTimestamp(existing.thumbnail, updatedAt));
      }
      return { metadata, writes };
    }

    const thumbnailDataUrl = await thumbnailGenerator(patch.dataUrl);
    if (!thumbnailDataUrl) return { metadata, writes };

    const thumbnailSource = classifyPersistentImageString(thumbnailDataUrl);
    if (thumbnailSource.kind !== 'file-data-url') {
      throw new TypeError(
        'CoffeeBean thumbnail generator must return an image Data URL'
      );
    }
    const thumbnail = fileRow(
      beanId,
      side,
      'thumbnail',
      updatedAt,
      thumbnailDataUrl,
      thumbnailSource.binary,
      identity,
      true
    );
    metadata.push(thumbnail.metadata);
    writes.push(thumbnail.write);
    return { metadata, writes };
  }

  async function transactAndResolve(
    work: (tx: SqliteExecutor) => Promise<void>,
    created: readonly { objectKey: string; relativePath: string }[],
    supersededPaths: readonly string[]
  ): Promise<void> {
    try {
      await driver.transaction(work);
    } catch (error) {
      await compensateTransactionFailure(
        driver,
        fileStore,
        created,
        supersededPaths,
        error,
        reportCleanupError
      );
      throw error;
    }

    await cleanupUnreferencedPaths(
      driver,
      fileStore,
      supersededPaths,
      reportCleanupError
    );
  }

  return {
    async saveWithImages(bean, saveOptions) {
      const patches = {
        front: parseSavePatch(bean, 'front'),
        back: parseSavePatch(bean, 'back'),
      };
      const touched =
        patches.front.kind !== 'absent' || patches.back.kind !== 'absent';

      return coordinator.withOwners([bean.id], async () => {
        const cleanBean = stripCoffeeBeanImages(bean);
        saveCoffeeBeanValidation(cleanBean);

        if (!touched) {
          await driver.transaction(tx => saveCoffeeBean(tx, cleanBean));
          return cleanBean;
        }

        const currentMetadata = await listBeanImageMetadata(driver, bean.id);
        validateStoredPaths(currentMetadata);
        const updatedAt = bean.timestamp || now();
        const identity = createIdentityAllocator(
          imageIdFactory,
          objectKeyFactory,
          currentMetadata
        );
        const currentFront = sideRows(currentMetadata, 'front');
        const currentBack = sideRows(currentMetadata, 'back');
        const generateThumbnails = saveOptions?.generateThumbnails !== false;
        const [frontPlan, backPlan] = await Promise.all([
          planSaveSide(
            bean.id,
            'front',
            patches.front,
            currentFront,
            updatedAt,
            generateThumbnails,
            identity
          ),
          planSaveSide(
            bean.id,
            'back',
            patches.back,
            currentBack,
            updatedAt,
            generateThumbnails,
            identity
          ),
        ]);
        const desiredMetadata = [...frontPlan.metadata, ...backPlan.metadata];
        const writes = [...frontPlan.writes, ...backPlan.writes];
        await verifyMetadataRows(desiredMetadata, writes);
        saveCoffeeBeanValidation(cleanBean);
        await assertPlannedObjectsAbsent(fileStore, writes);

        const { created, failedOptionalImageIds } = await writePlannedObjects(
          fileStore,
          writes,
          reportCleanupError
        );

        const committedMetadata = desiredMetadata.filter(
          row => !failedOptionalImageIds.has(row.imageId)
        );
        const supersededPaths = replacedFilePaths(
          currentMetadata,
          committedMetadata
        );
        try {
          await transactAndResolve(
            async tx => {
              await replaceBeanImageMetadata(tx, bean.id, committedMetadata);
              await saveCoffeeBean(tx, cleanBean);
            },
            created,
            supersededPaths
          );
        } catch (error) {
          // transactAndResolve owns reference-aware compensation after SQL starts.
          throw error;
        }
        return cleanBean;
      });
    },

    async deleteWithImages(id) {
      await coordinator.withOwners([id], async () => {
        const existing = await listBeanImageMetadata(driver, id);
        validateStoredPaths(existing);
        const oldPaths = originalRows(existing);
        await transactAndResolve(
          async tx => {
            await deleteCoffeeBean(tx, id);
            await replaceBeanImageMetadata(tx, id, []);
          },
          [],
          oldPaths
        );
      });
    },

    async deleteManyWithImages(ids) {
      const uniqueIds = Array.from(new Set(ids));
      if (uniqueIds.length === 0) return;

      await coordinator.withOwners(uniqueIds, async () => {
        const existingByOwner = new Map<string, CoffeeBeanImageMetadata[]>();
        for (const id of uniqueIds) {
          const rows = await listBeanImageMetadata(driver, id);
          validateStoredPaths(rows);
          existingByOwner.set(id, rows);
        }
        const oldPaths = Array.from(existingByOwner.values()).flatMap(
          filePaths
        );
        await transactAndResolve(
          async tx => {
            await deleteManyCoffeeBeans(tx, ids);
            for (const id of uniqueIds) {
              await replaceBeanImageMetadata(tx, id, []);
            }
          },
          [],
          oldPaths
        );
      });
    },

    async replaceAllWithImages(beans, replaceOptions) {
      return coordinator.withExclusive(async () => {
        const snapshot = await driver.transaction(async tx => {
          const existingCount = await countCoffeeBeans(tx);
          if (
            shouldSkipDestructiveReplace({
              nextCount: beans.length,
              existingCount,
              allowEmptyReplace: replaceOptions?.allowEmptyReplace,
              allowDestructiveReplace: replaceOptions?.allowDestructiveReplace,
            })
          ) {
            return { skipped: true as const };
          }
          const [existingBeans, allImageMetadata] = await Promise.all([
            listCoffeeBeans(tx),
            listAllCoffeeBeanImageMetadata(tx),
          ]);
          return {
            skipped: false as const,
            existingBeans,
            allImageMetadata,
          };
        });
        if (snapshot.skipped) return false;

        validateStoredPaths(snapshot.allImageMetadata);
        const cleanBeans = beans.map(stripCoffeeBeanImages);
        await Promise.all(cleanBeans.map(saveCoffeeBeanValidation));

        const incomingIds = beans.map(bean => bean.id).filter(Boolean);
        const incomingIdSet = new Set(incomingIds);
        const staleBeanIds = snapshot.existingBeans
          .map(bean => bean.id)
          .filter(id => !incomingIdSet.has(id));
        const imageRecords = new Map<string, CoffeeBean>();
        const explicitEmptyIds = new Set<string>();
        for (const bean of beans) {
          const hasImageRecord = Boolean(bean.image || bean.backImage);
          if (hasImageRecord) {
            imageRecords.set(bean.id, bean);
          } else if (hasOwn(bean, 'image') || hasOwn(bean, 'backImage')) {
            explicitEmptyIds.add(bean.id);
          }
        }

        // Classify only the last effective bulkPut image record for each ID,
        // matching Dexie's duplicate-key write ordering.
        const replaceSources = new Map<
          string,
          { front?: ReplaceSource; back?: ReplaceSource; updatedAt: number }
        >();
        let operationNow: number | undefined;
        const fallbackTimestamp = (): number => {
          operationNow ??= now();
          return operationNow;
        };
        for (const [beanId, bean] of imageRecords) {
          const frontValue = parseReplaceSource(bean.image, 'image');
          const backValue = parseReplaceSource(bean.backImage, 'backImage');
          replaceSources.set(beanId, {
            ...(frontValue ? { front: frontValue } : {}),
            ...(backValue ? { back: backValue } : {}),
            updatedAt: bean.timestamp || fallbackTimestamp(),
          });
        }

        const existingByOwner = metadataByOwner(snapshot.allImageMetadata);
        const identity = createIdentityAllocator(
          imageIdFactory,
          objectKeyFactory,
          snapshot.allImageMetadata
        );
        const desiredByOwner = new Map<
          string,
          { metadata: CoffeeBeanImageMetadata[]; writes: PlannedFile[] }
        >();

        const ownersToReplace = new Set<string>([
          ...Array.from(existingByOwner.keys()).filter(
            id => !incomingIdSet.has(id)
          ),
          ...Array.from(explicitEmptyIds).filter(id => !imageRecords.has(id)),
          ...imageRecords.keys(),
        ]);

        for (const beanId of ownersToReplace) {
          const previous = existingByOwner.get(beanId) ?? [];
          const sourceRecord = replaceSources.get(beanId);
          if (!sourceRecord) {
            desiredByOwner.set(beanId, { metadata: [], writes: [] });
            continue;
          }

          const metadata: CoffeeBeanImageMetadata[] = [];
          const writes: PlannedFile[] = [];
          for (const side of ['front', 'back'] as const) {
            const source = sourceRecord[side];
            if (!source) continue;
            const existing = sideRows(previous, side).original;
            if (source.kind === 'external') {
              if (
                existing?.sourceKind === 'external' &&
                existing.externalUrl === source.url
              ) {
                metadata.push(
                  updateMetadataTimestamp(existing, sourceRecord.updatedAt)
                );
              } else {
                metadata.push(
                  externalRow(
                    beanId,
                    side,
                    source.url,
                    sourceRecord.updatedAt,
                    identity
                  )
                );
              }
              continue;
            }

            const incomingBinary = decodeImageDataUrl(source.dataUrl);
            const unchanged = await fileSourceIsUnchanged(
              existing,
              {
                mimeType: source.mimeType,
                sizeBytes: source.sizeBytes,
                bytes: incomingBinary.bytes,
              },
              fileStore
            );
            if (unchanged && existing?.sourceKind === 'file') {
              metadata.push(
                updateMetadataTimestamp(existing, sourceRecord.updatedAt)
              );
              continue;
            }

            const file = fileRow(
              beanId,
              side,
              'original',
              sourceRecord.updatedAt,
              source.dataUrl,
              incomingBinary,
              identity
            );
            metadata.push(file.metadata);
            writes.push({ ...file.write, bytes: undefined });
          }
          desiredByOwner.set(beanId, { metadata, writes });
        }

        const allDesired = Array.from(desiredByOwner.values()).flatMap(
          value => value.metadata
        );
        const allWrites = Array.from(desiredByOwner.values()).flatMap(
          value => value.writes
        );
        validateDesiredMetadata(allDesired);
        for (const plan of allWrites)
          encodeCoffeeBeanImageMetadata(plan.metadata);
        await assertPlannedObjectsAbsent(fileStore, allWrites);

        const result = await writePlannedObjects(
          fileStore,
          allWrites,
          reportCleanupError
        );
        const supersededPaths = replacedFilePaths(snapshot.allImageMetadata, [
          ...Array.from(existingByOwner.entries())
            .filter(([id]) => !ownersToReplace.has(id))
            .flatMap(([, rows]) => rows),
          ...allDesired,
        ]);

        await transactAndResolve(
          async tx => {
            await upsertManyCoffeeBeans(tx, cleanBeans);
            await deleteManyCoffeeBeans(tx, staleBeanIds);
            for (const ownerId of Array.from(ownersToReplace).sort()) {
              const desired = desiredByOwner.get(ownerId)?.metadata ?? [];
              await replaceBeanImageMetadata(tx, ownerId, desired);
            }
          },
          result.created,
          supersededPaths
        );
        return true;
      });
    },

    async clearWithImages() {
      await coordinator.withExclusive(async () => {
        const current = await listAllCoffeeBeanImageMetadata(driver);
        validateStoredPaths(current);
        const oldPaths = originalRows(current);
        await transactAndResolve(
          async tx => {
            await clearCoffeeBeans(tx);
            await tx.execute('DELETE FROM coffee_bean_images');
          },
          [],
          oldPaths
        );
      });
    },
  };
}

function saveCoffeeBeanValidation(bean: CoffeeBean): void {
  // Reuse the subject repository codec and its image-field guard before any
  // image bytes are written. The executor used here is intentionally absent.
  encodeCoffeeBean(bean);
}
