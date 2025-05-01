'use client'

import React, { useMemo, useRef, useState, useEffect } from 'react'
import { showToast } from '@/components/ui/toast'
import { StatsViewProps } from './types'
import { calculateStats, stardomFontStyle } from './utils'
import BeanImageGallery from './BeanImageGallery'
import StatsSummary from './StatsSummary'
import StatsCategories from './StatsCategories'
import { useAnimation } from './useAnimation'
import { useConsumption } from './useConsumption'
import { Storage } from '@/lib/storage'

const StatsView: React.FC<StatsViewProps> = ({ beans, showEmptyBeans }) => {
    const statsContainerRef = useRef<HTMLDivElement>(null)
    const [username, setUsername] = useState<string>('')
    
    // 获取统计数据
    const stats = useMemo(() => calculateStats(beans, showEmptyBeans), [beans, showEmptyBeans])
    
    // 获取今日消耗数据
    const { consumption: todayConsumption, cost: todayCost } = useConsumption(beans)
    
    // 动画控制
    const { imagesLoaded, textLoaded, styles } = useAnimation()

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
        <div className="bg-neutral-50 dark:bg-neutral-900 overflow-x-hidden">
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
                        className="w-full flex justify-between items-center space-x-2 text-[10px] uppercase tracking-widest mb-8"
                        style={styles.infoAnimStyle}
                    >
                        <div className="">✦</div>
                        <StatsSummary stats={stats} todayConsumption={todayConsumption} />
                        <div className="">✦</div>
                    </div>
                </div>
                
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
        </div>
    )
}

export default StatsView 