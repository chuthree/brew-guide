/**
 * SQLite v1 contract only. This module describes rows and SQL; it does not
 * open a database or execute the statements.
 */

export const SQLITE_SCHEMA_VERSION = 1;

export interface CoffeeBeanRow {
  id: string;
  timestamp_ms: number;
  record_json: string;
}

export interface BrewingNoteRow {
  id: string;
  timestamp_ms: number;
  updated_at_ms: number | null;
  bean_id: string | null;
  record_json: string;
}

export interface CustomEquipmentRow {
  id: string;
  record_json: string;
}

export interface CustomMethodsRow {
  equipment_id: string;
  methods_json: string;
  extra_json: string;
}

export interface GrinderRow {
  id: string;
  record_json: string;
}

export interface AppSettingsRow {
  id: string;
  data_json: string;
}

export interface LegacySettingsRow {
  key: string;
  value: string;
}

export interface PendingOperationRow {
  id: string;
  table_name: string;
  operation_type: string;
  record_id: string;
  timestamp_ms: number;
  retry_count: number;
  last_error: string | null;
  failed_at_ms: number | null;
  /** SQL NULL means the source data property was absent or undefined. */
  data_json: string | null;
  extra_json: string;
}

export interface HistoricalYearlyReportRow {
  id: string;
  year: number;
  username: string;
  content: string;
  created_at_ms: number;
  extra_json: string;
}

export type SQLiteImageVariant = 'original' | 'thumbnail';
export type CoffeeBeanImageSlot = 'front' | 'back';

export interface CoffeeBeanImageMetadataRow {
  image_id: string;
  bean_id: string;
  slot: CoffeeBeanImageSlot;
  variant: SQLiteImageVariant;
  relative_path: string;
  mime_type: string;
  size_bytes: number;
  sha256: string | null;
  updated_at_ms: number | null;
}

export interface BrewingNoteImageMetadataRow {
  image_id: string;
  note_id: string;
  position: number;
  variant: SQLiteImageVariant;
  relative_path: string;
  mime_type: string;
  size_bytes: number;
  sha256: string | null;
  updated_at_ms: number | null;
}

export type LegacySourcePresence = 'absent' | 'present-empty' | 'present-data';
export type LegacySourceTableName =
  | 'coffeeBeans'
  | 'brewingNotes'
  | 'coffeeBeanImages'
  | 'coffeeBeanImageThumbnails'
  | 'brewingNoteImages'
  | 'brewingNoteImageThumbnails'
  | 'customEquipments'
  | 'customMethods'
  | 'grinders'
  | 'appSettings'
  | 'settings'
  | 'pendingOperations'
  | 'yearlyReports';
export type LegacySourcePresenceMap = Record<
  LegacySourceTableName,
  LegacySourcePresence
>;

/**
 * Generic source facts leave the future migration runner free to record
 * per-table presence (LegacySourcePresenceMap, including absent vs
 * present-empty) without encoding a state machine in the v1 row contract.
 */
export interface MigrationStateRow {
  id: string;
  status: 'in_progress' | 'completed' | 'failed';
  source_presence_json: string;
  details_json: string;
}

export const SQLITE_SCHEMA_V1_SQL = `
CREATE TABLE coffee_beans (
  id TEXT NOT NULL PRIMARY KEY,
  timestamp_ms INTEGER NOT NULL,
  record_json TEXT NOT NULL
);

CREATE TABLE brewing_notes (
  id TEXT NOT NULL PRIMARY KEY,
  timestamp_ms INTEGER NOT NULL,
  updated_at_ms INTEGER,
  bean_id TEXT,
  record_json TEXT NOT NULL
);

CREATE TABLE custom_equipments (
  id TEXT NOT NULL PRIMARY KEY,
  record_json TEXT NOT NULL
);

CREATE TABLE custom_methods (
  equipment_id TEXT NOT NULL PRIMARY KEY,
  methods_json TEXT NOT NULL,
  extra_json TEXT NOT NULL
);

CREATE TABLE grinders (
  id TEXT NOT NULL PRIMARY KEY,
  record_json TEXT NOT NULL
);

CREATE TABLE app_settings (
  id TEXT NOT NULL PRIMARY KEY,
  data_json TEXT NOT NULL
);

CREATE TABLE legacy_settings (
  key TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE pending_operations (
  id TEXT NOT NULL PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  timestamp_ms INTEGER NOT NULL,
  retry_count INTEGER NOT NULL,
  last_error TEXT,
  failed_at_ms INTEGER,
  data_json TEXT,
  extra_json TEXT NOT NULL
);

CREATE TABLE historical_yearly_reports (
  id TEXT NOT NULL PRIMARY KEY,
  year INTEGER NOT NULL,
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  extra_json TEXT NOT NULL
);

CREATE TABLE coffee_bean_images (
  image_id TEXT NOT NULL PRIMARY KEY,
  bean_id TEXT NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('front', 'back')),
  variant TEXT NOT NULL CHECK (variant IN ('original', 'thumbnail')),
  relative_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  sha256 TEXT,
  updated_at_ms INTEGER,
  UNIQUE (bean_id, slot, variant)
);

CREATE TABLE brewing_note_images (
  image_id TEXT NOT NULL PRIMARY KEY,
  note_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  variant TEXT NOT NULL CHECK (variant IN ('original', 'thumbnail')),
  relative_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  sha256 TEXT,
  updated_at_ms INTEGER,
  UNIQUE (note_id, position, variant)
);

CREATE TABLE migration_state (
  id TEXT NOT NULL PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')),
  source_presence_json TEXT NOT NULL,
  details_json TEXT NOT NULL
);

CREATE INDEX idx_brewing_notes_bean_timestamp_id
  ON brewing_notes (bean_id, timestamp_ms DESC, id DESC);
CREATE INDEX idx_pending_operations_table_record
  ON pending_operations (table_name, record_id);
CREATE INDEX idx_pending_operations_timestamp_id
  ON pending_operations (timestamp_ms ASC, id ASC);
`;

/** One SQL statement per entry for drivers that do not support SQL batches. */
export const SQLITE_SCHEMA_V1_STATEMENTS = SQLITE_SCHEMA_V1_SQL.split(';')
  .map(statement => statement.trim())
  .filter(Boolean);
