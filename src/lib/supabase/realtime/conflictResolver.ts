/**
 * 冲突解决器
 *
 * 核心原则：
 * 1. 云端是权威数据源（Cloud-Authoritative）
 * 2. 使用 Last-Write-Wins (LWW) 策略解决冲突
 * 3. 删除操作通过 deleted_at 标记（Tombstone 模式）
 * 4. 使用 lastSyncTime 作为基准判断变更
 *
 * 参考: CouchDB Conflicts Resolution
 * https://docs.couchdb.org/en/stable/replication/conflicts.html
 */

import type { SyncableRecord, ConflictResolution, CloudRecord } from './types';

// 本地同步时间戳存储键
const LAST_SYNC_TIME_KEY = 'brew-guide:realtime-sync:lastSyncTime';

function parseStoredSyncTime(value: string | null): number {
  if (!value) return 0;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function persistLastSyncTimeBackup(value: string): Promise<void> {
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key: LAST_SYNC_TIME_KEY, value });
  } catch (error) {
    console.warn('[ConflictResolver] 备份 lastSyncTime 失败:', error);
  }
}

/**
 * 获取上次同步时间
 */
export function getLastSyncTime(): number {
  if (typeof window === 'undefined') return 0;
  const stored = localStorage.getItem(LAST_SYNC_TIME_KEY);
  return parseStoredSyncTime(stored);
}

/**
 * 从更稳定的 Preferences 备份恢复同步时间。
 *
 * Capacitor WebView 下 localStorage 偶尔会被清理；同步基准丢失会让应用
 * 把下一轮同步当作首次同步，从而重复扫描/上传大量本地记录。
 */
export async function hydrateLastSyncTime(): Promise<number> {
  const localSyncTime = getLastSyncTime();
  if (localSyncTime > 0) return localSyncTime;

  try {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key: LAST_SYNC_TIME_KEY });
    const backupSyncTime = parseStoredSyncTime(value);

    if (backupSyncTime > 0 && typeof window !== 'undefined') {
      localStorage.setItem(LAST_SYNC_TIME_KEY, String(backupSyncTime));
    }

    return backupSyncTime;
  } catch (error) {
    console.warn('[ConflictResolver] 恢复 lastSyncTime 失败:', error);
    return 0;
  }
}

/**
 * 设置上次同步时间
 */
export function setLastSyncTime(time: number): void {
  const value = String(time);
  if (typeof window !== 'undefined') {
    localStorage.setItem(LAST_SYNC_TIME_KEY, value);
  }
  void persistLastSyncTimeBackup(value);
}

/**
 * 从记录中提取时间戳
 *
 * @param record - 本地或云端记录
 * @returns 时间戳（毫秒）
 */
export function extractTimestamp(record: SyncableRecord | CloudRecord): number {
  // 优先使用 updatedAt（用于 BrewingNote 等区分创建时间和更新时间的记录）
  if ('updatedAt' in record && typeof record.updatedAt === 'number') {
    return record.updatedAt;
  }

  // 本地记录使用 timestamp 字段
  if ('timestamp' in record && typeof record.timestamp === 'number') {
    return record.timestamp;
  }

  // 云端记录使用 updated_at 字段
  if ('updated_at' in record && record.updated_at) {
    return new Date(record.updated_at).getTime();
  }

  // 如果都没有，返回 0（最旧）并记录警告
  const recordId = 'id' in record ? record.id : 'unknown';
  console.warn(
    `[ConflictResolver] Record missing timestamp: id=${recordId}, ` +
      `hasUpdatedAt=${'updatedAt' in record}, ` +
      `hasTimestamp=${'timestamp' in record}, ` +
      `hasUpdated_at=${'updated_at' in record}`
  );
  return 0;
}

/**
 * Last-Write-Wins 冲突解决
 *
 * @param local - 本地记录
 * @param remote - 云端记录
 * @returns 冲突解决结果
 */
export function resolveConflictLWW<T extends SyncableRecord>(
  local: T,
  remote: CloudRecord<T>
): ConflictResolution {
  const localTime = extractTimestamp(local);
  const remoteTime = extractTimestamp(remote);

  // 同时间戳时优先云端，确保多端收敛到同一结果（Cloud-Authoritative）
  if (localTime > remoteTime) {
    return {
      winner: 'local',
      record: local,
    };
  } else {
    return {
      winner: 'remote',
      record: remote.data,
    };
  }
}

/**
 * 批量冲突解决（改进版）
 *
 * 核心逻辑：
 * 1. 云端有、本地没有 → 下载（云端新增或本地删除后需恢复）
 * 2. 本地有、云端没有 → 上传（本地新增）
 * 3. 两边都有 → 比较时间戳，决定上传还是下载
 * 4. 云端已删除 → 本地也删除
 *
 * @param localRecords - 本地记录数组
 * @param remoteRecords - 云端记录数组（包括已删除的）
 * @param lastSyncTime - 上次同步时间（用于判断是否为本地删除）
 * @returns 合并后的记录数组 + 需要上传/下载/删除的记录
 */
export function batchResolveConflicts<T extends SyncableRecord>(
  localRecords: T[],
  remoteRecords: CloudRecord<T>[],
  lastSyncTime: number = 0
): {
  merged: T[];
  toUpload: T[];
  toDownload: T[];
  toDeleteLocal: string[];
} {
  const localMap = new Map(localRecords.map(r => [r.id, r]));
  const remoteMap = new Map(remoteRecords.map(r => [r.id, r]));

  const merged: T[] = [];
  const toUpload: T[] = [];
  const toDownload: T[] = [];
  const toDeleteLocal: string[] = [];

  // 1. 处理本地记录
  for (const local of localRecords) {
    const remote = remoteMap.get(local.id);
    const localTime = extractTimestamp(local);

    if (!remote) {
      merged.push(local);
      // 云端索引中不存在该记录时，lastSyncTime 无法证明它曾成功上传。
      // 上传使用按 id 幂等的 upsert；真正的云端删除由上方 deleted_at 分支处理。
      toUpload.push(local);
    } else if (remote.deleted_at) {
      // 云端已删除（有 deleted_at 标记）
      const deleteTime = new Date(remote.deleted_at).getTime();

      if (localTime > deleteTime) {
        // 本地更新比删除更晚 → 恢复记录（本地优先）
        console.log(
          `[Conflict] ${local.id}: 本地更新(${localTime}) > 删除(${deleteTime}), 恢复`
        );
        merged.push(local);
        toUpload.push(local);
      } else {
        // 删除更晚 → 接受删除，本地也删除
        console.log(
          `[Conflict] ${local.id}: 接受云端删除(${deleteTime} > 本地${localTime})`
        );
        toDeleteLocal.push(local.id);
      }
    } else {
      // 两边都有且云端未删除
      const remoteTime = extractTimestamp(remote);
      const localModified = localTime > lastSyncTime;
      const remoteModified = remoteTime > lastSyncTime;

      if (localModified && remoteModified) {
        // 两边都修改了 → LWW
        if (localTime > remoteTime) {
          merged.push(local);
          toUpload.push(local);
        } else if (remote.data) {
          // 只有当 remote.data 存在时才下载
          merged.push(remote.data);
          toDownload.push(remote.data);
        } else {
          // remote.data 为 null，保持本地数据
          merged.push(local);
        }
      } else if (localModified) {
        // 只有本地修改 → 上传
        merged.push(local);
        toUpload.push(local);
      } else if (remoteModified) {
        // 只有云端修改 → 下载（仅当 data 存在时）
        if (remote.data) {
          merged.push(remote.data);
          toDownload.push(remote.data);
        } else {
          merged.push(local);
        }
      } else {
        // 两边都没修改 → 保持本地
        // 修复：如果本地时间戳小于云端时间戳（即使未超过 lastSyncTime），也应该更新本地
        // 这种情况可能发生在 lastSyncTime 丢失或重置的情况下
        if (remoteTime > localTime && remote.data) {
          merged.push(remote.data);
          toDownload.push(remote.data);
        } else {
          merged.push(local);
        }
      }
    }
  }

  // 2. 处理只在云端存在的记录（云端新增）
  for (const remote of remoteRecords) {
    if (!localMap.has(remote.id) && !remote.deleted_at && remote.data) {
      merged.push(remote.data);
      toDownload.push(remote.data);
    }
  }

  return { merged, toUpload, toDownload, toDeleteLocal };
}

/**
 * 判断是否应该接受远程变更
 *
 * @param localRecord - 本地记录（可能不存在）
 * @param remoteRecord - 云端记录
 * @returns 是否应该接受远程变更
 */
export function shouldAcceptRemoteChange<T extends SyncableRecord>(
  localRecord: T | undefined,
  remoteRecord: CloudRecord<T>
): boolean {
  // 本地不存在，接受远程
  if (!localRecord) {
    return true;
  }

  // 比较时间戳
  const localTime = extractTimestamp(localRecord);
  const remoteTime = extractTimestamp(remoteRecord);

  // 同时间戳时接受远程变更，避免并发写入造成的双端分叉
  return remoteTime >= localTime;
}

/**
 * 判断记录是否在上次同步后被修改
 */
export function isModifiedAfterSync<T extends SyncableRecord>(
  record: T,
  lastSyncTime: number
): boolean {
  const recordTime = extractTimestamp(record);
  return recordTime > lastSyncTime;
}
