'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { CoffeeBean } from '@/types/app'
import { getBloggerBeans, BloggerBean, BloggerType, getVideoUrlFromEpisode } from '@/lib/utils/csvUtils'
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore'

// 用于检测当前运行环境
const isMobileApp = typeof window !== 'undefined' && 
    window.hasOwnProperty('Capacitor') && 
     
    !!(window as Window & { Capacitor?: { isNative?: boolean } }).Capacitor?.isNative;

// 移动浏览器检测已移除（未使用）

// 处理链接打开的工具函数
const openLink = async (url: string) => {
    if (!url) return;

    try {
        // 仅在 Capacitor 原生应用环境中尝试使用 InAppBrowser
        if (isMobileApp) {
            try {
                // 动态导入 Capacitor InAppBrowser 插件
                 
                const { InAppBrowser } = await import('@capacitor/inappbrowser');
                
                // 使用系统浏览器打开链接（iOS上是SFSafariViewController，Android上是Custom Tabs）
                // 创建选项对象，避免类型检查问题
                const browserOptions = {
                    android: {
                        showTitle: false,
                        hideToolbarOnScroll: false,
                        viewStyle: 'FULLSCREEN',
                        startAnimation: 'SLIDE_IN_RIGHT',
                        exitAnimation: 'SLIDE_OUT_LEFT'
                    },
                    iOS: {
                        closeButtonText: 'Done',
                        viewStyle: 'FULLSCREEN',
                        animationEffect: 'FLIP_HORIZONTAL',
                        enableBarsCollapsing: false,
                        enableReadersMode: false
                    }
                };

                await InAppBrowser.openInSystemBrowser({
                    url,
                    options: browserOptions as unknown as Parameters<typeof InAppBrowser.openInSystemBrowser>[0]['options']
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
    hideFilters?: boolean
    beanType?: 'all' | 'espresso' | 'filter'
    editMode?: boolean
    viewMode?: 'personal' | 'blogger'
    year?: 2023 | 2024 | 2025
    blogger?: BloggerType
    // 搜索相关props
    isSearching?: boolean
    searchQuery?: string
    // 外部滚动容器（Virtuoso 使用）
    scrollParentRef?: HTMLElement
}

const CoffeeBeanRanking: React.FC<CoffeeBeanRankingProps> = ({
    isOpen,
    onShowRatingForm,
    sortOption = SORT_OPTIONS.RATING_DESC,
    hideFilters = false,
    beanType: externalBeanType,
    editMode: externalEditMode,
    viewMode = 'personal',
    year: externalYear,
    blogger: externalBlogger = 'peter',
    // 搜索相关props
    isSearching = false,
    searchQuery = '',
    scrollParentRef
}) => {
    const [ratedBeans, setRatedBeans] = useState<(CoffeeBean | BloggerBean)[]>([])
    const [unratedBeans, setUnratedBeans] = useState<CoffeeBean[]>([])
    const [beanType, setBeanType] = useState<'all' | 'espresso' | 'filter'>(externalBeanType || 'all')
    const [editMode, setEditMode] = useState(externalEditMode || false)
    const [showUnrated, setShowUnrated] = useState(false)
    const [refreshTrigger, setRefreshTrigger] = useState(0)
    const [year, setYear] = useState<2023 | 2024 | 2025>(externalYear || 2025)
    const [blogger, setBlogger] = useState<BloggerType>(externalBlogger)
    
    // 订阅 Zustand store 的咖啡豆数据，当数据变化时触发重新加载
    // 我们只订阅数组长度的变化，以避免不必要的重新渲染
    const storeBeans = useCoffeeBeanStore(state => state.beans)



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

    // 监听外部传入的博主类型变化
    useEffect(() => {
        if (externalBlogger !== undefined) {
            setBlogger(externalBlogger);
        }
    }, [externalBlogger]);

    // Fenix博主评分比较函数
    const compareFenixRating = useCallback((ratingA: string, ratingB: string): number => {
        // 解析评分：5+ -> {base: 5, modifier: 1}, 5 -> {base: 5, modifier: 0}, 5- -> {base: 5, modifier: -1}
        const parseRating = (rating: string) => {
            const trimmed = rating.trim();
            if (trimmed.endsWith('+')) {
                return { base: parseFloat(trimmed.slice(0, -1)), modifier: 1 };
            } else if (trimmed.endsWith('-')) {
                return { base: parseFloat(trimmed.slice(0, -1)), modifier: -1 };
            } else {
                return { base: parseFloat(trimmed), modifier: 0 };
            }
        };

        const a = parseRating(ratingA);
        const b = parseRating(ratingB);

        // 首先比较基础分数
        if (a.base !== b.base) {
            return b.base - a.base; // 降序：高分在前
        }

        // 基础分数相同时，比较修饰符：+ > 无修饰 > -
        return b.modifier - a.modifier;
    }, []);

    // 排序咖啡豆的函数
    const sortBeans = useCallback((beansToSort: CoffeeBean[], option: RankingSortOption): CoffeeBean[] => {
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
                return sorted.sort((a, b) => {
                    // Fenix博主使用特殊的评分比较逻辑
                    if (viewMode === 'blogger' && blogger === 'fenix') {
                        const aRating = (a as BloggerBean).originalRating || '0';
                        const bRating = (b as BloggerBean).originalRating || '0';
                        return compareFenixRating(aRating, bRating);
                    }
                    // 其他情况使用普通数值比较
                    return (b.overallRating || 0) - (a.overallRating || 0);
                });

            case SORT_OPTIONS.RATING_ASC:
                return sorted.sort((a, b) => {
                    // Fenix博主使用特殊的评分比较逻辑（反向）
                    if (viewMode === 'blogger' && blogger === 'fenix') {
                        const aRating = (a as BloggerBean).originalRating || '0';
                        const bRating = (b as BloggerBean).originalRating || '0';
                        return compareFenixRating(bRating, aRating); // 注意这里参数顺序相反
                    }
                    // 其他情况使用普通数值比较
                    return (a.overallRating || 0) - (b.overallRating || 0);
                });

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
    }, [viewMode, blogger, compareFenixRating]);

    // 加载咖啡豆数据的函数
    const loadBeans = useCallback(async () => {
        if (!isOpen) return;

        try {
            let ratedBeansData: (CoffeeBean | BloggerBean)[] = [];
            let unratedBeansData: CoffeeBean[] = [];

            if (viewMode === 'blogger') {
                // Use CSV utility function with the current year state and blogger type
                ratedBeansData = await getBloggerBeans(beanType, year, blogger);
                unratedBeansData = []; // Blogger view doesn't show unrated
            } else {
                // Load personal rated beans
                const { CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager');
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
    }, [isOpen, beanType, sortOption, viewMode, year, blogger, sortBeans]);

    // 在组件挂载、isOpen变化、beanType变化、sortOption变化、refreshTrigger变化或store数据变化时重新加载数据
    useEffect(() => {
        loadBeans();
    }, [loadBeans, refreshTrigger, storeBeans]);



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

    // 搜索过滤逻辑
    const filteredRatedBeans = React.useMemo(() => {
        if (!isSearching || !searchQuery.trim()) {
            return ratedBeans;
        }

        const query = searchQuery.toLowerCase().trim();
        const queryTerms = query.split(/\s+/).filter(term => term.length > 0);

        return ratedBeans.filter(bean => {
            // 检查豆子名称
            const nameMatch = bean.name?.toLowerCase().includes(query);

            // 检查产地（BloggerBean特有字段）
            const originMatch = (bean as BloggerBean).origin?.toLowerCase().includes(query);

            // 检查风味描述（BloggerBean特有字段）
            const flavorMatch = (bean as BloggerBean).flavorDescription?.toLowerCase().includes(query);

            // 检查烘焙度
            const roastLevelMatch = bean.roastLevel?.toLowerCase().includes(query);

            // 检查备注
            const notesMatch = bean.notes?.toLowerCase().includes(query) || bean.ratingNotes?.toLowerCase().includes(query);

            // 多关键词搜索：所有关键词都必须在某个字段中找到
            const multiTermMatch = queryTerms.every(term => {
                return bean.name?.toLowerCase().includes(term) ||
                       (bean as BloggerBean).origin?.toLowerCase().includes(term) ||
                       (bean as BloggerBean).flavorDescription?.toLowerCase().includes(term) ||
                       bean.roastLevel?.toLowerCase().includes(term) ||
                       bean.notes?.toLowerCase().includes(term) ||
                       bean.ratingNotes?.toLowerCase().includes(term);
            });

            return nameMatch || originMatch || flavorMatch || roastLevelMatch || notesMatch || multiTermMatch;
        });
    }, [ratedBeans, isSearching, searchQuery]);

    const filteredUnratedBeans = React.useMemo(() => {
        if (!isSearching || !searchQuery.trim()) {
            return unratedBeans;
        }

        const query = searchQuery.toLowerCase().trim();
        const queryTerms = query.split(/\s+/).filter(term => term.length > 0);

        return unratedBeans.filter(bean => {
            // 检查豆子名称
            const nameMatch = bean.name?.toLowerCase().includes(query);

            // 检查烘焙度
            const roastLevelMatch = bean.roastLevel?.toLowerCase().includes(query);

            // 检查备注
            const notesMatch = bean.notes?.toLowerCase().includes(query);

            // 检查风味描述（如果有）
            const flavorMatch = bean.flavor?.some(f => f.toLowerCase().includes(query));

            // 多关键词搜索：所有关键词都必须在某个字段中找到
            const multiTermMatch = queryTerms.every(term => {
                return bean.name?.toLowerCase().includes(term) ||
                       bean.roastLevel?.toLowerCase().includes(term) ||
                       bean.notes?.toLowerCase().includes(term) ||
                       bean.flavor?.some(f => f.toLowerCase().includes(term));
            });

            return nameMatch || roastLevelMatch || notesMatch || flavorMatch || multiTermMatch;
        });
    }, [unratedBeans, isSearching, searchQuery]);

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
                                className={`pb-1.5 px-3 text-xs relative ${beanType === 'all' ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                onClick={() => setBeanType('all')}
                            >
                                <span className="relative">全部豆子</span>
                                {beanType === 'all' && (
                                    <span className="absolute bottom-0 left-0 w-full h-px bg-neutral-800 dark:bg-white"></span>
                                )}
                            </button>
                            <button
                                className={`pb-1.5 px-3 text-xs relative ${beanType === 'espresso' ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                onClick={() => setBeanType('espresso')}
                            >
                                <span className="relative">意式豆</span>
                                {beanType === 'espresso' && (
                                    <span className="absolute bottom-0 left-0 w-full h-px bg-neutral-800 dark:bg-white"></span>
                                )}
                            </button>
                            <button
                                className={`pb-1.5 px-3 text-xs relative ${beanType === 'filter' ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                onClick={() => setBeanType('filter')}
                            >
                                <span className="relative">手冲豆</span>
                                {beanType === 'filter' && (
                                    <span className="absolute bottom-0 left-0 w-full h-px bg-neutral-800 dark:bg-white"></span>
                                )}
                            </button>
                        </div>

                        {/* 编辑按钮 - 仅在个人视图下显示 */}
                        {viewMode === 'personal' && (
                            <button
                                onClick={toggleEditMode}
                                className={`pb-1.5 px-3 text-xs relative ${editMode ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                            >
                                <span className="relative">{editMode ? '完成' : '编辑'}</span>
                                {editMode && (
                                    <span className="absolute bottom-0 left-0 w-full h-px bg-neutral-800 dark:bg-white"></span>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* 已评分咖啡豆区域 */}
            {filteredRatedBeans.length === 0 ? (
                <div className="flex h-28 items-center justify-center text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                    {isSearching && ratedBeans.length > 0 ? (
                        <div className="text-center">
                            <div>[ 没有找到匹配的咖啡豆 ]</div>
                            <div className="mt-1 text-[9px] opacity-70">尝试使用其他关键词搜索</div>
                        </div>
                    ) : viewMode === 'blogger' && blogger === 'fenix' && beanType === 'filter' ? (
                        <div className="text-center">
                            <div>[ 矮人博主暂无手冲豆数据 ]</div>
                            <div className="mt-1 text-[9px] opacity-70">请切换到&ldquo;意式豆&rdquo;或&ldquo;全部&rdquo;查看数据</div>
                        </div>
                    ) : (
                        <div>[ 有咖啡豆数据后，再来查看吧～ ]</div>
                    )}
                </div>
            ) : (
                <div className="w-full">
                    <Virtuoso
                        data={filteredRatedBeans}
                        customScrollParent={scrollParentRef}
                        itemContent={(index, bean) => (
                            <div className={`${index < filteredRatedBeans.length - 1 ? 'border-b border-neutral-200/60 dark:border-neutral-800/40' : ''}`}>
                                <div className="flex items-start px-6 py-3">
                                    {/* 序号 - 极简风格 */}
                                    <div className="text-xs font-medium text-neutral-600 dark:text-neutral-400 w-4 mr-2 shrink-0">
                                        {index + 1}
                                    </div>

                                    {/* 咖啡豆信息 */}
                                    <div className="cursor-pointer flex-1 min-w-0 ">
                                        <div className="flex items-center leading-none">
                                            <div className="text-xs font-medium text-neutral-800 dark:text-neutral-100 truncate">{bean.name}</div>
                                            <div className="ml-2 text-xs font-medium text-neutral-800 dark:text-neutral-100 shrink-0">
                                                {viewMode === 'blogger' && blogger === 'fenix' && (bean as BloggerBean).originalRating
                                                    ? (bean as BloggerBean).originalRating // 直接显示原始评分格式，如 5+, 5, 5-
                                                    : `+${(bean as CoffeeBean).overallRating !== undefined ? (bean as CoffeeBean).overallRating : 0}`
                                                }
                                            </div>
                                        </div>
                                        <div className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mt-1.5 text-justify">
                                            {(() => {
                                                // 显示信息数组
                                                const infoArray: (React.ReactNode | string)[] = [];
                                                
                                                // 矮人博主特殊信息显示
                                                if (viewMode === 'blogger' && blogger === 'fenix') {
                                                    const fenixBean = bean as BloggerBean;

                                                    // 产区信息
                                                    if (fenixBean.origin) {
                                                        infoArray.push(fenixBean.origin);
                                                    }

                                                    // 风味描述
                                                    if (fenixBean.flavorDescription) {
                                                        infoArray.push(fenixBean.flavorDescription);
                                                    }
                                                } else {
                                                    // 豆子类型 - 只有在"全部豆子"视图下显示
                                                    if (beanType === 'all') {
                                                        infoArray.push((bean as CoffeeBean).beanType === 'espresso' ? '意式豆' : '手冲豆');
                                                    }
                                                }
                                                
                                                // 处理法和烘焙度 - 仅对Peter博主显示
                                                if (viewMode === 'blogger' && blogger === 'peter') {
                                                    if ((bean as BloggerBean).year === 2025 && (bean as CoffeeBean).beanType === 'filter') {
                                                        // 2025手冲豆：处理法 · 烘焙度
                                                        const processInfo = (bean as BloggerBean).process && (bean as BloggerBean).process !== '/' ? (bean as BloggerBean).process : '';
                                                        const roastInfo = (bean as CoffeeBean).roastLevel && (bean as CoffeeBean).roastLevel !== '未知' && (bean as CoffeeBean).roastLevel !== '/' ? (bean as CoffeeBean).roastLevel as string : '';

                                                        if (processInfo && roastInfo) {
                                                            infoArray.push(`${processInfo} · ${roastInfo}`);
                                                        } else if (processInfo) {
                                                            infoArray.push(processInfo);
                                                        } else if (roastInfo) {
                                                            infoArray.push(roastInfo);
                                                        }
                                                    } else {
                                                        // 其他情况：只显示烘焙度
                                                        if ((bean as CoffeeBean).roastLevel && (bean as CoffeeBean).roastLevel !== '未知') {
                                                            infoArray.push((bean as CoffeeBean).roastLevel as string);
                                                        }
                                                    }
                                                } else if (viewMode !== 'blogger') {
                                                    // 个人榜单：显示烘焙度
                                                    if ((bean as CoffeeBean).roastLevel && (bean as CoffeeBean).roastLevel !== '未知') {
                                                        infoArray.push((bean as CoffeeBean).roastLevel as string);
                                                    }
                                                }
                                                
                                                // 视频期数 - 仅Peter博主榜单模式下显示
                                                if (viewMode === 'blogger' && blogger === 'peter' && (bean as BloggerBean).videoEpisode) {
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
                                                                key={`video-${(bean as CoffeeBean).id}`}
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
                                                const pricePerGram = calculatePricePerGram(bean as CoffeeBean);
                                                if (pricePerGram) {
                                                    infoArray.push(`${pricePerGram}元/克`);
                                                }
                                                
                                                // 意式豆特有信息 - 美式分数和奶咖分数 (Only for 2025 data)
                                                if ((bean as CoffeeBean).beanType === 'espresso' && viewMode === 'blogger' && (bean as BloggerBean).year === 2025) {
                                                    const bloggerBean = bean as BloggerBean;
                                                    if (bloggerBean.ratingEspresso !== undefined && bloggerBean.ratingMilkBased !== undefined) {
                                                        infoArray.push(`美式/奶咖:${bloggerBean.ratingEspresso}/${bloggerBean.ratingMilkBased}`);
                                                    } else if (bloggerBean.ratingEspresso !== undefined) {
                                                        infoArray.push(`美式:${bloggerBean.ratingEspresso}`);
                                                    } else if (bloggerBean.ratingMilkBased !== undefined) {
                                                        infoArray.push(`奶咖:${bloggerBean.ratingMilkBased}`);
                                                    }
                                                }
                                                


                                                // 评价备注 - 个人榜单模式下不在这里显示，改为独立区域显示
                                                // if (viewMode !== 'blogger' && bean.ratingNotes) {
                                                //     infoArray.push(bean.ratingNotes);
                                                // }
                                                
                                                // 渲染信息数组，在元素之间添加分隔点
                                                return infoArray.map((info, index) => (
                                                    <React.Fragment key={index}>
                                                        {index > 0 && <span className="mx-1">·</span>}
                                                        {info}
                                                    </React.Fragment>
                                                ));
                                            })()}
                                        </div>

                                        {/* 矮人博主优缺点显示区域 */}
                                        {viewMode === 'blogger' && blogger === 'fenix' && (
                                            <div className="mt-2 space-y-1">
                                                {(bean as BloggerBean).advantages && (
                                                    <div className="text-xs font-medium bg-neutral-200/30 dark:bg-neutral-800/40 p-1.5 rounded tracking-widest text-neutral-800/70 dark:text-neutral-400/85 leading-tight flex items-start">
                                                        <span className="w-3.5 shrink-0 text-center">+</span>
                                                        <span className="flex-1">{(bean as BloggerBean).advantages}</span>
                                                    </div>
                                                )}
                                                {(bean as BloggerBean).disadvantages && (
                                                    <div className="text-xs font-medium bg-neutral-200/30 dark:bg-neutral-800/40 p-1.5 rounded tracking-widest text-neutral-800/70 dark:text-neutral-400/85 leading-tight flex items-start">
                                                        <span className="w-3.5 shrink-0 text-center">-</span>
                                                        <span className="flex-1">{(bean as BloggerBean).disadvantages}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Peter博主备注显示区域 */}
                                        {(() => {
                                            const rn = (bean as CoffeeBean).ratingNotes;
                                            return viewMode === 'blogger' && blogger === 'peter' && typeof rn === 'string' && rn.trim();
                                        })() && (
                                            <div className="mt-2">
                                                <div className="text-xs font-medium bg-neutral-200/30 dark:bg-neutral-800/40 p-1.5 rounded tracking-widest text-neutral-800/70 dark:text-neutral-400/85 leading-tight">
                                                    {(bean as CoffeeBean).ratingNotes as string}
                                                </div>
                                            </div>
                                        )}

                                        {/* 个人榜单备注显示区域 */}
                                        {(() => {
                                            const rn = (bean as CoffeeBean).ratingNotes;
                                            return viewMode !== 'blogger' && typeof rn === 'string' && rn.trim();
                                        })() && (
                                            <div className="mt-2">
                                                <div className="text-xs font-medium bg-neutral-200/30 dark:bg-neutral-800/40 p-1.5 rounded tracking-widest text-neutral-800/70 dark:text-neutral-400/85 leading-tight">
                                                    {(bean as CoffeeBean).ratingNotes as string}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* 操作按钮 - 仅在编辑模式下显示 */}
                                    {editMode && (
                                        <button
                                            onClick={() => handleRateBeanClick(bean as CoffeeBean)}
                                            className="text-xs text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100 leading-none"
                                        >
                                            编辑
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    />
                </div>
            )}

            {/* 分割线和未评分咖啡豆区域 */}
            {filteredUnratedBeans.length > 0 && (
                <div className="mt-4">
                    <div
                        className="relative flex items-center mb-4 cursor-pointer"
                        onClick={toggleShowUnrated}
                    >
                        <div className="grow border-t border-neutral-200 dark:border-neutral-800"></div>
                        <button className="flex items-center justify-center mx-3 text-[10px] text-neutral-600 dark:text-neutral-400">
                            {isSearching && filteredUnratedBeans.length !== unratedBeans.length
                                ? `${filteredUnratedBeans.length}/${unratedBeans.length}款未评分咖啡豆`
                                : `${unratedBeans.length}款未评分咖啡豆`}
                            <svg
                                className={`ml-1 w-3 h-3 transition-transform duration-200 ${showUnrated ? 'rotate-180' : ''}`}
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                        <div className="grow border-t border-neutral-200 dark:border-neutral-800"></div>
                    </div>

                    {/* 未评分咖啡豆列表 */}
                    {showUnrated && (
                        <div className="opacity-60">
                            {filteredUnratedBeans.map((bean, index) => (
                                <div
                                    key={bean.id}
                                    className={`${index < filteredUnratedBeans.length - 1 ? 'border-b border-neutral-200/60 dark:border-neutral-800/40' : ''}`}
                                >
                                    <div className="flex justify-between items-start px-6 py-2.5">
                                        <div className="flex items-start">
                                            {/* 咖啡豆信息 */}
                                            <div className="cursor-pointer">
                                                <div className="flex items-center">
                                                    <div className="text-xs text-neutral-800 dark:text-neutral-100">{bean.name}</div>
                                                </div>
                                                <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 text-justify">
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
                                            className="text-xs text-neutral-800 dark:text-neutral-100 hover:opacity-80"
                                        >
                                            + 添加评分
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
                <div className="mt-4 text-center text-[10px] text-neutral-500 dark:text-neutral-400 space-y-1">
                    <div>
                        {blogger === 'fenix' ? (
                            <span
                                className="cursor-pointer underline"
                                onClick={() => openLink('https://docs.qq.com/sheet/DTXBmUEd3R25NaGNX')}
                            >
                                数据来自于 矮人(Fenix) 咖啡豆评测榜单 ( 同步时间：2025 / 8 / 21 )
                            </span>
                        ) : (
                            <span
                                className="cursor-pointer underline"
                                onClick={() => openLink(year === 2024 ? 'https://www.kdocs.cn/l/cmx9enIek2Hm' : 'https://kdocs.cn/l/cr1urhFNvrgK')}
                            >
                                数据来自于 Peter 咖啡豆评测榜单 ( 同步时间：2025 / 9 / 19 )
                            </span>
                        )}
                    </div>
                    <div className="text-[9px] opacity-70 mt-3">
                        
                    </div>
                </div>
            )}
        </div>
    );
};

export default CoffeeBeanRanking; 
