'use client'

import React, { useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { ExtendedCoffeeBean, BeanType } from '../types'
import BeanListItem from './BeanListItem'
import ImageFlowView from './ImageFlowView'
import RemainingEditor from './RemainingEditor'
import BeanDetailModal from '@/components/coffee-bean/Detail/BeanDetailModal'

// 已移除手动分页，改用 react-virtuoso 虚拟列表

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
    // 外部滚动容器（Virtuoso 使用）
    scrollParentRef?: HTMLElement
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
    settings,
    scrollParentRef
}) => {
    // 剩余量编辑状态
    const [editingRemaining, setEditingRemaining] = useState<{
        beanId: string,
        value: string,
        targetElement: HTMLElement | null,
        bean: ExtendedCoffeeBean
    } | null>(null);

    // 详情弹窗状态 - 简化为单一状态
    const [detailBean, setDetailBean] = useState<ExtendedCoffeeBean | null>(null);

    const handleDetailClick = (bean: ExtendedCoffeeBean) => {
        setDetailBean(bean);
    };

    const handleDetailClose = () => {
        setDetailBean(null);
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

    const [_rerenderTick, setRerenderTick] = useState(0);

    const handleQuickDecrement = async (decrementAmount: number) => {
        if (!editingRemaining) return;

        const { beanId, value } = editingRemaining;
        setEditingRemaining(null);

        try {
            const result = await onQuickDecrement(beanId, value, decrementAmount);
            if (result.success) {
                const updatedBean = filteredBeans.find(bean => bean.id === beanId);
                if (updatedBean) {
                    // 乐观更新本地对象并触发一次重新渲染
                    updatedBean.remaining = result.value || "0";
                    setRerenderTick(t => t + 1);
                }
            }
        } catch (error) {
            console.error('快捷减量失败:', error);
        }
    };

    // 兼容之前编辑剩余量时的就地更新
    // 虚拟列表场景下直接依赖 filteredBeans 的外部更新即可

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
        <div className="w-full h-full relative">
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
                <div className="pb-20">
                    {(() => {
                        const VirtuosoList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
                            ({ style, children, ...props }, ref) => (
                                <div ref={ref} style={style} className="mx-6 flex flex-col gap-y-5" {...props}>
                                    {children}
                                </div>
                            )
                        );
                        VirtuosoList.displayName = 'VirtuosoList';

                        return (
                            <Virtuoso
                                data={filteredBeans}
                                customScrollParent={scrollParentRef}
                                components={{
                                    List: VirtuosoList,
                                    Header: () => <div className="h-5" />
                                }}
                                itemContent={(_index, bean) => (
                                    <BeanListItem
                                        key={bean.id}
                                        bean={bean}
                                        isLast={false}
                                        onRemainingClick={handleRemainingClick}
                                        onDetailClick={handleDetailClick}
                                        searchQuery={isSearching ? searchQuery : ''}
                                        settings={settings}
                                    />
                                )}
                            />
                        );
                    })()}
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
                isOpen={!!detailBean}
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
