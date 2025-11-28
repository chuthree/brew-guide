'use client';

import React, { useState, useEffect, useCallback } from 'react';
import BrewingNoteForm from './BrewingNoteForm';
import { MethodSelector, CoffeeBeanSelector } from '@/components/notes/Form';
import EquipmentCategoryBar from './EquipmentCategoryBar';
import { useMethodManagement } from '@/components/notes/Form/hooks/useMethodManagement';
import type { BrewingNoteData, CoffeeBean } from '@/types/app';
import { SettingsOptions } from '@/components/settings/Settings';

import NoteSteppedFormModal, { Step } from './NoteSteppedFormModal';
import { type Method, type CustomEquipment } from '@/lib/core/config';
import { loadCustomEquipments } from '@/lib/managers/customEquipments';
import { useEquipmentStore } from '@/lib/stores/equipmentStore';
// 导入随机选择器组件
import CoffeeBeanRandomPicker from '@/components/coffee-bean/RandomPicker/CoffeeBeanRandomPicker';
import { useCoffeeBeanData } from './hooks/useCoffeeBeanData';
import {
  useMultiStepModalHistory,
  modalHistory,
} from '@/lib/hooks/useModalHistory';

interface BrewingNoteFormModalProps {
  showForm: boolean;
  initialNote?: Partial<BrewingNoteData> & {
    coffeeBean?: CoffeeBean | null;
    id?: string;
  };
  onSave: (note: BrewingNoteData) => void;
  onClose: () => void;
  onSaveSuccess?: () => void;
  settings?: SettingsOptions; // 添加可选的设置参数
}

const BrewingNoteFormModal: React.FC<BrewingNoteFormModalProps> = ({
  showForm,
  initialNote,
  onSave,
  onClose,
  onSaveSuccess,
  settings,
}) => {
  // 使用优化的咖啡豆数据Hook
  const { beans: coffeeBeans } = useCoffeeBeanData();

  // 🎯 直接使用 Zustand store 作为单一数据源
  const selectedEquipment = useEquipmentStore(state => state.selectedEquipment);
  const setSelectedEquipment = useEquipmentStore(
    state => state.setSelectedEquipment
  );

  // 咖啡豆状态
  const [selectedCoffeeBean, setSelectedCoffeeBean] =
    useState<CoffeeBean | null>(initialNote?.coffeeBean || null);

  // 自定义器具列表
  const [customEquipments, setCustomEquipments] = useState<CustomEquipment[]>(
    []
  );

  // 步骤控制
  const [currentStep, setCurrentStep] = useState<number>(0);

  // 随机选择器状态
  const [isRandomPickerOpen, setIsRandomPickerOpen] = useState(false);
  const [isLongPressRandom, setIsLongPressRandom] = useState(false);

  // 使用新的多步骤历史栈管理
  // 步骤从 1 开始，但内部 currentStep 从 0 开始，所以需要 +1
  useMultiStepModalHistory({
    id: 'note-stepped-form',
    isOpen: showForm,
    step: currentStep + 1, // 内部是0开始，历史栈是1开始
    onStepChange: step => {
      // 历史栈返回时更新步骤
      setCurrentStep(step - 1); // 历史栈是1开始，内部是0开始
    },
    onClose: () => {
      // 关闭时重置状态
      setSelectedCoffeeBean(null);
      setSelectedMethod('');
      onClose();
    },
  });

  // 使用方法管理Hook
  const {
    methodType: _methodType,
    selectedMethod,
    availableMethods: _availableMethods,
    customMethods,
    commonMethodsOnly,
    handleMethodTypeChange: _handleMethodTypeChange,
    setSelectedMethod,
  } = useMethodManagement({
    selectedEquipment,
    initialMethod: initialNote?.method,
    customEquipments,
    settings,
  });

  // 处理关闭 - 使用新的历史栈系统
  const handleClose = useCallback(() => {
    modalHistory.back();
  }, []);

  // 处理初始笔记的咖啡豆匹配
  useEffect(() => {
    if (!showForm || !initialNote || coffeeBeans.length === 0) return;

    // 当有初始coffeeBean对象时
    if (initialNote.coffeeBean) {
      setSelectedCoffeeBean(initialNote.coffeeBean);

      // 如果有咖啡豆，自动跳到下一步
      if (!initialNote.id) {
        // 只在创建新笔记时自动跳步
        setCurrentStep(1);
      }
      return;
    }

    // 当有beanId时，尝试从Bean列表中找到对应的豆子
    if (initialNote.beanId) {
      const foundBean = coffeeBeans.find(
        bean => bean.id === initialNote.beanId
      );
      if (foundBean) {
        setSelectedCoffeeBean(foundBean);
        // 如果有咖啡豆，自动跳到下一步
        if (!initialNote.id) {
          // 只在创建新笔记时自动跳步
          setCurrentStep(1);
        }
        return;
      }
    }

    // 当有咖啡豆信息但没有完整对象时，通过名称匹配
    if (initialNote.coffeeBeanInfo?.name) {
      const foundBean = coffeeBeans.find(
        bean => bean.name === initialNote.coffeeBeanInfo?.name
      );
      if (foundBean) {
        setSelectedCoffeeBean(foundBean);
        // 如果有咖啡豆，自动跳到下一步
        if (!initialNote.id) {
          // 只在创建新笔记时自动跳步
          setCurrentStep(1);
        }
      }
    }
  }, [showForm, initialNote, coffeeBeans]);

  // 加载自定义器具列表
  useEffect(() => {
    if (showForm) {
      loadCustomEquipments()
        .then(equipments => setCustomEquipments(equipments))
        .catch(error => console.error('加载自定义器具失败:', error));
    }
  }, [showForm]);

  // 处理器具选择 - 直接使用 Zustand store
  const handleEquipmentSelect = useCallback(
    (equipmentId: string) => {
      setSelectedEquipment(equipmentId);
    },
    [setSelectedEquipment]
  );

  // 处理咖啡豆选择 - 使用函数式更新避免依赖currentStep
  const handleCoffeeBeanSelect = useCallback((bean: CoffeeBean | null) => {
    setSelectedCoffeeBean(bean);
    // 选择咖啡豆后自动前进到下一步
    setCurrentStep(prev => prev + 1);
  }, []);

  // 打开随机选择器
  const handleOpenRandomPicker = (isLongPress: boolean = false) => {
    setIsLongPressRandom(isLongPress);
    setIsRandomPickerOpen(true);
  };

  // 处理随机选择咖啡豆 - 使用useCallback和函数式更新
  const handleRandomBeanSelect = useCallback((bean: CoffeeBean) => {
    setSelectedCoffeeBean(bean);
    // 选择随机咖啡豆后自动前进到下一步
    // 注意：picker 已经在调用 onSelect 之前关闭并清理了历史栈
    setCurrentStep(prev => prev + 1);
  }, []);

  // 处理方法参数变化 - 使用useCallback优化并延迟事件触发
  const _handleMethodParamsChange = useCallback(
    (method: Method) => {
      // 统一使用ID优先的方式标识方案
      const methodIdentifier = method.id || method.name;
      setSelectedMethod(methodIdentifier);

      // 延迟触发事件，避免在渲染期间触发
      setTimeout(() => {
        const event = new CustomEvent('methodParamsChanged', {
          detail: { params: method.params },
        });
        document.dispatchEvent(event);
      }, 0);
    },
    [setSelectedMethod]
  );

  // 获取方案参数
  const getMethodParams = () => {
    if (selectedEquipment && selectedMethod) {
      // 合并所有方案列表以确保查找全面
      const allMethods = [...commonMethodsOnly, ...customMethods];

      // 同时检查ID和名称匹配
      const methodObj = allMethods.find(
        m => m.id === selectedMethod || m.name === selectedMethod
      );

      if (methodObj) {
        return {
          coffee: methodObj.params.coffee,
          water: methodObj.params.water,
          ratio: methodObj.params.ratio,
          grindSize: methodObj.params.grindSize,
          temp: methodObj.params.temp,
        };
      }
    }
    return {
      coffee: '15g',
      water: '225g',
      ratio: '1:15',
      grindSize: '中细',
      temp: '92°C',
    };
  };

  // 设置默认值 - 简化为函数调用，避免复杂的useMemo依赖
  const getDefaultNote = (): Partial<BrewingNoteData> => {
    const params = getMethodParams();
    const isNewNote = !initialNote?.id;

    // 计算总时间
    let totalTime = initialNote?.totalTime || 0;
    if (selectedMethod && !totalTime) {
      const allMethods = [...commonMethodsOnly, ...customMethods];
      const methodObj = allMethods.find(
        m => m.id === selectedMethod || m.name === selectedMethod
      );
      if (methodObj && methodObj.params.stages) {
        totalTime = methodObj.params.stages.reduce(
          (acc, stage) => acc + (stage.time || 0),
          0
        );
      }
    }

    return {
      equipment: selectedEquipment,
      method: selectedMethod || '', // 如果没有选择方案，使用空字符串
      coffeeBean: selectedCoffeeBean,
      coffeeBeanInfo: selectedCoffeeBean
        ? {
            name: selectedCoffeeBean.name || '',
            roastLevel: selectedCoffeeBean.roastLevel || '中度烘焙',
            roastDate: selectedCoffeeBean.roastDate || '',
          }
        : {
            name: initialNote?.coffeeBeanInfo?.name || '',
            roastLevel: initialNote?.coffeeBeanInfo?.roastLevel || '中度烘焙',
            roastDate: initialNote?.coffeeBeanInfo?.roastDate || '',
          },
      params: initialNote?.params || params,
      totalTime: totalTime,
      rating: initialNote?.rating ?? 0,
      taste: initialNote?.taste || {
        acidity: 0,
        sweetness: 0,
        bitterness: 0,
        body: 0,
      },
      notes: initialNote?.notes || '',
      ...(isNewNote ? {} : { id: initialNote?.id }),
    };
  };

  // 处理步骤完成 - 使用useCallback优化并延迟事件触发
  const handleStepComplete = useCallback(() => {
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) {
        form.dispatchEvent(
          new Event('submit', { cancelable: true, bubbles: true })
        );
      }
    }, 0);
  }, []);

  // 处理保存笔记
  const handleSaveNote = (note: BrewingNoteData) => {
    // 获取方案名称
    let methodName = selectedMethod || ''; // 如果没有选择方案，使用空字符串

    if (selectedMethod) {
      // 合并所有方案以便查找
      const allMethods = [...commonMethodsOnly, ...customMethods];

      // 在所有方案中查找匹配的方案
      const methodObj = allMethods.find(
        m => m.id === selectedMethod || m.name === selectedMethod
      );

      if (methodObj) {
        // 如果找到匹配的方案，始终使用其名称
        methodName = methodObj.name;
      }
    }

    // 创建完整笔记
    const completeNote: BrewingNoteData = {
      ...note,
      equipment: selectedEquipment,
      method: methodName,
      // 移除完整的coffeeBean对象，避免可能引起的问题
      coffeeBean: undefined,
      // 重新设置参数以确保使用最新的方案参数
      params: note.params || getMethodParams(),
    };

    // 处理咖啡豆关联
    if (selectedCoffeeBean?.id) {
      completeNote['beanId'] = selectedCoffeeBean.id;

      // 始终设置咖啡豆信息，无论是否已存在
      completeNote.coffeeBeanInfo = {
        name: selectedCoffeeBean.name || '',
        roastLevel: selectedCoffeeBean.roastLevel || '中度烘焙',
        roastDate: selectedCoffeeBean.roastDate || '',
      };

      // 🎯 减少咖啡豆剩余量 - 使用笔记中保存的参数值,而不是方案的原始值
      // 这样才能正确处理用户修改参数的情况
      if (completeNote.params?.coffee) {
        const match = completeNote.params.coffee.match(/(\d+(\.\d+)?)/);
        if (match) {
          const coffeeAmount = parseFloat(match[0]);
          if (coffeeAmount > 0) {
            import('@/lib/managers/coffeeBeanManager')
              .then(({ CoffeeBeanManager }) =>
                CoffeeBeanManager.updateBeanRemaining(
                  selectedCoffeeBean.id,
                  coffeeAmount
                )
              )
              .catch(error => console.error('减少咖啡豆剩余量失败:', error));
          }
        }
      }
    }

    // 保存笔记
    onSave(completeNote);

    // 保存成功后直接关闭，不通过历史栈返回
    // 避免触发 popstate 事件导致表单返回上一步
    // 重置状态
    setSelectedCoffeeBean(null);
    setSelectedMethod('');
    onClose();

    // 如果提供了保存成功回调，则调用它
    if (onSaveSuccess) {
      onSaveSuccess();
    }
  };

  // 定义步骤
  const steps: Step[] = [
    // 只有当有咖啡豆时才添加咖啡豆选择步骤
    ...(coffeeBeans.length > 0
      ? [
          {
            id: 'coffeeBean',
            label: '选择咖啡豆',
            content: (
              <CoffeeBeanSelector
                coffeeBeans={coffeeBeans}
                selectedCoffeeBean={selectedCoffeeBean}
                onSelect={handleCoffeeBeanSelect}
                showStatusDots={settings?.showStatusDots}
              />
            ),
            isValid: true, // 咖啡豆选择为可选
          },
        ]
      : []),
    {
      id: 'method',
      label: '选择方案',
      content: (
        <div>
          {/* 器具分类栏 */}
          <EquipmentCategoryBar
            selectedEquipment={selectedEquipment}
            customEquipments={customEquipments}
            onEquipmentSelect={handleEquipmentSelect}
            settings={settings}
          />
          {/* 方案选择 */}
          {selectedEquipment && (
            <MethodSelector
              selectedEquipment={selectedEquipment}
              selectedMethod={selectedMethod}
              customMethods={customMethods}
              commonMethods={commonMethodsOnly}
              onMethodSelect={setSelectedMethod}
              onParamsChange={_handleMethodParamsChange}
              grinderDefaultSyncEnabled={
                settings?.grinderDefaultSync?.manualNote ?? true
              }
            />
          )}
        </div>
      ),
      isValid: !!selectedEquipment, // 只要选择了设备就有效，方案选择是可选的
    },
    {
      id: 'note-form',
      label: '冲煮笔记',
      content: (
        <BrewingNoteForm
          id={initialNote?.id}
          onClose={() => {}} // 不提供关闭功能，由模态框控制
          onSave={handleSaveNote}
          initialData={getDefaultNote()}
          inBrewPage={true}
          showSaveButton={false}
          onSaveSuccess={onSaveSuccess}
          settings={settings}
        />
      ),
      isValid: true,
    },
  ];

  return (
    <>
      <NoteSteppedFormModal
        showForm={showForm}
        onClose={handleClose}
        onComplete={handleStepComplete}
        steps={steps}
        initialStep={0}
        preserveState={true}
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        onRandomBean={handleOpenRandomPicker}
      />

      {/* 随机选择器 */}
      <CoffeeBeanRandomPicker
        beans={coffeeBeans}
        isOpen={isRandomPickerOpen}
        onClose={() => {
          setIsRandomPickerOpen(false);
          setIsLongPressRandom(false); // 重置长按状态
        }}
        onSelect={handleRandomBeanSelect}
        isLongPress={isLongPressRandom}
      />
    </>
  );
};

export default BrewingNoteFormModal;
