'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  StatsViewProps,
  DateGroupingMode,
  CalculationMode,
  FunStatsData,
} from './types';
import {
  calculateStats,
  formatNumber,
  calculateFunStats,
  calculateEstimatedFinishDate,
} from './utils';
import { useConsumption } from './useConsumption';
import type { BrewingNote } from '@/lib/core/config';
import {
  globalCache,
  saveDateGroupingModePreference,
  saveCalculationModePreference,
  saveSelectedDatePreference,
} from '../../globalCache';
import StatsFilterBar, { CALCULATION_MODE_LABELS } from './StatsFilterBar';
import { useConsumptionTrend } from './useConsumptionTrend';
import ConsumptionTrendChart from './ConsumptionTrendChart';
import { ExtendedCoffeeBean } from '../../types';
import { isBeanEmpty } from '../../globalCache';

// 辅助组件：单个统计块
const StatsBlock: React.FC<{
  title: string;
  value: string | number;
  className?: string;
}> = ({ title, value, className }) => (
  <div
    className={`flex flex-col justify-between rounded bg-neutral-100 p-3 dark:bg-neutral-800 ${className}`}
  >
    <div className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
      {title}
    </div>
    <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
      {value}
    </div>
  </div>
);

// 辅助组件：列表统计块
const StatsListBlock: React.FC<{
  title: string;
  items: Array<{ label: string; value: string | number }>;
  className?: string;
}> = ({ title, items, className }) => (
  <div
    className={`flex flex-col rounded bg-neutral-100 p-3 dark:bg-neutral-800 ${className}`}
  >
    <div className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
      {title}
    </div>
    <div className="space-y-1.5">
      {items.map((item, index) => (
        <div
          key={index}
          className="flex items-center justify-between text-sm font-medium text-neutral-900 dark:text-neutral-100"
        >
          <span className="mr-2 flex-1 truncate">{item.label}</span>
          <span>{item.value}</span>
        </div>
      ))}
    </div>
  </div>
);

// 辅助函数：获取可用日期列表
const getAvailableDates = (
  beans: ExtendedCoffeeBean[],
  mode: DateGroupingMode
) => {
  const dates = new Set<string>();
  beans.forEach(bean => {
    if (!bean.timestamp) return;
    const date = new Date(bean.timestamp);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    if (mode === 'year') {
      dates.add(`${year}`);
    } else if (mode === 'month') {
      dates.add(`${year}-${month}`);
    } else {
      dates.add(`${year}-${month}-${day}`);
    }
  });

  return Array.from(dates).sort((a, b) => {
    // 降序排列
    if (mode === 'year') {
      return parseInt(b) - parseInt(a);
    } else if (mode === 'month') {
      const [yA, mA] = a.split('-').map(Number);
      const [yB, mB] = b.split('-').map(Number);
      if (yA !== yB) return yB - yA;
      return mB - mA;
    } else {
      const [yA, mA, dA] = a.split('-').map(Number);
      const [yB, mB, dB] = b.split('-').map(Number);
      if (yA !== yB) return yB - yA;
      if (mA !== mB) return mB - mA;
      return dB - dA;
    }
  });
};

interface BeanTypeCardProps {
  title: string;
  statsData: any;
  finishDate: string;
  chart?: React.ReactNode;
  customLastItem?: { label: string; value: string };
  customStats?: Array<{ title: string; value: string }>;
  moreDetails?: React.ReactNode;
}

const BeanTypeCard: React.FC<BeanTypeCardProps> = ({
  title,
  statsData,
  finishDate,
  chart,
  customLastItem,
  customStats,
  moreDetails,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);

  if (statsData.totalBeans === 0) return null;

  const handleCardClick = () => {
    if (moreDetails) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
          {title}
        </h3>
      </div>

      <div
        onClick={handleCardClick}
        className={`${moreDetails ? 'cursor-pointer transition-opacity hover:opacity-80' : ''}`}
      >
        <div className="grid grid-cols-2 gap-3">
          {/* 趋势图 */}
          {chart && (
            <div className="col-span-2 flex flex-col justify-between rounded bg-neutral-100 p-3 dark:bg-neutral-800">
              {chart}
            </div>
          )}

          {/* 使用自定义统计块或默认统计块 */}
          {customStats ? (
            customStats.map((stat, index) => (
              <StatsBlock key={index} title={stat.title} value={stat.value} />
            ))
          ) : (
            <>
              {/* 消耗 */}
              <StatsBlock
                title="消耗"
                value={
                  statsData.consumedWeight > 0
                    ? `${formatNumber(statsData.consumedWeight)}克`
                    : '-'
                }
              />

              {/* 剩余 */}
              <StatsBlock
                title="剩余"
                value={
                  statsData.remainingWeight > 0
                    ? `${formatNumber(statsData.remainingWeight)}克`
                    : '-'
                }
              />

              {/* 花费 */}
              <StatsBlock
                title="花费"
                value={
                  statsData.totalCost > 0
                    ? `${formatNumber(statsData.totalCost)}元`
                    : '-'
                }
              />

              {/* 预计用完 / 自定义项 */}
              <StatsBlock
                title={customLastItem ? customLastItem.label : '预计用完'}
                value={
                  customLastItem ? customLastItem.value : finishDate || '-'
                }
              />
            </>
          )}
        </div>

        {moreDetails && (
          <div
            ref={detailsRef}
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{
              maxHeight: isExpanded
                ? `${detailsRef.current?.scrollHeight}px`
                : '0px',
            }}
          >
            <div className="mt-3">{moreDetails}</div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatsView: React.FC<StatsViewProps> = ({ beans, showEmptyBeans }) => {
  const statsContainerRef = useRef<HTMLDivElement>(null);
  const [username, setUsername] = useState<string>('');
  const [espressoAverageConsumption, setEspressoAverageConsumption] =
    useState<number>(0);
  const [filterAverageConsumption, setFilterAverageConsumption] =
    useState<number>(0);
  const [omniAverageConsumption, setOmniAverageConsumption] =
    useState<number>(0);

  // 趣味统计数据
  const [funStats, setFunStats] = useState<FunStatsData | null>(null);

  // 筛选状态
  const [dateGroupingMode, setDateGroupingMode] = useState<DateGroupingMode>(
    globalCache.dateGroupingMode
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(
    globalCache.selectedDate
  );

  // 计算方式状态
  const [calculationMode, setCalculationMode] = useState<CalculationMode>(
    globalCache.calculationMode
  );

  // 处理分组模式变更
  const handleDateGroupingModeChange = (mode: DateGroupingMode) => {
    setDateGroupingMode(mode);
    globalCache.dateGroupingMode = mode;
    saveDateGroupingModePreference(mode);

    // 切换分组模式时，自动选中最新的日期
    const newAvailableDates = getAvailableDates(beans, mode);
    const newSelectedDate =
      newAvailableDates.length > 0 ? newAvailableDates[0] : null;
    setSelectedDate(newSelectedDate);
  };

  // 监听 selectedDate 变化并保存
  useEffect(() => {
    globalCache.selectedDate = selectedDate;
    saveSelectedDatePreference(selectedDate);
  }, [selectedDate]);

  // 处理计算方式变更
  const handleCalculationModeChange = (mode: CalculationMode) => {
    setCalculationMode(mode);
    globalCache.calculationMode = mode;
    saveCalculationModePreference(mode);
  };

  // 实际天数状态
  const [actualDays, setActualDays] = useState<number>(1);

  // 生成可用日期列表
  const availableDates = useMemo(() => {
    return getAvailableDates(beans, dateGroupingMode);
  }, [beans, dateGroupingMode]);

  // 根据时间区间过滤咖啡豆数据
  const filteredBeans = useMemo(() => {
    if (!selectedDate) {
      return beans;
    }

    return beans.filter(bean => {
      if (!bean.timestamp) return false;

      const date = new Date(bean.timestamp);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();

      if (dateGroupingMode === 'year') {
        return `${year}` === selectedDate;
      } else if (dateGroupingMode === 'month') {
        return `${year}-${month}` === selectedDate;
      } else {
        return `${year}-${month}-${day}` === selectedDate;
      }
    });
  }, [beans, selectedDate, dateGroupingMode]);

  // 获取今日消耗数据（保持原有逻辑用于"今日"显示）
  const todayConsumptionData = useConsumption(filteredBeans);
  const { consumption: todayConsumption } = todayConsumptionData;

  // 获取消耗趋势数据
  const { trendData } = useConsumptionTrend(
    beans,
    dateGroupingMode,
    selectedDate
  );

  // 决定是否显示趋势图
  const showTrendChart = useMemo(() => {
    // 如果选中了具体日期（day模式），则不显示
    if (dateGroupingMode === 'day' && selectedDate) {
      return false;
    }
    // 如果没有数据，也不显示
    if (trendData.length === 0) {
      return false;
    }
    return true;
  }, [dateGroupingMode, selectedDate, trendData]);

  // 获取统计数据 - 修复今日消耗显示问题
  const stats = useMemo(() => {
    // 对于"今日"显示，应该使用真正的今日消耗数据，而不是时间区间数据
    const todayConsumptionForStats = {
      espressoConsumption: todayConsumptionData.espressoConsumption,
      espressoCost: todayConsumptionData.espressoCost,
      filterConsumption: todayConsumptionData.filterConsumption,
      filterCost: todayConsumptionData.filterCost,
      omniConsumption: todayConsumptionData.omniConsumption,
      omniCost: todayConsumptionData.omniCost,
    };

    return calculateStats(
      filteredBeans,
      showEmptyBeans,
      todayConsumptionForStats
    );
  }, [filteredBeans, showEmptyBeans, todayConsumptionData]);

  // 获取时间范围的时间戳
  const getTimeRange = (dateStr: string | null, mode: DateGroupingMode) => {
    if (!dateStr) return { startTime: 0, endTime: Infinity };

    if (mode === 'year') {
      const year = parseInt(dateStr);
      const start = new Date(year, 0, 1).getTime();
      const end = new Date(year + 1, 0, 1).getTime();
      return { startTime: start, endTime: end };
    } else if (mode === 'month') {
      const [year, month] = dateStr.split('-').map(Number);
      const start = new Date(year, month - 1, 1).getTime();
      const end = new Date(year, month, 1).getTime();
      return { startTime: start, endTime: end };
    } else {
      const [year, month, day] = dateStr.split('-').map(Number);
      const start = new Date(year, month - 1, day).getTime();
      const end = new Date(year, month - 1, day + 1).getTime();
      return { startTime: start, endTime: end };
    }
  };

  // 计算实际天数的函数
  const calculateActualDays = useMemo(() => {
    return async (): Promise<number> => {
      try {
        const { Storage } = await import('@/lib/core/storage');
        const notesStr = await Storage.get('brewingNotes');
        if (!notesStr) return 1;

        const notes: BrewingNote[] = JSON.parse(notesStr);
        if (!Array.isArray(notes)) return 1;

        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000;
        let totalDays = 1;

        const { startTime, endTime } = getTimeRange(
          selectedDate,
          dateGroupingMode
        );

        // 筛选出相关的笔记记录（不过滤豆子名称，统计所有记录）
        let relevantNotes = notes.filter(note => {
          if (note.source === 'capacity-adjustment') {
            return false;
          }
          // 不过滤豆子名称，统计所有有效的冲煮记录
          return true;
        });

        // 根据时间区间过滤
        if (selectedDate) {
          relevantNotes = relevantNotes.filter(
            note => note.timestamp >= startTime && note.timestamp < endTime
          );

          // 计算自然日天数
          if (calculationMode === 'natural') {
            totalDays = Math.ceil((endTime - startTime) / dayInMs);
            // 如果是未来时间，限制到今天
            if (endTime > now) {
              const effectiveEnd = Math.min(endTime, now);
              if (effectiveEnd > startTime) {
                totalDays = Math.ceil((effectiveEnd - startTime) / dayInMs);
              }
            }
            totalDays = Math.max(1, totalDays);
          }
        } else {
          // 对于"目前为止"，计算实际的天数
          if (relevantNotes.length > 0) {
            const firstNoteTimestamp = Math.min(
              ...relevantNotes.map(note => note.timestamp)
            );
            totalDays = Math.max(
              1,
              Math.ceil((now - firstNoteTimestamp) / dayInMs)
            );
          }
        }

        if (relevantNotes.length === 0 && calculationMode === 'coffee')
          return 1;

        // 根据计算模式确定实际天数
        if (calculationMode === 'coffee') {
          const uniqueDays = new Set<string>();
          relevantNotes.forEach(note => {
            const date = new Date(note.timestamp);
            const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            uniqueDays.add(dateKey);
          });
          totalDays = Math.max(1, uniqueDays.size);
        }

        return totalDays;
      } catch (error) {
        console.error('计算实际天数失败:', error);
        return 1;
      }
    };
  }, [filteredBeans, selectedDate, dateGroupingMode, calculationMode]);

  // 平均消耗计算函数 - 基于时间区间和冲煮记录
  const calculateAverageConsumption = useMemo(() => {
    return async (
      beanType: 'espresso' | 'filter' | 'omni'
    ): Promise<number> => {
      try {
        const { Storage } = await import('@/lib/core/storage');
        const notesStr = await Storage.get('brewingNotes');
        if (!notesStr) return 0;

        const notes: BrewingNote[] = JSON.parse(notesStr);
        if (!Array.isArray(notes)) return 0;

        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000;
        let totalDays = 1;

        const { startTime, endTime } = getTimeRange(
          selectedDate,
          dateGroupingMode
        );

        const beanNames = filteredBeans
          .filter(bean => bean.beanType === beanType)
          .map(bean => bean.name);

        if (beanNames.length === 0) return 0;

        let relevantNotes = notes.filter(note => {
          if (note.source === 'capacity-adjustment') {
            return false;
          }
          return (
            note.coffeeBeanInfo?.name &&
            beanNames.includes(note.coffeeBeanInfo.name)
          );
        });

        if (selectedDate) {
          relevantNotes = relevantNotes.filter(
            note => note.timestamp >= startTime && note.timestamp < endTime
          );

          if (calculationMode === 'natural') {
            totalDays = Math.ceil((endTime - startTime) / dayInMs);
            if (endTime > now) {
              const effectiveEnd = Math.min(endTime, now);
              if (effectiveEnd > startTime) {
                totalDays = Math.ceil((effectiveEnd - startTime) / dayInMs);
              }
            }
            totalDays = Math.max(1, totalDays);
          }
        } else {
          if (relevantNotes.length > 0) {
            const firstNoteTimestamp = Math.min(
              ...relevantNotes.map(note => note.timestamp)
            );
            totalDays = Math.max(
              1,
              Math.ceil((now - firstNoteTimestamp) / dayInMs)
            );
          }
        }

        if (relevantNotes.length === 0) return 0;

        if (calculationMode === 'coffee') {
          const uniqueDays = new Set<string>();
          relevantNotes.forEach(note => {
            const date = new Date(note.timestamp);
            const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            uniqueDays.add(dateKey);
          });
          totalDays = Math.max(1, uniqueDays.size);
        }

        let totalConsumption = 0;
        relevantNotes.forEach(note => {
          if (note.source === 'quick-decrement' && note.quickDecrementAmount) {
            const coffeeAmount = note.quickDecrementAmount;
            if (!isNaN(coffeeAmount)) {
              totalConsumption += coffeeAmount;
            }
          } else if (note.params?.coffee) {
            const match = note.params.coffee.match(/(\d+(\.\d+)?)/);
            if (match) {
              const coffeeAmount = parseFloat(match[0]);
              if (!isNaN(coffeeAmount)) {
                totalConsumption += coffeeAmount;
              }
            }
          }
        });

        return totalConsumption / totalDays;
      } catch (error) {
        console.error('计算平均消耗失败:', error);
        return 0;
      }
    };
  }, [filteredBeans, selectedDate, dateGroupingMode, calculationMode]);

  // 获取具有图片的咖啡豆，用于渲染半圆图片
  const beansWithImages = useMemo(() => {
    return beans
      .filter(bean => bean.image && bean.image.length > 0)
      .slice(0, 7); // 最多取7个豆子的图片用于展示
  }, [beans]);

  // 获取用户名
  useEffect(() => {
    const fetchUsername = async () => {
      try {
        const { Storage } = await import('@/lib/core/storage');
        const settingsStr = await Storage.get('brewGuideSettings');
        if (settingsStr) {
          const settings = JSON.parse(settingsStr);
          setUsername(settings.username?.trim() || '');
        }
      } catch (e) {
        console.error('获取用户设置失败', e);
      }
    };

    fetchUsername();
  }, []);

  // 计算平均消耗
  useEffect(() => {
    const calculateConsumptions = async () => {
      const hasEspresso =
        stats.espressoStats && stats.espressoStats.totalBeans > 0;
      const hasFilter = stats.filterStats && stats.filterStats.totalBeans > 0;
      const hasOmni = stats.omniStats && stats.omniStats.totalBeans > 0;

      if (hasEspresso) {
        const espressoAvg = await calculateAverageConsumption('espresso');
        setEspressoAverageConsumption(espressoAvg);
      }

      if (hasFilter) {
        const filterAvg = await calculateAverageConsumption('filter');
        setFilterAverageConsumption(filterAvg);
      }

      if (hasOmni) {
        const omniAvg = await calculateAverageConsumption('omni');
        setOmniAverageConsumption(omniAvg);
      }
    };

    calculateConsumptions();
  }, [stats, calculateAverageConsumption]);

  // 计算实际天数
  useEffect(() => {
    const updateActualDays = async () => {
      const days = await calculateActualDays();
      setActualDays(days);
    };

    updateActualDays();
  }, [calculateActualDays]);

  // 计算趣味统计数据
  useEffect(() => {
    const updateFunStats = async () => {
      try {
        const { Storage } = await import('@/lib/core/storage');
        const notesStr = await Storage.get('brewingNotes');
        if (!notesStr) return;

        const notes: BrewingNote[] = JSON.parse(notesStr);
        if (!Array.isArray(notes)) return;

        const { startTime, endTime } = getTimeRange(
          selectedDate,
          dateGroupingMode
        );

        // 根据当前筛选的时间范围过滤笔记
        let relevantNotes = notes;
        if (selectedDate) {
          relevantNotes = notes.filter(
            note => note.timestamp >= startTime && note.timestamp < endTime
          );
        }

        const stats = calculateFunStats(relevantNotes);
        setFunStats(stats);
      } catch (error) {
        console.error('计算趣味统计失败:', error);
      }
    };

    updateFunStats();
  }, [selectedDate, dateGroupingMode]);

  // 格式化选中的时间范围标签
  const selectedTimeRangeLabel = useMemo(() => {
    if (!selectedDate) return '目前为止';

    if (dateGroupingMode === 'year') {
      return `${selectedDate}年`;
    } else if (dateGroupingMode === 'month') {
      const [y, m] = selectedDate.split('-');
      return `${y}年${m}月`;
    } else {
      return selectedDate.replace(/-/g, '/');
    }
  }, [selectedDate, dateGroupingMode]);

  // 生成顶部显示的时间范围文案 (YYYY-MM-DD - MM-DD)
  const dateRangeLabel = useMemo(() => {
    let startTimestamp: number;
    let endTimestamp: number;

    if (selectedDate) {
      const { startTime, endTime } = getTimeRange(
        selectedDate,
        dateGroupingMode
      );
      startTimestamp = startTime;
      endTimestamp = endTime - 1; // 减去1毫秒，变为闭区间
    } else {
      // 如果没有选中日期，计算所有豆子的时间范围
      if (beans.length === 0) return '';
      const timestamps = beans
        .map(b => b.timestamp)
        .filter((t): t is number => !!t);
      if (timestamps.length === 0) return '';
      startTimestamp = Math.min(...timestamps);
      endTimestamp = Math.max(...timestamps);
    }

    const startDate = new Date(startTimestamp);
    const endDate = new Date(endTimestamp);

    const formatFull = (date: Date) => {
      const y = date.getFullYear();
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const d = date.getDate().toString().padStart(2, '0');
      return `${y}.${m}.${d}`;
    };

    const formatShort = (date: Date) => {
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const d = date.getDate().toString().padStart(2, '0');
      return `${m}.${d}`;
    };

    const isSameDay =
      startDate.getFullYear() === endDate.getFullYear() &&
      startDate.getMonth() === endDate.getMonth() &&
      startDate.getDate() === endDate.getDate();

    if (isSameDay) {
      return formatFull(startDate);
    }

    if (startDate.getFullYear() !== endDate.getFullYear()) {
      return `数据周期 ${formatFull(startDate)} - ${formatFull(endDate)}`;
    } else {
      return `数据周期 ${formatFull(startDate)} - ${formatShort(endDate)}`;
    }
  }, [selectedDate, dateGroupingMode, beans]);

  // 如果没有咖啡豆数据，显示友好提示
  if (beans.length === 0) {
    return (
      <div className="coffee-bean-stats-container bg-neutral-50 dark:bg-neutral-900">
        <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
          [ 有咖啡豆数据后，再来查看吧～ ]
        </div>
      </div>
    );
  }

  return (
    <div className="coffee-bean-stats-container bg-neutral-50 dark:bg-neutral-900">
      <div className="sticky top-0 z-10 bg-neutral-50 dark:bg-neutral-900">
        <StatsFilterBar
          dateGroupingMode={dateGroupingMode}
          onDateGroupingModeChange={handleDateGroupingModeChange}
          selectedDate={selectedDate}
          onDateClick={setSelectedDate}
          availableDates={availableDates}
          calculationMode={calculationMode}
          onCalculationModeChange={handleCalculationModeChange}
          dateRangeLabel={dateRangeLabel}
        />
      </div>

      <div ref={statsContainerRef} className="mt-5 px-6">
        <div className="flex flex-col items-center">
          {/* 统计卡片列表 */}
          <div className="w-full space-y-5">
            {(() => {
              const hasEspresso =
                stats.espressoStats && stats.espressoStats.totalBeans > 0;
              const hasFilter =
                stats.filterStats && stats.filterStats.totalBeans > 0;
              const hasOmni = stats.omniStats && stats.omniStats.totalBeans > 0;

              const espressoAverageConsumptionForFinish =
                actualDays > 0
                  ? stats.espressoStats.consumedWeight / actualDays
                  : 0;

              const espressoFinishDate = hasEspresso
                ? calculateEstimatedFinishDate(
                    {
                      ...stats,
                      remainingWeight: stats.espressoStats.remainingWeight,
                      consumedWeight: stats.espressoStats.consumedWeight,
                      totalWeight: stats.espressoStats.totalWeight,
                    },
                    espressoAverageConsumptionForFinish
                  )
                : '';

              const filterAverageConsumptionForFinish =
                actualDays > 0
                  ? stats.filterStats.consumedWeight / actualDays
                  : 0;

              const filterFinishDate = hasFilter
                ? calculateEstimatedFinishDate(
                    {
                      ...stats,
                      remainingWeight: stats.filterStats.remainingWeight,
                      consumedWeight: stats.filterStats.consumedWeight,
                      totalWeight: stats.filterStats.totalWeight,
                    },
                    filterAverageConsumptionForFinish
                  )
                : '';

              const omniAverageConsumptionForFinish =
                actualDays > 0
                  ? stats.omniStats.consumedWeight / actualDays
                  : 0;

              const omniFinishDate = hasOmni
                ? calculateEstimatedFinishDate(
                    {
                      ...stats,
                      remainingWeight: stats.omniStats.remainingWeight,
                      consumedWeight: stats.omniStats.consumedWeight,
                      totalWeight: stats.omniStats.totalWeight,
                    },
                    omniAverageConsumptionForFinish
                  )
                : '';

              // 计算总览数据
              const totalAverageConsumption =
                actualDays > 0 ? stats.consumedWeight / actualDays : 0;

              const totalFinishDate = calculateEstimatedFinishDate(
                stats,
                totalAverageConsumption
              );

              // 概览详情
              const overviewDetails = (
                <div className="grid grid-cols-2 gap-3">
                  <StatsBlock
                    title="消耗"
                    value={
                      stats.consumedWeight > 0
                        ? `${formatNumber(stats.consumedWeight)}克`
                        : '-'
                    }
                  />
                  <StatsBlock
                    title="花费"
                    value={
                      stats.totalCost > 0
                        ? `${formatNumber(stats.totalCost)}元`
                        : '-'
                    }
                  />
                  <StatsBlock
                    title="日均消耗"
                    value={
                      totalAverageConsumption > 0
                        ? `${formatNumber(totalAverageConsumption)}克`
                        : '-'
                    }
                  />
                  <StatsBlock
                    title="平均每克"
                    value={
                      stats.averageGramPrice > 0
                        ? `${formatNumber(stats.averageGramPrice)}元`
                        : '-'
                    }
                  />
                </div>
              );

              // 意式详情
              const espressoAverageConsumptionFixed =
                actualDays > 0
                  ? stats.espressoStats.consumedWeight / actualDays
                  : 0;

              const espressoDetails = (
                <div className="grid grid-cols-2 gap-3">
                  <StatsBlock
                    title="日均消耗"
                    value={
                      espressoAverageConsumptionFixed > 0
                        ? `${formatNumber(espressoAverageConsumptionFixed)}克`
                        : '-'
                    }
                  />
                  <StatsBlock
                    title="平均每克"
                    value={
                      stats.espressoStats.averageGramPrice > 0
                        ? `${formatNumber(stats.espressoStats.averageGramPrice)}元`
                        : '-'
                    }
                  />
                  <StatsBlock
                    title="今日消耗"
                    value={
                      stats.espressoStats.todayConsumption > 0
                        ? `${formatNumber(stats.espressoStats.todayConsumption)}克`
                        : '-'
                    }
                  />
                  <StatsBlock
                    title="今日花费"
                    value={
                      stats.espressoStats.todayCost > 0
                        ? `${formatNumber(stats.espressoStats.todayCost)}元`
                        : '-'
                    }
                  />
                </div>
              );

              // 手冲详情
              const filterAverageConsumptionFixed =
                actualDays > 0
                  ? stats.filterStats.consumedWeight / actualDays
                  : 0;

              const filterDetails = (
                <div className="grid grid-cols-2 gap-3">
                  <StatsBlock
                    title="日均消耗"
                    value={
                      filterAverageConsumptionFixed > 0
                        ? `${formatNumber(filterAverageConsumptionFixed)}克`
                        : '-'
                    }
                  />
                  <StatsBlock
                    title="平均每克"
                    value={
                      stats.filterStats.averageGramPrice > 0
                        ? `${formatNumber(stats.filterStats.averageGramPrice)}元`
                        : '-'
                    }
                  />
                  <StatsBlock
                    title="今日消耗"
                    value={
                      stats.filterStats.todayConsumption > 0
                        ? `${formatNumber(stats.filterStats.todayConsumption)}克`
                        : '-'
                    }
                  />
                  <StatsBlock
                    title="今日花费"
                    value={
                      stats.filterStats.todayCost > 0
                        ? `${formatNumber(stats.filterStats.todayCost)}元`
                        : '-'
                    }
                  />
                </div>
              );

              // 全能详情
              const omniAverageConsumptionFixed =
                actualDays > 0
                  ? stats.omniStats.consumedWeight / actualDays
                  : 0;

              const omniDetails = (
                <div className="grid grid-cols-2 gap-3">
                  <StatsBlock
                    title="日均消耗"
                    value={
                      omniAverageConsumptionFixed > 0
                        ? `${formatNumber(omniAverageConsumptionFixed)}克`
                        : '-'
                    }
                  />
                  <StatsBlock
                    title="平均每克"
                    value={
                      stats.omniStats.averageGramPrice > 0
                        ? `${formatNumber(stats.omniStats.averageGramPrice)}元`
                        : '-'
                    }
                  />
                  <StatsBlock
                    title="今日消耗"
                    value={
                      stats.omniStats.todayConsumption > 0
                        ? `${formatNumber(stats.omniStats.todayConsumption)}克`
                        : '-'
                    }
                  />
                  <StatsBlock
                    title="今日花费"
                    value={
                      stats.omniStats.todayCost > 0
                        ? `${formatNumber(stats.omniStats.todayCost)}元`
                        : '-'
                    }
                  />
                </div>
              );

              return (
                <>
                  {/* 总览卡片 */}
                  <BeanTypeCard
                    title="概览"
                    statsData={{
                      ...stats,
                      todayConsumption: 0,
                      todayCost: 0,
                      activeBeans: stats.activeBeans,
                    }}
                    finishDate={totalFinishDate}
                    chart={
                      showTrendChart ? (
                        <ConsumptionTrendChart data={trendData} />
                      ) : undefined
                    }
                    customStats={[
                      {
                        title: '今日消耗',
                        value:
                          todayConsumptionData.consumption > 0
                            ? `${formatNumber(todayConsumptionData.consumption)}克`
                            : '-',
                      },
                      {
                        title: '今日花费',
                        value:
                          todayConsumptionData.cost > 0
                            ? `${formatNumber(todayConsumptionData.cost)}元`
                            : '-',
                      },
                      {
                        title: '剩余',
                        value:
                          stats.remainingWeight > 0
                            ? `${formatNumber(stats.remainingWeight)}克`
                            : '-',
                      },
                      {
                        title: '剩余价值',
                        value:
                          stats.remainingWeight > 0 &&
                          stats.averageGramPrice > 0
                            ? `${formatNumber(stats.remainingWeight * stats.averageGramPrice)}元`
                            : '-',
                      },
                    ]}
                    moreDetails={overviewDetails}
                  />

                  {hasEspresso && (
                    <BeanTypeCard
                      title="意式豆"
                      statsData={stats.espressoStats}
                      finishDate={espressoFinishDate}
                      moreDetails={espressoDetails}
                    />
                  )}
                  {hasFilter && (
                    <BeanTypeCard
                      title="手冲豆"
                      statsData={stats.filterStats}
                      finishDate={filterFinishDate}
                      moreDetails={filterDetails}
                    />
                  )}
                  {hasOmni && (
                    <BeanTypeCard
                      title="全能豆"
                      statsData={stats.omniStats}
                      finishDate={omniFinishDate}
                      moreDetails={omniDetails}
                    />
                  )}

                  {/* 趣味统计 */}
                  {funStats && (
                    <>
                      <div className="my-6 border-t border-neutral-200 dark:border-neutral-800" />

                      <div className="w-full">
                        <div className="grid grid-cols-2 gap-3">
                          {/* 最早冲煮 */}
                          <div className="flex flex-col justify-between rounded bg-neutral-100 p-3 dark:bg-neutral-800">
                            <div className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                              最早冲煮
                            </div>
                            <div className="flex items-baseline text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {funStats.earliestBrewTime}
                            </div>
                          </div>

                          {/* 最晚冲煮 */}
                          <div className="flex flex-col justify-between rounded bg-neutral-100 p-3 dark:bg-neutral-800">
                            <div className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                              最晚冲煮
                            </div>
                            <div className="flex items-baseline text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {funStats.latestBrewTime}
                            </div>
                          </div>

                          {/* 最活跃时段 */}
                          <div className="flex flex-col justify-between rounded bg-neutral-100 p-3 dark:bg-neutral-800">
                            <div className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                              最活跃时段
                            </div>
                            <div className="flex items-baseline text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {funStats.mostActiveTimePeriod}
                            </div>
                          </div>

                          {/* 最长连续打卡 */}
                          <div className="flex flex-col justify-between rounded bg-neutral-100 p-3 dark:bg-neutral-800">
                            <div className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                              最长连续打卡
                            </div>
                            <div className="flex items-baseline text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {funStats.longestStreak} 天
                            </div>
                          </div>

                          {/* 评分红榜 Top 3 */}
                          {funStats.topRatedBeans.length > 0 && (
                            <div className="col-span-2 flex flex-col rounded bg-neutral-100 p-3 dark:bg-neutral-800">
                              <div className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                评分红榜 (Top 3)
                              </div>
                              <div className="space-y-1.5">
                                {funStats.topRatedBeans.map((bean, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center justify-between text-sm font-medium text-neutral-900 dark:text-neutral-100"
                                  >
                                    <span className="mr-2 flex-1 truncate">
                                      {index + 1}. {bean.name}
                                    </span>
                                    <span>{bean.rating}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 评分黑榜 Bottom 3 */}
                          {funStats.lowestRatedBeans.length > 0 && (
                            <div className="col-span-2 flex flex-col rounded bg-neutral-100 p-3 dark:bg-neutral-800">
                              <div className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                评分黑榜 (Bottom 3)
                              </div>
                              <div className="space-y-1.5">
                                {funStats.lowestRatedBeans.map(
                                  (bean, index) => (
                                    <div
                                      key={index}
                                      className="flex items-center justify-between text-sm font-medium text-neutral-900 dark:text-neutral-100"
                                    >
                                      <span className="mr-2 flex-1 truncate">
                                        {index + 1}. {bean.name}
                                      </span>
                                      <span>{bean.rating}</span>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          )}

                          <div className="col-span-2 my-3 border-t border-neutral-200 dark:border-neutral-800" />

                          {/* 咖啡豆画像 (原 Profile 数据) */}
                          {Object.keys(stats.roastLevelCount).length > 0 && (
                            <StatsListBlock
                              title="烘焙度"
                              items={Object.entries(stats.roastLevelCount).map(
                                ([label, value]) => ({
                                  label,
                                  value: `${value}个`,
                                })
                              )}
                              className="col-span-2"
                            />
                          )}

                          {Object.keys(stats.originCount).length > 0 && (
                            <StatsListBlock
                              title="产地"
                              items={Object.entries(stats.originCount).map(
                                ([label, value]) => ({
                                  label,
                                  value: `${value}个`,
                                })
                              )}
                              className="col-span-2"
                            />
                          )}

                          {Object.keys(stats.processCount).length > 0 && (
                            <StatsListBlock
                              title="处理法"
                              items={Object.entries(stats.processCount).map(
                                ([label, value]) => ({
                                  label,
                                  value: `${value}个`,
                                })
                              )}
                              className="col-span-2"
                            />
                          )}

                          {Object.keys(stats.varietyCount).length > 0 && (
                            <StatsListBlock
                              title="品种"
                              items={Object.entries(stats.varietyCount).map(
                                ([label, value]) => ({
                                  label,
                                  value: `${value}个`,
                                })
                              )}
                              className="col-span-2"
                            />
                          )}

                          {stats.topFlavors.length > 0 && (
                            <StatsListBlock
                              title="风味"
                              items={stats.topFlavors.map(([label, value]) => ({
                                label,
                                value: `${value}次`,
                              }))}
                              className="col-span-2"
                            />
                          )}

                          {/* 分类统计 */}
                          {(() => {
                            const singleTotal = beans.filter(
                              b =>
                                !b.blendComponents ||
                                b.blendComponents.length <= 1
                            ).length;
                            const blendTotal = beans.filter(
                              b =>
                                b.blendComponents &&
                                b.blendComponents.length > 1
                            ).length;
                            const espressoTotal = beans.filter(
                              b => b.beanType === 'espresso'
                            ).length;
                            const filterTotal = beans.filter(
                              b => b.beanType === 'filter'
                            ).length;
                            const omniTotal = beans.filter(
                              b => b.beanType === 'omni'
                            ).length;

                            const items = [];
                            if (singleTotal > 0) {
                              items.push({
                                label: '单品豆',
                                value: `${beans.filter(b => (!b.blendComponents || b.blendComponents.length <= 1) && !isBeanEmpty(b)).length}/${singleTotal}`,
                              });
                            }
                            if (blendTotal > 0) {
                              items.push({
                                label: '拼配豆',
                                value: `${beans.filter(b => b.blendComponents && b.blendComponents.length > 1 && !isBeanEmpty(b)).length}/${blendTotal}`,
                              });
                            }
                            if (espressoTotal > 0) {
                              items.push({
                                label: '意式豆',
                                value: `${beans.filter(b => b.beanType === 'espresso' && !isBeanEmpty(b)).length}/${espressoTotal}`,
                              });
                            }
                            if (filterTotal > 0) {
                              items.push({
                                label: '手冲豆',
                                value: `${beans.filter(b => b.beanType === 'filter' && !isBeanEmpty(b)).length}/${filterTotal}`,
                              });
                            }
                            if (omniTotal > 0) {
                              items.push({
                                label: '全能豆',
                                value: `${beans.filter(b => b.beanType === 'omni' && !isBeanEmpty(b)).length}/${omniTotal}`,
                              });
                            }

                            if (items.length > 0) {
                              return (
                                <StatsListBlock
                                  title="分类统计 (使用中/总数)"
                                  items={items}
                                  className="col-span-2"
                                />
                              );
                            }
                            return null;
                          })()}

                          {/* 赏味期 */}
                          {stats.flavorPeriodStatus.inPeriod +
                            stats.flavorPeriodStatus.beforePeriod +
                            stats.flavorPeriodStatus.afterPeriod >
                            0 && (
                            <StatsListBlock
                              title="赏味期"
                              items={[
                                ...(stats.flavorPeriodStatus.inPeriod > 0
                                  ? [
                                      {
                                        label: '在赏味期内',
                                        value: `${stats.flavorPeriodStatus.inPeriod}个`,
                                      },
                                    ]
                                  : []),
                                ...(stats.flavorPeriodStatus.beforePeriod > 0
                                  ? [
                                      {
                                        label: '尚未进入',
                                        value: `${stats.flavorPeriodStatus.beforePeriod}个`,
                                      },
                                    ]
                                  : []),
                                ...(stats.flavorPeriodStatus.afterPeriod > 0
                                  ? [
                                      {
                                        label: '已过赏味期',
                                        value: `${stats.flavorPeriodStatus.afterPeriod}个`,
                                      },
                                    ]
                                  : []),
                              ]}
                              className="col-span-2"
                            />
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsView;
