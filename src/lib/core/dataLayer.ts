import {
  coordinateStoreActions,
  callStoreActionInMutation,
} from '@/lib/data/storeMutationBoundary';
/**
 * 数据层统一初始化器
 *
 * 在应用启动时调用，确保所有 Store 正确初始化
 * 遵循 Local-First 架构原则
 */

import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { useBrewingNoteStore } from '@/lib/stores/brewingNoteStore';
import { useCustomEquipmentStore } from '@/lib/stores/customEquipmentStore';
import { useCustomMethodStore } from '@/lib/stores/customMethodStore';
import { useEquipmentStore } from '@/lib/stores/equipmentStore';
import { useGrinderStore } from '@/lib/stores/grinderStore';
import { recordCrashCheckpoint } from '@/lib/app/crashDiagnostics';
import { migrateRoasterField } from '@/lib/utils/roasterMigration';
import { initializeDataRuntime } from '@/lib/data/runtime';
import {
  brewingNoteImageRepository,
  coffeeBeanImageRepository,
  coffeeBeanPersistence,
} from '@/lib/data/repositories';
import { stripCoffeeBeanImages } from '@/lib/coffee-beans/imageRecords';

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
 * 1. 数据库初始化
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
    // 1. 初始化当前选择的数据 backend，然后再初始化 Store。
    console.log('📦 Step 1: 初始化数据运行时...');
    recordCrashCheckpoint('data-layer:db:init');
    const runtimeInitialization = await initializeDataRuntime();
    if (runtimeInitialization.status !== 'ready') {
      throw new Error(
        `Data backend "${runtimeInitialization.backend}" is not implemented: ${runtimeInitialization.reason}`
      );
    }

    // 3. 并行初始化所有 Store
    console.log('📦 Step 3: 初始化 Stores...');
    recordCrashCheckpoint('data-layer:stores:init');
    await Promise.all([
      useSettingsStore.getState().loadSettings(),
      useCoffeeBeanStore.getState().loadBeans(),
      useBrewingNoteStore.getState().loadNotes(),
      useCustomEquipmentStore.getState().loadEquipments(),
      useCustomMethodStore.getState().loadMethods(),
      useGrinderStore.getState().initialize(),
    ]);

    // 4. 同步初始化 UI 状态 Store（不需要 await，不涉及异步操作）
    recordCrashCheckpoint('data-layer:ui-store:init');
    useEquipmentStore.getState().initialize();

    // 5. 执行烘焙商字段迁移（如果尚未完成）
    console.log('📦 Step 4: 检查烘焙商字段迁移...');
    recordCrashCheckpoint('data-layer:roaster-migrate');
    await migrateRoasterField();

    if (runtimeInitialization.backend === 'dexie') {
      try {
        const { inspectCoreDataIntegrity } =
          await import('@/lib/app/dataIntegrity');
        await inspectCoreDataIntegrity('data-layer:init');
      } catch (integrityError) {
        console.error('数据完整性检查失败:', integrityError);
      }
    }

    initState.isInitialized = true;
    initState.error = null;
    console.log('✅ 数据层初始化完成');

    if (
      runtimeInitialization.runtime === 'capacitor' &&
      runtimeInitialization.backend === 'native-sqlite'
    ) {
      try {
        const { initializeAndroidProviderBridge } =
          await import('@/lib/provider/foregroundBridge');
        await initializeAndroidProviderBridge();
      } catch {
        console.error('ContentProvider 数据恢复失败，将在下次打开时重试');
      }
    }

    if (
      runtimeInitialization.runtime === 'tauri' &&
      runtimeInitialization.backend === 'native-sqlite'
    ) {
      try {
        const { initializeDesktopMcpBridge } = await import('@/lib/mcp/bridge');
        await initializeDesktopMcpBridge();
      } catch {
        // An optional external connection must never prevent using local data.
        console.error('MCP 连接初始化失败，可在数据设置中检查后重新启动应用');
      }
    }
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
}> {
  // 确保已初始化
  if (!initState.isInitialized) {
    await initializeDataLayer();
  }

  return {
    settings: useSettingsStore.getState().settings,
    coffeeBeans: await coffeeBeanImageRepository.exportAll(),
    brewingNotes: await brewingNoteImageRepository.exportAll(),
    customEquipments: useCustomEquipmentStore.getState().equipments,
    customMethods: useCustomMethodStore.getState().methodsByEquipment,
    grinders: useGrinderStore.getState().grinders,
  };
}

/**
 * 导入所有数据（用于恢复/同步）
 */
async function importAllDataInMutation(data: {
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
}): Promise<void> {
  console.log('📥 开始导入数据...');

  const tasks: Promise<void>[] = [];

  if (data.settings) {
    tasks.push(
      callStoreActionInMutation(
        useSettingsStore.getState().importSettings,
        data.settings
      )
    );
  }

  if (data.coffeeBeans) {
    tasks.push(
      (async () => {
        const replaced = await coffeeBeanPersistence.replaceAllWithImages(
          data.coffeeBeans!,
          { allowDestructiveReplace: true }
        );
        if (replaced) {
          useCoffeeBeanStore.setState({
            beans: data.coffeeBeans!.map(stripCoffeeBeanImages),
          });
        } else {
          await useCoffeeBeanStore.getState().refreshBeans();
        }
      })()
    );
  }

  if (data.brewingNotes) {
    tasks.push(
      (async () => {
        for (const note of data.brewingNotes!) {
          await callStoreActionInMutation(
            useBrewingNoteStore.getState().upsertNote,
            note
          );
        }
      })()
    );
  }

  if (data.customEquipments) {
    tasks.push(
      (async () => {
        for (const equipment of data.customEquipments!) {
          await callStoreActionInMutation(
            useCustomEquipmentStore.getState().upsertEquipment,
            equipment
          );
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
          await callStoreActionInMutation(
            useCustomMethodStore.getState().setMethodsForEquipment,
            equipmentId,
            methods
          );
        }
      })()
    );
  }

  if (data.grinders) {
    tasks.push(
      callStoreActionInMutation(
        useGrinderStore.getState().setGrinders,
        data.grinders
      )
    );
  }

  await Promise.all(tasks);
  console.log('✅ 数据导入完成');
}

export const { importAllData } = coordinateStoreActions(
  { importAllData: importAllDataInMutation },
  ['importAllData']
);
