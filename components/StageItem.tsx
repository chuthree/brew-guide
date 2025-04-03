import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Method } from '@/lib/config'
import ActionMenu from './ui/action-menu'
import { Step } from '@/lib/hooks/useBrewingState'

interface StageItemProps {
    step: Step
    index: number
    onClick: () => void
    activeTab: string
    selectedMethod: Method | null
    currentStage: number
    onEdit?: () => void
    onDelete?: () => void
    actionMenuStates: Record<string, boolean>
    setActionMenuStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
}

// 辅助函数：格式化时间
const formatTime = (seconds: number, compact: boolean = false) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60

    if (compact) {
        // 简洁模式: 1'20" 或 45"
        return mins > 0
            ? `${mins}'${secs.toString().padStart(2, '0')}"`
            : `${secs}"`
    }
    // 完整模式: 1:20 (用于主计时器显示)
    return `${mins}:${secs.toString().padStart(2, '0')}`
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
    actionMenuStates,
    setActionMenuStates,
}) => {
    // 创建一个唯一的ID来标识这个卡片
    const cardId = useMemo(() => 
        `${activeTab}-${step.methodId || step.title}-${index}`, 
        [activeTab, step.methodId, step.title, index]
    );
    
    // 检查这个卡片的菜单是否应该显示
    const showActions = actionMenuStates[cardId] || false

    // 判断是否为等待阶段
    const isWaitingStage = step.type === 'wait';

    // 判断是否为当前阶段
    const isCurrentStage = activeTab === '注水' && index === currentStage;
    
    // 获取文本样式
    const textStyle = useMemo(() => 
        isCurrentStage
            ? 'text-neutral-800 dark:text-white'
            : 'text-neutral-600 dark:text-neutral-400',
        [isCurrentStage]
    );

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
        
        return items;
    }, [onEdit, onDelete]);

    // 处理菜单开关变更
    const handleOpenChange = (open: boolean) => {
        setActionMenuStates(prev => ({
            ...prev,
            [cardId]: open
        }))
    }

    // 渲染阶段内容
    const renderStageContent = () => {
        return (
            <div className={`group relative border-l ${isWaitingStage ? 'border-dashed' : ''} border-neutral-200 pl-6 dark:border-neutral-800 ${textStyle}`}>
                {isCurrentStage && (
                    <motion.div
                        className={`absolute -left-px top-0 h-full w-px ${isWaitingStage ? 'bg-neutral-600 dark:bg-neutral-400' : 'bg-neutral-800 dark:bg-white'}`}
                        initial={{ scaleY: 0, transformOrigin: "top" }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.26, ease: 'linear' }}
                    />
                )}
                <div className={activeTab !== '注水' ? 'cursor-pointer' : ''} onClick={onClick}>
                    <div className="flex items-baseline justify-between">
                        <div className="flex items-baseline gap-3 min-w-0 overflow-hidden">
                            <h3 className={`text-xs font-normal tracking-wider truncate ${isCurrentStage ? 'text-neutral-800 dark:text-white' : ''}`}>
                                {step.title}
                            </h3>
                            {activeTab === '注水' && selectedMethod && step.originalIndex !== undefined && step.items && step.note && (
                                <div className="flex items-baseline gap-2 text-[10px] text-neutral-600 dark:text-neutral-400 shrink-0">
                                    <span>{step.endTime ? formatTime(step.endTime, true) : formatTime(parseInt(step.note), true)}</span>
                                    <span>·</span>
                                    <span>{step.items[0]}</span>
                                </div>
                            )}
                        </div>
                        {step.description && (
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                                {step.description}
                            </p>
                        )}
                        {onEdit && onDelete && (
                            <div className="flex items-baseline ml-2 shrink-0">
                                <ActionMenu
                                    items={actionMenuItems}
                                    showAnimation={false}
                                    isOpen={showActions}
                                    onOpenChange={handleOpenChange}
                                    onStop={(e) => e.stopPropagation()}
                                />
                            </div>
                        )}
                    </div>
                    <div className="mt-2">
                        {activeTab === '注水' && step.items ? (
                            <p className={`text-xs font-light ${textStyle}`}>{step.items[1]}</p>
                        ) : step.items ? (
                            <ul className="space-y-1">
                                {step.items.map((item: string, i: number) => (
                                    <li key={i} className="text-xs font-light text-neutral-600 dark:text-neutral-400">
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div
            className={`group relative ${
                currentStage === index
                    ? 'text-neutral-800 dark:text-white'
                    : 'text-neutral-600 dark:text-neutral-400'
            }`}
            onClick={onClick}
        >
            {renderStageContent()}
        </div>
    );
}

export default StageItem