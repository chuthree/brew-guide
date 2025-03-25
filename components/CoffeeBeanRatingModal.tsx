'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CoffeeBean } from '@/app/types'
import StarRating from './ui/StarRating'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './ui/select'

interface CoffeeBeanRatingModalProps {
    showModal: boolean
    coffeeBean: CoffeeBean | null
    onClose: () => void
    onSave: (id: string, ratings: Partial<CoffeeBean>) => void
}

const CoffeeBeanRatingModal: React.FC<CoffeeBeanRatingModalProps> = ({
    showModal,
    coffeeBean,
    onClose,
    onSave
}) => {
    const [beanType, setBeanType] = useState<'espresso' | 'filter'>('filter')
    const [overallRating, setOverallRating] = useState<number>(0)
    const [ratingNotes, setRatingNotes] = useState<string>('')

    // 当咖啡豆数据加载时，初始化表单状态
    useEffect(() => {
        if (coffeeBean) {
            setBeanType(coffeeBean.beanType || 'filter')
            setOverallRating(coffeeBean.overallRating || 0)
            setRatingNotes(coffeeBean.ratingNotes || '')
        }
    }, [coffeeBean])

    const handleSave = () => {
        if (!coffeeBean) return

        const ratings: Partial<CoffeeBean> = {
            beanType,
            overallRating,
            ratingNotes: ratingNotes.trim() || undefined,
            // 清空所有其他评分字段
            ratingEspresso: 0,
            ratingMilkBased: 0,
            ratingAroma: 0,
            ratingFlavor: 0,
            ratingAftertaste: 0,
            purchaseChannel: undefined
        }

        onSave(coffeeBean.id, ratings)
    }

    if (!showModal || !coffeeBean) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.265 }}
                className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
                onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        onClose()
                    }
                }}
            >
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{
                        type: "tween",
                        ease: [0.33, 1, 0.68, 1], // cubic-bezier(0.33, 1, 0.68, 1) - easeOutCubic
                        duration: 0.265
                    }}
                    style={{
                        willChange: "transform"
                    }}
                    className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-hidden rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl"
                >
                    {/* 拖动条 */}
                    <div className="sticky top-0 z-10 flex justify-center py-2 bg-neutral-50 dark:bg-neutral-900">
                        <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                    </div>

                    {/* 表单内容 */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                            type: "tween",
                            ease: "easeOut",
                            duration: 0.265,
                            delay: 0.05
                        }}
                        style={{
                            willChange: "opacity, transform"
                        }}
                        className="px-6 px-safe pb-6 pb-safe overflow-auto max-h-[calc(75vh-40px)]"
                    >
                        <div className="space-y-6 py-4">
                            {/* 豆子名称和类型 */}
                            <div className="space-y-2">
                                <h3 className="text-xs font-medium tracking-wide">{coffeeBean.name}</h3>
                                <div className="flex flex-col space-y-0.5">
                                    <div className="text-[11px] tracking-wide text-neutral-500 dark:text-neutral-400">豆子类型</div>
                                    <Select
                                        value={beanType}
                                        onValueChange={(value) => setBeanType(value as 'espresso' | 'filter')}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="espresso">意式豆</SelectItem>
                                            <SelectItem value="filter">手冲豆</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* 总体评分 */}
                            <div className="space-y-2">
                                <div className="text-[11px] tracking-wide text-neutral-500 dark:text-neutral-400">评分</div>
                                <StarRating
                                    value={overallRating}
                                    onChange={setOverallRating}
                                    size="lg"
                                    color="text-amber-500"
                                />
                            </div>

                            {/* 评价备注 */}
                            <div className="space-y-2">
                                <div className="text-[11px] tracking-wide text-neutral-500 dark:text-neutral-400">备注</div>
                                <textarea
                                    value={ratingNotes}
                                    onChange={(e) => setRatingNotes(e.target.value)}
                                    placeholder="添加对这款咖啡豆的备注"
                                    className="w-full px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-300 dark:focus:ring-neutral-600 min-h-[60px] resize-none"
                                />
                            </div>

                            {/* 操作按钮 */}
                            <div className="flex space-x-3 pt-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-2 rounded-md border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-500 dark:text-neutral-400"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 py-2 rounded-md bg-neutral-900 dark:bg-neutral-100 text-xs text-white dark:text-neutral-900"
                                >
                                    保存
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}

export default CoffeeBeanRatingModal 