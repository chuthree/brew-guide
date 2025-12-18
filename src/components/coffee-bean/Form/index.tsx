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
import Complete from './components/Complete';
import {
  addCustomPreset,
  DEFAULT_ORIGINS,
  DEFAULT_ESTATES,
  DEFAULT_PROCESSES,
  DEFAULT_VARIETIES,
} from './constants';
import {
  defaultSettings,
  type SettingsOptions,
} from '@/components/settings/Settings';
import { compressBase64Image } from '@/lib/utils/imageCapture';
import { getDefaultFlavorPeriodByRoastLevelSync } from '@/lib/utils/flavorPeriodUtils';
import { modalHistory } from '@/lib/hooks/useModalHistory';
import { inferBeanType } from '@/lib/utils/beanTypeInference';

interface CoffeeBeanFormProps {
  onSave: (bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>) => void;
  onCancel: () => void;
  initialBean?: ExtendedCoffeeBean;
  onRepurchase?: () => void;
  /** 步骤变化回调，用于同步历史栈 */
  onStepChange?: (step: number) => void;
  /** 初始豆子状态（生豆/熟豆），用于新建时自动设置 */
  initialBeanState?: 'green' | 'roasted';
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
  { id: 'complete', label: '完成' },
];

const CoffeeBeanForm = forwardRef<CoffeeBeanFormHandle, CoffeeBeanFormProps>(
  (
    {
      onSave,
      onCancel,
      initialBean,
      onRepurchase,
      onStepChange,
      initialBeanState,
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

    // 记录初始剩余容量，用于检测容量变动
    const initialRemainingRef = useRef<string>(initialBean?.remaining || '');

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

    const [bean, setBean] = useState<
      Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>
    >(() => {
      if (initialBean) {
        const { id: _id, timestamp: _timestamp, ...beanData } = initialBean;

        // 不预设烘焙度默认值，保持数据严谨性

        // 确保有beanType字段，默认为手冲
        if (!beanData.beanType) {
          beanData.beanType = 'filter';
        }

        const needFlavorPeriodInit = !beanData.startDay && !beanData.endDay;

        if (needFlavorPeriodInit && beanData.roastLevel) {
          // 这里先设置默认值，后续会在useEffect中用自定义设置覆盖
          let startDay = 0;
          let endDay = 0;

          if (beanData.roastLevel.includes('浅')) {
            startDay = 7;
            endDay = 60;
          } else if (beanData.roastLevel.includes('深')) {
            startDay = 14;
            endDay = 90;
          } else {
            startDay = 10;
            endDay = 60;
          }

          beanData.startDay = startDay;
          beanData.endDay = endDay;
        }

        return beanData;
      }

      return {
        name: '',
        capacity: '',
        remaining: '',
        roastLevel: '',
        roastDate: '',
        flavor: [],
        price: '',
        beanType: 'filter', // 默认为手冲
        notes: '',
        startDay: 0,
        endDay: 0,
        blendComponents: [],
        beanState: initialBeanState || 'roasted', // 使用传入的 initialBeanState 或默认为熟豆
        // 生豆预设今天的购买日期
        purchaseDate:
          initialBeanState === 'green'
            ? (() => {
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
              })()
            : undefined,
      };
    });

    // 定义额外的状态来跟踪风味标签输入
    const [flavorInput, setFlavorInput] = useState('');

    // 自动填充识图图片 - 在表单加载时检查设置，如果开启了自动填充且有识图图片，则自动填充
    useEffect(() => {
      const autoFillRecognitionImage = async () => {
        console.log(
          '[自动填充检查] recognitionImage:',
          recognitionImage ? '有图片' : '无图片'
        );
        console.log(
          '[自动填充检查] initialBean:',
          initialBean ? '编辑模式' : '新建模式'
        );
        console.log(
          '[自动填充检查] bean.image:',
          bean.image ? '已有图片' : '无图片'
        );

        // 只要没有图片且有识图图片就自动填充（不管是新建还是编辑）
        // 因为识图导入后会先保存到数据库再打开表单，此时 initialBean 会有值
        if (!bean.image && recognitionImage) {
          try {
            const { Storage } = await import('@/lib/core/storage');
            const settingsStr = await Storage.get('brewGuideSettings');
            let settings: SettingsOptions = defaultSettings;

            if (settingsStr) {
              settings = JSON.parse(settingsStr);
            }

            console.log(
              '[自动填充检查] autoFillRecognitionImage 设置:',
              settings.autoFillRecognitionImage
            );

            // 检查是否开启了自动填充设置
            if (settings.autoFillRecognitionImage) {
              console.log('[自动填充] 开始填充图片');
              setBean(prev => ({
                ...prev,
                image: recognitionImage,
              }));
            } else {
              console.log('[自动填充] 设置未开启，不自动填充');
            }
          } catch (error) {
            console.error('自动填充识图图片失败:', error);
          }
        }
      };

      autoFillRecognitionImage();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recognitionImage]); // 只依赖 recognitionImage，避免重复触发

    // 从设置中加载自定义赏味期设置
    useEffect(() => {
      const loadSettingsAndInitializeBean = async () => {
        try {
          const { Storage } = await import('@/lib/core/storage');
          const settingsStr = await Storage.get('brewGuideSettings');
          let settings: SettingsOptions = defaultSettings;

          if (settingsStr) {
            settings = JSON.parse(settingsStr);
          }

          // 如果是新建咖啡豆且没有设置赏味期，使用自定义设置初始化
          if (
            !initialBean &&
            bean.startDay === 0 &&
            bean.endDay === 0 &&
            bean.roastLevel
          ) {
            const customFlavorPeriod =
              settings.customFlavorPeriod || defaultSettings.customFlavorPeriod;
            const detailedEnabled =
              settings.detailedFlavorPeriodEnabled ?? false;
            const detailedFlavorPeriod =
              settings.detailedFlavorPeriod ||
              defaultSettings.detailedFlavorPeriod;

            const { extractRoasterFromName } = await import(
              '@/lib/utils/beanVarietyUtils'
            );
            const roasterName = extractRoasterFromName(bean.name);

            const { startDay, endDay } = getDefaultFlavorPeriodByRoastLevelSync(
              bean.roastLevel,
              customFlavorPeriod,
              roasterName,
              detailedEnabled,
              detailedFlavorPeriod
            );

            setBean(prev => ({
              ...prev,
              startDay,
              endDay,
            }));
          }
        } catch (error) {
          console.error('加载设置失败:', error);
        }
      };

      loadSettingsAndInitializeBean();
    }, [bean.endDay, bean.roastLevel, bean.startDay, initialBean]);

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
      if (!value.trim()) return;

      if (bean.flavor?.includes(value.trim())) {
        if (!flavorValue) setFlavorInput('');
        return;
      }

      setBean({
        ...bean,
        flavor: [...(bean.flavor || []), value.trim()],
      });
      if (!flavorValue) setFlavorInput('');
    };

    // 移除风味标签
    const handleRemoveFlavor = (flavor: string) => {
      setBean({
        ...bean,
        flavor: bean.flavor?.filter((f: string) => f !== flavor) || [],
      });
    };

    // 处理输入变化
    const handleInputChange =
      (field: keyof Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>) =>
      (value: string) => {
        const safeValue = String(value || '');

        if (field === 'capacity') {
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

          // 传入新的烘焙度值，避免使用过时的state
          setTimeout(() => autoSetFlavorPeriod(safeValue), 100);
        } else if (field === 'name') {
          // 更新名称
          setBean(prev => ({
            ...prev,
            [field]: safeValue,
          }));

          // 从名称中智能提取产地、庄园、处理法、品种并自动填充到成分
          if (safeValue.trim() && blendComponents.length === 1) {
            const extractedOrigin = DEFAULT_ORIGINS.find(origin =>
              safeValue.includes(origin)
            );
            const extractedEstate = DEFAULT_ESTATES.find(estate =>
              safeValue.includes(estate)
            );
            const extractedProcess = DEFAULT_PROCESSES.find(process =>
              safeValue.includes(process)
            );
            const extractedVariety = DEFAULT_VARIETIES.find(variety =>
              safeValue.includes(variety)
            );

            // 只有当提取到信息且对应字段为空时才自动填充
            if (
              extractedOrigin ||
              extractedEstate ||
              extractedProcess ||
              extractedVariety
            ) {
              setBlendComponents(prev => {
                const newComponents = [...prev];
                if (newComponents.length > 0) {
                  // 只在字段为空时填充，避免覆盖用户手动输入的内容
                  if (extractedOrigin && !newComponents[0].origin) {
                    newComponents[0] = {
                      ...newComponents[0],
                      origin: extractedOrigin,
                    };
                  }
                  if (extractedEstate && !newComponents[0].estate) {
                    newComponents[0] = {
                      ...newComponents[0],
                      estate: extractedEstate,
                    };
                  }
                  if (extractedProcess && !newComponents[0].process) {
                    newComponents[0] = {
                      ...newComponents[0],
                      process: extractedProcess,
                    };
                  }
                  if (extractedVariety && !newComponents[0].variety) {
                    newComponents[0] = {
                      ...newComponents[0],
                      variety: extractedVariety,
                    };
                  }
                }
                return newComponents;
              });
            }
          }
        } else {
          setBean(prev => ({
            ...prev,
            [field]: safeValue,
          }));
        }
      };

    // 添加拼配成分处理函数
    const handleAddBlendComponent = () => {
      // 计算当前总百分比
      const totalPercentage = blendComponents.reduce(
        (sum, comp) => (comp.percentage ? sum + comp.percentage : sum),
        0
      );

      // 如果不是第一个成分且总百分比已经达到100%，则不允许添加更多成分
      if (blendComponents.length > 1 && totalPercentage >= 100) {
        return;
      }

      setBlendComponents([
        ...blendComponents,
        {
          origin: '',
          process: '',
          variety: '',
        },
      ]);
    };

    const handleRemoveBlendComponent = (index: number) => {
      if (blendComponents.length <= 1) return;

      const newComponents = blendComponents.filter((_, i) => i !== index);
      setBlendComponents(newComponents);
    };

    const handleBlendComponentChange = (
      index: number,
      field: keyof BlendComponent,
      value: string | number
    ) => {
      const newComponents = [...blendComponents];

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
        newComponents[index][field] = value as string;
      }

      setBlendComponents(newComponents);
    };

    // 创建容量调整记录的辅助函数
    const createCapacityAdjustmentRecord = async (
      originalAmount: number,
      newAmount: number
    ) => {
      const changeAmount = newAmount - originalAmount;
      const timestamp = Date.now();
      const changeType =
        changeAmount > 0 ? 'increase' : changeAmount < 0 ? 'decrease' : 'set';

      // 简化备注内容
      const noteContent = '容量调整(不计入统计)';

      // 创建容量调整记录（简化版本，参考快捷扣除记录）
      const adjustmentRecord = {
        id: timestamp.toString(),
        timestamp,
        source: 'capacity-adjustment',
        beanId: initialBean!.id,
        equipment: '',
        method: '',
        coffeeBeanInfo: {
          name: initialBean!.name || '',
          roastLevel: initialBean!.roastLevel || '中度烘焙',
          roastDate: initialBean!.roastDate,
        },
        notes: noteContent,
        rating: 0,
        taste: { acidity: 0, sweetness: 0, bitterness: 0, body: 0 },
        params: {
          coffee: `${Math.abs(changeAmount)}g`,
          water: '',
          ratio: '',
          grindSize: '',
          temp: '',
        },
        totalTime: 0,
        changeRecord: {
          capacityAdjustment: {
            originalAmount,
            newAmount,
            changeAmount,
            changeType,
          },
        },
      };

      // 保存记录（参考快捷扣除记录的保存方式）
      const { Storage } = await import('@/lib/core/storage');
      const existingNotesStr = await Storage.get('brewingNotes');
      const existingNotes = existingNotesStr
        ? JSON.parse(existingNotesStr)
        : [];
      const updatedNotes = [adjustmentRecord, ...existingNotes];

      // 更新全局缓存
      try {
        const { globalCache } = await import(
          '@/components/notes/List/globalCache'
        );
        globalCache.notes = updatedNotes;

        const { calculateTotalCoffeeConsumption } = await import(
          '@/components/notes/List/globalCache'
        );
        globalCache.totalConsumption =
          calculateTotalCoffeeConsumption(updatedNotes);
      } catch (error) {
        console.error('更新全局缓存失败:', error);
      }

      await Storage.set('brewingNotes', JSON.stringify(updatedNotes));
      console.warn('容量调整记录创建成功:', noteContent);
    };

    // 提交表单
    const handleSubmit = async () => {
      validateRemaining();

      // 保存自定义的预设值
      blendComponents.forEach(component => {
        // 检查产地是否是自定义值
        if (component.origin && !DEFAULT_ORIGINS.includes(component.origin)) {
          addCustomPreset('origins', component.origin);
        }

        // 检查庄园是否是自定义值
        if (component.estate && !DEFAULT_ESTATES.includes(component.estate)) {
          addCustomPreset('estates', component.estate);
        }

        // 检查处理法是否是自定义值
        if (
          component.process &&
          !DEFAULT_PROCESSES.includes(component.process)
        ) {
          addCustomPreset('processes', component.process);
        }

        // 检查品种是否是自定义值
        if (
          component.variety &&
          !DEFAULT_VARIETIES.includes(component.variety)
        ) {
          addCustomPreset('varieties', component.variety);
        }
      });

      // 如果是编辑模式且容量发生变化，创建容量变动记录
      if (initialBean && initialBean.id) {
        try {
          const originalAmount = parseFloat(initialRemainingRef.current || '0');
          const newAmount = parseFloat(bean.remaining || '0');
          const changeAmount = newAmount - originalAmount;

          // 检查是否有有效的变化（避免微小的浮点数差异）
          if (
            !isNaN(originalAmount) &&
            !isNaN(newAmount) &&
            Math.abs(changeAmount) >= 0.01
          ) {
            await createCapacityAdjustmentRecord(originalAmount, newAmount);
          }
        } catch (error) {
          console.error('创建容量变动记录失败:', error);
          // 不阻止保存流程，只记录错误
        }
      }

      // 先清理历史栈（关闭所有 bean-form 相关的历史记录）
      modalHistory.closeAllByPrefix('bean-form');

      // 然后调用保存回调
      onSave({
        ...bean,
        blendComponents: blendComponents,
      });
    };

    // 根据烘焙度自动设置赏味期参数
    const autoSetFlavorPeriod = async (roastLevelOverride?: string) => {
      let startDay = 0;
      let endDay = 0;

      // 使用传入的烘焙度参数，如果没有则使用当前的bean.roastLevel
      const currentRoastLevel = roastLevelOverride || bean.roastLevel || '';

      try {
        // 从设置中获取自定义赏味期配置
        const { Storage } = await import('@/lib/core/storage');
        const settingsStr = await Storage.get('brewGuideSettings');
        let customFlavorPeriod = defaultSettings.customFlavorPeriod;
        let detailedEnabled = false;
        let detailedFlavorPeriod = defaultSettings.detailedFlavorPeriod;

        if (settingsStr) {
          const settings: SettingsOptions = JSON.parse(settingsStr);
          customFlavorPeriod =
            settings.customFlavorPeriod || defaultSettings.customFlavorPeriod;
          detailedEnabled = settings.detailedFlavorPeriodEnabled ?? false;
          detailedFlavorPeriod =
            settings.detailedFlavorPeriod ||
            defaultSettings.detailedFlavorPeriod;
        }

        // 从咖啡豆名称中提取烘焙商名称
        const { extractRoasterFromName } = await import(
          '@/lib/utils/beanVarietyUtils'
        );
        const roasterName = bean.name
          ? extractRoasterFromName(bean.name)
          : undefined;

        // 使用工具函数获取烘焙度对应的赏味期设置，传入烘焙商名称和详细模式参数
        const flavorPeriod = getDefaultFlavorPeriodByRoastLevelSync(
          currentRoastLevel,
          customFlavorPeriod,
          roasterName,
          detailedEnabled,
          detailedFlavorPeriod
        );
        startDay = flavorPeriod.startDay;
        endDay = flavorPeriod.endDay;
      } catch (error) {
        console.error('获取自定义赏味期设置失败，使用默认值:', error);
        // 使用工具函数获取默认值
        const flavorPeriod =
          getDefaultFlavorPeriodByRoastLevelSync(currentRoastLevel);
        startDay = flavorPeriod.startDay;
        endDay = flavorPeriod.endDay;
      }

      setBean(prev => ({
        ...prev,
        startDay,
        endDay,
        isFrozen: false, // 设置赏味期时取消冷冻状态
      }));
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
        startDay: !prev.isInTransit ? 0 : prev.startDay,
        endDay: !prev.isInTransit ? 0 : prev.endDay,
        isFrozen: !prev.isInTransit ? false : prev.isFrozen,
      }));
    };

    // 处理图片上传
    const handleImageUpload = async (file: File) => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          if (!base64) return;

          const compressedBase64 = await compressBase64Image(base64, {
            maxSizeMB: 0.1, // 100KB
            maxWidthOrHeight: 1200,
            initialQuality: 0.8,
          });
          setBean(prev => ({ ...prev, image: compressedBase64 }));
        } catch (error) {
          // Log error in development only
          if (process.env.NODE_ENV === 'development') {
            console.error('图片处理失败:', error);
          }
        }
      };

      reader.onerror = () => {
        // Log error in development only
        if (process.env.NODE_ENV === 'development') {
          console.error('文件读取失败');
        }
      };

      reader.readAsDataURL(file);
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
              editingRemaining={editingRemaining}
              validateRemaining={validateRemaining}
              handleCapacityBlur={handleCapacityBlur}
              toggleInTransitState={toggleInTransitState}
              isEdit={!!initialBean}
              onRepurchase={onRepurchase}
              recognitionImage={recognitionImage}
              onCapacityChange={handleCapacityChangeForTypeInference}
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

        case 'complete':
          return (
            <Complete
              bean={bean}
              blendComponents={blendComponents}
              isEdit={!!initialBean}
            />
          );

        default:
          return null;
      }
    };

    const renderNextButton = () => {
      const isLastStep = getCurrentStepIndex() === steps.length - 1;
      const valid = isStepValid();
      const canSave =
        valid && ['basic', 'detail', 'flavor'].includes(currentStep);

      const springTransition = { stiffness: 500, damping: 25 };
      const buttonBaseClass =
        'rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100';

      return (
        <div className="modal-bottom-button flex items-center justify-center">
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
      <div className="flex flex-col">
        <div className="my-6 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="-m-3 rounded-full p-3"
          >
            <ArrowLeft className="h-5 w-5 text-neutral-800 dark:text-neutral-200" />
          </button>

          <div className="flex-1 px-4">{renderProgressBar()}</div>

          <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            {getCurrentStepIndex() + 1}/{steps.length}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-4">
          <AnimatePresence mode="wait">{renderStepContent()}</AnimatePresence>
        </div>

        {renderNextButton()}
      </div>
    );
  }
);

CoffeeBeanForm.displayName = 'CoffeeBeanForm';

export default CoffeeBeanForm;
