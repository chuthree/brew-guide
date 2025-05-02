'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { CoffeeBean } from '@/types/app'
import { CoffeeBeanManager } from '@/lib/managers/coffeeBeanManager'
import { getBloggerBeans, BloggerBean, getVideoUrlFromEpisode } from '@/lib/utils/csvUtils'

// 用于检测当前运行环境
const isMobileApp = typeof window !== 'undefined' && 
    window.hasOwnProperty('Capacitor') && 
     
    !!(window as any).Capacitor?.isNative;

// 检测是否是移动浏览器 (暂未使用，但保留以备将来使用)
const _isMobileBrowser = typeof window !== 'undefined' && 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// 处理链接打开的工具函数
const openLink = async (url: string) => {
    if (!url) return;

    try {
        // 仅在 Capacitor 原生应用环境中尝试使用 InAppBrowser
        if (isMobileApp) {
            try {
                // 动态导入 Capacitor InAppBrowser 插件
                 
                const { InAppBrowser } = await import('@capacitor/inappbrowser' as any);
                
                // 使用系统浏览器打开链接（iOS上是SFSafariViewController，Android上是Custom Tabs）
                await InAppBrowser.openInSystemBrowser({
                    url: url
                });
                return; // 成功打开链接后退出函数
            } catch (capacitorError) {
                console.error('Capacitor InAppBrowser 错误:', capacitorError);
                // 出错时继续执行到后面的普通链接打开逻辑
            }
        }
        
        // 在非原生应用环境或Capacitor插件失败时使用普通窗口打开
        window.open(url, '_blank');
    } catch (error) {
        console.error('打开链接出错:', error);
        // 最后的回退方案
        try {
            window.location.href = url;
        } catch {
            console.error('所有打开链接的方法都失败了');
        }
    }
};

export const SORT_OPTIONS = {
    ORIGINAL: 'original',  // 添加原始排序选项
    RATING_DESC: 'rating_desc',
    RATING_ASC: 'rating_asc',
    NAME_ASC: 'name_asc',
    NAME_DESC: 'name_desc',
    PRICE_ASC: 'price_asc',
    PRICE_DESC: 'price_desc',
} as const;

export type RankingSortOption = typeof SORT_OPTIONS[keyof typeof SORT_OPTIONS];

// 排序选项的显示名称（导出给其他组件使用）
export const SORT_LABELS: Record<RankingSortOption, string> = {
    [SORT_OPTIONS.ORIGINAL]: '原始',
    [SORT_OPTIONS.RATING_DESC]: '评分 (高→低)',
    [SORT_OPTIONS.RATING_ASC]: '评分 (低→高)',
    [SORT_OPTIONS.NAME_ASC]: '名称 (A→Z)',
    [SORT_OPTIONS.NAME_DESC]: '名称 (Z→A)',
    [SORT_OPTIONS.PRICE_ASC]: '价格 (低→高)',
    [SORT_OPTIONS.PRICE_DESC]: '价格 (高→低)',
};

interface CoffeeBeanRankingProps {
    isOpen: boolean
    onShowRatingForm: (bean: CoffeeBean, onRatingSaved?: () => void) => void
    sortOption?: RankingSortOption
    updatedBeanId?: string | null
    hideFilters?: boolean
    beanType?: 'all' | 'espresso' | 'filter'
    editMode?: boolean
    viewMode?: 'personal' | 'blogger'
    year?: 2024 | 2025
}

const CoffeeBeanRanking: React.FC<CoffeeBeanRankingProps> = ({
    isOpen,
    onShowRatingForm,
    sortOption = SORT_OPTIONS.RATING_DESC,
    updatedBeanId: externalUpdatedBeanId = null,
    hideFilters = false,
    beanType: externalBeanType,
    editMode: externalEditMode,
    viewMode = 'personal',
    year: externalYear
}) => {
    const [ratedBeans, setRatedBeans] = useState<(CoffeeBean | BloggerBean)[]>([])
    const [unratedBeans, setUnratedBeans] = useState<CoffeeBean[]>([])
    const [beanType, setBeanType] = useState<'all' | 'espresso' | 'filter'>(externalBeanType || 'all')
    const [updatedBeanId, setUpdatedBeanId] = useState<string | null>(externalUpdatedBeanId)
    const [editMode, setEditMode] = useState(externalEditMode || false)
    const [showUnrated, setShowUnrated] = useState(false)
    const [refreshTrigger, setRefreshTrigger] = useState(0)
    const [year, setYear] = useState<2024 | 2025>(externalYear || 2025)

    // 监听外部传入的ID变化
    useEffect(() => {
        if (externalUpdatedBeanId) {
            setUpdatedBeanId(externalUpdatedBeanId);

            // 清除高亮标记
            const timer = setTimeout(() => {
                setUpdatedBeanId(null);
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [externalUpdatedBeanId]);

    // 监听外部传入的筛选类型变化
    useEffect(() => {
        if (externalBeanType !== undefined) {
            setBeanType(externalBeanType);
        }
    }, [externalBeanType]);

    // 监听外部传入的编辑模式变化
    useEffect(() => {
        if (externalEditMode !== undefined) {
            setEditMode(externalEditMode);
        }
    }, [externalEditMode]);

    // 监听外部传入的年份变化
    useEffect(() => {
        if (externalYear !== undefined) {
            setYear(externalYear);
        }
    }, [externalYear]);

    // 加载咖啡豆数据的函数
    const loadBeans = useCallback(async () => {
        if (!isOpen) return;

        try {
            let ratedBeansData: (CoffeeBean | BloggerBean)[] = [];
            let unratedBeansData: CoffeeBean[] = [];

            if (viewMode === 'blogger') {
                // Use CSV utility function with the current year state
                ratedBeansData = getBloggerBeans(beanType, year);
                unratedBeansData = []; // Blogger view doesn't show unrated
            } else {
                // Load personal rated beans
                if (beanType === 'all') {
                    ratedBeansData = await CoffeeBeanManager.getRatedBeans();
                } else {
                    ratedBeansData = await CoffeeBeanManager.getRatedBeansByType(beanType);
                }

                // Load all beans, filter out unrated
                const allBeans = await CoffeeBeanManager.getAllBeans();
                const ratedIds = new Set(ratedBeansData.map(bean => bean.id));

                unratedBeansData = allBeans.filter(bean => {
                    const isUnrated = !ratedIds.has(bean.id) && (!bean.overallRating || bean.overallRating === 0);
                    if (beanType === 'all') return isUnrated;
                    if (beanType === 'espresso') return isUnrated && bean.beanType === 'espresso';
                    if (beanType === 'filter') return isUnrated && bean.beanType === 'filter';
                    return isUnrated;
                });
            }

            setRatedBeans(sortBeans(ratedBeansData, sortOption));
            setUnratedBeans(unratedBeansData.sort((a, b) => b.timestamp - a.timestamp));
        } catch (error) {
            console.error("加载咖啡豆数据失败:", error);
            setRatedBeans([]);
            setUnratedBeans([]);
        }
    }, [isOpen, beanType, sortOption, viewMode, year]);

    // 在组件挂载、isOpen变化、beanType变化、sortOption变化或refreshTrigger变化时重新加载数据
    useEffect(() => {
        loadBeans();
    }, [loadBeans, refreshTrigger]);

    // 排序咖啡豆的函数
    const sortBeans = (beansToSort: CoffeeBean[], option: RankingSortOption): CoffeeBean[] => {
        const sorted = [...beansToSort];

        // 博主榜单模式下，对于ORIGINAL选项使用特殊处理，保留从CSV导入的原始顺序
        if (viewMode === 'blogger' && option === SORT_OPTIONS.ORIGINAL) {
            return sorted; // 直接返回，保留getBloggerBeans函数中已经设置的顺序
        }

        switch (option) {
            case SORT_OPTIONS.ORIGINAL:
                // 对于原始选项，有序号的按序号排序，没有序号的保持原有顺序
                return sorted.sort((a, b) => {
                    // 检查是否有序号属性（可能在 id 中包含）
                    const aId = a.id || '';
                    const bId = b.id || '';
                    
                    // 从 id 中提取序号（假设格式为 blogger-type-序号-name-随机字符）
                    const aMatch = aId.match(/blogger-\w+-(\d+)-/);
                    const bMatch = bId.match(/blogger-\w+-(\d+)-/);
                    
                    if (aMatch && bMatch) {
                        // 如果两者都有序号，按序号排序
                        return parseInt(aMatch[1]) - parseInt(bMatch[1]);
                    } else if (aMatch) {
                        // a 有序号，b 没有，a 排前面
                        return -1;
                    } else if (bMatch) {
                        // b 有序号，a 没有，b 排前面
                        return 1;
                    }
                    // 都没有序号，保持原有顺序
                    return 0;
                });

            case SORT_OPTIONS.RATING_DESC:
                return sorted.sort((a, b) => (b.overallRating || 0) - (a.overallRating || 0));

            case SORT_OPTIONS.RATING_ASC:
                return sorted.sort((a, b) => (a.overallRating || 0) - (b.overallRating || 0));

            case SORT_OPTIONS.NAME_ASC:
                return sorted.sort((a, b) => a.name.localeCompare(b.name));

            case SORT_OPTIONS.NAME_DESC:
                return sorted.sort((a, b) => b.name.localeCompare(a.name));

            case SORT_OPTIONS.PRICE_ASC:
                return sorted.sort((a, b) => {
                    // 提取数字部分并转换为浮点数
                    const aPrice = a.price ? parseFloat(a.price.replace(/[^\d.]/g, '')) : 0;
                    const bPrice = b.price ? parseFloat(b.price.replace(/[^\d.]/g, '')) : 0;
                    return aPrice - bPrice;
                });

            case SORT_OPTIONS.PRICE_DESC:
                return sorted.sort((a, b) => {
                    // 提取数字部分并转换为浮点数
                    const aPrice = a.price ? parseFloat(a.price.replace(/[^\d.]/g, '')) : 0;
                    const bPrice = b.price ? parseFloat(b.price.replace(/[^\d.]/g, '')) : 0;
                    return bPrice - aPrice;
                });

            default:
                return sorted;
        }
    };

    // 计算每克价格
    const calculatePricePerGram = (bean: CoffeeBean) => {
        if (!bean.price || !bean.capacity) return null;

        // 处理博主榜单豆子 - 博主榜单豆子的价格已经是每百克价格
        if ((bean as BloggerBean).isBloggerRecommended) {
            const price = parseFloat(bean.price.replace(/[^\d.]/g, ''));
            if (isNaN(price)) return null;
            // 直接返回价格的1/100，因为原始数据已经是每百克价格
            return (price / 100).toFixed(2);
        }

        // 常规豆子价格计算
        const price = parseFloat(bean.price.replace(/[^\d.]/g, ''));
        const capacity = parseFloat(bean.capacity.replace(/[^\d.]/g, ''));

        if (isNaN(price) || isNaN(capacity) || capacity === 0) return null;

        return (price / capacity).toFixed(2);
    };

    // 评分保存后的回调函数
    const handleRatingSaved = useCallback(() => {
        // 触发数据刷新
        setRefreshTrigger(prev => prev + 1);

        // 不再自动折叠未评分列表，让用户自行控制
    }, []);

    const handleRateBeanClick = (bean: CoffeeBean) => {
        // 将回调函数传递给评分表单
        onShowRatingForm(bean, handleRatingSaved);
    };

    // 切换编辑模式
    const toggleEditMode = () => {
        setEditMode(prev => !prev);
    };

    // 切换显示未评分咖啡豆
    const toggleShowUnrated = () => {
        setShowUnrated(prev => !prev);
    };

    if (!isOpen) return null;

    return (
        <div className="pb-16 coffee-bean-ranking-container">
            {/* 头部 - 只在hideFilters为false时显示 */}
            {!hideFilters && (
                <div className="mb-1">
                    {/* 豆子筛选选项卡 */}
                    <div className="flex justify-between border-b border-neutral-200 dark:border-neutral-800 px-3">
                        <div className="flex">
                            <button
                                className={`pb-1.5 px-3 text-[11px] relative ${beanType === 'all' ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                onClick={() => setBeanType('all')}
                            >
                                <span className="relative">全部豆子</span>
                                {beanType === 'all' && (
                                    <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                )}
                            </button>
                            <button
                                className={`pb-1.5 px-3 text-[11px] relative ${beanType === 'espresso' ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                onClick={() => setBeanType('espresso')}
                            >
                                <span className="relative">意式豆</span>
                                {beanType === 'espresso' && (
                                    <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                )}
                            </button>
                            <button
                                className={`pb-1.5 px-3 text-[11px] relative ${beanType === 'filter' ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                onClick={() => setBeanType('filter')}
                            >
                                <span className="relative">手冲豆</span>
                                {beanType === 'filter' && (
                                    <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                )}
                            </button>
                        </div>

                        {/* 编辑按钮 - 仅在个人视图下显示 */}
                        {viewMode === 'personal' && (
                            <button
                                onClick={toggleEditMode}
                                className={`pb-1.5 px-3 text-[11px] relative ${editMode ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                            >
                                <span className="relative">{editMode ? '完成' : '编辑'}</span>
                                {editMode && (
                                    <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* 已评分咖啡豆区域 */}
            {ratedBeans.length === 0 ? (
                <div className="flex h-28 items-center justify-center text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                    暂无咖啡豆评分数据
                </div>
            ) : (
                <div>
                    {ratedBeans.map((bean, index) => (
                        <div
                            key={bean.id}
                            className={`border-b border-neutral-200/60 dark:border-neutral-800/40 last:border-none transition-colors ${updatedBeanId === bean.id ? 'bg-neutral-100/50 dark:bg-neutral-800' : ''}`}
                        >
                            <div className="flex items-start px-6 py-2.5">
                                {/* 序号 - 极简风格 */}
                                <div className="text-[11px] text-neutral-600 dark:text-neutral-400 w-4 mr-2 flex-shrink-0">
                                    {index + 1}
                                </div>

                                {/* 咖啡豆信息 */}
                                <div className="cursor-pointer flex-1 min-w-0">
                                    <div className="flex items-center">
                                        <div className="text-[11px] text-neutral-800 dark:text-neutral-100 truncate">{bean.name}</div>
                                        <div className="ml-2 text-[11px] text-neutral-800 dark:text-neutral-100 flex-shrink-0">
                                            +{bean.overallRating !== undefined ? bean.overallRating : 0}
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-neutral-600 dark:text-neutral-400 mt-1">
                                        {(() => {
                                            // 显示信息数组
                                            const infoArray: (React.ReactNode | string)[] = [];
                                            
                                            // 豆子类型 - 只有在"全部豆子"视图下显示
                                            if (beanType === 'all') {
                                                infoArray.push(bean.beanType === 'espresso' ? '意式豆' : '手冲豆');
                                            }
                                            
                                            // Roast Level - Conditionally display
                                            if (bean.roastLevel && bean.roastLevel !== '未知') {
                                                infoArray.push(bean.roastLevel);
                                            }
                                            
                                            // 视频期数 - 博主榜单模式下显示
                                            if (viewMode === 'blogger' && (bean as BloggerBean).videoEpisode) {
                                                const episode = (bean as BloggerBean).videoEpisode;
                                                // Extract brand and bean name from the full bean name (e.g., "Joker 摆脱冷气")
                                                const nameParts = bean.name.split(' ');
                                                const brand = nameParts[0]; // Assuming first part is brand
                                                const beanNameOnly = nameParts.slice(1).join(' '); // Rest is bean name
                                                
                                                const videoUrl = getVideoUrlFromEpisode(episode, brand, beanNameOnly);
                                                
                                                if (videoUrl) {
                                                    // 有视频链接时，添加可点击的元素
                                                    infoArray.push(
                                                        <span 
                                                            key={`video-${bean.id}`}
                                                            className="inline-flex items-center cursor-pointer underline"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openLink(videoUrl);
                                                            }}
                                                        >
                                                            第{episode}期
                                                        </span>
                                                    );
                                                } else {
                                                    // 没有视频链接时，仍显示期数但不可点击
                                                    infoArray.push(`第${episode}期`);
                                                }
                                            }
                                            
                                            // 每克价格
                                            const pricePerGram = calculatePricePerGram(bean);
                                            if (pricePerGram) {
                                                infoArray.push(`${pricePerGram}元/克`);
                                            }
                                            
                                            // 意式豆特有信息 - 美式分数和奶咖分数 (Only for 2025 data)
                                            if (bean.beanType === 'espresso' && viewMode === 'blogger' && (bean as BloggerBean).year === 2025) {
                                                const bloggerBean = bean as BloggerBean;
                                                if (bloggerBean.ratingEspresso !== undefined && bloggerBean.ratingMilkBased !== undefined) {
                                                    infoArray.push(`美式/奶咖:${bloggerBean.ratingEspresso}/${bloggerBean.ratingMilkBased}`);
                                                } else if (bloggerBean.ratingEspresso !== undefined) {
                                                    infoArray.push(`美式:${bloggerBean.ratingEspresso}`);
                                                } else if (bloggerBean.ratingMilkBased !== undefined) {
                                                    infoArray.push(`奶咖:${bloggerBean.ratingMilkBased}`);
                                                }
                                            }
                                            
                                            // 购买渠道 - 博主榜单模式下显示 (Only for 2025 data)
                                            if (viewMode === 'blogger' && bean.purchaseChannel && (bean as BloggerBean).year === 2025) {
                                                infoArray.push(bean.purchaseChannel);
                                            }
                                            
                                            // 评价备注 - 如果存在且不是博主模式
                                            if (viewMode !== 'blogger' && bean.ratingNotes) {
                                                infoArray.push(bean.ratingNotes);
                                            }
                                            
                                            // 渲染信息数组，在元素之间添加分隔点
                                            return infoArray.map((info, index) => (
                                                <React.Fragment key={index}>
                                                    {index > 0 && <span className="mx-1">·</span>}
                                                    {info}
                                                </React.Fragment>
                                            ));
                                        })()}
                                    </div>
                                </div>

                                {/* 操作按钮 - 仅在编辑模式下显示 */}
                                {editMode && (
                                    <button
                                        onClick={() => handleRateBeanClick(bean as CoffeeBean)}
                                        className="text-[10px] text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
                                    >
                                        编辑
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 分割线和未评分咖啡豆区域 */}
            {unratedBeans.length > 0 && (
                <div className="mt-4">
                    <div
                        className="relative flex items-center mb-4 cursor-pointer"
                        onClick={toggleShowUnrated}
                    >
                        <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
                        <button className="flex items-center justify-center mx-3 text-[10px] text-neutral-600 dark:text-neutral-400">
                            {unratedBeans.length}款未评分咖啡豆
                            <svg
                                className={`ml-1 w-3 h-3 transition-transform duration-200 ${showUnrated ? 'rotate-180' : ''}`}
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                        <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
                    </div>

                    {/* 未评分咖啡豆列表 */}
                    {showUnrated && (
                        <div className="opacity-60">
                            {unratedBeans.map((bean, _index) => (
                                <div
                                    key={bean.id}
                                    className="border-b border-neutral-200/60 dark:border-neutral-800/40 last:border-none"
                                >
                                    <div className="flex justify-between items-start px-6 py-2.5">
                                        <div className="flex items-start">
                                            {/* 咖啡豆信息 */}
                                            <div className="cursor-pointer">
                                                <div className="flex items-center">
                                                    <div className="text-[11px] text-neutral-800 dark:text-neutral-100">{bean.name}</div>
                                                </div>
                                                <div className="text-[10px] text-neutral-600 dark:text-neutral-400 mt-0.5">
                                                    {(() => {
                                                        // 显示信息数组
                                                        const infoArray: (React.ReactNode | string)[] = [];
                                                        
                                                        // 豆子类型 - 只有在"全部豆子"视图下显示
                                                        if (beanType === 'all') {
                                                            infoArray.push(bean.beanType === 'espresso' ? '意式豆' : '手冲豆');
                                                        }
                                                        
                                                        // Roast Level - Conditionally display
                                                        if (bean.roastLevel && bean.roastLevel !== '未知') {
                                                            infoArray.push(bean.roastLevel);
                                                        }
                                                        
                                                        // 每克价格
                                                        const pricePerGram = calculatePricePerGram(bean);
                                                        if (pricePerGram) {
                                                            infoArray.push(`${pricePerGram}元/克`);
                                                        }
                                                        
                                                        return infoArray.map((info, index) => (
                                                            <React.Fragment key={index}>
                                                                {index > 0 && <span className="mx-1">·</span>}
                                                                {info}
                                                            </React.Fragment>
                                                        ));
                                                    })()}
                                                </div>
                                            </div>
                                        </div>

                                        {/* 添加评分按钮 */}
                                        <button
                                            onClick={() => handleRateBeanClick(bean as CoffeeBean)}
                                            className="text-[10px] text-neutral-800 dark:text-neutral-100 hover:opacity-80"
                                        >
                                            添加评分
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 数据来源 - 仅在博主榜单模式下显示 */}
            {viewMode === 'blogger' && ratedBeans.length > 0 && (
                <div className="mt-4 text-center text-[10px] text-neutral-500 dark:text-neutral-400">
                    <span 
                        className="cursor-pointer underline"
                        onClick={() => openLink('https://kdocs.cn/l/cr1urhFNvrgK')}
                    >
                        数据来自于 Peter 咖啡豆评测榜单
                    </span>
                </div>
            )}
        </div>
    );
};

export default CoffeeBeanRanking; 