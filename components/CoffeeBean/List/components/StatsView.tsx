'use client'

import React, { useMemo, useEffect, useState } from 'react'
import { ExtendedCoffeeBean } from '../types'
import { isBeanEmpty } from '../globalCache'
import { Storage } from '@/lib/storage'

interface StatsViewProps {
    beans: ExtendedCoffeeBean[]
    showEmptyBeans: boolean
}

const StatsView: React.FC<StatsViewProps> = ({ beans, showEmptyBeans }) => {
    const [todayConsumption, setTodayConsumption] = useState(0)
    const [todayCost, setTodayCost] = useState(0)
    
    // 加载今日消耗数据
    useEffect(() => {
        const loadTodayConsumption = async () => {
            try {
                // 获取所有冲煮记录
                const notesStr = await Storage.get('brewingNotes')
                if (!notesStr) return
                
                const notes = JSON.parse(notesStr)
                if (!Array.isArray(notes)) return
                
                // 计算今天的时间戳范围（当天0点到现在）
                const now = new Date()
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
                
                // 筛选今天的冲煮记录
                const todayNotes = notes.filter(note => note.timestamp >= today)
                
                // 计算今日消耗的咖啡量
                let consumption = 0
                let cost = 0
                
                todayNotes.forEach(note => {
                    if (note.params?.coffee) {
                        // 提取咖啡量中的数字部分
                        const match = note.params.coffee.match(/(\d+(\.\d+)?)/);
                        if (match) {
                            const coffeeAmount = parseFloat(match[0]);
                            if (!isNaN(coffeeAmount)) {
                                consumption += coffeeAmount;
                                
                                // 计算花费
                                if (note.coffeeBeanInfo?.name) {
                                    // 找到对应的豆子计算价格
                                    const bean = beans.find(b => b.name === note.coffeeBeanInfo?.name)
                                    if (bean && bean.price && bean.capacity) {
                                        const price = parseFloat(bean.price)
                                        const capacity = parseFloat(bean.capacity)
                                        if (capacity > 0) {
                                            cost += coffeeAmount * price / capacity
                                        }
                                    }
                                }
                            }
                        }
                    }
                })
                
                setTodayConsumption(consumption)
                setTodayCost(cost)
            } catch (err) {
                console.error('加载今日消耗数据失败:', err)
            }
        }
        
        loadTodayConsumption()
        
        // 添加事件监听，当冲煮记录更新时重新计算
        const handleStorageChange = (e: CustomEvent) => {
            if (e.detail?.key === 'brewingNotes') {
                loadTodayConsumption()
            }
        }
        
        window.addEventListener('customStorageChange', handleStorageChange as EventListener)
        window.addEventListener('storage:changed', handleStorageChange as EventListener)
        
        return () => {
            window.removeEventListener('customStorageChange', handleStorageChange as EventListener)
            window.removeEventListener('storage:changed', handleStorageChange as EventListener)
        }
    }, [beans])
    
    // 计算统计数据
    const stats = useMemo(() => {
        // 过滤掉已用完的豆子（如果showEmptyBeans为false）
        const filteredBeans = showEmptyBeans 
            ? beans 
            : beans.filter(bean => !isBeanEmpty(bean))
        
        // 计算咖啡豆总数
        const totalBeans = beans.length

        // 计算已用完的咖啡豆数量
        const emptyBeans = beans.filter(bean => isBeanEmpty(bean)).length

        // 计算正在使用的咖啡豆数量
        const activeBeans = beans.length - emptyBeans

        // 计算总重量（克）
        const totalWeight = filteredBeans.reduce((sum, bean) => {
            const capacity = bean.capacity ? parseFloat(bean.capacity) : 0
            return sum + capacity
        }, 0)
        
        // 计算剩余重量（克）
        const remainingWeight = filteredBeans.reduce((sum, bean) => {
            const remaining = bean.remaining ? parseFloat(bean.remaining) : 0
            return sum + remaining
        }, 0)
        
        // 计算已消耗重量（克）
        const consumedWeight = totalWeight - remainingWeight
        
        // 计算总花费（元）
        const totalCost = filteredBeans.reduce((sum, bean) => {
            const price = bean.price ? parseFloat(bean.price) : 0
            return sum + price
        }, 0)
        
        // 计算平均每豆价格（元）
        const averageBeanPrice = totalBeans > 0 ? totalCost / totalBeans : 0
        
        // 计算平均每克价格（元/克）
        const averageGramPrice = totalWeight > 0 ? totalCost / totalWeight : 0
        
        // 根据烘焙度统计
        const roastLevelCount: Record<string, number> = {}
        filteredBeans.forEach(bean => {
            const roastLevel = bean.roastLevel || '未知'
            roastLevelCount[roastLevel] = (roastLevelCount[roastLevel] || 0) + 1
        })
        
        // 根据产品类型统计
        const typeCount = {
            '单品': filteredBeans.filter(bean => bean.type === '单品').length,
            '拼配': filteredBeans.filter(bean => bean.type === '拼配').length
        }
        
        // 根据豆子用途统计
        const beanTypeCount = {
            'espresso': filteredBeans.filter(bean => bean.beanType === 'espresso').length,
            'filter': filteredBeans.filter(bean => bean.beanType === 'filter').length,
            'other': filteredBeans.filter(bean => !bean.beanType || bean.beanType !== 'espresso' && bean.beanType !== 'filter').length
        }

        // 根据产地统计
        const originCount: Record<string, number> = {}
        filteredBeans.forEach(bean => {
            // 先处理单品豆的产地
            if (bean.origin) {
                const origin = bean.origin
                originCount[origin] = (originCount[origin] || 0) + 1
            }
            
            // 然后处理拼配豆的成分产地
            if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
                bean.blendComponents.forEach(comp => {
                    if (comp.origin) {
                        const origin = comp.origin
                        originCount[origin] = (originCount[origin] || 0) + 1
                    }
                })
            }
        })
        
        // 根据处理法统计
        const processCount: Record<string, number> = {}
        filteredBeans.forEach(bean => {
            // 先处理单品豆的处理法
            if (bean.process) {
                const process = bean.process
                processCount[process] = (processCount[process] || 0) + 1
            }
            
            // 然后处理拼配豆的成分处理法
            if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
                bean.blendComponents.forEach(comp => {
                    if (comp.process) {
                        const process = comp.process
                        processCount[process] = (processCount[process] || 0) + 1
                    }
                })
            }
        })
        
        // 根据品种统计
        const varietyCount: Record<string, number> = {}
        filteredBeans.forEach(bean => {
            // 先处理单品豆的品种
            if (bean.variety) {
                const variety = bean.variety
                varietyCount[variety] = (varietyCount[variety] || 0) + 1
            }
            
            // 然后处理拼配豆的成分品种
            if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
                bean.blendComponents.forEach(comp => {
                    if (comp.variety) {
                        const variety = comp.variety
                        varietyCount[variety] = (varietyCount[variety] || 0) + 1
                    }
                })
            }
        })
        
        // 统计风味标签
        const flavorCount: Record<string, number> = {}
        let totalFlavorTags = 0
        
        filteredBeans.forEach(bean => {
            if (bean.flavor && Array.isArray(bean.flavor)) {
                bean.flavor.forEach(flavor => {
                    flavorCount[flavor] = (flavorCount[flavor] || 0) + 1
                    totalFlavorTags++
                })
            }
        })
        
        // 按频率排序风味标签
        const topFlavors = Object.entries(flavorCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10) // 只取前10个最常见的风味
        
        // 赏味期统计
        const now = Date.now()
        const dayInMs = 24 * 60 * 60 * 1000
        
        // 计算豆子的赏味期状态
        const flavorPeriodStatus = {
            inPeriod: 0, // 在赏味期内
            beforePeriod: 0, // 尚未进入赏味期
            afterPeriod: 0, // 已过赏味期
            unknown: 0, // 未知赏味期
        }
        
        filteredBeans.forEach(bean => {
            // 如果没有烘焙日期或赏味期信息，则归为未知
            if (!bean.roastDate || (bean.startDay === undefined && bean.endDay === undefined)) {
                flavorPeriodStatus.unknown++
                return
            }
            
            try {
                // 尝试解析烘焙日期
                const roastDate = new Date(bean.roastDate)
                
                // 计算从烘焙到现在的天数
                const daysSinceRoast = Math.floor((now - roastDate.getTime()) / dayInMs)
                
                // 根据开始日和结束日判断赏味期状态
                if (bean.startDay !== undefined && bean.endDay !== undefined) {
                    if (daysSinceRoast < bean.startDay) {
                        flavorPeriodStatus.beforePeriod++
                    } else if (daysSinceRoast <= bean.endDay) {
                        flavorPeriodStatus.inPeriod++
                    } else {
                        flavorPeriodStatus.afterPeriod++
                    }
                } else if (bean.startDay !== undefined) {
                    // 只有开始日
                    if (daysSinceRoast < bean.startDay) {
                        flavorPeriodStatus.beforePeriod++
                    } else {
                        flavorPeriodStatus.inPeriod++
                    }
                } else if (bean.endDay !== undefined) {
                    // 只有结束日
                    if (daysSinceRoast <= bean.endDay) {
                        flavorPeriodStatus.inPeriod++
                    } else {
                        flavorPeriodStatus.afterPeriod++
                    }
                } else {
                    flavorPeriodStatus.unknown++
                }
            } catch (_error) {
                // 日期解析错误，归为未知
                flavorPeriodStatus.unknown++
            }
        })

        return {
            totalBeans,
            emptyBeans,
            activeBeans,
            totalWeight,
            remainingWeight,
            consumedWeight,
            totalCost,
            averageBeanPrice,
            averageGramPrice,
            roastLevelCount,
            typeCount,
            beanTypeCount,
            originCount,
            processCount,
            varietyCount,
            topFlavors,
            totalFlavorTags,
            flavorPeriodStatus
        }
    }, [beans, showEmptyBeans])

    // 格式化数字，保留2位小数
    const formatNumber = (num: number) => {
        return num.toFixed(2).replace(/\.00$/, '')
    }
    
    // 生成一行统计数据，左侧是标题，右侧是值，中间用空格填充
    const renderStatItem = (label: string, value: string, unit: string = '', isRight = false) => {
        const combinedValue = `${value}${unit}`;
        
        return (
            <div className={`w-1/2 inline-flex justify-between items-center ${isRight ? 'ml-1.5' : 'mr-1.5'}`}>
                <span className="truncate text-neutral-600 dark:text-neutral-400">{label}</span>
                <span className="ml-2 font-medium whitespace-nowrap">{combinedValue}</span>
            </div>
        );
    }
    
    // 生成一对统计数据，放在同一行
    const renderStatPair = (leftLabel: string, leftValue: string, leftUnit: string, rightLabel: string, rightValue: string, rightUnit: string) => {
        return (
            <div className="text-xs font-normal flex w-full leading-6 mb-1">
                {renderStatItem(leftLabel, leftValue, leftUnit, false)}
                {rightLabel ? renderStatItem(rightLabel, rightValue, rightUnit, true) : <div className="w-1/2"></div>}
            </div>
        )
    }
    
    // 生成一个统计分类的标题行
    const renderSectionHeader = (title: string) => (
        <div className="text-xs font-semibold mt-4 mb-2 text-neutral-800 dark:text-neutral-200">
            {title}
        </div>
    )

    return (
        <div className="px-6">
            {renderSectionHeader('基本数据')}
            {renderStatPair('咖啡豆总数', `${stats.totalBeans}`, '个', '已用完', `${stats.emptyBeans}`, '个')}
            {renderStatPair('正在使用', `${stats.activeBeans}`, '个', '总重量', `${formatNumber(stats.totalWeight)}`, 'g')}
            {renderStatPair('剩余重量', `${formatNumber(stats.remainingWeight)}`, 'g', '已消耗重量', `${formatNumber(stats.consumedWeight)}`, 'g')}
            {renderStatPair('消耗比例', `${stats.totalWeight > 0 ? formatNumber(stats.consumedWeight / stats.totalWeight * 100) : 0}`, '%', '今日消耗', `${formatNumber(todayConsumption)}`, 'g')}
            
            {renderSectionHeader('费用数据')}
            {renderStatPair('总花费', `${formatNumber(stats.totalCost)}`, '元', '平均每豆价格', `${formatNumber(stats.averageBeanPrice)}`, '元')}
            {renderStatPair('每克平均价格', `${formatNumber(stats.averageGramPrice)}`, '元/g', '已消耗咖啡价值', `${formatNumber(stats.consumedWeight * stats.averageGramPrice)}`, '元')}
            {renderStatPair('剩余咖啡价值', `${formatNumber(stats.remainingWeight * stats.averageGramPrice)}`, '元', '今日花费', `${formatNumber(todayCost)}`, '元')}
            
            {renderSectionHeader('豆子分类')}
            {renderStatPair('单品豆', `${stats.typeCount['单品']}`, '个', '拼配豆', `${stats.typeCount['拼配']}`, '个')}
            {renderStatPair('意式豆', `${stats.beanTypeCount.espresso}`, '个', '手冲豆', `${stats.beanTypeCount.filter}`, '个')}
            
            {renderSectionHeader('赏味期状态')}
            {renderStatPair('在赏味期内', `${stats.flavorPeriodStatus.inPeriod}`, '个', '尚未进入赏味期', `${stats.flavorPeriodStatus.beforePeriod}`, '个')}
            {renderStatPair('已过赏味期', `${stats.flavorPeriodStatus.afterPeriod}`, '个', '未设置赏味期', `${stats.flavorPeriodStatus.unknown}`, '个')}
            
            {renderSectionHeader('烘焙度分布')}
            {Object.entries(stats.roastLevelCount)
                .sort((a, b) => b[1] - a[1])
                .reduce((rows, [level, count], index, array) => {
                    // 每两个一组，组成一行
                    if (index % 2 === 0) {
                        // 如果是最后一个且总数为奇数，则单独一行
                        if (index === array.length - 1 && array.length % 2 === 1) {
                            rows.push(renderStatPair(level, `${count}`, '个', '', '', ''));
                        } else if (array[index + 1]) {
                            // 如果有下一个，则组成一对
                            const [nextLevel, nextCount] = array[index + 1];
                            rows.push(renderStatPair(level, `${count}`, '个', nextLevel, `${nextCount}`, '个'));
                        }
                    }
                    return rows;
                }, [] as React.ReactNode[])}
                
            {renderSectionHeader('产地分布')}
            {Object.entries(stats.originCount)
                .sort((a, b) => b[1] - a[1])
                .reduce((rows, [origin, count], index, array) => {
                    if (index % 2 === 0) {
                        if (index === array.length - 1 && array.length % 2 === 1) {
                            rows.push(renderStatPair(origin, `${count}`, '个', '', '', ''));
                        } else if (array[index + 1]) {
                            const [nextOrigin, nextCount] = array[index + 1];
                            rows.push(renderStatPair(origin, `${count}`, '个', nextOrigin, `${nextCount}`, '个'));
                        }
                    }
                    return rows;
                }, [] as React.ReactNode[])}
                
            {renderSectionHeader('处理法分布')}
            {Object.entries(stats.processCount)
                .sort((a, b) => b[1] - a[1])
                .reduce((rows, [process, count], index, array) => {
                    if (index % 2 === 0) {
                        if (index === array.length - 1 && array.length % 2 === 1) {
                            rows.push(renderStatPair(process, `${count}`, '个', '', '', ''));
                        } else if (array[index + 1]) {
                            const [nextProcess, nextCount] = array[index + 1];
                            rows.push(renderStatPair(process, `${count}`, '个', nextProcess, `${nextCount}`, '个'));
                        }
                    }
                    return rows;
                }, [] as React.ReactNode[])}
                
            {renderSectionHeader('品种分布')}
            {Object.entries(stats.varietyCount)
                .sort((a, b) => b[1] - a[1])
                .reduce((rows, [variety, count], index, array) => {
                    if (index % 2 === 0) {
                        if (index === array.length - 1 && array.length % 2 === 1) {
                            rows.push(renderStatPair(variety, `${count}`, '个', '', '', ''));
                        } else if (array[index + 1]) {
                            const [nextVariety, nextCount] = array[index + 1];
                            rows.push(renderStatPair(variety, `${count}`, '个', nextVariety, `${nextCount}`, '个'));
                        }
                    }
                    return rows;
                }, [] as React.ReactNode[])}
                
            {renderSectionHeader('风味标签分布')}
            {renderStatPair('风味标签总数', `${stats.totalFlavorTags}`, '个', '', '', '')}
            {stats.topFlavors
                .reduce((rows, [flavor, count], index, array) => {
                    if (index % 2 === 0) {
                        if (index === array.length - 1 && array.length % 2 === 1) {
                            rows.push(renderStatPair(flavor, `${count}`, '次', '', '', ''));
                        } else if (array[index + 1]) {
                            const [nextFlavor, nextCount] = array[index + 1];
                            rows.push(renderStatPair(flavor, `${count}`, '次', nextFlavor, `${nextCount}`, '次'));
                        }
                    }
                    return rows;
                }, [] as React.ReactNode[])}
        </div>
    )
}

export default StatsView 