import type {
  AppSettings,
  Grinder,
  StoredPendingOperation,
} from '@/lib/data/models';
import type { BrewingNote, CustomEquipment, Method } from '@/lib/core/config';
import type { CoffeeBean } from '@/types/app';
import type { CoffeeBeanImageRecord } from '@/lib/coffee-beans/imageRecords';
import type { BrewingNoteImageRecord } from '@/lib/notes/imageRecords';
import type { PendingOperation } from '@/lib/supabase/realtime/types';
import type { ImageRecompressionStats } from '@/lib/images/imageRecompression';

export interface LegacySettingEntry {
  key: string;
  value: string;
}

/** Raw string key/value access to the historical IndexedDB settings table. */
export interface LegacySettingsRepository {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  count(): Promise<number>;
  clear(): Promise<void>;
}

export interface RoasterRenamePersistenceResult {
  beans: CoffeeBean[];
  updatedBeans: CoffeeBean[];
  notes: BrewingNote[];
  updatedNotes: BrewingNote[];
  grinders: Grinder[];
  updatedGrinderCount: number;
  settings: AppSettings;
  updatedConfigCount: number;
}

/** Execute the persisted part of a roaster rename as one backend transaction. */
export interface RoasterRenamePersistence {
  renameReferences(input: {
    renames: ReadonlyMap<string, string>;
    now: number;
    /** Preserve the existing Store fallback when the appSettings row is absent. */
    getFallbackSettings: () => AppSettings;
  }): Promise<RoasterRenamePersistenceResult>;
}

/** A string that the current UI can use as an image source. */
export type ImageDisplaySource = string;

export type CoffeeBeanImageSide = 'front' | 'back';
export type CoffeeBeanImageSourceMode = 'thumbnail' | 'original';

export interface CoffeeBeanImageSourceOptions {
  side?: CoffeeBeanImageSide;
  mode?: CoffeeBeanImageSourceMode;
  preferThumbnail?: boolean;
}

export interface CoffeeBeanImageIdsOptions {
  side?: CoffeeBeanImageSide | 'any';
}

export interface ImageRecordCounts {
  records: number;
  thumbnails: number;
}

/** Read and export coffee bean image data without exposing a storage backend. */
export interface CoffeeBeanImageRepository {
  getRecord(beanId: string): Promise<CoffeeBeanImageRecord | undefined>;
  getRecords(beanIds?: string[]): Promise<CoffeeBeanImageRecord[]>;
  getBeanIds(
    beanIds?: string[],
    options?: CoffeeBeanImageIdsOptions
  ): Promise<string[]>;
  getSource(
    beanId: string,
    options?: CoffeeBeanImageSourceOptions
  ): Promise<ImageDisplaySource | undefined>;
  mergeBean(bean: CoffeeBean): Promise<CoffeeBean>;
  mergeBeans(beans: CoffeeBean[]): Promise<CoffeeBean[]>;
  exportAll(): Promise<CoffeeBean[]>;
  getRecordCounts(): Promise<ImageRecordCounts>;
}

export interface CoffeeBeanPersistence {
  /** expectedRecord adds an optimistic guard on native SQLite backends. */
  saveWithImages(
    bean: CoffeeBean,
    options?: { generateThumbnails?: boolean; expectedRecord?: CoffeeBean }
  ): Promise<CoffeeBean>;
  deleteWithImages(
    id: string,
    options?: { expectedRecord?: CoffeeBean }
  ): Promise<void>;
  deleteManyWithImages(ids: string[]): Promise<void>;
  replaceAllWithImages(
    beans: CoffeeBean[],
    options?: {
      allowEmptyReplace?: boolean;
      allowDestructiveReplace?: boolean;
    }
  ): Promise<boolean>;
  clearWithImages(): Promise<void>;
}

/** Read and export brewing note image data without exposing a storage backend. */
export interface BrewingNoteImageRepository {
  getRecord(noteId: string): Promise<BrewingNoteImageRecord | undefined>;
  getNoteIds(noteIds?: string[]): Promise<string[]>;
  getImageCounts(noteIds: string[]): Promise<Map<string, number>>;
  getImages(noteId: string): Promise<ImageDisplaySource[]>;
  mergeNote(note: BrewingNote): Promise<BrewingNote>;
  mergeNotes(notes: BrewingNote[]): Promise<BrewingNote[]>;
  exportAll(): Promise<BrewingNote[]>;
  getRecordCounts(): Promise<ImageRecordCounts>;
}

export interface BrewingNotePersistence {
  /** expectedRecord adds an optimistic guard on native SQLite backends. */
  saveWithImages(
    note: BrewingNote,
    options?: { expectedRecord?: BrewingNote }
  ): Promise<BrewingNote>;
  deleteWithImages(
    id: string,
    options?: { expectedRecord?: BrewingNote }
  ): Promise<void>;
  deleteManyWithImages(ids: string[]): Promise<void>;
  replaceAllWithImages(
    notes: BrewingNote[],
    options?: {
      allowEmptyReplace?: boolean;
      allowDestructiveReplace?: boolean;
    }
  ): Promise<boolean>;
  clearWithImages(): Promise<void>;
}

/** Backend-specific validation of image payloads before batch import/write. */
export interface ImageSourcePayloadValidator {
  validateCoffeeBeans(records: readonly unknown[]): Promise<void>;
  validateBrewingNotes(records: readonly unknown[]): Promise<void>;
}

export interface BrewingNoteNormalizationStats {
  scannedCount: number;
  cleanedCount: number;
}

/** Historical normalization that is specific to an active storage backend. */
export interface BrewingNoteMaintenance {
  normalizeStoredNotes(): Promise<BrewingNoteNormalizationStats>;
}

/** Recompress stored images without exposing the backend's image records. */
export interface ImageMaintenance {
  recompressCoffeeBeanImages(): Promise<ImageRecompressionStats>;
  recompressBrewingNoteImages(): Promise<ImageRecompressionStats>;
}

/** Backend-specific clearing of the app's database data. */
export interface BackendDataMaintenance {
  clearAllData(): Promise<void>;
}

export interface CustomMethodRecord {
  equipmentId: string;
  methods: Method[];
}

/** App settings persisted in the appSettings table (not the legacy settings table). */
export interface AppSettingsRepository {
  get(): Promise<AppSettings | undefined>;
  save(settings: AppSettings): Promise<void>;
  count(): Promise<number>;
  clear(): Promise<void>;
}

export interface GrinderRepository {
  list(): Promise<Grinder[]>;
  count(): Promise<number>;
  save(grinder: Grinder): Promise<void>;
  /** Upsert a batch, matching Dexie's bulkPut behavior. */
  upsertMany(grinders: Grinder[]): Promise<void>;
  delete(id: string): Promise<void>;
  /** Clear the table, then bulk upsert the supplied rows when non-empty. */
  replaceAll(grinders: Grinder[]): Promise<void>;
  clear(): Promise<void>;
}

export interface CustomEquipmentRepository {
  list(): Promise<CustomEquipment[]>;
  get(id: string): Promise<CustomEquipment | undefined>;
  count(): Promise<number>;
  save(equipment: CustomEquipment): Promise<void>;
  /** Upsert a batch, matching Dexie's bulkPut behavior. */
  upsertMany(equipments: CustomEquipment[]): Promise<void>;
  delete(id: string): Promise<void>;
  deleteMany(ids: string[]): Promise<void>;
  /** Clear the table, then bulk upsert the supplied rows when non-empty. */
  replaceAll(equipments: CustomEquipment[]): Promise<void>;
  clear(): Promise<void>;
}

export interface CustomMethodRepository {
  list(): Promise<CustomMethodRecord[]>;
  get(equipmentId: string): Promise<CustomMethodRecord | undefined>;
  count(): Promise<number>;
  save(record: CustomMethodRecord): Promise<void>;
  /** Upsert a batch, matching Dexie's bulkPut behavior. */
  upsertMany(records: CustomMethodRecord[]): Promise<void>;
  delete(equipmentId: string): Promise<void>;
  deleteMany(equipmentIds: string[]): Promise<void>;
  clear(): Promise<void>;
}

export interface CoffeeBeanRepository {
  list(): Promise<CoffeeBean[]>;
  get(id: string): Promise<CoffeeBean | undefined>;
  count(): Promise<number>;
  save(bean: CoffeeBean): Promise<void>;
  /** Upsert a batch, matching Dexie's bulkPut behavior. */
  upsertMany(beans: CoffeeBean[]): Promise<void>;
  delete(id: string): Promise<void>;
  deleteMany(ids: string[]): Promise<void>;
  clear(): Promise<void>;
}

export interface BrewingNoteRepository {
  list(): Promise<BrewingNote[]>;
  /** Returns notes for a bean newest-first by timestamp. */
  listByBeanId(beanId: string): Promise<BrewingNote[]>;
  get(id: string): Promise<BrewingNote | undefined>;
  count(): Promise<number>;
  save(note: BrewingNote): Promise<void>;
  /** Upsert a batch, matching Dexie's bulkPut behavior. */
  upsertMany(notes: BrewingNote[]): Promise<void>;
  delete(id: string): Promise<void>;
  deleteMany(ids: string[]): Promise<void>;
  clear(): Promise<void>;
}

/** Persistence boundary for queued sync operations. */
export interface OfflineQueueRepository {
  findByTarget(
    table: PendingOperation['table'],
    recordId: string
  ): Promise<StoredPendingOperation[]>;
  add(operation: PendingOperation): Promise<void>;
  update(id: string, changes: PendingOperationUpdate): Promise<void>;
  get(id: string): Promise<StoredPendingOperation | undefined>;
  /** Returns operations in ascending timestamp order. */
  listOrdered(): Promise<StoredPendingOperation[]>;
  count(): Promise<number>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

/** Fields the current queue manager may patch without replacing a stored row. */
export type PendingOperationUpdate = Partial<
  Pick<
    PendingOperation,
    'type' | 'data' | 'timestamp' | 'retryCount' | 'lastError' | 'failedAt'
  >
>;
