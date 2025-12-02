'use client';

import React, { useState, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { ExtendedCoffeeBean, BeanType, BeanState } from '../types';
import BeanListItem from './BeanListItem';
import ImageFlowView from './ImageFlowView';
import RemainingEditor from './RemainingEditor';
import { showToast } from '@/components/common/feedback/LightToast';

// 已移除手动分页，改用 react-virtuoso 虚拟列表

/** 获取空状态提示消息 */
const getEmptyStateMessage = ({
  searchQuery,
  selectedVariety,
  selectedBeanType,
  hasEmptyBeansInCurrentState,
  showEmptyBeans,
  isGreenBean,
}: {
  searchQuery: string;
  selectedVariety: string | null;
  selectedBeanType: BeanType;
  hasEmptyBeansInCurrentState: boolean;
  showEmptyBeans: boolean;
  isGreenBean: boolean;
}): string => {
  const beanLabel = isGreenBean ? '生豆' : '咖啡豆';

  if (searchQuery.trim()) {
    return `[ 没有找到匹配"${searchQuery.trim()}"的${beanLabel} ]`;
  }

  if (selectedVariety) {
    return `[ 没有${selectedVariety}品种的${beanLabel} ]`;
  }

  if (selectedBeanType !== 'all') {
    const typeLabel =
      selectedBeanType === 'espresso'
        ? '意式'
        : selectedBeanType === 'filter'
          ? '手冲'
          : '全能';
    return `[ 没有${typeLabel}${beanLabel} ]`;
  }

  if (hasEmptyBeansInCurrentState && !showEmptyBeans) {
    return `[ 所有${beanLabel}已用完，点击"已用完"查看 ]`;
  }

  return `[ 暂无${beanLabel}，请点击下方按钮添加 ]`;
};

interface InventoryViewProps {
  filteredBeans: ExtendedCoffeeBean[];
  emptyBeans: ExtendedCoffeeBean[]; // 已用完的豆子
  selectedVariety: string | null;
  showEmptyBeans: boolean;
  selectedBeanType: BeanType;
  selectedBeanState?: BeanState;
  /** 当前状态下是否存在已用完的豆子（由父组件计算传入） */
  hasEmptyBeansInCurrentState?: boolean;
  onEdit: (bean: ExtendedCoffeeBean) => void;
  onDelete: (bean: ExtendedCoffeeBean) => void;
  onShare: (bean: ExtendedCoffeeBean) => void;
  onRate?: (bean: ExtendedCoffeeBean) => void;
  onQuickDecrement: (
    beanId: string,
    currentValue: string,
    decrementAmount: number
  ) => Promise<{
    success: boolean;
    value?: string;
    reducedToZero?: boolean;
    error?: Error;
  }>;
  isSearching?: boolean;
  searchQuery?: string;
  isImageFlowMode?: boolean;
  // 备注展开状态相关
  expandedNotes?: Record<string, boolean>;
  onNotesExpandToggle?: (beanId: string, expanded: boolean) => void;
  settings?: {
    dateDisplayMode?: 'date' | 'flavorPeriod' | 'agingDays';
    showOnlyBeanName?: boolean;
    showFlavorInfo?: boolean;
    showBeanNotes?: boolean;
    limitNotesLines?: boolean;
    notesMaxLines?: number;
    showTotalPrice?: boolean;
    showStatusDots?: boolean;
    simplifiedViewLabels?: boolean;
  };
  // 外部滚动容器（Virtuoso 使用）
  scrollParentRef?: HTMLElement;
}

const InventoryView: React.FC<InventoryViewProps> = ({
  filteredBeans,
  emptyBeans,
  selectedVariety,
  showEmptyBeans,
  selectedBeanType,
  selectedBeanState = 'roasted',
  hasEmptyBeansInCurrentState = false,
  onEdit,
  onDelete,
  onShare,
  onRate,
  onQuickDecrement,
  isSearching = false,
  searchQuery = '',
  isImageFlowMode = false,
  expandedNotes = {},
  onNotesExpandToggle,
  settings,
  scrollParentRef,
}) => {
  // 剩余量编辑状态
  const [editingRemaining, setEditingRemaining] = useState<{
    beanId: string;
    value: string;
    targetElement: HTMLElement | null;
    bean: ExtendedCoffeeBean;
  } | null>(null);

  const handleDetailClick = (bean: ExtendedCoffeeBean) => {
    // 通过事件打开详情页
    window.dispatchEvent(
      new CustomEvent('beanDetailOpened', {
        detail: {
          bean,
          searchQuery: isSearching ? searchQuery : '',
        },
      })
    );
  };

  const handleRemainingClick = (
    bean: ExtendedCoffeeBean,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();
    const target = event.target as HTMLElement;

    if (!target || !document.body.contains(target)) return;

    setEditingRemaining({
      beanId: bean.id,
      value: bean.remaining || '',
      targetElement: target,
      bean: bean,
    });
  };

  const [_rerenderTick, setRerenderTick] = useState(0);

  const handleQuickDecrement = async (decrementAmount: number) => {
    if (!editingRemaining) return;

    const { beanId, value, bean } = editingRemaining;
    setEditingRemaining(null);

    try {
      const result = await onQuickDecrement(beanId, value, decrementAmount);
      if (result.success) {
        const updatedBean = filteredBeans.find(b => b.id === beanId);
        if (updatedBean) {
          // 乐观更新本地对象并触发一次重新渲染
          updatedBean.remaining = result.value || '0';
          setRerenderTick(t => t + 1);
        }
      } else if (result.error) {
        // 显示错误提示
        const isGreenBean = bean?.beanState === 'green';
        const errorMessage = result.error.message || '操作失败，请重试';
        showToast({
          type: 'error',
          title: isGreenBean
            ? `烘焙失败: ${errorMessage}`
            : `扣除失败: ${errorMessage}`,
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('快捷减量失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      showToast({
        type: 'error',
        title: `操作失败: ${errorMessage}`,
        duration: 3000,
      });
    }
  };

  // 兼容之前编辑剩余量时的就地更新
  // 虚拟列表场景下直接依赖 filteredBeans 的外部更新即可

  // 构建虚拟列表的数据结构
  // 包含正常豆子、分割线（如果有已用完的豆子）、已用完的豆子
  const virtuosoData = React.useMemo(() => {
    const items: Array<
      { type: 'bean'; bean: ExtendedCoffeeBean } | { type: 'divider' }
    > = [];

    // 添加正常豆子
    filteredBeans.forEach(bean => {
      items.push({ type: 'bean', bean });
    });

    // 只有在同时存在正常豆子和已用完的豆子时才显示分割线
    if (showEmptyBeans && emptyBeans.length > 0 && filteredBeans.length > 0) {
      items.push({ type: 'divider' });
    }

    // 添加已用完的豆子
    if (showEmptyBeans && emptyBeans.length > 0) {
      emptyBeans.forEach(bean => {
        items.push({ type: 'bean', bean });
      });
    }

    return items;
  }, [filteredBeans, emptyBeans, showEmptyBeans]);

  // 判断是否为生豆
  const isGreenBean = selectedBeanState === 'green';

  // 获取空状态提示消息
  const emptyStateMessage = getEmptyStateMessage({
    searchQuery,
    selectedVariety,
    selectedBeanType,
    hasEmptyBeansInCurrentState,
    showEmptyBeans,
    isGreenBean,
  });

  // 如果是图片流模式，直接返回图片流视图
  if (isImageFlowMode) {
    return (
      <ImageFlowView
        filteredBeans={filteredBeans}
        emptyBeans={emptyBeans}
        showEmptyBeans={showEmptyBeans}
        onEdit={onEdit}
        onDelete={onDelete}
        onShare={onShare}
        onRate={onRate}
      />
    );
  }

  return (
    <div className="inventory-view-container relative h-full w-full">
      {filteredBeans.length === 0 && emptyBeans.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
          {emptyStateMessage}
        </div>
      ) : (
        <div className="pb-64">
          {(() => {
            const VirtuosoList = React.forwardRef<
              HTMLDivElement,
              React.HTMLAttributes<HTMLDivElement>
            >(({ style, children, ...props }, ref) => (
              <div
                ref={ref}
                style={style}
                className="mx-6 flex flex-col gap-y-4"
                {...props}
              >
                {children}
              </div>
            ));
            VirtuosoList.displayName = 'VirtuosoList';

            return (
              <Virtuoso
                data={virtuosoData}
                customScrollParent={scrollParentRef}
                components={{
                  List: VirtuosoList,
                  Header: () => <div className="h-5" />,
                }}
                itemContent={(_index, item) => {
                  if (item.type === 'divider') {
                    // 渲染分割线
                    return (
                      <div className="relative -mx-6 flex items-center justify-center">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-neutral-200 dark:border-neutral-800"></div>
                        </div>
                        <div className="relative bg-neutral-50 px-4 text-xs font-medium text-neutral-400 dark:bg-neutral-900 dark:text-neutral-700">
                          用完的咖啡豆
                        </div>
                      </div>
                    );
                  } else {
                    // 渲染豆子项
                    return (
                      <BeanListItem
                        key={item.bean.id}
                        bean={item.bean}
                        isLast={false}
                        onRemainingClick={handleRemainingClick}
                        onDetailClick={handleDetailClick}
                        searchQuery={isSearching ? searchQuery : ''}
                        isNotesExpanded={expandedNotes[item.bean.id]}
                        onNotesExpandToggle={onNotesExpandToggle}
                        settings={settings}
                      />
                    );
                  }
                }}
              />
            );
          })()}
        </div>
      )}

      {/* 剩余量编辑弹出层 */}
      <RemainingEditor
        targetElement={editingRemaining?.targetElement || null}
        isOpen={!!editingRemaining}
        onOpenChange={open => !open && setEditingRemaining(null)}
        onCancel={() => setEditingRemaining(null)}
        onQuickDecrement={handleQuickDecrement}
        coffeeBean={editingRemaining?.bean}
      />
    </div>
  );
};

export default InventoryView;
