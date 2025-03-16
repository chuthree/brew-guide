'use client'

import React, { useState, useEffect } from 'react'
import { APP_VERSION, equipmentList } from '@/lib/config'

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
    ratio: string
}

// Add TabButton component
const TabButton = ({
    tab,
    isActive,
    isDisabled,
    onClick,
    hasSecondaryLine,
    className = '',
}: {
    tab: string
    isActive: boolean
    isDisabled?: boolean
    onClick?: () => void
    hasSecondaryLine?: boolean
    className?: string
}) => (
    <div
        onClick={!isDisabled ? onClick : undefined}
        className={`text-[11px] tracking-widest transition-all duration-300 ${className} ${isActive
            ? 'text-neutral-800 dark:text-neutral-100'
            : isDisabled
                ? 'text-neutral-300 dark:text-neutral-600'
                : 'cursor-pointer text-neutral-400  dark:text-neutral-500 '
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
            {/* 主下划线 */}
            <span
                className={`absolute -bottom-1 left-0 right-0 z-10 h-px transition-all duration-200 ${isActive
                    ? 'bg-neutral-800 dark:bg-neutral-100 opacity-100 scale-x-100'
                    : 'bg-neutral-800 dark:bg-neutral-100 opacity-0 scale-x-0'
                    }`}
                style={{ transformOrigin: 'center' }}
            />
        </span>
    </div>
)

// 添加步骤指示器组件
const StepIndicator = ({
    currentStep,
    onStepClick,
    disabledSteps = [],
}: {
    currentStep: BrewingStep
    onStepClick?: (step: BrewingStep) => void
    disabledSteps?: BrewingStep[]
}) => {
    const steps: { label: string; value: BrewingStep }[] = [
        { label: '咖啡豆', value: 'coffeeBean' },
        { label: '器具', value: 'equipment' },
        { label: '方案', value: 'method' },
        { label: '注水', value: 'brewing' },
        { label: '记录', value: 'notes' },
    ];

    const getStepIndex = (step: BrewingStep) => {
        return steps.findIndex(s => s.value === step);
    };

    const currentIndex = getStepIndex(currentStep);

    return (
        <div className="flex items-center justify-between w-full">
            {steps.map((step, index) => (
                <React.Fragment key={step.value}>
                    <TabButton
                        tab={step.label}
                        isActive={currentStep === step.value}
                        isDisabled={disabledSteps.includes(step.value)}
                        onClick={onStepClick ? () => onStepClick(step.value) : undefined}
                        className="text-[10px] sm:text-xs"
                    />
                    {index < steps.length - 1 && (
                        <div
                            className={`h-px w-full max-w-[20px] sm:max-w-[30px] transition-colors duration-300 ${index < currentIndex
                                ? 'bg-neutral-400 dark:bg-neutral-500'
                                : 'bg-neutral-200 dark:bg-neutral-700'
                                }`}
                        />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};

// Add new component for editable parameters
const EditableParameter = ({
    value,
    onChange,
    unit,
    className = '',
}: {
    value: string
    onChange: (value: string) => void
    unit: string
    className?: string
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
            className={`group relative inline-block ${className} cursor-pointer min-w-0 max-w-[40px] sm:max-w-[50px] whitespace-nowrap`}
            onClick={() => setIsEditing(true)}
        >
            {isEditing ? (
                <div className="transition-all duration-150">
                    <input
                        ref={inputRef}
                        type="text"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        className="w-full border-b border-neutral-300 bg-transparent text-center text-[10px] outline-none sm:text-xs"
                    />
                </div>
            ) : (
                <span className="cursor-pointer transition-all duration-150 whitespace-nowrap">
                    {value}
                    <span className="ml-0.5 flex-shrink-0">{unit}</span>
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
    onTitleDoubleClick // 接收双击标题的回调函数
}) => {
    // 获取禁用的步骤
    const getDisabledSteps = (): BrewingStep[] => {
        const disabled: BrewingStep[] = [];

        // 根据应用状态确定哪些步骤应该禁用
        if (!selectedEquipment) {
            disabled.push('method', 'brewing', 'notes');
        } else if (!selectedMethod) {
            disabled.push('brewing', 'notes');
        } else if (!showComplete) {
            disabled.push('notes');
        }

        return disabled;
    };

    // 添加双击计时器和计数器
    const [lastTitleClickTime, setLastTitleClickTime] = useState(0);

    // 处理标题点击事件
    const handleTitleClick = () => {
        const currentTime = new Date().getTime();
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

        // 直接调用父组件传入的setActiveBrewingStep函数，让父组件处理所有逻辑
        setActiveBrewingStep(step);
    };

    // 判断是否应该隐藏标题和导航
    const shouldHideHeader = isTimerRunning && !showComplete;

    return (
        <div
            className="sticky top-0 pt-safe bg-neutral-50/95 dark:bg-neutral-900/95 border-b border-neutral-200 dark:border-neutral-800"
        >
            {/* 添加隐藏滚动条的样式 */}
            <style jsx global>{noScrollbarStyle}</style>

            <div className={`transition-all duration-300 ease-in-out ${shouldHideHeader ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-20 opacity-100'}`}>
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
                            onClick={() => {
                                // 如果已经在冲煮标签，不做任何操作
                                if (activeMainTab === '冲煮') return;

                                setActiveMainTab('冲煮');
                                // 从笔记切换回冲煮时，确保关闭历史记录显示
                                if (activeMainTab === '笔记') {
                                    setShowHistory(false);
                                }

                                // 根据当前步骤恢复显示参数信息条和步骤指示器
                                if (activeBrewingStep === 'coffeeBean') {
                                    setParameterInfo({
                                        equipment: null,
                                        method: null,
                                        params: null,
                                    });
                                } else if (activeBrewingStep === 'equipment') {
                                    if (selectedEquipment) {
                                        const equipmentName = equipmentList.find(e => e.id === selectedEquipment)?.name || selectedEquipment;
                                        setParameterInfo({
                                            equipment: equipmentName,
                                            method: null,
                                            params: null,
                                        });
                                    } else {
                                        setParameterInfo({
                                            equipment: null,
                                            method: null,
                                            params: null,
                                        });
                                    }
                                } else if (activeBrewingStep === 'method') {
                                    if (selectedEquipment) {
                                        const equipmentName = equipmentList.find(e => e.id === selectedEquipment)?.name || selectedEquipment;
                                        setParameterInfo({
                                            equipment: equipmentName,
                                            method: selectedMethod?.name || null,
                                            params: selectedMethod?.params ? {
                                                coffee: selectedMethod.params.coffee,
                                                water: selectedMethod.params.water,
                                                ratio: selectedMethod.params.ratio,
                                                grindSize: selectedMethod.params.grindSize,
                                                temp: selectedMethod.params.temp,
                                            } : null,
                                        });
                                    }
                                }
                            }}
                            className="text-[10px] sm:text-xs"
                        />
                        <TabButton
                            tab="咖啡豆"
                            isActive={activeMainTab === '咖啡豆'}
                            onClick={() => {
                                // 如果已经在咖啡豆标签，不做任何操作
                                if (activeMainTab === '咖啡豆') return;

                                setActiveMainTab('咖啡豆');
                            }}
                            className="text-[10px] sm:text-xs"
                        />
                        <TabButton
                            tab="笔记"
                            isActive={activeMainTab === '笔记'}
                            onClick={() => {
                                // 如果已经在笔记标签，不做任何操作
                                if (activeMainTab === '笔记') return;

                                setActiveMainTab('笔记');
                                setShowHistory(true);
                            }}
                            className="text-[10px] sm:text-xs"
                        />
                    </div>
                </div>
            </div>

            {/* 参数信息条 - 只在有选择且非计时状态时显示 */}
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${parameterInfo.equipment && (!isTimerRunning || showComplete) && activeMainTab === '冲煮'
                ? 'max-h-20 opacity-100'
                : 'max-h-0 opacity-0'
                }`}>
                <div
                    className="px-4 sm:px-6 py-2 bg-neutral-100/80 dark:bg-neutral-800/80 text-[10px] text-neutral-500 dark:text-neutral-400 relative"
                >
                    {/* 左侧设备和方法名称 */}
                    <div className="flex items-center min-w-0 overflow-x-auto no-scrollbar max-w-full">
                        <span
                            className="cursor-pointer whitespace-nowrap"
                            onClick={() => {
                                // 点击设备名称时，跳转到器具步骤
                                setActiveBrewingStep('equipment');
                                setActiveTab('器具');
                                // 完全清空参数信息条，因为用户正在选择器具
                                setParameterInfo({
                                    equipment: null,
                                    method: null,
                                    params: null,
                                });
                            }}
                        >{parameterInfo.equipment}</span>
                        {parameterInfo.method && (
                            <>
                                <span className="mx-1 flex-shrink-0">·</span>
                                <span
                                    className="cursor-pointer whitespace-nowrap"
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
                                >{parameterInfo.method}</span>
                            </>
                        )}
                    </div>

                    {/* 右侧参数信息 - 使用绝对定位，允许完全覆盖左侧内容 */}
                    {parameterInfo.params && (
                        <div className="absolute top-2 right-4 sm:right-6 min-w-0 max-w-full text-right z-10">
                            {editableParams ? (
                                <div className="flex items-center justify-end space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar bg-gradient-to-r from-transparent via-neutral-100/95 to-neutral-100/95 dark:via-neutral-800/95 dark:to-neutral-800/95 pl-6">
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
                                        className="border-b border-dashed border-neutral-200 dark:border-neutral-700 whitespace-nowrap before:content-['1:']"
                                    />
                                    {parameterInfo.params?.grindSize && (
                                        <>
                                            <span className="flex-shrink-0">·</span>
                                            <span className="whitespace-nowrap">{parameterInfo.params.grindSize}</span>
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
                                                ratio: selectedMethod.params.ratio,
                                            });
                                        }
                                    }}
                                >
                                    <span className="truncate max-w-[30px] sm:max-w-[40px]">{parameterInfo.params.coffee}</span>
                                    <span className="flex-shrink-0">·</span>
                                    <span className="whitespace-nowrap">{parameterInfo.params.ratio}</span>
                                    <span className="flex-shrink-0">·</span>
                                    <span className="whitespace-nowrap">{parameterInfo.params.grindSize}</span>
                                    <span className="flex-shrink-0">·</span>
                                    <span className="whitespace-nowrap">{parameterInfo.params.temp}</span>
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 冲煮流程指示器 - 仅在冲煮标签激活且计时器未运行时显示 */}
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${activeMainTab === '冲煮' && (!isTimerRunning || showComplete)
                ? 'max-h-20 opacity-100'
                : 'max-h-0 opacity-0'
                }`}>
                <div className="px-6 px-safe py-3">
                    <StepIndicator
                        currentStep={activeBrewingStep}
                        onStepClick={handleBrewingStepClick}
                        disabledSteps={getDisabledSteps()}
                    />
                </div>
            </div>
        </div>
    );
};

export default NavigationBar; 