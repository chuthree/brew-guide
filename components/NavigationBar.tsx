'use client'

import React, { useState, useEffect } from 'react'
import { APP_VERSION, equipmentList } from '@/lib/config'
import { motion, AnimatePresence } from 'framer-motion'
import hapticsUtils from '@/lib/haptics'
import { SettingsOptions } from '@/components/Settings'
import { formatGrindSize } from '@/lib/grindUtils'

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
        coffee?: string
        water?: string
        ratio?: string
        grindSize?: string
        temp?: string
    } | null
}

// Add new interfaces for parameter editing
interface EditableParams {
    coffee: string
    water: string
    ratio: string
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
}: {
    tab: string
    isActive: boolean
    isDisabled?: boolean
    isCompleted?: boolean
    onClick?: () => void
    hasSecondaryLine?: boolean
    className?: string
}) => {
    // 处理点击事件
    const handleClick = () => {
        if (!isDisabled && onClick) {
            // 不在这里触发触感反馈，由父组件统一处理
            onClick();
        }
    };

    return (
        <div
            onClick={!isDisabled ? handleClick : undefined}
            className={`text-[12px] tracking-widest transition-all duration-300 ${className} ${isActive
                ? 'text-neutral-800 dark:text-neutral-100'
                : isCompleted
                    ? 'cursor-pointer text-neutral-600 dark:text-neutral-400'
                    : isDisabled
                        ? 'text-neutral-300 dark:text-neutral-600'
                        : 'cursor-pointer text-neutral-400 dark:text-neutral-500'
                }`}
        >
            <span className="relative">
                {tab}
                {/* 使用纯CSS实现下划线效果，减少动画复杂度 */}
                <span
                    className={`absolute -bottom-1 left-0 right-0 h-px transition-all duration-200 ${hasSecondaryLine
                        ? 'bg-neutral-200 dark:bg-neutral-700 opacity-100'
                        : 'bg-neutral-200 dark:bg-neutral-700 opacity-0'
                        }`}
                />
                {/* 主下划线 - 只为当前激活步骤显示 */}
                <motion.span
                    className={`absolute -bottom-1 left-0 right-0 z-10 h-px bg-neutral-800 dark:bg-neutral-100`}
                    initial={false}
                    animate={{
                        opacity: isActive ? 1 : 0,
                        scaleX: isActive ? 1 : 0
                    }}
                    transition={{ duration: 0.26, ease: "easeInOut" }}
                    style={{ transformOrigin: 'center' }}
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
    // 根据是否有咖啡豆动态生成步骤数组
    const steps: { label: string; value: BrewingStep }[] = hasCoffeeBeans
        ? [
            { label: '咖啡豆', value: 'coffeeBean' },
            { label: '器具', value: 'equipment' },
            { label: '方案', value: 'method' },
            { label: '注水', value: 'brewing' },
            { label: '记录', value: 'notes' },
        ]
        : [
            { label: '器具', value: 'equipment' },
            { label: '方案', value: 'method' },
            { label: '注水', value: 'brewing' },
            { label: '记录', value: 'notes' },
        ];

    const getStepIndex = (step: BrewingStep) => {
        return steps.findIndex(s => s.value === step);
    };

    const currentIndex = getStepIndex(currentStep);

    // 使用状态来存储当前主题模式
    const [isDarkMode, setIsDarkMode] = useState(false);

    // 初始化时检测主题并设置监听
    useEffect(() => {
        // 检查当前主题
        const checkDarkMode = () => {
            const isDark = document.documentElement.classList.contains('dark');
            setIsDarkMode(isDark);
        };

        // 初始检查
        checkDarkMode();

        // 创建MutationObserver来监听class变化
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    checkDarkMode();
                }
            });
        });

        // 开始监听
        observer.observe(document.documentElement, { attributes: true });

        // 清理
        return () => observer.disconnect();
    }, []);

    // 处理步骤点击
    const handleStepClick = (step: BrewingStep) => {
        if (!disabledSteps.includes(step) && onStepClick) {
            // 触感反馈已在onStepClick函数中处理，这里不再重复触发
            onStepClick(step);
        }
    };

    return (
        <motion.div
            className="flex items-center justify-between w-full"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, ease: "easeOut" }}
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
                            className="text-[10px] sm:text-xs"
                        />
                        {index < steps.length - 1 && (
                            <motion.div
                                className="h-px w-full max-w-[20px] sm:max-w-[30px]"
                                style={{
                                    backgroundColor: stepIndex < currentIndex
                                        ? isDarkMode
                                            ? 'rgb(107, 114, 128)' // dark:neutral-500
                                            : 'rgb(156, 163, 175)' // neutral-400
                                        : isDarkMode
                                            ? 'rgb(64, 64, 64)' // dark:neutral-700
                                            : 'rgb(229, 231, 235)' // neutral-200
                                }}
                                transition={{ duration: 0.26 }}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </motion.div>
    );
};

// 修改EditableParameter组件，添加更好的布局控制
const EditableParameter = ({
    value,
    onChange,
    unit,
    className = '',
    prefix = '',
}: {
    value: string
    onChange: (value: string) => void
    unit: string
    className?: string
    prefix?: string
}) => {
    const [isEditing, setIsEditing] = useState(false)
    const [tempValue, setTempValue] = useState(value)
    const inputRef = React.useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])

    useEffect(() => {
        setTempValue(value)
    }, [value])

    const handleBlur = () => {
        setIsEditing(false)
        if (tempValue !== value) {
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
            className={`group relative inline-flex items-center ${className} cursor-pointer min-w-0 max-w-[40px] sm:max-w-[50px]`}
            onClick={() => setIsEditing(true)}
        >
            {prefix && <span className="flex-shrink-0">{prefix}</span>}
            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="w-full border-b border-neutral-300 bg-transparent text-center text-[10px] outline-none sm:text-xs px-0.5"
                />
            ) : (
                <span className="inline-flex items-center whitespace-nowrap">
                    {value}
                    {unit && <span className="ml-0.5 flex-shrink-0">{unit}</span>}
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
}

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
    selectedCoffeeBean,
    hasCoffeeBeans // 接收是否有咖啡豆的属性
}) => {
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

        // 禁用当前步骤后面的所有步骤（严格顺序）
        for (let i = currentIndex + 1; i < steps.length; i++) {
            disabledSteps.push(steps[i]);
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

        return disabledSteps;
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const hasCoffeeBean = !!selectedCoffeeBean;

    // 添加双击计时器和计数器
    const [lastTitleClickTime, setLastTitleClickTime] = useState(0);

    // 处理标题点击事件
    const handleTitleClick = () => {
        const currentTime = new Date().getTime();
        // 每次点击事件只有成功触发时才执行触感反馈
        if (settings.hapticFeedback) {
            hapticsUtils.light(); // 添加轻触感反馈
        }
        // 如果距离上次点击不超过300毫秒，视为双击
        if (currentTime - lastTitleClickTime < 300) {
            onTitleDoubleClick(); // 调用父组件传入的回调函数
        }
        setLastTitleClickTime(currentTime);
    };

    // 处理冲煮步骤点击
    const handleBrewingStepClick = (step: BrewingStep) => {
        // 如果计时器正在运行，不允许切换步骤
        if (isTimerRunning && !showComplete) {
            return;
        }

        // 如果点击的步骤被禁用，不执行任何操作
        if (getDisabledSteps().includes(step)) {
            return;
        }

        // 如果没有咖啡豆且尝试切换到咖啡豆步骤，则跳转到器具步骤
        if (step === 'coffeeBean' && !hasCoffeeBeans) {
            // 直接调用父组件传入的setActiveBrewingStep函数，让父组件处理所有逻辑
            if (settings.hapticFeedback) {
                hapticsUtils.light(); // 添加轻触感反馈
            }
            setActiveBrewingStep('equipment');
            return;
        }

        // 特殊处理：从记录跳转到注水时，完全保留参数
        if (activeBrewingStep === 'notes' && step === 'brewing') {
            // 仅改变当前步骤，不清空参数栏
            if (settings.hapticFeedback) {
                hapticsUtils.light();
            }
            setActiveBrewingStep(step);
            setActiveTab('注水');

            // 触发事件，仅关闭记录表单，不做任何其他操作
            const event = new CustomEvent("closeBrewingNoteForm", {
                detail: { force: true },
            });
            window.dispatchEvent(event);

            // 不修改参数信息，直接返回
            return;
        }

        // 只在非特殊情况下清空参数栏
        if (step !== 'brewing') {
            setParameterInfo({
                equipment: null,
                method: null,
                params: null
            });
        }

        // 确保在任何步骤切换时，如果有选择的设备，都始终使用设备的中文名称而不是ID
        if (selectedEquipment && step !== 'equipment' && step !== 'notes') {
            const equipmentName = equipmentList.find(e => e.id === selectedEquipment)?.name || selectedEquipment;

            // 如果是切换到brewing步骤且已有方案，保留方案信息
            if (step === 'brewing' && selectedMethod) {
                setParameterInfo({
                    equipment: equipmentName,
                    method: selectedMethod.name,
                    params: null
                });
            } else if (step === 'method') {
                // 如果是方案步骤且已选择器具，只显示器具信息
                setParameterInfo({
                    equipment: equipmentName,
                    method: null,
                    params: null
                });
            } else {
                // 其他情况下，只显示设备名称
                setParameterInfo({
                    equipment: equipmentName,
                    method: null,
                    params: null
                });
            }
        }

        // 直接调用父组件传入的setActiveBrewingStep函数，让父组件处理所有逻辑
        if (settings.hapticFeedback) {
            hapticsUtils.light(); // 添加轻触感反馈
        }
        setActiveBrewingStep(step);

        // 如果不在冲煮主标签，先切换到冲煮主标签
        if (activeMainTab !== '冲煮') {
            setActiveMainTab('冲煮');
        }
    };

    // 判断是否应该隐藏标题和导航
    const shouldHideHeader = isTimerRunning && !showComplete;

    // 动画变体定义
    const containerVariants = {
        visible: {
            height: "auto",
            opacity: 1,
            transition: {
                height: { duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] },
                opacity: { duration: 0.25, delay: 0.05 }
            }
        },
        hidden: {
            height: 0,
            opacity: 0,
            transition: {
                height: { duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] },
                opacity: { duration: 0.15 }
            }
        }
    };


    const fadeInVariants = {
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.2,
                ease: "easeOut"
            }
        },
        hidden: {
            opacity: 0,
            y: -5,
            transition: {
                duration: 0.2,
                ease: "easeIn"
            }
        }
    };

    const paramVariants = {
        visible: {
            opacity: 1,
            x: 0,
            transition: {
                duration: 0.3,
                ease: "easeOut"
            }
        },
        hidden: {
            opacity: 0,
            x: 10,
            transition: {
                duration: 0.2,
                ease: "easeIn"
            }
        }
    };

    // 处理主标签点击
    const handleMainTabClick = (tab: MainTabType) => {
        // 如果已经在选中的标签，不做任何操作
        if (activeMainTab === tab) return;

        if (settings.hapticFeedback) {
            hapticsUtils.light(); // 添加轻触感反馈
        }

        if (tab === '冲煮') {
            setActiveMainTab('冲煮');
            // 从笔记切换回冲煮时，确保关闭历史记录显示
            if (activeMainTab === '笔记') {
                setShowHistory(false);
            }
            // 移除强制设置到器具步骤的代码
        } else if (tab === '咖啡豆') {
            setActiveMainTab('咖啡豆');
        } else if (tab === '笔记') {
            setActiveMainTab('笔记');
            setShowHistory(true);
        }
    };

    return (
        <div
            className="sticky top-0 z-10 pt-safe bg-neutral-50/95 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800"
            style={{ paddingTop: 'max(env(safe-area-inset-top), 24px)' }}
        >
            {/* 添加隐藏滚动条的样式 */}
            <style jsx global>{noScrollbarStyle}</style>

            <motion.div
                initial={false}
                animate={shouldHideHeader ? "hidden" : "visible"}
                variants={containerVariants}
                className="overflow-hidden"
            >
                <div className="flex items-center justify-between px-6 px-safe py-4">
                    {/* 左侧标题 - 添加双击事件 */}
                    <h1
                        className="text-base font-light tracking-wide cursor-pointer"
                        onClick={handleTitleClick}
                    >
                        手冲咖啡
                        <span className="ml-1 text-[8px] text-neutral-400 dark:text-neutral-600">v{APP_VERSION}</span>
                    </h1>

                    {/* 右侧主导航 */}
                    <div className="flex items-center space-x-6">
                        <TabButton
                            tab="冲煮"
                            isActive={activeMainTab === '冲煮'}
                            onClick={() => handleMainTabClick('冲煮')}
                            className="text-[10px] sm:text-xs"
                        />
                        <TabButton
                            tab="咖啡豆"
                            isActive={activeMainTab === '咖啡豆'}
                            onClick={() => handleMainTabClick('咖啡豆')}
                            className="text-[10px] sm:text-xs"
                        />
                        <TabButton
                            tab="笔记"
                            isActive={activeMainTab === '笔记'}
                            onClick={() => handleMainTabClick('笔记')}
                            className="text-[10px] sm:text-xs"
                        />
                    </div>
                </div>
            </motion.div>

            {/* 参数信息条 - 只在有选择且非计时状态时显示 */}
            <motion.div
                initial={false}
                animate={parameterInfo.equipment && (!isTimerRunning || showComplete) && activeMainTab === '冲煮' ? "visible" : "hidden"}
                variants={containerVariants}
                className="overflow-hidden"
            >
                <div
                    className="px-6 py-2 bg-neutral-100 dark:bg-neutral-800 text-[10px] text-neutral-500 dark:text-neutral-400 relative"
                >
                    {/* 左侧设备和方法名称 */}
                    <motion.div
                        className="flex items-center min-w-0 overflow-x-auto no-scrollbar max-w-full"
                        initial="hidden"
                        animate="visible"
                        variants={fadeInVariants}
                    >
                        <AnimatePresence mode="wait">
                            {parameterInfo.equipment && (
                                <motion.span
                                    key={parameterInfo.equipment}
                                    className="cursor-pointer whitespace-nowrap"
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 5 }}
                                    transition={{ duration: 0.3, ease: "easeOut" }}
                                    onClick={() => {
                                        // 点击设备名称时，跳转到器具步骤
                                        setActiveBrewingStep('equipment');
                                        setActiveTab('器具');
                                        // 保持当前设备名称
                                        setParameterInfo({
                                            equipment: parameterInfo.equipment,
                                            method: null,
                                            params: null,
                                        });
                                    }}
                                >{parameterInfo.equipment}</motion.span>
                            )}
                        </AnimatePresence>

                        <AnimatePresence>
                            {parameterInfo.method && (
                                <>
                                    <motion.span
                                        className="mx-1 flex-shrink-0"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >·</motion.span>
                                    <motion.span
                                        key={parameterInfo.method}
                                        className="cursor-pointer whitespace-nowrap"
                                        initial={{ opacity: 0, x: -5 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -5 }}
                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                        onClick={() => {
                                            // 点击方法名称时，跳转到方案步骤
                                            setActiveBrewingStep('method');
                                            setActiveTab('方案');
                                            // 保持设备和方法信息，清空参数信息
                                            if (selectedEquipment && selectedMethod) {
                                                const equipmentName = equipmentList.find(e => e.id === selectedEquipment)?.name || selectedEquipment;
                                                setParameterInfo({
                                                    equipment: equipmentName,
                                                    method: selectedMethod.name,
                                                    params: null,
                                                });
                                            }
                                        }}
                                    >{parameterInfo.method}</motion.span>
                                </>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* 右侧参数信息 - 使用绝对定位，允许完全覆盖左侧内容 */}
                    <AnimatePresence mode="wait">
                        {parameterInfo.params && (
                            <motion.div
                                className="absolute top-2 right-6 min-w-0 max-w-full text-right z-10"
                                key={`params-${parameterInfo.equipment}-${parameterInfo.method}`}
                                initial="hidden"
                                animate="visible"
                                exit="hidden"
                                variants={paramVariants}
                            >
                                {editableParams ? (
                                    <div
                                        className="flex items-center justify-end bg-neutral-100 dark:bg-neutral-800 space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar pl-6"
                                    >
                                        <EditableParameter
                                            value={editableParams.coffee.replace('g', '')}
                                            onChange={(v) => handleParamChange('coffee', v)}
                                            unit="g"
                                            className="border-b border-dashed border-neutral-200 dark:border-neutral-700"
                                        />
                                        <span className="flex-shrink-0">·</span>
                                        <EditableParameter
                                            value={editableParams.ratio.replace('1:', '')}
                                            onChange={(v) => handleParamChange('ratio', v)}
                                            unit=""
                                            prefix="1:"
                                            className="border-b border-dashed border-neutral-200 dark:border-neutral-700"
                                        />
                                        {parameterInfo.params?.grindSize && (
                                            <>
                                                <span className="flex-shrink-0">·</span>
                                                <span className="whitespace-nowrap">{formatGrindSize(parameterInfo.params.grindSize || "", settings.grindType)}</span>
                                            </>
                                        )}
                                        {parameterInfo.params?.temp && (
                                            <>
                                                <span className="flex-shrink-0">·</span>
                                                <span className="whitespace-nowrap">{parameterInfo.params.temp}</span>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <span
                                        className="cursor-pointer flex items-center justify-end space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar bg-gradient-to-r from-transparent via-neutral-100/95 to-neutral-100/95 dark:via-neutral-800/95 dark:to-neutral-800/95 pl-6"
                                        onClick={() => {
                                            if (selectedMethod && !isTimerRunning) {
                                                setEditableParams({
                                                    coffee: selectedMethod.params.coffee,
                                                    water: selectedMethod.params.water,
                                                    ratio: selectedMethod.params.ratio,
                                                });
                                            }
                                        }}
                                    >
                                        <span className="truncate max-w-[30px] sm:max-w-[40px]">{parameterInfo.params.coffee}</span>
                                        <span className="flex-shrink-0">·</span>
                                        <span className="whitespace-nowrap">{parameterInfo.params.ratio}</span>
                                        <span className="flex-shrink-0">·</span>
                                        <span className="whitespace-nowrap">{formatGrindSize(parameterInfo.params.grindSize || "", settings.grindType)}</span>
                                        <span className="flex-shrink-0">·</span>
                                        <span className="whitespace-nowrap">{parameterInfo.params.temp}</span>
                                    </span>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* 冲煮流程指示器 - 仅在冲煮标签激活且计时器未运行时显示 */}
            <motion.div
                initial={false}
                animate={activeMainTab === '冲煮' && (!isTimerRunning || showComplete) ? "visible" : "hidden"}
                variants={containerVariants}
                className="overflow-hidden"
            >
                <div className="px-6 px-safe py-3">
                    <StepIndicator
                        currentStep={activeBrewingStep}
                        onStepClick={handleBrewingStepClick}
                        disabledSteps={getDisabledSteps()}
                        hasCoffeeBeans={hasCoffeeBeans}
                    />
                </div>
            </motion.div>
        </div>
    );
};

export default NavigationBar; 