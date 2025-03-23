'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CoffeeBean } from '@/app/types'
import { CoffeeBeanManager } from '@/lib/coffeeBeanManager'

// 定义组件属性接口
interface CoffeeBeanListProps {
    selectedId?: string | null;
    onSelect: (beanId: string | null, bean: CoffeeBean | null) => void
}

const CoffeeBeanList: React.FC<CoffeeBeanListProps> = ({
    selectedId,
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
            } catch (error) {
                console.error('加载咖啡豆数据失败:', error)
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
                    className={`group relative border-l ${selectedId === null
                            ? "border-blue-500 dark:border-blue-400"
                            : "border-neutral-200 dark:border-neutral-800"
                        } pl-6 cursor-pointer ${selectedId === null
                            ? "text-blue-500 dark:text-blue-400"
                            : "text-neutral-500 dark:text-neutral-400"
                        }`}
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
                if (bean.roastDate) {
                    try {
                        const roastTime = new Date(bean.roastDate).getTime();
                        const now = new Date().getTime();
                        const daysPassed = Math.floor((now - roastTime) / (1000 * 60 * 60 * 24));
                        const daysLeft = 30 - daysPassed;

                        if (daysLeft <= 0) {
                            freshStatus = "(已过期)";
                        } else if (daysLeft <= 7) {
                            freshStatus = `(急)`;
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
                            className={`group relative border-l ${selectedId === bean.id
                                    ? "border-blue-500 dark:border-blue-400"
                                    : "border-neutral-200 dark:border-neutral-800"
                                } pl-6 cursor-pointer ${selectedId === bean.id
                                    ? "text-blue-500 dark:text-blue-400"
                                    : "text-neutral-500 dark:text-neutral-400"
                                }`}
                            onClick={() => onSelect(bean.id, bean)}
                        >
                            <div className="cursor-pointer">
                                <div className="flex items-baseline justify-between">
                                    <div className="flex items-baseline gap-3 min-w-0 overflow-hidden">
                                        <h3 className="text-xs font-normal tracking-wider truncate">
                                            {bean.name} <span className="text-rose-500 dark:text-rose-400">{freshStatus}</span>
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