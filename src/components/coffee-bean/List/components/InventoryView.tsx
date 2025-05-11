'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { ExtendedCoffeeBean, BeanType } from '../types'
import BeanListItem from './BeanListItem'
import { generateBeanTitle } from '../types'
import RemainingEditor from './RemainingEditor'

// 每页加载的咖啡豆数量 - 增大分页大小减少加载次数
const PAGE_SIZE = 5;

interface InventoryViewProps {
    filteredBeans: ExtendedCoffeeBean[]
    selectedVariety: string | null
    showEmptyBeans: boolean
    selectedBeanType: BeanType
    onVarietyClick: (variety: string | null) => void
    onBeanTypeChange: (type: BeanType) => void
    onToggleShowEmptyBeans: () => void
    availableVarieties: string[]
    beans: ExtendedCoffeeBean[]
    onEdit: (bean: ExtendedCoffeeBean) => void
    onDelete: (bean: ExtendedCoffeeBean) => void
    onShare: (bean: ExtendedCoffeeBean) => void
    _onRemainingUpdate: (beanId: string, value: string) => Promise<{ success: boolean, value?: string, error?: Error }>
    onQuickDecrement: (beanId: string, currentValue: string, decrementAmount: number) => Promise<{ success: boolean, value?: string, reducedToZero?: boolean, error?: Error }>
    isSearching?: boolean
    searchQuery?: string
}

const InventoryView: React.FC<InventoryViewProps> = ({
    filteredBeans,
    selectedVariety,
    showEmptyBeans,
    selectedBeanType,
    onVarietyClick,
    onBeanTypeChange,
    onToggleShowEmptyBeans,
    availableVarieties,
    beans,
    onEdit,
    onDelete,
    onShare,
    _onRemainingUpdate,
    onQuickDecrement,
    isSearching = false,
    searchQuery = ''
}) => {
    // 添加剩余量编辑状态
    const [editingRemaining, setEditingRemaining] = useState<{
        beanId: string,
        value: string,
        targetElement: HTMLElement | null,
        bean: ExtendedCoffeeBean // 存储完整的咖啡豆对象
    } | null>(null);

    // 处理剩余量点击
    const handleRemainingClick = (bean: ExtendedCoffeeBean, event: React.MouseEvent) => {
        event.stopPropagation();
        try {
            const target = event.target as HTMLElement;
            
            // 检查目标元素是否有效
            if (!target || !document.body.contains(target)) {
                console.warn('无效的目标元素');
                return;
            }
            
            setEditingRemaining({
                beanId: bean.id,
                value: bean.remaining || '',
                targetElement: target,
                bean: bean // 存储完整的咖啡豆对象
            });
        } catch (error) {
            console.error('处理剩余量点击失败:', error);
        }
    };

    // 处理快捷减量
    const handleQuickDecrement = async (decrementAmount: number) => {
        if (!editingRemaining) return;
        try {
            // 保存当前的bean引用，以防在异步操作中状态变化
            const currentBeanId = editingRemaining.beanId;
            const currentValue = editingRemaining.value;
            
            // 先关闭弹出层，防止在处理过程中组件卸载导致错误
            setEditingRemaining(null);
            
            const result = await onQuickDecrement(
                currentBeanId,
                currentValue,
                decrementAmount
            );
            
            if (result.success) {
                // 强制更新筛选后的咖啡豆列表，确保UI显示正确
                const updatedBean = filteredBeans.find(bean => bean.id === currentBeanId);
                if (updatedBean) {
                    updatedBean.remaining = result.value || "0";
                    
                    // 检查组件是否仍然挂载
                    if (loaderRef.current) {
                        // 刷新当前显示的咖啡豆
                        setDisplayedBeans(prev => 
                            prev.map(bean => 
                                bean.id === currentBeanId ? {...bean, remaining: result.value || "0"} : bean
                            )
                        );
                    }
                }
            }
        } catch (error) {
            console.error('快捷减量失败:', error);
            // 确保组件状态一致
            setEditingRemaining(null);
        }
    };

    // 处理剩余量编辑取消
    const handleRemainingCancel = () => {
        setEditingRemaining(null);
    };

    // 分页状态
    const [displayedBeans, setDisplayedBeans] = useState<ExtendedCoffeeBean[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const loaderRef = useRef<HTMLDivElement>(null);
    
    // 初始化分页数据
    useEffect(() => {
        // 每次筛选条件变化时，重置分页状态
        setCurrentPage(1);
        const initialBeans = filteredBeans.slice(0, PAGE_SIZE);
        setDisplayedBeans(initialBeans);
        setHasMore(filteredBeans.length > PAGE_SIZE);
    }, [filteredBeans]);
    
    // 加载更多咖啡豆 - 移除setTimeout，直接同步更新
    const loadMoreBeans = useCallback(() => {
        if (!hasMore || isLoading) return;
        
        setIsLoading(true);
        
        try {
            // 计算下一页的咖啡豆
            const nextPage = currentPage + 1;
            const endIndex = nextPage * PAGE_SIZE;
            
            // 使用筛选后的咖啡豆作为数据源
            const newDisplayedBeans = filteredBeans.slice(0, endIndex);
            
            // 如果加载的数量和筛选后的总数一样，说明没有更多数据了
            const noMoreBeans = newDisplayedBeans.length >= filteredBeans.length;
            
            setDisplayedBeans(newDisplayedBeans);
            setCurrentPage(nextPage);
            setHasMore(!noMoreBeans);
        } catch (error) {
            console.error('加载更多咖啡豆失败:', error);
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, filteredBeans, hasMore, isLoading]);
    
    // 设置IntersectionObserver来监听加载更多的元素
    useEffect(() => {
        if (!loaderRef.current) return;
        
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreBeans();
                }
            },
            { threshold: 0.1 } // 降低阈值，提高加载触发敏感度
        );
        
        observer.observe(loaderRef.current);
        
        return () => {
            if (loaderRef.current) {
                observer.unobserve(loaderRef.current);
            }
        };
    }, [hasMore, loadMoreBeans]);

    return (
        <div className="w-full h-full overflow-y-auto scroll-with-bottom-bar relative">
            {/* 咖啡豆列表 */}
            {filteredBeans.length === 0 ? (
                <div
                    className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400"
                >
                    {searchQuery.trim() ? 
                        `[ 没有找到匹配"${searchQuery.trim()}"的咖啡豆 ]` :
                        selectedVariety ?
                            `[ 没有${selectedVariety}品种的咖啡豆 ]` :
                            selectedBeanType !== 'all' ?
                                `[ 没有${selectedBeanType === 'espresso' ? '意式' : '手冲'}咖啡豆 ]` :
                                beans.length > 0 ?
                                    (showEmptyBeans ? '[ 暂无咖啡豆，请点击下方按钮添加 ]' : '[ 所有咖啡豆已用完，点击"已用完"查看 ]') :
                                    '[ 暂无咖啡豆，请点击下方按钮添加 ]'
                    }
                </div>
            ) : (
                <div className="min-h-full pb-20">
                    {displayedBeans.map((bean, index) => (
                        <BeanListItem
                            key={bean.id}
                            bean={bean}
                            title={generateBeanTitle(bean)}
                            isLast={index === displayedBeans.length - 1}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onShare={onShare}
                            onRemainingClick={handleRemainingClick}
                            searchQuery={isSearching ? searchQuery : ''}
                        />
                    ))}
                    
                    {/* 加载更多指示器 - 简化加载提示 */}
                    {hasMore && (
                        <div 
                            ref={loaderRef} 
                            className="flex justify-center items-center py-4"
                        >
                            <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                                {isLoading ? '正在加载...' : '上滑加载更多'}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 剩余量编辑弹出层 */}
            <RemainingEditor
                targetElement={editingRemaining?.targetElement || null}
                isOpen={!!editingRemaining}
                onOpenChange={(open) => !open && setEditingRemaining(null)}
                onCancel={handleRemainingCancel}
                onQuickDecrement={handleQuickDecrement}
                coffeeBean={editingRemaining?.bean} // 传递咖啡豆对象
            />
        </div>
    );
};

export default InventoryView;