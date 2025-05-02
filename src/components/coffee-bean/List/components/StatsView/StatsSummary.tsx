import React from 'react'
import { formatNumber } from './utils'
import { StatsSummaryProps } from './types'

const StatsSummary: React.FC<StatsSummaryProps> = ({ stats, _todayConsumption }) => {
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