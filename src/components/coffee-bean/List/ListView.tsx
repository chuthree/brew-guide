'use client'

import React, { useState, useEffect, useTransition, useCallback } from 'react'
import { CoffeeBean } from '@/types/app'
import { CoffeeBeanManager } from '@/lib/managers/coffeeBeanManager'

// 定义组件属性接口
interface CoffeeBeanListProps {
    onSelect: (beanId: string | null, bean: CoffeeBean | null) => void
    isOpen?: boolean
}

// 用于缓存咖啡豆数据
let cachedBeans: CoffeeBean[] | null = null;

const CoffeeBeanList: React.FC<CoffeeBeanListProps> = ({
    onSelect,
    isOpen = true
}) => {
    const [beans, setBeans] = useState<CoffeeBean[]>(cachedBeans || [])
    const [_isPending, startTransition] = useTransition()
    const [isFirstLoad, setIsFirstLoad] = useState(!cachedBeans)
    const [forceRefreshKey, setForceRefreshKey] = useState(0) // 添加强制刷新的key

    // 检查咖啡豆是否用完
    const isBeanEmpty = (bean: CoffeeBean): boolean => {
        return (bean.remaining === "0" || bean.remaining === "0g") && bean.capacity !== undefined;
    }

    // 获取阶段数值用于排序
    const getPhaseValue = useCallback((phase: string): number => {
        switch (phase) {
            case '赏味期': return 0;
            case '养豆期': return 1;
            case '衰退期':
            default: return 2;
        }
    }, []);

    // 获取咖啡豆的赏味期信息
    const getFlavorInfo = useCallback((bean: CoffeeBean): { phase: string, remainingDays: number } => {
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

    // 加载咖啡豆数据
    const loadBeans = useCallback(async () => {
        try {
            // 如果已有缓存数据，则不显示加载状态
            if (!cachedBeans) {
                setIsFirstLoad(true);
            }
                
            const loadedBeans = await CoffeeBeanManager.getAllBeans();

            // 过滤掉已经喝完的咖啡豆
            const availableBeans = loadedBeans.filter(bean => !isBeanEmpty(bean));

            // 按照赏味期排序
            const sortedBeans = sortBeans(availableBeans);

            // 使用 useTransition 包裹状态更新，避免界面闪烁
            startTransition(() => {
                setBeans(sortedBeans);
                cachedBeans = sortedBeans; // 更新缓存
                setIsFirstLoad(false);
            });
        } catch (error) {
            console.error("加载咖啡豆数据失败:", error);
            setIsFirstLoad(false);
        }
    }, [sortBeans]);

    // 当isOpen状态变化时重新加载数据
    useEffect(() => {
        if (isOpen) {
            loadBeans();
        }
    }, [isOpen, loadBeans]);

    // 初始化加载
    useEffect(() => {
        // 即使未设置isOpen，也尝试加载一次数据
        loadBeans();
    }, [loadBeans]);

    // 强制刷新时重新加载数据
    useEffect(() => {
        loadBeans();
    }, [forceRefreshKey, loadBeans]);

    // 监听咖啡豆更新事件
    useEffect(() => {
        // 处理自定义coffeeBeansUpdated事件
        const handleBeansUpdated = () => {
            // 清除缓存以确保获取最新数据
            cachedBeans = null;
            // 强制刷新
            setForceRefreshKey(prev => prev + 1);
        };

        // 添加事件监听
        window.addEventListener('coffeeBeansUpdated', handleBeansUpdated);
        
        // 清理函数
        return () => {
            window.removeEventListener('coffeeBeansUpdated', handleBeansUpdated);
        };
    }, [loadBeans]);

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

    // 使用isFirstLoad替代原来的loading状态
    if (isFirstLoad) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <div className="w-8 h-8 border-t-2 border-neutral-800 dark:border-neutral-200 rounded-full animate-spin"></div>
            </div>
        )
    }

    return (
        <div className="space-y-5 pb-12">
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

            {beans.map((bean) => {
                // 获取赏味期状态（添加到咖啡豆名称后面）
                let freshStatus = "";
                let statusClass = "text-rose-500 dark:text-rose-400";

                if (bean.roastDate) {
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

                // 添加单价信息
                const unitPrice = calculateUnitPrice(bean);
                if (unitPrice !== "未知") {
                    items.push(`价格 ${unitPrice} 元/g`);
                }

                // 添加容量信息
                const remaining = typeof bean.remaining === 'string' ? parseFloat(bean.remaining) : bean.remaining ?? 0;
                const capacity = typeof bean.capacity === 'string' ? parseFloat(bean.capacity) : bean.capacity ?? 0;
                if (remaining > 0 && capacity > 0) {
                    items.push(`容量 ${remaining}/${capacity} g`);
                }

                return (
                    <div
                        key={bean.id}
                        className={`group relative border-l border-neutral-200 dark:border-neutral-800 pl-6 cursor-pointer text-neutral-500 dark:text-neutral-400`}
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