/**
 * 烘焙商字段迁移模块
 *
 * 当用户首次启用烘焙商字段功能时，执行一次性迁移：
 * - 从现有咖啡豆名称中提取烘焙商信息
 * - 填充到新的 roaster 字段
 * - 从 name 中移除烘焙商部分
 * - 迁移完成后标记 roasterMigrationCompleted
 */

import { db } from '@/lib/core/db';
import {
  extractRoasterFromName,
  removeRoasterFromName,
} from './beanVarietyUtils';
import { getSettingsStore } from '@/lib/stores/settingsStore';
import { getCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';

/**
 * 执行烘焙商字段迁移
 *
 * 从现有咖啡豆名称中提取烘焙商并填充到 roaster 字段，
 * 同时从 name 中移除烘焙商部分，确保显示时不会重复。
 *
 * 迁移逻辑：
 * - 只处理没有 roaster 字段的咖啡豆
 * - 使用当前分隔符设置提取烘焙商
 * - 提取成功后从 name 中移除烘焙商部分
 * - 迁移完成后标记 roasterMigrationCompleted
 */
export async function migrateRoasterField(): Promise<void> {
  const settingsStore = getSettingsStore();
  const { roasterMigrationCompleted, roasterSeparator } =
    settingsStore.settings;

  if (roasterMigrationCompleted) {
    return;
  }

  try {
    const separator = roasterSeparator || ' ';
    const beans = await db.coffeeBeans.toArray();
    const beansToMigrate = beans.filter(bean => !bean.roaster);

    if (beansToMigrate.length === 0) {
      await settingsStore.updateSettings({ roasterMigrationCompleted: true });
      return;
    }

    const updates = beansToMigrate.map(bean => {
      const roaster = extractRoasterFromName(bean.name, separator);
      const name =
        roaster !== '未知烘焙商'
          ? removeRoasterFromName(bean.name, separator)
          : bean.name;

      return { ...bean, roaster, name };
    });

    await db.coffeeBeans.bulkPut(updates);
    await getCoffeeBeanStore().refreshBeans();
    await settingsStore.updateSettings({ roasterMigrationCompleted: true });

    console.warn(`[RoasterMigration] 已迁移 ${updates.length} 个咖啡豆`);
  } catch (error) {
    console.error('[RoasterMigration] 迁移失败:', error);
    throw error;
  }
}

/**
 * 重置迁移状态
 *
 * 用于开发测试，重置后下次启用烘焙商字段时会重新执行迁移。
 * 注意：这不会清除已迁移的 roaster 字段值。
 */
export async function resetRoasterMigration(): Promise<void> {
  const settingsStore = getSettingsStore();
  await settingsStore.updateSettings({ roasterMigrationCompleted: false });
}
