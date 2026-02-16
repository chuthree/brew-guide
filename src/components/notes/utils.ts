'use client';

import {
  getEquipmentNameById,
  getEquipmentIdByName,
} from '@/lib/utils/equipmentUtils';
import type { BrewingNote } from '@/lib/core/config';
import { SortOption, SORT_OPTIONS } from './types';
import { db } from '@/lib/core/db';

interface NoteDeleteDisplay {
  itemName: string;
  itemSuffix?: string;
}

const NOTE_DELETE_NAME_MAX_LENGTH = 18;

const getNoteTextPreview = (text: string): string => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= NOTE_DELETE_NAME_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, NOTE_DELETE_NAME_MAX_LENGTH)}...`;
};

export const getNoteDeleteDisplay = (note: BrewingNote): NoteDeleteDisplay => {
  const beanName = note.coffeeBeanInfo?.name?.trim() || '未知咖啡豆';

  if (note.source === 'quick-decrement') {
    return {
      itemName: beanName,
      itemSuffix: '的快捷扣除记录',
    };
  }

  if (note.source === 'capacity-adjustment') {
    return {
      itemName: beanName,
      itemSuffix: '的容量调整记录',
    };
  }

  if (note.source === 'roasting') {
    return {
      itemName: beanName,
      itemSuffix: '的烘焙记录',
    };
  }

  const notePreview = getNoteTextPreview(note.notes || '');
  if (notePreview) {
    return { itemName: notePreview };
  }

  if (note.coffeeBeanInfo?.name?.trim()) {
    return { itemName: note.coffeeBeanInfo.name.trim() };
  }

  return { itemName: '此笔记' };
};

/**
 * 从用户备注中提取萃取时间
 * @param notes 用户备注内容
 * @returns 提取到的萃取时间（秒数），如果未匹配到则返回 null
 */
export const extractExtractionTime = (notes: string): number | null => {
  if (!notes || typeof notes !== 'string') {
    return null;
  }

  // 正则表达式匹配各种萃取时间格式
  const timePatterns = [
    // 匹配 "12s25g", "30s", "45 s" 等格式 - 使用限制量词避免回溯
    /(\d{1,3})(?:\s{0,3})[sS]/g,
    // 匹配 "25秒", "30 秒" 等格式 - 使用限制量词避免回溯
    /(\d{1,3})(?:\s{0,3})秒/g,
    // 匹配更复杂的描述，如 "萃取25秒", "extraction 30s" 等 - 使用限制量词避免回溯
    /(?:萃取|extraction|extract)(?:[^0-9]{0,10})(\d{1,3})(?:\s{0,3})[sS秒]/gi,
    // 匹配时间:分钟格式，如 "0:25", "00:30" (转换为秒数) - 使用限制量词避免回溯
    /(?:萃取|extraction|extract|time)(?:[^0-9:]{0,10})(\d{1,2}):(\d{1,2})/gi,
  ];

  const matches: number[] = [];

  for (const pattern of timePatterns) {
    let match;
    while ((match = pattern.exec(notes)) !== null) {
      if (match[1] && match[2]) {
        // 处理分钟:秒格式 (如 "0:25" = 25秒, "1:30" = 90秒)
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const totalSeconds = minutes * 60 + seconds;
        if (totalSeconds > 0 && totalSeconds < 600) {
          // 限制在10分钟内
          matches.push(totalSeconds);
        }
      } else if (match[1]) {
        // 处理纯秒数格式
        const time = parseInt(match[1], 10);
        // 合理的萃取时间范围：5秒到300秒（5分钟）
        if (time >= 5 && time <= 300) {
          matches.push(time);
        }
      }
    }
  }

  // 如果找到多个匹配项，返回最后一个（通常是最准确的）
  // 如果没有匹配项，返回 null
  return matches.length > 0 ? matches[matches.length - 1] : null;
};

// 日期格式化函数
export const formatDate = (timestamp: number): string => {
  const now = Date.now();
  const date = new Date(timestamp);
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  // 1分钟内：刚刚
  if (seconds < 60) {
    return '刚刚';
  }
  // 1小时内：N分钟前
  else if (minutes < 60) {
    return `${minutes}分钟前`;
  }
  // 今天：N小时前
  else if (isToday(date)) {
    return `${hours}小时前`;
  }
  // 昨天：昨天 HH:mm
  else if (isYesterday(date)) {
    return `昨天 ${formatTime(date)}`;
  }
  // 今年内：MM月DD日 HH:mm
  else if (isThisYear(date)) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${formatTime(date)}`;
  }
  // 更早：YYYY年MM月DD日 HH:mm
  else {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${formatTime(date)}`;
  }
};

// 绝对日期格式（旧版列表使用）
export const formatDateAbsolute = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// 辅助函数：判断是否是今天
const isToday = (date: Date): boolean => {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

// 辅助函数：判断是否是昨天
const isYesterday = (date: Date): boolean => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  );
};

// 辅助函数：判断是否是今年
const isThisYear = (date: Date): boolean => {
  const today = new Date();
  return date.getFullYear() === today.getFullYear();
};

// 辅助函数：格式化时间为 HH:mm
const formatTime = (date: Date): string => {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// 评分格式化函数
export const formatRating = (rating: number): string => {
  return `[ ${rating}/5 ]`;
};

// 获取设备名称的辅助函数 - 使用统一工具函数
export const getEquipmentName = async (
  equipmentId: string
): Promise<string> => {
  try {
    // 加载自定义设备列表
    const customEquipmentsModule =
      await import('@/lib/stores/customEquipmentStore');
    const customEquipments =
      await customEquipmentsModule.loadCustomEquipments();

    // 使用统一的工具函数
    return getEquipmentNameById(equipmentId, customEquipments);
  } catch (error) {
    console.error('加载自定义设备失败:', error);
    return equipmentId; // 出错时返回原始ID
  }
};

// 规范化器具ID的辅助函数 - 使用统一工具函数
export const normalizeEquipmentId = async (
  equipmentIdOrName: string
): Promise<string> => {
  try {
    // 加载自定义器具列表
    const customEquipmentsModule =
      await import('@/lib/stores/customEquipmentStore');
    const customEquipments =
      await customEquipmentsModule.loadCustomEquipments();

    // 使用统一的工具函数：如果传入的是名称，转为ID；如果是ID，直接返回
    return getEquipmentIdByName(equipmentIdOrName, customEquipments);
  } catch (error) {
    console.error('规范化器具ID失败:', error);
    return equipmentIdOrName; // 出错时返回原始值
  }
};

// 计算总咖啡消耗量的函数
export const calculateTotalCoffeeConsumption = (
  notes: BrewingNote[]
): number => {
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
      const match = note.params.coffee.match(/(\d+(?:\.\d+)?)/);
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
export const getCoffeeBeanUnitPrice = async (
  beanName: string
): Promise<number> => {
  try {
    // 直接从 DB 获取所有咖啡豆
    const beans = await db.coffeeBeans.toArray();
    // 查找匹配的咖啡豆
    const bean = beans.find(b => b.name === beanName);
    if (bean && bean.price && bean.capacity) {
      // 价格格式可能是"100元"或"100" - 使用原子组避免回溯
      const priceMatch = bean.price.match(/(\d+(?:\.\d+)?)/);
      const capacityMatch = bean.capacity.match(/(\d+(?:\.\d+)?)/);

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

  const coffeeMatch = note.params.coffee.match(/(\d+(?:\.\d+)?)/);
  if (!coffeeMatch) return 0;

  const coffeeAmount = parseFloat(coffeeMatch[0]);
  if (isNaN(coffeeAmount)) return 0;

  const unitPrice = await getCoffeeBeanUnitPrice(note.coffeeBeanInfo.name);
  return coffeeAmount * unitPrice;
};

// 计算总花费的函数
const calculateTotalCost = async (notes: BrewingNote[]): Promise<number> => {
  let totalCost = 0;

  for (const note of notes) {
    // 只排除容量调整记录，快捷扣除记录需要计入统计
    if (note.source === 'capacity-adjustment') {
      continue;
    }

    // 处理快捷扣除记录
    if (
      note.source === 'quick-decrement' &&
      note.quickDecrementAmount &&
      note.coffeeBeanInfo?.name
    ) {
      const coffeeAmount = note.quickDecrementAmount;
      if (!isNaN(coffeeAmount)) {
        const unitPrice = await getCoffeeBeanUnitPrice(
          note.coffeeBeanInfo.name
        );
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
      const amount =
        typeof note.quickDecrementAmount === 'number'
          ? note.quickDecrementAmount
          : parseFloat(String(note.quickDecrementAmount));

      if (!isNaN(amount) && amount > 0) {
        return amount;
      }
    }

    // 处理容量调整笔记 - 优先使用changeRecord中的信息，确保数据一致性
    if (
      note.source === 'capacity-adjustment' &&
      note.changeRecord?.capacityAdjustment
    ) {
      const changeAmount = note.changeRecord.capacityAdjustment.changeAmount;
      if (typeof changeAmount === 'number' && !isNaN(changeAmount)) {
        // 对于容量调整记录，返回0，因为它不消耗咖啡豆，删除时使用专门的恢复函数
        return 0;
      }
    }

    // 处理普通笔记
    if (note.params && note.params.coffee) {
      // 提取咖啡量中的数字部分（如"18g" -> 18）
      const match = note.params.coffee.match(/(\d+(?:\.\d+)?)/);
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
export const sortNotes = (
  notes: BrewingNote[],
  sortOption: SortOption
): BrewingNote[] => {
  switch (sortOption) {
    case SORT_OPTIONS.TIME_DESC:
      return [...notes].sort((a, b) => b.timestamp - a.timestamp);
    case SORT_OPTIONS.TIME_ASC:
      return [...notes].sort((a, b) => a.timestamp - b.timestamp);
    case SORT_OPTIONS.RATING_DESC:
      return [...notes].sort((a, b) => b.rating - a.rating);
    case SORT_OPTIONS.RATING_ASC:
      return [...notes].sort((a, b) => a.rating - b.rating);
    case SORT_OPTIONS.EXTRACTION_TIME_DESC:
      return [...notes].sort((a, b) => {
        const timeA = extractExtractionTime(a.notes || '');
        const timeB = extractExtractionTime(b.notes || '');

        // 有萃取时间的排在前面
        if (timeA === null && timeB === null) return 0;
        if (timeA === null) return 1;
        if (timeB === null) return -1;

        // 都有萃取时间时，按时间长短排序（降序：慢到快）
        return timeB - timeA;
      });
    case SORT_OPTIONS.EXTRACTION_TIME_ASC:
      return [...notes].sort((a, b) => {
        const timeA = extractExtractionTime(a.notes || '');
        const timeB = extractExtractionTime(b.notes || '');

        // 有萃取时间的排在前面
        if (timeA === null && timeB === null) return 0;
        if (timeA === null) return 1;
        if (timeB === null) return -1;

        // 都有萃取时间时，按时间长短排序（升序：快到慢）
        return timeA - timeB;
      });
    default:
      return notes;
  }
};

// 异步过滤器辅助函数
const asyncFilter = async <T>(
  array: T[],
  predicate: (item: T) => Promise<boolean>
): Promise<T[]> => {
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

/**
 * 获取咖啡豆类型对应的默认每杯用量
 * @param beanType 咖啡豆类型
 * @returns 默认每杯用量(g)
 */
export const getDefaultAmountPerCup = (
  beanType: 'espresso' | 'filter' | 'omni' | undefined
): number => {
  // 意式默认 18g，手冲/全能默认 15g
  return beanType === 'espresso' ? 18 : 15;
};

/**
 * 逐个咖啡豆计算预计杯数
 *
 * 算法说明：
 * 对于每个咖啡豆，判断其剩余量是否足够冲泡一杯：
 * - 每个豆子的杯数 = floor(remaining / amountPerCup)
 * - 总杯数 = 各个豆子杯数之和
 *
 * 这样可以更准确地反映实际可冲泡杯数。
 * 例如：3款豆子分别剩余 15g/15g/16g，按 15g/杯计算：
 * - 旧算法：floor(46 / 平均用量) 可能因历史记录被拉高而不准确
 * - 新算法：floor(15/15) + floor(15/15) + floor(16/15) = 1 + 1 + 1 = 3 杯
 *
 * @param beans 咖啡豆数组（需包含 remaining 和 beanType 字段）
 * @returns 预计杯数
 */
export const calculateEstimatedCupsPerBean = (
  beans: Array<{
    remaining?: string;
    beanType?: 'espresso' | 'filter' | 'omni';
  }>
): number => {
  if (!beans || beans.length === 0) {
    return 0;
  }

  let totalCups = 0;

  for (const bean of beans) {
    // 解析剩余量
    const remainingStr = bean.remaining || '0';
    const remainingMatch = remainingStr.match(/(\d+(?:\.\d+)?)/);
    const remaining = remainingMatch ? parseFloat(remainingMatch[1]) : 0;

    if (remaining <= 0) {
      continue;
    }

    // 使用豆子类型的默认值：意式 18g，手冲/全能 15g
    const amountPerCup = getDefaultAmountPerCup(bean.beanType);

    // 计算该豆子可冲泡的杯数
    const cupsFromBean = Math.floor(remaining / amountPerCup);
    totalCups += cupsFromBean;
  }

  return totalCups;
};
