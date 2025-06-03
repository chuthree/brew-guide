import React from 'react'
import { formatNumber2Digits } from './utils'
import { StatsSummaryProps } from './types'

// 咖啡消耗量计算专家系统
// 基于数据科学和咖啡爱好者经验的综合计算方法

interface ConsumptionCalculationOptions {
    useRealTimeData?: boolean;      // 是否使用真实时间数据
    considerSeasonality?: boolean;   // 是否考虑季节性因素
    separateByType?: boolean;       // 是否按咖啡类型分别计算
    weightRecentData?: boolean;     // 是否对近期数据加权
}

// 获取今日消耗数据
const getTodayConsumption = (stats: StatsSummaryProps['stats']): number => {
    // 优先使用分类型的今日消耗数据
    const espressoToday = stats.espressoStats?.todayConsumption || 0;
    const filterToday = stats.filterStats?.todayConsumption || 0;
    return espressoToday + filterToday;
}

// 获取特定类型豆子的今日消耗数据
const getTodayConsumptionByType = (stats: StatsSummaryProps['stats'], beanType: 'espresso' | 'filter'): number => {
    if (beanType === 'espresso') {
        return stats.espressoStats?.todayConsumption || 0;
    } else {
        return stats.filterStats?.todayConsumption || 0;
    }
}

// 基于历史数据计算平均消耗量
const calculateHistoricalAverage = (_stats: StatsSummaryProps['stats'], beans: any[]): number => {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    // 收集有效的消耗数据
    const validConsumptionData: number[] = [];

    beans.forEach(bean => {
        const capacity = parseFloat(bean.capacity?.toString().replace(/[^\d.]/g, '') || '0');
        const remaining = parseFloat(bean.remaining?.toString().replace(/[^\d.]/g, '') || '0');
        const consumed = capacity - remaining;

        // 只考虑有明显消耗的豆子
        if (consumed > 5 && bean.timestamp) { // 至少消耗5克才算有效数据
            // 计算使用天数，最少算1天
            const daysUsed = Math.max(1, Math.floor((now - bean.timestamp) / dayInMs));

            // 计算日均消耗，但设置合理范围
            const dailyConsumption = consumed / daysUsed;
            if (dailyConsumption > 0.5 && dailyConsumption < 150) { // 合理的日消耗范围
                validConsumptionData.push(dailyConsumption);
            }
        }
    });

    if (validConsumptionData.length === 0) return 0;

    // 使用中位数而不是平均数，避免异常值影响
    validConsumptionData.sort((a, b) => a - b);
    const mid = Math.floor(validConsumptionData.length / 2);

    if (validConsumptionData.length % 2 === 0) {
        return (validConsumptionData[mid - 1] + validConsumptionData[mid]) / 2;
    } else {
        return validConsumptionData[mid];
    }
}

// 智能估算消耗量
const calculateSmartEstimation = (stats: StatsSummaryProps['stats']): number => {
    // 基于咖啡类型的合理消耗量参考值（克/天）
    const CONSUMPTION_REFERENCES = {
        espresso: 20,   // 意式豆：约2-3杯浓缩咖啡
        filter: 30      // 手冲豆：约1-2杯手冲咖啡
    };

    // 计算各类型豆子的权重
    const espressoWeight = stats.espressoStats?.consumedWeight || 0;
    const filterWeight = stats.filterStats?.consumedWeight || 0;
    const totalConsumed = espressoWeight + filterWeight;

    if (totalConsumed === 0) return 25; // 默认值

    // 按实际消耗比例加权计算
    const espressoRatio = espressoWeight / totalConsumed;
    const filterRatio = filterWeight / totalConsumed;

    return CONSUMPTION_REFERENCES.espresso * espressoRatio +
           CONSUMPTION_REFERENCES.filter * filterRatio;
}

// 按类型智能估算消耗量
const calculateSmartEstimationByType = (stats: StatsSummaryProps['stats'], beanType: 'espresso' | 'filter'): number => {
    // 基于咖啡类型的合理消耗量参考值（克/天）
    const CONSUMPTION_REFERENCES = {
        espresso: 20,   // 意式豆：约2-3杯浓缩咖啡
        filter: 30      // 手冲豆：约1-2杯手冲咖啡
    };

    // 获取对应类型的消耗数据
    const typeStats = beanType === 'espresso' ? stats.espressoStats : stats.filterStats;

    // 如果该类型没有消耗数据，返回参考值
    if (!typeStats || typeStats.consumedWeight <= 0) {
        return CONSUMPTION_REFERENCES[beanType];
    }

    // 如果有消耗数据，可以基于实际消耗情况调整参考值
    // 这里可以根据实际消耗量与参考值的比例进行调整
    const referenceValue = CONSUMPTION_REFERENCES[beanType];

    // 简单返回参考值，后续可以根据需要添加更复杂的逻辑
    return referenceValue;
}

// 计算平均每日消耗量（克/天）- 优化版
export const calculateAverageConsumption = (
    stats: StatsSummaryProps['stats'],
    beans?: any[],
    options: ConsumptionCalculationOptions & { beanType?: 'espresso' | 'filter' } = {}
) => {
    const { beanType } = options;

    // 如果没有消耗则返回0
    if (stats.consumedWeight <= 0) return 0

    // 根据豆子类型获取对应的今日消耗数据
    let todayConsumption: number;
    if (beanType) {
        // 如果指定了豆子类型，使用特定类型的今日消耗
        todayConsumption = getTodayConsumptionByType(stats, beanType);
    } else {
        // 如果没有指定类型，使用总的今日消耗
        todayConsumption = getTodayConsumption(stats);
    }

    // 如果有今日消耗数据且合理，优先使用
    if (todayConsumption > 0 && todayConsumption < 200) { // 200克是合理的日消耗上限
        return todayConsumption;
    }

    // 方法1：基于实际消耗历史的计算
    if (beans && beans.length > 0) {
        const historicalAverage = calculateHistoricalAverage(stats, beans);
        if (historicalAverage > 0) {
            return historicalAverage;
        }
    }

    // 方法2：基于消耗模式的智能估算
    if (beanType) {
        // 如果指定了豆子类型，使用特定类型的智能估算
        return calculateSmartEstimationByType(stats, beanType);
    } else {
        // 如果没有指定类型，使用总体智能估算
        return calculateSmartEstimation(stats);
    }
}





// 高级消耗量分析和预测
export const getConsumptionInsights = (
    stats: StatsSummaryProps['stats'],
    beans?: any[],
    dailyConsumption?: number
) => {
    const insights = {
        consumptionLevel: 'moderate' as 'light' | 'moderate' | 'heavy',
        typePreference: 'balanced' as 'espresso' | 'filter' | 'balanced',
        efficiency: 0, // 消耗效率（避免浪费的程度）
        recommendations: [] as string[]
    };

    // 判断消耗水平
    const totalDaily = dailyConsumption || calculateAverageConsumption(stats, beans);
    if (totalDaily < 20) {
        insights.consumptionLevel = 'light';
        insights.recommendations.push('您是轻度咖啡爱好者，建议选择小包装或多样化尝试');
    } else if (totalDaily > 40) {
        insights.consumptionLevel = 'heavy';
        insights.recommendations.push('您是重度咖啡爱好者，建议批量购买以获得更好的性价比');
    } else {
        insights.consumptionLevel = 'moderate';
        insights.recommendations.push('您有着适中的咖啡消费习惯，建议保持当前的购买节奏');
    }

    // 判断类型偏好
    const espressoRatio = stats.beanTypeCount.espresso / (stats.beanTypeCount.espresso + stats.beanTypeCount.filter);
    if (espressoRatio > 0.7) {
        insights.typePreference = 'espresso';
        insights.recommendations.push('您偏爱意式咖啡，建议关注意式拼配豆和单品意式豆');
    } else if (espressoRatio < 0.3) {
        insights.typePreference = 'filter';
        insights.recommendations.push('您偏爱手冲咖啡，建议多尝试不同产区的单品豆');
    } else {
        insights.typePreference = 'balanced';
        insights.recommendations.push('您在意式和手冲之间保持平衡，建议继续保持多样化的选择');
    }

    return insights;
}

// 计算预计消耗完的时间 - 兼容版本（保持向后兼容）
export const calculateEstimatedFinishDate = (
    stats: StatsSummaryProps['stats'],
    dailyConsumption: number,
    options?: {
        considerSeasonality?: boolean;
        separateByType?: boolean;
        includeConfidenceLevel?: boolean;
        beans?: any[];
    }
): string => {
    const result = calculateEstimatedFinishDateAdvanced(stats, dailyConsumption, options);
    return typeof result === 'string' ? result : result.date;
}

// 计算预计消耗完的时间 - 简化优化版
export const calculateEstimatedFinishDateAdvanced = (
    stats: StatsSummaryProps['stats'],
    dailyConsumption: number,
    options: {
        considerSeasonality?: boolean;
        separateByType?: boolean;
        includeConfidenceLevel?: boolean;
        beans?: any[];
    } = {}
) => {
    const {
        includeConfidenceLevel = false
    } = options;

    // 如果没有剩余或平均消耗为0，返回未知
    if (stats.remainingWeight <= 0 || dailyConsumption <= 0) {
        return includeConfidenceLevel ? { date: '未知', confidence: 0 } : '未知'
    }

    // 使用传入的日消耗量直接计算
    const adjustedDailyConsumption = Math.max(1, dailyConsumption); // 确保至少1克/天

    // 计算剩余天数
    const daysRemaining = Math.ceil(stats.remainingWeight / adjustedDailyConsumption);

    // 计算预计结束日期
    const finishDate = new Date();
    finishDate.setDate(finishDate.getDate() + daysRemaining);

    // 处理跨年情况
    const now = new Date();
    const isNextYear = finishDate.getFullYear() > now.getFullYear();

    // 格式化日期
    let dateString: string;
    if (isNextYear) {
        // 跨年显示年份
        const year = finishDate.getFullYear().toString().slice(-2);
        const month = formatNumber2Digits(finishDate.getMonth() + 1);
        const day = formatNumber2Digits(finishDate.getDate());
        dateString = `${year}/${month}-${day}`;
    } else {
        // 同年只显示月日
        const month = formatNumber2Digits(finishDate.getMonth() + 1);
        const day = formatNumber2Digits(finishDate.getDate());
        dateString = `${month}-${day}`;
    }

    // 添加时间范围提示
    if (daysRemaining <= 7) {
        dateString += ' (本周内)';
    } else if (daysRemaining <= 30) {
        dateString += ' (本月内)';
    } else if (daysRemaining > 365) {
        dateString = '1年以上';
    }

    if (includeConfidenceLevel) {
        // 简化的置信度计算
        const confidence = Math.min(90, Math.max(50, 80 - Math.abs(daysRemaining - 30))); // 30天左右置信度最高
        return {
            date: dateString,
            confidence,
            daysRemaining,
            adjustedConsumption: adjustedDailyConsumption
        };
    }

    return dateString;
}



const StatsSummary: React.FC<StatsSummaryProps> = ({ stats, todayConsumption: _todayConsumption }) => {
    return (
        <div className="py-4 text-justify text-sm font-medium max-w-xs">
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