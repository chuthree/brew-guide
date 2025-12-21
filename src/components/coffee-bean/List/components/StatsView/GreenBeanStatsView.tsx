'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StatsViewProps,
  DateGroupingMode,
  TypeInventoryStats,
  BeanType,
} from './types';
import { formatNumber } from './utils';
import {
  globalCache,
  saveDateGroupingModePreference,
  saveSelectedDatePreference,
  saveSelectedDateByModePreference,
} from '../../preferences';
import StatsFilterBar from './StatsFilterBar';
import ConsumptionTrendChart from './ConsumptionTrendChart';
import {
  useGreenBeanStatsData,
  GreenBeanStatsMetadata,
  RoastingDetailItem,
} from './useGreenBeanStatsData';
import StatsExplainer, { StatsExplanation } from './StatsExplainer';
import {
  extractUniqueOrigins,
  extractUniqueVarieties,
  extractUniqueEstates,
  getBeanProcesses,
} from '@/lib/utils/beanVarietyUtils';
import { ExtendedCoffeeBean } from '../../types';

// 格式化辅助函数
const fmtWeight = (v: number) => (v > 0 ? `${formatNumber(v)}g` : '-');
const fmtCost = (v: number) => (v > 0 ? `¥${formatNumber(v)}` : '-');
const fmtDays = (v: number) => (v > 0 ? `${v}天` : '-');
const fmtPercent = (v: number) => (v > 0 ? `${formatNumber(v)}%` : '-');

// 生豆统计项的唯一标识
type GreenBeanStatsKey =
  | 'totalRoasted'
  | 'totalCost'
  | 'dailyRoasted'
  | 'dailyCost'
  | 'todayRoasted'
  | 'todayCost'
  | 'remaining'
  | 'remainingValue'
  | 'totalCapacity'
  | 'totalValue'
  | 'conversionRate'
  | 'beanCount';

// 生成解释内容
const createGreenBeanExplanation = (
  key: GreenBeanStatsKey,
  value: string,
  stats: ReturnType<typeof useGreenBeanStatsData>['stats'],
  metadata: GreenBeanStatsMetadata,
  isHistoricalView: boolean
): StatsExplanation | null => {
  const {
    validRoastingRecords,
    actualDays,
    beansWithPrice,
    beansTotal,
    todayRoastingRecords,
  } = metadata;

  switch (key) {
    case 'totalRoasted':
      return {
        title: isHistoricalView ? '烘焙量' : '总烘焙量',
        value,
        formula: '∑ 每条烘焙记录的烘焙量',
        dataSource: [
          { label: '有效烘焙记录', value: `${validRoastingRecords} 条` },
          { label: '统计天数', value: `${actualDays} 天` },
        ],
        note: validRoastingRecords < 3 ? '记录较少，数据仅供参考' : undefined,
      };

    case 'totalCost':
      return {
        title: isHistoricalView ? '花费' : '总花费',
        value,
        formula: '∑ (烘焙量 × 生豆单价/容量)',
        dataSource: [
          { label: '有效烘焙记录', value: `${validRoastingRecords} 条` },
          {
            label: '有价格的生豆',
            value: `${beansWithPrice}/${beansTotal} 款`,
          },
        ],
        note:
          beansWithPrice < beansTotal
            ? `${beansTotal - beansWithPrice} 款生豆缺少价格信息，未计入花费`
            : undefined,
      };

    case 'dailyRoasted':
      return {
        title: '日均烘焙',
        value,
        formula: '总烘焙量 ÷ 统计天数',
        dataSource: [
          { label: '总烘焙量', value: fmtWeight(stats.overview.totalRoasted) },
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
          { label: '总花费', value: fmtCost(stats.overview.totalCost) },
          { label: '统计天数', value: `${actualDays} 天` },
        ],
      };

    case 'todayRoasted':
      return {
        title: '今日烘焙',
        value,
        formula: '∑ 今日烘焙记录的烘焙量',
        dataSource: [
          { label: '今日烘焙记录', value: `${todayRoastingRecords} 条` },
        ],
      };

    case 'todayCost':
      return {
        title: '今日花费',
        value,
        formula: '∑ 今日 (烘焙量 × 生豆单价/容量)',
        dataSource: [
          { label: '今日烘焙记录', value: `${todayRoastingRecords} 条` },
          {
            label: '有价格的生豆',
            value: `${beansWithPrice}/${beansTotal} 款`,
          },
        ],
      };

    case 'remaining':
      return {
        title: '剩余总量',
        value,
        formula: '∑ 每款生豆的剩余量',
        dataSource: [{ label: '生豆数量', value: `${beansTotal} 款` }],
      };

    case 'remainingValue':
      return {
        title: '剩余价值',
        value,
        formula: '∑ (剩余量 × 单价/容量)',
        dataSource: [
          { label: '生豆数量', value: `${beansTotal} 款` },
          { label: '有价格信息', value: `${beansWithPrice} 款` },
        ],
      };

    case 'totalCapacity':
      return {
        title: '库存总量',
        value,
        formula: '∑ 每款生豆的购买容量',
        dataSource: [{ label: '生豆数量', value: `${beansTotal} 款` }],
        note: '所有生豆购买时的容量总和',
      };

    case 'totalValue':
      return {
        title: '总价值',
        value,
        formula: '∑ 每款生豆的购买价格',
        dataSource: [
          { label: '生豆数量', value: `${beansTotal} 款` },
          { label: '有价格信息', value: `${beansWithPrice} 款` },
        ],
      };

    case 'conversionRate':
      return {
        title: '烘焙转化率',
        value,
        formula: '(已烘焙量 ÷ 总购买量) × 100%',
        dataSource: [
          { label: '已烘焙量', value: fmtWeight(stats.overview.totalRoasted) },
          {
            label: '总购买量',
            value: fmtWeight(stats.inventory?.totalCapacity || 0),
          },
        ],
        note: '表示生豆已被烘焙使用的比例',
      };

    case 'beanCount':
      return {
        title: '生豆数量',
        value,
        formula: '未用完 / 总数',
        dataSource: [
          { label: '总数', value: '拥有的生豆总数量' },
          { label: '未用完', value: '剩余量 > 0 的生豆数量' },
        ],
      };

    default:
      return null;
  }
};

// 可点击的统计块组件
interface ClickableStatsBlockProps {
  title: string;
  value: string;
  statsKey: GreenBeanStatsKey;
  onExplain: (key: GreenBeanStatsKey, rect: DOMRect) => void;
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
      className="flex cursor-pointer flex-col justify-between rounded-md bg-neutral-100 p-3 transition-colors active:bg-neutral-300/40 dark:bg-neutral-800/40 dark:active:bg-neutral-700/40"
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
    <div className="rounded-md bg-neutral-100 p-3 dark:bg-neutral-800/40">
      <div className="mb-2 grid grid-cols-4 gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        <div>类型</div>
        <div className="text-right">剩余</div>
        <div className="text-right">日均烘焙</div>
        <div className="text-right">预计用完</div>
      </div>
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

// 烘焙明细组件
const RoastingDetails: React.FC<{ data: RoastingDetailItem[] }> = ({
  data,
}) => {
  if (data.length === 0) return null;

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <div className="rounded-md bg-neutral-100 p-3 dark:bg-neutral-800/40">
      <div className="mb-2 grid grid-cols-[2fr_1fr_1fr] gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        <div>生豆</div>
        <div className="text-right">烘焙量</div>
        <div className="text-right">时间</div>
      </div>
      <div className="space-y-1.5">
        {data.map(item => (
          <div
            key={item.id}
            className="grid grid-cols-[2fr_1fr_1fr] gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100"
          >
            <div className="truncate">{item.greenBeanName}</div>
            <div className="text-right">{fmtWeight(item.roastedAmount)}</div>
            <div className="text-right">{formatTime(item.timestamp)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 属性统计项组件
interface BeanAttributeItemProps {
  label: string;
  count: number;
}

const BeanAttributeItem: React.FC<BeanAttributeItemProps> = ({
  label,
  count,
}) => (
  <div className="grid grid-cols-[1fr_auto] gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
    <div className="truncate">{label}</div>
    <div className="text-right">{count}</div>
  </div>
);

// 属性卡片组件
interface AttributeCardProps {
  title: string;
  data: [string, number][];
  initialLimit?: number;
}

const AttributeCard: React.FC<AttributeCardProps> = ({
  title,
  data,
  initialLimit = 5,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [data, isExpanded]);

  if (data.length === 0) return null;

  const hasMore = data.length > initialLimit;
  const listItemHeight = 26;
  const listCollapsedHeight = initialLimit * listItemHeight;

  const handleToggle = () => {
    if (hasMore) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-md bg-neutral-100 p-3 dark:bg-neutral-800/40 ${hasMore ? 'cursor-pointer' : ''}`}
      onClick={handleToggle}
    >
      <div className="mb-2 grid grid-cols-[1fr_auto] gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        <div>{title}</div>
        <div className="text-right">数量</div>
      </div>
      <div
        ref={contentRef}
        className="space-y-1.5 overflow-hidden transition-[max-height] duration-300 ease-out"
        style={{
          maxHeight: isExpanded
            ? `${contentHeight}px`
            : `${listCollapsedHeight}px`,
        }}
      >
        {data.map(([label, count]) => (
          <BeanAttributeItem key={label} label={label} count={count} />
        ))}
      </div>
      {hasMore && !isExpanded && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b bg-linear-to-t from-[#F4F4F4] via-[#F4F4F4]/80 to-transparent pt-12 pb-3 dark:from-[#1D1D1D] dark:via-[#1D1D1D]/80" />
      )}
    </div>
  );
};

// 生豆数量统计组件
interface BeanCountStatsProps {
  beans: ExtendedCoffeeBean[];
  onExplain: (key: GreenBeanStatsKey, rect: DOMRect) => void;
}

const BeanCountStats: React.FC<BeanCountStatsProps> = ({
  beans,
  onExplain,
}) => {
  const countByType = useMemo(() => {
    const counts = {
      espresso: { total: 0, remaining: 0 },
      filter: { total: 0, remaining: 0 },
      omni: { total: 0, remaining: 0 },
    };

    beans.forEach(bean => {
      if (bean.beanType && bean.beanType in counts) {
        const type = bean.beanType as keyof typeof counts;
        counts[type].total++;

        const remaining = parseFloat(
          bean.remaining?.toString().replace(/[^\d.]/g, '') || '0'
        );
        if (remaining > 0) {
          counts[type].remaining++;
        }
      }
    });

    return counts;
  }, [beans]);

  const total =
    countByType.espresso.total +
    countByType.filter.total +
    countByType.omni.total;
  const totalRemaining =
    countByType.espresso.remaining +
    countByType.filter.remaining +
    countByType.omni.remaining;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onExplain('beanCount', rect);
  };

  if (total === 0) return null;

  return (
    <div
      data-stats-block
      onClick={handleClick}
      className="cursor-pointer rounded-md bg-neutral-100 p-3 transition-colors active:bg-neutral-300/40 dark:bg-neutral-800/40 dark:active:bg-neutral-700/40"
    >
      <div className="mb-2 grid grid-cols-[1fr_auto] gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        <div>生豆</div>
        <div className="text-right">未用完 / 总数</div>
      </div>
      <div className="space-y-1.5">
        {countByType.espresso.total > 0 && (
          <div className="grid grid-cols-[1fr_auto] gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
            <div>意式豆</div>
            <div className="text-right">
              {countByType.espresso.remaining} / {countByType.espresso.total}
            </div>
          </div>
        )}
        {countByType.filter.total > 0 && (
          <div className="grid grid-cols-[1fr_auto] gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
            <div>手冲豆</div>
            <div className="text-right">
              {countByType.filter.remaining} / {countByType.filter.total}
            </div>
          </div>
        )}
        {countByType.omni.total > 0 && (
          <div className="grid grid-cols-[1fr_auto] gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
            <div>全能豆</div>
            <div className="text-right">
              {countByType.omni.remaining} / {countByType.omni.total}
            </div>
          </div>
        )}
        <div className="grid grid-cols-[1fr_auto] gap-2 border-t border-neutral-300/40 pt-1.5 text-sm font-medium text-neutral-900 dark:border-neutral-600/40 dark:text-neutral-100">
          <div>总计</div>
          <div className="text-right">
            {totalRemaining} / {total}
          </div>
        </div>
      </div>
    </div>
  );
};

// 生豆属性统计组件
interface GreenBeanAttributeStatsProps {
  beans: ExtendedCoffeeBean[];
  selectedDate: string | null;
  dateGroupingMode: DateGroupingMode;
  onExplain: (key: GreenBeanStatsKey, rect: DOMRect) => void;
}

const GreenBeanAttributeStats: React.FC<GreenBeanAttributeStatsProps> = ({
  beans,
  selectedDate,
  dateGroupingMode,
  onExplain,
}) => {
  // 过滤生豆
  const greenBeans = useMemo(() => {
    return beans.filter(bean => bean.beanState === 'green');
  }, [beans]);

  // 根据日期范围过滤
  const filteredBeans = useMemo(() => {
    if (!selectedDate) return greenBeans;

    let startTime: number;
    let endTime: number;

    if (dateGroupingMode === 'year') {
      const year = parseInt(selectedDate);
      startTime = new Date(year, 0, 1).getTime();
      endTime = new Date(year + 1, 0, 1).getTime();
    } else if (dateGroupingMode === 'month') {
      const [year, month] = selectedDate.split('-').map(Number);
      startTime = new Date(year, month - 1, 1).getTime();
      endTime = new Date(year, month, 1).getTime();
    } else {
      const [year, month, day] = selectedDate.split('-').map(Number);
      startTime = new Date(year, month - 1, day).getTime();
      endTime = new Date(year, month - 1, day + 1).getTime();
    }

    return greenBeans.filter(bean => {
      const beanTime = bean.timestamp;
      return beanTime >= startTime && beanTime < endTime;
    });
  }, [greenBeans, selectedDate, dateGroupingMode]);

  // 计算产地统计
  const originStats = useMemo(() => {
    const originCount = new Map<string, number>();
    filteredBeans.forEach(bean => {
      const origins = extractUniqueOrigins([bean]);
      origins.forEach(origin => {
        originCount.set(origin, (originCount.get(origin) || 0) + 1);
      });
    });
    return Array.from(originCount.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredBeans]);

  // 计算庄园统计
  const estateStats = useMemo(() => {
    const estateCount = new Map<string, number>();
    filteredBeans.forEach(bean => {
      const estates = extractUniqueEstates([bean]);
      estates.forEach(estate => {
        estateCount.set(estate, (estateCount.get(estate) || 0) + 1);
      });
    });
    return Array.from(estateCount.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredBeans]);

  // 计算品种统计
  const varietyStats = useMemo(() => {
    const varietyCount = new Map<string, number>();
    filteredBeans.forEach(bean => {
      const varieties = extractUniqueVarieties([bean]);
      varieties.forEach(variety => {
        varietyCount.set(variety, (varietyCount.get(variety) || 0) + 1);
      });
    });
    return Array.from(varietyCount.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredBeans]);

  // 计算处理法统计
  const processStats = useMemo(() => {
    const processCount = new Map<string, number>();
    filteredBeans.forEach(bean => {
      const processes = getBeanProcesses(bean);
      processes.forEach(process => {
        processCount.set(process, (processCount.get(process) || 0) + 1);
      });
    });
    return Array.from(processCount.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredBeans]);

  if (
    originStats.length === 0 &&
    estateStats.length === 0 &&
    varietyStats.length === 0 &&
    processStats.length === 0
  ) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="space-y-3">
        <BeanCountStats beans={filteredBeans} onExplain={onExplain} />
        <AttributeCard title="产地" data={originStats} />
        {estateStats.length > 0 && (
          <AttributeCard title="庄园" data={estateStats} />
        )}
        <AttributeCard title="品种" data={varietyStats} />
        <AttributeCard title="处理法" data={processStats} />
      </div>
    </div>
  );
};

// 统计卡片组件
interface StatsCardProps {
  title: string;
  chart?: React.ReactNode;
  stats: Array<{ title: string; value: string; key: GreenBeanStatsKey }>;
  extra?: React.ReactNode;
  onExplain: (key: GreenBeanStatsKey, rect: DOMRect) => void;
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
            <div className="col-span-2 flex flex-col justify-between rounded-md bg-neutral-100 p-3 dark:bg-neutral-800/40">
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

// 主组件 Props
export interface GreenBeanStatsViewProps {
  beans: ExtendedCoffeeBean[];
  embedded?: boolean; // 是否嵌入模式（不渲染外层容器）- 已废弃，保留兼容
  // 生豆/熟豆切换相关
  beanStateType?: 'roasted' | 'green';
  onBeanStateTypeChange?: (type: 'roasted' | 'green') => void;
  showBeanStateSwitch?: boolean;
  // 内容模式 props（从父组件共享状态）
  contentModeProps?: {
    dateGroupingMode: DateGroupingMode;
    onDateGroupingModeChange: (mode: DateGroupingMode) => void;
    selectedDate: string | null;
    onSelectedDateChange: (date: string | null) => void;
  };
}

const GreenBeanStatsView: React.FC<GreenBeanStatsViewProps> = ({
  beans,
  beanStateType = 'green',
  onBeanStateTypeChange,
  showBeanStateSwitch = false,
  contentModeProps,
}) => {
  // 是否为内容模式（由父组件管理状态）
  const isContentMode = !!contentModeProps;

  // 筛选状态 - 内容模式使用外部状态，独立模式使用本地状态
  const [localDateGroupingMode, setLocalDateGroupingMode] =
    useState<DateGroupingMode>(globalCache.dateGroupingMode);
  const [localSelectedDate, setLocalSelectedDate] = useState<string | null>(
    globalCache.selectedDate
  );

  // 根据模式选择状态
  const dateGroupingMode = isContentMode
    ? contentModeProps.dateGroupingMode
    : localDateGroupingMode;
  const selectedDate = isContentMode
    ? contentModeProps.selectedDate
    : localSelectedDate;

  // 解释弹窗状态
  const [explanation, setExplanation] = useState<StatsExplanation | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [activeKey, setActiveKey] = useState<GreenBeanStatsKey | null>(null);

  // 使用生豆统计数据 hook
  const {
    availableDates,
    stats,
    todayStats,
    trendData,
    isHistoricalView,
    effectiveDateRange,
    metadata,
    roastingDetails,
  } = useGreenBeanStatsData(beans, dateGroupingMode, selectedDate);

  // 生成日期范围标签
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
    const endDate = new Date(effectiveDateRange.end - 1);

    const isSameDay =
      startDate.getFullYear() === endDate.getFullYear() &&
      startDate.getMonth() === endDate.getMonth() &&
      startDate.getDate() === endDate.getDate();

    if (isSameDay) return formatFull(startDate);

    if (startDate.getFullYear() !== endDate.getFullYear()) {
      return `${formatFull(startDate)} - ${formatFull(endDate)}`;
    }
    return `${formatFull(startDate)} - ${formatShort(endDate)}`;
  }, [effectiveDateRange]);

  // 处理点击解释
  const handleExplain = useCallback(
    (key: GreenBeanStatsKey, rect: DOMRect) => {
      if (activeKey === key) {
        setExplanation(null);
        setAnchorRect(null);
        setActiveKey(null);
        return;
      }

      let value = '-';
      switch (key) {
        case 'totalRoasted':
          value = fmtWeight(stats.overview.totalRoasted);
          break;
        case 'totalCost':
          value = fmtCost(stats.overview.totalCost);
          break;
        case 'dailyRoasted':
          value = fmtWeight(stats.overview.dailyRoasted);
          break;
        case 'dailyCost':
          value = fmtCost(stats.overview.dailyCost);
          break;
        case 'todayRoasted':
          value = fmtWeight(todayStats?.roasted || 0);
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
        case 'totalCapacity':
          value = fmtWeight(stats.inventory?.totalCapacity || 0);
          break;
        case 'totalValue':
          value = fmtCost(stats.inventory?.totalValue || 0);
          break;
        case 'conversionRate':
          value = fmtPercent(stats.overview.conversionRate);
          break;
        case 'beanCount':
          value = '';
          break;
      }

      const exp = createGreenBeanExplanation(
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

  const handleCloseExplanation = useCallback(() => {
    setExplanation(null);
    setAnchorRect(null);
    setActiveKey(null);
  }, []);

  // 设置日期分组模式（根据模式选择）
  const setDateGroupingMode = isContentMode
    ? contentModeProps.onDateGroupingModeChange
    : setLocalDateGroupingMode;

  // 设置选中日期（根据模式选择）
  const setSelectedDate = isContentMode
    ? contentModeProps.onSelectedDateChange
    : setLocalSelectedDate;

  // 处理分组模式变更
  const handleDateGroupingModeChange = (mode: DateGroupingMode) => {
    globalCache.selectedDates[dateGroupingMode] = selectedDate;
    saveSelectedDateByModePreference(dateGroupingMode, selectedDate);

    setDateGroupingMode(mode);
    globalCache.dateGroupingMode = mode;
    saveDateGroupingModePreference(mode);

    const previousSelection = globalCache.selectedDates[mode];
    setSelectedDate(previousSelection);
    globalCache.selectedDate = previousSelection;
    saveSelectedDatePreference(previousSelection);
  };

  // 自动切换模式（仅独立模式）
  useEffect(() => {
    if (
      !isContentMode &&
      dateGroupingMode === 'year' &&
      availableDates.length <= 1
    ) {
      handleDateGroupingModeChange('month');
    }
  }, [dateGroupingMode, availableDates.length, isContentMode]);

  // 保存选中日期（仅独立模式）
  useEffect(() => {
    if (!isContentMode) {
      globalCache.selectedDate = selectedDate;
      saveSelectedDatePreference(selectedDate);
      globalCache.selectedDates[dateGroupingMode] = selectedDate;
      saveSelectedDateByModePreference(dateGroupingMode, selectedDate);
    }
  }, [selectedDate, dateGroupingMode, isContentMode]);

  // 验证 selectedDate 是否在可用日期列表中（仅独立模式）
  useEffect(() => {
    if (
      !isContentMode &&
      selectedDate !== null &&
      availableDates.length > 0 &&
      !availableDates.includes(selectedDate)
    ) {
      setSelectedDate(null);
    }
  }, [availableDates, selectedDate, isContentMode]);

  // 检查是否有生豆
  const greenBeans = useMemo(() => {
    return beans.filter(bean => bean.beanState === 'green');
  }, [beans]);

  // 空状态
  if (greenBeans.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
        [ 有生豆数据后，再来查看吧～ ]
      </div>
    );
  }

  const showTrendChart = trendData.length > 0;
  const isSingleDayView = dateGroupingMode === 'day' && selectedDate !== null;

  // 概览统计
  const overviewStats = isSingleDayView
    ? [
        {
          title: '烘焙量',
          value: fmtWeight(stats.overview.totalRoasted),
          key: 'totalRoasted' as GreenBeanStatsKey,
        },
        {
          title: '花费',
          value: fmtCost(stats.overview.totalCost),
          key: 'totalCost' as GreenBeanStatsKey,
        },
      ]
    : [
        ...(stats.inventory
          ? [
              {
                title: '库存总量',
                value: fmtWeight(stats.inventory.totalCapacity),
                key: 'totalCapacity' as GreenBeanStatsKey,
              },
              {
                title: '总价值',
                value: fmtCost(stats.inventory.totalValue),
                key: 'totalValue' as GreenBeanStatsKey,
              },
            ]
          : []),
        {
          title: '总烘焙量',
          value: fmtWeight(stats.overview.totalRoasted),
          key: 'totalRoasted' as GreenBeanStatsKey,
        },
        {
          title: '总花费',
          value: fmtCost(stats.overview.totalCost),
          key: 'totalCost' as GreenBeanStatsKey,
        },
      ];

  // 今日统计
  const hasTodayData = todayStats && todayStats.roasted > 0;
  const todayStatsDisplay = hasTodayData
    ? [
        {
          title: '今日烘焙',
          value: fmtWeight(todayStats.roasted),
          key: 'todayRoasted' as GreenBeanStatsKey,
        },
        {
          title: '今日花费',
          value: fmtCost(todayStats.cost),
          key: 'todayCost' as GreenBeanStatsKey,
        },
      ]
    : [];

  // 库存统计
  const inventoryStats = stats.inventory
    ? [
        {
          title: '剩余总量',
          value: fmtWeight(stats.inventory.remaining),
          key: 'remaining' as GreenBeanStatsKey,
        },
        {
          title: '剩余价值',
          value: fmtCost(stats.inventory.remainingValue),
          key: 'remainingValue' as GreenBeanStatsKey,
        },
      ]
    : [];

  // 统计内容
  const statsContent = (
    <>
      {/* 仅在独立模式下渲染 StatsFilterBar */}
      {!isContentMode && (
        <div className="sticky top-0 z-10 bg-neutral-50 dark:bg-neutral-900">
          <StatsFilterBar
            dateGroupingMode={dateGroupingMode}
            onDateGroupingModeChange={handleDateGroupingModeChange}
            selectedDate={selectedDate}
            onDateClick={setSelectedDate}
            availableDates={availableDates}
            dateRangeLabel={dateRangeLabel}
            beanStateType={beanStateType}
            onBeanStateTypeChange={onBeanStateTypeChange}
            showBeanStateSwitch={showBeanStateSwitch}
          />
        </div>
      )}

      <div className={isContentMode ? 'px-6' : 'mt-5 px-6'}>
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
                isSingleDayView && roastingDetails.length > 0 ? (
                  <RoastingDetails data={roastingDetails} />
                ) : undefined
              }
              onExplain={handleExplain}
            />

            {/* 今日 */}
            {todayStatsDisplay.length > 0 && (
              <StatsCard
                title="今日"
                stats={todayStatsDisplay}
                onExplain={handleExplain}
              />
            )}

            {/* 库存预测 */}
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

            {/* 属性统计 */}
            {!isSingleDayView && (
              <>
                <div className="mb-5 border-t border-neutral-200/40 dark:border-neutral-700/30" />
                <GreenBeanAttributeStats
                  beans={beans}
                  selectedDate={selectedDate}
                  dateGroupingMode={dateGroupingMode}
                  onExplain={handleExplain}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <StatsExplainer
        explanation={explanation}
        onClose={handleCloseExplanation}
        anchorRect={anchorRect}
      />
    </>
  );

  // 内容模式：返回不包裹容器的内容
  if (isContentMode) {
    return statsContent;
  }

  // 渲染完整容器
  return (
    <div className="coffee-bean-stats-container bg-neutral-50 dark:bg-neutral-900">
      {statsContent}
    </div>
  );
};

export default GreenBeanStatsView;
