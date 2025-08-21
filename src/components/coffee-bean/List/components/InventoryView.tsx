'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { ExtendedCoffeeBean, BeanType } from '../types'
import BeanListItem from './BeanListItem'
import ImageFlowView from './ImageFlowView'
import RemainingEditor from './RemainingEditor'
import BeanDetailModal from '@/components/coffee-bean/Detail/BeanDetailModal'

const PAGE_SIZE = 8;

interface InventoryViewProps {
    filteredBeans: ExtendedCoffeeBean[]
    selectedVariety: string | null
    showEmptyBeans: boolean
    selectedBeanType: BeanType
    beans: ExtendedCoffeeBean[]
    onEdit: (bean: ExtendedCoffeeBean) => void
    onDelete: (bean: ExtendedCoffeeBean) => void
    onShare: (bean: ExtendedCoffeeBean) => void
    onQuickDecrement: (beanId: string, currentValue: string, decrementAmount: number) => Promise<{ success: boolean, value?: string, reducedToZero?: boolean, error?: Error }>
    isSearching?: boolean
    searchQuery?: string
    isImageFlowMode?: boolean
    settings?: {
        dateDisplayMode?: 'date' | 'flavorPeriod' | 'agingDays'
        showOnlyBeanName?: boolean
        showFlavorInfo?: boolean
        limitNotesLines?: boolean
        notesMaxLines?: number
        showTotalPrice?: boolean
    }
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
    isSearching = false,
    searchQuery = '',
    isImageFlowMode = false,
    settings
}) => {
    // 剩余量编辑状态
    const [editingRemaining, setEditingRemaining] = useState<{
        beanId: string,
        value: string,
        targetElement: HTMLElement | null,
        bean: ExtendedCoffeeBean
    } | null>(null);

    // 详情弹窗状态
    const [detailBean, setDetailBean] = useState<ExtendedCoffeeBean | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    const handleDetailClick = (bean: ExtendedCoffeeBean) => {
        setDetailBean(bean);
        setShowDetailModal(true);
    };

    const handleDetailClose = () => {
        setShowDetailModal(false);
        setTimeout(() => setDetailBean(null), 300);
    };

    const handleRemainingClick = (bean: ExtendedCoffeeBean, event: React.MouseEvent) => {
        event.stopPropagation();
        const target = event.target as HTMLElement;

        if (!target || !document.body.contains(target)) return;

        setEditingRemaining({
            beanId: bean.id,
            value: bean.remaining || '',
            targetElement: target,
            bean: bean
        });
    };

    const handleQuickDecrement = async (decrementAmount: number) => {
        if (!editingRemaining) return;

        const { beanId, value } = editingRemaining;
        setEditingRemaining(null);

        try {
            const result = await onQuickDecrement(beanId, value, decrementAmount);
            if (result.success) {
                const updatedBean = filteredBeans.find(bean => bean.id === beanId);
                if (updatedBean) {
                    updatedBean.remaining = result.value || "0";
                    setDisplayedBeans(prev =>
                        prev.map(bean =>
                            bean.id === beanId ? {...bean, remaining: result.value || "0"} : bean
                        )
                    );
                }
            }
        } catch (error) {
            console.error('快捷减量失败:', error);
        }
    };

    // 分页状态
    const [displayedBeans, setDisplayedBeans] = useState<ExtendedCoffeeBean[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const loaderRef = useRef<HTMLDivElement>(null);

    // 初始化分页数据
    useEffect(() => {
        setCurrentPage(1);
        const initialBeans = filteredBeans.slice(0, PAGE_SIZE);
        setDisplayedBeans(initialBeans);
        setHasMore(filteredBeans.length > PAGE_SIZE);
    }, [filteredBeans]);

    // 加载更多数据
    const loadMoreBeans = useCallback(() => {
        if (!hasMore || isLoading) return;

        setIsLoading(true);
        const nextPage = currentPage + 1;
        const endIndex = nextPage * PAGE_SIZE;
        const newDisplayedBeans = filteredBeans.slice(0, endIndex);

        setDisplayedBeans(newDisplayedBeans);
        setCurrentPage(nextPage);
        setHasMore(newDisplayedBeans.length < filteredBeans.length);
        setIsLoading(false);
    }, [currentPage, filteredBeans, hasMore, isLoading]);

    // 监听滚动加载
    useEffect(() => {
        if (!loaderRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreBeans();
                }
            },
            { threshold: 0.1 }
        );

        observer.observe(loaderRef.current);
        return () => observer.disconnect();
    }, [hasMore, loadMoreBeans]);

    // 如果是图片流模式，直接返回图片流视图
    if (isImageFlowMode) {
        return (
            <ImageFlowView
                filteredBeans={filteredBeans}
                onEdit={onEdit}
                onDelete={onDelete}
                onShare={onShare}
            />
        )
    }

    return (
        <div className="w-full h-full overflow-y-auto scroll-with-bottom-bar relative">
            {filteredBeans.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
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
                    <div className="mx-6 flex flex-col gap-y-5 mt-5">
                        {displayedBeans.map((bean, index) => (
                            <BeanListItem
                                key={bean.id}
                                bean={bean}
                                isLast={index === displayedBeans.length - 1}
                                onRemainingClick={handleRemainingClick}
                                onDetailClick={handleDetailClick}
                                searchQuery={isSearching ? searchQuery : ''}
                                settings={settings}
                            />
                        ))}

                        {hasMore && (
                            <div ref={loaderRef} className="flex justify-center items-center py-4">
                                <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                                    {isLoading ? '正在加载...' : '上滑加载更多'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 剩余量编辑弹出层 */}
            <RemainingEditor
                targetElement={editingRemaining?.targetElement || null}
                isOpen={!!editingRemaining}
                onOpenChange={(open) => !open && setEditingRemaining(null)}
                onCancel={() => setEditingRemaining(null)}
                onQuickDecrement={handleQuickDecrement}
                coffeeBean={editingRemaining?.bean}
            />

            {/* 详情弹窗 */}
            <BeanDetailModal
                isOpen={showDetailModal}
                bean={detailBean}
                onClose={handleDetailClose}
                searchQuery={isSearching ? searchQuery : ''}
                onEdit={onEdit}
                onDelete={onDelete}
                onShare={onShare}
            />
        </div>
    );
};

export default InventoryView;