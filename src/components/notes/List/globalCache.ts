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
import { getBrewingNotes } from '@/lib/notes/relatedNotes';
import { replaceBrewingNotesWithSplitImages } from '@/lib/notes/imageRepository';

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
    globalCache.selectedDate = getSelectedDatePreference();
    globalCache.filterMode = getFilterModePreference();
    globalCache.sortOption = getSortOptionPreference();
    globalCache.dateGroupingMode = getDateGroupingModePreference();

    // 从 IndexedDB 加载，避免把带图片的笔记整包序列化成 JSON
    const parsedNotes = await getBrewingNotes();
    globalCache.notes = parsedNotes;

    // 计算总消耗量
    const totalConsumption = calculateConsumption(parsedNotes);
    globalCache.totalConsumption = totalConsumption;

    // 并行加载设备数据和收集ID
    const [namesMap, equipmentIds, datesList] = await Promise.all([
      // 获取设备名称映射
      (async () => {
        const map: Record<string, string> = {};
        const { equipmentList } = await import('@/lib/core/config');
        const { loadCustomEquipments } =
          await import('@/lib/stores/customEquipmentStore');
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
const forceReinitializeGlobalCache = async (): Promise<void> => {
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
globalCache.filterMode = getFilterModePreference();
globalCache.sortOption = getSortOptionPreference();

// 移除复杂的全局事件监听系统

/**
 * 更新笔记缓存并触发更新事件的通用函数
 * 用于在保存笔记后统一更新缓存和触发事件
 */
const updateBrewingNotesCache = async (
  updatedNotes: BrewingNote[]
): Promise<void> => {
  try {
    const replaced = await replaceBrewingNotesWithSplitImages(updatedNotes);
    if (!replaced) return;

    // 更新全局缓存
    globalCache.notes = updatedNotes;
    globalCache.lastUpdated = Date.now();
    globalCache.totalConsumption = calculateConsumption(updatedNotes);
    globalCache.initialized = true; // 🔥 标记缓存已初始化

    // 触发立即更新事件，让笔记列表无延迟刷新
    window.dispatchEvent(new Event('brewingNotesDataChanged'));
  } catch (error) {
    console.error('更新笔记缓存失败:', error);
    throw error;
  }
};

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
const removeSearchHistoryItem = (query: string): void => {
  const history = getSearchHistoryPreference();
  const newHistory = history.filter(item => item !== query);
  saveSearchHistoryPreference(newHistory);
};
