'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { Plus, GripVertical, Edit, Trash2, Share2, X } from 'lucide-react'
import { type CustomEquipment } from '@/lib/core/config'
import hapticsUtils from '@/lib/ui/haptics'
import { SettingsOptions } from '@/components/settings/Settings'
import { 
    animateThemeColorForDrawerOpen, 
    animateThemeColorForDrawerClose,
    themeColorAnimator
} from '@/lib/ui/theme-color-animator'
import { useEquipmentList } from '@/lib/equipment/useEquipmentList'

interface EquipmentManagementDrawerProps {
    isOpen: boolean
    onClose: () => void
    customEquipments: CustomEquipment[]
    onAddEquipment: () => void
    onEditEquipment: (equipment: CustomEquipment) => void
    onDeleteEquipment: (equipment: CustomEquipment) => void
    onShareEquipment: (equipment: CustomEquipment) => void
    onReorderEquipments: (newOrder: CustomEquipment[]) => void
    settings: SettingsOptions
}

interface EquipmentWithActions {
    id: string
    name: string
    note?: string
    showActions?: boolean
    isSystem?: boolean // true 表示系统器具，false 表示自定义器具
    // 自定义器具的特有属性（可选）
    animationType?: "v60" | "kalita" | "origami" | "clever" | "custom" | "espresso"
    hasValve?: boolean
    isCustom?: true
    customShapeSvg?: string
    customValveSvg?: string
    customValveOpenSvg?: string
    customPourAnimations?: Array<{
        id: string
        name: string
        customAnimationSvg: string
        isSystemDefault?: boolean
        pourType?: 'center' | 'circle' | 'ice' | 'bypass'
        previewFrames?: number
        frames?: Array<{
            id: string
            svgData: string
        }>
    }>
}

const EquipmentManagementDrawer: React.FC<EquipmentManagementDrawerProps> = ({
    isOpen,
    onClose,
    customEquipments,
    onAddEquipment,
    onEditEquipment,
    onDeleteEquipment,
    onShareEquipment,
    onReorderEquipments,
    settings
}) => {
    // 使用自定义Hook管理器具列表
    const { allEquipments: baseEquipments } = useEquipmentList({ customEquipments })

    // 本地状态管理器具的操作显示状态
    const [allEquipments, setAllEquipments] = useState<EquipmentWithActions[]>([])

    // 同步基础器具列表到本地状态，添加操作状态
    React.useEffect(() => {
        const equipmentsWithActions = baseEquipments.map(eq => ({
            ...eq,
            showActions: false,
            isSystem: !eq.isCustom
        } as EquipmentWithActions))
        setAllEquipments(equipmentsWithActions)
    }, [baseEquipments])

    const triggerHaptic = React.useCallback(async () => {
        if (settings?.hapticFeedback) {
            await hapticsUtils.light()
        }
    }, [settings?.hapticFeedback])

    // 处理拖拽排序（所有器具统一排序）
    const handleReorder = async (newOrder: EquipmentWithActions[]) => {
        setAllEquipments(newOrder)
        
        try {
            // 生成新的器具排序数据
            const { equipmentUtils } = await import('@/lib/equipment/equipmentUtils')
            const newEquipmentOrder = equipmentUtils.generateEquipmentOrder(newOrder)
            
            // 保存排序
            const { saveEquipmentOrder } = await import('@/lib/managers/customEquipments')
            await saveEquipmentOrder(newEquipmentOrder)
            
            // 传递自定义器具给父组件以保持向后兼容
            const customEquipmentsOnly = newOrder.filter(eq => !eq.isSystem) as CustomEquipment[]
            onReorderEquipments(customEquipmentsOnly)
            
            // 通知所有器具栏组件更新
            const { equipmentEventBus } = await import('@/lib/equipment/equipmentEventBus')
            equipmentEventBus.notify()
            
        } catch (error) {
            console.error('保存器具排序失败:', error)
        }
    }

    // 切换操作按钮显示
    const toggleActions = async (equipmentId: string) => {
        await triggerHaptic()
        setAllEquipments(prev => 
            prev.map(eq => ({
                ...eq,
                showActions: eq.id === equipmentId ? !eq.showActions : false
            }))
        )
    }

    // 处理操作按钮点击
    const handleAction = async (action: 'edit' | 'delete' | 'share', equipment: EquipmentWithActions) => {
        await triggerHaptic()
        
        // 隐藏操作按钮
        setAllEquipments(prev => 
            prev.map(eq => ({ ...eq, showActions: false }))
        )

        // 只对自定义器具执行操作
        if (!equipment.isSystem && equipment.isCustom) {
            switch (action) {
                case 'edit':
                    onEditEquipment(equipment as CustomEquipment)
                    break
                case 'delete':
                    onDeleteEquipment(equipment as CustomEquipment)
                    break
                case 'share':
                    onShareEquipment(equipment as CustomEquipment)
                    break
            }
        }
    }

    // 处理添加设备
    const handleAddEquipment = async () => {
        await triggerHaptic()
        onAddEquipment()
    }



    // 监听 isOpen 变化，处理关闭时的主题色动画
    React.useEffect(() => {
        if (!isOpen) {
            // 抽屉开始关闭时，立即开始主题色恢复动画
            animateThemeColorForDrawerClose()
        }
    }, [isOpen])

    // 组件卸载时重置主题色
    React.useEffect(() => {
        return () => {
            themeColorAnimator.reset()
        }
    }, [])

    return (
        <AnimatePresence 
            onExitComplete={() => {
                // 退出动画完成后，确保主题色已恢复
                themeColorAnimator.reset()
            }}
        >
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.265 }}
                        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs"
                        onAnimationStart={() => {
                            // 进入动画开始时立即触发主题色动画
                            animateThemeColorForDrawerOpen()
                        }}
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ 
                            type: "tween",
                            duration: 0.35,
                            ease: [0.36, 0.66, 0.04, 1]
                        }}
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0, bottom: 0.2 }}
                        onDragEnd={(_, info) => {
                            if (info.offset.y > 100) {
                                onClose()
                            }
                        }}
                        className="fixed bottom-0 left-0 right-0 z-50 max-w-[500px] mx-auto bg-neutral-50 dark:bg-neutral-900 backdrop-blur-xl rounded-t-3xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-center pt-3 pb-2">
                            <div className="w-10 h-1 bg-neutral-300 dark:bg-neutral-600 rounded-full" />
                        </div>

                        <div className="px-6 pb-6">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
                                    器具管理
                                </h3>
                                <button
                                    onClick={handleAddEquipment}
                                    className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600 transition-colors duration-150 active:scale-95"
                                >
                                    <Plus className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                                </button>
                            </div>

                            <div className="space-y-2 max-h-[85vh] overflow-y-auto pb-safe-bottom">
                                {allEquipments.length > 0 ? (
                                    <div className="space-y-2">
                                        <Reorder.Group
                                            axis="y"
                                            values={allEquipments}
                                            onReorder={handleReorder}
                                            className="space-y-2"
                                        >
                                            {allEquipments.map((equipment) => (
                                                <Reorder.Item
                                                    key={equipment.id}
                                                    value={equipment}
                                                    whileDrag={{ 
                                                        scale: 1.01,
                                                        transition: { duration: 0.1 }
                                                    }}
                                                    style={{ 
                                                        listStyle: 'none'
                                                    }}
                                                >
                                                    <motion.div 
                                                        className="flex items-center py-3"
                                                        whileDrag={{
                                                            backgroundColor: 'transparent',
                                                            transition: { duration: 0.1 }
                                                        }}
                                                        onPointerDown={(e) => {
                                                            const target = e.target as HTMLElement;
                                                            const isDragHandle = target.closest('.drag-handle');
                                                            if (!isDragHandle) {
                                                                e.preventDefault();
                                                            }
                                                        }}
                                                    >
                                                        <div 
                                                            className="drag-handle p-1 pl-0 mr-3 rounded-md cursor-grab active:cursor-grabbing transition-colors duration-150"
                                                        >
                                                            <motion.div
                                                                whileDrag={{
                                                                    color: 'rgb(107 114 128)',
                                                                    transition: { duration: 0.1 }
                                                                }}
                                                            >
                                                                <GripVertical className="w-4 h-4 transition-colors duration-150 text-neutral-400 dark:text-neutral-500" />
                                                            </motion.div>
                                                        </div>
                                                        
                                                        <motion.span 
                                                            className={`flex-1 text-md font-medium text-neutral-700 dark:text-neutral-200 transition-colors duration-150 ${
                                                                !equipment.isSystem && equipment.showActions ? 'truncate' : ''
                                                            }`}
                                                            whileDrag={{
                                                                color: 'rgb(107 114 128)',
                                                                transition: { duration: 0.1 }
                                                            }}
                                                            title={equipment.name + (equipment.isSystem ? '' : ' - 自定义')}
                                                        >
                                                            {equipment.name}{equipment.isSystem ? '' : ' - 自定义'}
                                                        </motion.span>

                                                        {!equipment.isSystem && (
                                                            <div className="flex items-center justify-end">
                                                                <AnimatePresence mode="wait">
                                                                    {equipment.showActions ? (
                                                                        <motion.div
                                                                            initial={{ opacity: 0, filter: "blur(4px)" }}
                                                                            animate={{ opacity: 1, filter: "blur(0px)" }}
                                                                            exit={{ opacity: 0, filter: "blur(4px)" }}
                                                                            transition={{ duration: 0.2 }}
                                                                            className="flex items-center space-x-1"
                                                                        >
                                                                            <button
                                                                                onClick={() => handleAction('edit', equipment)}
                                                                                className="p-2 rounded-md hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600 transition-colors duration-150"
                                                                            >
                                                                                <Edit className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleAction('share', equipment)}
                                                                                className="p-2 rounded-md hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600 transition-colors duration-150"
                                                                            >
                                                                                <Share2 className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleAction('delete', equipment)}
                                                                                className="p-2 rounded-md hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600 transition-colors duration-150"
                                                                            >
                                                                                <Trash2 className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => toggleActions(equipment.id)}
                                                                                className="p-2 rounded-md hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600 transition-colors duration-150"
                                                                            >
                                                                                <X className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                                                                            </button>
                                                                        </motion.div>
                                                                    ) : (
                                                                        <motion.button
                                                                            initial={{ opacity: 0.6, filter: "blur(2px)" }}
                                                                            animate={{ opacity: 1, filter: "blur(0px)" }}
                                                                            exit={{ opacity: 0.6, filter: "blur(2px)" }}
                                                                            transition={{ duration: 0.2 }}
                                                                            onClick={() => toggleActions(equipment.id)}
                                                                            className="p-2 rounded-md hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600 transition-all duration-150"
                                                                        >
                                                                            <span className="flex items-center justify-center w-4 h-4 text-neutral-600 dark:text-neutral-400 text-lg font-bold leading-none select-none">⋯</span>
                                                                        </motion.button>
                                                                    )}
                                                                </AnimatePresence>
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                </Reorder.Item>
                                            ))}
                                        </Reorder.Group>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
                                            暂无自定义器具
                                        </p>
                                        <button
                                            onClick={handleAddEquipment}
                                            className="text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors duration-150 hover:underline"
                                        >
                                            点击添加
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}

export default EquipmentManagementDrawer