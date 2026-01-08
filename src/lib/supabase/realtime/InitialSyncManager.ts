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
import { showToast } from '@/components/common/feedback/LightToast';

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

    // 仅在首次同步时显示提示，避免后台静默同步打扰用户
    // lastSyncTime 为 0 表示首次同步（或数据被重置）
    if (typeof window !== 'undefined' && lastSyncTime === 0) {
      showToast({ type: 'info', title: '正在同步云端数据...', duration: 3000 });
    }

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
    let errorCount = 0;

    for (const result of results) {
      if (result.status === 'fulfilled') {
        stats.uploaded += result.value.uploaded;
        stats.downloaded += result.value.downloaded;
        stats.deleted += result.value.deleted;
      } else {
        errorCount++;
        console.error('[InitialSync] 表同步失败:', result.reason);
      }
    }

    // 同步设置
    try {
      await this.syncSettings();
    } catch (e) {
      console.error('[InitialSync] 设置同步失败:', e);
      // 设置同步失败不计入核心数据同步错误，但可以记录日志
    }

    // 刷新所有 Store
    console.log('[InitialSync] 刷新所有 Store...');
    await refreshAllStores();

    // 执行烘焙商字段迁移（按需迁移同步下载的数据）
    try {
      const { migrateRoasterField } = await import(
        '@/lib/utils/roasterMigration'
      );
      await migrateRoasterField();
    } catch (e) {
      console.error('[InitialSync] 烘焙商字段迁移失败:', e);
    }

    // 强制触发一次全局 UI 更新事件，确保组件重绘
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('syncCompleted'));
    }

    // 同步完成提示
    if (typeof window !== 'undefined') {
      if (errorCount > 0) {
        // 如果有错误发生
        if (errorCount === results.length) {
          showToast({ type: 'error', title: '同步失败，请检查网络' });
        } else {
          showToast({ type: 'warning', title: '部分数据同步失败' });
        }
      } else if (
        stats.downloaded > 0 ||
        stats.uploaded > 0 ||
        stats.deleted > 0
      ) {
        const parts = [];
        if (stats.downloaded > 0) parts.push(`↓${stats.downloaded}`);
        if (stats.uploaded > 0) parts.push(`↑${stats.uploaded}`);
        if (stats.deleted > 0) parts.push(`×${stats.deleted}`);

        showToast({
          type: 'success',
          title: `同步完成 ${parts.join(' ')}`,
        });
      } else {
        // 仅在首次同步时显示“数据已是最新”，避免日常使用中频繁打扰
        if (lastSyncTime === 0) {
          showToast({ type: 'success', title: '数据已是最新' });
        }
      }
    }

    // 只有在没有完全失败的情况下才更新时间戳
    // 这样下次重试时可以再次尝试同步失败的部分
    if (errorCount < results.length) {
      const now = Date.now();
      setLastSyncTime(now);
    }

    console.log(
      `[InitialSync] 完成 (${Date.now() - startTime}ms): ↑${stats.uploaded} ↓${stats.downloaded} ×${stats.deleted}, Errors: ${errorCount}`
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
        throw new Error(remoteMetaResult.error || `拉取 ${table} 失败`);
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
          console.log(`[InitialSync] ${table} 需下载 ${remote.id}: 本地缺失`);
        } else {
          // 直接访问 timestamp 属性，避免类型复杂度
          const localTime =
            'timestamp' in local && typeof local.timestamp === 'number'
              ? local.timestamp
              : 0;
          // 远程比本地新 -> 需要下载
          if (remoteTime > localTime) {
            idsToDownload.push(remote.id);
            console.log(
              `[InitialSync] ${table} 需下载 ${remote.id}: 远程更新 (Remote: ${remoteTime} > Local: ${localTime})`
            );
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
      const idsToDownloadSet = new Set(idsToDownload);
      const remoteRecords = remoteMetaRecords
        .map(r => {
          if (downloadedDataMap.has(r.id)) {
            const data = downloadedDataMap.get(r.id);
            // PATCH: 确保数据有 timestamp，且不小于 updated_at
            // 这防止了因数据时间戳滞后于 updated_at 导致无限循环下载
            if (data) {
              const updatedAtTime = new Date(r.updated_at).getTime();
              data.timestamp = Math.max(data.timestamp || 0, updatedAtTime);
            }
            return { ...r, data };
          }
          return r;
        })
        .filter(r => {
          // 安全检查：如果记录需要下载但数据缺失（下载失败），则跳过该记录
          // 防止 batchResolveConflicts 处理 null 数据导致崩溃
          if (idsToDownloadSet.has(r.id) && !r.data && !r.deleted_at) {
            console.warn(
              `[InitialSync] ${table} 记录 ${r.id} 下载失败，跳过本次同步`
            );
            return false;
          }
          return true;
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
            (record as { updatedAt?: number; timestamp?: number }).updatedAt ||
              (record as { timestamp?: number }).timestamp ||
              Date.now()
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
      throw error;
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
      const localWithId = localRecords.map(r => {
        const maxTimestamp = Math.max(
          0,
          ...r.methods.map(m => m.timestamp || 0)
        );
        // DEBUG: 打印本地记录的时间戳详情
        // console.log(`[Debug] Local Method ${r.equipmentId}: maxTimestamp=${maxTimestamp}`);
        return {
          id: r.equipmentId,
          equipmentId: r.equipmentId,
          methods: r.methods,
          timestamp: maxTimestamp,
        };
      });

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
        throw new Error(remoteResult.error || '拉取 custom_methods 失败');
      }

      const remoteRecords = (remoteResult.data || []).map(r => {
        const methods = (r.data as { methods?: Method[] })?.methods || [];
        const updatedAtTime = new Date(r.updated_at).getTime();

        // PATCH: 确保 methods 中的每个 method 都有 timestamp，且不小于 updated_at
        // 这防止了因 methods 时间戳滞后于 updated_at 导致计算出的 localTime 偏小，从而无限循环下载
        const patchedMethods = methods.map(m => ({
          ...m,
          timestamp: Math.max(m.timestamp || 0, updatedAtTime),
        }));

        // DEBUG: 检查远程记录的时间戳差异
        // const maxMethodTime = Math.max(0, ...patchedMethods.map(m => m.timestamp || 0));
        // if (updatedAtTime > maxMethodTime) {
        //   console.log(`[Debug] Remote Method ${r.id}: updatedAt(${updatedAtTime}) > maxMethodTime(${maxMethodTime})`);
        // }

        return {
          id: r.id,
          user_id: DEFAULT_USER_ID,
          data: {
            id: r.id,
            equipmentId: r.id,
            methods: patchedMethods,
            timestamp: 0,
          },
          updated_at: r.updated_at,
          deleted_at: r.deleted_at,
        };
      });

      // 冲突解决
      const { toUpload, toDownload, toDeleteLocal } = batchResolveConflicts(
        localWithId,
        remoteRecords,
        lastSyncTime
      );

      if (toDownload.length > 0) {
        console.log(
          `[InitialSync] custom_methods 需下载 ${toDownload.length} 条记录`
        );
        toDownload.forEach(item => {
          // 查找对应的远程记录以获取更多调试信息
          const remote = remoteRecords.find(r => r.id === item.equipmentId);
          const local = localWithId.find(l => l.id === item.equipmentId);

          const remoteUpdatedAt = remote
            ? new Date(remote.updated_at).getTime()
            : 'N/A';
          const localTimestamp = local ? local.timestamp : 'N/A';

          console.log(
            `[InitialSync] custom_methods 下载详情: ${item.equipmentId} | Remote UpdatedAt: ${remoteUpdatedAt} | Local MaxTimestamp: ${localTimestamp}`
          );
        });
      }

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
      throw error;
    }
  }

  /**
   * 同步设置（双向）
   */
  private async syncSettings(): Promise<void> {
    try {
      const lastSyncTime = getLastSyncTime();

      const remoteResult = await withTimeout(
        fetchRemoteLatestTimestamp(this.client, SYNC_TABLES.USER_SETTINGS),
        SYNC_TIMEOUT,
        '获取设置时间戳超时'
      );

      const remoteTimestamp = remoteResult.success ? remoteResult.data || 0 : 0;

      if (remoteTimestamp > lastSyncTime || lastSyncTime === 0) {
        // 云端更新或首次同步，下载
        const result = await withTimeout(
          downloadSettingsData(this.client),
          SYNC_TIMEOUT,
          '下载设置超时'
        );
        if (result.success) {
          await refreshSettingsStores();
        }
      } else {
        // 本地更新，上传
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
