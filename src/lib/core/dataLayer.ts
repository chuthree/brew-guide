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
import {
  omitSyncConnectionSettings,
  preserveSyncConnectionSettings,
} from '@/lib/settings/deviceSettings';
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

let initializationPromise: Promise<void> | null = null;

export function initializeDataLayer(): Promise<void> {
  if (initializationPromise) return initializationPromise;

  initializationPromise = initializeStores().catch(error => {
    initializationPromise = null;
    throw error;
  });
  return initializationPromise;
}

async function initializeStores(): Promise<void> {
  console.log('📦 开始初始化数据层...');

  try {
    // 1. 初始化当前选择的数据 backend，然后再初始化 Store。
    console.log('📦 Step 1: 初始化数据运行时...');
    recordCrashCheckpoint('data-layer:db:init');
    const runtimeInitialization = await initializeDataRuntime();

    // 3. 并行初始化所有 Store
    console.log('📦 Step 3: 初始化 Stores...');
    recordCrashCheckpoint('data-layer:stores:init');
    const initializers = [
      ['应用设置', useSettingsStore.getState().loadSettings],
      ['咖啡豆', useCoffeeBeanStore.getState().loadBeans],
      ['冲煮笔记', useBrewingNoteStore.getState().loadNotes],
      ['自定义器具', useCustomEquipmentStore.getState().loadEquipments],
      ['自定义方案', useCustomMethodStore.getState().loadMethods],
      ['磨豆机', useGrinderStore.getState().initialize],
    ] as const;
    await Promise.all(
      initializers.map(async ([name, initialize]) => {
        try {
          await initialize();
        } catch (cause) {
          throw new Error(
            `${name}加载失败: ${cause instanceof Error ? cause.message : String(cause)}`,
            { cause }
          );
        }
      })
    );

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
    throw error;
  }
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
  await initializeDataLayer();

  return {
    settings: omitSyncConnectionSettings(useSettingsStore.getState().settings),
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
        preserveSyncConnectionSettings(
          data.settings,
          useSettingsStore.getState().settings
        )
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
          useCoffeeBeanStore
            .getState()
            .setBeans(data.coffeeBeans!.map(stripCoffeeBeanImages));
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
