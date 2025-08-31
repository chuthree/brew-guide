import React, { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Method } from '@/lib/core/config'
import ActionMenu from '@/components/coffee-bean/ui/action-menu'
import { Step } from '@/lib/hooks/useBrewingState'

interface StageItemProps {
    step: Step & {
        customParams?: Record<string, string | number | boolean>;
        icon?: string;
        isPinned?: boolean;
        isDivider?: boolean;
        dividerText?: string;
        onToggleCollapse?: (isCollapsed: boolean) => void;
        time?: number;
        pourTime?: number;
        valveStatus?: string;
    }
    index: number
    onClick: () => void
    activeTab: string
    selectedMethod: Method | null
    currentStage: number
    onEdit?: () => void
    onDelete?: () => void
    onShare?: () => void
    isPinned?: boolean
    actionMenuStates?: Record<string, boolean>
    setActionMenuStates?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
    showFlowRate?: boolean
    allSteps?: Step[]
    compactMode?: boolean
}

// 辅助函数：格式化时间
const formatTime = (seconds: number, compact: boolean = false) => {
    // 确保秒数为非负数
    const positiveSeconds = Math.max(0, seconds);
    const mins = Math.floor(positiveSeconds / 60)
    const secs = positiveSeconds % 60

    if (compact) {
        // 简洁模式: 1'20" 或 45"
        return mins > 0
            ? `${mins}'${secs.toString().padStart(2, '0')}"`
            : `${secs}"`
    }
    // 完整模式: 1:20 (用于主计时器显示)
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

// 辅助函数：计算流速
const calculateFlowRate = (waterAmount: string, time: string | number) => {
    if (!waterAmount || !time) return 0;
    const water = parseInt(waterAmount);
    const seconds = typeof time === 'string' ? parseInt(time) : time;
    if (seconds <= 0) return 0;
    return water / seconds;
}

// 改进的流速计算函数：考虑前后阶段的水量差值
const calculateImprovedFlowRate = (step: Step, allSteps: Step[]) => {
    if (!step || !step.items || !step.note || step.type !== 'pour') return 0;
    
    // 获取当前阶段的水量和时间
    const currentWater = parseInt(step.items[0]);
    const currentTime = typeof step.note === 'string' ? parseInt(step.note) : step.note;
    
    if (!currentTime || currentTime <= 0) return 0;
    
    // 查找相同originalIndex的前一个阶段
    if (step.originalIndex !== undefined) {
        // 查找所有具有相同originalIndex的阶段
        const sameStageSteps = allSteps.filter(s => 
            s.originalIndex === step.originalIndex && s.type === 'pour');
        
        // 找出当前步骤在这些阶段中的位置
        const stepIndex = sameStageSteps.findIndex(s => s === step);
        
        // 如果是该originalIndex的第一个阶段
        if (stepIndex === 0) {
            // 查找前一个originalIndex的最后一个阶段
            const prevOriginalIndex = step.originalIndex - 1;
            const prevStageSteps = allSteps.filter(s => 
                s.originalIndex === prevOriginalIndex && s.type === 'pour');
            
            // 获取前一个阶段的最后一个步骤的水量
            let prevWater = 0;
            if (prevStageSteps.length > 0) {
                const prevStep = prevStageSteps[prevStageSteps.length - 1];
                prevWater = prevStep.items ? parseInt(prevStep.items[0]) : 0;
            }
            
            // 计算水量差值
            const waterDiff = currentWater - prevWater;
            return waterDiff / currentTime;
        } else if (stepIndex > 0) {
            // 如果不是第一个阶段，获取同一originalIndex的前一个阶段的水量
            const prevStep = sameStageSteps[stepIndex - 1];
            const prevWater = prevStep.items ? parseInt(prevStep.items[0]) : 0;
            
            // 计算水量差值
            const waterDiff = currentWater - prevWater;
            return waterDiff / currentTime;
        }
    }
    
    // 如果无法确定前一个阶段，使用简单的计算方法
    return currentWater / currentTime;
}

// 辅助函数：生成简洁模式的自然语言描述
const generateCompactDescription = (step: Step & { time?: number; pourTime?: number; endTime?: number }, showFlowRate: boolean, allSteps: Step[]) => {
    if (!step.items || step.items.length === 0) return null;

    const title = step.title || '';
    const waterAmount = step.items[0] || '';
    const description = step.items[1] || step.description || '';
    const isWaitingStep = step.type === 'wait';
    const isBypassStep = step.pourType === 'bypass';

    // 获取时间信息
    let timeInfo = null;
    const parseTimeString = (timeStr: string) => {
        // 处理格式如 "1'30"" 或 "10""
        if (timeStr.includes("'")) {
            // 有分钟的情况：1'30"
            const [minutes, seconds] = timeStr.replace(/"/g, '').split("'");
            return { minutes, seconds };
        } else {
            // 只有秒的情况：10"
            const seconds = timeStr.replace(/"/g, '');
            return { minutes: '0', seconds };
        }
    };

    if (step.endTime !== undefined) {
        const time = formatTime(step.endTime, true);
        timeInfo = parseTimeString(time);
    } else if (step.note) {
        const time = formatTime(parseInt(String(step.note)), true);
        timeInfo = parseTimeString(time);
    } else if (step.time !== undefined) {
        const time = formatTime(step.time, true);
        timeInfo = parseTimeString(time);
    }

    // 获取流速信息
    let flowRateInfo = null;
    if (showFlowRate && step.type === 'pour' && step.note) {
        const flowRate = allSteps.length > 0
            ? calculateImprovedFlowRate(step, allSteps).toFixed(1)
            : calculateFlowRate(waterAmount, step.note).toFixed(1);
        if (flowRate !== '0.0') {
            flowRateInfo = flowRate;
        }
    }

    return {
        title,
        timeInfo,
        waterAmount,
        flowRateInfo,
        description,
        isWaitingStep,
        isBypassStep
    };
}

// StageItem组件
const StageItem: React.FC<StageItemProps> = ({
    step,
    index,
    onClick,
    activeTab,
    selectedMethod,
    currentStage,
    onEdit,
    onDelete,
    onShare,
    isPinned: _isPinned,
    actionMenuStates: _actionMenuStates,
    setActionMenuStates: _setActionMenuStates,
    showFlowRate = false,
    allSteps = [],
    compactMode = false
}) => {
    // 添加用于管理分隔符折叠状态的 state
    const [isCommonSectionCollapsed, setIsCommonSectionCollapsed] = useState(false);
    
    // 向父组件传递折叠状态的效果
    useEffect(() => {
        // 如果是分隔符且父组件提供了设置折叠状态的回调，则调用它
        if (step.isDivider && step.onToggleCollapse) {
            step.onToggleCollapse(isCommonSectionCollapsed);
        }
    }, [isCommonSectionCollapsed, step]);

    // 判断是否为等待阶段
    const isWaitingStage = step.type === 'wait';

    // 判断是否为 Bypass 步骤
    const isBypassStep = step.pourType === 'bypass';

    // 判断是否为当前阶段
    const isCurrentStage = activeTab === '注水' && index === currentStage;

    // 获取文本样式 - 统一使用相同的样式，通过透明度区分状态
    const textStyle = useMemo(() => {
        if (activeTab === '方案') {
            // 方案列表使用统一的样式，不区分当前状态
            return 'text-neutral-600 dark:text-neutral-400';
        } else {
            // 注水步骤使用统一样式
            return 'text-neutral-600 dark:text-neutral-400';
        }
    }, [activeTab]);

    // 获取标题样式 - 统一使用相同的样式
    const titleStyle = useMemo(() => {
        return 'text-neutral-800 dark:text-neutral-100';
    }, []);

    // 获取透明度样式 - 注水步骤中未到达的步骤降低透明度
    const opacityStyle = useMemo(() => {
        if (activeTab === '注水' && !isCurrentStage && index > currentStage) {
            return 'opacity-50';
        }
        return '';
    }, [activeTab, isCurrentStage, index, currentStage]);

    // 处理点击事件，如果是分隔符则切换折叠状态
    const handleClick = (e: React.MouseEvent) => {
        if (step.isDivider) {
            e.stopPropagation();
            setIsCommonSectionCollapsed(!isCommonSectionCollapsed);
            return;
        }
        onClick();
    };

    // 获取操作菜单项
    const actionMenuItems = useMemo(() => {
        const items = [];
        
        if (onEdit) {
            items.push({
                id: 'edit',
                label: '编辑',
                onClick: onEdit,
            });
        }
        
        if (onDelete) {
            items.push({
                id: 'delete',
                label: '删除',
                onClick: onDelete,
            });
        }

        if (onShare) {
            items.push({
                id: 'share',
                label: '分享',
                onClick: onShare,
            });
        }
        
        return items;
    }, [onEdit, onDelete, onShare]);

    // 渲染阶段内容
    const renderStageContent = () => {
        if (step.isDivider) {
            return (
                <div 
                    className="relative flex items-center mb-4 cursor-pointer"
                    onClick={handleClick}
                >
                    <div className="grow border-t border-neutral-200 dark:border-neutral-800"></div>
                    <button className="flex items-center justify-center mx-3 text-[10px] font-medium text-neutral-600 dark:text-neutral-400">
                        {step.dividerText || ''}
                        <svg
                            className={`ml-1 w-3 h-3 transition-transform duration-200 ${isCommonSectionCollapsed ? 'rotate-180' : ''}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                    <div className="grow border-t border-neutral-200 dark:border-neutral-800"></div>
                </div>
            );
        }

        return (
            <div className={`group relative ${compactMode && activeTab === '注水' ? '' : `border-l ${isWaitingStage ? 'border-dashed' : ''} border-neutral-200 pl-6 dark:border-neutral-800`} ${textStyle} ${opacityStyle}`}>
                {isCurrentStage && !compactMode && (
                    <motion.div
                        className={`absolute -left-px top-0 h-full w-px ${isWaitingStage ? 'bg-neutral-600 dark:bg-neutral-400' : 'bg-neutral-800 dark:bg-white'}`}
                        initial={{ scaleY: 0, transformOrigin: "top" }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.26, ease: 'linear' }}
                    />
                )}
                <div className={activeTab !== '注水' ? 'cursor-pointer' : ''} onClick={handleClick}>
                    {compactMode && activeTab === '注水' && selectedMethod && step.originalIndex !== undefined && step.items ? (
                        // 简洁模式渲染
                        (() => {
                            const compactDesc = generateCompactDescription(step, showFlowRate, allSteps);
                            if (!compactDesc) return null;

                            return (
                                <div className="space-y-3 py-3">
                                    {/* 主要描述 - 自然语言 */}
                                    <div className="text-xl font-medium text-neutral-600 dark:text-neutral-400 leading-relaxed">
                                        {compactDesc.isBypassStep ? (
                                            // Bypass 步骤的简洁处理
                                            <>
                                                <span className="opacity-100">{compactDesc.title}</span>
                                                <span className="opacity-80">，添加 </span>
                                                <span className="opacity-100">{compactDesc.waterAmount}</span>
                                            </>
                                        ) : compactDesc.isWaitingStep ? (
                                            // 等待步骤的特殊处理 - 显示原始标题而不是硬编码的"等待"
                                            <>
                                                <span className="opacity-100">{compactDesc.title}</span>
                                                {compactDesc.timeInfo && (
                                                    <>
                                                        <span className="opacity-80">，持续到 </span>
                                                        {compactDesc.timeInfo.minutes !== '0' && (
                                                            <>
                                                                <span className="opacity-100">{compactDesc.timeInfo.minutes}</span>
                                                                <span className="opacity-80"> 分 </span>
                                                            </>
                                                        )}
                                                        <span className="opacity-100">{compactDesc.timeInfo.seconds}</span>
                                                        <span className="opacity-80"> 秒</span>
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            // 注水步骤的正常处理
                                            <>
                                                {/* 注水方式 */}
                                                <span className="opacity-100">{compactDesc.title}</span>

                                                {/* 时间信息 */}
                                                {compactDesc.timeInfo && (
                                                    <>
                                                        <span className="opacity-80">，在 </span>
                                                        {compactDesc.timeInfo.minutes !== '0' && (
                                                            <>
                                                                <span className="opacity-100">{compactDesc.timeInfo.minutes}</span>
                                                                <span className="opacity-80"> 分 </span>
                                                            </>
                                                        )}
                                                        <span className="opacity-100">{compactDesc.timeInfo.seconds}</span>
                                                        <span className="opacity-80"> 秒时</span>
                                                    </>
                                                )}

                                                {/* 水量信息 */}
                                                {compactDesc.waterAmount && (
                                                    <>
                                                        <span className="opacity-80">，注水量达到 </span>
                                                        <span className="opacity-100">{compactDesc.waterAmount}</span>
                                                    </>
                                                )}

                                                {/* 流速信息 */}
                                                {compactDesc.flowRateInfo && (
                                                    <>
                                                        <span className="opacity-80">，流速 </span>
                                                        <span className="opacity-100">{compactDesc.flowRateInfo}</span>
                                                        <span className="opacity-100">g/s</span>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* 详细描述 - 简洁模式下不显示 */}

                                    {/* 操作菜单 */}
                                    {(onEdit || onDelete || onShare) && (
                                        <div className="flex items-baseline">
                                            <ActionMenu
                                                items={actionMenuItems}
                                                showAnimation={false}
                                                onStop={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })()
                    ) : (
                        // 原有的标准模式渲染
                        <>
                            <div className="flex items-baseline justify-between">
                                <div className="flex items-baseline gap-3 min-w-0 overflow-hidden">
                                    {step.icon && (
                                        <span className="text-xs mr-1">{step.icon}</span>
                                    )}
                                    <h3 className={`text-xs font-medium tracking-wider truncate ${titleStyle}`}>
                                        {step.title}
                                    </h3>
                                    {/* 注水阶段显示时间和水量 */}
                                    {activeTab === '注水' && selectedMethod && step.originalIndex !== undefined && step.items && (
                                        <div className="flex items-baseline gap-3 text-xs font-medium text-neutral-800 dark:text-neutral-100 shrink-0">
                                            {/* Bypass 步骤不显示时间，其他步骤显示时间 */}
                                            {!isBypassStep && (step.endTime !== undefined || step.note || step.time !== undefined) && (
                                                <>
                                                    <span>
                                                        {step.endTime !== undefined
                                                            ? formatTime(step.endTime, true)
                                                            : step.note
                                                                ? formatTime(parseInt(String(step.note)), true)
                                                                : step.time !== undefined
                                                                    ? formatTime(step.time, true)
                                                                    : ""}
                                                    </span>
                                                    <span>·</span>
                                                </>
                                            )}
                                            <span>{step.items[0]}</span>
                                            {showFlowRate && step.type === 'pour' && step.note && (
                                                <>
                                                    <span>·</span>
                                                    <span>
                                                        {allSteps.length > 0
                                                            ? calculateImprovedFlowRate(step, allSteps).toFixed(1)
                                                            : calculateFlowRate(step.items[0], step.note).toFixed(1)}g/s
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {step.description && (
                                    <p className={`text-xs font-medium truncate ${textStyle}`}>
                                        {step.description}
                                    </p>
                                )}
                                {step.detail && (
                                    <p className={`text-xs font-medium truncate ${textStyle}`}>
                                        {step.detail}
                                    </p>
                                )}
                                {(onEdit || onDelete || onShare) && (
                                    <div className="flex items-baseline ml-2 shrink-0">
                                        <ActionMenu
                                            items={actionMenuItems}
                                            showAnimation={false}
                                            onStop={(e) => e.stopProkupagation()}
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="mt-2">
                                {activeTab === '注水' && step.items ? (
                                    <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">{step.items[1]}</p>
                                ) : step.items ? (
                                    <ul className="space-y-1">
                                        {step.items.map((item: string, i: number) => (
                                            <li key={i} className={`text-xs font-medium ${textStyle}`}>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                            </div>
                        </>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div
            className="group relative"
            onClick={handleClick}
        >
            {renderStageContent()}
        </div>
    );
}

export default StageItem