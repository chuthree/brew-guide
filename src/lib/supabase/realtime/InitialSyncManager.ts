/**
 * 初始同步管理器
 *
 * 职责：执行连接后的初始双向同步
 *
 * 同步策略（基于 CouchDB 复制模型）：
 * 1. 拉取云端所有数据
 * 2. 与本地数据对比（使用 batchResolveConflicts）
 * 3. 决定哪些记录需要上传、下载或删除
 * 4. 执行操作
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { db } from '@/lib/core/db';
import {
  SYNC_TABLES,
  DEFAULT_USER_ID,
  upsertRecords,
  fetchRemoteAllRecords,
  fetchRemoteRecordsByIds,
  fetchRemoteLatestTimestamp,
  uploadSettingsData,
  downloadSettingsData,
} from '../syncOperations';
import {
  batchResolveConflicts,
  getLastSyncTime,
  setLastSyncTime,
  extractTimestamp,
} from './conflictResolver';
import { getDbTable } from './dbUtils';
import {
  refreshAllStores,
  refreshSettingsStores,
} from './handlers/StoreNotifier';
import type { RealtimeSyncTable } from './types';
import type { Method } from '@/lib/core/config';

// 网络请求超时时间 (ms)
const SYNC_TIMEOUT = 60000; // 增加到 60s 以适应移动端大文件传输

/**
 * 带超时的 Promise 包装器
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMsg: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), ms)
    ),
  ]);
}

/**
 * 同步结果统计
 */
interface SyncStats {
  uploaded: number;
  downloaded: number;
  deleted: number;
}

/**
 * 初始同步管理器类
 *
 * 注意：此类设计为每次同步创建新实例，由调用方（RealtimeSyncService）保证不会并发调用
 */
export class InitialSyncManager {
  private client: SupabaseClient;
  private aborted = false;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * 中止同步（用于断开连接时）
   */
  abort(): void {
    this.aborted = true;
  }

  /**
   * 执行完整的初始同步
   */
  async performSync(): Promise<SyncStats> {
    const emptyStats: SyncStats = { uploaded: 0, downloaded: 0, deleted: 0 };
    if (this.aborted) return emptyStats;

    const startTime = Date.now();
    const lastSyncTime = getLastSyncTime();

    console.log(
      `[InitialSync] 开始同步, lastSync=${lastSyncTime ? new Date(lastSyncTime).toLocaleString() : '首次'}`
    );

    // 并行同步所有表
    // 恢复并行同步：由于采用了“元数据优先”策略，初始请求非常小，并行执行不会造成带宽压力
    // 这将显著减少总同步时间
    const results = await Promise.allSettled([
      this.syncTable(SYNC_TABLES.COFFEE_BEANS, lastSyncTime),
      this.syncTable(SYNC_TABLES.BREWING_NOTES, lastSyncTime),
      this.syncTable(SYNC_TABLES.CUSTOM_EQUIPMENTS, lastSyncTime),
      this.syncTableMethods(lastSyncTime),
    ]);

    // 统计结果
    const stats: SyncStats = { uploaded: 0, downloaded: 0, deleted: 0 };
    for (const result of results) {
      if (result.status === 'fulfilled') {
        stats.uploaded += result.value.uploaded;
        stats.downloaded += result.value.downloaded;
        stats.deleted += result.value.deleted;
      } else {
        console.error('[InitialSync] 表同步失败:', result.reason);
      }
    }

    // 同步设置
    try {
      await this.syncSettings();
    } catch (e) {
      console.error('[InitialSync] 设置同步失败:', e);
    }

    // 刷新所有 Store
    console.log('[InitialSync] 刷新所有 Store...');
    await refreshAllStores();

    // 强制触发一次全局 UI 更新事件，确保组件重绘
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('syncCompleted'));
    }

    // 更新同步时间
    const now = Date.now();
    setLastSyncTime(now);

    console.log(
      `[InitialSync] 完成 (${Date.now() - startTime}ms): ↑${stats.uploaded} ↓${stats.downloaded} ×${stats.deleted}`
    );

    return stats;
  }

  /**
   * 同步单个表
   */
  private async syncTable(
    table: RealtimeSyncTable,
    lastSyncTime: number
  ): Promise<SyncStats> {
    const emptyResult: SyncStats = { uploaded: 0, downloaded: 0, deleted: 0 };

    try {
      const dbTable = getDbTable(table);

      // 获取本地和云端数据
      const localRecords = await dbTable.toArray();

      // 增加超时控制
      // 优化：只拉取元数据 (id, updated_at, deleted_at)，不拉取 data
      // 这样可以极大减少初始请求的大小，避免超时
      const remoteMetaResult = await withTimeout(
        fetchRemoteAllRecords(this.client, table, 'id, updated_at, deleted_at'),
        SYNC_TIMEOUT,
        `拉取 ${table} 元数据超时`
      );

      if (!remoteMetaResult.success) {
        console.error(
          `[InitialSync] ${table} 拉取失败:`,
          remoteMetaResult.error
        );
        return emptyResult;
      }

      const remoteMetaRecords = (remoteMetaResult.data || []).map(r => ({
        id: r.id,
        user_id: DEFAULT_USER_ID,
        data: null as any, // 暂时没有 data
        updated_at: r.updated_at,
        deleted_at: r.deleted_at,
      }));

      // 调试日志：检查拉取到的数据量
      if (remoteMetaRecords.length > 0) {
        console.log(
          `[InitialSync] ${table} 拉取到 ${remoteMetaRecords.length} 条元数据`
        );
      }

      // 预处理：找出需要下载完整数据的记录 ID
      // 逻辑：如果远程记录比本地新（或本地不存在），且未删除，则需要下载 data
      const idsToDownload: string[] = [];
      const localMap = new Map(
        localRecords.map(r => {
          // 处理 customMethods 表的特殊情况：它使用 equipmentId 作为唯一标识
          const id =
            table === SYNC_TABLES.CUSTOM_METHODS
              ? (r as { equipmentId: string }).equipmentId
              : (r as { id: string }).id;
          return [id, r];
        })
      );

      for (const remote of remoteMetaRecords) {
        if (remote.deleted_at) continue; // 已删除的不需要下载 data

        const local = localMap.get(remote.id);
        const remoteTime = extractTimestamp(remote);

        if (!local) {
          // 本地不存在 -> 需要下载
          idsToDownload.push(remote.id);
        } else {
          // 直接访问 timestamp 属性，避免类型复杂度
          const localTime =
            'timestamp' in local && typeof local.timestamp === 'number'
              ? local.timestamp
              : 0;
          // 远程比本地新 -> 需要下载
          if (remoteTime > localTime) {
            idsToDownload.push(remote.id);
          }
        }
      }

      // 批量下载需要的数据
      const downloadedDataMap = new Map<string, any>();
      if (idsToDownload.length > 0) {
        console.log(
          `[InitialSync] ${table} 需要下载 ${idsToDownload.length} 条完整记录`
        );
        const fetchResult = await withTimeout(
          fetchRemoteRecordsByIds(this.client, table, idsToDownload),
          SYNC_TIMEOUT * 2, // 下载数据给予更多时间
          `下载 ${table} 详情超时`
        );

        if (fetchResult.success && fetchResult.data) {
          fetchResult.data.forEach(item => {
            downloadedDataMap.set(item.id, item.data);
          });
        } else {
          console.error(
            `[InitialSync] ${table} 下载详情失败:`,
            fetchResult.error
          );
          // 如果下载失败，我们仍然继续，但这些记录将无法更新
        }
      }

      // 组装完整的 remoteRecords
      const remoteRecords = remoteMetaRecords.map(r => {
        if (downloadedDataMap.has(r.id)) {
          return { ...r, data: downloadedDataMap.get(r.id) };
        }
        return r;
      });

      // 冲突解决
      const { toUpload, toDownload, toDeleteLocal } = batchResolveConflicts(
        localRecords as { id: string; timestamp?: number }[],
        remoteRecords,
        lastSyncTime
      );

      // 执行上传
      if (toUpload.length > 0) {
        await upsertRecords(this.client, table, toUpload, record => ({
          id: record.id,
          data: record,
          updated_at: new Date(
            (record as { timestamp?: number }).timestamp || Date.now()
          ).toISOString(),
        }));
      }

      // 执行下载
      if (toDownload.length > 0) {
        console.log(
          `[InitialSync] ${table} 写入 ${toDownload.length} 条记录到本地 DB`
        );
        const putRecord = dbTable.put.bind(dbTable) as (
          item: unknown
        ) => Promise<unknown>;

        // 批量写入以提高性能
        await db.transaction('rw', dbTable, async () => {
          for (const record of toDownload) {
            await putRecord(record);
          }
        });
      }

      // 执行本地删除
      if (toDeleteLocal.length > 0) {
        console.log(
          `[InitialSync] ${table} 删除 ${toDeleteLocal.length} 条本地记录`
        );
        await dbTable.bulkDelete(toDeleteLocal);
      }

      return {
        uploaded: toUpload.length,
        downloaded: toDownload.length,
        deleted: toDeleteLocal.length,
      };
    } catch (error) {
      console.error(`[InitialSync] ${table} 同步失败:`, error);
      return emptyResult;
    }
  }

  /**
   * 同步方案表（特殊处理）
   */
  private async syncTableMethods(lastSyncTime: number): Promise<SyncStats> {
    const emptyResult: SyncStats = { uploaded: 0, downloaded: 0, deleted: 0 };

    try {
      // 获取本地方案
      const localRecords = await db.customMethods.toArray();
      const localWithId = localRecords.map(r => ({
        id: r.equipmentId,
        equipmentId: r.equipmentId,
        methods: r.methods,
        timestamp: Math.max(0, ...r.methods.map(m => m.timestamp || 0)),
      }));

      // 获取云端方案
      // 增加超时控制
      const remoteResult = await withTimeout(
        fetchRemoteAllRecords<{
          equipmentId: string;
          methods: Method[];
        }>(this.client, SYNC_TABLES.CUSTOM_METHODS),
        SYNC_TIMEOUT,
        `拉取 custom_methods 超时`
      );

      if (!remoteResult.success) {
        console.error(
          `[InitialSync] custom_methods 拉取失败:`,
          remoteResult.error
        );
        return emptyResult;
      }

      const remoteRecords = (remoteResult.data || []).map(r => ({
        id: r.id,
        user_id: DEFAULT_USER_ID,
        data: {
          id: r.id,
          equipmentId: r.id,
          methods: (r.data as { methods?: Method[] })?.methods || [],
          timestamp: 0,
        },
        updated_at: r.updated_at,
        deleted_at: r.deleted_at,
      }));

      // 冲突解决
      const { toUpload, toDownload, toDeleteLocal } = batchResolveConflicts(
        localWithId,
        remoteRecords,
        lastSyncTime
      );

      // 执行上传
      if (toUpload.length > 0) {
        await upsertRecords(
          this.client,
          SYNC_TABLES.CUSTOM_METHODS,
          toUpload,
          r => ({
            id: r.id,
            data: { equipmentId: r.equipmentId, methods: r.methods },
            updated_at: new Date().toISOString(),
          })
        );
      }

      // 执行下载
      if (toDownload.length > 0) {
        for (const item of toDownload) {
          await db.customMethods.put({
            equipmentId: item.equipmentId,
            methods: item.methods,
          });
        }
      }

      // 执行本地删除
      if (toDeleteLocal.length > 0) {
        for (const id of toDeleteLocal) {
          await db.customMethods.delete(id);
        }
      }

      return {
        uploaded: toUpload.length,
        downloaded: toDownload.length,
        deleted: toDeleteLocal.length,
      };
    } catch (error) {
      console.error(`[InitialSync] custom_methods 同步失败:`, error);
      return emptyResult;
    }
  }

  /**
   * 同步设置（双向）
   */
  private async syncSettings(): Promise<void> {
    try {
      const lastSyncTime = getLastSyncTime();

      // 增加超时控制
      const remoteResult = await withTimeout(
        fetchRemoteLatestTimestamp(this.client, SYNC_TABLES.USER_SETTINGS),
        SYNC_TIMEOUT,
        '获取设置时间戳超时'
      );

      const remoteTimestamp = remoteResult.success ? remoteResult.data || 0 : 0;

      if (remoteTimestamp > lastSyncTime || lastSyncTime === 0) {
        // 云端更新，下载
        // 修复：如果 lastSyncTime 为 0（首次同步或重置），也应该尝试下载
        const result = await withTimeout(
          downloadSettingsData(this.client),
          SYNC_TIMEOUT,
          '下载设置超时'
        );
        if (result.success) {
          await refreshSettingsStores();
        }
      } else {
        // 本地更新或首次，上传
        await withTimeout(
          uploadSettingsData(this.client),
          SYNC_TIMEOUT,
          '上传设置超时'
        );
      }
    } catch (error) {
      console.error('[InitialSync] 设置同步失败:', error);
    }
  }
}
