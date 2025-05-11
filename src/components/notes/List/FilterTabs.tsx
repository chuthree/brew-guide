'use client'

import React, { memo, useRef } from 'react'
import { FilterTabsProps } from '../types'
import { X } from 'lucide-react'

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
    onSearchKeyDown
}) {
    // 如果没有可筛选的设备或咖啡豆，不渲染任何内容
    if (availableEquipments.length === 0 && availableBeans.length === 0) return null;
    
    // 搜索输入框引用
    const searchInputRef = useRef<HTMLInputElement>(null);
    
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
    
    return (
        <div className="relative">
            <div className="border-b border-neutral-200 dark:border-neutral-800 px-6 relative">
                {isSearching ? (
                    // 搜索模式 - 使用完全独立的容器，不受pr-14影响，参考咖啡豆搜索实现
                    <div className="flex items-center pb-1.5 h-[24px] w-full">
                        <div className="flex-1 relative flex items-center">
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={onSearchChange}
                                onKeyDown={onSearchKeyDown}
                                placeholder="搜索笔记..."
                                className="w-full pr-2 text-[11px] bg-transparent border-none outline-none text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500"
                                autoComplete="off"
                            />
                        </div>
                        <button 
                            onClick={handleSearchClick}
                            className="ml-1 text-neutral-500 dark:text-neutral-400 flex items-center"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ) : (
                    // 非搜索模式 - 保持原有布局
                    <div className="flex overflow-x-auto no-scrollbar pr-20 h-[24px]">
                        {filterMode === 'equipment' ? (
                            <>
                                <button
                                    onClick={() => onEquipmentClick(null)}
                                    className={`pb-1.5 mr-3 text-[11px] whitespace-nowrap relative ${selectedEquipment === null ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                >
                                    <span className="relative">全部记录</span>
                                    {selectedEquipment === null && (
                                        <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                    )}
                                </button>
                                {availableEquipments.map(equipment => (
                                    <button
                                        key={equipment}
                                        onClick={() => onEquipmentClick(equipment)}
                                        className={`pb-1.5 mr-3 text-[11px] whitespace-nowrap relative ${selectedEquipment === equipment ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                    >
                                        <span className="relative">{equipmentNames[equipment] || equipment}</span>
                                        {selectedEquipment === equipment && (
                                            <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                        )}
                                    </button>
                                ))}
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => onBeanClick(null)}
                                    className={`pb-1.5 mr-3 text-[11px] whitespace-nowrap relative ${selectedBean === null ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                >
                                    <span className="relative">全部记录</span>
                                    {selectedBean === null && (
                                        <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                    )}
                                </button>
                                {availableBeans.map(bean => (
                                    <button
                                        key={bean}
                                        onClick={() => onBeanClick(bean)}
                                        className={`pb-1.5 mr-3 text-[11px] whitespace-nowrap relative ${selectedBean === bean ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                    >
                                        <span className="relative">{bean}</span>
                                        {selectedBean === bean && (
                                            <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                        )}
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                )}

                {/* 筛选模式切换按钮和搜索按钮 - 固定在右侧，仅在非搜索模式下显示 */}
                {!isSearching && (
                    <div className="absolute right-6 top-0 bottom-0 flex items-center bg-neutral-50 dark:bg-neutral-900 pl-1 before:content-[''] before:absolute before:left-[-20px] before:top-0 before:bottom-0 before:w-5 before:bg-gradient-to-r before:from-transparent before:to-neutral-50 dark:before:to-neutral-900 before:pointer-events-none">
                        <button
                            onClick={() => onFilterModeChange(filterMode === 'equipment' ? 'bean' : 'equipment')}
                            className={`pb-1.5 text-[11px] whitespace-nowrap relative text-neutral-600 dark:text-neutral-400`}
                        >
                            <span className="relative">{filterMode === 'equipment' ? '按器具' : '按豆子'}</span>
                        </button>
                        
                        {/* 搜索按钮 - 使用"找笔记"文字代替图标 */}
                        <button
                            onClick={handleSearchClick}
                            className="ml-3 pb-1.5 text-[11px] text-neutral-600 dark:text-neutral-400 flex items-center whitespace-nowrap"
                        >
                            <span className="relative">找笔记</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
})

export default FilterTabs 