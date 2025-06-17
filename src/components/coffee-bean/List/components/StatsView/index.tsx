'use client'

import React, { useMemo, useRef, useState, useEffect } from 'react'
import { StatsViewProps } from './types'
import { calculateStats, stardomFontStyle, formatNumber } from './utils'
import BeanImageGallery from './BeanImageGallery'
import StatsSummary, { calculateEstimatedFinishDate } from './StatsSummary'
import StatsCategories from './StatsCategories'

import { useAnimation } from './useAnimation'
import { useConsumption } from './useConsumption'
import { ArrowUpRight } from 'lucide-react'
import type { BrewingNote } from '@/lib/core/config'
import { motion, AnimatePresence } from 'framer-motion'

// 时间区间选项
export type TimeRange = 'all' | 'week' | 'month'

export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
    all: '目前为止',
    week: '近一周内',
    month: '近一个月内'
}

// 计算方式选项
export type CalculationMode = 'natural' | 'coffee'

export const CALCULATION_MODE_LABELS: Record<CalculationMode, string> = {
    natural: '按照自然日',
    coffee: '按照咖啡日'
}

// 根据时间区间计算消耗数据
const calculateTimeRangeConsumption = async (beans: any[], timeRange: TimeRange) => {
    try {
        // 获取所有冲煮记录
        const { Storage } = await import('@/lib/core/storage');
        const notesStr = await Storage.get('brewingNotes')
        if (!notesStr) return {
            consumption: 0,
            cost: 0,
            espressoConsumption: 0,
            espressoCost: 0,
            filterConsumption: 0,
            filterCost: 0
        }

        const notes: BrewingNote[] = JSON.parse(notesStr)
        if (!Array.isArray(notes)) return {
            consumption: 0,
            cost: 0,
            espressoConsumption: 0,
            espressoCost: 0,
            filterConsumption: 0,
            filterCost: 0
        }

        // 计算时间范围
        const now = Date.now()
        const dayInMs = 24 * 60 * 60 * 1000
        let cutoffTime = 0

        if (timeRange === 'week') {
            cutoffTime = now - (7 * dayInMs)
        } else if (timeRange === 'month') {
            cutoffTime = now - (30 * dayInMs)
        } else {
            // 'all' - 不设置时间限制
            cutoffTime = 0
        }

        // 筛选时间范围内的冲煮记录
        const filteredNotes = timeRange === 'all'
            ? notes
            : notes.filter(note => note.timestamp >= cutoffTime)

        // 计算消耗数据
        let consumption = 0
        let cost = 0
        let espressoConsumption = 0
        let espressoCost = 0
        let filterConsumption = 0
        let filterCost = 0

        filteredNotes.forEach(note => {
            // 只排除容量调整记录，快捷扣除记录需要计入统计
            if (note.source === 'capacity-adjustment') {
                return;
            }

            // 处理快捷扣除记录
            if (note.source === 'quick-decrement' && note.quickDecrementAmount) {
                const coffeeAmount = note.quickDecrementAmount;
                if (!isNaN(coffeeAmount)) {
                    consumption += coffeeAmount;

                    // 根据咖啡豆类型判断消耗分类
                    const bean = note.coffeeBeanInfo?.name ?
                               beans.find(b => b.name === note.coffeeBeanInfo?.name) : null;

                    const isEspresso = bean?.beanType === 'espresso';
                    const isFilter = bean?.beanType === 'filter';

                    // 分别统计手冲和意式消耗
                    if (isEspresso) {
                        espressoConsumption += coffeeAmount;
                    } else if (isFilter) {
                        filterConsumption += coffeeAmount;
                    }

                    // 计算花费
                    if (note.coffeeBeanInfo?.name) {
                        const bean = beans.find(b => b.name === note.coffeeBeanInfo?.name)
                        if (bean && bean.price && bean.capacity) {
                            const price = parseFloat(bean.price.toString().replace(/[^\d.]/g, ''))
                            const capacity = parseFloat(bean.capacity.toString().replace(/[^\d.]/g, ''))
                            if (!isNaN(price) && !isNaN(capacity) && capacity > 0) {
                                const noteCost = coffeeAmount * price / capacity
                                cost += noteCost

                                if (isEspresso) {
                                    espressoCost += noteCost;
                                } else if (isFilter) {
                                    filterCost += noteCost;
                                }
                            }
                        }
                    }
                }
            } else if (note.params?.coffee) {
                // 处理普通冲煮笔记
                // 提取咖啡量中的数字部分
                const match = note.params.coffee.match(/(\d+(\.\d+)?)/);
                if (match) {
                    const coffeeAmount = parseFloat(match[0]);
                    if (!isNaN(coffeeAmount)) {
                        consumption += coffeeAmount;

                        // 根据咖啡豆类型判断消耗分类
                        const bean = note.coffeeBeanInfo?.name ?
                                   beans.find(b => b.name === note.coffeeBeanInfo?.name) : null;

                        const isEspresso = bean?.beanType === 'espresso';
                        const isFilter = bean?.beanType === 'filter';

                        // 分别统计手冲和意式消耗
                        if (isEspresso) {
                            espressoConsumption += coffeeAmount;
                        } else if (isFilter) {
                            filterConsumption += coffeeAmount;
                        }

                        // 计算花费
                        if (note.coffeeBeanInfo?.name) {
                            const bean = beans.find(b => b.name === note.coffeeBeanInfo?.name)
                            if (bean && bean.price && bean.capacity) {
                                const price = parseFloat(bean.price.toString().replace(/[^\d.]/g, ''))
                                const capacity = parseFloat(bean.capacity.toString().replace(/[^\d.]/g, ''))
                                if (!isNaN(price) && !isNaN(capacity) && capacity > 0) {
                                    const noteCost = coffeeAmount * price / capacity
                                    cost += noteCost

                                    if (isEspresso) {
                                        espressoCost += noteCost;
                                    } else if (isFilter) {
                                        filterCost += noteCost;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })

        return {
            consumption,
            cost,
            espressoConsumption,
            espressoCost,
            filterConsumption,
            filterCost
        }
    } catch (error) {
        console.error('计算时间区间消耗失败:', error)
        return {
            consumption: 0,
            cost: 0,
            espressoConsumption: 0,
            espressoCost: 0,
            filterConsumption: 0,
            filterCost: 0
        }
    }
}

const StatsView: React.FC<StatsViewProps> = ({ beans, showEmptyBeans, onStatsShare }) => {
    const statsContainerRef = useRef<HTMLDivElement>(null)
    const [username, setUsername] = useState<string>('')
    const [espressoAverageConsumption, setEspressoAverageConsumption] = useState<number>(0)
    const [filterAverageConsumption, setFilterAverageConsumption] = useState<number>(0)

    // 时间区间状态
    const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('all')
    const [showTimeRangeDropdown, setShowTimeRangeDropdown] = useState(false)
    const [timeRangeButtonPosition, setTimeRangeButtonPosition] = useState<{
        top: number;
        left: number;
        width: number;
    } | null>(null)

    // 计算方式状态
    const [calculationMode, setCalculationMode] = useState<CalculationMode>('coffee')

    // 实际天数状态
    const [actualDays, setActualDays] = useState<number>(1)



    // 根据时间区间过滤咖啡豆数据
    const filteredBeans = useMemo(() => {
        if (selectedTimeRange === 'all') {
            return beans
        }

        const now = Date.now()
        const dayInMs = 24 * 60 * 60 * 1000
        let cutoffTime = 0

        if (selectedTimeRange === 'week') {
            cutoffTime = now - (7 * dayInMs)
        } else if (selectedTimeRange === 'month') {
            cutoffTime = now - (30 * dayInMs)
        }

        // 过滤在指定时间范围内有活动的咖啡豆
        return beans.filter(bean => {
            // 如果没有时间戳，保留所有豆子（向后兼容）
            if (!bean.timestamp) return true

            // 检查豆子的创建时间或最后更新时间
            return bean.timestamp >= cutoffTime
        })
    }, [beans, selectedTimeRange])

    // 根据时间区间获取消耗数据（暂时保留，可能用于未来功能）
    const [_timeRangeConsumptionData, _setTimeRangeConsumptionData] = useState({
        consumption: 0,
        cost: 0,
        espressoConsumption: 0,
        espressoCost: 0,
        filterConsumption: 0,
        filterCost: 0
    })

    // 异步计算时间区间消耗数据（暂时保留，可能用于未来功能）
    useEffect(() => {
        const loadTimeRangeConsumption = async () => {
            const data = await calculateTimeRangeConsumption(filteredBeans, selectedTimeRange)
            _setTimeRangeConsumptionData(data)
        }
        loadTimeRangeConsumption()
    }, [filteredBeans, selectedTimeRange])

    // 获取今日消耗数据（保持原有逻辑用于"今日"显示）
    const todayConsumptionData = useConsumption(filteredBeans)
    const { consumption: todayConsumption } = todayConsumptionData

    // 获取统计数据 - 修复今日消耗显示问题
    const stats = useMemo(() => {
        // 对于"今日"显示，应该使用真正的今日消耗数据，而不是时间区间数据
        const todayConsumptionForStats = {
            espressoConsumption: todayConsumptionData.espressoConsumption,
            espressoCost: todayConsumptionData.espressoCost,
            filterConsumption: todayConsumptionData.filterConsumption,
            filterCost: todayConsumptionData.filterCost
        };

        return calculateStats(filteredBeans, showEmptyBeans, todayConsumptionForStats);
    }, [filteredBeans, showEmptyBeans, todayConsumptionData])

    // 时间区间切换处理函数
    const updateTimeRangeButtonPosition = () => {
        const buttonElement = (window as any).timeRangeButtonRef
        if (buttonElement) {
            const rect = buttonElement.getBoundingClientRect()
            setTimeRangeButtonPosition({
                top: rect.top,
                left: rect.left,
                width: rect.width
            })
        }
    }

    const handleToggleTimeRangeDropdown = () => {
        if (!showTimeRangeDropdown) {
            updateTimeRangeButtonPosition()
        }
        setShowTimeRangeDropdown(!showTimeRangeDropdown)
    }

    const handleTimeRangeChange = (timeRange: TimeRange) => {
        setSelectedTimeRange(timeRange)
        setShowTimeRangeDropdown(false)
    }

    // 计算方式切换处理函数
    const handleCalculationModeToggle = () => {
        setCalculationMode(prev => prev === 'natural' ? 'coffee' : 'natural')
    }

    // 计算实际天数的函数
    const calculateActualDays = useMemo(() => {
        return async (): Promise<number> => {
            try {
                // 获取所有冲煮笔记
                const { Storage } = await import('@/lib/core/storage');
                const notesStr = await Storage.get('brewingNotes')
                if (!notesStr) return 1

                const notes: BrewingNote[] = JSON.parse(notesStr)
                if (!Array.isArray(notes)) return 1

                // 计算时间范围
                const now = Date.now()
                const dayInMs = 24 * 60 * 60 * 1000
                let cutoffTime = 0
                let totalDays = 1

                if (selectedTimeRange === 'week') {
                    cutoffTime = now - (7 * dayInMs)
                    totalDays = 7
                } else if (selectedTimeRange === 'month') {
                    cutoffTime = now - (30 * dayInMs)
                    totalDays = 30
                } else {
                    // 'all' - 使用全部数据计算
                    cutoffTime = 0
                }

                // 获取所有咖啡豆名称列表
                const beanNames = filteredBeans.map(bean => bean.name)
                if (beanNames.length === 0) return 1

                // 筛选出相关的笔记记录，只排除容量调整记录
                let relevantNotes = notes.filter(note => {
                    // 只排除容量调整记录，快捷扣除记录需要计入统计
                    if (note.source === 'capacity-adjustment') {
                        return false;
                    }
                    return note.coffeeBeanInfo?.name && beanNames.includes(note.coffeeBeanInfo.name)
                })

                // 根据时间区间过滤
                if (selectedTimeRange !== 'all') {
                    relevantNotes = relevantNotes.filter(note => note.timestamp >= cutoffTime)
                } else {
                    // 对于"目前为止"，计算实际的天数
                    if (relevantNotes.length > 0) {
                        const firstNoteTimestamp = Math.min(...relevantNotes.map(note => note.timestamp))
                        totalDays = Math.max(1, Math.ceil((now - firstNoteTimestamp) / dayInMs))
                    }
                }

                if (relevantNotes.length === 0) return totalDays

                // 根据计算模式确定实际天数
                if (calculationMode === 'coffee') {
                    // 咖啡日模式：计算实际有冲煮记录的天数
                    const uniqueDays = new Set<string>()
                    relevantNotes.forEach(note => {
                        const date = new Date(note.timestamp)
                        const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
                        uniqueDays.add(dateKey)
                    })
                    totalDays = Math.max(1, uniqueDays.size)
                }
                // 自然日模式：使用固定的天数（已在上面设置）

                return totalDays
            } catch (error) {
                console.error('计算实际天数失败:', error)
                return 1
            }
        }
    }, [filteredBeans, selectedTimeRange, calculationMode])

    // 点击外部关闭时间区间下拉菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showTimeRangeDropdown) {
                const target = event.target as Element
                if (!target.closest('[data-time-range-selector]')) {
                    setShowTimeRangeDropdown(false)
                }
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showTimeRangeDropdown])

    // 平均消耗计算函数 - 基于时间区间和冲煮记录
    const calculateAverageConsumption = useMemo(() => {
        return async (beanType: 'espresso' | 'filter'): Promise<number> => {
            try {
                // 获取所有冲煮笔记
                const { Storage } = await import('@/lib/core/storage');
                const notesStr = await Storage.get('brewingNotes')
                if (!notesStr) return 0

                const notes: BrewingNote[] = JSON.parse(notesStr)
                if (!Array.isArray(notes)) return 0

                // 计算时间范围
                const now = Date.now()
                const dayInMs = 24 * 60 * 60 * 1000
                let cutoffTime = 0
                let totalDays = 1

                if (selectedTimeRange === 'week') {
                    cutoffTime = now - (7 * dayInMs)
                    totalDays = 7
                } else if (selectedTimeRange === 'month') {
                    cutoffTime = now - (30 * dayInMs)
                    totalDays = 30
                } else {
                    // 'all' - 使用全部数据计算
                    cutoffTime = 0
                }

                // 获取该类型的咖啡豆名称列表
                const beanNames = filteredBeans
                    .filter(bean => bean.beanType === beanType)
                    .map(bean => bean.name)

                if (beanNames.length === 0) return 0

                // 筛选出相关的笔记记录，只排除容量调整记录
                let relevantNotes = notes.filter(note => {
                    // 只排除容量调整记录，快捷扣除记录需要计入统计
                    if (note.source === 'capacity-adjustment') {
                        return false;
                    }
                    return note.coffeeBeanInfo?.name && beanNames.includes(note.coffeeBeanInfo.name)
                })

                // 根据时间区间过滤
                if (selectedTimeRange !== 'all') {
                    relevantNotes = relevantNotes.filter(note => note.timestamp >= cutoffTime)
                } else {
                    // 对于"目前为止"，计算实际的天数
                    if (relevantNotes.length > 0) {
                        const firstNoteTimestamp = Math.min(...relevantNotes.map(note => note.timestamp))
                        totalDays = Math.max(1, Math.ceil((now - firstNoteTimestamp) / dayInMs))
                    }
                }

                if (relevantNotes.length === 0) return 0

                // 根据计算模式确定实际天数
                if (calculationMode === 'coffee') {
                    // 咖啡日模式：计算实际有冲煮记录的天数
                    const uniqueDays = new Set<string>()
                    relevantNotes.forEach(note => {
                        const date = new Date(note.timestamp)
                        const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
                        uniqueDays.add(dateKey)
                    })
                    totalDays = Math.max(1, uniqueDays.size)
                }
                // 自然日模式：使用固定的天数（已在上面设置）

                // 计算总消耗量
                let totalConsumption = 0
                relevantNotes.forEach(note => {
                    // 处理快捷扣除记录
                    if (note.source === 'quick-decrement' && note.quickDecrementAmount) {
                        const coffeeAmount = note.quickDecrementAmount;
                        if (!isNaN(coffeeAmount)) {
                            totalConsumption += coffeeAmount;
                        }
                    } else if (note.params?.coffee) {
                        // 处理普通冲煮笔记
                        // 提取咖啡量中的数字部分
                        const match = note.params.coffee.match(/(\d+(\.\d+)?)/)
                        if (match) {
                            const coffeeAmount = parseFloat(match[0])
                            if (!isNaN(coffeeAmount)) {
                                totalConsumption += coffeeAmount
                            }
                        }
                    }
                })

                // 计算平均每天消耗量
                return totalConsumption / totalDays
            } catch (error) {
                console.error('计算平均消耗失败:', error)
                return 0
            }
        }
    }, [filteredBeans, selectedTimeRange, calculationMode])
    

    
    // 动画控制
    const { imagesLoaded, textLoaded: _textLoaded, styles } = useAnimation()

    // 获取具有图片的咖啡豆，用于渲染半圆图片
    const beansWithImages = useMemo(() => {
        return beans
            .filter(bean => bean.image && bean.image.length > 0)
            .slice(0, 7) // 最多取7个豆子的图片用于展示
    }, [beans])
    
    // 获取用户名
    useEffect(() => {
        const fetchUsername = async () => {
            try {
                const { Storage } = await import('@/lib/core/storage');
                const settingsStr = await Storage.get('brewGuideSettings');
                if (settingsStr) {
                    const settings = JSON.parse(settingsStr);
                    setUsername(settings.username?.trim() || '');
                }
            } catch (e) {
                console.error('获取用户设置失败', e);
            }
        };

        fetchUsername();
    }, []);

    // 计算平均消耗
    useEffect(() => {
        const calculateConsumptions = async () => {
            const hasEspresso = stats.espressoStats && stats.espressoStats.totalBeans > 0;
            const hasFilter = stats.filterStats && stats.filterStats.totalBeans > 0;

            if (hasEspresso) {
                const espressoAvg = await calculateAverageConsumption('espresso');
                setEspressoAverageConsumption(espressoAvg);
            }

            if (hasFilter) {
                const filterAvg = await calculateAverageConsumption('filter');
                setFilterAverageConsumption(filterAvg);
            }
        };

        calculateConsumptions();
    }, [stats, calculateAverageConsumption]);

    // 计算实际天数
    useEffect(() => {
        const updateActualDays = async () => {
            const days = await calculateActualDays();
            setActualDays(days);
        };

        updateActualDays();
    }, [calculateActualDays]);

    return (
        <div className="bg-neutral-50 dark:bg-neutral-900 overflow-x-hidden coffee-bean-stats-container">
            {/* 时间区间下拉菜单 - 参考导航栏风格 */}
            <AnimatePresence>
                {showTimeRangeDropdown && (
                    <>
                        {/* 背景模糊层 */}
                        <motion.div
                            initial={{
                                opacity: 0,
                                backdropFilter: 'blur(0px)'
                            }}
                            animate={{
                                opacity: 1,
                                backdropFilter: 'blur(20px)',
                                transition: {
                                    opacity: {
                                        duration: 0.2,
                                        ease: [0.25, 0.46, 0.45, 0.94]
                                    },
                                    backdropFilter: {
                                        duration: 0.3,
                                        ease: [0.25, 0.46, 0.45, 0.94]
                                    }
                                }
                            }}
                            exit={{
                                opacity: 0,
                                backdropFilter: 'blur(0px)',
                                transition: {
                                    opacity: {
                                        duration: 0.15,
                                        ease: [0.4, 0.0, 1, 1]
                                    },
                                    backdropFilter: {
                                        duration: 0.2,
                                        ease: [0.4, 0.0, 1, 1]
                                    }
                                }
                            }}
                            className="fixed inset-0 z-[60]"
                            style={{
                                backgroundColor: 'color-mix(in srgb, var(--background) 40%, transparent)',
                                WebkitBackdropFilter: 'blur(4px)'
                            }}
                            onClick={() => setShowTimeRangeDropdown(false)}
                        />

                        {/* 当前选中的时间区间选项 */}
                        {timeRangeButtonPosition && (
                            <motion.div
                                initial={{ opacity: 1, scale: 1 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{
                                    opacity: 0,
                                    scale: 0.98,
                                    transition: {
                                        duration: 0.12,
                                        ease: [0.4, 0.0, 1, 1]
                                    }
                                }}
                                className="fixed z-[80]"
                                style={{
                                    top: `${timeRangeButtonPosition.top}px`,
                                    left: `${timeRangeButtonPosition.left}px`,
                                    minWidth: `${timeRangeButtonPosition.width}px`
                                }}
                                data-time-range-selector
                            >
                                <motion.button
                                    initial={{ opacity: 1 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 1 }}
                                    onClick={() => setShowTimeRangeDropdown(false)}
                                    className="text-sm font-medium tracking-widest whitespace-nowrap transition-colors text-left flex items-center text-neutral-800 dark:text-neutral-100 cursor-pointer"
                                >
                                    <span className="relative inline-block">
                                        {TIME_RANGE_LABELS[selectedTimeRange]}
                                    </span>
                                </motion.button>
                            </motion.div>
                        )}

                        {/* 其他时间区间选项 */}
                        {timeRangeButtonPosition && (
                            <motion.div
                                initial={{
                                    opacity: 0,
                                    y: -8,
                                    scale: 0.96
                                }}
                                animate={{
                                    opacity: 1,
                                    y: 0,
                                    scale: 1,
                                    transition: {
                                        duration: 0.25,
                                        ease: [0.25, 0.46, 0.45, 0.94]
                                    }
                                }}
                                exit={{
                                    opacity: 0,
                                    y: -6,
                                    scale: 0.98,
                                    transition: {
                                        duration: 0.15,
                                        ease: [0.4, 0.0, 1, 1]
                                    }
                                }}
                                className="fixed z-[80]"
                                style={{
                                    top: `${timeRangeButtonPosition.top + 30}px`,
                                    left: `${timeRangeButtonPosition.left}px`,
                                    minWidth: `${timeRangeButtonPosition.width}px`
                                }}
                                data-time-range-selector
                            >
                                <div className="flex flex-col">
                                    {Object.entries(TIME_RANGE_LABELS)
                                        .filter(([key]) => key !== selectedTimeRange)
                                        .map(([key, label], index) => (
                                            <motion.button
                                                key={key}
                                                initial={{
                                                    opacity: 0,
                                                    y: -6,
                                                    scale: 0.98
                                                }}
                                                animate={{
                                                    opacity: 1,
                                                    y: 0,
                                                    scale: 1,
                                                    transition: {
                                                        delay: index * 0.04,
                                                        duration: 0.2,
                                                        ease: [0.25, 0.46, 0.45, 0.94]
                                                    }
                                                }}
                                                exit={{
                                                    opacity: 0,
                                                    y: -4,
                                                    scale: 0.98,
                                                    transition: {
                                                        delay: (Object.keys(TIME_RANGE_LABELS).length - index - 1) * 0.02,
                                                        duration: 0.12,
                                                        ease: [0.4, 0.0, 1, 1]
                                                    }
                                                }}
                                                onClick={() => handleTimeRangeChange(key as TimeRange)}
                                                className="text-sm font-medium tracking-widest whitespace-nowrap transition-colors text-left pb-3 flex items-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                                                style={{ paddingBottom: '12px' }}
                                            >
                                                <span className="relative inline-block">
                                                    {label}
                                                </span>
                                            </motion.button>
                                        ))}
                                </div>
                            </motion.div>
                        )}
                    </>
                )}
            </AnimatePresence>

            {/* 添加字体定义 */}
            <style jsx global>{`
                @font-face {
                    font-family: 'Stardom';
                    src: url('/font/Stardom-Regular.otf') format('opentype');
                    font-weight: normal;
                    font-style: normal;
                    font-display: swap;
                }
            `}</style>
            
            <div ref={statsContainerRef}>
                {/* 只在有图片的咖啡豆存在时才显示半圆豆子图片展示 */}
                {beansWithImages.length > 0 && (
                    <BeanImageGallery beansWithImages={beansWithImages} imagesLoaded={imagesLoaded} />
                )}

                <div className="px-4 pb-6 pt-12 flex flex-col items-center">
                    <div 
                        className="text-3xl font-bold text-center tracking-wider text-neutral-800 dark:text-neutral-100 z-10" 
                        style={{...stardomFontStyle, ...styles.titleAnimStyle}}
                    >
                        BREW <br />
                        <p>
                            <span>GUIDE — COUNT </span><br />
                        </p>
                    </div>
                    
                    <div 
                        className="text-sm font-medium text-center tracking-wider text-neutral-800 dark:text-neutral-100 my-4 mb-6" 
                        style={styles.usernameAnimStyle}
                    >
                        <p className='opacity-20'>/</p>
                        <p className='mt-6'>{username ? `@${username}` : ''}</p>
                    </div>
                    
                    <div
                        className="w-full flex justify-between items-center space-x-2 text-[10px] uppercase tracking-widest"
                        style={styles.infoAnimStyle}
                    >
                        <div className="">✦</div>
                        <StatsSummary
                            stats={stats}
                            todayConsumption={todayConsumption}
                            selectedTimeRange={TIME_RANGE_LABELS[selectedTimeRange]}
                            onToggleTimeRangeDropdown={handleToggleTimeRangeDropdown}
                            showTimeRangeDropdown={showTimeRangeDropdown}
                            calculationMode={CALCULATION_MODE_LABELS[calculationMode]}
                            onToggleCalculationMode={handleCalculationModeToggle}
                            actualDays={actualDays}
                        />
                        <div className="">✦</div>
                    </div>
                    
                    {/* 简化后的统计信息布局 */}
                    <div
                        className="w-full max-w-xs mx-auto px-4 pb-6 pt-2 space-y-3 text-sm font-medium"
                        style={styles.infoAnimStyle}
                    >
                        {(() => {
                            const hasEspresso = stats.espressoStats && stats.espressoStats.totalBeans > 0;
                            const hasFilter = stats.filterStats && stats.filterStats.totalBeans > 0;

                            // 使用新的平均消耗计算结果

                            const espressoFinishDate = hasEspresso ? calculateEstimatedFinishDate({
                                ...stats,
                                remainingWeight: stats.espressoStats.remainingWeight,
                                consumedWeight: stats.espressoStats.consumedWeight,
                                totalWeight: stats.espressoStats.totalWeight
                            }, stats.espressoStats.todayConsumption > 0 ? stats.espressoStats.todayConsumption : espressoAverageConsumption) : '';

                            const filterFinishDate = hasFilter ? calculateEstimatedFinishDate({
                                ...stats,
                                remainingWeight: stats.filterStats.remainingWeight,
                                consumedWeight: stats.filterStats.consumedWeight,
                                totalWeight: stats.filterStats.totalWeight
                            }, stats.filterStats.todayConsumption > 0 ? stats.filterStats.todayConsumption : filterAverageConsumption) : '';

                            // 如果有两种豆子，显示两个独立的统计块
                            if (hasEspresso && hasFilter) {
                                return (
                                    <>
                                        {/* 意式豆统计 */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">意式豆</span>
                                                <span className="text-neutral-800 dark:text-white font-mono">
                                                    {formatNumber(stats.espressoStats.remainingWeight)}/{formatNumber(stats.espressoStats.totalWeight)}克
                                                </span>
                                            </div>

                                            {/* 进度条 */}
                                            <div className="relative h-1 bg-neutral-200 dark:bg-neutral-800">
                                                {/* 剩余部分 - 实色（表示还有的） */}
                                                <div
                                                    className="absolute top-0 left-0 h-full bg-neutral-800 dark:bg-neutral-200 transition-all duration-300"
                                                    style={{
                                                        width: `${stats.espressoStats.totalWeight > 0 ? (stats.espressoStats.remainingWeight / stats.espressoStats.totalWeight) * 100 : 0}%`
                                                    }}
                                                />
                                                {/* 消耗部分 - 斜线纹理（表示已用掉的） */}
                                                <div
                                                    className="absolute top-0 h-full transition-all duration-300"
                                                    style={{
                                                        left: `${stats.espressoStats.totalWeight > 0 ? (stats.espressoStats.remainingWeight / stats.espressoStats.totalWeight) * 100 : 0}%`,
                                                        width: `${stats.espressoStats.totalWeight > 0 ? (stats.espressoStats.consumedWeight / stats.espressoStats.totalWeight) * 100 : 100}%`,
                                                        background: 'repeating-linear-gradient(45deg, transparent, transparent 1px, rgba(0,0,0,0.15) 1px, rgba(0,0,0,0.15) 2px)'
                                                    }}
                                                />
                                            </div>

                                            {/* 消耗预估 */}
                                            <div className="space-y-1 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-neutral-600 dark:text-neutral-400">今日</span>
                                                    <span className="text-neutral-800 dark:text-white font-mono">{formatNumber(stats.espressoStats.todayConsumption)}克</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-neutral-600 dark:text-neutral-400">平均</span>
                                                    <span className="text-neutral-800 dark:text-white font-mono">{formatNumber(espressoAverageConsumption)}克/天</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-neutral-600 dark:text-neutral-400">预计用完</span>
                                                    <span className="text-neutral-800 dark:text-white font-mono">{espressoFinishDate}</span>
                                                </div>
                                            </div>


                                        </div>

                                        {/* 手冲豆统计 */}
                                        <div className="space-y-2 border-t border-neutral-200 dark:border-neutral-800 pt-3">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">手冲豆</span>
                                                <span className="text-neutral-800 dark:text-white font-mono">
                                                    {formatNumber(stats.filterStats.remainingWeight)}/{formatNumber(stats.filterStats.totalWeight)}克
                                                </span>
                                            </div>

                                            {/* 进度条 */}
                                            <div className="relative h-1 bg-neutral-200 dark:bg-neutral-800">
                                                {/* 剩余部分 - 实色（表示还有的） */}
                                                <div
                                                    className="absolute top-0 left-0 h-full bg-neutral-800 dark:bg-neutral-200 transition-all duration-300"
                                                    style={{
                                                        width: `${stats.filterStats.totalWeight > 0 ? (stats.filterStats.remainingWeight / stats.filterStats.totalWeight) * 100 : 0}%`
                                                    }}
                                                />
                                                {/* 消耗部分 - 斜线纹理（表示已用掉的） */}
                                                <div
                                                    className="absolute top-0 h-full transition-all duration-300"
                                                    style={{
                                                        left: `${stats.filterStats.totalWeight > 0 ? (stats.filterStats.remainingWeight / stats.filterStats.totalWeight) * 100 : 0}%`,
                                                        width: `${stats.filterStats.totalWeight > 0 ? (stats.filterStats.consumedWeight / stats.filterStats.totalWeight) * 100 : 100}%`,
                                                        background: 'repeating-linear-gradient(45deg, transparent, transparent 1px, rgba(0,0,0,0.15) 1px, rgba(0,0,0,0.15) 2px)'
                                                    }}
                                                />
                                            </div>

                                            {/* 消耗预估 */}
                                            <div className="space-y-1 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-neutral-600 dark:text-neutral-400">今日</span>
                                                    <span className="text-neutral-800 dark:text-white font-mono">{formatNumber(stats.filterStats.todayConsumption)}克</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-neutral-600 dark:text-neutral-400">平均</span>
                                                    <span className="text-neutral-800 dark:text-white font-mono">{formatNumber(filterAverageConsumption)}克/天</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-neutral-600 dark:text-neutral-400">预计用完</span>
                                                    <span className="text-neutral-800 dark:text-white font-mono">{filterFinishDate}</span>
                                                </div>
                                            </div>


                                        </div>
                                    </>
                                );
                            }

                            // 如果只有一种豆子，显示对应的统计块
                            if (hasEspresso) {
                                return (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">意式豆</span>
                                            <span className="text-neutral-800 dark:text-white font-mono">
                                                {formatNumber(stats.espressoStats.remainingWeight)}/{formatNumber(stats.espressoStats.totalWeight)}克
                                            </span>
                                        </div>

                                        {/* 进度条 */}
                                        <div className="relative h-1 bg-neutral-200 dark:bg-neutral-800">
                                            {/* 剩余部分 - 实色（表示还有的） */}
                                            <div
                                                className="absolute top-0 left-0 h-full bg-neutral-800 dark:bg-neutral-200 transition-all duration-300"
                                                style={{
                                                    width: `${stats.espressoStats.totalWeight > 0 ? (stats.espressoStats.remainingWeight / stats.espressoStats.totalWeight) * 100 : 0}%`
                                                }}
                                            />
                                            {/* 消耗部分 - 斜线纹理（表示已用掉的） */}
                                            <div
                                                className="absolute top-0 h-full transition-all duration-300"
                                                style={{
                                                    left: `${stats.espressoStats.totalWeight > 0 ? (stats.espressoStats.remainingWeight / stats.espressoStats.totalWeight) * 100 : 0}%`,
                                                    width: `${stats.espressoStats.totalWeight > 0 ? (stats.espressoStats.consumedWeight / stats.espressoStats.totalWeight) * 100 : 100}%`,
                                                    background: 'repeating-linear-gradient(45deg, transparent, transparent 1px, rgba(0,0,0,0.15) 1px, rgba(0,0,0,0.15) 2px)'
                                                }}
                                            />
                                        </div>

                                        {/* 消耗预估 */}
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-neutral-600 dark:text-neutral-400">今日</span>
                                                <span className="text-neutral-800 dark:text-white font-mono">{formatNumber(stats.espressoStats.todayConsumption)}克</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-neutral-600 dark:text-neutral-400">平均</span>
                                                <span className="text-neutral-800 dark:text-white font-mono">{formatNumber(espressoAverageConsumption)}克/天</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-neutral-600 dark:text-neutral-400">预计用完</span>
                                                <span className="text-neutral-800 dark:text-white font-mono">{espressoFinishDate}</span>
                                            </div>
                                        </div>


                                    </div>
                                );
                            }

                            if (hasFilter) {
                                return (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">手冲豆</span>
                                            <span className="text-neutral-800 dark:text-white font-mono">
                                                {formatNumber(stats.filterStats.remainingWeight)}/{formatNumber(stats.filterStats.totalWeight)}克
                                            </span>
                                        </div>

                                        {/* 进度条 */}
                                        <div className="relative h-1 bg-neutral-200 dark:bg-neutral-800">
                                            {/* 剩余部分 - 实色（表示还有的） */}
                                            <div
                                                className="absolute top-0 left-0 h-full bg-neutral-800 dark:bg-neutral-200 transition-all duration-300"
                                                style={{
                                                    width: `${stats.filterStats.totalWeight > 0 ? (stats.filterStats.remainingWeight / stats.filterStats.totalWeight) * 100 : 0}%`
                                                }}
                                            />
                                            {/* 消耗部分 - 斜线纹理（表示已用掉的） */}
                                            <div
                                                className="absolute top-0 h-full transition-all duration-300"
                                                style={{
                                                    left: `${stats.filterStats.totalWeight > 0 ? (stats.filterStats.remainingWeight / stats.filterStats.totalWeight) * 100 : 0}%`,
                                                    width: `${stats.filterStats.totalWeight > 0 ? (stats.filterStats.consumedWeight / stats.filterStats.totalWeight) * 100 : 100}%`,
                                                    background: 'repeating-linear-gradient(45deg, transparent, transparent 1px, rgba(0,0,0,0.15) 1px, rgba(0,0,0,0.15) 2px)'
                                                }}
                                            />
                                        </div>

                                        {/* 消耗预估 */}
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-neutral-600 dark:text-neutral-400">今日</span>
                                                <span className="text-neutral-800 dark:text-white font-mono">{formatNumber(stats.filterStats.todayConsumption)}克</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-neutral-600 dark:text-neutral-400">平均</span>
                                                <span className="text-neutral-800 dark:text-white font-mono">{formatNumber(filterAverageConsumption)}克/天</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-neutral-600 dark:text-neutral-400">预计用完</span>
                                                <span className="text-neutral-800 dark:text-white font-mono">{filterFinishDate}</span>
                                            </div>
                                        </div>


                                    </div>
                                );
                            }

                            return null;
                        })()}
                    </div>
                </div>

                <div className="p-4 max-w-xs mx-auto">
                    <StatsCategories
                        stats={stats}
                        beans={filteredBeans}
                        todayConsumption={todayConsumptionData.consumption}
                        todayCost={todayConsumptionData.cost}
                        styles={styles}
                    />
                </div>
            </div>

            <div className="p-4 max-w-xs mx-auto text-center">
                <button
                    onClick={onStatsShare}
                    className="mx-auto text-center pb-1.5 text-[11px] font-medium relative text-neutral-600 dark:text-neutral-400"
                >
                    <span className="relative underline underline-offset-2 decoration-sky-500">分享 (包含费用数据)</span>
                    <ArrowUpRight className="inline-block ml-1 w-3 h-3" />
                </button>
            </div>
        </div>
    )
}

export default StatsView 