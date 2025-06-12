'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { defaultSettings, SettingsOptions } from '@/components/settings/Settings'
import { cn } from '@/lib/utils/classNameUtils'
import { CoffeeBean } from '@/types/app'
import { BrewingNoteData } from '@/types/app'

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
    const setOpen = (value: boolean) => {
        if (!isMounted.current) return
        
        setInternalOpen(value)
        onOpenChange?.(value)
        
        if (!value) {
            onCancel()
        }
    }
    
    // 加载减量预设值
    useEffect(() => {
        const loadPresets = async () => {
            try {
                const { Storage } = await import('@/lib/core/storage');
                const settingsStr = await Storage.get('brewGuideSettings')
                if (settingsStr) {
                    const settings = JSON.parse(settingsStr) as SettingsOptions
                    if (settings.decrementPresets?.length > 0) {
                        safeSetState(setDecrementValues)(settings.decrementPresets)
                    }
                }
            } catch (error) {
                console.error('加载库存扣除预设值失败:', error)
            }
        }
        
        loadPresets()
        
        // 监听设置变更
        const handleSettingsChange = (e: CustomEvent) => {
            if (e.detail?.key === 'brewGuideSettings' && isMounted.current) {
                loadPresets()
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
    }, [open])

    // 计算和更新位置
    const updatePosition = () => {
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
    };

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
    }, [open, targetElement, position])

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
    }, [open])

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
                coffeeBeanInfo: {
                    name: coffeeBean.name || '',
                    roastLevel: coffeeBean.roastLevel || '中度烘焙',
                    roastDate: coffeeBean.roastDate
                },
                notes: actualAmount < requestedAmount
                    ? `快捷扣除${actualAmount}g咖啡豆（剩余不足，已全部扣除）`
                    : `快捷扣除${actualAmount}g咖啡豆`,
                rating: 0,
                taste: { acidity: 0, sweetness: 0, bitterness: 0, body: 0 },
                params: {
                    coffee: `${actualAmount}g`, // 使用实际扣除量
                    water: '',
                    ratio: '',
                    grindSize: '',
                    temp: ''
                }
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
                console.log('快捷扣除自动创建笔记成功')
            }
        } catch (error) {
            console.error('创建快捷扣除笔记失败:', error)
        }
    }
    
    // 安全处理按钮点击 - 修改为先计算实际扣除量
    const handleDecrementClick = async (e: React.MouseEvent, value: number) => {
        e.stopPropagation()
        if (!isMounted.current || !coffeeBean) return

        try {
            setOpen(false)

            // 获取当前剩余量
            const currentRemaining = parseFloat(coffeeBean.remaining || '0')
            // 计算实际扣除量（不能超过剩余量）
            const actualDecrementAmount = Math.min(value, currentRemaining)

            // 执行快捷扣除
            onQuickDecrement(value)

            // 创建变动记录，传入请求量和实际扣除量
            await createAutoNote(value, actualDecrementAmount)
        } catch (error) {
            console.error('快捷扣除操作失败:', error)
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
                        "fixed z-10 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 p-2",
                        className
                    )}
                    style={positionStyle}
                    onClick={handleStop}
                >
                    <div className="flex flex-col space-y-2">
                        <div className={`flex ${decrementValues.length > 3 ? 'flex-wrap gap-1' : 'space-x-1'}`}>
                            {decrementValues.map((value) => (
                                <button
                                    key={value}
                                    className="flex-1 text-[10px] px-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-200 rounded-sm py-1 transition-colors"
                                    onClick={(e) => handleDecrementClick(e, value)}
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