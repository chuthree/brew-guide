'use client';

import React, {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  ViewOption,
  VIEW_OPTIONS,
  BeanType,
  BeanState,
  BeanFilterMode,
  BEAN_STATE_LABELS,
  BEAN_FIELD_ID_BY_FILTER_MODE,
  getBeanFilterModeLabel,
} from '../types';
import {
  SortOption,
  getSortTypeAndOrder,
  getSortOption,
  getSortOrderLabel,
  getSortOrdersForType,
  getAvailableSortTypesForView,
  getSortTypeLabelByState,
} from '../SortSelector';
import { X, AlignLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FlavorPeriodStatus,
  FLAVOR_PERIOD_LABELS,
} from '@/lib/utils/beanVarietyUtils';
import {
  getDateDisplayColumnLabel,
  TABLE_COLUMN_CONFIG,
  type TableColumnKey,
} from './tableColumns';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useInputFocus } from '@/lib/hooks/useInputFocus';
import { useHorizontalWheelScroll } from '@/lib/hooks/useHorizontalWheelScroll';
import {
  useNavigationSwipe,
  type NavigationSwipeControl,
} from '@/lib/navigation/navigationSwipe';
import {
  buildBeanSummaryDetailItems,
  getBeanSummaryDisplayLimit,
  getBeanSummaryLimitMode,
} from '@/lib/utils/beanSummaryDisplay';
import type { CoffeeBeanGroup } from '@/lib/data/models';
import type { BeanFieldId } from '@/lib/coffee-beans/beanFields';
import TabButton from '@/components/common/ui/TabButton';
import { centerCategoryTab } from '@/lib/utils/centerCategoryTab';
import SearchAllSuggestion from '@/components/common/ui/SearchAllSuggestion';
import {
  formatRankingDateLabel,
  type RankingDateGroupingMode,
  type RankingFilterMode,
} from '../rankingFilters';
// Apple风格动画配置
const FILTER_ANIMATION = {
  initial: {
    height: 0,
    opacity: 0,
    y: -10,
  },
  animate: {
    height: 'auto',
    opacity: 1,
    y: 0,
  },
  exit: {
    height: 0,
    opacity: 0,
    y: -10,
  },
  transition: {
    duration: 0.35,
    opacity: {
      duration: 0.25,
    },
  },
};

const isInsideFilterInteraction = (
  event: PointerEvent,
  elements: Array<HTMLElement | null>
) => {
  const target = event.target;
  const path =
    typeof event.composedPath === 'function' ? event.composedPath() : [];

  if (
    target instanceof Element &&
    target.closest('[data-filter-toggle-button="true"]')
  ) {
    return true;
  }

  return elements.some(element => {
    if (!element) return false;
    if (path.includes(element)) return true;
    return target instanceof Node && element.contains(target);
  });
};

const EMPTY_BEAN_GROUPS: CoffeeBeanGroup[] = [];
type SelectableBeanType = Exclude<BeanType, 'all'>;

const BEAN_TYPE_LABELS: Record<SelectableBeanType, string> = {
  espresso: '意式',
  filter: '手冲',
  omni: '全能',
};

const BEAN_TYPE_ORDER: SelectableBeanType[] = ['espresso', 'filter', 'omni'];

export const getNextBeanType = (
  availableBeanTypes: readonly SelectableBeanType[],
  selectedBeanType?: BeanType
): BeanType | null => {
  if (availableBeanTypes.length === 0) return null;
  if (!selectedBeanType || selectedBeanType === 'all') {
    return availableBeanTypes[0];
  }

  const currentIndex = availableBeanTypes.indexOf(selectedBeanType);
  return currentIndex === -1 || currentIndex === availableBeanTypes.length - 1
    ? 'all'
    : availableBeanTypes[currentIndex + 1];
};

type InventoryAllClickAction =
  | 'clear-variety'
  | 'clear-origin'
  | 'clear-processing-method'
  | 'clear-flavor-period'
  | 'clear-roaster'
  | 'clear-group'
  | 'none';

export const getInventoryAllClickAction = ({
  filterMode,
  selectedVariety,
  selectedOrigin,
  selectedProcessingMethod,
  selectedFlavorPeriod,
  selectedRoaster,
  selectedBeanGroupId,
}: {
  filterMode: BeanFilterMode;
  selectedVariety?: string | null;
  selectedOrigin?: string | null;
  selectedProcessingMethod?: string | null;
  selectedFlavorPeriod?: FlavorPeriodStatus | null;
  selectedRoaster?: string | null;
  selectedBeanGroupId?: string | null;
}): InventoryAllClickAction => {
  const fieldId = BEAN_FIELD_ID_BY_FILTER_MODE[filterMode];
  if (fieldId === 'variety' && selectedVariety != null) {
    return 'clear-variety';
  }
  if (
    (fieldId === 'origin' ||
      fieldId === 'country' ||
      fieldId === 'region' ||
      fieldId === 'estate' ||
      fieldId === 'processingStation' ||
      fieldId === 'altitude') &&
    selectedOrigin != null
  ) {
    return 'clear-origin';
  }
  if (
    (fieldId === 'process' || fieldId === 'batch') &&
    selectedProcessingMethod != null
  ) {
    return 'clear-processing-method';
  }
  if (filterMode === 'flavorPeriod' && selectedFlavorPeriod != null) {
    return 'clear-flavor-period';
  }
  if (filterMode === 'roaster' && selectedRoaster != null) {
    return 'clear-roaster';
  }
  if (filterMode === 'group' && selectedBeanGroupId != null) {
    return 'clear-group';
  }

  return 'none';
};

// 筛选按钮组件 - 用于筛选区域的轻量样式
interface FilterButtonProps {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

const FilterButton: React.FC<FilterButtonProps> = ({
  isActive,
  onClick,
  children,
  className = '',
  disabled = false,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
      isActive
        ? 'bg-neutral-300/30 text-neutral-800 dark:bg-neutral-600/50 dark:text-neutral-200'
        : 'bg-neutral-200/30 text-neutral-400 dark:bg-neutral-800/50 dark:text-neutral-400'
    } ${disabled ? 'cursor-not-allowed opacity-40' : ''} ${className}`}
  >
    {children}
  </button>
);

// 排序区域组件 - 使用筛选按钮样式
interface SortSectionProps {
  viewMode: ViewOption;
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
  selectedBeanState?: BeanState;
}

const SortSection: React.FC<SortSectionProps> = ({
  viewMode,
  sortOption,
  onSortChange,
  selectedBeanState = 'roasted',
}) => {
  const { type: currentType, order: currentOrder } =
    getSortTypeAndOrder(sortOption);

  return (
    <div>
      <div className="mb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
        排序
      </div>
      <div className="space-y-3">
        {/* 排序方式 */}
        <div className="flex flex-wrap items-center gap-2">
          {getAvailableSortTypesForView(viewMode, selectedBeanState).map(
            type => (
              <FilterButton
                key={type}
                isActive={type === currentType}
                onClick={() => {
                  const newOption = getSortOption(
                    type,
                    getSortOrdersForType(type)[0]
                  );
                  onSortChange(newOption);
                }}
              >
                {getSortTypeLabelByState(type, selectedBeanState)}
              </FilterButton>
            )
          )}
        </div>

        {/* 排序顺序 */}
        {currentType !== 'original' && (
          <div className="flex flex-wrap items-center gap-2">
            {getSortOrdersForType(currentType).map(order => (
              <FilterButton
                key={order}
                isActive={order === currentOrder}
                onClick={() => onSortChange(getSortOption(currentType, order))}
              >
                {getSortOrderLabel(currentType, order)}
              </FilterButton>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// 豆子类型筛选组件
interface BeanTypeFilterProps {
  selectedBeanType?: BeanType;
  onBeanTypeChange?: (type: BeanType) => void;
  showAll?: boolean;
  espressoCount?: number;
  filterCount?: number;
  omniCount?: number;
  // 总体统计（用于判断按钮是否应该禁用）
  totalEspressoCount?: number;
  totalFilterCount?: number;
  totalOmniCount?: number;
}

const BeanTypeFilter: React.FC<BeanTypeFilterProps> = ({
  selectedBeanType,
  onBeanTypeChange,
  showAll = true,
  totalEspressoCount = 0,
  totalFilterCount = 0,
  totalOmniCount = 0,
}) => (
  <div>
    <div className="mb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
      类型
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {showAll && (
        <FilterButton
          isActive={selectedBeanType === 'all' || !selectedBeanType}
          onClick={() => onBeanTypeChange?.('all')}
        >
          全部
        </FilterButton>
      )}
      <FilterButton
        isActive={selectedBeanType === 'espresso'}
        onClick={() => totalEspressoCount > 0 && onBeanTypeChange?.('espresso')}
        disabled={totalEspressoCount === 0}
      >
        {showAll ? '意式' : '意式豆'}
      </FilterButton>
      <FilterButton
        isActive={selectedBeanType === 'filter'}
        onClick={() => totalFilterCount > 0 && onBeanTypeChange?.('filter')}
        disabled={totalFilterCount === 0}
      >
        {showAll ? '手冲' : '手冲豆'}
      </FilterButton>
      <FilterButton
        isActive={selectedBeanType === 'omni'}
        onClick={() => totalOmniCount > 0 && onBeanTypeChange?.('omni')}
        disabled={totalOmniCount === 0}
      >
        {showAll ? '全能' : '全能豆'}
      </FilterButton>
    </div>
  </div>
);

// 分类模式选择组件
interface FilterModeSectionProps {
  filterMode: BeanFilterMode;
  onFilterModeChange: (mode: BeanFilterMode) => void;
  selectedBeanState?: BeanState;
  hasBeanGroups?: boolean;
  enabledBeanFieldFilterModes?: BeanFilterMode[];
}

const FilterModeSection: React.FC<FilterModeSectionProps> = ({
  filterMode,
  onFilterModeChange,
  selectedBeanState = 'roasted',
  hasBeanGroups = false,
  enabledBeanFieldFilterModes = ['origin', 'processingMethod', 'variety'],
}) => {
  const isGreenBean = selectedBeanState === 'green';

  return (
    <div>
      <div className="mb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
        分类
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FilterButton
          isActive={filterMode === 'roaster'}
          onClick={() => onFilterModeChange('roaster')}
        >
          {isGreenBean ? '按生豆商' : '按烘焙商'}
        </FilterButton>
        {/* 赏味期筛选仅对熟豆显示 */}
        {!isGreenBean && (
          <FilterButton
            isActive={filterMode === 'flavorPeriod'}
            onClick={() => onFilterModeChange('flavorPeriod')}
          >
            按赏味期
          </FilterButton>
        )}
        {!isGreenBean && hasBeanGroups && (
          <FilterButton
            isActive={filterMode === 'group'}
            onClick={() => onFilterModeChange('group')}
          >
            按分组
          </FilterButton>
        )}
        {enabledBeanFieldFilterModes.map(mode => (
          <FilterButton
            key={mode}
            isActive={filterMode === mode}
            onClick={() => onFilterModeChange(mode)}
          >
            {getBeanFilterModeLabel(mode)}
          </FilterButton>
        ))}
      </div>
    </div>
  );
};

const RankingFilterModeSection: React.FC<{
  filterMode: RankingFilterMode;
  onFilterModeChange: (mode: RankingFilterMode) => void;
}> = ({ filterMode, onFilterModeChange }) => (
  <div>
    <div className="mb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
      分类
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <FilterButton
        isActive={filterMode === 'type'}
        onClick={() => onFilterModeChange('type')}
      >
        按类型
      </FilterButton>
      <FilterButton
        isActive={filterMode === 'date'}
        onClick={() => onFilterModeChange('date')}
      >
        按时间
      </FilterButton>
      <FilterButton
        isActive={filterMode === 'roaster'}
        onClick={() => onFilterModeChange('roaster')}
      >
        按烘焙商
      </FilterButton>
    </div>
  </div>
);

const RankingDateGroupingSection: React.FC<{
  dateGroupingMode: RankingDateGroupingMode;
  onDateGroupingModeChange: (mode: RankingDateGroupingMode) => void;
}> = ({ dateGroupingMode, onDateGroupingModeChange }) => (
  <div>
    <div className="mb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
      时间分组
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {(['year', 'month', 'day'] as const).map(mode => (
        <FilterButton
          key={mode}
          isActive={dateGroupingMode === mode}
          onClick={() => onDateGroupingModeChange(mode)}
        >
          {mode === 'year' ? '按年' : mode === 'month' ? '按月' : '按日'}
        </FilterButton>
      ))}
    </div>
  </div>
);

interface ViewSwitcherProps {
  viewMode: ViewOption;
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
  beansCount: number;
  totalBeans?: number;
  totalWeight?: string;
  originalTotalWeight?: string;
  rankingBeanType?: BeanType;
  onRankingBeanTypeChange?: (type: BeanType) => void;
  selectedBeanType?: BeanType;
  onBeanTypeChange?: (type: BeanType) => void;
  selectedBeanState?: BeanState;
  onBeanStateChange?: (state: BeanState) => void;
  selectedVariety?: string | null;
  onVarietyClick?: (variety: string | null) => void;
  showEmptyBeans?: boolean;
  onToggleShowEmptyBeans?: () => void;
  onSearchClick?: () => void;
  availableVarieties?: string[];
  isSearching?: boolean;
  setIsSearching?: (value: boolean) => void;
  searchQuery?: string;
  setSearchQuery?: (value: string) => void;
  onSearchKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSearchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  rankingBeansCount?: number;
  // 榜单各类型豆子数量
  rankingEspressoCount?: number;
  rankingFilterCount?: number;
  rankingOmniCount?: number;
  rankingFilterMode?: RankingFilterMode;
  onRankingFilterModeChange?: (mode: RankingFilterMode) => void;
  rankingDateGroupingMode?: RankingDateGroupingMode;
  onRankingDateGroupingModeChange?: (mode: RankingDateGroupingMode) => void;
  rankingSelectedDate?: string | null;
  onRankingDateClick?: (date: string | null) => void;
  rankingSelectedRoaster?: string | null;
  onRankingRoasterClick?: (roaster: string | null) => void;
  rankingAvailableDates?: string[];
  rankingAvailableRoasters?: string[];
  // 新增图片流模式相关props
  isImageFlowMode?: boolean;
  hasImageBeans?: boolean;
  // 新增显示模式 props（替代 isImageFlowMode）
  displayMode?: 'list' | 'imageFlow' | 'table';
  onDisplayModeChange?: (mode: 'list' | 'imageFlow' | 'table') => void;
  // 表格列配置相关 props
  tableVisibleColumns?: TableColumnKey[];
  onTableColumnsChange?: (columns: TableColumnKey[]) => void;
  // 新增分类相关props
  filterMode?: BeanFilterMode;
  onFilterModeChange?: (mode: BeanFilterMode) => void;
  selectedOrigin?: string | null;
  onOriginClick?: (origin: string | null) => void;
  selectedFlavorPeriod?: FlavorPeriodStatus | null;
  onFlavorPeriodClick?: (status: FlavorPeriodStatus | null) => void;
  selectedRoaster?: string | null;
  onRoasterClick?: (roaster: string | null) => void;
  selectedBeanGroupId?: string | null;
  onBeanGroupClick?: (groupId: string | null) => void;
  selectedProcessingMethod?: string | null;
  onProcessingMethodClick?: (method: string | null) => void;
  availableOrigins?: string[];
  availableProcessingMethods?: string[];
  availableBeanFieldValues?: Partial<Record<BeanFieldId, string[]>>;
  enabledBeanFieldFilterModes?: BeanFilterMode[];
  availableFlavorPeriods?: FlavorPeriodStatus[];
  availableRoasters?: string[];
  availableBeanGroups?: CoffeeBeanGroup[];
  // 新增导出相关props
  onExportPreview?: () => void;
  // 新增类型统计props（基于当前筛选条件）
  espressoCount?: number;
  filterCount?: number;
  omniCount?: number;
  // 新增类型剩余量props
  espressoRemaining?: number;
  filterRemaining?: number;
  omniRemaining?: number;
  // 总体类型统计props（用于判断按钮禁用状态）
  totalEspressoCount?: number;
  totalFilterCount?: number;
  totalOmniCount?: number;
  // 新增搜索历史相关props
  searchHistory?: string[];
  onSearchHistoryClick?: (query: string) => void;
  searchAllScopeLabel?: string;
  onSearchAllClick?: () => void;
  // 生豆库启用设置
  enableGreenBeanInventory?: boolean;
  // 预计杯数
  estimatedCupsLabel?: string;
  // 是否有生豆（用于动态调整列标签）
  hasGreenBeans?: boolean;
  navigationToggleControl?: React.ReactNode;
  navigationSwipeControl?: NavigationSwipeControl;
}

const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  viewMode,
  sortOption,
  onSortChange,
  beansCount,
  totalBeans,
  totalWeight,
  originalTotalWeight,
  rankingBeanType = 'all',
  onRankingBeanTypeChange,
  selectedBeanType,
  onBeanTypeChange,
  selectedBeanState = 'roasted',
  onBeanStateChange,
  selectedVariety,
  onVarietyClick,
  showEmptyBeans,
  onToggleShowEmptyBeans,
  onSearchClick: _onSearchClick,
  availableVarieties,
  isSearching,
  setIsSearching,
  searchQuery = '',
  setSearchQuery,
  onSearchKeyDown,
  onSearchChange,
  rankingBeansCount,
  // 榜单各类型豆子数量参数
  rankingEspressoCount = 0,
  rankingFilterCount = 0,
  rankingOmniCount = 0,
  rankingFilterMode = 'type',
  onRankingFilterModeChange,
  rankingDateGroupingMode = 'month',
  onRankingDateGroupingModeChange,
  rankingSelectedDate,
  onRankingDateClick,
  rankingSelectedRoaster,
  onRankingRoasterClick,
  rankingAvailableDates = [],
  rankingAvailableRoasters = [],
  isImageFlowMode = false,
  hasImageBeans = true,
  // 新增显示模式参数
  displayMode: externalDisplayMode,
  onDisplayModeChange,
  // 表格列配置参数
  tableVisibleColumns = [],
  onTableColumnsChange,
  // 新增分类相关参数
  filterMode = 'variety',
  onFilterModeChange,
  selectedOrigin,
  onOriginClick,
  selectedFlavorPeriod,
  onFlavorPeriodClick,
  selectedRoaster,
  onRoasterClick,
  selectedBeanGroupId,
  onBeanGroupClick,
  selectedProcessingMethod,
  onProcessingMethodClick,
  availableOrigins = [],
  availableProcessingMethods = [],
  availableBeanFieldValues = {},
  enabledBeanFieldFilterModes,
  availableFlavorPeriods = [],
  availableRoasters = [],
  availableBeanGroups = EMPTY_BEAN_GROUPS,
  // 新增导出相关参数
  onExportPreview,
  // 新增类型统计参数（基于当前筛选条件）
  espressoCount = 0,
  filterCount = 0,
  omniCount = 0,
  // 新增类型剩余量参数
  espressoRemaining = 0,
  filterRemaining = 0,
  omniRemaining = 0,
  // 总体类型统计参数（用于判断按钮禁用状态）
  totalEspressoCount = 0,
  totalFilterCount = 0,
  totalOmniCount = 0,
  // 新增搜索历史参数
  searchHistory = [],
  onSearchHistoryClick,
  searchAllScopeLabel,
  onSearchAllClick,
  // 生豆库启用设置
  enableGreenBeanInventory = false,
  // 预计杯数
  estimatedCupsLabel,
  // 是否有生豆（用于动态调整列标签）
  hasGreenBeans = false,
  navigationToggleControl,
  navigationSwipeControl,
}) => {
  // 获取概要显示设置
  const showBeanSummary = useSettingsStore(
    state => state.settings.showBeanSummary
  );
  const showEstimatedCups = useSettingsStore(
    state => state.settings.showEstimatedCups
  );
  const dateDisplayMode = useSettingsStore(
    state => state.settings.dateDisplayMode ?? 'date'
  );
  const hasConfiguredBeanGroups = useSettingsStore(
    state => (state.settings.coffeeBeanGroups?.length || 0) > 0
  );
  const navigationSwipeHandlers = useNavigationSwipe(navigationSwipeControl);
  const beanSummaryDisplayLimit = useSettingsStore(state =>
    getBeanSummaryDisplayLimit(state.settings)
  );
  const beanSummaryLimitMode = useSettingsStore(state =>
    getBeanSummaryLimitMode(state.settings)
  );
  const availableBeanTypes = useMemo(
    () =>
      BEAN_TYPE_ORDER.filter(type => {
        if (type === 'espresso') return totalEspressoCount > 0;
        if (type === 'filter') return totalFilterCount > 0;
        return totalOmniCount > 0;
      }),
    [totalEspressoCount, totalFilterCount, totalOmniCount]
  );
  const rankingAvailableBeanTypes = useMemo(
    () =>
      BEAN_TYPE_ORDER.filter(type => {
        if (type === 'espresso') return rankingEspressoCount > 0;
        if (type === 'filter') return rankingFilterCount > 0;
        return rankingOmniCount > 0;
      }),
    [rankingEspressoCount, rankingFilterCount, rankingOmniCount]
  );
  const rankingSelectedCategory =
    rankingFilterMode === 'type'
      ? rankingBeanType === 'all'
        ? null
        : rankingBeanType
      : rankingFilterMode === 'date'
        ? rankingSelectedDate
        : rankingSelectedRoaster;
  const rankingCategoryTabs = useMemo(() => {
    if (rankingFilterMode === 'date') {
      return rankingAvailableDates.map(value => ({
        value,
        label: formatRankingDateLabel(value, rankingDateGroupingMode),
      }));
    }

    if (rankingFilterMode === 'roaster') {
      return rankingAvailableRoasters.map(value => ({ value, label: value }));
    }

    return rankingAvailableBeanTypes.map(type => ({
      value: type,
      label: `${BEAN_TYPE_LABELS[type]}豆`,
    }));
  }, [
    rankingAvailableDates,
    rankingAvailableBeanTypes,
    rankingAvailableRoasters,
    rankingDateGroupingMode,
    rankingFilterMode,
  ]);
  const handleRankingCategoryClick = useCallback(
    (value: string | null) => {
      if (rankingFilterMode === 'type') {
        onRankingBeanTypeChange?.((value || 'all') as BeanType);
      } else if (rankingFilterMode === 'date') {
        onRankingDateClick?.(value);
      } else {
        onRankingRoasterClick?.(value);
      }
    },
    [
      onRankingBeanTypeChange,
      onRankingDateClick,
      onRankingRoasterClick,
      rankingFilterMode,
    ]
  );
  const selectedBeanTypeLabel =
    selectedBeanType && selectedBeanType !== 'all'
      ? BEAN_TYPE_LABELS[selectedBeanType]
      : '';
  const beanStateLabel =
    selectedBeanTypeLabel && selectedBeanState === 'roasted'
      ? `${selectedBeanTypeLabel}豆`
      : `${selectedBeanTypeLabel}${BEAN_STATE_LABELS[selectedBeanState]}`;
  const handleBeanTypeDoubleClick = useCallback(() => {
    const nextType = getNextBeanType(availableBeanTypes, selectedBeanType);
    if (nextType) onBeanTypeChange?.(nextType);
  }, [availableBeanTypes, onBeanTypeChange, selectedBeanType]);
  const rankingClickStartType = useRef(rankingBeanType);
  const handleRankingAllClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      // 原生 dblclick 之前会先触发两次 click；只在第一下保存类型。
      if (event.detail <= 1) rankingClickStartType.current = rankingBeanType;
      handleRankingCategoryClick(null);
    },
    [handleRankingCategoryClick, rankingBeanType]
  );
  const handleRankingBeanTypeDoubleClick = useCallback(
    (startType: BeanType) => {
      const nextType = getNextBeanType(rankingAvailableBeanTypes, startType);
      if (nextType) onRankingBeanTypeChange?.(nextType);
    },
    [onRankingBeanTypeChange, rankingAvailableBeanTypes]
  );
  const handleInventoryAllClick = useCallback(() => {
    const action = getInventoryAllClickAction({
      filterMode,
      selectedVariety,
      selectedOrigin,
      selectedProcessingMethod,
      selectedFlavorPeriod,
      selectedRoaster,
      selectedBeanGroupId,
    });

    switch (action) {
      case 'clear-variety':
        onVarietyClick?.(null);
        break;
      case 'clear-origin':
        onOriginClick?.(null);
        break;
      case 'clear-processing-method':
        onProcessingMethodClick?.(null);
        break;
      case 'clear-flavor-period':
        onFlavorPeriodClick?.(null);
        break;
      case 'clear-roaster':
        onRoasterClick?.(null);
        break;
      case 'clear-group':
        onBeanGroupClick?.(null);
        break;
      case 'none':
        break;
    }
  }, [
    filterMode,
    onBeanGroupClick,
    onFlavorPeriodClick,
    onOriginClick,
    onProcessingMethodClick,
    onRoasterClick,
    onVarietyClick,
    selectedBeanGroupId,
    selectedFlavorPeriod,
    selectedOrigin,
    selectedProcessingMethod,
    selectedRoaster,
    selectedVariety,
  ]);
  const beanSummaryDetailsText = useMemo(() => {
    const typeCount = [
      espressoCount > 0,
      filterCount > 0,
      omniCount > 0,
    ].filter(Boolean).length;

    if (
      !showBeanSummary ||
      selectedBeanState !== 'roasted' ||
      (selectedBeanType && selectedBeanType !== 'all') ||
      typeCount <= 1
    ) {
      return '';
    }

    const details = buildBeanSummaryDetailItems(
      [
        espressoCount > 0 ? { label: '意式', weight: espressoRemaining } : null,
        filterCount > 0 ? { label: '手冲', weight: filterRemaining } : null,
        omniCount > 0 ? { label: '全能', weight: omniRemaining } : null,
      ].filter(Boolean) as Array<{ label: string; weight: number }>,
      beanSummaryDisplayLimit,
      beanSummaryLimitMode
    );

    return details.length > 0 ? `（${details.join('，')}）` : '';
  }, [
    beanSummaryDisplayLimit,
    beanSummaryLimitMode,
    espressoCount,
    espressoRemaining,
    filterCount,
    filterRemaining,
    omniCount,
    omniRemaining,
    selectedBeanState,
    selectedBeanType,
    showBeanSummary,
  ]);
  const currentBeanFieldId = BEAN_FIELD_ID_BY_FILTER_MODE[filterMode];
  const selectedBeanFieldValue =
    currentBeanFieldId === 'variety'
      ? selectedVariety
      : currentBeanFieldId === 'process' || currentBeanFieldId === 'batch'
        ? selectedProcessingMethod
        : currentBeanFieldId
          ? selectedOrigin
          : null;
  const availableCurrentBeanFieldValues: string[] = currentBeanFieldId
    ? (availableBeanFieldValues[currentBeanFieldId] ??
      (currentBeanFieldId === 'variety'
        ? availableVarieties
        : currentBeanFieldId === 'process'
          ? availableProcessingMethods
          : currentBeanFieldId === 'origin'
            ? availableOrigins
            : []) ??
      [])
    : [];
  const handleBeanFieldValueClick = useCallback(
    (value: string) => {
      if (!currentBeanFieldId || selectedBeanFieldValue === value) {
        return;
      }

      if (currentBeanFieldId === 'variety') {
        onVarietyClick?.(value);
        return;
      }

      if (currentBeanFieldId === 'process' || currentBeanFieldId === 'batch') {
        onProcessingMethodClick?.(value);
        return;
      }

      onOriginClick?.(value);
    },
    [
      currentBeanFieldId,
      onOriginClick,
      onProcessingMethodClick,
      onVarietyClick,
      selectedBeanFieldValue,
    ]
  );
  const hasBeanGroups = hasConfiguredBeanGroups;

  // 筛选展开栏状态
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  // 筛选交互边界：只包含触发按钮和下拉内容，点击其他分类标签会按外部点击处理
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const filterToggleButtonRef = useRef<HTMLButtonElement>(null);

  // 滚动容器引用
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rankingScrollContainerRef = useRef<HTMLDivElement>(null);
  useHorizontalWheelScroll(scrollContainerRef);
  useHorizontalWheelScroll(rankingScrollContainerRef);

  // 处理滚动阴影效果
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRankingLeftShadow, setShowRankingLeftShadow] = useState(false);

  // 监听滚动事件以控制阴影显示
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      setShowLeftShadow(scrollContainerRef.current.scrollLeft > 2);
    }
  };

  // 监听榜单滚动事件
  const handleRankingScroll = () => {
    if (rankingScrollContainerRef.current) {
      setShowRankingLeftShadow(
        rankingScrollContainerRef.current.scrollLeft > 2
      );
    }
  };

  // 添加滚动事件监听
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      // 初始检测滚动位置
      handleScroll();

      scrollContainer.addEventListener('scroll', handleScroll, {
        passive: true,
      });
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);

  // 添加榜单滚动事件监听
  useEffect(() => {
    const rankingScrollContainer = rankingScrollContainerRef.current;
    if (rankingScrollContainer) {
      // 初始检测滚动位置
      handleRankingScroll();

      rankingScrollContainer.addEventListener('scroll', handleRankingScroll, {
        passive: true,
      });
      return () => {
        rankingScrollContainer.removeEventListener(
          'scroll',
          handleRankingScroll
        );
      };
    }
  }, []);

  const inventoryTabsKey = currentBeanFieldId
    ? availableCurrentBeanFieldValues.join('\u0001')
    : filterMode === 'roaster'
      ? availableRoasters.join('\u0001')
      : filterMode === 'group'
        ? availableBeanGroups.map(group => group.id).join('\u0001')
        : (availableFlavorPeriods ?? []).join('\u0001');
  const rankingTabsKey = rankingCategoryTabs.map(tab => tab.value).join('\u0001');

  useLayoutEffect(() => {
    centerCategoryTab(scrollContainerRef.current);
  }, [
    viewMode,
    isSearching,
    filterMode,
    selectedBeanFieldValue,
    selectedFlavorPeriod,
    selectedRoaster,
    selectedBeanGroupId,
    inventoryTabsKey,
  ]);

  useLayoutEffect(() => {
    centerCategoryTab(rankingScrollContainerRef.current);
  }, [viewMode, isSearching, rankingFilterMode, rankingSelectedCategory, rankingTabsKey]);

  // 注：isMinimalistMode 和 hideTotalWeight 功能已移除，始终为 false

  // 搜索相关逻辑
  const { inputRef: searchInputRef, activateAndFocus } =
    useInputFocus<HTMLInputElement>(Boolean(isSearching));

  // 处理搜索图标点击
  const handleSearchClick = () => {
    setIsFilterExpanded(false);

    if (setIsSearching) {
      activateAndFocus(() => {
        setIsSearching(true);
      });
    }
  };

  // 处理搜索框关闭
  const handleCloseSearch = () => {
    if (setIsSearching && setSearchQuery) {
      setIsSearching(false);
      setSearchQuery('');
    }
  };

  // 处理搜索输入变化
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (setSearchQuery) {
      setSearchQuery(e.target.value);
    } else if (onSearchChange) {
      onSearchChange(e);
    }
  };

  // 处理搜索框键盘事件
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (onSearchKeyDown) {
      onSearchKeyDown(e);
    } else if (e.key === 'Escape') {
      handleCloseSearch();
    }
  };

  // 处理历史记录项点击
  const handleHistoryClick = (query: string) => {
    if (onSearchHistoryClick) {
      onSearchHistoryClick(query);
    }
  };

  // 处理筛选展开栏
  const handleFilterToggle = useCallback(() => {
    setIsFilterExpanded(isExpanded => !isExpanded);
  }, []);

  // 点击外部关闭筛选展开栏
  useEffect(() => {
    if (!isFilterExpanded) return;

    const handlePointerDownOutside = (event: PointerEvent) => {
      if (
        isInsideFilterInteraction(event, [
          filterToggleButtonRef.current,
          filterDropdownRef.current,
        ])
      ) {
        return;
      }

      setIsFilterExpanded(false);
    };

    document.addEventListener('pointerdown', handlePointerDownOutside, true);

    return () => {
      document.removeEventListener(
        'pointerdown',
        handlePointerDownOutside,
        true
      );
    };
  }, [isFilterExpanded]);

  // 统计视图时不显示任何筛选栏
  if (viewMode === VIEW_OPTIONS.STATS) {
    return null;
  }

  //完全没有数据时不显示筛选栏
  // 库存视图：开启生豆库时始终显示，否则需要有咖啡豆数据
  // 榜单视图：没有评分咖啡豆
  const hasNoData =
    (viewMode === VIEW_OPTIONS.INVENTORY &&
      !enableGreenBeanInventory &&
      (totalBeans === 0 || totalBeans === undefined)) ||
    (viewMode === VIEW_OPTIONS.RANKING &&
      (!rankingBeansCount || rankingBeansCount === 0));

  if (hasNoData) {
    return null;
  }

  const newLocal =
    'shrink-0 bg-neutral-200/30 px-2 py-1 text-xs font-medium whitespace-nowrap text-neutral-400 transition-colors dark:bg-neutral-800/50 dark:text-neutral-400';
  return (
    <div
      className={`sticky top-0 flex-none space-y-6 bg-neutral-50 ${
        navigationSwipeControl?.isCollapsed ? 'pt-0' : 'pt-6'
      } md:pt-0 dark:bg-neutral-900`}
      {...navigationSwipeHandlers}
    >
      {/* 视图切换与筛选栏 - 统一布局 */}
      <div className="mb-6 flex items-center justify-between px-6">
        <div
          className={`relative min-w-0 ${navigationToggleControl ? 'pl-6' : ''}`}
        >
          {navigationToggleControl && (
            <div className="absolute top-1/2 -left-1.5 -translate-y-1/2">
              {navigationToggleControl}
            </div>
          )}
          <div className="min-w-0 text-xs font-medium tracking-wide wrap-break-word text-neutral-800 dark:text-neutral-100">
            {viewMode === VIEW_OPTIONS.INVENTORY ? (
              showEmptyBeans ? (
                <span>
                  {beansCount} 款
                  {enableGreenBeanInventory ? (
                    <span
                      className="cursor-pointer text-xs leading-none font-medium tracking-wide text-neutral-800 underline decoration-neutral-300 underline-offset-2 dark:text-neutral-100 dark:decoration-neutral-600"
                      onClick={() => {
                        // 切换生豆/熟豆
                        const newState =
                          selectedBeanState === 'green' ? 'roasted' : 'green';
                        onBeanStateChange?.(newState);
                      }}
                      title="点击切换生豆/熟豆"
                    >
                      {beanStateLabel}
                    </span>
                  ) : (
                    <span className="text-xs leading-none font-medium tracking-wide text-neutral-800 dark:text-neutral-100">
                      {beanStateLabel}
                    </span>
                  )}
                  ，总共 {originalTotalWeight || '0g'}
                  {totalWeight ? `，剩余 ${totalWeight}` : ''}
                  {showEstimatedCups &&
                    selectedBeanState === 'roasted' &&
                    estimatedCupsLabel &&
                    `，约 ${estimatedCupsLabel}`}
                </span>
              ) : (
                <span>
                  {beansCount} 款
                  {enableGreenBeanInventory ? (
                    <span
                      className="cursor-pointer text-xs leading-none font-medium tracking-wide text-neutral-800 underline decoration-neutral-300 underline-offset-2 dark:text-neutral-100 dark:decoration-neutral-600"
                      onClick={() => {
                        // 切换生豆/熟豆
                        const newState =
                          selectedBeanState === 'green' ? 'roasted' : 'green';
                        onBeanStateChange?.(newState);
                      }}
                      title="点击切换生豆/熟豆"
                    >
                      {beanStateLabel}
                    </span>
                  ) : (
                    <span className="text-xs leading-none font-medium tracking-wide text-neutral-800 dark:text-neutral-100">
                      {beanStateLabel}
                    </span>
                  )}
                  {totalWeight ? `，剩余 ${totalWeight}` : ''}
                  {showEstimatedCups &&
                    selectedBeanState === 'roasted' &&
                    estimatedCupsLabel &&
                    `，约 ${estimatedCupsLabel}`}
                  {showBeanSummary && beanSummaryDetailsText}
                </span>
              )
            ) : rankingBeansCount === 0 ? (
              '' // 当没有评分咖啡豆时不显示任何统计信息
            ) : rankingBeanType === 'all' ? (
              `${rankingBeansCount} 款已评分咖啡豆`
            ) : (
              `${rankingBeansCount} 款已评分${BEAN_TYPE_LABELS[rankingBeanType]}豆`
            )}
          </div>
        </div>

        {/* 视图切换功能已移至导航栏 */}
      </div>

      {/* 榜单标签筛选 - 仅在榜单视图中显示 */}
      {viewMode === VIEW_OPTIONS.RANKING &&
        rankingBeansCount &&
        rankingBeansCount > 0 && (
          <div>
            {/* 整个分类栏容器 - 下边框在这里 */}
            <div className="border-b border-neutral-200/50 dark:border-neutral-800/50">
              {/* 豆子筛选选项卡 */}
              <div className="relative px-6">
                {!isSearching ? (
                  <div className="relative flex items-center">
                    {/* 固定在左侧的"全部"和筛选按钮 */}
                    <div className="relative flex shrink-0 items-center bg-neutral-50 pr-3 dark:bg-neutral-900">
                      <TabButton
                        isActive={rankingSelectedCategory === null}
                        onClick={handleRankingAllClick}
                        onDoubleClick={() =>
                          handleRankingBeanTypeDoubleClick(
                            rankingClickStartType.current
                          )
                        }
                        className="mr-1"
                        dataTab="all"
                        layoutId={`ranking-${rankingFilterMode}-underline`}
                      >
                        全部
                      </TabButton>

                      {/* 筛选图标按钮 */}
                      <button
                        type="button"
                        ref={filterToggleButtonRef}
                        data-filter-toggle-button="true"
                        onClick={handleFilterToggle}
                        className="mr-1 flex items-center pb-1.5 text-xs font-medium text-neutral-400 dark:text-neutral-600"
                      >
                        <AlignLeft size={12} color="currentColor" />
                      </button>

                      {/* 左侧固定按钮的右侧渐变遮罩 */}
                      <div className="fade-mask-to-l pointer-events-none absolute top-0 right-0 bottom-0 w-5 bg-neutral-50 dark:bg-neutral-900"></div>
                    </div>

                    {/* 中间滚动区域 */}
                    <div className="relative flex-1 overflow-hidden">
                      {/* 左侧渐变阴影 - 覆盖在滚动内容上 */}
                      {showRankingLeftShadow && (
                        <div className="fade-mask-to-r pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-6 bg-neutral-50/95 dark:bg-neutral-900/95"></div>
                      )}

                      <div
                        ref={rankingScrollContainerRef}
                        data-category-scroll
                        className="flex overflow-x-auto"
                        style={{
                          scrollbarWidth: 'none',
                          msOverflowStyle: 'none',
                          WebkitOverflowScrolling: 'touch',
                        }}
                        onScroll={handleRankingScroll}
                      >
                        <style jsx>{`
                          div::-webkit-scrollbar {
                            display: none;
                          }
                        `}</style>

                        {rankingCategoryTabs.map(tab => (
                          <TabButton
                            key={tab.value}
                            isActive={rankingSelectedCategory === tab.value}
                            onClick={() =>
                              handleRankingCategoryClick(tab.value)
                            }
                            className="mr-3"
                            dataTab={tab.value}
                            layoutId={`ranking-${rankingFilterMode}-underline`}
                          >
                            {tab.label}
                          </TabButton>
                        ))}
                      </div>

                      {/* 右侧渐变阴影 - 覆盖在滚动内容上 */}
                      <div className="fade-mask-to-l pointer-events-none absolute top-0 right-0 bottom-0 w-6 bg-neutral-50/95 dark:bg-neutral-900/95"></div>
                    </div>

                    {/* 固定在右侧的搜索按钮 */}
                    <div className="relative flex shrink-0 items-center bg-neutral-50 pl-3 dark:bg-neutral-900">
                      {/* 竖直分割线 */}
                      <div className="mr-3 mb-1.5 h-3 w-px bg-neutral-200 dark:bg-neutral-800"></div>
                      <button
                        type="button"
                        onClick={handleSearchClick}
                        className="flex items-center pb-1.5 text-xs font-medium whitespace-nowrap text-neutral-600 dark:text-neutral-400"
                      >
                        <span className="relative">搜索</span>
                      </button>

                      {/* 右侧固定按钮的左侧渐变遮罩 */}
                      <div className="fade-mask-to-r pointer-events-none absolute top-0 bottom-0 left-0 w-5 bg-neutral-50 dark:bg-neutral-900"></div>
                    </div>
                  </div>
                ) : (
                  /* 搜索框 - 替换整个分类栏 */
                  <div className="relative flex items-center pb-1.5">
                    <div className="relative flex flex-1 items-center">
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        onKeyDown={handleSearchKeyDown}
                        placeholder="输入咖啡豆名称..."
                        className="w-full border-none bg-transparent pr-2 text-xs font-medium text-neutral-800 placeholder-neutral-400 outline-hidden dark:text-neutral-100 dark:placeholder-neutral-500"
                        autoComplete="off"
                        autoFocus
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleCloseSearch}
                      className="-m-2 ml-1 flex items-center p-2 text-neutral-500 dark:text-neutral-400"
                    >
                      <X size={14} color="currentColor" />
                    </button>
                  </div>
                )}
              </div>

              {/* 搜索历史下拉框 - 在搜索框没有内容时显示 */}
              {isSearching &&
                !searchQuery.trim() &&
                searchHistory &&
                searchHistory.length > 0 && (
                  <div className="border-t border-neutral-200/50 dark:border-neutral-800/50">
                    <div className="px-6 py-3">
                      <div
                        className="flex flex-wrap items-center gap-2 overflow-hidden"
                        style={{ maxHeight: '3.5rem' }}
                      >
                        <div className="shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                          历史搜索:
                        </div>
                        {searchHistory.map((item, index) => (
                          <button
                            type="button"
                            key={index}
                            onClick={() => handleHistoryClick(item)}
                            className="shrink-0 bg-neutral-200/30 px-2 py-1 text-xs font-medium whitespace-nowrap text-neutral-400 transition-colors dark:bg-neutral-800/50 dark:text-neutral-400"
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              {/* 展开式筛选栏 - 在同一个容器内 */}
              <AnimatePresence>
                {isFilterExpanded && (
                  <>
                    {/* 固定的半透明分割线 - 只在展开时显示 */}
                    <div className="border-t border-neutral-200/50 dark:border-neutral-800/50"></div>

                    <motion.div
                      ref={filterDropdownRef}
                      initial={FILTER_ANIMATION.initial}
                      animate={FILTER_ANIMATION.animate}
                      exit={FILTER_ANIMATION.exit}
                      transition={FILTER_ANIMATION.transition}
                      className="overflow-hidden"
                      style={{ willChange: 'height, opacity, transform' }}
                    >
                      <div className="px-6 py-4">
                        <div className="space-y-4">
                          {onRankingFilterModeChange && (
                            <RankingFilterModeSection
                              filterMode={rankingFilterMode}
                              onFilterModeChange={onRankingFilterModeChange}
                            />
                          )}

                          {rankingFilterMode === 'date' &&
                            onRankingDateGroupingModeChange && (
                              <RankingDateGroupingSection
                                dateGroupingMode={rankingDateGroupingMode}
                                onDateGroupingModeChange={
                                  onRankingDateGroupingModeChange
                                }
                              />
                            )}

                          {rankingFilterMode !== 'type' && (
                            <BeanTypeFilter
                              selectedBeanType={rankingBeanType}
                              onBeanTypeChange={onRankingBeanTypeChange}
                              totalEspressoCount={rankingEspressoCount}
                              totalFilterCount={rankingFilterCount}
                              totalOmniCount={rankingOmniCount}
                            />
                          )}

                          {/* 表格视图下隐藏排序，因为表格有列头排序 */}
                          {externalDisplayMode !== 'table' && (
                            <SortSection
                              viewMode={viewMode}
                              sortOption={sortOption}
                              onSortChange={onSortChange}
                              selectedBeanState={selectedBeanState}
                            />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

      {/* 库存视图的品种标签筛选 - 仅在库存视图中显示 */}
      {viewMode === VIEW_OPTIONS.INVENTORY ? (
        <div className="relative">
          {/* 整个分类栏容器 - 下边框在这里 */}
          <div className="border-b border-neutral-200/50 dark:border-neutral-800/50">
            <div className="relative px-6">
              {!isSearching ? (
                <div className="relative flex items-center">
                  {/* 固定在左侧的"全部"和筛选按钮 */}
                  <div className="relative flex shrink-0 items-center bg-neutral-50 pr-3 dark:bg-neutral-900">
                    <TabButton
                      isActive={
                        (currentBeanFieldId &&
                          selectedBeanFieldValue === null) ||
                        (filterMode === 'flavorPeriod' &&
                          selectedFlavorPeriod === null) ||
                        (filterMode === 'roaster' &&
                          selectedRoaster === null) ||
                        (filterMode === 'group' && selectedBeanGroupId === null)
                      }
                      onClick={handleInventoryAllClick}
                      onDoubleClick={handleBeanTypeDoubleClick}
                      className="mr-1"
                      dataTab="all"
                      layoutId={`inventory-${filterMode}-underline`}
                    >
                      全部
                    </TabButton>

                    {/* 筛选图标按钮 */}
                    <button
                      type="button"
                      ref={filterToggleButtonRef}
                      data-filter-toggle-button="true"
                      onClick={handleFilterToggle}
                      className="mr-1 flex items-center pb-1.5 text-xs font-medium text-neutral-400 dark:text-neutral-600"
                    >
                      <AlignLeft size={12} color="currentColor" />
                    </button>

                    {/* 左侧固定按钮的右侧渐变遮罩 */}
                    <div className="fade-mask-to-l pointer-events-none absolute top-0 right-0 bottom-0 w-5 bg-neutral-50 dark:bg-neutral-900"></div>
                  </div>

                  {/* 中间滚动区域 */}
                  <div className="relative flex-1 overflow-hidden">
                    {/* 左侧渐变阴影 - 覆盖在滚动内容上 */}
                    {showLeftShadow && (
                      <div className="fade-mask-to-r pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-6 bg-neutral-50/95 dark:bg-neutral-900/95"></div>
                    )}

                    <div
                      ref={scrollContainerRef}
                      data-category-scroll
                      className="flex overflow-x-auto"
                      style={{
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        WebkitOverflowScrolling: 'touch',
                      }}
                      onScroll={handleScroll}
                    >
                      <style jsx>{`
                        div::-webkit-scrollbar {
                          display: none;
                        }
                      `}</style>

                      {/* 根据分类模式显示不同的筛选按钮 */}
                      {currentBeanFieldId &&
                        availableCurrentBeanFieldValues.map(value => (
                          <TabButton
                            key={value}
                            isActive={selectedBeanFieldValue === value}
                            onClick={() => handleBeanFieldValueClick(value)}
                            className="mr-3"
                            dataTab={value}
                            layoutId={`inventory-${filterMode}-underline`}
                          >
                            {value}
                          </TabButton>
                        ))}

                      {filterMode === 'flavorPeriod' &&
                        availableFlavorPeriods?.map(
                          (status: FlavorPeriodStatus) => (
                            <TabButton
                              key={status}
                              isActive={selectedFlavorPeriod === status}
                              onClick={() =>
                                selectedFlavorPeriod !== status &&
                                onFlavorPeriodClick?.(status)
                              }
                              className="mr-3"
                              dataTab={status}
                              layoutId="inventory-flavorPeriod-underline"
                            >
                              {FLAVOR_PERIOD_LABELS[status]}
                            </TabButton>
                          )
                        )}

                      {filterMode === 'roaster' &&
                        availableRoasters?.map((roaster: string) => (
                          <TabButton
                            key={roaster}
                            isActive={selectedRoaster === roaster}
                            onClick={() =>
                              selectedRoaster !== roaster &&
                              onRoasterClick?.(roaster)
                            }
                            className="mr-3"
                            dataTab={roaster}
                            layoutId="inventory-roaster-underline"
                          >
                            {roaster}
                          </TabButton>
                        ))}

                      {filterMode === 'group' &&
                        availableBeanGroups.map(group => (
                          <TabButton
                            key={group.id}
                            isActive={selectedBeanGroupId === group.id}
                            onClick={() =>
                              selectedBeanGroupId !== group.id &&
                              onBeanGroupClick?.(group.id)
                            }
                            className="mr-3"
                            dataTab={group.id}
                            layoutId="inventory-group-underline"
                          >
                            {group.name}
                          </TabButton>
                        ))}
                    </div>

                    {/* 右侧渐变阴影 - 覆盖在滚动内容上 */}
                    <div className="fade-mask-to-l pointer-events-none absolute top-0 right-0 bottom-0 w-6 bg-neutral-50/95 dark:bg-neutral-900/95"></div>
                  </div>

                  {/* 固定在右侧的搜索按钮 */}
                  <div className="relative flex shrink-0 items-center bg-neutral-50 pl-3 dark:bg-neutral-900">
                    {/* 竖直分割线 */}
                    <div className="mr-3 mb-1.5 h-3 w-px bg-neutral-200 dark:bg-neutral-800"></div>
                    <button
                      type="button"
                      onClick={handleSearchClick}
                      className="flex items-center pb-1.5 text-xs font-medium whitespace-nowrap text-neutral-600 dark:text-neutral-400"
                    >
                      <span className="relative">搜索</span>
                    </button>

                    {/* 右侧固定按钮的左侧渐变遮罩 */}
                    <div className="fade-mask-to-r pointer-events-none absolute top-0 bottom-0 left-0 w-5 bg-neutral-50 dark:bg-neutral-900"></div>
                  </div>
                </div>
              ) : (
                <div className="relative flex items-center pb-1.5">
                  <div className="relative flex flex-1 items-center">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={handleSearchChange}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="输入咖啡豆名称..."
                      className="w-full border-none bg-transparent pr-2 text-xs font-medium text-neutral-800 placeholder-neutral-400 outline-hidden dark:text-neutral-100 dark:placeholder-neutral-500"
                      autoComplete="off"
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseSearch}
                    className="-m-2 ml-1 flex items-center p-2 text-neutral-500 dark:text-neutral-400"
                  >
                    <X size={14} color="currentColor" />
                  </button>
                </div>
              )}
            </div>

            {/* 搜索历史下拉框 - 在搜索框没有内容时显示 */}
            {isSearching &&
              !searchQuery.trim() &&
              searchHistory &&
              searchHistory.length > 0 && (
                <div className="border-t border-neutral-200/50 dark:border-neutral-800/50">
                  <div className="px-6 py-3">
                    <div
                      className="flex flex-wrap items-center gap-2 overflow-hidden"
                      style={{ maxHeight: '3.5rem' }}
                    >
                      <div className="shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        历史搜索:
                      </div>
                      {searchHistory.map((item, index) => (
                        <button
                          type="button"
                          key={index}
                          onClick={() => handleHistoryClick(item)}
                          className={newLocal}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            <SearchAllSuggestion
              scopeLabel={searchAllScopeLabel}
              query={searchQuery}
              onClick={onSearchAllClick}
            />

            {/* 展开式筛选栏 - 在同一个容器内 */}
            <AnimatePresence>
              {isFilterExpanded && (
                <>
                  {/* 固定的半透明分割线 - 只在展开时显示 */}
                  <div className="border-t border-neutral-200/50 dark:border-neutral-800/50"></div>

                  <motion.div
                    ref={filterDropdownRef}
                    initial={FILTER_ANIMATION.initial}
                    animate={FILTER_ANIMATION.animate}
                    exit={FILTER_ANIMATION.exit}
                    transition={FILTER_ANIMATION.transition}
                    className="overflow-hidden"
                    style={{ willChange: 'height, opacity, transform' }}
                  >
                    <div className="px-6 py-4">
                      <div className="space-y-4">
                        {/* 分类模式选择 - 仅在库存视图显示 */}
                        {viewMode === VIEW_OPTIONS.INVENTORY &&
                          onFilterModeChange && (
                            <FilterModeSection
                              filterMode={filterMode}
                              onFilterModeChange={onFilterModeChange}
                              selectedBeanState={selectedBeanState}
                              hasBeanGroups={hasBeanGroups}
                              enabledBeanFieldFilterModes={
                                enabledBeanFieldFilterModes
                              }
                            />
                          )}

                        {/* 表格视图下隐藏排序，因为表格有列头排序 */}
                        {externalDisplayMode !== 'table' && (
                          <SortSection
                            viewMode={viewMode}
                            sortOption={sortOption}
                            onSortChange={onSortChange}
                            selectedBeanState={selectedBeanState}
                          />
                        )}

                        <BeanTypeFilter
                          selectedBeanType={selectedBeanType}
                          onBeanTypeChange={onBeanTypeChange}
                          showAll={true}
                          espressoCount={espressoCount}
                          filterCount={filterCount}
                          omniCount={omniCount}
                          totalEspressoCount={totalEspressoCount}
                          totalFilterCount={totalFilterCount}
                          totalOmniCount={totalOmniCount}
                        />

                        {/* 显示选项 */}
                        <div>
                          <div className="mb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                            显示
                          </div>
                          <div className="space-y-2">
                            {onDisplayModeChange && (
                              <div className="flex flex-wrap items-center gap-2">
                                <FilterButton
                                  isActive={
                                    externalDisplayMode === 'list' ||
                                    (!externalDisplayMode && !isImageFlowMode)
                                  }
                                  onClick={() => onDisplayModeChange('list')}
                                >
                                  列表
                                </FilterButton>
                                <FilterButton
                                  isActive={externalDisplayMode === 'table'}
                                  onClick={() => onDisplayModeChange('table')}
                                >
                                  表格
                                </FilterButton>
                                <FilterButton
                                  isActive={
                                    externalDisplayMode === 'imageFlow' ||
                                    (!externalDisplayMode && isImageFlowMode)
                                  }
                                  onClick={() => {
                                    if (!hasImageBeans) return;
                                    onDisplayModeChange('imageFlow');
                                  }}
                                  disabled={!hasImageBeans}
                                >
                                  图片流
                                </FilterButton>
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              <FilterButton
                                isActive={showEmptyBeans || false}
                                onClick={() => onToggleShowEmptyBeans?.()}
                              >
                                展示已用完
                              </FilterButton>
                              <FilterButton
                                isActive={false}
                                onClick={() => onExportPreview?.()}
                              >
                                导出预览图
                              </FilterButton>
                            </div>
                          </div>
                        </div>

                        {/* 表格列配置区域 - 仅在表格模式下显示 */}
                        {externalDisplayMode === 'table' &&
                          onTableColumnsChange && (
                            <div>
                              <div className="mb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                表格列
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {TABLE_COLUMN_CONFIG.map(col => {
                                  const displayLabel =
                                    col.key === 'flavorPeriod'
                                      ? getDateDisplayColumnLabel(
                                          dateDisplayMode,
                                          hasGreenBeans
                                        )
                                      : hasGreenBeans && col.greenBeanLabel
                                        ? col.greenBeanLabel
                                        : col.label;

                                  return (
                                    <FilterButton
                                      key={col.key}
                                      isActive={tableVisibleColumns.includes(
                                        col.key
                                      )}
                                      onClick={() => {
                                        const isVisible =
                                          tableVisibleColumns.includes(col.key);
                                        if (isVisible) {
                                          // 至少保留一列
                                          if (tableVisibleColumns.length > 1) {
                                            onTableColumnsChange(
                                              tableVisibleColumns.filter(
                                                k => k !== col.key
                                              )
                                            );
                                          }
                                        } else {
                                          onTableColumnsChange([
                                            ...tableVisibleColumns,
                                            col.key,
                                          ]);
                                        }
                                      }}
                                    >
                                      {displayLabel}
                                    </FilterButton>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ViewSwitcher;
