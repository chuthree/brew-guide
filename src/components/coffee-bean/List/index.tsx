'use client'

import React, { useState, useEffect, useRef } from 'react'
import { CoffeeBeanManager } from '@/lib/managers/coffeeBeanManager'
import CoffeeBeanFormModal from '@/components/coffee-bean/Form/Modal'
import CoffeeBeanRatingModal from '../Rating/Modal'
import _CoffeeBeanRanking from '../Ranking'
import { getBloggerBeans } from '@/lib/utils/csvUtils'
import BottomActionBar from '@/components/layout/BottomActionBar'
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
import { Share } from '@capacitor/share'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'
import { toPng } from 'html-to-image'
import { useToast } from '@/components/common/feedback/GlobalToast'
import { Storage } from '@/lib/core/storage'
import { exportStatsView } from './components/StatsView/StatsExporter'

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
        
        // 从过滤后的豆子中提取可用的品种列表 - 只使用 blendComponents 中的品种信息
        const varieties = beansForVarieties.reduce((acc, bean) => {
            // 不再从顶层 variety 字段提取品种
            
            // 从拼配豆/单品豆的成分中提取品种
            if (bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
                bean.blendComponents.forEach(component => {
                    if (component.variety && !acc.includes(component.variety)) {
                        acc.push(component.variety);
                    }
                });
            } else if (!acc.includes('未分类')) {
                // 如果没有 blendComponents，添加"未分类"
                acc.push('未分类');
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
                
                // 只检查拼配豆/单品豆中是否包含所选品种
                if (bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
                    return bean.blendComponents.some(component => component.variety === selectedVariety);
                }
                
                // 如果没有 blendComponents 且选择了"未分类"
                return selectedVariety === '未分类';
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

    // 添加榜单和博主榜单的豆子数量状态
    const [rankingBeansCount, setRankingBeansCount] = useState<number>(0);
    const [bloggerBeansCount, setBloggerBeansCount] = useState<number>(0);

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
            // 更新榜单豆子数量
            setRankingBeansCount(filteredRatedBeans.length);
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
            
            // 更新博主榜单豆子数量
            setBloggerBeansCount(bloggerBeansData.length);
            
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
        } else if (viewMode === VIEW_OPTIONS.INVENTORY) {
            // 在切换到仓库视图时，应用当前的排序选项重新排序
            if (beans.length > 0) {
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
                    overallRating: bean.overallRating,
                    variety: bean.variety,
                    price: bean.price,
                    type: bean.type
                }));
                
                const sortedBeans = sortBeans(compatibleBeans, sortOption);
                
                // 创建一个新的数组来存放排序后的原始豆子
                const resultBeans: ExtendedCoffeeBean[] = [];
                
                // 按照排序后的顺序收集原始beans数组中的豆子
                for (let i = 0; i < sortedBeans.length; i++) {
                    const sortedBean = sortedBeans[i];
                    const originalBean = beans.find(b => b.id === sortedBean.id);
                    if (originalBean) {
                        resultBeans.push(originalBean);
                    }
                }
                
                // 确保长度一致后更新
                if (resultBeans.length === beans.length) {
                    updateFilteredBeansAndCategories(resultBeans);
                }
            }
        }
    }, [viewMode, loadBloggerBeans, loadRatedBeans, beans, sortOption, updateFilteredBeansAndCategories]);

    // 确保在榜单beanType或年份变化时更新计数
    useEffect(() => {
        if (viewMode === VIEW_OPTIONS.RANKING) {
            loadRatedBeans();
        } else if (viewMode === VIEW_OPTIONS.BLOGGER) {
            loadBloggerBeans();
        }
    }, [rankingBeanType, bloggerYear, viewMode, loadRatedBeans, loadBloggerBeans]);

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
                overallRating: bean.overallRating, // 确保使用正确的评分字段名称
                variety: bean.variety,
                price: bean.price,
                type: bean.type
            }));
            
            const sortedBeans = sortBeans(compatibleBeans, sortOption);
            
            // 创建一个新的数组来存放排序后的原始豆子
            const resultBeans: ExtendedCoffeeBean[] = [];
            
            // 按照排序后的顺序收集原始beans数组中的豆子
            for (let i = 0; i < sortedBeans.length; i++) {
                const sortedBean = sortedBeans[i];
                const originalBean = beans.find(b => b.id === sortedBean.id);
                if (originalBean) {
                    resultBeans.push(originalBean);
                }
            }
            
            // 确保长度一致
            if (resultBeans.length === beans.length) {
                // 更新过滤后的豆子和分类
                updateFilteredBeansAndCategories(resultBeans);
            } else {
                console.error('排序后的豆子数量与原始豆子数量不一致', resultBeans.length, beans.length);
                // 如果出现不一致，仍然进行更新，但是使用原始数组
                updateFilteredBeansAndCategories(beans);
            }
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
                
                // 只检查拼配豆/单品豆中是否包含所选品种
                if (bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
                    return bean.blendComponents.some(component => component.variety === variety);
                }
                
                // 如果没有 blendComponents 且选择了"未分类"
                return variety === '未分类';
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
                
                // 只检查拼配豆/单品豆中是否包含所选品种
                if (bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
                    return bean.blendComponents.some(component => component.variety === selectedVariety);
                }
                
                // 如果没有 blendComponents 且选择了"未分类"
                return selectedVariety === '未分类';
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
        
        // 从过滤后的豆子中提取可用的品种列表 - 只使用 blendComponents 中的品种信息
        const varieties = beansForVarieties.reduce((acc, bean) => {
            // 不再从顶层 variety 字段提取品种
            
            // 从拼配豆/单品豆的成分中提取品种
            if (bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
                bean.blendComponents.forEach(component => {
                    if (component.variety && !acc.includes(component.variety)) {
                        acc.push(component.variety);
                    }
                });
            } else if (!acc.includes('未分类')) {
                // 如果没有 blendComponents，添加"未分类"
                acc.push('未分类');
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
                
                // 只检查拼配豆/单品豆中是否包含所选品种
                if (bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
                    return bean.blendComponents.some(component => component.variety === selectedVariety);
                }
                
                // 如果没有 blendComponents 且选择了"未分类"
                return selectedVariety === '未分类';
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
        
        // 从过滤后的豆子中提取可用的品种列表 - 只使用 blendComponents 中的品种信息
        const varieties = beansForVarieties.reduce((acc, bean) => {
            // 不再从顶层 variety 字段提取品种
            
            // 从拼配豆/单品豆的成分中提取品种
            if (bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
                bean.blendComponents.forEach(component => {
                    if (component.variety && !acc.includes(component.variety)) {
                        acc.push(component.variety);
                    }
                });
            } else if (!acc.includes('未分类')) {
                // 如果没有 blendComponents，添加"未分类"
                acc.push('未分类');
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
        if (!searchQuery.trim() || !isSearching) {
            // 当没有搜索时，返回当前过滤和排序后的豆子列表
            return filteredBeans;
        }
        
        // 将查询拆分为多个关键词，移除空字符串
        const queryTerms = searchQuery.toLowerCase().trim().split(/\s+/).filter(term => term.length > 0);
        
        // 给每个咖啡豆计算匹配分数
        const beansWithScores = filteredBeans.map(bean => {
            // 基本信息搜索
            const name = bean.name?.toLowerCase() || '';
            const origin = bean.origin?.toLowerCase() || '';
            const process = bean.process?.toLowerCase() || '';
            const notes = bean.notes?.toLowerCase() || '';
            
            // 额外信息搜索
            const roastLevel = bean.roastLevel?.toLowerCase() || '';
            const roastDate = bean.roastDate?.toLowerCase() || '';
            const price = bean.price?.toLowerCase() || '';
            const beanType = bean.beanType?.toLowerCase() || '';
            
            // 风味标签搜索 - 将数组转换为字符串进行搜索
            const flavors = bean.flavor?.join(' ').toLowerCase() || '';
            
            // 拼配组件搜索 - 包含成分中的品种信息
            const blendComponentsText = bean.blendComponents?.map(comp => 
                `${comp.percentage || ''} ${comp.origin || ''} ${comp.process || ''} ${comp.variety || ''}`
            ).join(' ').toLowerCase() || '';
            
            // 计量信息搜索
            const capacity = bean.capacity?.toLowerCase() || '';
            const remaining = bean.remaining?.toLowerCase() || '';
            
            // 赏味期搜索 - 将赏味期信息转换为可搜索的文本
            const flavorPeriod = `${bean.startDay || ''} ${bean.endDay || ''}`.toLowerCase();
            
            // 组合所有可搜索文本到一个数组，为不同字段分配权重
            const searchableTexts = [
                { text: name, weight: 3 },           // 名称权重最高
                { text: origin, weight: 2 },         // 产地权重较高
                { text: process, weight: 2 },        // 处理法权重较高
                { text: notes, weight: 1 },          // 备注权重一般
                { text: roastLevel, weight: 1 },     // 烘焙度权重一般
                { text: roastDate, weight: 1 },      // 烘焙日期权重一般
                { text: price, weight: 1 },          // 价格权重一般
                { text: beanType, weight: 2 },       // 豆子类型权重较高
                { text: flavors, weight: 2 },        // 风味标签权重较高
                { text: blendComponentsText, weight: 2 }, // 拼配组件权重较高
                { text: capacity, weight: 1 },       // 容量权重一般
                { text: remaining, weight: 1 },      // 剩余量权重一般
                { text: flavorPeriod, weight: 1 }    // 赏味期信息权重一般
            ];
            
            // 计算匹配分数 - 所有匹配关键词的权重总和
            let score = 0;
            let allTermsMatch = true;
            
            for (const term of queryTerms) {
                // 检查当前关键词是否至少匹配一个字段
                const termMatches = searchableTexts.some(({ text }) => text.includes(term));
                
                if (!termMatches) {
                    allTermsMatch = false;
                    break;
                }
                
                // 累加匹配到的权重
                for (const { text, weight } of searchableTexts) {
                    if (text.includes(term)) {
                        score += weight;
                        
                        // 精确匹配整个字段给予额外加分
                        if (text === term) {
                            score += weight * 2;
                        }
                        
                        // 匹配字段开头给予额外加分
                        if (text.startsWith(term)) {
                            score += weight;
                        }
                    }
                }
            }
            
            return {
                bean,
                score,
                matches: allTermsMatch
            };
        });
        
        // 过滤掉不匹配所有关键词的豆子
        const matchingBeans = beansWithScores.filter(item => item.matches);
        
        // 根据分数排序，分数高的在前面
        matchingBeans.sort((a, b) => b.score - a.score);
        
        // 返回排序后的豆子列表
        return matchingBeans.map(item => item.bean);
    }, [filteredBeans, searchQuery, isSearching]);

    const [_isExportingRanking, setIsExportingRanking] = useState(false);
    const _rankingContainerRef = useRef(null);
    const toast = useToast();
    
    // 处理榜单分享
    const handleRankingShare = async () => {
        // 找到榜单容器
        const rankingContainer = document.querySelector('.coffee-bean-ranking-container');
        if (!rankingContainer) {
            toast.showToast({
                type: 'error',
                title: '无法找到榜单数据容器'
            });
            return;
        }
        
        setIsExportingRanking(true);
        
        try {
            // 创建一个临时容器用于导出
            const tempContainer = document.createElement('div');
            const isDarkMode = document.documentElement.classList.contains('dark');
            const backgroundColor = isDarkMode ? '#171717' : '#fafafa';
            
            // 设置样式
            tempContainer.style.backgroundColor = backgroundColor;
            tempContainer.style.maxWidth = '100%';
            tempContainer.style.width = '350px';
            tempContainer.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
            
            if (isDarkMode) {
                tempContainer.classList.add('dark');
            }
            
            // 复制榜单内容到临时容器
            const clone = rankingContainer.cloneNode(true) as HTMLElement;
            
            // 移除未评分咖啡豆部分
            const unratedSection = clone.querySelector('.mt-4');
            if (unratedSection) {
                unratedSection.remove();
            }
            
            // 调整克隆内容的样式，移除多余的内边距
            clone.style.padding = '0';
            clone.style.paddingTop = '0';
            clone.style.paddingBottom = '0';
            
            // 调整榜单内部元素的内边距
            const listItems = clone.querySelectorAll('[class*="py-2"]');
            listItems.forEach(item => {
                (item as HTMLElement).style.paddingTop = '4px';
                (item as HTMLElement).style.paddingBottom = '4px';
            });
            
            // 移除底部额外的内边距
            if (clone.classList.contains('pb-16')) {
                clone.classList.remove('pb-16');
                clone.style.paddingBottom = '0';
            }
            
            // 添加标题
            const title = document.createElement('h2');
            title.innerText = '个人咖啡豆榜单';
            title.style.textAlign = 'left';
            title.style.marginBottom = '8px';
            title.style.fontSize = '12px';
            title.style.color = isDarkMode ? '#f5f5f5' : '#262626';
            title.style.padding = '24px';
            
            tempContainer.appendChild(title);
            tempContainer.appendChild(clone);
            
            // 获取用户名
            const settingsStr = await Storage.get('brewGuideSettings');
            let username = '';
            if (settingsStr) {
                try {
                    const settings = JSON.parse(settingsStr);
                    username = settings.username?.trim() || '';
                } catch (e) {
                    console.error('解析用户设置失败', e);
                }
            }
            
            // 添加底部标记
            const footer = document.createElement('p');
            footer.style.textAlign = 'left';
            footer.style.marginTop = '8px';
            footer.style.fontSize = '11px';
            footer.style.color = isDarkMode ? '#a3a3a3' : '#525252';
            footer.style.padding = '24px';
            footer.style.display = 'flex';
            footer.style.justifyContent = 'space-between';
            
            if (username) {
                // 如果有用户名，将用户名放在左边，Brew Guide放在右边
                const usernameSpan = document.createElement('span');
                usernameSpan.innerText = `@${username}`;
                
                const appNameSpan = document.createElement('span');
                appNameSpan.innerText = '—— Brew Guide';
                
                footer.appendChild(usernameSpan);
                footer.appendChild(appNameSpan);
            } else {
                // 如果没有用户名，保持原样
                footer.innerText = '—— Brew Guide';
            }
            
            tempContainer.appendChild(footer);
            
            // 添加到文档以便能够导出
            document.body.appendChild(tempContainer);
            
            // 使用html-to-image生成PNG
            const imageData = await toPng(tempContainer, {
                quality: 1,
                pixelRatio: 5,
                backgroundColor: backgroundColor,
            });
            
            // 删除临时容器
            document.body.removeChild(tempContainer);
            
            // 在移动设备上使用Capacitor分享
            if (Capacitor.isNativePlatform()) {
                // 保存到文件
                const timestamp = new Date().getTime();
                const fileName = `coffee-ranking-${timestamp}.png`;
                
                // 确保正确处理base64数据
                const base64Data = imageData.split(',')[1];
                
                // 写入文件
                await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data,
                    directory: Directory.Cache,
                    recursive: true
                });
                
                // 获取文件URI
                const uriResult = await Filesystem.getUri({
                    path: fileName,
                    directory: Directory.Cache
                });
                
                // 分享文件
                await Share.share({
                    title: '我的咖啡豆个人榜单',
                    text: '我的咖啡豆个人榜单',
                    files: [uriResult.uri],
                    dialogTitle: '分享我的咖啡豆个人榜单'
                });
            } else {
                // 在网页上下载图片
                const link = document.createElement('a');
                link.download = `coffee-ranking-${new Date().getTime()}.png`;
                link.href = imageData;
                link.click();
            }
            
            toast.showToast({
                type: 'success',
                title: '个人榜单已保存为图片'
            });
        } catch (error) {
            console.error('生成个人榜单图片失败', error);
            toast.showToast({
                type: 'error',
                title: '生成图片失败'
            });
        } finally {
            setIsExportingRanking(false);
        }
    };

    // 添加统计数据分享状态
    const [isExportingStats, setIsExportingStats] = useState(false)
    
    // 处理统计数据分享
    const handleStatsShare = async () => {
        if (isExportingStats) return;
        
        // 找到统计数据容器
        const statsContainer = document.querySelector('.coffee-bean-stats-container');
        if (!statsContainer) {
            toast.showToast({
                type: 'error',
                title: '无法找到统计数据容器'
            });
            return;
        }
        
        setIsExportingStats(true);
        
        try {
            // 使用StatsExporter处理导出
            await exportStatsView({
                statsContainerRef: { current: statsContainer as HTMLDivElement },
                onSuccess: (message) => {
                    toast.showToast({
                        type: 'success',
                        title: message
                    });
                },
                onError: (message) => {
                    toast.showToast({
                        type: 'error',
                        title: message
                    });
                },
                onComplete: () => {
                    setIsExportingStats(false);
                }
            });
        } catch (error) {
            console.error('导出统计数据时出错:', error);
            toast.showToast({
                type: 'error',
                title: '生成图片失败'
            });
            setIsExportingStats(false);
        }
    };

    // 处理排序选项变更
    const handleSortChange = (option: SortOption) => {
        setSortOption(option);
        
        // 同时更新视图特定的排序选项
        switch (viewMode) {
            case VIEW_OPTIONS.INVENTORY:
                setInventorySortOption(option);
                globalCache.inventorySortOption = option;
                saveInventorySortOptionPreference(option);
                break;
            case VIEW_OPTIONS.RANKING:
                setRankingSortOption(option);
                globalCache.rankingSortOption = option;
                saveRankingSortOptionPreference(option);
                break;
            case VIEW_OPTIONS.BLOGGER:
                setBloggerSortOption(option);
                globalCache.bloggerSortOption = option;
                saveBloggerSortOptionPreference(option);
                break;
        }
        
        // 更新全局缓存
        globalCache.sortOption = option;
        saveSortOptionPreference(option);
        
        // 强制清除缓存并重新加载数据
        CoffeeBeanManager.clearCache();
    };

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
                        onSortChange={handleSortChange}
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
                        onRankingShare={handleRankingShare}
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
                        rankingBeansCount={rankingBeansCount}
                        bloggerBeansCount={bloggerBeansCount}
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
                            _onVarietyClick={handleVarietyClick}
                            _onBeanTypeChange={handleBeanTypeChange}
                            _onToggleShowEmptyBeans={toggleShowEmptyBeans}
                            _availableVarieties={availableVarieties}
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
                                onStatsShare={handleStatsShare}
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