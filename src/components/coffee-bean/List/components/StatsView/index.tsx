'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { GrainGradient } from '@paper-design/shaders-react';
import {
  StatsViewProps,
  DateGroupingMode,
  TypeInventoryStats,
  BrewingDetailItem,
} from './types';
import { formatNumber } from './utils';
import {
  globalCache,
  saveDateGroupingModePreference,
  saveSelectedDatePreference,
  saveSelectedDateByModePreference,
  saveStatsBeanStatePreference,
  getStatsBeanStatePreference,
  StatsBeanStateType,
} from '../../globalCache';
import StatsFilterBar from './StatsFilterBar';
import ConsumptionTrendChart from './ConsumptionTrendChart';
import { useStatsData, StatsMetadata } from './useStatsData';
import { useGreenBeanStatsData } from './useGreenBeanStatsData';
import StatsExplainer, { StatsExplanation } from './StatsExplainer';
import {
  extractUniqueOrigins,
  extractUniqueVarieties,
  getBeanProcesses,
  getBeanFlavors,
  getBeanEstates,
} from '@/lib/utils/beanVarietyUtils';
import { ExtendedCoffeeBean } from '../../types';
import GreenBeanStatsView from './GreenBeanStatsView';
import YearlyReviewDrawer from './YearlyReviewDrawer';
import { Storage } from '@/lib/core/storage';

// 格式化辅助函数
const fmtWeight = (v: number) => (v > 0 ? `${formatNumber(v)}g` : '-');
const fmtCost = (v: number) => (v > 0 ? `¥${formatNumber(v)}` : '-');
const fmtDays = (v: number) => (v > 0 ? `${v}天` : '-');

// 年度回顾预览入口组件
interface YearlyReviewPreviewCardProps {
  onClick: () => void;
  onDismiss: () => void;
}

// 预览卡片的主题颜色 - 薄荷青绿
const PREVIEW_CARD_COLORS: [string, string, string, string] = [
  '#00B894',
  '#55EFC4',
  '#00CEC9',
  '#81ECEC',
];

const YearlyReviewPreviewCard: React.FC<YearlyReviewPreviewCardProps> = ({
  onClick,
  onDismiss,
}) => {
  const currentYear = new Date().getFullYear();

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss();
  };

  return (
    <motion.div
      onClick={onClick}
      className="relative z-0 cursor-pointer overflow-hidden rounded-md shadow"
      style={{ height: '72px', isolation: 'isolate' }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {/* GrainGradient 特效背景 */}
      <div className="absolute inset-0">
        <GrainGradient
          colors={PREVIEW_CARD_COLORS}
          colorBack={PREVIEW_CARD_COLORS[2]}
          shape="wave"
          speed={0.6}
          softness={0.8}
          intensity={0.5}
          noise={0.08}
          scale={2}
          rotation={90}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        />
      </div>

      {/* 关闭按钮 - 右上角 */}
      <motion.button
        onClick={handleDismiss}
        className="absolute top-2 right-2 z-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-white/70 backdrop-blur-sm transition-colors hover:bg-white/25 hover:text-white"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <X size={12} />
      </motion.button>

      {/* 内容 */}
      <div className="relative z-1 flex h-full items-center px-4">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold tracking-tight text-white">
            Replay'{String(currentYear).slice(-2)}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

// 统计项的唯一标识
type StatsKey =
  | 'totalConsumption'
  | 'totalCost'
  | 'dailyConsumption'
  | 'dailyCost'
  | 'todayConsumption'
  | 'todayCost'
  | 'remaining'
  | 'remainingValue'
  | 'totalCapacity'
  | 'totalValue'
  | 'beanCount';

// 生成解释内容的工厂函数
const createExplanation = (
  key: StatsKey,
  value: string,
  stats: ReturnType<typeof useStatsData>['stats'],
  metadata: StatsMetadata,
  isHistoricalView: boolean,
  dateRangeLabel?: string
): StatsExplanation | null => {
  const {
    validNotes,
    actualDays,
    beansWithPrice,
    beansTotal,
    todayNotes,
    useFallbackStats,
  } = metadata;

  switch (key) {
    case 'totalConsumption':
      return {
        title: isHistoricalView ? '消耗' : '总消耗',
        value,
        formula: isHistoricalView
          ? '∑ 每条冲煮记录的咖啡用量'
          : '∑ (购买容量 - 剩余量)',
        dataSource: isHistoricalView
          ? [
              { label: '有效冲煮记录', value: `${validNotes} 条` },
              { label: '统计天数', value: `${actualDays} 天` },
            ]
          : [
              { label: '咖啡豆数量', value: `${beansTotal} 款` },
              { label: '统计天数', value: `${actualDays} 天` },
            ],
        note: isHistoricalView
          ? validNotes < 5
            ? '记录较少，数据仅供参考'
            : undefined
          : '基于咖啡豆容量变化计算，不受冲煮记录影响',
      };

    case 'totalCost':
      return {
        title: isHistoricalView ? '花费' : '总花费',
        value,
        formula: isHistoricalView
          ? '∑ (用量 × 单价/容量)'
          : '∑ (消耗量 × 单价/容量)',
        dataSource: isHistoricalView
          ? [
              { label: '有效冲煮记录', value: `${validNotes} 条` },
              {
                label: '有价格的咖啡豆',
                value: `${beansWithPrice}/${beansTotal} 款`,
              },
            ]
          : [
              { label: '咖啡豆数量', value: `${beansTotal} 款` },
              {
                label: '有价格的咖啡豆',
                value: `${beansWithPrice}/${beansTotal} 款`,
              },
            ],
        note:
          beansWithPrice < beansTotal
            ? `${beansTotal - beansWithPrice} 款咖啡豆缺少价格信息，未计入花费`
            : isHistoricalView
              ? undefined
              : '基于咖啡豆容量变化计算',
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

    case 'totalCapacity':
      return {
        title: '库存总量',
        value,
        formula: '∑ 每款咖啡豆的购买容量',
        dataSource: [{ label: '咖啡豆数量', value: `${beansTotal} 款` }],
        note: '所有咖啡豆购买时的容量总和',
      };

    case 'totalValue':
      return {
        title: '总价值',
        value,
        formula: '∑ 每款咖啡豆的购买价格',
        dataSource: [
          { label: '咖啡豆数量', value: `${beansTotal} 款` },
          { label: '有价格信息', value: `${beansWithPrice} 款` },
        ],
        note:
          beansWithPrice < beansTotal
            ? '部分咖啡豆缺少价格信息，未计入总价值'
            : '所有咖啡豆购买时的价格总和',
      };

    case 'beanCount':
      return {
        title: '咖啡豆数量',
        value,
        formula: '未用完 / 总数',
        dataSource: [
          { label: '总数', value: '拥有的咖啡豆总数量' },
          { label: '未用完', value: '剩余量 > 0 的咖啡豆数量' },
        ],
        note: dateRangeLabel
          ? `基于咖啡豆添加日期的筛选范围进行统计`
          : '基于咖啡豆添加日期的筛选范围进行统计',
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
    <div className="rounded-md bg-neutral-100 p-3 dark:bg-neutral-800/40">
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

// 咖啡豆属性统计项组件
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

// 单个属性统计卡片组件（支持展开/收起）
interface AttributeCardProps {
  title: string;
  data: [string, number][];
  initialLimit?: number;
  displayMode?: 'list' | 'tags'; // 新增：显示模式
}

const AttributeCard: React.FC<AttributeCardProps> = ({
  title,
  data,
  initialLimit = 5,
  displayMode = 'list',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>(0);

  // 测量内容实际高度
  useEffect(() => {
    if (contentRef.current) {
      // 获取实际滚动高度
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [data, isExpanded]);

  if (data.length === 0) return null;

  const hasMore = data.length > initialLimit;

  const handleToggle = () => {
    if (hasMore) {
      setIsExpanded(!isExpanded);
    }
  };

  // 标签模式：收起时的初始高度
  const tagsCollapsedHeight = 120;
  // 列表模式：每行高度约 26px (包含 1.5 的 space-y)
  const listItemHeight = 26;
  const listCollapsedHeight = initialLimit * listItemHeight;

  // 标签模式
  if (displayMode === 'tags') {
    return (
      <div
        className={`relative overflow-hidden rounded-md bg-neutral-100 p-3 dark:bg-neutral-800/40 ${hasMore ? 'cursor-pointer' : ''}`}
        onClick={handleToggle}
      >
        {/* 表头 */}
        <div className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {title}
        </div>
        {/* 标签容器 */}
        <div
          ref={contentRef}
          className="flex flex-wrap gap-2.5 overflow-hidden transition-[max-height] duration-300 ease-out"
          style={{
            maxHeight: isExpanded
              ? `${contentHeight}px`
              : `${tagsCollapsedHeight}px`,
          }}
        >
          {data.map(([label, count]) => (
            <div
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full bg-neutral-200/50 px-3 py-1.5 dark:bg-neutral-800/50"
            >
              <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                {label}
              </span>
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {count}
              </span>
            </div>
          ))}
        </div>
        {/* 渐变遮罩 */}
        {hasMore && !isExpanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b bg-linear-to-t from-[#F4F4F4] via-[#F4F4F4]/80 to-transparent pt-12 pb-3 dark:from-[#1D1D1D] dark:via-[#1D1D1D]/80" />
        )}
      </div>
    );
  }

  // 列表模式
  return (
    <div
      className={`relative overflow-hidden rounded-md bg-neutral-100 p-3 dark:bg-neutral-800/40 ${hasMore ? 'cursor-pointer' : ''}`}
      onClick={handleToggle}
    >
      {/* 表头 */}
      <div className="mb-2 grid grid-cols-[1fr_auto] gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        <div>{title}</div>
        <div className="text-right">数量</div>
      </div>
      {/* 数据行容器 - 添加动画 */}
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
      {/* 渐变遮罩 */}
      {hasMore && !isExpanded && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b bg-linear-to-t from-[#F4F4F4] via-[#F4F4F4]/80 to-transparent pt-12 pb-3 dark:from-[#1D1D1D] dark:via-[#1D1D1D]/80" />
      )}
    </div>
  );
};

// 咖啡豆数量统计组件
interface BeanCountStatsProps {
  beans: ExtendedCoffeeBean[];
  onExplain: (key: StatsKey, rect: DOMRect) => void;
}

const BeanCountStats: React.FC<BeanCountStatsProps> = ({
  beans,
  onExplain,
}) => {
  // 按类型统计数量和未用完数量
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

        // 判断是否还有剩余（剩余量大于0）
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
      {/* 表头 */}
      <div className="mb-2 grid grid-cols-[1fr_auto] gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        <div>咖啡豆</div>
        <div className="text-right">未用完 / 总数</div>
      </div>
      {/* 数据行 */}
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
        {/* 总计 */}
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

// 咖啡豆属性统计组件
interface BeanAttributeStatsProps {
  beans: ExtendedCoffeeBean[];
  selectedDate: string | null;
  dateGroupingMode: DateGroupingMode;
  onExplain: (key: StatsKey, rect: DOMRect) => void;
}

const BeanAttributeStats: React.FC<BeanAttributeStatsProps> = ({
  beans,
  selectedDate,
  dateGroupingMode,
  onExplain,
}) => {
  // 先过滤掉生豆，只统计熟豆
  const roastedBeans = useMemo(() => {
    return beans.filter(bean => (bean.beanState || 'roasted') === 'roasted');
  }, [beans]);

  // 根据日期范围过滤咖啡豆（基于添加时间）
  const filteredBeans = useMemo(() => {
    if (!selectedDate) {
      // 全部视图：不过滤
      return roastedBeans;
    }

    // 计算时间范围
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
      // day
      const [year, month, day] = selectedDate.split('-').map(Number);
      startTime = new Date(year, month - 1, day).getTime();
      endTime = new Date(year, month - 1, day + 1).getTime();
    }

    // 过滤咖啡豆（基于日期范围）
    return roastedBeans.filter(bean => {
      const beanTime = bean.timestamp;
      return beanTime >= startTime && beanTime < endTime;
    });
  }, [roastedBeans, selectedDate, dateGroupingMode]);
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
      const estates = getBeanEstates(bean);
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

  // 计算风味统计
  const flavorStats = useMemo(() => {
    const flavorCount = new Map<string, number>();
    filteredBeans.forEach(bean => {
      const flavors = getBeanFlavors(bean);
      flavors.forEach(flavor => {
        flavorCount.set(flavor, (flavorCount.get(flavor) || 0) + 1);
      });
    });
    return Array.from(flavorCount.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredBeans]);

  // 如果所有统计都为空，不显示
  if (
    originStats.length === 0 &&
    estateStats.length === 0 &&
    varietyStats.length === 0 &&
    processStats.length === 0 &&
    flavorStats.length === 0
  ) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="space-y-3">
        {/* 咖啡豆数量统计 */}
        <BeanCountStats beans={filteredBeans} onExplain={onExplain} />

        {/* 产地 */}
        <AttributeCard title="产地" data={originStats} />

        {/* 庄园 */}
        {estateStats.length > 0 && (
          <AttributeCard title="庄园" data={estateStats} />
        )}

        {/* 品种 */}
        <AttributeCard title="品种" data={varietyStats} />

        {/* 处理法 */}
        <AttributeCard title="处理法" data={processStats} />

        {/* 风味 */}
        <AttributeCard title="风味" data={flavorStats} displayMode="tags" />
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

// 熟豆统计视图 Props
interface RoastedBeanStatsViewProps extends StatsViewProps {
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

// 熟豆统计视图（原 StatsView）
const RoastedBeanStatsView: React.FC<RoastedBeanStatsViewProps> = ({
  beans,
  beanStateType = 'roasted',
  onBeanStateTypeChange,
  showBeanStateSwitch = false,
  contentModeProps,
}) => {
  // 是否为内容模式（由父组件管理状态）
  const isContentMode = !!contentModeProps;

  // 年度回顾抽屉状态
  const [isYearlyReviewOpen, setIsYearlyReviewOpen] = useState(false);
  // 年度回顾预览卡片是否被关闭
  const [isYearlyReviewDismissed, setIsYearlyReviewDismissed] = useState(true);

  // 初始化时从 Storage 读取关闭状态
  useEffect(() => {
    const loadDismissState = async () => {
      try {
        const dismissed = await Storage.get('yearlyReviewPreviewDismissed');
        // 如果没有存储值或值为 'false'，则显示卡片
        setIsYearlyReviewDismissed(dismissed === 'true');
      } catch {
        setIsYearlyReviewDismissed(false);
      }
    };
    loadDismissState();
  }, []);

  // 关闭预览卡片
  const handleDismissYearlyReview = useCallback(async () => {
    setIsYearlyReviewDismissed(true);
    await Storage.set('yearlyReviewPreviewDismissed', 'true');
  }, []);

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
  } = useStatsData(beans, dateGroupingMode, selectedDate);

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
      return `${formatFull(startDate)} - ${formatFull(endDate)}`;
    }
    return `${formatFull(startDate)} - ${formatShort(endDate)}`;
  }, [effectiveDateRange]);

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
        case 'totalCapacity':
          value = fmtWeight(stats.inventory?.totalCapacity || 0);
          break;
        case 'totalValue':
          value = fmtCost(stats.inventory?.totalValue || 0);
          break;
        case 'beanCount':
          value = ''; // 咖啡豆数量不需要单独的值
          break;
      }

      const exp = createExplanation(
        key,
        value,
        stats,
        metadata,
        isHistoricalView,
        dateRangeLabel
      );
      setExplanation(exp);
      setAnchorRect(rect);
      setActiveKey(key);
    },
    [stats, todayStats, metadata, isHistoricalView, activeKey, dateRangeLabel]
  );

  // 关闭解释弹窗
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
    // 保存当前模式下的选择到记忆
    globalCache.selectedDates[dateGroupingMode] = selectedDate;
    saveSelectedDateByModePreference(dateGroupingMode, selectedDate);

    // 切换到新模式
    setDateGroupingMode(mode);
    globalCache.dateGroupingMode = mode;
    saveDateGroupingModePreference(mode);

    // 恢复新模式之前的选择（如果有的话）
    const previousSelection = globalCache.selectedDates[mode];
    setSelectedDate(previousSelection);
    globalCache.selectedDate = previousSelection;
    saveSelectedDatePreference(previousSelection);
  };

  // 当只有一年数据时，自动从按年统计切换到按月统计（仅独立模式）
  useEffect(() => {
    if (
      !isContentMode &&
      dateGroupingMode === 'year' &&
      availableDates.length <= 1
    ) {
      // 只有一年或没有数据，自动切换到按月统计
      handleDateGroupingModeChange('month');
    }
  }, [dateGroupingMode, availableDates.length, isContentMode]);

  // 监听 selectedDate 变化并保存（仅独立模式）
  useEffect(() => {
    if (!isContentMode) {
      globalCache.selectedDate = selectedDate;
      saveSelectedDatePreference(selectedDate);
      // 同时保存到当前模式的记忆
      globalCache.selectedDates[dateGroupingMode] = selectedDate;
      saveSelectedDateByModePreference(dateGroupingMode, selectedDate);
    }
  }, [selectedDate, dateGroupingMode, isContentMode]);

  // 验证 selectedDate 是否在可用日期列表中，如果不在则重置（仅独立模式）
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

  // 空状态 - 只检查熟豆
  const roastedBeans = useMemo(() => {
    return beans.filter(bean => (bean.beanState || 'roasted') === 'roasted');
  }, [beans]);

  if (roastedBeans.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
        [ 有熟豆数据后，再来查看吧～ ]
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
        // 第一行：购买数据
        ...(stats.inventory
          ? [
              {
                title: '库存总量',
                value: fmtWeight(stats.inventory.totalCapacity),
                key: 'totalCapacity' as StatsKey,
              },
              {
                title: '总价值',
                value: fmtCost(stats.inventory.totalValue),
                key: 'totalValue' as StatsKey,
              },
            ]
          : []),
        // 第二行：消耗数据
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
            {/* 年度回顾入口 - 仅在全部视图（selectedDate 为 null）且未被关闭时显示 */}
            {!selectedDate && !isYearlyReviewDismissed && (
              <YearlyReviewPreviewCard
                onClick={() => setIsYearlyReviewOpen(true)}
                onDismiss={handleDismissYearlyReview}
              />
            )}

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
                  <BrewingDetails data={brewingDetails} />
                ) : undefined
              }
              onExplain={handleExplain}
            />

            {/* 今日（仅在非按日模式且有数据时显示） */}
            {todayStatsDisplay.length > 0 && (
              <StatsCard
                title="今日"
                stats={todayStatsDisplay}
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

            {/* 咖啡豆属性统计（单日视图不显示） */}
            {!isSingleDayView && (
              <>
                {/* 分割线 */}
                <div className="mb-5 border-t border-neutral-200/40 dark:border-neutral-700/30" />

                <BeanAttributeStats
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

      {/* 解释弹窗 */}
      <StatsExplainer
        explanation={explanation}
        onClose={handleCloseExplanation}
        anchorRect={anchorRect}
      />

      {/* 年度回顾抽屉 */}
      <YearlyReviewDrawer
        isOpen={isYearlyReviewOpen}
        onClose={() => setIsYearlyReviewOpen(false)}
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

// 组合统计视图 - 共享 StatsFilterBar，内容区域平滑切换
interface CombinedStatsViewProps {
  beans: ExtendedCoffeeBean[];
  showEmptyBeans?: boolean;
  beanStateType: StatsBeanStateType;
  onBeanStateTypeChange: (state: StatsBeanStateType) => void;
}

const CombinedStatsView: React.FC<CombinedStatsViewProps> = ({
  beans,
  showEmptyBeans,
  beanStateType,
  onBeanStateTypeChange,
}) => {
  // 共享的日期筛选状态
  const [dateGroupingMode, setDateGroupingMode] = useState<DateGroupingMode>(
    globalCache.dateGroupingMode
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(
    globalCache.selectedDate
  );

  // 使用两个 hook 获取数据（根据当前类型决定使用哪个）
  const roastedStatsData = useStatsData(beans, dateGroupingMode, selectedDate);
  const greenStatsData = useGreenBeanStatsData(
    beans,
    dateGroupingMode,
    selectedDate
  );

  // 根据当前类型选择数据
  const currentStatsData =
    beanStateType === 'roasted' ? roastedStatsData : greenStatsData;
  const { availableDates, effectiveDateRange } = currentStatsData;

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

  // 处理分组模式变更
  const handleDateGroupingModeChange = useCallback(
    (mode: DateGroupingMode) => {
      // 保存当前模式下的选择到记忆
      globalCache.selectedDates[dateGroupingMode] = selectedDate;
      saveSelectedDateByModePreference(dateGroupingMode, selectedDate);

      // 切换到新模式
      setDateGroupingMode(mode);
      globalCache.dateGroupingMode = mode;
      saveDateGroupingModePreference(mode);

      // 恢复新模式之前的选择（如果有的话）
      const previousSelection = globalCache.selectedDates[mode];
      setSelectedDate(previousSelection);
      globalCache.selectedDate = previousSelection;
      saveSelectedDatePreference(previousSelection);
    },
    [dateGroupingMode, selectedDate]
  );

  // 处理日期选择变更
  const handleSelectedDateChange = useCallback(
    (date: string | null) => {
      setSelectedDate(date);
      globalCache.selectedDate = date;
      saveSelectedDatePreference(date);
      // 同时保存到当前模式的记忆
      globalCache.selectedDates[dateGroupingMode] = date;
      saveSelectedDateByModePreference(dateGroupingMode, date);
    },
    [dateGroupingMode]
  );

  // 当只有一年数据时，自动从按年统计切换到按月统计
  useEffect(() => {
    if (dateGroupingMode === 'year' && availableDates.length <= 1) {
      handleDateGroupingModeChange('month');
    }
  }, [dateGroupingMode, availableDates.length, handleDateGroupingModeChange]);

  // 验证 selectedDate 是否在可用日期列表中，如果不在则重置
  useEffect(() => {
    if (
      selectedDate !== null &&
      availableDates.length > 0 &&
      !availableDates.includes(selectedDate)
    ) {
      handleSelectedDateChange(null);
    }
  }, [availableDates, selectedDate, handleSelectedDateChange]);

  // 内容模式 props
  const contentModeProps = useMemo(
    () => ({
      dateGroupingMode,
      onDateGroupingModeChange: handleDateGroupingModeChange,
      selectedDate,
      onSelectedDateChange: handleSelectedDateChange,
    }),
    [
      dateGroupingMode,
      handleDateGroupingModeChange,
      selectedDate,
      handleSelectedDateChange,
    ]
  );

  return (
    <div className="coffee-bean-stats-container bg-neutral-50 dark:bg-neutral-900">
      {/* 共享的 StatsFilterBar */}
      <div className="sticky top-0 z-10 bg-neutral-50 dark:bg-neutral-900">
        <StatsFilterBar
          dateGroupingMode={dateGroupingMode}
          onDateGroupingModeChange={handleDateGroupingModeChange}
          selectedDate={selectedDate}
          onDateClick={handleSelectedDateChange}
          availableDates={availableDates}
          dateRangeLabel={dateRangeLabel}
          beanStateType={beanStateType}
          onBeanStateTypeChange={onBeanStateTypeChange}
          showBeanStateSwitch
        />
      </div>

      {/* 内容区域 */}
      <div className="mt-5">
        {beanStateType === 'roasted' ? (
          <RoastedBeanStatsView
            beans={beans}
            showEmptyBeans={showEmptyBeans ?? false}
            contentModeProps={contentModeProps}
          />
        ) : (
          <GreenBeanStatsView
            beans={beans}
            contentModeProps={contentModeProps}
          />
        )}
      </div>
    </div>
  );
};

// 主 StatsView 组件 - 包含生豆/熟豆切换
const StatsView: React.FC<StatsViewProps> = ({
  beans,
  showEmptyBeans,
  enableGreenBeanInventory = false,
}) => {
  // 初始化时从缓存读取状态
  const [beanStateType, setBeanStateType] = useState<StatsBeanStateType>(() => {
    // 从 localStorage 读取
    const saved = getStatsBeanStatePreference();
    globalCache.statsBeanState = saved;
    return saved;
  });

  // 检查是否有生豆和熟豆（仅当生豆库启用时才检查生豆）
  const hasGreenBeans = useMemo(() => {
    if (!enableGreenBeanInventory) return false;
    return beans.some(bean => bean.beanState === 'green');
  }, [beans, enableGreenBeanInventory]);

  const hasRoastedBeans = useMemo(() => {
    return beans.some(bean => (bean.beanState || 'roasted') === 'roasted');
  }, [beans]);

  // 处理状态切换
  const handleBeanStateChange = useCallback((state: StatsBeanStateType) => {
    setBeanStateType(state);
    globalCache.statsBeanState = state;
    saveStatsBeanStatePreference(state);
  }, []);

  // 如果只有一种类型的豆子，自动切换到该类型
  // 如果生豆库被禁用，强制切换回熟豆
  useEffect(() => {
    if (!enableGreenBeanInventory && beanStateType === 'green') {
      handleBeanStateChange('roasted');
    } else if (hasGreenBeans && !hasRoastedBeans && beanStateType !== 'green') {
      handleBeanStateChange('green');
    } else if (
      hasRoastedBeans &&
      !hasGreenBeans &&
      beanStateType !== 'roasted'
    ) {
      handleBeanStateChange('roasted');
    }
  }, [
    hasGreenBeans,
    hasRoastedBeans,
    beanStateType,
    handleBeanStateChange,
    enableGreenBeanInventory,
  ]);

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

  // 如果生豆库未启用或只有熟豆，直接显示熟豆统计（独立模式）
  if (!enableGreenBeanInventory || !hasGreenBeans) {
    return (
      <RoastedBeanStatsView beans={beans} showEmptyBeans={showEmptyBeans} />
    );
  }

  // 如果只有生豆，直接显示生豆统计（独立模式）
  if (!hasRoastedBeans) {
    return <GreenBeanStatsView beans={beans} />;
  }

  // 两种都有，使用组合视图（共享 StatsFilterBar）
  return (
    <CombinedStatsView
      beans={beans}
      showEmptyBeans={showEmptyBeans}
      beanStateType={beanStateType}
      onBeanStateTypeChange={handleBeanStateChange}
    />
  );
};

export default StatsView;
