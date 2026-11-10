import { callStoreActionInMutation } from '@/lib/data/storeMutationBoundary';
import { withDataMutation } from '@/lib/data/mutationCoordinator';
import { readCustomPresets } from '@/lib/settings/customPresets';
import {
  Method as _Method,
  CustomEquipment,
  BrewingNote as _BrewingNote,
} from '@/lib/core/config';
import { CoffeeBean as _CoffeeBean, BlendComponent } from '@/types/app';
import { APP_VERSION } from '@/lib/core/config';
import { detectAppRuntime } from '@/lib/app/runtime';
import type {
  Grinder,
  RoasterConfig,
  SettingsOptions as _SettingsOptions,
} from '@/lib/data/models';
import { LayoutSettings as _LayoutSettings } from '@/components/brewing/Timer/Settings';
import {
  appSettingsRepository,
  brewingNoteImageRepository,
  brewingNotePersistence,
  brewingNoteRepository,
  coffeeBeanImageRepository,
  coffeeBeanPersistence,
  coffeeBeanRepository,
  customEquipmentRepository,
  customMethodRepository,
  grinderRepository,
  legacySettingsRepository,
  imageSourcePayloadValidator,
  dataImportPersistence,
} from '@/lib/data/repositories';
import { resolveStorageBackend } from '@/lib/data/runtime';
import {
  getRoasterConfigsSync,
  getSettingsStore,
  normalizeImportedSettings,
  useSettingsStore,
} from '@/lib/stores/settingsStore';
import { normalizeCoffeeBeans } from '@/lib/utils/coffeeBeanUtils';
import { recordCrashOperationStep } from '@/lib/app/crashDiagnostics';
import { markExpectedCoreDataMutation } from '@/lib/app/dataIntegrity';
import {
  omitDeviceSettings,
  preserveDeviceSettings,
  omitSyncConnectionSettings,
  preserveSyncConnectionSettings,
} from '@/lib/settings/deviceSettings';

// 检查是否在浏览器环境中
const isBrowser = typeof window !== 'undefined';

// 动态导入 Storage 的辅助函数
const getStorage = async () => {
  const { Storage } = await import('@/lib/core/storage');
  return Storage;
};

// 定义导出数据的接口
interface ExportData {
  exportDate: string;
  appVersion: string;
  timeZone: string; // 新增时区字段
  data: Record<string, unknown>;
}

// 定义导入数据的接口
interface ImportData {
  exportDate?: string;
  appVersion?: string;
  timeZone?: string;
  data?: Record<string, unknown>;
}

interface ExportAllDataOptions {
  /** 跨设备备份排除设备设置；普通导出也不包含同步连接配置。 */
  excludeDeviceSettings?: boolean;
  pretty?: boolean;
  collectDiagnostics?: boolean;
  /** 默认拒绝不完整备份，避免恢复时把导出失败的数据当作删除。 */
  strict?: boolean;
  /** Upgrade backup: use frozen core data before repositories are bound. */
  snapshot?: Record<string, unknown>;
}

type LegacyCoffeeBeanRecord = _CoffeeBean & {
  origin?: string;
  process?: string;
  variety?: string;
  type?: unknown;
};

// 使用从 config.ts 导入的 BrewingNote 类型

/**
 * 应用数据键名列表
 * 注意：这些键名用于导入/导出兼容性
 * - 新数据存储在 IndexedDB (appSettings, coffeeBeans, brewingNotes, customEquipments 等表)
 * - 这里的键名主要用于处理旧版本数据导入和 Storage 层面的操作
 */
export const APP_DATA_KEYS = [
  'customMethods', // 自定义冲煮方案
  'brewingNotes', // 冲煮记录
  'brewGuideSettings', // 应用设置（包含 flavorDimensions, roasterConfigs 等）
  'brewingNotesVersion', // 数据版本
  'coffeeBeans', // 咖啡豆数据
  'customEquipments', // 自定义器具
  'equipmentOrder', // 器具排序信息（已迁移到 brewGuideSettings）
  'onboardingCompleted', // 引导完成标记
  'backupReminderSettings', // 备份提醒设置
  'grinders', // 磨豆机数据
];

/**
 * 自定义预设键名前缀
 */
const CUSTOM_PRESETS_PREFIX = 'brew-guide:custom-presets:';

/**
 * 自定义预设键名列表
 */
const CUSTOM_PRESETS_KEYS = [
  'origins', // 产地
  'countries', // 产国
  'regions', // 产区
  'estates', // 庄园
  'processingStations', // 处理站
  'altitudes', // 海拔
  'processes', // 处理法
  'batches', // 批次
  'varieties', // 品种
];

/**
 * 数据管理工具类
 */
export const DataManager = {
  /**
	/**
	 * 格式化日期以包含时区偏移
	 * @param date 日期对象
	 * @returns 格式化的日期字符串
	 */
  formatDateWithTimezone(date: Date): string {
    const pad = (num: number) => num.toString().padStart(2, '0');
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const offsetHours = pad(Math.floor(Math.abs(offset) / 60));
    const offsetMinutes = pad(Math.abs(offset) % 60);

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${date.getMilliseconds().toString().padStart(3, '0')}${sign}${offsetHours}:${offsetMinutes}`;
  },

  /**
   * 导出数据
   * @returns 包含数据的JSON字符串
   */
  async exportAllData(options: ExportAllDataOptions = {}): Promise<string> {
    try {
      const {
        pretty = false,
        collectDiagnostics = false,
        strict = true,
        snapshot,
      } = options;
      const now = new Date();
      const exportData: ExportData = {
        exportDate: this.formatDateWithTimezone(now),
        appVersion: APP_VERSION,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        data: {},
      };

      // Startup migration exports a frozen legacy snapshot before repositories
      // are bound. Never mix it with live settings or silently omit fields.
      if (snapshot) {
        exportData.data = { ...snapshot };
        if (Array.isArray(snapshot.brewingNotes)) {
          exportData.data.brewingNotes = this.cleanBrewingNotesForExport(
            snapshot.brewingNotes as _BrewingNote[]
          );
        }
        const roasters = (
          snapshot.brewGuideSettings as _SettingsOptions | undefined
        )?.roasterConfigs;
        if (roasters?.length && !Object.hasOwn(snapshot, 'roasterConfigs')) {
          exportData.data.roasterConfigs = roasters;
        }
        if (Object.hasOwn(snapshot, 'legacyIndexedDB')) {
          const { compactLegacyBackupSnapshot } =
            await import('@/lib/data/legacy/legacyMigrationBackup');
          exportData.data.legacyIndexedDB = compactLegacyBackupSnapshot(
            snapshot.legacyIndexedDB,
            exportData.data
          );
        }
        return JSON.stringify(exportData, null, pretty ? 2 : undefined);
      }

      // 获取数据
      const storage = await getStorage();
      for (const key of APP_DATA_KEYS) {
        if (options.excludeDeviceSettings && key === 'backupReminderSettings')
          continue;
        // 特殊处理 brewGuideSettings - 从 settingsStore 获取
        if (key === 'brewGuideSettings') {
          const settingsFromStore = getSettingsStore().settings;
          exportData.data[key] = options.excludeDeviceSettings
            ? omitDeviceSettings(settingsFromStore)
            : omitSyncConnectionSettings(settingsFromStore);
          continue;
        }

        // 特殊处理 grinders
        if (key === 'grinders') {
          const grinders = await grinderRepository.list();
          exportData.data[key] = grinders;
          continue;
        }

        // 特殊处理 coffeeBeans - 从 IndexedDB 获取
        if (key === 'coffeeBeans') {
          if (collectDiagnostics) {
            const [beanCount, imageCounts] = await Promise.all([
              coffeeBeanRepository.count(),
              coffeeBeanImageRepository.getRecordCounts(),
            ]);

            recordCrashOperationStep('coffee-beans:image-preflight', {
              beanCount,
              imageRecordCount: imageCounts.records,
              thumbnailRecordCount: imageCounts.thumbnails,
            });
          }

          exportData.data[key] = await coffeeBeanImageRepository.exportAll();
          continue;
        }

        // 特殊处理 customEquipments - 从 IndexedDB 获取
        if (key === 'customEquipments') {
          exportData.data[key] = await customEquipmentRepository.list();
          continue;
        }

        // 特殊处理 brewingNotes - 从 IndexedDB 获取
        if (key === 'brewingNotes') {
          if (collectDiagnostics) {
            recordCrashOperationStep('brewing-notes:preflight', {
              noteCount: await brewingNoteRepository.count(),
            });
          }

          const notes = await brewingNoteImageRepository.exportAll();
          exportData.data[key] = this.cleanBrewingNotesForExport(notes);
          continue;
        }

        const value = await storage.get(key);
        if (value) {
          try {
            // 尝试解析JSON
            const parsedValue = JSON.parse(value);

            exportData.data[key] = parsedValue;

            // 如果是冲煮笔记数据，清理冗余的咖啡豆信息
            if (key === 'brewingNotes' && Array.isArray(exportData.data[key])) {
              exportData.data[key] = this.cleanBrewingNotesForExport(
                exportData.data[key] as _BrewingNote[]
              );
            }
          } catch {
            // 如果不是JSON，直接存储字符串
            exportData.data[key] = value;
          }
        }
      }

      // 导出自定义方案数据（优先从IndexedDB获取，确保数据完整性）
      try {
        exportData.data.customMethodsByEquipment = {};

        // 优先从IndexedDB加载自定义方案数据
        const methodsFromDB = await customMethodRepository.list();
        if (methodsFromDB && methodsFromDB.length > 0) {
          for (const item of methodsFromDB) {
            const { equipmentId, methods } = item;
            if (Array.isArray(methods) && methods.length > 0) {
              (
                exportData.data.customMethodsByEquipment as Record<
                  string,
                  unknown
                >
              )[equipmentId] = methods;
            }
          }
        } else {
          // 如果IndexedDB中没有数据，从Storage加载
          const allKeys = await storage.keys();
          const methodKeys = allKeys.filter((key: string) =>
            key.startsWith('customMethods_')
          );

          for (const key of methodKeys) {
            const equipmentId = key.replace('customMethods_', '');
            const methodsJson = await storage.get(key);
            if (methodsJson) {
              try {
                const methods = JSON.parse(methodsJson);
                (
                  exportData.data.customMethodsByEquipment as Record<
                    string,
                    unknown
                  >
                )[equipmentId] = methods;
              } catch {
                if (strict) throw new Error(`自定义方案数据无效: ${key}`);
                console.error(`解析自定义方案数据失败: ${key}`);
              }
            }
          }
        }
      } catch (error) {
        if (strict) throw error;
        console.error('导出自定义方案失败:', error);
      }

      // 导出自定义预设数据
      try {
        if (isBrowser) {
          // 初始化自定义预设存储结构
          exportData.data.customPresets = {};

          // 处理每个自定义预设类型
          for (const key of CUSTOM_PRESETS_KEYS) {
            (exportData.data.customPresets as Record<string, string[]>)[key] =
              readCustomPresets(key);
          }
        }
      } catch (error) {
        if (strict) throw error;
        console.error('导出自定义预设失败:', error);
        // 错误处理：即使自定义预设导出失败，也继续导出其他数据
      }

      // 注意：roasterConfigs 已包含在 brewGuideSettings 中，无需单独导出
      // 为了向后兼容，仍然单独导出一份（使用新的 key 名称）
      try {
        const roasterConfigs = getRoasterConfigsSync();
        if (roasterConfigs.length > 0) {
          exportData.data['roasterConfigs'] = roasterConfigs;
        }
      } catch (error) {
        if (strict) throw error;
        console.error('导出烘焙商配置失败:', error);
      }

      const jsonData = pretty
        ? JSON.stringify(exportData, null, 2)
        : JSON.stringify(exportData);

      if (collectDiagnostics) {
        recordCrashOperationStep('data-export:stringified', {
          jsonLength: jsonData.length,
          dataKeys: Object.keys(exportData.data),
        });
      }

      return jsonData;
    } catch (error) {
      console.error('导出数据失败:', error);
      if (options.collectDiagnostics) {
        recordCrashOperationStep('data-export:error', {
          message: error instanceof Error ? error.message : String(error),
        });
      }
      throw new Error(
        error instanceof Error
          ? `导出数据失败: ${error.message}`
          : '导出数据失败'
      );
    }
  },

  /**
   * 导入数据
   * @param jsonString 备份文件（流式读取），或同步调用方已读取的 JSON 字符串
   * @returns 导入结果
   */
  async importAllData(
    jsonString: string | Blob,
    options: {
      preserveDeviceSettings?: boolean;
      expectedSyncData?: Record<string, unknown>;
      onProgress?: (phase: 'checking' | 'importing', fraction: number) => void;
    } = {}
  ): Promise<{ success: boolean; message: string }> {
    let committed = false;
    try {
      return await withDataMutation(async () => {
        if (options.expectedSyncData) {
          const { syncDataEqual, parseSyncDocument } =
            await import('@/lib/sync/mergeData');
          const current = parseSyncDocument(
            await this.exportAllData({
              excludeDeviceSettings: true,
              strict: true,
            })
          );
          if (!syncDataEqual(current.data, options.expectedSyncData)) {
            throw new Error('同步期间本地数据发生变化，请重试');
          }
        }
        let document: ImportData;
        const file = typeof jsonString === 'string' ? undefined : jsonString;
        const streamedSections = new Set<'coffeeBeans' | 'brewingNotes'>();
        if (file) {
          const { readBackupStream } = await import('@/lib/data/backupStream');
          let parsed: ImportData | undefined;
          for await (const event of readBackupStream(file, fraction =>
            options.onProgress?.('checking', fraction)
          )) {
            if (event.section === 'document') parsed = event.value;
          }
          if (!parsed?.data) throw new Error('备份文件不完整');
          document = parsed;
          for (const section of ['coffeeBeans', 'brewingNotes'] as const) {
            if (Object.hasOwn(parsed.data, section)) {
              streamedSections.add(section);
              delete parsed.data[section];
            }
          }
        } else {
          document = JSON.parse(jsonString as string) as ImportData;
        }
        const data = document?.data;
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw new Error('导入的数据格式不正确，缺少有效的 data 字段');
        }
        const plan: import('@/lib/data/importData').DataImportPlan = {
          legacy: {},
        };
        const native =
          resolveStorageBackend(detectAppRuntime()) === 'native-sqlite';
        for (const key of [
          'coffeeBeans',
          'brewingNotes',
          'customEquipments',
          'grinders',
        ] as const) {
          if (!Object.hasOwn(data, key)) continue;
          const records = data[key];
          if (
            !Array.isArray(records) ||
            records.some(
              record =>
                !record ||
                typeof record !== 'object' ||
                Array.isArray(record) ||
                typeof record.id !== 'string' ||
                !record.id.trim()
            )
          )
            throw new Error(`${key} 格式无效，应为包含有效 id 的记录数组`);
        }
        if (Array.isArray(data.coffeeBeans)) {
          plan.coffeeBeans = normalizeCoffeeBeans(
            data.coffeeBeans as _CoffeeBean[],
            { ensureFlavorArray: true }
          );
          if (native)
            plan.coffeeBeans = plan.coffeeBeans.map(bean => ({
              ...bean,
              ...(bean.image === null ? { image: undefined } : {}),
              ...(bean.backImage === null ? { backImage: undefined } : {}),
            }));
          await imageSourcePayloadValidator.validateCoffeeBeans(
            plan.coffeeBeans
          );
        }
        if (Array.isArray(data.brewingNotes)) {
          plan.brewingNotes = (data.brewingNotes as _BrewingNote[]).map(note =>
            native && note.rating == null ? { ...note, rating: 0 } : note
          );
          await imageSourcePayloadValidator.validateBrewingNotes(
            plan.brewingNotes
          );
        }
        if (Array.isArray(data.customEquipments))
          plan.customEquipments = data.customEquipments as CustomEquipment[];
        if (Array.isArray(data.grinders))
          plan.grinders = data.grinders as Grinder[];

        const currentSettings = getSettingsStore().settings;
        if (Object.hasOwn(data, 'brewGuideSettings')) {
          let incoming = data.brewGuideSettings as Record<string, unknown>;
          if (
            !incoming ||
            typeof incoming !== 'object' ||
            Array.isArray(incoming)
          )
            throw new Error('brewGuideSettings 格式无效');
          if (
            incoming.state &&
            typeof incoming.state === 'object' &&
            'settings' in incoming.state
          ) {
            incoming = incoming.state.settings as Record<string, unknown>;
          }
          if (
            !incoming ||
            typeof incoming !== 'object' ||
            Array.isArray(incoming)
          )
            throw new Error('brewGuideSettings 格式无效');
          let settings = { ...incoming } as Partial<_SettingsOptions>;
          if (options.preserveDeviceSettings)
            settings = preserveDeviceSettings(settings, currentSettings);
          settings = preserveSyncConnectionSettings(settings, currentSettings);
          if (
            Array.isArray(data.customFlavorDimensions) &&
            !settings.flavorDimensions?.length
          ) {
            settings.flavorDimensions = data.customFlavorDimensions;
          }
          if (
            data.flavorDimensionHistoricalLabels &&
            typeof data.flavorDimensionHistoricalLabels === 'object'
          ) {
            settings.flavorDimensionHistoricalLabels = {
              ...settings.flavorDimensionHistoricalLabels,
              ...(data.flavorDimensionHistoricalLabels as Record<
                string,
                string
              >),
            };
          }
          const legacyGrinders = incoming.grinders;
          if (!plan.grinders && Array.isArray(legacyGrinders)) {
            plan.grinders = legacyGrinders.filter(
              g => g && typeof g === 'object' && g.id && g.name
            );
          }
          plan.settings = normalizeImportedSettings(
            settings as _SettingsOptions
          );
          // Presets have their own backup section; older settings must not erase them.
          plan.settings.customPresets = currentSettings.customPresets;
        }
        if (Object.hasOwn(data, 'customPresets')) {
          const presets = data.customPresets;
          if (!presets || typeof presets !== 'object' || Array.isArray(presets))
            throw new Error('customPresets 格式无效，应为对象');
          const normalized: Record<string, string[]> = {
            ...currentSettings.customPresets,
          };
          for (const key of CUSTOM_PRESETS_KEYS) {
            const values = Object.hasOwn(presets, key)
              ? (presets as Record<string, unknown>)[key]
              : [];
            if (
              !Array.isArray(values) ||
              values.some(value => typeof value !== 'string')
            )
              throw new Error(`customPresets.${key} 格式无效，应为字符串数组`);
            normalized[key] = values;
          }
          plan.settings = {
            ...(plan.settings ?? currentSettings),
            customPresets: normalized,
          };
        }
        if (Object.hasOwn(data, 'customMethodsByEquipment')) {
          const methods = data.customMethodsByEquipment;
          if (!methods || typeof methods !== 'object' || Array.isArray(methods))
            throw new Error('customMethodsByEquipment 格式无效');
          plan.methods = Object.entries(methods).map(
            ([equipmentId, values]) => {
              if (!equipmentId.trim() || !Array.isArray(values))
                throw new Error('自定义方案格式无效');
              return { equipmentId, methods: values as _Method[] };
            }
          );
        }
        const roasters = data.roasterConfigs ?? data['roaster-logos'];
        if (roasters !== undefined) {
          if (!Array.isArray(roasters))
            throw new Error('roasterConfigs 格式无效');
          const settings = plan.settings ?? currentSettings;
          const configs = [...(settings.roasterConfigs ?? [])];
          for (const config of roasters as RoasterConfig[]) {
            if (
              !config ||
              typeof config.roasterName !== 'string' ||
              !config.roasterName.trim()
            )
              throw new Error('烘焙商配置格式无效');
            const index = configs.findIndex(
              value => value.roasterName === config.roasterName
            );
            const previous = configs[index];
            const next = {
              ...previous,
              ...config,
              updatedAt: Date.now(),
              logoUpdatedAt: Math.max(
                Date.now(),
                (previous?.logoUpdatedAt ?? 0) + 1
              ),
            };
            if (index < 0) configs.push(next);
            else configs[index] = next;
          }
          plan.settings = { ...settings, roasterConfigs: configs };
        }
        for (const key of APP_DATA_KEYS) {
          if (
            [
              'coffeeBeans',
              'brewingNotes',
              'customEquipments',
              'grinders',
              'brewGuideSettings',
            ].includes(key)
          )
            continue;
          if (
            options.preserveDeviceSettings &&
            key === 'backupReminderSettings'
          )
            continue;
          if (data[key] !== undefined)
            plan.legacy[key] =
              typeof data[key] === 'object'
                ? JSON.stringify(data[key])
                : String(data[key]);
        }
        if (plan.coffeeBeans) {
          const { extractRoasterFromName, removeRoasterFromName } =
            await import('@/lib/utils/beanVarietyUtils');
          const separator =
            (plan.settings ?? currentSettings).roasterSeparator || ' ';
          plan.coffeeBeans = plan.coffeeBeans.map(bean => {
            if (bean.roaster) return bean;
            const roaster = extractRoasterFromName(bean.name, separator);
            return roaster
              ? {
                  ...bean,
                  roaster,
                  name: removeRoasterFromName(bean.name, separator),
                }
              : bean;
          });
        }
        if (file) {
          const { readBackupStream } = await import('@/lib/data/backupStream');
          const { extractRoasterFromName, removeRoasterFromName } =
            await import('@/lib/utils/beanVarietyUtils');
          const separator =
            (plan.settings ?? currentSettings).roasterSeparator || ' ';
          plan.streamed = {
            sections: streamedSections,
            records: (async function* () {
              for await (const event of readBackupStream(file, fraction =>
                options.onProgress?.('importing', fraction)
              )) {
                if (event.section === 'coffeeBeans') {
                  let [bean] = normalizeCoffeeBeans(
                    [event.value as unknown as _CoffeeBean],
                    { ensureFlavorArray: true }
                  );
                  if (native)
                    bean = {
                      ...bean,
                      ...(bean.image === null ? { image: undefined } : {}),
                      ...(bean.backImage === null
                        ? { backImage: undefined }
                        : {}),
                    };
                  if (!bean.roaster) {
                    const roaster = extractRoasterFromName(
                      bean.name,
                      separator
                    );
                    if (roaster)
                      bean = {
                        ...bean,
                        roaster,
                        name: removeRoasterFromName(bean.name, separator),
                      };
                  }
                  await imageSourcePayloadValidator.validateCoffeeBeans([bean]);
                  yield { section: 'coffeeBeans' as const, value: bean };
                } else if (event.section === 'brewingNotes') {
                  let note = event.value as unknown as _BrewingNote;
                  if (native && note.rating == null)
                    note = { ...note, rating: 0 };
                  await imageSourcePayloadValidator.validateBrewingNotes([
                    note,
                  ]);
                  yield { section: 'brewingNotes' as const, value: note };
                }
              }
            })(),
          };
        }
        await dataImportPersistence.importData(plan);
        committed = true;

        // Persistence has committed. Cache/notification failures cannot turn it into a failed import.
        try {
          if (plan.settings)
            useSettingsStore.setState({ settings: plan.settings });
          await markExpectedCoreDataMutation('data-import');
          const { announceBusinessHistoryInvalidation } =
            await import('@/lib/data/business/maintenance');
          announceBusinessHistoryInvalidation();
          const { getCoffeeBeanStore } =
            await import('@/lib/stores/coffeeBeanStore');
          const { getGrinderStore } = await import('@/lib/stores/grinderStore');
          await getCoffeeBeanStore().refreshBeans();
          await callStoreActionInMutation(getGrinderStore().refreshGrinders);
          if (isBrowser) {
            for (const name of [
              'coffeeBeansUpdated',
              'customEquipmentUpdate',
              'customMethodUpdate',
              'settingsChanged',
            ]) {
              window.dispatchEvent(
                new CustomEvent(name, { detail: { source: 'importAllData' } })
              );
            }
            window.dispatchEvent(
              new CustomEvent('storage:changed', {
                detail: { key: 'allData', action: 'import' },
              })
            );
          }
        } catch (error) {
          console.error('数据已导入，刷新缓存失败，请重新打开应用:', error);
        }
        return {
          success: true,
          message: '数据导入成功',
        };
      });
    } catch (error) {
      if (committed) {
        console.error('数据已导入，会话清理失败:', error);
        return {
          success: true,
          message: '数据已导入，请重新打开应用加载最新数据',
        };
      }
      return {
        success: false,
        message: `导入数据失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
  /**
   * 重置所有数据（完全重置）
   * 清除所有用户数据、设置和缓存，恢复到初始状态
   * @returns 重置结果
   */
  async resetAllData(): Promise<{ success: boolean; message: string }> {
    const { withAndroidProviderReset } =
      await import('@/lib/provider/resetBoundary');
    return withAndroidProviderReset(async () => {
      try {
        const desktopRuntime = detectAppRuntime();
        const hasDesktopMcp =
          desktopRuntime.runtime === 'tauri' &&
          desktopRuntime.tauriBundled !== false;
        if (hasDesktopMcp) {
          const { stopDesktopMcpForDataReset } =
            await import('@/lib/mcp/bridge');
          await stopDesktopMcpForDataReset();
        }
        const storage = await getStorage();
        await markExpectedCoreDataMutation('reset-all-data');

        // 清除所有 IndexedDB 数据
        await brewingNotePersistence.clearWithImages();
        await coffeeBeanPersistence.clearWithImages();
        await customEquipmentRepository.clear();
        await customMethodRepository.clear();
        await grinderRepository.clear();
        await appSettingsRepository.clear();
        await legacySettingsRepository.clear();
        if (hasDesktopMcp) {
          const { clearMcpLocalHistory } = await import('@/lib/mcp/storage');
          await clearMcpLocalHistory();
        }

        // 清除 Storage 中的所有应用数据
        for (const key of APP_DATA_KEYS) {
          await callStoreActionInMutation(storage.remove, key);
        }

        // 清除所有自定义方案
        const allKeys = await storage.keys();
        const methodKeys = allKeys.filter((key: string) =>
          key.startsWith('customMethods_')
        );
        for (const key of methodKeys) {
          await callStoreActionInMutation(storage.remove, key);
        }

        // 清除浏览器端数据
        if (isBrowser) {
          // 清除所有自定义预设
          for (const key of CUSTOM_PRESETS_KEYS) {
            localStorage.removeItem(`${CUSTOM_PRESETS_PREFIX}${key}`);
          }

          // 清除所有状态持久化数据（brew-guide: 前缀的键）
          const localStorageKeys = Object.keys(localStorage);
          const stateKeys = localStorageKeys.filter(key =>
            key.startsWith('brew-guide:')
          );
          for (const key of stateKeys) {
            localStorage.removeItem(key);
          }

          // 清除冲煮相关的临时状态
          const brewingStateKeys = ['brewingNoteInProgress'];
          for (const key of brewingStateKeys) {
            localStorage.removeItem(key);
          }

          // 清除 sessionStorage
          try {
            sessionStorage.clear();
          } catch (error) {
            console.warn('清除sessionStorage失败:', error);
          }
        }

        // 重新初始化 Store 状态
        try {
          // 写入默认设置到 IndexedDB 并重新加载
          const { getSettingsStore, defaultSettings } =
            await import('@/lib/stores/settingsStore');
          await appSettingsRepository.save(defaultSettings);
          await callStoreActionInMutation(getSettingsStore().loadSettings);

          // 重置数据 Store
          const { getCoffeeBeanStore } =
            await import('@/lib/stores/coffeeBeanStore');
          getCoffeeBeanStore().setBeans([]);

          const { getBrewingNoteStore } =
            await import('@/lib/stores/brewingNoteStore');
          getBrewingNoteStore().setNotes([]);

          const { getCustomEquipmentStore } =
            await import('@/lib/stores/customEquipmentStore');
          getCustomEquipmentStore().setEquipments([]);

          const { getCustomMethodStore } =
            await import('@/lib/stores/customMethodStore');
          await callStoreActionInMutation(getCustomMethodStore().loadMethods);

          const { getGrinderStore } = await import('@/lib/stores/grinderStore');
          await callStoreActionInMutation(getGrinderStore().setGrinders, []);

          // 重置同步状态
          const { useSyncStatusStore } =
            await import('@/lib/stores/syncStatusStore');
          useSyncStatusStore.getState().reset();
          // 显式重置实时同步状态
          useSyncStatusStore.setState({
            realtimeStatus: 'disconnected',
            realtimeEnabled: false,
            pendingChangesCount: 0,
            isInitialSyncing: false,
          });

          // 断开实时同步连接
          const { getRealtimeSyncService } =
            await import('@/lib/supabase/realtime');
          await getRealtimeSyncService().disconnect();
        } catch (error) {
          console.error('重置 Store 状态失败:', error);
        }

        // 触发数据变更事件，通知应用中的组件重新加载数据
        if (isBrowser) {
          // 触发器具排序更新事件
          try {
            const { equipmentEventBus } =
              await import('@/lib/equipment/equipmentEventBus');
            equipmentEventBus.notify();
          } catch (error) {
            console.error('触发器具排序更新事件失败:', error);
          }

          // 触发自定义器具更新事件
          const equipmentEvent = new CustomEvent('customEquipmentUpdate', {
            detail: { source: 'resetAllData' },
          });
          window.dispatchEvent(equipmentEvent);

          // 触发自定义方案更新事件
          const methodEvent = new CustomEvent('customMethodUpdate', {
            detail: { source: 'resetAllData' },
          });
          window.dispatchEvent(methodEvent);

          // 触发全局缓存重置事件
          const cacheResetEvent = new CustomEvent('globalCacheReset', {
            detail: { source: 'resetAllData' },
          });
          window.dispatchEvent(cacheResetEvent);

          // 触发一个通用的数据更改事件
          const dataChangeEvent = new CustomEvent('storage:changed', {
            detail: { key: 'allData', action: 'reset' },
          });
          window.dispatchEvent(dataChangeEvent);
        }

        return {
          success: true,
          message: '已重置所有数据和设置',
        };
      } catch (_error) {
        console.error('重置数据失败:', _error);
        return {
          success: false,
          message: '重置数据失败',
        };
      }
    });
  },

  /**
   * 检查是否为有效的文本（非占位符）
   * @param text 要检查的文本
   * @returns 是否为有效文本
   */
  isValidText(text: string | undefined | null): boolean {
    if (!text || typeof text !== 'string') return false;

    const trimmed = text.trim();
    if (trimmed === '') return false;

    // 占位符文本列表
    const placeholders = [
      '产地',
      'origin',
      'Origin',
      '处理法',
      'process',
      'Process',
      '水洗',
      '日晒',
      '蜜处理',
      '品种',
      'variety',
      'Variety',
      '烘焙度',
      'roast',
      'Roast',
    ];

    return !placeholders.includes(trimmed);
  },

  /**
   * 检查咖啡豆是否有有效的旧格式字段
   * @param bean 咖啡豆对象
   * @returns 是否有有效的旧格式字段
   */
  hasLegacyBeanFields(bean: LegacyCoffeeBeanRecord): boolean {
    return (
      this.isValidText(bean.origin as string) ||
      this.isValidText(bean.process as string) ||
      this.isValidText(bean.variety as string)
    );
  },

  /**
   * 检测是否存在旧格式的咖啡豆数据
   * @returns 检测结果，包含是否存在旧格式数据和数量
   */
  async detectLegacyBeanData(): Promise<{
    hasLegacyData: boolean;
    legacyCount: number;
    totalCount: number;
  }> {
    try {
      const beans =
        (await coffeeBeanRepository.list()) as LegacyCoffeeBeanRecord[];

      let legacyCount = 0;

      // 检查每个咖啡豆是否使用旧格式
      beans.forEach(bean => {
        // 检查是否存在有效的旧格式字段（排除占位符）
        const hasLegacyBeanFields = this.hasLegacyBeanFields(bean);

        if (hasLegacyBeanFields) {
          legacyCount++;
        }
      });

      return {
        hasLegacyData: legacyCount > 0,
        legacyCount,
        totalCount: beans.length,
      };
    } catch (error) {
      console.error('检测旧格式数据失败:', error);
      return { hasLegacyData: false, legacyCount: 0, totalCount: 0 };
    }
  },

  /**
   * 修复咖啡豆数据问题
   * 处理可能存在问题的咖啡豆数据，确保blendComponents字段正确，删除废弃的type字段
   * @returns 修复结果，包含修复数量
   */
  async fixBlendBeansData(): Promise<{ success: boolean; fixedCount: number }> {
    return withDataMutation(async () => {
      try {
        const beans =
          (await coffeeBeanRepository.list()) as LegacyCoffeeBeanRecord[];
        if (beans.length === 0) {
          return { success: true, fixedCount: 0 };
        }

        let fixedCount = 0;

        // 处理每个咖啡豆
        const fixedBeans = beans.map(bean => {
          // 删除已废弃的type字段
          if ('type' in bean) {
            delete bean.type;
            fixedCount++;
          }

          // 确保所有咖啡豆都有blendComponents字段
          if (
            !bean.blendComponents ||
            !Array.isArray(bean.blendComponents) ||
            bean.blendComponents.length === 0
          ) {
            bean.blendComponents = [
              {
                origin: bean.origin || '',
                process: bean.process || '',
                variety: bean.variety || '',
              },
            ];
            fixedCount++;
          }

          // 确保所有拼配成分都有正确的属性
          if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
            bean.blendComponents = bean.blendComponents.map(
              (comp: BlendComponent) => {
                // 只修复无效的百分比值，而不是强制设置所有未定义的百分比
                if (comp.percentage !== undefined) {
                  // 仅当百分比是无效值时修复
                  if (
                    typeof comp.percentage === 'number' &&
                    (comp.percentage < 1 || comp.percentage > 100)
                  ) {
                    // 如果百分比值无效，将其约束在1-100范围内
                    comp.percentage = Math.min(
                      Math.max(1, comp.percentage),
                      100
                    );
                    fixedCount++;
                  } else if (typeof comp.percentage !== 'number') {
                    // 如果不是数字类型，尝试转换为数字
                    try {
                      const numValue = Number(comp.percentage);
                      if (!isNaN(numValue)) {
                        comp.percentage = Math.min(Math.max(1, numValue), 100);
                      } else {
                        // 如果无法转换为有效数字，移除百分比属性
                        delete comp.percentage;
                      }
                      fixedCount++;
                    } catch {
                      // 转换失败，移除百分比属性
                      delete comp.percentage;
                      fixedCount++;
                    }
                  }
                }
                // 如果百分比为undefined，保持原样，不进行修复
                return comp;
              }
            );
          }

          return bean;
        });

        // 如果有修复，更新存储
        if (fixedCount > 0) {
          await coffeeBeanRepository.upsertMany(fixedBeans);
        }

        return { success: true, fixedCount };
      } catch (error) {
        console.error('修复拼配豆数据失败:', error);
        return { success: false, fixedCount: 0 };
      }
    });
  },

  /**
   * 清理冲煮笔记中的冗余咖啡豆数据
   * 移除每个笔记中的完整coffeeBean对象，只保留必要的beanId和coffeeBeanInfo
   * @param notes 冲煮笔记数组
   * @returns 清理后的冲煮笔记数组
   */
  cleanBrewingNotesForExport(notes: _BrewingNote[]): _BrewingNote[] {
    return notes.map(note => {
      // 创建笔记的浅拷贝
      const cleanedNote = { ...note };

      // 删除coffeeBean字段，它包含完整的咖啡豆对象
      if ('coffeeBean' in cleanedNote) {
        delete cleanedNote.coffeeBean;
      }

      return cleanedNote;
    });
  },
};
