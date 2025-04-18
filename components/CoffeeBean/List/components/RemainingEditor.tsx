'use client'

import React, { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

interface RemainingEditorProps {
    value: string
    position: { x: number, y: number } | null
    onChange: (value: string) => void
    onSave: () => void
    onCancel: () => void
    onQuickDecrement: (amount: number) => void
}

const RemainingEditor: React.FC<RemainingEditorProps> = ({
    value,
    position,
    onChange,
    onSave,
    onCancel,
    onQuickDecrement
}) => {
    const inputRef = useRef<HTMLInputElement>(null)

    // 自动聚焦输入框
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [])

    // 添加键盘事件处理
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Enter') {
                event.preventDefault()
                onSave()
            } else if (event.key === 'Escape') {
                event.preventDefault()
                onCancel()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [onSave, onCancel])

    if (!position) return null

    return (
        <motion.div
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
                <div className="flex items-center">
                    <input
                        ref={inputRef}
                        type="number"
                        className="w-16 text-sm bg-transparent border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 text-neutral-800 dark:text-neutral-100 outline-none focus:border-neutral-400 dark:focus:border-neutral-500"
                        value={value}
                        min="0"
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault()
                                onSave()
                            } else if (e.key === 'Escape') {
                                e.preventDefault()
                                onCancel()
                            }
                        }}
                    />
                    <span className="text-sm flex items-center ml-1 text-neutral-800 dark:text-neutral-100">g</span>
                    <div className="flex ml-2">
                        <button 
                            className="text-sm text-white bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-800 rounded px-2 py-1 ml-1"
                            onClick={onSave}
                        >
                            确定
                        </button>
                    </div>
                </div>
                
                {/* 快捷按钮组 */}
                <div className="flex space-x-1 pt-1">
                    <button
                        className="flex-1 text-[10px] bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-200 rounded py-1 transition-colors"
                        onClick={() => onQuickDecrement(15)}
                    >
                        -15
                    </button>
                    <button
                        className="flex-1 text-[10px] bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-200 rounded py-1 transition-colors"
                        onClick={() => onQuickDecrement(16)}
                    >
                        -16
                    </button>
                    <button
                        className="flex-1 text-[10px] bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-200 rounded py-1 transition-colors"
                        onClick={() => onQuickDecrement(18)}
                    >
                        -18
                    </button>
                </div>
            </div>
        </motion.div>
    )
}

export default RemainingEditor 