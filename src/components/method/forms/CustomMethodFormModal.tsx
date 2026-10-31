'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import CustomMethodForm from '@/components/method/forms/CustomMethodForm';
import type { CustomMethodFormHandle } from '@/components/method/forms/CustomMethodForm';
import {
  useMultiStepModalHistory,
  useModalHistory,
  modalHistory,
} from '@/lib/hooks/useModalHistory';
import MethodImportModal from '@/components/method/import/MethodImportModal';
import PageStackDrawer from '@/components/common/ui/PageStackDrawer';
import type { PageStackDrawerAction } from '@/components/common/ui/PageStackDrawer';
import {
  Method,
  CustomEquipment,
  getAnimationTypeFromEquipmentId,
} from '@/lib/core/config';
import { loadCustomEquipments } from '@/lib/stores/customEquipmentStore';
import { v4 as uuidv4 } from 'uuid';

interface CustomMethodFormModalProps {
  showCustomForm: boolean;
  showImportForm: boolean;
  editingMethod?: Method;
  selectedEquipment: string | null;
  customMethods: Record<string, Method[]>;
  onSaveCustomMethod: (method: Method) => Promise<void>;
  onCloseCustomForm: () => void;
  onCloseImportForm: () => void;
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
}) => {
  const formRef = useRef<CustomMethodFormHandle>(null);
  const [_validationError, setValidationError] = useState<string | null>(null);
  const [_customEquipments, setCustomEquipments] = useState<CustomEquipment[]>(
    []
  );
  const [currentCustomEquipment, setCurrentCustomEquipment] =
    useState<CustomEquipment | null>(null);
  // 多步骤表单的当前步骤状态
  const [currentFormStep, setCurrentFormStep] = useState(1);
  const defaultDrawerChrome = useMemo(
    () => ({
      doneLabel: '下一步',
      doneDisabled: false,
      canGoBack: false,
    }),
    []
  );
  const [drawerChrome, setDrawerChrome] = useState(defaultDrawerChrome);
  const resetFormShell = useCallback(() => {
    setCurrentFormStep(1);
    setDrawerChrome(defaultDrawerChrome);
  }, [defaultDrawerChrome]);

  const isCustomMethodDrawerOpen = showCustomForm && !!currentCustomEquipment;

  // 步骤变化回调 - 用于浏览器返回时
  const handleStepChange = useCallback((step: number) => {
    setCurrentFormStep(step);
  }, []);

  // 使用新的多步骤历史栈管理
  useMultiStepModalHistory({
    id: 'custom-method-form',
    isOpen: isCustomMethodDrawerOpen,
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
      // 新建和导入方案都需要知道当前器具，两个表单都不显示时不加载
      if (!showCustomForm && !showImportForm) return;

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
  }, [selectedEquipment, showCustomForm, showImportForm]); // 只在selectedEquipment或表单显示状态变化时重新加载

  // 根据表单数据保存自定义方法
  const handleSaveMethod = useCallback(
    async (method: Method) => {
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

        // 确保有唯一ID
        const methodWithId: Method = {
          ...method,
          id: method.id || uuidv4(),
        };

        // 直接调用父组件的保存方法并传递完整的方法对象
        await onSaveCustomMethod(methodWithId);

        // 清除错误
        setValidationError(null);

        // 保存成功后直接关闭表单，不通过历史栈返回
        // 直接调用父组件的关闭回调，避免触发 popstate 事件导致表单返回上一步
        resetFormShell();
        onCloseCustomForm();

        return methodWithId.id;
      } catch (error) {
        console.error('保存方案失败:', error);
        setValidationError('保存失败，请重试');
        alert('保存方案失败，请重试');
        return null;
      }
    },
    [onCloseCustomForm, onSaveCustomMethod, resetFormShell]
  );

  // 处理自定义方案表单关闭（使用新的历史栈系统）
  const handleCloseCustomForm = useCallback(() => {
    if (currentFormStep <= 1) {
      resetFormShell();
    }
    modalHistory.back();
  }, [currentFormStep, resetFormShell]);

  const handleDoneCustomForm = useCallback(() => {
    formRef.current?.done();
  }, []);

  const handleSkipStages = useCallback(() => {
    formRef.current?.skipStages();
  }, []);

  const drawerDoneActions = useMemo<PageStackDrawerAction[] | undefined>(() => {
    if (editingMethod || currentFormStep !== 3) {
      return undefined;
    }

    return [
      {
        label: '跳过',
        onClick: handleSkipStages,
      },
      {
        label: drawerChrome.doneLabel,
        onClick: handleDoneCustomForm,
        disabled: drawerChrome.doneDisabled,
      },
    ];
  }, [
    currentFormStep,
    drawerChrome.doneDisabled,
    drawerChrome.doneLabel,
    editingMethod,
    handleDoneCustomForm,
    handleSkipStages,
  ]);

  // 处理导入表单关闭（使用新的历史栈系统）
  const handleCloseImportForm = useCallback(() => {
    modalHistory.back();
  }, []);

  return (
    <>
      <PageStackDrawer
        isOpen={isCustomMethodDrawerOpen}
        title={editingMethod ? '编辑方案' : '添加方案'}
        activeKey={`custom-method-form-${currentFormStep}`}
        canGoBack={drawerChrome.canGoBack}
        backLabel="上一步"
        doneLabel={drawerChrome.doneLabel}
        doneActions={drawerDoneActions}
        doneDisabled={drawerChrome.doneDisabled}
        onCancel={handleCloseCustomForm}
        onBack={handleCloseCustomForm}
        onDone={handleDoneCustomForm}
        historyId="custom-method-form"
      >
        {isCustomMethodDrawerOpen && currentCustomEquipment && (
          <div
            data-modal="custom-method-form"
            className="flex min-h-[calc(88vh-76px)] flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+32px)]"
          >
            <CustomMethodForm
              ref={formRef}
              onSave={handleSaveMethod}
              onBack={handleCloseCustomForm}
              initialMethod={editingMethod}
              customEquipment={currentCustomEquipment}
              currentStep={currentFormStep}
              onStepChange={setCurrentFormStep}
              chromeMode="drawer"
              onChromeChange={setDrawerChrome}
            />
          </div>
        )}
      </PageStackDrawer>

      {/* 导入方案组件 - 使用新的MethodImportModal */}
      <MethodImportModal
        showForm={showImportForm}
        onImport={onSaveCustomMethod}
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
