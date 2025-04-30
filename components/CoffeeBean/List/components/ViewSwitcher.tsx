'use client'

import React, { useRef } from 'react'
import { ViewOption, VIEW_LABELS, VIEW_OPTIONS, BeanType, BloggerBeansYear } from '../types'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/CoffeeBean/ui/select'
import { SortSelector, SortOption } from '../SortSelector'
import { X } from 'lucide-react'

interface ViewSwitcherProps {
    viewMode: ViewOption
    onViewChange: (view: ViewOption) => void
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
}

const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
    viewMode,
    onViewChange,
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
}) => {
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

    return (
        <div className="pt-6 space-y-6 sticky top-0 bg-neutral-50 dark:bg-neutral-900 z-20 flex-none">
            {/* 视图切换与筛选栏 - 统一布局 */}
            <div className="flex justify-between items-center mb-6 px-6">
                <div className="flex items-center space-x-3">
                    <div className="text-xs tracking-wide text-neutral-800 dark:text-neutral-100 break-words">
                        {viewMode === VIEW_OPTIONS.INVENTORY
                            ? `${totalBeans ? `${beansCount}/${totalBeans}` : beansCount} 款咖啡豆${totalWeight ? `，共 ${totalWeight}` : ''}`
                            : viewMode === VIEW_OPTIONS.BLOGGER
                                ? `${beansCount} 款 (${bloggerYear}) 咖啡豆`
                                : viewMode === VIEW_OPTIONS.STATS
                                    ? `${totalBeans || beansCount} 款咖啡豆统计数据`
                                    : `${beansCount} 款已评分咖啡豆`
                        }
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    {/* 统一的视图切换组件 */}
                    <Select
                        value={viewMode}
                        onValueChange={(value) => onViewChange(value as ViewOption)}
                    >
                        <SelectTrigger
                            variant="minimal"
                            className="w-auto min-w-[82px] tracking-wide text-neutral-800 dark:text-neutral-100 transition-colors hover:opacity-80 text-right"
                        >
                            <div className="flex items-center justify-end w-full">
                                <SelectValue />
                                <svg
                                    className="w-3 h-3 ml-1.5"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <line x1="4" y1="6" x2="11" y2="6" />
                                    <line x1="4" y1="12" x2="11" y2="12" />
                                    <line x1="4" y1="18" x2="13" y2="18" />
                                    <line x1="15" y1="6" x2="20" y2="6" />
                                    <line x1="15" y1="12" x2="20" y2="12" />
                                    <line x1="15" y1="18" x2="20" y2="18" />
                                </svg>
                            </div>
                        </SelectTrigger>
                        <SelectContent
                            position="popper"
                            sideOffset={5}
                            className="border-neutral-200/70 dark:border-neutral-800/70 shadow-lg backdrop-blur-sm bg-white/95 dark:bg-neutral-900/95 rounded-lg overflow-hidden"
                        >
                            {Object.entries(VIEW_LABELS).map(([value, label]) => (
                                <SelectItem
                                    key={value}
                                    value={value}
                                    className="tracking-wide text-neutral-800 dark:text-neutral-100 data-[highlighted]:opacity-80 transition-colors font-medium"
                                >
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* 排序组件 */}
                    {beansCount > 0 && viewMode !== VIEW_OPTIONS.STATS && (
                        <SortSelector
                            viewMode={viewMode}
                            sortOption={sortOption}
                            onSortChange={(value) => onSortChange(value as SortOption)}
                            showSelector={true}
                        />
                    )}
                </div>
            </div>

            {/* 榜单标签筛选 - 在榜单和博主榜单视图中显示 */}
            {(viewMode === VIEW_OPTIONS.RANKING || viewMode === VIEW_OPTIONS.BLOGGER) && (
                <div className="mb-1">
                    {/* 豆子筛选选项卡 */}
                    <div className="flex justify-between border-b px-6 border-neutral-200 dark:border-neutral-800">
                        <div className="flex">
                            <button
                                className={`pb-1.5 mr-3 text-[11px] relative ${rankingBeanType === 'all' ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                onClick={() => onRankingBeanTypeChange?.('all')}
                            >
                                <span className="relative">全部豆子</span>
                                {rankingBeanType === 'all' && (
                                    <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                )}
                            </button>
                            <button
                                className={`pb-1.5 mx-3 text-[11px] relative ${rankingBeanType === 'espresso' ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                onClick={() => onRankingBeanTypeChange?.('espresso')}
                            >
                                <span className="relative">意式豆</span>
                                {rankingBeanType === 'espresso' && (
                                    <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                )}
                            </button>
                            <button
                                className={`pb-1.5 mx-3 text-[11px] relative ${rankingBeanType === 'filter' ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                onClick={() => onRankingBeanTypeChange?.('filter')}
                            >
                                <span className="relative">手冲豆</span>
                                {rankingBeanType === 'filter' && (
                                    <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                )}
                            </button>
                        </div>

                        <div className="flex items-center">
                            {/* 年份选择器 - 仅在博主榜单视图中显示 */}
                            {viewMode === VIEW_OPTIONS.BLOGGER && onBloggerYearChange && (
                                <div className="flex items-center ml-3">
                                    <button
                                        onClick={() => onBloggerYearChange(2025)}
                                        className={`pb-1.5 mx-3 text-[11px] relative ${bloggerYear === 2025 ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                    >
                                        <span className="relative">2025</span>
                                        {bloggerYear === 2025 && (
                                            <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => onBloggerYearChange(2024)}
                                        className={`pb-1.5 ml-3 text-[11px] relative ${bloggerYear === 2024 ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                    >
                                        <span className="relative">2024</span>
                                        {bloggerYear === 2024 && (
                                            <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* 编辑按钮 - 仅在个人榜单视图中显示 */}
                            {viewMode === VIEW_OPTIONS.RANKING && onRankingEditModeChange && (
                                <button
                                    onClick={() => onRankingEditModeChange(!rankingEditMode)}
                                    className={`pb-1.5 text-[11px] relative ${rankingEditMode ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                >
                                    <span className="relative">{rankingEditMode ? '完成' : '编辑'}</span>
                                    {rankingEditMode && (
                                        <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 库存视图的品种标签筛选 - 仅在库存视图中显示 */}
            {(viewMode === VIEW_OPTIONS.INVENTORY && totalBeans && totalBeans > 0) ? (
                <div className="relative">
                    <div className="border-b border-neutral-200 dark:border-neutral-800 px-6 relative">
                        {!isSearching ? (
                            <div className="flex overflow-x-auto no-scrollbar pr-28">
                                {/* 豆子类型筛选按钮 */}
                                <button
                                    onClick={() => onBeanTypeChange?.('espresso')}
                                    className={`pb-1.5 mr-3 text-[11px] whitespace-nowrap relative ${selectedBeanType === 'espresso' ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                >
                                    <span className="relative">意式豆</span>
                                    {selectedBeanType === 'espresso' && (
                                        <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                    )}
                                </button>
                                
                                <button
                                    onClick={() => onBeanTypeChange?.('filter')}
                                    className={`pb-1.5 mr-3 text-[11px] whitespace-nowrap relative ${selectedBeanType === 'filter' ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                >
                                    <span className="relative">手冲豆</span>
                                    {selectedBeanType === 'filter' && (
                                        <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                    )}
                                </button>
                                
                                {/* 分隔符 */}
                                <div className="h-6 mr-3 self-center border-l border-neutral-200 dark:border-neutral-800"></div>
                                
                                {/* 品种筛选按钮 */}
                                <button
                                    onClick={() => selectedVariety !== null && onVarietyClick?.(null)}
                                    className={`pb-1.5 mr-3 text-[11px] whitespace-nowrap relative ${selectedVariety === null ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                >
                                    <span className="relative">全部品种</span>
                                    {selectedVariety === null && (
                                        <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                    )}
                                </button>
                                
                                {availableVarieties?.map((variety: string) => (
                                    <button
                                        key={variety}
                                        onClick={() => selectedVariety !== variety && onVarietyClick?.(variety)}
                                        className={`pb-1.5 mx-3 text-[11px] whitespace-nowrap relative ${selectedVariety === variety ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                    >
                                        <span className="relative">{variety}</span>
                                        {selectedVariety === variety && (
                                            <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center pb-1.5 h-[24px]">
                                <div className="flex-1 relative flex items-center">
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        value={searchQuery}
                                        onChange={handleSearchChange}
                                        onKeyDown={handleSearchKeyDown}
                                        placeholder="输入咖啡豆名称..."
                                        className="w-full pr-2 text-[11px] bg-transparent border-none outline-none text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500"
                                        autoComplete="off"
                                    />
                                </div>
                                <button 
                                    onClick={handleCloseSearch}
                                    className="ml-1 text-neutral-500 dark:text-neutral-400 flex items-center "
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}

                        {/* 操作按钮 - 右侧固定 */}
                        {!isSearching && (
                            <div className="absolute right-6 top-0 bottom-0 flex items-center bg-neutral-50 dark:bg-neutral-900 pl-1 before:content-[''] before:absolute before:left-[-20px] before:top-0 before:bottom-0 before:w-5 before:bg-gradient-to-r before:from-transparent before:to-neutral-50 dark:before:to-neutral-900">
                                <button
                                    onClick={onToggleShowEmptyBeans}
                                    className={`pb-1.5 text-[11px] whitespace-nowrap relative ${showEmptyBeans ? 'text-neutral-800 dark:text-neutral-100 font-normal' : 'text-neutral-600 dark:text-neutral-400'}`}
                                >
                                    <span className="relative">已用完</span>
                                    {showEmptyBeans && (
                                        <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                    )}
                                </button>
                                <button
                                    onClick={handleSearchClick}
                                    className="ml-3 pb-1.5 text-[11px] text-neutral-600 dark:text-neutral-400 flex items-center whitespace-nowrap"
                                >
                                    <span className="relative">找豆子</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    )
}

export default ViewSwitcher 