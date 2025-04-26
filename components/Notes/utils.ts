'use client'

import { equipmentList } from '@/lib/config'
import { getEquipmentName as getEquipmentNameUtil } from '@/lib/brewing/parameters'
import type { BrewingNote } from '@/lib/config'
import { SortOption, SORT_OPTIONS } from './types'
import { CoffeeBeanManager } from '@/lib/coffeeBeanManager'

// 日期格式化函数
export const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
    })
}

// 评分格式化函数
export const formatRating = (rating: number): string => {
    return `[ ${rating}/5 ]`
}

// 获取设备名称的辅助函数 - 简化实现
export const getEquipmentName = async (equipmentId: string): Promise<string> => {
    // 首先尝试在标准设备列表中查找
    const standardEquipment = equipmentList.find(e => e.id === equipmentId);
    if (standardEquipment) return standardEquipment.name;

    // 如果没找到，加载自定义设备列表并查找
    try {
        const { loadCustomEquipments } = await import('@/lib/customEquipments');
        const customEquipments = await loadCustomEquipments();

        // 先在自定义设备中按ID查找
        const customEquipment = customEquipments.find(e => e.id === equipmentId);
        if (customEquipment) return customEquipment.name;
        
        // 如果上面都没找到，尝试使用工具函数
        const equipmentName = getEquipmentNameUtil(equipmentId, equipmentList, customEquipments);
        return equipmentName || equipmentId;
    } catch (error) {
        console.error('加载自定义设备失败:', error);
        return equipmentId; // 出错时返回原始ID
    }
};

// 规范化器具ID的辅助函数 - 简化实现
export const normalizeEquipmentId = async (equipmentIdOrName: string): Promise<string> => {
    // 首先检查这是否是标准设备的ID
    const standardEquipmentById = equipmentList.find(e => e.id === equipmentIdOrName);
    if (standardEquipmentById) return standardEquipmentById.id;

    // 检查是否是标准设备的名称
    const standardEquipmentByName = equipmentList.find(e => e.name === equipmentIdOrName);
    if (standardEquipmentByName) return standardEquipmentByName.id;

    // 如果不是标准设备，返回原始值
    return equipmentIdOrName;
};

// 计算总咖啡消耗量的函数
export const calculateTotalCoffeeConsumption = (notes: BrewingNote[]): number => {
    return notes.reduce((total, note) => {
        if (note.params && note.params.coffee) {
            // 提取咖啡量中的数字部分
            const match = note.params.coffee.match(/(\d+(\.\d+)?)/);
            if (match) {
                const coffeeAmount = parseFloat(match[0]);
                if (!isNaN(coffeeAmount)) {
                    return total + coffeeAmount;
                }
            }
        }
        return total;
    }, 0);
};

// 获取咖啡豆单位价格的函数
export const getCoffeeBeanUnitPrice = async (beanName: string): Promise<number> => {
    try {
        // 获取所有咖啡豆
        const beans = await CoffeeBeanManager.getAllBeans();
        // 查找匹配的咖啡豆
        const bean = beans.find(b => b.name === beanName);
        if (bean && bean.price && bean.capacity) {
            // 价格格式可能是"100元"或"100"
            const priceMatch = bean.price.match(/(\d+(\.\d+)?)/);
            const capacityMatch = bean.capacity.match(/(\d+(\.\d+)?)/);
            
            if (priceMatch && capacityMatch) {
                const price = parseFloat(priceMatch[0]);
                const capacity = parseFloat(capacityMatch[0]);
                
                if (!isNaN(price) && !isNaN(capacity) && capacity > 0) {
                    // 返回每克价格
                    return price / capacity;
                }
            }
        }
        return 0; // 找不到匹配的咖啡豆或无法计算价格时返回0
    } catch (error) {
        console.error('获取咖啡豆单位价格出错:', error);
        return 0;
    }
};

// 计算笔记消费的函数
export const calculateNoteCost = async (note: BrewingNote): Promise<number> => {
    if (!note.params?.coffee || !note.coffeeBeanInfo?.name) return 0;
    
    const coffeeMatch = note.params.coffee.match(/(\d+(\.\d+)?)/);
    if (!coffeeMatch) return 0;
    
    const coffeeAmount = parseFloat(coffeeMatch[0]);
    if (isNaN(coffeeAmount)) return 0;
    
    const unitPrice = await getCoffeeBeanUnitPrice(note.coffeeBeanInfo.name);
    return coffeeAmount * unitPrice;
};

// 计算总花费的函数
export const calculateTotalCost = async (notes: BrewingNote[]): Promise<number> => {
    let totalCost = 0;
    
    for (const note of notes) {
        const cost = await calculateNoteCost(note);
        totalCost += cost;
    }
    
    return totalCost;
};

// 笔记排序函数
export const sortNotes = (notes: BrewingNote[], sortOption: SortOption): BrewingNote[] => {
    switch (sortOption) {
        case SORT_OPTIONS.TIME_DESC:
            return [...notes].sort((a, b) => b.timestamp - a.timestamp)
        case SORT_OPTIONS.TIME_ASC:
            return [...notes].sort((a, b) => a.timestamp - b.timestamp)
        case SORT_OPTIONS.RATING_DESC:
            return [...notes].sort((a, b) => b.rating - a.rating)
        case SORT_OPTIONS.RATING_ASC:
            return [...notes].sort((a, b) => a.rating - b.rating)
        default:
            return notes
    }
}

// 异步过滤器辅助函数
export const asyncFilter = async <T,>(array: T[], predicate: (item: T) => Promise<boolean>): Promise<T[]> => {
    const results = await Promise.all(array.map(predicate));
    return array.filter((_, index) => results[index]);
};

// 消耗量显示格式的函数
export const formatConsumption = (amount: number): string => {
    if (amount < 1000) {
        return `${Math.round(amount)}g`;
    } else {
        return `${(amount / 1000).toFixed(1)}kg`;
    }
}; 