'use client'

import React, { useRef, useState, useEffect } from 'react'
import { ViewOption, VIEW_OPTIONS, BeanType, BloggerBeansYear, BeanFilterMode } from '../types'
import {
    SortOption,
    SORT_ORDERS,
    SORT_TYPE_LABELS,
    getSortTypeAndOrder,
    getSortOption,
    getSortOrderLabel,
    getSortOrdersForType,
    getAvailableSortTypesForView
} from '../SortSelector'
import { X, ArrowUpRight, AlignLeft } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { FlavorPeriodStatus, FLAVOR_PERIOD_LABELS } from '@/lib/utils/beanVarietyUtils'

// Apple风格动画配置
const FILTER_ANIMATION = {
    initial: {
        height: 0,
        opacity: 0,
        y: -10
    },
    animate: {
        height: 'auto',
        opacity: 1,
        y: 0
    },
    exit: {
        height: 0,
        opacity: 0,
        y: -10
    },
    transition: {
        type: "tween",
        ease: [0.33, 1, 0.68, 1], // Apple的easeOutCubic曲线
        duration: 0.35,
        opacity: {
            duration: 0.25,
            ease: [0.33, 1, 0.68, 1]
        }
    }
}

// 可复用的标签按钮组件
interface TabButtonProps {
    isActive: boolean
    onClick: () => void
    children: React.ReactNode
    className?: string
    dataTab?: string
}

const TabButton: React.FC<TabButtonProps> = ({ isActive, onClick, children, className = '', dataTab }) => (
    <button
        onClick={onClick}
        className={`pb-1.5 text-xs font-medium relative whitespace-nowrap ${
            isActive
                ? 'text-neutral-800 dark:text-neutral-100'
                : 'text-neutral-600 dark:text-neutral-400 hover:opacity-80'
        } ${className}`}
        data-tab={dataTab}
    >
        <span className="relative">{children}</span>
        {isActive && (
            <span className="absolute bottom-0 left-0 w-full h-px bg-neutral-800 dark:bg-white"></span>
        )}
    </button>
)



// 筛选按钮组件 - 用于筛选区域的轻量样式
interface FilterButtonProps {
    isActive: boolean
    onClick: () => void
    children: React.ReactNode
    className?: string
}

const FilterButton: React.FC<FilterButtonProps> = ({ isActive, onClick, children, className = '' }) => (
    <button
        onClick={onClick}
        className={`px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
            isActive
                ? 'bg-neutral-200/50 dark:bg-neutral-700/50 text-neutral-800 dark:text-neutral-100'
                : 'bg-neutral-100 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400'
        } ${className}`}
    >
        {children}
    </button>
)

// 排序区域组件 - 使用筛选按钮样式
interface SortSectionProps {
    viewMode: ViewOption
    sortOption: SortOption
    onSortChange: (option: SortOption) => void
}

const SortSection: React.FC<SortSectionProps> = ({ viewMode, sortOption, onSortChange }) => {
    const { type: currentType, order: currentOrder } = getSortTypeAndOrder(sortOption)

    return (
        <div>
            <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">排序</div>
            <div className="space-y-3">
                {/* 排序方式 */}
                <div className="flex items-center flex-wrap gap-2">
                    {getAvailableSortTypesForView(viewMode).map((type) => (
                        <FilterButton
                            key={type}
                            isActive={type === currentType}
                            onClick={() => {
                                const newOption = getSortOption(type, SORT_ORDERS.DESC)
                                onSortChange(newOption)
                            }}
                        >
                            {SORT_TYPE_LABELS[type]}
                        </FilterButton>
                    ))}
                </div>

                {/* 排序顺序 */}
                {currentType !== 'original' && (
                    <div className="flex items-center flex-wrap gap-2">
                        {getSortOrdersForType(currentType).map((order) => (
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
    )
}

// 豆子类型筛选组件
interface BeanTypeFilterProps {
    selectedBeanType?: BeanType
    onBeanTypeChange?: (type: BeanType) => void
    showAll?: boolean
}

const BeanTypeFilter: React.FC<BeanTypeFilterProps> = ({
    selectedBeanType,
    onBeanTypeChange,
    showAll = true
}) => (
    <div>
        <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">类型</div>
        <div className="flex items-center flex-wrap gap-2">
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
                onClick={() => onBeanTypeChange?.('espresso')}
            >
                {showAll ? '意式' : '意式豆'}
            </FilterButton>
            <FilterButton
                isActive={selectedBeanType === 'filter'}
                onClick={() => onBeanTypeChange?.('filter')}
            >
                {showAll ? '手冲' : '手冲豆'}
            </FilterButton>
        </div>
    </div>
)

// 分类模式选择组件
interface FilterModeSectionProps {
    filterMode: BeanFilterMode
    onFilterModeChange: (mode: BeanFilterMode) => void
}

const FilterModeSection: React.FC<FilterModeSectionProps> = ({ filterMode, onFilterModeChange }) => {
    return (
        <div>
            <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">分类方式</div>
            <div className="flex items-center flex-wrap gap-2">
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
                    按烘焙商 BETA
                </FilterButton>
            </div>
        </div>
    );
};

interface ViewSwitcherProps {
    viewMode: ViewOption
    sortOption: SortOption
    onSortChange: (option: SortOption) => void
    beansCount: number
    totalBeans?: number
    totalWeight?: string
    rankingBeanType?: BeanType
    onRankingBeanTypeChange?: (type: BeanType) => void
    bloggerYear?: BloggerBeansYear
    onBloggerYearChange?: (year: BloggerBeansYear) => void
    rankingEditMode?: boolean
    onRankingEditModeChange?: (edit: boolean) => void
    onRankingShare?: () => void
    selectedBeanType?: BeanType
    onBeanTypeChange?: (type: BeanType) => void
    selectedVariety?: string | null
    onVarietyClick?: (variety: string | null) => void
    showEmptyBeans?: boolean
    onToggleShowEmptyBeans?: () => void
    onSearchClick?: () => void
    availableVarieties?: string[]
    isSearching?: boolean
    setIsSearching?: (value: boolean) => void
    searchQuery?: string
    setSearchQuery?: (value: string) => void
    onSearchKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
    onSearchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    rankingBeansCount?: number
    bloggerBeansCount?: number
    // 新增图片流模式相关props
    isImageFlowMode?: boolean
    onToggleImageFlowMode?: () => void
    // 新增分类相关props
    filterMode?: BeanFilterMode
    onFilterModeChange?: (mode: BeanFilterMode) => void
    selectedOrigin?: string | null
    onOriginClick?: (origin: string | null) => void
    selectedFlavorPeriod?: FlavorPeriodStatus | null
    onFlavorPeriodClick?: (status: FlavorPeriodStatus | null) => void
    selectedRoaster?: string | null
    onRoasterClick?: (roaster: string | null) => void
    availableOrigins?: string[]
    availableFlavorPeriods?: FlavorPeriodStatus[]
    availableRoasters?: string[]
    // 新增库存分享功能
    onInventoryShare?: () => void
}

const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
    viewMode,
    sortOption,
    onSortChange,
    beansCount,
    totalBeans,
    totalWeight,
    rankingBeanType = 'all',
    onRankingBeanTypeChange,
    bloggerYear = 2025,
    onBloggerYearChange,
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
    isImageFlowMode = false,
    onToggleImageFlowMode,
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
    onInventoryShare,
}) => {
    // 添加极简模式状态
    const [_isMinimalistMode, setIsMinimalistMode] = useState(false);

    // 筛选展开栏状态
    const [isFilterExpanded, setIsFilterExpanded] = useState(false);
    const filterExpandRef = useRef<HTMLDivElement>(null);
    const [hideTotalWeight, setHideTotalWeight] = useState(false);

    // 滚动容器引用
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const rankingScrollContainerRef = useRef<HTMLDivElement>(null);

    // 滚动到选中项的函数 - 用于品种筛选
    const scrollToSelected = () => {
        if (!scrollContainerRef.current || !selectedVariety) return

        const selectedElement = scrollContainerRef.current.querySelector(`[data-tab="${selectedVariety}"]`)
        if (!selectedElement) return

        const container = scrollContainerRef.current
        const containerRect = container.getBoundingClientRect()
        const elementRect = selectedElement.getBoundingClientRect()

        // 计算元素相对于容器的位置
        const elementLeft = elementRect.left - containerRect.left + container.scrollLeft
        const elementWidth = elementRect.width
        const containerWidth = containerRect.width

        // 计算目标滚动位置（将选中项居中）
        const targetScrollLeft = elementLeft - (containerWidth - elementWidth) / 2

        // 平滑滚动到目标位置
        container.scrollTo({
            left: Math.max(0, targetScrollLeft),
            behavior: 'smooth'
        })
    }

    // 滚动到选中项的函数 - 用于榜单豆子类型筛选
    const scrollToRankingSelected = () => {
        if (!rankingScrollContainerRef.current || !rankingBeanType) return

        const selectedElement = rankingScrollContainerRef.current.querySelector(`[data-tab="${rankingBeanType}"]`)
        if (!selectedElement) return

        const container = rankingScrollContainerRef.current
        const containerRect = container.getBoundingClientRect()
        const elementRect = selectedElement.getBoundingClientRect()

        // 计算元素相对于容器的位置
        const elementLeft = elementRect.left - containerRect.left + container.scrollLeft
        const elementWidth = elementRect.width
        const containerWidth = containerRect.width

        // 计算目标滚动位置（将选中项居中）
        const targetScrollLeft = elementLeft - (containerWidth - elementWidth) / 2

        // 平滑滚动到目标位置
        container.scrollTo({
            left: Math.max(0, targetScrollLeft),
            behavior: 'smooth'
        })
    }

    // 当选中项变化时滚动到选中项
    useEffect(() => {
        // 延迟执行以确保DOM已更新
        const timer = setTimeout(scrollToSelected, 100)
        return () => clearTimeout(timer)
    }, [selectedVariety])

    // 当榜单豆子类型变化时滚动到选中项
    useEffect(() => {
        // 延迟执行以确保DOM已更新
        const timer = setTimeout(scrollToRankingSelected, 100)
        return () => clearTimeout(timer)
    }, [rankingBeanType])

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
                console.error('加载设置失败', error);
            }
        };

        loadSettings();

        // 监听设置变更
        const handleSettingsChange = (e: CustomEvent) => {
            if (e.detail?.key === 'brewGuideSettings') {
                loadSettings();
            }
        };

        window.addEventListener('storageChange', handleSettingsChange as EventListener);
        return () => {
            window.removeEventListener('storageChange', handleSettingsChange as EventListener);
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

    // 处理筛选展开栏
    const handleFilterToggle = () => {
        setIsFilterExpanded(!isFilterExpanded);
    };

    // 点击外部关闭筛选展开栏
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterExpandRef.current && !filterExpandRef.current.contains(event.target as Node)) {
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

    // 统计视图时不显示任何筛选栏
    if (viewMode === VIEW_OPTIONS.STATS) {
        return null;
    }

    return (
        <div className="pt-6 space-y-6 sticky top-0 bg-neutral-50 dark:bg-neutral-900 z-20 flex-none">
            {/* 视图切换与筛选栏 - 统一布局 */}
            <div className="flex justify-between items-center mb-6 px-6">
                <div className="flex items-center space-x-3">
                    <div className="text-xs font-medium tracking-wide text-neutral-800 dark:text-neutral-100 break-words">
                        {viewMode === VIEW_OPTIONS.INVENTORY
                            ? `${beansCount} 款咖啡豆${!hideTotalWeight && totalWeight ? `，共 ${totalWeight}` : ''}`
                            : viewMode === VIEW_OPTIONS.BLOGGER
                                ? `${bloggerBeansCount || 0} 款 (${bloggerYear}) 咖啡豆`
                                : `${rankingBeansCount || 0} 款已评分咖啡豆`
                        }
                    </div>
                </div>

                {/* 视图切换功能已移至导航栏 */}
            </div>

            {/* 榜单标签筛选 - 在榜单和博主榜单视图中显示 */}
            {(viewMode === VIEW_OPTIONS.RANKING || viewMode === VIEW_OPTIONS.BLOGGER) && (
                <div className="mb-1" ref={filterExpandRef}>
                    {/* 整个分类栏容器 - 下边框在这里 */}
                    <div className="border-b border-neutral-200 dark:border-neutral-800">
                        {/* 豆子筛选选项卡 */}
                        <div className="flex justify-between px-6">
                            <div className="flex items-center">
                                <div
                                    ref={rankingScrollContainerRef}
                                    className="relative flex items-center overflow-x-auto"
                                    style={{
                                        scrollbarWidth: 'none',
                                        msOverflowStyle: 'none',
                                        WebkitOverflowScrolling: 'touch'
                                    }}
                                >
                                    <style jsx>{`
                                        div::-webkit-scrollbar {
                                            display: none;
                                        }
                                    `}</style>
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
                                        className="pb-1.5 mr-3 text-xs font-medium text-neutral-400 dark:text-neutral-600 flex items-center"
                                    >
                                        <AlignLeft size={12} color="currentColor" />
                                    </button>

                                    <TabButton
                                        isActive={rankingBeanType === 'espresso'}
                                        onClick={() => onRankingBeanTypeChange?.('espresso')}
                                        className="mr-3"
                                        dataTab="espresso"
                                    >
                                        意式豆
                                    </TabButton>
                                    <TabButton
                                        isActive={rankingBeanType === 'filter'}
                                        onClick={() => onRankingBeanTypeChange?.('filter')}
                                        className="mr-3"
                                        dataTab="filter"
                                    >
                                        手冲豆
                                    </TabButton>
                                </div>
                            </div>

                            <div className="flex items-center">
                                {/* 年份选择器 - 仅在博主榜单视图中显示 */}
                                {viewMode === VIEW_OPTIONS.BLOGGER && onBloggerYearChange && (
                                    <div className="flex items-center ml-3">
                                        <TabButton
                                            isActive={bloggerYear === 2025}
                                            onClick={() => onBloggerYearChange(2025)}
                                            className="ml-3"
                                        >
                                            2025
                                        </TabButton>
                                        <TabButton
                                            isActive={bloggerYear === 2024}
                                            onClick={() => onBloggerYearChange(2024)}
                                            className="ml-3"
                                        >
                                            2024
                                        </TabButton>
                                    </div>
                                )}

                                {/* 编辑按钮 - 仅在个人榜单视图中显示 */}
                                {viewMode === VIEW_OPTIONS.RANKING && onRankingEditModeChange && (
                                    <TabButton
                                        isActive={rankingEditMode}
                                        onClick={() => onRankingEditModeChange(!rankingEditMode)}
                                        className="mr-3"
                                    >
                                        {rankingEditMode ? '完成' : '编辑'}
                                    </TabButton>
                                )}

                                {/* 分享按钮 - 仅在个人榜单视图中显示 */}
                                {viewMode === VIEW_OPTIONS.RANKING && onRankingShare && (
                                    <button
                                        onClick={onRankingShare}
                                        className="pb-1.5 text-xs font-medium relative text-neutral-600 dark:text-neutral-400"
                                    >
                                        <span className="relative underline underline-offset-2 decoration-sky-500">分享</span>
                                        <ArrowUpRight className="inline-block ml-1 w-3 h-3" color="currentColor" />
                                    </button>
                                )}
                            </div>
                        </div>

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
                                        style={{ willChange: "height, opacity, transform" }}
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
            {(viewMode === VIEW_OPTIONS.INVENTORY && totalBeans && totalBeans > 0) ? (
                <div className="relative" ref={filterExpandRef}>
                    {/* 整个分类栏容器 - 下边框在这里 */}
                    <div className="border-b border-neutral-200 dark:border-neutral-800">
                        <div className="px-6 relative">
                            {!isSearching ? (
                                <div
                                    ref={scrollContainerRef}
                                    className="flex pr-20 overflow-x-auto"
                                    style={{
                                        scrollbarWidth: 'none',
                                        msOverflowStyle: 'none',
                                        WebkitOverflowScrolling: 'touch'
                                    }}
                                >
                                    <style jsx>{`
                                        div::-webkit-scrollbar {
                                            display: none;
                                        }
                                    `}</style>

                                    {/* 全部按钮 - 带筛选图标 */}
                                    <TabButton
                                        isActive={
                                            (filterMode === 'variety' && selectedVariety === null) ||
                                            (filterMode === 'origin' && selectedOrigin === null) ||
                                            (filterMode === 'flavorPeriod' && selectedFlavorPeriod === null) ||
                                            (filterMode === 'roaster' && selectedRoaster === null)
                                        }
                                        onClick={() => {
                                            if (filterMode === 'variety' && selectedVariety !== null) {
                                                onVarietyClick?.(null)
                                            } else if (filterMode === 'origin' && selectedOrigin !== null) {
                                                onOriginClick?.(null)
                                            } else if (filterMode === 'flavorPeriod' && selectedFlavorPeriod !== null) {
                                                onFlavorPeriodClick?.(null)
                                            } else if (filterMode === 'roaster' && selectedRoaster !== null) {
                                                onRoasterClick?.(null)
                                            }
                                        }}
                                        className="mr-1"
                                        dataTab="all"
                                    >
                                        <span onDoubleClick={() => onToggleImageFlowMode?.()}>
                                            全部
                                            {isImageFlowMode && (
                                                <span> · 图片流</span>
                                            )}
                                        </span>
                                    </TabButton>

                                    {/* 筛选图标按钮 */}
                                    <button
                                        onClick={handleFilterToggle}
                                        className="pb-1.5 mr-3 text-xs font-medium text-neutral-400 dark:text-neutral-600 flex items-center"
                                    >
                                        <AlignLeft size={12} color="currentColor" />
                                    </button>

                                    {/* 根据分类模式显示不同的筛选按钮 */}
                                    {filterMode === 'variety' && availableVarieties?.map((variety: string) => (
                                        <TabButton
                                            key={variety}
                                            isActive={selectedVariety === variety}
                                            onClick={() => selectedVariety !== variety && onVarietyClick?.(variety)}
                                            className="mr-3"
                                            dataTab={variety}
                                        >
                                            {variety}
                                        </TabButton>
                                    ))}

                                    {filterMode === 'origin' && availableOrigins?.map((origin: string) => (
                                        <TabButton
                                            key={origin}
                                            isActive={selectedOrigin === origin}
                                            onClick={() => selectedOrigin !== origin && onOriginClick?.(origin)}
                                            className="mr-3"
                                            dataTab={origin}
                                        >
                                            {origin}
                                        </TabButton>
                                    ))}

                                    {filterMode === 'flavorPeriod' && availableFlavorPeriods?.map((status: FlavorPeriodStatus) => (
                                        <TabButton
                                            key={status}
                                            isActive={selectedFlavorPeriod === status}
                                            onClick={() => selectedFlavorPeriod !== status && onFlavorPeriodClick?.(status)}
                                            className="mr-3"
                                            dataTab={status}
                                        >
                                            {FLAVOR_PERIOD_LABELS[status]}
                                        </TabButton>
                                    ))}

                                    {filterMode === 'roaster' && availableRoasters?.map((roaster: string) => (
                                        <TabButton
                                            key={roaster}
                                            isActive={selectedRoaster === roaster}
                                            onClick={() => selectedRoaster !== roaster && onRoasterClick?.(roaster)}
                                            className="mr-3"
                                            dataTab={roaster}
                                        >
                                            {roaster}
                                        </TabButton>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center pb-1.5 min-h-[22px]">
                                    <div className="flex-1 relative flex items-center">
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            value={searchQuery}
                                            onChange={handleSearchChange}
                                            onKeyDown={handleSearchKeyDown}
                                            placeholder="输入咖啡豆名称..."
                                            className="w-full pr-2 text-xs font-medium bg-transparent border-none outline-hidden text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500"
                                            autoComplete="off"
                                        />
                                    </div>
                                    <button
                                        onClick={handleCloseSearch}
                                        className="ml-1 text-neutral-500 dark:text-neutral-400 flex items-center "
                                    >
                                        <X size={14} color="currentColor" />
                                    </button>
                                </div>
                            )}

                            {/* 操作按钮 - 右侧固定 */}
                            {!isSearching && (
                                <div className="absolute right-6 top-0 bottom-0 flex items-center bg-neutral-50 dark:bg-neutral-900 pl-3 before:content-[''] before:absolute before:left-[-20px] before:top-0 before:bottom-0 before:w-5 before:bg-linear-to-r before:from-transparent before:to-neutral-50 dark:before:to-neutral-900 before:pointer-events-none">
                                    {/* 竖直分割线 */}
                                    <div className="w-px h-3 bg-neutral-200 dark:bg-neutral-800 mb-1.5 mr-3"></div>
                                    <button
                                        onClick={handleSearchClick}
                                        className="pb-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 flex items-center whitespace-nowrap"
                                    >
                                        <span className="relative">搜索</span>
                                    </button>
                                </div>
                            )}
                        </div>

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
                                        style={{ willChange: "height, opacity, transform" }}
                                    >
                                        <div className="px-6 py-4">
                                            <div className="space-y-4">
                                                {/* 分类模式选择 - 仅在仓库视图显示 */}
                                                {viewMode === VIEW_OPTIONS.INVENTORY && onFilterModeChange && (
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
                                                />

                                                {/* 显示选项区域 */}
                                                <div>
                                                    <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">显示</div>
                                                    <div className="flex items-center flex-wrap gap-2">
                                                        <FilterButton
                                                            isActive={showEmptyBeans || false}
                                                            onClick={() => onToggleShowEmptyBeans?.()}
                                                        >
                                                            包含已用完
                                                        </FilterButton>
                                                        {onToggleImageFlowMode && (
                                                            <FilterButton
                                                                isActive={isImageFlowMode}
                                                                onClick={() => onToggleImageFlowMode()}
                                                            >
                                                                图片流
                                                            </FilterButton>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 分享按钮 - 仅在库存视图且咖啡豆数量超过10个时显示 */}
                                                {viewMode === VIEW_OPTIONS.INVENTORY && onInventoryShare && beansCount > 10 && (
                                                    <div className="pt-2 border-t border-neutral-200/30 dark:border-neutral-700/30">
                                                        <FilterButton
                                                            isActive={false}
                                                            onClick={onInventoryShare}
                                                        >
                                                            分享为图片
                                                            <ArrowUpRight className="inline-block ml-1 w-3 h-3" />
                                                        </FilterButton>
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
    )
}

export default ViewSwitcher