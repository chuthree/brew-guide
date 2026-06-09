'use client';

import React, { useState, useEffect } from 'react';
import {
  motion,
  AnimatePresence,
  Reorder,
  useDragControls,
} from 'framer-motion';
import { GripVertical, Edit, Trash2, Share2, X, EyeOff } from 'lucide-react';
import type {
  CustomEquipment,
  EquipmentAnimationType,
} from '@/lib/core/config';
import hapticsUtils from '@/lib/ui/haptics';
import { SettingsOptions } from '@/components/settings/Settings';
import { useEquipmentList } from '@/lib/equipment/useEquipmentList';
import {
  getEquipmentDisplayName,
  getEquipmentDisplayParts,
} from '@/lib/equipment/displayName';
import { createEditableEquipmentFromPreset } from '@/lib/equipment/editableEquipment';
import { useThemeColor } from '@/lib/hooks/useThemeColor';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { useSettingsStore } from '@/lib/stores/settingsStore';

interface EquipmentManagementDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  customEquipments: CustomEquipment[];
  onAddEquipment: () => void;
  onEditEquipment: (equipment: CustomEquipment) => void;
  onDeleteEquipment: (equipment: CustomEquipment) => void;
  onShareEquipment: (equipment: CustomEquipment) => void;
  settings: SettingsOptions;
}

interface EquipmentWithActions {
  id: string;
  name: string;
  note?: string;
  showActions?: boolean;
  isSystem?: boolean; // true 表示系统器具，false 表示自定义器具
  // 自定义器具的特有属性（可选）
  animationType?: EquipmentAnimationType;
  hasValve?: boolean;
  isCustom?: true;
  customShapeSvg?: string;
  customValveSvg?: string;
  customValveOpenSvg?: string;
  customPourAnimations?: Array<{
    id: string;
    name: string;
    customAnimationSvg: string;
    isSystemDefault?: boolean;
    pourType?: 'center' | 'circle' | 'ice' | 'bypass';
    previewFrames?: number;
    frames?: Array<{
      id: string;
      svgData: string;
    }>;
  }>;
}

type EquipmentAction = 'edit' | 'delete' | 'share' | 'hide';

interface EquipmentRowProps {
  equipment: EquipmentWithActions;
  onDragEnd: () => void;
  onToggleActions: (equipmentId: string) => void;
  onAction: (action: EquipmentAction, equipment: EquipmentWithActions) => void;
}

const EquipmentRow: React.FC<EquipmentRowProps> = ({
  equipment,
  onDragEnd,
  onToggleActions,
  onAction,
}) => {
  const dragControls = useDragControls();
  const { name: equipmentName, customSuffix } =
    getEquipmentDisplayParts(equipment);
  const equipmentDisplayName = getEquipmentDisplayName(equipment);

  return (
    <Reorder.Item
      value={equipment}
      dragControls={dragControls}
      dragListener={false}
      onDragEnd={onDragEnd}
      whileDrag={{
        scale: 1.01,
        transition: { duration: 0.1 },
      }}
      style={{
        listStyle: 'none',
      }}
    >
      <motion.div
        className="flex items-center py-3"
        whileDrag={{
          backgroundColor: 'transparent',
          transition: { duration: 0.1 },
        }}
      >
        <button
          type="button"
          aria-label={`拖动调整 ${equipmentDisplayName} 排序`}
          title="拖动排序"
          onPointerDown={event => dragControls.start(event)}
          className="mr-3 cursor-grab rounded-md p-1 pl-0 transition-colors duration-150 active:cursor-grabbing"
        >
          <motion.span
            className="flex"
            whileDrag={{
              color: 'rgb(107 114 128)',
              transition: { duration: 0.1 },
            }}
          >
            <GripVertical className="h-4 w-4 text-neutral-400 transition-colors duration-150 dark:text-neutral-500" />
          </motion.span>
        </button>

        <motion.span
          className="flex min-w-0 flex-1 items-baseline text-base font-medium text-neutral-700 transition-colors duration-150 dark:text-neutral-200"
          whileDrag={{
            color: 'rgb(107 114 128)',
            transition: { duration: 0.1 },
          }}
          title={equipmentDisplayName}
        >
          <span className={equipment.showActions ? 'truncate' : undefined}>
            {equipmentName}
          </span>
          {customSuffix && (
            <span className="ml-1 shrink-0 text-neutral-400 dark:text-neutral-500">
              {customSuffix}
            </span>
          )}
        </motion.span>

        <div className="flex items-center justify-end">
          <AnimatePresence mode="wait">
            {equipment.showActions ? (
              <motion.div
                initial={{ opacity: 0, filter: 'blur(4px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, filter: 'blur(4px)' }}
                transition={{ duration: 0.2 }}
                className="flex items-center space-x-1"
              >
                <button
                  type="button"
                  onClick={() => onAction('edit', equipment)}
                  className="rounded-md p-2 transition-colors duration-150 hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                >
                  <Edit className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                </button>
                <button
                  type="button"
                  onClick={() => onAction('share', equipment)}
                  className="rounded-md p-2 transition-colors duration-150 hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                >
                  <Share2 className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                </button>
                {equipment.isSystem ? (
                  <button
                    type="button"
                    onClick={() => onAction('hide', equipment)}
                    className="rounded-md p-2 transition-colors duration-150 hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                  >
                    <EyeOff className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAction('delete', equipment)}
                    className="rounded-md p-2 transition-colors duration-150 hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                  >
                    <Trash2 className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onToggleActions(equipment.id)}
                  className="rounded-md p-2 transition-colors duration-150 hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                >
                  <X className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                </button>
              </motion.div>
            ) : (
              <motion.button
                type="button"
                initial={{
                  opacity: 0.6,
                  filter: 'blur(2px)',
                }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0.6, filter: 'blur(2px)' }}
                transition={{ duration: 0.2 }}
                onClick={() => onToggleActions(equipment.id)}
                className="rounded-md p-2 transition-all duration-150 hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
              >
                <span className="flex h-4 w-4 items-center justify-center text-lg leading-none font-bold text-neutral-600 select-none dark:text-neutral-400">
                  ⋯
                </span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </Reorder.Item>
  );
};

const EquipmentManagementDrawer: React.FC<EquipmentManagementDrawerProps> = ({
  isOpen,
  onClose,
  customEquipments,
  onAddEquipment,
  onEditEquipment,
  onDeleteEquipment,
  onShareEquipment,
  settings,
}) => {
  // 动画状态管理
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // 同步顶部安全区颜色
  useThemeColor({ useOverlay: true, enabled: isOpen });

  // 使用自定义Hook管理器具列表
  const { allEquipments: baseEquipments } = useEquipmentList({
    customEquipments,
    settings, // 传入设置以过滤隐藏的器具
  });

  // 本地状态管理器具的操作显示状态
  const [allEquipments, setAllEquipments] = useState<EquipmentWithActions[]>(
    []
  );
  const pendingOrderRef = React.useRef<EquipmentWithActions[] | null>(null);

  // 处理显示/隐藏动画
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 同步基础器具列表到本地状态，添加操作状态
  React.useEffect(() => {
    const equipmentsWithActions = baseEquipments.map(
      eq =>
        ({
          ...eq,
          showActions: false,
          isSystem: !('isCustom' in eq && eq.isCustom),
        }) as EquipmentWithActions
    );
    pendingOrderRef.current = null;
    setAllEquipments(equipmentsWithActions);
  }, [baseEquipments]);

  const triggerHaptic = React.useCallback(async () => {
    if (settings?.hapticFeedback) {
      await hapticsUtils.light();
    }
  }, [settings?.hapticFeedback]);

  const handleReorder = React.useCallback(
    (newOrder: EquipmentWithActions[]) => {
      pendingOrderRef.current = newOrder;
      setAllEquipments(newOrder);
    },
    []
  );

  // 拖拽中只更新本地顺序，松手后再持久化一次，避免外部刷新打断 Reorder 状态。
  const persistReorder = React.useCallback(async () => {
    const orderToSave = pendingOrderRef.current;
    if (!orderToSave) return;

    pendingOrderRef.current = null;

    try {
      const visibleIds = orderToSave.map(equipment => equipment.id);
      const currentOrder = settings.equipmentOrder || [];
      const nextOrder = [
        ...visibleIds,
        ...currentOrder.filter(id => !visibleIds.includes(id)),
      ];

      // 保存排序
      await useSettingsStore.getState().setEquipmentOrder(nextOrder);

      // 通知所有器具栏组件更新
      const { equipmentEventBus } =
        await import('@/lib/equipment/equipmentEventBus');
      equipmentEventBus.notify();
    } catch (error) {
      pendingOrderRef.current = orderToSave;
      console.error('保存器具排序失败:', error);
    }
  }, [settings.equipmentOrder]);

  const handleDragEnd = React.useCallback(() => {
    void persistReorder();
  }, [persistReorder]);

  // 切换操作按钮显示
  const toggleActions = async (equipmentId: string) => {
    await triggerHaptic();
    setAllEquipments(prev =>
      prev.map(eq => ({
        ...eq,
        showActions: eq.id === equipmentId ? !eq.showActions : false,
      }))
    );
  };

  // 处理操作按钮点击
  const handleAction = async (
    action: EquipmentAction,
    equipment: EquipmentWithActions
  ) => {
    await triggerHaptic();

    // 隐藏操作按钮
    setAllEquipments(prev => prev.map(eq => ({ ...eq, showActions: false })));

    // 隐藏操作对所有器具都可用
    if (action === 'hide') {
      try {
        // 使用 settingsStore 隐藏器具
        await useSettingsStore.getState().hideEquipment(equipment.id);

        // 通知设置变更
        window.dispatchEvent(new CustomEvent('settingsChanged'));

        // 从列表中移除隐藏的器具
        setAllEquipments(prev => prev.filter(eq => eq.id !== equipment.id));
      } catch (error) {
        console.error('隐藏器具失败:', error);
        alert('隐藏器具失败，请重试');
      }
      return;
    }

    if (action === 'delete') {
      if (!equipment.isSystem && equipment.isCustom) {
        onDeleteEquipment(equipment as CustomEquipment);
      }
      return;
    }

    if (action === 'edit' || action === 'share') {
      const editableEquipment =
        !equipment.isSystem && equipment.isCustom
          ? (equipment as CustomEquipment)
          : createEditableEquipmentFromPreset(equipment);

      if (action === 'edit') {
        onEditEquipment(editableEquipment);
      } else {
        onShareEquipment(editableEquipment);
      }
    }
  };

  // 处理添加设备
  const handleAddEquipment = async () => {
    await triggerHaptic();
    onAddEquipment();
  };

  // 使用统一的历史栈管理
  useModalHistory({
    id: 'equipment-management',
    isOpen,
    onClose,
  });

  // 处理关闭 - 使用统一历史栈
  const handleClose = React.useCallback(() => {
    modalHistory.back();
  }, []);

  if (!shouldRender) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div
        data-modal={isOpen ? 'equipment-management' : undefined}
        className={`fixed inset-0 bg-black/50 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'} `}
        onClick={handleClose}
      />

      {/* 抽屉内容 */}
      <div
        className={`fixed right-0 bottom-0 left-0 mx-auto max-w-md rounded-t-3xl bg-neutral-50 backdrop-blur-xl transition-transform duration-350 ease-[cubic-bezier(0.36,0.66,0.04,1)] dark:bg-neutral-900 ${isVisible ? 'translate-y-0' : 'translate-y-full'} `}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-600" />
        </div>

        <div className="px-6 pb-6">
          <motion.div className="mb-5 flex items-center justify-between">
            <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
              器具列表
            </h3>
            <button
              onClick={handleAddEquipment}
              className="flex items-center justify-center rounded-full bg-neutral-100 px-3 py-1 transition-all duration-150 active:scale-95 active:opacity-80 dark:bg-neutral-800"
            >
              <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
                + 添加器具
              </span>
            </button>
          </motion.div>{' '}
          <div className="pb-safe-bottom max-h-[85vh] space-y-2 overflow-x-hidden overflow-y-auto">
            {allEquipments.length > 0 ? (
              <div className="space-y-2">
                <Reorder.Group
                  axis="y"
                  values={allEquipments}
                  onReorder={handleReorder}
                  className="space-y-2"
                >
                  {allEquipments.map(equipment => (
                    <EquipmentRow
                      key={equipment.id}
                      equipment={equipment}
                      onDragEnd={handleDragEnd}
                      onToggleActions={toggleActions}
                      onAction={(action, rowEquipment) => {
                        void handleAction(action, rowEquipment);
                      }}
                    />
                  ))}
                </Reorder.Group>
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="mb-2 text-sm text-neutral-500 dark:text-neutral-400">
                  暂无自定义器具
                </p>
                <button
                  onClick={handleAddEquipment}
                  className="text-xs text-neutral-600 transition-colors duration-150 hover:text-neutral-800 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200"
                >
                  点击添加
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default EquipmentManagementDrawer;
