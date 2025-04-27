'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { ExtendedCoffeeBean, BeanType } from '../types'
import BeanListItem from './BeanListItem'
import { generateBeanTitle } from '../types'
import { AnimatePresence } from 'framer-motion'
import RemainingEditor from './RemainingEditor'
import { X as _X } from 'lucide-react'

// 每页加载的咖啡豆数量
const PAGE_SIZE = 10;

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
    onVarietyClick: _onVarietyClick,
    onBeanTypeChange: _onBeanTypeChange,
    onToggleShowEmptyBeans: _onToggleShowEmptyBeans,
    availableVarieties: _availableVarieties,
    beans,
    onEdit,
    onDelete,
    onShare,
    _onRemainingUpdate,
    onQuickDecrement,
    isSearching: _isSearching = false,
    searchQuery = ''
}) => {
    // 为所有豆子预计算标题并缓存
    const beanTitles = React.useMemo(() => {
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

    // 添加剩余量编辑状态
    const [editingRemaining, setEditingRemaining] = useState<{
        beanId: string,
        value: string,
        position: { x: number, y: number } | null,
        targetElement: HTMLElement | null
    } | null>(null);

    // 处理剩余量点击
    const handleRemainingClick = (bean: ExtendedCoffeeBean, event: React.MouseEvent) => {
        event.stopPropagation();
        const target = event.target as HTMLElement;
        const rect = target.getBoundingClientRect();
        
        // 相对于容器元素计算位置
        const containerElement = document.querySelector('.scroll-with-bottom-bar') as HTMLElement;
        
        if (containerElement) {
            const containerRect = containerElement.getBoundingClientRect();
            
            // 计算组件应该显示的位置
            // 获取右侧的安全距离，保证整个组件不会超出右边界
            // 假设下拉组件宽度约为120px
            const DROPDOWN_WIDTH = 120;
            const rightBoundaryPadding = 10; // 右侧安全边距
            
            // 计算x位置，确保不会超出右边界
            // 先尝试将组件放在元素正下方
            let xPosition = rect.left - containerRect.left;
            
            // 检查是否会超出右边界
            const rightEdge = xPosition + DROPDOWN_WIDTH;
            const containerWidth = containerElement.clientWidth;
            
            if (rightEdge > containerWidth - rightBoundaryPadding) {
                // 如果会超出右边界，则向左调整位置
                xPosition = Math.max(rightBoundaryPadding, containerWidth - DROPDOWN_WIDTH - rightBoundaryPadding);
            }
            
            setEditingRemaining({
                beanId: bean.id,
                value: bean.remaining || '',
                position: {
                    x: xPosition,
                    y: rect.bottom - containerRect.top
                },
                targetElement: target
            });
        }
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

    // 检查是否有特定类型的豆子存在
    const _hasEspressoBeans = React.useMemo(() => {
        return beans.some(bean => bean.beanType === 'espresso');
    }, [beans]);

    const _hasFilterBeans = React.useMemo(() => {
        return beans.some(bean => bean.beanType === 'filter'); 
    }, [beans]);

    // 基于搜索条件过滤豆子 - 现在可以移除，因为过滤已经在父组件完成
    const searchFilteredBeans = filteredBeans;

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
        const initialBeans = searchFilteredBeans.slice(0, PAGE_SIZE);
        setDisplayedBeans(initialBeans);
        setHasMore(searchFilteredBeans.length > PAGE_SIZE);
    }, [searchFilteredBeans]);
    
    // 加载更多咖啡豆
    const loadMoreBeans = useCallback(() => {
        if (!hasMore || isLoading) return;
        
        setIsLoading(true);
        
        // 使用setTimeout避免阻塞UI渲染
        setTimeout(() => {
            try {
                // 计算下一页的咖啡豆
                const nextPage = currentPage + 1;
                const endIndex = nextPage * PAGE_SIZE;
                
                // 使用筛选后的咖啡豆作为数据源
                const newDisplayedBeans = searchFilteredBeans.slice(0, endIndex);
                
                // 如果加载的数量和筛选后的总数一样，说明没有更多数据了
                const noMoreBeans = newDisplayedBeans.length >= searchFilteredBeans.length;
                
                setDisplayedBeans(newDisplayedBeans);
                setCurrentPage(nextPage);
                setHasMore(!noMoreBeans);
            } catch (error) {
                console.error('加载更多咖啡豆失败:', error);
            } finally {
                setIsLoading(false);
            }
        }, 100);
    }, [currentPage, searchFilteredBeans, hasMore, isLoading]);
    
    // 设置IntersectionObserver来监听加载更多的元素
    useEffect(() => {
        if (!loaderRef.current) return;
        
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreBeans();
                }
            },
            { threshold: 0.5 }
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
            {/* 搜索模式 - 现在可以移除 */}

            {/* 咖啡豆列表 */}
            {searchFilteredBeans.length === 0 ? (
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
                                    (showEmptyBeans ? '[ 暂无咖啡豆 ]' : '[ 所有咖啡豆已用完，点击"已用完"查看 ]') :
                                    '[ 暂无咖啡豆 ]'
                    }
                </div>
            ) : (
                <div className="pb-20">
                    {displayedBeans.map((bean, index) => (
                        <BeanListItem
                            key={bean.id}
                            bean={bean}
                            title={beanTitles[bean.id]}
                            isLast={index === displayedBeans.length - 1 && !hasMore}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onShare={onShare}
                            onRemainingClick={handleRemainingClick}
                        />
                    ))}
                    
                    {/* 加载更多指示器 */}
                    {hasMore && (
                        <div 
                            ref={loaderRef} 
                            className="flex justify-center items-center py-4"
                        >
                            {isLoading ? (
                                <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                                    正在加载更多...
                                </div>
                            ) : (
                                <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                                    上滑加载更多
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* 剩余量编辑弹出层 */}
            <AnimatePresence>
                {editingRemaining && (
                    <RemainingEditor
                        position={editingRemaining.position}
                        onCancel={handleRemainingCancel}
                        onQuickDecrement={handleQuickDecrement}
                        targetElement={editingRemaining.targetElement}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default InventoryView;