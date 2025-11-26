'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { StatsViewProps, DateGroupingMode, TypeInventoryStats } from './types';
import { formatNumber } from './utils';
import {
  globalCache,
  saveDateGroupingModePreference,
  saveSelectedDatePreference,
} from '../../globalCache';
import StatsFilterBar from './StatsFilterBar';
import ConsumptionTrendChart from './ConsumptionTrendChart';
import { useStatsData } from './useStatsData';

// 格式化辅助函数
const fmtWeight = (v: number) => (v > 0 ? `${formatNumber(v)}g` : '-');
const fmtCost = (v: number) => (v > 0 ? `¥${formatNumber(v)}` : '-');
const fmtDays = (v: number) => (v > 0 ? `${v}天` : '-');

// 辅助组件：单个统计块
const StatsBlock: React.FC<{
  title: string;
  value: string | number;
  className?: string;
}> = ({ title, value, className }) => (
  <div
    className={`flex flex-col justify-between rounded bg-neutral-200/30 p-3 dark:bg-neutral-800/40 ${className}`}
  >
    <div className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
      {title}
    </div>
    <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
      {value}
    </div>
  </div>
);

// 库存预测表格组件
const InventoryForecast: React.FC<{ data: TypeInventoryStats[] }> = ({
  data,
}) => {
  if (data.length === 0) return null;

  return (
    <div className="rounded bg-neutral-200/30 p-3 dark:bg-neutral-800/40">
      {/* 表头 */}
      <div className="mb-2 grid grid-cols-4 gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        <div>类型</div>
        <div className="text-right">剩余</div>
        <div className="text-right">日均</div>
        <div className="text-right">预计用完</div>
      </div>
      {/* 数据行 */}
      <div className="space-y-1.5">
        {data.map(item => (
          <div
            key={item.type}
            className="grid grid-cols-4 gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100"
          >
            <div>{item.label}</div>
            <div className="text-right">{fmtWeight(item.remaining)}</div>
            <div className="text-right">{fmtWeight(item.dailyConsumption)}</div>
            <div className="text-right">{fmtDays(item.estimatedDays)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 统计卡片组件
interface StatsCardProps {
  title: string;
  chart?: React.ReactNode;
  stats: Array<{ title: string; value: string }>;
  extra?: React.ReactNode;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  chart,
  stats,
  extra,
}) => {
  if (stats.length === 0 && !chart && !extra) return null;

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
          {title}
        </h3>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {chart && (
            <div className="col-span-2 flex flex-col justify-between rounded bg-neutral-200/30 p-3 dark:bg-neutral-800/40">
              {chart}
            </div>
          )}
          {stats.map((stat, index) => (
            <StatsBlock key={index} title={stat.title} value={stat.value} />
          ))}
        </div>
        {extra}
      </div>
    </div>
  );
};

const StatsView: React.FC<StatsViewProps> = ({ beans }) => {
  // 筛选状态
  const [dateGroupingMode, setDateGroupingMode] = useState<DateGroupingMode>(
    globalCache.dateGroupingMode
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(
    globalCache.selectedDate
  );

  // 使用统一的数据 hook
  const {
    availableDates,
    stats,
    trendData,
    isHistoricalView,
    effectiveDateRange,
  } = useStatsData(beans, dateGroupingMode, selectedDate);

  // 处理分组模式变更
  const handleDateGroupingModeChange = (mode: DateGroupingMode) => {
    setDateGroupingMode(mode);
    setSelectedDate(null); // 切换模式时重置选择
    globalCache.dateGroupingMode = mode;
    saveDateGroupingModePreference(mode);
  };

  // 监听 selectedDate 变化并保存
  useEffect(() => {
    globalCache.selectedDate = selectedDate;
    saveSelectedDatePreference(selectedDate);
  }, [selectedDate]);

  // 生成日期范围标签（基于实际数据范围）
  const dateRangeLabel = useMemo(() => {
    if (!effectiveDateRange) return '';

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

    const startDate = new Date(effectiveDateRange.start);
    // end 是开区间边界，需要减1ms获取实际最后一天
    const endDate = new Date(effectiveDateRange.end - 1);

    const isSameDay =
      startDate.getFullYear() === endDate.getFullYear() &&
      startDate.getMonth() === endDate.getMonth() &&
      startDate.getDate() === endDate.getDate();

    if (isSameDay) return formatFull(startDate);

    if (startDate.getFullYear() !== endDate.getFullYear()) {
      return `数据周期 ${formatFull(startDate)} - ${formatFull(endDate)}`;
    }
    return `数据周期 ${formatFull(startDate)} - ${formatShort(endDate)}`;
  }, [effectiveDateRange]);

  // 空状态
  if (beans.length === 0) {
    return (
      <div className="coffee-bean-stats-container bg-neutral-50 dark:bg-neutral-900">
        <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
          [ 有咖啡豆数据后，再来查看吧～ ]
        </div>
      </div>
    );
  }

  // 是否显示趋势图
  const showTrendChart = trendData.length > 0;

  // 是否为单日视图（按日筛选且选中了某一天）
  const isSingleDayView = dateGroupingMode === 'day' && selectedDate !== null;

  // 概览统计：单日视图只显示消耗和花费，其他视图显示全部
  const overviewStats = isSingleDayView
    ? [
        { title: '消耗', value: fmtWeight(stats.overview.consumption) },
        { title: '花费', value: fmtCost(stats.overview.cost) },
      ]
    : [
        { title: '总消耗', value: fmtWeight(stats.overview.consumption) },
        { title: '总花费', value: fmtCost(stats.overview.cost) },
        {
          title: '日均消耗',
          value: fmtWeight(stats.overview.dailyConsumption),
        },
        { title: '日均花费', value: fmtCost(stats.overview.dailyCost) },
      ];

  // 库存统计（仅实时视图显示）
  const inventoryStats = stats.inventory
    ? [
        { title: '剩余总量', value: fmtWeight(stats.inventory.remaining) },
        { title: '剩余价值', value: fmtCost(stats.inventory.remainingValue) },
      ]
    : [];

  return (
    <div className="coffee-bean-stats-container bg-neutral-50 dark:bg-neutral-900">
      <div className="sticky top-0 z-10 bg-neutral-50 dark:bg-neutral-900">
        <StatsFilterBar
          dateGroupingMode={dateGroupingMode}
          onDateGroupingModeChange={handleDateGroupingModeChange}
          selectedDate={selectedDate}
          onDateClick={setSelectedDate}
          availableDates={availableDates}
          dateRangeLabel={dateRangeLabel}
        />
      </div>

      <div className="mt-5 px-6">
        <div className="flex flex-col items-center">
          <div className="w-full space-y-5">
            {/* 概览 */}
            <StatsCard
              title="概览"
              chart={
                showTrendChart ? (
                  <ConsumptionTrendChart data={trendData} />
                ) : undefined
              }
              stats={overviewStats}
            />

            {/* 库存预测（仅实时视图） */}
            {!isHistoricalView &&
              stats.inventoryByType &&
              stats.inventoryByType.length > 0 && (
                <StatsCard
                  title="库存预测"
                  stats={inventoryStats}
                  extra={<InventoryForecast data={stats.inventoryByType} />}
                />
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsView;
