'use client'

import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface RemainingEditorProps {
    position: { x: number, y: number } | null
    onQuickDecrement: (amount: number) => void
    onCancel: () => void
}

const RemainingEditor: React.FC<RemainingEditorProps> = ({
    position,
    onQuickDecrement,
    onCancel
}) => {
    // 添加ref引用弹出层DOM元素
    const popoverRef = useRef<HTMLDivElement>(null)

    // 添加键盘事件处理
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                onCancel()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [onCancel])

    // 添加点击外部关闭功能
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onCancel()
            }
        }

        // 延迟一帧添加事件监听，避免触发按钮的点击事件同时触发此事件
        setTimeout(() => {
            document.addEventListener('click', handleClickOutside)
        }, 0)

        return () => {
            document.removeEventListener('click', handleClickOutside)
        }
    }, [onCancel])

    // 快捷减量值数组
    const decrementValues = [15, 16, 18]

    if (!position) return null

    return (
        <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="fixed z-50 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 p-2"
            style={{ 
                left: `${position.x}px`,
                top: `${position.y + 5}px`,
                transform: 'translateX(-50%)'
            }}
        >
            <div className="flex flex-col space-y-2">
                {/* 快捷按钮组 */}
                <div className="flex space-x-1">
                    {decrementValues.map((value) => (
                        <button
                            key={value}
                            className="flex-1 text-[10px] px-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-200 rounded py-1 transition-colors"
                            onClick={() => onQuickDecrement(value)}
                        >
                            -{value}
                        </button>
                    ))}
                </div>
            </div>
        </motion.div>
    )
}

export default RemainingEditor 