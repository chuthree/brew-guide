import { useState, useEffect, useMemo } from 'react';
import type { BrewingNote } from '@/lib/core/config';
import { ExtendedCoffeeBean } from '../../types';
import {
  DateGroupingMode,
  UnifiedStatsData,
  InventoryStats,
  TypeInventoryStats,
  BeanType,
  BrewingDetailItem,
} from './types';

// ============================================================================
// 类型定义
// ============================================================================

export interface TrendDataPoint {
  label: string;
  date: string;
  value: number;
}

// 统计数据的元信息（用于解释数据来源）
export interface StatsMetadata {
  totalNotes: number; // 总记录数
  validNotes: number; // 有效记录数（排除容量调整等）
  actualDays: number; // 实际统计天数
  beansWithPrice: number; // 有价格信息的咖啡豆数量
  beansTotal: number; // 参与计算的咖啡豆总数
  todayNotes: number; // 今日记录数
  useFallbackStats: boolean; // 是否使用备选统计（基于咖啡豆容量变化）
}

interface UseStatsDataResult {
  availableDates: string[];
  stats: UnifiedStatsData;
  todayStats: { consumption: number; cost: number } | null;
  trendData: TrendDataPoint[];
  isHistoricalView: boolean;
  effectiveDateRange: { start: number; end: number } | null;
  isLoading: boolean;
  metadata: StatsMetadata; // 新增：数据来源元信息
  brewingDetails: BrewingDetailItem[]; // 冲煮明细（单日视图使用）
  todayBrewingDetails: BrewingDetailItem[]; // 今日冲煮明细（全部视图使用）
}

// ============================================================================
// 工具函数
// ============================================================================

/** 解析数字字段（处理字符串如 "100g" 或 "¥50"） */
const parseNum = (value: string | number | undefined | null): number => {
  if (value === undefined || value === null) return 0;
  const parsed = parseFloat(value.toString().replace(/[^\d.]/g, ''));
  return isNaN(parsed) ? 0 : parsed;
};

/** 解析笔记中的咖啡消耗量 */
const parseNoteConsumption = (note: BrewingNote): number => {
  if (note.source === 'capacity-adjustment') return 0;
  if (note.source === 'quick-decrement' && note.quickDecrementAmount) {
    return note.quickDecrementAmount;
  }
  if (note.params?.coffee) {
    const match = note.params.coffee.match(/(\d+(\.\d+)?)/);
    if (match) return parseFloat(match[0]);
  }
  return 0;
};

/** 根据笔记查找对应的咖啡豆（优先 beanId，降级到名称） */
const findBeanForNote = (
  note: BrewingNote,
  beans: ExtendedCoffeeBean[]
): ExtendedCoffeeBean | null => {
  if (note.beanId) {
    const bean = beans.find(b => b.id === note.beanId);
    if (bean) return bean;
  }
  if (note.coffeeBeanInfo?.name) {
    return beans.find(b => b.name === note.coffeeBeanInfo?.name) || null;
  }
  return null;
};

/** 计算笔记的花费 */
const calculateNoteCost = (
  amount: number,
  bean: ExtendedCoffeeBean | null
): number => {
  if (!bean?.price || !bean?.capacity) return 0;
  const price = parseNum(bean.price);
  const capacity = parseNum(bean.capacity);
  if (capacity <= 0) return 0;
  return (amount * price) / capacity;
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

// ============================================================================
// 时间范围计算
// ============================================================================

export interface TimeRange {
  startTime: number;
  endTime: number;
}

/** 根据日期字符串和模式计算时间范围 */
export const getTimeRange = (
  dateStr: string | null,
  mode: DateGroupingMode
): TimeRange => {
  if (!dateStr) return { startTime: 0, endTime: Infinity };

  if (mode === 'year') {
    const year = parseInt(dateStr);
    return {
      startTime: new Date(year, 0, 1).getTime(),
      endTime: new Date(year + 1, 0, 1).getTime(),
    };
  }

  if (mode === 'month') {
    const [year, month] = dateStr.split('-').map(Number);
    return {
      startTime: new Date(year, month - 1, 1).getTime(),
      endTime: new Date(year, month, 1).getTime(),
    };
  }

  // day
  const [year, month, day] = dateStr.split('-').map(Number);
  return {
    startTime: new Date(year, month - 1, day).getTime(),
    endTime: new Date(year, month - 1, day + 1).getTime(),
  };
};

// ============================================================================
// 库存计算
// ============================================================================

const BEAN_TYPE_LABELS: Record<BeanType, string> = {
  espresso: '意式豆',
  filter: '手冲豆',
  omni: '全能豆',
};

/** 计算总库存数据 */
const calculateInventory = (
  beans: ExtendedCoffeeBean[],
  dailyConsumption: number
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

    // 累加库存总量（所有咖啡豆的 capacity 总和）
    totalCapacity += capacity;

    // 累加总价值（所有咖啡豆的 price 总和）
    totalValue += price;

    if (capacity > 0) {
      remainingValue += (beanRemaining * price) / capacity;
    }
  }

  return {
    remaining,
    remainingValue,
    estimatedDays:
      dailyConsumption > 0 ? Math.ceil(remaining / dailyConsumption) : 0,
    totalCapacity,
    totalValue,
  };
};

/** 计算按类型分类的库存预测 */
const calculateInventoryByType = (
  beans: ExtendedCoffeeBean[],
  typeConsumption: Record<BeanType, number>,
  actualDays: number
): TypeInventoryStats[] => {
  const types: BeanType[] = ['espresso', 'filter', 'omni'];

  return types
    .map(type => {
      const remaining = beans
        .filter(b => b.beanType === type)
        .reduce((sum, b) => sum + parseNum(b.remaining), 0);

      const dailyConsumption =
        actualDays > 0 ? typeConsumption[type] / actualDays : 0;

      return {
        type,
        label: BEAN_TYPE_LABELS[type],
        remaining,
        dailyConsumption,
        estimatedDays:
          dailyConsumption > 0 ? Math.ceil(remaining / dailyConsumption) : 0,
      };
    })
    .filter(item => item.remaining > 0 || item.dailyConsumption > 0);
};

// ============================================================================
// 主 Hook
// ============================================================================

export const useStatsData = (
  beans: ExtendedCoffeeBean[],
  dateGroupingMode: DateGroupingMode,
  selectedDate: string | null
): UseStatsDataResult => {
  const [notes, setNotes] = useState<BrewingNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isHistoricalView = selectedDate !== null;

  // 过滤掉生豆，只统计熟豆
  const roastedBeans = useMemo(() => {
    return beans.filter(bean => (bean.beanState || 'roasted') === 'roasted');
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

    window.addEventListener(
      'customStorageChange',
      handleChange as EventListener
    );
    window.addEventListener('storage:changed', handleChange as EventListener);

    return () => {
      window.removeEventListener(
        'customStorageChange',
        handleChange as EventListener
      );
      window.removeEventListener(
        'storage:changed',
        handleChange as EventListener
      );
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Layer 2: 可用日期列表（用于筛选器）
  // ─────────────────────────────────────────────────────────────────────────
  const availableDates = useMemo(() => {
    const dates = new Set<string>();

    for (const note of notes) {
      if (!note.timestamp || note.source === 'capacity-adjustment') continue;
      const { key } = getDateKey(
        note.timestamp,
        dateGroupingMode === 'year' ? 'month' : 'day'
      );

      if (dateGroupingMode === 'year') {
        dates.add(key.substring(0, 4)); // 只取年份
      } else if (dateGroupingMode === 'month') {
        dates.add(key.substring(0, 7)); // 年-月
      } else {
        dates.add(key); // 完整日期
      }
    }

    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [notes, dateGroupingMode]);

  // ─────────────────────────────────────────────────────────────────────────
  // Layer 3: 核心计算（一次遍历）
  // ─────────────────────────────────────────────────────────────────────────
  const computedData = useMemo(() => {
    const { startTime, endTime } = getTimeRange(selectedDate, dateGroupingMode);
    const now = Date.now();

    // ═══════════════════════════════════════════════════════════════════════
    // 总消耗计算策略：
    // - 全部视图：基于 "总量 - 剩余量" 计算（不受笔记记录影响）
    // - 历史视图：基于时间范围内的笔记累加（因为无历史剩余量数据）
    // ═══════════════════════════════════════════════════════════════════════
    let beanBasedConsumption = 0;
    let beanBasedCost = 0;
    let earliestBeanTime = Infinity;
    let earliestNoteTime = Infinity;
    const beanBasedTypeConsumption: Record<BeanType, number> = {
      espresso: 0,
      filter: 0,
      omni: 0,
    };

    // 仅在全部视图时，计算基于容量变化的消耗
    if (!selectedDate) {
      // 遍历所有熟豆，计算总消耗（容量 - 剩余量）和最早创建时间
      for (const bean of roastedBeans) {
        const capacity = parseNum(bean.capacity);
        const remaining = parseNum(bean.remaining);
        const consumed = capacity - remaining;

        if (consumed > 0) {
          beanBasedConsumption += consumed;

          // 计算花费
          const price = parseNum(bean.price);
          if (capacity > 0 && price > 0) {
            beanBasedCost += (consumed * price) / capacity;
          }

          // 按类型统计
          const beanType = bean.beanType;
          if (beanType && beanType in beanBasedTypeConsumption) {
            beanBasedTypeConsumption[beanType] += consumed;
          }
        }

        // 找到最早的咖啡豆创建时间
        if (bean.timestamp && bean.timestamp < earliestBeanTime) {
          earliestBeanTime = bean.timestamp;
        }
      }

      // 遍历所有笔记，找到最早的有效笔记时间（用于确定数据周期起始时间）
      for (const note of notes) {
        if (
          note.timestamp &&
          note.source !== 'capacity-adjustment' &&
          note.source !== 'roasting' &&
          note.timestamp < earliestNoteTime
        ) {
          earliestNoteTime = note.timestamp;
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 冲煮笔记用于：
    // - 全部视图：今日统计、冲煮明细
    // - 历史视图：总消耗、趋势图、冲煮明细
    // ═══════════════════════════════════════════════════════════════════════
    let noteBasedConsumption = 0;
    let noteBasedCost = 0;
    let todayConsumption = 0;
    let todayCost = 0;
    let firstNoteTime = Infinity;
    let lastNoteTime = 0;
    let validNotesCount = 0; // 有效记录数
    let todayNotesCount = 0; // 今日记录数
    const beansUsed = new Set<string>(); // 参与计算的咖啡豆
    const noteBasedTypeConsumption: Record<BeanType, number> = {
      espresso: 0,
      filter: 0,
      omni: 0,
    };

    // 冲煮明细（仅单日视图需要）
    const isSingleDayView = dateGroupingMode === 'day' && selectedDate !== null;
    const brewingDetails: BrewingDetailItem[] = [];

    // 今日冲煮明细（全部视图需要）
    const todayBrewingDetails: BrewingDetailItem[] = [];

    // 趋势数据（仅年/月视图）
    const needTrend = selectedDate !== null && dateGroupingMode !== 'day';
    const trendMap = new Map<string, number>();
    const groupBy = dateGroupingMode === 'year' ? 'month' : 'day';

    // 遍历笔记
    for (const note of notes) {
      // 跳过容量调整记录和烘焙记录（烘焙记录属于生豆统计）
      if (
        !note.timestamp ||
        note.source === 'capacity-adjustment' ||
        note.source === 'roasting'
      )
        continue;

      const ts = note.timestamp;

      // 范围内的笔记（历史视图用于计算总消耗，全部视图用于明细）
      if (ts >= startTime && ts < endTime) {
        const amount = parseNoteConsumption(note);
        if (amount <= 0) continue;

        const bean = findBeanForNote(note, roastedBeans);
        const cost = calculateNoteCost(amount, bean);

        validNotesCount++;

        // 历史视图：累加消耗和花费
        if (selectedDate) {
          noteBasedConsumption += amount;
          noteBasedCost += cost;
        }

        // 按类型统计：用于库存预测的日均消耗计算（基于实际冲煮记录）
        const beanType = bean?.beanType;
        if (beanType && beanType in noteBasedTypeConsumption) {
          noteBasedTypeConsumption[beanType] += amount;
        }

        // 记录参与计算的咖啡豆
        if (bean) {
          beansUsed.add(bean.id);
        }

        // 收集冲煮明细（单日视图）
        if (isSingleDayView) {
          brewingDetails.push({
            id: note.id,
            timestamp: ts,
            beanName: bean?.name || note.coffeeBeanInfo?.name || '未知咖啡豆',
            amount,
            cost,
          });
        }

        // 记录时间边界
        if (ts < firstNoteTime) firstNoteTime = ts;
        if (ts > lastNoteTime) lastNoteTime = ts;

        // 趋势数据
        if (needTrend) {
          const { key } = getDateKey(ts, groupBy);
          trendMap.set(key, (trendMap.get(key) || 0) + amount);
        }
      }

      // 今日统计（仅全部视图）
      if (!isHistoricalView && isToday(ts)) {
        const amount = parseNoteConsumption(note);
        if (amount > 0) {
          const bean = findBeanForNote(note, roastedBeans);
          const cost = calculateNoteCost(amount, bean);
          todayConsumption += amount;
          todayCost += cost;
          todayNotesCount++;

          // 收集今日冲煮明细
          todayBrewingDetails.push({
            id: note.id,
            timestamp: ts,
            beanName: bean?.name || note.coffeeBeanInfo?.name || '未知咖啡豆',
            amount,
            cost,
          });
        }
      }
    }

    // 计算有价格信息的咖啡豆数量（统计熟豆，而非所有咖啡豆）
    const beansWithPrice = roastedBeans.filter(
      b => b.price && parseNum(b.price) > 0
    ).length;

    // ─────────────────────────────────────────────────────────────────────────
    // 决定使用哪种统计方式
    // ─────────────────────────────────────────────────────────────────────────
    let totalConsumption: number;
    let totalCost: number;
    let typeConsumption: Record<BeanType, number>;
    let effectiveDateRange: { start: number; end: number } | null = null;
    let actualDays = 1;

    if (selectedDate) {
      // 历史视图：使用笔记统计
      totalConsumption = noteBasedConsumption;
      totalCost = noteBasedCost;
      typeConsumption = noteBasedTypeConsumption;

      // 计算日期范围（基于笔记时间）
      if (firstNoteTime !== Infinity) {
        const rangeEnd = endTime - 1; // endTime 是开区间
        effectiveDateRange = {
          start: Math.max(startTime, firstNoteTime),
          end: Math.min(rangeEnd, now),
        };
        actualDays = calculateDaysBetween(
          effectiveDateRange.start,
          effectiveDateRange.end
        );
      }
    } else {
      // 全部视图：总消耗用容量变化（准确），类型消耗用笔记（反映真实习惯）
      totalConsumption = beanBasedConsumption;
      totalCost = beanBasedCost;
      typeConsumption = noteBasedTypeConsumption;

      // 计算日期范围（同时考虑咖啡豆创建时间和笔记时间，取较早的时间）
      const earliestTime = Math.min(earliestBeanTime, earliestNoteTime);
      if (earliestTime !== Infinity) {
        effectiveDateRange = { start: earliestTime, end: now };
        actualDays = calculateDaysBetween(earliestTime, now);
      }
    }

    // 生成趋势数据数组
    let trendData: TrendDataPoint[] = [];
    if (needTrend && selectedDate) {
      // 生成完整的日期序列
      const { startTime: tStart, endTime: tEnd } = getTimeRange(
        selectedDate,
        dateGroupingMode
      );
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

    // 按时间倒序排列冲煮明细
    brewingDetails.sort((a, b) => b.timestamp - a.timestamp);
    todayBrewingDetails.sort((a, b) => b.timestamp - a.timestamp);

    return {
      totalConsumption,
      totalCost,
      todayConsumption,
      todayCost,
      typeConsumption,
      actualDays,
      effectiveDateRange,
      trendData,
      brewingDetails,
      todayBrewingDetails,
      // 元数据
      validNotesCount,
      todayNotesCount,
      beansUsedCount: beansUsed.size,
      beansWithPrice,
      totalNotesCount: notes.length,
      useBeanBasedStats: !selectedDate, // 标记是否使用基于容量的统计
    };
  }, [notes, roastedBeans, selectedDate, dateGroupingMode, isHistoricalView]);

  // ─────────────────────────────────────────────────────────────────────────
  // Layer 4: 组装最终数据
  // ─────────────────────────────────────────────────────────────────────────
  const stats = useMemo((): UnifiedStatsData => {
    const { totalConsumption, totalCost, actualDays, typeConsumption } =
      computedData;

    const dailyConsumption = actualDays > 0 ? totalConsumption / actualDays : 0;
    const dailyCost = actualDays > 0 ? totalCost / actualDays : 0;

    // 库存数据（仅全部视图）- 只统计熟豆
    const inventory = isHistoricalView
      ? null
      : calculateInventory(roastedBeans, dailyConsumption);

    const inventoryByType = isHistoricalView
      ? null
      : calculateInventoryByType(roastedBeans, typeConsumption, actualDays);

    return {
      overview: {
        consumption: totalConsumption,
        cost: totalCost,
        dailyConsumption,
        dailyCost,
      },
      byType: {
        espresso: {
          consumption: typeConsumption.espresso,
          cost: 0,
          percentage: 0,
        },
        filter: { consumption: typeConsumption.filter, cost: 0, percentage: 0 },
        omni: { consumption: typeConsumption.omni, cost: 0, percentage: 0 },
      },
      inventory,
      inventoryByType,
    };
  }, [computedData, roastedBeans, isHistoricalView]);

  const todayStats = useMemo(() => {
    if (isHistoricalView) return null;
    const { todayConsumption, todayCost } = computedData;
    if (todayConsumption <= 0) return null;
    return { consumption: todayConsumption, cost: todayCost };
  }, [computedData, isHistoricalView]);

  // 组装元数据
  const metadata = useMemo((): StatsMetadata => {
    return {
      totalNotes: computedData.totalNotesCount,
      validNotes: computedData.validNotesCount,
      actualDays: computedData.actualDays,
      beansWithPrice: computedData.beansWithPrice,
      beansTotal: roastedBeans.length, // 使用熟豆的总数
      todayNotes: computedData.todayNotesCount,
      useFallbackStats: computedData.useBeanBasedStats, // 全部视图使用容量变化统计
    };
  }, [computedData, roastedBeans.length]);

  return {
    availableDates,
    stats,
    todayStats,
    trendData: computedData.trendData,
    isHistoricalView,
    effectiveDateRange: computedData.effectiveDateRange,
    isLoading,
    metadata,
    brewingDetails: computedData.brewingDetails,
    todayBrewingDetails: computedData.todayBrewingDetails,
  };
};
