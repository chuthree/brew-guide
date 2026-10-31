import { nanoid } from 'nanoid';
import {
  assertRecordUnchanged,
  brewingNoteSnapshot,
} from '@/lib/data/recordConflict';
import { shouldSkipDestructiveReplace } from '@/lib/core/safeReplace';
import type { BrewingNotePersistence } from '@/lib/data/contracts';
import {
  createImageObjectKey,
  parseImageRelativePath,
  toImageRelativePath,
  type NativeImageFileStore,
} from '@/lib/data/images/nativeImageFileStore';
import { classifyPersistentImageString } from '@/lib/data/images/persistentImageSource';
import {
  getBrewingNoteImages,
  stripBrewingNoteImages,
} from '@/lib/notes/imageRecords';
import type { BrewingNote } from '@/lib/core/config';
import { encodeBrewingNote } from '../codecs';
import {
  decodeBrewingNoteImageMetadata,
  encodeBrewingNoteImageMetadata,
  type BrewingNoteImageMetadata,
} from '../imageMetadata';
import type { BrewingNoteImageMetadataRow } from '../schemaV1';
import type { SqliteDriver, SqliteExecutor } from '../driver';
import {
  listBrewingNoteImageMetadata,
  replaceBrewingNoteImageMetadata,
} from '../imageMetadataExecutor';
import {
  clearBrewingNotes,
  countBrewingNotes,
  getBrewingNote,
  deleteBrewingNote,
  deleteManyBrewingNotes,
  listBrewingNotes,
  saveBrewingNote,
  upsertManyBrewingNotes,
} from '../repositories/brewingNote';

const NOTE_IMAGE_COLUMNS =
  'image_id, note_id, position, variant, source_kind, relative_path, mime_type, size_bytes, sha256, external_url, updated_at_ms';
const REFERENCE_QUERY_BATCH_SIZE = 400;

interface MutationCoordinator {
  withExclusive<T>(work: () => Promise<T>): Promise<T>;
  withOwners<T>(ids: readonly string[], work: () => Promise<T>): Promise<T>;
}

interface IdentityAllocator {
  nextImageId(): string;
  nextObjectKey(): { objectKey: string; relativePath: string };
}

interface PlannedFile {
  objectKey: string;
  relativePath: string;
  metadata: Extract<BrewingNoteImageMetadata, { sourceKind: 'file' }>;
  bytes: Uint8Array;
}

type NoteImageSource =
  | { kind: 'file'; bytes: Uint8Array; mimeType: string }
  | { kind: 'external'; url: string };

interface ImageSnapshot {
  noteId: string;
  images: string[];
  updatedAt: number;
}

export interface SqliteBrewingNotePersistenceOptions {
  imageIdFactory?: () => string;
  objectKeyFactory?: () => string;
  now?: () => number;
  onCleanupError?: (message: string) => void;
}

const coordinatorByDriver = new WeakMap<SqliteDriver, MutationCoordinator>();

function createMutationCoordinator(): MutationCoordinator {
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
    withExclusive: work => withDatasetLock('exclusive', work),
    withOwners: (ids, work) =>
      withDatasetLock('shared', () =>
        withOwnersInOrder(Array.from(new Set(ids)).sort(), 0, work)
      ),
  };
}

function coordinatorFor(driver: SqliteDriver): MutationCoordinator {
  let coordinator = coordinatorByDriver.get(driver);
  if (!coordinator) {
    coordinator = createMutationCoordinator();
    coordinatorByDriver.set(driver, coordinator);
  }
  return coordinator;
}

function hasImageFieldUpdate(note: BrewingNote): boolean {
  return (
    Object.prototype.hasOwnProperty.call(note, 'image') ||
    Object.prototype.hasOwnProperty.call(note, 'images')
  );
}

function effectiveTimestamp(note: BrewingNote, now: () => number): number {
  // Match splitBrewingNoteImages' existing `updatedAt || timestamp || Date.now()` semantics.
  return note.updatedAt || note.timestamp || now();
}

function classifyImages(images: readonly string[]): NoteImageSource[] {
  return images.map(image => {
    const source = classifyPersistentImageString(image);
    return source.kind === 'file-data-url'
      ? {
          kind: 'file' as const,
          bytes: source.binary.bytes,
          mimeType: source.binary.mimeType,
        }
      : { kind: 'external' as const, url: source.url };
  });
}

function createIdentityAllocator(
  imageIdFactory: () => string,
  objectKeyFactory: () => string,
  existing: readonly BrewingNoteImageMetadata[]
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

function noteOriginalRows(
  metadata: readonly BrewingNoteImageMetadata[]
): BrewingNoteImageMetadata[] {
  const originals = new Map<number, BrewingNoteImageMetadata>();
  for (const row of metadata) {
    if (row.variant !== 'original') continue;
    if (originals.has(row.position)) {
      throw new Error(
        `Duplicate BrewingNote original metadata for ${row.noteId}/${row.position}`
      );
    }
    originals.set(row.position, row);
  }
  return Array.from(originals.values()).sort(
    (left, right) => left.position - right.position
  );
}

function validateStoredPaths(
  metadata: readonly BrewingNoteImageMetadata[]
): void {
  for (const row of metadata) {
    if (row.sourceKind === 'file') parseImageRelativePath(row.relativePath);
  }
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

async function findReusableSource(
  source: NoteImageSource,
  existing: readonly BrewingNoteImageMetadata[],
  consumedImageIds: Set<string>,
  fileStore: NativeImageFileStore
): Promise<BrewingNoteImageMetadata | undefined> {
  for (const row of existing) {
    if (consumedImageIds.has(row.imageId)) continue;

    if (source.kind === 'external') {
      if (row.sourceKind === 'external' && row.externalUrl === source.url) {
        return row;
      }
      continue;
    }

    if (
      row.sourceKind !== 'file' ||
      row.mimeType !== source.mimeType ||
      row.sizeBytes !== source.bytes.byteLength
    ) {
      continue;
    }

    const storedBytes = await fileStore.read(
      parseImageRelativePath(row.relativePath)
    );
    if (storedBytes.byteLength !== row.sizeBytes) {
      throw new Error(
        `BrewingNote image file size does not match metadata for ${row.imageId}`
      );
    }
    if (sameBytes(storedBytes, source.bytes)) return row;
  }

  return undefined;
}

function fileMetadata(
  noteId: string,
  position: number,
  updatedAt: number,
  source: Extract<NoteImageSource, { kind: 'file' }>,
  identity: IdentityAllocator
): PlannedFile {
  const { objectKey, relativePath } = identity.nextObjectKey();
  return {
    objectKey,
    relativePath,
    bytes: source.bytes,
    metadata: {
      imageId: identity.nextImageId(),
      noteId,
      position,
      variant: 'original',
      sourceKind: 'file',
      relativePath,
      mimeType: source.mimeType,
      sizeBytes: source.bytes.byteLength,
      updatedAt,
    },
  };
}

function externalMetadata(
  noteId: string,
  position: number,
  updatedAt: number,
  url: string,
  identity: IdentityAllocator
): Extract<BrewingNoteImageMetadata, { sourceKind: 'external' }> {
  return {
    imageId: identity.nextImageId(),
    noteId,
    position,
    variant: 'original',
    sourceKind: 'external',
    externalUrl: url,
    updatedAt,
  };
}

function validateDesiredMetadata(
  metadata: readonly BrewingNoteImageMetadata[]
): void {
  const imageIds = new Set<string>();
  const logicalKeys = new Set<string>();
  for (const row of metadata) {
    encodeBrewingNoteImageMetadata(row);
    if (imageIds.has(row.imageId)) {
      throw new Error(`Duplicate desired BrewingNote image ID: ${row.imageId}`);
    }
    imageIds.add(row.imageId);
    const key = JSON.stringify([row.noteId, row.position, row.variant]);
    if (logicalKeys.has(key)) {
      throw new Error(`Duplicate desired BrewingNote image source: ${key}`);
    }
    logicalKeys.add(key);
  }
}

async function listAllBrewingNoteImageMetadata(
  executor: SqliteExecutor
): Promise<BrewingNoteImageMetadata[]> {
  const rows = await executor.query(
    `SELECT ${NOTE_IMAGE_COLUMNS} FROM brewing_note_images
     ORDER BY note_id ASC, position ASC,
       CASE variant WHEN 'original' THEN 0 ELSE 1 END ASC, image_id ASC`
  );
  return rows.map(row =>
    decodeBrewingNoteImageMetadata(
      row as unknown as BrewingNoteImageMetadataRow
    )
  );
}

function metadataByOwner(
  metadata: readonly BrewingNoteImageMetadata[]
): Map<string, BrewingNoteImageMetadata[]> {
  const result = new Map<string, BrewingNoteImageMetadata[]>();
  for (const row of metadata) {
    const ownerRows = result.get(row.noteId) ?? [];
    ownerRows.push(row);
    result.set(row.noteId, ownerRows);
  }
  return result;
}

function filePaths(metadata: readonly BrewingNoteImageMetadata[]): string[] {
  return metadata.flatMap(row =>
    row.sourceKind === 'file' ? [row.relativePath] : []
  );
}

function replacedFilePaths(
  previous: readonly BrewingNoteImageMetadata[],
  next: readonly BrewingNoteImageMetadata[]
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
      if (typeof row.relative_path !== 'string') {
        throw new Error('Image path reference query returned an invalid path');
      }
      referenced.add(row.relative_path);
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
      else console.warn(`[BrewingNoteImagePersistence] ${message}`);
    } catch {
      // Diagnostics must not replace the operation's primary result.
    }
  };
}

export async function cleanupUnreferencedPaths(
  driver: SqliteExecutor,
  fileStore: NativeImageFileStore,
  relativePaths: readonly string[],
  reportCleanupError: (message: string) => void
): Promise<void> {
  const candidates = Array.from(new Set(relativePaths));
  if (candidates.length === 0) return;

  let referenced: Set<string>;
  try {
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
  driver: SqliteExecutor,
  fileStore: NativeImageFileStore,
  plans: readonly PlannedFile[]
): Promise<void> {
  const referenced = await findReferencedImagePaths(
    driver,
    plans.map(plan => plan.relativePath)
  );
  if (referenced.size > 0) {
    throw new Error('Generated image object path is already referenced');
  }

  for (const plan of plans) {
    if (await fileStore.exists(plan.objectKey)) {
      throw new Error('Generated image object key already exists');
    }
  }
}

async function writePlannedObjects(
  driver: SqliteExecutor,
  fileStore: NativeImageFileStore,
  plans: readonly PlannedFile[],
  reportCleanupError: (message: string) => void
): Promise<PlannedFile[]> {
  const created: PlannedFile[] = [];
  for (const plan of plans) {
    try {
      await fileStore.write(plan.objectKey, plan.bytes);
      created.push(plan);
    } catch (error) {
      await cleanupUnreferencedPaths(
        driver,
        fileStore,
        [...created.map(file => file.relativePath), plan.relativePath],
        reportCleanupError
      );
      throw error;
    }
  }
  return created;
}

async function compensateTransactionFailure(
  driver: SqliteDriver,
  fileStore: NativeImageFileStore,
  created: readonly Pick<PlannedFile, 'relativePath'>[],
  supersededPaths: readonly string[],
  error: unknown,
  reportCleanupError: (message: string) => void
): Promise<void> {
  if (hasRollbackDiagnostic(error)) {
    reportCleanupError(
      'SQLite rollback status is uncertain; image files were retained'
    );
    return;
  }
  await cleanupUnreferencedPaths(
    driver,
    fileStore,
    [...created.map(file => file.relativePath), ...supersededPaths],
    reportCleanupError
  );
}

function imageSnapshot(note: BrewingNote, now: () => number): ImageSnapshot {
  return {
    noteId: note.id,
    images: getBrewingNoteImages(note),
    updatedAt: effectiveTimestamp(note, now),
  };
}

function buildImageRecord(
  snapshot: ImageSnapshot,
  existing: readonly BrewingNoteImageMetadata[],
  identity: IdentityAllocator,
  fileStore: NativeImageFileStore
): Promise<{ metadata: BrewingNoteImageMetadata[]; writes: PlannedFile[] }> {
  return (async () => {
    const previousOriginals = noteOriginalRows(existing);
    const consumedImageIds = new Set<string>();
    const sources = classifyImages(snapshot.images);
    const metadata: BrewingNoteImageMetadata[] = [];
    const writes: PlannedFile[] = [];

    for (const [position, source] of sources.entries()) {
      const previous = await findReusableSource(
        source,
        previousOriginals,
        consumedImageIds,
        fileStore
      );
      if (previous) {
        consumedImageIds.add(previous.imageId);
        metadata.push({
          ...previous,
          position,
          updatedAt: snapshot.updatedAt,
        });
        continue;
      }

      if (source.kind === 'external') {
        metadata.push(
          externalMetadata(
            snapshot.noteId,
            position,
            snapshot.updatedAt,
            source.url,
            identity
          )
        );
        continue;
      }

      const planned = fileMetadata(
        snapshot.noteId,
        position,
        snapshot.updatedAt,
        source,
        identity
      );
      metadata.push(planned.metadata);
      writes.push(planned);
    }

    validateDesiredMetadata(metadata);
    return { metadata, writes };
  })();
}

function validateNote(note: BrewingNote): void {
  // Validate the inline image shape before stripBrewingNoteImages hides it.
  encodeBrewingNote(note);
  encodeBrewingNote(stripBrewingNoteImages(note));
}

async function persistTransactionAndCleanup(
  driver: SqliteDriver,
  fileStore: NativeImageFileStore,
  work: (executor: SqliteExecutor) => Promise<void>,
  created: readonly Pick<PlannedFile, 'relativePath'>[],
  supersededPaths: readonly string[],
  reportCleanupError: (message: string) => void
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

export interface PreparedBrewingNoteImageWrite {
  note: BrewingNote;
  metadata: BrewingNoteImageMetadata[];
  created: Array<{ objectKey: string; relativePath: string }>;
  supersededPaths: string[];
  apply(executor: SqliteExecutor): Promise<void>;
}

/** Internal ID-based selection never accepts filesystem paths or external source URLs. */
export type BrewingNoteImageSelection =
  | { appendImages: readonly string[] }
  | { imageIds: readonly string[] }
  | { replaceImage: { imageId: string; image: string } };

/** Prepare file objects, but leave metadata/record commit to the caller's transaction. */
export async function prepareBrewingNoteImageWrite(
  executor: SqliteExecutor,
  fileStore: NativeImageFileStore,
  note: BrewingNote,
  options: SqliteBrewingNotePersistenceOptions = {},
  selection?: BrewingNoteImageSelection
): Promise<PreparedBrewingNoteImageWrite> {
  validateNote(note);
  const cleanNote = stripBrewingNoteImages(note);
  const existing = await listBrewingNoteImageMetadata(executor, note.id);
  validateStoredPaths(existing);
  const identity = createIdentityAllocator(
    options.imageIdFactory ?? nanoid,
    options.objectKeyFactory ?? createImageObjectKey,
    existing
  );
  const now = options.now ?? Date.now;
  let plan: { metadata: BrewingNoteImageMetadata[]; writes: PlannedFile[] };
  if (selection && 'imageIds' in selection) {
    const originals = noteOriginalRows(existing);
    const byId = new Map(originals.map(row => [row.imageId, row]));
    if (
      new Set(selection.imageIds).size !== selection.imageIds.length ||
      selection.imageIds.some(id => !byId.has(id))
    )
      throw new Error('Invalid note image selection');
    plan = {
      metadata: selection.imageIds.flatMap((id, position) => {
        const original = byId.get(id)!;
        return existing
          .filter(row => row.position === original.position)
          .map(row => ({ ...row, position }));
      }),
      writes: [],
    };
  } else if (selection && 'replaceImage' in selection) {
    const original = noteOriginalRows(existing).find(
      row => row.imageId === selection.replaceImage.imageId
    );
    if (!original) throw new Error('Unknown note image');
    const replacement = await buildImageRecord(
      {
        noteId: note.id,
        images: [selection.replaceImage.image],
        updatedAt: effectiveTimestamp(note, now),
      },
      existing.filter(row => row.position === original.position),
      identity,
      fileStore
    );
    plan = {
      metadata: [
        ...existing.filter(row => row.position !== original.position),
        ...replacement.metadata.map(row => ({
          ...row,
          position: original.position,
        })),
      ].sort((a, b) => a.position - b.position),
      writes: replacement.writes,
    };
  } else if (selection && 'appendImages' in selection) {
    const added = await buildImageRecord(
      {
        noteId: note.id,
        images: [...selection.appendImages],
        updatedAt: effectiveTimestamp(note, now),
      },
      [],
      identity,
      fileStore
    );
    const position = existing.length
      ? Math.max(...existing.map(row => row.position)) + 1
      : 0;
    plan = {
      metadata: [
        ...existing,
        ...added.metadata.map(row => ({
          ...row,
          position: row.position + position,
        })),
      ],
      writes: added.writes,
    };
  } else {
    plan = await buildImageRecord(
      imageSnapshot(note, now),
      existing,
      identity,
      fileStore
    );
  }
  validateDesiredMetadata(plan.metadata);
  await assertPlannedObjectsAbsent(executor, fileStore, plan.writes);
  const created = await writePlannedObjects(
    executor,
    fileStore,
    plan.writes,
    createCleanupReporter(options.onCleanupError)
  );
  const supersededPaths = replacedFilePaths(existing, plan.metadata);
  return {
    note: cleanNote,
    metadata: plan.metadata,
    created,
    supersededPaths,
    async apply(tx) {
      await replaceBrewingNoteImageMetadata(tx, note.id, plan.metadata);
      await saveBrewingNote(tx, cleanNote);
    },
  };
}

export async function cleanupPreparedBrewingNoteImageFiles(
  executor: SqliteExecutor,
  fileStore: NativeImageFileStore,
  paths: readonly string[],
  error?: unknown
): Promise<void> {
  if (hasRollbackDiagnostic(error)) return;
  await cleanupUnreferencedPaths(
    executor,
    fileStore,
    paths,
    createCleanupReporter()
  );
}

export function createSqliteBrewingNotePersistence(
  driver: SqliteDriver,
  fileStore: NativeImageFileStore,
  options: SqliteBrewingNotePersistenceOptions = {}
): BrewingNotePersistence {
  const imageIdFactory = options.imageIdFactory ?? nanoid;
  const objectKeyFactory = options.objectKeyFactory ?? createImageObjectKey;
  const now = options.now ?? Date.now;
  const reportCleanupError = createCleanupReporter(options.onCleanupError);
  const coordinator = coordinatorFor(driver);

  function makeIdentity(existing: readonly BrewingNoteImageMetadata[]) {
    return createIdentityAllocator(imageIdFactory, objectKeyFactory, existing);
  }

  return {
    async saveWithImages(note, saveOptions) {
      const expectedSnapshot = brewingNoteSnapshot(saveOptions?.expectedRecord);
      const cleanNote = stripBrewingNoteImages(note);
      validateNote(note);

      return coordinator.withOwners([note.id], async () => {
        if (!hasImageFieldUpdate(note)) {
          await driver.transaction(async tx => {
            if (expectedSnapshot !== undefined)
              assertRecordUnchanged(
                brewingNoteSnapshot(await getBrewingNote(tx, note.id)),
                expectedSnapshot
              );
            await saveBrewingNote(tx, cleanNote);
          });
          return cleanNote;
        }

        const prepared = await prepareBrewingNoteImageWrite(
          driver,
          fileStore,
          note,
          options
        );
        const { created, supersededPaths } = prepared;

        await persistTransactionAndCleanup(
          driver,
          fileStore,
          async tx => {
            if (expectedSnapshot !== undefined)
              assertRecordUnchanged(
                brewingNoteSnapshot(await getBrewingNote(tx, note.id)),
                expectedSnapshot
              );
            await prepared.apply(tx);
          },
          created,
          supersededPaths,
          reportCleanupError
        );
        return cleanNote;
      });
    },

    async deleteWithImages(id, deleteOptions) {
      const expectedSnapshot = brewingNoteSnapshot(
        deleteOptions?.expectedRecord
      );
      await coordinator.withOwners([id], async () => {
        const existing = await listBrewingNoteImageMetadata(driver, id);
        validateStoredPaths(existing);
        await persistTransactionAndCleanup(
          driver,
          fileStore,
          async tx => {
            if (expectedSnapshot !== undefined)
              assertRecordUnchanged(
                brewingNoteSnapshot(await getBrewingNote(tx, id)),
                expectedSnapshot
              );
            await deleteBrewingNote(tx, id);
            await replaceBrewingNoteImageMetadata(tx, id, []);
          },
          [],
          filePaths(existing),
          reportCleanupError
        );
      });
    },

    async deleteManyWithImages(ids) {
      const uniqueIds = Array.from(new Set(ids));
      if (uniqueIds.length === 0) return;

      await coordinator.withOwners(uniqueIds, async () => {
        const metadataById = new Map<string, BrewingNoteImageMetadata[]>();
        for (const id of uniqueIds) {
          const rows = await listBrewingNoteImageMetadata(driver, id);
          validateStoredPaths(rows);
          metadataById.set(id, rows);
        }
        const oldPaths = Array.from(metadataById.values()).flatMap(filePaths);

        await persistTransactionAndCleanup(
          driver,
          fileStore,
          async tx => {
            await deleteManyBrewingNotes(tx, uniqueIds);
            for (const id of uniqueIds) {
              await replaceBrewingNoteImageMetadata(tx, id, []);
            }
          },
          [],
          oldPaths,
          reportCleanupError
        );
      });
    },

    async replaceAllWithImages(notes, replaceOptions) {
      return coordinator.withExclusive(async () => {
        const snapshot = await driver.transaction(async tx => {
          const existingCount = await countBrewingNotes(tx);
          if (
            shouldSkipDestructiveReplace({
              nextCount: notes.length,
              existingCount,
              allowEmptyReplace: replaceOptions?.allowEmptyReplace,
              allowDestructiveReplace: replaceOptions?.allowDestructiveReplace,
            })
          ) {
            return { skipped: true as const };
          }

          const [existingNotes, allMetadata] = await Promise.all([
            listBrewingNotes(tx),
            listAllBrewingNoteImageMetadata(tx),
          ]);
          return {
            skipped: false as const,
            existingNotes,
            allMetadata,
          };
        });
        if (snapshot.skipped) return false;

        const cleanNotes = notes.map(stripBrewingNoteImages);
        notes.forEach(validateNote);
        validateStoredPaths(snapshot.allMetadata);

        const incomingIds = cleanNotes.map(note => note.id);
        const incomingIdSet = new Set(incomingIds);
        const staleNoteIds = snapshot.existingNotes
          .map(note => note.id)
          .filter(id => !incomingIdSet.has(id));
        const validImageRecords = new Map<string, ImageSnapshot>();
        const explicitEmptyIds = new Set<string>();
        for (const note of notes) {
          const images = getBrewingNoteImages(note);
          if (images.length > 0) {
            validImageRecords.set(note.id, {
              noteId: note.id,
              images,
              updatedAt: effectiveTimestamp(note, now),
            });
          } else if (hasImageFieldUpdate(note)) {
            explicitEmptyIds.add(note.id);
          }
        }

        const existingByOwner = metadataByOwner(snapshot.allMetadata);
        const identity = makeIdentity(snapshot.allMetadata);
        const ownersToReplace = new Set<string>([
          ...Array.from(existingByOwner.keys()).filter(
            id => !incomingIdSet.has(id)
          ),
          ...Array.from(explicitEmptyIds).filter(
            id => !validImageRecords.has(id)
          ),
          ...validImageRecords.keys(),
        ]);
        const desiredByOwner = new Map<
          string,
          { metadata: BrewingNoteImageMetadata[]; writes: PlannedFile[] }
        >();

        for (const noteId of ownersToReplace) {
          const previous = existingByOwner.get(noteId) ?? [];
          const imageRecord = validImageRecords.get(noteId);
          if (!imageRecord) {
            desiredByOwner.set(noteId, { metadata: [], writes: [] });
            continue;
          }
          desiredByOwner.set(
            noteId,
            await buildImageRecord(imageRecord, previous, identity, fileStore)
          );
        }

        const allDesired = Array.from(desiredByOwner.values()).flatMap(
          value => value.metadata
        );
        const allWrites = Array.from(desiredByOwner.values()).flatMap(
          value => value.writes
        );
        validateDesiredMetadata(allDesired);
        await assertPlannedObjectsAbsent(driver, fileStore, allWrites);
        const created = await writePlannedObjects(
          driver,
          fileStore,
          allWrites,
          reportCleanupError
        );

        const preservedMetadata = Array.from(existingByOwner.entries())
          .filter(([id]) => !ownersToReplace.has(id))
          .flatMap(([, rows]) => rows);
        const supersededPaths = replacedFilePaths(snapshot.allMetadata, [
          ...preservedMetadata,
          ...allDesired,
        ]);

        await persistTransactionAndCleanup(
          driver,
          fileStore,
          async tx => {
            await upsertManyBrewingNotes(tx, cleanNotes);
            await deleteManyBrewingNotes(tx, staleNoteIds);
            for (const noteId of Array.from(ownersToReplace).sort()) {
              await replaceBrewingNoteImageMetadata(
                tx,
                noteId,
                desiredByOwner.get(noteId)?.metadata ?? []
              );
            }
          },
          created,
          supersededPaths,
          reportCleanupError
        );
        return true;
      });
    },

    async clearWithImages() {
      await coordinator.withExclusive(async () => {
        const current = await listAllBrewingNoteImageMetadata(driver);
        validateStoredPaths(current);
        await persistTransactionAndCleanup(
          driver,
          fileStore,
          async tx => {
            await clearBrewingNotes(tx);
            await tx.execute('DELETE FROM brewing_note_images');
          },
          [],
          filePaths(current),
          reportCleanupError
        );
      });
    },
  };
}
