'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import { CustomEquipment } from '@/lib/core/config';
import {
  isEspressoMachine,
  getDefaultPourType,
  getPourTypeName,
} from '@/lib/utils/equipmentUtils';
import {
  Steps,
  NameStep,
  ParamsStep,
  StagesStep,
  CompleteStep,
  Stage,
} from './components';
import type { Step } from './components';
import { MethodWithStages } from '@/lib/types/method';
import { showToast } from '@/components/common/feedback/LightToast';

// 数据规范化辅助函数
const normalizeMethodData = (
  method: Partial<MethodWithStages> & Record<string, unknown>
): MethodWithStages => {
  const normalizedMethod = { ...method };

  // 确保params存在
  if (!normalizedMethod.params) {
    normalizedMethod.params = {
      coffee: '',
      water: '',
      ratio: '',
      grindSize: '',
      temp: '',
      stages: [],
    };
  } else {
    // 规范化params对象
    normalizedMethod.params = { ...normalizedMethod.params };

    // 确保水量、咖啡粉量是字符串格式
    if (normalizedMethod.params) {
      ['water', 'coffee'].forEach(field => {
        const fieldKey = field as keyof typeof normalizedMethod.params;
        if (normalizedMethod.params![fieldKey] !== undefined) {
          const fieldValue = normalizedMethod.params![fieldKey];
          if (typeof fieldValue === 'number') {
            (normalizedMethod.params as Record<string, unknown>)[fieldKey] =
              `${fieldValue}g`;
          } else if (
            typeof fieldValue === 'string' &&
            !fieldValue.endsWith('g')
          ) {
            (normalizedMethod.params as Record<string, unknown>)[fieldKey] =
              `${fieldValue}g`;
          }
        }
      });
    }

    // 确保温度是字符串格式
    if (normalizedMethod.params.temp !== undefined) {
      if (typeof normalizedMethod.params.temp === 'number') {
        normalizedMethod.params.temp = `${normalizedMethod.params.temp}°C`;
      } else if (
        typeof normalizedMethod.params.temp === 'string' &&
        !normalizedMethod.params.temp.endsWith('°C')
      ) {
        normalizedMethod.params.temp = `${normalizedMethod.params.temp}°C`;
      }
    }

    // 规范化每个阶段的水量
    if (Array.isArray(normalizedMethod.params.stages)) {
      normalizedMethod.params.stages = normalizedMethod.params.stages.map(
        stage => {
          const normalizedStage = { ...stage } as Record<string, unknown>;
          if (normalizedStage.water !== undefined) {
            if (typeof normalizedStage.water === 'number') {
              normalizedStage.water = `${normalizedStage.water}g`;
            } else if (
              typeof normalizedStage.water === 'string' &&
              !normalizedStage.water.endsWith('g')
            ) {
              normalizedStage.water = `${normalizedStage.water}g`;
            }
          }
          return normalizedStage as unknown as Stage;
        }
      );
    }
  }

  return normalizedMethod as MethodWithStages;
};

// 使用从 types.ts 导入的类型定义
// MethodWithStages 替代 _Method
// Stage 替代 _Stage

// 定义步骤类型
// type Step = 'name' | 'params' | 'stages' | 'complete'; // 已在Steps.tsx中定义并导出

// 修改组件 props 类型
interface CustomMethodFormProps {
  initialMethod?: MethodWithStages;
  customEquipment: CustomEquipment;
  onSave: (method: MethodWithStages) => void;
  onBack: () => void;
  /** 当前步骤，由父组件控制（用于历史栈管理） */
  currentStep?: number;
  /** 步骤变化回调，通知父组件步骤变化 */
  onStepChange?: (step: number) => void;
  /** 磨豆机同步默认开关状态 */
  grinderDefaultSyncEnabled?: boolean;
}

/**
 * 自定义冲泡方案表单组件
 */
const CustomMethodForm: React.FC<CustomMethodFormProps> = ({
  initialMethod,
  customEquipment,
  onSave,
  onBack,
  currentStep: externalStep,
  onStepChange,
  grinderDefaultSyncEnabled = false,
}) => {
  // ===== 状态管理 =====
  // 内部步骤状态（当没有外部控制时使用）
  const [internalStep, setInternalStep] = useState<Step>('name');

  // 步骤映射：数字步骤 <-> 字符串步骤
  const stepOrder: Step[] = ['name', 'params', 'stages', 'complete'];

  // 根据外部步骤号获取实际步骤
  const currentStep: Step = externalStep
    ? stepOrder[externalStep - 1] || 'name'
    : internalStep;

  // 设置步骤的函数（同时通知父组件）
  const setCurrentStep = useCallback(
    (step: Step) => {
      if (onStepChange) {
        const stepIndex = stepOrder.indexOf(step);
        onStepChange(stepIndex + 1);
      } else {
        setInternalStep(step);
      }
    },
    [onStepChange]
  );

  // 阶段用时编辑状态（新数据模型）
  const [editingDuration, setEditingDuration] = useState<{
    index: number;
    value: string;
  } | null>(null);
  // 阶段注水量编辑状态（新数据模型）
  const [editingWater, setEditingWater] = useState<{
    index: number;
    value: string;
  } | null>(null);
  const [showWaterTooltip, setShowWaterTooltip] = useState<number | null>(null);

  // ===== DOM引用 =====
  const inputRef = useRef<HTMLInputElement>(null);
  const stagesContainerRef = useRef<HTMLDivElement>(null);
  const newStageRef = useRef<HTMLDivElement>(null);

  // ===== 工具函数 =====

  // 初始化新方法
  const initializeNewMethod = useCallback((): MethodWithStages => {
    const isCustomPreset = customEquipment.animationType === 'custom';
    const isEspresso = isEspressoMachine(customEquipment);

    // 自定义预设类型 - 不设置初始步骤
    if (isCustomPreset) {
      return {
        name: '',
        params: {
          coffee: '15g',
          water: '225g',
          ratio: '1:15',
          grindSize: '中细',
          temp: '92°C',
          stages: [],
        },
      };
    }

    // 意式机类型（使用新数据模型）
    if (isEspresso) {
      return {
        name: '',
        params: {
          coffee: '18g',
          water: '36g',
          ratio: '1:2',
          grindSize: '细',
          temp: '93°C',
          stages: [
            {
              duration: 25,
              label: '萃取浓缩',
              water: '36',
              detail: '标准意式浓缩',
              pourType: 'extraction',
            },
          ],
        },
      };
    }

    // 手冲类型 - 获取默认注水方式
    const defaultPourType = getDefaultPourType(customEquipment);

    // 创建初始步骤（使用新数据模型：焖蒸 + 等待）
    // Requirements 6.1, 6.2, 6.3: 手冲器具默认焖蒸阶段 + 等待阶段
    const initialStages: Stage[] = [
      {
        // Requirement 6.2: pourType="circle", label="焖蒸(绕圈注水)", water="30", duration="10"
        duration: 10,
        label: '焖蒸(绕圈注水)',
        water: '30',
        detail: '中心向外绕圈，确保均匀萃取',
        pourType: defaultPourType, // 使用器具默认注水方式以提供更好的用户体验
        ...(customEquipment.hasValve
          ? { valveStatus: 'closed' as 'closed' | 'open' }
          : {}),
      },
      {
        // Requirement 6.3: pourType="wait", label="等待", duration="15", detail=""
        duration: 20,
        label: '等待',
        detail: '',
        pourType: 'wait',
      },
    ];

    return {
      name: '',
      params: {
        coffee: '15g',
        water: '225g',
        ratio: '1:15',
        grindSize: '中细',
        temp: '92°C',
        stages: initialStages,
      },
    };
  }, [customEquipment]);

  // 初始化方法状态
  const [method, setMethod] = useState<MethodWithStages>(() => {
    // 创建新方法
    return initializeNewMethod();
  });

  // ===== 步骤配置 =====
  const steps = React.useMemo(
    () => [
      { id: 'name' as Step, label: '方案名称' },
      { id: 'params' as Step, label: '基本参数' },
      { id: 'stages' as Step, label: '冲泡步骤' },
      { id: 'complete' as Step, label: '完成' },
    ],
    []
  );

  // ===== 基本功能函数 =====
  const getCurrentStepIndex = useCallback(
    () => steps.findIndex(step => step.id === currentStep),
    [steps, currentStep]
  );

  const handleNextStep = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].id);
    }
  };

  // UI 返回按钮处理 - 始终调用 onBack（即 modalHistory.back()）
  // 这样可以保证浏览器历史栈和内部状态同步
  // modalHistory 会通过 popstate 事件触发 onStepChange 来更新步骤状态
  const handleBack = () => {
    onBack();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const _formatWater = (water: string | number | undefined) => {
    if (water === undefined || water === null || water === '') return '0g';
    if (typeof water === 'number') return `${water}g`;
    return water.endsWith('g') ? water : `${water}g`;
  };

  // ===== 注水步骤辅助函数 =====
  const getDefaultStageLabel = (pourType: string) => {
    const isCustomPreset = customEquipment.animationType === 'custom';

    // 特殊情况处理
    if (isCustomPreset && pourType === 'other') return '';

    // 检查自定义注水动画
    if (customEquipment.customPourAnimations) {
      // 先检查ID匹配
      const idMatch = customEquipment.customPourAnimations.find(
        anim => anim.id === pourType
      );
      if (idMatch) return idMatch.name;

      // 再检查pourType匹配
      const typeMatch = customEquipment.customPourAnimations.find(
        anim => anim.pourType === pourType
      );
      if (typeMatch?.name) return typeMatch.name;
    }

    // 默认标签
    switch (pourType) {
      case 'circle':
        return '绕圈注水';
      case 'center':
        return '中心注水';
      case 'ice':
        return '添加冰块';
      case 'bypass':
        return 'Bypass';
      case 'other':
        return '';
      default:
        return '注水';
    }
  };

  const getDefaultStageDetail = (pourType: string) => {
    const isCustomPreset = customEquipment.animationType === 'custom';

    // 特殊情况处理
    if (isCustomPreset && pourType === 'other') return '';

    // 检查自定义注水动画
    if (customEquipment.customPourAnimations) {
      const customAnimation = customEquipment.customPourAnimations.find(
        anim => anim.id === pourType
      );
      if (customAnimation) return `使用${customAnimation.name}注水`;
    }

    // 默认详情
    switch (pourType) {
      case 'circle':
        return '中心向外缓慢画圈注水，均匀萃取咖啡风味';
      case 'center':
        return '中心定点注水，降低萃取率';
      case 'ice':
        return '添加冰块，降低温度进行冷萃';
      case 'bypass':
        return '冲煮完成后添加到咖啡液中，调节浓度和口感';
      case 'other':
        return '';
      default:
        return '注水';
    }
  };

  // ===== 副作用 =====

  // 自动聚焦输入框
  useEffect(() => {
    if (currentStep === 'name' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentStep]);

  // 监听器具变化，重新初始化方法
  useEffect(() => {
    // 只有在没有初始化方法的情况下才重新初始化
    if (!initialMethod) {
      setMethod(initializeNewMethod());
    }
  }, [
    customEquipment.animationType,
    customEquipment.hasValve,
    customEquipment.customPourAnimations,
    initialMethod,
    initializeNewMethod,
  ]); // 添加缺失的依赖

  // 监听initialMethod变化
  useEffect(() => {
    if (initialMethod) {
      // 使用初始方法
      const normalizedMethod = normalizeMethodData(
        initialMethod as Partial<MethodWithStages> & Record<string, unknown>
      );

      // 处理聪明杯标签特殊情况
      if (customEquipment.hasValve && normalizedMethod.params.stages) {
        normalizedMethod.params.stages = normalizedMethod.params.stages.map(
          stage => ({
            ...stage,
            label: stage.label.replace(/\s*\[开阀\]|\s*\[关阀\]/g, '').trim(),
          })
        );
      }

      setMethod(normalizedMethod);
    }
  }, [initialMethod, customEquipment.hasValve]);

  // ===== 数据计算函数 =====

  // 计算总冲泡时间（使用新数据模型的 duration 字段）
  const calculateTotalTime = () => {
    if (method.params.stages.length === 0) return 0;

    // 检查是否为意式咖啡方案
    const isEspresso = isEspressoMachine(customEquipment);

    if (isEspresso) {
      // 意式咖啡只计算萃取步骤的时间
      const extractionStage = method.params.stages.find(
        stage => stage.pourType === 'extraction'
      );
      // 优先使用 duration，兼容旧数据的 time
      return extractionStage?.duration ?? extractionStage?.time ?? 0;
    } else {
      // 常规方案：累加所有阶段的 duration
      return method.params.stages.reduce((total, stage) => {
        // 优先使用 duration，兼容旧数据的 time
        const stageDuration = stage.duration ?? stage.time ?? 0;
        return total + stageDuration;
      }, 0);
    }
  };

  // 计算当前已使用的水量（排除 Bypass 和等待步骤）
  const calculateCurrentWater = () => {
    if (method.params.stages.length === 0) return 0;

    // 累加所有非等待、非 Bypass 步骤的水量
    return method.params.stages.reduce((total, stage) => {
      // 跳过等待和 Bypass 步骤
      if (stage.pourType === 'wait' || stage.pourType === 'bypass') {
        return total;
      }

      if (stage.water) {
        const waterValue =
          typeof stage.water === 'number'
            ? stage.water
            : parseInt(stage.water.replace('g', '') || '0');
        return total + (waterValue > 0 ? waterValue : 0);
      }
      return total;
    }, 0);
  };

  // ===== 事件处理函数 =====

  // 处理步骤变更
  const handleStageChange = (
    index: number,
    field: keyof Stage,
    value: string | number
  ) => {
    const newStages = [...method.params.stages];
    const stage = { ...newStages[index] };

    // 根据字段类型处理值
    if (field === 'duration') {
      // 新数据模型：阶段用时
      const durationValue =
        typeof value === 'number' ? value : parseInt(value.toString()) || 0;
      stage.duration = Math.max(0, durationValue); // 确保非负
    } else if (field === 'time' || field === 'pourTime') {
      // 旧数据模型兼容：数值类型
      stage[field] = value as number;

      // 当更新累计时间时，自动更新注水时间为阶段时间长度（当前阶段时间与上一阶段时间的差值）
      if (field === 'time' && !isEspressoMachine(customEquipment)) {
        // 获取当前阶段的索引和时间值
        const currentTime = parseInt(value.toString()) || 0;

        // 获取上一个阶段的时间（如果存在）
        let previousTime = 0;
        if (index > 0) {
          const previousStage = method.params.stages[index - 1];
          previousTime = previousStage.time || 0;
        }

        // 计算阶段时间长度（当前阶段时间与上一阶段时间的差值）
        const stageDuration = currentTime - previousTime;

        // 将注水时间设置为阶段时间长度
        stage.pourTime = stageDuration > 0 ? stageDuration : 0;
      }

      // 确保注水时间不超过总时间
      if (
        field === 'pourTime' &&
        stage.time !== undefined &&
        (stage.pourTime ?? 0) > stage.time
      ) {
        stage.pourTime = stage.time;
      }
    } else if (field === 'label' || field === 'detail' || field === 'water') {
      // 字符串类型
      if (field === 'water' && typeof value === 'string' && value) {
        // 新数据模型：阶段注水量（不带 g 后缀存储）
        const waterValue = value.replace('g', '');
        stage[field] = waterValue;
      } else {
        stage[field] = value as string;
      }
    } else if (field === 'pourType') {
      // 注水类型
      stage[field] = value as string;
    }

    // 更新method状态
    newStages[index] = stage;

    // 水量特殊处理 - 更新总水量
    const updatedParams = { ...method.params, stages: newStages };

    // 手冲模式：阶段水量变更时，不应该自动更新总水量
    // 总水量应该只在用户修改咖啡粉量、水粉比时才自动计算
    // 阶段水量是累计水量，应该受总水量限制，但不应该反过来影响总水量
    if (field === 'water' && !isEspressoMachine(customEquipment)) {
      // 手冲模式：不自动更新总水量，保持用户设定的总水量不变
      // 这样确保用户的总水量设定不会因为阶段水量的修改而意外改变
    } else if (field === 'water' && isEspressoMachine(customEquipment)) {
      // 意式机模式：萃取步骤的液重变化时，同步更新总水量和水粉比
      if (stage.pourType === 'extraction') {
        // 只有当水量有效时才更新总水量和比例
        const liquidValue = stage.water
          ? parseInt((stage.water as string).replace('g', '') || '0')
          : 0;

        if (liquidValue > 0) {
          updatedParams.water = stage.water as string;

          // 根据咖啡粉量和液重计算新的水粉比
          const coffee = parseFloat(method.params.coffee.replace('g', ''));
          const liquid = liquidValue;

          // 计算比值
          const ratio = liquid / coffee;
          // 如果比值是整数，则不显示小数点
          const newRatio =
            coffee > 0
              ? `1:${Number.isInteger(ratio) ? ratio.toString() : ratio.toFixed(1)}`
              : method.params.ratio;

          updatedParams.ratio = newRatio;
        }
        // 如果水量为空或0，保持原有的总水量和比例不变
      }
      // 对于饮料类型的水量变化，不影响总水量和比例
    }

    setMethod({
      ...method,
      params: updatedParams,
    });
  };

  const addStage = () => {
    // 获取器具类型
    const _equipmentType = customEquipment.animationType;
    const isEspresso = isEspressoMachine(customEquipment);

    // 确定默认注水方式
    let defaultPourType = getDefaultPourType(customEquipment);

    // 对于意式机，检查是否已有步骤，有则新步骤默认为"饮料"类型
    if (isEspresso && method.params.stages.length > 0) {
      defaultPourType = 'beverage';
    }

    // 根据器具类型和阶段设置默认阶段用时（新数据模型使用 duration）
    const defaultDuration = (() => {
      if (isEspresso) {
        // 意式咖啡机：只有萃取类型有时间，饮料类型没有 duration
        return defaultPourType === 'extraction' ? 25 : undefined;
      } else if (defaultPourType === 'bypass') {
        // Bypass 类型没有 duration
        return undefined;
      } else if (method.params.stages.length === 0) {
        return 10; // 第一个阶段默认10秒
      } else {
        // 新增步骤不预设时间，让用户自行输入
        return undefined;
      }
    })();

    // 创建新阶段（使用新数据模型）
    const newStage: Stage = {
      duration: defaultDuration,
      // 当是意式机且为饮料类型时，不自动设置标签名称，留空让用户自行填写
      // 非意式机则使用默认的步骤名称
      // 等待类型使用固定标签
      label:
        defaultPourType === 'wait'
          ? '等待'
          : isEspresso
            ? defaultPourType === 'beverage'
              ? ''
              : getPourTypeName(defaultPourType)
            : getDefaultStageLabel(defaultPourType),
      // 等待类型不需要水量
      water: defaultPourType === 'wait' ? '' : '',
      // 非意式机设置默认的详细说明
      detail: isEspresso ? '' : getDefaultStageDetail(defaultPourType),
      pourType: defaultPourType,
    };

    // 为聪明杯添加阀门状态
    if (customEquipment.hasValve) {
      newStage.valveStatus = 'closed';
    }

    // 更新方法
    setMethod({
      ...method,
      params: {
        ...method.params,
        stages: [...method.params.stages, newStage],
      },
    });

    // 使用setTimeout确保DOM已更新后再滚动
    setTimeout(() => {
      // 首先尝试使用直接引用的方式滚动到新步骤
      if (newStageRef.current) {
        newStageRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });

        // 额外向上滚动一些距离，确保底部阴影不会遮挡新添加的步骤
        setTimeout(() => {
          const container = stagesContainerRef.current?.parentElement;
          if (container) {
            container.scrollTop += 20; // 向下额外滚动20px，确保新步骤完全可见
          }
        }, 300);
      }
      // 如果没有直接引用，则尝试使用容器的最后一个子元素
      else if (stagesContainerRef.current) {
        const newStageElement = stagesContainerRef.current
          .lastElementChild as HTMLElement;
        if (newStageElement) {
          newStageElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });

          // 额外向上滚动一些距离，确保底部阴影不会遮挡新添加的步骤
          setTimeout(() => {
            const container = stagesContainerRef.current?.parentElement;
            if (container) {
              container.scrollTop += 20; // 向下额外滚动20px，确保新步骤完全可见
            }
          }, 300);
        }
      }
    }, 100);
  };

  const removeStage = (index: number) => {
    const newStages = [...method.params.stages];
    newStages.splice(index, 1);
    setMethod({
      ...method,
      params: {
        ...method.params,
        stages: newStages,
      },
    });
  };

  // 批量删除多个阶段（时间模式需要同时删除注水阶段和等待阶段）
  const removeStages = (indices: number[]) => {
    // 按索引从大到小排序，这样删除时不会影响前面的索引
    const sortedIndices = [...indices].sort((a, b) => b - a);
    const newStages = [...method.params.stages];
    sortedIndices.forEach(idx => {
      newStages.splice(idx, 1);
    });
    setMethod({
      ...method,
      params: {
        ...method.params,
        stages: newStages,
      },
    });
  };

  // 在指定位置插入阶段（时间模式需要插入等待阶段）
  const insertStage = (index: number, stage: Stage) => {
    const newStages = [...method.params.stages];
    newStages.splice(index, 0, stage);
    setMethod({
      ...method,
      params: {
        ...method.params,
        stages: newStages,
      },
    });
  };

  const handleSubmit = async () => {
    // 创建一个方法的深拷贝，以便修改
    const finalMethod = JSON.parse(JSON.stringify(method)) as MethodWithStages;

    // 如果是聪明杯，将阀门状态添加到步骤名称中
    if (customEquipment.hasValve && finalMethod.params.stages) {
      finalMethod.params.stages = finalMethod.params.stages.map(stage => {
        if (stage.valveStatus) {
          const valveStatusText =
            stage.valveStatus === 'open' ? '[开阀]' : '[关阀]';
          // 确保没有重复添加
          const baseLabel = stage.label
            .replace(/\s*\[开阀\]|\s*\[关阀\]/g, '')
            .trim();
          return {
            ...stage,
            label: `${valveStatusText}${baseLabel}`.trim(),
          };
        }
        return stage;
      });
    }

    // 保存意式机饮料名称到localStorage
    if (isEspressoMachine(customEquipment)) {
      try {
        // 获取所有饮料类型步骤的饮料名称
        const beverageNames = finalMethod.params.stages
          .filter(stage => stage.pourType === 'beverage')
          .map(stage => stage.label)
          .filter(label => label.trim() !== ''); // 排除空名称

        if (beverageNames.length > 0) {
          // 从localStorage读取已保存的饮料名称
          const savedSuggestions = localStorage.getItem(
            'userBeverageSuggestions'
          );
          let userBeverages: string[] = [];

          if (savedSuggestions) {
            userBeverages = JSON.parse(savedSuggestions);
          }

          // 添加新的饮料名称，去重
          const uniqueBeverages = Array.from(
            new Set([...userBeverages, ...beverageNames])
          );

          // 保存回localStorage
          localStorage.setItem(
            'userBeverageSuggestions',
            JSON.stringify(uniqueBeverages)
          );
        }
      } catch (error) {
        // Log error in development only
        if (process.env.NODE_ENV === 'development') {
          console.error('保存饮料名称失败:', error);
        }
        // 继续执行，不影响主要功能
      }
    }

    try {
      // 同步磨豆机刻度到设置
      if (finalMethod.params.grindSize) {
        const { syncGrinderToSettings } = await import('@/lib/grinder');
        await syncGrinderToSettings(finalMethod.params.grindSize);
      }

      // 保存方法
      onSave(finalMethod);
    } catch {
      // 可以在这里添加用户友好的错误提示
      alert('保存方案失败，请重试');
    }
  };

  const handleCoffeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const coffee = e.target.value;
    // 根据咖啡粉量和水粉比计算总水量
    const ratio = method.params.ratio.replace('1:', '');
    let totalWater = '';

    if (coffee && ratio) {
      totalWater = `${Math.round(parseFloat(coffee) * parseFloat(ratio))}g`;
    }

    // 获取旧总水量
    const oldTotalWater = parseInt(method.params.water.replace('g', '') || '0');
    // 获取新总水量
    const newTotalWater = totalWater
      ? parseInt(totalWater.replace('g', ''))
      : 0;

    // 计算水量调整比例
    const waterRatio =
      oldTotalWater > 0 && newTotalWater > 0
        ? newTotalWater / oldTotalWater
        : 1;

    // 更新所有步骤的水量（排除 Bypass 步骤）
    const newStages = [...method.params.stages].map((stage, index) => {
      const updatedStage = { ...stage };

      // Bypass 步骤不参与自动水量调整
      if (stage.pourType === 'bypass') {
        return updatedStage;
      }

      if (isEspressoMachine(customEquipment)) {
        // 意式机：只更新萃取步骤的液重与总水量相同
        if (stage.pourType === 'extraction' && coffee && ratio) {
          updatedStage.water = totalWater;
        }
      } else {
        // 手冲模式处理

        // 如果是第一个步骤，并且没有水量或水量为0，则设置默认值（咖啡粉量的2倍）
        if (
          index === 0 &&
          (!updatedStage.water ||
            parseInt((updatedStage.water as string).replace('g', '')) === 0)
        ) {
          if (coffee) {
            const waterAmount = Math.round(parseFloat(coffee) * 2);
            updatedStage.water = `${waterAmount}g`;
          }
        }
        // 否则按比例更新所有步骤的水量
        else if (updatedStage.water) {
          const stageWater =
            typeof updatedStage.water === 'number'
              ? updatedStage.water
              : parseInt(updatedStage.water.replace('g', '') || '0');

          // 按比例调整水量
          const adjustedWater = Math.round(stageWater * waterRatio);
          updatedStage.water = `${adjustedWater}g`;
        }
      }

      return updatedStage;
    });

    setMethod({
      ...method,
      params: {
        ...method.params,
        coffee: `${coffee}g`,
        water: totalWater, // 更新总水量
        stages: newStages, // 更新步骤
      },
    });
  };

  const handleRatioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ratio = e.target.value;
    // 根据咖啡粉量和水粉比计算总水量
    const coffee = method.params.coffee.replace('g', '');
    let totalWater = '';

    if (coffee && ratio) {
      totalWater = `${Math.round(parseFloat(coffee) * parseFloat(ratio))}g`;
    }

    // 获取旧总水量
    const oldTotalWater = parseInt(method.params.water.replace('g', '') || '0');
    // 获取新总水量
    const newTotalWater = totalWater
      ? parseInt(totalWater.replace('g', ''))
      : 0;

    // 计算水量调整比例
    const waterRatio =
      oldTotalWater > 0 && newTotalWater > 0
        ? newTotalWater / oldTotalWater
        : 1;

    // 更新所有步骤的水量（排除 Bypass 步骤）
    const newStages = [...method.params.stages].map((stage, index) => {
      const updatedStage = { ...stage };

      // Bypass 步骤不参与自动水量调整
      if (stage.pourType === 'bypass') {
        return updatedStage;
      }

      if (isEspressoMachine(customEquipment)) {
        // 意式机：只更新萃取步骤的液重与总水量相同
        if (stage.pourType === 'extraction' && coffee && ratio) {
          updatedStage.water = totalWater;
        }
      } else {
        // 手冲模式处理

        // 如果是第一个步骤，并且没有水量或水量为0，则设置默认值（咖啡粉量的2倍）
        if (
          index === 0 &&
          (!updatedStage.water ||
            parseInt((updatedStage.water as string).replace('g', '')) === 0)
        ) {
          if (coffee) {
            const waterAmount = Math.round(parseFloat(coffee) * 2);
            updatedStage.water = `${waterAmount}g`;
          }
        }
        // 否则按比例更新所有步骤的水量
        else if (updatedStage.water) {
          const stageWater =
            typeof updatedStage.water === 'number'
              ? updatedStage.water
              : parseInt(updatedStage.water.replace('g', '') || '0');

          // 按比例调整水量
          const adjustedWater = Math.round(stageWater * waterRatio);
          updatedStage.water = `${adjustedWater}g`;
        }
      }

      return updatedStage;
    });

    setMethod({
      ...method,
      params: {
        ...method.params,
        ratio: `1:${ratio}`,
        water: totalWater, // 更新总水量
        stages: newStages, // 更新步骤
      },
    });
  };

  const handleTempChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const temp = e.target.value;
    setMethod({
      ...method,
      params: {
        ...method.params,
        temp: temp ? `${temp}°C` : '',
      },
    });
  };

  // 意式机特有 - 处理萃取时间变更
  const handleExtractionTimeChange = (time: number) => {
    if (
      !isEspressoMachine(customEquipment) ||
      method.params.stages.length === 0
    )
      return;

    // 更新第一个萃取步骤的时间（使用 duration 字段）
    const newStages = [...method.params.stages];
    const firstStage = { ...newStages[0] };
    firstStage.duration = time;
    newStages[0] = firstStage;

    setMethod({
      ...method,
      params: {
        ...method.params,
        stages: newStages,
      },
    });
  };

  // 意式机特有 - 处理液重变更
  const handleLiquidWeightChange = (liquidWeight: string) => {
    if (
      !isEspressoMachine(customEquipment) ||
      method.params.stages.length === 0
    )
      return;

    // 获取旧液重（第一个萃取步骤的水量）
    const extractionStage = method.params.stages.find(
      stage => stage.pourType === 'extraction'
    );
    const oldLiquidWeight = extractionStage?.water
      ? typeof extractionStage.water === 'number'
        ? extractionStage.water
        : parseInt(extractionStage.water.replace('g', '') || '0')
      : 0;

    // 获取新液重
    const newLiquidWeight = parseInt(liquidWeight.replace('g', '') || '0');

    // 计算液重调整比例
    const _liquidRatio =
      oldLiquidWeight > 0 && newLiquidWeight > 0
        ? newLiquidWeight / oldLiquidWeight
        : 1;

    // 更新所有萃取步骤的水量
    const newStages = [...method.params.stages].map(stage => {
      const updatedStage = { ...stage };

      // 只更新萃取类型步骤的水量
      if (stage.pourType === 'extraction') {
        updatedStage.water = liquidWeight;
      }

      return updatedStage;
    });

    // 根据咖啡粉量和液重计算新的水粉比
    const coffee = parseFloat(method.params.coffee.replace('g', ''));
    const liquid = newLiquidWeight;

    // 计算比值
    const ratio = liquid / coffee;
    // 如果比值是整数，则不显示小数点
    const newRatio =
      coffee > 0
        ? `1:${Number.isInteger(ratio) ? ratio.toString() : ratio.toFixed(1)}`
        : method.params.ratio;

    setMethod({
      ...method,
      params: {
        ...method.params,
        water: liquidWeight, // 更新总水量与萃取液重同步
        ratio: newRatio, // 更新水粉比
        stages: newStages,
      },
    });
  };

  // 此处原calculateTotalTime函数已移至上方统一管理

  // 处理所有器具类型的注水方式变更
  const handlePourTypeChange = (index: number, value: string) => {
    const newStages = [...method.params.stages];
    const stage = { ...newStages[index] } as Stage;
    const isCustomPreset = customEquipment.animationType === 'custom';
    const isEspresso = isEspressoMachine(customEquipment);

    // 设置pourType，对所有器具类型通用
    stage.pourType = value;

    // 对于意式机的特殊处理
    if (isEspresso) {
      // 获取注水方式的显示名称
      const pourTypeName = getPourTypeName(value);

      // 获取所有可能的默认注水方式标签
      const allDefaultLabels = ['萃取浓缩', '饮料', '其他', ''];

      // 检查当前标签是否与任何默认标签匹配，或者是否为特定切换场景（从饮料切换到萃取，或从萃取切换到饮料）
      const isLabelDefault =
        !stage.label ||
        stage.label === '' ||
        allDefaultLabels.includes(stage.label) ||
        (value === 'extraction' && stage.label === '饮料') ||
        (value === 'beverage' && stage.label === '萃取浓缩');

      // 根据不同的注水方式处理默认值
      switch (value) {
        case 'extraction':
          // 萃取模式，需要时间和液重
          if (isLabelDefault) {
            stage.label = pourTypeName;
          }
          // 确保有 duration 字段，萃取模式需要
          if (!stage.duration) {
            stage.duration = 25;
          }
          break;
        case 'beverage':
          // 饮料模式，只需要名称和液重，不需要时间
          if (isLabelDefault) {
            stage.label = pourTypeName;
          }
          // 饮料阶段不需要时间
          stage.duration = undefined;
          break;
        default:
          // 其他模式，根据实际情况设置
          if (isLabelDefault) {
            stage.label = pourTypeName;
          }
          break;
      }
    }
    // 检查是否选择了自定义注水动画（自定义注水动画的值是ID而不是pourType类型）
    else if (isCustomPreset) {
      // 获取所有可能的默认注水方式标签
      const allDefaultLabels = ['绕圈注水', '中心注水', '添加冰块', '注水', ''];
      // 获取所有可能的默认注水方式详细信息
      const allDefaultDetails = [
        '中心向外缓慢画圈注水，均匀萃取咖啡风味',
        '中心定点注水，降低萃取率',
        '添加冰块，降低温度进行冷萃',
        '注水',
        '',
      ];

      // 如果有自定义注水动画，将它们的名称添加到默认标签列表中
      if (customEquipment.customPourAnimations) {
        customEquipment.customPourAnimations.forEach(anim => {
          if (anim.name) allDefaultLabels.push(anim.name);
          if (anim.name) allDefaultDetails.push(`使用${anim.name}注水`);
        });
      }

      const isCustomAnimation =
        value !== 'center' &&
        value !== 'circle' &&
        value !== 'ice' &&
        value !== 'other';

      // 检查当前标签是否与任何默认标签匹配
      const isLabelDefault =
        !stage.label ||
        stage.label === '' ||
        allDefaultLabels.includes(stage.label);
      // 检查当前详细说明是否与任何默认详细说明匹配
      const isDetailDefault =
        !stage.detail ||
        stage.detail === '' ||
        allDefaultDetails.includes(stage.detail);

      if (isCustomAnimation) {
        // 查找对应的自定义注水动画
        const customAnimation = customEquipment.customPourAnimations?.find(
          anim => anim.id === value
        );

        if (customAnimation) {
          // 更新标签和详细信息，如果它们是默认值之一或为空
          if (isLabelDefault) {
            stage.label = customAnimation.name || getDefaultStageLabel(value);
          }

          if (isDetailDefault) {
            stage.detail = getDefaultStageDetail(value);
          }
        }
      } else {
        // 常规注水方式
        if (isLabelDefault) {
          stage.label = getDefaultStageLabel(value);
        }

        if (isDetailDefault) {
          stage.detail = getDefaultStageDetail(value);
        }
      }
    }
    // 常规器具处理
    else {
      // 获取所有可能的默认注水方式标签
      const allDefaultLabels = ['绕圈注水', '中心注水', '添加冰块', '注水', ''];
      // 获取所有可能的默认注水方式详细信息
      const allDefaultDetails = [
        '中心向外缓慢画圈注水，均匀萃取咖啡风味',
        '中心定点注水，降低萃取率',
        '添加冰块，降低温度进行冷萃',
        '注水',
        '',
      ];

      // 如果有自定义注水动画，将它们的名称添加到默认标签列表中
      if (customEquipment.customPourAnimations) {
        customEquipment.customPourAnimations.forEach(anim => {
          if (anim.name) allDefaultLabels.push(anim.name);
          if (anim.name) allDefaultDetails.push(`使用${anim.name}注水`);
        });
      }

      // 检查当前标签是否与任何默认标签匹配
      const isLabelDefault =
        !stage.label ||
        stage.label === '' ||
        allDefaultLabels.includes(stage.label);
      // 检查当前详细说明是否与任何默认详细说明匹配
      const isDetailDefault =
        !stage.detail ||
        stage.detail === '' ||
        allDefaultDetails.includes(stage.detail);

      // 如果标签是默认值之一或为空，更新它
      if (isLabelDefault) {
        stage.label = getDefaultStageLabel(value);
      }

      // 如果详细说明是默认值之一或为空，更新它
      if (isDetailDefault) {
        stage.detail = getDefaultStageDetail(value);
      }
    }

    // 更新stages
    newStages[index] = stage;

    // 更新方法
    setMethod({
      ...method,
      params: {
        ...method.params,
        stages: newStages,
      },
    });
  };

  // 处理阀门状态变更 - 直接切换开关状态
  const toggleValveStatus = (index: number) => {
    const newStages = [...method.params.stages];
    const stage = { ...newStages[index] };

    // 切换阀门状态
    const newStatus = stage.valveStatus === 'open' ? 'closed' : 'open';
    stage.valveStatus = newStatus;

    // 保留原始的标签内容，移除可能已存在的阀门状态标记
    const baseLabel = stage.label.replace(/\s*\[开阀\]|\s*\[关阀\]/g, '');
    stage.label = baseLabel.trim();

    newStages[index] = stage;
    setMethod({
      ...method,
      params: {
        ...method.params,
        stages: newStages,
      },
    });
  };

  // 此处原calculateCurrentWater函数已移至上方统一管理

  // 格式化意式咖啡的总水量，显示为各阶段的累加
  const formatEspressoTotalWater = () => {
    if (!method.params.stages || method.params.stages.length === 0) {
      return '0g';
    }

    const isEspresso = isEspressoMachine(customEquipment);
    if (!isEspresso) return '0g';

    // 计算总水量：提取步骤的水量 + 饮料步骤的水量
    const allStages = [...method.params.stages];

    // 找到萃取步骤
    const extractionStage = allStages.find(
      stage => stage.pourType === 'extraction'
    );
    const extractionAmount = extractionStage
      ? parseFloat(extractionStage.water || '0') || 0
      : 0;

    // 找到饮料步骤
    const beverageStages = allStages
      .filter(stage => stage.pourType === 'beverage')
      .map(stage => parseFloat(stage.water || '0') || 0);
    const beverageAmount =
      beverageStages.length > 0 ? Math.max(...beverageStages) : 0;

    // 使用较大的值
    return `${Math.max(extractionAmount, beverageAmount)}g`;
  };

  // ===== 渲染函数 =====

  // 渲染步骤内容
  const renderStepContent = () => {
    switch (currentStep) {
      case 'name':
        return (
          <NameStep
            name={method.name}
            onChange={name => setMethod({ ...method, name })}
            isEdit={
              !!initialMethod &&
              !(
                initialMethod as MethodWithStages & {
                  _isFromCommonMethod?: boolean;
                }
              )._isFromCommonMethod
            }
          />
        );

      case 'params':
        return (
          <ParamsStep
            params={{
              coffee: method.params.coffee,
              water: method.params.water,
              ratio: method.params.ratio,
              grindSize: method.params.grindSize,
              temp: method.params.temp,
              // 添加意式机特有参数（使用 duration 字段）
              extractionTime: isEspressoMachine(customEquipment)
                ? (method.params.stages[0]?.duration ??
                  method.params.stages[0]?.time)
                : undefined,
              liquidWeight: isEspressoMachine(customEquipment)
                ? method.params.stages[0]?.water
                : undefined,
            }}
            onCoffeeChange={handleCoffeeChange}
            onRatioChange={handleRatioChange}
            onGrindSizeChange={grindSize =>
              setMethod({
                ...method,
                params: {
                  ...method.params,
                  grindSize,
                },
              })
            }
            onTempChange={handleTempChange}
            // 添加意式机特有参数处理函数
            onExtractionTimeChange={
              isEspressoMachine(customEquipment)
                ? handleExtractionTimeChange
                : undefined
            }
            onLiquidWeightChange={
              isEspressoMachine(customEquipment)
                ? handleLiquidWeightChange
                : undefined
            }
            customEquipment={customEquipment}
            grinderDefaultSyncEnabled={grinderDefaultSyncEnabled}
          />
        );

      case 'stages':
        return (
          <StagesStep
            stages={method.params.stages}
            totalWater={method.params.water}
            customEquipment={customEquipment}
            onStageChange={handleStageChange}
            onPourTypeChange={handlePourTypeChange}
            toggleValveStatus={toggleValveStatus}
            addStage={addStage}
            removeStage={removeStage}
            removeStages={removeStages}
            insertStage={insertStage}
            formatTime={formatTime}
            showWaterTooltip={showWaterTooltip}
            setShowWaterTooltip={setShowWaterTooltip}
            stagesContainerRef={stagesContainerRef}
            newStageRef={newStageRef}
            coffeeDosage={method.params.coffee}
            editingDuration={editingDuration}
            setEditingDuration={setEditingDuration}
            editingWater={editingWater}
            setEditingWater={setEditingWater}
          />
        );

      case 'complete':
        return (
          <CompleteStep
            methodName={method.name}
            coffee={method.params.coffee}
            water={method.params.water}
            ratio={method.params.ratio}
            totalTime={calculateTotalTime()}
            isEdit={
              !!initialMethod &&
              !(
                initialMethod as MethodWithStages & {
                  _isFromCommonMethod?: boolean;
                }
              )._isFromCommonMethod
            }
            formatTime={formatTime}
            isEspressoMachine={isEspressoMachine(customEquipment)}
            formattedEspressoWater={
              isEspressoMachine(customEquipment)
                ? formatEspressoTotalWater()
                : undefined
            }
          />
        );

      default:
        return null;
    }
  };

  // 渲染下一步按钮
  const renderNextButton = () => {
    const isLastStep = getCurrentStepIndex() === steps.length - 1;
    const isCustomPreset = customEquipment.animationType === 'custom';
    const isEspresso = isEspressoMachine(customEquipment);

    // 验证 duration 是否为非负整数
    const isValidDuration = (duration: number | undefined): boolean => {
      if (duration === undefined) return true; // duration 可选
      return Number.isInteger(duration) && duration >= 0;
    };

    // 验证 water 是否为非负整数（非等待步骤）
    const isValidWater = (
      water: string | undefined,
      pourType: string | undefined
    ): boolean => {
      // 等待步骤不需要水量
      if (pourType === 'wait') return true;
      if (!water || !water.trim()) return false;
      const waterValue = parseInt(water.replace('g', '') || '0');
      return Number.isInteger(waterValue) && waterValue >= 0;
    };

    // 验证当前步骤是否可进行下一步
    const isStepValid = () => {
      switch (currentStep) {
        case 'name':
          return !!method.name.trim();

        case 'params':
          // 基本参数验证
          return (
            !!method.params.coffee.trim() &&
            !!method.params.water.trim() &&
            !!method.params.ratio.trim() &&
            !!method.params.temp.trim() &&
            !!method.params.grindSize.trim()
          );

        case 'stages':
          if (method.params.stages.length === 0) return false;

          return method.params.stages.every(stage => {
            // 意式机特殊验证
            if (isEspresso) {
              switch (stage.pourType) {
                case 'extraction': // 萃取类型 - 需要 duration 和 water
                  return (
                    isValidDuration(stage.duration) &&
                    (stage.duration ?? 0) > 0 &&
                    !!stage.label.trim() &&
                    isValidWater(stage.water, stage.pourType)
                  );
                case 'beverage': // 饮料类型 - 不需要 duration，只需要 water
                  return (
                    !!stage.label.trim() &&
                    isValidWater(stage.water, stage.pourType)
                  );
                case 'other': // 其他类型
                  return true;
                default:
                  return !!stage.pourType;
              }
            }

            // 自定义预设验证
            if (isCustomPreset) {
              // 等待类型只需要 duration
              if (stage.pourType === 'wait') {
                return (
                  isValidDuration(stage.duration) && (stage.duration ?? 0) > 0
                );
              }

              const basicValidation =
                isValidDuration(stage.duration) &&
                (stage.duration ?? 0) > 0 &&
                isValidWater(stage.water, stage.pourType);

              // 聪明杯验证阀门状态
              if (customEquipment.hasValve) {
                return (
                  basicValidation &&
                  (stage.valveStatus === 'open' ||
                    stage.valveStatus === 'closed')
                );
              }

              return basicValidation;
            }

            // 等待类型特殊验证（只需要 duration）
            if (stage.pourType === 'wait') {
              return (
                isValidDuration(stage.duration) && (stage.duration ?? 0) > 0
              );
            }

            // Bypass 类型特殊验证（不需要 duration，只需要 water）
            if (stage.pourType === 'bypass') {
              return (
                !!stage.label.trim() &&
                isValidWater(stage.water, stage.pourType) &&
                !!stage.pourType
              );
            }

            // 标准器具验证
            const basicValidation =
              isValidDuration(stage.duration) &&
              (stage.duration ?? 0) > 0 &&
              !!stage.label.trim() &&
              isValidWater(stage.water, stage.pourType) &&
              !!stage.pourType;

            // 聪明杯验证阀门状态
            if (customEquipment.hasValve) {
              return (
                basicValidation &&
                (stage.valveStatus === 'open' || stage.valveStatus === 'closed')
              );
            }

            return basicValidation;
          });

        case 'complete':
          return true;

        default:
          return true;
      }
    };

    // 检查步骤有效性
    const stepValid = isStepValid();

    // 获取验证错误提示信息
    const getValidationErrorMessage = (): string | null => {
      switch (currentStep) {
        case 'name':
          if (!method.name.trim()) return '请输入方案名称';
          return null;

        case 'params':
          if (!method.params.coffee.trim()) return '请输入咖啡粉量';
          if (!method.params.water.trim()) return '请输入水量';
          if (!method.params.ratio.trim()) return '请输入水粉比';
          if (!method.params.temp.trim()) return '请输入水温';
          if (!method.params.grindSize.trim()) return '请输入研磨度';
          return null;

        case 'stages':
          if (method.params.stages.length === 0)
            return '请添加至少一个冲泡步骤';

          for (let i = 0; i < method.params.stages.length; i++) {
            const stage = method.params.stages[i];
            const stageNum = i + 1;

            // 意式机特殊验证
            if (isEspresso) {
              switch (stage.pourType) {
                case 'extraction':
                  if (
                    !isValidDuration(stage.duration) ||
                    (stage.duration ?? 0) <= 0
                  )
                    return `步骤${stageNum}：请输入萃取时间`;
                  if (!stage.label.trim())
                    return `步骤${stageNum}：请输入步骤名称`;
                  if (!isValidWater(stage.water, stage.pourType))
                    return `步骤${stageNum}：请输入液重`;
                  break;
                case 'beverage':
                  if (!stage.label.trim())
                    return `步骤${stageNum}：请输入饮料名称`;
                  if (!isValidWater(stage.water, stage.pourType))
                    return `步骤${stageNum}：请输入液量`;
                  break;
              }
              continue;
            }

            // 自定义预设验证
            if (isCustomPreset) {
              if (stage.pourType === 'wait') {
                if (
                  !isValidDuration(stage.duration) ||
                  (stage.duration ?? 0) <= 0
                )
                  return `步骤${stageNum}：请输入等待时间`;
                continue;
              }
              if (
                !isValidDuration(stage.duration) ||
                (stage.duration ?? 0) <= 0
              )
                return `步骤${stageNum}：请输入阶段用时`;
              if (!isValidWater(stage.water, stage.pourType))
                return `步骤${stageNum}：请输入注水量`;
              if (
                customEquipment.hasValve &&
                stage.valveStatus !== 'open' &&
                stage.valveStatus !== 'closed'
              )
                return `步骤${stageNum}：请设置阀门状态`;
              continue;
            }

            // 等待类型
            if (stage.pourType === 'wait') {
              if (
                !isValidDuration(stage.duration) ||
                (stage.duration ?? 0) <= 0
              )
                return `步骤${stageNum}：请输入等待时间`;
              continue;
            }

            // Bypass 类型
            if (stage.pourType === 'bypass') {
              if (!stage.label.trim()) return `步骤${stageNum}：请输入步骤名称`;
              if (!isValidWater(stage.water, stage.pourType))
                return `步骤${stageNum}：请输入水量`;
              continue;
            }

            // 标准器具验证
            if (!isValidDuration(stage.duration) || (stage.duration ?? 0) <= 0)
              return `步骤${stageNum}：请输入阶段用时`;
            if (!stage.label.trim()) return `步骤${stageNum}：请输入步骤名称`;
            if (!isValidWater(stage.water, stage.pourType))
              return `步骤${stageNum}：请输入注水量`;
            if (!stage.pourType) return `步骤${stageNum}：请选择注水方式`;
            if (
              customEquipment.hasValve &&
              stage.valveStatus !== 'open' &&
              stage.valveStatus !== 'closed'
            )
              return `步骤${stageNum}：请设置阀门状态`;
          }
          return null;

        default:
          return null;
      }
    };

    // 按钮点击处理
    const handleButtonClick = () => {
      if (!stepValid) {
        // 显示验证错误提示
        const errorMessage = getValidationErrorMessage();
        if (errorMessage) {
          showToast({ type: 'error', title: errorMessage });
        }
        return;
      }

      if (isLastStep) {
        try {
          handleSubmit();
        } catch (error) {
          // Log error in development only
          if (process.env.NODE_ENV === 'development') {
            console.error('提交表单失败', error);
          }
        }
      } else {
        handleNextStep();
      }
    };

    return (
      <div className="modal-bottom-button flex items-center justify-center">
        <button
          type="button"
          onClick={handleButtonClick}
          className={`flex items-center justify-center p-4 ${!stepValid ? 'cursor-not-allowed opacity-50' : ''} ${isLastStep ? 'rounded-full bg-neutral-800 px-6 py-3 text-neutral-100 dark:bg-neutral-200 dark:text-neutral-800' : ''} `}
        >
          {isLastStep ? (
            <span className="font-medium">完成</span>
          ) : (
            <div className="relative flex items-center">
              <div className="h-0.5 w-24 bg-neutral-800 dark:bg-neutral-200"></div>
              <div className="absolute -right-1 translate-x-0 transform">
                <ArrowRight className="h-5 w-5 text-neutral-800 dark:text-neutral-200" />
              </div>
            </div>
          )}
        </button>
      </div>
    );
  };

  // 最终渲染
  return (
    <>
      {/* 顶部导航栏 */}
      <Steps steps={steps} currentStep={currentStep} onBack={handleBack} />

      {/* 步骤内容 */}
      <div className="flex-1 overflow-y-auto pr-2">{renderStepContent()}</div>

      {/* 下一步按钮 */}
      {renderNextButton()}
    </>
  );
};

export default CustomMethodForm;
