/**
 * 隐藏通用方案管理器
 * 用于隐藏和恢复通用冲煮方案
 */

import { Method } from '@/lib/core/config';
import { SettingsOptions } from '@/components/settings/Settings';

/**
 * 隐藏通用方案
 * @param equipmentId 器具ID
 * @param methodId 方案ID
 * @param settings 当前设置
 * @returns 更新后的设置
 */
export async function hideCommonMethod(
  equipmentId: string,
  methodId: string,
  settings: SettingsOptions
): Promise<SettingsOptions> {
  const hiddenMethods = settings.hiddenCommonMethods || {};
  const equipmentHidden = hiddenMethods[equipmentId] || [];

  // 如果该方案还没有被隐藏，添加到隐藏列表
  if (!equipmentHidden.includes(methodId)) {
    equipmentHidden.push(methodId);
    hiddenMethods[equipmentId] = equipmentHidden;
  }

  const updatedSettings = {
    ...settings,
    hiddenCommonMethods: hiddenMethods,
  };

  // 保存设置
  await saveSettings(updatedSettings);

  return updatedSettings;
}

/**
 * 恢复（显示）隐藏的通用方案
 * @param equipmentId 器具ID
 * @param methodId 方案ID
 * @param settings 当前设置
 * @returns 更新后的设置
 */
export async function unhideCommonMethod(
  equipmentId: string,
  methodId: string,
  settings: SettingsOptions
): Promise<SettingsOptions> {
  const hiddenMethods = settings.hiddenCommonMethods || {};
  const equipmentHidden = hiddenMethods[equipmentId] || [];

  // 从隐藏列表中移除
  const updatedHidden = equipmentHidden.filter(id => id !== methodId);

  if (updatedHidden.length > 0) {
    hiddenMethods[equipmentId] = updatedHidden;
  } else {
    // 如果该器具没有隐藏的方案了，删除该键
    delete hiddenMethods[equipmentId];
  }

  const updatedSettings = {
    ...settings,
    hiddenCommonMethods: hiddenMethods,
  };

  // 保存设置
  await saveSettings(updatedSettings);

  return updatedSettings;
}

/**
 * 检查方案是否被隐藏
 * @param equipmentId 器具ID
 * @param methodId 方案ID
 * @param settings 当前设置
 * @returns 是否被隐藏
 */
function isMethodHidden(
  equipmentId: string,
  methodId: string,
  settings: SettingsOptions
): boolean {
  const hiddenMethods = settings.hiddenCommonMethods || {};
  const equipmentHidden = hiddenMethods[equipmentId] || [];
  return equipmentHidden.includes(methodId);
}

/**
 * 获取指定器具的所有隐藏方案ID列表
 * @param equipmentId 器具ID
 * @param settings 当前设置
 * @returns 隐藏的方案ID列表
 */
export function getHiddenMethodIds(
  equipmentId: string,
  settings: SettingsOptions
): string[] {
  const hiddenMethods = settings.hiddenCommonMethods || {};
  return hiddenMethods[equipmentId] || [];
}

/**
 * 获取所有隐藏的方案（跨所有器具）
 * @param settings 当前设置
 * @returns 按器具分组的隐藏方案列表
 */
export function getAllHiddenMethods(settings: SettingsOptions): {
  [equipmentId: string]: string[];
} {
  return settings.hiddenCommonMethods || {};
}

/**
 * 过滤隐藏的方案
 * @param methods 方案列表
 * @param equipmentId 器具ID
 * @param settings 当前设置
 * @returns 过滤后的方案列表
 */
export function filterHiddenMethods(
  methods: Method[],
  equipmentId: string,
  settings: SettingsOptions
): Method[] {
  const hiddenIds = getHiddenMethodIds(equipmentId, settings);
  if (hiddenIds.length === 0) {
    return methods;
  }

  return methods.filter(method => {
    const methodId = method.id || method.name;
    return !hiddenIds.includes(methodId);
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
    console.error('保存隐藏方案设置失败:', error);
    throw error;
  }
}

/**
 * 批量恢复器具的所有隐藏方案
 * @param equipmentId 器具ID
 * @param settings 当前设置
 * @returns 更新后的设置
 */
async function unhideAllMethodsForEquipment(
  equipmentId: string,
  settings: SettingsOptions
): Promise<SettingsOptions> {
  const hiddenMethods = settings.hiddenCommonMethods || {};
  delete hiddenMethods[equipmentId];

  const updatedSettings = {
    ...settings,
    hiddenCommonMethods: hiddenMethods,
  };

  await saveSettings(updatedSettings);
  return updatedSettings;
}

/**
 * 清空所有隐藏的方案
 * @param settings 当前设置
 * @returns 更新后的设置
 */
async function clearAllHiddenMethods(
  settings: SettingsOptions
): Promise<SettingsOptions> {
  const updatedSettings = {
    ...settings,
    hiddenCommonMethods: {},
  };

  await saveSettings(updatedSettings);
  return updatedSettings;
}
