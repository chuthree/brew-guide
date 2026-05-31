import { useCallback } from 'react';
import {
  Method,
  Stage,
  commonMethods,
  getBaseEquipmentIdByAnimationType,
  inferBaseEquipmentIdFromCustomEquipmentId,
} from '@/lib/core/config';
import { EditableParams } from './useBrewingParameters';
import { getEquipmentNameById } from '@/lib/utils/equipmentUtils';
import { TabType, BrewingStep } from './useBrewingState';
import { MethodStepConfig } from '@/lib/types/method';
import { hasBrewingStages } from '@/lib/brewing/methodAvailability';
import { showToast } from '@/components/common/feedback/LightToast';

export interface UseMethodSelectorProps {
  selectedEquipment: string | null;
  customMethods: Record<string, Method[]>;
  setSelectedMethod: (method: Method | null) => void;
  setCurrentBrewingMethod: (method: Method | null) => void;
  setEditableParams: (params: EditableParams | null) => void;
  setParameterInfo: (info: {
    equipment: string | null;
    method: string | null;
    params: Record<string, string | undefined> | null;
  }) => void;
  setActiveTab: (tab: TabType) => void;
  setActiveBrewingStep: (step: BrewingStep) => void;
  updateBrewingSteps: (stages: Stage[]) => void;
}

export function useMethodSelector({
  selectedEquipment,
  customMethods,
  setSelectedMethod,
  setCurrentBrewingMethod,
  setEditableParams,
  setParameterInfo,
  setActiveTab,
  setActiveBrewingStep,
  updateBrewingSteps,
}: UseMethodSelectorProps) {
  // 简化方法选择处理
  const processSelectedMethod = useCallback(
    async (method: Method | null) => {
      if (!method) return false;
      if (!hasBrewingStages(method)) {
        showToast({
          type: 'error',
          title: '该方案没有冲煮步骤，请补充步骤后再用于计时',
        });
        return false;
      }

      // 设置选中的方案
      setCurrentBrewingMethod(method);
      setSelectedMethod(method);

      // 设置可编辑参数
      setEditableParams({
        coffee: method.params.coffee || '',
        water: method.params.water || '',
        ratio: method.params.ratio || '',
        grindSize: method.params.grindSize || '',
        temp: method.params.temp || '',
      });

      // 更新注水步骤内容
      updateBrewingSteps(method.params.stages);

      // 更新参数栏信息
      const equipmentName = selectedEquipment
        ? getEquipmentNameById(selectedEquipment, [])
        : null;

      setParameterInfo({
        equipment: equipmentName,
        method: method.name,
        params: {
          coffee: method.params.coffee,
          water: method.params.water,
          ratio: method.params.ratio,
          grindSize: method.params.grindSize,
          temp: method.params.temp,
        },
      });

      // 简单的步骤切换：选择方案后进入注水步骤
      setActiveTab('注水');
      setActiveBrewingStep('brewing');

      return true;
    },
    [
      selectedEquipment,
      setSelectedMethod,
      setCurrentBrewingMethod,
      setEditableParams,
      setParameterInfo,
      updateBrewingSteps,
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
        let targetEquipmentId = selectedEquipment;

        // 检查是否是自定义器具
        const { equipmentList } = await import('@/lib/core/config');
        const customEquipment = equipmentList.find(
          e =>
            (e.id === selectedEquipment || e.name === selectedEquipment) &&
            'animationType' in e
        );

        if (customEquipment && 'animationType' in customEquipment) {
          const animationType = (customEquipment as { animationType?: string })
            .animationType;
          if (animationType === 'custom') {
            // 自定义预设器具不使用通用方案
            targetEquipmentId = '';
          } else if (animationType) {
            targetEquipmentId =
              getBaseEquipmentIdByAnimationType(animationType);
          }
        } else if (selectedEquipment.startsWith('custom-')) {
          // 兼容旧版本：从ID推断器具类型
          targetEquipmentId =
            inferBaseEquipmentIdFromCustomEquipmentId(selectedEquipment);
        }

        method =
          targetEquipmentId && commonMethods?.[targetEquipmentId]?.[methodIndex]
            ? commonMethods[targetEquipmentId][methodIndex]
            : null;
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

        await processSelectedMethod(method);
      }

      return method;
    },
    [customMethods, processSelectedMethod]
  );

  return {
    processSelectedMethod,
    handleMethodSelect,
  };
}
