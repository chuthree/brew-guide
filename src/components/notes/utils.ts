'use client'

import { equipmentList } from '@/lib/core/config'
import { getEquipmentName as getEquipmentNameUtil } from '@/lib/brewing/parameters'
import type { BrewingNote } from '@/lib/core/config'
import { SortOption, SORT_OPTIONS } from './types'
import { CoffeeBeanManager } from '@/lib/managers/coffeeBeanManager'

/**
 * 从用户备注中提取萃取时间
 * @param notes 用户备注内容
 * @returns 提取到的萃取时间（秒数），如果未匹配到则返回 null
 */
export const extractExtractionTime = (notes: string): number | null => {
  if (!notes || typeof notes !== 'string') {
    return null
  }

  // 正则表达式匹配各种萃取时间格式
  const timePatterns = [
    // 匹配 "12s25g", "30s", "45 s" 等格式 - 移除负前瞻以支持复合格式
    /(\d+)\s*[sS]/g,
    // 匹配 "25秒", "30 秒" 等格式
    /(\d+)\s*秒/g,
    // 匹配更复杂的描述，如 "萃取25秒", "extraction 30s" 等
    /(?:萃取|extraction|extract).*?(\d+)\s*[sS秒]/gi,
    // 匹配时间:分钟格式，如 "0:25", "00:30" (转换为秒数)
    /(?:萃取|extraction|extract|time).*?(\d+):(\d+)/gi
  ]

  const matches: number[] = []

  for (const pattern of timePatterns) {
    let match
    while ((match = pattern.exec(notes)) !== null) {
      if (match[1] && match[2]) {
        // 处理分钟:秒格式 (如 "0:25" = 25秒, "1:30" = 90秒)
        const minutes = parseInt(match[1], 10)
        const seconds = parseInt(match[2], 10)
        const totalSeconds = minutes * 60 + seconds
        if (totalSeconds > 0 && totalSeconds < 600) { // 限制在10分钟内
          matches.push(totalSeconds)
        }
      } else if (match[1]) {
        // 处理纯秒数格式
        const time = parseInt(match[1], 10)
        // 合理的萃取时间范围：5秒到300秒（5分钟）
        if (time >= 5 && time <= 300) {
          matches.push(time)
        }
      }
    }
  }

  // 如果找到多个匹配项，返回最后一个（通常是最准确的）
  // 如果没有匹配项，返回 null
  return matches.length > 0 ? matches[matches.length - 1] : null
}

// 日期格式化函数
export const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
        // 使用动态导入，但只导入一次模块
        const customEquipmentsModule = await import('@/lib/managers/customEquipments');
        const customEquipments = await customEquipmentsModule.loadCustomEquipments();

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

// 规范化器具ID的辅助函数 - 增强实现，支持自定义器具
export const normalizeEquipmentId = async (equipmentIdOrName: string): Promise<string> => {
    // 首先检查这是否是标准设备的ID
    const standardEquipmentById = equipmentList.find(e => e.id === equipmentIdOrName);
    if (standardEquipmentById) return standardEquipmentById.id;

    // 检查是否是标准设备的名称
    const standardEquipmentByName = equipmentList.find(e => e.name === equipmentIdOrName);
    if (standardEquipmentByName) return standardEquipmentByName.id;

    // 如果不是标准设备，检查自定义器具
    try {
        const customEquipmentsModule = await import('@/lib/managers/customEquipments');
        const customEquipments = await customEquipmentsModule.loadCustomEquipments();

        // 先按ID查找自定义器具
        const customEquipmentById = customEquipments.find(e => e.id === equipmentIdOrName);
        if (customEquipmentById) return customEquipmentById.id;

        // 再按名称查找自定义器具
        const customEquipmentByName = customEquipments.find(e => e.name === equipmentIdOrName);
        if (customEquipmentByName) return customEquipmentByName.id;
    } catch (error) {
        console.error('加载自定义器具失败:', error);
    }

    // 如果都没找到，返回原始值
    return equipmentIdOrName;
};

// 计算总咖啡消耗量的函数
export const calculateTotalCoffeeConsumption = (notes: BrewingNote[]): number => {
    return notes.reduce((total, note) => {
        // 只排除容量调整记录，快捷扣除记录需要计入统计
        if (note.source === 'capacity-adjustment') {
            return total;
        }

        // 处理快捷扣除记录
        if (note.source === 'quick-decrement' && note.quickDecrementAmount) {
            const coffeeAmount = note.quickDecrementAmount;
            if (!isNaN(coffeeAmount)) {
                return total + coffeeAmount;
            }
        } else if (note.params && note.params.coffee) {
            // 处理普通冲煮笔记
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
        // 只排除容量调整记录，快捷扣除记录需要计入统计
        if (note.source === 'capacity-adjustment') {
            continue;
        }

        // 处理快捷扣除记录
        if (note.source === 'quick-decrement' && note.quickDecrementAmount && note.coffeeBeanInfo?.name) {
            const coffeeAmount = note.quickDecrementAmount;
            if (!isNaN(coffeeAmount)) {
                const unitPrice = await getCoffeeBeanUnitPrice(note.coffeeBeanInfo.name);
                totalCost += coffeeAmount * unitPrice;
            }
        } else {
            // 处理普通冲煮笔记
            const cost = await calculateNoteCost(note);
            totalCost += cost;
        }
    }

    return totalCost;
};

/**
 * 从笔记中提取咖啡豆使用量或容量变化量
 * @param note 笔记对象
 * @returns 咖啡豆使用量(g)或容量变化量(g)，如果无法提取则返回0
 */
export const extractCoffeeAmountFromNote = (note: BrewingNote): number => {
    try {
        // 输入验证
        if (!note) {
            console.warn('extractCoffeeAmountFromNote: 笔记对象为空');
            return 0;
        }

        // 处理快捷扣除笔记
        if (note.source === 'quick-decrement' && note.quickDecrementAmount) {
            const amount = typeof note.quickDecrementAmount === 'number'
                ? note.quickDecrementAmount
                : parseFloat(String(note.quickDecrementAmount));

            if (!isNaN(amount) && amount > 0) {
                return amount;
            }
        }

        // 处理容量调整笔记 - 优先使用changeRecord中的信息，确保数据一致性
        if (note.source === 'capacity-adjustment' && note.changeRecord?.capacityAdjustment) {
            const changeAmount = note.changeRecord.capacityAdjustment.changeAmount;
            if (typeof changeAmount === 'number' && !isNaN(changeAmount)) {
                // 对于容量调整记录，返回0，因为它不消耗咖啡豆，删除时使用专门的恢复函数
                return 0;
            }
        }

        // 处理普通笔记
        if (note.params && note.params.coffee) {
            // 提取咖啡量中的数字部分（如"18g" -> 18）
            const match = note.params.coffee.match(/(\d+(\.\d+)?)/);
            if (match) {
                const coffeeAmount = parseFloat(match[0]);
                if (!isNaN(coffeeAmount) && coffeeAmount > 0) {
                    return coffeeAmount;
                }
            }
        }

        return 0;
    } catch (error) {
        console.error('提取笔记咖啡量失败:', error, note);
        return 0;
    }
};

/**
 * 获取笔记关联的咖啡豆ID
 * @param note 笔记对象
 * @returns 咖啡豆ID，如果没有关联则返回null
 */
export const getNoteAssociatedBeanId = (note: BrewingNote): string | null => {
    // 优先使用beanId字段
    if (note.beanId) {
        return note.beanId;
    }

    // 如果没有beanId，但有咖啡豆信息，可以尝试通过名称查找
    // 但这种情况下我们无法直接获取ID，需要调用者自行处理
    return null;
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
        case SORT_OPTIONS.EXTRACTION_TIME_DESC:
            return [...notes].sort((a, b) => {
                const timeA = extractExtractionTime(a.notes || '')
                const timeB = extractExtractionTime(b.notes || '')
                
                // 有萃取时间的排在前面
                if (timeA === null && timeB === null) return 0
                if (timeA === null) return 1
                if (timeB === null) return -1
                
                // 都有萃取时间时，按时间长短排序（降序：慢到快）
                return timeB - timeA
            })
        case SORT_OPTIONS.EXTRACTION_TIME_ASC:
            return [...notes].sort((a, b) => {
                const timeA = extractExtractionTime(a.notes || '')
                const timeB = extractExtractionTime(b.notes || '')
                
                // 有萃取时间的排在前面
                if (timeA === null && timeB === null) return 0
                if (timeA === null) return 1
                if (timeB === null) return -1
                
                // 都有萃取时间时，按时间长短排序（升序：快到慢）
                return timeA - timeB
            })
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
        return `${(amount / 1000).toFixed(2)}kg`;
    }
}; 