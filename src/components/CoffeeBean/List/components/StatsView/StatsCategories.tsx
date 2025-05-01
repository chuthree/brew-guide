import React from 'react'
import { isBeanEmpty } from '../../globalCache'
import { StatsData, AnimationStyles } from './types'
import { formatNumber } from './utils'
import { StatCategory, StatItem, renderStatsRows } from './StatComponents'

interface StatsCategoriesProps {
    stats: StatsData
    beans: any[]
    todayConsumption: number
    todayCost: number
    styles: AnimationStyles
}

const StatsCategories: React.FC<StatsCategoriesProps> = ({ 
    stats, 
    beans, 
    todayConsumption, 
    todayCost, 
    styles 
}) => {
    return (
        <div className="flex flex-col gap-8">
            <div className="grid grid-cols-1 gap-8">
                {/* 编号01 - 基本数据 */}
                <StatCategory 
                    number={1} 
                    title="基本数据" 
                    animStyle={styles.statsAnimStyle(0)}
                >
                    <StatItem label="咖啡豆总数" value={`${stats.totalBeans}`} unit="个" />
                    <StatItem label="正在使用" value={`${stats.activeBeans}`} unit="个" />
                    <StatItem label="已用完" value={`${stats.emptyBeans}`} unit="个" />
                </StatCategory>

                {/* 编号02 - 库存信息 */}
                <StatCategory 
                    number={2} 
                    title="库存" 
                    animStyle={styles.statsAnimStyle(1)}
                >
                    <StatItem label="总重量" value={`${formatNumber(stats.totalWeight)}`} unit="克" />
                    <StatItem label="剩余重量" value={`${formatNumber(stats.remainingWeight)}`} unit="克" />
                    <StatItem label="已消耗重量" value={`${formatNumber(stats.consumedWeight)}`} unit="克" />
                    <StatItem label="消耗比例" value={`${stats.totalWeight > 0 ? formatNumber(stats.consumedWeight / stats.totalWeight * 100) : 0}`} unit="%" />
                    <StatItem label="今日消耗" value={`${formatNumber(todayConsumption)}`} unit="克" />
                </StatCategory>
                
                {/* 编号03 - 费用数据 */}
                {/* <StatCategory 
                    number={3} 
                    title="费用数据" 
                    animStyle={styles.statsAnimStyle(2)}
                >
                    <StatItem label="总花费" value={`${formatNumber(stats.totalCost)}`} unit="元" />
                    <StatItem label="剩余咖啡价值" value={`${formatNumber(stats.remainingWeight * stats.averageGramPrice)}`} unit="元" />
                    <StatItem label="已消耗咖啡价值" value={`${formatNumber(stats.consumedWeight * stats.averageGramPrice)}`} unit="元" />
                    <StatItem label="今日花费" value={`${formatNumber(todayCost)}`} unit="元" />
                    <StatItem label="平均每豆价格" value={`${formatNumber(stats.averageBeanPrice)}`} unit="元" />
                    <StatItem label="每克平均价格" value={`${formatNumber(stats.averageGramPrice)}`} unit="元/克" />
                </StatCategory> */}
                
                {/* 编号04 - 豆子分类 */}
                <StatCategory 
                    number={3} 
                    title="分类" 
                    animStyle={styles.statsAnimStyle(2)}
                >
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
                </StatCategory>
                
                {/* 编号05 - 赏味期状态 */}
                <StatCategory 
                    number={4} 
                    title="赏味期" 
                    animStyle={styles.statsAnimStyle(3)}
                >
                    <StatItem label="在赏味期内" value={`${stats.flavorPeriodStatus.inPeriod}`} unit="个" />
                    <StatItem label="尚未进入赏味期" value={`${stats.flavorPeriodStatus.beforePeriod}`} unit="个" />
                    <StatItem label="已过赏味期" value={`${stats.flavorPeriodStatus.afterPeriod}`} unit="个" />
                    {/* <StatItem label="未设置赏味期" value={`${stats.flavorPeriodStatus.unknown}`} unit="个" /> */}
                </StatCategory>
                
                {/* 编号06 - 烘焙度分布 */}
                <StatCategory 
                    number={5} 
                    title="烘焙度" 
                    animStyle={styles.statsAnimStyle(4)}
                >
                    {renderStatsRows(Object.entries(stats.roastLevelCount))}
                </StatCategory>
                
                {/* 编号07 - 产地分布 */}
                <StatCategory 
                    number={6} 
                    title="产地" 
                    animStyle={styles.statsAnimStyle(5)}
                >
                    {renderStatsRows(Object.entries(stats.originCount))}
                </StatCategory>
                
                {/* 编号08 - 处理法分布 */}
                <StatCategory 
                    number={7} 
                    title="处理法" 
                    animStyle={styles.statsAnimStyle(6)}
                >
                    {renderStatsRows(Object.entries(stats.processCount))}
                </StatCategory>
                
                {/* 编号09 - 品种分布 */}
                <StatCategory 
                    number={8} 
                    title="品种" 
                    animStyle={styles.statsAnimStyle(7)}
                >
                    {renderStatsRows(Object.entries(stats.varietyCount))}
                </StatCategory>
                
                {/* 编号10 - 风味标签分布 */}
                <StatCategory 
                    number={9} 
                    title="风味" 
                    animStyle={styles.statsAnimStyle(8)}
                >
                    {renderStatsRows(stats.topFlavors, '次')}
                </StatCategory>
            </div>
            
            {/* 底部附加项，可选显示 */}
            <div 
                className="mt-8 mb-4 text-[10px] text-center text-neutral-500 dark:text-neutral-400 flex flex-col space-y-1"
                style={{
                    ...styles.infoAnimStyle,
                    transitionDelay: '1200ms'
                }}
            >
                <div className="flex justify-center">
                    <span className="px-2">—— Brew Guide</span>
                </div>
            </div>
        </div>
    )
}

export default StatsCategories 