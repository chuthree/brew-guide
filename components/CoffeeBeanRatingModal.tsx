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
    const [ratingEspresso, setRatingEspresso] = useState<number>(0)
    const [ratingMilkBased, setRatingMilkBased] = useState<number>(0)
    const [ratingAroma, setRatingAroma] = useState<number>(0)
    const [ratingFlavor, setRatingFlavor] = useState<number>(0)
    const [ratingAftertaste, setRatingAftertaste] = useState<number>(0)
    const [purchaseChannel, setPurchaseChannel] = useState<string>('')
    const [ratingNotes, setRatingNotes] = useState<string>('')

    // 当咖啡豆数据加载时，初始化表单状态
    useEffect(() => {
        if (coffeeBean) {
            setBeanType(coffeeBean.beanType || 'filter')
            setOverallRating(coffeeBean.overallRating || 0)
            setRatingEspresso(coffeeBean.ratingEspresso || 0)
            setRatingMilkBased(coffeeBean.ratingMilkBased || 0)
            setRatingAroma(coffeeBean.ratingAroma || 0)
            setRatingFlavor(coffeeBean.ratingFlavor || 0)
            setRatingAftertaste(coffeeBean.ratingAftertaste || 0)
            setPurchaseChannel(coffeeBean.purchaseChannel || '')
            setRatingNotes(coffeeBean.ratingNotes || '')
        }
    }, [coffeeBean])

    const handleSave = () => {
        if (!coffeeBean) return

        const ratings: Partial<CoffeeBean> = {
            beanType,
            overallRating,
            purchaseChannel: purchaseChannel.trim() || undefined,
            ratingNotes: ratingNotes.trim() || undefined
        }

        // 根据豆子类型保存不同的评分
        if (beanType === 'espresso') {
            ratings.ratingEspresso = ratingEspresso
            ratings.ratingMilkBased = ratingMilkBased
            // 清空手冲豆相关评分
            ratings.ratingAroma = 0
            ratings.ratingFlavor = 0
            ratings.ratingAftertaste = 0
        } else {
            ratings.ratingAroma = ratingAroma
            ratings.ratingFlavor = ratingFlavor
            ratings.ratingAftertaste = ratingAftertaste
            // 清空意式豆相关评分
            ratings.ratingEspresso = 0
            ratings.ratingMilkBased = 0
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
                                <div className="text-[11px] tracking-wide text-neutral-500 dark:text-neutral-400">总体喜好</div>
                                <StarRating
                                    value={overallRating}
                                    onChange={setOverallRating}
                                    size="lg"
                                    color="text-amber-500"
                                />
                            </div>

                            {/* 意式豆评分 */}
                            {beanType === 'espresso' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="text-[11px] tracking-wide text-neutral-500 dark:text-neutral-400">美式</div>
                                        <StarRating
                                            value={ratingEspresso}
                                            onChange={setRatingEspresso}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-[11px] tracking-wide text-neutral-500 dark:text-neutral-400">奶咖</div>
                                        <StarRating
                                            value={ratingMilkBased}
                                            onChange={setRatingMilkBased}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* 手冲豆评分 */}
                            {beanType === 'filter' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="text-[11px] tracking-wide text-neutral-500 dark:text-neutral-400">香气</div>
                                        <StarRating
                                            value={ratingAroma}
                                            onChange={setRatingAroma}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-[11px] tracking-wide text-neutral-500 dark:text-neutral-400">风味</div>
                                        <StarRating
                                            value={ratingFlavor}
                                            onChange={setRatingFlavor}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-[11px] tracking-wide text-neutral-500 dark:text-neutral-400">余韵</div>
                                        <StarRating
                                            value={ratingAftertaste}
                                            onChange={setRatingAftertaste}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* 购买渠道 */}
                            <div className="space-y-2">
                                <div className="text-[11px] tracking-wide text-neutral-500 dark:text-neutral-400">购买渠道</div>
                                <input
                                    type="text"
                                    value={purchaseChannel}
                                    onChange={(e) => setPurchaseChannel(e.target.value)}
                                    placeholder="输入购买渠道"
                                    className="w-full px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-300 dark:focus:ring-neutral-600"
                                />
                            </div>

                            {/* 评价备注 */}
                            <div className="space-y-2">
                                <div className="text-[11px] tracking-wide text-neutral-500 dark:text-neutral-400">评价备注</div>
                                <textarea
                                    value={ratingNotes}
                                    onChange={(e) => setRatingNotes(e.target.value)}
                                    placeholder="添加对这款咖啡豆的评价备注"
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