import { withDataMutation } from '@/lib/data/mutationCoordinator';
/**
 * Supabase 同步操作模块
 *
 * 设计原则（参考 CouchDB 复制模型 + RxDB 离线优先架构）:
 * 1. 软删除（Tombstone）：删除操作通过设置 deleted_at 实现，而不是物理删除
 * 2. 幂等性：相同操作多次执行结果一致
 * 3. 原子性：每个操作要么完全成功，要么完全失败
 *
 * 参考文档:
 * - CouchDB Replication: https://docs.couchdb.org/en/stable/replication/conflicts.html
 * - RxDB Offline-First: https://rxdb.info/offline-first.html
 * - Supabase Soft Delete: https://supabase.com/docs/guides/database/tables
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  describeSyncPayload,
  recordSupabaseDiagnosticEvent,
  sanitizeDiagnosticText,
} from './syncDiagnostics';
import {
  appSettingsRepository,
  grinderRepository,
} from '@/lib/data/repositories';
import type { AppSettings } from '@/lib/data/models';
import {
  omitDeviceSettings,
  preserveDeviceSettings,
} from '@/lib/settings/deviceSettings';

// ============================================
// 类型定义
// ============================================

export interface SyncOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  diagnostic?: SyncOperationDiagnostic;
  affectedCount: number;
}

export interface SyncOperationDiagnostic {
  operation: string;
  table?: SyncTableName;
  recordId?: string;
  recordIndex?: number;
  total?: number;
  affectedCount?: number;
  columns?: string;
  idsSample?: string[];
  dataSections?: string[];
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  causeName?: string;
  payloadShape?: string;
  httpStatus?: number;
  durationMs?: number;
  attempts?: number;
  recovery?: string;
}

export interface UpsertRecordsOptions {
  /** 每条记录成功后回调 */
  onProgress?: (uploadedCount: number, totalCount: number) => void;
}

export interface UploadSettingsDataOptions {
  /** 内容未变化时跳过 upsert，避免制造无意义的远端更新时间 */
  skipIfUnchanged?: boolean;
}

export interface DownloadSettingsDataOptions {
  /** 取消下载请求，用于移动端后台恢复时主动结束挂起的 fetch */
  signal?: AbortSignal;
}

export interface FetchRemoteRecordsByIdsOptions {
  /** 每条记录读取完成后回调 */
  onProgress?: (downloadedCount: number, totalCount: number) => void;
}

function getErrorField(error: unknown, field: string): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const value = (error as Record<string, unknown>)[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  const message = getErrorField(error, 'message');
  return message || String(error);
}

function createDiagnostic(
  operation: string,
  table: SyncTableName,
  error: unknown,
  extra: Partial<
    Omit<SyncOperationDiagnostic, 'operation' | 'table' | 'message'>
  > = {}
): SyncOperationDiagnostic {
  return {
    operation,
    table,
    message: sanitizeDiagnosticText(getErrorMessage(error)),
    code: getErrorField(error, 'code'),
    details:
      sanitizeDiagnosticText(
        (getErrorField(error, 'details') || '').replace(
          /Failing row contains[\s\S]*/gi,
          'Failing row contains [已隐藏记录内容]'
        )
      ) || undefined,
    hint:
      sanitizeDiagnosticText(getErrorField(error, 'hint') || '') || undefined,
    causeName:
      error instanceof Error ? error.name : getErrorField(error, 'name'),
    ...extra,
  };
}

function createFailure<T>(
  diagnostic: SyncOperationDiagnostic,
  affectedCount: number,
  data?: T
): SyncOperationResult<T> {
  recordSupabaseDiagnosticEvent(
    `失败\n${formatSyncOperationDiagnostic(diagnostic)}`,
    true
  );
  return {
    success: false,
    error: diagnostic.message,
    diagnostic,
    data,
    affectedCount,
  };
}

export function formatSyncOperationDiagnostic(
  diagnostic: SyncOperationDiagnostic
): string {
  return [
    `操作: ${diagnostic.operation}`,
    diagnostic.table ? `表: ${diagnostic.table}` : null,
    diagnostic.recordId ? `记录ID: ${diagnostic.recordId}` : null,
    typeof diagnostic.recordIndex === 'number' ||
    typeof diagnostic.total === 'number'
      ? `位置: ${diagnostic.recordIndex ?? '-'} / ${diagnostic.total ?? '-'}`
      : null,
    typeof diagnostic.affectedCount === 'number'
      ? `已完成: ${diagnostic.affectedCount}`
      : null,
    diagnostic.columns ? `列: ${diagnostic.columns}` : null,
    diagnostic.payloadShape ? `上传字段结构: ${diagnostic.payloadShape}` : null,
    diagnostic.httpStatus !== undefined
      ? `HTTP 状态: ${diagnostic.httpStatus}`
      : null,
    diagnostic.durationMs !== undefined
      ? `操作耗时: ${diagnostic.durationMs}ms`
      : null,
    diagnostic.attempts ? `请求次数: ${diagnostic.attempts}` : null,
    diagnostic.recovery ? `兼容处理: ${diagnostic.recovery}` : null,
    diagnostic.idsSample?.length
      ? `ID样本: ${diagnostic.idsSample.join(', ')}`
      : null,
    diagnostic.dataSections?.length
      ? `数据段: ${diagnostic.dataSections.join(', ')}`
      : null,
    diagnostic.code ? `Supabase/PostgREST code: ${diagnostic.code}` : null,
    diagnostic.details ? `details: ${diagnostic.details}` : null,
    diagnostic.hint ? `hint: ${diagnostic.hint}` : null,
    diagnostic.causeName ? `cause: ${diagnostic.causeName}` : null,
    `message: ${diagnostic.message}`,
  ]
    .filter(Boolean)
    .map(line => sanitizeDiagnosticText(String(line)))
    .join('\n');
}

// ============================================
// 常量
// ============================================

export const DEFAULT_USER_ID = 'default_user';

export const SYNC_TABLES = {
  COFFEE_BEANS: 'coffee_beans',
  BREWING_NOTES: 'brewing_notes',
  CUSTOM_EQUIPMENTS: 'custom_equipments',
  CUSTOM_METHODS: 'custom_methods',
  USER_SETTINGS: 'user_settings',
} as const;

export type SyncTableName = (typeof SYNC_TABLES)[keyof typeof SYNC_TABLES];

/**
 * Complete image fields only after the caller has hydrated a record from the
 * local image repository. Missing fields then represent a confirmed removal.
 */
export function completeHydratedImageSnapshot<T extends object>(
  table: SyncTableName,
  record: T,
  sourceRecord?: T
): T {
  const data = record as T & Record<string, unknown>;
  const source = sourceRecord as (T & Record<string, unknown>) | undefined;
  const value = (field: string): unknown =>
    data[field] === undefined && source?.[field] !== undefined
      ? source[field]
      : data[field];

  if (table === SYNC_TABLES.COFFEE_BEANS) {
    const image = value('image');
    const backImage = value('backImage');
    return {
      ...data,
      image: image === undefined ? '' : image,
      backImage: backImage === undefined ? '' : backImage,
    } as T;
  }

  if (table === SYNC_TABLES.BREWING_NOTES) {
    const image = value('image');
    const images = value('images');
    return {
      ...data,
      image: image === undefined ? '' : image,
      images: images === undefined ? [] : images,
    } as T;
  }

  return record;
}

const REMOTE_SELECT_PAGE_SIZE = 1000;

// 自定义预设键（存储在 localStorage）
export const PRESETS_PREFIX = 'brew-guide:custom-presets:';
export const PRESETS_KEYS = [
  'origins',
  'countries',
  'regions',
  'estates',
  'processingStations',
  'altitudes',
  'processes',
  'batches',
  'varieties',
] as const;

const SETTINGS_SYNC_FINGERPRINT_KEY =
  'brew-guide:realtime-sync:settingsFingerprint';
const SETTINGS_SYNC_FINGERPRINT_VERSION = 'v2';
const SETTINGS_SYNC_HASH_SEED = 0x9e3779b1;

function getLocalStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
    if (typeof window !== 'undefined') return window.localStorage;
  } catch {
    return null;
  }
  return null;
}

function normalizeForStableStringify(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForStableStringify);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const objectValue = value as Record<string, unknown>;
  return Object.keys(objectValue)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      const normalized = normalizeForStableStringify(objectValue[key]);
      if (normalized !== undefined) {
        acc[key] = normalized;
      }
      return acc;
    }, {});
}

function normalizeSettingsFingerprintData(
  data: Record<string, unknown>
): Record<string, unknown> {
  const normalized = normalizeForStableStringify(data) as Record<
    string,
    unknown
  >;
  const appSettings = normalized.appSettings as
    | Record<string, unknown>
    | undefined;
  if (appSettings) {
    normalized.appSettings = omitDeviceSettings(appSettings);
  }

  return normalized;
}

export function createSettingsSyncFingerprint(
  data: Record<string, unknown>
): string {
  const stableSettingsData = JSON.stringify(
    normalizeSettingsFingerprintData(data)
  );
  const hash = hashStableString(stableSettingsData);
  return `${SETTINGS_SYNC_FINGERPRINT_VERSION}:${stableSettingsData.length}:${hash}`;
}

function hashStableString(value: string): string {
  let firstHash = 0xdeadbeef ^ SETTINGS_SYNC_HASH_SEED;
  let secondHash = 0x41c6ce57 ^ SETTINGS_SYNC_HASH_SEED;

  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    firstHash = Math.imul(firstHash ^ code, 2654435761);
    secondHash = Math.imul(secondHash ^ code, 1597334677);
  }

  firstHash =
    Math.imul(firstHash ^ (firstHash >>> 16), 2246822507) ^
    Math.imul(secondHash ^ (secondHash >>> 13), 3266489909);
  secondHash =
    Math.imul(secondHash ^ (secondHash >>> 16), 2246822507) ^
    Math.imul(firstHash ^ (firstHash >>> 13), 3266489909);

  const high = (secondHash >>> 0).toString(16).padStart(8, '0');
  const low = (firstHash >>> 0).toString(16).padStart(8, '0');
  return `${high}${low}`;
}

function getStoredSettingsSyncFingerprint(): string | null {
  const storage = getLocalStorage();
  if (!storage) return null;

  try {
    return storage.getItem(SETTINGS_SYNC_FINGERPRINT_KEY);
  } catch {
    return null;
  }
}

function persistSettingsSyncFingerprint(fingerprint: string): void {
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    storage.setItem(SETTINGS_SYNC_FINGERPRINT_KEY, fingerprint);
    return;
  } catch {
    // 旧版曾把完整设置 JSON 缓存在此 key；先删除再写入短 fingerprint，
    // 但本地缓存失败不应影响真正的 Supabase 同步结果。
  }

  try {
    storage.removeItem(SETTINGS_SYNC_FINGERPRINT_KEY);
    storage.setItem(SETTINGS_SYNC_FINGERPRINT_KEY, fingerprint);
  } catch (error) {
    console.warn('[SyncOps] 设置同步指纹缓存失败，已跳过:', error);
  }
}

function hasOwnSettingSection(
  data: Record<string, unknown>,
  section: string
): boolean {
  return Object.prototype.hasOwnProperty.call(data, section);
}

async function collectLocalSettingsSyncData(): Promise<{
  data: Record<string, unknown>;
  dataSections: string[];
}> {
  const data: Record<string, unknown> = {};
  const dataSections: string[] = [];

  // 收集应用设置
  const appSettings = await appSettingsRepository.get();
  if (appSettings) {
    data.appSettings = omitDeviceSettings(appSettings);
    dataSections.push('appSettings');
  }

  // 收集磨豆机数据。即使为空也写入，确保删除磨豆机能同步到云端。
  const grinders = await grinderRepository.list();
  data.grinders = grinders;
  dataSections.push('grinders');

  // 收集自定义预设（localStorage）
  const storage = getLocalStorage();
  if (storage) {
    const presets: Record<string, unknown> = {};
    for (const k of PRESETS_KEYS) {
      const v = storage.getItem(`${PRESETS_PREFIX}${k}`);
      if (v) {
        try {
          presets[k] = JSON.parse(v);
        } catch {
          /* 忽略解析错误 */
        }
      }
    }
    data.customPresets = presets;
    dataSections.push('customPresets');
  }

  return { data, dataSections };
}

async function fetchRemoteSettingsFingerprint(
  client: SupabaseClient
): Promise<string | null | undefined> {
  const { data: row, error } = await client
    .from(SYNC_TABLES.USER_SETTINGS)
    .select('data')
    .eq('user_id', DEFAULT_USER_ID)
    .eq('id', 'app_settings')
    .maybeSingle();

  if (error) {
    if (getErrorField(error, 'code') === 'PGRST116') return null;
    console.warn('[SyncOps] 检查远端设置指纹失败，继续执行上传:', error);
    return undefined;
  }

  const remoteData = (row as { data?: Record<string, unknown> } | null)?.data;
  return remoteData ? createSettingsSyncFingerprint(remoteData) : null;
}

// ============================================
// 核心同步操作
// ============================================

/**
 * 获取云端表的最新更新时间戳
 */
export async function fetchRemoteLatestTimestamp(
  client: SupabaseClient,
  table: SyncTableName
): Promise<SyncOperationResult<number>> {
  try {
    const { data, error } = await client
      .from(table)
      .select('updated_at')
      .eq('user_id', DEFAULT_USER_ID)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error(
        `[SyncOps] 获取 ${table} 云端最新时间戳失败:`,
        error.message
      );
      return createFailure(
        createDiagnostic('fetch-latest-timestamp', table, error),
        0
      );
    }

    if (!data || data.length === 0) {
      return { success: true, data: 0, affectedCount: 0 };
    }

    const timestamp = new Date(data[0].updated_at).getTime();
    return { success: true, data: timestamp, affectedCount: 1 };
  } catch (err) {
    return createFailure(
      createDiagnostic('fetch-latest-timestamp', table, err),
      0
    );
  }
}

/**
 * 获取云端所有记录（包括已删除的，用于冲突解决）
 * 支持指定列以优化性能
 */
export async function fetchRemoteAllRecords<T>(
  client: SupabaseClient,
  table: SyncTableName,
  columns: string = 'id, data, updated_at, deleted_at'
): Promise<
  SyncOperationResult<
    Array<{
      id: string;
      data: T;
      updated_at: string;
      deleted_at: string | null;
    }>
  >
> {
  try {
    const records: Array<{
      id: string;
      data: T;
      updated_at: string;
      deleted_at: string | null;
    }> = [];
    let expectedTotal: number | null = null;

    while (true) {
      const from = records.length;
      const to = from + REMOTE_SELECT_PAGE_SIZE - 1;

      const { data, error, count } = await client
        .from(table)
        .select(columns, { count: 'exact' })
        .eq('user_id', DEFAULT_USER_ID)
        .order('id', { ascending: true })
        .range(from, to);

      if (error) {
        console.error(`[SyncOps] 获取 ${table} 全部数据失败:`, error.message);
        return createFailure(
          createDiagnostic('fetch-all-records', table, error, {
            columns,
            recordIndex: from + 1,
            affectedCount: records.length,
          }),
          records.length,
          records
        );
      }

      if (typeof count === 'number') {
        expectedTotal = count;
      }

      const pageRecords = (data || []).map((row: any) => ({
        id: row.id,
        data: row.data, // 如果 columns 不包含 data，这里可能是 undefined
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
      }));

      records.push(...pageRecords);

      if (expectedTotal !== null) {
        if (records.length >= expectedTotal) break;

        if (pageRecords.length === 0) {
          const error = new Error(
            `分页拉取 ${table} 停止在 ${records.length}/${expectedTotal} 条，没有返回新数据`
          );
          return createFailure(
            createDiagnostic('fetch-all-records', table, error, {
              columns,
              recordIndex: from + 1,
              affectedCount: records.length,
            }),
            records.length,
            records
          );
        }

        continue;
      }

      if (pageRecords.length < REMOTE_SELECT_PAGE_SIZE) break;
    }

    return { success: true, data: records, affectedCount: records.length };
  } catch (err) {
    return createFailure(
      createDiagnostic('fetch-all-records', table, err, { columns }),
      0
    );
  }
}

/**
 * 根据 ID 列表批量获取云端记录
 */
export async function fetchRemoteRecordsByIds<T>(
  client: SupabaseClient,
  table: SyncTableName,
  ids: string[],
  options: FetchRemoteRecordsByIdsOptions = {}
): Promise<SyncOperationResult<Array<{ id: string; data: T }>>> {
  if (ids.length === 0) {
    return { success: true, data: [], affectedCount: 0 };
  }

  try {
    const allRecords: Array<{ id: string; data: T }> = [];

    for (const id of ids) {
      const { data, error } = await client
        .from(table)
        .select('id, data')
        .eq('user_id', DEFAULT_USER_ID)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error(`[SyncOps] 获取 ${table}/${id} 详情失败:`, error.message);
        return createFailure(
          createDiagnostic('fetch-record-by-id', table, error, {
            recordId: id,
            recordIndex: allRecords.length + 1,
            total: ids.length,
            affectedCount: allRecords.length,
            idsSample: ids.slice(0, 10),
          }),
          allRecords.length,
          allRecords
        );
      }

      if (data) {
        allRecords.push(data as { id: string; data: T });
      }
      options.onProgress?.(allRecords.length, ids.length);
    }

    return {
      success: true,
      data: allRecords,
      affectedCount: allRecords.length,
    };
  } catch (err) {
    return createFailure(
      createDiagnostic('fetch-records-by-id', table, err, {
        total: ids.length,
        idsSample: ids.slice(0, 10),
      }),
      0
    );
  }
}

/**
 * 批量更新/插入记录到云端
 *
 * @description 使用 upsert 确保幂等性，同时重置 deleted_at 为 null
 */
export async function upsertRecords<T extends { id: string }>(
  client: SupabaseClient,
  table: SyncTableName,
  records: T[],
  mapFn: (record: T) => Record<string, unknown>,
  options: UpsertRecordsOptions = {}
): Promise<SyncOperationResult> {
  if (records.length === 0) {
    return { success: true, affectedCount: 0 };
  }

  let affectedCount = 0;
  let requiresEquipmentId = false;
  let currentContext: Partial<SyncOperationDiagnostic> = {};
  try {
    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      currentContext = {
        recordId: record.id,
        recordIndex: index + 1,
        total: records.length,
        affectedCount,
      };
      let mappedRecord: Record<string, unknown>;

      try {
        mappedRecord = {
          ...mapFn(record),
          user_id: DEFAULT_USER_ID,
          deleted_at: null,
        };
        if (requiresEquipmentId && mappedRecord.equipment_id === undefined) {
          mappedRecord.equipment_id = mappedRecord.id;
        }
      } catch (err) {
        return createFailure(
          createDiagnostic('map-record-for-upsert', table, err, currentContext),
          affectedCount
        );
      }

      currentContext.payloadShape = describeSyncPayload(mappedRecord);
      currentContext.attempts = 1;
      const startedAt = Date.now();
      let response = await client
        .from(table)
        .upsert(mappedRecord, { onConflict: 'id,user_id' });

      // Some existing clouds require a legacy equipment_id column. New tables do
      // not have it, so only send it after the server explicitly requests it.
      if (
        table === SYNC_TABLES.CUSTOM_METHODS &&
        response.error?.code === '23502' &&
        response.error.message.includes(
          'null value in column "equipment_id" of relation "custom_methods"'
        ) &&
        typeof mappedRecord.id === 'string' &&
        mappedRecord.id.length > 0 &&
        mappedRecord.equipment_id === undefined
      ) {
        currentContext.recovery =
          '云端要求 equipment_id，使用本条记录的器具 ID 补齐并重试一次';
        recordSupabaseDiagnosticEvent(
          `兼容重试触发\n${formatSyncOperationDiagnostic(
            createDiagnostic('upsert-record', table, response.error, {
              ...currentContext,
              httpStatus: response.status,
            })
          )}`,
          true
        );
        mappedRecord = { ...mappedRecord, equipment_id: mappedRecord.id };
        currentContext.payloadShape = describeSyncPayload(mappedRecord);
        currentContext.attempts = 2;
        response = await client
          .from(table)
          .upsert(mappedRecord, { onConflict: 'id,user_id' });
      }

      const { error } = response;
      if (error) {
        console.error(`[SyncOps] ${table} upsert 失败:`, error.message);
        return createFailure(
          createDiagnostic('upsert-record', table, error, {
            ...currentContext,
            httpStatus: response.status,
            durationMs: Date.now() - startedAt,
          }),
          affectedCount
        );
      }

      if (currentContext.recovery) requiresEquipmentId = true;
      recordSupabaseDiagnosticEvent(
        `上传成功 ${table}/${record.id} duration=${Date.now() - startedAt}ms attempts=${currentContext.attempts} fields=${currentContext.payloadShape}${currentContext.recovery ? ' 兼容重试成功：已补齐 equipment_id' : ''}`,
        Boolean(currentContext.recovery)
      );
      affectedCount += 1;
      options.onProgress?.(affectedCount, records.length);
    }

    return { success: true, affectedCount };
  } catch (err) {
    return createFailure(
      createDiagnostic('upsert-record', table, err, {
        ...currentContext,
        affectedCount,
      }),
      affectedCount
    );
  }
}

/**
 * 软删除：标记云端记录为已删除（Tombstone 模式）
 */
export async function markRecordsAsDeleted(
  client: SupabaseClient,
  table: SyncTableName,
  ids: string[]
): Promise<SyncOperationResult> {
  if (ids.length === 0) {
    return { success: true, affectedCount: 0 };
  }

  try {
    const now = new Date().toISOString();

    const { error } = await client
      .from(table)
      .update({ deleted_at: now, updated_at: now })
      .eq('user_id', DEFAULT_USER_ID)
      .in('id', ids);

    if (error) {
      console.error(`[SyncOps] ${table} 软删除失败:`, error.message);
      return createFailure(
        createDiagnostic('mark-records-deleted', table, error, {
          total: ids.length,
          idsSample: ids.slice(0, 10),
        }),
        0
      );
    }

    return { success: true, affectedCount: ids.length };
  } catch (err) {
    return createFailure(
      createDiagnostic('mark-records-deleted', table, err, {
        total: ids.length,
        idsSample: ids.slice(0, 10),
      }),
      0
    );
  }
}

// ============================================
// 设置同步操作
// ============================================

/**
 * 上传设置数据到云端
 */
export async function uploadSettingsData(
  client: SupabaseClient,
  options: UploadSettingsDataOptions = {}
): Promise<SyncOperationResult<number>> {
  const dataSections: string[] = [];

  try {
    const collected = await collectLocalSettingsSyncData();
    dataSections.push(...collected.dataSections);
    const { data } = collected;

    if (Object.keys(data).length === 0) {
      return { success: true, data: 0, affectedCount: 0 };
    }

    const fingerprint = createSettingsSyncFingerprint(data);

    if (options.skipIfUnchanged) {
      const storedFingerprint = getStoredSettingsSyncFingerprint();
      if (storedFingerprint === fingerprint) {
        return { success: true, data: 0, affectedCount: 0 };
      }

      const remoteFingerprint = await fetchRemoteSettingsFingerprint(client);
      if (remoteFingerprint === fingerprint) {
        persistSettingsSyncFingerprint(fingerprint);
        return { success: true, data: 0, affectedCount: 0 };
      }
    }

    const { error } = await client.from(SYNC_TABLES.USER_SETTINGS).upsert(
      {
        id: 'app_settings',
        user_id: DEFAULT_USER_ID,
        data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id,user_id' }
    );

    if (error) {
      return createFailure(
        createDiagnostic('upload-settings', SYNC_TABLES.USER_SETTINGS, error, {
          recordId: 'app_settings',
          dataSections,
        }),
        0
      );
    }

    const count = Object.keys(data).length;
    persistSettingsSyncFingerprint(fingerprint);
    return { success: true, data: count, affectedCount: count };
  } catch (err) {
    return createFailure(
      createDiagnostic('upload-settings', SYNC_TABLES.USER_SETTINGS, err, {
        recordId: 'app_settings',
        dataSections,
      }),
      0
    );
  }
}

/**
 * 判断本地设置是否为"空"或"默认"状态
 * 用于决定是否应该完全使用云端数据
 */
function isLocalSettingsEmpty(localSettings: Partial<AppSettings>): boolean {
  // 检查关键字段是否有用户数据
  const hasUsername = !!localSettings.username;
  const hasS3Config =
    localSettings.s3Sync?.enabled === true ||
    !!localSettings.s3Sync?.accessKeyId;
  const hasWebDAVConfig = !!localSettings.webdavSync?.url;
  const hasSupabaseConfig = localSettings.supabaseSync?.enabled === true;

  return !hasUsername && !hasS3Config && !hasWebDAVConfig && !hasSupabaseConfig;
}

/**
 * 下载设置数据并应用到本地
 */
export async function downloadSettingsData(
  client: SupabaseClient,
  options: DownloadSettingsDataOptions = {}
): Promise<SyncOperationResult<number>> {
  let currentSection = 'fetch';

  try {
    let query = client
      .from(SYNC_TABLES.USER_SETTINGS)
      .select('data')
      .eq('user_id', DEFAULT_USER_ID)
      .eq('id', 'app_settings');

    if (options.signal) {
      query = query.abortSignal(options.signal);
    }

    const { data: row, error } = await query.single();

    // PGRST116 = 记录不存在，不算错误
    if (error && error.code !== 'PGRST116') {
      return createFailure(
        createDiagnostic(
          'download-settings',
          SYNC_TABLES.USER_SETTINGS,
          error,
          {
            recordId: 'app_settings',
            dataSections: [currentSection],
          }
        ),
        0
      );
    }

    if (!row?.data) {
      return { success: true, data: 0, affectedCount: 0 };
    }

    let count = 0;
    await withDataMutation(async () => {
      const settingsData = row.data as Record<string, unknown>;

      // 恢复应用设置
      if (settingsData.appSettings) {
        currentSection = 'appSettings';
        const cloudAppSettings = settingsData.appSettings as AppSettings;
        const localSettings = ((await appSettingsRepository.get()) ||
          {}) as Partial<AppSettings>;

        // 如果本地是空/默认状态，完全使用云端数据
        // 而不是合并（合并会保留本地的默认值）
        let mergedSettings: AppSettings;
        const localIsEmpty = isLocalSettingsEmpty(localSettings);

        if (localIsEmpty) {
          // 本地无用户数据，直接使用云端设置
          mergedSettings = cloudAppSettings;
        } else {
          // 本地有用户数据，进行合并（云端优先）
          mergedSettings = {
            ...localSettings,
            ...cloudAppSettings,
          } as AppSettings;
        }

        await appSettingsRepository.save(
          preserveDeviceSettings(mergedSettings, localSettings) as AppSettings
        );
        count++;
      }

      // 恢复磨豆机数据
      if (hasOwnSettingSection(settingsData, 'grinders')) {
        currentSection = 'grinders';
        if (!Array.isArray(settingsData.grinders)) {
          throw new Error('云端 grinders 数据格式无效，应为数组');
        }

        const cloudGrinders = settingsData.grinders as Array<{
          id: string;
          name: string;
          currentGrindSize?: string;
        }>;
        await grinderRepository.replaceAll(cloudGrinders);
        count++;
      }

      // 恢复自定义预设（localStorage）
      if (typeof window !== 'undefined') {
        if (hasOwnSettingSection(settingsData, 'customPresets')) {
          currentSection = 'customPresets';
          if (
            settingsData.customPresets === null ||
            typeof settingsData.customPresets !== 'object' ||
            Array.isArray(settingsData.customPresets)
          ) {
            throw new Error('云端 customPresets 数据格式无效，应为对象');
          }

          const presets = settingsData.customPresets as Record<string, unknown>;
          for (const k of PRESETS_KEYS) {
            if (hasOwnSettingSection(presets, k) && presets[k] !== undefined) {
              localStorage.setItem(
                `${PRESETS_PREFIX}${k}`,
                JSON.stringify(presets[k])
              );
              count++;
            } else {
              localStorage.removeItem(`${PRESETS_PREFIX}${k}`);
            }
          }
        }

        // 触发 UI 刷新
        window.dispatchEvent(
          new CustomEvent('settingsChanged', { detail: { source: 'remote' } })
        );
      }
    });

    const syncedLocalData = await collectLocalSettingsSyncData();
    if (Object.keys(syncedLocalData.data).length > 0) {
      persistSettingsSyncFingerprint(
        createSettingsSyncFingerprint(syncedLocalData.data)
      );
    }

    return { success: true, data: count, affectedCount: count };
  } catch (err) {
    return createFailure(
      createDiagnostic('download-settings', SYNC_TABLES.USER_SETTINGS, err, {
        recordId: 'app_settings',
        dataSections: [currentSection],
      }),
      0
    );
  }
}
