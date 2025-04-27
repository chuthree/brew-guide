import { BrewingNote } from '@/lib/config';
import { SortOption, SORT_OPTIONS } from './types';
import { getStringState, saveStringState } from '@/lib/statePersistence';

// 模块名称
const MODULE_NAME = 'brewing-notes';

// 创建全局缓存对象，确保跨组件实例保持数据
export const globalCache: {
    notes: BrewingNote[];
    filteredNotes: BrewingNote[];
    equipmentNames: Record<string, string>;
    beanPrices: Record<string, number>;
    selectedEquipment: string | null;
    selectedBean: string | null;
    filterMode: 'equipment' | 'bean';
    sortOption: SortOption;
    availableEquipments: string[];
    availableBeans: string[];
    initialized: boolean;
} = {
    notes: [],
    filteredNotes: [],
    equipmentNames: {},
    beanPrices: {},
    selectedEquipment: null,
    selectedBean: null,
    filterMode: 'equipment',
    sortOption: SORT_OPTIONS.TIME_DESC,
    availableEquipments: [],
    availableBeans: [],
    initialized: false
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

// 从localStorage读取过滤模式
export const getFilterModePreference = (): 'equipment' | 'bean' => {
    const value = getStringState(MODULE_NAME, 'filterMode', 'equipment');
    return value as 'equipment' | 'bean';
};

// 保存过滤模式到localStorage
export const saveFilterModePreference = (value: 'equipment' | 'bean'): void => {
    saveStringState(MODULE_NAME, 'filterMode', value);
};

// 从localStorage读取排序选项
export const getSortOptionPreference = (): SortOption => {
    const value = getStringState(MODULE_NAME, 'sortOption', SORT_OPTIONS.TIME_DESC);
    return value as SortOption;
};

// 保存排序选项到localStorage
export const saveSortOptionPreference = (value: SortOption): void => {
    saveStringState(MODULE_NAME, 'sortOption', value);
};

// 初始化全局缓存的状态
globalCache.selectedEquipment = getSelectedEquipmentPreference();
globalCache.selectedBean = getSelectedBeanPreference();
globalCache.filterMode = getFilterModePreference();
globalCache.sortOption = getSortOptionPreference();

// 计算总咖啡消耗量
export const calculateTotalCoffeeConsumption = (notes: BrewingNote[]): number => {
    return notes.reduce((total, note) => {
        // 根据BrewingNote实际定义，获取coffee消耗量
        if (note.params?.coffee) {
            const consumption = parseFloat(note.params.coffee);
            if (!isNaN(consumption)) {
                return total + consumption;
            }
        }
        return total;
    }, 0);
};

// 格式化咖啡消耗量
export const formatConsumption = (consumption: number): string => {
    return `${consumption.toFixed(1)}g`;
}; 