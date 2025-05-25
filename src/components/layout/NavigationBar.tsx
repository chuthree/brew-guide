'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { equipmentList } from '@/lib/core/config'
import hapticsUtils from '@/lib/ui/haptics'
import { SettingsOptions } from '@/components/settings/Settings'
import { formatGrindSize } from '@/lib/utils/grindUtils'
import { BREWING_EVENTS, ParameterInfo } from '@/lib/brewing/constants'
import { listenToEvent } from '@/lib/brewing/events'
import { updateParameterInfo } from '@/lib/brewing/parameters'
import { useTranslations } from 'next-intl'
import { Equal, ArrowLeft } from 'lucide-react'
import { saveStringState } from '@/lib/core/statePersistence'

// 统一类型定义
type TabType = '方案' | '注水' | '记录'
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
    hideIndicator?: boolean // 添加隐藏指示器的选项
}

const TabButton: React.FC<TabButtonProps> = ({
    tab, isActive, isDisabled = false, onClick, className = '', dataTab, hideIndicator = false
}) => {
    const baseClasses = 'text-[12px] tracking-widest whitespace-nowrap pb-3'
    const stateClasses = isActive
        ? 'text-neutral-800 dark:text-neutral-100'
        : isDisabled
            ? 'text-neutral-300 dark:text-neutral-600'
            : 'cursor-pointer text-neutral-500 dark:text-neutral-400'

    const indicatorClasses = `absolute -bottom-3 left-0 right-0 z-10 h-px bg-neutral-800 dark:bg-neutral-100 ${
        isActive && !hideIndicator ? 'opacity-100 w-full' : 'opacity-0 w-0'
    }`

    return (
        <div
            onClick={!isDisabled && onClick ? onClick : undefined}
            className={`${baseClasses} ${stateClasses} ${className}`}
            data-tab={dataTab}
        >
            <span className="relative inline-block">
                {tab}
                {!hideIndicator && <span className={indicatorClasses} />}
            </span>
        </div>
    )
}

// 自定义Hook：处理触感反馈
const useHapticFeedback = (settings: { hapticFeedback?: boolean }) =>
    useCallback(async () => {
        if (settings?.hapticFeedback) hapticsUtils.light()
    }, [settings?.hapticFeedback])

// 自定义Hook：处理菜单状态
const useCustomMenu = () => {
    const [showCustomMenu, setShowCustomMenu] = useState<string | null>(null)
    const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null)

    const toggleMenu = useCallback((equipmentId: string, e: React.MouseEvent) => {
        e.stopPropagation()

        if (showCustomMenu === equipmentId) {
            setShowCustomMenu(null)
            setMenuPosition(null)
        } else {
            const target = e.currentTarget as HTMLElement
            const rect = target.getBoundingClientRect()
            setMenuPosition({
                top: rect.bottom + 8,
                right: window.innerWidth - rect.right
            })
            setShowCustomMenu(equipmentId)
        }
    }, [showCustomMenu])

    const closeMenu = useCallback(() => {
        setShowCustomMenu(null)
        setMenuPosition(null)
    }, [])

    return { showCustomMenu, menuPosition, toggleMenu, closeMenu }
}

// 器具指示器组件接口
interface EquipmentIndicatorProps {
    selectedEquipment: string | null
    customEquipments: any[]
    onEquipmentSelect: (equipmentId: string) => void
    onAddEquipment: () => void
    onEditEquipment: (equipment: any) => void
    onDeleteEquipment: (equipment: any) => void
    onShareEquipment: (equipment: any) => void
    settings: { hapticFeedback?: boolean }
}

const EquipmentIndicator: React.FC<EquipmentIndicatorProps> = ({
    selectedEquipment, customEquipments, onEquipmentSelect, onAddEquipment,
    onEditEquipment, onDeleteEquipment, onShareEquipment, settings
}) => {
    const triggerHaptic = useHapticFeedback(settings)
    const { showCustomMenu, menuPosition, toggleMenu, closeMenu } = useCustomMenu()
    const scrollContainerRef = React.useRef<HTMLDivElement>(null)
    const [showLeftBorder, setShowLeftBorder] = React.useState(false)
    const [showRightBorder, setShowRightBorder] = React.useState(false)

    // 合并所有器具数据
    const allEquipments = [
        ...equipmentList.map((eq: any) => ({ ...eq, isCustom: false })),
        ...customEquipments
    ]

    // 创建处理函数的工厂
    const createHandler = (action: (...args: any[]) => void) => async (...args: any[]) => {
        await triggerHaptic()
        action(...args)
    }

    // 使用工厂函数创建处理器
    const handlers = {
        equipment: createHandler((id: string) => {
            onEquipmentSelect(id);
            // 保存器具选择到缓存
            saveStringState('brewing-equipment', 'selectedEquipment', id);
        }),
        add: createHandler(() => onAddEquipment()),
        menuToggle: async (equipmentId: string, e: React.MouseEvent) => {
            await triggerHaptic()
            toggleMenu(equipmentId, e)
        },
        menuAction: async (action: () => void, e: React.MouseEvent) => {
            e.stopPropagation()
            await triggerHaptic()
            action()
            closeMenu()
        }
    }

    // 点击外部关闭菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement
            if (!target.closest('[data-menu-trigger]') && !target.closest('[data-custom-menu]')) {
                closeMenu()
            }
        }

        if (showCustomMenu) {
            document.addEventListener('click', handleClickOutside)
            return () => document.removeEventListener('click', handleClickOutside)
        }
    }, [showCustomMenu, closeMenu])

    // 滚动到选中项的函数
    const scrollToSelected = React.useCallback(() => {
        if (!scrollContainerRef.current || !selectedEquipment) return

        const selectedElement = scrollContainerRef.current.querySelector(`[data-tab="${selectedEquipment}"]`)
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
    }, [selectedEquipment])

    // 当选中项变化时滚动到选中项
    React.useEffect(() => {
        // 延迟执行以确保DOM已更新
        const timer = setTimeout(scrollToSelected, 100)
        return () => clearTimeout(timer)
    }, [scrollToSelected])

    // 构建所有项目数据
    const allItems = [
        ...allEquipments.map(equipment => ({
            type: 'equipment' as const,
            id: equipment.id,
            name: equipment.name,
            isSelected: selectedEquipment === equipment.id,
            isCustom: equipment.isCustom || false,
            onClick: () => handlers.equipment(equipment.id)
        })),
        {
            type: 'addButton' as const,
            id: 'add',
            name: '添加器具',
            isSelected: false,
            isCustom: false,
            onClick: handlers.add
        }
    ]

    // 监听滚动事件来控制左右边框显示
    React.useEffect(() => {
        const container = scrollContainerRef.current
        if (!container) return

        const handleScroll = () => {
            const scrollLeft = container.scrollLeft
            const scrollWidth = container.scrollWidth
            const clientWidth = container.clientWidth

            // 左边框：当向右滚动时显示
            setShowLeftBorder(scrollLeft > 0)

            // 右边框：当还能继续向右滚动时显示
            const maxScrollLeft = scrollWidth - clientWidth
            const canScrollRight = maxScrollLeft > 0 && scrollLeft < maxScrollLeft - 1
            setShowRightBorder(canScrollRight)
        }

        // 延迟初始检查，确保DOM已完全渲染
        const timer = setTimeout(handleScroll, 100)

        container.addEventListener('scroll', handleScroll)
        window.addEventListener('resize', handleScroll)

        return () => {
            clearTimeout(timer)
            container.removeEventListener('scroll', handleScroll)
            window.removeEventListener('resize', handleScroll)
        }
    }, [allItems.length])

    return (
        <div className="relative w-full overflow-hidden">
            <div
                ref={scrollContainerRef}
                className="flex items-center gap-4 overflow-x-auto mt-2"
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

                {allItems.map((item) => (
                    <div key={item.id} className="flex-shrink-0 flex items-center">
                        {item.type === 'addButton' ? (
                            <div
                                onClick={item.onClick}
                                className="text-[12px] tracking-widest cursor-pointer text-neutral-500 dark:text-neutral-400 flex items-center whitespace-nowrap pb-3"
                            >
                                添加器具
                            </div>
                        ) : (
                            <div className="whitespace-nowrap flex items-center relative">
                                <TabButton
                                    tab={item.name}
                                    isActive={item.isSelected}
                                    onClick={item.onClick}
                                    dataTab={item.id}
                                />

                                {/* {item.isCustom && item.isSelected && (
                                    <span
                                        onClick={(e) => handlers.menuToggle(item.id, e)}
                                        className="ml-2 pb-3 text-[12px] tracking-widest text-neutral-400 dark:text-neutral-500 cursor-pointer"
                                        role="button"
                                        tabIndex={0}
                                        data-menu-trigger
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault()
                                                handlers.menuToggle(item.id, e as any)
                                            }
                                        }}
                                    >
                                        选项
                                    </span>
                                )} */}
                            </div>
                        )}
                    </div>
                ))}

                {/* 左边框指示器 */}
                <div
                    className={`absolute top-0 left-0 w-6 h-full bg-gradient-to-r from-neutral-50/95 dark:from-neutral-900/95 to-transparent pointer-events-none transition-opacity duration-200 ease-out ${
                        showLeftBorder ? 'opacity-100' : 'opacity-0'
                    }`}
                />

                {/* 右边框指示器 */}
                <div
                    className={`absolute top-0 right-0 w-6 h-full bg-gradient-to-l from-neutral-50/95 dark:from-neutral-900/95 to-transparent pointer-events-none transition-opacity duration-200 ease-out ${
                        showRightBorder ? 'opacity-100' : 'opacity-0'
                    }`}
                />
            </div>

            {/* 自定义器具菜单 - 简洁文字风格 */}
            <AnimatePresence>
                {showCustomMenu && menuPosition && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="fixed z-50 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded shadow-sm"
                        style={{
                            top: menuPosition.top,
                            right: menuPosition.right,
                            minWidth: '80px'
                        }}
                        data-custom-menu
                    >
                        <div className="py-1">
                            <button
                                onClick={(e) => {
                                    const equipment = customEquipments.find(eq => eq.id === showCustomMenu);
                                    if (equipment) handlers.menuAction(() => onEditEquipment(equipment), e);
                                }}
                                className="w-full px-3 py-1.5 text-left text-[12px] tracking-widest text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                            >
                                编辑
                            </button>
                            <button
                                onClick={(e) => {
                                    const equipment = customEquipments.find(eq => eq.id === showCustomMenu);
                                    if (equipment) handlers.menuAction(() => onShareEquipment(equipment), e);
                                }}
                                className="w-full px-3 py-1.5 text-left text-[12px] tracking-widest text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                            >
                                分享
                            </button>
                            <div className="h-px bg-neutral-200 dark:bg-neutral-700 mx-2 my-1" />
                            <button
                                onClick={(e) => {
                                    const equipment = customEquipments.find(eq => eq.id === showCustomMenu);
                                    if (equipment) handlers.menuAction(() => onDeleteEquipment(equipment), e);
                                }}
                                className="w-full px-3 py-1.5 text-left text-[12px] tracking-widest text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                删除
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};



// 优化的EditableParameter组件 - 使用更简洁的逻辑和hooks
interface EditableParameterProps {
    value: string
    onChange: (value: string) => void
    unit: string
    className?: string
    prefix?: string
    isGrindSize?: boolean
    originalGrindSize?: string
}

const EditableParameter: React.FC<EditableParameterProps> = ({
    value, onChange, unit, className = '', prefix = '',
    isGrindSize = false, originalGrindSize = ''
}) => {
    const [isEditing, setIsEditing] = useState(false)
    const inputRef = React.useRef<HTMLInputElement>(null)

    // 计算编辑值 - 使用更简洁的逻辑
    const editValue = isGrindSize && originalGrindSize ? originalGrindSize : value
    const [tempValue, setTempValue] = useState(editValue)

    // 自动聚焦和选择文本
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])

    // 同步编辑值
    useEffect(() => {
        setTempValue(editValue)
    }, [editValue])

    // 处理提交和取消的统一逻辑
    const handleSubmit = useCallback(() => {
        setIsEditing(false)
        if (tempValue !== editValue) onChange(tempValue)
    }, [tempValue, editValue, onChange])

    const handleCancel = useCallback(() => {
        setTempValue(editValue)
        setIsEditing(false)
    }, [editValue])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSubmit()
        else if (e.key === 'Escape') handleCancel()
    }, [handleSubmit, handleCancel])

    return (
        <span
            className={`group relative inline-flex items-center ${className} cursor-pointer min-w-0`}
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
                    className="w-full border-b border-neutral-300 bg-transparent text-center text-[10px] outline-hidden px-0.5"
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
    setActiveBrewingStep: (step: BrewingStep) => void;
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
    setActiveTab: (tab: TabType) => void;
    onTitleDoubleClick: () => void; // 添加双击标题的回调函数
    settings: SettingsOptions; // 添加settings属性
    // 添加咖啡豆相关字段
    selectedCoffeeBean: string | null;
    hasCoffeeBeans?: boolean; // 添加是否有咖啡豆的属性
    navigateToStep?: (step: BrewingStep, options?: {
        resetParams?: boolean,
        preserveMethod?: boolean,
        preserveEquipment?: boolean,
        preserveCoffeeBean?: boolean,
        force?: boolean
    }) => void; // 添加统一的步骤导航函数
    onStepClick?: (step: BrewingStep) => void; // 添加步骤点击回调
    // 添加替代头部内容支持
    alternativeHeader?: React.ReactNode; // 替代的头部内容
    showAlternativeHeader?: boolean; // 是否显示替代头部内容
    // 添加萃取时间变更处理函数
    handleExtractionTimeChange?: (time: number) => void;
    // 添加器具相关props
    customEquipments?: any[];
    onEquipmentSelect?: (equipmentId: string) => void;
    onAddEquipment?: () => void;
    onEditEquipment?: (equipment: any) => void;
    onDeleteEquipment?: (equipment: any) => void;
    onShareEquipment?: (equipment: any) => void;
    // 添加返回按钮相关props
    onBackClick?: () => void;
}

// 意式咖啡相关工具函数 - 优化为更简洁的实现
const espressoUtils = {
    isEspresso: (method: any) =>
        method?.params?.stages?.some((stage: any) =>
            ['extraction', 'beverage'].includes(stage.pourType)) || false,

    getExtractionTime: (method: any) =>
        method?.params?.stages?.find((stage: any) => stage.pourType === 'extraction')?.time || 0,

    formatTime: (seconds: number) => `${seconds}`
}

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

        if (activeBrewingStep === 'method' && !hasCoffeeBeans) return false
        return NAVIGABLE_STEPS[activeBrewingStep] !== null
    }, [activeBrewingStep, activeMainTab, hasCoffeeBeans])

    return { canGoBack }
}

const NavigationBar: React.FC<NavigationBarProps> = ({
    activeMainTab, setActiveMainTab, activeBrewingStep, setActiveBrewingStep,
    parameterInfo, setParameterInfo, editableParams, setEditableParams,
    isTimerRunning, showComplete, selectedEquipment, selectedMethod,
    handleParamChange, setShowHistory, setActiveTab, onTitleDoubleClick,
    settings, hasCoffeeBeans, alternativeHeader, showAlternativeHeader = false,
    handleExtractionTimeChange, customEquipments = [], onEquipmentSelect,
    onAddEquipment, onEditEquipment, onDeleteEquipment, onShareEquipment, onBackClick,
}) => {
    const t = useTranslations('nav')
    const { canGoBack } = useNavigation(activeBrewingStep, activeMainTab, hasCoffeeBeans)



    const handleTitleClick = () => {
        if (settings.hapticFeedback) {
            hapticsUtils.light()
        }

        if (canGoBack() && onBackClick) {
            onBackClick()
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

        setActiveMainTab(tab)
        if (tab === '笔记') {
            setShowHistory(true)
        } else if (activeMainTab === '笔记') {
            setShowHistory(false)
        }
    }

    const shouldShowContent = activeMainTab === '冲煮' && (!isTimerRunning || showComplete)
    const shouldShowParams = parameterInfo.method

    const handleTimeChange = (value: string) => {
        if (handleExtractionTimeChange && selectedMethod) {
            const time = parseInt(value, 10) || 0
            handleExtractionTimeChange(time)
        }
    }

    return (
        <motion.div
            className="sticky top-0 z-20 pt-safe-top bg-neutral-50/95 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800"
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
                                <div
                                    onClick={handleTitleClick}
                                    className="cursor-pointer text-[12px] tracking-widest text-neutral-500 dark:text-neutral-400 flex items-center"
                                >
                                    {canGoBack() && onBackClick ? (
                                        <ArrowLeft className="w-4 h-4 mr-1" />
                                    ) : (
                                        <Equal className="w-4 h-4 mr-1" />
                                    )}
                                    {!(canGoBack() && onBackClick) && <span>{t('title')}</span>}
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
                                            tab={t('main.brewing')}
                                            isActive={activeMainTab === '冲煮'}
                                            onClick={() => handleMainTabClick('冲煮')}
                                            dataTab="冲煮"
                                            hideIndicator={activeMainTab === '冲煮' && activeBrewingStep === 'method'}
                                        />
                                    </div>
                                    <div
                                        style={{
                                            opacity: !(canGoBack() && onBackClick) ? 1 : 0,
                                            pointerEvents: !(canGoBack() && onBackClick) ? 'auto' : 'none'
                                        }}
                                    >
                                        <TabButton
                                            tab={t('main.beans')}
                                            isActive={activeMainTab === '咖啡豆'}
                                            onClick={() => handleMainTabClick('咖啡豆')}
                                            dataTab="咖啡豆"
                                            hideIndicator={false}
                                        />
                                    </div>
                                    <div
                                        style={{
                                            opacity: !(canGoBack() && onBackClick) ? 1 : 0,
                                            pointerEvents: !(canGoBack() && onBackClick) ? 'auto' : 'none'
                                        }}
                                    >
                                        <TabButton
                                            tab={t('main.notes')}
                                            isActive={activeMainTab === '笔记'}
                                            onClick={() => handleMainTabClick('笔记')}
                                            dataTab="笔记"
                                            hideIndicator={false}
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
                                        <div className="px-6 py-2 mt-2 bg-neutral-100 dark:bg-neutral-800 text-[10px] text-neutral-500 dark:text-neutral-400 relative">
                                            <div className="flex items-center min-w-0 overflow-x-auto no-scrollbar max-w-full">
                                                {parameterInfo.method && (
                                                    <span
                                                        className="cursor-pointer whitespace-nowrap"
                                                        onClick={() => {
                                                            setActiveBrewingStep('method');
                                                            setActiveTab('方案');
                                                        }}
                                                    >
                                                        {parameterInfo.method}
                                                    </span>
                                                )}
                                            </div>

                                            {parameterInfo.params && (
                                                <div className="absolute top-2 right-6 min-w-0 max-w-full text-right z-10">
                                                    {editableParams ? (
                                                        <div className="flex items-center justify-end bg-neutral-100 dark:bg-neutral-800 space-x-1 sm:space-x-2 overflow-x-auto pl-3">
                                                            <EditableParameter
                                                                value={editableParams.coffee.replace('g', '')}
                                                                onChange={(v) => handleParamChange('coffee', v)}
                                                                unit="g"
                                                                className="border-b border-dashed border-neutral-200 dark:border-neutral-700"
                                                            />

                                                            {!espressoUtils.isEspresso(selectedMethod) && (
                                                                <>
                                                                    <span className="shrink-0">·</span>
                                                                    <EditableParameter
                                                                        value={editableParams.ratio.replace('1:', '')}
                                                                        onChange={(v) => handleParamChange('ratio', v)}
                                                                        unit=""
                                                                        prefix="1:"
                                                                        className="border-b border-dashed border-neutral-200 dark:border-neutral-700"
                                                                    />
                                                                </>
                                                            )}

                                                            {parameterInfo.params?.grindSize && (
                                                                <>
                                                                    <span className="shrink-0">·</span>
                                                                    <EditableParameter
                                                                        value={formatGrindSize(editableParams.grindSize, settings.grindType)}
                                                                        onChange={(v) => handleParamChange('grindSize', v)}
                                                                        unit=""
                                                                        className="border-b border-dashed border-neutral-200 dark:border-neutral-700"
                                                                        isGrindSize={true}
                                                                        originalGrindSize={editableParams.grindSize}
                                                                    />
                                                                </>
                                                            )}

                                                            {espressoUtils.isEspresso(selectedMethod) ? (
                                                                <>
                                                                    <span className="shrink-0">·</span>
                                                                    <EditableParameter
                                                                        value={espressoUtils.formatTime(espressoUtils.getExtractionTime(selectedMethod))}
                                                                        onChange={(v) => handleTimeChange(v)}
                                                                        unit="秒"
                                                                        className="border-b border-dashed border-neutral-200 dark:border-neutral-700"
                                                                    />
                                                                    <span className="shrink-0">·</span>
                                                                    <EditableParameter
                                                                        value={editableParams.water.replace('g', '')}
                                                                        onChange={(v) => handleParamChange('water', v)}
                                                                        unit="g"
                                                                        className="border-b border-dashed border-neutral-200 dark:border-neutral-700"
                                                                    />
                                                                </>
                                                            ) : (
                                                                parameterInfo.params?.temp && (
                                                                    <>
                                                                        <span className="shrink-0">·</span>
                                                                        <EditableParameter
                                                                            value={editableParams.temp.replace('°C', '')}
                                                                            onChange={(v) => handleParamChange('temp', v)}
                                                                            unit="°C"
                                                                            className="border-b border-dashed border-neutral-200 dark:border-neutral-700"
                                                                        />
                                                                    </>
                                                                )
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span
                                                            className="cursor-pointer flex items-center justify-end space-x-1 sm:space-x-2 overflow-x-auto pl-6"
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
                                                            {espressoUtils.isEspresso(selectedMethod) ? (
                                                                <>
                                                                    <span className="whitespace-nowrap">
                                                                        {formatGrindSize(parameterInfo.params.grindSize || "", settings.grindType)}
                                                                    </span>
                                                                    <span className="shrink-0">·</span>
                                                                    <span className="truncate max-w-[30px] sm:max-w-[40px]">{parameterInfo.params.coffee}</span>
                                                                    <span className="shrink-0">·</span>
                                                                    <span className="whitespace-nowrap">
                                                                        {espressoUtils.formatTime(espressoUtils.getExtractionTime(selectedMethod))}秒
                                                                    </span>
                                                                    <span className="shrink-0">·</span>
                                                                    <span className="whitespace-nowrap">{parameterInfo.params.water}</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span className="truncate max-w-[30px] sm:max-w-[40px]">{parameterInfo.params.coffee}</span>
                                                                    <span className="shrink-0">·</span>
                                                                    <span className="whitespace-nowrap">{parameterInfo.params.ratio}</span>
                                                                    <span className="shrink-0">·</span>
                                                                    <span className="whitespace-nowrap">
                                                                        {formatGrindSize(parameterInfo.params.grindSize || "", settings.grindType)}
                                                                    </span>
                                                                    <span className="shrink-0">·</span>
                                                                    <span className="whitespace-nowrap">{parameterInfo.params.temp}</span>
                                                                </>
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
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
                                            <EquipmentIndicator
                                                selectedEquipment={selectedEquipment}
                                                customEquipments={customEquipments}
                                                onEquipmentSelect={onEquipmentSelect || (() => {})}
                                                onAddEquipment={onAddEquipment || (() => {})}
                                                onEditEquipment={onEditEquipment || (() => {})}
                                                onDeleteEquipment={onDeleteEquipment || (() => {})}
                                                onShareEquipment={onShareEquipment || (() => {})}
                                                settings={settings}
                                            />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </motion.div>
    );
};

export default NavigationBar;