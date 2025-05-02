'use client'

import React, { useMemo, useRef, useState, useEffect } from 'react'
import { StatsViewProps } from './types'
import { calculateStats, stardomFontStyle } from './utils'
import BeanImageGallery from './BeanImageGallery'
import StatsSummary from './StatsSummary'
import StatsCategories from './StatsCategories'
import { useAnimation } from './useAnimation'
import { useConsumption } from './useConsumption'
import { Storage } from '@/lib/storage'
import { ArrowUpRight } from 'lucide-react'

const StatsView: React.FC<StatsViewProps> = ({ beans, showEmptyBeans, onStatsShare }) => {
    const statsContainerRef = useRef<HTMLDivElement>(null)
    const [username, setUsername] = useState<string>('')
    
    // 获取统计数据
    const stats = useMemo(() => calculateStats(beans, showEmptyBeans), [beans, showEmptyBeans])
    
    // 获取今日消耗数据
    const { consumption: todayConsumption, cost: todayCost } = useConsumption(beans)
    
    // 动画控制
    const { imagesLoaded, _textLoaded, styles } = useAnimation()

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
                    className="mx-auto text-center pb-1.5 text-[11px] relative text-neutral-600 dark:text-neutral-400"
            >
                <span className="relative underline underline-offset-2 decoration-sky-500">分享 (不包含费用数据)</span>
                    <ArrowUpRight className="inline-block ml-1 w-3 h-3" />
                </button>
            </div>
        </div>
    )
}

export default StatsView 