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
    beans,
    onEdit,
    onDelete,
    onShare,
    onQuickDecrement,
    searchQuery = ''
}) => {
    // 添加剩余量编辑状态
    const [editingRemaining, setEditingRemaining] = useState<{
        beanId: string,
        value: string,
        targetElement: HTMLElement | null
    } | null>(null);

    // 处理剩余量点击
    const handleRemainingClick = (bean: ExtendedCoffeeBean, event: React.MouseEvent) => {
        event.stopPropagation();
        const target = event.target as HTMLElement;
        
        setEditingRemaining({
            beanId: bean.id,
            value: bean.remaining || '',
            targetElement: target
        });
    };

    // 处理快捷减量
    const handleQuickDecrement = async (decrementAmount: number) => {
        if (!editingRemaining) return;
        try {
            const result = await onQuickDecrement(
                editingRemaining.beanId,
                editingRemaining.value,
                decrementAmount
            );
            if (result.success) {
                setEditingRemaining(null);
            }
        } catch (error) {
            console.error('快捷减量失败:', error);
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
                <div className="pb-20">
                    {displayedBeans.map((bean, index) => (
                        <BeanListItem
                            key={bean.id}
                            bean={bean}
                            title={generateBeanTitle(bean)} // 直接生成标题，无需useMemo缓存
                            isLast={index === displayedBeans.length - 1 && !hasMore}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onShare={onShare}
                            onRemainingClick={handleRemainingClick}
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
            />
        </div>
    );
};

export default InventoryView;