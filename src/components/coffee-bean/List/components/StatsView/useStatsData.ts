import { useState, useEffect, useMemo } from 'react';
import type { BrewingNote } from '@/lib/core/config';
import { ExtendedCoffeeBean } from '../../types';
import {
  DateGroupingMode,
  UnifiedStatsData,
  ConsumptionStats,
  TypeConsumptionStats,
  InventoryStats,
  TypeInventoryStats,
  BeanType,
} from './types';

export interface TrendDataPoint {
  label: string;
  date: string;
  value: number;
}

interface UseStatsDataResult {
  // 可用日期列表
  availableDates: string[];
  // 统一的统计数据
  stats: UnifiedStatsData;
  // 今日统计数据
  todayStats: { consumption: number; cost: number } | null;
  // 趋势数据
  trendData: TrendDataPoint[];
  // 实际天数
  actualDays: number;
  // 是否为历史视图
  isHistoricalView: boolean;
  // 实际数据时间范围（从第一条记录到今天）
  effectiveDateRange: { start: number; end: number } | null;
  // 加载状态
  isLoading: boolean;
}

// 解析笔记中的咖啡消耗量
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

// 解析数字字段
const parseNumericField = (value: string | number | undefined): number => {
  if (value === undefined) return 0;
  const parsed = parseFloat(value.toString().replace(/[^\d.]/g, ''));
  return isNaN(parsed) ? 0 : parsed;
};

// 获取时间范围（可选截断到当前时间）
export const getTimeRange = (
  dateStr: string | null,
  mode: DateGroupingMode,
  clampToNow: boolean = false
) => {
  if (!dateStr) return { startTime: 0, endTime: Infinity };

  let startTime: number;
  let endTime: number;

  if (mode === 'year') {
    const year = parseInt(dateStr);
    startTime = new Date(year, 0, 1).getTime();
    endTime = new Date(year + 1, 0, 1).getTime();
  } else if (mode === 'month') {
    const [year, month] = dateStr.split('-').map(Number);
    startTime = new Date(year, month - 1, 1).getTime();
    endTime = new Date(year, month, 1).getTime();
  } else {
    const [year, month, day] = dateStr.split('-').map(Number);
    startTime = new Date(year, month - 1, day).getTime();
    endTime = new Date(year, month - 1, day + 1).getTime();
  }

  // 截断到当前时间（用于显示和计算日均）
  if (clampToNow) {
    const now = Date.now();
    if (endTime > now) {
      endTime = now;
    }
  }

  return { startTime, endTime };
};

// 计算指定时间范围内的消耗数据
const calculateConsumption = (
  notes: BrewingNote[],
  beans: ExtendedCoffeeBean[],
  startTime: number,
  endTime: number
): { total: ConsumptionStats; byType: TypeConsumptionStats } => {
  const result = {
    total: { consumption: 0, cost: 0 },
    byType: {
      espresso: { consumption: 0, cost: 0, percentage: 0 },
      filter: { consumption: 0, cost: 0, percentage: 0 },
      omni: { consumption: 0, cost: 0, percentage: 0 },
    } as TypeConsumptionStats,
  };

  notes
    .filter(
      note =>
        note.timestamp >= startTime &&
        note.timestamp < endTime &&
        note.source !== 'capacity-adjustment'
    )
    .forEach(note => {
      const amount = parseNoteConsumption(note);
      if (amount <= 0) return;

      result.total.consumption += amount;

      const bean = note.coffeeBeanInfo?.name
        ? beans.find(b => b.name === note.coffeeBeanInfo?.name)
        : null;

      // 计算花费
      let noteCost = 0;
      if (bean?.price && bean?.capacity) {
        const price = parseFloat(bean.price.toString().replace(/[^\d.]/g, ''));
        const capacity = parseFloat(
          bean.capacity.toString().replace(/[^\d.]/g, '')
        );
        if (!isNaN(price) && !isNaN(capacity) && capacity > 0) {
          noteCost = (amount * price) / capacity;
          result.total.cost += noteCost;
        }
      }

      // 按类型分类
      const beanType = bean?.beanType;
      if (beanType === 'espresso') {
        result.byType.espresso.consumption += amount;
        result.byType.espresso.cost += noteCost;
      } else if (beanType === 'filter') {
        result.byType.filter.consumption += amount;
        result.byType.filter.cost += noteCost;
      } else if (beanType === 'omni') {
        result.byType.omni.consumption += amount;
        result.byType.omni.cost += noteCost;
      }
    });

  // 计算占比
  const totalConsumption = result.total.consumption;
  if (totalConsumption > 0) {
    result.byType.espresso.percentage =
      (result.byType.espresso.consumption / totalConsumption) * 100;
    result.byType.filter.percentage =
      (result.byType.filter.consumption / totalConsumption) * 100;
    result.byType.omni.percentage =
      (result.byType.omni.consumption / totalConsumption) * 100;
  }

  return result;
};

// 计算库存数据
const calculateInventory = (
  beans: ExtendedCoffeeBean[],
  dailyConsumption: number
): InventoryStats => {
  const remaining = beans.reduce(
    (sum, bean) => sum + parseNumericField(bean.remaining),
    0
  );

  // 计算剩余价值
  const remainingValue = beans.reduce((sum, bean) => {
    const price = parseNumericField(bean.price);
    const capacity = parseNumericField(bean.capacity);
    const beanRemaining = parseNumericField(bean.remaining);
    if (capacity <= 0) return sum;
    return sum + (beanRemaining * price) / capacity;
  }, 0);

  // 计算预计可用天数
  const estimatedDays =
    dailyConsumption > 0 ? Math.ceil(remaining / dailyConsumption) : 0;

  return { remaining, remainingValue, estimatedDays };
};

// 豆子类型显示名称
const BEAN_TYPE_LABELS: Record<BeanType, string> = {
  espresso: '意式豆',
  filter: '手冲豆',
  omni: '全能豆',
};

// 计算按类型分类的库存预测
const calculateInventoryByType = (
  beans: ExtendedCoffeeBean[],
  byTypeConsumption: TypeConsumptionStats,
  actualDays: number
): TypeInventoryStats[] => {
  const types: BeanType[] = ['espresso', 'filter', 'omni'];

  return types
    .map(type => {
      // 该类型的所有豆子剩余量
      const remaining = beans
        .filter(bean => bean.beanType === type)
        .reduce((sum, bean) => sum + parseNumericField(bean.remaining), 0);

      // 该类型的日均消耗
      const dailyConsumption =
        actualDays > 0 ? byTypeConsumption[type].consumption / actualDays : 0;

      // 预计可用天数
      const estimatedDays =
        dailyConsumption > 0 ? Math.ceil(remaining / dailyConsumption) : 0;

      return {
        type,
        label: BEAN_TYPE_LABELS[type],
        remaining,
        dailyConsumption,
        estimatedDays,
      };
    })
    .filter(item => item.remaining > 0 || item.dailyConsumption > 0);
};

export const useStatsData = (
  beans: ExtendedCoffeeBean[],
  dateGroupingMode: DateGroupingMode,
  selectedDate: string | null
): UseStatsDataResult => {
  const [notes, setNotes] = useState<BrewingNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isHistoricalView = selectedDate !== null;

  // 1. 加载笔记数据
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

    const handleStorageChange = (e: CustomEvent) => {
      if (e.detail?.key === 'brewingNotes') {
        loadNotes();
      }
    };

    window.addEventListener(
      'customStorageChange',
      handleStorageChange as EventListener
    );
    window.addEventListener(
      'storage:changed',
      handleStorageChange as EventListener
    );

    return () => {
      window.removeEventListener(
        'customStorageChange',
        handleStorageChange as EventListener
      );
      window.removeEventListener(
        'storage:changed',
        handleStorageChange as EventListener
      );
    };
  }, []);

  // 2. 从笔记中提取可用日期列表
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    notes.forEach(note => {
      if (!note.timestamp) return;
      const date = new Date(note.timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      if (dateGroupingMode === 'year') {
        dates.add(`${year}`);
      } else if (dateGroupingMode === 'month') {
        dates.add(`${year}-${month}`);
      } else {
        dates.add(`${year}-${month}-${day}`);
      }
    });
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [notes, dateGroupingMode]);

  // 3. 计算实际数据时间范围
  // 规则：
  // - 开始：取「时间范围起点」和「范围内第一条记录」中的较晚者
  // - 结束：取「时间范围终点」和「当前时间」中的较早者
  // - 这样既能反映实际有数据的范围，又能正确处理当前进行中的时间段
  const effectiveDateRange = useMemo(() => {
    const now = Date.now();
    const validNotes = notes.filter(
      note => note.source !== 'capacity-adjustment'
    );
    if (validNotes.length === 0) return null;

    if (selectedDate) {
      const { startTime, endTime } = getTimeRange(
        selectedDate,
        dateGroupingMode
      );

      // 筛选该范围内的记录
      const rangeNotes = validNotes.filter(
        note => note.timestamp >= startTime && note.timestamp < endTime
      );
      if (rangeNotes.length === 0) return null;

      // 开始时间：范围起点 vs 第一条记录，取较晚者
      const firstRecord = Math.min(...rangeNotes.map(n => n.timestamp));
      const effectiveStart = Math.max(startTime, firstRecord);

      // 结束时间：范围终点 vs 当前时间，取较早者
      const effectiveEnd = Math.min(endTime, now);

      return { start: effectiveStart, end: effectiveEnd };
    } else {
      // 全部：从第一条记录到现在
      const firstTimestamp = Math.min(...validNotes.map(n => n.timestamp));
      return { start: firstTimestamp, end: now };
    }
  }, [notes, selectedDate, dateGroupingMode]);

  // 4. 计算实际天数（基于 effectiveDateRange，按日历天计算）
  const actualDays = useMemo(() => {
    if (!effectiveDateRange) return 1;

    // 获取开始和结束的日期（去掉时间部分）
    const startDate = new Date(effectiveDateRange.start);
    const endDate = new Date(effectiveDateRange.end);

    // 转换为当天0点的时间戳
    const startDay = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate()
    ).getTime();
    const endDay = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate()
    ).getTime();

    const dayInMs = 24 * 60 * 60 * 1000;
    // 日历天数 = 结束日期 - 开始日期 + 1（包含首尾两天）
    const days = Math.floor((endDay - startDay) / dayInMs) + 1;

    return Math.max(1, days);
  }, [effectiveDateRange]);

  // 5. 统一的统计数据
  const stats = useMemo((): UnifiedStatsData => {
    const { startTime, endTime } = getTimeRange(selectedDate, dateGroupingMode);
    const consumptionData = calculateConsumption(
      notes,
      beans,
      startTime,
      endTime
    );

    const dailyConsumption =
      actualDays > 0 ? consumptionData.total.consumption / actualDays : 0;
    const dailyCost =
      actualDays > 0 ? consumptionData.total.cost / actualDays : 0;

    // 库存数据仅在实时视图（全部）时计算
    const inventory = isHistoricalView
      ? null
      : calculateInventory(beans, dailyConsumption);

    // 按类型分类的库存预测（仅实时视图）
    const inventoryByType = isHistoricalView
      ? null
      : calculateInventoryByType(beans, consumptionData.byType, actualDays);

    return {
      overview: {
        consumption: consumptionData.total.consumption,
        cost: consumptionData.total.cost,
        dailyConsumption,
        dailyCost,
      },
      byType: consumptionData.byType,
      inventory,
      inventoryByType,
    };
  }, [
    notes,
    beans,
    selectedDate,
    dateGroupingMode,
    actualDays,
    isHistoricalView,
  ]);

  // 6. 趋势数据
  const trendData = useMemo((): TrendDataPoint[] => {
    // 日模式或无选择时不显示趋势
    if ((dateGroupingMode === 'day' && selectedDate) || !selectedDate) {
      return [];
    }

    const { startTime, endTime } = getTimeRange(selectedDate, dateGroupingMode);
    const groupBy = dateGroupingMode === 'year' ? 'month' : 'day';

    const dataMap = new Map<string, number>();
    const result: TrendDataPoint[] = [];

    const startDate = new Date(startTime);
    const endDate = new Date(endTime - 1);

    if (groupBy === 'day') {
      const current = new Date(startDate);
      while (current <= endDate) {
        const y = current.getFullYear();
        const m = current.getMonth() + 1;
        const d = current.getDate();
        const key = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        dataMap.set(key, 0);
        result.push({ date: key, label: `${m}/${d}`, value: 0 });
        current.setDate(current.getDate() + 1);
      }
    } else {
      const current = new Date(startDate);
      while (current <= endDate) {
        const y = current.getFullYear();
        const m = current.getMonth() + 1;
        const key = `${y}-${m.toString().padStart(2, '0')}`;
        if (!dataMap.has(key)) {
          dataMap.set(key, 0);
          result.push({ date: key, label: `${m}月`, value: 0 });
        }
        current.setMonth(current.getMonth() + 1);
      }
    }

    // 聚合数据
    notes
      .filter(
        note =>
          note.timestamp >= startTime &&
          note.timestamp < endTime &&
          note.source !== 'capacity-adjustment'
      )
      .forEach(note => {
        const amount = parseNoteConsumption(note);
        if (amount <= 0) return;

        const date = new Date(note.timestamp);
        let key = '';
        if (groupBy === 'day') {
          const y = date.getFullYear();
          const m = date.getMonth() + 1;
          const d = date.getDate();
          key = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        } else {
          const y = date.getFullYear();
          const m = date.getMonth() + 1;
          key = `${y}-${m.toString().padStart(2, '0')}`;
        }

        if (dataMap.has(key)) {
          dataMap.set(key, dataMap.get(key)! + amount);
        }
      });

    result.forEach(point => {
      point.value = dataMap.get(point.date) || 0;
    });

    return result;
  }, [notes, dateGroupingMode, selectedDate]);

  // 7. 今日统计（仅在非按日模式下计算）
  const todayStats = useMemo(() => {
    if (dateGroupingMode === 'day') return null;

    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;

    const todayData = calculateConsumption(notes, beans, todayStart, todayEnd);
    return {
      consumption: todayData.total.consumption,
      cost: todayData.total.cost,
    };
  }, [notes, beans, dateGroupingMode]);

  return {
    availableDates,
    stats,
    todayStats,
    trendData,
    actualDays,
    isHistoricalView,
    effectiveDateRange,
    isLoading,
  };
};
