'use client'

import React, { useState, useEffect, useTransition, useCallback, useMemo, useRef } from 'react'
import { CoffeeBean } from '@/types/app'
import { CoffeeBeanManager } from '@/lib/managers/coffeeBeanManager'
import { Storage } from '@/lib/core/storage'
import { SettingsOptions } from '@/components/settings/Settings'

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
    isOpen = true,
    searchQuery = '',  // 添加搜索查询参数默认值
    highlightedBeanId = null // 添加高亮咖啡豆ID默认值
}) => {
    const [beans, setBeans] = useState<CoffeeBean[]>([])
    const [_isPending, startTransition] = useTransition()
    const [isFirstLoad, setIsFirstLoad] = useState(true)
    const [forceRefreshKey, setForceRefreshKey] = useState(0) // 添加强制刷新的key

    // 添加设置状态
    const [hidePrice, setHidePrice] = useState(false) // 默认显示价格

    // 添加ref用于存储咖啡豆元素列表
    const beanItemsRef = useRef<Map<string, HTMLDivElement>>(new Map());

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
    const isBeanEmpty = (bean: CoffeeBean): boolean => {
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

    // 获取阶段数值用于排序
    const getPhaseValue = useCallback((phase: string): number => {
        switch (phase) {
            case '在途': return -1; // 在途状态优先级最高
            case '冰冻': return 0; // 冰冻状态与赏味期同等优先级
            case '赏味期': return 0;
            case '养豆期': return 1;
            case '衰退期':
            default: return 2;
        }
    }, []);

    // 获取咖啡豆的赏味期信息
    const getFlavorInfo = useCallback((bean: CoffeeBean): { phase: string, remainingDays: number } => {
        // 处理冰冻状态
        if (bean.isFrozen) {
            return { phase: '冰冻', remainingDays: 0 };
        }
        
        if (!bean.roastDate) {
            return { phase: '衰退期', remainingDays: 0 };
        }

        // 计算天数差
        const today = new Date();
        const roastDate = new Date(bean.roastDate);
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const roastDateOnly = new Date(roastDate.getFullYear(), roastDate.getMonth(), roastDate.getDate());
        const daysSinceRoast = Math.ceil((todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24));

        // 优先使用自定义赏味期参数，如果没有则根据烘焙度计算
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

        let phase = '';
        let remainingDays = 0;

        if (daysSinceRoast < startDay) {
            phase = '养豆期';
            remainingDays = startDay - daysSinceRoast;
        } else if (daysSinceRoast <= endDay) {
            phase = '赏味期';
            remainingDays = endDay - daysSinceRoast;
        } else {
            phase = '衰退期';
            remainingDays = 0;
        }

        return { phase, remainingDays };
    }, []);

    // 排序咖啡豆
    const sortBeans = useCallback((beansToSort: CoffeeBean[]): CoffeeBean[] => {
        return [...beansToSort].sort((a, b) => {
            const { phase: phaseA, remainingDays: daysA } = getFlavorInfo(a);
            const { phase: phaseB, remainingDays: daysB } = getFlavorInfo(b);

            // 首先按照阶段排序：最佳期 > 赏味期 > 养豆期 > 衰退期
            if (phaseA !== phaseB) {
                // 将阶段转换为数字进行比较
                const phaseValueA = getPhaseValue(phaseA);
                const phaseValueB = getPhaseValue(phaseB);
                return phaseValueA - phaseValueB;
            }

            // 如果阶段相同，根据不同阶段有不同的排序逻辑
            if (phaseA === '最佳赏味期') {
                // 最佳赏味期内，剩余天数少的排在前面
                return daysA - daysB;
            } else if (phaseA === '赏味期') {
                // 赏味期内，剩余天数少的排在前面
                return daysA - daysB;
            } else if (phaseA === '养豆期') {
                // 养豆期内，剩余天数少的排在前面（离最佳期近的优先）
                return daysA - daysB;
            } else {
                // 衰退期按烘焙日期新的在前
                if (!a.roastDate || !b.roastDate) return 0;
                return new Date(b.roastDate).getTime() - new Date(a.roastDate).getTime();
            }
        });
    }, [getFlavorInfo, getPhaseValue]);

    // 优化的加载咖啡豆数据函数 - 减少不必要的过滤和排序
    const loadBeans = useCallback(async () => {
        try {
            // 显示加载状态
            setIsFirstLoad(true);

            const loadedBeans = await CoffeeBeanManager.getAllBeans();

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

    // 优化的数据加载逻辑 - 减少重复触发
    useEffect(() => {
        if (isOpen) {
            loadBeans();
        }
    }, [isOpen, forceRefreshKey, loadBeans]);

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
    const calculateUnitPrice = (bean: CoffeeBean): string => {
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

    // 搜索过滤的咖啡豆
    const filteredBeans = useMemo(() => {
        if (!searchQuery?.trim()) return beans;
        
        const query = searchQuery.toLowerCase().trim();
        return beans.filter(bean => 
            bean.name?.toLowerCase().includes(query)
        );
    }, [beans, searchQuery]);

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

            {filteredBeans.map((bean) => {
                // 获取赏味期状态（添加到咖啡豆名称后面）
                let freshStatus = "";
                let statusClass = "text-rose-500 dark:text-rose-400";

                if (bean.isFrozen) {
                    // 冰冻状态处理
                    freshStatus = "(冰冻)";
                    statusClass = "text-blue-400 dark:text-blue-300";
                } else if (bean.roastDate) {
                    try {
                        // 消除时区和时间差异，只比较日期部分
                        const today = new Date();
                        const roastDate = new Date(bean.roastDate);

                        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                        const roastDateOnly = new Date(roastDate.getFullYear(), roastDate.getMonth(), roastDate.getDate());

                        // 计算天数差
                        const daysSinceRoast = Math.ceil((todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24));

                        // 优先使用自定义赏味期参数，如果没有则根据烘焙度计算
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
                            // 还没到最佳赏味期
                            freshStatus = `(养豆期)`;
                            statusClass = "text-neutral-500 dark:text-neutral-400";
                        } else if (daysSinceRoast <= endDay) {
                            // 处于赏味期
                            freshStatus = `(赏味期)`;
                            statusClass = "text-emerald-500 dark:text-emerald-400";
                        } else {
                            // 已超过推荐饮用期限
                            freshStatus = "(衰退期)";
                            statusClass = "text-neutral-500 dark:text-neutral-400";
                        }
                    } catch {
                        // 忽略日期解析错误
                    }
                }

                // 准备简洁的信息列表
                const items = [];

                // 添加烘焙度信息
                if (bean.roastLevel) {
                    items.push(`烘焙度 ${bean.roastLevel}`);
                }

                // 添加单价信息 - 根据设置控制显示
                if (!hidePrice) {
                    const unitPrice = calculateUnitPrice(bean);
                    if (unitPrice !== "未知") {
                        items.push(`价格 ${unitPrice} 元/g`);
                    }
                }

                // 添加容量信息
                const remaining = typeof bean.remaining === 'string' ? parseFloat(bean.remaining) : bean.remaining ?? 0;
                const capacity = typeof bean.capacity === 'string' ? parseFloat(bean.capacity) : bean.capacity ?? 0;
                if (remaining > 0 && capacity > 0) {
                    items.push(`容量 ${remaining}/${capacity} g`);
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
                            pl-6 cursor-pointer text-neutral-500 dark:text-neutral-400 transition-all duration-300
                            ${isBeanEmpty(bean) ? 'bg-neutral-100/60 dark:bg-neutral-800/30' : ''}`}
                        onClick={() => onSelect(bean.id, bean)}
                    >
                        <div className="cursor-pointer">
                            <div className="flex items-baseline justify-between">
                                <div className="flex items-baseline gap-3 min-w-0 overflow-hidden">
                                    <h3 className="text-xs font-normal tracking-wider truncate">
                                        {bean.name} <span className={statusClass}>{freshStatus}</span>
                                    </h3>
                                </div>
                            </div>
                            <div className="mt-2">
                                <ul className="space-y-1">
                                    {items.map((item, i) => (
                                        <li key={i} className="text-xs font-light">
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    )
}

export default CoffeeBeanList 