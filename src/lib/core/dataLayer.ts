/**
 * 数据层统一初始化器
 *
 * 在应用启动时调用，确保所有 Store 正确初始化
 * 遵循 Local-First 架构原则
 */

import { dbUtils } from '@/lib/core/db';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { useBrewingNoteStore } from '@/lib/stores/brewingNoteStore';
import { useCustomEquipmentStore } from '@/lib/stores/customEquipmentStore';
import { useCustomMethodStore } from '@/lib/stores/customMethodStore';
import { useEquipmentStore } from '@/lib/stores/equipmentStore';
import { useGrinderStore } from '@/lib/stores/grinderStore';
import { useYearlyReportStore } from '@/lib/stores/yearlyReportStore';
import { migrateRoasterField } from '@/lib/utils/roasterMigration';

/**
 * 初始化状态
 */
interface InitializationState {
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
}

let initState: InitializationState = {
  isInitialized: false,
  isInitializing: false,
  error: null,
};

/**
 * 初始化所有数据 Store
 *
 * 调用顺序很重要：
 * 1. 数据库初始化（含迁移）
 * 2. 设置 Store（其他 Store 可能依赖设置）
 * 3. 核心数据 Store（咖啡豆、笔记）
 * 4. 器具相关 Store
 * 5. 其他 Store
 */
export async function initializeDataLayer(): Promise<void> {
  // 防止重复初始化
  if (initState.isInitialized || initState.isInitializing) {
    return;
  }

  initState.isInitializing = true;
  console.log('📦 开始初始化数据层...');

  try {
    // 1. 初始化数据库
    console.log('📦 Step 1: 初始化数据库...');
    await dbUtils.initialize();

    // 2. 迁移旧数据
    console.log('📦 Step 2: 迁移旧数据...');
    await dbUtils.migrateFromLocalStorage();

    // 3. 并行初始化所有 Store
    console.log('📦 Step 3: 初始化 Stores...');
    await Promise.all([
      useSettingsStore.getState().loadSettings(),
      useCoffeeBeanStore.getState().loadBeans(),
      useBrewingNoteStore.getState().loadNotes(),
      useCustomEquipmentStore.getState().loadEquipments(),
      useCustomMethodStore.getState().loadMethods(),
      useGrinderStore.getState().initialize(),
      useYearlyReportStore.getState().loadReports(),
    ]);

    // 4. 同步初始化 UI 状态 Store（不需要 await，不涉及异步操作）
    useEquipmentStore.getState().initialize();

    // 5. 执行烘焙商字段迁移（如果尚未完成）
    console.log('📦 Step 4: 检查烘焙商字段迁移...');
    await migrateRoasterField();

    initState.isInitialized = true;
    initState.error = null;
    console.log('✅ 数据层初始化完成');
  } catch (error) {
    console.error('❌ 数据层初始化失败:', error);
    initState.error = error instanceof Error ? error.message : '初始化失败';
    throw error;
  } finally {
    initState.isInitializing = false;
  }
}

/**
 * 获取初始化状态
 */
export function getInitializationState(): InitializationState {
  return { ...initState };
}

/**
 * 重置初始化状态（用于测试或重新初始化）
 */
export function resetInitializationState(): void {
  initState = {
    isInitialized: false,
    isInitializing: false,
    error: null,
  };
}

/**
 * 刷新所有数据
 * 用于同步完成后重新加载数据
 */
export async function refreshAllData(): Promise<void> {
  console.log('🔄 刷新所有数据...');

  await Promise.all([
    useSettingsStore.getState().loadSettings(),
    useCoffeeBeanStore.getState().refreshBeans(),
    useBrewingNoteStore.getState().refreshNotes(),
    useCustomEquipmentStore.getState().refreshEquipments(),
    useCustomMethodStore.getState().refreshMethods(),
    useGrinderStore.getState().refreshGrinders(),
    useYearlyReportStore.getState().refreshReports(),
  ]);

  console.log('✅ 数据刷新完成');
}

/**
 * 导出所有数据（用于备份/同步）
 */
export async function exportAllData(): Promise<{
  settings: ReturnType<typeof useSettingsStore.getState>['settings'];
  coffeeBeans: ReturnType<typeof useCoffeeBeanStore.getState>['beans'];
  brewingNotes: ReturnType<typeof useBrewingNoteStore.getState>['notes'];
  customEquipments: ReturnType<
    typeof useCustomEquipmentStore.getState
  >['equipments'];
  customMethods: ReturnType<
    typeof useCustomMethodStore.getState
  >['methodsByEquipment'];
  grinders: ReturnType<typeof useGrinderStore.getState>['grinders'];
  yearlyReports: ReturnType<typeof useYearlyReportStore.getState>['reports'];
}> {
  // 确保已初始化
  if (!initState.isInitialized) {
    await initializeDataLayer();
  }

  return {
    settings: useSettingsStore.getState().settings,
    coffeeBeans: useCoffeeBeanStore.getState().beans,
    brewingNotes: useBrewingNoteStore.getState().notes,
    customEquipments: useCustomEquipmentStore.getState().equipments,
    customMethods: useCustomMethodStore.getState().methodsByEquipment,
    grinders: useGrinderStore.getState().grinders,
    yearlyReports: useYearlyReportStore.getState().reports,
  };
}

/**
 * 导入所有数据（用于恢复/同步）
 */
export async function importAllData(data: {
  settings?: ReturnType<typeof useSettingsStore.getState>['settings'];
  coffeeBeans?: ReturnType<typeof useCoffeeBeanStore.getState>['beans'];
  brewingNotes?: ReturnType<typeof useBrewingNoteStore.getState>['notes'];
  customEquipments?: ReturnType<
    typeof useCustomEquipmentStore.getState
  >['equipments'];
  customMethods?: ReturnType<
    typeof useCustomMethodStore.getState
  >['methodsByEquipment'];
  grinders?: ReturnType<typeof useGrinderStore.getState>['grinders'];
  yearlyReports?: ReturnType<typeof useYearlyReportStore.getState>['reports'];
}): Promise<void> {
  console.log('📥 开始导入数据...');

  const tasks: Promise<void>[] = [];

  if (data.settings) {
    tasks.push(useSettingsStore.getState().importSettings(data.settings));
  }

  if (data.coffeeBeans) {
    tasks.push(
      (async () => {
        for (const bean of data.coffeeBeans!) {
          await useCoffeeBeanStore.getState().upsertBean(bean);
        }
      })()
    );
  }

  if (data.brewingNotes) {
    tasks.push(
      (async () => {
        for (const note of data.brewingNotes!) {
          await useBrewingNoteStore.getState().upsertNote(note);
        }
      })()
    );
  }

  if (data.customEquipments) {
    tasks.push(
      (async () => {
        for (const equipment of data.customEquipments!) {
          await useCustomEquipmentStore.getState().upsertEquipment(equipment);
        }
      })()
    );
  }

  if (data.customMethods) {
    tasks.push(
      (async () => {
        for (const [equipmentId, methods] of Object.entries(
          data.customMethods!
        )) {
          await useCustomMethodStore
            .getState()
            .setMethodsForEquipment(equipmentId, methods);
        }
      })()
    );
  }

  if (data.grinders) {
    tasks.push(useGrinderStore.getState().setGrinders(data.grinders));
  }

  if (data.yearlyReports) {
    tasks.push(
      (async () => {
        for (const report of data.yearlyReports!) {
          await useYearlyReportStore.getState().upsertReport(report);
        }
      })()
    );
  }

  await Promise.all(tasks);
  console.log('✅ 数据导入完成');
}
