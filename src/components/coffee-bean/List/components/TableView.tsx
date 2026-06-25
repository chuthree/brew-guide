'use client';

import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
  ColumnDef,
  Row,
  SortingFn,
  sortingFns,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { ExtendedCoffeeBean } from '../types';
import { isBeanEmpty } from '../preferences';
import { parseDateToTimestamp } from '@/lib/utils/dateUtils';
import { calculateFlavorInfo } from '@/lib/utils/flavorPeriodUtils';
import {
  getRoasterLogoFromConfigs,
  useSettingsStore,
} from '@/lib/stores/settingsStore';
import {
  formatBeanDisplayName,
  formatBeanNameWithoutRoaster,
  getRoasterName,
} from '@/lib/utils/beanVarietyUtils';
import FlavorStatusRing from './FlavorStatusRing';
import TableHoverPreview, { type HoverPreviewBean } from './TableHoverPreview';
import { getCoffeeBeanImageSource } from '@/lib/coffee-beans/imageRepository';
import {
  getDateDisplayColumnLabel,
  getDefaultVisibleColumns,
  TABLE_COLUMN_CONFIG,
  type DateDisplayMode,
  type TableColumnKey,
} from './tableColumns';
import {
  compareDateDisplayBeans,
  getAgingDays,
  getDateSortValue,
} from './tableSorting';

// 默认排序状态（空数组，表示不预设列排序）
const DEFAULT_SORTING: SortingState = [];
const SORTING_STORAGE_KEY = 'brew-guide:coffee-beans:tableSorting:v2';
const HOVER_PREVIEW_OFFSET_X = 24;
const HOVER_PREVIEW_OFFSET_Y = 20;
const HOVER_PREVIEW_HIDE_DELAY_MS = 40;
const DEFAULT_COLUMN_MIN_SIZE = 96;
const COLUMN_SIZE_CONFIG: Record<
  TableColumnKey,
  { size: number; minSize: number; maxSize?: number }
> = {
  roaster: { size: 125, minSize: 100, maxSize: 250 },
  name: { size: 200, minSize: 100, maxSize: 400 },
  flavorPeriod: { size: 90, minSize: 70, maxSize: 120 },
  capacity: { size: 90, minSize: 90, maxSize: 120 },
  price: { size: 90, minSize: 90, maxSize: 120 },
  beanType: { size: 70, minSize: 65, maxSize: 120 },
  origin: { size: 100, minSize: 90, maxSize: 200 },
  estate: { size: 100, minSize: 90, maxSize: 200 },
  process: { size: 100, minSize: 90, maxSize: 200 },
  variety: { size: 100, minSize: 90, maxSize: 200 },
  roastLevel: { size: 90, minSize: 90, maxSize: 120 },
  flavor: { size: 200, minSize: 100, maxSize: 400 },
  rating: { size: 90, minSize: 90, maxSize: 120 },
  notes: { size: 200, minSize: 160, maxSize: 400 },
};

// 从 localStorage 读取排序状态
const loadSorting = (): SortingState => {
  if (typeof window === 'undefined') return DEFAULT_SORTING;
  try {
    const saved = localStorage.getItem(SORTING_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    return DEFAULT_SORTING;
  }
  return DEFAULT_SORTING;
};

// 保存排序状态到 localStorage
const saveSorting = (sorting: SortingState) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SORTING_STORAGE_KEY, JSON.stringify(sorting));
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
    dateDisplayMode?: DateDisplayMode;
  };
  visibleColumns?: TableColumnKey[];
  activeBeanId?: string | null;
}

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

const getSortingDesc = (sorting: SortingState, columnId: string): boolean =>
  sorting.find(sort => sort.id === columnId)?.desc === true;

const compareEmptyBeanGroup = (
  rowA: Row<ExtendedCoffeeBean>,
  rowB: Row<ExtendedCoffeeBean>,
  isDesc: boolean
): number => {
  const aEmpty = isBeanEmpty(rowA.original);
  const bEmpty = isBeanEmpty(rowB.original);

  if (aEmpty === bEmpty) return 0;

  // TanStack applies desc by reversing the sortingFn result, so flip the
  // grouping value ahead of time to keep empty beans at the bottom.
  const result = aEmpty ? 1 : -1;
  return isDesc ? -result : result;
};

const createBeanSortingFn =
  (
    sorting: SortingState,
    baseSortingFn: SortingFn<ExtendedCoffeeBean>
  ): SortingFn<ExtendedCoffeeBean> =>
  (rowA, rowB, columnId) => {
    const emptyGroupResult = compareEmptyBeanGroup(
      rowA,
      rowB,
      getSortingDesc(sorting, columnId)
    );

    if (emptyGroupResult !== 0) return emptyGroupResult;

    return baseSortingFn(rowA, rowB, columnId);
  };

const buildBeanHoverPreview = async (
  bean: ExtendedCoffeeBean,
  fallback?: HoverPreviewBean | null
): Promise<HoverPreviewBean | null> => {
  const imageSrc =
    (await getCoffeeBeanImageSource(bean.id, { mode: 'original' })) ||
    bean.image ||
    '';

  if (!imageSrc) {
    return fallback ?? null;
  }

  return {
    id: `${bean.id}:bean`,
    imageSrc,
  };
};

const isSameHoverPreviewImage = (
  current: HoverPreviewBean | null,
  next: HoverPreviewBean | null
): boolean => current?.imageSrc === next?.imageSrc;

const createDirectionAwareBeanSortingFn =
  (
    sorting: SortingState,
    compareRows: (
      rowA: Row<ExtendedCoffeeBean>,
      rowB: Row<ExtendedCoffeeBean>,
      desc: boolean
    ) => number
  ): SortingFn<ExtendedCoffeeBean> =>
  (rowA, rowB, columnId) => {
    const isDesc = getSortingDesc(sorting, columnId);
    const emptyGroupResult = compareEmptyBeanGroup(rowA, rowB, isDesc);

    if (emptyGroupResult !== 0) return emptyGroupResult;

    const desiredResult = compareRows(rowA, rowB, isDesc);
    return isDesc ? -desiredResult : desiredResult;
  };

const getFlavorStatus = (bean: ExtendedCoffeeBean): string => {
  if (bean.isInTransit) return '在途';
  if (!bean.roastDate) return '-';
  if (bean.isFrozen) return '冷冻';

  const info = calculateFlavorInfo(bean);
  if (info.phase === '养豆期') return `养豆${info.remainingDays}天`;
  if (info.phase === '赏味期') return `赏味${info.remainingDays}天`;
  if (info.phase === '衰退期') return '已衰退';
  return getAgingDaysText(bean.roastDate);
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
const getColumnSizing = (columnKey: TableColumnKey) =>
  COLUMN_SIZE_CONFIG[columnKey];

const TableView: React.FC<TableViewProps> = ({
  filteredBeans,
  emptyBeans,
  showEmptyBeans,
  onRate,
  onRemainingClick,
  settings,
  visibleColumns = getDefaultVisibleColumns(),
  activeBeanId,
}) => {
  const storeDateDisplayMode = useSettingsStore(
    state => state.settings.dateDisplayMode
  );
  const dateDisplayMode =
    settings?.dateDisplayMode ?? storeDateDisplayMode ?? 'date';

  // 获取烘焙商字段设置
  const roasterFieldEnabled = useSettingsStore(
    state => state.settings.roasterFieldEnabled
  );
  const roasterSeparator = useSettingsStore(
    state => state.settings.roasterSeparator
  );
  const roasterSettings = useMemo(
    () => ({
      roasterFieldEnabled,
      roasterSeparator,
    }),
    [roasterFieldEnabled, roasterSeparator]
  );
  const prefersReducedMotion = useReducedMotion();
  const isReducedMotion = Boolean(prefersReducedMotion);
  const previewX = useMotionValue(0);
  const previewY = useMotionValue(0);
  const previewSpringX = useSpring(previewX, {
    stiffness: isReducedMotion ? 900 : 420,
    damping: isReducedMotion ? 120 : 36,
    mass: isReducedMotion ? 1 : 0.45,
  });
  const previewSpringY = useSpring(previewY, {
    stiffness: isReducedMotion ? 900 : 420,
    damping: isReducedMotion ? 120 : 36,
    mass: isReducedMotion ? 1 : 0.45,
  });
  const [supportsHoverPreview, setSupportsHoverPreview] = useState(false);
  const [hoverPreviewBean, setHoverPreviewBean] =
    useState<HoverPreviewBean | null>(null);
  const hoverPreviewRequestIdRef = useRef(0);
  const hidePreviewTimeoutRef = useRef<number | null>(null);

  // 多重排序状态（持久化）
  const [sorting, setSorting] = useState<SortingState>(loadSorting);
  const effectiveSorting = useMemo(() => {
    const hasInvisibleSortColumn = sorting.some(
      sort => !visibleColumns.includes(sort.id as TableColumnKey)
    );

    return hasInvisibleSortColumn ? DEFAULT_SORTING : sorting;
  }, [visibleColumns, sorting]);

  // 排序变化时持久化
  const handleSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      setSorting(old => {
        const newSorting =
          typeof updater === 'function' ? updater(old) : updater;
        saveSorting(newSorting);
        return newSorting;
      });
    },
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const updateSupportState = () => {
      setSupportsHoverPreview(mediaQuery.matches);
    };

    updateSupportState();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateSupportState);
      return () => mediaQuery.removeEventListener('change', updateSupportState);
    }

    mediaQuery.addListener(updateSupportState);
    return () => mediaQuery.removeListener(updateSupportState);
  }, []);

  useEffect(() => {
    if (!supportsHoverPreview) {
      setHoverPreviewBean(null);
    }
  }, [supportsHoverPreview]);

  useEffect(() => {
    return () => {
      const timeoutId = hidePreviewTimeoutRef.current;
      hidePreviewTimeoutRef.current = null;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [hidePreviewTimeoutRef]);

  const roasterConfigs = useSettingsStore(
    state => state.settings.roasterConfigs
  );

  // 合并正常豆子和用完的豆子
  const allBeans = useMemo(() => {
    if (!showEmptyBeans) return filteredBeans;
    return [...filteredBeans, ...emptyBeans];
  }, [filteredBeans, emptyBeans, showEmptyBeans]);

  const buildRoasterHoverPreview = (
    bean: ExtendedCoffeeBean
  ): HoverPreviewBean | null => {
    const roasterName = getRoasterName(bean, roasterSettings);
    if (!roasterName || roasterName === '未知烘焙商') return null;

    const imageSrc = getRoasterLogoFromConfigs(roasterConfigs, roasterName);
    if (!imageSrc) return null;

    return {
      id: `${bean.id}:roaster:${roasterName}`,
      imageSrc,
    };
  };

  const setHoverPreviewBeanIfChanged = (
    nextPreview: HoverPreviewBean | null
  ) => {
    setHoverPreviewBean(currentPreview => {
      if (isSameHoverPreviewImage(currentPreview, nextPreview)) {
        return currentPreview;
      }

      return nextPreview;
    });
  };

  const cancelScheduledHoverPreviewClear = () => {
    if (hidePreviewTimeoutRef.current === null) return;

    window.clearTimeout(hidePreviewTimeoutRef.current);
    hidePreviewTimeoutRef.current = null;
  };

  const updatePreviewPosition = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      previewX.set(event.clientX + HOVER_PREVIEW_OFFSET_X);
      previewY.set(event.clientY + HOVER_PREVIEW_OFFSET_Y);
    },
    [previewX, previewY]
  );

  const handlePreviewCellMouseEnter = (
    bean: ExtendedCoffeeBean,
    kind: 'bean' | 'roaster',
    event: React.MouseEvent<HTMLElement>
  ) => {
    if (!supportsHoverPreview) return;
    cancelScheduledHoverPreviewClear();
    updatePreviewPosition(event);

    const requestId = hoverPreviewRequestIdRef.current + 1;
    hoverPreviewRequestIdRef.current = requestId;

    if (kind === 'roaster') {
      setHoverPreviewBeanIfChanged(buildRoasterHoverPreview(bean));
      return;
    }

    const fallbackPreviewBean = buildRoasterHoverPreview(bean);
    if (fallbackPreviewBean) {
      setHoverPreviewBeanIfChanged(fallbackPreviewBean);
    }

    void buildBeanHoverPreview(bean, fallbackPreviewBean).then(previewBean => {
      if (hoverPreviewRequestIdRef.current !== requestId) return;
      setHoverPreviewBeanIfChanged(previewBean);
    });
  };

  const handleNameCellMouseMove = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!supportsHoverPreview) return;
      updatePreviewPosition(event);
    },
    [supportsHoverPreview, updatePreviewPosition]
  );

  const clearHoverPreview = useCallback(() => {
    hoverPreviewRequestIdRef.current += 1;
    cancelScheduledHoverPreviewClear();
    hidePreviewTimeoutRef.current = window.setTimeout(() => {
      hidePreviewTimeoutRef.current = null;
      setHoverPreviewBeanIfChanged(null);
    }, HOVER_PREVIEW_HIDE_DELAY_MS);
  }, []);

  const handleRateClick = useCallback(
    (bean: ExtendedCoffeeBean, event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      onRate?.(bean);
    },
    [onRate]
  );

  // 检查是否有生豆
  const hasGreenBeans = useMemo(
    () => allBeans.some(bean => bean.beanState === 'green'),
    [allBeans]
  );

  // 定义所有列
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns = useMemo<ColumnDef<ExtendedCoffeeBean, any>[]>(() => {
    const showRoasterColumn = visibleColumns.includes('roaster');
    const basicSortingFn = createBeanSortingFn(
      effectiveSorting,
      sortingFns.basic as SortingFn<ExtendedCoffeeBean>
    );
    const alphanumericSortingFn = createBeanSortingFn(
      effectiveSorting,
      sortingFns.alphanumeric as SortingFn<ExtendedCoffeeBean>
    );
    const dateDisplaySortingFn = createDirectionAwareBeanSortingFn(
      effectiveSorting,
      (rowA, rowB, desc) =>
        compareDateDisplayBeans(
          rowA.original,
          rowB.original,
          dateDisplayMode,
          desc
        )
    );
    const getNameDisplayValue = (bean: ExtendedCoffeeBean) =>
      showRoasterColumn
        ? formatBeanNameWithoutRoaster(bean, roasterSettings)
        : formatBeanDisplayName(bean, roasterSettings);
    const nameSortingFn = createBeanSortingFn(sorting, (rowA, rowB) =>
      getNameDisplayValue(rowA.original).localeCompare(
        getNameDisplayValue(rowB.original),
        'zh-CN'
      )
    );

    const allColumns: Record<
      TableColumnKey,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ColumnDef<ExtendedCoffeeBean, any>
    > = {
      roaster: columnHelper.accessor(
        row => getRoasterName(row, roasterSettings) || '-',
        {
          id: 'roaster',
          header: '烘焙商',
          cell: info => info.getValue(),
          sortingFn: alphanumericSortingFn,
          ...getColumnSizing('roaster'),
        }
      ),
      name: columnHelper.accessor(row => getNameDisplayValue(row), {
        id: 'name',
        header: '名称',
        cell: ({ row }) => getNameDisplayValue(row.original),
        sortingFn: nameSortingFn,
        ...getColumnSizing('name'),
      }),
      flavorPeriod: columnHelper.accessor(
        row => getDateSortValue(row, dateDisplayMode),
        {
          id: 'flavorPeriod',
          header: getDateDisplayColumnLabel(dateDisplayMode, hasGreenBeans),
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
                <FlavorStatusRing bean={bean} className="mr-1.5" />
                {content}
              </span>
            );
          },
          sortingFn: dateDisplaySortingFn,
          ...getColumnSizing('flavorPeriod'),
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
        sortingFn: basicSortingFn,
        ...getColumnSizing('capacity'),
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
          sortingFn: basicSortingFn,
          ...getColumnSizing('price'),
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
        sortingFn: alphanumericSortingFn,
        ...getColumnSizing('beanType'),
      }),
      origin: columnHelper.accessor(
        row => row.blendComponents?.[0]?.origin || '',
        {
          id: 'origin',
          header: '产地',
          cell: info => info.getValue() || '-',
          sortingFn: alphanumericSortingFn,
          ...getColumnSizing('origin'),
        }
      ),
      estate: columnHelper.accessor(
        row => row.blendComponents?.[0]?.estate || '',
        {
          id: 'estate',
          header: '庄园',
          cell: info => info.getValue() || '-',
          sortingFn: alphanumericSortingFn,
          ...getColumnSizing('estate'),
        }
      ),
      process: columnHelper.accessor(
        row => row.blendComponents?.[0]?.process || '',
        {
          id: 'process',
          header: '处理法',
          cell: info => info.getValue() || '-',
          sortingFn: alphanumericSortingFn,
          ...getColumnSizing('process'),
        }
      ),
      variety: columnHelper.accessor(
        row => row.blendComponents?.[0]?.variety || '',
        {
          id: 'variety',
          header: '品种',
          cell: info => info.getValue() || '-',
          sortingFn: alphanumericSortingFn,
          ...getColumnSizing('variety'),
        }
      ),
      roastLevel: columnHelper.accessor(row => row.roastLevel || '', {
        id: 'roastLevel',
        header: '烘焙度',
        cell: info => info.getValue() || '-',
        sortingFn: alphanumericSortingFn,
        ...getColumnSizing('roastLevel'),
      }),
      flavor: columnHelper.accessor(row => row.flavor?.join('、') || '', {
        id: 'flavor',
        header: '风味',
        cell: info => info.getValue() || '-',
        sortingFn: alphanumericSortingFn,
        ...getColumnSizing('flavor'),
      }),
      rating: columnHelper.accessor(row => row.overallRating || 0, {
        id: 'rating',
        header: '评分',
        cell: ({ row }) => {
          const bean = row.original;
          const rating = bean.overallRating;
          const displayValue = rating && rating > 0 ? rating : '-';

          if (!onRate) {
            return displayValue;
          }

          const beanName = formatBeanDisplayName(bean, roasterSettings);
          const actionLabel =
            rating && rating > 0
              ? `编辑 ${beanName} 的评分`
              : `添加 ${beanName} 的评分`;

          return (
            <button
              type="button"
              className="block w-full cursor-pointer text-left"
              onClick={event => handleRateClick(bean, event)}
              aria-label={actionLabel}
              title={actionLabel}
            >
              {displayValue}
            </button>
          );
        },
        sortingFn: basicSortingFn,
        ...getColumnSizing('rating'),
      }),
      notes: columnHelper.accessor(row => row.notes || '', {
        id: 'notes',
        header: '备注',
        cell: info => info.getValue() || '-',
        sortingFn: alphanumericSortingFn,
        ...getColumnSizing('notes'),
      }),
    };

    // 按照配置顺序返回可见列
    return TABLE_COLUMN_CONFIG.filter(col =>
      visibleColumns.includes(col.key)
    ).map(col => allColumns[col.key]);
  }, [
    visibleColumns,
    dateDisplayMode,
    effectiveSorting,
    hasGreenBeans,
    handleRateClick,
    onRate,
    roasterSettings,
  ]);

  // 创建表格实例
  const table = useReactTable({
    data: allBeans,
    columns,
    state: { sorting: effectiveSorting },
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableMultiSort: true,
    isMultiSortEvent: () => true,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
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
        onScroll={clearHoverPreview}
      >
        <table
          className="w-full min-w-max border-separate border-spacing-0"
          style={{ minWidth: table.getTotalSize() }}
        >
          {/* 表头 - 使用 border-separate 解决 sticky 边框问题 */}
          <thead className="sticky top-0 z-10 bg-neutral-50 dark:bg-neutral-900">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => {
                  const isFirst = index === 0;
                  const isLast = index === headerGroup.headers.length - 1;
                  const paddingClass = `py-2 ${isFirst ? 'pl-6 pr-3' : isLast ? 'pl-3 pr-6' : 'px-3'}`;
                  const sortIndex = effectiveSorting.findIndex(
                    s => s.id === header.id
                  );
                  const isSorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  const canResize = header.column.getCanResize();
                  const isResizing = header.column.getIsResizing();
                  const resizeHandler = header.getResizeHandler();

                  return (
                    <th
                      key={header.id}
                      className="group relative border-b border-neutral-200/50 bg-neutral-50 text-left text-xs leading-relaxed font-medium whitespace-nowrap text-neutral-600 select-none dark:border-neutral-800/50 dark:bg-neutral-900 dark:text-neutral-400"
                      style={{
                        width: header.getSize(),
                        minWidth:
                          header.column.columnDef.minSize ??
                          DEFAULT_COLUMN_MIN_SIZE,
                      }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={`relative flex items-center ${paddingClass}`}
                        >
                          <button
                            type="button"
                            className={`inline-flex items-center ${
                              canSort
                                ? 'cursor-pointer hover:text-neutral-800 dark:hover:text-neutral-200'
                                : 'cursor-default'
                            }`}
                            onClick={
                              canSort
                                ? header.column.getToggleSortingHandler()
                                : undefined
                            }
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            <SortIcon
                              direction={isSorted}
                              index={
                                effectiveSorting.length > 1
                                  ? sortIndex
                                  : undefined
                              }
                            />
                          </button>
                          {canResize && (
                            <div
                              role="separator"
                              aria-label={`调整${
                                String(
                                  flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )
                                ) || '列'
                              }宽度`}
                              aria-orientation="vertical"
                              className={`absolute top-0 right-0 z-20 h-full w-4 translate-x-1/2 cursor-col-resize touch-none ${
                                isResizing
                                  ? 'opacity-100'
                                  : 'opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100'
                              }`}
                              onMouseDown={resizeHandler}
                              onTouchStart={resizeHandler}
                              onDoubleClick={() => header.column.resetSize()}
                              onClick={event => event.stopPropagation()}
                            >
                              <span
                                className={`absolute top-1/2 left-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-200 transition-opacity dark:bg-neutral-800 ${
                                  isResizing ? 'opacity-100' : 'opacity-70'
                                }`}
                              />
                            </div>
                          )}
                        </div>
                      )}
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
              const isActive = activeBeanId === bean.id;

              return (
                <tr
                  key={row.id}
                  className={`cursor-pointer hover:bg-neutral-100 active:bg-neutral-100 dark:hover:bg-neutral-800/30 dark:active:bg-neutral-800/30 ${
                    isActive ? 'bg-neutral-100 dark:bg-neutral-800/30' : ''
                  } ${isEmpty ? 'opacity-50' : ''}`}
                  onClick={() => handleDetailClick(bean)}
                  aria-selected={isActive}
                >
                  {row.getVisibleCells().map((cell, index) => {
                    const isFirst = index === 0;
                    const isLast = index === row.getVisibleCells().length - 1;
                    const isCapacity = cell.column.id === 'capacity';
                    const isName = cell.column.id === 'name';
                    const isRoaster = cell.column.id === 'roaster';
                    const isPreviewCell = isName || isRoaster;
                    const isRating =
                      cell.column.id === 'rating' && Boolean(onRate);

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
                        style={{
                          width: cell.column.getSize(),
                          minWidth:
                            cell.column.columnDef.minSize ??
                            DEFAULT_COLUMN_MIN_SIZE,
                        }}
                        onClick={
                          isCapacity && !isEmpty
                            ? e => {
                                e.stopPropagation();
                                onRemainingClick?.(bean, e);
                              }
                            : isRating
                              ? e => handleRateClick(bean, e)
                              : undefined
                        }
                        onMouseEnter={
                          isPreviewCell
                            ? e =>
                                handlePreviewCellMouseEnter(
                                  bean,
                                  isRoaster ? 'roaster' : 'bean',
                                  e
                                )
                            : undefined
                        }
                        onMouseMove={
                          isPreviewCell ? handleNameCellMouseMove : undefined
                        }
                        onMouseLeave={
                          isPreviewCell ? clearHoverPreview : undefined
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
      {supportsHoverPreview && (
        <TableHoverPreview
          previewBean={hoverPreviewBean}
          x={previewSpringX}
          y={previewSpringY}
          reducedMotion={isReducedMotion}
        />
      )}
    </div>
  );
};

export default TableView;
