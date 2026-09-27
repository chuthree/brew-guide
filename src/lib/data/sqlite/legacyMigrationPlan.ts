import type { BrewingNote } from '@/lib/core/config';
import type {
  LegacyDatabaseInfo,
  LegacyHistoricalData,
  LegacyMigrationData,
} from '@/lib/data/legacy/legacyDexieReader';
import {
  LEGACY_LOCAL_STORAGE_MIGRATION_KEYS,
  type LegacyLocalStorageMigrationKey,
  type LegacyLocalStorageSnapshot,
} from '@/lib/data/legacy/legacyLocalStorageReader';
import type { CoffeeBean } from '@/types/app';
import {
  encodeAppSettings,
  encodeBrewingNote,
  encodeCoffeeBean,
  encodeCustomEquipment,
  encodeCustomMethods,
  encodeGrinder,
  encodeHistoricalYearlyReport,
  encodeLegacySetting,
  encodePendingOperation,
} from './codecs';
import {
  encodeBrewingNoteImageMetadata,
  encodeCoffeeBeanImageMetadata,
} from './imageMetadata';
import type {
  AppSettingsRow,
  BrewingNoteImageMetadataRow,
  BrewingNoteRow,
  CoffeeBeanImageMetadataRow,
  CoffeeBeanRow,
  CustomEquipmentRow,
  CustomMethodsRow,
  GrinderRow,
  HistoricalYearlyReportRow,
  LegacySourcePresenceMap,
  LegacySettingsRow,
  PendingOperationRow,
} from './schemaV1';
import { decodeImageDataUrl } from '../images/imageBinary';
import { validateExternalImageUrl } from '../images/persistentImageSource';
import {
  toImageRelativePath,
  type ImageObjectKey,
} from '../images/nativeImageFileStore';
import {
  getBrewingNoteImages,
  type BrewingNoteImageRecord,
} from '@/lib/notes/imageRecords';
import {
  type CoffeeBeanImageRecord,
  type CoffeeBeanImageThumbnailRecord,
} from '@/lib/coffee-beans/imageRecords';
import {
  mapLegacyBrewingNoteImages,
  mapLegacyCoffeeBeanImages,
} from './legacyImageMapper';

export interface LegacyMigrationImageFile {
  objectKey: ImageObjectKey;
  /** Reference to the preflighted source string; bytes are decoded on demand. */
  dataUrl: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}

export interface LegacySqliteMigrationPlan {
  sourceVersion: number | null;
  sourcePresence: LegacySourcePresenceMap;
  legacyLocalStoragePresence: Record<LegacyLocalStorageMigrationKey, boolean>;
  rows: {
    coffeeBeans: CoffeeBeanRow[];
    brewingNotes: BrewingNoteRow[];
    customEquipments: CustomEquipmentRow[];
    customMethods: CustomMethodsRow[];
    grinders: GrinderRow[];
    appSettings: AppSettingsRow[];
    legacySettings: LegacySettingsRow[];
    pendingOperations: PendingOperationRow[];
    historicalYearlyReports: HistoricalYearlyReportRow[];
    coffeeBeanImages: CoffeeBeanImageMetadataRow[];
    brewingNoteImages: BrewingNoteImageMetadataRow[];
  };
  imageFiles: LegacyMigrationImageFile[];
}

export interface LegacyMigrationSource {
  /** null means Dexie.exists() confirmed BrewGuideDB is absent. */
  info: LegacyDatabaseInfo | null;
  active: LegacyMigrationData;
  historical: LegacyHistoricalData;
  localStorage: LegacyLocalStorageSnapshot;
}

const TABLES = [
  'coffeeBeans',
  'brewingNotes',
  'coffeeBeanImages',
  'coffeeBeanImageThumbnails',
  'brewingNoteImages',
  'brewingNoteImageThumbnails',
  'customEquipments',
  'customMethods',
  'grinders',
  'appSettings',
  'settings',
  'pendingOperations',
] as const;

const IMAGE_FIELDS = {
  coffeeBeanImages: new Set([
    'beanId',
    'image',
    'backImage',
    'imageThumbnail',
    'backImageThumbnail',
    'updatedAt',
  ]),
  coffeeBeanImageThumbnails: new Set([
    'beanId',
    'imageThumbnail',
    'backImageThumbnail',
    'updatedAt',
  ]),
  brewingNoteImages: new Set(['noteId', 'image', 'images', 'updatedAt']),
  brewingNoteImageThumbnails: new Set([
    'noteId',
    'imageThumbnail',
    'imageThumbnails',
    'updatedAt',
  ]),
} as const;

function fail(table: string, id: string | undefined, reason: string): never {
  throw new Error(
    'Legacy migration preflight failed at ' +
      table +
      (id ? ' record ' + id : '') +
      ': ' +
      reason
  );
}

function record(
  value: unknown,
  table: string,
  index: number
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    fail(table, String(index), 'expected a plain object');
  }
  return value as Record<string, unknown>;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

function localStorageFailure(key: string, reason: string): never {
  return fail('localStorage', key, reason);
}

type ParsedLegacyJson = { present: false } | { present: true; value: unknown };

function parseLegacyLocalStorageJson(
  source: LegacyLocalStorageSnapshot,
  key: LegacyLocalStorageMigrationKey
): ParsedLegacyJson {
  const raw = source[key];
  if (raw === null || raw === '') return { present: false };
  try {
    return { present: true, value: JSON.parse(raw) };
  } catch {
    return localStorageFailure(key, 'contains invalid JSON');
  }
}

function legacySettingsFromLocalStorage(
  source: LegacyLocalStorageSnapshot
): Record<string, unknown> | undefined {
  const parsed = parseLegacyLocalStorageJson(source, 'brewGuideSettings');
  if (!parsed.present) return undefined;

  let settings = parsed.value;
  if (
    isPlainRecord(settings) &&
    isPlainRecord(settings.state) &&
    settings.state.settings
  ) {
    settings = settings.state.settings;
  }
  if (!isPlainRecord(settings)) {
    return localStorageFailure(
      'brewGuideSettings',
      'expected a settings object'
    );
  }
  return settings;
}

function roasterConfigsFromLocalStorage(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    return localStorageFailure('roaster-logos', 'expected an array');
  }
  return value.map((config, index) => {
    if (!isPlainRecord(config)) {
      return localStorageFailure(
        'roaster-logos',
        'entry ' + index + ' must be an object'
      );
    }
    // Keep unknown historical fields and do not synthesize updatedAt. The
    // old Dexie initializer used Date.now() here, which is non-deterministic.
    return { ...config };
  });
}

function equipmentOrderFromLocalStorage(value: unknown): unknown {
  if (!isPlainRecord(value)) {
    return localStorageFailure('equipmentOrder', 'expected an object');
  }
  if (!Object.prototype.hasOwnProperty.call(value, 'equipmentIds')) return [];
  if (!Array.isArray(value.equipmentIds)) {
    return localStorageFailure(
      'equipmentOrder',
      'equipmentIds must be an array'
    );
  }
  return value.equipmentIds;
}

function isEmptyArrayLike(value: unknown): boolean {
  if (!value) return true;
  return (
    typeof value === 'object' &&
    value !== null &&
    'length' in value &&
    (value as { length?: unknown }).length === 0
  );
}

function isEmptyObjectLike(value: unknown): boolean {
  if (!value) return true;
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}

function applySupplementalSettings(
  settings: Record<string, unknown>,
  source: LegacyLocalStorageSnapshot,
  onlyFillEmpty: boolean
): Record<string, unknown> {
  const result = { ...settings };
  if (!onlyFillEmpty || isEmptyArrayLike(result.flavorDimensions)) {
    const flavorDimensions = parseLegacyLocalStorageJson(
      source,
      'customFlavorDimensions'
    );
    if (flavorDimensions.present) {
      result.flavorDimensions = flavorDimensions.value;
    }
  }

  if (
    !onlyFillEmpty ||
    isEmptyObjectLike(result.flavorDimensionHistoricalLabels)
  ) {
    const historicalLabels = parseLegacyLocalStorageJson(
      source,
      'flavorDimensionHistoricalLabels'
    );
    if (historicalLabels.present) {
      result.flavorDimensionHistoricalLabels = historicalLabels.value;
    }
  }

  if (!onlyFillEmpty || isEmptyArrayLike(result.roasterConfigs)) {
    const roasterLogos = parseLegacyLocalStorageJson(source, 'roaster-logos');
    if (roasterLogos.present) {
      if (!Array.isArray(roasterLogos.value)) {
        return localStorageFailure('roaster-logos', 'expected an array');
      }
      if (roasterLogos.value.length > 0) {
        result.roasterConfigs = roasterConfigsFromLocalStorage(
          roasterLogos.value
        );
      }
    }
  }

  if (!onlyFillEmpty || isEmptyArrayLike(result.equipmentOrder)) {
    const equipmentOrder = parseLegacyLocalStorageJson(
      source,
      'equipmentOrder'
    );
    if (equipmentOrder.present) {
      result.equipmentOrder = equipmentOrderFromLocalStorage(
        equipmentOrder.value
      );
    }
  }
  return result;
}

function appSettingsRows(
  records: Record<string, unknown>[],
  source: LegacyLocalStorageSnapshot,
  localSettings: Record<string, unknown> | undefined
): AppSettingsRow[] {
  let hasMain = false;
  const rows = records.map(raw => {
    const id = idOf(raw, 'id', 'appSettings');
    if (id !== 'main') return encodeAppSettings(raw);
    hasMain = true;
    const data = raw.data;
    if (!isPlainRecord(data)) {
      return fail('appSettings', id, 'data must be a plain object');
    }
    return encodeAppSettings({
      ...raw,
      data: applySupplementalSettings(data, source, true),
    });
  });

  const hasSupplementalStorage = (
    [
      'roaster-logos',
      'customFlavorDimensions',
      'flavorDimensionHistoricalLabels',
      'equipmentOrder',
    ] as const
  ).some(key => Boolean(source[key]));
  if (!hasMain && (localSettings || hasSupplementalStorage)) {
    const data = { ...(localSettings ?? {}) };
    if (Object.prototype.hasOwnProperty.call(data, 'grinders')) {
      if (!Array.isArray(data.grinders)) {
        return fail(
          'localStorage',
          'brewGuideSettings',
          'grinders must be an array when present'
        );
      }
      delete data.grinders;
    }
    rows.push(
      encodeAppSettings({
        id: 'main',
        data: applySupplementalSettings(data, source, false),
      })
    );
  }
  return rows;
}

function assertUniqueIds(rows: readonly { id: string }[], table: string): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) fail(table, row.id, 'duplicate source primary key');
    seen.add(row.id);
  }
}

function grinderRows(
  records: Record<string, unknown>[],
  localSettings: Record<string, unknown> | undefined
): GrinderRow[] {
  const rows = records.map(encodeGrinder);
  if (rows.length === 0 && localSettings) {
    const grinders = localSettings.grinders;
    if (grinders !== undefined) {
      if (!Array.isArray(grinders)) {
        return fail(
          'localStorage',
          'brewGuideSettings',
          'grinders must be an array when present'
        );
      }
      rows.push(...grinders.map(encodeGrinder));
    }
  }
  assertUniqueIds(rows, 'grinders');
  return rows;
}

function customEquipmentRows(
  records: Record<string, unknown>[],
  settings: Record<string, unknown>[]
): CustomEquipmentRow[] {
  const rows = records.map(encodeCustomEquipment);
  if (rows.length === 0) {
    const legacyValue = settings.find(
      entry => entry.key === 'customEquipments'
    )?.value;
    if (typeof legacyValue === 'string' && legacyValue !== '') {
      let parsed: unknown;
      try {
        parsed = JSON.parse(legacyValue);
      } catch {
        return fail(
          'settings',
          'customEquipments',
          'contains invalid JSON for the legacy equipment fallback'
        );
      }
      if (!Array.isArray(parsed)) {
        return fail(
          'settings',
          'customEquipments',
          'legacy equipment fallback must be an array'
        );
      }
      rows.push(...parsed.map(encodeCustomEquipment));
    }
  }
  assertUniqueIds(rows, 'customEquipments');
  return rows;
}

function idOf(
  value: Record<string, unknown>,
  field: string,
  table: string
): string {
  const id = value[field];
  if (typeof id !== 'string' || id.length === 0) {
    fail(table, undefined, field + ' must be a non-empty string');
  }
  return id;
}

function assertKnownImageFields(
  value: Record<string, unknown>,
  table: keyof typeof IMAGE_FIELDS,
  id: string
): void {
  for (const field of Object.keys(value)) {
    if (!IMAGE_FIELDS[table].has(field as never)) {
      fail(table, id, 'unmapped source field ' + field);
    }
  }
}

function activeRecords(
  source: LegacyMigrationSource,
  table: (typeof TABLES)[number],
  actualTables: ReadonlySet<string>
): Record<string, unknown>[] {
  const result = source.active[table];
  const actual = actualTables.has(table);
  if ((result.status === 'present') !== actual) {
    fail(table, undefined, 'source table presence changed during read');
  }
  if (!Array.isArray(result.records))
    fail(table, undefined, 'records are unavailable');
  if (result.status === 'absent' && result.records.length > 0) {
    fail(table, undefined, 'absent table returned records');
  }
  return result.records.map((entry, index) => record(entry, table, index));
}

function actualTableNames(source: LegacyMigrationSource): Set<string> {
  if (source.info === null) {
    for (const table of TABLES) {
      if (
        source.active[table].status !== 'absent' ||
        source.active[table].records.length > 0
      ) {
        fail(
          table,
          undefined,
          'database is absent but source records were returned'
        );
      }
    }
    if (
      source.historical.yearlyReports.status !== 'absent' ||
      source.historical.yearlyReports.records.length > 0
    ) {
      fail(
        'yearlyReports',
        undefined,
        'database is absent but records were returned'
      );
    }
    return new Set();
  }
  if (!Number.isSafeInteger(source.info.version) || source.info.version < 1) {
    fail('BrewGuideDB', undefined, 'source version is invalid');
  }
  const allowed = new Set<string>([...TABLES, 'yearlyReports']);
  const names = new Set(source.info.tables.map(table => table.name));
  for (const name of names) {
    if (!allowed.has(name)) {
      fail(name, undefined, 'source table has no SQLite v1 migration mapping');
    }
  }
  return names;
}

function readPresence(
  source: LegacyMigrationSource,
  names: ReadonlySet<string>,
  table: string
): 'absent' | 'present-empty' | 'present-data' {
  const result =
    table === 'yearlyReports'
      ? source.historical.yearlyReports
      : source.active[table as (typeof TABLES)[number]];
  if (!names.has(table)) return 'absent';
  if (result.status !== 'present') {
    fail(table, undefined, 'inspection and read disagree');
  }
  return result.records.length === 0 ? 'present-empty' : 'present-data';
}

function sourcePresence(
  source: LegacyMigrationSource,
  names: ReadonlySet<string>
): LegacySourcePresenceMap {
  return {
    coffeeBeans: readPresence(source, names, 'coffeeBeans'),
    brewingNotes: readPresence(source, names, 'brewingNotes'),
    coffeeBeanImages: readPresence(source, names, 'coffeeBeanImages'),
    coffeeBeanImageThumbnails: readPresence(
      source,
      names,
      'coffeeBeanImageThumbnails'
    ),
    brewingNoteImages: readPresence(source, names, 'brewingNoteImages'),
    brewingNoteImageThumbnails: readPresence(
      source,
      names,
      'brewingNoteImageThumbnails'
    ),
    customEquipments: readPresence(source, names, 'customEquipments'),
    customMethods: readPresence(source, names, 'customMethods'),
    grinders: readPresence(source, names, 'grinders'),
    appSettings: readPresence(source, names, 'appSettings'),
    settings: readPresence(source, names, 'settings'),
    pendingOperations: readPresence(source, names, 'pendingOperations'),
    yearlyReports: readPresence(source, names, 'yearlyReports'),
  };
}

function recordsByOwner(
  rows: readonly Record<string, unknown>[],
  ownerKey: 'beanId' | 'noteId',
  table: keyof typeof IMAGE_FIELDS
): Map<string, Record<string, unknown>> {
  const result = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const id = idOf(row, ownerKey, table);
    assertKnownImageFields(row, table, id);
    if (result.has(id)) fail(table, id, 'duplicate source owner');
    result.set(id, row);
  }
  return result;
}

function assertImageValue(
  value: unknown,
  table: string,
  id: string,
  field: string,
  variant: 'original' | 'thumbnail'
): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    fail(table, id, field + ' must be a string, null, or absent');
  }
  try {
    if (value.startsWith('data:')) {
      decodeImageDataUrl(value);
      return value;
    }
    validateExternalImageUrl(value);
    if (variant === 'thumbnail') {
      fail(
        table,
        id,
        field + ' is an external thumbnail unsupported by SQLite v1'
      );
    }
    return value;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('Legacy migration preflight failed')
    ) {
      throw error;
    }
    fail(
      table,
      id,
      field + ' is not a supported image Data URL or absolute HTTP(S) URL'
    );
  }
}

function denseArray(
  value: unknown,
  table: string,
  id: string,
  field: string
): unknown[] {
  if (!Array.isArray(value)) fail(table, id, field + ' must be an array');
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) {
      fail(table, id, field + '[' + index + '] is a sparse array hole');
    }
  }
  return value;
}

function noteImages(
  value: Record<string, unknown>,
  table: string,
  id: string
): string[] {
  const list = value.images;
  const values =
    list === undefined || list === null
      ? []
      : denseArray(list, table, id, 'images');
  const arrayTakesPrecedence = values.length > 0;
  const images = arrayTakesPrecedence
    ? values.filter(Boolean).map((image, index) => {
        if (typeof image !== 'string') {
          fail(
            table,
            id,
            'images[' + index + '] must be a string or falsy empty entry'
          );
        }
        return image;
      })
    : value.image
      ? [value.image as string]
      : [];
  if (value.image && arrayTakesPrecedence && value.image !== images[0]) {
    fail(table, id, 'image and images contain conflicting values');
  }
  return images;
}

function groupSame(
  left: readonly string[],
  right: readonly string[],
  table: string,
  id: string
): void {
  if (
    left.length !== right.length ||
    left.some((value, index) => value !== right[index])
  ) {
    fail(table, id, 'inline and split images conflict');
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof TextEncoder === 'undefined') {
    throw new Error('Legacy migration preflight requires Web Crypto SHA-256');
  }
  const digest = await subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

async function tokenFor(identity: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(identity));
}

export async function planLegacySqliteMigration(
  source: LegacyMigrationSource
): Promise<LegacySqliteMigrationPlan> {
  const names = actualTableNames(source);
  const records = Object.fromEntries(
    TABLES.map(table => [table, activeRecords(source, table, names)])
  ) as Record<(typeof TABLES)[number], Record<string, unknown>[]>;
  const hasMainAppSettings = records.appSettings.some(row => row.id === 'main');
  const needsLocalSettings =
    Boolean(source.localStorage.brewGuideSettings) &&
    (records.grinders.length === 0 || !hasMainAppSettings);
  const localSettings = needsLocalSettings
    ? legacySettingsFromLocalStorage(source.localStorage)
    : undefined;
  const historicalResult = source.historical.yearlyReports;
  if ((historicalResult.status === 'present') !== names.has('yearlyReports')) {
    fail('yearlyReports', undefined, 'inspection and read disagree');
  }
  const historical = historicalResult.records.map((entry, index) =>
    record(entry, 'yearlyReports', index)
  );
  const beanRecords = recordsByOwner(
    records.coffeeBeanImages,
    'beanId',
    'coffeeBeanImages'
  );
  const beanThumbnails = recordsByOwner(
    records.coffeeBeanImageThumbnails,
    'beanId',
    'coffeeBeanImageThumbnails'
  );
  const noteRecords = recordsByOwner(
    records.brewingNoteImages,
    'noteId',
    'brewingNoteImages'
  );
  const noteThumbnails = recordsByOwner(
    records.brewingNoteImageThumbnails,
    'noteId',
    'brewingNoteImageThumbnails'
  );

  for (const bean of records.coffeeBeans) {
    const id = idOf(bean, 'id', 'coffeeBeans');
    assertImageValue(bean.image, 'coffeeBeans', id, 'image', 'original');
    assertImageValue(
      bean.backImage,
      'coffeeBeans',
      id,
      'backImage',
      'original'
    );
  }
  for (const note of records.brewingNotes) {
    const id = idOf(note, 'id', 'brewingNotes');
    assertImageValue(note.image, 'brewingNotes', id, 'image', 'original');
    if (note.images !== undefined && note.images !== null) {
      denseArray(note.images, 'brewingNotes', id, 'images').forEach(
        (image, index) => {
          if (image) {
            assertImageValue(
              image,
              'brewingNotes',
              id,
              'images[' + index + ']',
              'original'
            );
          }
        }
      );
    }
  }

  for (const row of records.coffeeBeanImages) {
    const id = idOf(row, 'beanId', 'coffeeBeanImages');
    for (const field of ['image', 'backImage']) {
      assertImageValue(row[field], 'coffeeBeanImages', id, field, 'original');
    }
    for (const field of ['imageThumbnail', 'backImageThumbnail']) {
      assertImageValue(row[field], 'coffeeBeanImages', id, field, 'thumbnail');
    }
  }
  for (const row of records.coffeeBeanImageThumbnails) {
    const id = idOf(row, 'beanId', 'coffeeBeanImageThumbnails');
    for (const field of ['imageThumbnail', 'backImageThumbnail']) {
      assertImageValue(
        row[field],
        'coffeeBeanImageThumbnails',
        id,
        field,
        'thumbnail'
      );
    }
  }
  for (const row of records.brewingNoteImages) {
    const id = idOf(row, 'noteId', 'brewingNoteImages');
    assertImageValue(row.image, 'brewingNoteImages', id, 'image', 'original');
    if (row.images !== undefined && row.images !== null) {
      denseArray(row.images, 'brewingNoteImages', id, 'images').forEach(
        (image, index) => {
          if (image)
            assertImageValue(
              image,
              'brewingNoteImages',
              id,
              'images[' + index + ']',
              'original'
            );
        }
      );
    }
  }
  for (const row of records.brewingNoteImageThumbnails) {
    const id = idOf(row, 'noteId', 'brewingNoteImageThumbnails');
    assertImageValue(
      row.imageThumbnail,
      'brewingNoteImageThumbnails',
      id,
      'imageThumbnail',
      'thumbnail'
    );
    if (row.imageThumbnails !== undefined && row.imageThumbnails !== null) {
      denseArray(
        row.imageThumbnails,
        'brewingNoteImageThumbnails',
        id,
        'imageThumbnails'
      ).forEach((image, index) => {
        if (image) {
          assertImageValue(
            image,
            'brewingNoteImageThumbnails',
            id,
            'imageThumbnails[' + index + ']',
            'thumbnail'
          );
        }
      });
    }
  }

  const plan: LegacySqliteMigrationPlan = {
    sourceVersion: source.info?.version ?? null,
    sourcePresence: sourcePresence(source, names),
    legacyLocalStoragePresence: Object.fromEntries(
      LEGACY_LOCAL_STORAGE_MIGRATION_KEYS.map(key => [
        key,
        source.localStorage[key] !== null,
      ])
    ) as Record<LegacyLocalStorageMigrationKey, boolean>,
    rows: {
      coffeeBeans: [],
      brewingNotes: [],
      customEquipments: customEquipmentRows(
        records.customEquipments,
        records.settings
      ),
      customMethods: records.customMethods.map(encodeCustomMethods),
      grinders: grinderRows(records.grinders, localSettings),
      appSettings: appSettingsRows(
        records.appSettings,
        source.localStorage,
        localSettings
      ),
      legacySettings: records.settings.map(encodeLegacySetting),
      pendingOperations: records.pendingOperations.map(encodePendingOperation),
      historicalYearlyReports: historical.map(encodeHistoricalYearlyReport),
      coffeeBeanImages: [],
      brewingNoteImages: [],
    },
    imageFiles: [],
  };
  const beanIds = new Set<string>();
  const noteIds = new Set<string>();
  const beanImageIdentities = new Set<string>();
  const noteImageIdentities = new Set<string>();

  const addBeanImage = async (
    beanId: string,
    slot: 'front' | 'back',
    variant: 'original' | 'thumbnail',
    value: unknown,
    updatedAt: unknown
  ): Promise<void> => {
    const table =
      variant === 'thumbnail' ? 'coffeeBeanImageThumbnails' : 'coffeeBeans';
    const image = assertImageValue(value, table, beanId, slot, variant);
    if (!image) return;
    const unique = JSON.stringify([beanId, slot, variant]);
    if (beanImageIdentities.has(unique))
      fail(table, beanId, 'duplicate image slot');
    beanImageIdentities.add(unique);
    const token = await tokenFor(JSON.stringify(['legacy-v1', 'bean', unique]));
    const imageId = 'legacy-' + token;
    const updated = updatedAt === undefined ? {} : { updatedAt };
    if (image.startsWith('data:')) {
      const binary = decodeImageDataUrl(image);
      const sha256 = await sha256Hex(binary.bytes);
      const objectKey = 'mig_' + token;
      plan.rows.coffeeBeanImages.push(
        encodeCoffeeBeanImageMetadata({
          imageId,
          beanId,
          slot,
          variant,
          sourceKind: 'file',
          relativePath: toImageRelativePath(objectKey),
          mimeType: binary.mimeType,
          sizeBytes: binary.bytes.byteLength,
          ...updated,
        })
      );
      plan.imageFiles.push({
        objectKey,
        dataUrl: image,
        mimeType: binary.mimeType,
        sizeBytes: binary.bytes.byteLength,
        sha256,
      });
    } else {
      plan.rows.coffeeBeanImages.push(
        encodeCoffeeBeanImageMetadata({
          imageId,
          beanId,
          slot,
          sourceKind: 'external',
          variant: 'original',
          externalUrl: image,
          ...updated,
        })
      );
    }
  };

  const addNoteImage = async (
    noteId: string,
    position: number,
    variant: 'original' | 'thumbnail',
    value: unknown,
    updatedAt: unknown
  ): Promise<void> => {
    const table =
      variant === 'thumbnail' ? 'brewingNoteImageThumbnails' : 'brewingNotes';
    const image = assertImageValue(
      value,
      table,
      noteId,
      'images[' + position + ']',
      variant
    );
    if (!image) return;
    const unique = JSON.stringify([noteId, position, variant]);
    if (noteImageIdentities.has(unique))
      fail(table, noteId, 'duplicate image position');
    noteImageIdentities.add(unique);
    const token = await tokenFor(JSON.stringify(['legacy-v1', 'note', unique]));
    const imageId = 'legacy-' + token;
    const updated = updatedAt === undefined ? {} : { updatedAt };
    if (image.startsWith('data:')) {
      const binary = decodeImageDataUrl(image);
      const sha256 = await sha256Hex(binary.bytes);
      const objectKey = 'mig_' + token;
      plan.rows.brewingNoteImages.push(
        encodeBrewingNoteImageMetadata({
          imageId,
          noteId,
          position,
          variant,
          sourceKind: 'file',
          relativePath: toImageRelativePath(objectKey),
          mimeType: binary.mimeType,
          sizeBytes: binary.bytes.byteLength,
          ...updated,
        })
      );
      plan.imageFiles.push({
        objectKey,
        dataUrl: image,
        mimeType: binary.mimeType,
        sizeBytes: binary.bytes.byteLength,
        sha256,
      });
    } else {
      plan.rows.brewingNoteImages.push(
        encodeBrewingNoteImageMetadata({
          imageId,
          noteId,
          position,
          variant: 'original',
          sourceKind: 'external',
          externalUrl: image,
          ...updated,
        })
      );
    }
  };

  for (const raw of records.coffeeBeans) {
    const beanId = idOf(raw, 'id', 'coffeeBeans');
    const split = beanRecords.get(beanId);
    const thumbnails = beanThumbnails.get(beanId);
    const resolution = mapLegacyCoffeeBeanImages(
      raw as unknown as CoffeeBean,
      split as unknown as CoffeeBeanImageRecord | undefined,
      thumbnails as unknown as CoffeeBeanImageThumbnailRecord | undefined
    );
    if (resolution.originalConflicts.length > 0) {
      fail('coffeeBeans', beanId, 'inline and split original images conflict');
    }
    plan.rows.coffeeBeans.push(encodeCoffeeBean(resolution.mergedBean).row);
    beanIds.add(beanId);
    for (const image of resolution.canonicalOriginals.front
      ? [{ slot: 'front' as const, data: resolution.canonicalOriginals.front }]
      : []) {
      await addBeanImage(
        beanId,
        image.slot,
        'original',
        image.data,
        split?.updatedAt
      );
    }
    if (resolution.canonicalOriginals.back) {
      await addBeanImage(
        beanId,
        'back',
        'original',
        resolution.canonicalOriginals.back,
        split?.updatedAt
      );
    }
  }

  for (const [beanId, split] of beanRecords) {
    if (beanIds.has(beanId)) continue;
    await addBeanImage(
      beanId,
      'front',
      'original',
      split.image,
      split.updatedAt
    );
    await addBeanImage(
      beanId,
      'back',
      'original',
      split.backImage,
      split.updatedAt
    );
  }

  for (const beanId of new Set([
    ...beanIds,
    ...beanRecords.keys(),
    ...beanThumbnails.keys(),
  ])) {
    const split = beanRecords.get(beanId);
    const thumbnail = beanThumbnails.get(beanId);
    for (const [field, slot] of [
      ['imageThumbnail', 'front'],
      ['backImageThumbnail', 'back'],
    ] as const) {
      const tableValue = thumbnail?.[field];
      const embeddedValue = split?.[field];
      if (tableValue && embeddedValue && tableValue !== embeddedValue) {
        fail(
          'coffeeBeanImageThumbnails',
          beanId,
          field + ' has conflicting stored thumbnails'
        );
      }
      const useTable = Boolean(tableValue);
      await addBeanImage(
        beanId,
        slot,
        'thumbnail',
        tableValue || embeddedValue,
        useTable ? thumbnail?.updatedAt : split?.updatedAt
      );
    }
  }

  for (const raw of records.brewingNotes) {
    const noteId = idOf(raw, 'id', 'brewingNotes');
    const split = noteRecords.get(noteId);
    const inlineImages = noteImages(raw, 'brewingNotes', noteId);
    const splitImages = split
      ? noteImages(split, 'brewingNoteImages', noteId)
      : [];
    const splitOverridesInline = Boolean(
      split &&
      ((Array.isArray(split.images) && split.images.length > 0) || split.image)
    );
    if (splitOverridesInline && inlineImages.length > 0) {
      if (splitImages.length === 0) {
        fail(
          'brewingNoteImages',
          noteId,
          'empty split images would hide inline images'
        );
      }
      groupSame(inlineImages, splitImages, 'brewingNoteImages', noteId);
    }
    const resolution = mapLegacyBrewingNoteImages(
      raw as unknown as BrewingNote,
      split as unknown as BrewingNoteImageRecord | undefined,
      undefined
    );
    if (resolution.originalConflicts.length > 0) {
      fail('brewingNotes', noteId, 'inline and split original images conflict');
    }
    plan.rows.brewingNotes.push(encodeBrewingNote(resolution.mergedNote).row);
    noteIds.add(noteId);
    const images = getBrewingNoteImages(resolution.mergedNote);
    for (let position = 0; position < images.length; position += 1) {
      await addNoteImage(
        noteId,
        position,
        'original',
        images[position],
        splitOverridesInline && splitImages.length > 0
          ? split?.updatedAt
          : undefined
      );
    }
  }

  for (const [noteId, split] of noteRecords) {
    if (noteIds.has(noteId)) continue;
    const images = noteImages(split, 'brewingNoteImages', noteId);
    for (let position = 0; position < images.length; position += 1) {
      await addNoteImage(
        noteId,
        position,
        'original',
        images[position],
        split.updatedAt
      );
    }
  }

  for (const [noteId, thumbnail] of noteThumbnails) {
    let thumbnails: string[];
    const values =
      thumbnail.imageThumbnails === undefined ||
      thumbnail.imageThumbnails === null
        ? []
        : denseArray(
            thumbnail.imageThumbnails,
            'brewingNoteImageThumbnails',
            noteId,
            'imageThumbnails'
          );
    if (values.length > 0) {
      thumbnails = values.map((value, index) => {
        if (value === undefined || value === null || value === '') return '';
        if (typeof value !== 'string') {
          fail(
            'brewingNoteImageThumbnails',
            noteId,
            'imageThumbnails[' + index + '] is not a string'
          );
        }
        return value;
      });
      if (
        thumbnail.imageThumbnail &&
        thumbnails.length > 0 &&
        thumbnail.imageThumbnail !== thumbnails[0]
      ) {
        fail(
          'brewingNoteImageThumbnails',
          noteId,
          'scalar and array thumbnails conflict'
        );
      }
    } else {
      thumbnails =
        thumbnail.imageThumbnail === undefined ||
        thumbnail.imageThumbnail === null
          ? []
          : [thumbnail.imageThumbnail as string];
    }
    for (let position = 0; position < thumbnails.length; position += 1) {
      await addNoteImage(
        noteId,
        position,
        'thumbnail',
        thumbnails[position],
        thumbnail.updatedAt
      );
    }
  }

  const reports = historical.map(encodeHistoricalYearlyReport);
  plan.rows.historicalYearlyReports = reports;

  return plan;
}
