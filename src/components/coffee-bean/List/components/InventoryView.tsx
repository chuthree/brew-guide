'use client';

import React, { useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { ExtendedCoffeeBean, BeanType } from '../types';
import BeanListItem from './BeanListItem';
import ImageFlowView from './ImageFlowView';
import RemainingEditor from './RemainingEditor';

// 已移除手动分页，改用 react-virtuoso 虚拟列表

interface InventoryViewProps {
  filteredBeans: ExtendedCoffeeBean[];
  emptyBeans: ExtendedCoffeeBean[]; // 已用完的豆子
  selectedVariety: string | null;
  showEmptyBeans: boolean;
  selectedBeanType: BeanType;
  beans: ExtendedCoffeeBean[];
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
    limitNotesLines?: boolean;
    notesMaxLines?: number;
    showTotalPrice?: boolean;
    showStatusDots?: boolean;
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
  beans,
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

    const { beanId, value } = editingRemaining;
    setEditingRemaining(null);

    try {
      const result = await onQuickDecrement(beanId, value, decrementAmount);
      if (result.success) {
        const updatedBean = filteredBeans.find(bean => bean.id === beanId);
        if (updatedBean) {
          // 乐观更新本地对象并触发一次重新渲染
          updatedBean.remaining = result.value || '0';
          setRerenderTick(t => t + 1);
        }
      }
    } catch (error) {
      console.error('快捷减量失败:', error);
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
          {searchQuery.trim()
            ? `[ 没有找到匹配"${searchQuery.trim()}"的咖啡豆 ]`
            : selectedVariety
              ? `[ 没有${selectedVariety}品种的咖啡豆 ]`
              : selectedBeanType !== 'all'
                ? `[ 没有${selectedBeanType === 'espresso' ? '意式' : selectedBeanType === 'filter' ? '手冲' : '全能'}咖啡豆 ]`
                : beans.length > 0
                  ? showEmptyBeans
                    ? '[ 暂无咖啡豆，请点击下方按钮添加 ]'
                    : '[ 所有咖啡豆已用完，点击"已用完"查看 ]'
                  : '[ 暂无咖啡豆，请点击下方按钮添加 ]'}
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
                className="mx-6 flex flex-col gap-y-5"
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
