'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { ExtendedCoffeeBean, BlendComponent, Step, StepConfig } from './types';
import BasicInfo from './components/BasicInfo';
import DetailInfo from './components/DetailInfo';
import FlavorInfo from './components/FlavorInfo';
import {
  autofillBlendComponentsFromName,
  useBlendComponentSuggestions,
} from './hooks/useBlendComponentSuggestions';
import {
  addCustomPreset,
  DEFAULT_ORIGINS,
  DEFAULT_ESTATES,
  DEFAULT_PROCESSES,
  DEFAULT_VARIETIES,
} from './constants';
import { defaultSettings } from '@/components/settings/Settings';
import {
  ImageProcessingError,
  processImageFile,
} from '@/lib/images/imageProcessing';
import {
  getDefaultFlavorPeriodByRoastLevelSync,
  normalizeFlavorPeriodDay,
} from '@/lib/utils/flavorPeriodUtils';
import { modalHistory } from '@/lib/hooks/useModalHistory';
import { inferBeanType } from '@/lib/utils/beanTypeInference';
import { useRoasterLogo, useSettingsStore } from '@/lib/stores/settingsStore';
import {
  getBeanRoasterName,
  getCoffeeBeanRoasterSuggestions,
  prepareCoffeeBeanRoasterFieldsForFormDraft,
  prepareCoffeeBeanRoasterFieldsForSave,
  normalizeDelimitedTextList,
  updateBlendComponentsDelimitedField,
} from '@/lib/utils/coffeeBeanUtils';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';

interface CoffeeBeanFormProps {
  onSave: (bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>) => void;
  onCancel: () => void;
  initialBean?: ExtendedCoffeeBean;
  onRepurchase?: () => void;
  /** 步骤变化回调，用于同步历史栈 */
  onStepChange?: (step: number) => void;
  /** 初始豆子状态（生豆/熟豆），用于新建时自动设置 */
  initialBeanState?: 'green' | 'roasted';
  /** 当前是否处于“生豆转熟豆”烘焙流程（来源生豆ID） */
  roastingSourceBeanId?: string | null;
  /** 识别时使用的原始图片 base64（用于在表单中显示） */
  recognitionImage?: string | null;
}

// 暴露给父组件的方法
export interface CoffeeBeanFormHandle {
  handleBackStep: () => boolean;
  goToStep: (step: number) => void;
  getCurrentStep: () => number;
}

const steps: StepConfig[] = [
  { id: 'basic', label: '基本信息' },
  { id: 'detail', label: '详细信息' },
  { id: 'flavor', label: '风味描述' },
];

const getTodayLocalDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isRoastingDraft = (
  bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>,
  roastingSourceBeanId?: string | null
) => {
  return (
    !!roastingSourceBeanId &&
    bean.beanState === 'roasted' &&
    bean.sourceGreenBeanId === roastingSourceBeanId
  );
};

const createEmptyBeanDraft = (
  initialBeanState?: 'green' | 'roasted'
): Omit<ExtendedCoffeeBean, 'id' | 'timestamp'> => ({
  name: '',
  capacity: '',
  remaining: '',
  roastLevel: '',
  roastDate: '',
  flavor: [],
  price: '',
  beanType: 'filter',
  notes: '',
  startDay: undefined,
  endDay: undefined,
  blendComponents: [],
  beanState: initialBeanState || 'roasted',
  purchaseDate:
    initialBeanState === 'green' ? getTodayLocalDateString() : undefined,
});

const createInitialBeanDraft = ({
  initialBean,
  initialBeanState,
  roastingSourceBeanId,
  roasterFieldEnabled,
}: {
  initialBean?: ExtendedCoffeeBean;
  initialBeanState?: 'green' | 'roasted';
  roastingSourceBeanId?: string | null;
  roasterFieldEnabled: boolean;
}): Omit<ExtendedCoffeeBean, 'id' | 'timestamp'> => {
  if (!initialBean) {
    return createEmptyBeanDraft(initialBeanState);
  }

  const { id: _id, timestamp: _timestamp, ...beanData } = initialBean;
  const preparedBeanData = prepareCoffeeBeanRoasterFieldsForFormDraft(
    beanData,
    { roasterFieldEnabled }
  );

  if (!preparedBeanData.beanType) {
    preparedBeanData.beanType = 'filter';
  }

  if (isRoastingDraft(preparedBeanData, roastingSourceBeanId)) {
    preparedBeanData.roastLevel = '';
    preparedBeanData.startDay = undefined;
    preparedBeanData.endDay = undefined;
  }

  return preparedBeanData;
};

const CoffeeBeanForm = forwardRef<CoffeeBeanFormHandle, CoffeeBeanFormProps>(
  (
    {
      onSave,
      onCancel: _onCancel,
      initialBean,
      onRepurchase,
      onStepChange,
      initialBeanState,
      roastingSourceBeanId,
      recognitionImage,
    },
    ref
  ) => {
    // 当前步骤状态
    const [currentStep, setCurrentStep] = useState<Step>('basic');
    const inputRef = useRef<HTMLInputElement>(null);

    // 添加一个状态来跟踪正在编辑的剩余容量输入
    const [editingRemaining, setEditingRemaining] = useState<string | null>(
      null
    );

    // 添加拼配成分状态
    const [blendComponents, setBlendComponents] = useState<BlendComponent[]>(
      () => {
        if (
          initialBean &&
          initialBean.blendComponents &&
          initialBean.blendComponents.length > 0
        ) {
          return initialBean.blendComponents;
        }

        // 如果没有拼配成分，创建一个空的成分用于单品豆
        // （移除了旧的 origin/process/variety 字段兼容性代码）

        // 默认创建一个空成分
        return [
          {
            origin: '',
            estate: '',
            process: '',
            variety: '',
          },
        ];
      }
    );
    const blendComponentNameAutofillRef = useRef<BlendComponent[]>([]);

    const [bean, setBean] = useState<
      Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>
    >(() => {
      const currentSettings = useSettingsStore.getState().settings;
      return createInitialBeanDraft({
        initialBean,
        initialBeanState,
        roastingSourceBeanId,
        roasterFieldEnabled: !!currentSettings.roasterFieldEnabled,
      });
    });

    // 定义额外的状态来跟踪风味标签输入
    const [flavorInput, setFlavorInput] = useState('');

    // 获取设置和所有咖啡豆用于烘焙商建议
    const settings = useSettingsStore(state => state.settings);
    const allBeans = useCoffeeBeanStore(state => state.beans);

    const roasterSuggestions = React.useMemo(() => {
      return getCoffeeBeanRoasterSuggestions(
        allBeans,
        !!settings.roasterFieldEnabled
      );
    }, [allBeans, settings.roasterFieldEnabled]);
    const blendComponentSuggestions = useBlendComponentSuggestions();

    const roasterLogoName = React.useMemo(() => {
      // 根据是否启用独立烘焙商字段决定如何获取烘焙商名称
      // 启用独立输入时：只从 roaster 字段获取
      // 关闭独立输入时：从名称中提取
      return getBeanRoasterName(bean) || null;
    }, [bean.name, bean.roaster]);

    // 烘焙商图标仅用于显示，不存储到咖啡豆数据
    const roasterLogo = useRoasterLogo(roasterLogoName);

    // 自动填充识图图片 - 在表单加载时检查设置，如果开启了自动填充且有识图图片，则自动填充
    useEffect(() => {
      // 只要没有图片且有识图图片就自动填充（不管是新建还是编辑）
      // 因为识图导入后会先保存到数据库再打开表单，此时 initialBean 会有值
      if (!bean.image && recognitionImage) {
        // 从 settingsStore 获取设置
        const settings = useSettingsStore.getState().settings;

        // 检查是否开启了自动填充设置
        if (settings.autoFillRecognitionImage) {
          setBean(prev => ({
            ...prev,
            image: recognitionImage,
          }));
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recognitionImage]); // 只依赖 recognitionImage，避免重复触发

    // 自动聚焦输入框
    useEffect(() => {
      if (currentStep === 'basic' && inputRef.current) {
        inputRef.current.focus();
      }
    }, [currentStep]);

    // 验证剩余容量，确保不超过总容量（失焦时再次验证）
    const validateRemaining = useCallback(() => {
      setEditingRemaining(null);

      if (bean.capacity && bean.remaining) {
        const capacityNum = parseFloat(bean.capacity);
        const remainingNum = parseFloat(bean.remaining);

        if (
          !isNaN(capacityNum) &&
          !isNaN(remainingNum) &&
          remainingNum > capacityNum
        ) {
          setBean(prev => ({
            ...prev,
            remaining: bean.capacity,
          }));
        }
      }
    }, [bean.capacity, bean.remaining]);

    // 处理总量失焦时的同步逻辑（现在主要逻辑在BasicInfo组件中处理）
    const handleCapacityBlur = useCallback(() => {
      // 预留给其他可能的失焦处理逻辑
    }, []);

    // 处理容量变化并智能推断咖啡豆类型
    // 只在新建模式下自动推断，编辑模式保持用户原有选择
    const handleCapacityChangeForTypeInference = useCallback(
      (capacity: string) => {
        // 只在新建模式下进行自动推断
        if (initialBean) return;

        // 如果用户已选择全能，不再自动推断
        if (bean.beanType === 'omni') return;

        const type = inferBeanType(capacity);
        if (type) {
          setBean(prev => ({ ...prev, beanType: type }));
        }
      },
      [initialBean, bean.beanType]
    );

    // 获取当前步骤索引
    const getCurrentStepIndex = () => {
      return steps.findIndex(step => step.id === currentStep);
    };

    // 暴露给父组件的方法
    useImperativeHandle(ref, () => ({
      // 返回 true 表示处理了返回（返回上一步），false 表示已在第一步
      handleBackStep: () => {
        const currentIndex = getCurrentStepIndex();
        if (currentIndex > 0) {
          setCurrentStep(steps[currentIndex - 1].id);
          return true; // 处理了返回
        }
        return false; // 已经在第一步，无法再返回
      },
      // 直接跳转到指定步骤
      goToStep: (step: number) => {
        if (step >= 1 && step <= steps.length) {
          setCurrentStep(steps[step - 1].id);
        }
      },
      // 获取当前步骤号（1-based）
      getCurrentStep: () => {
        return getCurrentStepIndex() + 1;
      },
    }));

    // 下一步
    const handleNextStep = () => {
      validateRemaining();

      const currentIndex = getCurrentStepIndex();
      if (currentIndex < steps.length - 1) {
        const nextStep = currentIndex + 2; // 步骤号从 1 开始
        setCurrentStep(steps[currentIndex + 1].id);
        // 通知父组件步骤变化，让它推入新历史
        onStepChange?.(nextStep);
      } else {
        handleSubmit();
      }
    };

    // 上一步/返回 - 通过历史栈管理
    const handleBack = () => {
      validateRemaining();
      // 使用历史栈的 back()，这会触发 onStepChange 或 onClose
      modalHistory.back();
    };

    // 添加风味标签
    const handleAddFlavor = (flavorValue?: string) => {
      const value = flavorValue || flavorInput;
      const nextFlavors = normalizeDelimitedTextList(value);
      if (nextFlavors.length === 0) return;

      setBean(prev => ({
        ...prev,
        flavor: Array.from(new Set([...(prev.flavor || []), ...nextFlavors])),
      }));
      if (!flavorValue) setFlavorInput('');
    };

    // 移除风味标签
    const handleRemoveFlavor = (flavor: string) => {
      setBean(prev => ({
        ...prev,
        flavor: prev.flavor?.filter((f: string) => f !== flavor) || [],
      }));
    };

    // 根据烘焙度自动设置赏味期参数
    const autoSetFlavorPeriod = useCallback(
      (roastLevelOverride?: string) => {
        let startDay = 0;
        let endDay = 0;

        const currentRoastLevel = roastLevelOverride || bean.roastLevel || '';

        try {
          const currentSettings = useSettingsStore.getState().settings;
          const customFlavorPeriod =
            currentSettings.customFlavorPeriod ||
            defaultSettings.customFlavorPeriod;

          const roasterName = getBeanRoasterName(bean) || undefined;

          const flavorPeriod = getDefaultFlavorPeriodByRoastLevelSync(
            currentRoastLevel,
            customFlavorPeriod,
            roasterName
          );
          startDay = flavorPeriod.startDay;
          endDay = flavorPeriod.endDay;
        } catch (error) {
          console.error('获取自定义赏味期设置失败，使用默认值:', error);
          const flavorPeriod =
            getDefaultFlavorPeriodByRoastLevelSync(currentRoastLevel);
          startDay = flavorPeriod.startDay;
          endDay = flavorPeriod.endDay;
        }

        setBean(prev => ({
          ...prev,
          startDay: startDay || undefined,
          endDay: endDay || undefined,
          isFrozen: false,
        }));
      },
      [bean.name, bean.roastLevel]
    );

    // 处理输入变化
    const handleInputChange =
      (field: keyof Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>) =>
      (value: string) => {
        const safeValue = String(value || '');

        if (field === 'startDay' || field === 'endDay') {
          const day = normalizeFlavorPeriodDay(safeValue);

          setBean(prev => ({
            ...prev,
            [field]: day || undefined,
          }));
        } else if (field === 'capacity') {
          // 修改正则表达式以允许小数点
          const numericValue = safeValue.replace(/[^0-9.]/g, '');

          // 确保只有一个小数点
          const dotCount = (numericValue.match(/\./g) || []).length;
          let sanitizedValue =
            dotCount > 1
              ? numericValue.substring(0, numericValue.lastIndexOf('.'))
              : numericValue;

          // 限制小数点后只能有一位数字
          const dotIndex = sanitizedValue.indexOf('.');
          if (dotIndex !== -1 && dotIndex < sanitizedValue.length - 2) {
            sanitizedValue = sanitizedValue.substring(0, dotIndex + 2);
          }

          // 更新总量，不实时同步剩余量
          setBean(prev => ({
            ...prev,
            capacity: sanitizedValue,
            // 总量清空时，剩余量也清空
            remaining: sanitizedValue.trim() === '' ? '' : prev.remaining,
          }));
          setEditingRemaining(null);
        } else if (field === 'remaining') {
          // 修改正则表达式以允许小数点
          const numericValue = safeValue.replace(/[^0-9.]/g, '');

          // 确保只有一个小数点
          const dotCount = (numericValue.match(/\./g) || []).length;
          let sanitizedValue =
            dotCount > 1
              ? numericValue.substring(0, numericValue.lastIndexOf('.'))
              : numericValue;

          // 限制小数点后只能有一位数字
          const dotIndex = sanitizedValue.indexOf('.');
          if (dotIndex !== -1 && dotIndex < sanitizedValue.length - 2) {
            sanitizedValue = sanitizedValue.substring(0, dotIndex + 2);
          }

          setEditingRemaining(sanitizedValue);

          if (bean.capacity && sanitizedValue.trim() !== '') {
            const capacityNum = parseFloat(bean.capacity);
            const remainingNum = parseFloat(sanitizedValue);

            if (!isNaN(capacityNum) && !isNaN(remainingNum)) {
              if (remainingNum > capacityNum) {
                setEditingRemaining(bean.capacity);
                setBean(prev => ({
                  ...prev,
                  remaining: prev.capacity,
                }));
                return;
              }
            }
          }

          setBean(prev => ({
            ...prev,
            remaining: sanitizedValue,
          }));
        } else if (field === 'roastLevel') {
          setBean(prev => ({
            ...prev,
            [field]: safeValue,
          }));

          autoSetFlavorPeriod(safeValue);
        } else if (field === 'name') {
          // 更新名称
          setBean(prev => ({
            ...prev,
            [field]: safeValue,
          }));

          setBlendComponents(prev => {
            const autofillResult = autofillBlendComponentsFromName(
              prev,
              safeValue,
              blendComponentSuggestions,
              blendComponentNameAutofillRef.current
            );

            blendComponentNameAutofillRef.current =
              autofillResult.autofillComponents;

            return autofillResult.components;
          });
        } else {
          setBean(prev => ({
            ...prev,
            [field]: safeValue,
          }));
        }
      };

    // 添加拼配成分处理函数
    const handleAddBlendComponent = () => {
      setBlendComponents(prev => {
        const totalPercentage = prev.reduce(
          (sum, comp) => (comp.percentage ? sum + comp.percentage : sum),
          0
        );

        if (prev.length > 1 && totalPercentage >= 100) {
          return prev;
        }

        return [
          ...prev,
          {
            origin: '',
            process: '',
            variety: '',
          },
        ];
      });
    };

    const handleRemoveBlendComponent = (index: number) => {
      setBlendComponents(prev =>
        prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
      );
    };

    const handleBlendComponentChange = (
      index: number,
      field: keyof BlendComponent,
      value: string | number
    ) => {
      setBlendComponents(prev => {
        const newComponents = [...prev];

        if (field === 'percentage') {
          if (value === '' || value === null || value === undefined) {
            delete newComponents[index].percentage;
          } else {
            // 将输入值转换为数字
            const numValue =
              typeof value === 'string' ? parseInt(value) || 0 : value;

            // 直接设置值，AutocompleteInput组件的maxValue属性会负责限制最大值
            newComponents[index].percentage = numValue;
          }
        } else {
          return updateBlendComponentsDelimitedField(
            newComponents,
            index,
            field,
            value as string
          );
        }

        return newComponents;
      });
    };

    // 提交表单
    const handleSubmit = async () => {
      validateRemaining();

      const addPresetValues = (
        key: 'origins' | 'estates' | 'processes' | 'varieties',
        defaultValues: string[],
        value?: string
      ) => {
        normalizeDelimitedTextList(value).forEach(item => {
          if (!defaultValues.includes(item)) {
            addCustomPreset(key, item);
          }
        });
      };

      // 保存自定义的预设值
      blendComponents.forEach(component => {
        addPresetValues('origins', DEFAULT_ORIGINS, component.origin);
        addPresetValues('estates', DEFAULT_ESTATES, component.estate);
        addPresetValues('processes', DEFAULT_PROCESSES, component.process);
        addPresetValues('varieties', DEFAULT_VARIETIES, component.variety);
      });

      if (bean.roaster?.trim()) {
        addCustomPreset('roasters', bean.roaster);
      }

      if (bean.roastLevel?.trim()) {
        addCustomPreset('roastLevels', bean.roastLevel);
      }

      bean.flavor?.forEach(flavor => {
        addCustomPreset('flavors', flavor);
      });

      // 先清理历史栈（关闭所有 bean-form 相关的历史记录）
      modalHistory.closeAllByPrefix('bean-form');

      // 准备保存的数据
      const finalBean = prepareCoffeeBeanRoasterFieldsForSave(
        { ...bean, blendComponents },
        { roasterFieldEnabled: settings.roasterFieldEnabled }
      );

      // 调用保存回调
      onSave(finalBean);
    };

    // 切换冷冻状态
    const toggleFrozenState = () => {
      setBean(prev => ({
        ...prev,
        isFrozen: !prev.isFrozen,
      }));
    };

    // 切换在途状态
    const toggleInTransitState = () => {
      setBean(prev => ({
        ...prev,
        isInTransit: !prev.isInTransit,
        // 设为在途时清空烘焙日期和赏味期设置
        roastDate: !prev.isInTransit ? '' : prev.roastDate,
        startDay: !prev.isInTransit ? undefined : prev.startDay,
        endDay: !prev.isInTransit ? undefined : prev.endDay,
        isFrozen: !prev.isInTransit ? false : prev.isFrozen,
      }));
    };

    // 处理图片上传
    const handleImageUpload = async (file: File) => {
      try {
        const image = await processImageFile(file, {
          compression: {
            maxSizeMB: 0.1,
            maxWidthOrHeight: 1200,
            initialQuality: 0.8,
          },
        });
        setBean(prev => ({ ...prev, image }));
      } catch (error) {
        alert(
          error instanceof ImageProcessingError
            ? error.message
            : '图片处理失败，请更换图片后重试'
        );
      }
    };

    // 处理背面图片上传
    const handleBackImageUpload = async (file: File) => {
      try {
        const backImage = await processImageFile(file, {
          compression: {
            maxSizeMB: 0.1,
            maxWidthOrHeight: 1200,
            initialQuality: 0.8,
          },
        });
        setBean(prev => ({ ...prev, backImage }));
      } catch (error) {
        alert(
          error instanceof ImageProcessingError
            ? error.message
            : '背面图片处理失败，请更换图片后重试'
        );
      }
    };

    // 验证当前步骤是否可以进行下一步
    const isStepValid = () => {
      if (currentStep === 'basic') {
        return typeof bean.name === 'string' && bean.name.trim() !== '';
      }

      if (currentStep === 'detail') {
        // 确保有选择beanType(手冲/意式/全能)
        return (
          typeof bean.beanType === 'string' &&
          (bean.beanType === 'filter' ||
            bean.beanType === 'espresso' ||
            bean.beanType === 'omni')
        );
      }

      return true;
    };

    // 渲染进度条
    const renderProgressBar = () => {
      const currentIndex = getCurrentStepIndex();
      const progress = ((currentIndex + 1) / steps.length) * 100;

      return (
        <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
          <div
            className="h-full bg-neutral-800 transition-all duration-300 ease-in-out dark:bg-neutral-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      );
    };

    // 渲染步骤内容
    const renderStepContent = () => {
      switch (currentStep) {
        case 'basic':
          return (
            <BasicInfo
              bean={bean}
              onBeanChange={handleInputChange}
              onImageUpload={handleImageUpload}
              onBackImageUpload={handleBackImageUpload}
              editingRemaining={editingRemaining}
              validateRemaining={validateRemaining}
              handleCapacityBlur={handleCapacityBlur}
              toggleInTransitState={toggleInTransitState}
              isEdit={!!initialBean}
              onRepurchase={onRepurchase}
              recognitionImage={recognitionImage}
              onCapacityChange={handleCapacityChangeForTypeInference}
              roasterLogo={roasterLogo}
              roasterFieldEnabled={settings.roasterFieldEnabled}
              roasterSuggestions={roasterSuggestions}
              roastingSourceBeanId={roastingSourceBeanId}
            />
          );

        case 'detail':
          return (
            <DetailInfo
              bean={bean}
              onBeanChange={handleInputChange}
              blendComponents={blendComponents}
              onBlendComponentsChange={{
                add: handleAddBlendComponent,
                remove: handleRemoveBlendComponent,
                change: handleBlendComponentChange,
              }}
              autoSetFlavorPeriod={autoSetFlavorPeriod}
              toggleFrozenState={toggleFrozenState}
            />
          );

        case 'flavor':
          return (
            <FlavorInfo
              bean={bean}
              flavorInput={flavorInput}
              onFlavorInputChange={setFlavorInput}
              onAddFlavor={handleAddFlavor}
              onRemoveFlavor={handleRemoveFlavor}
            />
          );

        default:
          return null;
      }
    };

    const renderNextButton = () => {
      const isLastStep = getCurrentStepIndex() === steps.length - 1;
      const valid = isStepValid();
      const canSave = valid && !isLastStep;

      const springTransition = { stiffness: 500, damping: 25 };
      const buttonBaseClass =
        'rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100';

      return (
        <div className="pb-safe-bottom flex items-center justify-center pt-4">
          <div className="flex items-center justify-center gap-2">
            <AnimatePresence mode="popLayout">
              {canSave && (
                <motion.button
                  key="save-button"
                  type="button"
                  onClick={handleSubmit}
                  className={`${buttonBaseClass} flex shrink-0 items-center gap-2 px-4 py-3`}
                  title="快速保存"
                  initial={{ scale: 0.8, opacity: 0, x: 15 }}
                  animate={{ scale: 1, opacity: 1, x: 0 }}
                  exit={{ scale: 0.8, opacity: 0, x: 15 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={springTransition}
                >
                  <Check className="h-4 w-4" strokeWidth="3" />
                  <span className="font-medium">完成</span>
                </motion.button>
              )}
            </AnimatePresence>

            <motion.button
              layout
              type="button"
              onClick={handleNextStep}
              disabled={!valid}
              transition={springTransition}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`${buttonBaseClass} flex items-center justify-center ${!valid ? 'cursor-not-allowed opacity-0' : ''} ${isLastStep ? 'px-6 py-3' : 'p-4'}`}
            >
              {isLastStep ? (
                <span className="font-medium">完成</span>
              ) : (
                <ArrowRight className="h-4 w-4" strokeWidth="3" />
              )}
            </motion.button>
          </div>
        </div>
      );
    };

    // 钩子函数确保任何步骤切换时都验证剩余容量
    useEffect(() => {
      validateRemaining();
    }, [currentStep, validateRemaining]);

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 py-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="-m-3 cursor-pointer rounded-full p-3"
            >
              <ArrowLeft className="h-5 w-5 text-neutral-800 dark:text-neutral-200" />
            </button>

            <div className="flex-1 px-4">{renderProgressBar()}</div>

            <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              {getCurrentStepIndex() + 1}/{steps.length}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          <AnimatePresence mode="wait">{renderStepContent()}</AnimatePresence>
        </div>

        <div className="shrink-0">{renderNextButton()}</div>
      </div>
    );
  }
);

CoffeeBeanForm.displayName = 'CoffeeBeanForm';

export default CoffeeBeanForm;
