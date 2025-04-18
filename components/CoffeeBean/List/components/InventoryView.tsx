'use client'

import React, { useState } from 'react'
import { ExtendedCoffeeBean } from '../types'
import BeanListItem from './BeanListItem'
import { generateBeanTitle } from '../types'
import { AnimatePresence } from 'framer-motion'
import RemainingEditor from './RemainingEditor'

interface InventoryViewProps {
    filteredBeans: ExtendedCoffeeBean[]
    selectedVariety: string | null
    showEmptyBeans: boolean
    onVarietyClick: (variety: string | null) => void
    onToggleShowEmptyBeans: () => void
    availableVarieties: string[]
    beans: ExtendedCoffeeBean[]
    onEdit: (bean: ExtendedCoffeeBean) => void
    onDelete: (bean: ExtendedCoffeeBean) => void
    onShare: (bean: ExtendedCoffeeBean) => void
    _onRemainingUpdate: (beanId: string, value: string) => Promise<{ success: boolean, value?: string, error?: Error }>
    onQuickDecrement: (beanId: string, currentValue: string, decrementAmount: number) => Promise<{ success: boolean, value?: string, reducedToZero?: boolean, error?: Error }>
}

const InventoryView: React.FC<InventoryViewProps> = ({
    filteredBeans,
    selectedVariety,
    showEmptyBeans,
    onVarietyClick,
    onToggleShowEmptyBeans,
    availableVarieties,
    beans,
    onEdit,
    onDelete,
    onShare,
    _onRemainingUpdate,
    onQuickDecrement
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
        position: { x: number, y: number } | null
    } | null>(null);

    // 处理剩余量点击
    const handleRemainingClick = (bean: ExtendedCoffeeBean, event: React.MouseEvent) => {
        event.stopPropagation();
        const rect = (event.target as HTMLElement).getBoundingClientRect();
        setEditingRemaining({
            beanId: bean.id,
            value: bean.remaining || '',
            position: {
                x: rect.left,
                y: rect.top + rect.height
            }
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

    return (
        <div className="w-full h-full overflow-y-auto scroll-with-bottom-bar">
            {/* 品种标签筛选 */}
            <div className="relative">
                <div className="border-b border-neutral-200 dark:border-neutral-800 px-6 relative">
                    <div className="flex overflow-x-auto no-scrollbar pr-14">
                        <button
                            onClick={() => onVarietyClick(null)}
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
                                onClick={() => onVarietyClick(variety)}
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
                                onClick={onToggleShowEmptyBeans}
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
                    {filteredBeans.map((bean, index) => (
                        <BeanListItem
                            key={bean.id}
                            bean={bean}
                            title={beanTitles[bean.id]}
                            isLast={index === filteredBeans.length - 1}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onShare={onShare}
                            onRemainingClick={handleRemainingClick}
                        />
                    ))}
                </div>
            )}

            {/* 剩余量编辑弹出层 */}
            <AnimatePresence>
                {editingRemaining && (
                    <RemainingEditor
                        position={editingRemaining.position}
                        onCancel={handleRemainingCancel}
                        onQuickDecrement={handleQuickDecrement}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default InventoryView;