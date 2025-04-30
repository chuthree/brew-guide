'use client'

import React, { useState, useEffect, useRef } from 'react'
import { CoffeeBeanManager } from '@/lib/coffeeBeanManager'
import CoffeeBeanFormModal from '@/components/CoffeeBean/Form/Modal'
import CoffeeBeanRatingModal from '../Rating/Modal'
import _CoffeeBeanRanking from '../Ranking'
import { getBloggerBeans } from '@/lib/csvUtils'
import BottomActionBar from '@/components/BottomActionBar'
import { useCopy } from "@/lib/hooks/useCopy"
import CopyFailureModal from "../ui/copy-failure-modal"
import { type SortOption, sortBeans, convertToRankingSortOption as _convertToRankingSortOption } from './SortSelector'

// 导入新创建的组件和类型
import { 
    ExtendedCoffeeBean, 
    CoffeeBeansProps, 
    BeanType, 
    BloggerBeansYear,
    VIEW_OPTIONS, 
    ViewOption 
} from './types'
import { 
    globalCache, 
    saveShowEmptyBeansPreference, 
    saveSelectedVarietyPreference, 
    saveSelectedBeanTypePreference, 
    saveViewModePreference, 
    saveSortOptionPreference, 
    saveInventorySortOptionPreference,
    saveRankingSortOptionPreference,
    saveBloggerSortOptionPreference,
    saveRankingBeanTypePreference,
    saveRankingEditModePreference,
    saveBloggerYearPreference,
    isBeanEmpty 
} from './globalCache'
import { useBeanOperations } from './hooks/useBeanOperations'
import ViewSwitcher from './components/ViewSwitcher'
import InventoryView from './components/InventoryView'
import StatsView from './components/StatsView'

// 重命名导入组件以避免混淆
const CoffeeBeanRanking = _CoffeeBeanRanking;
// 重命名函数以避免混淆
const convertToRankingSortOption = _convertToRankingSortOption;

// 添加全局缓存中的beanType属性
globalCache.selectedBeanType = globalCache.selectedBeanType || 'all';

const CoffeeBeans: React.FC<CoffeeBeansProps> = ({ isOpen, showBeanForm, onShowImport }) => {
    const { copyText, showFailureModal, failureContent, closeFailureModal } = useCopy()
    
    // 基础状态
    const [beans, setBeans] = useState<ExtendedCoffeeBean[]>(globalCache.beans)
    const [_ratedBeans, setRatedBeans] = useState<ExtendedCoffeeBean[]>(globalCache.ratedBeans)
    const [showAddForm, setShowAddForm] = useState(false)
    const [editingBean, setEditingBean] = useState<ExtendedCoffeeBean | null>(null)
    const [sortOption, setSortOption] = useState<SortOption>(globalCache.sortOption)
    // 视图特定的排序选项
    const [inventorySortOption, setInventorySortOption] = useState<SortOption>(globalCache.inventorySortOption)
    const [rankingSortOption, setRankingSortOption] = useState<SortOption>(globalCache.rankingSortOption)
    const [bloggerSortOption, setBloggerSortOption] = useState<SortOption>(globalCache.bloggerSortOption)
    const [viewMode, setViewMode] = useState<ViewOption>(globalCache.viewMode)
    
    // 评分相关状态
    const [showRatingModal, setShowRatingModal] = useState(false)
    const [selectedBeanForRating, setSelectedBeanForRating] = useState<ExtendedCoffeeBean | null>(null)
    const [lastRatedBeanId, setLastRatedBeanId] = useState<string | null>(null)
    const [ratingSavedCallback, setRatingSavedCallback] = useState<(() => void) | null>(null)
    
    // 过滤和显示控制状态
    const [availableVarieties, setAvailableVarieties] = useState<string[]>(globalCache.varieties)
    const [selectedVariety, setSelectedVariety] = useState<string | null>(globalCache.selectedVariety)
    const [selectedBeanType, setSelectedBeanType] = useState<BeanType>(globalCache.selectedBeanType)
    const [filteredBeans, setFilteredBeans] = useState<ExtendedCoffeeBean[]>(globalCache.filteredBeans)
    const [showEmptyBeans, setShowEmptyBeans] = useState<boolean>(globalCache.showEmptyBeans)
    
    // 榜单视图状态
    const [rankingBeanType, setRankingBeanType] = useState<BeanType>(globalCache.rankingBeanType)
    const [rankingEditMode, setRankingEditMode] = useState<boolean>(globalCache.rankingEditMode)
    const [bloggerYear, setBloggerYear] = useState<BloggerBeansYear>(globalCache.bloggerYear)
    
    // 辅助引用和状态
    const [_isFirstLoad, setIsFirstLoad] = useState<boolean>(!globalCache.initialized)
    const unmountTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const isLoadingRef = useRef<boolean>(false)
    const containerRef = React.useRef<HTMLDivElement>(null)
    
    // 使用自定义钩子处理咖啡豆操作
    const {
        forceRefreshKey,
        handleSaveBean,
        handleDelete,
        handleSaveRating,
        handleRemainingUpdate: baseHandleRemainingUpdate,
        handleQuickDecrement: baseHandleQuickDecrement,
        handleShare
    } = useBeanOperations()

    // 使用类型包装函数解决类型不匹配问题
    const handleRemainingUpdate = async (beanId: string, value: string): Promise<{ success: boolean, value?: string, error?: Error }> => {
        try {
            const result = await baseHandleRemainingUpdate(beanId, value);
            return {
                success: result.success,
                value: result.value,
                error: result.error ? new Error(String(result.error)) : undefined
            };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
        }
    };

    const handleQuickDecrement = async (
        beanId: string, 
        currentValue: string, 
        decrementAmount: number
    ): Promise<{ success: boolean, value?: string, reducedToZero?: boolean, error?: Error }> => {
        try {
            const result = await baseHandleQuickDecrement(beanId, currentValue, decrementAmount);
            return {
                success: result.success,
                value: result.value,
                reducedToZero: result.reducedToZero,
                error: result.error ? new Error(String(result.error)) : undefined
            };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
        }
    };

    // 更新过滤后的豆子和分类
    const updateFilteredBeansAndCategories = React.useCallback((beansToSort: ExtendedCoffeeBean[]) => {
        // 先根据豆子类型过滤
        let typeFilteredBeans = beansToSort;
        if (selectedBeanType && selectedBeanType !== 'all') {
            // 常规豆子类型筛选
            typeFilteredBeans = beansToSort.filter(bean => bean.beanType === selectedBeanType);
        }
        
        // 然后根据是否显示已用完的豆子过滤用于提取品种的豆子
        let beansForVarieties = typeFilteredBeans;
        if (!showEmptyBeans) {
            beansForVarieties = typeFilteredBeans.filter(bean => !isBeanEmpty(bean));
        }
        
        // 从过滤后的豆子中提取可用的品种列表
        const varieties = beansForVarieties.reduce((acc, bean) => {
            if (bean.variety && !acc.includes(bean.variety)) {
                acc.push(bean.variety);
            }
            
            // 从拼配豆中提取品种
            if (bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
                bean.blendComponents.forEach(component => {
                    if (component.variety && !acc.includes(component.variety)) {
                        acc.push(component.variety);
                    }
                });
            }
            
            return acc;
        }, [] as string[]);
        
        // 再根据选择的品种过滤豆子
        let filtered = typeFilteredBeans;
        if (selectedVariety) {
            filtered = filtered.filter(bean => {
                // 如果选择的是"拼配豆"分类
                if (selectedVariety === '拼配豆') {
                    return bean.blendComponents && bean.blendComponents.length > 1;
                }
                
                // 检查拼配豆中是否包含所选品种
                if (bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
                    return bean.blendComponents.some(component => component.variety === selectedVariety);
                }
                
                // 常规品种筛选
                return (bean.variety || '未分类') === selectedVariety;
            });
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
    }, [selectedVariety, showEmptyBeans, selectedBeanType]);

    // 加载咖啡豆数据
    const loadBeans = React.useCallback(async () => {
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
            
            setIsFirstLoad(false);
        } catch (error) {
            console.error("加载咖啡豆数据失败:", error);
            setIsFirstLoad(false);
        } finally {
            isLoadingRef.current = false;
        }
    }, [updateFilteredBeansAndCategories]);

    // 加载已评分的咖啡豆
    const loadRatedBeans = React.useCallback(async () => {
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
    const loadBloggerBeans = React.useCallback(async () => {
        if (viewMode !== VIEW_OPTIONS.BLOGGER) return;
        
        try {
            // 直接调用csvUtils中的函数，传入选定的年份
            const bloggerBeansData = getBloggerBeans(rankingBeanType, bloggerYear);
            
            // 更新全局缓存中指定年份的数据
            globalCache.bloggerBeans[bloggerYear] = bloggerBeansData;
        } catch (error) {
            console.error(`加载博主榜单咖啡豆 (${bloggerYear}) 失败:`, error);
        }
    }, [viewMode, rankingBeanType, bloggerYear]);

    // 强制刷新时重新加载数据
    useEffect(() => {
        if (isOpen) {
            loadBeans();
        }
    }, [forceRefreshKey, loadBeans, isOpen]);

    // 监听咖啡豆更新事件
    useEffect(() => {
        const handleBeansUpdated = () => loadBeans();
        
        window.addEventListener('coffeeBeansUpdated', handleBeansUpdated);
        window.addEventListener('coffeeBeanListChanged', handleBeansUpdated);
        
        return () => {
            window.removeEventListener('coffeeBeansUpdated', handleBeansUpdated);
            window.removeEventListener('coffeeBeanListChanged', handleBeansUpdated);
        };
    }, [loadBeans]);

    // 清理unmountTimeout
    useEffect(() => {
        return () => {
            if (unmountTimeoutRef.current) {
                clearTimeout(unmountTimeoutRef.current);
                unmountTimeoutRef.current = null;
            }
        };
    }, []);

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
            loadBloggerBeans();
        } else {
            // 组件关闭时，不立即清空状态，延迟重置
            unmountTimeoutRef.current = setTimeout(() => {
                // 不执行任何操作，状态保持不变
            }, 5000); // 5秒后再考虑重置
        }
    }, [isOpen, sortOption, selectedVariety, loadBeans, loadRatedBeans, loadBloggerBeans, rankingBeanType, bloggerYear]);

    // 在视图切换时更新数据
    useEffect(() => {
        if (viewMode === VIEW_OPTIONS.BLOGGER) {
            loadBloggerBeans();
        } else if (viewMode === VIEW_OPTIONS.RANKING) {
            loadRatedBeans();
        }
    }, [viewMode, loadBloggerBeans, loadRatedBeans]);

    // 当显示空豆子设置改变时更新过滤和全局缓存
    useEffect(() => {
        if (globalCache.initialized) {
            // 更新全局缓存
            globalCache.showEmptyBeans = showEmptyBeans;
            // 持久化到localStorage
            saveShowEmptyBeansPreference(showEmptyBeans);
            updateFilteredBeansAndCategories(globalCache.beans);
        }
    }, [showEmptyBeans, selectedVariety, updateFilteredBeansAndCategories]);

    // 视图切换时更新排序选项
    useEffect(() => {
        if (globalCache.initialized) {
            // 根据视图模式选择对应的排序选项
            let newSortOption: SortOption;
            
            switch (viewMode) {
                case VIEW_OPTIONS.INVENTORY:
                    newSortOption = inventorySortOption;
                    break;
                case VIEW_OPTIONS.RANKING:
                    newSortOption = rankingSortOption;
                    break;
                case VIEW_OPTIONS.BLOGGER:
                    newSortOption = bloggerSortOption;
                    break;
                default:
                    newSortOption = inventorySortOption;
            }
            
            // 更新全局排序选项状态
            setSortOption(newSortOption);
            globalCache.sortOption = newSortOption;
            saveSortOptionPreference(newSortOption);
            
            // 保存视图模式到本地存储
            globalCache.viewMode = viewMode;
            saveViewModePreference(viewMode);
        }
    }, [viewMode, inventorySortOption, rankingSortOption, bloggerSortOption]);

    // 当排序选项改变时更新数据
    useEffect(() => {
        if (viewMode === VIEW_OPTIONS.INVENTORY) {
            // 仓库视图：直接使用本地排序
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
                price: bean.price,
                type: bean.type
            }));
            const sortedBeans = sortBeans(compatibleBeans, sortOption);
            
            // 保持原始引用以维护其他属性
            const resultBeans = beans.slice();
            
            // 按照排序后的顺序重新排列原始beans数组
            for (let i = 0; i < sortedBeans.length; i++) {
                const sortedBean = sortedBeans[i];
                const originalIndex = beans.findIndex(b => b.id === sortedBean.id);
                if (originalIndex !== -1) {
                    resultBeans[i] = beans[originalIndex];
                }
            }
            
            updateFilteredBeansAndCategories(resultBeans);
        }
    }, [sortOption, viewMode, beans, updateFilteredBeansAndCategories]);

    // 处理品种标签点击
    const handleVarietyClick = (variety: string | null) => {
        setSelectedVariety(variety);
        // 更新全局缓存并保存到本地存储
        globalCache.selectedVariety = variety;
        saveSelectedVarietyPreference(variety);
        
        // 先根据豆子类型过滤
        let typeFilteredBeans = beans;
        if (selectedBeanType && selectedBeanType !== 'all') {
            // 常规豆子类型筛选
            typeFilteredBeans = beans.filter(bean => bean.beanType === selectedBeanType);
        }
        
        // 再根据品种过滤
        let filtered = typeFilteredBeans;
        if (variety) {
            filtered = filtered.filter(bean => {
                // 如果选择的是"拼配豆"分类
                if (variety === '拼配豆') {
                    return bean.blendComponents && bean.blendComponents.length > 1;
                }
                
                // 检查拼配豆中是否包含所选品种
                if (bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
                    return bean.blendComponents.some(component => component.variety === variety);
                }
                
                // 常规品种筛选
                return (bean.variety || '未分类') === variety;
            });
        }
        
        // 根据"显示已用完"设置过滤
        if (!showEmptyBeans) {
            filtered = filtered.filter(bean => !isBeanEmpty(bean));
        }
        
        globalCache.filteredBeans = filtered;
        setFilteredBeans(filtered);
    };

    // 处理豆子类型点击
    const handleBeanTypeChange = (beanType: BeanType) => {
        // 如果点击已选中的类型，则重置为全部
        const newBeanType = beanType === selectedBeanType ? 'all' : beanType;
        
        setSelectedBeanType(newBeanType);
        // 更新全局缓存并保存到本地存储
        globalCache.selectedBeanType = newBeanType;
        saveSelectedBeanTypePreference(newBeanType);
        
        // 根据新选择的豆子类型过滤
        let typeFilteredBeans = beans;
        if (newBeanType !== 'all') {
            // 常规豆子类型筛选
            typeFilteredBeans = beans.filter(bean => bean.beanType === newBeanType);
        }
        
        // 再根据选择的品种过滤
        let filtered = typeFilteredBeans;
        if (selectedVariety) {
            filtered = filtered.filter(bean => {
                // 如果选择的是"拼配豆"分类
                if (selectedVariety === '拼配豆') {
                    return bean.blendComponents && bean.blendComponents.length > 1;
                }
                
                // 检查拼配豆中是否包含所选品种
                if (bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
                    return bean.blendComponents.some(component => component.variety === selectedVariety);
                }
                
                // 常规品种筛选
                return (bean.variety || '未分类') === selectedVariety;
            });
        }
        
        // 根据"显示已用完"设置过滤
        if (!showEmptyBeans) {
            filtered = filtered.filter(bean => !isBeanEmpty(bean));
        }
        
        // 更新品种列表 - 切换豆子类型后需要重新计算可用品种
        // 只有未用完的豆子才会被用于计算可用品种，除非showEmptyBeans为true
        let beansForVarieties = typeFilteredBeans;
        if (!showEmptyBeans) {
            beansForVarieties = typeFilteredBeans.filter(bean => !isBeanEmpty(bean));
        }
        
        // 从过滤后的豆子中提取可用的品种列表
        const varieties = beansForVarieties.reduce((acc, bean) => {
            if (bean.variety && !acc.includes(bean.variety)) {
                acc.push(bean.variety);
            }
            
            // 从拼配豆中提取品种
            if (bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
                bean.blendComponents.forEach(component => {
                    if (component.variety && !acc.includes(component.variety)) {
                        acc.push(component.variety);
                    }
                });
            }
            
            return acc;
        }, [] as string[]);
        
        setAvailableVarieties(varieties);
        globalCache.varieties = varieties;
        globalCache.filteredBeans = filtered;
        setFilteredBeans(filtered);
    };

    // 处理编辑咖啡豆
    const handleEdit = (bean: ExtendedCoffeeBean) => {
        try {
            if (showBeanForm) {
                showBeanForm(bean);
            } else {
                setEditingBean(bean);
            }
        } catch (_error) {
            alert('编辑咖啡豆时出错，请重试');
        }
    };

    // 处理咖啡豆表单保存
    const handleFormSave = async (bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>) => {
        try {
            const result = await handleSaveBean(bean, editingBean);
            if (result.success) {
                setShowAddForm(false);
                setEditingBean(null);
            } else {
                alert('保存失败，请重试');
            }
        } catch (error) {
            console.error('保存咖啡豆失败:', error);
            alert('保存失败，请重试');
        }
    };

    // 用于打开评分表单的处理函数
    const handleShowRatingForm = (bean: ExtendedCoffeeBean, onRatingSaved?: () => void) => {
        setSelectedBeanForRating(bean);
        setShowRatingModal(true);
        
        // 如果提供了回调函数，存储它
        if (onRatingSaved) {
            setRatingSavedCallback(() => onRatingSaved);
        }
    };

    // 处理评分保存
    const handleRatingSave = async (id: string, ratings: Partial<ExtendedCoffeeBean>) => {
        try {
            const result = await handleSaveRating(id, ratings);
            if (result.success) {
                // 记录最近评分的咖啡豆ID
                setLastRatedBeanId(id);
                
                // 自动切换到榜单视图
                setViewMode(VIEW_OPTIONS.RANKING);
                
                // 清除标记
                setTimeout(() => {
                    setLastRatedBeanId(null);
                }, 2000);
                
                return result.bean;
            }
            return null;
        } catch (error) {
            alert("保存评分失败，请重试");
            throw error;
        }
    };

    // 计算可用容量和总重量
    const calculateTotalWeight = () => {
        const totalWeight = filteredBeans
            .filter(bean => bean.remaining && parseFloat(bean.remaining) > 0)
            .reduce((sum, bean) => sum + parseFloat(bean.remaining || '0'), 0);
        
        if (totalWeight < 1000) {
            return `${Math.round(totalWeight)} g`;
        } else {
            return `${(totalWeight / 1000).toFixed(2)} kg`;
        }
    };

    // 切换显示空豆子状态
    const toggleShowEmptyBeans = () => {
        const newShowEmptyBeans = !showEmptyBeans;
        setShowEmptyBeans(newShowEmptyBeans);
        // 更新全局缓存并保存到本地存储
        globalCache.showEmptyBeans = newShowEmptyBeans;
        saveShowEmptyBeansPreference(newShowEmptyBeans);
        
        // 根据豆子类型过滤
        let typeFilteredBeans = beans;
        if (selectedBeanType && selectedBeanType !== 'all') {
            // 常规豆子类型筛选
            typeFilteredBeans = beans.filter(bean => bean.beanType === selectedBeanType);
        }
        
        // 再根据品种过滤
        let filtered = typeFilteredBeans;
        if (selectedVariety) {
            filtered = filtered.filter(bean => {
                // 如果选择的是"拼配豆"分类
                if (selectedVariety === '拼配豆') {
                    return bean.blendComponents && bean.blendComponents.length > 1;
                }
                
                // 检查拼配豆中是否包含所选品种
                if (bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
                    return bean.blendComponents.some(component => component.variety === selectedVariety);
                }
                
                // 常规品种筛选
                return (bean.variety || '未分类') === selectedVariety;
            });
        }
        
        // 根据新的"显示已用完"设置过滤
        if (!newShowEmptyBeans) {
            filtered = filtered.filter(bean => !isBeanEmpty(bean));
        }
        
        // 更新品种列表 - 切换显示空豆子状态后需要重新计算可用品种
        let beansForVarieties = typeFilteredBeans;
        if (!newShowEmptyBeans) {
            beansForVarieties = typeFilteredBeans.filter(bean => !isBeanEmpty(bean));
        }
        
        // 从过滤后的豆子中提取可用的品种列表
        const varieties = beansForVarieties.reduce((acc, bean) => {
            if (bean.variety && !acc.includes(bean.variety)) {
                acc.push(bean.variety);
            }
            
            // 从拼配豆中提取品种
            if (bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
                bean.blendComponents.forEach(component => {
                    if (component.variety && !acc.includes(component.variety)) {
                        acc.push(component.variety);
                    }
                });
            }
            
            return acc;
        }, [] as string[]);
        
        setAvailableVarieties(varieties);
        globalCache.varieties = varieties;
        globalCache.filteredBeans = filtered;
        setFilteredBeans(filtered);
    };

    // 当榜单豆子类型变更时更新数据
    useEffect(() => {
        if (globalCache.initialized) {
            if (viewMode === VIEW_OPTIONS.RANKING) {
                loadRatedBeans();
            } else if (viewMode === VIEW_OPTIONS.BLOGGER) {
                loadBloggerBeans();
            }
        }
    }, [rankingBeanType, loadRatedBeans, loadBloggerBeans, viewMode]);

    // 当博主榜单年份变更时更新数据
    useEffect(() => {
        if (globalCache.initialized && viewMode === VIEW_OPTIONS.BLOGGER) {
            loadBloggerBeans();
        }
    }, [bloggerYear, loadBloggerBeans, viewMode]);

    // 组件加载后初始化各视图的排序选项
    useEffect(() => {
        if (isOpen && !isLoadingRef.current) {
            // 初始化时根据当前视图设置全局排序选项
            let currentSortOption: SortOption;
            
            switch (viewMode) {
                case VIEW_OPTIONS.INVENTORY:
                    currentSortOption = inventorySortOption;
                    break;
                case VIEW_OPTIONS.RANKING:
                    currentSortOption = rankingSortOption;
                    break;
                case VIEW_OPTIONS.BLOGGER:
                    currentSortOption = bloggerSortOption;
                    break;
                default:
                    currentSortOption = inventorySortOption;
            }
            
            // 设置当前排序选项
            setSortOption(currentSortOption);
            globalCache.sortOption = currentSortOption;
        }
    }, [isOpen, viewMode, inventorySortOption, rankingSortOption, bloggerSortOption]);

    // 添加搜索状态
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // 搜索过滤逻辑
    const searchFilteredBeans = React.useMemo(() => {
        if (!searchQuery.trim() || !isSearching) return filteredBeans;
        
        const query = searchQuery.toLowerCase().trim();
        return filteredBeans.filter(bean => {
            // 基本信息搜索
            const name = bean.name?.toLowerCase() || '';
            const origin = bean.origin?.toLowerCase() || '';
            const process = bean.process?.toLowerCase() || '';
            const variety = bean.variety?.toLowerCase() || '';
            const notes = bean.notes?.toLowerCase() || '';
            
            // 额外信息搜索
            const roastLevel = bean.roastLevel?.toLowerCase() || '';
            const roastDate = bean.roastDate?.toLowerCase() || '';
            const price = bean.price?.toLowerCase() || '';
            const beanType = bean.beanType?.toLowerCase() || '';
            
            // 风味标签搜索 - 将数组转换为字符串进行搜索
            const flavors = bean.flavor?.join(' ').toLowerCase() || '';
            
            // 拼配组件搜索
            const blendComponentsText = bean.blendComponents?.map(comp => 
                `${comp.percentage || ''} ${comp.origin || ''} ${comp.process || ''} ${comp.variety || ''}`
            ).join(' ').toLowerCase() || '';
            
            // 计量信息搜索
            const capacity = bean.capacity?.toLowerCase() || '';
            const remaining = bean.remaining?.toLowerCase() || '';
            
            // 赏味期搜索 - 将赏味期信息转换为可搜索的文本
            const flavorPeriod = `${bean.startDay || ''} ${bean.endDay || ''}`.toLowerCase();
            
            // 合并所有可搜索文本
            return name.includes(query) || 
                origin.includes(query) || 
                process.includes(query) || 
                variety.includes(query) || 
                notes.includes(query) ||
                roastLevel.includes(query) ||
                roastDate.includes(query) ||
                price.includes(query) ||
                beanType.includes(query) ||
                flavors.includes(query) ||
                blendComponentsText.includes(query) ||
                capacity.includes(query) ||
                remaining.includes(query) ||
                flavorPeriod.includes(query);
        });
    }, [filteredBeans, searchQuery, isSearching]);

    if (!isOpen) return null;

    return (
        <>
            {/* 咖啡豆表单弹出框 */}
            <CoffeeBeanFormModal
                showForm={showAddForm || editingBean !== null}
                initialBean={editingBean || undefined}
                onSave={handleFormSave}
                onClose={() => {
                    setShowAddForm(false);
                    setEditingBean(null);
                }}
            />

            {/* 咖啡豆评分表单 */}
            <CoffeeBeanRatingModal
                showModal={showRatingModal}
                coffeeBean={selectedBeanForRating}
                onClose={() => setShowRatingModal(false)}
                onSave={handleRatingSave}
                onAfterSave={() => {
                    // 强制刷新榜单数据
                    loadRatedBeans();
                    // 关闭评分模态框
                    setShowRatingModal(false);
                    // 调用存储的回调函数
                    if (ratingSavedCallback) {
                        ratingSavedCallback();
                        setRatingSavedCallback(null);
                    }
                }}
            />

            <div className={`relative flex flex-col h-full ${isOpen ? 'block' : 'hidden'}`}>
                <div className="w-full" ref={containerRef}>
                    <ViewSwitcher
                        viewMode={viewMode}
                        onViewChange={(newViewMode) => {
                            setViewMode(newViewMode);
                            // 视图模式的保存在effect中处理
                        }}
                        sortOption={sortOption}
                        onSortChange={(newSortOption) => {
                            // 根据当前视图类型保存对应的排序选项
                            switch (viewMode) {
                                case VIEW_OPTIONS.INVENTORY:
                                    setInventorySortOption(newSortOption);
                                    globalCache.inventorySortOption = newSortOption;
                                    saveInventorySortOptionPreference(newSortOption);
                                    break;
                                case VIEW_OPTIONS.RANKING:
                                    setRankingSortOption(newSortOption);
                                    globalCache.rankingSortOption = newSortOption;
                                    saveRankingSortOptionPreference(newSortOption);
                                    break;
                                case VIEW_OPTIONS.BLOGGER:
                                    setBloggerSortOption(newSortOption);
                                    globalCache.bloggerSortOption = newSortOption;
                                    saveBloggerSortOptionPreference(newSortOption);
                                    break;
                            }
                            
                            // 更新全局排序选项
                            setSortOption(newSortOption);
                            globalCache.sortOption = newSortOption;
                            saveSortOptionPreference(newSortOption);
                        }}
                        beansCount={isSearching ? searchFilteredBeans.length : filteredBeans.length}
                        totalBeans={beans.length}
                        totalWeight={calculateTotalWeight()}
                        rankingBeanType={rankingBeanType}
                        onRankingBeanTypeChange={(newType) => {
                            setRankingBeanType(newType);
                            // 保存到本地存储
                            globalCache.rankingBeanType = newType;
                            saveRankingBeanTypePreference(newType);
                        }}
                        bloggerYear={bloggerYear}
                        onBloggerYearChange={(newYear) => {
                            setBloggerYear(newYear);
                            // 保存到本地存储
                            globalCache.bloggerYear = newYear;
                            saveBloggerYearPreference(newYear);
                        }}
                        rankingEditMode={rankingEditMode}
                        onRankingEditModeChange={(newMode) => {
                            setRankingEditMode(newMode);
                            // 保存到本地存储
                            globalCache.rankingEditMode = newMode;
                            saveRankingEditModePreference(newMode);
                        }}
                        selectedBeanType={selectedBeanType}
                        onBeanTypeChange={handleBeanTypeChange}
                        selectedVariety={selectedVariety}
                        onVarietyClick={handleVarietyClick}
                        showEmptyBeans={showEmptyBeans}
                        onToggleShowEmptyBeans={toggleShowEmptyBeans}
                        availableVarieties={availableVarieties}
                        isSearching={isSearching}
                        setIsSearching={setIsSearching}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                    />
                </div>
                
                <div className="flex-1 overflow-hidden">
                    {/* 根据视图模式显示不同内容 */}
                    {viewMode === VIEW_OPTIONS.INVENTORY && (
                        <InventoryView
                            filteredBeans={isSearching ? searchFilteredBeans : filteredBeans}
                            selectedVariety={selectedVariety}
                            showEmptyBeans={showEmptyBeans}
                            selectedBeanType={selectedBeanType}
                            onVarietyClick={handleVarietyClick}
                            onBeanTypeChange={handleBeanTypeChange}
                            onToggleShowEmptyBeans={toggleShowEmptyBeans}
                            availableVarieties={availableVarieties}
                            beans={beans}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onShare={(bean) => handleShare(bean, copyText)}
                            _onRemainingUpdate={handleRemainingUpdate}
                            onQuickDecrement={handleQuickDecrement}
                            isSearching={isSearching}
                            searchQuery={searchQuery}
                        />
                    )}
                    {/* 添加统计视图 */}
                    {viewMode === VIEW_OPTIONS.STATS && (
                        <div className="w-full h-full overflow-y-auto scroll-with-bottom-bar">
                            <StatsView 
                                beans={beans}
                                showEmptyBeans={showEmptyBeans}
                            />
                        </div>
                    )}
                    {/* 添加榜单和博主榜单视图 */}
                    {(viewMode === VIEW_OPTIONS.RANKING || viewMode === VIEW_OPTIONS.BLOGGER) && (
                        <div className="w-full h-full overflow-y-auto scroll-with-bottom-bar">
                            <CoffeeBeanRanking
                                isOpen={viewMode === VIEW_OPTIONS.RANKING || viewMode === VIEW_OPTIONS.BLOGGER}
                                onShowRatingForm={handleShowRatingForm}
                                sortOption={convertToRankingSortOption(sortOption, viewMode)}
                                updatedBeanId={lastRatedBeanId}
                                hideFilters={true}
                                beanType={rankingBeanType}
                                editMode={rankingEditMode}
                                viewMode={viewMode === VIEW_OPTIONS.BLOGGER ? 'blogger' : 'personal'}
                                year={viewMode === VIEW_OPTIONS.BLOGGER ? bloggerYear : undefined}
                            />
                        </div>
                    )}
                </div>
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
            
            {/* 复制失败模态框 */}
            <CopyFailureModal
                isOpen={showFailureModal}
                onClose={closeFailureModal}
                content={failureContent || ""}
            />
        </>
    );
};

export default CoffeeBeans;