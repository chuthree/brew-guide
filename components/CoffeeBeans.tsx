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
    [SORT_OPTIONS.REMAINING_DAYS_ASC]: '赏味期 (近→远)',
    [SORT_OPTIONS.REMAINING_DAYS_DESC]: '赏味期 (远→近)',
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
    // 榜单视图的筛选状态
    const [rankingBeanType, setRankingBeanType] = useState<'all' | 'espresso' | 'filter'>('all')
    const [rankingEditMode, setRankingEditMode] = useState<boolean>(false)

    // 添加引用，用于点击外部关闭操作菜单
    const containerRef = React.useRef<HTMLDivElement>(null);

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
                    .filter(bean => (showEmptyBeans || !isBeanEmpty(bean))) // 只根据是否显示已用完的豆子来过滤
                    .map(bean => bean.variety || '未分类') // 如果没有豆种，标记为"未分类"
                    .filter((value, index, self) => self.indexOf(value) === index) // 去重
                    .sort() // 按字母排序

                setAvailableVarieties(varieties)

                // 根据当前选中的品种过滤咖啡豆
                if (selectedVariety) {
                    setFilteredBeans(sortedBeans.filter(bean =>
                        (bean.variety || '未分类') === selectedVariety &&
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

    // 检查参数是否已包含在名称中的辅助函数
    const isParameterInName = (name: string, parameter?: string): boolean => {
        if (!parameter) return true; // 如果参数为空，视为已包含
        return name.toLowerCase().includes(parameter.toLowerCase());
    };

    // 添加点击外部关闭菜单的处理函数
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // 检查是否有开启的菜单
            const hasOpenMenu = Object.values(actionMenuStates).some(state => state);

            if (!hasOpenMenu) return;

            // 检查点击是否在容器外部
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                // 关闭所有打开的菜单
                const updatedMenuStates = { ...actionMenuStates };
                let hasChanges = false;

                Object.keys(updatedMenuStates).forEach(id => {
                    if (updatedMenuStates[id]) {
                        updatedMenuStates[id] = false;
                        hasChanges = true;
                    }
                });

                if (hasChanges) {
                    setActionMenuStates(updatedMenuStates);
                }
            }
        };

        // 添加事件监听器
        document.addEventListener('mousedown', handleClickOutside);

        // 清理事件监听器
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [actionMenuStates]);

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
                    transition={{ duration: 0.15 }}
                    ref={containerRef}
                >
                    {/* 视图切换和操作按钮 - 固定在页面顶部 */}
                    <div className="pt-6 space-y-6 sticky top-0 bg-neutral-50 dark:bg-neutral-900 z-10">
                        {/* 视图切换与筛选栏 - 统一布局 */}
                        <div className="flex justify-between items-center mb-6 px-6">
                            <div className="flex items-center space-x-3">
                                <div className="text-xs tracking-wide text-neutral-600 dark:text-neutral-300">
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
                                        className="w-auto min-w-[90px] tracking-wide text-neutral-600 dark:text-neutral-300 transition-colors hover:text-neutral-800 dark:hover:text-neutral-200"
                                    >
                                        <div className="flex items-center">
                                            <SelectValue />
                                            <svg
                                                className="ml-1.5 w-3.5 h-3.5 opacity-80"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M6 9l6 6 6-6" />
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
                                                className="tracking-wide text-neutral-600 dark:text-neutral-300 data-[highlighted]:text-neutral-800 dark:data-[highlighted]:text-neutral-100 transition-colors font-medium"
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
                                            className="w-auto min-w-[100px] tracking-wide text-neutral-600 dark:text-neutral-300 transition-colors hover:text-neutral-800 dark:hover:text-neutral-200"
                                        >
                                            <div className="flex items-center">
                                                <SelectValue />
                                                <svg
                                                    className="ml-1.5 w-3.5 h-3.5 opacity-80"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M6 9l6 6 6-6" />
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
                                                        className="tracking-wide text-neutral-600 dark:text-neutral-300 data-[highlighted]:text-neutral-800 dark:data-[highlighted]:text-neutral-100 transition-colors font-medium"
                                                    >
                                                        评分 (高→低)
                                                    </SelectItem>
                                                    <SelectItem
                                                        key={SORT_OPTIONS.REMAINING_DAYS_DESC}
                                                        value={SORT_OPTIONS.REMAINING_DAYS_DESC}
                                                        className="tracking-wide text-neutral-600 dark:text-neutral-300 data-[highlighted]:text-neutral-800 dark:data-[highlighted]:text-neutral-100 transition-colors font-medium"
                                                    >
                                                        评分 (低→高)
                                                    </SelectItem>
                                                    <SelectItem
                                                        key={SORT_OPTIONS.NAME_ASC}
                                                        value={SORT_OPTIONS.NAME_ASC}
                                                        className="tracking-wide text-neutral-600 dark:text-neutral-300 data-[highlighted]:text-neutral-800 dark:data-[highlighted]:text-neutral-100 transition-colors font-medium"
                                                    >
                                                        名称 (A→Z)
                                                    </SelectItem>
                                                    <SelectItem
                                                        key={SORT_OPTIONS.NAME_DESC}
                                                        value={SORT_OPTIONS.NAME_DESC}
                                                        className="tracking-wide text-neutral-600 dark:text-neutral-300 data-[highlighted]:text-neutral-800 dark:data-[highlighted]:text-neutral-100 transition-colors font-medium"
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
                                                        className="tracking-wide text-neutral-600 dark:text-neutral-300 data-[highlighted]:text-neutral-800 dark:data-[highlighted]:text-neutral-100 transition-colors font-medium"
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
                            <div className="mb-1 relative">
                                {/* 使用与CoffeeBeanRanking相同的样式，但添加可滑动功能 */}
                                <div className="border-b border-neutral-200 dark:border-neutral-800/50 px-3">
                                    <div className="flex overflow-x-auto no-scrollbar pr-6">
                                        <button
                                            onClick={() => handleVarietyClick(null)}
                                            className={`pb-1.5 mx-3 text-[11px] whitespace-nowrap ${selectedVariety === null ? 'text-neutral-800 dark:text-white border-b border-neutral-600 dark:border-neutral-300' : 'text-neutral-500 dark:text-neutral-400'}`}
                                        >
                                            全部豆子
                                        </button>
                                        {availableVarieties.map(variety => (
                                            <button
                                                key={variety}
                                                onClick={() => handleVarietyClick(variety)}
                                                className={`pb-1.5 mx-3 text-[11px] whitespace-nowrap ${selectedVariety === variety ? 'text-neutral-800 dark:text-white border-b border-neutral-600 dark:border-neutral-300' : 'text-neutral-500 dark:text-neutral-400'}`}
                                            >
                                                {variety}
                                            </button>
                                        ))}

                                        {/* 显示/隐藏已用完的咖啡豆 - 只在有已用完的咖啡豆时显示 */}
                                        {hasEmptyBeans && (
                                            <button
                                                onClick={() => setShowEmptyBeans(!showEmptyBeans)}
                                                className={`pb-1.5 mx-3 text-[11px] whitespace-nowrap ml-auto ${showEmptyBeans ? 'text-blue-500 dark:text-blue-400 border-b border-blue-500 dark:border-blue-400' : 'text-neutral-500 dark:text-neutral-400'}`}
                                            >
                                                {showEmptyBeans ? '隐藏已用完' : '显示已用完'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {/* 添加右侧渐变阴影指示可滑动 */}
                                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
                            </div>
                        )}

                        {/* 榜单标签筛选 - 仅在榜单视图显示 */}
                        {viewMode === VIEW_OPTIONS.RANKING && (
                            <div className="mb-1">
                                {/* 豆子筛选选项卡 */}
                                <div className="flex justify-between border-b border-neutral-200 dark:border-neutral-800/50 px-3">
                                    <div className="flex">
                                        <button
                                            className={`pb-1.5 mx-3 text-[11px] ${rankingBeanType === 'all' ? 'text-neutral-800 dark:text-white border-b border-neutral-600 dark:border-neutral-300' : 'text-neutral-500 dark:text-neutral-400'}`}
                                            onClick={() => setRankingBeanType('all')}
                                        >
                                            全部豆子
                                        </button>
                                        <button
                                            className={`pb-1.5 mx-3 text-[11px] ${rankingBeanType === 'espresso' ? 'text-neutral-800 dark:text-white border-b border-neutral-600 dark:border-neutral-300' : 'text-neutral-500 dark:text-neutral-400'}`}
                                            onClick={() => setRankingBeanType('espresso')}
                                        >
                                            意式豆
                                        </button>
                                        <button
                                            className={`pb-1.5 mx-3 text-[11px] ${rankingBeanType === 'filter' ? 'text-neutral-800 dark:text-white border-b border-neutral-600 dark:border-neutral-300' : 'text-neutral-500 dark:text-neutral-400'}`}
                                            onClick={() => setRankingBeanType('filter')}
                                        >
                                            手冲豆
                                        </button>
                                    </div>

                                    {/* 编辑按钮 */}
                                    <button
                                        onClick={() => setRankingEditMode(!rankingEditMode)}
                                        className={`pb-1.5 px-3 text-[11px] ${rankingEditMode ? 'text-blue-500 dark:text-blue-400 border-b border-blue-500 dark:border-blue-400' : 'text-neutral-500 dark:text-neutral-400'}`}
                                    >
                                        {rankingEditMode ? '完成' : '编辑'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 内容区域：根据视图模式显示不同内容 */}
                    <AnimatePresence mode="wait">
                        {viewMode === VIEW_OPTIONS.INVENTORY ? (
                            // 库存视图
                            <motion.div
                                key="inventory-view"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="w-full scroll-with-bottom-bar"
                            >
                                {/* 咖啡豆列表 */}
                                {filteredBeans.length === 0 ? (
                                    <div
                                        className="flex h-28 items-center justify-center text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400"
                                    >
                                        {selectedVariety ? `暂无${selectedVariety}品种的咖啡豆` : '暂无咖啡豆'}
                                    </div>
                                ) : (
                                    <div className="pb-24">
                                        {filteredBeans.map((bean, index) => (
                                            <motion.div
                                                key={bean.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{
                                                    duration: 0.2,
                                                    delay: Math.min(index * 0.03, 0.3) // 最多延迟0.3秒
                                                }}
                                                className={`border-b border-neutral-200/60 dark:border-neutral-800/40 last:border-none ${isBeanEmpty(bean) ? 'opacity-80' : ''}`}
                                            >
                                                <div className="flex justify-between items-start px-6 py-2.5 hover:bg-neutral-50/90 dark:hover:bg-neutral-900/50 transition-colors"
                                                    onClick={() => {
                                                        // 关闭所有操作菜单
                                                        const hasOpenMenus = Object.values(actionMenuStates).some(state => state);
                                                        if (hasOpenMenus) {
                                                            setActionMenuStates(Object.keys(actionMenuStates).reduce((acc, id) => {
                                                                acc[id] = false;
                                                                return acc;
                                                            }, {} as Record<string, boolean>));
                                                        }
                                                    }}
                                                >
                                                    <div className="flex items-start min-w-0 w-full">
                                                        {/* 图片 - 增大尺寸 */}
                                                        {bean.image && (
                                                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex-shrink-0 mr-3 border border-neutral-200/50 dark:border-neutral-700/50 relative">
                                                                <Image
                                                                    src={bean.image}
                                                                    alt=""
                                                                    fill
                                                                    className="object-cover"
                                                                    sizes="64px"
                                                                />
                                                            </div>
                                                        )}

                                                        {/* 咖啡豆信息 */}
                                                        <div className="flex-1 min-w-0">
                                                            {/* 咖啡豆名称和阶段 */}
                                                            <div className="flex items-center flex-wrap">
                                                                <div className="text-[11px] font-medium text-neutral-800 dark:text-white break-all pr-1">
                                                                    {(() => {
                                                                        // 收集未包含在名称中的信息
                                                                        const extraInfo = [];

                                                                        // 如果是拼配豆，不添加额外信息到标题
                                                                        if (bean.type === '拼配') {
                                                                            return bean.name;
                                                                        }

                                                                        // 只为单品豆添加额外信息
                                                                        if (bean.origin && !isParameterInName(bean.name, bean.origin)) {
                                                                            extraInfo.push(bean.origin);
                                                                        }
                                                                        if (bean.process && !isParameterInName(bean.name, bean.process)) {
                                                                            extraInfo.push(bean.process);
                                                                        }
                                                                        if (bean.variety && !isParameterInName(bean.name, bean.variety)) {
                                                                            extraInfo.push(bean.variety);
                                                                        }
                                                                        return extraInfo.length > 0 ? `${bean.name} ${extraInfo.join(' ')}` : bean.name;
                                                                    })()}
                                                                </div>

                                                                {/* 赏味期状态显示 */}
                                                                {bean.roastDate && (
                                                                    <div className="flex items-center">
                                                                        {(() => {
                                                                            const { phase, remainingDays } = getFlavorInfo(bean);

                                                                            let status = '';
                                                                            let statusColor = '';

                                                                            if (phase === '养豆期') {
                                                                                status = `养豆期 ${remainingDays}天`;
                                                                                statusColor = 'text-amber-500 dark:text-amber-400';
                                                                            } else if (phase === '最佳赏味期') {
                                                                                status = `最佳期 ${remainingDays}天`;
                                                                                statusColor = 'text-emerald-500 dark:text-emerald-400';
                                                                            } else if (phase === '赏味期') {
                                                                                status = `赏味期 ${remainingDays}天`;
                                                                                statusColor = 'text-blue-500 dark:text-blue-400';
                                                                            } else {
                                                                                status = '已衰退';
                                                                                statusColor = 'text-neutral-500';
                                                                            }

                                                                            return (
                                                                                <div className={`ml-1.5 text-[10px] ${statusColor}`}>
                                                                                    {status}
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                )}

                                                                {/* 已用完状态标签 */}
                                                                {isBeanEmpty(bean) && (
                                                                    <div className="ml-1.5 text-[10px] text-red-500 dark:text-red-400">
                                                                        已用完
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* 咖啡豆详细信息 */}
                                                            <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 break-words">
                                                                {[
                                                                    bean.roastLevel && !isParameterInName(bean.name, bean.roastLevel) ? bean.roastLevel : null,
                                                                    bean.roastDate ? `烘焙于 ${new Date(bean.roastDate).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}` : null,
                                                                    (bean.capacity || bean.remaining) ?
                                                                        `${bean.remaining}/${bean.capacity}g` : null,
                                                                    bean.price && bean.capacity ?
                                                                        `${(parseFloat(bean.price) / parseFloat(bean.capacity)).toFixed(2)}元/g` : null,
                                                                    (bean.type === '拼配' && bean.blendComponents && bean.blendComponents.length > 0) ?
                                                                        `拼配: ${bean.blendComponents.map((comp, i) => {
                                                                            // 收集每个成分的详细信息
                                                                            const details = [];
                                                                            if (comp.origin) details.push(comp.origin);
                                                                            if (comp.variety) details.push(comp.variety);
                                                                            if (comp.process) details.push(comp.process);

                                                                            // 构建成分文本
                                                                            let compText = details.length > 0 ? details.join(' ') : '未知成分';

                                                                            // 添加百分比信息
                                                                            if (comp.percentage) {
                                                                                compText += ` ${comp.percentage}%`;
                                                                            }

                                                                            return compText + (i < bean.blendComponents!.length - 1 ? ' + ' : '');
                                                                        }).join('')}` : null,
                                                                    (bean.flavor && bean.flavor.length > 0) ?
                                                                        `风味: ${bean.flavor.join(' · ')}` : null
                                                                ].filter(Boolean).join(' · ')}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* 操作按钮 - 更多菜单 */}
                                                    <div className="relative">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                // 关闭其他操作菜单
                                                                Object.keys(actionMenuStates).forEach(id => {
                                                                    if (id !== bean.id && actionMenuStates[id]) {
                                                                        setActionMenuStates(prev => ({
                                                                            ...prev,
                                                                            [id]: false
                                                                        }))
                                                                    }
                                                                });
                                                                // 切换当前菜单
                                                                setActionMenuStates(prev => ({
                                                                    ...prev,
                                                                    [bean.id]: !prev[bean.id]
                                                                }))
                                                            }}
                                                            className="text-[10px] text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 ml-2 px-1 py-0.5 transition-colors"
                                                            aria-label="更多操作"
                                                        >
                                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <circle cx="12" cy="12" r="1" />
                                                                <circle cx="19" cy="12" r="1" />
                                                                <circle cx="5" cy="12" r="1" />
                                                            </svg>
                                                        </button>

                                                        <AnimatePresence>
                                                            {actionMenuStates[bean.id] && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                                    animate={{ opacity: 1, scale: 1 }}
                                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                                    transition={{ duration: 0.15 }}
                                                                    className="absolute right-0 top-0 z-10 bg-white dark:bg-neutral-800 shadow-md border border-neutral-200/80 dark:border-neutral-700/80 rounded-lg px-3 py-2 mt-7 min-w-[9rem] flex flex-col space-y-2.5"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <button
                                                                        onClick={() => {
                                                                            handleShowRatingForm(bean);
                                                                            setActionMenuStates(prev => ({ ...prev, [bean.id]: false }));
                                                                        }}
                                                                        className="flex items-center text-[11px] text-neutral-600 dark:text-neutral-300 hover:text-neutral-800 dark:hover:text-white transition-colors text-left"
                                                                    >
                                                                        <svg className="w-3 h-3 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                                                        </svg>
                                                                        评分
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            handleEdit(bean);
                                                                            setActionMenuStates(prev => ({ ...prev, [bean.id]: false }));
                                                                        }}
                                                                        className="flex items-center text-[11px] text-neutral-600 dark:text-neutral-300 hover:text-neutral-800 dark:hover:text-white transition-colors text-left"
                                                                    >
                                                                        <svg className="w-3 h-3 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                                        </svg>
                                                                        编辑
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            handleShare(bean);
                                                                            setActionMenuStates(prev => ({ ...prev, [bean.id]: false }));
                                                                        }}
                                                                        className="flex items-center text-[11px] text-neutral-600 dark:text-neutral-300 hover:text-neutral-800 dark:hover:text-white transition-colors text-left"
                                                                    >
                                                                        <svg className="w-3 h-3 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                                                            <polyline points="16 6 12 2 8 6" />
                                                                            <line x1="12" y1="2" x2="12" y2="15" />
                                                                        </svg>
                                                                        {copySuccess[bean.id] ? '已复制' : '分享'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            handleGenerateAIRecipe(bean);
                                                                            setActionMenuStates(prev => ({ ...prev, [bean.id]: false }));
                                                                        }}
                                                                        className="flex items-center text-[11px] text-neutral-600 dark:text-neutral-300 hover:text-neutral-800 dark:hover:text-white transition-colors text-left"
                                                                    >
                                                                        <svg className="w-3 h-3 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                            <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
                                                                            <path d="M8.5 8.5v.01" />
                                                                            <path d="M16 15.5v.01" />
                                                                            <path d="M12 12v.01" />
                                                                        </svg>
                                                                        AI方案
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            handleDelete(bean);
                                                                            setActionMenuStates(prev => ({ ...prev, [bean.id]: false }));
                                                                        }}
                                                                        className="flex items-center text-[11px] text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors text-left"
                                                                    >
                                                                        <svg className="w-3 h-3 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                            <polyline points="3 6 5 6 21 6" />
                                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                                        </svg>
                                                                        删除
                                                                    </button>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
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
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="w-full"
                            >
                                <CoffeeBeanRanking
                                    isOpen={viewMode === VIEW_OPTIONS.RANKING}
                                    onShowRatingForm={handleShowRatingForm}
                                    sortOption={convertToRankingSortOption(sortOption)}
                                    updatedBeanId={lastRatedBeanId}
                                    hideFilters={true}
                                    beanType={rankingBeanType}
                                    editMode={rankingEditMode}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* 添加和导入按钮 - 仅在仓库视图显示 */}
                    {viewMode === VIEW_OPTIONS.INVENTORY && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
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