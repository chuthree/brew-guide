'use client';

import React, { useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { ExtendedCoffeeBean, BeanType, BeanState } from '../types';
import BeanListItem from './BeanListItem';
import ImageFlowView from './ImageFlowView';
import TableView from './TableView';
import type { TableColumnKey } from './tableColumns';
import RemainingEditor from './RemainingEditor';
import { showToast } from '@/components/common/feedback/LightToast';
import {
  buildInventoryVirtuosoData,
  getInventoryVirtuosoItemKey,
} from './inventoryVirtualization';

// 显示模式类型
export type DisplayMode = 'list' | 'imageFlow' | 'table';

// 已移除手动分页，改用 react-virtuoso 虚拟列表

type VirtuosoListProps = React.HTMLAttributes<HTMLDivElement> & {
  ref?: React.Ref<HTMLDivElement>;
};

const InventoryVirtuosoList = ({
  style,
  children,
  ref,
  ...props
}: VirtuosoListProps) => (
  <div
    ref={ref}
    style={style}
    className="mx-6 flex flex-col gap-y-3.5"
    {...props}
  >
    {children}
  </div>
);

const InventoryVirtuosoHeader = () => <div className="h-5" />;

const INVENTORY_VIRTUOSO_COMPONENTS = {
  List: InventoryVirtuosoList,
  Header: InventoryVirtuosoHeader,
};
const INVENTORY_VIRTUOSO_OVERSCAN = { top: 240, bottom: 480 };
const EMPTY_EXPANDED_NOTES: Record<string, boolean> = {};
const EMPTY_SELECTED_BEANS: string[] = [];

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
  /** 当咖啡豆用完时的回调 */
  onBeanReducedToZero?: () => void;
  isSearching?: boolean;
  searchQuery?: string;
  isImageFlowMode?: boolean;
  // 新增显示模式 prop，优先级高于 isImageFlowMode
  displayMode?: DisplayMode;
  // 表格可见列配置
  tableVisibleColumns?: TableColumnKey[];
  activeBeanId?: string | null;
  // 备注展开状态相关
  expandedNotes?: Record<string, boolean>;
  onNotesExpandToggle?: (beanId: string, expanded: boolean) => void;
  // 分享模式相关
  isShareMode?: boolean;
  selectedBeans?: string[];
  onToggleSelect?: (beanId: string) => void;
  settings?: {
    dateDisplayMode?: 'date' | 'flavorPeriod' | 'agingDays';
    showFlavorInfo?: boolean;
    showBeanNotes?: boolean;
    showNoteContent?: boolean;
    limitNotesLines?: boolean;
    notesMaxLines?: number;
    showTotalPrice?: boolean;
    showStatusDots?: boolean;
    simplifiedViewLabels?: boolean;
  };
  // 外部滚动容器（Virtuoso 使用）
  scrollParentRef?: HTMLElement;
  readOnly?: boolean;
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
  onBeanReducedToZero,
  isSearching = false,
  searchQuery = '',
  isImageFlowMode = false,
  displayMode: externalDisplayMode,
  tableVisibleColumns,
  activeBeanId,
  expandedNotes = EMPTY_EXPANDED_NOTES,
  onNotesExpandToggle,
  isShareMode = false,
  selectedBeans = EMPTY_SELECTED_BEANS,
  onToggleSelect,
  settings,
  scrollParentRef,
  readOnly = false,
}) => {
  // 剩余量编辑状态
  const [editingRemaining, setEditingRemaining] = useState<{
    beanId: string;
    value: string;
    targetElement: HTMLElement | null;
    bean: ExtendedCoffeeBean;
  } | null>(null);

  const handleDetailClick = (bean: ExtendedCoffeeBean) => {
    // 分享模式下不打开详情页，而是切换选择状态
    if (isShareMode && onToggleSelect) {
      onToggleSelect(bean.id);
      return;
    }
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

  const handleQuickDecrement = async (decrementAmount: number) => {
    if (!editingRemaining) return;
    if (readOnly) {
      setEditingRemaining(null);
      return;
    }

    const { beanId, value, bean } = editingRemaining;
    setEditingRemaining(null);

    try {
      const result = await onQuickDecrement(beanId, value, decrementAmount);
      if (result.success) {
        // 如果咖啡豆用完了，通知父组件
        if (result.reducedToZero && onBeanReducedToZero) {
          onBeanReducedToZero();
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

  const virtuosoData = React.useMemo(() => {
    return buildInventoryVirtuosoData(
      filteredBeans,
      emptyBeans,
      showEmptyBeans
    );
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

  // 确定当前显示模式：优先使用 externalDisplayMode，否则基于 isImageFlowMode 判断
  const currentDisplayMode: DisplayMode = externalDisplayMode
    ? externalDisplayMode
    : isImageFlowMode
      ? 'imageFlow'
      : 'list';

  // 如果是图片流模式，直接返回图片流视图
  if (currentDisplayMode === 'imageFlow') {
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

  // 如果是表格模式，返回表格视图
  if (currentDisplayMode === 'table') {
    return (
      <>
        <TableView
          filteredBeans={filteredBeans}
          emptyBeans={emptyBeans}
          showEmptyBeans={showEmptyBeans}
          onEdit={onEdit}
          onDelete={onDelete}
          onShare={onShare}
          onRate={readOnly ? undefined : onRate}
          onRemainingClick={handleRemainingClick}
          settings={settings}
          visibleColumns={tableVisibleColumns}
          activeBeanId={activeBeanId}
        />
        <RemainingEditor
          targetElement={editingRemaining?.targetElement || null}
          isOpen={!!editingRemaining}
          onOpenChange={open => !open && setEditingRemaining(null)}
          onCancel={() => setEditingRemaining(null)}
          onQuickDecrement={handleQuickDecrement}
          coffeeBean={editingRemaining?.bean}
          readOnly={readOnly}
        />
      </>
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
          <Virtuoso
            data={virtuosoData}
            customScrollParent={scrollParentRef}
            components={INVENTORY_VIRTUOSO_COMPONENTS}
            computeItemKey={getInventoryVirtuosoItemKey}
            increaseViewportBy={INVENTORY_VIRTUOSO_OVERSCAN}
            itemContent={(_index, item) => {
              if (item.type === 'divider') {
                return (
                  <div className="relative -mx-6 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-neutral-200/50 dark:border-neutral-800/50"></div>
                    </div>
                    <div className="relative bg-neutral-50 px-4 text-xs font-medium text-neutral-400 dark:bg-neutral-900 dark:text-neutral-700">
                      用完的咖啡豆
                    </div>
                  </div>
                );
              }

              return (
                <BeanListItem
                  bean={item.bean}
                  isLast={false}
                  onRemainingClick={handleRemainingClick}
                  onDetailClick={handleDetailClick}
                  searchQuery={isSearching ? searchQuery : ''}
                  isNotesExpanded={expandedNotes[item.bean.id]}
                  onNotesExpandToggle={onNotesExpandToggle}
                  isShareMode={isShareMode}
                  isSelected={selectedBeans.includes(item.bean.id)}
                  onToggleSelect={onToggleSelect}
                  settings={settings}
                />
              );
            }}
          />
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
        readOnly={readOnly}
      />
    </div>
  );
};

export default InventoryView;
