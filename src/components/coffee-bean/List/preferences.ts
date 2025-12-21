import {
  ExtendedCoffeeBean,
  BeanType,
  BeanState,
  ViewOption,
  BeanFilterMode,
} from './types';
import {
  getBooleanState,
  saveBooleanState,
  getStringState,
  saveStringState,
  getObjectState,
  saveObjectState,
} from '@/lib/core/statePersistence';
import { SortOption } from './SortSelector';
import { FlavorPeriodStatus } from '@/lib/utils/beanVarietyUtils';
import { DateGroupingMode } from './components/StatsView/types';

const MODULE_NAME = 'coffee-beans';
const MAX_SEARCH_HISTORY = 15;

// UI 偏好设置缓存（不存储数据，只存储 UI 状态）
export const globalCache: {
  // 筛选状态
  selectedVariety: string | null;
  selectedBeanType: BeanType;
  selectedBeanTypes: { green: BeanType; roasted: BeanType };
  selectedBeanState: BeanState;
  filterMode: BeanFilterMode;
  filterModes: { green: BeanFilterMode; roasted: BeanFilterMode };
  selectedOrigin: string | null;
  selectedFlavorPeriod: FlavorPeriodStatus | null;
  selectedRoaster: string | null;
  selectedVarieties: { green: string | null; roasted: string | null };
  selectedOrigins: { green: string | null; roasted: string | null };
  selectedFlavorPeriods: {
    green: FlavorPeriodStatus | null;
    roasted: FlavorPeriodStatus | null;
  };
  selectedRoasters: { green: string | null; roasted: string | null };
  showEmptyBeans: boolean;
  showEmptyBeansSettings: { green: boolean; roasted: boolean };

  // 视图状态
  isImageFlowMode: boolean;
  isImageFlowModes: { green: boolean; roasted: boolean };
  viewMode: ViewOption;
  sortOption: SortOption;
  inventorySortOption: SortOption;
  inventorySortOptions: { green: SortOption; roasted: SortOption };
  rankingSortOption: SortOption;
  rankingBeanType: BeanType;

  // 统计视图
  dateGroupingMode: DateGroupingMode;
  selectedDate: string | null;
  selectedDates: {
    year: string | null;
    month: string | null;
    day: string | null;
  };
  statsBeanState: 'roasted' | 'green';

  // 临时数据（用于 UI 计算，不持久化）
  filteredBeans: ExtendedCoffeeBean[];
  ratedBeans: ExtendedCoffeeBean[];
  varieties: string[];
  availableOrigins: string[];
  availableFlavorPeriods: FlavorPeriodStatus[];
  availableRoasters: string[];
} = {
  selectedVariety: null,
  selectedBeanType: 'all',
  selectedBeanTypes: { green: 'all', roasted: 'all' },
  selectedBeanState: 'roasted',
  filterMode: 'variety',
  filterModes: { green: 'variety', roasted: 'variety' },
  selectedOrigin: null,
  selectedFlavorPeriod: null,
  selectedRoaster: null,
  selectedVarieties: { green: null, roasted: null },
  selectedOrigins: { green: null, roasted: null },
  selectedFlavorPeriods: { green: null, roasted: null },
  selectedRoasters: { green: null, roasted: null },
  showEmptyBeans: false,
  showEmptyBeansSettings: { green: false, roasted: false },
  isImageFlowMode: false,
  isImageFlowModes: { green: false, roasted: false },
  viewMode: 'inventory',
  sortOption: 'remaining_days_asc',
  inventorySortOption: 'remaining_days_asc',
  inventorySortOptions: {
    green: 'last_modified_desc',
    roasted: 'remaining_days_asc',
  },
  rankingSortOption: 'rating_desc',
  rankingBeanType: 'all',
  dateGroupingMode: 'month',
  selectedDate: null,
  selectedDates: { year: null, month: null, day: null },
  statsBeanState: 'roasted',
  filteredBeans: [],
  ratedBeans: [],
  varieties: [],
  availableOrigins: [],
  availableFlavorPeriods: [],
  availableRoasters: [],
};

// ==================== 偏好设置读写函数 ====================

const migrateSortOption = (
  value: string,
  viewMode: string = 'inventory'
): SortOption => {
  if (value === 'name_asc' || value === 'name_desc') {
    return viewMode === 'ranking' ? 'rating_desc' : 'last_modified_desc';
  }
  return value as SortOption;
};

// 显示空豆子
export const getShowEmptyBeansPreference = () =>
  getBooleanState(MODULE_NAME, 'showEmptyBeans', false);
export const saveShowEmptyBeansPreference = (v: boolean) =>
  saveBooleanState(MODULE_NAME, 'showEmptyBeans', v);
export const getShowEmptyBeansByStatePreference = (s: BeanState) =>
  getBooleanState(MODULE_NAME, `showEmptyBeans_${s}`, false);
export const saveShowEmptyBeansByStatePreference = (s: BeanState, v: boolean) =>
  saveBooleanState(MODULE_NAME, `showEmptyBeans_${s}`, v);

// 品种筛选
export const getSelectedVarietyPreference = () =>
  getStringState(MODULE_NAME, 'selectedVariety', '') || null;
export const saveSelectedVarietyPreference = (v: string | null) =>
  saveStringState(MODULE_NAME, 'selectedVariety', v || '');
export const getSelectedVarietyByStatePreference = (s: BeanState) =>
  getStringState(MODULE_NAME, `selectedVariety_${s}`, '') || null;
export const saveSelectedVarietyByStatePreference = (
  s: BeanState,
  v: string | null
) => saveStringState(MODULE_NAME, `selectedVariety_${s}`, v || '');

// 豆子类型
export const getSelectedBeanTypePreference = () =>
  getStringState(MODULE_NAME, 'selectedBeanType', 'all') as BeanType;
export const saveSelectedBeanTypePreference = (v: BeanType) =>
  saveStringState(MODULE_NAME, 'selectedBeanType', v);
export const getSelectedBeanTypeByStatePreference = (s: BeanState) =>
  getStringState(MODULE_NAME, `selectedBeanType_${s}`, 'all') as BeanType;
export const saveSelectedBeanTypeByStatePreference = (
  s: BeanState,
  v: BeanType
) => saveStringState(MODULE_NAME, `selectedBeanType_${s}`, v);

// 豆子状态（生豆/熟豆）
export const getSelectedBeanStatePreference = () =>
  getStringState(MODULE_NAME, 'selectedBeanState', 'roasted') as BeanState;
export const saveSelectedBeanStatePreference = (v: BeanState) =>
  saveStringState(MODULE_NAME, 'selectedBeanState', v);

export const isGreenBeanInventoryEnabled = (): boolean => {
  try {
    if (typeof window !== 'undefined') {
      const settingsStr = localStorage.getItem('brewGuideSettings');
      if (settingsStr) {
        return JSON.parse(settingsStr).enableGreenBeanInventory === true;
      }
    }
  } catch {}
  return false;
};

export const getValidBeanState = (): BeanState => {
  const saved = getSelectedBeanStatePreference();
  return saved === 'green' && !isGreenBeanInventoryEnabled()
    ? 'roasted'
    : saved;
};

// 视图模式
export const getViewModePreference = () =>
  getStringState(MODULE_NAME, 'viewMode', 'inventory') as ViewOption;
export const saveViewModePreference = (v: ViewOption) =>
  saveStringState(MODULE_NAME, 'viewMode', v);

// 排序选项
export const getSortOptionPreference = () =>
  migrateSortOption(
    getStringState(MODULE_NAME, 'sortOption', 'remaining_days_asc')
  );
export const saveSortOptionPreference = (v: SortOption) =>
  saveStringState(MODULE_NAME, 'sortOption', v);
export const getInventorySortOptionPreference = () =>
  migrateSortOption(
    getStringState(MODULE_NAME, 'inventorySortOption', 'remaining_days_asc'),
    'inventory'
  );
export const saveInventorySortOptionPreference = (v: SortOption) =>
  saveStringState(MODULE_NAME, 'inventorySortOption', v);
export const getInventorySortOptionByStatePreference = (s: BeanState) => {
  const def = s === 'green' ? 'last_modified_desc' : 'remaining_days_asc';
  const v = getStringState(MODULE_NAME, `inventorySortOption_${s}`, def);
  if (s === 'green' && v.includes('remaining_days'))
    return 'last_modified_desc';
  return migrateSortOption(v, 'inventory');
};
export const saveInventorySortOptionByStatePreference = (
  s: BeanState,
  v: SortOption
) => saveStringState(MODULE_NAME, `inventorySortOption_${s}`, v);
export const getRankingSortOptionPreference = () =>
  migrateSortOption(
    getStringState(MODULE_NAME, 'rankingSortOption', 'rating_desc'),
    'ranking'
  );
export const saveRankingSortOptionPreference = (v: SortOption) =>
  saveStringState(MODULE_NAME, 'rankingSortOption', v);
export const getRankingBeanTypePreference = () =>
  getStringState(MODULE_NAME, 'rankingBeanType', 'all') as BeanType;
export const saveRankingBeanTypePreference = (v: BeanType) =>
  saveStringState(MODULE_NAME, 'rankingBeanType', v);

// 筛选模式
export const getFilterModePreference = () =>
  getStringState(MODULE_NAME, 'filterMode', 'variety') as BeanFilterMode;
export const saveFilterModePreference = (v: BeanFilterMode) =>
  saveStringState(MODULE_NAME, 'filterMode', v);
export const getFilterModeByStatePreference = (s: BeanState) => {
  const v = getStringState(MODULE_NAME, `filterMode_${s}`, 'variety');
  return s === 'green' && v === 'flavorPeriod'
    ? 'variety'
    : (v as BeanFilterMode);
};
export const saveFilterModeByStatePreference = (
  s: BeanState,
  v: BeanFilterMode
) => saveStringState(MODULE_NAME, `filterMode_${s}`, v);

// 产地筛选
export const getSelectedOriginPreference = () =>
  getStringState(MODULE_NAME, 'selectedOrigin', '') || null;
export const saveSelectedOriginPreference = (v: string | null) =>
  saveStringState(MODULE_NAME, 'selectedOrigin', v || '');
export const getSelectedOriginByStatePreference = (s: BeanState) =>
  getStringState(MODULE_NAME, `selectedOrigin_${s}`, '') || null;
export const saveSelectedOriginByStatePreference = (
  s: BeanState,
  v: string | null
) => saveStringState(MODULE_NAME, `selectedOrigin_${s}`, v || '');

// 赏味期筛选
export const getSelectedFlavorPeriodPreference = () =>
  (getStringState(MODULE_NAME, 'selectedFlavorPeriod', '') ||
    null) as FlavorPeriodStatus | null;
export const saveSelectedFlavorPeriodPreference = (
  v: FlavorPeriodStatus | null
) => saveStringState(MODULE_NAME, 'selectedFlavorPeriod', v || '');
export const getSelectedFlavorPeriodByStatePreference = (s: BeanState) =>
  (getStringState(MODULE_NAME, `selectedFlavorPeriod_${s}`, '') ||
    null) as FlavorPeriodStatus | null;
export const saveSelectedFlavorPeriodByStatePreference = (
  s: BeanState,
  v: FlavorPeriodStatus | null
) => saveStringState(MODULE_NAME, `selectedFlavorPeriod_${s}`, v || '');

// 烘焙商筛选
export const getSelectedRoasterPreference = () =>
  getStringState(MODULE_NAME, 'selectedRoaster', '') || null;
export const saveSelectedRoasterPreference = (v: string | null) =>
  saveStringState(MODULE_NAME, 'selectedRoaster', v || '');
export const getSelectedRoasterByStatePreference = (s: BeanState) =>
  getStringState(MODULE_NAME, `selectedRoaster_${s}`, '') || null;
export const saveSelectedRoasterByStatePreference = (
  s: BeanState,
  v: string | null
) => saveStringState(MODULE_NAME, `selectedRoaster_${s}`, v || '');

// 图片流模式
export const getImageFlowModePreference = () =>
  getBooleanState(MODULE_NAME, 'isImageFlowMode', false);
export const saveImageFlowModePreference = (v: boolean) =>
  saveBooleanState(MODULE_NAME, 'isImageFlowMode', v);
export const getImageFlowModeByStatePreference = (s: BeanState) =>
  getBooleanState(MODULE_NAME, `isImageFlowMode_${s}`, false);
export const saveImageFlowModeByStatePreference = (s: BeanState, v: boolean) =>
  saveBooleanState(MODULE_NAME, `isImageFlowMode_${s}`, v);

// 统计视图
export const getDateGroupingModePreference = () =>
  getStringState(MODULE_NAME, 'dateGroupingMode', 'month') as DateGroupingMode;
export const saveDateGroupingModePreference = (v: DateGroupingMode) =>
  saveStringState(MODULE_NAME, 'dateGroupingMode', v);
export const getSelectedDatePreference = () =>
  getStringState(MODULE_NAME, 'selectedDate', '') || null;
export const saveSelectedDatePreference = (v: string | null) =>
  saveStringState(MODULE_NAME, 'selectedDate', v || '');
export const getSelectedDateByModePreference = (m: DateGroupingMode) =>
  getStringState(MODULE_NAME, `selectedDate_${m}`, '') || null;
export const saveSelectedDateByModePreference = (
  m: DateGroupingMode,
  v: string | null
) => saveStringState(MODULE_NAME, `selectedDate_${m}`, v || '');
export type StatsBeanStateType = 'roasted' | 'green';
export const getStatsBeanStatePreference = () =>
  getStringState(
    MODULE_NAME,
    'statsBeanState',
    'roasted'
  ) as StatsBeanStateType;
export const saveStatsBeanStatePreference = (v: StatsBeanStateType) =>
  saveStringState(MODULE_NAME, 'statsBeanState', v);

// 搜索历史
export const getSearchHistoryPreference = (): string[] => {
  const history = getObjectState<string[]>(MODULE_NAME, 'searchHistory', []);
  return Array.isArray(history) ? history : [];
};
export const saveSearchHistoryPreference = (history: string[]) =>
  saveObjectState(MODULE_NAME, 'searchHistory', history);
export const addSearchHistory = (query: string) => {
  if (!query.trim()) return;
  const history = getSearchHistoryPreference().filter(
    item => item !== query.trim()
  );
  saveSearchHistoryPreference(
    [query.trim(), ...history].slice(0, MAX_SEARCH_HISTORY)
  );
};

// 检查豆子是否用完
export const isBeanEmpty = (bean: ExtendedCoffeeBean): boolean => {
  if (bean.capacity == null || bean.remaining == null) return false;
  const remaining =
    typeof bean.remaining === 'number'
      ? bean.remaining
      : parseFloat(bean.remaining.toString().replace(/[^\d.-]/g, ''));
  return !isNaN(remaining) && remaining < 0.001;
};

// 初始化
const initGlobalCache = () => {
  globalCache.showEmptyBeans = getShowEmptyBeansPreference();
  globalCache.showEmptyBeansSettings = {
    green: getShowEmptyBeansByStatePreference('green'),
    roasted: getShowEmptyBeansByStatePreference('roasted'),
  };
  globalCache.selectedVariety = getSelectedVarietyPreference();
  globalCache.selectedBeanType = getSelectedBeanTypePreference();
  globalCache.selectedBeanTypes = {
    green: getSelectedBeanTypeByStatePreference('green'),
    roasted: getSelectedBeanTypeByStatePreference('roasted'),
  };
  globalCache.isImageFlowMode = getImageFlowModePreference();
  globalCache.isImageFlowModes = {
    green: getImageFlowModeByStatePreference('green'),
    roasted: getImageFlowModeByStatePreference('roasted'),
  };
  globalCache.viewMode = getViewModePreference();
  globalCache.sortOption = getSortOptionPreference();
  globalCache.inventorySortOption = getInventorySortOptionPreference();
  globalCache.inventorySortOptions = {
    green: getInventorySortOptionByStatePreference('green'),
    roasted: getInventorySortOptionByStatePreference('roasted'),
  };
  globalCache.rankingSortOption = getRankingSortOptionPreference();
  globalCache.rankingBeanType = getRankingBeanTypePreference();
  globalCache.filterMode = getFilterModePreference();
  globalCache.filterModes = {
    green: getFilterModeByStatePreference('green'),
    roasted: getFilterModeByStatePreference('roasted'),
  };
  globalCache.selectedOrigin = getSelectedOriginPreference();
  globalCache.selectedFlavorPeriod = getSelectedFlavorPeriodPreference();
  globalCache.selectedRoaster = getSelectedRoasterPreference();
  globalCache.selectedVarieties = {
    green: getSelectedVarietyByStatePreference('green'),
    roasted: getSelectedVarietyByStatePreference('roasted'),
  };
  globalCache.selectedOrigins = {
    green: getSelectedOriginByStatePreference('green'),
    roasted: getSelectedOriginByStatePreference('roasted'),
  };
  globalCache.selectedFlavorPeriods = {
    green: getSelectedFlavorPeriodByStatePreference('green'),
    roasted: getSelectedFlavorPeriodByStatePreference('roasted'),
  };
  globalCache.selectedRoasters = {
    green: getSelectedRoasterByStatePreference('green'),
    roasted: getSelectedRoasterByStatePreference('roasted'),
  };
  globalCache.dateGroupingMode = getDateGroupingModePreference();
  globalCache.selectedDate = getSelectedDatePreference();
  globalCache.selectedDates = {
    year: getSelectedDateByModePreference('year'),
    month: getSelectedDateByModePreference('month'),
    day: getSelectedDateByModePreference('day'),
  };
};

initGlobalCache();
