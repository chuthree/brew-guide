import { useState, useEffect, useMemo } from 'react';
import type { BrewingNote } from '@/lib/core/config';
import { ExtendedCoffeeBean } from '../../types';
import {
  DateGroupingMode,
  BeanType,
  InventoryStats,
  TypeInventoryStats,
} from './types';
import { getTimeRange, TrendDataPoint } from './useStatsData';

// ============================================================================
// 类型定义
// ============================================================================

// 烘焙明细记录
export interface RoastingDetailItem {
  id: string;
  timestamp: number; // 烘焙时间戳
  greenBeanName: string; // 生豆名称
  roastedAmount: number; // 烘焙量（克）
  roastedBeanName?: string; // 派生熟豆名称
}

// 生豆统计元数据
export interface GreenBeanStatsMetadata {
  totalRoastingRecords: number; // 烘焙记录总数
  validRoastingRecords: number; // 有效烘焙记录数
  actualDays: number; // 实际统计天数
  beansWithPrice: number; // 有价格信息的生豆数量
  beansTotal: number; // 生豆总数
  todayRoastingRecords: number; // 今日烘焙记录数
}

// 生豆统计数据结构
export interface GreenBeanStatsData {
  // 概览：烘焙数据
  overview: {
    totalRoasted: number; // 总烘焙量
    totalCost: number; // 总花费（基于生豆价格）
    dailyRoasted: number; // 日均烘焙量
    dailyCost: number; // 日均花费
    conversionRate: number; // 转化率（已烘焙/总购买）
  };
  // 按类型分类的烘焙统计
  byType: Record<BeanType, { roasted: number; cost: number; percentage: number }>;
  // 库存数据（仅实时视图有效）
  inventory: InventoryStats | null;
  // 按类型分类的库存预测（仅实时视图有效）
  inventoryByType: TypeInventoryStats[] | null;
}

interface UseGreenBeanStatsDataResult {
  availableDates: string[];
  stats: GreenBeanStatsData;
  todayStats: { roasted: number; cost: number } | null;
  trendData: TrendDataPoint[];
  isHistoricalView: boolean;
  effectiveDateRange: { start: number; end: number } | null;
  isLoading: boolean;
  metadata: GreenBeanStatsMetadata;
  roastingDetails: RoastingDetailItem[]; // 烘焙明细（单日视图使用）
  todayRoastingDetails: RoastingDetailItem[]; // 今日烘焙明细
}

// ============================================================================
// 工具函数
// ============================================================================

/** 解析数字字段 */
const parseNum = (value: string | number | undefined): number => {
  if (value === undefined) return 0;
  const parsed = parseFloat(value.toString().replace(/[^\d.]/g, ''));
  return isNaN(parsed) ? 0 : parsed;
};

/** 判断时间戳是否在今天 */
const isToday = (timestamp: number): boolean => {
  const now = new Date();
  const date = new Date(timestamp);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

/** 计算日历天数（包含首尾） */
const calculateDaysBetween = (startMs: number, endMs: number): number => {
  const startDay = new Date(startMs);
  startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(endMs);
  endDay.setHours(0, 0, 0, 0);
  const days =
    Math.floor((endDay.getTime() - startDay.getTime()) / 86400000) + 1;
  return Math.max(1, days);
};

/** 获取日期键（用于趋势图分组） */
const getDateKey = (
  timestamp: number,
  groupBy: 'day' | 'month'
): { key: string; label: string } => {
  const date = new Date(timestamp);
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();

  if (groupBy === 'day') {
    return {
      key: `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`,
      label: `${m}/${d}`,
    };
  }
  return {
    key: `${y}-${m.toString().padStart(2, '0')}`,
    label: `${m}月`,
  };
};

const BEAN_TYPE_LABELS: Record<BeanType, string> = {
  espresso: '意式豆',
  filter: '手冲豆',
  omni: '全能豆',
};

/** 计算生豆库存数据 */
const calculateGreenBeanInventory = (
  beans: ExtendedCoffeeBean[],
  dailyRoasted: number
): InventoryStats => {
  let remaining = 0;
  let remainingValue = 0;
  let totalCapacity = 0;
  let totalValue = 0;

  for (const bean of beans) {
    const beanRemaining = parseNum(bean.remaining);
    remaining += beanRemaining;

    const capacity = parseNum(bean.capacity);
    const price = parseNum(bean.price);

    totalCapacity += capacity;
    totalValue += price;

    if (capacity > 0) {
      remainingValue += (beanRemaining * price) / capacity;
    }
  }

  return {
    remaining,
    remainingValue,
    estimatedDays: dailyRoasted > 0 ? Math.ceil(remaining / dailyRoasted) : 0,
    totalCapacity,
    totalValue,
  };
};

/** 计算按类型分类的库存预测 */
const calculateInventoryByType = (
  beans: ExtendedCoffeeBean[],
  typeRoasted: Record<BeanType, number>,
  actualDays: number
): TypeInventoryStats[] => {
  const types: BeanType[] = ['espresso', 'filter', 'omni'];

  return types
    .map(type => {
      const remaining = beans
        .filter(b => b.beanType === type)
        .reduce((sum, b) => sum + parseNum(b.remaining), 0);

      const dailyRoasted = actualDays > 0 ? typeRoasted[type] / actualDays : 0;

      return {
        type,
        label: BEAN_TYPE_LABELS[type],
        remaining,
        dailyConsumption: dailyRoasted,
        estimatedDays: dailyRoasted > 0 ? Math.ceil(remaining / dailyRoasted) : 0,
      };
    })
    .filter(item => item.remaining > 0 || item.dailyConsumption > 0);
};

// ============================================================================
// 主 Hook
// ============================================================================

export const useGreenBeanStatsData = (
  beans: ExtendedCoffeeBean[],
  dateGroupingMode: DateGroupingMode,
  selectedDate: string | null
): UseGreenBeanStatsDataResult => {
  const [notes, setNotes] = useState<BrewingNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isHistoricalView = selectedDate !== null;

  // 过滤出生豆
  const greenBeans = useMemo(() => {
    return beans.filter(bean => bean.beanState === 'green');
  }, [beans]);

  // ─────────────────────────────────────────────────────────────────────────
  // Layer 1: 数据加载
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadNotes = async () => {
      try {
        const { Storage } = await import('@/lib/core/storage');
        const notesStr = await Storage.get('brewingNotes');
        if (notesStr) {
          const parsed = JSON.parse(notesStr);
          if (Array.isArray(parsed)) {
            setNotes(parsed);
          }
        }
      } catch (error) {
        console.error('加载笔记数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadNotes();

    // 监听存储变化
    const handleChange = (e: CustomEvent) => {
      if (e.detail?.key === 'brewingNotes') loadNotes();
    };

    window.addEventListener('customStorageChange', handleChange as EventListener);
    window.addEventListener('storage:changed', handleChange as EventListener);
    window.addEventListener('brewingNotesUpdated', loadNotes);

    return () => {
      window.removeEventListener('customStorageChange', handleChange as EventListener);
      window.removeEventListener('storage:changed', handleChange as EventListener);
      window.removeEventListener('brewingNotesUpdated', loadNotes);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Layer 2: 可用日期列表（基于烘焙记录）
  // ─────────────────────────────────────────────────────────────────────────
  const availableDates = useMemo(() => {
    const dates = new Set<string>();

    for (const note of notes) {
      // 只统计烘焙记录
      if (!note.timestamp || note.source !== 'roasting') continue;
      const { key } = getDateKey(
        note.timestamp,
        dateGroupingMode === 'year' ? 'month' : 'day'
      );

      if (dateGroupingMode === 'year') {
        dates.add(key.substring(0, 4));
      } else if (dateGroupingMode === 'month') {
        dates.add(key.substring(0, 7));
      } else {
        dates.add(key);
      }
    }

    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [notes, dateGroupingMode]);

  // ─────────────────────────────────────────────────────────────────────────
  // Layer 3: 核心计算
  // ─────────────────────────────────────────────────────────────────────────
  const computedData = useMemo(() => {
    const { startTime, endTime } = getTimeRange(selectedDate, dateGroupingMode);
    const now = Date.now();

    // 结果容器
    let totalRoasted = 0;
    let totalCost = 0;
    let todayRoasted = 0;
    let todayCost = 0;
    let firstNoteTime = Infinity;
    let lastNoteTime = 0;
    let validRecordsCount = 0;
    let todayRecordsCount = 0;

    // 烘焙明细
    const isSingleDayView = dateGroupingMode === 'day' && selectedDate !== null;
    const roastingDetails: RoastingDetailItem[] = [];
    const todayRoastingDetails: RoastingDetailItem[] = [];

    // 按类型统计烘焙量
    const typeRoasted: Record<BeanType, number> = {
      espresso: 0,
      filter: 0,
      omni: 0,
    };

    // 趋势数据
    const needTrend = selectedDate !== null && dateGroupingMode !== 'day';
    const trendMap = new Map<string, number>();
    const groupBy = dateGroupingMode === 'year' ? 'month' : 'day';

    // 遍历烘焙记录
    for (const note of notes) {
      // 只处理烘焙记录
      if (!note.timestamp || note.source !== 'roasting') continue;

      const ts = note.timestamp;
      const roastingRecord = note.changeRecord?.roastingRecord;
      if (!roastingRecord) continue;

      const roastedAmount = roastingRecord.roastedAmount || 0;
      if (roastedAmount <= 0) continue;

      // 查找对应的生豆
      const greenBean = greenBeans.find(b => b.id === roastingRecord.greenBeanId);

      // 计算花费（基于生豆单价）
      let cost = 0;
      if (greenBean?.price && greenBean?.capacity) {
        const price = parseNum(greenBean.price);
        const capacity = parseNum(greenBean.capacity);
        if (capacity > 0) {
          cost = (roastedAmount * price) / capacity;
        }
      }

      // 范围内的记录
      if (ts >= startTime && ts < endTime) {
        totalRoasted += roastedAmount;
        totalCost += cost;
        validRecordsCount++;

        // 收集烘焙明细
        if (isSingleDayView) {
          roastingDetails.push({
            id: note.id,
            timestamp: ts,
            greenBeanName: roastingRecord.greenBeanName || '未知生豆',
            roastedAmount,
            roastedBeanName: roastingRecord.roastedBeanName,
          });
        }

        // 记录时间边界
        if (ts < firstNoteTime) firstNoteTime = ts;
        if (ts > lastNoteTime) lastNoteTime = ts;

        // 按类型统计
        const beanType = greenBean?.beanType;
        if (beanType && beanType in typeRoasted) {
          typeRoasted[beanType] += roastedAmount;
        }

        // 趋势数据
        if (needTrend) {
          const { key } = getDateKey(ts, groupBy);
          trendMap.set(key, (trendMap.get(key) || 0) + roastedAmount);
        }
      }

      // 今日统计
      if (!isHistoricalView && isToday(ts)) {
        todayRoasted += roastedAmount;
        todayCost += cost;
        todayRecordsCount++;

        todayRoastingDetails.push({
          id: note.id,
          timestamp: ts,
          greenBeanName: roastingRecord.greenBeanName || '未知生豆',
          roastedAmount,
          roastedBeanName: roastingRecord.roastedBeanName,
        });
      }
    }

    // 有价格信息的生豆数量
    const beansWithPrice = greenBeans.filter(
      b => b.price && parseNum(b.price) > 0
    ).length;

    // 计算实际数据范围
    let effectiveDateRange: { start: number; end: number } | null = null;
    if (firstNoteTime !== Infinity) {
      if (selectedDate) {
        const rangeEnd = endTime - 1;
        effectiveDateRange = {
          start: Math.max(startTime, firstNoteTime),
          end: Math.min(rangeEnd, now),
        };
      } else {
        effectiveDateRange = { start: firstNoteTime, end: now };
      }
    }

    // 计算实际天数
    const actualDays = effectiveDateRange
      ? calculateDaysBetween(effectiveDateRange.start, effectiveDateRange.end)
      : 1;

    // 生成趋势数据数组
    let trendData: TrendDataPoint[] = [];
    if (needTrend && selectedDate) {
      const { startTime: tStart, endTime: tEnd } = getTimeRange(selectedDate, dateGroupingMode);
      const current = new Date(tStart);
      const endDate = new Date(tEnd - 1);

      while (current <= endDate) {
        const { key, label } = getDateKey(current.getTime(), groupBy);
        trendData.push({ date: key, label, value: trendMap.get(key) || 0 });

        if (groupBy === 'day') {
          current.setDate(current.getDate() + 1);
        } else {
          current.setMonth(current.getMonth() + 1);
        }
      }
    }

    // 按时间倒序排列明细
    roastingDetails.sort((a, b) => b.timestamp - a.timestamp);
    todayRoastingDetails.sort((a, b) => b.timestamp - a.timestamp);

    // 备选统计：当没有烘焙记录时，使用生豆容量变化估算
    let useFallbackStats = false;
    let fallbackRoasted = 0;
    let fallbackCost = 0;
    let fallbackActualDays = 1;
    let fallbackDateRange: { start: number; end: number } | null = null;
    const fallbackTypeRoasted: Record<BeanType, number> = {
      espresso: 0,
      filter: 0,
      omni: 0,
    };

    if (!selectedDate && validRecordsCount === 0 && greenBeans.length > 0) {
      useFallbackStats = true;
      let earliestBeanTime = Infinity;

      for (const bean of greenBeans) {
        const capacity = parseNum(bean.capacity);
        const remaining = parseNum(bean.remaining);
        const consumed = capacity - remaining;

        if (consumed > 0) {
          fallbackRoasted += consumed;

          const price = parseNum(bean.price);
          if (capacity > 0 && price > 0) {
            fallbackCost += (consumed * price) / capacity;
          }

          const beanType = bean.beanType;
          if (beanType && beanType in fallbackTypeRoasted) {
            fallbackTypeRoasted[beanType] += consumed;
          }
        }

        if (bean.timestamp && bean.timestamp < earliestBeanTime) {
          earliestBeanTime = bean.timestamp;
        }
      }

      if (earliestBeanTime !== Infinity && fallbackRoasted > 0) {
        fallbackDateRange = { start: earliestBeanTime, end: now };
        fallbackActualDays = calculateDaysBetween(earliestBeanTime, now);
      }
    }

    // 计算总购买量（用于转化率）
    const totalPurchased = greenBeans.reduce((sum, bean) => sum + parseNum(bean.capacity), 0);

    const finalRoasted = useFallbackStats ? fallbackRoasted : totalRoasted;
    const finalCost = useFallbackStats ? fallbackCost : totalCost;
    const finalActualDays = useFallbackStats ? fallbackActualDays : actualDays;
    const finalDateRange = useFallbackStats ? fallbackDateRange : effectiveDateRange;
    const finalTypeRoasted = useFallbackStats ? fallbackTypeRoasted : typeRoasted;

    return {
      totalRoasted: finalRoasted,
      totalCost: finalCost,
      todayRoasted,
      todayCost,
      typeRoasted: finalTypeRoasted,
      actualDays: finalActualDays,
      effectiveDateRange: finalDateRange,
      trendData,
      roastingDetails,
      todayRoastingDetails,
      totalPurchased,
      // 元数据
      validRecordsCount,
      todayRecordsCount,
      beansWithPrice,
      totalRecordsCount: notes.filter(n => n.source === 'roasting').length,
      useFallbackStats,
    };
  }, [notes, greenBeans, selectedDate, dateGroupingMode, isHistoricalView]);

  // ─────────────────────────────────────────────────────────────────────────
  // Layer 4: 组装最终数据
  // ─────────────────────────────────────────────────────────────────────────
  const stats = useMemo((): GreenBeanStatsData => {
    const { totalRoasted, totalCost, actualDays, typeRoasted, totalPurchased } = computedData;

    const dailyRoasted = actualDays > 0 ? totalRoasted / actualDays : 0;
    const dailyCost = actualDays > 0 ? totalCost / actualDays : 0;
    const conversionRate = totalPurchased > 0 ? (totalRoasted / totalPurchased) * 100 : 0;

    // 库存数据（仅全部视图）
    const inventory = isHistoricalView
      ? null
      : calculateGreenBeanInventory(greenBeans, dailyRoasted);

    const inventoryByType = isHistoricalView
      ? null
      : calculateInventoryByType(greenBeans, typeRoasted, actualDays);

    // 计算类型占比
    const totalTypeRoasted = Object.values(typeRoasted).reduce((a, b) => a + b, 0);

    return {
      overview: {
        totalRoasted,
        totalCost,
        dailyRoasted,
        dailyCost,
        conversionRate,
      },
      byType: {
        espresso: {
          roasted: typeRoasted.espresso,
          cost: 0,
          percentage: totalTypeRoasted > 0 ? (typeRoasted.espresso / totalTypeRoasted) * 100 : 0,
        },
        filter: {
          roasted: typeRoasted.filter,
          cost: 0,
          percentage: totalTypeRoasted > 0 ? (typeRoasted.filter / totalTypeRoasted) * 100 : 0,
        },
        omni: {
          roasted: typeRoasted.omni,
          cost: 0,
          percentage: totalTypeRoasted > 0 ? (typeRoasted.omni / totalTypeRoasted) * 100 : 0,
        },
      },
      inventory,
      inventoryByType,
    };
  }, [computedData, greenBeans, isHistoricalView]);

  const todayStats = useMemo(() => {
    if (isHistoricalView) return null;
    const { todayRoasted, todayCost } = computedData;
    if (todayRoasted <= 0) return null;
    return { roasted: todayRoasted, cost: todayCost };
  }, [computedData, isHistoricalView]);

  const metadata = useMemo((): GreenBeanStatsMetadata => {
    return {
      totalRoastingRecords: computedData.totalRecordsCount,
      validRoastingRecords: computedData.validRecordsCount,
      actualDays: computedData.actualDays,
      beansWithPrice: computedData.beansWithPrice,
      beansTotal: greenBeans.length,
      todayRoastingRecords: computedData.todayRecordsCount,
    };
  }, [computedData, greenBeans.length]);

  return {
    availableDates,
    stats,
    todayStats,
    trendData: computedData.trendData,
    isHistoricalView,
    effectiveDateRange: computedData.effectiveDateRange,
    isLoading,
    metadata,
    roastingDetails: computedData.roastingDetails,
    todayRoastingDetails: computedData.todayRoastingDetails,
  };
};
