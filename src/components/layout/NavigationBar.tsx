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
import { Equal } from 'lucide-react'

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
type TabType = '器具' | '方案' | '注水' | '记录';

// 添加新的主导航类型
type MainTabType = '冲煮' | '咖啡豆' | '笔记';
// 修改冲煮步骤类型
type BrewingStep = 'coffeeBean' | 'equipment' | 'method' | 'brewing' | 'notes';
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
            className={`text-[12px] tracking-widest ${className} ${isActive
                ? 'text-neutral-800 dark:text-neutral-100'
                : isCompleted
                    ? 'cursor-pointer text-neutral-600 dark:text-neutral-400'
                    : isDisabled
                        ? 'text-neutral-300 dark:text-neutral-600'
                        : 'cursor-pointer text-neutral-500 dark:text-neutral-400'
                }`}
            data-tab={dataTab}
        >
            <span className="relative">
                {tab}
                <span
                    className={`absolute -bottom-1 left-0 right-0 h-px ${hasSecondaryLine
                        ? 'bg-neutral-200 dark:bg-neutral-700 opacity-100'
                        : 'bg-neutral-200 dark:bg-neutral-700 opacity-0'
                        }`}
                />
                <span
                    className={`absolute -bottom-1 left-0 right-0 z-10 h-px bg-neutral-800 dark:bg-neutral-100 ${isActive ? 'opacity-100 w-full' : 'opacity-0 w-0'
                        }`}
                />
            </span>
        </div>
    )
}

// 添加步骤指示器组件
const StepIndicator = ({
    currentStep,
    onStepClick,
    disabledSteps = [],
    hasCoffeeBeans = false
}: {
    currentStep: BrewingStep
    onStepClick?: (step: BrewingStep) => void
    disabledSteps?: BrewingStep[]
    hasCoffeeBeans?: boolean
}) => {
    const t = useTranslations('nav');

    // 根据是否有咖啡豆动态生成步骤数组
    const steps: { label: string; value: BrewingStep }[] = hasCoffeeBeans
        ? [
            { label: t('steps.beans'), value: 'coffeeBean' },
            { label: t('steps.equipment'), value: 'equipment' },
            { label: t('steps.method'), value: 'method' },
            { label: t('steps.pour'), value: 'brewing' },
            { label: t('steps.record'), value: 'notes' },
        ]
        : [
            { label: t('steps.equipment'), value: 'equipment' },
            { label: t('steps.method'), value: 'method' },
            { label: t('steps.pour'), value: 'brewing' },
            { label: t('steps.record'), value: 'notes' },
        ];

    const getStepIndex = (step: BrewingStep) => {
        return steps.findIndex(s => s.value === step);
    };

    const currentIndex = getStepIndex(currentStep);

    // 处理步骤点击
    const handleStepClick = (step: BrewingStep) => {
        if (!disabledSteps.includes(step) && onStepClick) {
            // 触感反馈已在onStepClick函数中处理，这里不再重复触发
            onStepClick(step);
        }
    };

    return (
        <div
            className="flex items-center justify-between w-full"
        >
            {steps.map((step, index) => {
                // 判断步骤状态
                const stepIndex = getStepIndex(step.value);
                const isActive = currentStep === step.value;
                const isDisabled = disabledSteps.includes(step.value);
                const isCompleted = stepIndex < currentIndex;

                return (
                    <React.Fragment key={step.value}>
                        <TabButton
                            tab={step.label}
                            isActive={isActive}
                            isDisabled={isDisabled}
                            isCompleted={isCompleted}
                            onClick={() => handleStepClick(step.value)}
                            dataTab={step.value}
                        />
                        {index < steps.length - 1 && (
                            <div
                                className={`h-px w-full max-w-[20px] sm:max-w-[30px] ${stepIndex < currentIndex
                                    ? 'bg-neutral-400 dark:bg-neutral-500'
                                    : 'bg-neutral-200 dark:bg-neutral-700'
                                    }`}
                            />
                        )}
                    </React.Fragment>
                );
            })}
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
    navigateToStep, // 接收统一的步骤导航函数
    onStepClick, // 接收步骤点击回调
    alternativeHeader, // 接收替代头部内容
    showAlternativeHeader = false, // 默认不显示替代头部内容
    handleExtractionTimeChange, // 接收萃取时间变更处理函数
}) => {
    const t = useTranslations('nav');

    // 获取禁用的步骤
    const getDisabledSteps = (): BrewingStep[] => {
        const disabledSteps: BrewingStep[] = [];

        // 定义步骤顺序
        const steps: BrewingStep[] = hasCoffeeBeans
            ? ['coffeeBean', 'equipment', 'method', 'brewing', 'notes']
            : ['equipment', 'method', 'brewing', 'notes'];

        const currentIndex = steps.indexOf(activeBrewingStep);

        // 如果没有咖啡豆，禁用咖啡豆步骤
        if (!hasCoffeeBeans) {
            disabledSteps.push('coffeeBean');
        }

        // 修改冲煮完成后的步骤禁用逻辑
        if (showComplete) {
            // 冲煮完成后，所有步骤都允许点击，不再禁用前面的步骤
            // 只有当没有选择设备、方法等情况时才禁用对应步骤（通过下面的逻辑判断）
        } else {
            // 未完成冲煮时保持原来的禁用逻辑
            // 禁用当前步骤后面的所有步骤（严格顺序）
            for (let i = currentIndex + 1; i < steps.length; i++) {
                disabledSteps.push(steps[i]);
            }
        }

        // 添加后置条件检查 - 无论当前步骤如何，都确保这些条件生效
        // 如果没有选择器具，禁用方案、冲煮和记录步骤
        if (!selectedEquipment) {
            if (!disabledSteps.includes('method')) disabledSteps.push('method');
            if (!disabledSteps.includes('brewing')) disabledSteps.push('brewing');
            if (!disabledSteps.includes('notes')) disabledSteps.push('notes');
        }
        // 如果没有选择方案，禁用冲煮和记录步骤
        if (!selectedMethod) {
            if (!disabledSteps.includes('brewing')) disabledSteps.push('brewing');
            if (!disabledSteps.includes('notes')) disabledSteps.push('notes');
        }
        // 如果没有完成冲煮，禁用记录步骤
        if (!showComplete) {
            if (!disabledSteps.includes('notes')) disabledSteps.push('notes');
        }

        // 当showComplete为true时，总是保证brewing和notes可点击
        if (showComplete) {
            const index = disabledSteps.indexOf('brewing');
            if (index !== -1) {
                disabledSteps.splice(index, 1);
            }

            const notesIndex = disabledSteps.indexOf('notes');
            if (notesIndex !== -1) {
                disabledSteps.splice(notesIndex, 1);
            }
        }

        return disabledSteps;
    };

    // 处理标题点击事件
    const handleTitleClick = () => {
        // 每次点击事件只有成功触发时才执行触感反馈
        if (settings.hapticFeedback) {
            hapticsUtils.light(); // 添加轻触感反馈
        }
        // 直接调用父组件传入的回调函数打开设置
        onTitleDoubleClick();
    };

    // 处理冲煮步骤点击
    const handleBrewingStepClick = (step: BrewingStep) => {
        // 如果计时器正在运行且冲煮未完成，不允许切换步骤
        if (isTimerRunning && !showComplete) {
            return;
        }

        // 如果点击的步骤被禁用，不执行任何操作
        if (getDisabledSteps().includes(step)) {
            return;
        }

        // 提供触感反馈
        if (settings.hapticFeedback) {
            hapticsUtils.light();
        }

        // 调用父组件传入的回调函数
        if (onStepClick) {
            // 使用回调而不是直接导航
            onStepClick(step);
            return;
        }

        // 仅当没有提供父组件回调时才使用内部导航逻辑
        if (navigateToStep) {
            // 根据步骤特点使用统一导航函数
            switch (step) {
                case 'coffeeBean':
                    // 咖啡豆步骤：完全重置参数
                    navigateToStep(step, { resetParams: true });
                    break;

                case 'equipment':
                    // 设备步骤：保留咖啡豆信息，重置其他参数
                    navigateToStep(step, {
                        resetParams: true,
                        preserveCoffeeBean: true
                    });
                    break;

                case 'method':
                    // 方案步骤：保留咖啡豆和设备信息，重置其他参数
                    navigateToStep(step, {
                        resetParams: true,
                        preserveCoffeeBean: true,
                        preserveEquipment: true
                    });
                    break;

                case 'brewing':
                    // 无论从哪里跳转到注水，都应该保留所有参数
                    navigateToStep(step, {
                        force: showComplete, // 如果冲煮完成，强制允许跳转
                        preserveMethod: true,
                        preserveEquipment: true,
                        preserveCoffeeBean: true
                    });
                    break;

                case 'notes':
                    // 记录步骤：如果冲煮完成，强制允许跳转
                    navigateToStep(step, {
                        force: showComplete
                    });
                    break;

                default:
                    // 其他情况使用默认导航
                    navigateToStep(step);
                    break;
            }
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

    // 判断是否应该显示参数栏（仅在选择了器具且当前不是器具步骤时显示）
    const shouldShowParams = parameterInfo.equipment && activeBrewingStep !== 'equipment';

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
            <div className="relative min-h-[34px] w-full">
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
                            <div className="flex items-center justify-between">
                                <div 
                                    onClick={handleTitleClick}
                                    className="cursor-pointer text-[12px] tracking-widest text-neutral-500 dark:text-neutral-400 flex items-center"
                                >
                                    <Equal className="w-4 h-4 mr-1" />
                                    <span>{t('title')}</span>
                                </div>

                                <div className="flex items-center space-x-6">
                                    <TabButton
                                        tab={t('main.brewing')}
                                        isActive={activeMainTab === '冲煮'}
                                        onClick={() => handleMainTabClick('冲煮')}
                                        dataTab="冲煮"
                                    />
                                    <TabButton
                                        tab={t('main.beans')}
                                        isActive={activeMainTab === '咖啡豆'}
                                        onClick={() => handleMainTabClick('咖啡豆')}
                                        dataTab="咖啡豆"
                                    />
                                    <TabButton
                                        tab={t('main.notes')}
                                        isActive={activeMainTab === '笔记'}
                                        onClick={() => handleMainTabClick('笔记')}
                                        dataTab="笔记"
                                    />
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
                                        <div className="px-6 py-2 mb-3 bg-neutral-100 dark:bg-neutral-800 text-[10px] text-neutral-500 dark:text-neutral-400 relative">
                                            <div className="flex items-center min-w-0 overflow-x-auto no-scrollbar max-w-full">
                                                {parameterInfo.equipment && (
                                                    <span
                                                        className="cursor-pointer whitespace-nowrap"
                                                        onClick={() => {
                                                            setActiveBrewingStep('equipment');
                                                            setActiveTab('器具');
                                                        }}
                                                    >
                                                        {parameterInfo.equipment}
                                                    </span>
                                                )}

                                                {parameterInfo.method && (
                                                    <>
                                                        <span className="mx-1 shrink-0">·</span>
                                                        <span
                                                            className="cursor-pointer whitespace-nowrap"
                                                            onClick={() => {
                                                                setActiveBrewingStep('method');
                                                                setActiveTab('方案');
                                                            }}
                                                        >
                                                            {parameterInfo.method}
                                                        </span>
                                                    </>
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

                            {/* 步骤指示器 - 内部不再单独有动画 */}
                            <div className="mx-6  mb-3">
                                <StepIndicator
                                    currentStep={activeBrewingStep}
                                    onStepClick={handleBrewingStepClick}
                                    disabledSteps={getDisabledSteps()}
                                    hasCoffeeBeans={hasCoffeeBeans}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </motion.div>
    );
};

export default NavigationBar;