'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { equipmentList, Method } from '@/lib/core/config'
import hapticsUtils from '@/lib/ui/haptics'
import { SettingsOptions } from '@/components/settings/Settings'
import { formatGrindSize } from '@/lib/utils/grindUtils'
import { BREWING_EVENTS } from '@/lib/brewing/constants'
import { listenToEvent } from '@/lib/brewing/events'
import { updateParameterInfo } from '@/lib/brewing/parameters'
import { useTranslations } from 'next-intl'
import { Equal, ChevronLeft } from 'lucide-react'

// 定义一个隐藏滚动条的样式
const noScrollbarStyle = `
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;

// 定义标签类型
type TabType = '方案' | '注水' | '记录';

// 添加新的主导航类型
type MainTabType = '冲煮' | '咖啡豆' | '笔记';
// 修改冲煮步骤类型
type BrewingStep = 'coffeeBean' | 'method' | 'brewing' | 'notes';
// Add new interface for parameter display
interface ParameterInfo {
    equipment: string | null
    method: string | null
    params: {
        coffee?: string | null
        water?: string | null
        ratio?: string | null
        grindSize?: string | null
        temp?: string | null
    } | null
}

// Add new interfaces for parameter editing
interface EditableParams {
    coffee: string
    water: string
    ratio: string
    grindSize: string
    temp: string
}

// Add TabButton component
const TabButton = ({
    tab,
    isActive,
    isDisabled,
    isCompleted,
    onClick,
    hasSecondaryLine,
    className = '',
    dataTab,
}: {
    tab: string
    isActive: boolean
    isDisabled?: boolean
    isCompleted?: boolean
    onClick?: () => void
    hasSecondaryLine?: boolean
    className?: string
    dataTab?: string
}) => {
    // 处理点击事件
    const handleClick = () => {
        if (!isDisabled && onClick) {
            onClick();
        }
    };

    return (
        <div
            onClick={!isDisabled ? handleClick : undefined}
            className={`text-[12px] tracking-widest whitespace-nowrap pb-3  ${className} ${isActive
                ? 'text-neutral-800 dark:text-neutral-100'
                : isCompleted
                    ? 'cursor-pointer text-neutral-600 dark:text-neutral-400'
                    : isDisabled
                        ? 'text-neutral-300 dark:text-neutral-600'
                        : 'cursor-pointer text-neutral-500 dark:text-neutral-400'
                }`}
            data-tab={dataTab}
        >
            <span className="relative inline-block">
                {tab}
                <span
                    className={`absolute -bottom-1.5 left-0 right-0 h-px ${hasSecondaryLine
                        ? 'bg-neutral-200 dark:bg-neutral-700 opacity-100'
                        : 'bg-neutral-200 dark:bg-neutral-700 opacity-0'
                        }`}
                />
                <span
                    className={`absolute -bottom-3 left-0 right-0 z-10 h-px bg-neutral-800 dark:bg-neutral-100 ${isActive ? 'opacity-100 w-full' : 'opacity-0 w-0'
                        }`}
                />
            </span>
        </div>
    )
}

// 添加器具指示器组件
const EquipmentIndicator = ({
    selectedEquipment,
    customEquipments,
    onEquipmentSelect,
    onAddEquipment,
    onEditEquipment,
    onDeleteEquipment,
    onShareEquipment,
    settings
}: {
    selectedEquipment: string | null
    customEquipments: any[]
    onEquipmentSelect: (equipmentId: string) => void
    onAddEquipment: () => void
    onEditEquipment: (equipment: any) => void
    onDeleteEquipment: (equipment: any) => void
    onShareEquipment: (equipment: any) => void
    settings: { hapticFeedback?: boolean }
}) => {
    // 添加状态管理
    const [showCustomMenu, setShowCustomMenu] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

    // 获取器具列表
    const allEquipments = [
        ...equipmentList.map((eq: any) => ({ ...eq, isCustom: false })),
        ...customEquipments
    ];

    // 触感反馈
    const triggerHapticFeedback = async () => {
        if (settings?.hapticFeedback) {
            const hapticsUtils = (await import('@/lib/ui/haptics')).default;
            hapticsUtils.light();
        }
    };

    // 处理器具选择
    const handleEquipmentSelect = async (equipmentId: string) => {
        await triggerHapticFeedback();
        onEquipmentSelect(equipmentId);
    };

    // 处理添加器具
    const handleAddEquipment = async () => {
        await triggerHapticFeedback();
        onAddEquipment();
    };



    // 处理自定义器具菜单
    const handleCustomMenuToggle = async (equipmentId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        await triggerHapticFeedback();

        if (showCustomMenu === equipmentId) {
            setShowCustomMenu(null);
            setMenuPosition(null);
        } else {
            // 计算菜单位置 - 使用视口坐标
            const target = e.currentTarget as HTMLElement;

            if (target) {
                const rect = target.getBoundingClientRect();

                // 使用视口坐标，确保菜单显示在正确位置
                const position = {
                    top: rect.bottom + 8, // 在按钮下方8px
                    right: window.innerWidth - rect.right // 右对齐
                };

                console.log('Menu position:', position, 'Equipment ID:', equipmentId);
                setMenuPosition(position);
            }

            setShowCustomMenu(equipmentId);
        }
    };

    // 处理菜单项点击
    const handleMenuAction = async (action: () => void, e: React.MouseEvent) => {
        e.stopPropagation();
        await triggerHapticFeedback();
        action();
        setShowCustomMenu(null);
        setMenuPosition(null);
    };

    // 点击外部关闭菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('[data-menu-trigger]') && !target.closest('[data-custom-menu]')) {
                setShowCustomMenu(null);
                setMenuPosition(null);
            }
        };

        if (showCustomMenu) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [showCustomMenu]);

    // 创建所有项目列表：器具 + 添加按钮
    const allItems: Array<{
        type: string;
        id: string;
        name: string;
        isSelected: boolean;
        isCompleted?: boolean;
        isCustom?: boolean;
        onClick: () => void | Promise<void>;
    }> = [];

    // 添加器具项目
    allEquipments.forEach(equipment => {
        allItems.push({
            type: 'equipment',
            id: equipment.id,
            name: equipment.name,
            isSelected: selectedEquipment === equipment.id,
            isCustom: equipment.isCustom || false,
            onClick: () => handleEquipmentSelect(equipment.id)
        });
    });

    // 添加"添加器具"按钮
    allItems.push({
        type: 'addButton',
        id: 'add',
        name: '添加器具',
        isSelected: false,
        isCustom: false,
        onClick: handleAddEquipment
    });

    return (
        <div className="relative w-full overflow-hidden">
            {/* 横向滚动容器 */}
            <div
                className="flex items-center gap-4 overflow-x-auto scrollbar-hide"
                style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch'
                }}
            >
                <style jsx>{`
                    .scrollbar-hide::-webkit-scrollbar {
                        display: none;
                    }
                `}</style>

                {allItems.map((item) => {
                    return (
                        <React.Fragment key={item.id}>
                            <div className="flex-shrink-0 flex items-center">
                                {item.type === 'addButton' ? (
                                    // 添加器具按钮 - 使用与TabButton相同的样式和边距
                                    <div
                                        onClick={item.onClick}
                                        className="text-[12px] tracking-widest cursor-pointer text-neutral-500 dark:text-neutral-400 flex items-center whitespace-nowrap pb-3"
                                    >
                                        添加器具
                                    </div>
                                ) : (
                                    // 咖啡豆或器具按钮
                                    <div className="whitespace-nowrap flex items-center relative">
                                        <TabButton
                                            tab={item.name}
                                            isActive={item.isSelected}
                                            isCompleted={item.type === 'coffeeBean' ? true : false}
                                            onClick={item.onClick}
                                            dataTab={item.id}
                                        />

                                        {/* 自定义器具操作入口 - 使用文字风格 */}
                                        {item.isCustom && item.isSelected && (
                                            <span
                                                onClick={(e) => handleCustomMenuToggle(item.id, e)}
                                                className="ml-2 pb-3 text-[12px] tracking-widest text-neutral-400 dark:text-neutral-500 cursor-pointer"
                                                role="button"
                                                tabIndex={0}
                                                data-menu-trigger
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        handleCustomMenuToggle(item.id, e as any);
                                                    }
                                                }}
                                            >
                                                选项
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>


                        </React.Fragment>
                    );
                })}

                {/* 右侧渐变遮罩，提示可以滚动 */}
                {allItems.length > 3 && (
                    <div className="absolute top-0 right-0 w-6 h-full bg-gradient-to-l from-neutral-50/95 dark:from-neutral-900/95 to-transparent pointer-events-none" />
                )}
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
                                    if (equipment) handleMenuAction(() => onEditEquipment(equipment), e);
                                }}
                                className="w-full px-3 py-1.5 text-left text-[12px] tracking-widest text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                            >
                                编辑
                            </button>
                            <button
                                onClick={(e) => {
                                    const equipment = customEquipments.find(eq => eq.id === showCustomMenu);
                                    if (equipment) handleMenuAction(() => onShareEquipment(equipment), e);
                                }}
                                className="w-full px-3 py-1.5 text-left text-[12px] tracking-widest text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                            >
                                分享
                            </button>
                            <div className="h-px bg-neutral-200 dark:bg-neutral-700 mx-2 my-1" />
                            <button
                                onClick={(e) => {
                                    const equipment = customEquipments.find(eq => eq.id === showCustomMenu);
                                    if (equipment) handleMenuAction(() => onDeleteEquipment(equipment), e);
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



// 修改EditableParameter组件，添加更好的布局控制
const EditableParameter = ({
    value,
    onChange,
    unit,
    className = '',
    prefix = '',
    isGrindSize = false,  // 标识是否为研磨度参数
    originalGrindSize = '', // 原始研磨度值（未转换的通用研磨度）
}: {
    value: string
    onChange: (value: string) => void
    unit: string
    className?: string
    prefix?: string
    isGrindSize?: boolean
    originalGrindSize?: string
}) => {
    const [isEditing, setIsEditing] = useState(false)
    // 如果是研磨度且提供了原始值，则使用原始值作为编辑初始值
    // 这确保编辑的是通用研磨度值，而不是转换后的特定磨豆机研磨度
    const [tempValue, setTempValue] = useState(isGrindSize && originalGrindSize ? originalGrindSize : value)
    const inputRef = React.useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])

    useEffect(() => {
        // 如果是研磨度且提供了原始值，则使用原始值，否则使用显示值
        // 这确保编辑表单显示的始终是通用研磨度值
        setTempValue(isGrindSize && originalGrindSize ? originalGrindSize : value)
    }, [value, isGrindSize, originalGrindSize])

    const handleBlur = () => {
        setIsEditing(false)
        // 确保编辑研磨度时将原始值与通用研磨度值比较
        if (tempValue !== (isGrindSize && originalGrindSize ? originalGrindSize : value)) {
            onChange(tempValue)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleBlur()
        } else if (e.key === 'Escape') {
            setTempValue(value)
            setIsEditing(false)
        }
    }

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
                    onBlur={handleBlur}
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

// 判断是否是意式咖啡方法
const isEspressoMethod = (method: any): boolean => {
    if (!method?.params?.stages) return false;
    return method.params.stages.some((stage: any) =>
        stage.pourType === 'extraction' ||
        stage.pourType === 'beverage'
    );
};

// 获取意式咖啡的萃取时间（秒）
const getEspressoExtractionTime = (method: any): number => {
    if (!method?.params?.stages) return 0;
    const extractionStage = method.params.stages.find((stage: any) =>
        stage.pourType === 'extraction'
    );
    return extractionStage?.time || 0;
};

// 格式化时间显示，不再添加"秒"字符
const formatExtractionTime = (seconds: number): string => {
    return `${seconds}`;
};

const NavigationBar: React.FC<NavigationBarProps> = ({
    activeMainTab,
    setActiveMainTab,
    activeBrewingStep,
    setActiveBrewingStep,
    parameterInfo,
    setParameterInfo,
    editableParams,
    setEditableParams,
    isTimerRunning,
    showComplete,
    selectedEquipment,
    selectedMethod,
    handleParamChange,
    setShowHistory,
    setActiveTab,
    onTitleDoubleClick, // 接收双击标题的回调函数
    settings, // 接收设置
    selectedCoffeeBean: _selectedCoffeeBean, // 重命名为下划线开头以避免未使用变量警告
    hasCoffeeBeans, // 接收是否有咖啡豆的属性
    navigateToStep: _navigateToStep, // 接收统一的步骤导航函数
    onStepClick: _onStepClick, // 接收步骤点击回调
    alternativeHeader, // 接收替代头部内容
    showAlternativeHeader = false, // 默认不显示替代头部内容
    handleExtractionTimeChange, // 接收萃取时间变更处理函数
    // 接收器具相关props
    customEquipments = [],
    onEquipmentSelect,
    onAddEquipment,
    onEditEquipment,
    onDeleteEquipment,
    onShareEquipment,
    onBackClick,
}) => {
    const t = useTranslations('nav');

    // 定义可导航的步骤映射（与SwipeBackGesture保持一致）
    const NAVIGABLE_STEPS: Record<BrewingStep, BrewingStep | null> = {
        'brewing': 'method', // 从注水步骤返回到方案步骤
        'method': 'coffeeBean', // 从方案步骤返回到咖啡豆步骤
        'coffeeBean': null, // 咖啡豆步骤是第一步，没有返回步骤
        'notes': 'brewing' // 从记录步骤返回到注水步骤
    };

    // 判断当前步骤是否可以返回
    const canGoBack = (): boolean => {
        // 如果当前是方案步骤且没有咖啡豆，则不允许返回到咖啡豆步骤
        if (activeBrewingStep === 'method' && !hasCoffeeBeans) {
            return false;
        }
        return NAVIGABLE_STEPS[activeBrewingStep] !== null;
    };



    // 处理标题点击事件
    const handleTitleClick = () => {
        // 每次点击事件只有成功触发时才执行触感反馈
        if (settings.hapticFeedback) {
            hapticsUtils.light(); // 添加轻触感反馈
        }

        // 如果可以返回且提供了返回回调，则执行返回操作
        if (canGoBack() && onBackClick) {
            onBackClick();
        } else {
            // 否则调用父组件传入的回调函数打开设置
            onTitleDoubleClick();
        }
    };



    // 修复updateParameterInfo处理逻辑
    useEffect(() => {
        // 定义事件处理函数
        const handleStepChanged = async (detail: {
            step: BrewingStep;
            resetParams?: boolean;
            preserveStates?: string[];
            preserveMethod?: boolean;
            preserveEquipment?: boolean;
            preserveCoffeeBean?: boolean;
        }) => {
            // 记录步骤变化

            // 确保更新参数栏，使用统一的标准化函数
            if (selectedMethod) {
                const methodForUpdate: Method = {
                    // id是可选的，可以忽略
                    name: selectedMethod.name,
                    params: {
                        coffee: selectedMethod.params.coffee,
                        water: selectedMethod.params.water,
                        ratio: selectedMethod.params.ratio,
                        grindSize: selectedMethod.params.grindSize,
                        temp: selectedMethod.params.temp,
                        videoUrl: '',  // 添加必需的videoUrl字段
                        stages: selectedMethod.params.stages.map(stage => ({
                            time: stage.time,
                            label: stage.label,
                            water: stage.water,
                            detail: stage.detail
                        }))
                    }
                };

                try {
                    // 加载自定义设备并更新参数栏
                    const { loadCustomEquipments } = await import('@/lib/managers/customEquipments');
                    const customEquipments = await loadCustomEquipments();
                    updateParameterInfo(detail.step, selectedEquipment, methodForUpdate, equipmentList, customEquipments);
                } catch (error) {
                    console.error('加载自定义设备失败:', error);
                    // 出错时使用标准设备列表
                    updateParameterInfo(detail.step, selectedEquipment, methodForUpdate, equipmentList);
                }
            } else {
                try {
                    // 即使没有选择方案，也需要加载自定义设备以正确显示器具名称
                    const { loadCustomEquipments } = await import('@/lib/managers/customEquipments');
                    const customEquipments = await loadCustomEquipments();
                    updateParameterInfo(detail.step, selectedEquipment, null, equipmentList, customEquipments);
                } catch (error) {
                    console.error('加载自定义设备失败:', error);
                    // 出错时使用标准设备列表
                    updateParameterInfo(detail.step, selectedEquipment, null, equipmentList);
                }
            }
        };

        // 添加事件监听
        const cleanup = listenToEvent(BREWING_EVENTS.STEP_CHANGED, handleStepChanged);

        // 移除事件监听
        return cleanup;
    }, [selectedEquipment, selectedMethod]); // 依赖项包括会影响参数栏的状态

    // 添加参数信息更新事件监听
    useEffect(() => {
        // 定义处理函数
        const handleParameterInfoUpdate = (detail: {
            equipment: string | null;
            method: string | null;
            params: {
                coffee?: string | null;
                water?: string | null;
                ratio?: string | null;
                grindSize?: string | null;
                temp?: string | null;
            } | null;
        }) => {

            // 直接更新参数信息
            setParameterInfo(detail);
        };

        // 添加事件监听
        const cleanup = listenToEvent(BREWING_EVENTS.PARAMS_UPDATED, handleParameterInfoUpdate);

        // 移除事件监听
        return cleanup;
    }, [setParameterInfo]); // 添加setParameterInfo作为依赖项

    // 判断是否应该隐藏标题和导航
    const shouldHideHeader = activeBrewingStep === 'brewing' && isTimerRunning && !showComplete;

    // 处理主标签点击
    const handleMainTabClick = (tab: MainTabType) => {
        // 如果已经在选中的标签，不做任何操作
        if (activeMainTab === tab) return;

        if (settings.hapticFeedback) {
            hapticsUtils.light(); // 添加轻触感反馈
        }

        // 使用switch语句确保类型安全
        switch(tab) {
            case '冲煮':
                setActiveMainTab('冲煮');
                // 从笔记切换回冲煮时，确保关闭历史记录显示
                if (activeMainTab === '笔记') {
                    setShowHistory(false);
                }
                break;
            case '咖啡豆':
                setActiveMainTab('咖啡豆');
                break;
            case '笔记':
                setActiveMainTab('笔记');
                setShowHistory(true);
                break;
        }
    };

    // 确定导航栏下方内容的显示状态
    const shouldShowContent = activeMainTab === '冲煮' && (!isTimerRunning || showComplete);

    // 判断是否应该显示参数栏（仅在选择了方案时显示）
    const shouldShowParams = parameterInfo.method;

    // 处理萃取时间变更
    const handleTimeChange = (value: string) => {
        if (handleExtractionTimeChange && selectedMethod) {
            // 将字符串转换为数字
            const time = parseInt(value, 10) || 0;
            handleExtractionTimeChange(time);
        }
    };

    return (
        <motion.div
            className="sticky top-0 z-20 pt-safe-top bg-neutral-50/95 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800"
            transition={{ duration: 0.3, ease: "easeInOut" }}
        >
            <style jsx global>{noScrollbarStyle}</style>

            {/* 修改：创建一个固定高度的容器，用于包含默认头部和替代头部 */}
            <div className="relative min-h-[30px] w-full">
                {/* 修改：将AnimatePresence用于透明度变化而非高度变化 */}
                <AnimatePresence mode="wait">
                    {showAlternativeHeader ? (
                        // 替代头部 - 使用绝对定位
                        <motion.div
                            key="alternative-header"
                            className="absolute top-0 left-0 right-0 w-full px-6 pb-4"
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
                            className="absolute top-0 left-0 right-0 w-full px-6 pb-4"
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
                                        <ChevronLeft className="w-4 h-4 mr-1" />
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
                            <AnimatePresence mode="sync">
                                {shouldShowParams && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{
                                            duration: 0.2,
                                            ease: "easeOut"
                                        }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-6 py-2 bg-neutral-100 dark:bg-neutral-800 text-[10px] text-neutral-500 dark:text-neutral-400 relative">
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
                                                        <div className="flex items-center justify-end bg-neutral-100 dark:bg-neutral-800 space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar pl-3">
                                                            <EditableParameter
                                                                value={editableParams.coffee.replace('g', '')}
                                                                onChange={(v) => handleParamChange('coffee', v)}
                                                                unit="g"
                                                                className="border-b border-dashed border-neutral-200 dark:border-neutral-700"
                                                            />

                                                            {!isEspressoMethod(selectedMethod) && (
                                                                // 普通冲煮模式显示水粉比
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

                                                            {isEspressoMethod(selectedMethod) ? (
                                                                // 意式咖啡模式显示液重和时间
                                                                <>
                                                                    <span className="shrink-0">·</span>
                                                                    <EditableParameter
                                                                        value={formatExtractionTime(getEspressoExtractionTime(selectedMethod))}
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
                                                                // 普通冲煮模式显示水温
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
                                                            className="cursor-pointer flex items-center justify-end space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar bg-linear-to-r from-transparent via-neutral-100/95 to-neutral-100/95 dark:via-neutral-800/95 dark:to-neutral-800/95 pl-6"
                                                            onClick={() => {
                                                                if (selectedMethod && !isTimerRunning) {
                                                                    setEditableParams({
                                                                        coffee: selectedMethod.params.coffee,
                                                                        water: selectedMethod.params.water,
                                                                        ratio: selectedMethod.params.ratio,
                                                                        grindSize: selectedMethod.params.grindSize,
                                                                        temp: selectedMethod.params.temp,
                                                                    });
                                                                }
                                                            }}
                                                        >
                                                            {isEspressoMethod(selectedMethod) ? (
                                                                // 意式咖啡参数显示: 研磨度、粉量、萃取时间、液重
                                                                <>
                                                                    <span className="whitespace-nowrap">
                                                                        {formatGrindSize(parameterInfo.params.grindSize || "", settings.grindType)}
                                                                    </span>
                                                                    <span className="shrink-0">·</span>
                                                                    <span className="truncate max-w-[30px] sm:max-w-[40px]">{parameterInfo.params.coffee}</span>
                                                                    <span className="shrink-0">·</span>
                                                                    <span className="whitespace-nowrap">
                                                                        {formatExtractionTime(getEspressoExtractionTime(selectedMethod))}秒
                                                                    </span>
                                                                    <span className="shrink-0">·</span>
                                                                    <span className="whitespace-nowrap">{parameterInfo.params.water}</span>
                                                                </>
                                                            ) : (
                                                                // 普通冲煮参数显示: 粉量、比例、研磨度、水温
                                                                <>
                                                                    <span className="truncate max-w-[30px] sm:max-w-[40px]">{parameterInfo.params.coffee}</span>
                                                                    <span className="shrink-0">·</span>
                                                                    <span className="whitespace-nowrap">{parameterInfo.params.ratio}</span>
                                                                    <span className="shrink-0">·</span>
                                                                    <span className="whitespace-nowrap">
                                                                        {/* 显示时使用formatGrindSize将通用研磨度转换为特定磨豆机的研磨度 */}
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

                            {/* 器具分类栏 - 只在方案步骤时显示 */}
                            {activeBrewingStep === 'method' && (
                                <div className="mx-6">
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
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </motion.div>
    );
};

export default NavigationBar;