import React from 'react'
import { formatNumber, formatNumber2Digits } from './utils'
import { StatsSummaryProps } from './types'

// 计算平均每日消耗量（克/天）
export const calculateAverageConsumption = (stats: StatsSummaryProps['stats']) => {
    // 假设开始统计到现在的天数，如果没有消耗则返回0
    if (stats.consumedWeight <= 0) return 0
    
    // 这里可以根据实际情况调整计算方式，例如使用第一次记录到现在的天数
    // 这里假设使用固定的30天作为计算周期
    const daysInPeriod = 30
    return stats.consumedWeight / daysInPeriod
}

// 计算预计消耗完的时间
export const calculateEstimatedFinishDate = (stats: StatsSummaryProps['stats'], dailyConsumption: number) => {
    // 如果没有剩余或平均消耗为0，返回未知
    if (stats.remainingWeight <= 0 || dailyConsumption <= 0) {
        return '未知'
    }
    
    // 计算剩余天数
    const daysRemaining = Math.ceil(stats.remainingWeight / dailyConsumption)
    
    // 计算预计结束日期
    const finishDate = new Date()
    finishDate.setDate(finishDate.getDate() + daysRemaining)
    
    // 格式化日期为 MM-DD 格式，确保月份和日期都是两位数
    const month = formatNumber2Digits(finishDate.getMonth() + 1)
    const day = formatNumber2Digits(finishDate.getDate())
    return `${month}-${day}`
}

const StatsSummary: React.FC<StatsSummaryProps> = ({ stats, todayConsumption }) => {
    return (
        <div className="p-4 text-justify text-sm font-medium max-w-xs mx-auto">
            目前已用{formatNumber(stats.consumedWeight)}克，
            剩余{formatNumber(stats.remainingWeight)}克。
            
            {stats.beanTypeCount.filter > stats.beanTypeCount.espresso ? 
                `偏爱手冲豆` : 
                stats.beanTypeCount.espresso > stats.beanTypeCount.filter ? 
                    `偏爱意式豆` : 
                    `手冲意式均衡`}，
            以{Object.entries(stats.roastLevelCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '中度'}烘焙为主。
            
            {stats.topFlavors.length > 0 ? 
                `风味偏爱${stats.topFlavors.slice(0, 2).map(([flavor]) => flavor).join('和')}` : ''}。
        </div>
    )
}

export default StatsSummary 