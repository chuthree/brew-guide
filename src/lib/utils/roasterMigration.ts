/**
 * 烘焙商字段迁移模块
 *
 * 采用"按需迁移"策略：
 * - 每次调用时检查是否有需要迁移的咖啡豆（没有 roaster 字段的）
 * - 从咖啡豆名称中提取烘焙商信息
 * - 填充到新的 roaster 字段
 * - 从 name 中移除烘焙商部分
 *
 * 此策略确保导入数据或云同步后，新数据也能被正确迁移。
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
 * - 只处理没有 roaster 字段的咖啡豆（按需迁移）
 * - 使用当前分隔符设置提取烘焙商
 * - 提取成功后从 name 中移除烘焙商部分
 *
 * 注意：此函数会在以下场景自动调用：
 * - 应用启动时（dataLayer 初始化）
 * - 数据导入后
 * - 云同步下载后
 */
export async function migrateRoasterField(): Promise<void> {
  const settingsStore = getSettingsStore();
  const { roasterSeparator } = settingsStore.settings;

  try {
    const separator = roasterSeparator || ' ';
    const beans = await db.coffeeBeans.toArray();
    // 按需迁移：只处理没有 roaster 字段的咖啡豆
    const beansToMigrate = beans.filter(bean => !bean.roaster);

    if (beansToMigrate.length === 0) {
      return;
    }

    const updates = beansToMigrate.map(bean => {
      const extractedRoaster = extractRoasterFromName(bean.name, separator);
      // 识别不到烘焙商时保持为空（可选字段）
      const roaster =
        extractedRoaster !== '未知烘焙商' ? extractedRoaster : undefined;
      const name =
        extractedRoaster !== '未知烘焙商'
          ? removeRoasterFromName(bean.name, separator)
          : bean.name;

      return { ...bean, roaster, name };
    });

    await db.coffeeBeans.bulkPut(updates);
    await getCoffeeBeanStore().refreshBeans();

    console.warn(`[RoasterMigration] 已迁移 ${updates.length} 个咖啡豆`);
  } catch (error) {
    console.error('[RoasterMigration] 迁移失败:', error);
    throw error;
  }
}

/**
 * 重置迁移状态（已废弃）
 *
 * 由于采用按需迁移策略，此函数不再需要。
 * 保留此函数以保持 API 兼容性。
 *
 * @deprecated 按需迁移策略不再需要重置状态
 */
export async function resetRoasterMigration(): Promise<void> {
  // 按需迁移策略不再需要重置状态
  console.warn(
    '[RoasterMigration] resetRoasterMigration 已废弃，按需迁移策略不再需要重置状态'
  );
}
