'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ViewOption,
  VIEW_OPTIONS,
  BeanType,
  BloggerBeansYear,
  BeanFilterMode,
  BloggerType,
  BLOGGER_LABELS,
} from '../types';
import {
  SortOption,
  SORT_ORDERS,
  SORT_TYPE_LABELS,
  getSortTypeAndOrder,
  getSortOption,
  getSortOrderLabel,
  getSortOrdersForType,
  getAvailableSortTypesForView,
} from '../SortSelector';
import { X, ArrowUpRight, AlignLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FlavorPeriodStatus,
  FLAVOR_PERIOD_LABELS,
} from '@/lib/utils/beanVarietyUtils';

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

// 可复用的标签按钮组件
interface TabButtonProps {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  dataTab?: string;
  title?: string;
}

const TabButton: React.FC<TabButtonProps> = ({
  isActive,
  onClick,
  children,
  className = '',
  dataTab,
  title,
}) => (
  <button
    onClick={onClick}
    className={`relative pb-1.5 text-xs font-medium whitespace-nowrap ${
      isActive
        ? 'text-neutral-800 dark:text-neutral-100'
        : 'text-neutral-600 hover:opacity-80 dark:text-neutral-400'
    } ${className}`}
    data-tab={dataTab}
    title={title}
  >
    <span className="relative">{children}</span>
    {isActive && (
      <span className="absolute bottom-0 left-0 h-px w-full bg-neutral-800 dark:bg-white"></span>
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

// 排序区域组件 - 使用筛选按钮样式
interface SortSectionProps {
  viewMode: ViewOption;
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
}

const SortSection: React.FC<SortSectionProps> = ({
  viewMode,
  sortOption,
  onSortChange,
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
          {getAvailableSortTypesForView(viewMode).map(type => (
            <FilterButton
              key={type}
              isActive={type === currentType}
              onClick={() => {
                const newOption = getSortOption(type, SORT_ORDERS.DESC);
                onSortChange(newOption);
              }}
            >
              {SORT_TYPE_LABELS[type]}
            </FilterButton>
          ))}
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
}

const BeanTypeFilter: React.FC<BeanTypeFilterProps> = ({
  selectedBeanType,
  onBeanTypeChange,
  showAll = true,
  espressoCount = 0,
  filterCount = 0,
  omniCount = 0,
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
        onClick={() => espressoCount > 0 && onBeanTypeChange?.('espresso')}
        className={espressoCount === 0 ? 'cursor-not-allowed opacity-30' : ''}
      >
        {showAll ? '意式' : '意式豆'}
      </FilterButton>
      <FilterButton
        isActive={selectedBeanType === 'filter'}
        onClick={() => filterCount > 0 && onBeanTypeChange?.('filter')}
        className={filterCount === 0 ? 'cursor-not-allowed opacity-30' : ''}
      >
        {showAll ? '手冲' : '手冲豆'}
      </FilterButton>
      <FilterButton
        isActive={selectedBeanType === 'omni'}
        onClick={() => omniCount > 0 && onBeanTypeChange?.('omni')}
        className={omniCount === 0 ? 'cursor-not-allowed opacity-30' : ''}
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
          isActive={filterMode === 'variety'}
          onClick={() => onFilterModeChange('variety')}
        >
          按品种
        </FilterButton>
        <FilterButton
          isActive={filterMode === 'origin'}
          onClick={() => onFilterModeChange('origin')}
        >
          按产地
        </FilterButton>
        <FilterButton
          isActive={filterMode === 'flavorPeriod'}
          onClick={() => onFilterModeChange('flavorPeriod')}
        >
          按赏味期
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
};

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
  bloggerYear?: BloggerBeansYear;
  onBloggerYearChange?: (year: BloggerBeansYear) => void;
  bloggerType?: BloggerType;
  onBloggerTypeChange?: (type: BloggerType) => void;
  rankingEditMode?: boolean;
  onRankingEditModeChange?: (edit: boolean) => void;
  onRankingShare?: () => void;
  selectedBeanType?: BeanType;
  onBeanTypeChange?: (type: BeanType) => void;
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
  bloggerBeansCount?: number;
  // 榜单各类型豆子数量
  rankingEspressoCount?: number;
  rankingFilterCount?: number;
  rankingOmniCount?: number;
  // 博主榜单各类型豆子数量
  bloggerEspressoCount?: number;
  bloggerFilterCount?: number;
  bloggerOmniCount?: number;
  // 新增图片流模式相关props
  isImageFlowMode?: boolean;
  onToggleImageFlowMode?: () => void;
  hasImageBeans?: boolean;
  // 新增分类相关props
  filterMode?: BeanFilterMode;
  onFilterModeChange?: (mode: BeanFilterMode) => void;
  selectedOrigin?: string | null;
  onOriginClick?: (origin: string | null) => void;
  selectedFlavorPeriod?: FlavorPeriodStatus | null;
  onFlavorPeriodClick?: (status: FlavorPeriodStatus | null) => void;
  selectedRoaster?: string | null;
  onRoasterClick?: (roaster: string | null) => void;
  availableOrigins?: string[];
  availableFlavorPeriods?: FlavorPeriodStatus[];
  availableRoasters?: string[];
  // 新增导出相关props
  onExportPreview?: () => void;
  // 新增类型统计props
  espressoCount?: number;
  filterCount?: number;
  omniCount?: number;
  // 新增搜索历史相关props
  searchHistory?: string[];
  onSearchHistoryClick?: (query: string) => void;
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
  bloggerYear = 2025,
  onBloggerYearChange,
  bloggerType = 'peter',
  onBloggerTypeChange,
  rankingEditMode = false,
  onRankingEditModeChange,
  onRankingShare,
  selectedBeanType,
  onBeanTypeChange,
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
  bloggerBeansCount,
  // 榜单各类型豆子数量参数
  rankingEspressoCount = 0,
  rankingFilterCount = 0,
  rankingOmniCount = 0,
  // 博主榜单各类型豆子数量参数
  bloggerEspressoCount = 0,
  bloggerFilterCount = 0,
  bloggerOmniCount = 0,
  isImageFlowMode = false,
  onToggleImageFlowMode,
  hasImageBeans = true,
  // 新增分类相关参数
  filterMode = 'variety',
  onFilterModeChange,
  selectedOrigin,
  onOriginClick,
  selectedFlavorPeriod,
  onFlavorPeriodClick,
  selectedRoaster,
  onRoasterClick,
  availableOrigins = [],
  availableFlavorPeriods = [],
  availableRoasters = [],
  // 新增导出相关参数
  onExportPreview,
  // 新增类型统计参数
  espressoCount = 0,
  filterCount = 0,
  omniCount = 0,
  // 新增搜索历史参数
  searchHistory = [],
  onSearchHistoryClick,
}) => {
  // 添加极简模式状态
  const [_isMinimalistMode, setIsMinimalistMode] = useState(false);

  // 筛选展开栏状态
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const filterExpandRef = useRef<HTMLDivElement>(null);
  const [hideTotalWeight, setHideTotalWeight] = useState(false);

  // 年份下拉菜单状态
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [yearButtonPosition, setYearButtonPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const yearButtonRef = useRef<HTMLSpanElement>(null);

  // 检查是否在浏览器环境（用于 Portal）
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 年份点击处理
  const handleYearClick = () => {
    if (yearButtonRef.current) {
      const rect = yearButtonRef.current.getBoundingClientRect();
      setYearButtonPosition({
        top: rect.top,
        left: rect.left,
        width: rect.width,
      });
      setShowYearDropdown(true);
    }
  };

  // 年份变更处理
  const handleYearChange = (year: BloggerBeansYear) => {
    onBloggerYearChange?.(year);
    setShowYearDropdown(false);
  };

  // 滚动容器引用
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rankingScrollContainerRef = useRef<HTMLDivElement>(null);

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

      scrollContainer.addEventListener('scroll', handleScroll);
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

      rankingScrollContainer.addEventListener('scroll', handleRankingScroll);
      return () => {
        rankingScrollContainer.removeEventListener(
          'scroll',
          handleRankingScroll
        );
      };
    }
  }, []);

  // 滚动到选中项的函数 - 用于品种筛选
  const scrollToSelected = useCallback(() => {
    if (!scrollContainerRef.current || !selectedVariety) return;

    const selectedElement = scrollContainerRef.current.querySelector(
      `[data-tab="${selectedVariety}"]`
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
  }, [selectedVariety]);

  // 滚动到选中项的函数 - 用于榜单豆子类型筛选
  const scrollToRankingSelected = useCallback(() => {
    if (!rankingScrollContainerRef.current || !rankingBeanType) return;

    const selectedElement = rankingScrollContainerRef.current.querySelector(
      `[data-tab="${rankingBeanType}"]`
    );
    if (!selectedElement) return;

    const container = rankingScrollContainerRef.current;
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
  }, [rankingBeanType]);

  // 当选中项变化时滚动到选中项
  useEffect(() => {
    // 延迟执行以确保DOM已更新
    const timer = setTimeout(scrollToSelected, 100);
    return () => clearTimeout(timer);
  }, [selectedVariety, scrollToSelected]);

  // 当榜单豆子类型变化时滚动到选中项
  useEffect(() => {
    // 延迟执行以确保DOM已更新
    const timer = setTimeout(scrollToRankingSelected, 100);
    return () => clearTimeout(timer);
  }, [rankingBeanType, scrollToRankingSelected]);

  // 获取全局设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { Storage } = await import('@/lib/core/storage');
        const settingsStr = await Storage.get('brewGuideSettings');
        if (settingsStr) {
          // 移除极简模式相关设置
          setIsMinimalistMode(false); // 移除极简模式
          setHideTotalWeight(false); // 始终显示总重量
        }
      } catch (error) {
        // Log error in development only
        if (process.env.NODE_ENV === 'development') {
          console.error('加载设置失败', error);
        }
      }
    };

    loadSettings();

    // 监听设置变更
    const handleSettingsChange = (e: CustomEvent) => {
      if (e.detail?.key === 'brewGuideSettings') {
        loadSettings();
      }
    };

    window.addEventListener(
      'storageChange',
      handleSettingsChange as EventListener
    );
    return () => {
      window.removeEventListener(
        'storageChange',
        handleSettingsChange as EventListener
      );
    };
  }, []);

  // 搜索相关逻辑
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 处理搜索图标点击
  const handleSearchClick = () => {
    if (setIsSearching) {
      setIsSearching(true);
      // 聚焦搜索框
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
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
  const handleFilterToggle = () => {
    setIsFilterExpanded(!isFilterExpanded);
  };

  // 点击外部关闭筛选展开栏和年份下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterExpandRef.current &&
        !filterExpandRef.current.contains(event.target as Node)
      ) {
        setIsFilterExpanded(false);
      }

      // 检查是否点击了年份下拉菜单外部
      const target = event.target as Element;
      if (showYearDropdown && !target.closest('[data-year-selector]')) {
        setShowYearDropdown(false);
      }
    };

    if (isFilterExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterExpanded, showYearDropdown]);

  // 统计视图时不显示任何筛选栏
  if (viewMode === VIEW_OPTIONS.STATS) {
    return null;
  }

  return (
    <div className="sticky top-0 flex-none space-y-6 bg-neutral-50 pt-6 dark:bg-neutral-900">
      {/* 视图切换与筛选栏 - 统一布局 */}
      <div className="mb-6 flex items-center justify-between px-6">
        <div className="flex items-center space-x-3">
          <div className="text-xs font-medium tracking-wide break-words text-neutral-800 dark:text-neutral-100">
            {viewMode === VIEW_OPTIONS.INVENTORY ? (
              beansCount === 0 && totalBeans === 0 ? (
                '' // 当没有咖啡豆时不显示任何统计信息
              ) : showEmptyBeans ? (
                `${beansCount} 款咖啡豆，总共 ${originalTotalWeight}${!hideTotalWeight && totalWeight ? `，剩余 ${totalWeight}` : ''}`
              ) : (
                `${beansCount} 款咖啡豆${!hideTotalWeight && totalWeight ? `，剩余 ${totalWeight}` : ''}`
              )
            ) : viewMode === VIEW_OPTIONS.BLOGGER ? (
              <span className="flex items-baseline">
                <span
                  className="cursor-pointer underline decoration-neutral-400 decoration-dashed underline-offset-2 transition-colors hover:decoration-neutral-600 dark:decoration-neutral-500 dark:hover:decoration-neutral-300"
                  onClick={() => {
                    // 切换博主
                    const newBlogger =
                      bloggerType === 'peter' ? 'fenix' : 'peter';
                    onBloggerTypeChange?.(newBlogger);
                  }}
                  title="点击切换博主"
                >
                  {BLOGGER_LABELS[bloggerType || 'peter']}
                </span>
                <span className="ml-1">
                  豆单，{bloggerBeansCount || 0} 款 (&nbsp;
                  <span
                    ref={yearButtonRef}
                    className="cursor-pointer underline decoration-neutral-400 decoration-dashed underline-offset-2 transition-colors hover:decoration-neutral-600 dark:decoration-neutral-500 dark:hover:decoration-neutral-300"
                    onClick={handleYearClick}
                    data-year-selector
                    title="点击切换年份"
                  >
                    {bloggerYear}
                  </span>
                  &nbsp;) 咖啡豆
                </span>
              </span>
            ) : rankingBeansCount === 0 ? (
              '' // 当没有评分咖啡豆时不显示任何统计信息
            ) : (
              `${rankingBeansCount} 款已评分咖啡豆`
            )}
          </div>
        </div>

        {/* 视图切换功能已移至导航栏 */}
      </div>

      {/* 榜单标签筛选 - 在榜单和博主榜单视图中显示 */}
      {((viewMode === VIEW_OPTIONS.RANKING &&
        rankingBeansCount &&
        rankingBeansCount > 0) ||
        viewMode === VIEW_OPTIONS.BLOGGER) && (
        <div className="mb-1" ref={filterExpandRef}>
          {/* 整个分类栏容器 - 下边框在这里 */}
          <div className="border-b border-neutral-200 dark:border-neutral-800">
            {/* 豆子筛选选项卡 */}
            <div className="relative px-6">
              {!isSearching ? (
                <div className="relative flex items-center">
                  {/* 固定在左侧的"全部"和筛选按钮 */}
                  <div className="relative z-10 flex flex-shrink-0 items-center bg-neutral-50 pr-3 dark:bg-neutral-900">
                    <TabButton
                      isActive={rankingBeanType === 'all'}
                      onClick={() => onRankingBeanTypeChange?.('all')}
                      className="mr-1"
                      dataTab="all"
                    >
                      全部
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
                    {showRankingLeftShadow && (
                      <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-6 bg-gradient-to-r from-neutral-50/95 to-transparent dark:from-neutral-900/95"></div>
                    )}

                    <div
                      ref={rankingScrollContainerRef}
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

                      {/* 意式豆 - 仅在有数据时显示 */}
                      {(viewMode === VIEW_OPTIONS.RANKING
                        ? rankingEspressoCount > 0
                        : bloggerEspressoCount > 0) && (
                        <TabButton
                          isActive={rankingBeanType === 'espresso'}
                          onClick={() => onRankingBeanTypeChange?.('espresso')}
                          className="mr-3"
                          dataTab="espresso"
                        >
                          意式豆
                        </TabButton>
                      )}

                      {/* 手冲豆 - 仅在有数据时显示 */}
                      {(viewMode === VIEW_OPTIONS.RANKING
                        ? rankingFilterCount > 0
                        : bloggerFilterCount > 0) && (
                        <TabButton
                          isActive={rankingBeanType === 'filter'}
                          onClick={() => {
                            // 如果是矮人博主，不允许切换到手冲豆
                            if (
                              viewMode === VIEW_OPTIONS.BLOGGER &&
                              bloggerType === 'fenix'
                            ) {
                              return;
                            }
                            onRankingBeanTypeChange?.('filter');
                          }}
                          className={`mr-3 ${
                            viewMode === VIEW_OPTIONS.BLOGGER &&
                            bloggerType === 'fenix'
                              ? 'cursor-not-allowed opacity-50'
                              : ''
                          }`}
                          dataTab="filter"
                          title={
                            viewMode === VIEW_OPTIONS.BLOGGER &&
                            bloggerType === 'fenix'
                              ? '矮人博主暂无手冲豆数据'
                              : undefined
                          }
                        >
                          手冲豆
                        </TabButton>
                      )}

                      {/* 全能豆 - 仅在有数据时显示 */}
                      {(viewMode === VIEW_OPTIONS.RANKING
                        ? rankingOmniCount > 0
                        : bloggerOmniCount > 0) && (
                        <TabButton
                          isActive={rankingBeanType === 'omni'}
                          onClick={() => onRankingBeanTypeChange?.('omni')}
                          className="mr-3"
                          dataTab="omni"
                        >
                          全能豆
                        </TabButton>
                      )}
                    </div>

                    {/* 右侧渐变阴影 - 覆盖在滚动内容上 */}
                    <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-6 bg-gradient-to-l from-neutral-50/95 to-transparent dark:from-neutral-900/95"></div>
                  </div>

                  {/* 固定在右侧的操作按钮 */}
                  <div className="relative z-10 flex flex-shrink-0 items-center bg-neutral-50 pl-3 dark:bg-neutral-900">
                    {/* 年份选择器已移至标题中 */}

                    {/* 编辑按钮 - 仅在个人榜单视图中显示且有评分咖啡豆数据时 */}
                    {viewMode === VIEW_OPTIONS.RANKING &&
                      onRankingEditModeChange &&
                      rankingBeansCount &&
                      rankingBeansCount > 0 && (
                        <TabButton
                          isActive={rankingEditMode}
                          onClick={() =>
                            onRankingEditModeChange(!rankingEditMode)
                          }
                          className="mr-3"
                        >
                          {rankingEditMode ? '完成' : '编辑'}
                        </TabButton>
                      )}

                    {/* 分享按钮 - 仅在个人榜单视图中显示且有评分咖啡豆数据时 */}
                    {viewMode === VIEW_OPTIONS.RANKING &&
                      onRankingShare &&
                      rankingBeansCount &&
                      rankingBeansCount > 0 && (
                        <button
                          onClick={onRankingShare}
                          className="relative pb-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400"
                        >
                          <span className="relative underline decoration-sky-500 underline-offset-2">
                            分享
                          </span>
                          <ArrowUpRight
                            className="ml-1 inline-block h-3 w-3"
                            color="currentColor"
                          />
                        </button>
                      )}

                    {/* 搜索按钮 - 仅在博主榜单视图中显示且有咖啡豆数据时 */}
                    {viewMode === VIEW_OPTIONS.BLOGGER &&
                      bloggerBeansCount &&
                      bloggerBeansCount > 0 && (
                        <>
                          {/* 竖直分割线 */}
                          <div className="mr-3 mb-1.5 h-3 w-px bg-neutral-200 dark:bg-neutral-800"></div>
                          <button
                            onClick={handleSearchClick}
                            className="flex items-center pb-1.5 text-xs font-medium whitespace-nowrap text-neutral-600 dark:text-neutral-400"
                          >
                            <span className="relative">搜索</span>
                          </button>
                        </>
                      )}

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
                      onChange={handleSearchChange}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="输入咖啡豆名称..."
                      className="w-full border-none bg-transparent pr-2 text-xs font-medium text-neutral-800 placeholder-neutral-400 outline-hidden dark:text-neutral-100 dark:placeholder-neutral-500"
                      autoComplete="off"
                    />
                  </div>
                  <button
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
                          onClick={() => handleHistoryClick(item)}
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
              {isFilterExpanded && (
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
                        <SortSection
                          viewMode={viewMode}
                          sortOption={sortOption}
                          onSortChange={onSortChange}
                        />
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
      {viewMode === VIEW_OPTIONS.INVENTORY && totalBeans && totalBeans > 0 ? (
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
                        (filterMode === 'variety' &&
                          selectedVariety === null) ||
                        (filterMode === 'origin' && selectedOrigin === null) ||
                        (filterMode === 'flavorPeriod' &&
                          selectedFlavorPeriod === null) ||
                        (filterMode === 'roaster' && selectedRoaster === null)
                      }
                      onClick={() => {
                        if (
                          filterMode === 'variety' &&
                          selectedVariety !== null
                        ) {
                          onVarietyClick?.(null);
                        } else if (
                          filterMode === 'origin' &&
                          selectedOrigin !== null
                        ) {
                          onOriginClick?.(null);
                        } else if (
                          filterMode === 'flavorPeriod' &&
                          selectedFlavorPeriod !== null
                        ) {
                          onFlavorPeriodClick?.(null);
                        } else if (
                          filterMode === 'roaster' &&
                          selectedRoaster !== null
                        ) {
                          onRoasterClick?.(null);
                        }
                      }}
                      className="mr-1"
                      dataTab="all"
                    >
                      <span onDoubleClick={() => onToggleImageFlowMode?.()}>
                        全部
                        {isImageFlowMode && <span> · 图片流</span>}
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

                      {/* 根据分类模式显示不同的筛选按钮 */}
                      {filterMode === 'variety' &&
                        availableVarieties?.map((variety: string) => (
                          <TabButton
                            key={variety}
                            isActive={selectedVariety === variety}
                            onClick={() =>
                              selectedVariety !== variety &&
                              onVarietyClick?.(variety)
                            }
                            className="mr-3"
                            dataTab={variety}
                          >
                            {variety}
                          </TabButton>
                        ))}

                      {filterMode === 'origin' &&
                        availableOrigins?.map((origin: string) => (
                          <TabButton
                            key={origin}
                            isActive={selectedOrigin === origin}
                            onClick={() =>
                              selectedOrigin !== origin &&
                              onOriginClick?.(origin)
                            }
                            className="mr-3"
                            dataTab={origin}
                          >
                            {origin}
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
                          >
                            {roaster}
                          </TabButton>
                        ))}
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
                    />
                  </div>
                  <button
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
                          onClick={() => handleHistoryClick(item)}
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
              {isFilterExpanded && (
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
                        {/* 分类模式选择 - 仅在库存视图显示 */}
                        {viewMode === VIEW_OPTIONS.INVENTORY &&
                          onFilterModeChange && (
                            <FilterModeSection
                              filterMode={filterMode}
                              onFilterModeChange={onFilterModeChange}
                            />
                          )}

                        <SortSection
                          viewMode={viewMode}
                          sortOption={sortOption}
                          onSortChange={onSortChange}
                        />

                        <BeanTypeFilter
                          selectedBeanType={selectedBeanType}
                          onBeanTypeChange={onBeanTypeChange}
                          showAll={true}
                          espressoCount={espressoCount}
                          filterCount={filterCount}
                          omniCount={omniCount}
                        />

                        {/* 显示选项区域 */}
                        <div>
                          <div className="mb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                            显示
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <FilterButton
                              isActive={showEmptyBeans || false}
                              onClick={() => onToggleShowEmptyBeans?.()}
                            >
                              包含已用完
                            </FilterButton>
                            {onToggleImageFlowMode && (
                              <FilterButton
                                isActive={isImageFlowMode}
                                onClick={() => {
                                  // 如果没有图片咖啡豆，不允许切换
                                  if (!hasImageBeans) return;
                                  onToggleImageFlowMode();
                                }}
                                disabled={!hasImageBeans}
                              >
                                图片流
                              </FilterButton>
                            )}
                            <span className="mx-1 text-neutral-300/30 dark:text-neutral-600/50">
                              ·
                            </span>
                            <FilterButton
                              isActive={false}
                              onClick={() => onExportPreview?.()}
                            >
                              导出预览图
                            </FilterButton>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : null}

      {/* 年份下拉选择菜单 - 参考StatsView风格 */}
      {isMounted &&
        createPortal(
          <AnimatePresence>
            {showYearDropdown && (
              <>
                {/* 背景模糊层 */}
                <motion.div
                  initial={{
                    opacity: 0,
                    backdropFilter: 'blur(0px)',
                  }}
                  animate={{
                    opacity: 1,
                    backdropFilter: 'blur(20px)',
                    transition: {
                      opacity: {
                        duration: 0.2,
                        ease: [0.25, 0.46, 0.45, 0.94],
                      },
                      backdropFilter: {
                        duration: 0.3,
                        ease: [0.25, 0.46, 0.45, 0.94],
                      },
                    },
                  }}
                  exit={{
                    opacity: 0,
                    backdropFilter: 'blur(0px)',
                    transition: {
                      opacity: {
                        duration: 0.15,
                        ease: [0.4, 0.0, 1, 1],
                      },
                      backdropFilter: {
                        duration: 0.2,
                        ease: [0.4, 0.0, 1, 1],
                      },
                    },
                  }}
                  className="fixed inset-0 z-[60]"
                  style={{
                    backgroundColor:
                      'color-mix(in srgb, var(--background) 40%, transparent)',
                    WebkitBackdropFilter: 'blur(4px)',
                  }}
                  onClick={() => setShowYearDropdown(false)}
                />

                {/* 当前选中的年份选项 */}
                {yearButtonPosition && (
                  <motion.div
                    initial={{ opacity: 1, scale: 1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{
                      opacity: 0,
                      scale: 0.98,
                      transition: {
                        duration: 0.12,
                        ease: [0.4, 0.0, 1, 1],
                      },
                    }}
                    className="fixed z-[80]"
                    style={{
                      top: `${yearButtonPosition.top}px`,
                      left: `${yearButtonPosition.left}px`,
                      minWidth: `${yearButtonPosition.width}px`,
                    }}
                    data-year-selector
                  >
                    <motion.button
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 1 }}
                      onClick={() => setShowYearDropdown(false)}
                      className="flex cursor-pointer items-center text-left text-xs font-medium tracking-wide break-words whitespace-nowrap text-neutral-800 transition-colors dark:text-neutral-100"
                    >
                      <span className="relative inline-block">
                        {bloggerYear}
                      </span>
                    </motion.button>
                  </motion.div>
                )}

                {/* 其他年份选项 */}
                {yearButtonPosition && (
                  <motion.div
                    initial={{
                      opacity: 0,
                      y: -8,
                      scale: 0.96,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: {
                        duration: 0.25,
                        ease: [0.25, 0.46, 0.45, 0.94],
                      },
                    }}
                    exit={{
                      opacity: 0,
                      y: -6,
                      scale: 0.98,
                      transition: {
                        duration: 0.15,
                        ease: [0.4, 0.0, 1, 1],
                      },
                    }}
                    className="fixed z-[80]"
                    style={{
                      top: `${yearButtonPosition.top + 30}px`,
                      left: `${yearButtonPosition.left}px`,
                      minWidth: `${yearButtonPosition.width}px`,
                    }}
                    data-year-selector
                  >
                    <div className="flex flex-col">
                      {(bloggerType === 'peter'
                        ? [2025, 2024]
                        : [2025, 2024, 2023]
                      )
                        .filter(year => year !== bloggerYear)
                        .map((year, index) => (
                          <motion.button
                            key={year}
                            initial={{
                              opacity: 0,
                              y: -6,
                              scale: 0.98,
                            }}
                            animate={{
                              opacity: 1,
                              y: 0,
                              scale: 1,
                              transition: {
                                delay: index * 0.04,
                                duration: 0.2,
                                ease: [0.25, 0.46, 0.45, 0.94],
                              },
                            }}
                            exit={{
                              opacity: 0,
                              y: -4,
                              scale: 0.98,
                              transition: {
                                delay: (1 - index) * 0.02,
                                duration: 0.12,
                                ease: [0.4, 0.0, 1, 1],
                              },
                            }}
                            onClick={() =>
                              handleYearChange(year as BloggerBeansYear)
                            }
                            className="flex items-center pb-3 text-left text-xs font-medium tracking-wide break-words whitespace-nowrap text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
                            style={{ paddingBottom: '12px' }}
                          >
                            <span className="relative inline-block">
                              {year}
                            </span>
                          </motion.button>
                        ))}
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};

export default ViewSwitcher;
