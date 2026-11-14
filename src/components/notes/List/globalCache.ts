import { BrewingNote } from '@/lib/core/config';
import { SortOption, SORT_OPTIONS, DateGroupingMode } from '../types';
import {
  getStringState,
  saveStringState,
  getObjectState,
  saveObjectState,
} from '@/lib/core/statePersistence';
import {
  calculateTotalCoffeeConsumption as calculateConsumption,
  formatConsumption as formatConsumptionUtil,
} from '../utils';
import { DATE_GROUPING_MODES } from '@/lib/utils/dateUtils';

// 模块名称
const MODULE_NAME = 'brewing-notes';

// 创建全局缓存对象，确保跨组件实例保持数据
export const globalCache: {
  notes: BrewingNote[];
  filteredNotes: BrewingNote[];
  equipmentNames: Record<string, string>;
  beanPrices: Record<string, number>;
  selectedEquipment: string | null;
  selectedDate: string | null;
  filterMode: 'equipment' | 'date';
  dateGroupingMode: DateGroupingMode;
  sortOption: SortOption;
  availableEquipments: string[];
  availableDates: string[];
  initialized: boolean;
  totalConsumption: number;
  isLoading: boolean;
  lastUpdated: number;
} = {
  notes: [],
  filteredNotes: [],
  equipmentNames: {},
  beanPrices: {},
  selectedEquipment: null,
  selectedDate: null,
  filterMode: 'date',
  dateGroupingMode: 'day', // 默认按日分组
  sortOption: SORT_OPTIONS.TIME_DESC,
  availableEquipments: [],
  availableDates: [],
  initialized: false,
  totalConsumption: 0,
  isLoading: false,
  lastUpdated: 0, // 🔥 初始化为0
};

// 从localStorage读取选中的设备ID
export const getSelectedEquipmentPreference = (): string | null => {
  const value = getStringState(MODULE_NAME, 'selectedEquipment', '');
  return value === '' ? null : value;
};

// 保存选中的设备ID到localStorage
export const saveSelectedEquipmentPreference = (value: string | null): void => {
  saveStringState(MODULE_NAME, 'selectedEquipment', value || '');
};

// 从localStorage读取选中的日期
export const getSelectedDatePreference = (): string | null => {
  const value = getStringState(MODULE_NAME, 'selectedDate', '');
  return value === '' ? null : value;
};

// 保存选中的日期到localStorage
export const saveSelectedDatePreference = (value: string | null): void => {
  saveStringState(MODULE_NAME, 'selectedDate', value || '');
};

// 从localStorage读取过滤模式
export const getFilterModePreference = (): 'equipment' | 'date' => {
  const value = getStringState(MODULE_NAME, 'filterMode', 'date');
  // 如果是旧的 'bean' 模式，返回默认的 'date'
  if (value === 'bean') return 'date';
  return value as 'equipment' | 'date';
};

// 保存过滤模式到localStorage
export const saveFilterModePreference = (value: 'equipment' | 'date'): void => {
  saveStringState(MODULE_NAME, 'filterMode', value);
};

// 从localStorage读取排序选项
export const getSortOptionPreference = (): SortOption => {
  const value = getStringState(
    MODULE_NAME,
    'sortOption',
    SORT_OPTIONS.TIME_DESC
  );
  return value as SortOption;
};

// 保存排序选项到localStorage
export const saveSortOptionPreference = (value: SortOption): void => {
  saveStringState(MODULE_NAME, 'sortOption', value);
};

// 从localStorage读取日期分组模式
export const getDateGroupingModePreference = (): DateGroupingMode => {
  const value = getStringState(MODULE_NAME, 'dateGroupingMode', 'day');
  return DATE_GROUPING_MODES.find(mode => mode === value) ?? 'day';
};

// 保存日期分组模式到localStorage
export const saveDateGroupingModePreference = (
  value: DateGroupingMode
): void => {
  saveStringState(MODULE_NAME, 'dateGroupingMode', value);
};

// 初始化全局缓存的状态
globalCache.selectedEquipment = getSelectedEquipmentPreference();
globalCache.filterMode = getFilterModePreference();
globalCache.sortOption = getSortOptionPreference();

// 导出主utils文件的函数，保持兼容性
export const calculateTotalCoffeeConsumption = calculateConsumption;
export const formatConsumption = formatConsumptionUtil;

// ============== 搜索历史管理 ==============

// 最大搜索历史记录数
const MAX_SEARCH_HISTORY = 15;

// 从localStorage读取搜索历史
export const getSearchHistoryPreference = (): string[] => {
  return getObjectState(MODULE_NAME, 'searchHistory', []);
};

// 保存搜索历史到localStorage
export const saveSearchHistoryPreference = (history: string[]): void => {
  saveObjectState(MODULE_NAME, 'searchHistory', history);
};

// 添加搜索记录到历史
export const addSearchHistory = (query: string): void => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return;

  const history = getSearchHistoryPreference();

  // 移除重复项（如果存在）
  const filteredHistory = history.filter(item => item !== trimmedQuery);

  // 添加到开头
  const newHistory = [trimmedQuery, ...filteredHistory];

  // 限制数量
  const limitedHistory = newHistory.slice(0, MAX_SEARCH_HISTORY);

  saveSearchHistoryPreference(limitedHistory);
};
