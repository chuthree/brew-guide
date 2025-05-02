import React from 'react'
import { StatItemProps, StatSectionProps, StatCategoryProps } from './types'
import { formatNumber2Digits } from './utils'

// 生成统计项，单个值
export const StatItem: React.FC<StatItemProps> = ({ label, value, unit = '' }) => (
    <div className="flex justify-between items-center w-full py-1.5">
        <span className="pr-3 text-neutral-600 dark:text-neutral-400 text-[11px] overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
        <span className="text-neutral-800 dark:text-neutral-100 text-[11px] font-medium whitespace-nowrap">{value}{unit ? ` ${unit}` : ''}</span>
    </div>
)

// 生成统计部分
export const StatSection: React.FC<StatSectionProps> = ({ title, children }) => (
    <div className="flex flex-col">
        <div className="text-[11px] font-medium text-neutral-800 dark:text-neutral-100 uppercase tracking-widest mb-2.5">{title}</div>
        <div className="flex flex-col border-l border-neutral-200 dark:border-neutral-800 pl-3">{children}</div>
    </div>
)

// 带编号的统计类别
export const StatCategory: React.FC<StatCategoryProps> = ({ number, title, children, animStyle }) => (
    <div className="flex" style={animStyle}>
        <div className="text-[11px] text-neutral-800 dark:text-neutral-100 mr-3">
            {formatNumber2Digits(number)}
        </div>
        <StatSection title={title}>
            {children}
        </StatSection>
    </div>
)

// 从数组生成统计行
export const renderStatsRows = (dataArr: [string, number][], unit = '个') => {
    return dataArr
        .sort((a, b) => b[1] - a[1])
        .map(([key, value]) => (
            <StatItem 
                key={key}
                label={key} 
                value={`${value}`} 
                unit={unit} 
            />
        ))
} 