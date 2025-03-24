'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CoffeeBean } from '@/app/types'
import { CoffeeBeanManager } from '@/lib/coffeeBeanManager'

// 定义组件属性接口
interface CoffeeBeanListProps {
    onSelect: (beanId: string | null, bean: CoffeeBean | null) => void
}

const CoffeeBeanList: React.FC<CoffeeBeanListProps> = ({
    onSelect,
}) => {
    const [beans, setBeans] = useState<CoffeeBean[]>([])
    const [loading, setLoading] = useState(true)

    // 加载咖啡豆数据
    useEffect(() => {
        const loadBeans = async () => {
            try {
                setLoading(true)
                const loadedBeans = await CoffeeBeanManager.getAllBeans()
                // 按时间降序排序，最新添加的在最前面
                const sortedBeans = [...loadedBeans].sort((a, b) => b.timestamp - a.timestamp)
                setBeans(sortedBeans)
            } catch {

            } finally {
                setLoading(false)
            }
        }

        loadBeans()
    }, [])

    // 计算单价
    const calculateUnitPrice = (bean: CoffeeBean): string => {
        if (!bean.price || !bean.capacity) return "未知";

        try {
            const price = parseFloat(bean.price.replace(/[^\d.]/g, ''));
            const capacity = parseFloat(bean.capacity.replace(/[^\d.]/g, ''));

            if (isNaN(price) || isNaN(capacity) || capacity === 0) return "未知";

            const unitPrice = price / capacity;
            return `¥${unitPrice.toFixed(2)}/g`;
        } catch {
            return "未知";
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <div className="w-8 h-8 border-t-2 border-neutral-800 dark:border-neutral-200 rounded-full animate-spin"></div>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            {/* 添加"不选择咖啡豆"选项 */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
            >
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
            </motion.div>

            {beans.map((bean, index) => {
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
                        let maxDay = bean.maxDay || 0;

                        // 如果没有自定义值，则根据烘焙度设置默认值
                        if (startDay === 0 && endDay === 0 && maxDay === 0) {
                            if (bean.roastLevel?.includes('浅')) {
                                startDay = 7;
                                endDay = 14;
                                maxDay = 28;
                            } else if (bean.roastLevel?.includes('深')) {
                                startDay = 14;
                                endDay = 28;
                                maxDay = 42;
                            } else {
                                // 默认为中烘焙
                                startDay = 10;
                                endDay = 21;
                                maxDay = 35;
                            }
                        }

                        if (daysSinceRoast < startDay) {
                            // 还没到最佳赏味期
                            freshStatus = `(养豆期)`;
                            statusClass = "text-neutral-500 dark:text-neutral-400";
                        } else if (daysSinceRoast <= endDay) {
                            // 处于最佳赏味期
                            freshStatus = `(最佳赏味期)`;
                            statusClass = "text-emerald-500 dark:text-emerald-400";
                        } else if (daysSinceRoast <= maxDay) {
                            // 已过最佳赏味期但仍可饮用
                            freshStatus = `(赏味期)`;
                            statusClass = "text-neutral-500 dark:text-neutral-400";
                        } else {
                            // 已超过推荐饮用期限
                            freshStatus = "(赏味衰退期)";
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

                // 添加单克价信息
                const unitPrice = calculateUnitPrice(bean);
                if (unitPrice !== "未知") {
                    items.push(`单克价 ${unitPrice.replace('¥', '').replace('/g', '')} 元`);
                }

                // 添加剩余容量信息
                const remaining = typeof bean.remaining === 'string' ? parseFloat(bean.remaining) : bean.remaining;
                if (!isNaN(remaining) && remaining > 0) {
                    items.push(`剩容量 ${remaining} 克`);
                }

                return (
                    <motion.div
                        key={bean.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        transition={{
                            duration: 0.3,
                            delay: index * 0.03,
                            ease: "easeOut"
                        }}
                    >
                        <div
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
                    </motion.div>
                );
            })}
        </div>
    )
}

export default CoffeeBeanList 