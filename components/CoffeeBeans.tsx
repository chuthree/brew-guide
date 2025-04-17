/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Image from 'next/image'
import { CoffeeBean } from '@/app/types'
import { CoffeeBeanManager } from '@/lib/coffeeBeanManager'
import CoffeeBeanFormModal from '@/components/CoffeeBean/Form/Modal'
import CoffeeBeanRatingModal from './CoffeeBeanRatingModal'
import CoffeeBeanRanking from './CoffeeBeanRanking'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './ui/select'
import { SORT_OPTIONS as RANKING_SORT_OPTIONS, RankingSortOption } from './CoffeeBeanRanking'
import { getBloggerBeans } from '@/lib/csvUtils'
import BottomActionBar from '@/components/BottomActionBar'
import ActionMenu from './ui/action-menu'
import { useCopy } from "@/lib/hooks/useCopy"
import CopyFailureModal from "./ui/copy-failure-modal"
import { SortSelector, SORT_OPTIONS, type SortOption, sortBeans as sortBeansFn, convertToRankingSortOption } from './SortSelector'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'

// 添加ExtendedCoffeeBean类型
interface BlendComponent {
    percentage?: number;  // 百分比 (1-100)，改为可选
    origin?: string;     // 产地
    process?: string;    // 处理法
    variety?: string;    // 品种
}

interface ExtendedCoffeeBean extends CoffeeBean {
    blendComponents?: BlendComponent[];
}

// 视图模式定义
const VIEW_OPTIONS = {
    INVENTORY: 'inventory',
    RANKING: 'ranking',
    BLOGGER: 'blogger', // 新增博主榜单视图
} as const;

type ViewOption = typeof VIEW_OPTIONS[keyof typeof VIEW_OPTIONS];

// 视图选项的显示名称
const VIEW_LABELS: Record<ViewOption, string> = {
    [VIEW_OPTIONS.INVENTORY]: '咖啡豆仓库',
    [VIEW_OPTIONS.RANKING]: '个人榜单',
    [VIEW_OPTIONS.BLOGGER]: '博主榜单',
};

interface CoffeeBeansProps {
    isOpen: boolean
    showBeanForm?: (bean: ExtendedCoffeeBean | null) => void  // 修改为ExtendedCoffeeBean
    onShowImport?: () => void
    onGenerateAIRecipe?: (bean: ExtendedCoffeeBean) => void // 修改为ExtendedCoffeeBean
}

// 修改函数参数类型
const generateBeanTitle = (bean: ExtendedCoffeeBean): string => {
    // 安全检查：确保bean是有效对象且有名称
    if (!bean || typeof bean !== 'object' || !bean.name) {
        return bean?.name || '未命名咖啡豆';
    }
    
    // 将豆子名称转换为小写以便比较
    const nameLower = bean.name.toLowerCase();
    
    // 创建一个函数来检查参数是否已包含在名称中
    const isIncluded = (param?: string | null): boolean => {
        // 如果参数为空或不是字符串类型，视为已包含
        if (!param || typeof param !== 'string') return true;
        
        // 将参数转换为小写并分割成单词
        const paramWords = param.toLowerCase().split(/\s+/);
        
        // 检查每个单词是否都包含在名称中
        return paramWords.every(word => nameLower.includes(word));
    };

    // 收集需要添加的参数
    const additionalParams: string[] = [];

    // 检查并添加烘焙度
    if (bean.roastLevel && !isIncluded(bean.roastLevel)) {
        additionalParams.push(bean.roastLevel);
    }

    // 检查并添加产地
    if (bean.origin && !isIncluded(bean.origin)) {
        additionalParams.push(bean.origin);
    }

    // 检查并添加处理法
    if (bean.process && !isIncluded(bean.process)) {
        additionalParams.push(bean.process);
    }

    // 检查并添加品种
    if (bean.variety && !isIncluded(bean.variety)) {
        additionalParams.push(bean.variety);
    }

    // 如果有额外参数，将它们添加到名称后面
    return additionalParams.length > 0
        ? `${bean.name} ${additionalParams.join(' ')}`
        : bean.name;
};

// 修改全局缓存对象，确保跨组件实例保持数据
const globalCache: {
    beans: ExtendedCoffeeBean[];
    ratedBeans: ExtendedCoffeeBean[];
    filteredBeans: ExtendedCoffeeBean[];
    bloggerBeans: { // Make bloggerBeans year-indexed
        2024: ExtendedCoffeeBean[];
        2025: ExtendedCoffeeBean[];
    };
    varieties: string[];
    selectedVariety: string | null;
    showEmptyBeans: boolean;
    initialized: boolean;
} = {
    beans: [],
    ratedBeans: [],
    filteredBeans: [],
    bloggerBeans: { 2024: [], 2025: [] }, // Initialize bloggerBeans for both years
    varieties: [],
    selectedVariety: null,
    showEmptyBeans: false,
    initialized: false
};

// 从localStorage读取已用完状态的函数
const getShowEmptyBeansPreference = (): boolean => {
    try {
        const value = localStorage.getItem('brew-guide:showEmptyBeans');
        return value === 'true';
    } catch (_e) {
        return false;
    }
};

// 保存已用完状态到localStorage的函数
const saveShowEmptyBeansPreference = (value: boolean): void => {
    try {
        localStorage.setItem('brew-guide:showEmptyBeans', value.toString());
    } catch (_e) {
        // 忽略错误，仅在控制台记录
        console.error('无法保存显示已用完豆子的偏好设置', _e);
    }
};

// 初始化全局缓存的已用完状态
globalCache.showEmptyBeans = getShowEmptyBeansPreference();

// const CoffeeBeans: React.FC<CoffeeBeansProps> = ({ isOpen, showBeanForm, onShowImport, onGenerateAIRecipe }) => {
const CoffeeBeans: React.FC<CoffeeBeansProps> = ({ isOpen, showBeanForm, onShowImport }) => {
    const { copyText, showFailureModal, failureContent, closeFailureModal } = useCopy()
    // 使用全局缓存的初始状态
    const [beans, setBeans] = useState<ExtendedCoffeeBean[]>(globalCache.beans)
    const [ratedBeans, setRatedBeans] = useState<ExtendedCoffeeBean[]>(globalCache.ratedBeans)
    const [showAddForm, setShowAddForm] = useState(false)
    const [editingBean, setEditingBean] = useState<ExtendedCoffeeBean | null>(null)
    const [actionMenuStates, setActionMenuStates] = useState<Record<string, boolean>>({}) // Keyed by bean.id
    const [sortOption, setSortOption] = useState<SortOption>(SORT_OPTIONS.REMAINING_DAYS_ASC)
    const [viewMode, setViewMode] = useState<ViewOption>(VIEW_OPTIONS.INVENTORY)
    const [showRatingModal, setShowRatingModal] = useState(false)
    const [selectedBeanForRating, setSelectedBeanForRating] = useState<ExtendedCoffeeBean | null>(null)
    const [lastRatedBeanId, setLastRatedBeanId] = useState<string | null>(null) // 新增，追踪最近评分的咖啡豆ID
    const [ratingSavedCallback, setRatingSavedCallback] = useState<(() => void) | null>(null) // 新增，存储评分保存后的回调
    // 豆种筛选相关状态 - 从全局缓存初始化
    const [availableVarieties, setAvailableVarieties] = useState<string[]>(globalCache.varieties)
    const [selectedVariety, setSelectedVariety] = useState<string | null>(globalCache.selectedVariety)
    const [filteredBeans, setFilteredBeans] = useState<ExtendedCoffeeBean[]>(globalCache.filteredBeans)
    // 咖啡豆显示控制 - 从全局缓存初始化
    const [showEmptyBeans, setShowEmptyBeans] = useState<boolean>(globalCache.showEmptyBeans)
    // 未使用的状态，但保留以避免修改太多相关代码
    const [_, setHasEmptyBeans] = useState<boolean>(false)
    // 榜单视图的筛选状态
    const [rankingBeanType, setRankingBeanType] = useState<'all' | 'espresso' | 'filter'>('all')
    const [rankingEditMode, setRankingEditMode] = useState<boolean>(false)
    // ** Add state for selected blogger year **
    const [bloggerYear, setBloggerYear] = useState<2024 | 2025>(2025)
    // 使用useRef避免不必要的重新渲染
    const [_isFirstLoad, setIsFirstLoad] = useState<boolean>(!globalCache.initialized)
    const unmountTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const isLoadingRef = useRef<boolean>(false)
    // 添加强制刷新的key
    const [forceRefreshKey, setForceRefreshKey] = useState(0)

    // 添加剩余量编辑状态
    const [editingRemaining, setEditingRemaining] = useState<{
        beanId: string,
        value: string,
        position: { x: number, y: number } | null
    } | null>(null)
    const remainingInputRef = useRef<HTMLInputElement>(null)
    
    // 添加引用，用于点击外部关闭操作菜单
    const containerRef = React.useRef<HTMLDivElement>(null);

    // 为所有豆子预计算标题并缓存
    const beanTitles = useMemo(() => {
        return filteredBeans.reduce((acc, bean) => {
            try {
                // 确保bean有name属性，否则使用默认名称
                if (bean && typeof bean === 'object' && typeof bean.name === 'string') {
                    acc[bean.id] = generateBeanTitle(bean);
                } else {
                    // 如果bean或bean.name不符合预期，使用安全的默认值
                    acc[bean.id] = bean.name || '未命名咖啡豆';
                }
            } catch (_error) {
                // 捕获生成标题过程中可能发生的错误，但不输出日志
                acc[bean.id] = bean.name || '未命名咖啡豆';
            }
            return acc;
        }, {} as Record<string, string>);
    }, [filteredBeans]);

    // 获取咖啡豆的赏味期信息
    const getFlavorInfo = useCallback((bean: ExtendedCoffeeBean): { phase: string, remainingDays: number } => {
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

    // 检查咖啡豆是否用完
    const isBeanEmpty = useCallback((bean: ExtendedCoffeeBean): boolean => {
        return (bean.remaining === "0" || bean.remaining === "0g") && bean.capacity !== undefined;
    }, []);

    // 更新过滤后的豆子和分类
    const updateFilteredBeansAndCategories = useCallback((beansToSort: ExtendedCoffeeBean[]) => {
        // 提取可用的品种列表
        const varieties = beansToSort.reduce((acc, bean) => {
            if (bean.variety && !acc.includes(bean.variety)) {
                acc.push(bean.variety);
            }
            return acc;
        }, [] as string[]);
        
        // 根据选择的品种过滤豆子
        let filtered = beansToSort;
        if (selectedVariety) {
            filtered = beansToSort.filter(bean => bean.variety === selectedVariety);
        }
        
        // 根据"显示已用完"设置过滤
        if (!showEmptyBeans) {
            filtered = filtered.filter(bean => !isBeanEmpty(bean));
        }
        
        // 更新状态和全局缓存
        setAvailableVarieties(varieties);
        setFilteredBeans(filtered);
        globalCache.varieties = varieties;
        globalCache.filteredBeans = filtered;
    }, [selectedVariety, showEmptyBeans, isBeanEmpty]);

    // 加载咖啡豆数据
    const loadBeans = useCallback(async () => {
        if (isLoadingRef.current) return; // 防止重复加载
        
        try {
            isLoadingRef.current = true;
            
            // 直接从存储加载新数据
            const loadedBeans = await CoffeeBeanManager.getAllBeans() as ExtendedCoffeeBean[];
            
            // 更新状态和全局缓存
            setBeans(loadedBeans);
            globalCache.beans = loadedBeans;
            globalCache.initialized = true;
            
            // 更新过滤后的豆子和分类
            updateFilteredBeansAndCategories(loadedBeans);
            
            // 检查是否有已用完的咖啡豆
            const hasEmpty = loadedBeans.some(bean => isBeanEmpty(bean));
            setHasEmptyBeans(hasEmpty);
            setIsFirstLoad(false);
        } catch (error) {
            console.error("加载咖啡豆数据失败:", error);
            setIsFirstLoad(false);
        } finally {
            isLoadingRef.current = false;
        }
    }, []);

    // 强制刷新时重新加载数据
    useEffect(() => {
        if (isOpen) {
            loadBeans();
        }
    }, [forceRefreshKey, loadBeans, isOpen]);

    // 监听咖啡豆更新事件
    useEffect(() => {
        // 处理自定义coffeeBeansUpdated事件
        const handleBeansUpdated = () => {
            // 强制刷新组件状态
            setForceRefreshKey(prev => prev + 1);
        };

        // 添加事件监听
        window.addEventListener('coffeeBeansUpdated', handleBeansUpdated);
        
        // 自己也是事件的发出者，监听自己的事件可以确保内部其他组件也能收到更新
        window.addEventListener('coffeeBeanListChanged', handleBeansUpdated);
        
        // 清理函数
        return () => {
            window.removeEventListener('coffeeBeansUpdated', handleBeansUpdated);
            window.removeEventListener('coffeeBeanListChanged', handleBeansUpdated);
        };
    }, []);

    // 清理unmountTimeout，避免内存泄漏
    useEffect(() => {
        // 在组件卸载时清除timeout
        return () => {
            if (unmountTimeoutRef.current) {
                clearTimeout(unmountTimeoutRef.current);
                unmountTimeoutRef.current = null;
            }
        };
    }, []);

    // 加载已评分的咖啡豆
    const loadRatedBeans = useCallback(async () => {
        if (viewMode !== VIEW_OPTIONS.RANKING) return;
        
        try {
            const ratedBeansData = await CoffeeBeanManager.getRatedBeans() as ExtendedCoffeeBean[];
            
            // 根据类型筛选
            let filteredRatedBeans = ratedBeansData;
            if (rankingBeanType !== 'all') {
                filteredRatedBeans = ratedBeansData.filter(bean => bean.beanType === rankingBeanType);
            }
            
            setRatedBeans(filteredRatedBeans);
            globalCache.ratedBeans = filteredRatedBeans;
        } catch (error) {
            console.error("加载评分咖啡豆失败:", error);
        }
    }, [viewMode, rankingBeanType]);

    // 加载博主榜单的咖啡豆
    const loadBloggerBeans = useCallback(async () => {
        if (viewMode !== VIEW_OPTIONS.BLOGGER) return;
        
        try {
            // Directly call the function from csvUtils with the selected year
            const bloggerBeansData = getBloggerBeans(rankingBeanType, bloggerYear); // Pass bloggerYear
            
            // Update the correct year in global cache
            globalCache.bloggerBeans[bloggerYear] = bloggerBeansData;
            
            // Trigger update (no direct state set for bloggerBeans, rely on global cache)
            setForceRefreshKey(prev => prev + 1);
        } catch (error) {
            console.error(`加载博主榜单咖啡豆 (${bloggerYear}) 失败:`, error);
        }
    }, [viewMode, rankingBeanType, bloggerYear]); // Add bloggerYear dependency

    // 根据isOpen状态和排序选项加载数据
    useEffect(() => {
        if (isOpen) {
            // 取消任何可能的超时重置
            if (unmountTimeoutRef.current) {
                clearTimeout(unmountTimeoutRef.current);
                unmountTimeoutRef.current = null;
            }
            
            loadBeans();
            loadRatedBeans();
            loadBloggerBeans(); // Call loadBloggerBeans
        } else {
            // 组件关闭时，不立即清空状态，而是延迟重置
            // 这样在切换页面时数据会保留一段时间，避免闪烁
            unmountTimeoutRef.current = setTimeout(() => {
                // 不执行任何操作，状态保持不变
                // 仍然使用全局缓存的数据
            }, 5000); // 5秒后再考虑重置，通常用户已经看不到了
        }
    }, [isOpen, sortOption, selectedVariety, loadBeans, loadRatedBeans, loadBloggerBeans, rankingBeanType, bloggerYear]); // Add bloggerYear dependency

    // 在视图切换时更新数据
    useEffect(() => {
        if (viewMode === VIEW_OPTIONS.BLOGGER) {
            loadBloggerBeans();
        } else if (viewMode === VIEW_OPTIONS.RANKING) {
            loadRatedBeans();
        }
    }, [viewMode, loadBloggerBeans, loadRatedBeans]);

    // 当显示空豆子设置改变时，更新过滤和全局缓存
    useEffect(() => {
        if (globalCache.initialized) {
            // 更新全局缓存
            globalCache.showEmptyBeans = showEmptyBeans;
            // 持久化到localStorage
            saveShowEmptyBeansPreference(showEmptyBeans);
            updateFilteredBeansAndCategories(globalCache.beans);
        }
    }, [showEmptyBeans, selectedVariety, updateFilteredBeansAndCategories]);

    // 处理添加咖啡豆 - 优化为立即更新UI和全局缓存
    const handleSaveBean = async (bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>) => {
        try {
            if (editingBean) {
                // 立即更新本地状态，先乐观更新UI
                const optimisticBean = {
                    ...editingBean,
                    ...bean
                };
                
                setBeans(prevBeans => {
                    const newBeans = prevBeans.map(b =>
                        b.id === editingBean.id ? optimisticBean : b
                    );
                    // 更新缓存
                    globalCache.beans = newBeans;
                    return globalCache.beans;
                });
                
                // 立即更新过滤后的豆子列表
                updateFilteredBeansAndCategories(globalCache.beans);
                
                // 异步更新本地存储
                await CoffeeBeanManager.updateBean(editingBean.id, bean);
                
                // 强制刷新数据
                setForceRefreshKey(prev => prev + 1);
                
                setEditingBean(null);
            } else {
                // 添加新咖啡豆 - 创建临时ID以便乐观更新UI
                const tempId = 'temp_' + Date.now();
                const tempBean = {
                    ...bean,
                    id: tempId,
                    timestamp: Date.now()
                } as ExtendedCoffeeBean;
                
                // 立即更新UI
                setBeans(prevBeans => {
                    const optimisticBeans = [...prevBeans, tempBean];
                    globalCache.beans = optimisticBeans;
                    return optimisticBeans;
                });
                
                // 立即更新过滤后的豆子列表
                updateFilteredBeansAndCategories(globalCache.beans);
                
                // 异步保存到存储
                await CoffeeBeanManager.addBean(bean);
                
                // 强制刷新数据
                setForceRefreshKey(prev => prev + 1);
                
                setShowAddForm(false);

                // 检查是否是首次添加咖啡豆并触发事件
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
            
            // 触发自定义事件以通知CoffeeBeanList组件更新
            window.dispatchEvent(new CustomEvent('coffeeBeansUpdated'));
            
        } catch (error) {
            console.error('保存咖啡豆失败:', error);
            // 保存失败时提示用户
            alert('保存失败，请重试');
        }
    };

    // 处理咖啡豆删除 - 优化为立即更新UI
    const handleDelete = async (bean: ExtendedCoffeeBean) => {
        if (window.confirm(`确认要删除咖啡豆"${bean.name}"吗？`)) {
            try {
                // 立即更新UI
                setBeans(prevBeans => {
                    const updatedBeans = prevBeans.filter(b => b.id !== bean.id);
                    globalCache.beans = updatedBeans;
                    return updatedBeans;
                });
                
                // 同步更新过滤后的列表
                setFilteredBeans(prevBeans => prevBeans.filter(b => b.id !== bean.id));
                updateFilteredBeansAndCategories(globalCache.beans);

                // 异步执行删除操作
                const success = await CoffeeBeanManager.deleteBean(bean.id);
                
                if (!success) {
                    // 如果删除失败，重新加载数据
                    setForceRefreshKey(prev => prev + 1);
                    alert('删除咖啡豆失败，请重试');
                } else {
                    // 强制刷新数据
                    setForceRefreshKey(prev => prev + 1);
                    
                    // 触发自定义事件以通知CoffeeBeanList组件更新
                    window.dispatchEvent(new CustomEvent('coffeeBeansUpdated'));
                }
            } catch (error) {
                console.error('删除咖啡豆失败:', error);
                // 删除失败时提示用户
                alert('删除咖啡豆时出错，请重试');
                // 重新加载数据恢复状态
                setForceRefreshKey(prev => prev + 1);
            }
        }
    };

    // 处理编辑咖啡豆
    const handleEdit = (bean: ExtendedCoffeeBean) => {
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

    // 保存咖啡豆评分 - 优化为立即更新UI
    const handleSaveRating = async (id: string, ratings: Partial<ExtendedCoffeeBean>) => {
        try {
            const updatedBean = await CoffeeBeanManager.updateBeanRatings(id, ratings);
            if (updatedBean) {
                // 更新本地状态
                setBeans(prevBeans => {
                    const newBeans = prevBeans.map(b =>
                        b.id === updatedBean.id ? updatedBean : b
                    );
                    globalCache.beans = newBeans;
                    return newBeans;
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
        } catch (_error) {
            // 静默处理错误
            alert("保存评分失败，请重试");
            throw _error; // 抛出错误以便上层处理
        }
    };

    // 处理分享咖啡豆信息
    const handleShare = (bean: ExtendedCoffeeBean) => {
        try {
            // 创建可共享的咖啡豆对象
            const shareableBean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'> = {
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
                notes: bean.notes,
                startDay: bean.startDay,
                endDay: bean.endDay
            };

            // 如果是拼配豆，添加拼配成分信息
            if (bean.type === '拼配' && bean.blendComponents && bean.blendComponents.length > 0) {
                shareableBean.blendComponents = bean.blendComponents;
            }

            // 导入转换工具并生成可读文本
            import('@/lib/jsonUtils').then(({ beanToReadableText }) => {
                // @ts-expect-error - 我们知道这个对象结构与函数期望的类型兼容
                const readableText = beanToReadableText(shareableBean);
                copyText(readableText);
                // 关闭操作菜单
                setActionMenuStates(prev => ({
                    ...prev,
                    [bean.id]: false
                }));
            }).catch(() => {
                // 转换失败时回退到JSON格式
                const jsonString = JSON.stringify(shareableBean, null, 2);
                copyText(jsonString);
            });
        } catch (error) {
            console.error('分享咖啡豆信息时出错:', error);
        }
    };

    // 处理咖啡豆评分
    const handleShowRatingForm = (bean: ExtendedCoffeeBean, onRatingSaved?: () => void) => {
        setSelectedBeanForRating(bean);
        setShowRatingModal(true);

        // 存储回调函数
        if (onRatingSaved) {
            setRatingSavedCallback(() => onRatingSaved);
        } else {
            setRatingSavedCallback(null);
        }
    };

    // 视图切换时更新排序选项
    useEffect(() => {
        // 根据视图模式设置默认排序
        switch (viewMode) {
            case VIEW_OPTIONS.INVENTORY:
                setSortOption(SORT_OPTIONS.REMAINING_DAYS_ASC);
                break;
            case VIEW_OPTIONS.RANKING:
                setSortOption(SORT_OPTIONS.RATING_DESC); // 默认按评分从高到低排序
                break;
            case VIEW_OPTIONS.BLOGGER:
                setSortOption(SORT_OPTIONS.ORIGINAL); // 默认使用原始排序
                break;
        }
    }, [viewMode]);

    // 当排序选项改变时更新数据
    useEffect(() => {
        if (viewMode === VIEW_OPTIONS.INVENTORY) {
            // 仓库视图：直接使用本地排序
            // 解决类型兼容性问题，将beans数组中的元素属性提取出来后再排序
            const compatibleBeans = beans.map(bean => ({
                id: bean.id,
                name: bean.name,
                roastDate: bean.roastDate,
                startDay: bean.startDay,
                endDay: bean.endDay,
                roastLevel: bean.roastLevel,
                capacity: bean.capacity,
                remaining: bean.remaining,
                timestamp: bean.timestamp,
                rating: bean.overallRating,
                variety: bean.variety,
                price: bean.price
            }));
            const sortedBeans = sortBeansFn(compatibleBeans, sortOption);
            
            // 保持原始引用以维护其他属性
            const resultBeans = beans.slice(); // 创建浅拷贝
            
            // 按照排序后的顺序重新排列原始beans数组
            for (let i = 0; i < sortedBeans.length; i++) {
                const sortedBean = sortedBeans[i];
                const originalIndex = beans.findIndex(b => b.id === sortedBean.id);
                if (originalIndex !== -1) {
                    resultBeans[i] = beans[originalIndex];
                }
            }
            
            updateFilteredBeansAndCategories(resultBeans);
        } else {
            // 榜单视图：转换为榜单排序选项
            const rankingSortOption = convertToRankingSortOption(sortOption, viewMode);
            // 更新榜单排序...（这里需要调用相应的更新函数）
        }
    }, [sortOption, viewMode, beans, updateFilteredBeansAndCategories]);

    // 处理品种标签点击
    const handleVarietyClick = (variety: string | null) => {
        setSelectedVariety(variety);
        // 更新全局缓存
        globalCache.selectedVariety = variety;
        
        // 立即更新过滤后的咖啡豆列表，不等待下一个渲染周期
        if (variety) {
            const filtered = beans.filter(bean => {
                // 如果选择的是"拼配豆"分类
                if (variety === '拼配豆') {
                    return bean.type === '拼配' && (showEmptyBeans || !isBeanEmpty(bean));
                }
                // 否则按照常规品种筛选，但排除拼配豆
                return bean.type !== '拼配' && (bean.variety || '未分类') === variety &&
                    (showEmptyBeans || !isBeanEmpty(bean));
            });
            globalCache.filteredBeans = filtered;
            setFilteredBeans(filtered);
        } else {
            const filtered = beans.filter(bean => 
                (showEmptyBeans || !isBeanEmpty(bean))
            );
            globalCache.filteredBeans = filtered;
            setFilteredBeans(filtered);
        }
    }

    // 检查参数是否已包含在名称中的辅助函数
    const _isParameterInName = (name: string, parameter?: string): boolean => {
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

    const _matchesSearch = (bean: ExtendedCoffeeBean, parameter: string): boolean => {
        if (!parameter) return true;
        
        // 检查name字段是否匹配
        const name = generateBeanTitle(bean);
        return name.toLowerCase().includes(parameter.toLowerCase());
    };

    // 添加剩余量编辑状态
    const handleRemainingClick = (bean: ExtendedCoffeeBean, event: React.MouseEvent) => {
        event.stopPropagation();
        const rect = (event.target as HTMLElement).getBoundingClientRect();
        setEditingRemaining({
            beanId: bean.id,
            value: bean.remaining || '', // 移除单位'g'，便于编辑
            position: {
                x: rect.left,
                y: rect.top + rect.height
            }
        });

        // 聚焦输入框
        setTimeout(() => {
            if (remainingInputRef.current) {
                remainingInputRef.current.focus();
                remainingInputRef.current.select();
            }
        }, 50);
    };

    // 处理剩余量更新
    const handleRemainingUpdate = async () => {
        if (!editingRemaining) return;

        try {
            const beanToUpdate = beans.find(bean => bean.id === editingRemaining.beanId);
            if (!beanToUpdate) return;

            // 验证输入值
            let valueToSave = editingRemaining.value.trim();
            if (valueToSave === '') valueToSave = '0';
            
            // 确保是有效数字
            const numValue = parseFloat(valueToSave);
            if (isNaN(numValue) || numValue < 0) {
                valueToSave = '0';
            }

            // 优化UI更新：先更新本地状态
            setBeans(prevBeans => {
                const newBeans = prevBeans.map(b => {
                    if (b.id === editingRemaining.beanId) {
                        return { ...b, remaining: valueToSave };
                    }
                    return b;
                });
                globalCache.beans = newBeans;
                return newBeans;
            });

            // 更新过滤后的豆子列表
            updateFilteredBeansAndCategories(globalCache.beans);

            // 异步更新数据库
            await CoffeeBeanManager.updateBean(editingRemaining.beanId, { remaining: valueToSave });

            // 触发自定义事件以通知其他组件更新
            window.dispatchEvent(new CustomEvent('coffeeBeansUpdated'));

            // 关闭编辑状态
            setEditingRemaining(null);
            
            // 强制刷新
            setForceRefreshKey(prev => prev + 1);
        } catch (error) {
            console.error('更新剩余量失败:', error);
            // 出错时仍然关闭编辑状态
            setEditingRemaining(null);
        }
    };

    // 处理快捷减量按钮点击
    const handleQuickDecrement = async (decrementAmount: number) => {
        if (!editingRemaining) return;
        
        try {
            const beanToUpdate = beans.find(bean => bean.id === editingRemaining.beanId);
            if (!beanToUpdate) return;
            
            // 获取当前值（不带单位）
            const currentValue = parseFloat(editingRemaining.value);
            if (isNaN(currentValue)) return;
            
            // 计算新值，确保不小于0
            const newValue = Math.max(0, currentValue - decrementAmount);
            
            // 是否减到0（剩余量不足）
            const reducedToZero = currentValue < decrementAmount;
            
            // 更新输入框值
            setEditingRemaining(prev => 
                prev ? { ...prev, value: newValue.toString() } : null
            );
            
            // 立即更新UI状态
            setBeans(prevBeans => {
                const newBeans = prevBeans.map(b => {
                    if (b.id === editingRemaining.beanId) {
                        return { ...b, remaining: newValue.toString() };
                    }
                    return b;
                });
                globalCache.beans = newBeans;
                return newBeans;
            });
            
            // 更新过滤后的豆子列表
            updateFilteredBeansAndCategories(globalCache.beans);
            
            // 异步更新数据库
            await CoffeeBeanManager.updateBean(editingRemaining.beanId, { remaining: newValue.toString() });
            
            // 触发自定义事件以通知其他组件更新
            window.dispatchEvent(new CustomEvent('coffeeBeansUpdated'));
            
            // 如果减到0，提供视觉反馈（例如闪烁一下）
            if (reducedToZero) {
                // 在这里可以添加剩余量不足时的反馈
                // 比如闪烁UI或显示提示信息
                console.log(`剩余量不足，已减至0g`);
            }
            
            // 关闭编辑状态
            setEditingRemaining(null);
            
            // 强制刷新
            setForceRefreshKey(prev => prev + 1);
        } catch (error) {
            console.error('快捷减量失败:', error);
            setEditingRemaining(null);
        }
    };

    // 添加键盘事件处理
    useEffect(() => {
        if (!editingRemaining) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleRemainingUpdate();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                handleRemainingCancel();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [editingRemaining]);

    // 处理剩余量编辑取消
    const handleRemainingCancel = () => {
        setEditingRemaining(null);
    };

    // 添加点击外部关闭剩余量编辑器的处理函数
    useEffect(() => {
        if (!editingRemaining) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (
                remainingInputRef.current && 
                !remainingInputRef.current.contains(event.target as Node)
            ) {
                // 点击的不是输入框本身，应用更改
                handleRemainingUpdate();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [editingRemaining]);

    if (!isOpen) return null

    return (
        <>
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
                    } catch (_error) {
                        // 静默处理错误
                        throw _error;
                    }
                }}
                onAfterSave={() => {
                    // 强制刷新榜单数据
                    const loadRatedBeans = async () => {
                        try {
                            const beans = await CoffeeBeanManager.getRatedBeans();
                            globalCache.ratedBeans = beans;
                            setRatedBeans(beans);
                        } catch (_error) {
                            // 静默处理错误
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

            <div
                ref={containerRef}
                className="h-full flex flex-col"
            >
                {/* 视图切换和操作按钮 - 固定在页面顶部 */}
                <div className="pt-6 space-y-6 sticky top-0 bg-neutral-50 dark:bg-neutral-900 z-20">
                    {/* 视图切换与筛选栏 - 统一布局 */}
                    <div className="flex justify-between items-center mb-6 px-6">
                        <div className="flex items-center space-x-3">
                            <div className="text-xs tracking-wide text-neutral-800 dark:text-neutral-100">
                                {(() => {
                                    if (viewMode === VIEW_OPTIONS.INVENTORY) {
                                        // 计算总重量
                                        const totalWeight = filteredBeans
                                            .filter(bean => bean.remaining && parseFloat(bean.remaining) > 0)
                                            .reduce((sum, bean) => sum + parseFloat(bean.remaining || '0'), 0);
                                        
                                        // 智能单位选择：小于1000克用g，大于等于1000克用kg
                                        let weightDisplay = '';
                                        if (totalWeight < 1000) {
                                            // 对于小重量，直接用克显示
                                            weightDisplay = `${Math.round(totalWeight)} g`;
                                        } else {
                                            // 对于大重量，用千克显示，保留1位小数
                                            const totalWeightKg = (totalWeight / 1000).toFixed(1);
                                            weightDisplay = `${totalWeightKg} kg`;
                                        }
                                        
                                        return `${selectedVariety ? `${filteredBeans.length}/${beans.length}` : beans.length} 款咖啡豆，总计 ${weightDisplay}`;
                                    } else if (viewMode === VIEW_OPTIONS.BLOGGER) {
                                        // Blogger view - use globalCache for the selected year
                                        const currentYearBeans = globalCache.bloggerBeans[bloggerYear] || [];
                                        const filteredCount = rankingBeanType === 'all' 
                                            ? currentYearBeans.length 
                                            : currentYearBeans.filter(bean => bean.beanType === rankingBeanType).length;
                                        
                                        return `${filteredCount} 款 (${bloggerYear}) 咖啡豆`; // Show year
                                    } else {
                                        // Ranking view
                                        const filteredCount = rankingBeanType === 'all' 
                                            ? ratedBeans.length 
                                            : ratedBeans.filter(bean => bean.beanType === rankingBeanType).length;
                                        
                                        return `${filteredCount} 款已评分咖啡豆`;
                                    }
                                })()}
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
                                    className="w-auto min-w-[82px] tracking-wide text-neutral-800 dark:text-neutral-100 transition-colors hover:opacity-80 text-right"
                                >
                                    <div className="flex items-center justify-end w-full">
                                        <SelectValue />
                                        <svg
                                            className="w-3 h-3 ml-1.5"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <line x1="4" y1="6" x2="11" y2="6" />
                                            <line x1="4" y1="12" x2="11" y2="12" />
                                            <line x1="4" y1="18" x2="13" y2="18" />
                                            <line x1="15" y1="6" x2="20" y2="6" />
                                            <line x1="15" y1="12" x2="20" y2="12" />
                                            <line x1="15" y1="18" x2="20" y2="18" />
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
                                            className="tracking-wide text-neutral-800 dark:text-neutral-100 data-[highlighted]:opacity-80 transition-colors font-medium"
                                        >
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* 排序组件 - 在两个视图中都显示 */}
                            {(viewMode === VIEW_OPTIONS.INVENTORY ? beans.length > 0 : true) && (
                                <SortSelector
                                    viewMode={viewMode}
                                    sortOption={sortOption}
                                    onSortChange={(value) => setSortOption(value as SortOption)}
                                    showSelector={true}
                                />
                            )}
                        </div>
                    </div>

                    {/* 品种标签筛选 - 仅在仓库视图显示 */}
                    {viewMode === VIEW_OPTIONS.INVENTORY && availableVarieties.length > 0 && (
                        <div className="relative">
                            {/* 使用与CoffeeBeanRanking相同的样式，但添加可滑动功能 */}
                            <div className="border-b border-neutral-200 dark:border-neutral-800 px-6 relative">
                                <div className="flex overflow-x-auto no-scrollbar pr-14">
                                    <button
                                        onClick={() => handleVarietyClick(null)}
                                        className={`pb-1.5 mr-3 text-[11px] whitespace-nowrap relative ${selectedVariety === null ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                    >
                                        <span className="relative">全部豆子</span>
                                        {selectedVariety === null && (
                                            <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                        )}
                                    </button>
                                    {availableVarieties.map(variety => (
                                        <button
                                            key={variety}
                                            onClick={() => handleVarietyClick(variety)}
                                            className={`pb-1.5 mx-3 text-[11px] whitespace-nowrap relative ${selectedVariety === variety ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                        >
                                            <span className="relative">{variety}</span>
                                            {selectedVariety === variety && (
                                                <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {/* 显示/隐藏已用完的咖啡豆 - 固定在右侧 */}
                                {beans.length > 0 && (
                                    <div className="absolute right-6 top-0 bottom-0 flex items-center bg-gradient-to-l from-neutral-50 via-neutral-50 to-transparent dark:from-neutral-900 dark:via-neutral-900 pl-6">
                                        <button
                                            onClick={() => setShowEmptyBeans(!showEmptyBeans)}
                                            className={`pb-1.5 text-[11px] whitespace-nowrap relative ${showEmptyBeans ? 'text-neutral-800 dark:text-neutral-100 font-normal' : 'text-neutral-600 dark:text-neutral-400'}`}
                                        >
                                            <span className="relative">已用完</span>
                                            {showEmptyBeans && (
                                                <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 榜单标签筛选 - 在榜单和博主榜单视图中显示 */}
                    {(viewMode === VIEW_OPTIONS.RANKING || viewMode === VIEW_OPTIONS.BLOGGER) && (
                        <div className="mb-1">
                            {/* 豆子筛选选项卡 */}
                            <div className="flex justify-between border-b px-6 border-neutral-200 dark:border-neutral-800">
                                <div className="flex">
                                    <button
                                        className={`pb-1.5 mr-3 text-[11px] relative ${rankingBeanType === 'all' ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                        onClick={() => setRankingBeanType('all')}
                                    >
                                        <span className="relative">全部豆子</span>
                                        {rankingBeanType === 'all' && (
                                            <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                        )}
                                    </button>
                                    <button
                                        className={`pb-1.5 mx-3 text-[11px] relative ${rankingBeanType === 'espresso' ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                        onClick={() => setRankingBeanType('espresso')}
                                    >
                                        <span className="relative">意式豆</span>
                                        {rankingBeanType === 'espresso' && (
                                            <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                        )}
                                    </button>
                                    <button
                                        className={`pb-1.5 mx-3 text-[11px] relative ${rankingBeanType === 'filter' ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                        onClick={() => setRankingBeanType('filter')}
                                    >
                                        <span className="relative">手冲豆</span>
                                        {rankingBeanType === 'filter' && (
                                            <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                        )}
                                    </button>
                                </div>

                                <div className="flex items-center">
                                    {/* Year selector - Only in Blogger view */}
                                    {viewMode === VIEW_OPTIONS.BLOGGER && (
                                        <div className="flex items-center ml-3">
                                            <button
                                                onClick={() => setBloggerYear(2025)}
                                                className={`pb-1.5 mx-3 text-[11px] relative ${bloggerYear === 2025 ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                            >
                                                <span className="relative">2025</span>
                                                {bloggerYear === 2025 && (
                                                    <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => setBloggerYear(2024)}
                                                className={`pb-1.5 ml-3 text-[11px] relative ${bloggerYear === 2024 ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                            >
                                                <span className="relative">2024</span>
                                                {bloggerYear === 2024 && (
                                                    <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {/* Edit button - Only in personal Ranking view */}
                                    {viewMode === VIEW_OPTIONS.RANKING && (
                                        <button
                                            onClick={() => setRankingEditMode(!rankingEditMode)}
                                            className={`pb-1.5 text-[11px] relative ${rankingEditMode ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}
                                        >
                                            <span className="relative">{rankingEditMode ? '完成' : '编辑'}</span>
                                            {rankingEditMode && (
                                                <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* 内容区域：根据视图模式显示不同内容 */}
                <div className="flex-1 overflow-hidden">
                    {viewMode === VIEW_OPTIONS.INVENTORY ? (
                        // 库存视图
                        <div
                            className="w-full h-full overflow-y-auto scroll-with-bottom-bar"
                        >
                            {/* 咖啡豆列表 */}
                            {filteredBeans.length === 0 ? (
                                <div
                                    className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400"
                                >
                                    {selectedVariety ?
                                        `[ 没有${selectedVariety}品种的咖啡豆 ]` :
                                        beans.length > 0 ?
                                            (showEmptyBeans ? '[ 暂无咖啡豆 ]' : '[ 所有咖啡豆已用完，点击"已用完"查看 ]') :
                                            '[ 暂无咖啡豆 ]'
                                    }
                                </div>
                            ) : (
                                <div className="pb-20">
                                    {filteredBeans.map((bean, index) => {
                                        return (
                                            <div
                                                key={bean.id}
                                                className={`group  space-y-3 px-6 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900/70 ${index === filteredBeans.length - 1 ? '' : 'border-b border-neutral-200 dark:border-neutral-800'} ${isBeanEmpty(bean)
                                                    ? 'bg-neutral-100/60 dark:bg-neutral-800/30'
                                                    : ''
                                                    }`}
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
                                                            <div className="flex justify-between items-start">
                                                                <div className="flex-1 min-w-0 overflow-hidden">
                                                                    <div className="text-[11px] font-normal break-words text-neutral-800 dark:text-neutral-100 pr-2">
                                                                        {beanTitles[bean.id]}
                                                                    </div>
                                                                    {isBeanEmpty(bean) && (
                                                                        <div className="text-[10px] font-normal px-1.5 py-0.5 mt-1 inline-block rounded-full bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300 shrink-0">
                                                                            已用完
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex-shrink-0 ml-1 relative">
                                                                    <ActionMenu
                                                                        items={[
                                                                            {
                                                                                id: 'edit',
                                                                                label: '编辑',
                                                                                onClick: () => handleEdit(bean)
                                                                            },
                                                                            {
                                                                                id: 'share',
                                                                                label: '分享',
                                                                                onClick: () => handleShare(bean)
                                                                            },
                                                                            {
                                                                                id: 'delete',
                                                                                label: '删除',
                                                                                color: 'danger',
                                                                                onClick: () => handleDelete(bean)
                                                                            }
                                                                        ]}
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400 break-words">
                                                                {bean.type === '拼配' && bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0 && (
                                                                    <>
                                                                        {bean.blendComponents.map((component, idx) => {
                                                                            // 确保component是有效对象
                                                                            if (!component || typeof component !== 'object') {
                                                                                return null;
                                                                            }
                                                                            
                                                                            // 使用类型断言处理可能的类型不匹配
                                                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                                            const comp = component as any; // 使用any处理不同文件中的BlendComponent类型定义可能不一致的问题
                                                                            
                                                                            // 获取组件内容
                                                                            const componentContent = [
                                                                                comp.origin || '',
                                                                                comp.process || '',
                                                                                comp.variety || ''
                                                                            ].filter(Boolean).join('');
                                                                            
                                                                            // 检查是否有百分比
                                                                            const hasPercentage = comp.percentage !== undefined && 
                                                                                               comp.percentage !== null && 
                                                                                               comp.percentage !== "";
                                                                            
                                                                            return (
                                                                                <React.Fragment key={idx}>
                                                                                    {idx > 0 && <span className="opacity-50 mx-1">·</span>}
                                                                                    <span>
                                                                                        {componentContent}
                                                                                        {hasPercentage && ` (${comp.percentage}%)`}
                                                                                    </span>
                                                                                </React.Fragment>
                                                                            );
                                                                        })}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-x-4">
                                                        {/* 剩余量进度条 - 仅当capacity和remaining都存在时显示 */}
                                                        {bean.capacity && bean.remaining && (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                                                        剩余量
                                                                    </div>
                                                                    <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                                                        <span 
                                                                            className="cursor-pointer border-dashed border-b border-neutral-400 dark:border-neutral-600 transition-colors"
                                                                            onClick={(e) => handleRemainingClick(bean, e)}
                                                                        >
                                                                            {bean.remaining}g
                                                                        </span>
                                                                        {" / "}
                                                                        {bean.capacity}g
                                                                    </div>
                                                                </div>
                                                                <div
                                                                    className="h-px w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800"
                                                                >
                                                                    <div
                                                                        style={{ 
                                                                            width: `${(parseFloat(bean.remaining.replace('g', '')) / parseFloat(bean.capacity.replace('g', ''))) * 100}%` 
                                                                        }}
                                                                        className="h-full bg-neutral-800 dark:bg-neutral-100"
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* 赏味期进度条 - 仅当roastDate存在时显示 */}
                                                        {bean.roastDate && (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
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

                                                                        let status = '';
                                                                        if (daysSinceRoast < startDay) {
                                                                            status = `养豆期剩余 ${startDay - daysSinceRoast}天`;
                                                                        } else if (daysSinceRoast <= endDay) {
                                                                            status = `赏味期剩余 ${endDay - daysSinceRoast}天`;
                                                                        } else {
                                                                            status = '已衰退';
                                                                        }

                                                                        return (
                                                                            <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                                                                {status}
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </div>
                                                                <div className="h-px w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800 relative">
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

                                                                        // 计算各区间宽度百分比
                                                                        const preFlavorPercent = (startDay / endDay) * 100;
                                                                        const flavorPercent = ((endDay - startDay) / endDay) * 100;
                                                                        const progressPercent = Math.min((daysSinceRoast / endDay) * 100, 100);

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
                                                                                {/* 养豆期区间 */}
                                                                                <div
                                                                                    className="absolute h-full bg-neutral-400/10 dark:bg-neutral-400/10"
                                                                                    style={{
                                                                                        left: '0%',
                                                                                        width: `${preFlavorPercent}%`
                                                                                    }}
                                                                                ></div>

                                                                                {/* 赏味期区间（带纹理） */}
                                                                                <div
                                                                                    className="absolute h-full bg-green-500/20 dark:bg-green-600/30"
                                                                                    style={{
                                                                                        left: `${preFlavorPercent}%`,
                                                                                        width: `${flavorPercent}%`,
                                                                                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0, 0, 0, 0.1) 2px, rgba(0, 0, 0, 0.1) 4px)'
                                                                                    }}
                                                                                ></div>

                                                                                {/* 进度指示 */}
                                                                                <div
                                                                                    className={`absolute h-full ${fillColor}`}
                                                                                    style={{
                                                                                        zIndex: 10,
                                                                                        width: `${progressPercent}%`
                                                                                    }}
                                                                                ></div>
                                                                            </>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* 风味标签 - 改进显示 */}
                                                    {bean.flavor && bean.flavor.length > 0 && (
                                                        <div className="flex flex-wrap gap-1">
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
                                                    <div className="flex items-baseline justify-between text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400 ">
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
                                                        <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                                            {bean.notes}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        // 榜单和博主榜单视图
                        <div
                            className="w-full h-full overflow-y-auto scroll-with-bottom-bar"
                        >
                            <CoffeeBeanRanking
                                isOpen={viewMode === VIEW_OPTIONS.RANKING || viewMode === VIEW_OPTIONS.BLOGGER}
                                onShowRatingForm={handleShowRatingForm}
                                sortOption={convertToRankingSortOption(sortOption, viewMode)}
                                updatedBeanId={lastRatedBeanId}
                                hideFilters={true}
                                beanType={rankingBeanType}
                                editMode={rankingEditMode}
                                viewMode={viewMode === VIEW_OPTIONS.BLOGGER ? 'blogger' : 'personal'}
                                year={viewMode === VIEW_OPTIONS.BLOGGER ? bloggerYear : undefined} // Pass year to Ranking component
                            />
                        </div>
                    )}
                </div>

                {/* 添加和导入按钮 - 仅在仓库视图显示 */}
                {viewMode === VIEW_OPTIONS.INVENTORY && (
                    <BottomActionBar
                        buttons={[
                            {
                                icon: '+',
                                text: '添加咖啡豆',
                                onClick: () => {
                                    if (showBeanForm) {
                                        showBeanForm(null);
                                    } else {
                                        setShowAddForm(true);
                                    }
                                },
                                highlight: true
                            },
                            {
                                icon: '↓',
                                text: '导入咖啡豆',
                                onClick: () => {
                                    if (onShowImport) onShowImport();
                                },
                                highlight: true
                            }
                        ]}
                    />
                )}
            </div>
            <CopyFailureModal
                isOpen={showFailureModal}
                onClose={closeFailureModal}
                content={failureContent || ""}
            />

            {/* 剩余量编辑弹出层 */}
            <AnimatePresence>
                {editingRemaining && editingRemaining.position && (
                    <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.15 }}
                        className="fixed z-50 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 p-2"
                        style={{ 
                            left: `${editingRemaining.position.x}px`,
                            top: `${editingRemaining.position.y + 5}px`,
                            transform: 'translateX(-50%)'
                        }}
                    >
                        <div className="flex flex-col space-y-2">
                            <div className="flex items-center">
                                <input
                                    ref={remainingInputRef}
                                    type="number"
                                    className="w-16 text-sm bg-transparent border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 text-neutral-800 dark:text-neutral-100 outline-none focus:border-neutral-400 dark:focus:border-neutral-500"
                                    value={editingRemaining.value}
                                    min="0"
                                    onChange={(e) => setEditingRemaining(prev => 
                                        prev ? { ...prev, value: e.target.value } : null
                                    )}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleRemainingUpdate();
                                        } else if (e.key === 'Escape') {
                                            e.preventDefault();
                                            handleRemainingCancel();
                                        }
                                    }}
                                />
                                <span className="text-sm flex items-center ml-1 text-neutral-800 dark:text-neutral-100">g</span>
                                <div className="flex ml-2">
                                    <button 
                                        className="text-sm text-white bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-800 rounded px-2 py-1 ml-1"
                                        onClick={handleRemainingUpdate}
                                    >
                                        确定
                                    </button>
                                </div>
                            </div>
                            
                            {/* 快捷按钮组 */}
                            <div className="flex space-x-1 pt-1">
                                <button
                                    className="flex-1 text-[10px] bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-200 rounded py-1 transition-colors"
                                    onClick={() => handleQuickDecrement(15)}
                                >
                                    -15
                                </button>
                                <button
                                    className="flex-1 text-[10px] bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-200 rounded py-1 transition-colors"
                                    onClick={() => handleQuickDecrement(16)}
                                >
                                    -16
                                </button>
                                <button
                                    className="flex-1 text-[10px] bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-200 rounded py-1 transition-colors"
                                    onClick={() => handleQuickDecrement(18)}
                                >
                                    -18
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}

export default CoffeeBeans