import Dexie from 'dexie';
import { BrewingNote, Method, CustomEquipment } from './config';
import { CoffeeBean } from '@/types/app';

/**
 * 研磨度历史记录
 */
export interface GrindSizeHistory {
  grindSize: string;
  timestamp: number;
  equipment?: string; // 器具名称
  method?: string; // 冲煮方案名称
  coffeeBean?: string; // 咖啡豆名称
}

/**
 * 磨豆机类型定义
 */
export interface Grinder {
  id: string;
  name: string;
  currentGrindSize?: string;
  /** 研磨度历史记录（最多保留最近10条） */
  grindSizeHistory?: GrindSizeHistory[];
}

/**
 * 年度报告类型定义
 */
export interface YearlyReport {
  id: string;
  year: number;
  username: string;
  content: string;
  createdAt: number;
}

/**
 * 风味评分维度类型定义
 */
export interface FlavorDimension {
  id: string;
  label: string;
  order: number;
  isDefault: boolean;
}

/**
 * 默认风味评分维度
 */
export const DEFAULT_FLAVOR_DIMENSIONS: FlavorDimension[] = [
  { id: 'acidity', label: '酸度', order: 0, isDefault: true },
  { id: 'sweetness', label: '甜度', order: 1, isDefault: true },
  { id: 'bitterness', label: '苦度', order: 2, isDefault: true },
  { id: 'body', label: '口感', order: 3, isDefault: true },
];

/**
 * 烘焙商赏味期设置
 */
export interface RoasterFlavorPeriod {
  light: { startDay: number; endDay: number };
  medium: { startDay: number; endDay: number };
  dark: { startDay: number; endDay: number };
}

/**
 * 烘焙商配置类型定义
 */
export interface RoasterConfig {
  roasterName: string;
  logoData?: string;
  flavorPeriod?: RoasterFlavorPeriod;
  updatedAt: number;
}

/**
 * 应用设置类型定义
 * 统一管理所有用户设置，存储在 IndexedDB 中
 */
export interface AppSettings {
  // 通用设置
  notificationSound: boolean;
  hapticFeedback: boolean;
  textZoomLevel: number;
  showFlowRate: boolean;
  username: string;

  // 布局设置
  layoutSettings?: {
    stageInfoReversed?: boolean;
    progressBarHeight?: number;
    controlsReversed?: boolean;
    alwaysShowTimerInfo?: boolean;
    dataFontSize?: '2xl' | '3xl' | '4xl';
    stepDisplayMode?: 'independent' | 'cumulative' | 'time'; // 步骤时间显示模式
  };

  // 雷达图设置
  radarChartScale?: number; // 雷达图缩放比例 (0.5 - 1.1)
  radarChartShape?: 'polygon' | 'circle'; // 雷达图形状
  radarChartAlign?: 'left' | 'center'; // 雷达图对齐方式

  // 咖啡豆显示设置
  decrementPresets: number[];
  enableAllDecrementOption: boolean;
  enableCustomDecrementInput: boolean;
  greenBeanRoastPresets: number[];
  enableAllGreenBeanRoastOption: boolean;
  enableCustomGreenBeanRoastInput: boolean;
  simplifiedViewLabels: boolean;
  dateDisplayMode: 'date' | 'flavorPeriod' | 'agingDays';
  showFlavorInfo: boolean;
  showBeanNotes: boolean;
  limitNotesLines: boolean;
  notesMaxLines: number;
  showPrice: boolean;
  showTotalPrice: boolean;
  showStatusDots: boolean;
  showBeanSummary: boolean;
  showEstimatedCups: boolean;

  // 安全区域设置
  safeAreaMargins?: {
    top: number;
    bottom: number;
  };

  // 导航栏设置
  navigationSettings?: {
    visibleTabs: {
      brewing: boolean;
      coffeeBean: boolean;
      notes: boolean;
    };
    coffeeBeanViews: Record<string, boolean>;
    pinnedViews: string[];
  };

  // 赏味期设置
  customFlavorPeriod?: {
    light: { startDay: number; endDay: number };
    medium: { startDay: number; endDay: number };
    dark: { startDay: number; endDay: number };
  };

  // 备份提醒设置
  backupReminder?: {
    enabled: boolean;
    interval: string;
    lastBackupDate: string;
    nextBackupDate: string;
  };

  // S3同步设置
  s3Sync?: {
    enabled: boolean;
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucketName: string;
    prefix: string;
    endpoint?: string;
    syncMode: 'manual';
    lastConnectionSuccess?: boolean;
    enablePullToSync?: boolean;
  };

  // WebDAV同步设置
  webdavSync?: {
    enabled: boolean;
    url: string;
    username: string;
    password: string;
    remotePath: string;
    syncMode: 'manual';
    lastConnectionSuccess?: boolean;
    enablePullToSync?: boolean;
    useProxy?: boolean;
  };

  // Supabase同步设置
  supabaseSync?: {
    enabled: boolean;
    url: string;
    anonKey: string;
    lastConnectionSuccess?: boolean;
    lastSyncTime?: number;
  };

  // 当前激活的云同步类型
  activeSyncType?: 'none' | 's3' | 'webdav' | 'supabase';

  // 随机咖啡豆设置
  randomCoffeeBeans?: {
    enableLongPressRandomType: boolean;
    defaultRandomType: 'espresso' | 'filter';
    flavorPeriodRanges: {
      aging: boolean;
      optimal: boolean;
      decline: boolean;
      frozen: boolean;
      inTransit: boolean;
      unknown: boolean;
    };
  };

  // 搜索排序设置
  searchSort?: {
    enabled: boolean;
    time: boolean;
    rating: boolean;
    extractionTime: boolean;
  };

  // 打印设置
  enableBeanPrint?: boolean;
  showBeanRating?: boolean;

  // 隐藏的通用方案设置
  hiddenCommonMethods?: Record<string, string[]>;

  // 隐藏的器具设置
  hiddenEquipments?: string[];

  // 磨豆机默认同步设置
  grinderDefaultSync?: {
    navigationBar: boolean;
    methodForm: boolean;
    manualNote: boolean;
    noteEdit: boolean;
  };

  // 磨豆机刻度显示设置
  showGrinderScale?: boolean;

  // 笔记设置
  defaultExpandChangeLog: boolean;
  showFlavorRatingInForm: boolean;
  showOverallRatingInForm: boolean;
  flavorRatingFollowOverall: boolean;
  flavorRatingHalfStep: boolean;
  overallRatingUseSlider: boolean;
  showRatingDimensionsEntry: boolean;
  showUnitPriceInNote: boolean;
  showCapacityAdjustmentRecords: boolean;

  // 生豆库设置
  enableGreenBeanInventory?: boolean;
  enableConvertToGreen?: boolean;

  // 识图设置
  autoFillRecognitionImage?: boolean;
  showEstateField?: boolean;
  immersiveAdd?: boolean;

  // 每日提醒设置
  dailyReminder: boolean;
  dailyReminderTime: string;

  // 隐藏二维码选项
  hideGroupQRCode?: boolean;
  hideAppreciationQRCode?: boolean;

  // 菜单栏图标设置（桌面端）
  showMenuBarIcon?: boolean;

  // 自定义风味维度
  flavorDimensions?: FlavorDimension[];
  flavorDimensionHistoricalLabels?: Record<string, string>;

  // 烘焙商配置
  roasterConfigs?: RoasterConfig[];

  // 器具排序
  equipmentOrder?: string[];

  // 方案参数覆盖（用户临时修改的参数，可还原）
  // key 格式: `${equipmentId}:${methodId}`
  methodParamOverrides?: Record<
    string,
    {
      coffee?: string;
      water?: string;
      ratio?: string;
      grindSize?: string;
      temp?: string;
      extractionTime?: number; // 意式萃取时长（秒）
      modifiedAt: number;
    }
  >;

  // 冲煮设置
  showCoffeeBeanSelectionStep?: boolean; // 是否显示咖啡豆选择步骤，默认 true

  // 烘焙商字段设置
  roasterFieldEnabled?: boolean; // 是否启用独立烘焙商字段，默认 false
  roasterSeparator?: ' ' | '/'; // 烘焙商分隔符，默认空格
  roasterMigrationCompleted?: boolean; // @deprecated 已废弃，按需迁移策略不再使用此标记

  // 提示显示状态
  emptyBeanTipShown?: boolean; // 用完咖啡豆提示是否已显示

  // 注意: grinders 字段已迁移到独立的 grinders 表
  // 此字段仅用于兼容旧数据导入，运行时不使用
  grinders?: Grinder[];
}

/**
 * SettingsOptions 类型别名
 * 为保持向后兼容，提供 AppSettings 的别名
 * 新代码应使用 AppSettings
 */
export type SettingsOptions = AppSettings;

/**
 * 应用数据库类 - 使用Dexie.js包装IndexedDB
 *
 * 版本历史：
 * - v1: 基础结构 (brewingNotes, settings)
 * - v2: 添加 coffeeBeans 表
 * - v3: 添加 customEquipments, customMethods 表
 * - v4: 重构 - 添加 grinders, yearlyReports, appSettings 表，统一数据管理
 */
export class BrewGuideDB extends Dexie {
  // 核心数据表
  brewingNotes!: Dexie.Table<BrewingNote, string>;
  coffeeBeans!: Dexie.Table<CoffeeBean, string>;

  // 器具与方案表
  customEquipments!: Dexie.Table<CustomEquipment, string>;
  customMethods!: Dexie.Table<
    { equipmentId: string; methods: Method[] },
    string
  >;

  // 磨豆机表
  grinders!: Dexie.Table<Grinder, string>;

  // 年度报告表
  yearlyReports!: Dexie.Table<YearlyReport, string>;

  // 应用设置表
  appSettings!: Dexie.Table<{ id: string; data: AppSettings }, string>;

  // 旧版设置表（兼容性保留）
  settings!: Dexie.Table<{ key: string; value: string }, string>;

  // 实时同步离线队列表
  pendingOperations!: Dexie.Table<
    {
      id: string;
      table: string;
      type: 'upsert' | 'delete';
      recordId: string;
      data?: unknown;
      timestamp: number;
      retryCount: number;
    },
    string
  >;

  constructor() {
    super('BrewGuideDB');

    // 版本1：基础结构
    this.version(1).stores({
      brewingNotes: 'id, timestamp, equipment, method',
      settings: 'key',
    });

    // 版本2：添加coffeeBeans表
    this.version(2).stores({
      brewingNotes: 'id, timestamp, equipment, method',
      coffeeBeans: 'id, timestamp, name, type',
      settings: 'key',
    });

    // 版本3：添加自定义器具和方案表
    this.version(3).stores({
      brewingNotes: 'id, timestamp, equipment, method',
      coffeeBeans: 'id, timestamp, name, type',
      settings: 'key',
      customEquipments: 'id, name',
      customMethods: 'equipmentId',
    });

    // 版本4：添加新表，统一数据管理
    this.version(4)
      .stores({
        brewingNotes: 'id, timestamp, equipment, method',
        coffeeBeans: 'id, timestamp, name, type',
        settings: 'key',
        customEquipments: 'id, name',
        customMethods: 'equipmentId',
        grinders: 'id, name',
        yearlyReports: 'id, year, createdAt',
        appSettings: 'id',
      })
      .upgrade(async () => {
        console.log('开始数据库 v4 升级迁移...');
        // 迁移将在数据库打开后通过 dbUtils.migrateToV4 完成
      });

    // 版本5：添加实时同步离线队列表
    this.version(5).stores({
      brewingNotes: 'id, timestamp, equipment, method',
      coffeeBeans: 'id, timestamp, name, type',
      settings: 'key',
      customEquipments: 'id, name',
      customMethods: 'equipmentId',
      grinders: 'id, name',
      yearlyReports: 'id, year, createdAt',
      appSettings: 'id',
      pendingOperations: 'id, table, recordId, timestamp',
    });
  }
}

// 创建并导出数据库单例
export const db = new BrewGuideDB();

/**
 * 数据库相关工具方法
 */
export const dbUtils = {
  /**
   * 初始化数据库并准备使用
   */
  async initialize(): Promise<void> {
    try {
      await db.open();
      console.warn('数据库初始化成功');

      // v4 迁移：从 localStorage 迁移数据到新表
      await this.migrateToV4();

      // 验证迁移状态与数据一致性
      const migrated = await db.settings.get('migrated');
      if (migrated && migrated.value === 'true') {
        const beansCount = await db.coffeeBeans.count();
        const notesCount = await db.brewingNotes.count();

        const hasLocalBeans = localStorage.getItem('coffeeBeans') !== null;
        const hasLocalNotes = localStorage.getItem('brewingNotes') !== null;

        if (
          (beansCount === 0 && hasLocalBeans) ||
          (notesCount === 0 && hasLocalNotes)
        ) {
          console.warn(
            '检测到数据不一致：IndexedDB为空但localStorage有数据，将重置迁移状态'
          );
          await db.settings.delete('migrated');
        }
      }

      setTimeout(() => this.logStorageInfo(), 1000);
    } catch (error) {
      console.error('数据库初始化失败:', error);
      throw error;
    }
  },

  /**
   * v4 迁移：从 localStorage 迁移数据到新的 IndexedDB 表
   */
  async migrateToV4(): Promise<void> {
    try {
      // 检查是否已完成 v4 迁移
      const v4Migrated = await db.settings.get('v4_migrated');
      if (v4Migrated && v4Migrated.value === 'true') {
        // 即使已标记迁移完成，也要检查补充迁移（修复数据丢失问题）
        await this.migrateAppSettings();
        return;
      }

      console.warn('开始 v4 数据迁移...');

      // 1. 迁移磨豆机数据
      await this.migrateGrinders();

      // 2. 迁移年度报告数据
      await this.migrateYearlyReports();

      // 3. 迁移应用设置
      await this.migrateAppSettings();

      // 标记 v4 迁移完成
      await db.settings.put({ key: 'v4_migrated', value: 'true' });
      console.log('v4 数据迁移完成');
    } catch (error) {
      console.error('v4 数据迁移失败:', error);
    }
  },

  /**
   * 迁移磨豆机数据
   */
  async migrateGrinders(): Promise<void> {
    try {
      if (typeof localStorage === 'undefined') return;

      // 检查是否已有数据
      const existingCount = await db.grinders.count();
      if (existingCount > 0) {
        console.log('磨豆机数据已存在，跳过迁移');
        return;
      }

      const settingsStr = localStorage.getItem('brewGuideSettings');
      if (!settingsStr) return;

      let settings = JSON.parse(settingsStr);

      // 处理 Zustand persist 格式
      if (settings?.state?.settings) {
        settings = settings.state.settings;
      }

      if (settings.grinders && Array.isArray(settings.grinders)) {
        await db.grinders.bulkPut(settings.grinders);
        console.log(`已迁移 ${settings.grinders.length} 个磨豆机到 IndexedDB`);
      }
    } catch (error) {
      console.error('迁移磨豆机数据失败:', error);
    }
  },

  /**
   * 迁移年度报告数据
   */
  async migrateYearlyReports(): Promise<void> {
    try {
      if (typeof localStorage === 'undefined') return;

      // 检查是否已有数据
      const existingCount = await db.yearlyReports.count();
      if (existingCount > 0) {
        console.log('年度报告数据已存在，跳过迁移');
        return;
      }

      const reportsStr = localStorage.getItem('yearlyReports');
      if (!reportsStr) return;

      const reports = JSON.parse(reportsStr) as YearlyReport[];
      if (reports && reports.length > 0) {
        await db.yearlyReports.bulkPut(reports);
        console.log(`已迁移 ${reports.length} 份年度报告到 IndexedDB`);
      }
    } catch (error) {
      console.error('迁移年度报告数据失败:', error);
    }
  },

  /**
   * 迁移应用设置
   */
  async migrateAppSettings(): Promise<void> {
    try {
      if (typeof localStorage === 'undefined') return;

      // 检查是否已有数据
      const existing = await db.appSettings.get('main');

      // 即使已有设置，也要检查是否需要补充迁移遗漏的数据
      if (existing) {
        let needsUpdate = false;

        // 补充迁移 roaster-logos
        const roasterLogosStr = localStorage.getItem('roaster-logos');
        if (
          roasterLogosStr &&
          (!existing.data.roasterConfigs ||
            existing.data.roasterConfigs.length === 0)
        ) {
          try {
            const oldConfigs = JSON.parse(roasterLogosStr);
            if (Array.isArray(oldConfigs) && oldConfigs.length > 0) {
              existing.data.roasterConfigs = oldConfigs.map(
                (config: {
                  roasterName: string;
                  logoData?: string;
                  flavorPeriod?: RoasterFlavorPeriod;
                  updatedAt?: number;
                }) => ({
                  roasterName: config.roasterName,
                  logoData: config.logoData,
                  flavorPeriod: config.flavorPeriod,
                  updatedAt: config.updatedAt || Date.now(),
                })
              );
              needsUpdate = true;
              console.warn(
                `已补充迁移 ${existing.data.roasterConfigs.length} 个烘焙商配置`
              );
            }
          } catch {
            // 忽略解析错误
          }
        }

        // 补充迁移 customFlavorDimensions
        const flavorDimensionsStr = localStorage.getItem(
          'customFlavorDimensions'
        );
        if (
          flavorDimensionsStr &&
          (!existing.data.flavorDimensions ||
            existing.data.flavorDimensions.length === 0)
        ) {
          try {
            existing.data.flavorDimensions = JSON.parse(flavorDimensionsStr);
            needsUpdate = true;
            console.warn('已补充迁移自定义风味维度');
          } catch {
            // 忽略解析错误
          }
        }

        // 补充迁移 flavorDimensionHistoricalLabels
        const historicalLabelsStr = localStorage.getItem(
          'flavorDimensionHistoricalLabels'
        );
        if (
          historicalLabelsStr &&
          (!existing.data.flavorDimensionHistoricalLabels ||
            Object.keys(existing.data.flavorDimensionHistoricalLabels)
              .length === 0)
        ) {
          try {
            existing.data.flavorDimensionHistoricalLabels =
              JSON.parse(historicalLabelsStr);
            needsUpdate = true;
            console.warn('已补充迁移风味维度历史标签');
          } catch {
            // 忽略解析错误
          }
        }

        // 补充迁移 equipmentOrder
        const equipmentOrderStr = localStorage.getItem('equipmentOrder');
        if (
          equipmentOrderStr &&
          (!existing.data.equipmentOrder ||
            existing.data.equipmentOrder.length === 0)
        ) {
          try {
            const order = JSON.parse(equipmentOrderStr);
            existing.data.equipmentOrder = order.equipmentIds || [];
            needsUpdate = true;
            console.warn('已补充迁移器具排序');
          } catch {
            // 忽略解析错误
          }
        }

        if (needsUpdate) {
          await db.appSettings.put(existing);
        }
        return;
      }

      const settingsStr = localStorage.getItem('brewGuideSettings');
      if (!settingsStr) return;

      let settings = JSON.parse(settingsStr);

      // 处理 Zustand persist 格式
      if (settings?.state?.settings) {
        settings = settings.state.settings;
      }

      // 移除磨豆机数据（已单独迁移到 grinders 表）
      delete settings.grinders;

      // 迁移自定义风味维度（旧版本数据迁移）
      const flavorDimensionsStr = localStorage.getItem(
        'customFlavorDimensions'
      );
      if (flavorDimensionsStr) {
        try {
          settings.flavorDimensions = JSON.parse(flavorDimensionsStr);
        } catch {
          // 忽略解析错误
        }
      }

      // 迁移风味维度历史标签（旧版本数据迁移）
      const historicalLabelsStr = localStorage.getItem(
        'flavorDimensionHistoricalLabels'
      );
      if (historicalLabelsStr) {
        try {
          settings.flavorDimensionHistoricalLabels =
            JSON.parse(historicalLabelsStr);
        } catch {
          // 忽略解析错误
        }
      }

      // 迁移烘焙商配置（旧版本数据迁移）
      // 旧版本使用 'roaster-logos' 存储 RoasterConfig[]
      const roasterLogosStr = localStorage.getItem('roaster-logos');
      if (roasterLogosStr) {
        try {
          const oldConfigs = JSON.parse(roasterLogosStr);
          if (Array.isArray(oldConfigs) && oldConfigs.length > 0) {
            // 新版格式：直接使用 RoasterConfig[] 数组
            settings.roasterConfigs = oldConfigs.map(
              (config: {
                roasterName: string;
                logoData?: string;
                flavorPeriod?: RoasterFlavorPeriod;
                updatedAt?: number;
              }) => ({
                roasterName: config.roasterName,
                logoData: config.logoData,
                flavorPeriod: config.flavorPeriod,
                updatedAt: config.updatedAt || Date.now(),
              })
            );
            console.log(
              `已迁移 ${settings.roasterConfigs.length} 个烘焙商配置`
            );
          }
        } catch {
          // 忽略解析错误
        }
      }

      // 迁移器具排序
      const equipmentOrderStr = localStorage.getItem('equipmentOrder');
      if (equipmentOrderStr) {
        try {
          const order = JSON.parse(equipmentOrderStr);
          settings.equipmentOrder = order.equipmentIds || [];
        } catch {
          // 忽略解析错误
        }
      }

      await db.appSettings.put({ id: 'main', data: settings });
      console.log('已迁移应用设置到 IndexedDB');
    } catch (error) {
      console.error('迁移应用设置失败:', error);
    }
  },

  /**
   * 从localStorage迁移数据到IndexedDB
   */
  async migrateFromLocalStorage(): Promise<boolean> {
    try {
      const migrated = await db.settings.get('migrated');
      if (migrated && migrated.value === 'true') {
        const beansCount = await db.coffeeBeans.count();
        const notesCount = await db.brewingNotes.count();

        if (
          (beansCount === 0 || notesCount === 0) &&
          (localStorage.getItem('coffeeBeans') ||
            localStorage.getItem('brewingNotes'))
        ) {
          console.warn('虽然标记为已迁移，但数据似乎丢失，重新执行迁移...');
          await db.settings.delete('migrated');
        } else {
          return true;
        }
      }

      let migrationSuccessful = true;

      // 迁移冲煮笔记
      const brewingNotesJson = localStorage.getItem('brewingNotes');
      if (brewingNotesJson) {
        try {
          const brewingNotes: BrewingNote[] = JSON.parse(brewingNotesJson);
          if (brewingNotes.length > 0) {
            await db.brewingNotes.bulkPut(brewingNotes);
            const migratedCount = await db.brewingNotes.count();
            if (migratedCount === brewingNotes.length) {
              console.warn(`已迁移 ${brewingNotes.length} 条冲煮笔记`);
            } else {
              console.error(
                `迁移失败：应有 ${brewingNotes.length} 条笔记，但只迁移了 ${migratedCount} 条`
              );
              migrationSuccessful = false;
            }
          }
        } catch (e) {
          console.error('解析冲煮笔记数据失败:', e);
          migrationSuccessful = false;
        }
      }

      // 迁移咖啡豆数据
      const coffeeBeansJson = localStorage.getItem('coffeeBeans');
      if (coffeeBeansJson) {
        try {
          const coffeeBeans: CoffeeBean[] = JSON.parse(coffeeBeansJson);
          if (coffeeBeans.length > 0) {
            await db.coffeeBeans.bulkPut(coffeeBeans);
            const migratedCount = await db.coffeeBeans.count();
            if (migratedCount === coffeeBeans.length) {
              console.warn(`已迁移 ${coffeeBeans.length} 条咖啡豆数据`);
            } else {
              console.error(
                `迁移失败：应有 ${coffeeBeans.length} 条咖啡豆数据，但只迁移了 ${migratedCount} 条`
              );
              migrationSuccessful = false;
            }
          }
        } catch (e) {
          console.error('解析咖啡豆数据失败:', e);
          migrationSuccessful = false;
        }
      }

      if (migrationSuccessful) {
        await db.settings.put({ key: 'migrated', value: 'true' });
        return true;
      } else {
        console.error('数据迁移过程中发生错误，未标记为已迁移');
        return false;
      }
    } catch (error) {
      console.error('数据迁移失败:', error);
      return false;
    }
  },

  /**
   * 清除数据库数据
   */
  async clearAllData(): Promise<void> {
    try {
      await db.brewingNotes.clear();
      await db.coffeeBeans.clear();
      await db.customEquipments.clear();
      await db.customMethods.clear();
      await db.grinders.clear();
      await db.yearlyReports.clear();
      await db.appSettings.clear();
      await db.settings.clear();
      console.warn('数据库已清空');
    } catch (error) {
      console.error('清空数据库失败:', error);
      throw error;
    }
  },

  /**
   * 记录当前存储信息
   */
  async logStorageInfo(): Promise<void> {
    try {
      const noteCount = await db.brewingNotes.count();
      const notes = await db.brewingNotes.toArray();
      const notesJson = JSON.stringify(notes);
      const notesSizeInBytes = notesJson.length * 2;
      const notesSizeInKB = Math.round(notesSizeInBytes / 1024);
      const notesSizeInMB = (notesSizeInKB / 1024).toFixed(2);

      const beanCount = await db.coffeeBeans.count();
      const beans = await db.coffeeBeans.toArray();
      const beansJson = JSON.stringify(beans);
      const beansSizeInBytes = beansJson.length * 2;
      const beansSizeInKB = Math.round(beansSizeInBytes / 1024);
      const beansSizeInMB = (beansSizeInKB / 1024).toFixed(2);

      const grinderCount = await db.grinders.count();
      const equipmentCount = await db.customEquipments.count();

      console.warn(`IndexedDB 存储信息:`);
      console.warn(
        `- 笔记数量: ${noteCount}, 大小: ${notesSizeInBytes} 字节 (${notesSizeInKB} KB, ${notesSizeInMB} MB)`
      );
      console.warn(
        `- 咖啡豆数量: ${beanCount}, 大小: ${beansSizeInBytes} 字节 (${beansSizeInKB} KB, ${beansSizeInMB} MB)`
      );
      console.warn(`- 磨豆机数量: ${grinderCount}`);
      console.warn(`- 自定义器具数量: ${equipmentCount}`);
      console.warn(
        `- 总大小: ${notesSizeInBytes + beansSizeInBytes} 字节 (${notesSizeInKB + beansSizeInKB} KB)`
      );

      try {
        let totalSize = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            const value = localStorage.getItem(key);
            totalSize += (key.length + (value?.length || 0)) * 2;
          }
        }
        const lsSizeInKB = Math.round(totalSize / 1024);
        const lsSizeInMB = (lsSizeInKB / 1024).toFixed(2);

        console.warn(`localStorage 存储信息:`);
        console.warn(
          `- 估计大小: ${totalSize} 字节 (${lsSizeInKB} KB, ${lsSizeInMB} MB)`
        );
      } catch (e) {
        console.error('计算localStorage大小失败:', e);
      }
    } catch (error) {
      console.error('记录存储信息失败:', error);
    }
  },
};
