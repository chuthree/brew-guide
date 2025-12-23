/**
 * 冲突解决器
 *
 * 实现 Last-Write-Wins (LWW) 策略
 * 参考: CouchDB Conflicts Resolution
 * https://docs.couchdb.org/en/stable/replication/conflicts.html
 */

import type { SyncableRecord, ConflictResolution, CloudRecord } from './types';

/**
 * 从记录中提取时间戳
 *
 * @param record - 本地或云端记录
 * @returns 时间戳（毫秒）
 */
export function extractTimestamp(
  record: SyncableRecord | CloudRecord
): number {
  // 本地记录使用 timestamp 字段
  if ('timestamp' in record && typeof record.timestamp === 'number') {
    return record.timestamp;
  }

  // 云端记录使用 updated_at 字段
  if ('updated_at' in record && record.updated_at) {
    return new Date(record.updated_at).getTime();
  }

  // 如果都没有，返回 0（最旧）
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

  console.log(
    `[ConflictResolver] 比较时间戳 - 本地: ${localTime}, 云端: ${remoteTime}`
  );

  if (localTime >= remoteTime) {
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
 * 批量冲突解决
 *
 * @param localRecords - 本地记录数组
 * @param remoteRecords - 云端记录数组
 * @returns 合并后的记录数组 + 需要上传/下载的记录
 */
export function batchResolveConflicts<T extends SyncableRecord>(
  localRecords: T[],
  remoteRecords: CloudRecord<T>[]
): {
  merged: T[];
  toUpload: T[];
  toDownload: T[];
} {
  const localMap = new Map(localRecords.map(r => [r.id, r]));
  const remoteMap = new Map(remoteRecords.map(r => [r.id, r]));

  const merged: T[] = [];
  const toUpload: T[] = [];
  const toDownload: T[] = [];

  // 处理本地记录
  for (const local of localRecords) {
    const remote = remoteMap.get(local.id);

    if (!remote) {
      // 本地有，云端没有 → 需要上传
      merged.push(local);
      toUpload.push(local);
    } else if (remote.deleted_at) {
      // 云端已删除，检查时间戳决定是否恢复
      const localTime = extractTimestamp(local);
      const deleteTime = new Date(remote.deleted_at).getTime();

      if (localTime > deleteTime) {
        // 本地更新比删除更晚 → 恢复记录
        merged.push(local);
        toUpload.push(local);
      }
      // 否则不添加到 merged（接受删除）
    } else {
      // 两边都有，解决冲突
      const resolution = resolveConflictLWW(local, remote);
      if (resolution.winner === 'local') {
        merged.push(local);
        toUpload.push(local);
      } else {
        merged.push(resolution.record as T);
        toDownload.push(resolution.record as T);
      }
    }
  }

  // 处理只在云端存在的记录
  for (const remote of remoteRecords) {
    if (!localMap.has(remote.id) && !remote.deleted_at) {
      // 云端有，本地没有 → 需要下载
      merged.push(remote.data);
      toDownload.push(remote.data);
    }
  }

  console.log(
    `[ConflictResolver] 批量解决完成 - 合并: ${merged.length}, 上传: ${toUpload.length}, 下载: ${toDownload.length}`
  );

  return { merged, toUpload, toDownload };
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

  return remoteTime > localTime;
}
