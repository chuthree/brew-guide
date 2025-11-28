'use client';

import React, { useState, useEffect, useCallback } from 'react';
import CustomMethodForm from '@/components/method/forms/CustomMethodForm';
import {
  useMultiStepModalHistory,
  useModalHistory,
  modalHistory,
} from '@/lib/hooks/useModalHistory';
import MethodImportModal from '@/components/method/import/MethodImportModal';
import { Method, CustomEquipment } from '@/lib/core/config';
import { loadCustomEquipments } from '@/lib/managers/customEquipments';
import { v4 as uuidv4 } from 'uuid';

interface CustomMethodFormModalProps {
  showCustomForm: boolean;
  showImportForm: boolean;
  editingMethod?: Method;
  selectedEquipment: string | null;
  customMethods: Record<string, Method[]>;
  onSaveCustomMethod: (method: Method) => void;
  onCloseCustomForm: () => void;
  onCloseImportForm: () => void;
  /** 磨豆机同步默认开关状态 */
  grinderDefaultSyncEnabled?: boolean;
}

const CustomMethodFormModal: React.FC<CustomMethodFormModalProps> = ({
  showCustomForm,
  showImportForm,
  editingMethod,
  selectedEquipment,
  customMethods,
  onSaveCustomMethod,
  onCloseCustomForm,
  onCloseImportForm,
  grinderDefaultSyncEnabled = false,
}) => {
  const [_validationError, setValidationError] = useState<string | null>(null);
  const [_customEquipments, setCustomEquipments] = useState<CustomEquipment[]>(
    []
  );
  const [currentCustomEquipment, setCurrentCustomEquipment] =
    useState<CustomEquipment | null>(null);

  // 多步骤表单的当前步骤状态
  const [currentFormStep, setCurrentFormStep] = useState(1);

  // 步骤变化回调 - 用于浏览器返回时
  const handleStepChange = useCallback((step: number) => {
    setCurrentFormStep(step);
  }, []);

  // 使用新的多步骤历史栈管理
  useMultiStepModalHistory({
    id: 'custom-method-form',
    isOpen: showCustomForm && !!currentCustomEquipment,
    step: currentFormStep,
    onStepChange: handleStepChange,
    onClose: onCloseCustomForm,
  });

  // 导入表单使用单个模态框历史栈管理
  useModalHistory({
    id: 'method-import-form',
    isOpen: showImportForm,
    onClose: onCloseImportForm,
  });

  // 加载自定义器具 - 优化为仅在首次挂载和选择新器具时加载
  useEffect(() => {
    const fetchCustomEquipments = async () => {
      if (!showCustomForm) return; // 不显示表单时不加载

      try {
        const equipments = await loadCustomEquipments();
        setCustomEquipments(equipments);

        // 直接在这里设置currentCustomEquipment，避免依赖另一个useEffect
        if (selectedEquipment) {
          // 首先检查是否是自定义器具
          const customEquipment = equipments.find(
            e => e.id === selectedEquipment || e.name === selectedEquipment
          );

          if (customEquipment) {
            setCurrentCustomEquipment(customEquipment);
          } else {
            // 如果不是自定义器具，创建一个虚拟的自定义器具对象，基于标准器具
            const virtualCustomEquipment: CustomEquipment = {
              id: selectedEquipment,
              name: selectedEquipment,
              isCustom: true,
              animationType: getAnimationTypeFromEquipmentId(selectedEquipment),
              hasValve: selectedEquipment === 'CleverDripper',
            };
            setCurrentCustomEquipment(virtualCustomEquipment);
          }
        }
      } catch (error) {
        console.error('[CustomMethodFormModal] 加载自定义器具失败:', error);
      }
    };

    fetchCustomEquipments();
  }, [selectedEquipment, showCustomForm]); // 只在selectedEquipment或showCustomForm变化时重新加载

  // 根据标准器具ID获取动画类型
  const getAnimationTypeFromEquipmentId = (
    equipmentId: string | null
  ): 'v60' | 'kalita' | 'origami' | 'clever' | 'custom' | 'espresso' => {
    if (!equipmentId) return 'custom';

    switch (equipmentId) {
      case 'V60':
        return 'v60';
      case 'Kalita':
        return 'kalita';
      case 'Origami':
        return 'origami';
      case 'CleverDripper':
        return 'clever';
      case 'Espresso':
        return 'espresso';
      default:
        return 'custom';
    }
  };

  // 根据表单数据保存自定义方法
  const handleSaveMethod = async (method: Method) => {
    try {
      // 检查必要字段
      if (!method.name) {
        setValidationError('请输入方案名称');
        return null;
      }

      if (!method.params?.coffee || !method.params?.water) {
        setValidationError('请输入咖啡粉量和水量');
        return null;
      }

      if (!method.params.stages || method.params.stages.length === 0) {
        setValidationError('至少需要添加一个阶段');
        return null;
      }

      // 确保有唯一ID
      const methodWithId: Method = {
        ...method,
        id: method.id || uuidv4(),
      };

      // 直接调用父组件的保存方法并传递完整的方法对象
      onSaveCustomMethod(methodWithId);

      // 清除错误
      setValidationError(null);

      // 保存成功后直接关闭表单，不通过历史栈返回
      // 直接调用父组件的关闭回调，避免触发 popstate 事件导致表单返回上一步
      onCloseCustomForm();

      return methodWithId.id;
    } catch (error) {
      console.error('保存方案失败:', error);
      setValidationError('保存失败，请重试');
      return null;
    }
  };

  // 重置表单步骤当表单关闭时
  useEffect(() => {
    if (!showCustomForm) {
      setCurrentFormStep(1);
    }
  }, [showCustomForm]);

  // 处理自定义方案表单关闭（使用新的历史栈系统）
  const handleCloseCustomForm = useCallback(() => {
    modalHistory.back();
  }, []);

  // 处理导入表单关闭（使用新的历史栈系统）
  const handleCloseImportForm = useCallback(() => {
    modalHistory.back();
  }, []);

  return (
    <>
      {/* 自定义方案表单 - 只在设备信息加载完成后显示 */}
      {showCustomForm && currentCustomEquipment && (
        <div
          data-modal="custom-method-form"
          className="pt-safe-top pb-safe-bottom fixed inset-0 inset-x-0 bottom-0 z-50 mx-auto flex h-full max-w-[500px] flex-col overflow-hidden bg-neutral-50 px-6 dark:bg-neutral-900"
        >
          <CustomMethodForm
            onSave={handleSaveMethod}
            onBack={handleCloseCustomForm}
            initialMethod={editingMethod}
            customEquipment={currentCustomEquipment}
            currentStep={currentFormStep}
            onStepChange={setCurrentFormStep}
            grinderDefaultSyncEnabled={grinderDefaultSyncEnabled}
          />
        </div>
      )}

      {/* 导入方案组件 - 使用新的MethodImportModal */}
      <MethodImportModal
        showForm={showImportForm}
        onImport={method => {
          onSaveCustomMethod(method);
          // 不在这里关闭，让MethodImportModal内部的handleImport来处理关闭
          // handleCloseImportForm();
        }}
        onClose={handleCloseImportForm}
        existingMethods={
          selectedEquipment && customMethods[selectedEquipment]
            ? customMethods[selectedEquipment]
            : []
        }
        customEquipment={currentCustomEquipment || undefined}
      />
    </>
  );
};

export default CustomMethodFormModal;
