import {
  Method as _Method,
  CustomEquipment,
  BrewingNote as _BrewingNote,
} from '@/lib/core/config';
import { CoffeeBean as _CoffeeBean, BlendComponent } from '@/types/app';
import { APP_VERSION } from '@/lib/core/config';
import { SettingsOptions as _SettingsOptions } from '@/components/settings/Settings';
import { LayoutSettings as _LayoutSettings } from '@/components/brewing/Timer/Settings';
import RoasterLogoManager from '@/lib/managers/RoasterLogoManager';
import { db } from '@/lib/core/db';

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

// 使用从 config.ts 导入的 BrewingNote 类型

/**
 * 应用数据键名列表
 */
export const APP_DATA_KEYS = [
  'customMethods', // 自定义冲煮方案
  'brewingNotes', // 冲煮记录
  'brewGuideSettings', // 应用设置
  'brewingNotesVersion', // 数据版本
  'coffeeBeans', // 咖啡豆数据
  'customEquipments', // 自定义器具
  'equipmentOrder', // 器具排序信息
  'onboardingCompleted', // 引导完成标记
  'customFlavorDimensions', // 自定义风味维度
  'flavorDimensionHistoricalLabels', // 风味维度历史标签
  'backupReminderSettings', // 备份提醒设置
  'yearlyReports', // 年度报告
  'yearlyReviewReminderSettings', // 年度回顾提醒设置
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
  'processes', // 处理法
  'varieties', // 品种
];

/**
 * 需要同步到IndexedDB的数据键
 */
const INDEXED_DB_SYNC_KEYS = [
  'customEquipments',
  'coffeeBeans',
  'brewingNotes',
] as const;

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
  async exportAllData(): Promise<string> {
    try {
      const now = new Date();
      const exportData: ExportData = {
        exportDate: this.formatDateWithTimezone(now),
        appVersion: APP_VERSION,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        data: {},
      };

      // 获取数据
      const storage = await getStorage();
      for (const key of APP_DATA_KEYS) {
        const value = await storage.get(key);
        if (value) {
          try {
            // 尝试解析JSON
            let parsedValue = JSON.parse(value);

            // 如果是 brewGuideSettings，检查是否被 Zustand persist 包装
            if (key === 'brewGuideSettings' && parsedValue?.state?.settings) {
              // 解包 Zustand persist 的数据结构
              parsedValue = parsedValue.state.settings;
            }

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
        const methodsFromDB = await db.customMethods.toArray();
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
                console.error(`解析自定义方案数据失败: ${key}`);
              }
            }
          }
        }
      } catch (error) {
        console.error('导出自定义方案失败:', error);
      }

      // 导出自定义预设数据
      try {
        if (isBrowser) {
          // 初始化自定义预设存储结构
          exportData.data.customPresets = {};

          // 处理每个自定义预设类型
          for (const key of CUSTOM_PRESETS_KEYS) {
            const storageKey = `${CUSTOM_PRESETS_PREFIX}${key}`;
            const presetJson = localStorage.getItem(storageKey);

            if (presetJson) {
              try {
                const presets = JSON.parse(presetJson);
                // 将当前类型的所有自定义预设添加到导出数据中
                (exportData.data.customPresets as Record<string, unknown>)[
                  key
                ] = presets;
              } catch {
                // 如果JSON解析失败，跳过
                console.error(`解析自定义预设数据失败: ${key}`);
              }
            }
          }
        }
      } catch (error) {
        console.error('导出自定义预设失败:', error);
        // 错误处理：即使自定义预设导出失败，也继续导出其他数据
      }

      // 导出烘焙商图标
      try {
        const roasterLogos = await RoasterLogoManager.getAllLogos();
        if (roasterLogos.length > 0) {
          exportData.data['roaster-logos'] = roasterLogos;
        }
      } catch (error) {
        console.error('导出烘焙商图标失败:', error);
      }

      return JSON.stringify(exportData, null, 2);
    } catch {
      throw new Error('导出数据失败');
    }
  },

  /**
   * 导入数据
   * @param jsonString 包含数据的JSON字符串
   * @returns 导入结果
   */
  async importAllData(
    jsonString: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const importData = JSON.parse(jsonString) as ImportData;

      // 验证数据格式
      if (!importData.data) {
        return {
          success: false,
          message: '导入的数据格式不正确，缺少 data 字段',
        };
      }

      // 导入数据
      const storage = await getStorage();

      // 辅助函数：同步数据到IndexedDB
      const syncToIndexedDB = async (key: string, data: unknown[]) => {
        switch (key) {
          case 'customEquipments':
            await db.customEquipments.clear();
            await db.customEquipments.bulkPut(data as CustomEquipment[]);
            break;
          case 'coffeeBeans':
            await db.coffeeBeans.clear();
            await db.coffeeBeans.bulkPut(data as _CoffeeBean[]);
            break;
          case 'brewingNotes':
            await db.brewingNotes.clear();
            await db.brewingNotes.bulkPut(data as _BrewingNote[]);
            break;
        }
      };

      for (const key of APP_DATA_KEYS) {
        if (importData.data[key] !== undefined) {
          let valueToSave = importData.data[key];

          // 如果是 brewGuideSettings，检查是否被 Zustand persist 包装
          // 如果导入的数据是 Zustand 格式（包含 state.settings），则解包
          if (key === 'brewGuideSettings' && typeof valueToSave === 'object') {
            if ((valueToSave as any)?.state?.settings) {
              valueToSave = (valueToSave as any).state.settings;
            }
          }

          // 保存到Storage
          const value =
            typeof valueToSave === 'object'
              ? JSON.stringify(valueToSave)
              : String(valueToSave);
          await storage.set(key, value);

          // 同步到IndexedDB（如果需要）
          if (
            INDEXED_DB_SYNC_KEYS.includes(
              key as (typeof INDEXED_DB_SYNC_KEYS)[number]
            ) &&
            typeof importData.data[key] === 'object'
          ) {
            const rawData = importData.data[key] as unknown[];
            if (Array.isArray(rawData)) {
              await syncToIndexedDB(key, rawData);
            }
          }
        }
      }

      // 导入自定义方案数据
      if (
        importData.data.customMethodsByEquipment &&
        typeof importData.data.customMethodsByEquipment === 'object'
      ) {
        // 清除现有方案数据
        await db.customMethods.clear();

        // 遍历所有器具的方案
        const customMethodsByEquipment = importData.data
          .customMethodsByEquipment as Record<string, unknown>;

        for (const equipmentId of Object.keys(customMethodsByEquipment)) {
          const methods = customMethodsByEquipment[equipmentId];
          if (Array.isArray(methods)) {
            // 保存该器具的所有方案
            const storageKey = `customMethods_${equipmentId}`;
            await storage.set(storageKey, JSON.stringify(methods));

            // 同时更新IndexedDB
            await db.customMethods.put({
              equipmentId,
              methods,
            });
          }
        }
      }

      // 导入自定义预设数据
      if (
        isBrowser &&
        importData.data.customPresets &&
        typeof importData.data.customPresets === 'object'
      ) {
        // 遍历所有自定义预设类型
        const customPresets = importData.data.customPresets as Record<
          string,
          unknown
        >;
        for (const presetType of Object.keys(customPresets)) {
          if (CUSTOM_PRESETS_KEYS.includes(presetType)) {
            const presets = customPresets[presetType];
            if (Array.isArray(presets)) {
              // 保存该类型的所有自定义预设
              const storageKey = `${CUSTOM_PRESETS_PREFIX}${presetType}`;
              localStorage.setItem(storageKey, JSON.stringify(presets));
            }
          }
        }
      }

      // 导入烘焙商图标
      if (
        importData.data['roaster-logos'] &&
        Array.isArray(importData.data['roaster-logos'])
      ) {
        await RoasterLogoManager.importLogos(
          JSON.stringify(importData.data['roaster-logos'])
        );
      }

      // 清理缓存，确保导入的数据能立即生效
      try {
        const { CoffeeBeanManager } = await import(
          '@/lib/managers/coffeeBeanManager'
        );
        CoffeeBeanManager.clearCache();
      } catch (error) {
        console.error('清理咖啡豆管理器缓存失败:', error);
      }

      // 触发器具排序更新事件
      if (importData.data.equipmentOrder) {
        try {
          const { equipmentEventBus } = await import(
            '@/lib/equipment/equipmentEventBus'
          );
          equipmentEventBus.notify();
        } catch (error) {
          console.error('触发器具排序更新事件失败:', error);
        }
      }

      // 触发数据变更事件，通知应用中的组件重新加载数据
      if (isBrowser) {
        const eventDetail = { source: 'importAllData' };
        const events = [
          'coffeeBeansUpdated', // 确保个人榜单能及时刷新
          'customEquipmentUpdate', // 自定义器具更新
          'customMethodUpdate', // 自定义方案更新
        ];

        // 批量触发事件
        events.forEach(eventName => {
          window.dispatchEvent(
            new CustomEvent(eventName, { detail: eventDetail })
          );
        });

        // 触发通用数据更改事件
        window.dispatchEvent(
          new CustomEvent('storage:changed', {
            detail: { key: 'allData', action: 'import' },
          })
        );
      }

      const displayDate = importData.exportDate
        ? new Date(importData.exportDate).toLocaleString(undefined, {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            timeZoneName: 'short',
          })
        : '未知';

      const timeZoneInfo = importData.timeZone
        ? ` (时区: ${importData.timeZone})`
        : '';

      return {
        success: true,
        message: `数据导入成功，导出日期: ${displayDate}${timeZoneInfo}`,
      };
    } catch (_error) {
      return {
        success: false,
        message: `导入数据失败: ${(_error as Error).message}`,
      };
    }
  },

  /**
   * 重置数据
   * @param completeReset 是否完全重置（包括所有设置和缓存）
   * @returns 重置结果
   */
  async resetAllData(
    completeReset = false
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 清除列表中的数据
      const storage = await getStorage();

      // 清理Storage和IndexedDB数据
      const indexedDBCleanupMap = {
        brewingNotes: () => db.brewingNotes.clear(),
        coffeeBeans: () => db.coffeeBeans.clear(),
        customEquipments: () => db.customEquipments.clear(),
      } as const;

      for (const key of APP_DATA_KEYS) {
        await storage.remove(key);

        // 清理对应的IndexedDB表
        if (key in indexedDBCleanupMap) {
          await indexedDBCleanupMap[key as keyof typeof indexedDBCleanupMap]();
        }
      }

      // 如果是完全重置，还需要清除其他数据
      if (completeReset) {
        // 获取所有存储键
        const allKeys = await storage.keys();

        // 清除所有自定义方案
        const methodKeys = allKeys.filter((key: string) =>
          key.startsWith('customMethods_')
        );
        for (const key of methodKeys) {
          await storage.remove(key);
        }

        // 同时清除IndexedDB数据
        await db.customEquipments.clear();
        await db.customMethods.clear();
        await db.settings.clear(); // 清除设置表，包括迁移标记

        // 清除所有自定义预设
        if (isBrowser) {
          for (const key of CUSTOM_PRESETS_KEYS) {
            localStorage.removeItem(`${CUSTOM_PRESETS_PREFIX}${key}`);
          }

          // 清除烘焙商图标
          localStorage.removeItem('roaster-logos');

          // 清除所有状态持久化数据（brew-guide: 前缀的键）
          const localStorageKeys = Object.keys(localStorage);
          const stateKeys = localStorageKeys.filter(key =>
            key.startsWith('brew-guide:')
          );
          for (const key of stateKeys) {
            localStorage.removeItem(key);
          }

          // 清除冲煮相关的临时状态
          const brewingStateKeys = [
            'brewingNoteInProgress',
            'dataMigrationSkippedThisSession',
          ];
          for (const key of brewingStateKeys) {
            localStorage.removeItem(key);
          }

          // 清除sessionStorage中的临时数据
          try {
            sessionStorage.clear();
          } catch (error) {
            console.warn('清除sessionStorage失败:', error);
          }
        }
      }

      // 触发数据变更事件，通知应用中的组件重新加载数据
      if (isBrowser) {
        // 触发器具排序更新事件
        try {
          const { equipmentEventBus } = await import(
            '@/lib/equipment/equipmentEventBus'
          );
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
        message: completeReset ? '已完全重置数据和设置' : '已重置主要数据',
      };
    } catch (_error) {
      console.error('重置数据失败:', _error);
      return {
        success: false,
        message: '重置数据失败',
      };
    }
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
  hasValidLegacyFields(bean: Record<string, unknown>): boolean {
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
      // 获取所有咖啡豆数据
      const storage = await getStorage();
      const beansStr = await storage.get('coffeeBeans');
      if (!beansStr) {
        return { hasLegacyData: false, legacyCount: 0, totalCount: 0 };
      }

      // 解析咖啡豆数据
      const beans = JSON.parse(beansStr);
      if (!Array.isArray(beans)) {
        return { hasLegacyData: false, legacyCount: 0, totalCount: 0 };
      }

      let legacyCount = 0;

      // 检查每个咖啡豆是否使用旧格式
      beans.forEach(bean => {
        // 检查是否存在有效的旧格式字段（排除占位符）
        const hasValidLegacyFields = this.hasValidLegacyFields(bean);

        if (hasValidLegacyFields) {
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
   * 迁移旧格式咖啡豆数据到新格式
   * @returns 迁移结果，包含迁移数量
   */
  async migrateLegacyBeanData(): Promise<{
    success: boolean;
    migratedCount: number;
    message: string;
  }> {
    try {
      // 获取所有咖啡豆数据
      const storage = await getStorage();
      const beansStr = await storage.get('coffeeBeans');
      if (!beansStr) {
        return {
          success: true,
          migratedCount: 0,
          message: '没有找到咖啡豆数据',
        };
      }

      // 解析咖啡豆数据
      const beans = JSON.parse(beansStr);
      if (!Array.isArray(beans)) {
        return {
          success: false,
          migratedCount: 0,
          message: '咖啡豆数据格式错误',
        };
      }

      let migratedCount = 0;

      // 处理每个咖啡豆
      const migratedBeans = beans.map(bean => {
        // 检查是否需要迁移（存在有效的旧格式字段）
        const hasValidLegacyFields = this.hasValidLegacyFields(bean);

        if (hasValidLegacyFields) {
          // 如果没有blendComponents，创建新的
          if (
            !bean.blendComponents ||
            !Array.isArray(bean.blendComponents) ||
            bean.blendComponents.length === 0
          ) {
            bean.blendComponents = [
              {
                origin: this.isValidText(bean.origin) ? bean.origin : '',
                process: this.isValidText(bean.process) ? bean.process : '',
                variety: this.isValidText(bean.variety) ? bean.variety : '',
              },
            ];
          }
          // 如果已经有blendComponents，但旧字段的信息更完整，则更新blendComponents
          else {
            // 检查第一个组件是否需要更新
            const firstComponent = bean.blendComponents[0];
            if (
              !this.isValidText(firstComponent.origin) &&
              this.isValidText(bean.origin)
            ) {
              firstComponent.origin = bean.origin;
            }
            if (
              !this.isValidText(firstComponent.process) &&
              this.isValidText(bean.process)
            ) {
              firstComponent.process = bean.process;
            }
            if (
              !this.isValidText(firstComponent.variety) &&
              this.isValidText(bean.variety)
            ) {
              firstComponent.variety = bean.variety;
            }
          }

          migratedCount++;
        }

        // 总是删除旧的字段（无论是否有效），避免数据重复
        delete bean.origin;
        delete bean.process;
        delete bean.variety;

        return bean;
      });

      // 如果有迁移，更新存储
      if (migratedCount > 0) {
        await storage.set('coffeeBeans', JSON.stringify(migratedBeans));

        // 同时更新IndexedDB
        try {
          await db.coffeeBeans.clear();
          await db.coffeeBeans.bulkPut(migratedBeans);
        } catch (dbError) {
          console.error('更新IndexedDB失败:', dbError);
        }
      }

      return {
        success: true,
        migratedCount,
        message:
          migratedCount > 0
            ? `成功迁移了${migratedCount}个咖啡豆的数据格式`
            : '没有需要迁移的数据',
      };
    } catch (error) {
      console.error('迁移数据失败:', error);
      return {
        success: false,
        migratedCount: 0,
        message: `迁移失败: ${(error as Error).message}`,
      };
    }
  },

  /**
   * 修复咖啡豆数据问题
   * 处理可能存在问题的咖啡豆数据，确保blendComponents字段正确，删除废弃的type字段
   * @returns 修复结果，包含修复数量
   */
  async fixBlendBeansData(): Promise<{ success: boolean; fixedCount: number }> {
    try {
      // 获取所有咖啡豆数据
      const storage = await getStorage();
      const beansStr = await storage.get('coffeeBeans');
      if (!beansStr) {
        return { success: true, fixedCount: 0 };
      }

      // 解析咖啡豆数据
      const beans = JSON.parse(beansStr);
      if (!Array.isArray(beans)) {
        return { success: false, fixedCount: 0 };
      }

      let fixedCount = 0;

      // 处理每个咖啡豆
      const fixedBeans = beans.map(bean => {
        // 删除已废弃的type字段
        if ('type' in bean) {
          delete (bean as Record<string, unknown>).type;
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
                  comp.percentage = Math.min(Math.max(1, comp.percentage), 100);
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
        await storage.set('coffeeBeans', JSON.stringify(fixedBeans));
      }

      return { success: true, fixedCount };
    } catch (error) {
      console.error('修复拼配豆数据失败:', error);
      return { success: false, fixedCount: 0 };
    }
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
