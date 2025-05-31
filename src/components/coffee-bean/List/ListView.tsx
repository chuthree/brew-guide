'use client'

import React, { useState, useEffect, useTransition, useCallback, useMemo, useRef } from 'react'
import { CoffeeBean } from '@/types/app'
import { CoffeeBeanManager } from '@/lib/managers/coffeeBeanManager'
import { Storage } from '@/lib/core/storage'
import { SettingsOptions } from '@/components/settings/Settings'
import { globalCache } from './globalCache'

// 每页加载的咖啡豆数量
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
    // 如果缓存已经有数据，就不显示加载动画
    const [isFirstLoad, setIsFirstLoad] = useState(!globalCache.initialized || globalCache.beans.length === 0)
    const [forceRefreshKey, setForceRefreshKey] = useState(0) // 添加强制刷新的key

    // 添加设置状态
    const [_hidePrice, setHidePrice] = useState(false) // 默认显示价格

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

    // 加载设置
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const settingsStr = await Storage.get('brewGuideSettings');
                if (settingsStr) {
                    const parsedSettings = JSON.parse(settingsStr) as SettingsOptions;

                    // 加载细粒度设置选项，使用默认值作为后备
                    const minimalistOptions = parsedSettings.minimalistOptions || {
                        hideFlavors: true,
                        hidePrice: false, // 默认显示价格
                        hideRoastDate: false,
                        hideTotalWeight: true
                    };

                    setHidePrice(parsedSettings.minimalistMode && minimalistOptions.hidePrice);
                } else {
                    // 如果没有设置，使用默认值（价格默认显示）
                    setHidePrice(false);
                }
            } catch (error) {
                console.error('加载设置失败', error);
                // 出错时也使用默认值（价格默认显示）
                setHidePrice(false);
            }
        };

        loadSettings();

        // 监听设置变更
        const handleSettingsChange = (e: CustomEvent) => {
            if (e.detail?.key === 'brewGuideSettings') {
                loadSettings();
            }
        };

        window.addEventListener('storageChange', handleSettingsChange as EventListener);
        return () => {
            window.removeEventListener('storageChange', handleSettingsChange as EventListener);
        };
    }, []);

    // 检查咖啡豆是否用完
    const _isBeanEmpty = (bean: CoffeeBean): boolean => {
        // 处理remaining可能是字符串或数字的情况
        if (typeof bean.remaining === 'number') {
            return bean.remaining <= 0;
        }

        // 处理remaining是字符串的情况
        if (typeof bean.remaining === 'string') {
            // 移除所有非数字字符（除了小数点）并转换为数字
            const numericValue = parseFloat(bean.remaining.replace(/[^\d.]/g, ''));
            return isNaN(numericValue) || numericValue <= 0;
        }

        // 如果remaining未定义或为null，也视为空
        return true;
    }





    // 优化的加载咖啡豆数据函数 - 使用全局缓存避免重复加载
    const loadBeans = useCallback(async () => {
        try {
            // 如果全局缓存已初始化且有数据，什么都不做，避免状态变化导致闪烁
            if (globalCache.initialized && globalCache.beans.length > 0) {
                return;
            }

            // 只有在真正需要加载时才显示加载状态
            if (!globalCache.initialized) {
                setIsFirstLoad(true);
            }

            const loadedBeans = await CoffeeBeanManager.getAllBeans();

            // 更新全局缓存
            globalCache.beans = loadedBeans;
            globalCache.initialized = true;

            // 使用 useTransition 包裹状态更新，避免界面闪烁
            startTransition(() => {
                setBeans(loadedBeans);
                setIsFirstLoad(false);
            });
        } catch (error) {
            console.error("加载咖啡豆数据失败:", error);
            setIsFirstLoad(false);
        }
    }, []);

    // 优化的数据加载逻辑 - 只在首次挂载和强制刷新时加载
    useEffect(() => {
        loadBeans();
    }, [forceRefreshKey, loadBeans]);

    // 监听咖啡豆更新事件
    useEffect(() => {
        const handleBeansUpdated = () => {
            setForceRefreshKey(prev => prev + 1);
        };

        window.addEventListener('coffeeBeansUpdated', handleBeansUpdated);

        return () => {
            window.removeEventListener('coffeeBeansUpdated', handleBeansUpdated);
        };
    }, []);

    // 计算单价
    const _calculateUnitPrice = (bean: CoffeeBean): string => {
        if (!bean.price || !bean.capacity) return "未知";

        try {
            const price = parseFloat(bean.price.replace(/[^\d.]/g, ''));
            const capacity = parseFloat(bean.capacity.replace(/[^\d.]/g, ''));

            if (isNaN(price) || isNaN(capacity) || capacity === 0) return "未知";

            const unitPrice = price / capacity;
            return unitPrice.toFixed(2);
        } catch {
            return "未知";
        }
    }

    // 计算咖啡豆的赏味期阶段和剩余天数
    const getFlavorInfo = (bean: CoffeeBean) => {
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
    }

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

    // 初始化分页数据
    useEffect(() => {
        // 每次筛选条件变化时，重置分页状态
        setCurrentPage(1);
        const initialBeans = filteredBeans.slice(0, PAGE_SIZE);

        // 只有在数据真正变化时才更新状态，避免不必要的重新渲染
        setDisplayedBeans(prevBeans => {
            if (JSON.stringify(prevBeans) !== JSON.stringify(initialBeans)) {
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

    // 使用isFirstLoad替代原来的loading状态
    if (isFirstLoad) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <div className="w-8 h-8 border-t-2 border-neutral-800 dark:border-neutral-200 rounded-full animate-spin"></div>
            </div>
        )
    }

    return (
        <div className="space-y-5 pb-20">
            {/* 添加"不选择咖啡豆"选项 */}
            <div
                className={`group relative border-l border-neutral-200 dark:border-neutral-800 pl-6 cursor-pointer text-neutral-500 dark:text-neutral-400`}
                onClick={() => onSelect(null, null)}
            >
                <div className="cursor-pointer">
                    <div className="flex items-baseline justify-between">
                        <div className="flex items-baseline gap-3 min-w-0 overflow-hidden">
                            <h3 className="text-xs font-normal tracking-wider truncate">
                                不使用咖啡豆
                            </h3>
                        </div>
                    </div>
                    <div className="mt-2">
                        <p className="text-xs font-light">跳过咖啡豆选择</p>
                    </div>
                </div>
            </div>

            {/* 显示无搜索结果的提示 */}
            {filteredBeans.length === 0 && searchQuery.trim() !== '' && (
                <div className="text-xs text-neutral-500 dark:text-neutral-400 border-l border-neutral-200 dark:border-neutral-800 pl-6">
                    没有找到匹配&amp;quot;{searchQuery.trim()}&amp;quot;的咖啡豆
                </div>
            )}

            {displayedBeans.map((bean) => {
                // 获取赏味期状态
                let freshStatus = "";
                let statusClass = "text-neutral-500 dark:text-neutral-400";

                if (bean.isInTransit) {
                    // 在途状态处理
                    freshStatus = "(在途)";
                    statusClass = "text-neutral-600 dark:text-neutral-400";
                } else if (bean.isFrozen) {
                    // 冰冻状态处理
                    freshStatus = "(冰冻)";
                    statusClass = "text-blue-400 dark:text-blue-300";
                } else if (bean.roastDate) {
                    const { phase } = getFlavorInfo(bean);

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

                // 准备简洁的信息列表
                const items = [];

                // 添加容量信息
                const remaining = typeof bean.remaining === 'string' ? parseFloat(bean.remaining) : bean.remaining ?? 0;
                const capacity = typeof bean.capacity === 'string' ? parseFloat(bean.capacity) : bean.capacity ?? 0;
                if (remaining > 0 && capacity > 0) {
                    items.push(`容量 ${remaining}/${capacity} g`);
                }

                // 添加烘焙日期（在途状态不显示）
                if (bean.roastDate && !bean.isInTransit) {
                    items.push(`烘焙日期 ${bean.roastDate}`);
                }

                // 确定是否高亮当前咖啡豆
                const isHighlighted = highlightedBeanId === bean.id;

                return (
                    <div
                        key={bean.id}
                        ref={setItemRef(bean.id)}
                        className={`group relative border-l ${isHighlighted
                            ? 'border-neutral-800 dark:border-neutral-100'
                            : 'border-neutral-200 dark:border-neutral-800'}
                            pl-6 cursor-pointer text-neutral-500 dark:text-neutral-400 transition-all duration-300`}
                        onClick={() => onSelect(bean.id, bean)}
                    >
                        <div className="cursor-pointer">
                            <div className="flex gap-4">
                                {/* 左侧图片区域 - 正方形显示 */}
                                {bean.image && (
                                    <div className="w-16 h-16 relative shrink-0 border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                                        <img
                                            src={bean.image}
                                            alt={bean.name || '咖啡豆图片'}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                            }}
                                        />
                                    </div>
                                )}

                                {/* 右侧内容区域 - 与图片等高 */}
                                <div className={`flex-1 min-w-0 flex flex-col ${bean.image ? 'h-16 justify-between' : 'min-h-[2.5rem] justify-start gap-1.5'}`}>
                                    {/* 顶部：咖啡豆名称和烘焙度 */}
                                    <div className="flex-1 min-w-0 overflow-hidden">
                                        <div className="text-xs font-normal text-neutral-800 dark:text-neutral-100 leading-tight line-clamp-2 text-justify">
                                            {bean.name}
                                            {bean.roastLevel && ` ${bean.roastLevel}`}
                                            <span className={statusClass}> {freshStatus}</span>
                                        </div>
                                    </div>

                                    {/* 底部：其他信息 */}
                                    <div className="space-y-1">
                                        {items.map((item, i) => (
                                            <div key={i} className="text-[11px] tracking-widest text-neutral-600 dark:text-neutral-400 truncate leading-none">
                                                {item}
                                            </div>
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