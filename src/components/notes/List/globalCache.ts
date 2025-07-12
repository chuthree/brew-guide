import { BrewingNote } from '@/lib/core/config';
import { SortOption, SORT_OPTIONS } from '../types';
import { getStringState, saveStringState } from '@/lib/core/statePersistence';
import { calculateTotalCoffeeConsumption as calculateConsumption, formatConsumption as formatConsumptionUtil } from '../utils';

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
    totalConsumption: number;
    isLoading: boolean;
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
    initialized: false,
    totalConsumption: 0,
    isLoading: false
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

// 初始化全局缓存数据
export const initializeGlobalCache = async (): Promise<void> => {
    if (globalCache.initialized || globalCache.isLoading) return;
    
    try {
        globalCache.isLoading = true;
        
        // 初始化首选项
        globalCache.selectedEquipment = getSelectedEquipmentPreference();
        globalCache.selectedBean = getSelectedBeanPreference();
        globalCache.filterMode = getFilterModePreference();
        globalCache.sortOption = getSortOptionPreference();
        
        // 从存储加载数据
        const { Storage } = await import('@/lib/core/storage');
        const savedNotes = await Storage.get('brewingNotes');
        const parsedNotes: BrewingNote[] = savedNotes ? JSON.parse(savedNotes) : [];
        globalCache.notes = parsedNotes;
        
        // 计算总消耗量
        const totalConsumption = calculateConsumption(parsedNotes);
        globalCache.totalConsumption = totalConsumption;
        
        // 并行加载设备数据和收集ID
        const [namesMap, equipmentIds, beanNames] = await Promise.all([
            // 获取设备名称映射
            (async () => {
                const map: Record<string, string> = {};
                const { equipmentList } = await import('@/lib/core/config');
                const { loadCustomEquipments } = await import('@/lib/managers/customEquipments');
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
                return Array.from(new Set(
                    parsedNotes
                        .map(note => note.equipment)
                        .filter(Boolean) as string[]
                ));
            })(),
            
            // 收集咖啡豆名称
            (async () => {
                return Array.from(new Set(
                    parsedNotes
                        .map(note => note.coffeeBeanInfo?.name)
                        .filter(Boolean) as string[]
                ));
            })()
        ]);
        
        // 更新全局缓存
        globalCache.equipmentNames = namesMap;
        globalCache.availableEquipments = equipmentIds;
        globalCache.availableBeans = beanNames;
        
        // 应用过滤器设置过滤后的笔记
        let filteredNotes = parsedNotes;
        if (globalCache.filterMode === 'equipment' && globalCache.selectedEquipment) {
            filteredNotes = parsedNotes.filter(note => note.equipment === globalCache.selectedEquipment);
        } else if (globalCache.filterMode === 'bean' && globalCache.selectedBean) {
            filteredNotes = parsedNotes.filter(note => 
                note.coffeeBeanInfo?.name === globalCache.selectedBean
            );
        }
        globalCache.filteredNotes = filteredNotes;
        
        globalCache.initialized = true;
    } catch (error) {
        console.error("初始化全局缓存失败:", error);
    } finally {
        globalCache.isLoading = false;
    }
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

// 监听全局缓存重置事件
if (typeof window !== 'undefined') {
    window.addEventListener('globalCacheReset', () => {
        // 重置所有缓存数据到初始状态
        globalCache.notes = [];
        globalCache.filteredNotes = [];
        globalCache.equipmentNames = {};
        globalCache.beanPrices = {};
        globalCache.selectedEquipment = null;
        globalCache.selectedBean = null;
        globalCache.filterMode = 'equipment';
        globalCache.sortOption = SORT_OPTIONS.TIME_DESC;
        globalCache.availableEquipments = [];
        globalCache.availableBeans = [];
        globalCache.initialized = false;
        globalCache.totalConsumption = 0;
        globalCache.isLoading = false;

        console.warn('笔记全局缓存已重置');
    });
}

// 导出主utils文件的函数，保持兼容性
export const calculateTotalCoffeeConsumption = calculateConsumption;
export const formatConsumption = formatConsumptionUtil;