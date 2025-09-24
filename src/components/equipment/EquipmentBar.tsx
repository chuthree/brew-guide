'use client'

import React, { useCallback, useRef } from 'react'
import { Menu } from 'lucide-react'
import { type CustomEquipment } from '@/lib/core/config'
import hapticsUtils from '@/lib/ui/haptics'
import { saveStringState } from '@/lib/core/statePersistence'
import { SettingsOptions } from '@/components/settings/Settings'
import { useEquipmentList } from '@/lib/equipment/useEquipmentList'
import { useScrollToSelected, useScrollBorder } from '@/lib/equipment/useScrollToSelected'

const useHapticFeedback = (settings: { hapticFeedback?: boolean }) =>
    useCallback(async () => {
        if (settings?.hapticFeedback) hapticsUtils.light()
    }, [settings?.hapticFeedback])

interface EquipmentBarProps {
    selectedEquipment: string | null
    customEquipments: CustomEquipment[]
    onEquipmentSelect: (equipmentId: string) => void
    onToggleManagementDrawer?: () => void
    settings: SettingsOptions
    className?: string
}

const EquipmentBar: React.FC<EquipmentBarProps> = ({
    selectedEquipment, 
    customEquipments, 
    onEquipmentSelect, 
    onToggleManagementDrawer,
    settings,
    className = ''
}) => {
    const triggerHaptic = useHapticFeedback(settings)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    
    // 使用自定义Hook管理器具列表
    const { allEquipments } = useEquipmentList({ customEquipments })
    
    // 使用自定义Hook管理滚动
    useScrollToSelected({
        selectedItem: selectedEquipment,
        containerRef: scrollContainerRef
    })
    
    // 使用自定义Hook管理滚动边框
    const { showLeftBorder, showRightBorder } = useScrollBorder({
        containerRef: scrollContainerRef,
        itemCount: allEquipments.length
    })

    const handleEquipmentSelect = async (equipmentId: string) => {
        await triggerHaptic()
        onEquipmentSelect(equipmentId)
        saveStringState('brewing-equipment', 'selectedEquipment', equipmentId)
    }

    const handleToggleManagement = async () => {
        await triggerHaptic()
        onToggleManagementDrawer?.()
    }





    return (
        <div className={`relative w-full overflow-hidden ${className}`}>
            <div className="flex items-center mt-2">
                {/* 器具选择滚动区域 */}
                <div
                    ref={scrollContainerRef}
                    className="flex-1 flex items-center gap-4 overflow-x-auto pr-2"
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

                    {allEquipments.map((equipment) => (
                        <div key={equipment.id} className="flex-shrink-0 flex items-center">
                            <div className="whitespace-nowrap flex items-center relative">
                                <div
                                    onClick={() => handleEquipmentSelect(equipment.id)}
                                    className="text-xs font-medium tracking-widest whitespace-nowrap pb-3 relative cursor-pointer"
                                    data-tab={equipment.id}
                                >
                                    <span className={`relative transition-colors duration-150 ${
                                        selectedEquipment === equipment.id
                                            ? 'text-neutral-800 dark:text-neutral-100'
                                            : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
                                    }`}>
                                        {equipment.name}
                                    </span>
                                    {selectedEquipment === equipment.id && (
                                        <span className="absolute bottom-0 left-0 w-full h-px bg-neutral-800 dark:bg-neutral-100"></span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* 左边框指示器 */}
                    <div
                        className={`absolute top-0 left-0 w-6 h-full bg-gradient-to-r from-neutral-50/95 dark:from-neutral-900/95 to-transparent pointer-events-none transition-opacity duration-200 ease-out ${
                            showLeftBorder ? 'opacity-100' : 'opacity-0'
                        }`}
                    />
                </div>

                {/* 固定在右侧的管理按钮 */}
                <div className="flex-shrink-0 flex items-center relative">
                    <button
                        onClick={handleToggleManagement}
                        className="text-xs font-medium tracking-widest whitespace-nowrap pb-3 relative cursor-pointer flex items-center justify-center"
                        aria-label="器具管理"
                    >
                        <span className="relative transition-colors duration-150 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300">
                            <Menu className="w-4 h-4" />
                        </span>
                    </button>

                    {/* 右边渐变指示器 - 从按钮左侧开始 */}
                    <div
                        className={`absolute top-0 -left-6 w-6 h-full bg-gradient-to-l from-neutral-50/95 dark:from-neutral-900/95 to-transparent pointer-events-none transition-opacity duration-200 ease-out ${
                            showRightBorder ? 'opacity-100' : 'opacity-0'
                        }`}
                    />
                </div>
            </div>
        </div>
    )
}

export default EquipmentBar
