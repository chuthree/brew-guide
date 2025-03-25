'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CoffeeBean } from '@/app/types'
import { CoffeeBeanManager } from '@/lib/coffeeBeanManager'

export const SORT_OPTIONS = {
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
    [SORT_OPTIONS.RATING_DESC]: '评分 (高→低)',
    [SORT_OPTIONS.RATING_ASC]: '评分 (低→高)',
    [SORT_OPTIONS.NAME_ASC]: '名称 (A→Z)',
    [SORT_OPTIONS.NAME_DESC]: '名称 (Z→A)',
    [SORT_OPTIONS.PRICE_ASC]: '价格 (低→高)',
    [SORT_OPTIONS.PRICE_DESC]: '价格 (高→低)',
};

interface CoffeeBeanRankingProps {
    isOpen: boolean
    onShowRatingForm: (bean: CoffeeBean) => void
    sortOption?: RankingSortOption
    updatedBeanId?: string | null
}

const CoffeeBeanRanking: React.FC<CoffeeBeanRankingProps> = ({
    isOpen,
    onShowRatingForm,
    sortOption = SORT_OPTIONS.RATING_DESC,
    updatedBeanId: externalUpdatedBeanId = null
}) => {
    const [ratedBeans, setRatedBeans] = useState<CoffeeBean[]>([])
    const [unratedBeans, setUnratedBeans] = useState<CoffeeBean[]>([]) // 新增：未评分的咖啡豆
    const [beanType, setBeanType] = useState<'all' | 'espresso' | 'filter'>('all')
    const [updatedBeanId, setUpdatedBeanId] = useState<string | null>(externalUpdatedBeanId)
    const [editMode, setEditMode] = useState(false)
    const [showUnrated, setShowUnrated] = useState(false) // 新增：是否显示未评分区域

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

    useEffect(() => {
        if (!isOpen) return

        const loadBeans = async () => {
            try {
                let ratedBeansData: CoffeeBean[];
                let unratedBeansData: CoffeeBean[] = []; // 未评分的咖啡豆

                // 加载已评分的咖啡豆
                if (beanType === 'all') {
                    ratedBeansData = await CoffeeBeanManager.getRatedBeans();
                } else {
                    ratedBeansData = await CoffeeBeanManager.getRatedBeansByType(beanType);
                }

                // 加载所有咖啡豆，过滤出未评分的
                const allBeans = await CoffeeBeanManager.getAllBeans();
                const ratedIds = new Set(ratedBeansData.map(bean => bean.id));

                // 过滤未评分的咖啡豆，并根据beanType筛选
                unratedBeansData = allBeans.filter(bean => {
                    const isUnrated = !ratedIds.has(bean.id) && (!bean.overallRating || bean.overallRating === 0);
                    if (beanType === 'all') return isUnrated;
                    if (beanType === 'espresso') return isUnrated && bean.beanType === 'espresso';
                    if (beanType === 'filter') return isUnrated && bean.beanType === 'filter';
                    return isUnrated;
                });

                setRatedBeans(sortBeans(ratedBeansData, sortOption));
                setUnratedBeans(unratedBeansData.sort((a, b) => b.timestamp - a.timestamp)); // 按添加时间排序
            } catch (error) {
                console.error("加载咖啡豆数据失败:", error);
                setRatedBeans([]);
                setUnratedBeans([]);
            }
        };

        loadBeans();
    }, [isOpen, beanType, sortOption]);

    // 排序咖啡豆的函数
    const sortBeans = (beansToSort: CoffeeBean[], option: RankingSortOption): CoffeeBean[] => {
        const sorted = [...beansToSort];

        switch (option) {
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

        const price = parseFloat(bean.price.replace(/[^\d.]/g, ''));
        const capacity = parseFloat(bean.capacity.replace(/[^\d.]/g, ''));

        if (isNaN(price) || isNaN(capacity) || capacity === 0) return null;

        return (price / capacity).toFixed(2);
    };

    const handleRateBeanClick = (bean: CoffeeBean) => {
        onShowRatingForm(bean);
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
        <div className="pb-3">
            {/* 头部 */}
            <div className="mb-1">
                {/* 豆子筛选选项卡 */}
                <div className="flex justify-between border-b border-neutral-200 dark:border-neutral-800/50 px-3">
                    <div className="flex">
                        <button
                            className={`pb-1.5 px-3 text-[11px] ${beanType === 'all' ? 'text-neutral-800 dark:text-white border-b border-neutral-300 dark:border-white/30' : 'text-neutral-500 dark:text-neutral-400'}`}
                            onClick={() => setBeanType('all')}
                        >
                            全部豆子
                        </button>
                        <button
                            className={`pb-1.5 px-3 text-[11px] ${beanType === 'espresso' ? 'text-neutral-800 dark:text-white border-b border-neutral-300 dark:border-white/30' : 'text-neutral-500 dark:text-neutral-400'}`}
                            onClick={() => setBeanType('espresso')}
                        >
                            意式豆
                        </button>
                        <button
                            className={`pb-1.5 px-3 text-[11px] ${beanType === 'filter' ? 'text-neutral-800 dark:text-white border-b border-neutral-300 dark:border-white/30' : 'text-neutral-500 dark:text-neutral-400'}`}
                            onClick={() => setBeanType('filter')}
                        >
                            手冲豆
                        </button>
                    </div>

                    {/* 新增：编辑按钮放在导航栏右侧 */}
                    <button
                        onClick={toggleEditMode}
                        className={`pb-1.5 px-3 text-[11px] ${editMode ? 'text-blue-500 dark:text-blue-400' : 'text-neutral-500 dark:text-neutral-400'}`}
                    >
                        {editMode ? '完成' : '编辑'}
                    </button>
                </div>
            </div>

            {/* 已评分咖啡豆区域 */}
            {ratedBeans.length === 0 ? (
                <div className="flex h-28 items-center justify-center text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                    暂无咖啡豆评分数据
                </div>
            ) : (
                <div>
                    {ratedBeans.map((bean, index) => (
                        <motion.div
                            key={bean.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{
                                opacity: 1,
                                y: 0,
                                backgroundColor: updatedBeanId === bean.id ? 'rgba(0, 0, 0, 0.03)' : 'transparent'
                            }}
                            transition={{ duration: 0.2, delay: index * 0.03 }}
                            className="border-b border-neutral-200/60 dark:border-neutral-800/40 last:border-none"
                        >
                            <div className="flex justify-between items-start px-6 py-2.5">
                                <div className="flex items-start">
                                    {/* 序号 - 极简风格 */}
                                    <div className="text-[11px] text-neutral-400 dark:text-neutral-500 w-4 mr-2 pt-0.5">
                                        {index + 1}
                                    </div>

                                    {/* 咖啡豆信息 */}
                                    <div className="cursor-pointer">
                                        <div className="flex items-center">
                                            <div className="text-[11px] text-neutral-800 dark:text-white">{bean.name}</div>
                                            <div className="ml-2 text-[11px] text-neutral-800 dark:text-white">
                                                +{bean.overallRating}
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1">
                                            {[
                                                bean.beanType === 'espresso' ? '意式豆' : '手冲豆',
                                                bean.roastLevel || '未知',
                                                calculatePricePerGram(bean) ? `${calculatePricePerGram(bean)}元/克` : '',
                                                bean.ratingNotes
                                            ].filter(Boolean).join(' · ')}
                                        </div>
                                    </div>
                                </div>

                                {/* 操作按钮 - 仅在编辑模式下显示 */}
                                {editMode && (
                                    <motion.button
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        onClick={() => handleRateBeanClick(bean)}
                                        className="text-[10px] text-neutral-500 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300"
                                    >
                                        编辑
                                    </motion.button>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )
            }

            {/* 分割线和未评分咖啡豆区域 */}
            {
                unratedBeans.length > 0 && (
                    <div className="mt-4">
                        <div
                            className="relative flex items-center mx-6 mb-4 cursor-pointer"
                            onClick={toggleShowUnrated}
                        >
                            <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800/50"></div>
                            <button className="flex items-center justify-center mx-3 text-[10px] text-neutral-500 dark:text-neutral-400">
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
                            <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800/50"></div>
                        </div>

                        {/* 未评分咖啡豆列表 */}
                        <AnimatePresence>
                            {showUnrated && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="opacity-60">
                                        {unratedBeans.map((bean, index) => (
                                            <motion.div
                                                key={bean.id}
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.2, delay: index * 0.03 }}
                                                className="border-b border-neutral-200/60 dark:border-neutral-800/40 last:border-none"
                                            >
                                                <div className="flex justify-between items-start px-6 py-2.5">
                                                    <div className="flex items-start">
                                                        {/* 咖啡豆信息 */}
                                                        <div className="cursor-pointer">
                                                            <div className="flex items-center">
                                                                <div className="text-[11px] text-neutral-800 dark:text-white">{bean.name}</div>
                                                            </div>
                                                            <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                                                                {[
                                                                    bean.beanType === 'espresso' ? '意式豆' : '手冲豆',
                                                                    bean.roastLevel || '未知',
                                                                    calculatePricePerGram(bean) ? `${calculatePricePerGram(bean)}元/克` : ''
                                                                ].filter(Boolean).join(' · ')}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* 添加评分按钮 */}
                                                    <motion.button
                                                        onClick={() => handleRateBeanClick(bean)}
                                                        className="text-[10px] text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300"
                                                    >
                                                        添加评分
                                                    </motion.button>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )
            }
        </div >
    );
};

export default CoffeeBeanRanking; 