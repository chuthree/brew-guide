/**
 * 数据库工具函数
 *
 * 集中管理 Dexie 表访问，避免重复代码
 */

import { db } from '@/lib/core/db';
import { SYNC_TABLES } from '../syncOperations';
import type { RealtimeSyncTable } from './types';

/**
 * 获取表对应的 Dexie Table
 *
 * @param table - 表名
 * @returns Dexie Table 实例
 * @throws 未知表名时抛出错误
 */
export function getDbTable(table: RealtimeSyncTable) {
  switch (table) {
    case SYNC_TABLES.COFFEE_BEANS:
      return db.coffeeBeans;
    case SYNC_TABLES.BREWING_NOTES:
      return db.brewingNotes;
    case SYNC_TABLES.CUSTOM_EQUIPMENTS:
      return db.customEquipments;
    case SYNC_TABLES.CUSTOM_METHODS:
      return db.customMethods;
    default:
      throw new Error(`Unknown table: ${table}`);
  }
}
