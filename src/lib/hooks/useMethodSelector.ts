import { useCallback } from 'react';
import { Method, type CustomEquipment } from '@/lib/core/config';
import { createBrewingMethod } from '@/lib/brewing/parameters';
import { TabType, BrewingStep } from './useBrewingState';
import { MethodStepConfig } from '@/lib/types/method';
import {
  getCommonMethodsForEquipment,
  hasBrewingStages,
} from '@/lib/brewing/methodAvailability';
import { showToast } from '@/components/common/feedback/LightToast';

export interface UseMethodSelectorProps {
  customMethods: Record<string, Method[]>;
  customEquipments: CustomEquipment[];
  setSelectedMethod: (method: Method | null) => void;
  setCurrentBrewingMethod: (method: Method | null) => void;
  setActiveTab: (tab: TabType) => void;
  setActiveBrewingStep: (step: BrewingStep) => void;
}

export function useMethodSelector({
  customMethods,
  customEquipments,
  setSelectedMethod,
  setCurrentBrewingMethod,
  setActiveTab,
  setActiveBrewingStep,
}: UseMethodSelectorProps) {
  // 简化方法选择处理
  const processSelectedMethod = useCallback(
    (method: Method | null) => {
      if (!method) return false;
      if (!hasBrewingStages(method)) {
        showToast({
          type: 'error',
          title: '该方案没有冲煮步骤，请补充步骤后再用于计时',
        });
        return false;
      }

      // 设置选中的方案
      setCurrentBrewingMethod(createBrewingMethod(method));
      setSelectedMethod(method);

      // 简单的步骤切换：选择方案后进入注水步骤
      setActiveTab('注水');
      setActiveBrewingStep('brewing');

      return true;
    },
    [
      setSelectedMethod,
      setCurrentBrewingMethod,
      setActiveTab,
      setActiveBrewingStep,
    ]
  );

  const handleMethodSelect = useCallback(
    async (
      selectedEquipment: string,
      methodIndex: number,
      methodType: string,
      step?: MethodStepConfig
    ): Promise<Method | null> => {
      if (!selectedEquipment?.trim()) {
        return null;
      }

      let method: Method | null = null;

      // 获取方法：自定义方案
      if (methodType === 'predefined' || methodType === 'custom') {
        method = customMethods?.[selectedEquipment]?.[methodIndex] || null;
      }
      // 获取方法：通用方案
      else if (methodType === 'common') {
        method =
          getCommonMethodsForEquipment(selectedEquipment, customEquipments)[
            methodIndex
          ] || null;
      }

      if (method) {
        // 应用自定义参数（如果有）
        if (step?.customParams) {
          method = {
            ...method,
            params: {
              ...method.params,
              ...Object.fromEntries(
                Object.entries(step.customParams)
                  .filter(([key]) => key !== 'stages' && key in method!.params)
                  .map(([key, value]) => [key, String(value)])
              ),
            },
          };
        }

        if (!processSelectedMethod(method)) return null;
      }

      return method;
    },
    [customEquipments, customMethods, processSelectedMethod]
  );

  return {
    handleMethodSelect,
  };
}
