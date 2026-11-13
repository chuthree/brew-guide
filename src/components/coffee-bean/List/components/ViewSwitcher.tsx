'use client';

import React, {
  useRef,
  useState,
  useEffect,
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
import { AlignLeft, ChevronDown } from 'lucide-react';
import {
  FilterButton,
  FilterPanel,
  FilterPanelTrigger,
} from '@/components/common/ui/FilterPanel';
import { useFilterPanel } from '@/lib/hooks/useFilterPanel';
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
import TabBar from '@/components/common/ui/TabBar';
import type { BeanFilterOptionCounts } from '../beanListPipeline';
import {
  ListFilterBar,
  ListHeaderSummary,
} from '@/components/common/ui/ListFilterBar';
import {
  DATE_GROUPING_LABELS,
  DATE_GROUPING_MODES,
} from '@/lib/utils/dateUtils';
import {
  formatRankingDateLabel,
  type RankingDateGroupingMode,
  type RankingFilterMode,
} from '../rankingFilters';

const EMPTY_BEAN_GROUPS: CoffeeBeanGroup[] = [];
type SelectableBeanType = Exclude<BeanType, 'all'>;
type MultiFilterCategory = BeanFilterMode | 'type';

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
  const customSortEnabled = useSettingsStore(
    state => state.settings.experimentalBeanCustomSortEnabled === true
  );

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
          {customSortEnabled && viewMode === VIEW_OPTIONS.INVENTORY && (
            <FilterButton
              isActive={currentType === 'custom'}
              onClick={() => onSortChange('custom')}
            >
              自定义
            </FilterButton>
          )}
        </div>

        {/* 排序顺序 */}
        {currentType !== 'original' && currentType !== 'custom' && (
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
      {DATE_GROUPING_MODES.map(mode => (
        <FilterButton
          key={mode}
          isActive={dateGroupingMode === mode}
          onClick={() => onDateGroupingModeChange(mode)}
        >
          {DATE_GROUPING_LABELS[mode]}
        </FilterButton>
      ))}
    </div>
  </div>
);

interface ViewSwitcherProps {
  filterOptionCounts?: BeanFilterOptionCounts;
  multiFilters?: Partial<Record<BeanFilterMode, string>>;
  onMultiFilterChange?: (mode: BeanFilterMode, value: string | null) => void;
  onClearMultiFilters?: () => void;
  viewMode: ViewOption;
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
  beansCount: number;
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
  filterOptionCounts,
  multiFilters,
  onMultiFilterChange,
  onClearMultiFilters,
  viewMode,
  sortOption,
  onSortChange,
  beansCount,
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
  rankingBeansCount = 0,
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
  const beanCategorySort = useSettingsStore(
    state => state.settings.beanCategorySort ?? 'count'
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
  const displayModeLabel =
    externalDisplayMode === 'table'
      ? '表格'
      : externalDisplayMode === 'imageFlow' ||
          (!externalDisplayMode && isImageFlowMode)
        ? '图片'
        : '列表';

  const {
    isOpen: isFilterExpanded,
    setIsOpen: setIsFilterExpanded,
    triggerRef,
    handleTriggerClick,
    interactionProps,
    panelProps,
  } = useFilterPanel();
  const multipleFiltering = multiFilters !== undefined;
  const [expandedMultiCategory, setExpandedMultiCategory] =
    useState<MultiFilterCategory | null>(null);
  const multiSelections: Partial<Record<MultiFilterCategory, string>> = {
    ...multiFilters,
    ...(selectedBeanType && selectedBeanType !== 'all'
      ? { type: selectedBeanType }
      : {}),
  };
  const multiSelectionCount = Object.keys(multiSelections).length;
  const changeMultiSelection = (
    mode: MultiFilterCategory,
    value: string | null
  ) => {
    const nextValue = multiSelections[mode] === value ? null : value;
    if (mode === 'type') {
      const nextType = (nextValue ?? 'all') as BeanType;
      if (nextType !== selectedBeanType) onBeanTypeChange?.(nextType);
    } else {
      onMultiFilterChange?.(mode, nextValue);
    }
  };
  const multiCategories: MultiFilterCategory[] = [
    ...(selectedBeanState === 'roasted' && hasBeanGroups
      ? ['group' as const]
      : []),
    'type',
    'roaster',
    ...(selectedBeanState === 'roasted' ? ['flavorPeriod' as const] : []),
    ...(enabledBeanFieldFilterModes ??
      (['origin', 'processingMethod', 'variety'] as BeanFilterMode[])),
  ];
  const getMultiCategoryLabel = (mode: MultiFilterCategory) =>
    mode === 'type'
      ? '类型'
      : mode === 'roaster' && selectedBeanState === 'green'
        ? '生豆商'
        : getBeanFilterModeLabel(mode).replace(/^按/, '');
  const getMultiValueLabel = (mode: MultiFilterCategory, value: string) => {
    if (mode === 'type') return BEAN_TYPE_LABELS[value as SelectableBeanType];
    if (mode === 'flavorPeriod')
      return FLAVOR_PERIOD_LABELS[value as FlavorPeriodStatus];
    if (mode === 'group')
      return (
        availableBeanGroups.find(group => group.id === value)?.name ??
        '当前分组'
      );
    return value;
  };
  const getMultiCategoryValues = (mode: MultiFilterCategory): string[] => {
    if (mode === 'type') return BEAN_TYPE_ORDER;
    if (mode === 'roaster') return availableRoasters;
    if (mode === 'flavorPeriod') return availableFlavorPeriods;
    if (mode === 'group') return availableBeanGroups.map(group => group.id);
    const fieldId = BEAN_FIELD_ID_BY_FILTER_MODE[mode];
    return fieldId ? (availableBeanFieldValues[fieldId] ?? []) : [];
  };
  const sortCategoryValuesByName = <T extends string>(
    mode: MultiFilterCategory,
    values: T[]
  ): T[] =>
    beanCategorySort === 'name'
      ? [...values].sort((left, right) =>
          getMultiValueLabel(mode, left).localeCompare(
            getMultiValueLabel(mode, right),
            'zh-CN',
            { numeric: true }
          )
        )
      : values;
  const getVisibleMultiCategoryValues = (mode: MultiFilterCategory) => {
    const selectedValue = multiSelections[mode];
    const values = getMultiCategoryValues(mode);
    const candidates =
      selectedValue !== undefined && !values.includes(selectedValue)
        ? [...values, selectedValue]
        : values;
    return candidates.filter(
      value =>
        value === selectedValue ||
        (filterOptionCounts?.[mode]?.get(value) ?? 0) > 0
    );
  };
  const activeMultiCategory =
    multiFilters &&
    expandedMultiCategory &&
    multiCategories.includes(expandedMultiCategory)
      ? expandedMultiCategory
      : null;
  const activeMultiCategoryValues = activeMultiCategory
    ? beanCategorySort === 'name'
      ? sortCategoryValuesByName(
          activeMultiCategory,
          getVisibleMultiCategoryValues(activeMultiCategory)
        )
      : getVisibleMultiCategoryValues(activeMultiCategory).sort(
          (left, right) =>
            (filterOptionCounts?.[activeMultiCategory]?.get(right) ?? 0) -
            (filterOptionCounts?.[activeMultiCategory]?.get(left) ?? 0)
        )
    : [];
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

  const handleFilterToggle: React.MouseEventHandler<
    HTMLButtonElement
  > = event => {
    setExpandedMultiCategory(null);
    handleTriggerClick(
      event,
      activeMultiCategory !== null || !isFilterExpanded
    );
  };

  useEffect(() => {
    setIsFilterExpanded(false);
    setExpandedMultiCategory(null);
  }, [selectedBeanState, multipleFiltering, viewMode, setIsFilterExpanded]);

  // 统计视图使用自身的筛选栏。
  if (viewMode === VIEW_OPTIONS.STATS) {
    return null;
  }

  const listSearch = {
    active: isSearching,
    input: {
      ref: searchInputRef,
      value: searchQuery,
      onChange: handleSearchChange,
      onKeyDown: handleSearchKeyDown,
      placeholder: '输入咖啡豆名称...',
    },
    onOpen: handleSearchClick,
    onClose: handleCloseSearch,
    history: searchHistory,
    onHistoryClick: onSearchHistoryClick,
    scopeLabel: searchAllScopeLabel,
    onSearchAll: onSearchAllClick,
  };

  return (
    <div
      className={`sticky top-0 flex-none space-y-6 bg-neutral-50 ${
        navigationSwipeControl?.isCollapsed ? 'pt-0' : 'pt-6'
      } md:pt-0 dark:bg-neutral-900`}
      {...navigationSwipeHandlers}
      {...interactionProps}
    >
      {/* 视图切换与筛选栏 - 统一布局 */}
      <ListHeaderSummary navigation={navigationToggleControl}>
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
          ) : rankingBeanType === 'all' ? (
            `${rankingBeansCount} 款已评分咖啡豆`
          ) : (
            `${rankingBeansCount} 款已评分${BEAN_TYPE_LABELS[rankingBeanType]}豆`
          )}
        </div>
      </ListHeaderSummary>

      {/* 榜单标签筛选 - 仅在榜单视图中显示 */}
      {viewMode === VIEW_OPTIONS.RANKING && (
        <div>
          {/* 整个分类栏容器 - 下边框在这里 */}
          <ListFilterBar
            leading={
              <>
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
                >
                  全部
                </TabButton>

                {/* 筛选图标按钮 */}
                <FilterPanelTrigger
                  panelId={panelProps.id}
                  isOpen={isFilterExpanded}
                  onClick={handleFilterToggle}
                />
              </>
            }
            tabs={rankingCategoryTabs.map(tab => (
              <TabButton
                key={tab.value}
                isActive={rankingSelectedCategory === tab.value}
                onClick={() => handleRankingCategoryClick(tab.value)}
                className="mr-3"
                dataTab={tab.value}
              >
                {tab.label}
              </TabButton>
            ))}
            search={listSearch}
          >
            <FilterPanel {...panelProps}>
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
                    onDateGroupingModeChange={onRankingDateGroupingModeChange}
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
            </FilterPanel>
          </ListFilterBar>
        </div>
      )}

      {/* 库存视图的品种标签筛选 - 仅在库存视图中显示 */}
      {viewMode === VIEW_OPTIONS.INVENTORY ? (
        <div className="relative">
          {/* 整个分类栏容器 - 下边框在这里 */}
          <ListFilterBar
            multiple={multipleFiltering}
            leading={
              multipleFiltering ? (
                <button
                  type="button"
                  aria-expanded={
                    isFilterExpanded && activeMultiCategory === null
                  }
                  aria-controls={panelProps.id}
                  aria-label={`${displayModeLabel}，调整排序和显示`}
                  onClick={handleFilterToggle}
                  className="mr-1 flex items-center gap-1 border-b border-transparent pb-[5px] text-xs leading-4 font-medium whitespace-nowrap text-neutral-600 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 dark:text-neutral-400"
                >
                  {displayModeLabel}
                  <AlignLeft
                    size={12}
                    className="text-neutral-400 dark:text-neutral-600"
                    aria-hidden="true"
                  />
                </button>
              ) : (
                <>
                  <TabButton
                    isActive={
                      (currentBeanFieldId && selectedBeanFieldValue === null) ||
                      (filterMode === 'flavorPeriod' &&
                        selectedFlavorPeriod === null) ||
                      (filterMode === 'roaster' && selectedRoaster === null) ||
                      (filterMode === 'group' && selectedBeanGroupId === null)
                    }
                    onClick={handleInventoryAllClick}
                    onDoubleClick={handleBeanTypeDoubleClick}
                    className="mr-1"
                    dataTab="all"
                  >
                    全部
                  </TabButton>

                  {/* 筛选图标按钮 */}
                  <FilterPanelTrigger
                    panelId={panelProps.id}
                    isOpen={isFilterExpanded}
                    onClick={handleFilterToggle}
                  />
                </>
              )
            }
            tabs={
              multiFilters ? (
                multiCategories.map(mode => {
                  const value = multiSelections[mode];
                  const isSelected = value !== undefined;
                  return (
                    <TabButton
                      key={mode}
                      isActive={false}
                      aria-pressed={isSelected}
                      aria-label={`${getMultiCategoryLabel(mode)}${value ? `：${getMultiValueLabel(mode, value)}` : ''}`}
                      aria-expanded={
                        isFilterExpanded && activeMultiCategory === mode
                      }
                      aria-controls={panelProps.id}
                      onClick={event => {
                        setExpandedMultiCategory(mode);
                        handleTriggerClick(
                          event,
                          !isFilterExpanded || activeMultiCategory !== mode
                        );
                      }}
                      className={`mr-3 flex items-center gap-1 ${isSelected ? 'text-neutral-800 dark:text-neutral-200' : ''}`}
                      dataTab={mode}
                    >
                      {value
                        ? getMultiValueLabel(mode, value)
                        : getMultiCategoryLabel(mode)}
                      <ChevronDown
                        size={12}
                        className={`shrink-0 ${isSelected ? 'text-neutral-500 dark:text-neutral-400' : 'text-neutral-400 dark:text-neutral-600'}`}
                        aria-hidden="true"
                      />
                    </TabButton>
                  );
                })
              ) : (
                <>
                  {currentBeanFieldId &&
                    sortCategoryValuesByName(
                      filterMode,
                      availableCurrentBeanFieldValues
                    ).map(value => (
                      <TabButton
                        key={value}
                        isActive={selectedBeanFieldValue === value}
                        onClick={() => handleBeanFieldValueClick(value)}
                        className="mr-3"
                        dataTab={value}
                      >
                        {value}
                      </TabButton>
                    ))}

                  {filterMode === 'flavorPeriod' &&
                    sortCategoryValuesByName(
                      'flavorPeriod',
                      availableFlavorPeriods
                    ).map((status: FlavorPeriodStatus) => (
                      <TabButton
                        key={status}
                        isActive={selectedFlavorPeriod === status}
                        onClick={() =>
                          selectedFlavorPeriod !== status &&
                          onFlavorPeriodClick?.(status)
                        }
                        className="mr-3"
                        dataTab={status}
                      >
                        {FLAVOR_PERIOD_LABELS[status]}
                      </TabButton>
                    ))}

                  {filterMode === 'roaster' &&
                    sortCategoryValuesByName('roaster', availableRoasters).map(
                      (roaster: string) => (
                        <TabButton
                          key={roaster}
                          isActive={selectedRoaster === roaster}
                          onClick={() =>
                            selectedRoaster !== roaster &&
                            onRoasterClick?.(roaster)
                          }
                          className="mr-3"
                          dataTab={roaster}
                        >
                          {roaster}
                        </TabButton>
                      )
                    )}

                  {filterMode === 'group' &&
                    sortCategoryValuesByName(
                      'group',
                      availableBeanGroups.map(group => group.id)
                    ).map(groupId => (
                      <TabButton
                        key={groupId}
                        isActive={selectedBeanGroupId === groupId}
                        onClick={() =>
                          selectedBeanGroupId !== groupId &&
                          onBeanGroupClick?.(groupId)
                        }
                        className="mr-3"
                        dataTab={groupId}
                      >
                        {getMultiValueLabel('group', groupId)}
                      </TabButton>
                    ))}
                </>
              )
            }
            search={listSearch}
          >
            <FilterPanel {...panelProps}>
              {activeMultiCategory ? (
                <div
                  role="group"
                  aria-label={getMultiCategoryLabel(activeMultiCategory)}
                >
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    <span>{getMultiCategoryLabel(activeMultiCategory)}</span>
                    {multiSelectionCount > 0 && (
                      <div className="flex shrink-0 items-center gap-3 whitespace-nowrap text-neutral-500 dark:text-neutral-400">
                        {multiSelections[activeMultiCategory] !== undefined && (
                          <button
                            type="button"
                            onClick={() =>
                              changeMultiSelection(activeMultiCategory, null)
                            }
                            className="-my-1 py-1 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
                          >
                            清除当前
                          </button>
                        )}
                        {multiSelections[activeMultiCategory] !== undefined &&
                          multiSelectionCount > 1 && (
                            <span
                              aria-hidden="true"
                              className="h-3 w-px bg-neutral-200 dark:bg-neutral-800"
                            />
                          )}
                        {(multiSelections[activeMultiCategory] === undefined ||
                          multiSelectionCount > 1) && (
                          <button
                            type="button"
                            onClick={onClearMultiFilters}
                            className="-my-1 py-1 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
                          >
                            清除全部
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <TabBar
                    key={activeMultiCategory}
                    className="relative overflow-hidden"
                  >
                    <div
                      data-category-scroll
                      className="flex gap-2 overflow-x-auto"
                    >
                      {activeMultiCategoryValues.length === 0 && (
                        <FilterButton
                          isActive={false}
                          disabled
                          onClick={() => {}}
                          className="shrink-0"
                        >
                          暂无选项
                        </FilterButton>
                      )}
                      {activeMultiCategoryValues.map(value => (
                        <FilterButton
                          key={value}
                          className="shrink-0 pr-1.5"
                          isActive={
                            multiSelections[activeMultiCategory] === value
                          }
                          onClick={() => {
                            changeMultiSelection(activeMultiCategory, value);
                            setIsFilterExpanded(false);
                            triggerRef.current?.focus();
                          }}
                        >
                          {getMultiValueLabel(activeMultiCategory, value)}
                          <span className="ml-1">
                            (
                            {filterOptionCounts?.[activeMultiCategory]?.get(
                              value
                            ) ?? 0}
                            )
                          </span>
                        </FilterButton>
                      ))}
                    </div>
                    <div
                      data-scroll-shadow="left"
                      className="fade-mask-to-r pointer-events-none absolute inset-y-0 left-0 w-3 bg-neutral-50 dark:bg-neutral-900"
                    />
                    <div
                      data-scroll-shadow="right"
                      className="fade-mask-to-l pointer-events-none absolute inset-y-0 right-0 w-3 bg-neutral-50 dark:bg-neutral-900"
                    />
                  </TabBar>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 分类模式选择 - 仅在库存视图显示 */}
                  {viewMode === VIEW_OPTIONS.INVENTORY &&
                    !multiFilters &&
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

                  {!multipleFiltering && (
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
                  )}

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
                  {externalDisplayMode === 'table' && onTableColumnsChange && (
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
                              isActive={tableVisibleColumns.includes(col.key)}
                              onClick={() => {
                                const isVisible = tableVisibleColumns.includes(
                                  col.key
                                );
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
              )}
            </FilterPanel>
          </ListFilterBar>
        </div>
      ) : null}
    </div>
  );
};

export default ViewSwitcher;
