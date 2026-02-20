/**
 * 远程变更处理器
 *
 * 职责：处理从 Supabase Realtime 接收到的远程数据变更
 *
 * 核心逻辑：
 * 1. 解析 Realtime payload
 * 2. 使用冲突解决器决定是否接受变更
 * 3. 更新本地 IndexedDB
 * 4. 通知 Store 更新 UI
 */

import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { db } from '@/lib/core/db';
import { SYNC_TABLES, DEFAULT_USER_ID } from '../../syncOperations';
import { shouldAcceptRemoteChange } from '../conflictResolver';
import { getDbTable } from '../dbUtils';
import { notifyStoreDelete, notifyStoreUpsert } from './StoreNotifier';
import type { RealtimeSyncTable, CloudRecord } from '../types';
import type { Method } from '@/lib/core/config';
import type { CoffeeBean } from '@/types/app';
import {
  extractRoasterFromName,
  removeRoasterFromName,
} from '@/lib/utils/beanVarietyUtils';
import { getSettingsStore } from '@/lib/stores/settingsStore';

type PostgresPayload = RealtimePostgresChangesPayload<Record<string, unknown>>;

/**
 * 远程变更处理器类
 */
export class RemoteChangeHandler {
  /**
   * 处理远程数据变更
   *
   * @param table - 表名
   * @param payload - Realtime payload
   * @param pendingLocalChanges - 正在处理的本地变更（用于跳过自己触发的事件）
   * @returns 是否成功处理
   */
  async handleChange(
    table: RealtimeSyncTable,
    payload: PostgresPayload,
    pendingLocalChanges: Map<string, number>
  ): Promise<boolean> {
    const newRecord = payload.new as Record<string, unknown> | null;
    const oldRecord = payload.old as Record<string, unknown> | null;
    const recordId = (newRecord?.id as string) || (oldRecord?.id as string);

    if (!recordId) {
      console.warn(`[RemoteHandler] 收到无效的远程变更，缺少 id`);
      return false;
    }

    // 检查是否是自己触发的变更
    const changeKey = `${table}:${recordId}`;
    const expireTime = pendingLocalChanges.get(changeKey);
    if (expireTime && Date.now() < expireTime) {
      return false; // 跳过自己触发的变更
    }
    // 清理过期的标记
    pendingLocalChanges.delete(changeKey);

    try {
      const isDelete =
        payload.eventType === 'DELETE' || newRecord?.deleted_at != null;

      if (isDelete) {
        await this.handleDelete(table, recordId, newRecord);
      } else {
        await this.handleUpsert(table, recordId, newRecord);
      }
      return true;
    } catch (error) {
      console.error(
        `[RemoteHandler] 处理变更失败 ${table}/${recordId}:`,
        error
      );
      return false;
    }
  }

  /**
   * 处理远程删除
   */
  private async handleDelete(
    table: RealtimeSyncTable,
    recordId: string,
    remoteRecord: Record<string, unknown> | null
  ): Promise<void> {
    const dbTable = getDbTable(table);
    const localRecord = await dbTable.get(recordId);
    if (!localRecord) {
      return; // 本地不存在，无需删除
    }

    // 比较时间戳决定是否接受删除
    const remoteTime = remoteRecord?.updated_at
      ? new Date(remoteRecord.updated_at as string).getTime()
      : Date.now();
    const localTime = (localRecord as { timestamp?: number }).timestamp || 0;

    if (remoteTime >= localTime) {
      await dbTable.delete(recordId);
      await notifyStoreDelete(table, recordId);
    }
    // 如果本地更新更晚，则忽略远程删除
  }

  /**
   * 处理远程插入/更新
   */
  private async handleUpsert(
    table: RealtimeSyncTable,
    recordId: string,
    remoteRecord: Record<string, unknown> | null
  ): Promise<void> {
    const dbTable = getDbTable(table);
    if (!remoteRecord?.data) {
      console.warn(
        `[RemoteHandler] 远程记录缺少 data 字段: ${table}/${recordId}`
      );
      return;
    }

    const remoteData = remoteRecord.data as Record<string, unknown>;
    const localRecord = await dbTable.get(recordId);

    const cloudRecord: CloudRecord<Record<string, unknown>> = {
      id: recordId,
      user_id: DEFAULT_USER_ID,
      data: remoteData,
      updated_at: remoteRecord.updated_at as string,
      deleted_at: null,
    };

    if (
      shouldAcceptRemoteChange(
        localRecord as { id: string; timestamp?: number } | undefined,
        cloudRecord as CloudRecord<{ id: string; timestamp?: number }>
      )
    ) {
      // custom_methods 需要特殊处理
      if (table === SYNC_TABLES.CUSTOM_METHODS) {
        await this.handleMethodsUpsert(recordId, remoteData);
      } else if (table === SYNC_TABLES.COFFEE_BEANS) {
        // 咖啡豆需要检查烘焙商字段迁移
        const beanData = await this.migrateRoasterIfNeeded(
          remoteData as unknown as CoffeeBean
        );
        await (dbTable as { put: (data: unknown) => Promise<unknown> }).put(
          beanData
        );
        await notifyStoreUpsert(
          table,
          recordId,
          beanData as unknown as Record<string, unknown>
        );
      } else {
        await (dbTable as { put: (data: unknown) => Promise<unknown> }).put(
          remoteData
        );
        await notifyStoreUpsert(table, recordId, remoteData);
      }
    }
    // 如果本地数据更新，则忽略远程变更
  }

  /**
   * 处理远程方案更新（custom_methods 表结构特殊）
   */
  private async handleMethodsUpsert(
    equipmentId: string,
    remoteData: Record<string, unknown>
  ): Promise<void> {
    const remoteMethods = (remoteData.methods || []) as Method[];
    await db.customMethods.put({
      equipmentId,
      methods: remoteMethods,
    });
  }

  /**
   * 为咖啡豆执行烘焙商字段迁移（如果需要）
   * 确保实时同步接收到的旧格式数据也能正确迁移
   */
  private async migrateRoasterIfNeeded(bean: CoffeeBean): Promise<CoffeeBean> {
    // 如果已有 roaster 字段，无需迁移
    if (bean.roaster) {
      return bean;
    }

    // 获取分隔符设置
    const { roasterSeparator } = getSettingsStore().settings;
    const separator = roasterSeparator || ' ';

    // 提取烘焙商
    const extractedRoaster = extractRoasterFromName(bean.name, separator);

    // 识别不到烘焙商时保持原样
    if (!extractedRoaster) {
      return bean;
    }

    // 迁移：填充 roaster 字段，从 name 中移除烘焙商部分
    return {
      ...bean,
      roaster: extractedRoaster,
      name: removeRoasterFromName(bean.name, separator),
    };
  }
}

// 导出单例
export const remoteChangeHandler = new RemoteChangeHandler();
