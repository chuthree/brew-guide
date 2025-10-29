/**
 * 隐藏器具管理器
 * 用于隐藏和恢复器具（包括系统器具和自定义器具）
 */

import { SettingsOptions } from '@/components/settings/Settings';

/**
 * 隐藏器具
 * @param equipmentId 器具ID
 * @param settings 当前设置
 * @returns 更新后的设置
 */
export async function hideEquipment(
  equipmentId: string,
  settings: SettingsOptions
): Promise<SettingsOptions> {
  const hiddenEquipments = settings.hiddenEquipments || [];

  // 如果该器具还没有被隐藏，添加到隐藏列表
  if (!hiddenEquipments.includes(equipmentId)) {
    hiddenEquipments.push(equipmentId);
  }

  const updatedSettings = {
    ...settings,
    hiddenEquipments: hiddenEquipments,
  };

  // 保存设置
  await saveSettings(updatedSettings);

  return updatedSettings;
}

/**
 * 恢复（显示）隐藏的器具
 * @param equipmentId 器具ID
 * @param settings 当前设置
 * @returns 更新后的设置
 */
export async function unhideEquipment(
  equipmentId: string,
  settings: SettingsOptions
): Promise<SettingsOptions> {
  const hiddenEquipments = settings.hiddenEquipments || [];

  // 从隐藏列表中移除
  const updatedHidden = hiddenEquipments.filter(
    (id: string) => id !== equipmentId
  );

  const updatedSettings = {
    ...settings,
    hiddenEquipments: updatedHidden,
  };

  // 保存设置
  await saveSettings(updatedSettings);

  return updatedSettings;
}

/**
 * 检查器具是否被隐藏
 * @param equipmentId 器具ID
 * @param settings 当前设置
 * @returns 是否被隐藏
 */
function isEquipmentHidden(
  equipmentId: string,
  settings: SettingsOptions
): boolean {
  const hiddenEquipments = settings.hiddenEquipments || [];
  return hiddenEquipments.includes(equipmentId);
}

/**
 * 获取所有隐藏的器具ID列表
 * @param settings 当前设置
 * @returns 隐藏的器具ID列表
 */
export function getHiddenEquipmentIds(settings: SettingsOptions): string[] {
  return settings.hiddenEquipments || [];
}

/**
 * 过滤隐藏的器具
 * @param equipments 器具列表
 * @param settings 当前设置
 * @returns 过滤后的器具列表
 */
export function filterHiddenEquipments<
  T extends { id: string; [key: string]: unknown },
>(equipments: T[], settings: SettingsOptions): T[] {
  const hiddenIds = getHiddenEquipmentIds(settings);
  if (hiddenIds.length === 0) {
    return equipments;
  }

  return equipments.filter(equipment => {
    return !hiddenIds.includes(equipment.id);
  });
}

/**
 * 保存设置到存储
 * @param settings 要保存的设置
 */
async function saveSettings(settings: SettingsOptions): Promise<void> {
  try {
    const { Storage } = await import('@/lib/core/storage');
    await Storage.set('brewGuideSettings', JSON.stringify(settings));
  } catch (error) {
    console.error('保存隐藏器具设置失败:', error);
    throw error;
  }
}

/**
 * 清空所有隐藏的器具
 * @param settings 当前设置
 * @returns 更新后的设置
 */
async function clearAllHiddenEquipments(
  settings: SettingsOptions
): Promise<SettingsOptions> {
  const updatedSettings = {
    ...settings,
    hiddenEquipments: [],
  };

  await saveSettings(updatedSettings);
  return updatedSettings;
}
