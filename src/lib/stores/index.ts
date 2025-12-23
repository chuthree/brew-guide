/**
 * Store 统一导出
 *
 * 所有 Zustand Store 的统一入口
 * 遵循 Local-First 架构，所有数据变更通过 Store -> IndexedDB
 */

// 核心数据 Store
export {
  useCoffeeBeanStore,
  getCoffeeBeanStore,
  // 容量相关工具函数
  CapacitySyncManager,
  updateBeanRemaining,
  increaseBeanRemaining,
  getRatedBeans,
  getRatedBeansByType,
  getBeanByName,
} from './coffeeBeanStore';
export { useBrewingNoteStore, getBrewingNoteStore } from './brewingNoteStore';

// 设置 Store
export {
  useSettingsStore,
  getSettingsStore,
  defaultSettings,
  useSetting,
  useSettings,
  // 隐藏器具/方案工具函数
  isEquipmentHidden,
  getHiddenEquipmentIds,
  filterHiddenEquipments,
  isMethodHidden,
  getAllHiddenMethods,
  getHiddenMethodIds,
  filterHiddenMethods,
  // 器具排序工具函数
  loadEquipmentOrder,
  saveEquipmentOrder,
} from './settingsStore';

// 器具相关 Store
export {
  useCustomEquipmentStore,
  getCustomEquipmentStore,
  addEquipmentWithMethods,
  loadCustomEquipments,
  saveCustomEquipment,
  deleteCustomEquipment,
  isEquipmentNameAvailable,
} from './customEquipmentStore';
export {
  useCustomMethodStore,
  getCustomMethodStore,
  saveMethod,
  copyMethodToEquipment,
  loadCustomMethods,
  loadCustomMethodsForEquipment,
  saveCustomMethod,
  deleteCustomMethod,
} from './customMethodStore';
export { useEquipmentStore } from './equipmentStore';

// 磨豆机 Store
export {
  useGrinderStore,
  getGrinderStore,
  parseGrinderFromGrindSize,
  syncGrinderScale,
} from './grinderStore';
export type { Grinder } from './grinderStore';

// 年度报告 Store
export {
  useYearlyReportStore,
  getYearlyReportStore,
} from './yearlyReportStore';
export type { YearlyReport } from './yearlyReportStore';

// 同步状态 Store
export { useSyncStatusStore } from './syncStatusStore';

// 类型重新导出
export type { AppSettings } from '@/lib/core/db';
