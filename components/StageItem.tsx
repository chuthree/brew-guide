import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Method } from '@/lib/config'

interface StageItemProps {
    step: {
        title: string
        items: string[]
        note: string
        methodId?: string
        type?: 'pour' | 'wait'
        originalIndex?: number
        startTime?: number
        endTime?: number
    }
    index: number
    onClick: () => void
    activeTab: string
    selectedMethod: Method | null
    currentStage: number
    onEdit?: () => void
    onDelete?: () => void
    actionMenuStates: Record<string, boolean>
    setActionMenuStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
    selectedEquipment?: string | null
    customMethods?: Record<string, Method[]>
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
    selectedEquipment,
    customMethods,
}) => {
    // 创建一个唯一的ID来标识这个卡片
    const cardId = `${activeTab}-${step.methodId || step.title}-${index}`
    // 检查这个卡片的菜单是否应该显示
    const showActions = actionMenuStates[cardId] || false
    // 添加复制成功状态
    const [copySuccess, setCopySuccess] = useState(false)

    // 判断是否为等待阶段
    const isWaitingStage = step.type === 'wait';

    // 处理分享方法
    const handleShare = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        if (onEdit && activeTab === '方案' && selectedEquipment && customMethods && customMethods[selectedEquipment]) {
            try {
                // 直接导入jsonUtils中的方法转换函数
                import('@/lib/jsonUtils').then(({ methodToReadableText }) => {
                    const method = customMethods[selectedEquipment][index]
                    const readableText = methodToReadableText(method);

                    // 复制到剪贴板
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(readableText)
                            .then(() => {
                                setCopySuccess(true)
                                setTimeout(() => setCopySuccess(false), 2000)
                            })
                            .catch(() => {
                                alert('复制失败，请手动复制')
                            });
                    } else {
                        // 回退方法：创建临时textarea元素
                        const textArea = document.createElement("textarea");
                        textArea.value = readableText;
                        textArea.style.position = "fixed";
                        textArea.style.left = "-999999px";
                        textArea.style.top = "-999999px";
                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();

                        try {
                            const successful = document.execCommand("copy");
                            if (successful) {
                                setCopySuccess(true)
                                setTimeout(() => setCopySuccess(false), 2000)
                            } else {
                                alert('复制失败，请手动复制')
                            }
                        } catch {
                            alert('复制失败，请手动复制')
                        } finally {
                            document.body.removeChild(textArea);
                        }
                    }
                })
            } catch {
                // 忽略异常
            }
        }
    }, [onEdit, activeTab, index, selectedEquipment, customMethods])

    return (
        <div
            className={`group relative border-l ${isWaitingStage ? 'border-dashed' : ''} border-neutral-200 pl-6 dark:border-neutral-800 ${activeTab === '注水' && index === currentStage
                ? 'text-neutral-800 dark:text-neutral-100'
                : activeTab === '注水' && index < currentStage
                    ? 'text-neutral-500 dark:text-neutral-400'
                    : 'text-neutral-500 dark:text-neutral-400'
                }`}
        >
            {activeTab === '注水' && index === currentStage && (
                <motion.div
                    className={`absolute -left-px top-0 h-full w-px ${isWaitingStage ? 'bg-neutral-500 dark:bg-neutral-400' : 'bg-neutral-800 dark:bg-neutral-100'}`}
                    initial={{ scaleY: 0, transformOrigin: "top" }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.26, ease: 'linear' }}
                />
            )}
            <div className={activeTab !== '注水' ? 'cursor-pointer' : ''} onClick={onClick}>
                <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-3 min-w-0 overflow-hidden">
                        <h3 className={`text-xs font-normal tracking-wider truncate`}>
                            {step.title}
                        </h3>
                        {activeTab === '注水' && selectedMethod && step.originalIndex !== undefined && (
                            <div className="flex items-baseline gap-2 text-[10px] text-neutral-500 dark:text-neutral-400 shrink-0">
                                <span>{step.endTime ? formatTime(step.endTime, true) : formatTime(parseInt(step.note), true)}</span>
                                <span>·</span>
                                <span>{step.items[0]}</span>
                            </div>
                        )}
                    </div>
                    {onEdit && onDelete && (
                        <div className="flex items-baseline ml-2 shrink-0">
                            <AnimatePresence mode="wait">
                                {showActions ? (
                                    <motion.div
                                        key="action-buttons"
                                        initial={{ opacity: 0, scale: 0.9, x: 10 }}
                                        animate={{ opacity: 1, scale: 1, x: 0 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.26, ease: "easeOut" }}
                                        className="flex items-baseline space-x-3"
                                    >
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onEdit()
                                            }}
                                            className="px-2  text-xs text-neutral-400  dark:text-neutral-500"
                                        >
                                            编辑
                                        </button>
                                        <button
                                            onClick={handleShare}
                                            className="px-2  text-xs text-blue-400 dark:text-blue-500 relative"
                                        >
                                            {copySuccess ? '已复制' : '分享'}
                                            {copySuccess && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -10 }}
                                                    className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-neutral-800 dark:bg-neutral-700 text-white px-2 py-1 rounded text-[10px] whitespace-nowrap"
                                                >
                                                    已复制到剪贴板
                                                </motion.div>
                                            )}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onDelete()
                                            }}
                                            className="px-2 text-xs text-red-400"
                                        >
                                            删除
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                // 更新全局状态对象，关闭当前卡片的菜单
                                                setActionMenuStates(prev => ({
                                                    ...prev,
                                                    [cardId]: false
                                                }))
                                            }}
                                            className="w-7 h-7 flex items-center justify-center rounded-full text-sm text-neutral-400"
                                        >
                                            ×
                                        </button>
                                    </motion.div>
                                ) : (
                                    <motion.button
                                        key="more-button"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.26, ease: "easeOut" }}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            // 更新全局状态对象，打开当前卡片的菜单
                                            setActionMenuStates(prev => ({
                                                ...prev,
                                                [cardId]: true
                                            }))
                                        }}
                                        className="w-7 h-7 flex items-center justify-center text-xs text-neutral-500 dark:text-neutral-400"
                                    >
                                        ···
                                    </motion.button>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
                <div className="mt-2">
                    {activeTab === '注水' ? (
                        <p className={`text-xs font-light`}>{step.items[1]}</p>
                    ) : (
                        <ul className="space-y-1">
                            {step.items.map((item: string, i: number) => (
                                <li key={i} className="text-xs font-light">
                                    {item}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    )
}

export default StageItem 