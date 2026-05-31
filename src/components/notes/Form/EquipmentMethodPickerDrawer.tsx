'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { Method, CustomEquipment } from '@/lib/core/config';
import {
  equipmentList,
  commonMethods,
  getBaseEquipmentIdByAnimationType,
} from '@/lib/core/config';
import { loadCustomEquipments } from '@/lib/stores/customEquipmentStore';
import { loadCustomMethods } from '@/lib/stores/customMethodStore';
import { filterHiddenEquipments } from '@/lib/stores/settingsStore';
import { SettingsOptions } from '@/components/settings/Settings';
import hapticsUtils from '@/lib/ui/haptics';
import EquipmentCategoryBar from './EquipmentCategoryBar';
import MethodSelector from './MethodSelector';
import PickerDrawerFrame from './PickerDrawerFrame';

/**
 * 获取器具对应的通用方案
 */
const getCommonMethodsForEquipment = (
  equipmentId: string,
  availableEquipments: ((typeof equipmentList)[0] | CustomEquipment)[],
  settings?: SettingsOptions
): Method[] => {
  let methods: Method[] = [];

  if (commonMethods[equipmentId]) {
    methods = commonMethods[equipmentId];
  } else {
    const customEquipment = availableEquipments.find(
      eq => eq.id === equipmentId && 'isCustom' in eq && eq.isCustom
    ) as CustomEquipment | undefined;

    if (customEquipment?.animationType) {
      if (customEquipment.animationType.toLowerCase() === 'custom') {
        return [];
      }
      const baseEquipmentId = getBaseEquipmentIdByAnimationType(
        customEquipment.animationType
      );
      methods = commonMethods[baseEquipmentId] || [];
    }
  }

  // 过滤掉隐藏的方案
  if (settings?.hiddenCommonMethods) {
    const hiddenIds = settings.hiddenCommonMethods[equipmentId] || [];
    if (hiddenIds.length > 0) {
      methods = methods.filter(method => {
        const methodId = method.id || method.name;
        return !hiddenIds.includes(methodId);
      });
    }
  }

  return methods;
};

export interface EquipmentMethodSelection {
  equipmentId: string;
  equipmentName: string;
  methodId?: string;
  methodName?: string;
  method?: Method;
}

export interface EquipmentMethodPickerDrawerProps {
  /** 是否打开 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 选择完成回调（选择方案后触发） */
  onSelect: (selection: EquipmentMethodSelection) => void;
  /** 当前选中的器具ID */
  selectedEquipmentId?: string;
  /** 当前选中的方案ID或名称 */
  selectedMethodId?: string;
  /** 笔记保存的方案参数（编辑模式时传入） */
  initialParams?: Partial<Method['params']>;
  /** 设置选项（用于过滤隐藏的器具和方案） */
  settings?: SettingsOptions;
  /** 是否启用触感反馈 */
  hapticFeedback?: boolean;
}

/**
 * 器具方案选择抽屉组件
 * 复用 EquipmentCategoryBar + MethodSelector 组件
 * 设计模式参考 CoffeeBeanPickerDrawer
 */
const EquipmentMethodPickerDrawer: React.FC<
  EquipmentMethodPickerDrawerProps
> = ({
  isOpen,
  onClose,
  onSelect,
  selectedEquipmentId,
  selectedMethodId,
  initialParams,
  settings,
  hapticFeedback = true,
}) => {
  // 数据状态
  const [customEquipments, setCustomEquipments] = useState<CustomEquipment[]>(
    []
  );
  const [customMethodsByEquipment, setCustomMethodsByEquipment] = useState<
    Record<string, Method[]>
  >({});
  const [dataLoaded, setDataLoaded] = useState(false);

  // 选择状态 - 内部临时状态
  const [tempEquipmentId, setTempEquipmentId] = useState<string>(
    selectedEquipmentId || ''
  );
  const [tempMethodId, setTempMethodId] = useState<string>(
    selectedMethodId || ''
  );
  // 保存最后选择的方案对象，用于回调
  const [lastSelectedMethod, setLastSelectedMethod] = useState<
    Method | undefined
  >();

  // 加载自定义数据
  useEffect(() => {
    if (isOpen && !dataLoaded) {
      Promise.all([loadCustomEquipments(), loadCustomMethods()])
        .then(([equipments, methodsByEquipment]) => {
          setCustomEquipments(equipments);
          setCustomMethodsByEquipment(methodsByEquipment);
          setDataLoaded(true);
        })
        .catch(error => console.error('加载数据失败:', error));
    }
  }, [isOpen, dataLoaded]);

  // 处理显示/隐藏动画
  useEffect(() => {
    if (isOpen) {
      // 同步外部状态到内部
      setTempEquipmentId(selectedEquipmentId || '');
      setTempMethodId(selectedMethodId || '');
      setLastSelectedMethod(undefined);
    }
  }, [isOpen, selectedEquipmentId, selectedMethodId]);

  // 触感反馈
  const triggerHaptic = useCallback(() => {
    if (hapticFeedback) {
      hapticsUtils.light();
    }
  }, [hapticFeedback]);

  // 构建可用器具列表
  const availableEquipments = React.useMemo(() => {
    const baseEquipments = [...equipmentList];
    const allEquipments = [...baseEquipments, ...customEquipments];
    return settings ? filterHiddenEquipments(allEquipments) : allEquipments;
  }, [customEquipments, settings]);

  // 获取当前器具的通用方案
  const commonMethodsForEquipment = React.useMemo(() => {
    if (!tempEquipmentId) return [];
    return getCommonMethodsForEquipment(
      tempEquipmentId,
      availableEquipments,
      settings
    );
  }, [tempEquipmentId, availableEquipments, settings]);

  // 获取当前器具的自定义方案
  const customMethodsForEquipment = React.useMemo(() => {
    if (!tempEquipmentId) return [];
    return customMethodsByEquipment[tempEquipmentId] || [];
  }, [tempEquipmentId, customMethodsByEquipment]);

  // 处理器具选择
  const handleEquipmentSelect = useCallback(
    (equipmentId: string) => {
      triggerHaptic();
      setTempEquipmentId(equipmentId);
      // 切换器具时清空方案选择
      setTempMethodId('');
      setLastSelectedMethod(undefined);
    },
    [triggerHaptic]
  );

  // 处理方案选择 - MethodSelector 内部选择方案时触发（只选中，不关闭）
  const handleMethodSelect = useCallback(
    (methodId: string) => {
      triggerHaptic();
      setTempMethodId(methodId);

      // 找到选中的方案
      const allMethods = [
        ...customMethodsForEquipment,
        ...commonMethodsForEquipment,
      ];
      const selectedMethod = allMethods.find(
        m => m.id === methodId || m.name === methodId
      );
      setLastSelectedMethod(selectedMethod);
    },
    [triggerHaptic, customMethodsForEquipment, commonMethodsForEquipment]
  );

  // 处理方案参数变化（MethodSelector 内部编辑参数时）
  const handleParamsChange = useCallback((method: Method) => {
    // 更新最后选择的方案（带修改后的参数）
    setLastSelectedMethod(method);
  }, []);

  // 确认选择
  const handleConfirm = useCallback(() => {
    if (!tempEquipmentId) return;

    triggerHaptic();
    const selectedEquipment = availableEquipments.find(
      eq => eq.id === tempEquipmentId
    );

    // 回调选择结果（使用 lastSelectedMethod 包含修改后的参数）
    onSelect({
      equipmentId: tempEquipmentId,
      equipmentName: selectedEquipment?.name || tempEquipmentId,
      methodId: tempMethodId || undefined,
      methodName: lastSelectedMethod?.name || tempMethodId || undefined,
      method: lastSelectedMethod,
    });

    // 关闭抽屉
    onClose();
  }, [
    triggerHaptic,
    tempEquipmentId,
    tempMethodId,
    availableEquipments,
    lastSelectedMethod,
    onSelect,
    onClose,
  ]);

  return (
    <PickerDrawerFrame
      isOpen={isOpen}
      onClose={onClose}
      historyId="equipment-method-picker-drawer"
    >
      <div className="flex h-full flex-col overflow-hidden px-6 pt-6">
        {/* 器具分类栏 - 复用 EquipmentCategoryBar */}
        <div className="shrink-0">
          <EquipmentCategoryBar
            selectedEquipment={tempEquipmentId}
            customEquipments={customEquipments}
            onEquipmentSelect={handleEquipmentSelect}
            settings={settings}
          />
        </div>

        {/* 方案选择列表 - 复用 MethodSelector */}
        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          <MethodSelector
            selectedEquipment={tempEquipmentId}
            selectedMethod={tempMethodId}
            customMethods={customMethodsForEquipment}
            commonMethods={commonMethodsForEquipment}
            onMethodSelect={handleMethodSelect}
            onParamsChange={handleParamsChange}
            grinderDefaultSyncEnabled={
              settings?.grinderDefaultSync?.manualNote ?? true
            }
            initialParams={initialParams}
          />
        </div>

        {/* 底部按钮 */}
        <div className="flex shrink-0 gap-3 pt-3 pb-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full bg-neutral-100 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!tempEquipmentId}
            className="flex-1 rounded-full bg-neutral-900 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
          >
            确定
          </button>
        </div>
      </div>
    </PickerDrawerFrame>
  );
};

export default EquipmentMethodPickerDrawer;
