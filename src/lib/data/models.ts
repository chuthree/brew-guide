import type { EstimatedCupDoseSettings } from '@/lib/settings/estimatedCupDose';
import type { BeanFieldConfig } from '@/lib/coffee-beans/beanFields';

/**
 * A canonical queue record as it is stored by any persistence backend.
 * Historical table/action names and future JSON-safe fields are preserved
 * until the runtime queue validates that the operation is executable.
 */
export interface StoredPendingOperation {
  id: string;
  table: string;
  type: string;
  recordId: string;
  data?: unknown;
  timestamp: number;
  retryCount: number;
  lastError?: string | null;
  failedAt?: number | null;
  [key: string]: unknown;
}

/**
 * 研磨度历史记录
 */
export interface GrindSizeHistory {
  grindSize: string;
  timestamp: number;
  equipment?: string; // 器具名称
  method?: string; // 冲煮方案名称
  coffeeBean?: string; // @deprecated 旧版仅存储显示名称
  coffeeBeanName?: string; // 咖啡豆名称
  coffeeBeanRoaster?: string; // 烘焙商名称
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
 * 咖啡豆自定义分组
 */
export interface CoffeeBeanGroup {
  id: string;
  name: string;
  beanIds: string[];
  order: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * 应用设置类型定义
 * 统一管理所有用户设置
 */
export interface AppSettings {
  // 通用设置
  notificationSound: boolean;
  hapticFeedback: boolean;
  showUpdatePrompt?: boolean;
  textZoomLevel: number;
  showFlowRate: boolean;
  username: string;

  // 布局设置
  layoutSettings?: {
    progressBarHeight?: number;
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
  showNoteContent: boolean;
  limitNotesLines: boolean;
  notesMaxLines: number;
  showPrice: boolean;
  showTotalPrice: boolean;
  showStatusDots: boolean;
  showBeanSummary: boolean;
  beanFilterStyle?: 'single' | 'multiple';
  beanCategorySort?: 'count' | 'name';
  showEstimatedCups: boolean;
  estimatedCupDoseSettings: EstimatedCupDoseSettings;
  enableBeanSummaryCapacityLimit: boolean;
  beanSummaryMaxDisplayCapacity: number;
  enableBeanSummaryOverflowWrap: boolean;

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

  // 日历同步设置（仅控制同步策略，原生日历事件 ID 存在本机本地存储）
  calendarSync?: {
    enabled: boolean;
  };
  showBeanReadyReminderPopup: boolean;

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

  // Supabase 主同步下的手动双备份提供商
  supabaseBackupProvider?: 'none' | 's3' | 'webdav';

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

  // 打印设置
  enableBeanPrint?: boolean;
  showBeanRating?: boolean;
  beanRatingTenthStep?: boolean;

  // 隐藏的通用方案设置
  hiddenCommonMethods?: Record<string, string[]>;

  // 隐藏的器具设置
  hiddenEquipments?: string[];

  // 系统预设器具名称覆盖，key 为系统器具 id。
  equipmentNameOverrides?: Record<string, string>;

  // 笔记设置
  showFlavorRatingInForm: boolean;
  showOverallRatingInForm: boolean;
  flavorRatingFollowOverall: boolean;
  flavorRatingHalfStep: boolean;
  flavorRatingTenthStep: boolean;
  overallRatingUseSlider: boolean;
  showRatingDimensionsEntry: boolean;
  showUnitPriceInNote: boolean;
  showBeanAgingDaysInNote: boolean;
  showFlavorInNote: boolean;
  showNoteTimeInNote: boolean;
  showCapacityAdjustmentRecords: boolean;
  useClassicNotesListStyle?: boolean;
  artisticShareRatingStyle?: 'number' | 'dots' | 'bar';
  artisticShareTags?: string;

  // 生豆库设置
  enableGreenBeanInventory?: boolean;
  enableConvertToGreen?: boolean;

  // 识图设置
  autoFillRecognitionImage?: boolean;
  beanFieldConfig?: BeanFieldConfig;
  showEstateField?: boolean;
  immersiveAdd?: boolean;
  experimentalBeanRecognitionEnabled?: boolean;
  experimentalBeanRecognitionApiBaseUrl?: string;
  experimentalBeanRecognitionApiKey?: string;
  experimentalBeanRecognitionModel?: string;
  experimentalBeanRecognitionPrompt?: string;
  experimentalBeanSharePackageEnabled?: boolean;
  syncNewNoteDateWithSelectedDate?: boolean;
  syncQuickDecrementDateWithSelectedDate?: boolean;

  // 菜单栏图标设置（桌面端）
  showMenuBarIcon?: boolean;

  // 自定义风味维度
  flavorDimensions?: FlavorDimension[];
  flavorDimensionHistoricalLabels?: Record<string, string>;

  // 烘焙商配置
  roasterConfigs?: RoasterConfig[];

  // 咖啡豆自定义分组
  coffeeBeanGroups?: CoffeeBeanGroup[];

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
  showBrewingVisualizer?: boolean; // 是否显示可视化冲煮界面，默认 true

  // 烘焙商字段设置
  roasterFieldEnabled?: boolean; // 是否启用独立烘焙商字段，默认 true
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
