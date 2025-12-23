/**
 * 离线操作队列管理器
 *
 * 负责：
 * 1. 离线时将变更存储到 IndexedDB
 * 2. 网络恢复后批量同步
 * 3. 失败重试机制
 *
 * 参考: Workbox Background Sync
 * https://developer.chrome.com/docs/workbox/modules/workbox-background-sync
 */

import { db } from '@/lib/core/db';
import type { PendingOperation, RealtimeSyncTable } from './types';
import { nanoid } from 'nanoid';

// 扩展 Dexie 数据库以支持离线队列
// 注意：需要在 db.ts 中添加 pendingOperations 表

/**
 * 离线队列管理器
 */
export class OfflineQueueManager {
  private static instance: OfflineQueueManager | null = null;
  private isProcessing = false;
  private maxRetries = 3;
  private retryInterval = 5000; // 5 秒

  private constructor() {}

  static getInstance(): OfflineQueueManager {
    if (!OfflineQueueManager.instance) {
      OfflineQueueManager.instance = new OfflineQueueManager();
    }
    return OfflineQueueManager.instance;
  }

  /**
   * 添加操作到队列
   */
  async enqueue(
    table: RealtimeSyncTable,
    type: 'upsert' | 'delete',
    recordId: string,
    data?: unknown
  ): Promise<void> {
    const operation: PendingOperation = {
      id: nanoid(),
      table,
      type,
      recordId,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    try {
      // 检查是否已有相同记录的操作，如果有则更新
      const existing = await this.findExistingOperation(table, recordId);
      if (existing) {
        // 更新现有操作
        await db.table('pendingOperations').update(existing.id, {
          type,
          data,
          timestamp: Date.now(),
          retryCount: 0,
        });
        console.log(`[OfflineQueue] 更新队列操作: ${table}/${recordId}`);
      } else {
        // 添加新操作
        await db.table('pendingOperations').add(operation);
        console.log(`[OfflineQueue] 添加到队列: ${table}/${recordId}`);
      }
    } catch (error) {
      console.error('[OfflineQueue] 添加失败:', error);
    }
  }

  /**
   * 查找已存在的操作
   */
  private async findExistingOperation(
    table: RealtimeSyncTable,
    recordId: string
  ): Promise<PendingOperation | undefined> {
    try {
      const operations = await db
        .table('pendingOperations')
        .where({ table, recordId })
        .toArray();
      return operations[0] as PendingOperation | undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * 获取所有待处理的操作
   */
  async getPendingOperations(): Promise<PendingOperation[]> {
    try {
      return (await db
        .table('pendingOperations')
        .orderBy('timestamp')
        .toArray()) as PendingOperation[];
    } catch {
      return [];
    }
  }

  /**
   * 获取待处理操作数量
   */
  async getPendingCount(): Promise<number> {
    try {
      return await db.table('pendingOperations').count();
    } catch {
      return 0;
    }
  }

  /**
   * 移除已完成的操作
   */
  async dequeue(operationId: string): Promise<void> {
    try {
      await db.table('pendingOperations').delete(operationId);
      console.log(`[OfflineQueue] 移除操作: ${operationId}`);
    } catch (error) {
      console.error('[OfflineQueue] 移除失败:', error);
    }
  }

  /**
   * 标记操作失败（增加重试次数）
   */
  async markFailed(operationId: string): Promise<boolean> {
    try {
      const operation = (await db
        .table('pendingOperations')
        .get(operationId)) as PendingOperation | undefined;

      if (!operation) return false;

      if (operation.retryCount >= this.maxRetries) {
        // 超过最大重试次数，移除操作
        await this.dequeue(operationId);
        console.warn(
          `[OfflineQueue] 操作 ${operationId} 超过最大重试次数，已移除`
        );
        return false;
      }

      await db.table('pendingOperations').update(operationId, {
        retryCount: operation.retryCount + 1,
      });
      return true;
    } catch (error) {
      console.error('[OfflineQueue] 标记失败出错:', error);
      return false;
    }
  }

  /**
   * 处理队列（由 RealtimeSyncService 调用）
   *
   * @param processor - 处理单个操作的回调函数
   * @returns 处理结果统计
   */
  async processQueue(
    processor: (operation: PendingOperation) => Promise<boolean>
  ): Promise<{ processed: number; failed: number }> {
    if (this.isProcessing) {
      console.log('[OfflineQueue] 队列正在处理中，跳过');
      return { processed: 0, failed: 0 };
    }

    this.isProcessing = true;
    let processed = 0;
    let failed = 0;

    try {
      const operations = await this.getPendingOperations();
      console.log(`[OfflineQueue] 开始处理 ${operations.length} 个待处理操作`);

      for (const operation of operations) {
        try {
          const success = await processor(operation);
          if (success) {
            await this.dequeue(operation.id);
            processed++;
          } else {
            const canRetry = await this.markFailed(operation.id);
            if (!canRetry) failed++;
          }
        } catch (error) {
          console.error(`[OfflineQueue] 处理操作 ${operation.id} 失败:`, error);
          await this.markFailed(operation.id);
          failed++;
        }
      }

      console.log(
        `[OfflineQueue] 处理完成 - 成功: ${processed}, 失败: ${failed}`
      );
    } finally {
      this.isProcessing = false;
    }

    return { processed, failed };
  }

  /**
   * 清空队列
   */
  async clear(): Promise<void> {
    try {
      await db.table('pendingOperations').clear();
      console.log('[OfflineQueue] 队列已清空');
    } catch (error) {
      console.error('[OfflineQueue] 清空队列失败:', error);
    }
  }

  /**
   * 配置重试参数
   */
  configure(options: { maxRetries?: number; retryInterval?: number }): void {
    if (options.maxRetries !== undefined) {
      this.maxRetries = options.maxRetries;
    }
    if (options.retryInterval !== undefined) {
      this.retryInterval = options.retryInterval;
    }
  }

  /**
   * 获取重试间隔
   */
  getRetryInterval(): number {
    return this.retryInterval;
  }
}

// 导出单例
export const offlineQueue = OfflineQueueManager.getInstance();
