'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { equipmentList, type CustomEquipment } from '@/lib/core/config'
import hapticsUtils from '@/lib/ui/haptics'
import { SettingsOptions } from '@/components/settings/Settings'
import { formatGrindSize } from '@/lib/utils/grindUtils'
import { BREWING_EVENTS, ParameterInfo } from '@/lib/brewing/constants'
import { listenToEvent } from '@/lib/brewing/events'
import { updateParameterInfo, getEquipmentName } from '@/lib/brewing/parameters'
import EquipmentBar from '@/components/equipment/EquipmentBar'
import EquipmentManagementDrawer from '@/components/equipment/EquipmentManagementDrawer'

import { Equal, ArrowLeft, ChevronsUpDown } from 'lucide-react'
import { saveMainTabPreference } from '@/lib/navigation/navigationCache'
import { ViewOption, VIEW_LABELS } from '@/components/coffee-bean/List/types'

// 统一类型定义
type MainTabType = '冲煮' | '咖啡豆' | '笔记'
type BrewingStep = 'coffeeBean' | 'method' | 'brewing' | 'notes'

interface EditableParams {
    coffee: string
    water: string
    ratio: string
    grindSize: string
    temp: string
}

// 优化的 TabButton 组件 - 使用更简洁的条件渲染和样式计算
interface TabButtonProps {
    tab: string
    isActive: boolean
    isDisabled?: boolean
    onClick?: () => void
    className?: string
    dataTab?: string
}

const TabButton: React.FC<TabButtonProps> = ({
    tab, isActive, isDisabled = false, onClick, className = '', dataTab
}) => {
    const baseClasses = 'text-xs font-medium tracking-widest whitespace-nowrap pb-3'
    const stateClasses = isActive
        ? 'text-neutral-800 dark:text-neutral-100'
        : isDisabled
            ? 'text-neutral-300 dark:text-neutral-600'
            : 'cursor-pointer text-neutral-500 dark:text-neutral-400'

    return (
        <div
            onClick={!isDisabled && onClick ? onClick : undefined}
            className={`${baseClasses} ${stateClasses} ${className}`}
            data-tab={dataTab}
        >
            <span className="relative inline-block">
                {tab}
            </span>
        </div>
    )
}

// 优化的EditableParameter组件 - 使用更简洁的逻辑和hooks
interface EditableParameterProps {
    value: string
    onChange: (value: string) => void
    unit: string
    className?: string
    prefix?: string
    disabled?: boolean
}

const EditableParameter: React.FC<EditableParameterProps> = ({
    value, onChange, unit, className = '', prefix = '', disabled = false
}) => {
    const [isEditing, setIsEditing] = useState(false)
    const inputRef = React.useRef<HTMLInputElement>(null)
    const [tempValue, setTempValue] = useState(value)

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])

    useEffect(() => {
        setTempValue(value)
    }, [value])

    const handleSubmit = useCallback(() => {
        setIsEditing(false)
        if (tempValue !== value) onChange(tempValue)
    }, [tempValue, value, onChange])

    const handleCancel = useCallback(() => {
        setTempValue(value)
        setIsEditing(false)
    }, [value])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSubmit()
        else if (e.key === 'Escape') handleCancel()
    }, [handleSubmit, handleCancel])

    if (disabled) {
        return (
            <span className={`inline-flex items-center ${className}`}>
                {prefix && <span className="shrink-0">{prefix}</span>}
                <span className="whitespace-nowrap">{value}</span>
                {unit && <span className="ml-0.5 shrink-0">{unit}</span>}
            </span>
        )
    }

    return (
        <span
            className={`group relative inline-flex items-center cursor-pointer min-w-0 border-b border-dashed border-neutral-300 dark:border-neutral-600 pb-0.5 ${className}`}
            onClick={() => setIsEditing(true)}
        >
            {prefix && <span className="shrink-0">{prefix}</span>}
            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={handleSubmit}
                    onKeyDown={handleKeyDown}
                    className="bg-transparent text-center text-xs outline-hidden min-w-0 max-w-none"
                    size={Math.max(tempValue.length || 1, 2)}
                />
            ) : (
                <span className="inline-flex items-center whitespace-nowrap">
                    {value}
                    {unit && <span className="ml-0.5 shrink-0">{unit}</span>}
                </span>
            )}
        </span>
    )
}

interface NavigationBarProps {
    activeMainTab: MainTabType;
    setActiveMainTab: (tab: MainTabType) => void;
    activeBrewingStep: BrewingStep;
    parameterInfo: ParameterInfo;
    setParameterInfo: (info: ParameterInfo) => void;
    editableParams: EditableParams | null;
    setEditableParams: (params: EditableParams | null) => void;
    isTimerRunning: boolean;
    showComplete: boolean;
    selectedEquipment: string | null;
    selectedMethod: {
        name: string;
        params: {
            coffee: string;
            water: string;
            ratio: string;
            grindSize: string;
            temp: string;
            stages: Array<{
                label: string;
                time: number;
                water: string;
                detail: string;
            }>;
        };
    } | null;
    handleParamChange: (type: keyof EditableParams, value: string) => void;
    setShowHistory: (show: boolean) => void;
    onTitleDoubleClick: () => void;
    settings: SettingsOptions;
    hasCoffeeBeans?: boolean;
    alternativeHeader?: React.ReactNode;
    showAlternativeHeader?: boolean;
    currentBeanView?: ViewOption;
    showViewDropdown?: boolean;
    onToggleViewDropdown?: () => void;
    handleExtractionTimeChange?: (time: number) => void;
    customEquipments?: CustomEquipment[];
    onEquipmentSelect?: (equipmentId: string) => void;
    onAddEquipment?: () => void;
    onEditEquipment?: (equipment: CustomEquipment) => void;
    onDeleteEquipment?: (equipment: CustomEquipment) => void;
    onShareEquipment?: (equipment: CustomEquipment) => void;
    onBackClick?: () => void;
}

// 意式咖啡相关工具函数 - 优化为更简洁的实现
// const espressoUtils = {
//     isEspresso: (method: { params?: { stages?: Array<{ pourType?: string; [key: string]: unknown }> } } | null) =>
//         method?.params?.stages?.some((stage) =>
//             ['extraction', 'beverage'].includes(stage.pourType || '')) || false,

//     getExtractionTime: (method: { params?: { stages?: Array<{ pourType?: string; time?: number; [key: string]: unknown }> } } | null) =>
//         method?.params?.stages?.find((stage) => stage.pourType === 'extraction')?.time || 0,

//     formatTime: (seconds: number) => `${seconds}`
// }

// 导航相关常量和工具
const NAVIGABLE_STEPS: Record<BrewingStep, BrewingStep | null> = {
    'brewing': 'method',
    'method': 'coffeeBean',
    'coffeeBean': null,
    'notes': 'brewing'
}

// 自定义Hook：处理导航逻辑
const useNavigation = (activeBrewingStep: BrewingStep, activeMainTab: MainTabType, hasCoffeeBeans?: boolean) => {
    const canGoBack = useCallback((): boolean => {
        // 如果当前在笔记页面，不显示返回按钮
        if (activeMainTab === '笔记') return false

        // 如果当前在咖啡豆页面，不显示返回按钮
        if (activeMainTab === '咖啡豆') return false

        // 只有在冲煮页面才考虑返回逻辑
        if (activeMainTab !== '冲煮') return false

        // 咖啡豆步骤是第一步，不显示返回按钮
        if (activeBrewingStep === 'coffeeBean') return false

        // 如果在方案步骤但没有咖啡豆，也是第一步，不显示返回按钮
        if (activeBrewingStep === 'method' && !hasCoffeeBeans) return false

        // 其他步骤检查是否有上一步
        return NAVIGABLE_STEPS[activeBrewingStep] !== null
    }, [activeBrewingStep, activeMainTab, hasCoffeeBeans])

    return { canGoBack }
}

const NavigationBar: React.FC<NavigationBarProps> = ({
    activeMainTab, setActiveMainTab, activeBrewingStep,
    parameterInfo, setParameterInfo, editableParams, setEditableParams,
    isTimerRunning, showComplete, selectedEquipment, selectedMethod,
    handleParamChange, setShowHistory, onTitleDoubleClick,
    settings, hasCoffeeBeans, alternativeHeader, showAlternativeHeader = false,
    currentBeanView, showViewDropdown, onToggleViewDropdown,
    handleExtractionTimeChange, customEquipments = [], onEquipmentSelect,
    onAddEquipment, onEditEquipment, onDeleteEquipment, onShareEquipment, onBackClick,
}) => {

    const { canGoBack } = useNavigation(activeBrewingStep, activeMainTab, hasCoffeeBeans)
    
    // 抽屉管理状态
    const [isManagementDrawerOpen, setIsManagementDrawerOpen] = useState(false)

    // 处理抽屉开关
    const handleToggleManagementDrawer = () => {
        setIsManagementDrawerOpen(!isManagementDrawerOpen)
    }

    // 处理器具排序
    const handleReorderEquipments = async (newOrder: CustomEquipment[]) => {
        try {
            // 动态导入排序管理函数
            const { saveEquipmentOrder, loadEquipmentOrder } = await import('@/lib/managers/customEquipments')
            const { equipmentUtils } = await import('@/lib/equipment/equipmentUtils')
            
            // 获取当前完整的器具列表（保持现有顺序，只更新自定义器具部分）
            const currentOrder = await loadEquipmentOrder()
            const allCurrentEquipments = equipmentUtils.getAllEquipments(customEquipments, currentOrder)
            
            // 更新自定义器具的位置，保持系统器具的位置不变
            const updatedEquipments = allCurrentEquipments.map(eq => {
                if (!eq.isCustom) return eq; // 系统器具位置不变
                const reorderedCustomEq = newOrder.find(newEq => newEq.id === eq.id);
                return reorderedCustomEq ? { ...reorderedCustomEq, isCustom: true } : eq;
            });
            
            // 生成新的排序数据
            const newEquipmentOrder = equipmentUtils.generateEquipmentOrder(updatedEquipments)
            
            // 保存排序
            await saveEquipmentOrder(newEquipmentOrder)
        } catch (error) {
            console.error('保存器具排序失败:', error)
        }
    }

    // 获取当前视图的显示名称
    const getCurrentViewLabel = () => {
        if (!currentBeanView) return '咖啡豆'
        return VIEW_LABELS[currentBeanView]
    }

    // 处理咖啡豆按钮点击
    const handleBeanTabClick = () => {
        if (activeMainTab === '咖啡豆') {
            // 如果已经在咖啡豆页面，切换下拉菜单显示状态
            onToggleViewDropdown?.()
        } else {
            // 如果不在咖啡豆页面，先切换到咖啡豆页面
            handleMainTabClick('咖啡豆')
        }
    }

    const handleTitleClick = () => {
        if (settings.hapticFeedback) {
            hapticsUtils.light()
        }

        if (canGoBack() && onBackClick) {
            // 检查是否有历史栈记录，如果有就触发浏览器返回
            if (window.history.state?.brewingStep) {
                window.history.back()
            } else {
                // 没有历史栈记录，直接调用返回函数
                onBackClick()
            }
        } else {
            onTitleDoubleClick()
        }
    }



    useEffect(() => {
        const handleStepChanged = async (detail: { step: BrewingStep }) => {
            const methodForUpdate = selectedMethod ? {
                name: selectedMethod.name,
                params: {
                    ...selectedMethod.params,
                    videoUrl: ''
                }
            } : null

            try {
                const { loadCustomEquipments } = await import('@/lib/managers/customEquipments')
                const customEquipments = await loadCustomEquipments()
                updateParameterInfo(detail.step, selectedEquipment, methodForUpdate, equipmentList, customEquipments)
            } catch (error) {
                console.error('加载自定义设备失败:', error)
                updateParameterInfo(detail.step, selectedEquipment, methodForUpdate, equipmentList)
            }
        }

        return listenToEvent(BREWING_EVENTS.STEP_CHANGED, handleStepChanged)
    }, [selectedEquipment, selectedMethod])

    useEffect(() => {
        const handleParameterInfoUpdate = (detail: ParameterInfo) => {
            setParameterInfo(detail)
        }

        return listenToEvent(BREWING_EVENTS.PARAMS_UPDATED, handleParameterInfoUpdate)
    }, [setParameterInfo])

    const shouldHideHeader = activeBrewingStep === 'brewing' && isTimerRunning && !showComplete

    const handleMainTabClick = (tab: MainTabType) => {
        if (activeMainTab === tab) return

        if (settings.hapticFeedback) {
            hapticsUtils.light()
        }

        // 保存主标签页选择到缓存
        saveMainTabPreference(tab)

        setActiveMainTab(tab)
        if (tab === '笔记') {
            setShowHistory(true)
        } else if (activeMainTab === '笔记') {
            setShowHistory(false)
        }
    }

    const shouldShowContent = activeMainTab === '冲煮' && (!isTimerRunning || showComplete || activeBrewingStep === 'notes')
    const shouldShowParams = parameterInfo.method

    const _handleTimeChange = (value: string) => {
        if (handleExtractionTimeChange && selectedMethod) {
            const time = parseInt(value, 10) || 0
            handleExtractionTimeChange(time)
        }
    }

    // 获取器具名称
    const getSelectedEquipmentName = () => {
        if (!selectedEquipment) return null
        return getEquipmentName(selectedEquipment, equipmentList, customEquipments)
    }

    return (
        <motion.div
            className={`sticky top-0 z-20 pt-safe-top border-b transition-colors duration-300 ease-in-out ${
                activeBrewingStep === 'brewing' || activeBrewingStep === 'notes'
                    ? 'border-transparent' 
                    : 'border-neutral-200 dark:border-neutral-800'
            }`}
            transition={{ duration: 0.3, ease: "easeInOut" }}
        >

            {/* 修改：创建一个固定高度的容器，用于包含默认头部和替代头部 */}
            <div className="relative min-h-[30px] w-full">
                {/* 修改：将AnimatePresence用于透明度变化而非高度变化 */}
                <AnimatePresence mode="wait">
                    {showAlternativeHeader ? (
                        // 替代头部 - 使用绝对定位
                        <motion.div
                            key="alternative-header"
                            className="absolute top-0 left-0 right-0 w-full px-6"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                        >
                            {alternativeHeader}
                        </motion.div>
                    ) : (
                        // 默认头部 - 使用绝对定位
                        <motion.div
                            key="default-header"
                            className="absolute top-0 left-0 right-0 w-full px-6"
                            initial={{ opacity: shouldHideHeader ? 0 : 1 }}
                            animate={{ opacity: shouldHideHeader ? 0 : 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            style={{ pointerEvents: shouldHideHeader ? 'none' : 'auto' }}
                        >
                            <div className="flex items-start justify-between">
                                {/* 设置入口按钮图标 */}
                                <div
                                    onClick={handleTitleClick}
                                    className="cursor-pointer text-[12px] tracking-widest text-neutral-500 dark:text-neutral-400 flex items-center"
                                >
                                    {canGoBack() && onBackClick ? (
                                        <ArrowLeft className="w-4 h-4 mr-1" />
                                    ) : (
                                        <Equal className="w-4 h-4" />
                                    )}
                                    {!(canGoBack() && onBackClick) && <span></span>}
                                </div>

                                {/* 主导航按钮 - 保持固定高度避免抖动 */}
                                <div className="flex items-center space-x-6">
                                    <div
                                        style={{
                                            opacity: !(canGoBack() && onBackClick) ? 1 : 0,
                                            pointerEvents: !(canGoBack() && onBackClick) ? 'auto' : 'none'
                                        }}
                                    >
                                        <TabButton
                                            tab="冲煮"
                                            isActive={activeMainTab === '冲煮'}
                                            onClick={() => handleMainTabClick('冲煮')}
                                            dataTab="冲煮"
                                        />
                                    </div>
                                    <div
                                        style={{
                                            opacity: !(canGoBack() && onBackClick) ? 1 : 0,
                                            pointerEvents: !(canGoBack() && onBackClick) ? 'auto' : 'none'
                                        }}
                                        className="relative"
                                    >
                                        {/* 咖啡豆按钮 - 带下拉菜单 */}
                                        <div
                                            ref={(el) => {
                                                // 将按钮引用传递给父组件
                                                if (el && typeof window !== 'undefined') {
                                                    (window as Window & { beanButtonRef?: HTMLDivElement }).beanButtonRef = el;
                                                }
                                            }}
                                            onClick={handleBeanTabClick}
                                            className="text-xs font-medium tracking-widest whitespace-nowrap pb-3 cursor-pointer flex items-center transition-opacity duration-100"
                                            style={{
                                                opacity: showViewDropdown && activeMainTab === '咖啡豆' ? 0 : 1,
                                                pointerEvents: showViewDropdown && activeMainTab === '咖啡豆' ? 'none' : 'auto',
                                                visibility: showViewDropdown && activeMainTab === '咖啡豆' ? 'hidden' : 'visible'
                                            }}
                                            data-view-selector
                                        >
                                            <span className={`relative inline-block ${
                                                activeMainTab === '咖啡豆'
                                                    ? 'text-neutral-800 dark:text-neutral-100'
                                                    : 'text-neutral-500 dark:text-neutral-400'
                                            }`}>
                                                {getCurrentViewLabel()}
                                            </span>

                                            {/* 下拉图标容器 - 使用动画宽度避免布局抖动 */}
                                            <motion.div
                                                className="flex items-center justify-center overflow-hidden"
                                                initial={false}
                                                animate={{
                                                    width: activeMainTab === '咖啡豆' ? '12px' : '0px',
                                                    marginLeft: activeMainTab === '咖啡豆' ? '4px' : '0px',
                                                    transition: {
                                                        duration: 0.35,
                                                        ease: [0.25, 0.46, 0.45, 0.94], // Apple的标准缓动
                                                    }
                                                }}
                                            >
                                                <AnimatePresence mode="wait">
                                                    {activeMainTab === '咖啡豆' && (
                                                        <motion.div
                                                            key="chevron-icon"
                                                            initial={{
                                                                opacity: 0,
                                                                scale: 0.8
                                                            }}
                                                            animate={{
                                                                opacity: 1,
                                                                scale: 1,
                                                                transition: {
                                                                    duration: 0.35,
                                                                    ease: [0.25, 0.46, 0.45, 0.94], // Apple的标准缓动
                                                                    opacity: { duration: 0.25, delay: 0.1 }, // 稍微延迟透明度动画
                                                                    scale: { duration: 0.35 }
                                                                }
                                                            }}
                                                            exit={{
                                                                opacity: 0,
                                                                scale: 0.8,
                                                                transition: {
                                                                    duration: 0.15,
                                                                    ease: [0.4, 0.0, 1, 1], // Apple的退出缓动
                                                                    opacity: { duration: 0.15 },
                                                                    scale: { duration: 0.15 }
                                                                }
                                                            }}
                                                            className="flex items-center justify-center w-3 h-3 shrink-0"
                                                        >
                                                            <ChevronsUpDown
                                                                size={12}
                                                                className="text-neutral-400 dark:text-neutral-600"
                                                                color="currentColor"
                                                            />
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </motion.div>
                                        </div>


                                    </div>
                                    <div
                                        style={{
                                            opacity: !(canGoBack() && onBackClick) ? 1 : 0,
                                            pointerEvents: !(canGoBack() && onBackClick) ? 'auto' : 'none'
                                        }}
                                    >
                                        <TabButton
                                            tab="笔记"
                                            isActive={activeMainTab === '笔记'}
                                            onClick={() => handleMainTabClick('笔记')}
                                            dataTab="笔记"
                                        />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 仅当不显示替代头部内容时才显示参数栏和步骤指示器 */}
            {!showAlternativeHeader && (
                <AnimatePresence mode="wait">
                    {shouldShowContent && (
                        <motion.div
                            key="content-container"
                            className="overflow-hidden"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{
                                duration: 0.25,
                                ease: "easeOut",
                                opacity: { duration: 0.15 }
                            }}
                        >
                            {/* 参数栏 - 添加高度动画 */}
                            <AnimatePresence mode="wait">
                                {shouldShowParams && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{
                                            duration: 0.3,
                                            ease: [0.4, 0, 0.2, 1],
                                            opacity: { duration: 0.2 }
                                        }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-6 py-2 mt-2 bg-neutral-100 dark:bg-neutral-800 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                            <div className="flex items-center justify-between gap-3">
                                                {/* 左侧：方案名称区域 - 使用省略号 */}
                                                <div className="flex items-center min-w-0 flex-1 overflow-hidden">
                                                    {parameterInfo.method && (
                                                        <span className="truncate">
                                                            {getSelectedEquipmentName() && (
                                                                <span>{getSelectedEquipmentName()}<span className="mx-1">·</span></span>
                                                            )}
                                                            {parameterInfo.method}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* 右侧：参数区域 - 固定不压缩 */}
                                                {parameterInfo.params && (
                                                    <div className="flex items-center flex-shrink-0">
                                                        {editableParams ? (
                                                            <div className="flex items-center space-x-1 sm:space-x-2">
                                                                <EditableParameter
                                                                    value={editableParams.coffee.replace('g', '')}
                                                                    onChange={(v) => handleParamChange('coffee', v)}
                                                                    unit="g"
                                                                />
                                                                <span className="shrink-0">·</span>
                                                                <EditableParameter
                                                                    value={editableParams.ratio.replace('1:', '')}
                                                                    onChange={(v) => handleParamChange('ratio', v)}
                                                                    unit=""
                                                                    prefix="1:"
                                                                />
                                                                {parameterInfo.params?.grindSize && (
                                                                    <>
                                                                        <span className="shrink-0">·</span>
                                                                        <EditableParameter
                                                                            value={formatGrindSize(editableParams.grindSize, settings.grindType, settings.customGrinders as Record<string, unknown>[] | undefined)}
                                                                            onChange={(v) => handleParamChange('grindSize', v)}
                                                                            unit=""
                                                                        />
                                                                    </>
                                                                )}
                                                                {parameterInfo.params?.temp && (
                                                                    <>
                                                                        <span className="shrink-0">·</span>
                                                                        <EditableParameter
                                                                            value={editableParams.temp.replace('°C', '')}
                                                                            onChange={(v) => handleParamChange('temp', v)}
                                                                            unit="°C"
                                                                        />
                                                                    </>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="cursor-pointer flex items-center space-x-1 sm:space-x-2 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                                                                onClick={() => {
                                                                    if (selectedMethod && !isTimerRunning) {
                                                                        setEditableParams({
                                                                            coffee: selectedMethod.params.coffee,
                                                                            water: selectedMethod.params.water,
                                                                            ratio: selectedMethod.params.ratio,
                                                                            grindSize: selectedMethod.params.grindSize,
                                                                            temp: selectedMethod.params.temp,
                                                                        })
                                                                    }
                                                                }}
                                                            >
                                                                <span className="whitespace-nowrap">{parameterInfo.params.coffee}</span>
                                                                <span className="shrink-0">·</span>
                                                                <span className="whitespace-nowrap">{parameterInfo.params.ratio}</span>
                                                                <span className="shrink-0">·</span>
                                                                <span className="whitespace-nowrap">
                                                                    {formatGrindSize(parameterInfo.params.grindSize || "", settings.grindType, settings.customGrinders as Record<string, unknown>[] | undefined)}
                                                                </span>
                                                                <span className="shrink-0">·</span>
                                                                <span className="whitespace-nowrap">{parameterInfo.params.temp}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* 器具分类栏 - 只在方案步骤时显示，添加动画效果 */}
                            <AnimatePresence mode="wait">
                                {activeBrewingStep === 'method' && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{
                                            duration: 0.3,
                                            ease: [0.4, 0, 0.2, 1],
                                            opacity: { duration: 0.2 }
                                        }}
                                        className="overflow-hidden mx-6"
                                    >
                                            <EquipmentBar
                                                selectedEquipment={selectedEquipment}
                                                customEquipments={customEquipments}
                                                onEquipmentSelect={onEquipmentSelect || (() => {})}
                                                onToggleManagementDrawer={handleToggleManagementDrawer}
                                                settings={settings}
                                            />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}

            {/* 器具管理抽屉 */}
            <EquipmentManagementDrawer
                isOpen={isManagementDrawerOpen}
                onClose={() => setIsManagementDrawerOpen(false)}
                customEquipments={customEquipments}
                onAddEquipment={onAddEquipment || (() => {})}
                onEditEquipment={onEditEquipment || (() => {})}
                onDeleteEquipment={onDeleteEquipment || (() => {})}
                onShareEquipment={onShareEquipment || (() => {})}
                onReorderEquipments={handleReorderEquipments}
                settings={settings}
            />
        </motion.div>
    );
};

export default NavigationBar;