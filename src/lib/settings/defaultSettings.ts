/** Shared defaults: no UI store or platform initialization. */
import { DEFAULT_FLAVOR_DIMENSIONS, type AppSettings } from '@/lib/data/models';
import { DEFAULT_NAVIGATION_SETTINGS } from '@/lib/navigation/navigationSettings';
import { DEFAULT_ESTIMATED_CUP_DOSE_SETTINGS } from '@/lib/settings/estimatedCupDose';
import { defaultCalendarSyncSettings } from '@/lib/calendarSync/settings';
export const defaultSettings: AppSettings = {
  // 通用设置
  notificationSound: true,
  hapticFeedback: true,
  showUpdatePrompt: true,
  textZoomLevel: 1.0,
  showFlowRate: false,
  username: '',

  // 布局设置
  layoutSettings: {
    progressBarHeight: 12,
    dataFontSize: '2xl',
    stepDisplayMode: 'cumulative',
  },

  // 雷达图设置
  radarChartScale: 1,
  radarChartShape: 'polygon',
  radarChartAlign: 'center',

  // 咖啡豆显示设置
  decrementPresets: [15, 16, 18],
  enableAllDecrementOption: false,
  enableCustomDecrementInput: true,
  greenBeanRoastPresets: [50, 100, 200],
  enableAllGreenBeanRoastOption: false,
  enableCustomGreenBeanRoastInput: true,
  simplifiedViewLabels: false,
  dateDisplayMode: 'agingDays',
  showFlavorInfo: false,
  showBeanNotes: true,
  showNoteContent: true,
  limitNotesLines: true,
  notesMaxLines: 3,
  showPrice: true,
  showTotalPrice: false,
  showStatusDots: false,
  showBeanSummary: false,
  beanFilterStyle: 'single',
  showEstimatedCups: false,
  estimatedCupDoseSettings: { ...DEFAULT_ESTIMATED_CUP_DOSE_SETTINGS },
  enableBeanSummaryCapacityLimit: false,
  beanSummaryMaxDisplayCapacity: 1000,
  enableBeanSummaryOverflowWrap: false,

  // 安全区域设置
  safeAreaMargins: {
    top: 12,
    bottom: 38,
  },

  // 导航栏设置
  navigationSettings: DEFAULT_NAVIGATION_SETTINGS,

  // 赏味期设置
  customFlavorPeriod: {
    light: { startDay: 0, endDay: 0 },
    medium: { startDay: 0, endDay: 0 },
    dark: { startDay: 0, endDay: 0 },
  },
  calendarSync: { ...defaultCalendarSyncSettings },
  showBeanReadyReminderPopup: false,

  // 备份提醒设置
  backupReminder: undefined,

  // 同步设置
  s3Sync: {
    enabled: false,
    accessKeyId: '',
    secretAccessKey: '',
    region: 'us-east-1',
    bucketName: '',
    prefix: 'brew-guide-data/',
    endpoint: '',
    syncMode: 'manual',
    enablePullToSync: true,
  },
  webdavSync: undefined,
  supabaseSync: {
    enabled: false,
    url: '',
    anonKey: '',
  },
  activeSyncType: 'none',
  supabaseBackupProvider: 'none',

  // 随机咖啡豆设置
  randomCoffeeBeans: {
    enableLongPressRandomType: false,
    defaultRandomType: 'espresso',
    flavorPeriodRanges: {
      aging: false,
      optimal: true,
      decline: true,
      frozen: true,
      inTransit: false,
      unknown: true,
    },
  },

  // 其他设置
  enableBeanPrint: false,
  showBeanRating: false,
  beanRatingTenthStep: false,
  hiddenCommonMethods: {},
  hiddenEquipments: [],
  equipmentNameOverrides: {},
  // 笔记设置
  showFlavorRatingInForm: true,
  showOverallRatingInForm: true,
  flavorRatingFollowOverall: false,
  flavorRatingHalfStep: false,
  flavorRatingTenthStep: false,
  overallRatingUseSlider: false,
  showRatingDimensionsEntry: false,
  showUnitPriceInNote: false,
  showBeanAgingDaysInNote: false,
  showFlavorInNote: true,
  showNoteTimeInNote: true,
  showCapacityAdjustmentRecords: true,
  useClassicNotesListStyle: false,
  artisticShareRatingStyle: 'dots',
  artisticShareTags: '#咖啡 #手冲咖啡 #咖啡笔记 #BrewGuide',

  // 生豆库设置
  enableGreenBeanInventory: false,
  enableConvertToGreen: false,

  // 识图设置
  autoFillRecognitionImage: false,
  showEstateField: false,
  immersiveAdd: false,
  experimentalBeanRecognitionEnabled: false,
  experimentalBeanRecognitionApiBaseUrl: '',
  experimentalBeanRecognitionApiKey: '',
  experimentalBeanRecognitionModel: '',
  experimentalBeanRecognitionPrompt: '',
  experimentalBeanSharePackageEnabled: false,
  syncNewNoteDateWithSelectedDate: false,
  syncQuickDecrementDateWithSelectedDate: false,

  // 菜单栏图标设置
  showMenuBarIcon: true,

  // 风味维度设置
  flavorDimensions: [...DEFAULT_FLAVOR_DIMENSIONS],
  flavorDimensionHistoricalLabels: {},

  // 烘焙商配置
  roasterConfigs: [],

  // 分组
  coffeeBeanGroups: [],

  // 器具排序
  equipmentOrder: [],

  // 冲煮设置
  showCoffeeBeanSelectionStep: true, // 默认显示咖啡豆选择步骤
  showBrewingVisualizer: true, // 默认显示可视化冲煮界面

  // 烘焙商字段设置
  roasterFieldEnabled: true, // 是否启用独立烘焙商字段
  roasterSeparator: ' ', // 烘焙商分隔符，默认空格
  roasterMigrationCompleted: false, // @deprecated 已废弃，按需迁移策略不再使用此标记
};
