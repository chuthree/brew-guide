/**
 * 统一设置 Store
 *
 * 架构设计：
 * - 所有设置统一存储在 IndexedDB (appSettings 表)
 * - 通过 Zustand 管理内存状态
 * - 提供细粒度的更新方法，避免全量更新
 * - 支持订阅特定设置变化
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  db,
  AppSettings,
  FlavorDimension,
  RoasterConfig,
  DEFAULT_FLAVOR_DIMENSIONS,
} from '@/lib/core/db';
import { LayoutSettings } from '@/components/brewing/Timer/Settings';
import {
  ViewOption,
  VIEW_OPTIONS,
} from '@/components/coffee-bean/List/constants';

/**
 * 默认设置值
 */
export const defaultSettings: AppSettings = {
  // 通用设置
  notificationSound: true,
  hapticFeedback: true,
  textZoomLevel: 1.0,
  showFlowRate: false,
  username: '',

  // 布局设置
  layoutSettings: {
    stageInfoReversed: false,
    progressBarHeight: 12,
    controlsReversed: false,
    alwaysShowTimerInfo: true,
    showStageDivider: true,
    compactMode: false,
    dataFontSize: '2xl',
  },

  // 咖啡豆显示设置
  decrementPresets: [15, 16, 18],
  enableAllDecrementOption: false,
  enableCustomDecrementInput: true,
  greenBeanRoastPresets: [50, 100, 200],
  enableAllGreenBeanRoastOption: false,
  enableCustomGreenBeanRoastInput: true,
  showOnlyBeanName: true,
  simplifiedViewLabels: false,
  dateDisplayMode: 'agingDays',
  showFlavorInfo: false,
  showBeanNotes: true,
  limitNotesLines: true,
  notesMaxLines: 3,
  showTotalPrice: false,
  showStatusDots: false,
  noteDisplayStyle: 'list',

  // 安全区域设置
  safeAreaMargins: {
    top: 38,
    bottom: 38,
  },

  // 导航栏设置
  navigationSettings: {
    visibleTabs: {
      brewing: true,
      coffeeBean: true,
      notes: true,
    },
    coffeeBeanViews: {
      [VIEW_OPTIONS.INVENTORY]: true,
      [VIEW_OPTIONS.RANKING]: true,
      [VIEW_OPTIONS.STATS]: true,
    },
    pinnedViews: [],
  },

  // 赏味期设置
  customFlavorPeriod: {
    light: { startDay: 0, endDay: 0 },
    medium: { startDay: 0, endDay: 0 },
    dark: { startDay: 0, endDay: 0 },
  },
  detailedFlavorPeriodEnabled: false,
  detailedFlavorPeriod: {
    extraLight: { startDay: 0, endDay: 0 },
    light: { startDay: 0, endDay: 0 },
    mediumLight: { startDay: 0, endDay: 0 },
    medium: { startDay: 0, endDay: 0 },
    mediumDark: { startDay: 0, endDay: 0 },
    dark: { startDay: 0, endDay: 0 },
  },

  // 备份提醒设置
  backupReminder: undefined,

  // 同步设置
  s3Sync: {
    enabled: false,
    accessKeyId: '',
    secretAccessKey: '',
    region: 'cn-south-1',
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

  // 搜索排序设置
  searchSort: {
    enabled: false,
    time: false,
    rating: false,
    extractionTime: true,
  },

  // 其他设置
  enableBeanPrint: false,
  showBeanRating: false,
  showBeanInfoDivider: true,
  hiddenCommonMethods: {},
  hiddenEquipments: [],
  grinderDefaultSync: {
    navigationBar: true,
    methodForm: true,
    manualNote: true,
    noteEdit: true,
  },
  showGrinderScale: true,

  // 笔记设置
  defaultExpandRating: false,
  defaultExpandChangeLog: false,
  showFlavorRatingInForm: true,
  showOverallRatingInForm: true,
  artisticSharingEnabled: false,

  // 生豆库设置
  enableGreenBeanInventory: false,
  enableConvertToGreen: false,

  // 识图设置
  autoFillRecognitionImage: false,
  showEstateField: false,
  immersiveAdd: false,

  // 每日提醒设置
  dailyReminder: false,
  dailyReminderTime: '09:00',

  // 隐藏二维码选项
  hideGroupQRCode: false,
  hideAppreciationQRCode: false,

  // 菜单栏图标设置
  showMenuBarIcon: true,

  // 风味维度设置
  flavorDimensions: [...DEFAULT_FLAVOR_DIMENSIONS],
  flavorDimensionHistoricalLabels: {},

  // 烘焙商配置
  roasterConfigs: [],

  // 器具排序
  equipmentOrder: [],
};

/**
 * 设置 Store 状态接口
 */
interface SettingsStore {
  // 状态
  settings: AppSettings;
  isLoading: boolean;
  initialized: boolean;
  error: string | null;

  // 初始化
  loadSettings: () => Promise<void>;

  // 通用更新方法
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;

  // 细粒度更新方法
  updateLayoutSettings: (layout: Partial<LayoutSettings>) => Promise<void>;
  updateNavigationSettings: (
    nav: Partial<AppSettings['navigationSettings']>
  ) => Promise<void>;
  updateS3SyncSettings: (
    s3: Partial<NonNullable<AppSettings['s3Sync']>>
  ) => Promise<void>;
  updateWebDAVSyncSettings: (
    webdav: Partial<NonNullable<AppSettings['webdavSync']>>
  ) => Promise<void>;
  updateSupabaseSyncSettings: (
    supabase: Partial<NonNullable<AppSettings['supabaseSync']>>
  ) => Promise<void>;

  // 隐藏器具/方案管理
  hideEquipment: (equipmentId: string) => Promise<void>;
  unhideEquipment: (equipmentId: string) => Promise<void>;
  hideMethod: (equipmentId: string, methodId: string) => Promise<void>;
  unhideMethod: (equipmentId: string, methodId: string) => Promise<void>;

  // 风味维度管理
  getFlavorDimensions: () => FlavorDimension[];
  addFlavorDimension: (label: string) => Promise<FlavorDimension>;
  updateFlavorDimension: (
    id: string,
    updates: Partial<Pick<FlavorDimension, 'label'>>
  ) => Promise<void>;
  deleteFlavorDimension: (id: string) => Promise<void>;
  reorderFlavorDimensions: (dimensions: FlavorDimension[]) => Promise<void>;
  resetFlavorDimensions: () => Promise<void>;
  getHistoricalLabel: (id: string) => string | undefined;

  // 烘焙商配置管理
  getRoasterConfigs: () => RoasterConfig[];
  getRoasterConfig: (roasterName: string) => RoasterConfig | undefined;
  updateRoasterConfig: (
    roasterName: string,
    updates: Partial<Omit<RoasterConfig, 'roasterName' | 'updatedAt'>>
  ) => Promise<void>;
  deleteRoasterConfig: (roasterName: string) => Promise<void>;

  // 器具排序
  setEquipmentOrder: (order: string[]) => Promise<void>;

  // 重置
  resetSettings: () => Promise<void>;

  // 兼容性方法（用于迁移期间）
  getSettingsForSync: () => AppSettings;
  importSettings: (settings: AppSettings) => Promise<void>;
}

/**
 * 设置 Store
 */
export const useSettingsStore = create<SettingsStore>()(
  subscribeWithSelector((set, get) => ({
    settings: { ...defaultSettings },
    isLoading: false,
    initialized: false,
    error: null,

    loadSettings: async () => {
      if (get().isLoading) return;

      set({ isLoading: true, error: null });

      try {
        // 从 IndexedDB 加载设置
        const stored = await db.appSettings.get('main');

        if (stored && stored.data) {
          // 合并默认设置和存储的设置，确保新字段有默认值
          const mergedSettings = { ...defaultSettings, ...stored.data };
          set({
            settings: mergedSettings,
            isLoading: false,
            initialized: true,
          });
        } else {
          // 使用默认设置
          await db.appSettings.put({ id: 'main', data: defaultSettings });
          set({
            settings: defaultSettings,
            isLoading: false,
            initialized: true,
          });
        }
      } catch (error) {
        console.error('[SettingsStore] loadSettings failed:', error);
        set({
          error: '加载设置失败',
          isLoading: false,
          initialized: true,
          settings: defaultSettings,
        });
      }
    },

    updateSettings: async updates => {
      const currentSettings = get().settings;
      const newSettings = { ...currentSettings, ...updates };

      try {
        await db.appSettings.put({ id: 'main', data: newSettings });
        set({ settings: newSettings });

        // 触发设置变化事件（用于兼容旧代码）
        dispatchSettingsChanged(newSettings);
      } catch (error) {
        console.error('[SettingsStore] updateSettings failed:', error);
        throw error;
      }
    },

    updateLayoutSettings: async layout => {
      const currentSettings = get().settings;
      const currentLayout = currentSettings.layoutSettings;
      const defaultLayout = defaultSettings.layoutSettings!; // defaultSettings.layoutSettings 在定义中有值

      // 确保所有字段都有值，使用类型断言来确保类型安全
      const newLayoutSettings: NonNullable<AppSettings['layoutSettings']> = {
        stageInfoReversed:
          layout.stageInfoReversed ??
          currentLayout?.stageInfoReversed ??
          defaultLayout.stageInfoReversed,
        progressBarHeight:
          layout.progressBarHeight ??
          currentLayout?.progressBarHeight ??
          defaultLayout.progressBarHeight,
        controlsReversed:
          layout.controlsReversed ??
          currentLayout?.controlsReversed ??
          defaultLayout.controlsReversed,
        alwaysShowTimerInfo:
          layout.alwaysShowTimerInfo ??
          currentLayout?.alwaysShowTimerInfo ??
          defaultLayout.alwaysShowTimerInfo,
        showStageDivider:
          layout.showStageDivider ??
          currentLayout?.showStageDivider ??
          defaultLayout.showStageDivider,
        compactMode:
          layout.compactMode ??
          currentLayout?.compactMode ??
          defaultLayout.compactMode,
        dataFontSize:
          layout.dataFontSize ??
          currentLayout?.dataFontSize ??
          defaultLayout.dataFontSize,
      };
      await get().updateSettings({ layoutSettings: newLayoutSettings });
    },

    updateNavigationSettings: async nav => {
      const currentSettings = get().settings;
      const newNavSettings = {
        ...currentSettings.navigationSettings,
        ...nav,
      };
      await get().updateSettings({
        navigationSettings: newNavSettings as AppSettings['navigationSettings'],
      });
    },

    updateS3SyncSettings: async s3 => {
      const currentSettings = get().settings;
      const newS3Settings = {
        ...currentSettings.s3Sync,
        ...s3,
      };
      await get().updateSettings({
        s3Sync: newS3Settings as AppSettings['s3Sync'],
      });
    },

    updateWebDAVSyncSettings: async webdav => {
      const currentSettings = get().settings;
      const newWebDAVSettings = {
        ...currentSettings.webdavSync,
        ...webdav,
      };
      await get().updateSettings({
        webdavSync: newWebDAVSettings as AppSettings['webdavSync'],
      });
    },

    updateSupabaseSyncSettings: async supabase => {
      const currentSettings = get().settings;
      const newSupabaseSettings = {
        ...currentSettings.supabaseSync,
        ...supabase,
      };
      await get().updateSettings({
        supabaseSync: newSupabaseSettings as AppSettings['supabaseSync'],
      });
    },

    hideEquipment: async equipmentId => {
      const currentSettings = get().settings;
      const hiddenEquipments = [...(currentSettings.hiddenEquipments || [])];

      if (!hiddenEquipments.includes(equipmentId)) {
        hiddenEquipments.push(equipmentId);
        await get().updateSettings({ hiddenEquipments });
      }
    },

    unhideEquipment: async equipmentId => {
      const currentSettings = get().settings;
      const hiddenEquipments = (currentSettings.hiddenEquipments || []).filter(
        id => id !== equipmentId
      );
      await get().updateSettings({ hiddenEquipments });
    },

    hideMethod: async (equipmentId, methodId) => {
      const currentSettings = get().settings;
      const hiddenCommonMethods = {
        ...(currentSettings.hiddenCommonMethods || {}),
      };
      const equipmentHidden = [...(hiddenCommonMethods[equipmentId] || [])];

      if (!equipmentHidden.includes(methodId)) {
        equipmentHidden.push(methodId);
        hiddenCommonMethods[equipmentId] = equipmentHidden;
        await get().updateSettings({ hiddenCommonMethods });
      }
    },

    unhideMethod: async (equipmentId, methodId) => {
      const currentSettings = get().settings;
      const hiddenCommonMethods = {
        ...(currentSettings.hiddenCommonMethods || {}),
      };
      const equipmentHidden = (hiddenCommonMethods[equipmentId] || []).filter(
        id => id !== methodId
      );

      if (equipmentHidden.length > 0) {
        hiddenCommonMethods[equipmentId] = equipmentHidden;
      } else {
        delete hiddenCommonMethods[equipmentId];
      }

      await get().updateSettings({ hiddenCommonMethods });
    },

    // ==================== 风味维度管理 ====================

    getFlavorDimensions: () => {
      const settings = get().settings;
      return settings.flavorDimensions || [...DEFAULT_FLAVOR_DIMENSIONS];
    },

    addFlavorDimension: async label => {
      const settings = get().settings;
      const dimensions = [
        ...(settings.flavorDimensions || DEFAULT_FLAVOR_DIMENSIONS),
      ];
      const maxOrder = Math.max(...dimensions.map(d => d.order), -1);

      const newDimension: FlavorDimension = {
        id: `custom_${Date.now()}`,
        label,
        order: maxOrder + 1,
        isDefault: false,
      };

      dimensions.push(newDimension);

      // 更新历史标签
      const historicalLabels = {
        ...(settings.flavorDimensionHistoricalLabels || {}),
        [newDimension.id]: label,
      };

      await get().updateSettings({
        flavorDimensions: dimensions,
        flavorDimensionHistoricalLabels: historicalLabels,
      });

      dispatchFlavorDimensionsChanged(dimensions);
      return newDimension;
    },

    updateFlavorDimension: async (id, updates) => {
      const settings = get().settings;
      const dimensions = [
        ...(settings.flavorDimensions || DEFAULT_FLAVOR_DIMENSIONS),
      ];
      const index = dimensions.findIndex(d => d.id === id);

      if (index === -1) return;

      dimensions[index] = { ...dimensions[index], ...updates };

      // 更新历史标签
      const historicalLabels = {
        ...(settings.flavorDimensionHistoricalLabels || {}),
      };
      if (updates.label) {
        historicalLabels[id] = updates.label;
      }

      await get().updateSettings({
        flavorDimensions: dimensions,
        flavorDimensionHistoricalLabels: historicalLabels,
      });

      dispatchFlavorDimensionsChanged(dimensions);
    },

    deleteFlavorDimension: async id => {
      const settings = get().settings;
      const dimensions = (
        settings.flavorDimensions || DEFAULT_FLAVOR_DIMENSIONS
      ).filter(d => d.id !== id);

      await get().updateSettings({ flavorDimensions: dimensions });
      dispatchFlavorDimensionsChanged(dimensions);
    },

    reorderFlavorDimensions: async dimensions => {
      // 更新 order 字段
      const reorderedDimensions = dimensions.map((d, index) => ({
        ...d,
        order: index,
      }));

      await get().updateSettings({ flavorDimensions: reorderedDimensions });
      dispatchFlavorDimensionsChanged(reorderedDimensions);
    },

    resetFlavorDimensions: async () => {
      await get().updateSettings({
        flavorDimensions: [...DEFAULT_FLAVOR_DIMENSIONS],
      });
      dispatchFlavorDimensionsChanged([...DEFAULT_FLAVOR_DIMENSIONS]);
    },

    getHistoricalLabel: id => {
      const settings = get().settings;
      return settings.flavorDimensionHistoricalLabels?.[id];
    },

    // ==================== 烘焙商配置管理 ====================

    getRoasterConfigs: () => {
      return get().settings.roasterConfigs || [];
    },

    getRoasterConfig: roasterName => {
      const configs = get().settings.roasterConfigs || [];
      return configs.find(c => c.roasterName === roasterName);
    },

    updateRoasterConfig: async (roasterName, updates) => {
      const settings = get().settings;
      const configs = [...(settings.roasterConfigs || [])];
      const existingIndex = configs.findIndex(
        c => c.roasterName === roasterName
      );

      if (existingIndex >= 0) {
        configs[existingIndex] = {
          ...configs[existingIndex],
          ...updates,
          updatedAt: Date.now(),
        };
      } else {
        configs.push({
          roasterName,
          ...updates,
          updatedAt: Date.now(),
        });
      }

      await get().updateSettings({ roasterConfigs: configs });
    },

    deleteRoasterConfig: async roasterName => {
      const settings = get().settings;
      const configs = (settings.roasterConfigs || []).filter(
        c => c.roasterName !== roasterName
      );
      await get().updateSettings({ roasterConfigs: configs });
    },

    // ==================== 器具排序 ====================

    setEquipmentOrder: async order => {
      await get().updateSettings({ equipmentOrder: order });
    },

    resetSettings: async () => {
      try {
        await db.appSettings.put({ id: 'main', data: defaultSettings });
        set({ settings: defaultSettings });
        dispatchSettingsChanged(defaultSettings);
      } catch (error) {
        console.error('[SettingsStore] resetSettings failed:', error);
        throw error;
      }
    },

    getSettingsForSync: () => {
      return get().settings;
    },

    importSettings: async settings => {
      const mergedSettings = { ...defaultSettings, ...settings };
      try {
        await db.appSettings.put({ id: 'main', data: mergedSettings });
        set({ settings: mergedSettings });
        dispatchSettingsChanged(mergedSettings);
      } catch (error) {
        console.error('[SettingsStore] importSettings failed:', error);
        throw error;
      }
    },
  }))
);

/**
 * 触发设置变化事件
 */
function dispatchSettingsChanged(settings: AppSettings): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('settingsChanged', {
        detail: { settings },
      })
    );
  }
}

/**
 * 触发风味维度变化事件
 */
function dispatchFlavorDimensionsChanged(dimensions: FlavorDimension[]): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('flavorDimensionsChanged', {
        detail: { dimensions },
      })
    );
  }
}

/**
 * 获取设置 Store 实例（非 React 环境使用）
 */
export const getSettingsStore = () => useSettingsStore.getState();

/**
 * 便捷 Hook：获取特定设置
 */
export function useSetting<K extends keyof AppSettings>(
  key: K
): AppSettings[K] {
  return useSettingsStore(state => state.settings[key]);
}

/**
 * 便捷 Hook：获取多个设置
 */
export function useSettings<K extends keyof AppSettings>(
  keys: K[]
): Pick<AppSettings, K> {
  return useSettingsStore(state => {
    const result = {} as Pick<AppSettings, K>;
    for (const key of keys) {
      result[key] = state.settings[key];
    }
    return result;
  });
}

// ==================== 隐藏器具/方案工具函数 ====================

/**
 * 检查器具是否被隐藏
 */
export function isEquipmentHidden(equipmentId: string): boolean {
  const settings = getSettingsStore().settings;
  return (settings.hiddenEquipments || []).includes(equipmentId);
}

/**
 * 获取所有隐藏的器具ID
 */
export function getHiddenEquipmentIds(): string[] {
  const settings = getSettingsStore().settings;
  return settings.hiddenEquipments || [];
}

/**
 * 过滤隐藏的器具
 */
export function filterHiddenEquipments<T extends { id: string }>(
  equipments: T[]
): T[] {
  const hiddenIds = getHiddenEquipmentIds();
  if (hiddenIds.length === 0) return equipments;
  return equipments.filter(e => !hiddenIds.includes(e.id));
}

/**
 * 检查方案是否被隐藏
 */
export function isMethodHidden(equipmentId: string, methodId: string): boolean {
  const settings = getSettingsStore().settings;
  const hiddenMethods = settings.hiddenCommonMethods || {};
  const equipmentHidden = hiddenMethods[equipmentId] || [];
  return equipmentHidden.includes(methodId);
}

/**
 * 获取所有隐藏的方案
 */
export function getAllHiddenMethods(): Record<string, string[]> {
  const settings = getSettingsStore().settings;
  return settings.hiddenCommonMethods || {};
}

/**
 * 获取指定器具的隐藏方案ID列表
 */
export function getHiddenMethodIds(equipmentId: string): string[] {
  const settings = getSettingsStore().settings;
  const hiddenMethods = settings.hiddenCommonMethods || {};
  return hiddenMethods[equipmentId] || [];
}

/**
 * 过滤隐藏的方案
 */
export function filterHiddenMethods<T extends { id?: string; name: string }>(
  methods: T[],
  equipmentId: string
): T[] {
  const hiddenIds = getHiddenMethodIds(equipmentId);
  if (hiddenIds.length === 0) return methods;
  return methods.filter(m => {
    const methodId = m.id || m.name;
    return !hiddenIds.includes(methodId);
  });
}

// ==================== 器具排序工具函数 ====================

interface EquipmentOrder {
  equipmentIds: string[];
}

/**
 * 加载器具排序信息
 */
export function loadEquipmentOrder(): EquipmentOrder {
  const settings = getSettingsStore().settings;
  return { equipmentIds: settings.equipmentOrder || [] };
}

/**
 * 保存器具排序信息
 */
export async function saveEquipmentOrder(order: EquipmentOrder): Promise<void> {
  await getSettingsStore().setEquipmentOrder(order.equipmentIds);
}

// ==================== 烘焙商配置工具函数 ====================

/**
 * 同步获取所有烘焙商配置
 */
export function getRoasterConfigsSync(): RoasterConfig[] {
  return getSettingsStore().settings.roasterConfigs || [];
}

/**
 * 同步获取指定烘焙商配置
 */
export function getRoasterConfigSync(
  roasterName: string
): RoasterConfig | undefined {
  const configs = getRoasterConfigsSync();
  return configs.find(c => c.roasterName === roasterName);
}

/**
 * 获取烘焙商 Logo（同步）
 */
export function getRoasterLogoSync(roasterName: string): string | undefined {
  const config = getRoasterConfigSync(roasterName);
  return config?.logoData;
}

// ==================== 风味维度工具函数 ====================

/**
 * 同步获取所有风味维度
 */
export function getFlavorDimensionsSync(): FlavorDimension[] {
  return (
    getSettingsStore().settings.flavorDimensions || [
      ...DEFAULT_FLAVOR_DIMENSIONS,
    ]
  );
}

/**
 * 同步获取历史维度标签
 */
export function getHistoricalLabelsSync(): Record<string, string> {
  return getSettingsStore().settings.flavorDimensionHistoricalLabels || {};
}

/**
 * 创建空的风味评分对象
 */
export function createEmptyTasteRatings(
  dimensions: FlavorDimension[]
): Record<string, number> {
  const ratings: Record<string, number> = {};
  dimensions.forEach(dimension => {
    ratings[dimension.id] = 0;
  });
  return ratings;
}

/**
 * 迁移风味评分数据（确保向后兼容）
 */
export function migrateTasteRatings(
  oldRatings: Record<string, number>,
  dimensions: FlavorDimension[]
): Record<string, number> {
  const newRatings: Record<string, number> = {};

  // 先设置所有维度的默认值
  dimensions.forEach(dimension => {
    newRatings[dimension.id] = 0;
  });

  // 然后用旧数据覆盖存在的维度
  Object.entries(oldRatings).forEach(([key, value]) => {
    if (dimensions.some(d => d.id === key)) {
      newRatings[key] = value;
    }
  });

  return newRatings;
}
