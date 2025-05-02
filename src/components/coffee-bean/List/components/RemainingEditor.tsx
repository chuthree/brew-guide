'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Storage } from '@/lib/storage'
import { defaultSettings, SettingsOptions } from '@/components/settings/Settings'
import { cn } from '@/lib/utils'

interface RemainingEditorProps {
    position?: { x: number, y: number } | null
    targetElement?: HTMLElement | null
    onQuickDecrement: (amount: number) => void
    onCancel: () => void
    isOpen?: boolean
    onOpenChange?: (open: boolean) => void
    className?: string
}

const RemainingEditor: React.FC<RemainingEditorProps> = ({
    position,
    targetElement,
    onQuickDecrement,
    onCancel,
    isOpen,
    onOpenChange,
    className
}) => {
    // 支持内部状态管理或外部控制
    const [internalOpen, setInternalOpen] = React.useState(false)
    const open = isOpen !== undefined ? isOpen : internalOpen
    
    // 添加ref引用弹出层DOM元素
    const popoverRef = useRef<HTMLDivElement>(null)
    
    // 添加位置状态，用于响应滚动更新
    const [positionStyle, setPositionStyle] = useState<React.CSSProperties>({})
    
    // 加载设置中的预设值
    const [decrementValues, setDecrementValues] = React.useState<number[]>(
        defaultSettings.decrementPresets
    )
    
    // 更新开关状态
    const setOpen = (value: boolean) => {
        setInternalOpen(value)
        onOpenChange?.(value)
        // 如果正在关闭菜单，触发onCancel回调
        if (!value) {
            onCancel()
        }
    }
    
    // 初始化时加载设置中的预设值
    React.useEffect(() => {
        const loadPresets = async () => {
            try {
                const settingsStr = await Storage.get('brewGuideSettings')
                if (settingsStr) {
                    const settings = JSON.parse(settingsStr) as SettingsOptions
                    if (settings.decrementPresets && Array.isArray(settings.decrementPresets) && settings.decrementPresets.length > 0) {
                        setDecrementValues(settings.decrementPresets)
                    }
                }
            } catch (error) {
                console.error('加载库存扣除预设值失败:', error)
            }
        }
        
        loadPresets()
    }, [])

    // 添加键盘事件处理
    useEffect(() => {
        if (!open) return
        
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                setOpen(false)
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [open])

    // 计算和更新位置
    const updatePosition = () => {
        // 如果有固定位置，优先使用
        if (position) {
            setPositionStyle({ 
                left: `${position.x}px`,
                top: `${position.y}px`,
            })
            return
        }

        // 如果有目标元素，基于目标元素计算位置
        if (targetElement) {
            const rect = targetElement.getBoundingClientRect()
            
            // 计算组件应该显示的位置
            const DROPDOWN_WIDTH = 120
            const DROPDOWN_HEIGHT = 40
            const WINDOW_WIDTH = window.innerWidth
            const WINDOW_HEIGHT = window.innerHeight
            const SAFE_PADDING = 10 // 安全边距
            
            // 默认在元素下方显示
            let top = rect.bottom + 8
            let left = rect.left
            
            // 检查是否会超出右边界
            if (left + DROPDOWN_WIDTH > WINDOW_WIDTH - SAFE_PADDING) {
                left = Math.max(SAFE_PADDING, WINDOW_WIDTH - DROPDOWN_WIDTH - SAFE_PADDING)
            }
            
            // 检查是否会超出下边界
            if (top + DROPDOWN_HEIGHT > WINDOW_HEIGHT - SAFE_PADDING) {
                // 如果会超出下边界，则改为在目标元素上方显示
                top = rect.top - DROPDOWN_HEIGHT - 8
            }
            
            // 设置位置样式
            setPositionStyle({
                left: `${left}px`,
                top: `${top}px`
            })
        }
    }

    // 监听滚动和调整大小事件，实时更新位置
    useEffect(() => {
        if (!open) return
        
        // 初始化位置
        updatePosition()
        
        // 添加滚动和调整大小事件监听
        window.addEventListener('scroll', updatePosition, true) // 使用捕获阶段确保捕获所有滚动事件
        window.addEventListener('resize', updatePosition)
        
        // 清理事件监听
        return () => {
            window.removeEventListener('scroll', updatePosition, true)
            window.removeEventListener('resize', updatePosition)
        }
    }, [open, targetElement, position])

    // 添加点击外部关闭功能，使用捕获阶段
    useEffect(() => {
        if (!open) return

        const handleClickOutside = (event: MouseEvent) => {
            // 检查点击是否在菜单内或触发按钮上
            const isInMenu = popoverRef.current && popoverRef.current.contains(event.target as Node)
            const isOnTarget = targetElement && targetElement.contains(event.target as Node)
            
            if (!isInMenu && !isOnTarget) {
                setOpen(false)
            }
        }

        // 使用捕获阶段确保在冒泡阶段前处理事件
        document.addEventListener('mousedown', handleClickOutside, true)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true)
        }
    }, [open, targetElement])

    // 阻止事件冒泡
    const handleStop = (e: React.MouseEvent) => {
        e.stopPropagation()
    }

    // 如果没有显示条件则不渲染
    if ((!position && !targetElement) || !open) return null

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    ref={popoverRef}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                        "fixed z-10 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 p-2",
                        className
                    )}
                    style={positionStyle}
                    onClick={handleStop}
                >
                    <div className="flex flex-col space-y-2">
                        {/* 快捷按钮组 */}
                        <div className={`flex ${decrementValues.length > 3 ? 'flex-wrap gap-1' : 'space-x-1'}`}>
                            {decrementValues.map((value) => (
                                <button
                                    key={value}
                                    className="flex-1 text-[10px] px-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-200 rounded py-1 transition-colors"
                                    onClick={() => {
                                        onQuickDecrement(value)
                                        setOpen(false)
                                    }}
                                >
                                    -{value}
                                </button>
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default RemainingEditor 