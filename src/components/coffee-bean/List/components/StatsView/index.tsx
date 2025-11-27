'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StatsViewProps, DateGroupingMode, TypeInventoryStats, BrewingDetailItem } from './types';
import { formatNumber } from './utils';
import {
  globalCache,
  saveDateGroupingModePreference,
  saveSelectedDatePreference,
} from '../../globalCache';
import StatsFilterBar from './StatsFilterBar';
import ConsumptionTrendChart from './ConsumptionTrendChart';
import { useStatsData, StatsMetadata } from './useStatsData';
import StatsExplainer, { StatsExplanation } from './StatsExplainer';

// 格式化辅助函数
const fmtWeight = (v: number) => (v > 0 ? `${formatNumber(v)}g` : '-');
const fmtCost = (v: number) => (v > 0 ? `¥${formatNumber(v)}` : '-');
const fmtDays = (v: number) => (v > 0 ? `${v}天` : '-');

// 统计项的唯一标识
type StatsKey =
  | 'totalConsumption'
  | 'totalCost'
  | 'dailyConsumption'
  | 'dailyCost'
  | 'todayConsumption'
  | 'todayCost'
  | 'remaining'
  | 'remainingValue';

// 生成解释内容的工厂函数
const createExplanation = (
  key: StatsKey,
  value: string,
  stats: ReturnType<typeof useStatsData>['stats'],
  metadata: StatsMetadata,
  isHistoricalView: boolean
): StatsExplanation | null => {
  const { validNotes, actualDays, beansWithPrice, beansTotal, todayNotes } =
    metadata;

  switch (key) {
    case 'totalConsumption':
      return {
        title: isHistoricalView ? '消耗' : '总消耗',
        value,
        formula: '∑ 每条冲煮记录的咖啡用量',
        dataSource: [
          { label: '有效冲煮记录', value: `${validNotes} 条` },
          { label: '统计天数', value: `${actualDays} 天` },
        ],
        note: validNotes < 5 ? '记录较少，数据仅供参考' : undefined,
      };

    case 'totalCost':
      return {
        title: isHistoricalView ? '花费' : '总花费',
        value,
        formula: '∑ (用量 × 单价/容量)',
        dataSource: [
          { label: '有效冲煮记录', value: `${validNotes} 条` },
          {
            label: '有价格的咖啡豆',
            value: `${beansWithPrice}/${beansTotal} 款`,
          },
        ],
        note:
          beansWithPrice < beansTotal
            ? `${beansTotal - beansWithPrice} 款咖啡豆缺少价格信息，未计入花费`
            : undefined,
      };

    case 'dailyConsumption':
      return {
        title: '日均消耗',
        value,
        formula: '总消耗 ÷ 统计天数',
        dataSource: [
          { label: '总消耗', value: fmtWeight(stats.overview.consumption) },
          { label: '统计天数', value: `${actualDays} 天` },
        ],
        note: actualDays < 7 ? '统计周期较短，日均值可能波动较大' : undefined,
      };

    case 'dailyCost':
      return {
        title: '日均花费',
        value,
        formula: '总花费 ÷ 统计天数',
        dataSource: [
          { label: '总花费', value: fmtCost(stats.overview.cost) },
          { label: '统计天数', value: `${actualDays} 天` },
        ],
        note:
          beansWithPrice < beansTotal
            ? '部分咖啡豆缺少价格，实际花费可能更高'
            : undefined,
      };

    case 'todayConsumption':
      return {
        title: '今日消耗',
        value,
        formula: '∑ 今日冲煮记录的咖啡用量',
        dataSource: [{ label: '今日冲煮记录', value: `${todayNotes} 条` }],
      };

    case 'todayCost':
      return {
        title: '今日花费',
        value,
        formula: '∑ 今日 (用量 × 单价/容量)',
        dataSource: [
          { label: '今日冲煮记录', value: `${todayNotes} 条` },
          {
            label: '有价格的咖啡豆',
            value: `${beansWithPrice}/${beansTotal} 款`,
          },
        ],
      };

    case 'remaining':
      return {
        title: '剩余总量',
        value,
        formula: '∑ 每款咖啡豆的剩余量',
        dataSource: [{ label: '咖啡豆数量', value: `${beansTotal} 款` }],
      };

    case 'remainingValue':
      return {
        title: '剩余价值',
        value,
        formula: '∑ (剩余量 × 单价/容量)',
        dataSource: [
          { label: '咖啡豆数量', value: `${beansTotal} 款` },
          { label: '有价格信息', value: `${beansWithPrice} 款` },
        ],
        note:
          beansWithPrice < beansTotal
            ? '部分咖啡豆缺少价格信息，未计入价值'
            : undefined,
      };

    default:
      return null;
  }
};

// 可点击的统计块组件
interface ClickableStatsBlockProps {
  title: string;
  value: string;
  statsKey: StatsKey;
  onExplain: (key: StatsKey, rect: DOMRect) => void;
}

const ClickableStatsBlock: React.FC<ClickableStatsBlockProps> = ({
  title,
  value,
  statsKey,
  onExplain,
}) => {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onExplain(statsKey, rect);
  };

  return (
    <div
      data-stats-block
      onClick={handleClick}
      className="flex cursor-pointer flex-col justify-between rounded bg-neutral-200/30 p-3 transition-colors active:bg-neutral-300/40 dark:bg-neutral-800/40 dark:active:bg-neutral-700/40"
    >
      <div className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {title}
      </div>
      <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {value}
      </div>
    </div>
  );
};

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

// 冲煮明细组件（单日视图使用）
const BrewingDetails: React.FC<{ data: BrewingDetailItem[] }> = ({ data }) => {
  if (data.length === 0) return null;

  // 格式化时间为 HH:mm
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <div className="rounded bg-neutral-200/30 p-3 dark:bg-neutral-800/40">
      {/* 表头 */}
      <div className="mb-2 grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        <div>咖啡豆</div>
        <div className="text-right">用量</div>
        <div className="text-right">花费</div>
        <div className="text-right">时间</div>
      </div>
      {/* 数据行 */}
      <div className="space-y-1.5">
        {data.map(item => (
          <div
            key={item.id}
            className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100"
          >
            <div className="truncate">{item.beanName}</div>
            <div className="text-right">{fmtWeight(item.amount)}</div>
            <div className="text-right">{fmtCost(item.cost)}</div>
            <div className="text-right">{formatTime(item.timestamp)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 统计卡片组件（支持可点击的统计块）
interface StatsCardProps {
  title: string;
  chart?: React.ReactNode;
  stats: Array<{ title: string; value: string; key: StatsKey }>;
  extra?: React.ReactNode;
  onExplain: (key: StatsKey, rect: DOMRect) => void;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  chart,
  stats,
  extra,
  onExplain,
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
            <ClickableStatsBlock
              key={index}
              title={stat.title}
              value={stat.value}
              statsKey={stat.key}
              onExplain={onExplain}
            />
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

  // 解释弹窗状态
  const [explanation, setExplanation] = useState<StatsExplanation | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [activeKey, setActiveKey] = useState<StatsKey | null>(null);

  // 使用统一的数据 hook
  const {
    availableDates,
    stats,
    todayStats,
    trendData,
    isHistoricalView,
    effectiveDateRange,
    metadata,
    brewingDetails,
    todayBrewingDetails,
  } = useStatsData(beans, dateGroupingMode, selectedDate);

  // 处理点击解释
  const handleExplain = useCallback(
    (key: StatsKey, rect: DOMRect) => {
      // 如果点击的是当前已展开的同一个卡片，则关闭
      if (activeKey === key) {
        setExplanation(null);
        setAnchorRect(null);
        setActiveKey(null);
        return;
      }

      // 获取对应的值
      let value = '-';
      switch (key) {
        case 'totalConsumption':
          value = fmtWeight(stats.overview.consumption);
          break;
        case 'totalCost':
          value = fmtCost(stats.overview.cost);
          break;
        case 'dailyConsumption':
          value = fmtWeight(stats.overview.dailyConsumption);
          break;
        case 'dailyCost':
          value = fmtCost(stats.overview.dailyCost);
          break;
        case 'todayConsumption':
          value = fmtWeight(todayStats?.consumption || 0);
          break;
        case 'todayCost':
          value = fmtCost(todayStats?.cost || 0);
          break;
        case 'remaining':
          value = fmtWeight(stats.inventory?.remaining || 0);
          break;
        case 'remainingValue':
          value = fmtCost(stats.inventory?.remainingValue || 0);
          break;
      }

      const exp = createExplanation(
        key,
        value,
        stats,
        metadata,
        isHistoricalView
      );
      setExplanation(exp);
      setAnchorRect(rect);
      setActiveKey(key);
    },
    [stats, todayStats, metadata, isHistoricalView, activeKey]
  );

  // 关闭解释弹窗
  const handleCloseExplanation = useCallback(() => {
    setExplanation(null);
    setAnchorRect(null);
    setActiveKey(null);
  }, []);

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
        {
          title: '消耗',
          value: fmtWeight(stats.overview.consumption),
          key: 'totalConsumption' as StatsKey,
        },
        {
          title: '花费',
          value: fmtCost(stats.overview.cost),
          key: 'totalCost' as StatsKey,
        },
      ]
    : [
        {
          title: '总消耗',
          value: fmtWeight(stats.overview.consumption),
          key: 'totalConsumption' as StatsKey,
        },
        {
          title: '总花费',
          value: fmtCost(stats.overview.cost),
          key: 'totalCost' as StatsKey,
        },
        {
          title: '日均消耗',
          value: fmtWeight(stats.overview.dailyConsumption),
          key: 'dailyConsumption' as StatsKey,
        },
        {
          title: '日均花费',
          value: fmtCost(stats.overview.dailyCost),
          key: 'dailyCost' as StatsKey,
        },
      ];

  // 今日统计（仅在非按日模式且有数据时显示）
  const hasTodayData = todayStats && todayStats.consumption > 0;
  const todayStatsDisplay = hasTodayData
    ? [
        {
          title: '今日消耗',
          value: fmtWeight(todayStats.consumption),
          key: 'todayConsumption' as StatsKey,
        },
        {
          title: '今日花费',
          value: fmtCost(todayStats.cost),
          key: 'todayCost' as StatsKey,
        },
      ]
    : [];

  // 库存统计（仅实时视图显示）
  const inventoryStats = stats.inventory
    ? [
        {
          title: '剩余总量',
          value: fmtWeight(stats.inventory.remaining),
          key: 'remaining' as StatsKey,
        },
        {
          title: '剩余价值',
          value: fmtCost(stats.inventory.remainingValue),
          key: 'remainingValue' as StatsKey,
        },
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
              extra={
                isSingleDayView && brewingDetails.length > 0 ? (
                  <div className="mt-1">
                    <div className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      明细
                    </div>
                    <BrewingDetails data={brewingDetails} />
                  </div>
                ) : undefined
              }
              onExplain={handleExplain}
            />

            {/* 今日（仅在非按日模式且有数据时显示） */}
            {todayStatsDisplay.length > 0 && (
              <StatsCard
                title="今日"
                stats={todayStatsDisplay}
                extra={
                  todayBrewingDetails.length > 0 ? (
                    <div className="mt-1">
                      <div className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        明细
                      </div>
                      <BrewingDetails data={todayBrewingDetails} />
                    </div>
                  ) : undefined
                }
                onExplain={handleExplain}
              />
            )}

            {/* 库存预测（仅实时视图） */}
            {!isHistoricalView &&
              stats.inventoryByType &&
              stats.inventoryByType.length > 0 && (
                <StatsCard
                  title="库存预测"
                  stats={inventoryStats}
                  extra={<InventoryForecast data={stats.inventoryByType} />}
                  onExplain={handleExplain}
                />
              )}
          </div>
        </div>
      </div>

      {/* 解释弹窗 */}
      <StatsExplainer
        explanation={explanation}
        onClose={handleCloseExplanation}
        anchorRect={anchorRect}
      />
    </div>
  );
};

export default StatsView;
