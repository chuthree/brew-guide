'use client'

import React from 'react'
import { ViewOption, VIEW_LABELS, VIEW_OPTIONS, BeanType, BloggerBeansYear } from '../types'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/CoffeeBean/ui/select'
import { SortSelector, SortOption } from '../SortSelector'

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
    onRankingEditModeChange
}) => {
    return (
        <div className="pt-6 space-y-6 sticky top-0 bg-neutral-50 dark:bg-neutral-900 z-20">
            {/* 视图切换与筛选栏 - 统一布局 */}
            <div className="flex justify-between items-center mb-6 px-6">
                <div className="flex items-center space-x-3">
                    <div className="text-xs tracking-wide text-neutral-800 dark:text-neutral-100">
                        {viewMode === VIEW_OPTIONS.INVENTORY
                            ? `${totalBeans ? `${beansCount}/${totalBeans}` : beansCount} 款咖啡豆，总计 ${totalWeight || '0g'}`
                            : viewMode === VIEW_OPTIONS.BLOGGER
                                ? `${beansCount} 款 (${bloggerYear}) 咖啡豆`
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
                    {beansCount > 0 && (
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
        </div>
    )
}

export default ViewSwitcher 