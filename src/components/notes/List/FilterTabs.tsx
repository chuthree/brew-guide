'use client';

import React, { memo, useRef, useState, useEffect, useCallback } from 'react';
import {
  FilterTabsProps,
  SORT_OPTIONS,
  SortOption,
  DateGroupingMode,
  DATE_GROUPING_LABELS,
} from '../types';
import { X, AlignLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

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

// 日期格式化函数 - 将日期字符串转换为更友好的显示（支持不同粒度）
const formatDateLabel = (
  dateStr: string,
  groupingMode: DateGroupingMode
): string => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  if (groupingMode === 'year') {
    // 按年分组
    const year = parseInt(dateStr, 10);
    if (year === currentYear) {
      return '今年';
    }
    return `${year}年`;
  } else if (groupingMode === 'month') {
    // 按月分组
    const [year, month] = dateStr.split('-');
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);

    if (yearNum === currentYear) {
      if (monthNum === currentMonth) {
        return '本月';
      }
      return `${monthNum}月`;
    }
    return `${year}年${monthNum}月`;
  } else {
    // 按日分组 - 优化显示逻辑
    const [year, month, day] = dateStr.split('-');
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);

    // 计算日期差
    const targetDate = new Date(yearNum, monthNum - 1, dayNum);
    const todayDate = new Date(currentYear, currentMonth - 1, currentDay);
    const diffTime = todayDate.getTime() - targetDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // 今天
    if (diffDays === 0) {
      return '今天';
    }
    // 昨天
    else if (diffDays === 1) {
      return '昨天';
    }
    // 前天
    else if (diffDays === 2) {
      return '前天';
    }
    // 其他日期：当年显示月/日，其他年份显示年/月/日
    else if (yearNum === currentYear) {
      return `${monthNum}/${dayNum}`;
    } else {
      return `${year}/${monthNum}/${dayNum}`;
    }
  }
};

// 生成今天的日期字符串（根据粒度）
const getTodayDateString = (groupingMode: DateGroupingMode): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  switch (groupingMode) {
    case 'year':
      return `${year}`;
    case 'month':
      return `${year}-${month}`;
    case 'day':
      return `${year}-${month}-${day}`;
    default:
      return `${year}-${month}`;
  }
};

// 下划线动画配置 - 使用 spring 动画实现丝滑效果
const UNDERLINE_TRANSITION = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 35,
  mass: 1,
};

// 可复用的标签按钮组件
interface TabButtonProps {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  dataTab?: string;
  layoutId?: string;
}

const TabButton: React.FC<TabButtonProps> = ({
  isActive,
  onClick,
  children,
  className = '',
  dataTab,
  layoutId = 'notes-tab-underline',
}) => (
  <button
    onClick={onClick}
    className={`relative pb-1.5 text-xs font-medium whitespace-nowrap ${
      isActive
        ? 'text-neutral-800 dark:text-neutral-100'
        : 'text-neutral-600 hover:opacity-80 dark:text-neutral-400'
    } ${className}`}
    data-tab={dataTab}
  >
    <span className="relative">{children}</span>
    {isActive && (
      <motion.span
        layoutId={layoutId}
        className="absolute inset-x-0 bottom-0 h-px bg-neutral-800 dark:bg-white"
        transition={UNDERLINE_TRANSITION}
      />
    )}
  </button>
);

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

// 排序相关辅助函数
const getSortTypeAndOrder = (sortOption: SortOption) => {
  if (sortOption.includes('extraction_time')) {
    return {
      type: 'extraction_time',
      order: sortOption.includes('desc') ? 'desc' : 'asc',
    };
  } else if (sortOption.includes('time')) {
    return {
      type: 'time',
      order: sortOption.includes('desc') ? 'desc' : 'asc',
    };
  } else if (sortOption.includes('rating')) {
    return {
      type: 'rating',
      order: sortOption.includes('desc') ? 'desc' : 'asc',
    };
  }
  return { type: 'time', order: 'desc' };
};

const getSortOption = (type: string, order: string): SortOption => {
  if (type === 'extraction_time') {
    return order === 'desc'
      ? SORT_OPTIONS.EXTRACTION_TIME_DESC
      : SORT_OPTIONS.EXTRACTION_TIME_ASC;
  } else if (type === 'time') {
    return order === 'desc' ? SORT_OPTIONS.TIME_DESC : SORT_OPTIONS.TIME_ASC;
  } else if (type === 'rating') {
    return order === 'desc'
      ? SORT_OPTIONS.RATING_DESC
      : SORT_OPTIONS.RATING_ASC;
  }
  return SORT_OPTIONS.TIME_DESC;
};

const getSortOrderLabel = (type: string, order: string) => {
  if (type === 'extraction_time') {
    return order === 'desc' ? '慢到快' : '快到慢';
  } else if (type === 'time') {
    return order === 'desc' ? '最新' : '最早';
  } else if (type === 'rating') {
    return order === 'desc' ? '最高' : '最低';
  }
  return '最新';
};

// 筛选模式选择组件
interface FilterModeSectionProps {
  filterMode: 'equipment' | 'bean' | 'date';
  onFilterModeChange: (mode: 'equipment' | 'bean' | 'date') => void;
}

const FilterModeSection: React.FC<FilterModeSectionProps> = ({
  filterMode,
  onFilterModeChange,
}) => {
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
        分类方式
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FilterButton
          isActive={filterMode === 'equipment'}
          onClick={() => onFilterModeChange('equipment')}
        >
          按器具
        </FilterButton>
        <FilterButton
          isActive={filterMode === 'bean'}
          onClick={() => onFilterModeChange('bean')}
        >
          按豆子
        </FilterButton>
        <FilterButton
          isActive={filterMode === 'date'}
          onClick={() => onFilterModeChange('date')}
        >
          按日期
        </FilterButton>
      </div>
    </div>
  );
};

// 日期粒度选择组件
interface DateGroupingSectionProps {
  dateGroupingMode: DateGroupingMode;
  onDateGroupingModeChange: (mode: DateGroupingMode) => void;
}

const DateGroupingSection: React.FC<DateGroupingSectionProps> = ({
  dateGroupingMode,
  onDateGroupingModeChange,
}) => {
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
        时间分组
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FilterButton
          isActive={dateGroupingMode === 'year'}
          onClick={() => onDateGroupingModeChange('year')}
        >
          {DATE_GROUPING_LABELS.year}
        </FilterButton>
        <FilterButton
          isActive={dateGroupingMode === 'month'}
          onClick={() => onDateGroupingModeChange('month')}
        >
          {DATE_GROUPING_LABELS.month}
        </FilterButton>
        <FilterButton
          isActive={dateGroupingMode === 'day'}
          onClick={() => onDateGroupingModeChange('day')}
        >
          {DATE_GROUPING_LABELS.day}
        </FilterButton>
      </div>
    </div>
  );
};

// 显示模式选择组件
interface ViewModeSectionProps {
  viewMode: 'list' | 'gallery';
  onViewModeChange: (mode: 'list' | 'gallery') => void;
  isImageFlowMode?: boolean;
  onToggleImageFlowMode?: () => void;
  isDateImageFlowMode?: boolean;
  onToggleDateImageFlowMode?: () => void;
  hasImageNotes?: boolean;
}

const ViewModeSection: React.FC<ViewModeSectionProps> = ({
  viewMode,
  onViewModeChange,
  isImageFlowMode = false,
  onToggleImageFlowMode,
  isDateImageFlowMode = false,
  onToggleDateImageFlowMode,
  hasImageNotes = true,
}) => {
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
        显示模式
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FilterButton
          isActive={viewMode === 'list'}
          onClick={() => {
            onViewModeChange('list');
            // 关闭所有图片流模式
            if (isImageFlowMode && onToggleImageFlowMode) {
              onToggleImageFlowMode();
            }
            if (isDateImageFlowMode && onToggleDateImageFlowMode) {
              onToggleDateImageFlowMode();
            }
          }}
        >
          列表
        </FilterButton>
        <FilterButton
          isActive={
            viewMode === 'gallery' && isImageFlowMode && !isDateImageFlowMode
          }
          onClick={() => {
            // 如果没有图片笔记，不允许切换
            if (!hasImageNotes) return;
            // 如果当前不是普通图片流模式，则激活它
            if (!isImageFlowMode || isDateImageFlowMode) {
              onToggleImageFlowMode?.();
            }
          }}
          disabled={!hasImageNotes}
        >
          图片流
        </FilterButton>
        <FilterButton
          isActive={
            viewMode === 'gallery' && isDateImageFlowMode && !isImageFlowMode
          }
          onClick={() => {
            // 如果没有图片笔记，不允许切换
            if (!hasImageNotes) return;
            // 如果当前不是带日期图片流模式，则激活它
            if (!isDateImageFlowMode || isImageFlowMode) {
              onToggleDateImageFlowMode?.();
            }
          }}
          disabled={!hasImageNotes}
        >
          带日期图片流
        </FilterButton>
      </div>
    </div>
  );
};

// 排序区域组件 - 使用筛选按钮样式
interface SortSectionProps {
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
  settings?: import('@/components/settings/Settings').SettingsOptions;
}

const SortSection: React.FC<SortSectionProps> = ({
  sortOption,
  onSortChange,
  settings,
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
          <FilterButton
            isActive={currentType === 'time'}
            onClick={() => {
              const newOption = getSortOption('time', currentOrder);
              onSortChange(newOption);
            }}
          >
            时间
          </FilterButton>
          <FilterButton
            isActive={currentType === 'rating'}
            onClick={() => {
              const newOption = getSortOption('rating', currentOrder);
              onSortChange(newOption);
            }}
          >
            评分
          </FilterButton>

          {/* 萃取时间排序选项 - 只在设置中启用时显示 */}
          {settings?.searchSort?.enabled &&
            settings?.searchSort?.extractionTime && (
              <FilterButton
                isActive={currentType === 'extraction_time'}
                onClick={() => {
                  const newOption = getSortOption(
                    'extraction_time',
                    currentOrder
                  );
                  onSortChange(newOption);
                }}
              >
                萃取时间
              </FilterButton>
            )}
        </div>

        {/* 排序顺序 */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterButton
            isActive={currentOrder === 'desc'}
            onClick={() => onSortChange(getSortOption(currentType, 'desc'))}
          >
            {getSortOrderLabel(currentType, 'desc')}
          </FilterButton>
          <FilterButton
            isActive={currentOrder === 'asc'}
            onClick={() => onSortChange(getSortOption(currentType, 'asc'))}
          >
            {getSortOrderLabel(currentType, 'asc')}
          </FilterButton>
        </div>
      </div>
    </div>
  );
};

// 搜索排序栏组件 - 只在搜索时显示
interface SearchSortBarProps {
  searchSortOption?: SortOption;
  onSearchSortChange?: (option: SortOption | null) => void;
  defaultSortOption: SortOption; // 普通排序选项，作为默认值
  settings?: import('@/components/settings/Settings').SettingsOptions;
  hasExtractionTimeData: boolean; // 搜索结果中是否有萃取时间数据
}

const SearchSortBar: React.FC<SearchSortBarProps> = ({
  searchSortOption,
  onSearchSortChange,
  defaultSortOption: _defaultSortOption,
  settings,
  hasExtractionTimeData,
}) => {
  // 用于激活状态判断的排序选项（只基于搜索排序选项）
  const searchSortType = searchSortOption
    ? getSortTypeAndOrder(searchSortOption)
    : null;

  // 滚动容器引用和阴影状态
  const searchScrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);

  // 处理滚动事件以控制阴影显示
  const handleSearchScroll = useCallback(() => {
    if (searchScrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } =
        searchScrollContainerRef.current;
      setShowLeftShadow(scrollLeft > 2);
      setShowRightShadow(scrollLeft < scrollWidth - clientWidth - 2);
    }
  }, []);

  // 移除了自动吸附滚动功能 - 只保留普通滚动处理

  // 监听滚动事件和容器大小变化
  useEffect(() => {
    const scrollContainer = searchScrollContainerRef.current;
    if (scrollContainer) {
      // 初始检测
      handleSearchScroll();

      // 添加滚动事件监听（移除了吸附功能）
      scrollContainer.addEventListener('scroll', handleSearchScroll);

      // 添加resize observer监听容器大小变化
      const resizeObserver = new ResizeObserver(handleSearchScroll);
      resizeObserver.observe(scrollContainer);

      return () => {
        scrollContainer.removeEventListener('scroll', handleSearchScroll);
        resizeObserver.disconnect();
      };
    }
  }, [handleSearchScroll]);

  // 检查是否有任何排序选项可用
  const hasAnyOption =
    settings?.searchSort?.enabled &&
    (settings?.searchSort?.time ||
      settings?.searchSort?.rating ||
      (settings?.searchSort?.extractionTime && hasExtractionTimeData));

  // 如果搜索排序功能未启用或没有任何可用的搜索排序选项，不显示组件
  if (!hasAnyOption || !onSearchSortChange) {
    return null;
  }

  return (
    <div className="border-b border-neutral-200 bg-neutral-50/30 px-6 py-3 dark:border-neutral-800 dark:bg-neutral-900/30">
      <div className="flex items-center">
        <span className="mr-2 flex-shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          搜索排序:
        </span>

        {/* 滚动容器包装器 - 限制最大宽度防止溢出 */}
        <div className="relative min-w-0 flex-1">
          {/* 左侧渐变阴影 */}
          {showLeftShadow && (
            <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-6 bg-gradient-to-r from-neutral-50/80 to-transparent dark:from-neutral-900/80"></div>
          )}

          {/* 右侧渐变阴影 */}
          {showRightShadow && (
            <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-6 bg-gradient-to-l from-neutral-50/80 to-transparent dark:from-neutral-900/80"></div>
          )}

          {/* 滚动容器 */}
          <div
            ref={searchScrollContainerRef}
            className="flex w-full items-center space-x-2 overflow-x-auto"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <style jsx>{`
              div::-webkit-scrollbar {
                display: none;
              }
            `}</style>

            {/* 时间排序按钮 */}
            {settings?.searchSort?.time && (
              <>
                <FilterButton
                  isActive={
                    searchSortType?.type === 'time' &&
                    searchSortType?.order === 'desc'
                  }
                  onClick={() => {
                    // 如果已经是激活状态，点击取消选中；否则设置为降序（最新）
                    const isCurrentlyActive =
                      searchSortType?.type === 'time' &&
                      searchSortType?.order === 'desc';
                    onSearchSortChange(
                      isCurrentlyActive ? null : SORT_OPTIONS.TIME_DESC
                    );
                  }}
                  className="flex-shrink-0 text-xs"
                >
                  时间 ↓
                </FilterButton>
                <FilterButton
                  isActive={
                    searchSortType?.type === 'time' &&
                    searchSortType?.order === 'asc'
                  }
                  onClick={() => {
                    // 如果已经是激活状态，点击取消选中；否则设置为升序（最早）
                    const isCurrentlyActive =
                      searchSortType?.type === 'time' &&
                      searchSortType?.order === 'asc';
                    onSearchSortChange(
                      isCurrentlyActive ? null : SORT_OPTIONS.TIME_ASC
                    );
                  }}
                  className="flex-shrink-0 text-xs"
                >
                  时间 ↑
                </FilterButton>
              </>
            )}

            {/* 评分排序按钮 */}
            {settings?.searchSort?.rating && (
              <>
                <FilterButton
                  isActive={
                    searchSortType?.type === 'rating' &&
                    searchSortType?.order === 'desc'
                  }
                  onClick={() => {
                    // 如果已经是激活状态，点击取消选中；否则设置为降序（最高分）
                    const isCurrentlyActive =
                      searchSortType?.type === 'rating' &&
                      searchSortType?.order === 'desc';
                    onSearchSortChange(
                      isCurrentlyActive ? null : SORT_OPTIONS.RATING_DESC
                    );
                  }}
                  className="flex-shrink-0 text-xs"
                >
                  评分 ↓
                </FilterButton>
                <FilterButton
                  isActive={
                    searchSortType?.type === 'rating' &&
                    searchSortType?.order === 'asc'
                  }
                  onClick={() => {
                    // 如果已经是激活状态，点击取消选中；否则设置为升序（最低分）
                    const isCurrentlyActive =
                      searchSortType?.type === 'rating' &&
                      searchSortType?.order === 'asc';
                    onSearchSortChange(
                      isCurrentlyActive ? null : SORT_OPTIONS.RATING_ASC
                    );
                  }}
                  className="flex-shrink-0 text-xs"
                >
                  评分 ↑
                </FilterButton>
              </>
            )}

            {/* 萃取时间排序按钮 */}
            {settings?.searchSort?.extractionTime && hasExtractionTimeData && (
              <>
                <FilterButton
                  isActive={
                    searchSortType?.type === 'extraction_time' &&
                    searchSortType?.order === 'asc'
                  }
                  onClick={() => {
                    // 如果已经是激活状态，点击取消选中；否则设置为升序
                    const isCurrentlyActive =
                      searchSortType?.type === 'extraction_time' &&
                      searchSortType?.order === 'asc';
                    onSearchSortChange(
                      isCurrentlyActive
                        ? null
                        : SORT_OPTIONS.EXTRACTION_TIME_ASC
                    );
                  }}
                  className="flex-shrink-0 text-xs"
                >
                  萃取时间 ↑
                </FilterButton>
                <FilterButton
                  isActive={
                    searchSortType?.type === 'extraction_time' &&
                    searchSortType?.order === 'desc'
                  }
                  onClick={() => {
                    // 如果已经是激活状态，点击取消选中；否则设置为降序
                    const isCurrentlyActive =
                      searchSortType?.type === 'extraction_time' &&
                      searchSortType?.order === 'desc';
                    onSearchSortChange(
                      isCurrentlyActive
                        ? null
                        : SORT_OPTIONS.EXTRACTION_TIME_DESC
                    );
                  }}
                  className="flex-shrink-0 text-xs"
                >
                  萃取时间 ↓
                </FilterButton>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 使用memo包装组件以避免不必要的重渲染
const FilterTabs: React.FC<FilterTabsProps> = memo(function FilterTabs({
  filterMode,
  selectedEquipment,
  selectedBean,
  selectedDate,
  dateGroupingMode,
  availableEquipments,
  availableBeans,
  availableDates,
  equipmentNames,
  onFilterModeChange,
  onEquipmentClick,
  onBeanClick,
  onDateClick,
  onDateGroupingModeChange,
  isSearching = false,
  searchQuery = '',
  onSearchClick,
  onSearchChange,
  onSearchKeyDown,
  sortOption,
  onSortChange,
  viewMode = 'list',
  onViewModeChange,
  isImageFlowMode = false,
  onToggleImageFlowMode,
  isDateImageFlowMode = false,
  onToggleDateImageFlowMode,
  onSmartToggleImageFlow,
  hasImageNotes = true,
  settings,
  hasExtractionTimeData = false,
  searchSortOption,
  onSearchSortChange,
  searchHistory,
  onSearchHistoryClick,
}) {
  // 搜索输入框引用 - 移到条件语句前面
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 筛选展开栏状态
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const filterExpandRef = useRef<HTMLDivElement>(null);

  // 滚动容器引用
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 处理滚动阴影效果
  const [showLeftShadow, setShowLeftShadow] = useState(false);

  // 监听滚动事件以控制阴影显示
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      setShowLeftShadow(scrollContainerRef.current.scrollLeft > 2);
    }
  };

  // 滚动到选中项的函数
  const scrollToSelected = useCallback(() => {
    if (!scrollContainerRef.current) return;

    let selectedId =
      filterMode === 'equipment'
        ? selectedEquipment
        : filterMode === 'bean'
          ? selectedBean
          : selectedDate;
    if (!selectedId) return;

    // 特殊处理日期模式下的快捷选项，确保能滚动到对应的快捷按钮
    if (filterMode === 'date' && dateGroupingMode === 'day') {
      const todayStr = getTodayDateString('day');
      const now = new Date();

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

      const dayBeforeYesterday = new Date(now);
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
      const dayBeforeYesterdayStr = `${dayBeforeYesterday.getFullYear()}-${String(dayBeforeYesterday.getMonth() + 1).padStart(2, '0')}-${String(dayBeforeYesterday.getDate()).padStart(2, '0')}`;

      if (selectedId === todayStr) selectedId = 'today';
      else if (selectedId === yesterdayStr) selectedId = 'yesterday';
      else if (selectedId === dayBeforeYesterdayStr)
        selectedId = 'dayBeforeYesterday';
    }

    const selectedElement = scrollContainerRef.current.querySelector(
      `[data-tab="${selectedId}"]`
    );
    if (!selectedElement) return;

    const container = scrollContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const elementRect = selectedElement.getBoundingClientRect();

    // 计算元素相对于容器的位置
    const elementLeft =
      elementRect.left - containerRect.left + container.scrollLeft;
    const elementWidth = elementRect.width;
    const containerWidth = containerRect.width;

    // 计算目标滚动位置（将选中项居中）
    const targetScrollLeft = elementLeft - (containerWidth - elementWidth) / 2;

    // 平滑滚动到目标位置
    container.scrollTo({
      left: Math.max(0, targetScrollLeft),
      behavior: 'smooth',
    });
  }, [
    filterMode,
    selectedEquipment,
    selectedBean,
    selectedDate,
    dateGroupingMode,
  ]);

  // 当选中项变化时滚动到选中项
  useEffect(() => {
    // 延迟执行以确保DOM已更新
    const timer = setTimeout(scrollToSelected, 100);
    return () => clearTimeout(timer);
  }, [
    selectedEquipment,
    selectedBean,
    selectedDate,
    filterMode,
    scrollToSelected,
  ]);

  // 添加滚动事件监听
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      // 初始检测滚动位置
      handleScroll();

      scrollContainer.addEventListener('scroll', handleScroll);
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);

  // 处理搜索图标点击
  const handleSearchClick = () => {
    if (onSearchClick) {
      onSearchClick();
      // 聚焦搜索框
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  };

  // 处理筛选展开栏
  const handleFilterToggle = () => {
    setIsFilterExpanded(!isFilterExpanded);
  };

  // 点击外部关闭筛选展开栏
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterExpandRef.current &&
        !filterExpandRef.current.contains(event.target as Node)
      ) {
        setIsFilterExpanded(false);
      }
    };

    if (isFilterExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterExpanded]);

  // 如果没有可筛选的设备或咖啡豆或日期，不渲染任何内容
  if (
    availableEquipments.length === 0 &&
    availableBeans.length === 0 &&
    availableDates.length === 0
  )
    return null;

  return (
    <div className="relative" ref={filterExpandRef}>
      {/* 整个分类栏容器 - 下边框在这里 */}
      <div className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="relative px-6">
          {!isSearching ? (
            <div className="relative flex items-center">
              {/* 固定在左侧的"全部"和筛选按钮 */}
              <div className="relative z-10 flex flex-shrink-0 items-center bg-neutral-50 pr-3 dark:bg-neutral-900">
                <TabButton
                  isActive={
                    (filterMode === 'equipment' &&
                      selectedEquipment === null) ||
                    (filterMode === 'bean' && selectedBean === null) ||
                    (filterMode === 'date' && selectedDate === null)
                  }
                  onClick={() => {
                    if (filterMode === 'equipment') {
                      onEquipmentClick(null);
                    } else if (filterMode === 'bean') {
                      onBeanClick(null);
                    } else {
                      onDateClick(null);
                    }
                  }}
                  className="mr-1"
                  dataTab="all"
                  layoutId={`notes-${filterMode}-underline`}
                >
                  <span onDoubleClick={() => onSmartToggleImageFlow?.()}>
                    全部
                    {isImageFlowMode && <span> · 图片流</span>}
                    {isDateImageFlowMode && <span> · 带日期图片流</span>}
                  </span>
                </TabButton>

                {/* 筛选图标按钮 */}
                <button
                  onClick={handleFilterToggle}
                  className="mr-1 flex items-center pb-1.5 text-xs font-medium text-neutral-400 dark:text-neutral-600"
                >
                  <AlignLeft size={12} color="currentColor" />
                </button>

                {/* 左侧固定按钮的右侧渐变遮罩 */}
                <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-5 bg-gradient-to-r from-transparent to-neutral-50 dark:to-neutral-900"></div>
              </div>

              {/* 中间滚动区域 */}
              <div className="relative flex-1 overflow-hidden">
                {/* 左侧渐变阴影 - 覆盖在滚动内容上 */}
                {showLeftShadow && (
                  <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-6 bg-gradient-to-r from-neutral-50/95 to-transparent dark:from-neutral-900/95"></div>
                )}

                <div
                  ref={scrollContainerRef}
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

                  {/* 动态筛选按钮 */}
                  {filterMode === 'equipment' ? (
                    availableEquipments.map(equipment => (
                      <TabButton
                        key={equipment}
                        isActive={selectedEquipment === equipment}
                        onClick={() =>
                          selectedEquipment !== equipment &&
                          onEquipmentClick(equipment)
                        }
                        className="mr-3"
                        dataTab={equipment}
                        layoutId="notes-equipment-underline"
                      >
                        {equipmentNames[equipment] || equipment}
                      </TabButton>
                    ))
                  ) : filterMode === 'bean' ? (
                    availableBeans.map(bean => (
                      <TabButton
                        key={bean}
                        isActive={selectedBean === bean}
                        onClick={() =>
                          selectedBean !== bean && onBeanClick(bean)
                        }
                        className="mr-3"
                        dataTab={bean}
                        layoutId="notes-bean-underline"
                      >
                        {bean}
                      </TabButton>
                    ))
                  ) : (
                    <>
                      {/* 按日模式下，始终显示"今天"、"昨天"、"前天"快捷选项 */}
                      {dateGroupingMode === 'day' &&
                        (() => {
                          const todayStr = getTodayDateString('day');
                          const now = new Date();

                          // 计算昨天
                          const yesterday = new Date(now);
                          yesterday.setDate(yesterday.getDate() - 1);
                          const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

                          // 计算前天
                          const dayBeforeYesterday = new Date(now);
                          dayBeforeYesterday.setDate(
                            dayBeforeYesterday.getDate() - 2
                          );
                          const dayBeforeYesterdayStr = `${dayBeforeYesterday.getFullYear()}-${String(dayBeforeYesterday.getMonth() + 1).padStart(2, '0')}-${String(dayBeforeYesterday.getDate()).padStart(2, '0')}`;

                          return (
                            <>
                              {/* 今天 - 始终显示 */}
                              <TabButton
                                key="today-shortcut"
                                isActive={
                                  selectedDate === 'today' ||
                                  selectedDate === todayStr
                                }
                                onClick={() =>
                                  selectedDate !== 'today' &&
                                  onDateClick('today')
                                }
                                className="mr-3"
                                dataTab="today"
                                layoutId="notes-date-underline"
                              >
                                今天
                              </TabButton>

                              {/* 昨天 - 始终显示 */}
                              <TabButton
                                key="yesterday-shortcut"
                                isActive={
                                  selectedDate === 'yesterday' ||
                                  selectedDate === yesterdayStr
                                }
                                onClick={() =>
                                  selectedDate !== 'yesterday' &&
                                  onDateClick('yesterday')
                                }
                                className="mr-3"
                                dataTab="yesterday"
                                layoutId="notes-date-underline"
                              >
                                昨天
                              </TabButton>

                              {/* 前天 - 始终显示 */}
                              <TabButton
                                key="day-before-yesterday-shortcut"
                                isActive={
                                  selectedDate === 'dayBeforeYesterday' ||
                                  selectedDate === dayBeforeYesterdayStr
                                }
                                onClick={() =>
                                  selectedDate !== 'dayBeforeYesterday' &&
                                  onDateClick('dayBeforeYesterday')
                                }
                                className="mr-3"
                                dataTab="dayBeforeYesterday"
                                layoutId="notes-date-underline"
                              >
                                前天
                              </TabButton>
                            </>
                          );
                        })()}

                      {/* 其他日期 - 过滤掉今天、昨天、前天（避免重复） */}
                      {availableDates
                        .filter(date => {
                          if (dateGroupingMode !== 'day') return true;
                          const todayStr = getTodayDateString('day');
                          const now = new Date();

                          const yesterday = new Date(now);
                          yesterday.setDate(yesterday.getDate() - 1);
                          const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

                          const dayBeforeYesterday = new Date(now);
                          dayBeforeYesterday.setDate(
                            dayBeforeYesterday.getDate() - 2
                          );
                          const dayBeforeYesterdayStr = `${dayBeforeYesterday.getFullYear()}-${String(dayBeforeYesterday.getMonth() + 1).padStart(2, '0')}-${String(dayBeforeYesterday.getDate()).padStart(2, '0')}`;

                          return (
                            date !== todayStr &&
                            date !== yesterdayStr &&
                            date !== dayBeforeYesterdayStr
                          );
                        })
                        .map(date => (
                          <TabButton
                            key={date}
                            isActive={selectedDate === date}
                            onClick={() =>
                              selectedDate !== date && onDateClick(date)
                            }
                            className="mr-3"
                            dataTab={date}
                            layoutId="notes-date-underline"
                          >
                            {formatDateLabel(date, dateGroupingMode)}
                          </TabButton>
                        ))}
                    </>
                  )}
                </div>

                {/* 右侧渐变阴影 - 覆盖在滚动内容上 */}
                <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-6 bg-gradient-to-l from-neutral-50/95 to-transparent dark:from-neutral-900/95"></div>
              </div>

              {/* 固定在右侧的搜索按钮 */}
              <div className="relative z-10 flex flex-shrink-0 items-center bg-neutral-50 pl-3 dark:bg-neutral-900">
                {/* 竖直分割线 */}
                <div className="mr-3 mb-1.5 h-3 w-px bg-neutral-200 dark:bg-neutral-800"></div>
                <button
                  onClick={handleSearchClick}
                  className="flex items-center pb-1.5 text-xs font-medium whitespace-nowrap text-neutral-600 dark:text-neutral-400"
                >
                  <span className="relative">搜索</span>
                </button>

                {/* 右侧固定按钮的左侧渐变遮罩 */}
                <div className="pointer-events-none absolute top-0 bottom-0 left-0 w-5 bg-gradient-to-l from-transparent to-neutral-50 dark:to-neutral-900"></div>
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
                  onChange={onSearchChange}
                  onKeyDown={onSearchKeyDown}
                  placeholder="搜索笔记..."
                  className="w-full border-none bg-transparent pr-2 text-xs font-medium text-neutral-800 placeholder-neutral-400 outline-hidden dark:text-neutral-100 dark:placeholder-neutral-500"
                  autoComplete="off"
                />
              </div>
              <button
                onClick={handleSearchClick}
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
            <div className="border-t border-neutral-200/50 dark:border-neutral-700/50">
              <div className="px-6 py-3">
                <div
                  className="flex flex-wrap items-center gap-2 overflow-hidden"
                  style={{ maxHeight: '3.5rem' }}
                >
                  <div className="flex-shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    历史搜索:
                  </div>
                  {searchHistory.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => onSearchHistoryClick?.(item)}
                      className="flex-shrink-0 bg-neutral-200/30 px-2 py-1 text-xs font-medium whitespace-nowrap text-neutral-400 transition-colors dark:bg-neutral-800/50 dark:text-neutral-400"
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
          {isFilterExpanded && sortOption && onSortChange && (
            <>
              {/* 固定的半透明分割线 - 只在展开时显示 */}
              <div className="border-t border-neutral-200/50 dark:border-neutral-700/50"></div>

              <motion.div
                initial={FILTER_ANIMATION.initial}
                animate={FILTER_ANIMATION.animate}
                exit={FILTER_ANIMATION.exit}
                transition={FILTER_ANIMATION.transition}
                className="overflow-hidden"
                style={{ willChange: 'height, opacity, transform' }}
              >
                <div className="px-6 py-4">
                  <div className="space-y-4">
                    <FilterModeSection
                      filterMode={filterMode}
                      onFilterModeChange={onFilterModeChange}
                    />

                    {/* 日期粒度选择 - 只在选择"按日期"时显示 */}
                    {filterMode === 'date' && (
                      <DateGroupingSection
                        dateGroupingMode={dateGroupingMode}
                        onDateGroupingModeChange={onDateGroupingModeChange}
                      />
                    )}

                    {onViewModeChange && (
                      <ViewModeSection
                        viewMode={viewMode}
                        onViewModeChange={onViewModeChange}
                        isImageFlowMode={isImageFlowMode}
                        onToggleImageFlowMode={onToggleImageFlowMode}
                        isDateImageFlowMode={isDateImageFlowMode}
                        onToggleDateImageFlowMode={onToggleDateImageFlowMode}
                        hasImageNotes={hasImageNotes}
                      />
                    )}

                    <SortSection
                      sortOption={sortOption}
                      onSortChange={onSortChange}
                      settings={settings}
                    />
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* 搜索排序栏 - 只在搜索时且有相关数据时显示 */}
      {isSearching && sortOption && (
        <SearchSortBar
          searchSortOption={searchSortOption}
          onSearchSortChange={onSearchSortChange}
          defaultSortOption={sortOption}
          settings={settings}
          hasExtractionTimeData={hasExtractionTimeData}
        />
      )}
    </div>
  );
});

export default FilterTabs;
