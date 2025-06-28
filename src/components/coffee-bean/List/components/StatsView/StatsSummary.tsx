import React from 'react'
import { formatNumber2Digits } from './utils'
import { StatsSummaryProps } from './types'
import { ExtendedCoffeeBean } from '../../types'

// 计算预计消耗完的时间 - 兼容版本（保持向后兼容）
export const calculateEstimatedFinishDate = (
    stats: StatsSummaryProps['stats'],
    dailyConsumption: number,
    options?: {
        considerSeasonality?: boolean;
        separateByType?: boolean;
        includeConfidenceLevel?: boolean;
        beans?: ExtendedCoffeeBean[];
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
        beans?: ExtendedCoffeeBean[];
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
    const today = new Date();

    // 计算本周末（周日）
    const dayOfWeek = today.getDay(); // 0=周日, 1=周一, ..., 6=周六
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek; // 如果今天是周日，就是0天
    const thisWeekEnd = new Date(today);
    thisWeekEnd.setDate(today.getDate() + daysUntilSunday);
    thisWeekEnd.setHours(23, 59, 59, 999); // 设置为当天最后一刻

    // 计算本月末
    const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    thisMonthEnd.setHours(23, 59, 59, 999); // 设置为当天最后一刻

    // 判断预计完成日期是否在本周内或本月内
    if (finishDate <= thisWeekEnd) {
        dateString += ' (本周内)';
    } else if (finishDate <= thisMonthEnd) {
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



const StatsSummary: React.FC<StatsSummaryProps> = ({
    stats,
    todayConsumption: _todayConsumption,
    selectedTimeRange = '目前为止',
    onToggleTimeRangeDropdown,
    showTimeRangeDropdown = false,
    calculationMode = '按照咖啡日',
    onToggleCalculationMode,
    actualDays = 1
}) => {
    return (
        <div className="p-4 text-justify text-sm font-medium max-w-xs">
            {/* 集成时间区间到文本中 */}
            {!showTimeRangeDropdown ? (
                <button
                    ref={(el) => {
                        // 将按钮引用传递给全局
                        if (el && typeof window !== 'undefined') {
                            (window as Window & { timeRangeButtonRef?: HTMLButtonElement }).timeRangeButtonRef = el;
                        }
                    }}
                    onClick={onToggleTimeRangeDropdown}
                    className="text-sm font-medium text-neutral-800 dark:text-neutral-100 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors cursor-pointer underline underline-offset-2 decoration-neutral-500"
                    data-time-range-selector
                >
                    {selectedTimeRange}
                </button>
            ) : (
                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100 opacity-0">
                    {selectedTimeRange}
                </span>
            )}
            ，
            {/* 计算方式切换按钮 */}
            {onToggleCalculationMode && (
                <>
                    <button
                        onClick={onToggleCalculationMode}
                        className="text-sm font-medium text-neutral-800 dark:text-neutral-100 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors cursor-pointer underline underline-offset-2 decoration-neutral-500"
                    >
                        {calculationMode} {actualDays} 天
                    </button>
                    统计，
                </>
            )}
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