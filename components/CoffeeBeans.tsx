'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { CoffeeBean } from '@/app/types'
import { CoffeeBeanManager } from '@/lib/coffeeBeanManager'
import CoffeeBeanFormModal from './CoffeeBeanFormModal'
import CoffeeBeanRatingModal from './CoffeeBeanRatingModal'
import CoffeeBeanRanking from './CoffeeBeanRanking'
import AIRecipeModal from './AIRecipeModal'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './ui/select'
import { Storage } from '@/lib/storage'
import { SORT_OPTIONS as RANKING_SORT_OPTIONS, RankingSortOption } from './CoffeeBeanRanking'

// 排序类型定义
const SORT_OPTIONS = {
    REMAINING_DAYS_ASC: 'remaining_days_asc', // 按照剩余天数排序（少→多）
    REMAINING_DAYS_DESC: 'remaining_days_desc', // 按照剩余天数排序（多→少）
    NAME_ASC: 'name_asc',
    NAME_DESC: 'name_desc',
} as const;

type SortOption = typeof SORT_OPTIONS[keyof typeof SORT_OPTIONS];

// 排序选项的显示名称
const SORT_LABELS: Record<SortOption, string> = {
    [SORT_OPTIONS.REMAINING_DAYS_ASC]: '赏味期 (少→多)',
    [SORT_OPTIONS.REMAINING_DAYS_DESC]: '赏味期 (多→少)',
    [SORT_OPTIONS.NAME_ASC]: '名称 (A→Z)',
    [SORT_OPTIONS.NAME_DESC]: '名称 (Z→A)',
};

// 视图模式定义
const VIEW_OPTIONS = {
    INVENTORY: 'inventory',
    RANKING: 'ranking',
} as const;

type ViewOption = typeof VIEW_OPTIONS[keyof typeof VIEW_OPTIONS];

// 视图选项的显示名称
const VIEW_LABELS: Record<ViewOption, string> = {
    [VIEW_OPTIONS.INVENTORY]: '咖啡豆仓库',
    [VIEW_OPTIONS.RANKING]: '咖啡豆榜单',
};

interface CoffeeBeansProps {
    isOpen: boolean
    showBeanForm?: (bean: CoffeeBean | null) => void  // 可选属性，用于在页面级显示咖啡豆表单
    onShowImport?: () => void // 新增属性，用于显示导入表单
    onGenerateAIRecipe?: (bean: CoffeeBean) => void // 新增属性，用于生成AI方案
}

const CoffeeBeans: React.FC<CoffeeBeansProps> = ({ isOpen, showBeanForm, onShowImport, onGenerateAIRecipe }) => {
    const [beans, setBeans] = useState<CoffeeBean[]>([])
    const [ratedBeans, setRatedBeans] = useState<CoffeeBean[]>([])
    const [showAddForm, setShowAddForm] = useState(false)
    const [editingBean, setEditingBean] = useState<CoffeeBean | null>(null)
    const [actionMenuStates, setActionMenuStates] = useState<Record<string, boolean>>({})
    const [copySuccess, setCopySuccess] = useState<Record<string, boolean>>({})
    const [sortOption, setSortOption] = useState<SortOption>(SORT_OPTIONS.REMAINING_DAYS_ASC)
    const [showAIRecipeModal, setShowAIRecipeModal] = useState(false)
    const [selectedBeanForAI, setSelectedBeanForAI] = useState<CoffeeBean | null>(null)
    // 新增状态
    const [viewMode, setViewMode] = useState<ViewOption>(VIEW_OPTIONS.INVENTORY)
    const [showRatingModal, setShowRatingModal] = useState(false)
    const [selectedBeanForRating, setSelectedBeanForRating] = useState<CoffeeBean | null>(null)
    const [lastRatedBeanId, setLastRatedBeanId] = useState<string | null>(null) // 新增，追踪最近评分的咖啡豆ID
    const [ratingSavedCallback, setRatingSavedCallback] = useState<(() => void) | null>(null) // 新增，存储评分保存后的回调
    // 豆种筛选相关状态
    const [availableVarieties, setAvailableVarieties] = useState<string[]>([])
    const [selectedVariety, setSelectedVariety] = useState<string | null>(null)
    const [filteredBeans, setFilteredBeans] = useState<CoffeeBean[]>([])
    // 咖啡豆显示控制
    const [showEmptyBeans, setShowEmptyBeans] = useState<boolean>(false)
    const [hasEmptyBeans, setHasEmptyBeans] = useState<boolean>(false)

    // 获取阶段数值用于排序
    const getPhaseValue = (phase: string): number => {
        switch (phase) {
            case '最佳赏味期': return 0;
            case '赏味期': return 1;
            case '养豆期': return 2;
            case '衰退期':
            default: return 3;
        }
    }

    // 获取咖啡豆的赏味期信息
    const getFlavorInfo = (bean: CoffeeBean): { phase: string, remainingDays: number } => {
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
        let maxDay = bean.maxDay || 0;

        // 如果没有自定义值，则根据烘焙度设置默认值
        if (startDay === 0 && endDay === 0 && maxDay === 0) {
            if (bean.roastLevel?.includes('浅')) {
                startDay = 7;
                endDay = 30;
                maxDay = 60;
            } else if (bean.roastLevel?.includes('深')) {
                startDay = 14;
                endDay = 60;
                maxDay = 90;
            } else {
                // 默认为中烘焙
                startDay = 10;
                endDay = 30;
                maxDay = 60;
            }
        }

        let phase = '';
        let remainingDays = 0;

        if (daysSinceRoast < startDay) {
            phase = '养豆期';
            remainingDays = startDay - daysSinceRoast;
        } else if (daysSinceRoast <= endDay) {
            phase = '最佳赏味期';
            remainingDays = endDay - daysSinceRoast;
        } else if (daysSinceRoast <= maxDay) {
            phase = '赏味期';
            remainingDays = maxDay - daysSinceRoast;
        } else {
            phase = '衰退期';
            remainingDays = 0;
        }

        return { phase, remainingDays };
    }

    // 检查咖啡豆是否用完
    const isBeanEmpty = (bean: CoffeeBean): boolean => {
        return (bean.remaining === "0" || bean.remaining === "0g") && bean.capacity !== undefined;
    }

    // 排序咖啡豆的函数 - 使用useCallback缓存函数以避免无限循环
    const sortBeans = useCallback((beansToSort: CoffeeBean[], option: SortOption): CoffeeBean[] => {
        switch (option) {
            case SORT_OPTIONS.NAME_ASC:
                return [...beansToSort].sort((a, b) => a.name.localeCompare(b.name))
            case SORT_OPTIONS.NAME_DESC:
                return [...beansToSort].sort((a, b) => b.name.localeCompare(a.name))
            case SORT_OPTIONS.REMAINING_DAYS_ASC:
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
            case SORT_OPTIONS.REMAINING_DAYS_DESC:
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
                        // 最佳赏味期内，剩余天数多的排在前面
                        return daysB - daysA;
                    } else if (phaseA === '赏味期') {
                        // 赏味期内，剩余天数多的排在前面
                        return daysB - daysA;
                    } else if (phaseA === '养豆期') {
                        // 养豆期内，剩余天数多的排在前面
                        return daysB - daysA;
                    } else {
                        // 衰退期按烘焙日期新的在前
                        if (!a.roastDate || !b.roastDate) return 0;
                        return new Date(b.roastDate).getTime() - new Date(a.roastDate).getTime();
                    }
                });
            default:
                return beansToSort
        }
    }, [])  // 由于getPhaseValue和getFlavorInfo是组件内定义的函数，不会改变，可以省略依赖

    // 加载咖啡豆数据
    useEffect(() => {
        const loadBeans = async () => {
            try {
                const savedBeans = await Storage.get('coffeeBeans')
                const parsedBeans = savedBeans ? JSON.parse(savedBeans) : []
                const sortedBeans = sortBeans(parsedBeans, sortOption)
                setBeans(sortedBeans)

                // 检查是否有已用完的咖啡豆
                const hasEmpty = sortedBeans.some(bean => isBeanEmpty(bean))
                setHasEmptyBeans(hasEmpty)

                // 提取所有唯一的豆种(品种)
                const varieties = sortedBeans
                    .filter(bean => bean.variety && (showEmptyBeans || !isBeanEmpty(bean))) // 过滤掉没有品种的豆子和已用完的豆子(如果不显示已用完)
                    .map(bean => bean.variety as string)
                    .filter((value, index, self) => self.indexOf(value) === index) // 去重
                    .sort() // 按字母排序

                setAvailableVarieties(varieties)

                // 根据当前选中的品种过滤咖啡豆
                if (selectedVariety) {
                    setFilteredBeans(sortedBeans.filter(bean =>
                        bean.variety === selectedVariety &&
                        // 根据showEmptyBeans状态决定是否显示用完的咖啡豆
                        (showEmptyBeans || !isBeanEmpty(bean))
                    ))
                } else {
                    setFilteredBeans(sortedBeans.filter(bean =>
                        // 根据showEmptyBeans状态决定是否显示用完的咖啡豆
                        (showEmptyBeans || !isBeanEmpty(bean))
                    ))
                }
            } catch {
                // 获取失败设置为空数组
                setBeans([])
                setFilteredBeans([])
                setHasEmptyBeans(false)
            }
        }

        // 加载已评分的咖啡豆
        const loadRatedBeans = async () => {
            try {
                const beans = await CoffeeBeanManager.getRatedBeans();
                setRatedBeans(beans);
            } catch (error) {
                console.error("加载评分咖啡豆失败:", error);
                setRatedBeans([]);
            }
        };

        if (isOpen) {
            loadBeans()
            loadRatedBeans() // 加载评分咖啡豆
        }
    }, [isOpen, sortOption, selectedVariety, sortBeans, showEmptyBeans])

    // 处理添加咖啡豆
    const handleSaveBean = async (bean: Omit<CoffeeBean, 'id' | 'timestamp'>) => {
        try {
            if (editingBean) {
                // 更新现有咖啡豆
                const updatedBean = await CoffeeBeanManager.updateBean(editingBean.id, bean)
                if (updatedBean) {
                    setBeans(prevBeans => {
                        const newBeans = prevBeans.map(b =>
                            b.id === updatedBean.id ? updatedBean : b
                        )
                        return sortBeans(newBeans, sortOption)
                    })
                }
                setEditingBean(null)
            } else {
                // 添加新咖啡豆
                const newBean = await CoffeeBeanManager.addBean(bean)
                setBeans(prevBeans => sortBeans([...prevBeans, newBean], sortOption))
                setShowAddForm(false)

                // 检查是否是首次添加咖啡豆
                const allBeans = await CoffeeBeanManager.getAllBeans();
                if (allBeans.length === 1) {
                    // 触发全局事件，通知应用程序现在有咖啡豆了
                    const event = new CustomEvent('coffeeBeanListChanged', {
                        detail: { hasBeans: true, isFirstBean: true }
                    });
                    window.dispatchEvent(event);
                } else {
                    // 一般性更新，仍然触发事件
                    const event = new CustomEvent('coffeeBeanListChanged', {
                        detail: { hasBeans: true }
                    });
                    window.dispatchEvent(event);
                }
            }
        } catch {
            // 保存失败时提示用户
            alert('保存失败，请重试')
        }
    }

    // 处理咖啡豆删除
    const handleDelete = async (bean: CoffeeBean) => {
        if (window.confirm(`确认要删除咖啡豆"${bean.name}"吗？`)) {
            try {
                const updatedBeans = beans.filter(b => b.id !== bean.id)
                await Storage.set('coffeeBeans', JSON.stringify(updatedBeans))
                setBeans(sortBeans(updatedBeans, sortOption))
            } catch {
                // 删除失败时提示用户
                alert('删除咖啡豆时出错，请重试')
            }
        }
    }

    // 处理编辑咖啡豆
    const handleEdit = (bean: CoffeeBean) => {
        try {
            if (showBeanForm) {
                showBeanForm(bean)
            } else {
                setEditingBean(bean)
            }
        } catch {
            // 处理错误
            alert('编辑咖啡豆时出错，请重试')
        }
    }

    // 复制到剪贴板
    const copyTextToClipboard = async (text: string) => {
        // 检查是否支持 navigator.clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return Promise.resolve();
            } catch {
                // 如果是安全或权限错误，尝试回退方法
            }
        }

        // 回退方法：使用document.execCommand
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);

            if (successful) {
                return Promise.resolve();
            } else {
                return Promise.reject(new Error('复制命令执行失败'));
            }
        } catch {
            // 如果是在安全上下文中不支持clipboard，则提供用户可以手动复制的选项
            alert('自动复制不可用，请手动复制以下内容:\n\n' + text);
            return Promise.reject(new Error('复制到剪贴板失败'));
        }
    };

    // 处理分享咖啡豆信息
    const handleShare = (bean: CoffeeBean) => {
        try {
            // 创建可共享的咖啡豆对象
            const shareableBean: Omit<CoffeeBean, 'id' | 'timestamp'> = {
                name: bean.name,
                capacity: bean.capacity,
                remaining: bean.remaining,
                roastLevel: bean.roastLevel,
                roastDate: bean.roastDate,
                flavor: bean.flavor,
                origin: bean.origin,
                process: bean.process,
                variety: bean.variety,
                price: bean.price,
                type: bean.type,
                notes: bean.notes
            };

            // 如果是拼配豆，添加拼配成分信息
            if (bean.type === '拼配' && bean.blendComponents && bean.blendComponents.length > 0) {
                shareableBean.blendComponents = bean.blendComponents;
            }

            // 导入转换工具并生成可读文本
            import('@/lib/jsonUtils').then(({ beanToReadableText }) => {
                // @ts-expect-error - 我们知道这个对象结构与函数期望的类型兼容
                const readableText = beanToReadableText(shareableBean);

                copyTextToClipboard(readableText)
                    .then(() => {
                        setCopySuccess(prev => ({
                            ...prev,
                            [bean.id]: true
                        }));
                        setTimeout(() => {
                            setCopySuccess(prev => ({
                                ...prev,
                                [bean.id]: false
                            }));
                        }, 2000);
                    })
                    .catch(() => {
                        // 复制失败时提示用户
                        alert('复制失败，请手动复制');
                    });
            }).catch(() => {
                // 转换失败时回退到JSON格式
                const jsonString = JSON.stringify(shareableBean, null, 2);
                copyTextToClipboard(jsonString)
                    .catch(() => {
                        alert('复制失败，请手动复制');
                    });
            });
        } catch {
            // 忽略异常
        }
    };

    // 添加方法处理AI方案生成
    const handleGenerateAIRecipe = (bean: CoffeeBean) => {
        if (onGenerateAIRecipe) {
            onGenerateAIRecipe(bean);
        } else {
            setSelectedBeanForAI(bean);
            setShowAIRecipeModal(true);
        }
        // 关闭操作菜单
        setActionMenuStates(prev => ({
            ...prev,
            [bean.id]: false
        }));
    }

    // 处理咖啡豆评分
    const handleShowRatingForm = (bean: CoffeeBean, onRatingSaved?: () => void) => {
        setSelectedBeanForRating(bean);
        setShowRatingModal(true);

        // 存储回调函数
        if (onRatingSaved) {
            setRatingSavedCallback(() => onRatingSaved);
        } else {
            setRatingSavedCallback(null);
        }
    };

    // 保存咖啡豆评分
    const handleSaveRating = async (id: string, ratings: Partial<CoffeeBean>) => {
        try {
            const updatedBean = await CoffeeBeanManager.updateBeanRatings(id, ratings);
            if (updatedBean) {
                // 更新本地状态
                setBeans(prevBeans => {
                    const newBeans = prevBeans.map(b =>
                        b.id === updatedBean.id ? updatedBean : b
                    );
                    return sortBeans(newBeans, sortOption);
                });

                // 记录最近评分的咖啡豆ID，用于高亮显示
                setLastRatedBeanId(id);

                // 自动切换到榜单视图
                setViewMode(VIEW_OPTIONS.RANKING);

                // 清除标记
                setTimeout(() => {
                    setLastRatedBeanId(null);
                }, 2000);

                // 返回更新后的咖啡豆
                return updatedBean;
            }
            return null;
        } catch (error) {
            console.error("保存咖啡豆评分失败:", error);
            alert("保存评分失败，请重试");
            throw error; // 抛出错误以便上层处理
        }
    };

    // 转换仓库排序选项到榜单排序选项
    const convertToRankingSortOption = (option: SortOption): RankingSortOption => {
        switch (option) {
            case SORT_OPTIONS.NAME_ASC:
                return RANKING_SORT_OPTIONS.NAME_ASC;
            case SORT_OPTIONS.NAME_DESC:
                return RANKING_SORT_OPTIONS.NAME_DESC;
            case SORT_OPTIONS.REMAINING_DAYS_ASC:
                return RANKING_SORT_OPTIONS.RATING_DESC;
            case SORT_OPTIONS.REMAINING_DAYS_DESC:
                return RANKING_SORT_OPTIONS.RATING_ASC;
            default:
                return RANKING_SORT_OPTIONS.RATING_DESC;
        }
    };

    // 视图切换时更新排序标签
    useEffect(() => {
        if (viewMode === VIEW_OPTIONS.RANKING) {
            // 当切换到榜单视图时，保持现有的排序类型，但更改其语义
            // 例如：REMAINING_DAYS_ASC -> RATING_DESC, REMAINING_DAYS_DESC -> RATING_ASC
            // 无需更改 NAME_ASC 和 NAME_DESC
        }
    }, [viewMode]);

    // 处理品种标签点击
    const handleVarietyClick = (variety: string | null) => {
        setSelectedVariety(variety)
    }

    if (!isOpen) return null

    return (
        <>
            {/* AI方案生成模态框 - 只在没有提供 onGenerateAIRecipe 时才显示 */}
            {!onGenerateAIRecipe && (
                <AIRecipeModal
                    showModal={showAIRecipeModal}
                    onClose={() => setShowAIRecipeModal(false)}
                    coffeeBean={selectedBeanForAI}
                />
            )}

            {/* 咖啡豆表单弹出框 */}
            <CoffeeBeanFormModal
                showForm={showAddForm || editingBean !== null}
                initialBean={editingBean || undefined}
                onSave={handleSaveBean}
                onClose={() => {
                    setShowAddForm(false)
                    setEditingBean(null)
                }}
            />

            {/* 咖啡豆评分表单 */}
            <CoffeeBeanRatingModal
                showModal={showRatingModal}
                coffeeBean={selectedBeanForRating}
                onClose={() => setShowRatingModal(false)}
                onSave={async (id, ratings) => {
                    try {
                        // 等待保存评分完成
                        const result = await handleSaveRating(id, ratings);
                        return result;
                    } catch (error) {
                        console.error("评分保存失败:", error);
                        throw error;
                    }
                }}
                onAfterSave={() => {
                    // 强制刷新榜单数据
                    const loadRatedBeans = async () => {
                        try {
                            const beans = await CoffeeBeanManager.getRatedBeans();
                            setRatedBeans(beans);
                        } catch (error) {
                            console.error("加载评分咖啡豆失败:", error);
                        }
                    };
                    loadRatedBeans();

                    // 关闭评分模态框
                    setShowRatingModal(false);

                    // 调用存储的回调函数
                    if (ratingSavedCallback) {
                        ratingSavedCallback();
                        setRatingSavedCallback(null); // 使用后清除
                    }
                }}
            />

            <AnimatePresence mode="wait">
                <motion.div
                    key="beans-container"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="space-y-6"
                >
                    {/* 视图切换和操作按钮 */}
                    <div className="px-6 pt-6 space-y-6">
                        {/* 视图切换与筛选栏 - 统一布局 */}
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center space-x-3">
                                <div className="text-xs tracking-wide text-neutral-500 dark:text-neutral-400">
                                    {viewMode === VIEW_OPTIONS.INVENTORY ?
                                        `${selectedVariety ? `${filteredBeans.length}/${beans.length}` : beans.length} 款咖啡豆` :
                                        `${ratedBeans?.length || 0} 款已评分咖啡豆`}
                                </div>
                            </div>

                            <div className="flex items-center space-x-3">
                                {/* 统一的视图切换组件 */}
                                <Select
                                    value={viewMode}
                                    onValueChange={(value) => setViewMode(value as ViewOption)}
                                >
                                    <SelectTrigger
                                        variant="minimal"
                                        className="w-auto min-w-[90px] tracking-wide text-neutral-500 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-400 transition-colors"
                                    >
                                        <div className="flex items-center">
                                            <SelectValue />
                                            <svg
                                                className="ml-1 w-3 h-3 opacity-90"
                                                viewBox="0 0 15 15"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path d="M4.5 6.5L7.5 3.5L10.5 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                                                <path d="M4.5 8.5L7.5 11.5L10.5 8.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent
                                        position="popper"
                                        sideOffset={5}
                                        className="border-neutral-200/70 dark:border-neutral-800/70 shadow-lg backdrop-blur-sm bg-white/95 dark:bg-neutral-900/95 rounded-lg overflow-hidden"
                                    >
                                        {Object.entries(VIEW_LABELS).map(([value, label]) => (
                                            <SelectItem
                                                key={value}
                                                value={value}
                                                className="tracking-wide text-neutral-500 dark:text-neutral-400 data-[highlighted]:text-neutral-600 dark:data-[highlighted]:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/70 transition-colors"
                                            >
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* 排序组件 - 在两个视图中都显示 */}
                                {(viewMode === VIEW_OPTIONS.INVENTORY ? beans.length > 0 : true) && (
                                    <Select
                                        value={sortOption}
                                        onValueChange={(value) => setSortOption(value as SortOption)}
                                    >
                                        <SelectTrigger
                                            variant="minimal"
                                            className="w-auto min-w-[90px] tracking-wide text-neutral-500 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-400 transition-colors group"
                                        >
                                            <div className="flex items-center">
                                                <SelectValue />
                                                <svg
                                                    className="ml-1 w-3 h-3 opacity-90 transition-opacity"
                                                    viewBox="0 0 15 15"
                                                    fill="none"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                >
                                                    <path d="M4.5 6.5L7.5 3.5L10.5 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                                                    <path d="M4.5 8.5L7.5 11.5L10.5 8.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent
                                            position="popper"
                                            sideOffset={5}
                                            className="border-neutral-200/70 dark:border-neutral-800/70 shadow-lg backdrop-blur-sm bg-white/95 dark:bg-neutral-900/95 rounded-lg overflow-hidden"
                                        >
                                            {viewMode === VIEW_OPTIONS.RANKING ? (
                                                // 榜单视图的排序选项
                                                <>
                                                    <SelectItem
                                                        key={SORT_OPTIONS.REMAINING_DAYS_ASC}
                                                        value={SORT_OPTIONS.REMAINING_DAYS_ASC}
                                                        className="tracking-wide text-neutral-500 dark:text-neutral-400 data-[highlighted]:text-neutral-600 dark:data-[highlighted]:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/70 transition-colors"
                                                    >
                                                        评分 (高→低)
                                                    </SelectItem>
                                                    <SelectItem
                                                        key={SORT_OPTIONS.REMAINING_DAYS_DESC}
                                                        value={SORT_OPTIONS.REMAINING_DAYS_DESC}
                                                        className="tracking-wide text-neutral-500 dark:text-neutral-400 data-[highlighted]:text-neutral-600 dark:data-[highlighted]:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/70 transition-colors"
                                                    >
                                                        评分 (低→高)
                                                    </SelectItem>
                                                    <SelectItem
                                                        key={SORT_OPTIONS.NAME_ASC}
                                                        value={SORT_OPTIONS.NAME_ASC}
                                                        className="tracking-wide text-neutral-500 dark:text-neutral-400 data-[highlighted]:text-neutral-600 dark:data-[highlighted]:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/70 transition-colors"
                                                    >
                                                        名称 (A→Z)
                                                    </SelectItem>
                                                    <SelectItem
                                                        key={SORT_OPTIONS.NAME_DESC}
                                                        value={SORT_OPTIONS.NAME_DESC}
                                                        className="tracking-wide text-neutral-500 dark:text-neutral-400 data-[highlighted]:text-neutral-600 dark:data-[highlighted]:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/70 transition-colors"
                                                    >
                                                        名称 (Z→A)
                                                    </SelectItem>
                                                </>
                                            ) : (
                                                // 仓库视图的排序选项
                                                Object.values(SORT_OPTIONS).map((value) => (
                                                    <SelectItem
                                                        key={value}
                                                        value={value}
                                                        className="tracking-wide text-neutral-500 dark:text-neutral-400 data-[highlighted]:text-neutral-600 dark:data-[highlighted]:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/70 transition-colors"
                                                    >
                                                        {SORT_LABELS[value]}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>

                        {/* 品种标签筛选 - 仅在仓库视图显示 */}
                        {viewMode === VIEW_OPTIONS.INVENTORY && availableVarieties.length > 0 && (
                            <div className="mb-4 relative">
                                <div className="flex overflow-x-auto no-scrollbar items-center space-x-2 pb-1">
                                    <motion.button
                                        onClick={() => handleVarietyClick(null)}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className={`shrink-0 px-3 py-1 rounded-full text-xs transition-colors ${selectedVariety === null
                                            ? 'bg-neutral-800 text-white dark:bg-white dark:text-neutral-800'
                                            : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                                            }`}
                                    >
                                        全部
                                    </motion.button>

                                    {/* 添加显示/隐藏已用完的咖啡豆标签 - 只在有已用完的咖啡豆时显示 */}
                                    {hasEmptyBeans && (
                                        <motion.button
                                            onClick={() => setShowEmptyBeans(!showEmptyBeans)}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            className={`shrink-0 px-3 py-1 rounded-full text-xs transition-colors ${showEmptyBeans
                                                ? 'bg-neutral-800 text-white dark:bg-white dark:text-neutral-800'
                                                : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                                                }`}
                                        >
                                            已用完
                                        </motion.button>
                                    )}

                                    {availableVarieties.map(variety => (
                                        <motion.button
                                            key={variety}
                                            onClick={() => handleVarietyClick(variety)}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            className={`shrink-0 px-3 py-1 rounded-full text-xs transition-colors ${selectedVariety === variety
                                                ? 'bg-neutral-800 text-white dark:bg-white dark:text-neutral-800'
                                                : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                                                }`}
                                        >
                                            {variety}
                                        </motion.button>
                                    ))}
                                </div>
                                <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
                            </div>
                        )}
                    </div>

                    {/* 内容区域：根据视图模式显示不同内容 */}
                    <AnimatePresence mode="wait">
                        {viewMode === VIEW_OPTIONS.INVENTORY ? (
                            // 库存视图
                            <motion.div
                                key="inventory-view"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className="w-full"
                            >
                                {/* 咖啡豆列表 */}
                                {filteredBeans.length === 0 ? (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.2, ease: "easeOut" }}
                                        className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400"
                                    >
                                        {selectedVariety ? `[ 没有${selectedVariety}品种的咖啡豆 ]` : '[ 暂无咖啡豆 ]'}
                                    </motion.div>
                                ) : (
                                    <div className="space-y-6 pb-24 px-6">
                                        {filteredBeans.map((bean, index) => (
                                            <motion.div
                                                key={bean.id}
                                                initial={{ opacity: 0, y: 15 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0 }}
                                                transition={{
                                                    duration: 0.2,
                                                    delay: Math.min(index * 0.05, 0.3),
                                                    ease: "easeOut"
                                                }}
                                                className={`group space-y-3 hover:bg-neutral-50 dark:hover:bg-neutral-900/70 transition-colors border-l ${isBeanEmpty(bean)
                                                    ? 'border-red-300/50 dark:border-red-800/50 bg-red-50/30 dark:bg-red-900/10'
                                                    : 'border-neutral-200/50 dark:border-neutral-800'
                                                    } pl-6`}
                                            >
                                                <div className="flex flex-col space-y-3">
                                                    {/* 图片和基本信息区域 */}
                                                    <div className="flex gap-4">
                                                        {/* 咖啡豆图片 - 只在有图片时显示 */}
                                                        {bean.image && (
                                                            <div className="w-14 h-14 rounded-md overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex-shrink-0 border border-neutral-200/50 dark:border-neutral-700/50 relative">
                                                                <Image
                                                                    src={bean.image}
                                                                    alt={bean.name}
                                                                    fill
                                                                    className="object-cover"
                                                                    sizes="50px"
                                                                />
                                                            </div>
                                                        )}

                                                        {/* 名称和标签区域 */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-baseline justify-between pb-0.5">
                                                                <div className="flex items-baseline space-x-2 min-w-0 overflow-hidden">
                                                                    <div className="text-[11px] font-normal truncate text-neutral-800 dark:text-white">
                                                                        {bean.name}
                                                                    </div>
                                                                    {isBeanEmpty(bean) && (
                                                                        <div className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 shrink-0">
                                                                            已用完
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-baseline ml-2 shrink-0">
                                                                    <AnimatePresence mode="wait">
                                                                        {actionMenuStates[bean.id] ? (
                                                                            <motion.div
                                                                                key="action-buttons"
                                                                                initial={{ opacity: 0, scale: 0.98 }}
                                                                                animate={{ opacity: 1, scale: 1 }}
                                                                                exit={{ opacity: 0 }}
                                                                                transition={{ duration: 0.15, ease: "easeOut" }}
                                                                                className="flex items-baseline space-x-3"
                                                                            >
                                                                                <button
                                                                                    onClick={() => handleEdit(bean)}
                                                                                    className="px-2 text-xs text-neutral-500 dark:text-neutral-400"
                                                                                >
                                                                                    编辑
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleShare(bean)}
                                                                                    className="px-2 text-xs text-blue-400 dark:text-blue-500 relative"
                                                                                >
                                                                                    {copySuccess[bean.id] ? '已复制' : '分享'}
                                                                                    {copySuccess[bean.id] && (
                                                                                        <motion.div
                                                                                            initial={{ opacity: 0, y: 5 }}
                                                                                            animate={{ opacity: 1, y: 0 }}
                                                                                            exit={{ opacity: 0 }}
                                                                                            transition={{ duration: 0.15, ease: "easeOut" }}
                                                                                            className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-neutral-800 dark:bg-neutral-700 text-white px-2 py-1 rounded text-[10px] whitespace-nowrap"
                                                                                        >
                                                                                            已复制到剪贴板
                                                                                        </motion.div>
                                                                                    )}
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleDelete(bean)}
                                                                                    className="px-2 text-xs text-red-400"
                                                                                >
                                                                                    删除
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleGenerateAIRecipe(bean)}
                                                                                    className="px-2 text-xs text-emerald-600 dark:text-emerald-500"
                                                                                >
                                                                                    AI方案
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setActionMenuStates(prev => ({
                                                                                            ...prev,
                                                                                            [bean.id]: false
                                                                                        }))
                                                                                    }}
                                                                                    className="w-7 h-7 flex items-center justif-center rounded-full text-sm text-neutral-400"
                                                                                >
                                                                                    ×
                                                                                </button>
                                                                            </motion.div>
                                                                        ) : (
                                                                            <motion.button
                                                                                key="more-button"
                                                                                initial={{ opacity: 0, scale: 0.98 }}
                                                                                animate={{ opacity: 1, scale: 1 }}
                                                                                exit={{ opacity: 0 }}
                                                                                transition={{ duration: 0.15, ease: "easeOut" }}
                                                                                onClick={() => {
                                                                                    setActionMenuStates(prev => ({
                                                                                        ...prev,
                                                                                        [bean.id]: true
                                                                                    }))
                                                                                }}
                                                                                className="w-7 h-7 flex items-center justify-center text-xs text-neutral-500 dark:text-neutral-400"
                                                                            >
                                                                                ···
                                                                            </motion.button>
                                                                        )}
                                                                    </AnimatePresence>
                                                                </div>
                                                            </div>

                                                            <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400 break-words">
                                                                {bean.roastLevel && <span>{bean.roastLevel}</span>}
                                                                {bean.origin && (
                                                                    <>
                                                                        {bean.roastLevel && <span className="opacity-50 mx-1">·</span>}
                                                                        <span>{bean.origin}</span>
                                                                    </>
                                                                )}
                                                                {bean.process && (
                                                                    <>
                                                                        {(bean.roastLevel || bean.origin) && <span className="opacity-50 mx-1">·</span>}
                                                                        <span>{bean.process}处理</span>
                                                                    </>
                                                                )}
                                                                {bean.type === '拼配' && bean.blendComponents && bean.blendComponents.length > 0 && (
                                                                    <>
                                                                        {(bean.roastLevel || bean.origin || bean.process) && <span className="opacity-50 mx-1">·</span>}
                                                                        {bean.blendComponents.map((component, idx) => (
                                                                            <React.Fragment key={idx}>
                                                                                {idx > 0 && <span className="opacity-50 mx-1">·</span>}
                                                                                <span>{`${component.origin || ''}${component.process ? `${component.process}` : ''}${component.variety ? `${component.variety}` : ''}(${component.percentage}%)`}</span>
                                                                            </React.Fragment>
                                                                        ))}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 mt-1.5">
                                                        {/* 剩余量进度条 - 仅当capacity和remaining都存在时显示 */}
                                                        {bean.capacity && bean.remaining && (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                                                                        剩余量
                                                                    </div>
                                                                    <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                                                                        {bean.remaining}g / {bean.capacity}g
                                                                    </div>
                                                                </div>
                                                                <motion.div
                                                                    className="h-px w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800"
                                                                >
                                                                    <motion.div
                                                                        initial={{ width: 0 }}
                                                                        animate={{ width: `${(parseFloat(bean.remaining.replace('g', '')) / parseFloat(bean.capacity.replace('g', ''))) * 100}%` }}
                                                                        transition={{
                                                                            delay: 0.1,
                                                                            duration: 0.8,
                                                                            ease: "easeInOut"
                                                                        }}
                                                                        className="h-full bg-neutral-800 dark:bg-neutral-100"
                                                                    />
                                                                </motion.div>
                                                            </div>
                                                        )}

                                                        {/* 赏味期进度条 - 仅当roastDate存在时显示 */}
                                                        {bean.roastDate && (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                                                                        赏味期
                                                                    </div>
                                                                    {(() => {
                                                                        // 计算天数差，向上取整确保当天也会显示进度
                                                                        const today = new Date();
                                                                        const roastDate = new Date(bean.roastDate);

                                                                        // 消除时区和时间差异，只比较日期部分
                                                                        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                                                                        const roastDateOnly = new Date(roastDate.getFullYear(), roastDate.getMonth(), roastDate.getDate());

                                                                        // 计算天数差，向上取整确保当天也会显示进度
                                                                        const daysSinceRoast = Math.ceil((todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24));

                                                                        // 优先使用自定义赏味期参数，如果没有则根据烘焙度计算
                                                                        let startDay = bean.startDay || 0;
                                                                        let endDay = bean.endDay || 0;
                                                                        let maxDay = bean.maxDay || 0;

                                                                        // 如果没有自定义值，则根据烘焙度设置默认值
                                                                        if (startDay === 0 && endDay === 0 && maxDay === 0) {
                                                                            if (bean.roastLevel?.includes('浅')) {
                                                                                startDay = 7;
                                                                                endDay = 30;
                                                                                maxDay = 60;
                                                                            } else if (bean.roastLevel?.includes('深')) {
                                                                                startDay = 14;
                                                                                endDay = 60;
                                                                                maxDay = 90;
                                                                            } else {
                                                                                // 默认为中烘焙
                                                                                startDay = 10;
                                                                                endDay = 30;
                                                                                maxDay = 60;
                                                                            }
                                                                        }

                                                                        let status = '';
                                                                        if (daysSinceRoast < startDay) {
                                                                            status = `养豆期还剩 ${startDay - daysSinceRoast} 天`;
                                                                        } else if (daysSinceRoast <= endDay) {
                                                                            status = `最佳赏味期剩余 ${endDay - daysSinceRoast} 天`;
                                                                        } else if (daysSinceRoast <= maxDay) {
                                                                            status = `赏味期剩余 ${maxDay - daysSinceRoast} 天`;
                                                                        } else {
                                                                            status = '已进入赏味衰退期';
                                                                        }

                                                                        return (
                                                                            <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                                                                                {status}
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </div>
                                                                <motion.div className="h-px w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800 relative">
                                                                    {(() => {
                                                                        // 计算天数差，向上取整确保当天也会显示进度
                                                                        const today = new Date();
                                                                        const roastDate = new Date(bean.roastDate);

                                                                        // 消除时区和时间差异，只比较日期部分
                                                                        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                                                                        const roastDateOnly = new Date(roastDate.getFullYear(), roastDate.getMonth(), roastDate.getDate());

                                                                        // 计算天数差，向上取整确保当天也会显示进度
                                                                        const daysSinceRoast = Math.ceil((todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24));

                                                                        // 优先使用自定义赏味期参数，如果没有则根据烘焙度计算
                                                                        let startDay = bean.startDay || 0;
                                                                        let endDay = bean.endDay || 0;
                                                                        let maxDay = bean.maxDay || 0;

                                                                        // 如果没有自定义值，则根据烘焙度设置默认值
                                                                        if (startDay === 0 && endDay === 0 && maxDay === 0) {
                                                                            if (bean.roastLevel?.includes('浅')) {
                                                                                startDay = 7;
                                                                                endDay = 30;
                                                                                maxDay = 60;
                                                                            } else if (bean.roastLevel?.includes('深')) {
                                                                                startDay = 14;
                                                                                endDay = 60;
                                                                                maxDay = 90;
                                                                            } else {
                                                                                // 默认为中烘焙
                                                                                startDay = 10;
                                                                                endDay = 30;
                                                                                maxDay = 60;
                                                                            }
                                                                        }

                                                                        // 计算各区间宽度百分比
                                                                        const preFlavorPercent = (startDay / maxDay) * 100;
                                                                        const flavorPercent = ((endDay - startDay) / maxDay) * 100;
                                                                        const postFlavorPercent = ((maxDay - endDay) / maxDay) * 100;
                                                                        const progressPercent = Math.min((daysSinceRoast / maxDay) * 100, 100);

                                                                        // 判断当前阶段
                                                                        let fillColor = 'bg-neutral-600 dark:bg-neutral-400';
                                                                        if (daysSinceRoast > endDay) {
                                                                            fillColor = 'bg-neutral-500 dark:bg-neutral-500';
                                                                        } else if (daysSinceRoast >= startDay) {
                                                                            fillColor = 'bg-green-500 dark:bg-green-600';
                                                                        } else {
                                                                            fillColor = 'bg-neutral-600 dark:bg-neutral-400';
                                                                        }

                                                                        return (
                                                                            <>
                                                                                {/* 赏味期前区间 */}
                                                                                <motion.div
                                                                                    initial={{ width: 0, opacity: 0 }}
                                                                                    animate={{ width: `${preFlavorPercent}%`, opacity: 1 }}
                                                                                    transition={{ delay: 0.1, duration: 0.6, ease: "easeInOut" }}
                                                                                    className="absolute h-full bg-neutral-400/10 dark:bg-neutral-400/10"
                                                                                    style={{
                                                                                        left: '0%'
                                                                                    }}
                                                                                ></motion.div>

                                                                                {/* 最佳赏味期区间（带纹理） */}
                                                                                <motion.div
                                                                                    initial={{ width: 0, opacity: 0 }}
                                                                                    animate={{ width: `${flavorPercent}%`, opacity: 1 }}
                                                                                    transition={{ delay: 0.2, duration: 0.6, ease: "easeInOut" }}
                                                                                    className="absolute h-full bg-green-500/20 dark:bg-green-600/30"
                                                                                    style={{
                                                                                        left: `${preFlavorPercent}%`,
                                                                                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0, 0, 0, 0.1) 2px, rgba(0, 0, 0, 0.1) 4px)'
                                                                                    }}
                                                                                ></motion.div>

                                                                                {/* 赏味期后区间 */}
                                                                                <motion.div
                                                                                    initial={{ width: 0, opacity: 0 }}
                                                                                    animate={{ width: `${postFlavorPercent}%`, opacity: 1 }}
                                                                                    transition={{ delay: 0.3, duration: 0.6, ease: "easeInOut" }}
                                                                                    className="absolute h-full bg-neutral-400/10 dark:bg-neutral-400/10"
                                                                                    style={{
                                                                                        left: `${preFlavorPercent + flavorPercent}%`
                                                                                    }}
                                                                                ></motion.div>

                                                                                {/* 进度指示 */}
                                                                                <motion.div
                                                                                    initial={{ width: 0 }}
                                                                                    animate={{ width: `${progressPercent}%` }}
                                                                                    transition={{ delay: 0.4, duration: 0.9, ease: "easeInOut" }}
                                                                                    className={`absolute h-full ${fillColor}`}
                                                                                    style={{
                                                                                        zIndex: 10
                                                                                    }}
                                                                                ></motion.div>
                                                                            </>
                                                                        );
                                                                    })()}
                                                                </motion.div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* 风味标签 - 改进显示 */}
                                                    {bean.flavor && bean.flavor.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                            {bean.flavor.map((flavor, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    className="text-[10px] bg-neutral-100 dark:bg-neutral-800 rounded-full px-2 py-0.5"
                                                                >
                                                                    {flavor}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* 底部信息布局优化 */}
                                                    <div className="flex items-baseline justify-between mt-1.5 text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400 ">
                                                        <div>
                                                            {bean.roastDate && <span>烘焙于 {bean.roastDate}</span>}
                                                        </div>
                                                        <div>
                                                            {bean.price && (
                                                                <span>
                                                                    {bean.price}元
                                                                    {bean.capacity && (
                                                                        <span className="ml-1">
                                                                            [{(parseFloat(bean.price) / parseFloat(bean.capacity.replace('g', ''))).toFixed(2)}元/克]
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* 备注信息 */}
                                                    {bean.notes && (
                                                        <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400  pt-1.5 border-t border-neutral-200/50 dark:border-neutral-800/50">
                                                            {bean.notes}
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            // 榜单视图
                            <motion.div
                                key="ranking-view"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                                className="w-full"
                            >
                                <CoffeeBeanRanking
                                    isOpen={viewMode === VIEW_OPTIONS.RANKING}
                                    onShowRatingForm={handleShowRatingForm}
                                    sortOption={convertToRankingSortOption(sortOption)}
                                    updatedBeanId={lastRatedBeanId}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* 添加和导入按钮 - 仅在仓库视图显示 */}
                    {viewMode === VIEW_OPTIONS.INVENTORY && (
                        <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="bottom-action-bar"
                        >
                            <div className="absolute bottom-full left-0 right-0 h-12 bg-gradient-to-t from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
                            <div className="relative flex items-center bg-neutral-50 dark:bg-neutral-900 py-4">
                                <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
                                <div className="flex items-center space-x-3 mx-3">
                                    <motion.button
                                        onClick={() => {
                                            if (showBeanForm) {
                                                showBeanForm(null);
                                            } else {
                                                setShowAddForm(true);
                                            }
                                        }}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="flex items-center justify-center text-[11px] text-neutral-500 dark:text-neutral-400"
                                    >
                                        <span className="mr-1">+</span> 添加咖啡豆
                                    </motion.button>
                                    <div className="flex-grow w-4 border-t border-neutral-200 dark:border-neutral-800"></div>
                                    <motion.button
                                        onClick={onShowImport}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="flex items-center justify-center text-[11px] text-neutral-500 dark:text-neutral-400"
                                    >
                                        <span className="mr-1">↓</span> 导入咖啡豆
                                    </motion.button>
                                </div>
                                <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
                            </div>
                        </motion.div>
                    )}
                </motion.div>
            </AnimatePresence>
        </>
    )
}

export default CoffeeBeans