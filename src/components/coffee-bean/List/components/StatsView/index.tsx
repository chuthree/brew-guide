'use client'

import React, { useMemo, useRef, useState, useEffect } from 'react'
import { StatsViewProps } from './types'
import { calculateStats, stardomFontStyle, formatNumber } from './utils'
import BeanImageGallery from './BeanImageGallery'
import StatsSummary, { calculateAverageConsumption, calculateEstimatedFinishDate } from './StatsSummary'
import StatsCategories from './StatsCategories'
import { useAnimation } from './useAnimation'
import { useConsumption } from './useConsumption'
import { Storage } from '@/lib/core/storage'
import { ArrowUpRight } from 'lucide-react'
import type { BrewingNote } from '@/lib/core/config'

const StatsView: React.FC<StatsViewProps> = ({ beans, showEmptyBeans, onStatsShare }) => {
    const statsContainerRef = useRef<HTMLDivElement>(null)
    const [username, setUsername] = useState<string>('')
    const [espressoAverageConsumption, setEspressoAverageConsumption] = useState<number>(0)
    const [filterAverageConsumption, setFilterAverageConsumption] = useState<number>(0)

    // 获取今日消耗数据
    const todayConsumptionData = useConsumption(beans)
    const { consumption: todayConsumption, cost: todayCost } = todayConsumptionData

    // 获取统计数据
    const stats = useMemo(() => calculateStats(beans, showEmptyBeans, {
        espressoConsumption: todayConsumptionData.espressoConsumption,
        espressoCost: todayConsumptionData.espressoCost,
        filterConsumption: todayConsumptionData.filterConsumption,
        filterCost: todayConsumptionData.filterCost
    }), [beans, showEmptyBeans, todayConsumptionData])

    // 新的平均消耗计算函数
    const calculateNewAverageConsumption = useMemo(() => {
        return async (beanType: 'espresso' | 'filter'): Promise<number> => {
            try {
                // 获取所有冲煮笔记
                const notesStr = await Storage.get('brewingNotes')
                if (!notesStr) return 0

                const notes: BrewingNote[] = JSON.parse(notesStr)
                if (!Array.isArray(notes)) return 0

                // 获取该类型的咖啡豆名称列表
                const beanNames = beans
                    .filter(bean => bean.beanType === beanType)
                    .map(bean => bean.name)

                if (beanNames.length === 0) return 0

                // 筛选出相关的笔记记录
                const relevantNotes = notes.filter(note => {
                    return note.coffeeBeanInfo?.name && beanNames.includes(note.coffeeBeanInfo.name)
                })

                if (relevantNotes.length === 0) return 0

                // 找到第一次记录日期
                const firstNoteTimestamp = Math.min(...relevantNotes.map(note => note.timestamp))
                const firstDate = new Date(firstNoteTimestamp)
                const today = new Date()

                // 计算总天数（从第一次记录到今天）
                const dayInMs = 24 * 60 * 60 * 1000
                const totalDays = Math.max(1, Math.ceil((today.getTime() - firstDate.getTime()) / dayInMs))

                // 计算总消耗量
                let totalConsumption = 0
                relevantNotes.forEach(note => {
                    if (note.params?.coffee) {
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
    }, [beans])
    
    // 计算平均消耗和预计用完日期
    const averageConsumption = useMemo(() => 
        calculateAverageConsumption(stats), [stats]);
    
    const estimatedFinishDate = useMemo(() => 
        calculateEstimatedFinishDate(stats, todayConsumption > 0 ? todayConsumption : averageConsumption), 
        [stats, todayConsumption, averageConsumption]);
    
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

    // 计算新的平均消耗
    useEffect(() => {
        const calculateConsumptions = async () => {
            const hasEspresso = stats.espressoStats && stats.espressoStats.totalBeans > 0;
            const hasFilter = stats.filterStats && stats.filterStats.totalBeans > 0;

            if (hasEspresso) {
                const espressoAvg = await calculateNewAverageConsumption('espresso');
                setEspressoAverageConsumption(espressoAvg);
            }

            if (hasFilter) {
                const filterAvg = await calculateNewAverageConsumption('filter');
                setFilterAverageConsumption(filterAvg);
            }
        };

        calculateConsumptions();
    }, [stats, calculateNewAverageConsumption]);

    return (
        <div className="bg-neutral-50 dark:bg-neutral-900 overflow-x-hidden coffee-bean-stats-container">
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
                        <StatsSummary stats={stats} todayConsumption={todayConsumption} />
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

                            // 如果没有任何豆子，显示总体统计（兜底情况）
                            return (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">容量概览</span>
                                        <span className="text-neutral-800 dark:text-white font-mono">
                                            {formatNumber(stats.remainingWeight)}/{formatNumber(stats.totalWeight)}克
                                        </span>
                                    </div>

                                    {/* 进度条 */}
                                    <div className="relative h-1 bg-neutral-200 dark:bg-neutral-800">
                                        {/* 剩余部分 - 实色（表示还有的） */}
                                        <div
                                            className="absolute top-0 left-0 h-full bg-neutral-800 dark:bg-neutral-200 transition-all duration-300"
                                            style={{
                                                width: `${stats.totalWeight > 0 ? (stats.remainingWeight / stats.totalWeight) * 100 : 0}%`
                                            }}
                                        />
                                        {/* 消耗部分 - 斜线纹理（表示已用掉的） */}
                                        <div
                                            className="absolute top-0 h-full transition-all duration-300"
                                            style={{
                                                left: `${stats.totalWeight > 0 ? (stats.remainingWeight / stats.totalWeight) * 100 : 0}%`,
                                                width: `${stats.totalWeight > 0 ? (stats.consumedWeight / stats.totalWeight) * 100 : 100}%`,
                                                background: 'repeating-linear-gradient(45deg, transparent, transparent 1px, rgba(0,0,0,0.15) 1px, rgba(0,0,0,0.15) 2px)'
                                            }}
                                        />
                                    </div>

                                    {/* 消耗预估 */}
                                    <div className="space-y-1 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-neutral-600 dark:text-neutral-400">今日</span>
                                            <span className="text-neutral-800 dark:text-white font-mono">{formatNumber(todayConsumption)}克</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-neutral-600 dark:text-neutral-400">平均</span>
                                            <span className="text-neutral-800 dark:text-white font-mono">{formatNumber(averageConsumption)}克/天</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-neutral-600 dark:text-neutral-400">预计用完</span>
                                            <span className="text-neutral-800 dark:text-white font-mono">{estimatedFinishDate}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}


                    </div>
                </div>

                {/* 这里添加一个剩余容量信息百分比，有个圆形图，先由线条画一个圆圈， */}
                {/* <div 
                    className="p-4 max-w-xs mx-auto"
                    style={styles.statsAnimStyle(0)}
                >
                    <div className="w-full flex justify-start">
                        <CapacityCircle 
                            remainingPercentage={stats.totalWeight > 0 
                                ? (stats.remainingWeight / stats.totalWeight) * 100 
                                : 100}
                        />
                    </div>
                </div> */}
                
                {/* 这些数据只是用于编写代码时参考 */}
                <div className="p-4 max-w-xs mx-auto">
                    <StatsCategories
                        stats={stats}
                        beans={beans}
                        todayConsumption={todayConsumption}
                        todayCost={todayCost}
                        styles={styles}
                    />
                </div>

                
            </div>
            {/* 分享按钮 */}
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