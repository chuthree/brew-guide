'use client'

import React, { useMemo, useEffect, useState, useRef } from 'react'
import { ExtendedCoffeeBean } from '../types'
import { isBeanEmpty } from '../globalCache'
import { Storage } from '@/lib/storage'
import { Share } from '@capacitor/share'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'
import { toPng } from 'html-to-image'
import { useToast } from '@/components/GlobalToast'
import { ArrowUpRight } from 'lucide-react'

interface StatsViewProps {
    beans: ExtendedCoffeeBean[]
    showEmptyBeans: boolean
}

const StatsView: React.FC<StatsViewProps> = ({ beans, showEmptyBeans }) => {
    const [todayConsumption, setTodayConsumption] = useState(0)
    const [todayCost, setTodayCost] = useState(0)
    const statsContainerRef = useRef<HTMLDivElement>(null)
    const [isExporting, setIsExporting] = useState(false)
    const toast = useToast()
    
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
    
    // 导出统计数据为图片
    const exportStats = async () => {
        if (!statsContainerRef.current) {
            toast.showToast({
                type: 'error',
                title: '无法找到统计数据容器'
            })
            return
        }

        setIsExporting(true)

        try {
            // 创建一个临时容器用于导出
            const tempContainer = document.createElement('div')
            const isDarkMode = document.documentElement.classList.contains('dark')
            const backgroundColor = isDarkMode ? '#171717' : '#fafafa'
            
            // 设置样式
            tempContainer.style.backgroundColor = backgroundColor
            tempContainer.style.maxWidth = '100%'
            tempContainer.style.padding = '20px'
            tempContainer.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
            
            if (isDarkMode) {
                tempContainer.classList.add('dark')
            }
            
            // 复制统计内容到临时容器
            const clone = statsContainerRef.current.cloneNode(true) as HTMLElement
            
            // 添加标题
            const title = document.createElement('h2')
            title.innerText = `${stats.totalBeans} 款咖啡豆统计数据`
            title.style.textAlign = 'left'
            title.style.marginBottom = '16px'
            title.style.fontSize = '12px'
            title.style.color = isDarkMode ? '#f5f5f5' : '#262626'
            
            tempContainer.appendChild(title)
            tempContainer.appendChild(clone)
            
            // 添加底部标记
            const footer = document.createElement('p')
            footer.innerText = '—— Brew Guide'
            footer.style.textAlign = 'left'
            footer.style.marginTop = '16px'
            footer.style.fontSize = '11px'
            footer.style.color = isDarkMode ? '#a3a3a3' : '#525252'
            
            tempContainer.appendChild(footer)
            
            // 添加到文档以便能够导出
            document.body.appendChild(tempContainer)
            
            // 使用html-to-image生成PNG
            const imageData = await toPng(tempContainer, {
                quality: 1,
                pixelRatio: 5,
                backgroundColor: backgroundColor,
            })
            
            // 删除临时容器
            document.body.removeChild(tempContainer)
            
            // 在移动设备上使用Capacitor分享
            if (Capacitor.isNativePlatform()) {
                // 保存到文件
                const timestamp = new Date().getTime()
                const fileName = `coffee-stats-${timestamp}.png`
                
                // 确保正确处理base64数据
                const base64Data = imageData.split(',')[1]
                
                // 写入文件
                await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data,
                    directory: Directory.Cache,
                    recursive: true
                })
                
                // 获取文件URI
                const uriResult = await Filesystem.getUri({
                    path: fileName,
                    directory: Directory.Cache
                })
                
                // 分享文件
                await Share.share({
                    title: '我的咖啡豆统计数据',
                    text: '我的咖啡豆统计数据',
                    files: [uriResult.uri],
                    dialogTitle: '分享我的咖啡豆统计数据'
                })
            } else {
                // 在网页上下载图片
                const link = document.createElement('a')
                link.download = `coffee-stats-${new Date().getTime()}.png`
                link.href = imageData
                link.click()
            }
            
            toast.showToast({
                type: 'success',
                title: '统计数据已保存为图片'
            })
        } catch (error) {
            console.error('生成统计数据图片失败', error)
            toast.showToast({
                type: 'error',
                title: '生成图片失败'
            })
        } finally {
            setIsExporting(false)
        }
    }

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
    
    // 生成统计项，单个值
    const StatItem = ({ label, value, unit = '' }: { label: string, value: string, unit?: string }) => (
        <div className="flex justify-between items-center w-full">
            <span className="text-neutral-600 dark:text-neutral-400 overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
            <span className="whitespace-nowrap">{value}{unit ? ` ${unit}` : ''}</span>
        </div>
    )
    
    // 生成统计部分
    const StatSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
        <div className="flex flex-col gap-2">
            <div className="text-xs font-normal text-neutral-800 dark:text-neutral-200">{title}</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-normal">{children}</div>
        </div>
    )

    // 从数组生成统计行
    const renderStatsRows = (dataArr: [string, number][], unit = '个') => {
        return dataArr
            .sort((a, b) => b[1] - a[1])
            .map(([key, value]) => (
                <StatItem 
                    key={key}
                    label={key} 
                    value={`${value}`} 
                    unit={unit} 
                />
            ));
    }

    return (
        <div className="px-6">
            <div ref={statsContainerRef} className="flex flex-col gap-6">
                <StatSection title="基本数据">
                    <StatItem label="咖啡豆总数" value={`${stats.totalBeans}`} unit="个" />
                    <StatItem label="正在使用" value={`${stats.activeBeans}`} unit="个" />
                    <StatItem label="已用完" value={`${stats.emptyBeans}`} unit="个" />
                </StatSection>

                <StatSection title="重量信息">
                    <StatItem label="总重量" value={`${formatNumber(stats.totalWeight)}`} unit="克" />
                    <StatItem label="剩余重量" value={`${formatNumber(stats.remainingWeight)}`} unit="克" />
                    <StatItem label="已消耗重量" value={`${formatNumber(stats.consumedWeight)}`} unit="克" />
                    <StatItem label="消耗比例" value={`${stats.totalWeight > 0 ? formatNumber(stats.consumedWeight / stats.totalWeight * 100) : 0}`} unit="%" />
                    <StatItem label="今日消耗" value={`${formatNumber(todayConsumption)}`} unit="克" />
                </StatSection>
                
                <StatSection title="费用数据">
                    <StatItem label="总花费" value={`${formatNumber(stats.totalCost)}`} unit="元" />
                    <StatItem label="剩余咖啡价值" value={`${formatNumber(stats.remainingWeight * stats.averageGramPrice)}`} unit="元" />
                    <StatItem label="已消耗咖啡价值" value={`${formatNumber(stats.consumedWeight * stats.averageGramPrice)}`} unit="元" />
                    <StatItem label="今日花费" value={`${formatNumber(todayCost)}`} unit="元" />
                    <StatItem label="平均每豆价格" value={`${formatNumber(stats.averageBeanPrice)}`} unit="元" />
                    <StatItem label="每克平均价格" value={`${formatNumber(stats.averageGramPrice)}`} unit="元/克" />
                </StatSection>
                
                <StatSection title="豆子分类">
                    <StatItem 
                        label="单品豆" 
                        value={(() => {
                            const total = beans.filter(bean => bean.type === '单品').length;
                            const active = beans.filter(bean => bean.type === '单品' && !isBeanEmpty(bean)).length;
                            return total === 0 ? '0' : `${active}/${total}`;
                        })()} 
                        unit="个"
                    />
                    <StatItem 
                        label="拼配豆" 
                        value={(() => {
                            const total = beans.filter(bean => bean.type === '拼配').length;
                            const active = beans.filter(bean => bean.type === '拼配' && !isBeanEmpty(bean)).length;
                            return total === 0 ? '0' : `${active}/${total}`;
                        })()} 
                        unit="个"
                    />
                    <StatItem 
                        label="意式豆" 
                        value={(() => {
                            const total = beans.filter(bean => bean.beanType === 'espresso').length;
                            const active = beans.filter(bean => bean.beanType === 'espresso' && !isBeanEmpty(bean)).length;
                            return total === 0 ? '0' : `${active}/${total}`;
                        })()} 
                        unit="个"
                    />
                    <StatItem 
                        label="手冲豆" 
                        value={(() => {
                            const total = beans.filter(bean => bean.beanType === 'filter').length;
                            const active = beans.filter(bean => bean.beanType === 'filter' && !isBeanEmpty(bean)).length;
                            return total === 0 ? '0' : `${active}/${total}`;
                        })()} 
                        unit="个"
                    />
                </StatSection>
                
                <StatSection title="赏味期状态">
                    <StatItem label="在赏味期内" value={`${stats.flavorPeriodStatus.inPeriod}`} unit="个" />
                    <StatItem label="尚未进入赏味期" value={`${stats.flavorPeriodStatus.beforePeriod}`} unit="个" />
                    <StatItem label="已过赏味期" value={`${stats.flavorPeriodStatus.afterPeriod}`} unit="个" />
                    <StatItem label="未设置赏味期" value={`${stats.flavorPeriodStatus.unknown}`} unit="个" />
                </StatSection>
                
                <StatSection title="烘焙度分布">
                    {renderStatsRows(Object.entries(stats.roastLevelCount))}
                </StatSection>
                
                <StatSection title="产地分布">
                    {renderStatsRows(Object.entries(stats.originCount))}
                </StatSection>
                
                <StatSection title="处理法分布">
                    {renderStatsRows(Object.entries(stats.processCount))}
                </StatSection>
                
                <StatSection title="品种分布">
                    {renderStatsRows(Object.entries(stats.varietyCount))}
                </StatSection>
                
                <StatSection title="风味标签分布">
                    {renderStatsRows(stats.topFlavors, '次')}
                </StatSection>
            </div>
            
            {/* 分享按钮 */}
            <div className="mt-6 mb-10">
                <button
                    onClick={exportStats}
                    disabled={isExporting}
                    className="text-xs font-normal rounded-full disabled:opacity-50"
                >
                    {isExporting ? (
                        <span>处理中...</span>
                    ) : (
                        <>
                            <span className='underline underline-offset-2 decoration-sky-500'>分享统计数据</span>
                            <ArrowUpRight className="inline-block ml-1 w-3 h-3" />
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}

export default StatsView 