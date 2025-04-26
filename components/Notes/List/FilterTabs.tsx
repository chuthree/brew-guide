'use client'

import React, { memo } from 'react'
import { FilterTabsProps } from '../types'

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
    onBeanClick
}) {
    // 如果没有可筛选的设备或咖啡豆，不渲染任何内容
    if (availableEquipments.length === 0 && availableBeans.length === 0) return null;
    
    return (
        <div className="relative">
            <div className="border-b border-neutral-200 dark:border-neutral-800 px-6 relative">
                <div className="flex overflow-x-auto no-scrollbar pr-14">
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
                                    className={`pb-1.5 mx-3 text-[11px] whitespace-nowrap relative ${selectedEquipment === equipment ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
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
                                    className={`pb-1.5 mx-3 text-[11px] whitespace-nowrap relative ${selectedBean === bean ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
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

                {/* 筛选模式切换按钮 - 固定在右侧 */}
                <div className="absolute right-6 top-0 bottom-0 flex items-center bg-gradient-to-l from-neutral-50 via-neutral-50 to-transparent dark:from-neutral-900 dark:via-neutral-900 pl-6">
                    <button
                        onClick={() => onFilterModeChange(filterMode === 'equipment' ? 'bean' : 'equipment')}
                        className={`pb-1.5 text-[11px] whitespace-nowrap relative text-neutral-800 dark:text-neutral-100 font-normal`}
                    >
                        <span className="relative mr-1">{filterMode === 'equipment' ? '器具' : '咖啡豆'}</span>
                        <span className="relative">/</span>
                    </button>
                </div>
            </div>
        </div>
    )
})

export default FilterTabs 