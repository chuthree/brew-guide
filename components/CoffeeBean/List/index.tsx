'use client'

import React, { useState, useEffect, useRef } from 'react'
import { CoffeeBeanManager } from '@/lib/coffeeBeanManager'
import CoffeeBeanFormModal from '@/components/CoffeeBean/Form/Modal'
import CoffeeBeanRatingModal from '../Rating/Modal'
import CoffeeBeanRanking from '../Ranking'
import { getBloggerBeans } from '@/lib/csvUtils'
import BottomActionBar from '@/components/BottomActionBar'
import { useCopy } from "@/lib/hooks/useCopy"
import CopyFailureModal from "../ui/copy-failure-modal"
import { SORT_OPTIONS, type SortOption, sortBeans, convertToRankingSortOption } from './SortSelector'

// 导入新创建的组件和类型
import { 
    ExtendedCoffeeBean, 
    CoffeeBeansProps, 
    BeanType, 
    BloggerBeansYear,
    VIEW_OPTIONS, 
    ViewOption 
} from './types'
import { globalCache, saveShowEmptyBeansPreference, isBeanEmpty } from './globalCache'
import { useBeanOperations } from './hooks/useBeanOperations'
import ViewSwitcher from './components/ViewSwitcher'
import InventoryView from './components/InventoryView'

const CoffeeBeans: React.FC<CoffeeBeansProps> = ({ isOpen, showBeanForm, onShowImport }) => {
    const { copyText, showFailureModal, failureContent, closeFailureModal } = useCopy()
    
    // 基础状态
    const [beans, setBeans] = useState<ExtendedCoffeeBean[]>(globalCache.beans)
    const [ratedBeans, setRatedBeans] = useState<ExtendedCoffeeBean[]>(globalCache.ratedBeans)
    const [showAddForm, setShowAddForm] = useState(false)
    const [editingBean, setEditingBean] = useState<ExtendedCoffeeBean | null>(null)
    const [sortOption, setSortOption] = useState<SortOption>(SORT_OPTIONS.REMAINING_DAYS_ASC)
    const [viewMode, setViewMode] = useState<ViewOption>(VIEW_OPTIONS.INVENTORY)
    
    // 评分相关状态
    const [showRatingModal, setShowRatingModal] = useState(false)
    const [selectedBeanForRating, setSelectedBeanForRating] = useState<ExtendedCoffeeBean | null>(null)
    const [lastRatedBeanId, setLastRatedBeanId] = useState<string | null>(null)
    const [ratingSavedCallback, setRatingSavedCallback] = useState<(() => void) | null>(null)
    
    // 过滤和显示控制状态
    const [availableVarieties, setAvailableVarieties] = useState<string[]>(globalCache.varieties)
    const [selectedVariety, setSelectedVariety] = useState<string | null>(globalCache.selectedVariety)
    const [filteredBeans, setFilteredBeans] = useState<ExtendedCoffeeBean[]>(globalCache.filteredBeans)
    const [showEmptyBeans, setShowEmptyBeans] = useState<boolean>(globalCache.showEmptyBeans)
    
    // 榜单视图状态
    const [rankingBeanType, setRankingBeanType] = useState<BeanType>('all')
    const [rankingEditMode, setRankingEditMode] = useState<boolean>(false)
    const [bloggerYear, setBloggerYear] = useState<BloggerBeansYear>(2025)
    
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
    }, [selectedVariety, showEmptyBeans]);

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
        // 根据视图模式设置默认排序
        switch (viewMode) {
            case VIEW_OPTIONS.INVENTORY:
                setSortOption(SORT_OPTIONS.REMAINING_DAYS_ASC);
                break;
            case VIEW_OPTIONS.RANKING:
                setSortOption(SORT_OPTIONS.RATING_DESC);
                break;
            case VIEW_OPTIONS.BLOGGER:
                setSortOption(SORT_OPTIONS.ORIGINAL);
                break;
        }
    }, [viewMode]);

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
        // 更新全局缓存
        globalCache.selectedVariety = variety;
        
        // 立即更新过滤后的咖啡豆列表
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
            return `${(totalWeight / 1000).toFixed(1)} kg`;
        }
    };

    // 切换显示空豆子状态
    const toggleShowEmptyBeans = () => {
        const newShowEmptyBeans = !showEmptyBeans;
        setShowEmptyBeans(newShowEmptyBeans);
        // 更新全局缓存
        globalCache.showEmptyBeans = newShowEmptyBeans;
        
        // 重新应用过滤
        if (selectedVariety) {
            const filtered = beans.filter(bean => {
                // 如果选择的是"拼配豆"分类
                if (selectedVariety === '拼配豆') {
                    return bean.type === '拼配' && (newShowEmptyBeans || !isBeanEmpty(bean));
                }
                // 否则按照常规品种筛选，但排除拼配豆
                return bean.type !== '拼配' && (bean.variety || '未分类') === selectedVariety &&
                    (newShowEmptyBeans || !isBeanEmpty(bean));
            });
            globalCache.filteredBeans = filtered;
            setFilteredBeans(filtered);
        } else {
            const filtered = beans.filter(bean => 
                (newShowEmptyBeans || !isBeanEmpty(bean))
            );
            globalCache.filteredBeans = filtered;
            setFilteredBeans(filtered);
        }
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

            <div
                ref={containerRef}
                className="h-full flex flex-col"
            >
                {/* 视图切换器 */}
                <ViewSwitcher
                                    viewMode={viewMode}
                    onViewChange={setViewMode}
                                    sortOption={sortOption}
                    onSortChange={setSortOption}
                    beansCount={
                        viewMode === VIEW_OPTIONS.INVENTORY 
                            ? filteredBeans.length 
                            : viewMode === VIEW_OPTIONS.BLOGGER 
                                ? (globalCache.bloggerBeans[bloggerYear] || []).length 
                                : ratedBeans.length
                    }
                    totalBeans={viewMode === VIEW_OPTIONS.INVENTORY ? beans.length : undefined}
                    totalWeight={viewMode === VIEW_OPTIONS.INVENTORY ? calculateTotalWeight() : undefined}
                    rankingBeanType={rankingBeanType}
                    onRankingBeanTypeChange={setRankingBeanType}
                    bloggerYear={bloggerYear}
                    onBloggerYearChange={setBloggerYear}
                    rankingEditMode={rankingEditMode}
                    onRankingEditModeChange={setRankingEditMode}
                />
                
                {/* 内容区域 */}
                {viewMode === VIEW_OPTIONS.INVENTORY ? (
                    // 库存视图
                    <InventoryView 
                        filteredBeans={filteredBeans}
                        selectedVariety={selectedVariety}
                        showEmptyBeans={showEmptyBeans}
                        onVarietyClick={handleVarietyClick}
                        onToggleShowEmptyBeans={toggleShowEmptyBeans}
                        availableVarieties={availableVarieties}
                        beans={beans}
                        onEdit={handleEdit}
                        onDelete={(bean) => handleDelete(bean)}
                        onShare={(bean) => handleShare(bean, copyText)}
                        _onRemainingUpdate={handleRemainingUpdate}
                        onQuickDecrement={handleQuickDecrement}
                    />
                ) : (
                    // 榜单和博主榜单视图
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