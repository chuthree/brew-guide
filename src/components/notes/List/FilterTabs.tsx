'use client'

import React, { memo, useRef, useState, useEffect } from 'react'
import { FilterTabsProps, SORT_OPTIONS, SortOption } from '../types'
import { X, AlignLeft } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

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

// 排序相关辅助函数
const getSortTypeAndOrder = (sortOption: SortOption) => {
    if (sortOption.includes('time')) {
        return { type: 'time', order: sortOption.includes('desc') ? 'desc' : 'asc' };
    } else if (sortOption.includes('rating')) {
        return { type: 'rating', order: sortOption.includes('desc') ? 'desc' : 'asc' };
    }
    return { type: 'time', order: 'desc' };
};

const getSortOption = (type: string, order: string): SortOption => {
    if (type === 'time') {
        return order === 'desc' ? SORT_OPTIONS.TIME_DESC : SORT_OPTIONS.TIME_ASC;
    } else if (type === 'rating') {
        return order === 'desc' ? SORT_OPTIONS.RATING_DESC : SORT_OPTIONS.RATING_ASC;
    }
    return SORT_OPTIONS.TIME_DESC;
};

const getSortOrderLabel = (type: string, order: string) => {
    if (type === 'time') {
        return order === 'desc' ? '最新' : '最早';
    } else if (type === 'rating') {
        return order === 'desc' ? '最高' : '最低';
    }
    return '最新';
};

// 筛选模式选择组件
interface FilterModeSectionProps {
    filterMode: 'equipment' | 'bean'
    onFilterModeChange: (mode: 'equipment' | 'bean') => void
}

const FilterModeSection: React.FC<FilterModeSectionProps> = ({ filterMode, onFilterModeChange }) => {
    return (
        <div>
            <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">筛选方式</div>
            <div className="flex items-center flex-wrap gap-2">
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
            </div>
        </div>
    );
};

// 排序区域组件 - 使用筛选按钮样式
interface SortSectionProps {
    sortOption: SortOption
    onSortChange: (option: SortOption) => void
}

const SortSection: React.FC<SortSectionProps> = ({ sortOption, onSortChange }) => {
    const { type: currentType, order: currentOrder } = getSortTypeAndOrder(sortOption);

    return (
        <div>
            <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">排序</div>
            <div className="space-y-3">
                {/* 排序方式 */}
                <div className="flex items-center flex-wrap gap-2">
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
                </div>

                {/* 排序顺序 */}
                <div className="flex items-center flex-wrap gap-2">
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

// 使用memo包装组件以避免不必要的重渲染
const FilterTabs: React.FC<FilterTabsProps> = memo(function FilterTabs({
    filterMode,
    selectedEquipment,
    selectedBean,
    availableEquipments,
    availableBeans,
    equipmentNames,
    onFilterModeChange,
    onEquipmentClick,
    onBeanClick,
    isSearching = false,
    searchQuery = '',
    onSearchClick,
    onSearchChange,
    onSearchKeyDown,
    sortOption,
    onSortChange
}) {
    // 搜索输入框引用 - 移到条件语句前面
    const searchInputRef = useRef<HTMLInputElement>(null);

    // 筛选展开栏状态
    const [isFilterExpanded, setIsFilterExpanded] = useState(false);
    const filterExpandRef = useRef<HTMLDivElement>(null);

    // 滚动容器引用
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // 滚动到选中项的函数
    const scrollToSelected = () => {
        if (!scrollContainerRef.current) return

        const selectedId = filterMode === 'equipment' ? selectedEquipment : selectedBean
        if (!selectedId) return

        const selectedElement = scrollContainerRef.current.querySelector(`[data-tab="${selectedId}"]`)
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

    // 当选中项变化时滚动到选中项
    useEffect(() => {
        // 延迟执行以确保DOM已更新
        const timer = setTimeout(scrollToSelected, 100)
        return () => clearTimeout(timer)
    }, [selectedEquipment, selectedBean, filterMode])

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

    // 如果没有可筛选的设备或咖啡豆，不渲染任何内容
    if (availableEquipments.length === 0 && availableBeans.length === 0) return null;

    return (
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
                                isActive={(filterMode === 'equipment' && selectedEquipment === null) || (filterMode === 'bean' && selectedBean === null)}
                                onClick={() => {
                                    if (filterMode === 'equipment') {
                                        onEquipmentClick(null);
                                    } else {
                                        onBeanClick(null);
                                    }
                                }}
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

                            {/* 动态筛选按钮 */}
                            {filterMode === 'equipment' ? (
                                availableEquipments.map(equipment => (
                                    <TabButton
                                        key={equipment}
                                        isActive={selectedEquipment === equipment}
                                        onClick={() => selectedEquipment !== equipment && onEquipmentClick(equipment)}
                                        className="mr-3"
                                        dataTab={equipment}
                                    >
                                        {equipmentNames[equipment] || equipment}
                                    </TabButton>
                                ))
                            ) : (
                                availableBeans.map(bean => (
                                    <TabButton
                                        key={bean}
                                        isActive={selectedBean === bean}
                                        onClick={() => selectedBean !== bean && onBeanClick(bean)}
                                        className="mr-3"
                                        dataTab={bean}
                                    >
                                        {bean}
                                    </TabButton>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center pb-1.5 min-h-[22px]">
                            <div className="flex-1 relative flex items-center">
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={onSearchChange}
                                    onKeyDown={onSearchKeyDown}
                                    placeholder="搜索笔记..."
                                    className="w-full pr-2 text-xs font-medium bg-transparent border-none outline-hidden text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500"
                                    autoComplete="off"
                                />
                            </div>
                            <button
                                onClick={handleSearchClick}
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
                                style={{ willChange: "height, opacity, transform" }}
                            >
                                <div className="px-6 py-4">
                                    <div className="space-y-4">
                                        <FilterModeSection
                                            filterMode={filterMode}
                                            onFilterModeChange={onFilterModeChange}
                                        />

                                        <SortSection
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
    )
})

export default FilterTabs