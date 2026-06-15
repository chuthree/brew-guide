'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StatsViewProps,
  DateGroupingMode,
  TypeInventoryStats,
  BrewingDetailItem,
  BeanType,
  BeanRatingHighlights,
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
  getStatsViewSectionsPreference,
  saveStatsViewSectionsPreference,
  StatsViewSectionPreference,
} from '../../preferences';
import StatsFilterBar from './StatsFilterBar';
import ConsumptionTrendChart from './ConsumptionTrendChart';
import { useStatsData, StatsMetadata } from './useStatsData';
import { useGreenBeanStatsData } from './useGreenBeanStatsData';
import StatsExplainer, { StatsExplanation } from './StatsExplainer';
import {
  extractUniqueOrigins,
  extractUniqueVarieties,
  formatBeanDisplayName,
  getBeanProcesses,
  getBeanFlavors,
  getBeanEstates,
  getBeanRegions,
  getBeanAltitudes,
  getBeanSeasons,
  getBeanAgtrons,
  getRoasterName,
} from '@/lib/utils/beanVarietyUtils';
import { ExtendedCoffeeBean } from '../../types';
import GreenBeanStatsView from './GreenBeanStatsView';
import CoffeeOriginMap from './CoffeeOriginMap';
import StatsSectionEditorDrawer, {
  StatsSectionOption,
} from './StatsSectionEditorDrawer';

// 格式化辅助函数
const fmtWeight = (v: number) => (v > 0 ? `${formatNumber(v)}g` : '-');
const fmtCost = (v: number) => (v > 0 ? `¥${formatNumber(v)}` : '-');
const fmtDays = (v: number) => (v > 0 ? `${v}天` : '-');
const fmtAverageWeight = (v: number, unit: '天' | '月') =>
  v > 0 ? `${formatNumber(v)}g/${unit}` : '-';
const fmtPricePerGram = (v: number) => (v > 0 ? `¥${formatNumber(v)}/g` : '-');
const fmtDetailWeight = (v: number) => `${formatNumber(v)}g`;
const fmtDetailCost = (v: number) => `¥${formatNumber(v)}`;
const fmtRating = (v: number) => (v > 0 ? `${formatNumber(v)} / 5` : '-');
const parseBeanNumber = (value: string | number | undefined | null): number => {
  if (value === undefined || value === null) return 0;
  const parsed = parseFloat(value.toString().replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const BEAN_PRICE_HIGHLIGHT_MAX_COUNT = 15;
const BEAN_TYPE_ORDER: BeanType[] = ['espresso', 'filter', 'omni'];
const BEAN_TYPE_LABELS: Record<BeanType, string> = {
  espresso: '意式豆',
  filter: '手冲豆',
  omni: '全能豆',
};

type BeanTypeSummary = Record<
  BeanType,
  {
    label: string;
    totalCount: number;
    remainingCount: number;
    totalCapacity: number;
    totalValue: number;
    remaining: number;
    remainingValue: number;
  }
>;

interface BeanPriceHighlight {
  beanId: string;
  beanName: string;
  pricePerGram: number;
}

interface BeanPriceHighlights {
  averagePricePerGram: number;
  expensive: BeanPriceHighlight[];
  cheap: BeanPriceHighlight[];
}

type RoastedStatsSectionKey =
  | 'beanCount'
  | 'bestBeans'
  | 'worstBeans'
  | 'expensiveBeans'
  | 'cheapBeans'
  | 'roaster'
  | 'originMap'
  | 'origin'
  | 'region'
  | 'estate'
  | 'altitude'
  | 'season'
  | 'agtron'
  | 'variety'
  | 'process'
  | 'flavor';

const ROASTED_STATS_SECTION_DEFAULTS: StatsSectionOption[] = [
  { key: 'beanCount', label: '咖啡豆', visible: true },
  { key: 'roaster', label: '烘焙商', visible: true },
  { key: 'expensiveBeans', label: '最贵豆子', visible: false },
  { key: 'cheapBeans', label: '最便宜豆子', visible: false },
  { key: 'bestBeans', label: '最夯豆子', visible: true },
  { key: 'worstBeans', label: '最拉豆子', visible: true },
  { key: 'originMap', label: '咖啡产区地图', visible: true },
  { key: 'origin', label: '产地', visible: true },
  { key: 'region', label: '产区', visible: true },
  { key: 'estate', label: '庄园', visible: true },
  { key: 'altitude', label: '海拔', visible: false },
  { key: 'season', label: '产季', visible: false },
  { key: 'agtron', label: 'Agtron值', visible: false },
  { key: 'variety', label: '品种', visible: true },
  { key: 'process', label: '处理法', visible: true },
  { key: 'flavor', label: '风味', visible: true },
];

const hydrateStatsSectionOptions = (
  preferences: StatsViewSectionPreference[],
  defaults: StatsSectionOption[]
): StatsSectionOption[] => {
  const defaultsByKey = new Map(defaults.map(item => [item.key, item]));

  return preferences.flatMap(item => {
    const defaultItem = defaultsByKey.get(item.key);
    if (!defaultItem) return [];
    return [{ ...defaultItem, visible: item.visible }];
  });
};

const toStatsSectionPreferences = (
  sections: StatsSectionOption[]
): StatsViewSectionPreference[] =>
  sections.map(({ key, visible }) => ({ key, visible }));

const createEmptyTypeSummary = (): BeanTypeSummary => ({
  espresso: {
    label: BEAN_TYPE_LABELS.espresso,
    totalCount: 0,
    remainingCount: 0,
    totalCapacity: 0,
    totalValue: 0,
    remaining: 0,
    remainingValue: 0,
  },
  filter: {
    label: BEAN_TYPE_LABELS.filter,
    totalCount: 0,
    remainingCount: 0,
    totalCapacity: 0,
    totalValue: 0,
    remaining: 0,
    remainingValue: 0,
  },
  omni: {
    label: BEAN_TYPE_LABELS.omni,
    totalCount: 0,
    remainingCount: 0,
    totalCapacity: 0,
    totalValue: 0,
    remaining: 0,
    remainingValue: 0,
  },
});

const summarizeBeansByType = (beans: ExtendedCoffeeBean[]): BeanTypeSummary => {
  const summary = createEmptyTypeSummary();

  for (const bean of beans) {
    const type = bean.beanType;
    if (!type || !(type in summary)) continue;

    const capacity = parseBeanNumber(bean.capacity);
    const remaining = parseBeanNumber(bean.remaining);
    const price = parseBeanNumber(bean.price);
    const remainingValue = capacity > 0 ? (remaining * price) / capacity : 0;

    summary[type].totalCount += 1;
    summary[type].remainingCount += remaining > 0 ? 1 : 0;
    summary[type].totalCapacity += capacity;
    summary[type].totalValue += price;
    summary[type].remaining += remaining;
    summary[type].remainingValue += remainingValue;
  }

  return summary;
};

const getOwnedBeanTypes = (typeSummary: BeanTypeSummary): BeanType[] =>
  BEAN_TYPE_ORDER.filter(type => typeSummary[type].totalCount > 0);

const getBeanPricePerGram = (bean: ExtendedCoffeeBean): number => {
  const price = parseBeanNumber(bean.price);
  const capacity = parseBeanNumber(bean.capacity);

  if (price <= 0 || capacity <= 0) return 0;
  return price / capacity;
};

const buildBeanPriceHighlights = (
  beans: ExtendedCoffeeBean[]
): BeanPriceHighlights | null => {
  const pricedBeans = beans.flatMap(bean => {
    const pricePerGram = getBeanPricePerGram(bean);
    if (pricePerGram <= 0) return [];

    return [
      {
        beanId: bean.id,
        beanName: formatBeanDisplayName(bean),
        pricePerGram,
      },
    ];
  });

  if (pricedBeans.length === 0) return null;

  const averagePricePerGram =
    pricedBeans.reduce((sum, bean) => sum + bean.pricePerGram, 0) /
    pricedBeans.length;

  return {
    averagePricePerGram,
    expensive: pricedBeans
      .filter(bean => bean.pricePerGram > averagePricePerGram)
      .sort(
        (a, b) =>
          b.pricePerGram - a.pricePerGram ||
          a.beanName.localeCompare(b.beanName)
      )
      .slice(0, BEAN_PRICE_HIGHLIGHT_MAX_COUNT),
    cheap: pricedBeans
      .filter(bean => bean.pricePerGram <= averagePricePerGram)
      .sort(
        (a, b) =>
          a.pricePerGram - b.pricePerGram ||
          a.beanName.localeCompare(b.beanName)
      )
      .slice(0, BEAN_PRICE_HIGHLIGHT_MAX_COUNT),
  };
};

const createTypeRows = (
  typeSummary: BeanTypeSummary,
  getValue: (type: BeanType) => string | number
): StatsExplanation['rows'] => {
  const ownedTypes = getOwnedBeanTypes(typeSummary);

  if (ownedTypes.length === 0) {
    return [{ label: '未分类', value: getValue('omni') }];
  }

  return ownedTypes.map(type => ({
    label: typeSummary[type].label,
    value: getValue(type),
  }));
};

// 统计项的唯一标识
type StatsKey =
  | 'totalConsumption'
  | 'totalCost'
  | 'averageConsumption'
  | 'averagePricePerGram'
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
  todayStats: ReturnType<typeof useStatsData>['todayStats'],
  metadata: StatsMetadata,
  typeSummary: BeanTypeSummary,
  isHistoricalView: boolean,
  dateRangeLabel?: string
): StatsExplanation | null => {
  const {
    validNotes,
    actualDays,
    averageConsumptionPeriods,
    averageConsumptionUnit,
    beansWithPrice,
    beansTotal,
    todayNotes,
    useFallbackStats,
  } = metadata;
  const normalizedDays = Math.max(1, actualDays);

  switch (key) {
    case 'totalConsumption':
      return {
        title: isHistoricalView ? '消耗' : '总消耗',
        value,
        formula: isHistoricalView
          ? '∑ 每条冲煮记录的咖啡用量'
          : useFallbackStats
            ? '∑ (购买容量 - 剩余量)'
            : '∑ 全部冲煮记录的咖啡用量',
        dataSource: isHistoricalView
          ? [
              { label: '有效冲煮记录', value: `${validNotes} 条` },
              { label: '统计天数', value: `${actualDays} 天` },
            ]
          : [
              { label: '咖啡豆数量', value: `${beansTotal} 款` },
              { label: '统计天数', value: `${actualDays} 天` },
            ],
        rows: createTypeRows(typeSummary, type =>
          fmtDetailWeight(stats.byType[type].consumption)
        ),
        note: isHistoricalView
          ? validNotes < 5
            ? '记录较少，数据仅供参考'
            : undefined
          : useFallbackStats
            ? '暂无有效冲煮记录，基于咖啡豆容量变化估算'
            : '基于全部冲煮记录累计，和月/日统计口径一致',
      };

    case 'totalCost':
      return {
        title: isHistoricalView ? '花费' : '总花费',
        value,
        formula: isHistoricalView
          ? '∑ (用量 × 单价/容量)'
          : useFallbackStats
            ? '∑ (消耗量 × 单价/容量)'
            : '∑ 每条冲煮记录的 (用量 × 单价/容量)',
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
        rows: createTypeRows(typeSummary, type =>
          fmtDetailCost(stats.byType[type].cost)
        ),
        note:
          beansWithPrice < beansTotal
            ? `${beansTotal - beansWithPrice} 款咖啡豆缺少价格信息，未计入花费`
            : isHistoricalView
              ? undefined
              : useFallbackStats
                ? '暂无有效冲煮记录，基于咖啡豆容量变化估算'
                : '基于全部冲煮记录累计，和月/日统计口径一致',
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
        rows: createTypeRows(typeSummary, type =>
          fmtDetailWeight(stats.byType[type].consumption / normalizedDays)
        ),
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
        rows: createTypeRows(typeSummary, type =>
          fmtDetailCost(stats.byType[type].cost / normalizedDays)
        ),
        note:
          beansWithPrice < beansTotal
            ? '部分咖啡豆缺少价格，实际花费可能更高'
            : undefined,
      };

    case 'averageConsumption':
      return {
        title: '平均消耗',
        value,
        formula: `总消耗 ÷ 统计${averageConsumptionUnit}数`,
        dataSource: [
          { label: '总消耗', value: fmtWeight(stats.overview.consumption) },
          {
            label: `统计${averageConsumptionUnit}数`,
            value: `${averageConsumptionPeriods} ${averageConsumptionUnit}`,
          },
        ],
        rows: createTypeRows(typeSummary, type =>
          fmtAverageWeight(
            stats.byType[type].consumption / averageConsumptionPeriods,
            averageConsumptionUnit
          )
        ),
        note:
          averageConsumptionUnit === '月'
            ? '按有效统计范围覆盖的日历月份计算'
            : actualDays < 7
              ? '统计周期较短，平均值可能波动较大'
              : undefined,
      };

    case 'averagePricePerGram':
      return {
        title: '平均克价',
        value,
        formula: '已计价花费 ÷ 已计价消耗',
        dataSource: [
          { label: '已计价花费', value: fmtCost(stats.overview.cost) },
          {
            label: '已计价消耗',
            value: fmtWeight(stats.overview.pricedConsumption ?? 0),
          },
        ],
        rows: createTypeRows(typeSummary, type => {
          const consumption = stats.byType[type].pricedConsumption ?? 0;
          return fmtPricePerGram(
            consumption > 0 ? stats.byType[type].cost / consumption : 0
          );
        }),
        note:
          beansWithPrice < beansTotal
            ? '部分咖啡豆缺少价格，平均克价仅基于已计入花费的数据'
            : undefined,
      };

    case 'todayConsumption':
      return {
        title: '今日消耗',
        value,
        formula: '∑ 今日冲煮记录的咖啡用量',
        dataSource: [{ label: '今日冲煮记录', value: `${todayNotes} 条` }],
        rows: createTypeRows(typeSummary, type =>
          fmtDetailWeight(todayStats?.byType[type].consumption ?? 0)
        ),
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
        rows: createTypeRows(typeSummary, type =>
          fmtDetailCost(todayStats?.byType[type].cost ?? 0)
        ),
      };

    case 'remaining':
      return {
        title: '剩余总量',
        value,
        formula: '∑ 每款咖啡豆的剩余量',
        dataSource: [{ label: '咖啡豆数量', value: `${beansTotal} 款` }],
        rows: createTypeRows(typeSummary, type =>
          fmtDetailWeight(typeSummary[type].remaining)
        ),
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
        rows: createTypeRows(typeSummary, type =>
          fmtDetailCost(typeSummary[type].remainingValue)
        ),
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
        rows: createTypeRows(typeSummary, type =>
          fmtDetailWeight(typeSummary[type].totalCapacity)
        ),
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
        rows: createTypeRows(typeSummary, type =>
          fmtDetailCost(typeSummary[type].totalValue)
        ),
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
        rows: createTypeRows(
          typeSummary,
          type =>
            `${typeSummary[type].remainingCount} / ${typeSummary[type].totalCount}`
        ),
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
  onExplain: (
    key: StatsKey,
    rect: DOMRect,
    typeSummary?: BeanTypeSummary
  ) => void;
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
  value: string | number;
}

const BeanAttributeItem: React.FC<BeanAttributeItemProps> = ({
  label,
  value,
}) => (
  <div className="grid grid-cols-[1fr_auto] gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
    <div className="truncate">{label}</div>
    <div className="text-right tabular-nums">{value}</div>
  </div>
);

interface AttributeCardRow {
  key: string;
  label: string;
  value: string | number;
}

type AttributeCardItem = readonly [string, string | number] | AttributeCardRow;

const isAttributeCardRow = (
  item: AttributeCardItem
): item is AttributeCardRow => !Array.isArray(item);

const getAttributeCardItemKey = (item: AttributeCardItem): string =>
  isAttributeCardRow(item) ? item.key : item[0];

const getAttributeCardItemLabel = (item: AttributeCardItem): string =>
  isAttributeCardRow(item) ? item.label : item[0];

const getAttributeCardItemValue = (item: AttributeCardItem): string | number =>
  isAttributeCardRow(item) ? item.value : item[1];

// 单个属性统计卡片组件（支持展开/收起）
interface AttributeCardProps {
  title: string;
  data: AttributeCardItem[];
  valueLabel?: string;
  initialLimit?: number;
  displayMode?: 'list' | 'tags'; // 新增：显示模式
}

const AttributeCard: React.FC<AttributeCardProps> = ({
  title,
  data,
  valueLabel = '数量',
  initialLimit = 5,
  displayMode = 'list',
}) => {
  const DEFAULT_TAGS_COLLAPSED_HEIGHT = 120;

  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const [collapsedHeight, setCollapsedHeight] = useState<number>(
    displayMode === 'tags' ? DEFAULT_TAGS_COLLAPSED_HEIGHT : initialLimit * 26
  );
  const [hasMore, setHasMore] = useState(false);

  const measureContent = useCallback(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    const measuredContentHeight = contentEl.scrollHeight;
    let measuredCollapsedHeight = DEFAULT_TAGS_COLLAPSED_HEIGHT;

    if (displayMode === 'list') {
      const rows = Array.from(contentEl.children) as HTMLElement[];
      const visibleCount = Math.min(initialLimit, rows.length);
      if (visibleCount > 0) {
        const lastVisibleRow = rows[visibleCount - 1];
        measuredCollapsedHeight =
          lastVisibleRow.offsetTop + lastVisibleRow.offsetHeight;
      } else {
        measuredCollapsedHeight = 0;
      }
    }

    setContentHeight(measuredContentHeight);
    setCollapsedHeight(measuredCollapsedHeight);

    const overflow = measuredContentHeight - measuredCollapsedHeight > 1;
    setHasMore(overflow);
    if (!overflow) {
      setIsExpanded(false);
    }
  }, [displayMode, initialLimit]);

  // 初始化与数据变化后测量
  useEffect(() => {
    measureContent();
  }, [measureContent, data]);

  // 监听字体缩放与窗口尺寸变化
  useEffect(() => {
    const handleMeasure = () => {
      requestAnimationFrame(measureContent);
    };

    window.addEventListener('fontZoomChange', handleMeasure);
    window.addEventListener('resize', handleMeasure);

    return () => {
      window.removeEventListener('fontZoomChange', handleMeasure);
      window.removeEventListener('resize', handleMeasure);
    };
  }, [measureContent]);

  // 监听容器尺寸变化（例如布局或宽度变化）
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !contentRef.current) return;

    const observer = new ResizeObserver(() => {
      measureContent();
    });
    observer.observe(contentRef.current);

    return () => {
      observer.disconnect();
    };
  }, [measureContent]);

  if (data.length === 0) return null;

  const handleToggle = () => {
    if (hasMore) {
      setIsExpanded(!isExpanded);
    }
  };

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
            maxHeight: hasMore
              ? `${isExpanded ? contentHeight : collapsedHeight}px`
              : 'none',
          }}
        >
          {data.map(item => {
            const label = getAttributeCardItemLabel(item);
            const value = getAttributeCardItemValue(item);

            return (
              <div
                key={getAttributeCardItemKey(item)}
                className="inline-flex items-center gap-1.5 rounded-full bg-neutral-200/50 px-3 py-1.5 dark:bg-neutral-800/50"
              >
                <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                  {label}
                </span>
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {value}
                </span>
              </div>
            );
          })}
        </div>
        {/* 渐变遮罩 */}
        {hasMore && !isExpanded && (
          <div className="fade-mask-to-t pointer-events-none absolute inset-x-0 bottom-0 rounded-b bg-[#F4F4F4] pt-12 pb-3 dark:bg-[#1D1D1D]" />
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
        <div className="text-right">{valueLabel}</div>
      </div>
      {/* 数据行容器 - 添加动画 */}
      <div
        ref={contentRef}
        className="space-y-1.5 overflow-hidden transition-[max-height] duration-300 ease-out"
        style={{
          maxHeight: hasMore
            ? `${isExpanded ? contentHeight : collapsedHeight}px`
            : 'none',
        }}
      >
        {data.map(item => (
          <BeanAttributeItem
            key={getAttributeCardItemKey(item)}
            label={getAttributeCardItemLabel(item)}
            value={getAttributeCardItemValue(item)}
          />
        ))}
      </div>
      {/* 渐变遮罩 */}
      {hasMore && !isExpanded && (
        <div className="fade-mask-to-t pointer-events-none absolute inset-x-0 bottom-0 rounded-b bg-[#F4F4F4] pt-12 pb-3 dark:bg-[#1D1D1D]" />
      )}
    </div>
  );
};

// 咖啡豆数量统计组件
interface BeanCountStatsProps {
  beans: ExtendedCoffeeBean[];
  onExplain: (
    key: StatsKey,
    rect: DOMRect,
    typeSummary?: BeanTypeSummary
  ) => void;
}

const BeanCountStats: React.FC<BeanCountStatsProps> = ({
  beans,
  onExplain,
}) => {
  const typeSummary = useMemo(() => summarizeBeansByType(beans), [beans]);

  const total =
    typeSummary.espresso.totalCount +
    typeSummary.filter.totalCount +
    typeSummary.omni.totalCount;
  const totalRemaining =
    typeSummary.espresso.remainingCount +
    typeSummary.filter.remainingCount +
    typeSummary.omni.remainingCount;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onExplain('beanCount', rect, typeSummary);
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
        {typeSummary.espresso.totalCount > 0 && (
          <div className="grid grid-cols-[1fr_auto] gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
            <div>意式豆</div>
            <div className="text-right">
              {typeSummary.espresso.remainingCount} /{' '}
              {typeSummary.espresso.totalCount}
            </div>
          </div>
        )}
        {typeSummary.filter.totalCount > 0 && (
          <div className="grid grid-cols-[1fr_auto] gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
            <div>手冲豆</div>
            <div className="text-right">
              {typeSummary.filter.remainingCount} /{' '}
              {typeSummary.filter.totalCount}
            </div>
          </div>
        )}
        {typeSummary.omni.totalCount > 0 && (
          <div className="grid grid-cols-[1fr_auto] gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
            <div>全能豆</div>
            <div className="text-right">
              {typeSummary.omni.remainingCount} / {typeSummary.omni.totalCount}
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
  ratingHighlights: BeanRatingHighlights | null;
  onExplain: (
    key: StatsKey,
    rect: DOMRect,
    typeSummary?: BeanTypeSummary
  ) => void;
}

const BeanAttributeStats: React.FC<BeanAttributeStatsProps> = ({
  beans,
  selectedDate,
  dateGroupingMode,
  ratingHighlights,
  onExplain,
}) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [sectionOptions, setSectionOptions] = useState<StatsSectionOption[]>(
    () =>
      hydrateStatsSectionOptions(
        getStatsViewSectionsPreference(
          'roasted',
          ROASTED_STATS_SECTION_DEFAULTS
        ),
        ROASTED_STATS_SECTION_DEFAULTS
      )
  );

  // 先过滤掉生豆，只统计熟豆
  const roastedBeans = useMemo(() => {
    return beans.filter(bean => (bean.beanState || 'roasted') === 'roasted');
  }, [beans]);

  // 根据日期范围过滤咖啡豆（基于添加时间 timestamp）
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

    // 过滤咖啡豆（基于 timestamp 添加时间）
    return roastedBeans.filter(bean => {
      if (!bean.timestamp) return false;
      return bean.timestamp >= startTime && bean.timestamp < endTime;
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

  // 计算烘焙商统计
  const roasterStats = useMemo(() => {
    const roasterCount = new Map<string, number>();
    filteredBeans.forEach(bean => {
      const roaster = getRoasterName(bean);
      if (roaster) {
        roasterCount.set(roaster, (roasterCount.get(roaster) || 0) + 1);
      }
    });
    return Array.from(roasterCount.entries()).sort((a, b) => b[1] - a[1]);
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

  // 计算产区统计
  const regionStats = useMemo(() => {
    const regionCount = new Map<string, number>();
    filteredBeans.forEach(bean => {
      const regions = getBeanRegions(bean);
      regions.forEach(region => {
        regionCount.set(region, (regionCount.get(region) || 0) + 1);
      });
    });
    return Array.from(regionCount.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredBeans]);

  // 计算海拔统计
  const altitudeStats = useMemo(() => {
    const altitudeCount = new Map<string, number>();
    filteredBeans.forEach(bean => {
      const altitudes = getBeanAltitudes(bean);
      altitudes.forEach(altitude => {
        altitudeCount.set(altitude, (altitudeCount.get(altitude) || 0) + 1);
      });
    });
    return Array.from(altitudeCount.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredBeans]);

  // 计算产季统计
  const seasonStats = useMemo(() => {
    const seasonCount = new Map<string, number>();
    filteredBeans.forEach(bean => {
      const seasons = getBeanSeasons(bean);
      seasons.forEach(season => {
        seasonCount.set(season, (seasonCount.get(season) || 0) + 1);
      });
    });
    return Array.from(seasonCount.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredBeans]);

  // 计算Agtron值统计
  const agtronStats = useMemo(() => {
    const agtronCount = new Map<string, number>();
    filteredBeans.forEach(bean => {
      const agtrons = getBeanAgtrons(bean);
      agtrons.forEach(agtron => {
        agtronCount.set(agtron, (agtronCount.get(agtron) || 0) + 1);
      });
    });
    return Array.from(agtronCount.entries()).sort((a, b) => b[1] - a[1]);
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

  // 计算产地数量映射（用于地图上显示不同大小的点）
  const originCountMap = useMemo(() => {
    return new Map(originStats);
  }, [originStats]);

  // 获取所有产地名称（用于地图）
  const originNames = useMemo(() => {
    return originStats.map(([name]) => name);
  }, [originStats]);

  const bestBeanStats = useMemo<AttributeCardItem[]>(() => {
    return (
      ratingHighlights?.best.map(bean => ({
        key: bean.beanId,
        label: bean.beanName,
        value: fmtRating(bean.averageRating),
      })) ?? []
    );
  }, [ratingHighlights]);

  const worstBeanStats = useMemo<AttributeCardItem[]>(() => {
    return (
      ratingHighlights?.worst.map(bean => ({
        key: bean.beanId,
        label: bean.beanName,
        value: fmtRating(bean.averageRating),
      })) ?? []
    );
  }, [ratingHighlights]);

  const beanPriceHighlights = useMemo(
    () => buildBeanPriceHighlights(filteredBeans),
    [filteredBeans]
  );
  const expensiveBeanStats = useMemo<AttributeCardItem[]>(() => {
    return (
      beanPriceHighlights?.expensive.map(bean => ({
        key: bean.beanId,
        label: bean.beanName,
        value: fmtPricePerGram(bean.pricePerGram),
      })) ?? []
    );
  }, [beanPriceHighlights]);
  const cheapBeanStats = useMemo<AttributeCardItem[]>(() => {
    return (
      beanPriceHighlights?.cheap.map(bean => ({
        key: bean.beanId,
        label: bean.beanName,
        value: fmtPricePerGram(bean.pricePerGram),
      })) ?? []
    );
  }, [beanPriceHighlights]);

  const handleSectionOptionsChange = useCallback(
    (nextSections: StatsSectionOption[]) => {
      setSectionOptions(nextSections);
      saveStatsViewSectionsPreference(
        'roasted',
        toStatsSectionPreferences(nextSections)
      );
    },
    []
  );

  const sectionNodes = useMemo(() => {
    const originMap =
      originStats.length > 0 ? (
        <div
          key="originMap"
          className="rounded-md bg-neutral-100 p-3 dark:bg-neutral-800/40"
        >
          <CoffeeOriginMap
            origins={originNames}
            originCounts={originCountMap}
          />
        </div>
      ) : null;

    return new Map<RoastedStatsSectionKey, React.ReactNode>([
      [
        'beanCount',
        <BeanCountStats
          key="beanCount"
          beans={filteredBeans}
          onExplain={onExplain}
        />,
      ],
      [
        'bestBeans',
        bestBeanStats.length > 0 ? (
          <AttributeCard
            key="bestBeans"
            title="最夯豆子"
            data={bestBeanStats}
            valueLabel="评分"
          />
        ) : null,
      ],
      [
        'worstBeans',
        worstBeanStats.length > 0 ? (
          <AttributeCard
            key="worstBeans"
            title="最拉豆子"
            data={worstBeanStats}
            valueLabel="评分"
          />
        ) : null,
      ],
      [
        'expensiveBeans',
        expensiveBeanStats.length > 0 ? (
          <AttributeCard
            key="expensiveBeans"
            title="最贵豆子"
            data={expensiveBeanStats}
            valueLabel="克价"
          />
        ) : null,
      ],
      [
        'cheapBeans',
        cheapBeanStats.length > 0 ? (
          <AttributeCard
            key="cheapBeans"
            title="最便宜豆子"
            data={cheapBeanStats}
            valueLabel="克价"
          />
        ) : null,
      ],
      [
        'roaster',
        roasterStats.length > 0 ? (
          <AttributeCard key="roaster" title="烘焙商" data={roasterStats} />
        ) : null,
      ],
      ['originMap', originMap],
      [
        'origin',
        originStats.length > 0 ? (
          <AttributeCard key="origin" title="产地" data={originStats} />
        ) : null,
      ],
      [
        'region',
        regionStats.length > 0 ? (
          <AttributeCard key="region" title="产区" data={regionStats} />
        ) : null,
      ],
      [
        'estate',
        estateStats.length > 0 ? (
          <AttributeCard key="estate" title="庄园" data={estateStats} />
        ) : null,
      ],
      [
        'altitude',
        altitudeStats.length > 0 ? (
          <AttributeCard key="altitude" title="海拔" data={altitudeStats} />
        ) : null,
      ],
      [
        'season',
        seasonStats.length > 0 ? (
          <AttributeCard key="season" title="产季" data={seasonStats} />
        ) : null,
      ],
      [
        'agtron',
        agtronStats.length > 0 ? (
          <AttributeCard key="agtron" title="Agtron值" data={agtronStats} />
        ) : null,
      ],
      [
        'variety',
        varietyStats.length > 0 ? (
          <AttributeCard key="variety" title="品种" data={varietyStats} />
        ) : null,
      ],
      [
        'process',
        processStats.length > 0 ? (
          <AttributeCard key="process" title="处理法" data={processStats} />
        ) : null,
      ],
      [
        'flavor',
        flavorStats.length > 0 ? (
          <AttributeCard
            key="flavor"
            title="风味"
            data={flavorStats}
            displayMode="tags"
          />
        ) : null,
      ],
    ]);
  }, [
    bestBeanStats,
    cheapBeanStats,
    estateStats,
    regionStats,
    altitudeStats,
    seasonStats,
    agtronStats,
    expensiveBeanStats,
    filteredBeans,
    flavorStats,
    onExplain,
    originCountMap,
    originNames,
    originStats,
    processStats,
    roasterStats,
    varietyStats,
    worstBeanStats,
  ]);

  const visibleSections = sectionOptions.flatMap(section => {
    if (!section.visible) return [];
    const node = sectionNodes.get(section.key as RoastedStatsSectionKey);
    return node
      ? [<React.Fragment key={section.key}>{node}</React.Fragment>]
      : [];
  });

  const hasAnyStats = Array.from(sectionNodes.values()).some(Boolean);

  if (!hasAnyStats) return null;

  return (
    <div className="w-full">
      <div className="space-y-3">
        {visibleSections}

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setIsEditorOpen(true)}
            className="inline-flex cursor-pointer items-center rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-[background-color,transform] active:scale-[0.96] active:bg-neutral-200 dark:bg-neutral-800/60 dark:text-neutral-300 dark:active:bg-neutral-700/70"
          >
            编辑
          </button>
        </div>
      </div>

      <StatsSectionEditorDrawer
        isOpen={isEditorOpen}
        title="统计模块"
        sections={sectionOptions}
        onClose={() => setIsEditorOpen(false)}
        onChange={handleSectionOptionsChange}
      />
    </div>
  );
};

// 统计卡片组件（支持可点击的统计块）
interface StatsCardProps {
  title: string;
  chart?: React.ReactNode;
  stats: Array<{ title: string; value: string; key: StatsKey }>;
  extra?: React.ReactNode;
  onExplain: (
    key: StatsKey,
    rect: DOMRect,
    typeSummary?: BeanTypeSummary
  ) => void;
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
  navigationToggleControl,
  navigationSwipeControl,
  beanStateType = 'roasted',
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

  const roastedBeans = useMemo(() => {
    return beans.filter(bean => (bean.beanState || 'roasted') === 'roasted');
  }, [beans]);

  const typeSummary = useMemo(
    () => summarizeBeansByType(roastedBeans),
    [roastedBeans]
  );

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
    (key: StatsKey, rect: DOMRect, typeSummaryOverride?: BeanTypeSummary) => {
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
        case 'averageConsumption':
          value = fmtAverageWeight(
            stats.overview.averageConsumption,
            metadata.averageConsumptionUnit
          );
          break;
        case 'averagePricePerGram':
          value = fmtPricePerGram(stats.overview.averagePricePerGram);
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
        todayStats,
        metadata,
        typeSummaryOverride ?? typeSummary,
        isHistoricalView,
        dateRangeLabel
      );
      setExplanation(exp);
      setAnchorRect(rect);
      setActiveKey(key);
    },
    [
      stats,
      todayStats,
      metadata,
      typeSummary,
      isHistoricalView,
      activeKey,
      dateRangeLabel,
    ]
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
  const showPeriodAverages =
    selectedDate !== null && dateGroupingMode !== 'day';
  const averageStats = showPeriodAverages
    ? [
        {
          title: '平均消耗',
          value: fmtAverageWeight(
            stats.overview.averageConsumption,
            metadata.averageConsumptionUnit
          ),
          key: 'averageConsumption' as StatsKey,
        },
        {
          title: '平均克价',
          value: fmtPricePerGram(stats.overview.averagePricePerGram),
          key: 'averagePricePerGram' as StatsKey,
        },
      ]
    : [];

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
        ...averageStats,
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

  const filterBar = !isContentMode ? (
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
      navigationToggleControl={navigationToggleControl}
      navigationSwipeControl={navigationSwipeControl}
    />
  ) : null;

  const statsBody = (
    <>
      <div className="flex flex-col items-center">
        <div className="w-full space-y-5">
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

          {todayStatsDisplay.length > 0 && (
            <StatsCard
              title="今日"
              stats={todayStatsDisplay}
              onExplain={handleExplain}
            />
          )}

          {!isHistoricalView &&
            stats.inventoryByType &&
            stats.inventoryByType.length > 0 && (
              <StatsCard
                title="库存"
                stats={inventoryStats}
                extra={<InventoryForecast data={stats.inventoryByType} />}
                onExplain={handleExplain}
              />
            )}

          {!isSingleDayView && (
            <>
              <div className="mb-5 border-t border-neutral-200/40 dark:border-neutral-700/30" />

              <BeanAttributeStats
                beans={beans}
                selectedDate={selectedDate}
                dateGroupingMode={dateGroupingMode}
                ratingHighlights={stats.ratingHighlights}
                onExplain={handleExplain}
              />
            </>
          )}
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
    return <div className="px-6">{statsBody}</div>;
  }

  // 渲染完整容器
  return (
    <div className="coffee-bean-stats-container flex h-full flex-col bg-neutral-50 dark:bg-neutral-900">
      <div className="flex-none bg-neutral-50 dark:bg-neutral-900">
        {filterBar}
      </div>
      <div className="scroll-with-bottom-bar min-h-0 flex-1 overflow-y-auto px-6 pt-5">
        {statsBody}
      </div>
    </div>
  );
};

// 组合统计视图 - 共享 StatsFilterBar，内容区域平滑切换
interface CombinedStatsViewProps {
  beans: ExtendedCoffeeBean[];
  showEmptyBeans?: boolean;
  beanStateType: StatsBeanStateType;
  onBeanStateTypeChange: (state: StatsBeanStateType) => void;
  navigationToggleControl?: React.ReactNode;
  navigationSwipeControl?: StatsViewProps['navigationSwipeControl'];
}

const CombinedStatsView: React.FC<CombinedStatsViewProps> = ({
  beans,
  showEmptyBeans,
  beanStateType,
  onBeanStateTypeChange,
  navigationToggleControl,
  navigationSwipeControl,
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
    <div className="coffee-bean-stats-container flex h-full flex-col bg-neutral-50 dark:bg-neutral-900">
      {/* 共享的 StatsFilterBar */}
      <div className="flex-none bg-neutral-50 dark:bg-neutral-900">
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
          navigationToggleControl={navigationToggleControl}
          navigationSwipeControl={navigationSwipeControl}
        />
      </div>

      {/* 内容区域 */}
      <div className="scroll-with-bottom-bar min-h-0 flex-1 overflow-y-auto pt-5">
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
  navigationToggleControl,
  navigationSwipeControl,
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
      <RoastedBeanStatsView
        beans={beans}
        showEmptyBeans={showEmptyBeans}
        navigationToggleControl={navigationToggleControl}
        navigationSwipeControl={navigationSwipeControl}
      />
    );
  }

  // 如果只有生豆，直接显示生豆统计（独立模式）
  if (!hasRoastedBeans) {
    return (
      <GreenBeanStatsView
        beans={beans}
        navigationToggleControl={navigationToggleControl}
        navigationSwipeControl={navigationSwipeControl}
      />
    );
  }

  // 两种都有，使用组合视图（共享 StatsFilterBar）
  return (
    <CombinedStatsView
      beans={beans}
      showEmptyBeans={showEmptyBeans}
      beanStateType={beanStateType}
      onBeanStateTypeChange={handleBeanStateChange}
      navigationToggleControl={navigationToggleControl}
      navigationSwipeControl={navigationSwipeControl}
    />
  );
};

export default StatsView;
