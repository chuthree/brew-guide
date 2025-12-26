'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
  ColumnDef,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { ExtendedCoffeeBean, generateBeanTitle } from '../types';
import { isBeanEmpty } from '../preferences';
import { parseDateToTimestamp } from '@/lib/utils/dateUtils';
import {
  calculateFlavorInfo,
  getFlavorPeriodSettings,
  getDefaultFlavorPeriodByRoastLevelSync,
} from '@/lib/utils/flavorPeriodUtils';
import { getRoasterLogoSync } from '@/lib/stores/settingsStore';
import { extractRoasterFromName } from '@/lib/utils/beanVarietyUtils';

// 表格列配置
export type TableColumnKey =
  | 'roaster'
  | 'name'
  | 'flavorPeriod'
  | 'capacity'
  | 'price'
  | 'beanType'
  | 'origin'
  | 'estate'
  | 'process'
  | 'variety'
  | 'roastLevel'
  | 'flavor'
  | 'rating'
  | 'notes';

export const TABLE_COLUMN_CONFIG: {
  key: TableColumnKey;
  label: string;
  defaultVisible: boolean;
}[] = [
  { key: 'roaster', label: '烘焙商', defaultVisible: false },
  { key: 'name', label: '名称', defaultVisible: true },
  { key: 'flavorPeriod', label: '赏味期', defaultVisible: true },
  { key: 'capacity', label: '容量', defaultVisible: true },
  { key: 'price', label: '价格', defaultVisible: true },
  { key: 'beanType', label: '类型', defaultVisible: false },
  { key: 'origin', label: '产地', defaultVisible: false },
  { key: 'estate', label: '庄园', defaultVisible: false },
  { key: 'process', label: '处理法', defaultVisible: false },
  { key: 'variety', label: '品种', defaultVisible: false },
  { key: 'roastLevel', label: '烘焙度', defaultVisible: false },
  { key: 'flavor', label: '风味', defaultVisible: false },
  { key: 'rating', label: '评分', defaultVisible: false },
  { key: 'notes', label: '备注', defaultVisible: true },
];

// 获取默认可见列
export const getDefaultVisibleColumns = (): TableColumnKey[] =>
  TABLE_COLUMN_CONFIG.filter(c => c.defaultVisible).map(c => c.key);

// 默认排序状态（空数组，跟随列表排序）
const DEFAULT_SORTING: SortingState = [];
const SORTING_STORAGE_KEY = 'brew-guide:coffee-beans:tableSorting';

// 从 localStorage 读取排序状态
const loadSorting = (): SortingState => {
  if (typeof window === 'undefined') return DEFAULT_SORTING;
  try {
    const saved = localStorage.getItem(SORTING_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return DEFAULT_SORTING;
};

// 保存排序状态到 localStorage
const saveSorting = (sorting: SortingState) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SORTING_STORAGE_KEY, JSON.stringify(sorting));
};

// 重置排序状态
export const resetTableSorting = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SORTING_STORAGE_KEY);
};

interface TableViewProps {
  filteredBeans: ExtendedCoffeeBean[];
  emptyBeans: ExtendedCoffeeBean[];
  showEmptyBeans: boolean;
  onEdit?: (bean: ExtendedCoffeeBean) => void;
  onDelete?: (bean: ExtendedCoffeeBean) => void;
  onShare?: (bean: ExtendedCoffeeBean) => void;
  onRate?: (bean: ExtendedCoffeeBean) => void;
  onRemainingClick?: (
    bean: ExtendedCoffeeBean,
    event: React.MouseEvent
  ) => void;
  settings?: {
    dateDisplayMode?: 'date' | 'flavorPeriod' | 'agingDays';
    showOnlyBeanName?: boolean;
  };
  visibleColumns?: TableColumnKey[];
}

// 从名称中移除烘焙商前缀
const removeRoasterFromName = (name: string): string => {
  if (!name) return name;
  const roaster = extractRoasterFromName(name);
  if (roaster === '未知烘焙商') return name;
  const trimmedName = name.trim();
  if (trimmedName.startsWith(roaster)) {
    return trimmedName.slice(roaster.length).trim();
  }
  return name;
};

// 格式化工具函数
const formatDateShort = (dateStr: string): string => {
  try {
    const timestamp = parseDateToTimestamp(dateStr);
    const date = new Date(timestamp);
    const year = date.getFullYear().toString().slice(-2);
    return `${year}-${date.getMonth() + 1}-${date.getDate()}`;
  } catch {
    return dateStr;
  }
};

const getAgingDays = (dateStr: string): number => {
  try {
    const timestamp = parseDateToTimestamp(dateStr);
    const roastDate = new Date(timestamp);
    const today = new Date();
    const todayDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const roastDateOnly = new Date(
      roastDate.getFullYear(),
      roastDate.getMonth(),
      roastDate.getDate()
    );
    return Math.ceil(
      (todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24)
    );
  } catch {
    return 0;
  }
};

const getAgingDaysText = (dateStr: string): string =>
  `${getAgingDays(dateStr)}天`;

const formatNumber = (value: string | undefined): string =>
  !value
    ? '0'
    : Number.isInteger(parseFloat(value))
      ? Math.floor(parseFloat(value)).toString()
      : value;

const formatPrice = (price: string, capacity: string): string => {
  const priceNum = parseFloat(price);
  const capacityNum = parseFloat(capacity.replace('g', ''));
  if (isNaN(priceNum) || isNaN(capacityNum) || capacityNum === 0) return '-';
  return `${(priceNum / capacityNum).toFixed(2)}元/克`;
};

const getPricePerGram = (price: string, capacity: string): number => {
  const priceNum = parseFloat(price);
  const capacityNum = parseFloat(capacity.replace('g', ''));
  if (isNaN(priceNum) || isNaN(capacityNum) || capacityNum === 0) return 0;
  return priceNum / capacityNum;
};

const FlavorStatusRing: React.FC<{ bean: ExtendedCoffeeBean }> = ({ bean }) => {
  // 1. Handle special states
  if (bean.isInTransit) {
    return (
      <svg
        className="mr-1.5 inline-block h-[1em] w-[1em] align-text-bottom text-neutral-400 dark:text-neutral-400/60"
        viewBox="0 0 24 24"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
      </svg>
    );
  }

  if (bean.isFrozen) {
    return (
      <svg
        className="mr-1.5 inline-block h-[1em] w-[1em] align-text-bottom text-blue-400 dark:text-blue-400/80"
        viewBox="0 0 24 24"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (!bean.roastDate) {
    return (
      <svg
        className="mr-1.5 inline-block h-[1em] w-[1em] align-text-bottom text-neutral-300 dark:text-neutral-300/60"
        viewBox="0 0 24 24"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeOpacity="0.3"
        />
      </svg>
    );
  }

  // 2. Calculate days and period
  const today = new Date();
  const roastDate = new Date(bean.roastDate);
  const todayDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const roastDateOnly = new Date(
    roastDate.getFullYear(),
    roastDate.getMonth(),
    roastDate.getDate()
  );
  const daysSinceRoast = Math.ceil(
    (todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24)
  );

  let startDay = bean.startDay || 0;
  let endDay = bean.endDay || 0;

  if (startDay === 0 && endDay === 0) {
    const { detailedEnabled, customFlavorPeriod, detailedFlavorPeriod } =
      getFlavorPeriodSettings();
    const roasterName = extractRoasterFromName(bean.name);
    const defaultPeriod = getDefaultFlavorPeriodByRoastLevelSync(
      bean.roastLevel || '',
      customFlavorPeriod,
      roasterName,
      detailedEnabled,
      detailedFlavorPeriod
    );
    startDay = defaultPeriod.startDay;
    endDay = defaultPeriod.endDay;
  }

  // 3. Determine phase and progress
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  let progress = 0;
  let colorClass = 'text-neutral-500 dark:text-neutral-500/60';
  let isDashed = false;

  if (daysSinceRoast < startDay) {
    // Resting (养豆期)
    // Progress: 0 -> 100% (fills up)
    progress =
      startDay > 0 ? Math.max(0, Math.min(1, daysSinceRoast / startDay)) : 1;
    colorClass = 'text-amber-500 dark:text-amber-500/60';
  } else if (daysSinceRoast <= endDay) {
    // Drinking (赏味期)
    // Progress: 100% -> 0% (empties)
    const duration = endDay - startDay;
    const remaining = endDay - daysSinceRoast;
    progress =
      duration > 0 ? Math.max(0, Math.min(1, remaining / duration)) : 0;
    colorClass = 'text-green-500 dark:text-green-500/60';
  } else {
    // Decline (衰退期)
    progress = 0; // Empty
    colorClass = 'text-neutral-300 dark:text-neutral-300/60';
    isDashed = true;
  }

  const strokeDashoffset = circumference * (1 - progress);

  return (
    <svg
      className={`mr-1.5 inline-block h-[1em] w-[1em] align-text-bottom ${colorClass}`}
      viewBox="0 0 24 24"
    >
      {/* Background track */}
      <circle
        cx="12"
        cy="12"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.2"
      />
      {/* Progress */}
      <circle
        cx="12"
        cy="12"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={isDashed ? '2 2' : `${circumference} ${circumference}`}
        strokeDashoffset={isDashed ? 0 : strokeDashoffset}
        strokeLinecap="round"
        transform="rotate(-90 12 12)"
      />
    </svg>
  );
};

// 获取赏味期状态的排序值
const getFlavorStatusSortValue = (bean: ExtendedCoffeeBean): number => {
  // 排序逻辑：已衰退 > 赏味期 > 冰冻 > 养豆期 > 在途 > 未知
  const info = calculateFlavorInfo(bean);

  if (info.phase === '衰退期') return 0;
  // 赏味期剩余天数越少越靠前（更紧急）
  if (info.phase === '赏味期') return 100 + info.remainingDays;
  if (info.phase === '冷冻') return 200;
  // 养豆期剩余天数越少越靠前（越接近赏味期）
  if (info.phase === '养豆期') return 300 + info.remainingDays;
  if (info.phase === '在途') return 400;

  return 500; // 未知
};

const getFlavorStatus = (bean: ExtendedCoffeeBean): string => {
  if (bean.isInTransit) return '在途';
  if (!bean.roastDate) return '-';
  if (bean.isFrozen) return '冷冻';

  const info = calculateFlavorInfo(bean);
  if (info.phase === '养豆期') return `养豆${info.remainingDays}天`;
  if (info.phase === '赏味期') return `赏味${info.remainingDays}天`;
  if (info.phase === '衰退期') return '已衰退';
  return info.phase;
};

// 排序图标组件
const SortIcon: React.FC<{
  direction: 'asc' | 'desc' | false;
  index?: number;
}> = ({ direction, index }) => {
  if (!direction) {
    return (
      <ChevronsUpDown className="ml-0.5 inline-block h-3 w-3 text-neutral-300 dark:text-neutral-600" />
    );
  }
  return (
    <span className="ml-0.5 inline-flex items-center text-neutral-800 dark:text-neutral-200">
      {direction === 'asc' ? (
        <ChevronUp className="h-3 w-3" />
      ) : (
        <ChevronDown className="h-3 w-3" />
      )}
      {index !== undefined && index > 0 && (
        <span className="ml-0.5 text-[10px] text-neutral-400">{index + 1}</span>
      )}
    </span>
  );
};

const columnHelper = createColumnHelper<ExtendedCoffeeBean>();

const TableView: React.FC<TableViewProps> = ({
  filteredBeans,
  emptyBeans,
  showEmptyBeans,
  onRemainingClick,
  settings,
  visibleColumns = getDefaultVisibleColumns(),
}) => {
  const showOnlyBeanName = settings?.showOnlyBeanName ?? true;
  const dateDisplayMode = settings?.dateDisplayMode ?? 'date';

  // 多重排序状态（持久化）
  const [sorting, setSorting] = useState<SortingState>(loadSorting);

  // 排序变化时持久化
  const handleSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      setSorting(old => {
        const newSorting = typeof updater === 'function' ? updater(old) : updater;
        saveSorting(newSorting);
        return newSorting;
      });
    },
    []
  );

  // 列配置变化时，检查排序列是否仍可见，不可见则重置
  useEffect(() => {
    const sortingColumnIds = sorting.map(s => s.id);
    const hasInvisibleSortColumn = sortingColumnIds.some(
      id => !visibleColumns.includes(id as TableColumnKey)
    );
    if (hasInvisibleSortColumn) {
      setSorting(DEFAULT_SORTING);
      saveSorting(DEFAULT_SORTING);
    }
  }, [visibleColumns, sorting]);

  const [roasterLogos, setRoasterLogos] = useState<
    Record<string, string | null>
  >({});

  // 合并正常豆子和用完的豆子
  const allBeans = useMemo(() => {
    if (!showEmptyBeans) return filteredBeans;
    return [...filteredBeans, ...emptyBeans];
  }, [filteredBeans, emptyBeans, showEmptyBeans]);

  // 加载所有咖啡豆的烘焙商图标
  useEffect(() => {
    const logos: Record<string, string | null> = {};
    allBeans.forEach(bean => {
      if (!bean.image && bean.name) {
        const roasterName = extractRoasterFromName(bean.name);
        if (roasterName && roasterName !== '未知烘焙商') {
          const logo = getRoasterLogoSync(roasterName);
          logos[bean.id] = logo || null;
        }
      }
    });
    setRoasterLogos(logos);
  }, [allBeans]);

  // 定义所有列
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns = useMemo<ColumnDef<ExtendedCoffeeBean, any>[]>(() => {
    const showRoasterColumn = visibleColumns.includes('roaster');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allColumns: Record<
      TableColumnKey,
      ColumnDef<ExtendedCoffeeBean, any>
    > = {
      roaster: columnHelper.accessor(
        row => extractRoasterFromName(row.name || '') || '-',
        {
          id: 'roaster',
          header: '烘焙商',
          cell: info => info.getValue(),
          sortingFn: 'alphanumeric',
        }
      ),
      name: columnHelper.accessor(
        row => {
          const title = generateBeanTitle(row, showOnlyBeanName);
          return showRoasterColumn ? removeRoasterFromName(title) : title;
        },
        {
          id: 'name',
          header: '名称',
          cell: info => info.getValue(),
          sortingFn: 'alphanumeric',
        }
      ),
      flavorPeriod: columnHelper.accessor(
        row => {
          const isGreenBean = row.beanState === 'green';

          // 赏味期模式且非生豆，使用自定义排序
          if (!isGreenBean && dateDisplayMode === 'flavorPeriod') {
            return getFlavorStatusSortValue(row);
          }

          const displayDate = isGreenBean ? row.purchaseDate : row.roastDate;
          if (!displayDate) return 999;
          if (row.isInTransit) return 1000;
          if (row.isFrozen) return 998;

          if (!isGreenBean && dateDisplayMode === 'agingDays') {
            return getAgingDays(displayDate);
          }
          return parseDateToTimestamp(displayDate);
        },
        {
          id: 'flavorPeriod',
          header: '赏味期',
          cell: ({ row }) => {
            const bean = row.original;
            const isGreenBean = bean.beanState === 'green';
            const displayDate = isGreenBean
              ? bean.purchaseDate
              : bean.roastDate;
            if (!displayDate) return '-';

            const content = (() => {
              if (bean.isInTransit) return '在途';
              if (bean.isFrozen) return '冷冻';
              if (!isGreenBean && dateDisplayMode === 'flavorPeriod') {
                return getFlavorStatus(bean);
              }
              if (!isGreenBean && dateDisplayMode === 'agingDays') {
                return getAgingDaysText(displayDate);
              }
              return formatDateShort(displayDate);
            })();

            if (isGreenBean) return content;

            return (
              <span className="inline-flex items-center">
                <FlavorStatusRing bean={bean} />
                {content}
              </span>
            );
          },
          sortingFn: 'basic',
        }
      ),
      capacity: columnHelper.accessor(row => parseFloat(row.remaining || '0'), {
        id: 'capacity',
        header: '容量',
        cell: ({ row }) => {
          const bean = row.original;
          if (!bean.capacity || !bean.remaining) return '-';
          const isEmpty = isBeanEmpty(bean);
          return (
            <>
              <span
                className={
                  isEmpty
                    ? ''
                    : 'border-b border-dashed border-neutral-400 dark:border-neutral-600'
                }
              >
                {formatNumber(bean.remaining)}
              </span>
              /{formatNumber(bean.capacity)}g
            </>
          );
        },
        sortingFn: 'basic',
      }),
      price: columnHelper.accessor(
        row => getPricePerGram(row.price || '0', row.capacity || '0'),
        {
          id: 'price',
          header: '价格',
          cell: ({ row }) => {
            const bean = row.original;
            return bean.price && bean.capacity
              ? formatPrice(bean.price, bean.capacity)
              : '-';
          },
          sortingFn: 'basic',
        }
      ),
      beanType: columnHelper.accessor(row => row.beanType || '', {
        id: 'beanType',
        header: '类型',
        cell: ({ row }) => {
          const type = row.original.beanType;
          return type === 'espresso'
            ? '意式'
            : type === 'filter'
              ? '手冲'
              : type === 'omni'
                ? '全能'
                : '-';
        },
        sortingFn: 'alphanumeric',
      }),
      origin: columnHelper.accessor(
        row => row.blendComponents?.[0]?.origin || '',
        {
          id: 'origin',
          header: '产地',
          cell: info => info.getValue() || '-',
          sortingFn: 'alphanumeric',
        }
      ),
      estate: columnHelper.accessor(
        row => row.blendComponents?.[0]?.estate || '',
        {
          id: 'estate',
          header: '庄园',
          cell: info => info.getValue() || '-',
          sortingFn: 'alphanumeric',
        }
      ),
      process: columnHelper.accessor(
        row => row.blendComponents?.[0]?.process || '',
        {
          id: 'process',
          header: '处理法',
          cell: info => info.getValue() || '-',
          sortingFn: 'alphanumeric',
        }
      ),
      variety: columnHelper.accessor(
        row => row.blendComponents?.[0]?.variety || '',
        {
          id: 'variety',
          header: '品种',
          cell: info => info.getValue() || '-',
          sortingFn: 'alphanumeric',
        }
      ),
      roastLevel: columnHelper.accessor(row => row.roastLevel || '', {
        id: 'roastLevel',
        header: '烘焙度',
        cell: info => info.getValue() || '-',
        sortingFn: 'alphanumeric',
      }),
      flavor: columnHelper.accessor(row => row.flavor?.join('、') || '', {
        id: 'flavor',
        header: '风味',
        cell: info => info.getValue() || '-',
        sortingFn: 'alphanumeric',
      }),
      rating: columnHelper.accessor(row => row.overallRating || 0, {
        id: 'rating',
        header: '评分',
        cell: ({ row }) => {
          const rating = row.original.overallRating;
          return rating && rating > 0 ? rating : '-';
        },
        sortingFn: 'basic',
      }),
      notes: columnHelper.accessor(row => row.notes || '', {
        id: 'notes',
        header: '备注',
        cell: info => info.getValue() || '-',
        sortingFn: 'alphanumeric',
      }),
    };

    // 按照配置顺序返回可见列
    return TABLE_COLUMN_CONFIG.filter(col =>
      visibleColumns.includes(col.key)
    ).map(col => allColumns[col.key]);
  }, [visibleColumns, showOnlyBeanName, dateDisplayMode]);

  // 创建表格实例
  const table = useReactTable({
    data: allBeans,
    columns,
    state: { sorting },
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableMultiSort: true,
    isMultiSortEvent: () => true, // 点击即可多重排序，无需按 Shift
  });

  // 处理详情点击
  const handleDetailClick = (bean: ExtendedCoffeeBean) => {
    window.dispatchEvent(
      new CustomEvent('beanDetailOpened', { detail: { bean } })
    );
  };

  if (allBeans.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-xs leading-relaxed font-medium text-neutral-600 dark:text-neutral-400">
        [ 暂无咖啡豆数据 ]
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* 横向滚动容器 */}
      <div
        className="scroll-with-bottom-bar h-full overflow-x-auto overflow-y-auto overscroll-none pb-20"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        <table className="w-full min-w-max border-separate border-spacing-0">
          {/* 表头 - 使用 border-separate 解决 sticky 边框问题 */}
          <thead className="sticky top-0 z-10 bg-neutral-50 dark:bg-neutral-900">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => {
                  const isFirst = index === 0;
                  const isLast = index === headerGroup.headers.length - 1;
                  const paddingClass = `py-2 ${isFirst ? 'pl-6 pr-3' : isLast ? 'pl-3 pr-6' : 'px-3'}`;
                  const sortIndex = sorting.findIndex(s => s.id === header.id);
                  const isSorted = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      className={`${paddingClass} cursor-pointer border-b border-neutral-200/50 bg-neutral-50 text-left text-xs leading-relaxed font-medium whitespace-nowrap text-neutral-600 select-none hover:text-neutral-800 dark:border-neutral-800/50 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200`}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <span className="inline-flex items-center">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        <SortIcon
                          direction={isSorted}
                          index={sorting.length > 1 ? sortIndex : undefined}
                        />
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          {/* 表体 */}
          <tbody>
            {table.getRowModel().rows.map(row => {
              const bean = row.original;
              const isEmpty = isBeanEmpty(bean);

              return (
                <tr
                  key={row.id}
                  className={`cursor-pointer transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/30 ${isEmpty ? 'opacity-50' : ''}`}
                  onClick={() => handleDetailClick(bean)}
                >
                  {row.getVisibleCells().map((cell, index) => {
                    const isFirst = index === 0;
                    const isLast = index === row.getVisibleCells().length - 1;
                    const isCapacity = cell.column.id === 'capacity';

                    const cellClass =
                      'text-xs leading-relaxed font-medium text-neutral-600 dark:text-neutral-400';
                    const paddingClass = `py-2.5 ${isFirst ? 'pl-6 pr-3' : isLast ? 'pl-3 pr-6' : 'px-3'}`;
                    // 名称、备注、风味列限制宽度
                    const widthClass =
                      cell.column.id === 'name' ||
                      cell.column.id === 'notes' ||
                      cell.column.id === 'flavor'
                        ? 'max-w-[200px] truncate'
                        : 'whitespace-nowrap';

                    return (
                      <td
                        key={cell.id}
                        className={`${cellClass} ${paddingClass} ${widthClass} border-b border-neutral-200/50 dark:border-neutral-800/50`}
                        onClick={
                          isCapacity && !isEmpty
                            ? e => {
                                e.stopPropagation();
                                onRemainingClick?.(bean, e);
                              }
                            : undefined
                        }
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TableView;
