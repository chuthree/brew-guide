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

// 模块名称
const MODULE_NAME = 'brewing-notes';

// 根据日期粒度格式化日期字符串
const formatDateByGrouping = (
  timestamp: number,
  groupingMode: DateGroupingMode
): string => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  switch (groupingMode) {
    case 'year':
      return `${year}`;
    case 'month':
      return `${year}-${month}`;
    case 'day':
      return `${year}-${month}-${day}`;
    default:
      return `${year}-${month}`;
  }
};

// 创建全局缓存对象，确保跨组件实例保持数据
export const globalCache: {
  notes: BrewingNote[];
  filteredNotes: BrewingNote[];
  equipmentNames: Record<string, string>;
  beanPrices: Record<string, number>;
  selectedEquipment: string | null;
  selectedBean: string | null;
  selectedDate: string | null;
  filterMode: 'equipment' | 'bean' | 'date';
  dateGroupingMode: DateGroupingMode;
  sortOption: SortOption;
  availableEquipments: string[];
  availableBeans: string[];
  availableDates: string[];
  initialized: boolean;
  totalConsumption: number;
  isLoading: boolean;
} = {
  notes: [],
  filteredNotes: [],
  equipmentNames: {},
  beanPrices: {},
  selectedEquipment: null,
  selectedBean: null,
  selectedDate: null,
  filterMode: 'equipment',
  dateGroupingMode: 'month', // 默认按月分组
  sortOption: SORT_OPTIONS.TIME_DESC,
  availableEquipments: [],
  availableBeans: [],
  availableDates: [],
  initialized: false,
  totalConsumption: 0,
  isLoading: false,
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

// 从localStorage读取选中的咖啡豆
export const getSelectedBeanPreference = (): string | null => {
  const value = getStringState(MODULE_NAME, 'selectedBean', '');
  return value === '' ? null : value;
};

// 保存选中的咖啡豆到localStorage
export const saveSelectedBeanPreference = (value: string | null): void => {
  saveStringState(MODULE_NAME, 'selectedBean', value || '');
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
export const getFilterModePreference = (): 'equipment' | 'bean' | 'date' => {
  const value = getStringState(MODULE_NAME, 'filterMode', 'equipment');
  return value as 'equipment' | 'bean' | 'date';
};

// 保存过滤模式到localStorage
export const saveFilterModePreference = (
  value: 'equipment' | 'bean' | 'date'
): void => {
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
  const value = getStringState(MODULE_NAME, 'dateGroupingMode', 'month');
  return value as DateGroupingMode;
};

// 保存日期分组模式到localStorage
export const saveDateGroupingModePreference = (
  value: DateGroupingMode
): void => {
  saveStringState(MODULE_NAME, 'dateGroupingMode', value);
};

// 初始化全局缓存数据
export const initializeGlobalCache = async (): Promise<void> => {
  if (globalCache.isLoading) return;

  try {
    globalCache.isLoading = true;

    // 初始化首选项
    globalCache.selectedEquipment = getSelectedEquipmentPreference();
    globalCache.selectedBean = getSelectedBeanPreference();
    globalCache.selectedDate = getSelectedDatePreference();
    globalCache.filterMode = getFilterModePreference();
    globalCache.sortOption = getSortOptionPreference();
    globalCache.dateGroupingMode = getDateGroupingModePreference();

    // 从存储加载数据
    const { Storage } = await import('@/lib/core/storage');
    const savedNotes = await Storage.get('brewingNotes');
    const parsedNotes: BrewingNote[] = savedNotes ? JSON.parse(savedNotes) : [];
    globalCache.notes = parsedNotes;

    // 计算总消耗量
    const totalConsumption = calculateConsumption(parsedNotes);
    globalCache.totalConsumption = totalConsumption;

    // 并行加载设备数据和收集ID
    const [namesMap, equipmentIds, beanNames, datesList] = await Promise.all([
      // 获取设备名称映射
      (async () => {
        const map: Record<string, string> = {};
        const { equipmentList } = await import('@/lib/core/config');
        const { loadCustomEquipments } = await import(
          '@/lib/managers/customEquipments'
        );
        const customEquipments = await loadCustomEquipments();

        // 处理标准设备和自定义设备
        equipmentList.forEach(equipment => {
          map[equipment.id] = equipment.name;
        });

        customEquipments.forEach(equipment => {
          map[equipment.id] = equipment.name;
        });

        return map;
      })(),

      // 收集设备ID
      (async () => {
        return Array.from(
          new Set(
            parsedNotes.map(note => note.equipment).filter(Boolean) as string[]
          )
        );
      })(),

      // 收集咖啡豆名称
      (async () => {
        return Array.from(
          new Set(
            parsedNotes
              .map(note => note.coffeeBeanInfo?.name)
              .filter(Boolean) as string[]
          )
        );
      })(),

      // 收集日期列表（按年-月）
      (async () => {
        const dateSet = new Set<string>();
        parsedNotes.forEach(note => {
          if (note.timestamp) {
            const date = new Date(note.timestamp);
            const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            dateSet.add(yearMonth);
          }
        });
        // 按日期降序排序（最新的在前）
        return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
      })(),
    ]);

    // 更新全局缓存
    globalCache.equipmentNames = namesMap;
    globalCache.availableEquipments = equipmentIds;
    globalCache.availableBeans = beanNames;
    globalCache.availableDates = datesList;

    // 应用过滤器设置过滤后的笔记
    let filteredNotes = parsedNotes;
    if (
      globalCache.filterMode === 'equipment' &&
      globalCache.selectedEquipment
    ) {
      filteredNotes = parsedNotes.filter(
        note => note.equipment === globalCache.selectedEquipment
      );
    } else if (globalCache.filterMode === 'bean' && globalCache.selectedBean) {
      filteredNotes = parsedNotes.filter(
        note => note.coffeeBeanInfo?.name === globalCache.selectedBean
      );
    } else if (globalCache.filterMode === 'date' && globalCache.selectedDate) {
      filteredNotes = parsedNotes.filter(note => {
        if (!note.timestamp) return false;
        const noteDate = formatDateByGrouping(
          note.timestamp,
          globalCache.dateGroupingMode
        );
        return noteDate === globalCache.selectedDate;
      });
    }
    globalCache.filteredNotes = filteredNotes;

    globalCache.initialized = true;
  } catch (error) {
    console.error('初始化全局缓存失败:', error);
    globalCache.initialized = false;
  } finally {
    globalCache.isLoading = false;
  }
};

// 强制重新初始化全局缓存 - 用于手动刷新
export const forceReinitializeGlobalCache = async (): Promise<void> => {
  globalCache.initialized = false;
  globalCache.isLoading = false;
  await initializeGlobalCache();
};

// 只在客户端环境下初始化全局缓存
if (typeof window !== 'undefined') {
  initializeGlobalCache();
}

// 初始化全局缓存的状态
globalCache.selectedEquipment = getSelectedEquipmentPreference();
globalCache.selectedBean = getSelectedBeanPreference();
globalCache.filterMode = getFilterModePreference();
globalCache.sortOption = getSortOptionPreference();

// 移除复杂的全局事件监听系统

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

// 从历史中移除单条记录
export const removeSearchHistoryItem = (query: string): void => {
  const history = getSearchHistoryPreference();
  const newHistory = history.filter(item => item !== query);
  saveSearchHistoryPreference(newHistory);
};
