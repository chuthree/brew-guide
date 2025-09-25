'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { defaultSettings, SettingsOptions } from '@/components/settings/Settings'
import { cn } from '@/lib/utils/classNameUtils'
import { CoffeeBean } from '@/types/app'
import { BrewingNoteData } from '@/types/app'
import hapticsUtils from '@/lib/ui/haptics'

interface RemainingEditorProps {
    position?: { x: number, y: number } | null
    targetElement?: HTMLElement | null
    onQuickDecrement: (amount: number) => void
    onCancel: () => void
    isOpen?: boolean
    onOpenChange?: (open: boolean) => void
    className?: string
    coffeeBean?: CoffeeBean // 添加咖啡豆对象属性，用于创建笔记
}

const RemainingEditor: React.FC<RemainingEditorProps> = ({
    position,
    targetElement,
    onQuickDecrement,
    onCancel,
    isOpen,
    onOpenChange,
    className,
    coffeeBean
}) => {
    // 状态管理
    const [internalOpen, setInternalOpen] = useState(false)
    const open = isOpen !== undefined ? isOpen : internalOpen
    const [positionStyle, setPositionStyle] = useState<React.CSSProperties>({})
    const [decrementValues, setDecrementValues] = useState<number[]>(defaultSettings.decrementPresets)
    const [enableAllOption, setEnableAllOption] = useState<boolean>(defaultSettings.enableAllDecrementOption)
    const [enableCustomInput, setEnableCustomInput] = useState<boolean>(defaultSettings.enableCustomDecrementInput)
    const [customValue, setCustomValue] = useState<string>('')
    const [hapticEnabled, setHapticEnabled] = useState<boolean>(defaultSettings.hapticFeedback)
    
    // 引用管理
    const popoverRef = useRef<HTMLDivElement>(null)
    const isMounted = useRef(false)
    const safeTargetRef = useRef<HTMLElement | null>(null)
    const _isExiting = useRef(false)
    
    // 安全的状态更新函数
    const safeSetState = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => {
        return (value: T) => {
            if (isMounted.current) {
                setter(value);
            }
        };
    };
    
    // 组件挂载和卸载处理
    useEffect(() => {
        isMounted.current = true
        safeTargetRef.current = targetElement || null
        
        // 清理函数
        return () => {
            isMounted.current = false
        }
    }, [targetElement])
    
    // 更新开关状态
    const setOpen = useCallback((value: boolean) => {
        if (!isMounted.current) return

        setInternalOpen(value)
        onOpenChange?.(value)

        if (!value) {
            onCancel()
        }
    }, [onOpenChange, onCancel])
    
    // 加载设置（预设值 + 功能开关）
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const { Storage } = await import('@/lib/core/storage');
                const settingsStr = await Storage.get('brewGuideSettings')
                if (settingsStr) {
                    const settings = JSON.parse(settingsStr) as SettingsOptions
                    if (settings.decrementPresets?.length > 0) {
                        safeSetState(setDecrementValues)(settings.decrementPresets)
                    } else {
                        safeSetState(setDecrementValues)(defaultSettings.decrementPresets)
                    }
                    safeSetState(setEnableAllOption)(settings.enableAllDecrementOption ?? defaultSettings.enableAllDecrementOption)
                    safeSetState(setEnableCustomInput)(settings.enableCustomDecrementInput ?? defaultSettings.enableCustomDecrementInput)
                    safeSetState(setHapticEnabled)(settings.hapticFeedback ?? defaultSettings.hapticFeedback)
                } else {
                    // 无本地设置时回退到默认
                    safeSetState(setDecrementValues)(defaultSettings.decrementPresets)
                    safeSetState(setEnableAllOption)(defaultSettings.enableAllDecrementOption)
                    safeSetState(setEnableCustomInput)(defaultSettings.enableCustomDecrementInput)
                    safeSetState(setHapticEnabled)(defaultSettings.hapticFeedback)
                }
            } catch (error) {
                console.error('加载库存扣除设置失败:', error)
            }
        }

        loadSettings().catch(error => {
            console.error('初始化加载设置失败:', error)
        })

        // 监听设置变更
        const handleSettingsChange = (e: CustomEvent) => {
            if (e.detail?.key === 'brewGuideSettings' && isMounted.current) {
                loadSettings().catch(error => {
                    console.error('设置变更时加载设置失败:', error)
                })
            }
        }

        window.addEventListener('storageChange', handleSettingsChange as EventListener)
        return () => {
            window.removeEventListener('storageChange', handleSettingsChange as EventListener)
        }
    }, [])

    // 添加键盘事件处理
    useEffect(() => {
        if (!open) return
        
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isMounted.current) {
                event.preventDefault()
                setOpen(false)
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [open, setOpen])

    // 计算和更新位置
    const updatePosition = useCallback(() => {
        if (!isMounted.current) return;

        if (position) {
            setPositionStyle({
                left: `${position.x}px`,
                top: `${position.y}px`,
            });
            return;
        }

        const safeTarget = safeTargetRef.current;

        if (safeTarget && document.body.contains(safeTarget)) {
            try {
                const rect = safeTarget.getBoundingClientRect();

                const DROPDOWN_WIDTH = 120;
                const DROPDOWN_HEIGHT = 40;
                const WINDOW_WIDTH = window.innerWidth;
                const WINDOW_HEIGHT = window.innerHeight;
                const SAFE_PADDING = 10;

                let top = rect.bottom + 8;
                let left = rect.left;

                if (left + DROPDOWN_WIDTH > WINDOW_WIDTH - SAFE_PADDING) {
                    left = Math.max(SAFE_PADDING, WINDOW_WIDTH - DROPDOWN_WIDTH - SAFE_PADDING);
                }

                if (top + DROPDOWN_HEIGHT > WINDOW_HEIGHT - SAFE_PADDING) {
                    top = rect.top - DROPDOWN_HEIGHT - 8;
                }

                if (isMounted.current) {
                    setPositionStyle({
                        left: `${left}px`,
                        top: `${top}px`
                    });
                }
            } catch (error) {
                console.error('计算位置时出错:', error);
                if (isMounted.current) {
                    setPositionStyle({
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)'
                    });
                }
            }
        }
    }, [position]);

    // 实时更新位置
    useEffect(() => {
        if (!open) return
        
        updatePosition()
        
        window.addEventListener('scroll', updatePosition, true)
        window.addEventListener('resize', updatePosition)
        
        return () => {
            window.removeEventListener('scroll', updatePosition, true)
            window.removeEventListener('resize', updatePosition)
        }
    }, [open, targetElement, position, updatePosition])

    // 添加点击外部关闭功能
    useEffect(() => {
        if (!open) return

        const handleClickOutside = (event: MouseEvent) => {
            if (!isMounted.current) return
            
            const isInMenu = popoverRef.current && popoverRef.current.contains(event.target as Node)
            const safeTarget = safeTargetRef.current
            const isOnTarget = safeTarget && document.body.contains(safeTarget) && safeTarget.contains(event.target as Node)
            
            if (!isInMenu && !isOnTarget) {
                setOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside, true)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true)
        }
    }, [open, setOpen])

    // 阻止事件冒泡
    const handleStop = (e: React.MouseEvent) => {
        e.stopPropagation()
    }
    
    // 创建自动笔记 - 根据实际扣除量创建变动记录
    const createAutoNote = async (requestedAmount: number, actualAmount: number) => {
        if (!coffeeBean || !isMounted.current) return

        const processingTimestamp = Date.now()

        try {
            // 创建一个默认的笔记数据
            const newNote: BrewingNoteData = {
                id: processingTimestamp.toString(),
                timestamp: processingTimestamp,
                source: 'quick-decrement',
                quickDecrementAmount: actualAmount, // 使用实际扣除量
                beanId: coffeeBean.id,
                equipment: '', // 添加空的equipment字段，避免显示"未知器具"
                method: '', // 添加空的method字段
                coffeeBeanInfo: {
                    name: coffeeBean.name || '',
                    roastLevel: coffeeBean.roastLevel || '中度烘焙',
                    roastDate: coffeeBean.roastDate
                },
                notes: '快捷扣除',
                rating: 0,
                taste: { acidity: 0, sweetness: 0, bitterness: 0, body: 0 },
                params: {
                    coffee: `${actualAmount}g`, // 使用实际扣除量
                    water: '',
                    ratio: '',
                    grindSize: '',
                    temp: ''
                },
                totalTime: 0 // 添加totalTime字段，快捷扣除记录没有时间概念
            }
            
            const { Storage } = await import('@/lib/core/storage');
            const existingNotesStr = await Storage.get('brewingNotes')
            if (!isMounted.current) return

            const existingNotes = existingNotesStr ? JSON.parse(existingNotesStr) : []
            const updatedNotes = [newNote, ...existingNotes]

            // 立即同步更新全局缓存，避免竞态条件
            try {
                const { globalCache } = await import('@/components/notes/List/globalCache');
                globalCache.notes = updatedNotes;

                // 重新计算总消耗量
                const { calculateTotalCoffeeConsumption } = await import('@/components/notes/List/globalCache');
                globalCache.totalConsumption = calculateTotalCoffeeConsumption(updatedNotes);
            } catch (error) {
                console.error('更新全局缓存失败:', error);
            }

            if (!isMounted.current) return

            // 保存到存储 - Storage.set() 会自动触发事件
            await Storage.set('brewingNotes', JSON.stringify(updatedNotes))

            if (isMounted.current) {
                console.warn('快捷扣除自动创建笔记成功')
            }
        } catch (error) {
            console.error('创建快捷扣除笔记失败:', error)
        }
    }
    
    // 执行快捷扣除（统一逻辑）
    const performQuickDecrement = async (value: number) => {
        if (!isMounted.current || !coffeeBean) return
        try {
            setOpen(false)
            const currentRemaining = parseFloat(coffeeBean.remaining || '0')
            const actualDecrementAmount = Math.min(value, currentRemaining)
            onQuickDecrement(value)
            await createAutoNote(value, actualDecrementAmount)
            if (hapticEnabled) {
                try { 
                    hapticsUtils.light() 
                } catch (_error) {
                    // 静默处理触觉反馈错误
                }
            }
        } catch (error) {
            console.error('快捷扣除操作失败:', error)
        }
    }

    // 预设扣除点击
    const handleDecrementClick = async (e: React.MouseEvent, value: number) => {
        e.stopPropagation()
        await performQuickDecrement(value)
    }

    // ALL 扣除点击
    const handleAllClick = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!coffeeBean) return
        const currentRemaining = Math.max(0, parseFloat(coffeeBean.remaining || '0'))
        if (currentRemaining > 0) {
            await performQuickDecrement(currentRemaining)
        }
    }

    // 自定义输入应用
    const handleCustomApply = async (e?: React.MouseEvent) => {
        e?.stopPropagation()
        const num = parseFloat(customValue)
        if (!isNaN(num) && num > 0) {
            await performQuickDecrement(num)
            setCustomValue('')
        }
    }
    
    if (!position && !targetElement && !open) return null

    return (
        <AnimatePresence mode="wait">
            {open && (
                <motion.div
                    ref={popoverRef}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                        "fixed z-10 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 p-2 max-w-xs",
                        className
                    )}
                    style={positionStyle}
                    onClick={handleStop}
                >
                    <div className="flex flex-wrap gap-1 items-center">
                        {/* 预设值按钮 */}
                        {decrementValues.map((value) => (
                            <button
                                key={value}
                                className="h-6 px-2 text-[10px] bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-200 rounded-sm transition-colors"
                                onClick={(e) => handleDecrementClick(e, value)}
                            >
                                -{value}
                            </button>
                        ))}
                        
                        {/* ALL按钮 */}
                        {enableAllOption && (
                            <button
                                className="h-6 px-2 text-[10px] bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-200 rounded-sm transition-colors"
                                onClick={handleAllClick}
                            >
                                ALL
                            </button>
                        )}
                        
                        {/* 自定义输入 - 连体设计 */}
                        {enableCustomInput && (
                            <div className="flex h-6 bg-neutral-100 dark:bg-neutral-700 rounded-sm overflow-hidden">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    className="w-12 h-full text-[10px] px-1 text-center bg-transparent text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-400 rounded-none"
                                    placeholder="15.5"
                                    value={customValue}
                                    onClick={handleStop}
                                    onChange={(e) => {
                                        const raw = e.target.value.replace(/[^0-9.]/g, '')
                                        const dotCount = (raw.match(/\./g) || []).length
                                        let sanitized = dotCount > 1 ? raw.substring(0, raw.lastIndexOf('.') ) : raw
                                        const dotIndex = sanitized.indexOf('.')
                                        if (dotIndex !== -1 && dotIndex < sanitized.length - 2) {
                                            sanitized = sanitized.substring(0, dotIndex + 2)
                                        }
                                        setCustomValue(sanitized)
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            void handleCustomApply()
                                        }
                                    }}
                                />
                                <button
                                    className="w-6 h-full text-[10px] bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-600 dark:hover:bg-neutral-500 text-neutral-800 dark:text-neutral-200 transition-colors disabled:opacity-40 flex items-center justify-center"
                                    disabled={!customValue || isNaN(parseFloat(customValue)) || parseFloat(customValue) <= 0}
                                    onClick={handleCustomApply}
                                    title="确认扣除"
                                >
                                    ✓
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default RemainingEditor 