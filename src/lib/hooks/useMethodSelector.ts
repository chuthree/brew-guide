import { useCallback } from 'react';
import { Method, Stage, commonMethods } from '@/lib/core/config';
import { EditableParams } from './useBrewingParameters';
import { getEquipmentNameById } from '@/lib/utils/equipmentUtils';
import { TabType, BrewingStep } from './useBrewingState';
import { MethodStepConfig, MethodType } from '@/lib/types/method';

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

/**
 * 根据自定义器具的动画类型获取基础器具ID
 */
function getBaseEquipmentId(animationType: string): string {
  const mapping: Record<string, string> = {
    v60: 'V60',
    clever: 'CleverDripper',
    espresso: 'Espresso',
    kalita: 'Kalita',
    origami: 'Origami',
  };
  return mapping[animationType.toLowerCase()] || 'V60';
}

/**
 * 从器具ID推断基础器具类型（兼容旧版本）
 */
function inferEquipmentTypeFromId(equipmentId: string): string {
  if (equipmentId.includes('-v60-')) return 'V60';
  if (equipmentId.includes('-clever-')) return 'CleverDripper';
  if (equipmentId.includes('-kalita-')) return 'Kalita';
  if (equipmentId.includes('-origami-')) return 'Origami';
  if (equipmentId.includes('-espresso-')) return 'Espresso';
  return 'V60'; // 默认
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
            targetEquipmentId = getBaseEquipmentId(animationType);
          }
        } else if (selectedEquipment.startsWith('custom-')) {
          // 兼容旧版本：从ID推断器具类型
          targetEquipmentId = inferEquipmentTypeFromId(selectedEquipment);
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
