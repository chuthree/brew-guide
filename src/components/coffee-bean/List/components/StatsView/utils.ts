import { ExtendedCoffeeBean } from '../../types'
import { isBeanEmpty } from '../../globalCache'
import { StatsData } from './types'

// 格式化数字，保留2位小数
export const formatNumber = (num: number): string => {
    return num.toFixed(2).replace(/\.00$/, '')
}

// 添加序号格式化函数
export const formatNumber2Digits = (num: number): string => {
    return num.toString().padStart(2, '0')
}

// 从数组生成统计行数据
export const sortStatsData = (dataArr: [string, number][]): [string, number][] => {
    return [...dataArr].sort((a, b) => b[1] - a[1])
}

// 自定义字体样式
export const stardomFontStyle = {
    fontFamily: "'Stardom', sans-serif",
    fontWeight: 'normal',
    letterSpacing: '0.05em'
}

// 计算统计数据
export const calculateStats = (beans: ExtendedCoffeeBean[], showEmptyBeans: boolean, todayConsumption: { espressoConsumption: number; espressoCost: number; filterConsumption: number; filterCost: number }): StatsData => {
    // 计算咖啡豆总数
    const totalBeans = beans.length

    // 计算已用完的咖啡豆数量
    const emptyBeans = beans.filter(bean => isBeanEmpty(bean)).length

    // 计算正在使用的咖啡豆数量
    const activeBeans = totalBeans - emptyBeans

    // 计算总重量（克）- 使用所有豆子计算，不受showEmptyBeans影响
    const totalWeight = beans.reduce((sum, bean) => {
        const capacity = bean.capacity ? parseFloat(bean.capacity) : 0
        return sum + capacity
    }, 0)
    
    // 计算剩余重量（克）- 使用所有豆子计算，不受showEmptyBeans影响
    const remainingWeight = beans.reduce((sum, bean) => {
        const remaining = bean.remaining ? parseFloat(bean.remaining) : 0
        return sum + remaining
    }, 0)
    
    // 计算已消耗重量（克）
    const consumedWeight = totalWeight - remainingWeight
    
    // 计算总花费（元）- 使用所有豆子计算，不受showEmptyBeans影响
    const totalCost = beans.reduce((sum, bean) => {
        const price = bean.price ? parseFloat(bean.price) : 0
        return sum + price
    }, 0)
    
    // 计算平均每豆价格（元）
    const averageBeanPrice = totalBeans > 0 ? totalCost / totalBeans : 0
    
    // 计算平均每克价格（元/克）
    const averageGramPrice = totalWeight > 0 ? totalCost / totalWeight : 0
    
    // 为了详细分类统计，我们需要根据showEmptyBeans过滤豆子
    // 这样可以在图表和分类数据中反映用户的过滤选择
    const filteredBeans = showEmptyBeans 
        ? beans 
        : beans.filter(bean => !isBeanEmpty(bean))
    
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
        // 只处理 blendComponents 中的产地信息
        if (bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
            bean.blendComponents.forEach(comp => {
                if (comp.origin) {
                    const origin = comp.origin
                    originCount[origin] = (originCount[origin] || 0) + 1
                }
            })
        } else {
            // 如果没有 blendComponents 或者为空，归为"未知"
            const origin = '未知'
            originCount[origin] = (originCount[origin] || 0) + 1
        }
    })
    
    // 根据处理法统计
    const processCount: Record<string, number> = {}
    filteredBeans.forEach(bean => {
        // 只处理 blendComponents 中的处理法信息
        if (bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
            bean.blendComponents.forEach(comp => {
                if (comp.process) {
                    const process = comp.process
                    processCount[process] = (processCount[process] || 0) + 1
                }
            })
        } else {
            // 如果没有 blendComponents 或者为空，归为"未知"
            const process = '未知'
            processCount[process] = (processCount[process] || 0) + 1
        }
    })
    
    // 根据品种统计
    const varietyCount: Record<string, number> = {}
    filteredBeans.forEach(bean => {
        // 不再处理顶层的 variety 字段
        
        // 只处理 blendComponents 中的品种信息
        if (bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
            bean.blendComponents.forEach(comp => {
                if (comp.variety) {
                    const variety = comp.variety
                    varietyCount[variety] = (varietyCount[variety] || 0) + 1
                }
            })
        } else {
            // 如果没有 blendComponents 或者其中没有品种信息，则归为"未分类"
            const variety = '未分类'
            varietyCount[variety] = (varietyCount[variety] || 0) + 1
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

    // 计算手冲豆统计
    const filterBeans = beans.filter(bean => bean.beanType === 'filter')
    const activeFilterBeans = filterBeans.filter(bean => !isBeanEmpty(bean))
    const filterTotalWeight = filterBeans.reduce((sum, bean) => {
        const capacity = bean.capacity ? parseFloat(bean.capacity) : 0
        return sum + capacity
    }, 0)
    const filterRemainingWeight = filterBeans.reduce((sum, bean) => {
        const remaining = bean.remaining ? parseFloat(bean.remaining) : 0
        return sum + remaining
    }, 0)
    const filterConsumedWeight = filterTotalWeight - filterRemainingWeight
    const filterTotalCost = filterBeans.reduce((sum, bean) => {
        const price = bean.price ? parseFloat(bean.price) : 0
        return sum + price
    }, 0)
    const filterAverageBeanPrice = filterBeans.length > 0 ? filterTotalCost / filterBeans.length : 0
    const filterAverageGramPrice = filterTotalWeight > 0 ? filterTotalCost / filterTotalWeight : 0

    // 计算意式豆统计
    const espressoBeans = beans.filter(bean => bean.beanType === 'espresso')
    const activeEspressoBeans = espressoBeans.filter(bean => !isBeanEmpty(bean))
    const espressoTotalWeight = espressoBeans.reduce((sum, bean) => {
        const capacity = bean.capacity ? parseFloat(bean.capacity) : 0
        return sum + capacity
    }, 0)
    const espressoRemainingWeight = espressoBeans.reduce((sum, bean) => {
        const remaining = bean.remaining ? parseFloat(bean.remaining) : 0
        return sum + remaining
    }, 0)
    const espressoConsumedWeight = espressoTotalWeight - espressoRemainingWeight
    const espressoTotalCost = espressoBeans.reduce((sum, bean) => {
        const price = bean.price ? parseFloat(bean.price) : 0
        return sum + price
    }, 0)
    const espressoAverageBeanPrice = espressoBeans.length > 0 ? espressoTotalCost / espressoBeans.length : 0
    const espressoAverageGramPrice = espressoTotalWeight > 0 ? espressoTotalCost / espressoTotalWeight : 0

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
        flavorPeriodStatus,
        espressoStats: {
            totalBeans: espressoBeans.length,
            activeBeans: activeEspressoBeans.length,
            totalWeight: espressoTotalWeight,
            remainingWeight: espressoRemainingWeight,
            consumedWeight: espressoConsumedWeight,
            totalCost: espressoTotalCost,
            averageBeanPrice: espressoAverageBeanPrice,
            averageGramPrice: espressoAverageGramPrice,
            todayConsumption: todayConsumption.espressoConsumption,
            todayCost: todayConsumption.espressoCost
        },
        filterStats: {
            totalBeans: filterBeans.length,
            activeBeans: activeFilterBeans.length,
            totalWeight: filterTotalWeight,
            remainingWeight: filterRemainingWeight,
            consumedWeight: filterConsumedWeight,
            totalCost: filterTotalCost,
            averageBeanPrice: filterAverageBeanPrice,
            averageGramPrice: filterAverageGramPrice,
            todayConsumption: todayConsumption.filterConsumption,
            todayCost: todayConsumption.filterCost
        }
    }
} 