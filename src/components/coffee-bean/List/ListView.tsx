'use client'

import React, { useState, useEffect, useTransition, useCallback, useMemo, useRef } from 'react'
import Image from 'next/image'
import { CoffeeBean } from '@/types/app'
import { CoffeeBeanManager } from '@/lib/managers/coffeeBeanManager'
import { globalCache } from './globalCache'

// 每页加载的咖啡豆数量 - 增加到20个，减少分页频率
const PAGE_SIZE = 8;

// 定义组件属性接口
interface CoffeeBeanListProps {
    onSelect: (beanId: string | null, bean: CoffeeBean | null) => void
    isOpen?: boolean
    searchQuery?: string  // 添加搜索查询参数
    highlightedBeanId?: string | null // 添加高亮咖啡豆ID参数
}

// 移除全局缓存变量，确保每次都从CoffeeBeanManager获取最新数据

const CoffeeBeanList: React.FC<CoffeeBeanListProps> = ({
    onSelect,
    isOpen: _isOpen = true,
    searchQuery = '',  // 添加搜索查询参数默认值
    highlightedBeanId = null // 添加高亮咖啡豆ID默认值
}) => {
    // 如果缓存已有数据，直接使用缓存初始化，避免闪烁
    const [beans, setBeans] = useState<CoffeeBean[]>(() =>
        globalCache.initialized ? globalCache.beans : []
    )
    const [_isPending, startTransition] = useTransition()
    const [forceRefreshKey, setForceRefreshKey] = useState(0) // 添加强制刷新的key

    // 移除了极简模式相关的设置状态

    // 添加ref用于存储咖啡豆元素列表
    const beanItemsRef = useRef<Map<string, HTMLDivElement>>(new Map());

    // 分页状态 - 如果缓存有数据，直接初始化分页数据
    const [displayedBeans, setDisplayedBeans] = useState<CoffeeBean[]>(() => {
        if (globalCache.initialized && globalCache.beans.length > 0) {
            return globalCache.beans.slice(0, PAGE_SIZE);
        }
        return [];
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(() => {
        if (globalCache.initialized && globalCache.beans.length > 0) {
            return globalCache.beans.length > PAGE_SIZE;
        }
        return true;
    });
    const [isLoading, setIsLoading] = useState(false);
    const loaderRef = useRef<HTMLDivElement>(null);

    // 移除了极简模式相关的设置加载逻辑


    // 优化的加载咖啡豆数据函数 - 支持强制刷新
    const loadBeans = useCallback(async (forceReload = false) => {
        try {
            // 如果强制刷新或缓存未初始化，则重新加载数据
            if (forceReload || !globalCache.initialized || globalCache.beans.length === 0) {
                console.log('ListView: 重新加载咖啡豆数据', { forceReload, initialized: globalCache.initialized, beansCount: globalCache.beans.length });

                const loadedBeans = await CoffeeBeanManager.getAllBeans();

                // 更新全局缓存
                globalCache.beans = loadedBeans;
                globalCache.initialized = true;

                // 使用 useTransition 包裹状态更新，避免界面闪烁
                startTransition(() => {
                    setBeans(loadedBeans);
                });
            } else {
                // 使用缓存数据
                startTransition(() => {
                    setBeans(globalCache.beans);
                });
            }
        } catch (error) {
            console.error("加载咖啡豆数据失败:", error);
        }
    }, []);

    // 优化的数据加载逻辑 - 首次挂载和强制刷新时加载
    useEffect(() => {
        const shouldForceReload = forceRefreshKey > 0;
        loadBeans(shouldForceReload);
    }, [forceRefreshKey, loadBeans]);

    // 监听咖啡豆更新事件 - 统一监听所有相关事件
    useEffect(() => {
        const handleBeansUpdated = async (event?: Event) => {
            console.log('ListView: 检测到咖啡豆数据更新事件', event?.type);

            // 清除CoffeeBeanManager缓存
            try {
                const { CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager');
                CoffeeBeanManager.clearCache();
            } catch (error) {
                console.error('清除CoffeeBeanManager缓存失败:', error);
            }

            // 清除全局缓存，强制重新加载
            globalCache.beans = [];
            globalCache.initialized = false;

            // 强制刷新组件，确保触发重新加载
            setForceRefreshKey(prev => {
                const newKey = prev + 1;
                console.log('ListView: 设置强制刷新key', newKey);
                return newKey;
            });
        };

        // 监听所有相关的咖啡豆更新事件
        window.addEventListener('coffeeBeansUpdated', handleBeansUpdated);
        window.addEventListener('coffeeBeanDataChanged', handleBeansUpdated);
        window.addEventListener('coffeeBeanListChanged', handleBeansUpdated);

        return () => {
            window.removeEventListener('coffeeBeansUpdated', handleBeansUpdated);
            window.removeEventListener('coffeeBeanDataChanged', handleBeansUpdated);
            window.removeEventListener('coffeeBeanListChanged', handleBeansUpdated);
        };
    }, []);



    // 计算咖啡豆的赏味期阶段和剩余天数 - 使用缓存优化性能
    const getFlavorInfo = useCallback((bean: CoffeeBean) => {
        // 处理在途状态
        if (bean.isInTransit) {
            return { phase: '在途', remainingDays: 0 };
        }

        // 处理冰冻状态
        if (bean.isFrozen) {
            return { phase: '冰冻', remainingDays: 0 };
        }

        if (!bean.roastDate) {
            return { phase: '衰退期', remainingDays: 0 };
        }

        const today = new Date();
        const roastDate = new Date(bean.roastDate);
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const roastDateOnly = new Date(roastDate.getFullYear(), roastDate.getMonth(), roastDate.getDate());
        const daysSinceRoast = Math.ceil((todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24));

        let startDay = bean.startDay || 0;
        let endDay = bean.endDay || 0;

        // 如果没有自定义值，则根据烘焙度设置默认值
        if (startDay === 0 && endDay === 0) {
            if (bean.roastLevel?.includes('浅')) {
                startDay = 7;
                endDay = 30;
            } else if (bean.roastLevel?.includes('深')) {
                startDay = 14;
                endDay = 60;
            } else {
                // 默认为中烘焙
                startDay = 10;
                endDay = 30;
            }
        }

        if (daysSinceRoast < startDay) {
            // 养豆期
            return { phase: '养豆期', remainingDays: startDay - daysSinceRoast };
        } else if (daysSinceRoast <= endDay) {
            // 赏味期
            return { phase: '赏味期', remainingDays: endDay - daysSinceRoast };
        } else {
            // 衰退期
            return { phase: '衰退期', remainingDays: 0 };
        }
    }, []);

    // 获取阶段数值用于排序
    const getPhaseValue = (phase: string): number => {
        switch (phase) {
            case '在途': return -1; // 在途状态优先级最高
            case '冰冻': return 0; // 冰冻状态与赏味期同等优先级
            case '赏味期': return 0;
            case '养豆期': return 1;
            case '衰退期':
            default: return 2;
        }
    }

    // 过滤出未用完的咖啡豆，并按赏味期排序
    const availableBeans = useMemo(() => {
        // 首先过滤掉剩余量为0(且设置了容量)的咖啡豆和在途状态的咖啡豆
        const filteredBeans = beans.filter(bean => {
            // 过滤掉在途状态的咖啡豆
            if (bean.isInTransit) {
                return false;
            }

            // 如果没有设置容量，则直接显示
            if (!bean.capacity || bean.capacity === '0' || bean.capacity === '0g') {
                return true;
            }

            // 考虑remaining可能是字符串或者数字
            const remaining = typeof bean.remaining === 'string'
                ? parseFloat(bean.remaining)
                : Number(bean.remaining);

            // 只过滤掉有容量设置且剩余量为0的咖啡豆
            return remaining > 0;
        });

        // 然后按照赏味期等进行排序（与添加笔记页面保持一致）
        return [...filteredBeans].sort((a, b) => {
            const { phase: phaseA, remainingDays: daysA } = getFlavorInfo(a);
            const { phase: phaseB, remainingDays: daysB } = getFlavorInfo(b);

            // 首先按照阶段排序：赏味期 > 养豆期 > 衰退期
            if (phaseA !== phaseB) {
                const phaseValueA = getPhaseValue(phaseA);
                const phaseValueB = getPhaseValue(phaseB);
                return phaseValueA - phaseValueB;
            }

            // 如果阶段相同，根据不同阶段有不同的排序逻辑
            if (phaseA === '赏味期') {
                // 赏味期内，剩余天数少的排在前面
                return daysA - daysB;
            } else if (phaseA === '养豆期') {
                // 养豆期内，剩余天数少的排在前面（离赏味期近的优先）
                return daysA - daysB;
            } else {
                // 衰退期按烘焙日期新的在前
                if (!a.roastDate || !b.roastDate) return 0;
                return new Date(b.roastDate).getTime() - new Date(a.roastDate).getTime();
            }
        });
    }, [beans]);

    // 搜索过滤
    const filteredBeans = useMemo(() => {
        if (!searchQuery?.trim()) return availableBeans;

        const query = searchQuery.toLowerCase().trim();
        return availableBeans.filter(bean =>
            bean.name?.toLowerCase().includes(query)
        );
    }, [availableBeans, searchQuery]);

    // 初始化分页数据 - 优化性能，避免JSON.stringify比较
    useEffect(() => {
        // 每次筛选条件变化时，重置分页状态
        setCurrentPage(1);
        const initialBeans = filteredBeans.slice(0, PAGE_SIZE);

        // 使用长度和ID比较，避免深度比较
        setDisplayedBeans(prevBeans => {
            if (prevBeans.length !== initialBeans.length ||
                prevBeans.some((bean, index) => bean.id !== initialBeans[index]?.id)) {
                return initialBeans;
            }
            return prevBeans;
        });

        const newHasMore = filteredBeans.length > PAGE_SIZE;
        setHasMore(prevHasMore => {
            if (prevHasMore !== newHasMore) {
                return newHasMore;
            }
            return prevHasMore;
        });
    }, [filteredBeans]);

    // 加载更多咖啡豆
    const loadMoreBeans = useCallback(() => {
        if (!hasMore || isLoading) return;

        setIsLoading(true);

        try {
            // 计算下一页的咖啡豆
            const nextPage = currentPage + 1;
            const endIndex = nextPage * PAGE_SIZE;

            // 使用筛选后的咖啡豆作为数据源
            const newDisplayedBeans = filteredBeans.slice(0, endIndex);

            // 如果加载的数量和筛选后的总数一样，说明没有更多数据了
            const noMoreBeans = newDisplayedBeans.length >= filteredBeans.length;

            setDisplayedBeans(newDisplayedBeans);
            setCurrentPage(nextPage);
            setHasMore(!noMoreBeans);
        } catch (error) {
            console.error('加载更多咖啡豆失败:', error);
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, filteredBeans, hasMore, isLoading]);

    // 设置IntersectionObserver来监听加载更多的元素
    useEffect(() => {
        if (!loaderRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreBeans();
                }
            },
            { threshold: 0.1 } // 降低阈值，提高加载触发敏感度
        );

        observer.observe(loaderRef.current);

        return () => {
            if (loaderRef.current) {
                observer.unobserve(loaderRef.current);
            }
        };
    }, [hasMore, loadMoreBeans]);

    // 设置ref的回调函数
    const setItemRef = useCallback((id: string) => (node: HTMLDivElement | null) => {
        if (node) {
            beanItemsRef.current.set(id, node);
        } else {
            beanItemsRef.current.delete(id);
        }
    }, []);

    // 滚动到高亮的咖啡豆
    useEffect(() => {
        if (highlightedBeanId && beanItemsRef.current.has(highlightedBeanId)) {
            // 滚动到高亮的咖啡豆
            const node = beanItemsRef.current.get(highlightedBeanId);
            node?.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, [highlightedBeanId]);

    // 删除加载动画，直接显示内容

    return (
        <div className="space-y-5 pb-20">
            {/* 添加"不选择咖啡豆"选项 */}
            <div
                className="group relative cursor-pointer text-neutral-500 dark:text-neutral-400 transition-all duration-300"
                onClick={() => onSelect(null, null)}
            >
                <div className="cursor-pointer">
                    <div className="flex gap-3">
                        {/* 左侧图标区域 - 实线边框，空内容 */}
                        <div className="relative self-start">
                            <div className="w-14 h-14 relative shrink-0 rounded border border-neutral-200/50 dark:border-neutral-800/50 bg-neutral-100 dark:bg-neutral-800/20">
                                {/* 空内容，表示"不选择" */}
                            </div>
                        </div>

                        {/* 右侧内容区域 - 与图片等高 */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-y-1.5 h-14">
                            {/* 选项名称 */}
                            <div className="text-xs font-medium text-neutral-800 dark:text-neutral-100 leading-tight line-clamp-2 text-justify">
                                不使用咖啡豆
                            </div>

                            {/* 描述信息 */}
                            <div className="flex items-center text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                                <span className="shrink-0">跳过咖啡豆选择</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 显示无搜索结果的提示 */}
            {filteredBeans.length === 0 && searchQuery.trim() !== '' && (
                <div className="flex gap-3">
                    {/* 左侧占位区域 - 与咖啡豆图片保持一致的尺寸 */}
                    <div className="w-14 h-14 shrink-0"></div>

                    {/* 右侧内容区域 */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center h-14">
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            没有找到匹配&quot;{searchQuery.trim()}&quot;的咖啡豆
                        </div>
                    </div>
                </div>
            )}

            {displayedBeans.map((bean) => {
                // 预计算所有需要的数据，避免在渲染中重复计算
                const flavorInfo = getFlavorInfo(bean);
                const { phase } = flavorInfo;

                // 获取赏味期状态
                let freshStatus = "";
                let statusClass = "text-neutral-500 dark:text-neutral-400";

                if (bean.isInTransit) {
                    freshStatus = "(在途)";
                    statusClass = "text-neutral-600 dark:text-neutral-400";
                } else if (bean.isFrozen) {
                    freshStatus = "(冰冻)";
                    statusClass = "text-blue-400 dark:text-blue-300";
                } else if (bean.roastDate) {
                    if (phase === '养豆期') {
                        freshStatus = `(养豆期)`;
                        statusClass = "text-neutral-500 dark:text-neutral-400";
                    } else if (phase === '赏味期') {
                        freshStatus = `(赏味期)`;
                        statusClass = "text-emerald-500 dark:text-emerald-400";
                    } else {
                        freshStatus = "(衰退期)";
                        statusClass = "text-neutral-500 dark:text-neutral-400";
                    }
                }

                // 预计算格式化函数
                const formatNumber = (value: string | undefined): string =>
                    !value ? '0' : (Number.isInteger(parseFloat(value)) ? Math.floor(parseFloat(value)).toString() : value);

                const formatDateShort = (dateStr: string): string => {
                    const date = new Date(dateStr);
                    const year = date.getFullYear().toString().slice(-2); // 获取年份的最后两位
                    return `${year}-${date.getMonth() + 1}-${date.getDate()}`;
                };

                const formatPricePerGram = (price: string, capacity: string): string => {
                    const priceNum = parseFloat(price);
                    const capacityNum = parseFloat(capacity.replace('g', ''));
                    if (isNaN(priceNum) || isNaN(capacityNum) || capacityNum === 0) return '';
                    return `${(priceNum / capacityNum).toFixed(2)}元/克`;
                };

                // 构建参数信息项
                const infoItems = [];
                if (bean.roastDate && !bean.isInTransit) {
                    infoItems.push(formatDateShort(bean.roastDate));
                }

                const remaining = typeof bean.remaining === 'string' ? parseFloat(bean.remaining) : bean.remaining ?? 0;
                const capacity = typeof bean.capacity === 'string' ? parseFloat(bean.capacity) : bean.capacity ?? 0;
                if (remaining > 0 && capacity > 0) {
                    infoItems.push(`${formatNumber(bean.remaining)}/${formatNumber(bean.capacity)}克`);
                }

                if (bean.price && bean.capacity) {
                    infoItems.push(formatPricePerGram(bean.price, bean.capacity));
                }

                // 获取状态圆点的颜色
                const getStatusDotColor = (phase: string): string => {
                    switch (phase) {
                        case '养豆期': return 'bg-amber-400';
                        case '赏味期': return 'bg-green-400';
                        case '衰退期': return 'bg-red-400';
                        case '在途': return 'bg-blue-400';
                        case '冰冻': return 'bg-cyan-400';
                        default: return 'bg-neutral-400';
                    }
                };

                return (
                    <div
                        key={bean.id}
                        ref={setItemRef(bean.id)}
                        className="group relative cursor-pointer text-neutral-500 dark:text-neutral-400 transition-all duration-300"
                        onClick={() => onSelect(bean.id, bean)}
                    >
                        <div className="cursor-pointer">
                            <div className="flex gap-3">
                                {/* 左侧图片区域 - 固定显示，缩小尺寸 */}
                                <div className="relative self-start">
                                    <div className="w-14 h-14 relative shrink-0 cursor-pointer rounded border border-neutral-200/50 dark:border-neutral-800/50 bg-neutral-100 dark:bg-neutral-800/20 overflow-hidden">
                                        {bean.image ? (
                                            <Image
                                                src={bean.image}
                                                alt={bean.name || '咖啡豆图片'}
                                                width={56}
                                                height={56}
                                                className="w-full h-full object-cover"
                                                key={`${bean.id}-${forceRefreshKey}`} // 添加key强制重新加载图片
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                }}
                                                onLoad={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'block';
                                                }}
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-neutral-400 dark:text-neutral-600">
                                                {bean.name ? bean.name.charAt(0) : '豆'}
                                            </div>
                                        )}
                                    </div>

                                    {/* 状态圆点 - 右下角，边框超出图片边界 - 只有当有赏味期数据时才显示 */}
                                    {bean.roastDate && (bean.startDay || bean.endDay || bean.roastLevel) && (
                                        <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${getStatusDotColor(phase)} border-2 border-neutral-50 dark:border-neutral-900`} />
                                    )}
                                </div>

                                {/* 右侧内容区域 - 与图片等高 */}
                                <div className="flex-1 min-w-0 flex flex-col justify-center gap-y-1.5 h-14">
                                    {/* 咖啡豆名称和烘焙度 */}
                                    <div className="text-xs font-medium text-neutral-800 dark:text-neutral-100 leading-tight line-clamp-2 text-justify">
                                        {bean.name}
                                        {bean.roastLevel && ` ${bean.roastLevel}`}
                                        <span className={statusClass}> {freshStatus}</span>
                                    </div>

                                    {/* 其他信息 */}
                                    <div className="flex items-center text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                                        {infoItems.map((item, i) => (
                                            <React.Fragment key={i}>
                                                <span className="shrink-0">{item}</span>
                                                {i < infoItems.length - 1 && (
                                                    <span className="mx-2 text-neutral-400 dark:text-neutral-600">·</span>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* 加载更多指示器 */}
            {hasMore && (
                <div
                    ref={loaderRef}
                    className="flex justify-center items-center py-4"
                >
                    <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                        {isLoading ? '正在加载...' : '上滑加载更多'}
                    </div>
                </div>
            )}
        </div>
    )
}

// 使用 React.memo 包装组件以避免不必要的重新渲染
export default React.memo(CoffeeBeanList)