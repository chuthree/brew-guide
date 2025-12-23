'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

import type { BrewingNoteData, CoffeeBean } from '@/types/app';
import AutoResizeTextarea from '@/components/common/forms/AutoResizeTextarea';
import NoteFormHeader from '@/components/notes/ui/NoteFormHeader';
import { captureImage, compressBase64Image } from '@/lib/utils/imageCapture';
import { Camera, Image as ImageIcon, X } from 'lucide-react';
import {
  equipmentList,
  commonMethods,
  type Method,
  type CustomEquipment,
} from '@/lib/core/config';
import { loadCustomEquipments } from '@/lib/stores/customEquipmentStore';
import { loadCustomMethods } from '@/lib/stores/customMethodStore';
import {
  getEquipmentNameById,
  getEquipmentIdByName,
} from '@/lib/utils/equipmentUtils';
import { SettingsOptions } from '@/components/settings/Settings';
import {
  CustomFlavorDimensionsManager,
  FlavorDimension,
} from '@/lib/managers/customFlavorDimensions';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/coffee-bean/ui/select';
import CoffeeBeanSelector from './CoffeeBeanSelector';
import { useCoffeeBeanData } from './hooks/useCoffeeBeanData';
import ImagePreview from '@/components/common/ImagePreview';
import GrindSizeInput from '@/components/ui/GrindSizeInput';

// 常量定义
const ROAST_LEVELS = [
  '极浅烘焙',
  '浅度烘焙',
  '中浅烘焙',
  '中度烘焙',
  '中深烘焙',
  '深度烘焙',
] as const;

// 动画类型到器具ID的映射
const ANIMATION_TYPE_MAPPING: Record<string, string> = {
  v60: 'V60',
  clever: 'CleverDripper',
  espresso: 'Espresso',
  kalita: 'Kalita',
  origami: 'Origami',
};

// 默认方案参数
const DEFAULT_METHOD_PARAMS = {
  coffee: '15g',
  water: '225g',
  ratio: '1:15',
  grindSize: '中细',
  temp: '92°C',
} as const;

// 工具函数：获取器具对应的通用方案
const getCommonMethodsForEquipment = (
  equipmentId: string,
  availableEquipments: ((typeof equipmentList)[0] | CustomEquipment)[],
  settings?: SettingsOptions
): Method[] => {
  // 先检查是否是预定义器具
  let methods: Method[] = [];

  if (commonMethods[equipmentId]) {
    methods = commonMethods[equipmentId];
  } else {
    // 检查是否是自定义器具
    const customEquipment = availableEquipments.find(
      eq => eq.id === equipmentId && 'isCustom' in eq && eq.isCustom
    ) as CustomEquipment | undefined;

    if (customEquipment?.animationType) {
      // 如果是自定义预设器具（animationType === 'custom'），不返回任何通用方案
      if (customEquipment.animationType.toLowerCase() === 'custom') {
        return [];
      }

      const baseEquipmentId =
        ANIMATION_TYPE_MAPPING[customEquipment.animationType.toLowerCase()] ||
        'V60';
      methods = commonMethods[baseEquipmentId] || [];
    }
  }

  // 如果有settings，过滤掉隐藏的方案
  if (settings && settings.hiddenCommonMethods) {
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

// 工具函数：获取参数的默认值
const getParamValue = (
  param: string | undefined,
  defaultKey: keyof typeof DEFAULT_METHOD_PARAMS
): string => {
  return param || DEFAULT_METHOD_PARAMS[defaultKey];
};

const SLIDER_STYLES = `relative h-px w-full appearance-none bg-neutral-300 dark:bg-neutral-600 cursor-pointer touch-none
[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-solid
[&::-webkit-slider-thumb]:border-neutral-300 [&::-webkit-slider-thumb]:bg-neutral-50
[&::-webkit-slider-thumb]:shadow-none [&::-webkit-slider-thumb]:outline-none
dark:[&::-webkit-slider-thumb]:border-neutral-600 dark:[&::-webkit-slider-thumb]:bg-neutral-900
[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:appearance-none
[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-solid
[&::-moz-range-thumb]:border-neutral-300 [&::-moz-range-thumb]:bg-neutral-50
[&::-moz-range-thumb]:shadow-none [&::-moz-range-thumb]:outline-none
dark:[&::-moz-range-thumb]:border-neutral-600 dark:[&::-moz-range-thumb]:bg-neutral-900`;

// 类型定义 - 使用动态的风味评分类型
interface TasteRatings {
  [key: string]: number;
}

interface FormData {
  coffeeBeanInfo: {
    name: string;
    roastLevel: string;
  };
  image?: string;
  rating: number;
  taste: TasteRatings;
  notes: string;
}

interface BrewingNoteFormProps {
  id?: string;
  onClose: () => void;
  onSave: (data: BrewingNoteData) => void;
  initialData: Partial<BrewingNoteData> & {
    coffeeBean?: CoffeeBean | null;
  };
  inBrewPage?: boolean;
  showSaveButton?: boolean;
  onSaveSuccess?: () => void;
  hideHeader?: boolean;
  onTimestampChange?: (timestamp: Date) => void;
  settings?: SettingsOptions;
  isCopy?: boolean; // 标记是否是复制操作
}

// 工具函数
const normalizeRoastLevel = (roastLevel?: string): string => {
  if (!roastLevel) return '中度烘焙';
  if (roastLevel.endsWith('烘焙')) return roastLevel;

  const roastMap: Record<string, string> = {
    极浅: '极浅烘焙',
    浅度: '浅度烘焙',
    中浅: '中浅烘焙',
    中度: '中度烘焙',
    中深: '中深烘焙',
    深度: '深度烘焙',
  };

  return (
    roastMap[roastLevel] ||
    Object.entries(roastMap).find(([key]) => roastLevel.includes(key))?.[1] ||
    '中度烘焙'
  );
};

const getInitialCoffeeBeanInfo = (
  initialData: BrewingNoteFormProps['initialData']
) => {
  const beanInfo = initialData.coffeeBean || initialData.coffeeBeanInfo;
  return {
    name: beanInfo?.name || '',
    roastLevel: normalizeRoastLevel(beanInfo?.roastLevel),
  };
};

const extractNumericValue = (param: string): string => {
  const match = param.match(/(\d+(\.\d+)?)/);
  return match ? match[0] : '';
};

const validateNumericInput = (value: string): boolean => {
  return /^$|^[0-9]*\.?[0-9]*$/.test(value);
};

const BrewingNoteForm: React.FC<BrewingNoteFormProps> = ({
  id,
  onClose: _onClose,
  onSave,
  initialData,
  inBrewPage: _inBrewPage = false,
  showSaveButton = true,
  onSaveSuccess,
  hideHeader = false,
  onTimestampChange,
  settings,
  isCopy = false, // 默认不是复制操作
}) => {
  // 评分维度数据
  const [flavorDimensions, setFlavorDimensions] = useState<FlavorDimension[]>(
    []
  );
  const [displayDimensions, setDisplayDimensions] = useState<FlavorDimension[]>(
    []
  );

  // 咖啡豆数据和状态管理
  const { beans: coffeeBeans } = useCoffeeBeanData();
  const [selectedCoffeeBean, setSelectedCoffeeBean] =
    useState<CoffeeBean | null>(initialData.coffeeBean || null);
  const [showCoffeeBeanSelector, setShowCoffeeBeanSelector] = useState(false);
  const [coffeeBeanSearchQuery, setCoffeeBeanSearchQuery] = useState('');
  const [originalBeanId] = useState<string | undefined>(initialData.beanId); // 记录原始的beanId用于容量同步
  const [showFlavorInfo, setShowFlavorInfo] = useState(false); // 控制风味信息的显示
  const [showImagePreview, setShowImagePreview] = useState(false); // 控制图片预览

  const [formData, setFormData] = useState<FormData>({
    coffeeBeanInfo: getInitialCoffeeBeanInfo(initialData),
    image: typeof initialData.image === 'string' ? initialData.image : '',
    rating: initialData?.rating ?? 0,
    taste: initialData?.taste || {},
    notes: initialData?.notes || '',
  });

  // 添加时间戳状态管理
  const [timestamp, setTimestamp] = useState<Date>(
    initialData.timestamp ? new Date(initialData.timestamp) : new Date()
  );

  // 监听initialData.timestamp的变化，同步更新内部状态
  useEffect(() => {
    if (initialData.timestamp) {
      setTimestamp(new Date(initialData.timestamp));
    }
  }, [initialData.timestamp]);

  // 初始化选中的咖啡豆
  useEffect(() => {
    if (initialData.beanId && coffeeBeans.length > 0 && !selectedCoffeeBean) {
      const foundBean = coffeeBeans.find(
        bean => bean.id === initialData.beanId
      );
      if (foundBean) {
        setSelectedCoffeeBean(foundBean);
      }
    }
  }, [initialData.beanId, coffeeBeans, selectedCoffeeBean]);

  // 处理时间戳变化，同时通知外部组件
  const handleTimestampChange = (newTimestamp: Date) => {
    setTimestamp(newTimestamp);
    onTimestampChange?.(newTimestamp);
  };

  // 添加方案参数状态 - 分离数值和单位
  const [methodParams, setMethodParams] = useState({
    coffee: getParamValue(initialData?.params?.coffee, 'coffee'),
    water: getParamValue(initialData?.params?.water, 'water'),
    ratio: getParamValue(initialData?.params?.ratio, 'ratio'),
    grindSize: getParamValue(initialData?.params?.grindSize, 'grindSize'),
    temp: getParamValue(initialData?.params?.temp, 'temp'),
  });

  // 分离的数值状态（用于输入框显示）
  const [numericValues, setNumericValues] = useState(() => ({
    coffee: extractNumericValue(
      getParamValue(initialData?.params?.coffee, 'coffee')
    ),
    water: extractNumericValue(
      getParamValue(initialData?.params?.water, 'water')
    ),
    temp: extractNumericValue(getParamValue(initialData?.params?.temp, 'temp')),
    ratio: extractNumericValue(
      getParamValue(initialData?.params?.ratio, 'ratio').split(':')[1]
    ),
  }));

  // 添加器具和方案选择相关状态
  const [availableEquipments, setAvailableEquipments] = useState<
    ((typeof equipmentList)[0] | CustomEquipment)[]
  >([]);
  const [availableMethods, setAvailableMethods] = useState<Method[]>([]);
  const [customMethods, setCustomMethods] = useState<Record<string, Method[]>>(
    {}
  );
  const [showEquipmentMethodSelector, setShowEquipmentMethodSelector] =
    useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(
    initialData.equipment || ''
  );
  const [selectedMethod, setSelectedMethod] = useState(
    initialData.method || ''
  );

  // 判断是否是意式器具
  const isEspresso = useMemo(() => {
    if (!selectedEquipment) return false;
    const equipment = availableEquipments.find(e => e.id === selectedEquipment);
    const name = equipment?.name || '';
    return (
      selectedEquipment.toLowerCase().includes('espresso') ||
      selectedEquipment.toLowerCase().includes('意式') ||
      name.toLowerCase().includes('espresso') ||
      name.toLowerCase().includes('意式')
    );
  }, [selectedEquipment, availableEquipments]);

  // 添加时间状态
  const [totalTimeStr, setTotalTimeStr] = useState(() =>
    initialData.totalTime ? String(initialData.totalTime) : ''
  );

  // 监听initialData.totalTime的变化
  useEffect(() => {
    if (initialData.totalTime) {
      setTotalTimeStr(String(initialData.totalTime));
    }
  }, [initialData.totalTime]);

  const formRef = useRef<HTMLFormElement>(null);
  // 使用 state 存储滚动容器元素，确保 Virtuoso 能正确获取滚动父元素
  const [coffeeBeanScrollContainer, setCoffeeBeanScrollContainer] =
    useState<HTMLDivElement | null>(null);
  const [currentSliderValue, setCurrentSliderValue] = useState<number | null>(
    null
  );

  // 通用滑块触摸处理
  const createSliderHandlers = useCallback(
    (
      updateFn: (value: number) => void,
      min: number = 0,
      max: number = 5,
      step: number = 1
    ) => ({
      onTouchStart: (value: number) => (e: React.TouchEvent) => {
        // 移除 e.preventDefault() - 避免 passive event listener 警告
        // 滑块组件本身会处理触摸事件，不需要在这里阻止默认行为
        e.stopPropagation();
        setCurrentSliderValue(value);
      },
      onTouchMove: (e: React.TouchEvent) => {
        if (currentSliderValue === null) return;
        const touch = e.touches[0];
        const target = e.currentTarget as HTMLInputElement;
        const rect = target.getBoundingClientRect();
        const percentage = Math.max(
          0,
          Math.min(1, (touch.clientX - rect.left) / rect.width)
        );
        const newValue =
          min + Math.round((percentage * (max - min)) / step) * step;
        if (newValue !== currentSliderValue) {
          updateFn(newValue);
          setCurrentSliderValue(newValue);
        }
      },
      onTouchEnd: () => setCurrentSliderValue(null),
    }),
    [currentSliderValue]
  );

  // 创建显示维度（包含历史维度）
  const createDisplayDimensions = async (
    currentDimensions: FlavorDimension[],
    tasteData: Record<string, number>
  ) => {
    const historicalLabels =
      await CustomFlavorDimensionsManager.getHistoricalLabels();
    const displayDims = [...currentDimensions];

    // 检查笔记中是否有当前维度列表中不存在的风味评分
    Object.keys(tasteData).forEach(tasteId => {
      const existsInCurrent = currentDimensions.some(d => d.id === tasteId);
      if (!existsInCurrent && tasteData[tasteId] > 0) {
        // 创建一个历史维度项
        const historicalDimension: FlavorDimension = {
          id: tasteId,
          label: historicalLabels[tasteId] || '已删除的评分维度',
          order: 999, // 放在最后
          isDefault: false,
        };
        displayDims.push(historicalDimension);
      }
    });

    // 按order排序
    return displayDims.sort((a, b) => a.order - b.order);
  };

  // 加载评分维度数据
  useEffect(() => {
    const loadFlavorDimensions = async () => {
      try {
        const dimensions =
          await CustomFlavorDimensionsManager.getFlavorDimensions();
        setFlavorDimensions(dimensions);

        // 如果是新笔记或者现有笔记缺少风味数据，初始化风味评分
        if (!initialData.taste || Object.keys(initialData.taste).length === 0) {
          const emptyTaste =
            CustomFlavorDimensionsManager.createEmptyTasteRatings(dimensions);
          setFormData(prev => ({ ...prev, taste: emptyTaste }));
          setDisplayDimensions(dimensions);
        } else {
          // 迁移现有的风味评分数据以确保兼容性
          const migratedTaste =
            CustomFlavorDimensionsManager.migrateTasteRatings(
              initialData.taste,
              dimensions
            );
          setFormData(prev => ({ ...prev, taste: migratedTaste }));

          // 创建包含历史维度的显示维度列表
          const displayDims = await createDisplayDimensions(
            dimensions,
            initialData.taste
          );
          setDisplayDimensions(displayDims);
        }
      } catch (error) {
        console.error('加载评分维度失败:', error);
      }
    };

    loadFlavorDimensions();
  }, [initialData.taste]);

  // 监听评分维度变化
  useEffect(() => {
    const handleFlavorDimensionsChange = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { dimensions } = customEvent.detail;
      setFlavorDimensions(dimensions);

      // 更新表单数据以匹配新的维度
      setFormData(prev => {
        const migratedTaste = CustomFlavorDimensionsManager.migrateTasteRatings(
          prev.taste,
          dimensions
        );
        return { ...prev, taste: migratedTaste };
      });

      // 重新创建显示维度列表
      const currentTaste = formData.taste;
      const displayDims = await createDisplayDimensions(
        dimensions,
        currentTaste
      );
      setDisplayDimensions(displayDims);
    };

    window.addEventListener(
      'flavorDimensionsChanged',
      handleFlavorDimensionsChange
    );
    return () => {
      window.removeEventListener(
        'flavorDimensionsChanged',
        handleFlavorDimensionsChange
      );
    };
  }, [formData.taste]);

  // 加载器具和方案数据
  useEffect(() => {
    const loadEquipmentsAndMethods = async () => {
      try {
        // 加载自定义器具
        const customEquips = await loadCustomEquipments();

        // 合并所有器具
        let allEquipments = [
          ...equipmentList.map(eq => ({ ...eq, isCustom: false })),
          ...customEquips,
        ];

        // 过滤隐藏的器具
        if (settings) {
          const { filterHiddenEquipments } = await import(
            '@/lib/stores/settingsStore'
          );
          allEquipments = filterHiddenEquipments(allEquipments);
        }

        setAvailableEquipments(allEquipments);

        // 加载自定义方案
        const customMethods = await loadCustomMethods();
        setCustomMethods(customMethods);

        // 🔥 如果有选中的器具，加载对应的方案（兼容ID和名称）
        if (initialData.equipment) {
          // 规范化器具标识为ID（名称会被转为ID，ID保持不变）
          // 使用同步版本的规范化函数
          const equipmentId = getEquipmentIdByName(
            initialData.equipment,
            customEquips
          );

          // 使用规范化后的ID查找方案
          const equipmentMethods = customMethods[equipmentId] || [];
          const commonEquipmentMethods = getCommonMethodsForEquipment(
            equipmentId,
            allEquipments,
            settings
          );
          setAvailableMethods([...equipmentMethods, ...commonEquipmentMethods]);
        }
      } catch (error) {
        // Log error in development only
        if (process.env.NODE_ENV === 'development') {
          console.error('加载器具和方案数据失败:', error);
        }
      }
    };

    loadEquipmentsAndMethods();
  }, [initialData.equipment, settings]);

  // 事件监听
  useEffect(() => {
    const handleGlobalTouchEnd = () => setCurrentSliderValue(null);

    const handleMethodParamsChange = (e: CustomEvent) => {
      if (e.detail?.params) {
        const params = e.detail.params;
        setMethodParams(prev => ({
          coffee: params.coffee || prev.coffee,
          water: params.water || prev.water,
          ratio: params.ratio || prev.ratio,
          grindSize: params.grindSize || prev.grindSize,
          temp: params.temp || prev.temp,
        }));

        // 同步时间
        if (params.stages && params.stages.length > 0) {
          const totalTime = params.stages.reduce(
            (acc: number, stage: any) => acc + (stage.time || 0),
            0
          );
          if (totalTime > 0) {
            setTotalTimeStr(String(totalTime));
          }
        }
      }
    };

    // 🎯 处理笔记步骤中的参数修改（直接修改，不触发外部事件）
    const handleUpdateNoteParams = (e: CustomEvent) => {
      const { type, value } = e.detail;

      // 根据参数类型计算相关值
      const currentCoffeeNum = parseFloat(
        extractNumericValue(methodParams.coffee)
      );
      const currentRatioNum = parseFloat(
        extractNumericValue(methodParams.ratio.split(':')[1])
      );

      switch (type) {
        case 'coffee': {
          const coffeeValue = parseFloat(value);
          if (isNaN(coffeeValue) || coffeeValue <= 0) return;

          const calculatedWater = Math.round(coffeeValue * currentRatioNum);
          setMethodParams(prev => ({
            ...prev,
            coffee: `${coffeeValue}g`,
            water: `${calculatedWater}g`,
          }));
          setNumericValues(prev => ({
            ...prev,
            coffee: String(coffeeValue),
            water: String(calculatedWater),
          }));
          break;
        }
        case 'ratio': {
          const ratioValue = parseFloat(value);
          if (isNaN(ratioValue) || ratioValue <= 0) return;

          const calculatedWater = Math.round(currentCoffeeNum * ratioValue);
          setMethodParams(prev => ({
            ...prev,
            ratio: `1:${ratioValue}`,
            water: `${calculatedWater}g`,
          }));
          setNumericValues(prev => ({
            ...prev,
            ratio: String(ratioValue),
            water: String(calculatedWater),
          }));
          break;
        }
        case 'grindSize': {
          setMethodParams(prev => ({
            ...prev,
            grindSize: value,
          }));
          break;
        }
        case 'temp': {
          const formattedTemp = value.includes('°C') ? value : `${value}°C`;
          setMethodParams(prev => ({
            ...prev,
            temp: formattedTemp,
          }));
          setNumericValues(prev => ({
            ...prev,
            temp: value,
          }));
          break;
        }
      }
    };

    // 点击外部区域关闭下拉选择器
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-equipment-method-selector]')) {
        setShowEquipmentMethodSelector(false);
      }
    };

    document.addEventListener('touchend', handleGlobalTouchEnd);
    document.addEventListener(
      'methodParamsChanged',
      handleMethodParamsChange as EventListener
    );
    window.addEventListener(
      'brewing:updateNoteParams',
      handleUpdateNoteParams as EventListener
    );
    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('touchend', handleGlobalTouchEnd);
      document.removeEventListener(
        'methodParamsChanged',
        handleMethodParamsChange as EventListener
      );
      window.removeEventListener(
        'brewing:updateNoteParams',
        handleUpdateNoteParams as EventListener
      );
      document.removeEventListener('click', handleClickOutside);
    };
  }, [methodParams]);

  // 更新方案参数的通用函数
  const updateMethodParams = useCallback((params: Method['params']) => {
    setMethodParams(params);
    setNumericValues({
      coffee: extractNumericValue(getParamValue(params.coffee, 'coffee')),
      water: extractNumericValue(getParamValue(params.water, 'water')),
      temp: extractNumericValue(getParamValue(params.temp, 'temp')),
      ratio: extractNumericValue(
        getParamValue(params.ratio, 'ratio').split(':')[1]
      ),
    });

    // 如果方案包含阶段信息，尝试提取总时间
    if (params.stages && params.stages.length > 0) {
      // 计算所有阶段的时间总和
      const totalTime = params.stages.reduce(
        (acc, stage) => acc + (stage.time || 0),
        0
      );
      if (totalTime > 0) {
        setTotalTimeStr(String(totalTime));
      }
    }
  }, []);

  // 简化的数据更新逻辑
  const prevInitialDataRef = useRef<typeof initialData>(initialData);

  useEffect(() => {
    const prev = prevInitialDataRef.current;
    const current = initialData;

    // 检查咖啡豆信息变化
    const beanChanged =
      prev.coffeeBean?.id !== current.coffeeBean?.id ||
      prev.coffeeBeanInfo?.name !== current.coffeeBeanInfo?.name;

    if (beanChanged) {
      const beanInfo = current.coffeeBean || current.coffeeBeanInfo;

      // 同步更新selectedCoffeeBean状态
      if (
        current.coffeeBean &&
        current.coffeeBean.id !== selectedCoffeeBean?.id
      ) {
        setSelectedCoffeeBean(current.coffeeBean);
      }

      setFormData(prev => ({
        ...prev,
        coffeeBeanInfo: {
          name: beanInfo?.name || '',
          roastLevel: normalizeRoastLevel(beanInfo?.roastLevel),
          roastDate: beanInfo?.roastDate || '',
        },
      }));
    }

    // 检查其他数据变化
    const dataChanged =
      prev.rating !== current.rating ||
      prev.notes !== current.notes ||
      prev.image !== current.image ||
      JSON.stringify(prev.taste) !== JSON.stringify(current.taste);

    if (dataChanged) {
      setFormData(prev => ({
        ...prev,
        image: typeof current.image === 'string' ? current.image : prev.image,
        rating: current.rating ?? prev.rating,
        taste: current.taste
          ? CustomFlavorDimensionsManager.migrateTasteRatings(
              current.taste,
              flavorDimensions
            )
          : prev.taste,
        notes: current.notes || prev.notes,
      }));
    }

    // 检查参数变化
    if (
      JSON.stringify(prev.params) !== JSON.stringify(current.params) &&
      current.params
    ) {
      setMethodParams(current.params);
      setNumericValues({
        coffee: extractNumericValue(
          getParamValue(current.params.coffee, 'coffee')
        ),
        water: extractNumericValue(
          getParamValue(current.params.water, 'water')
        ),
        temp: extractNumericValue(getParamValue(current.params.temp, 'temp')),
        ratio: extractNumericValue(
          getParamValue(current.params.ratio, 'ratio').split(':')[1]
        ),
      });
    }

    prevInitialDataRef.current = current;
  }, [initialData, selectedCoffeeBean?.id, flavorDimensions]);

  // 创建评分更新函数
  const updateRating = (value: number) => {
    setFormData(prev => ({ ...prev, rating: value }));
  };

  const updateTasteRating = (key: string) => (value: number) => {
    setFormData(prev => ({
      ...prev,
      taste: { ...prev.taste, [key]: value },
    }));
  };

  // 创建滑块处理器
  const ratingHandlers = createSliderHandlers(updateRating, 0, 5, 0.5);
  const tasteHandlers = (key: string) =>
    createSliderHandlers(updateTasteRating(key), 0, 5, 1);

  // 计算水量
  const calculateWater = useCallback(
    (coffee: string, ratio: string): string => {
      const coffeeValue = parseFloat(coffee.match(/(\d+(\.\d+)?)/)?.[0] || '0');
      const ratioValue = parseFloat(ratio.match(/1:(\d+(\.\d+)?)/)?.[1] || '0');
      return coffeeValue > 0 && ratioValue > 0
        ? `${Math.round(coffeeValue * ratioValue)}g`
        : methodParams.water;
    },
    [methodParams.water]
  );

  // 通用数值输入处理
  const createNumericHandler = useCallback(
    (
      field: 'coffee' | 'ratio' | 'temp' | 'water',
      formatter: (value: string) => string
    ) =>
      (value: string) => {
        if (!validateNumericInput(value)) return;

        setNumericValues(prev => ({ ...prev, [field]: value }));

        const formattedValue = formatter(value);
        setMethodParams(prev => {
          const newParams = { ...prev, [field]: formattedValue };
          if (!isEspresso && (field === 'coffee' || field === 'ratio')) {
            newParams.water = calculateWater(
              field === 'coffee' ? formattedValue : prev.coffee,
              field === 'ratio' ? formattedValue : prev.ratio
            );
          }
          return newParams;
        });
      },
    [calculateWater, isEspresso]
  );

  const handleCoffeeChange = createNumericHandler('coffee', value =>
    value ? `${value}g` : ''
  );
  const handleRatioChange = createNumericHandler('ratio', value =>
    value ? `1:${value}` : DEFAULT_METHOD_PARAMS.ratio
  );
  const handleTempChange = createNumericHandler('temp', value =>
    value ? `${value}°C` : ''
  );

  const handleWaterChange = createNumericHandler('water', value =>
    value ? `${value}g` : ''
  );

  // 处理器具选择
  const handleEquipmentSelect = useCallback(
    async (equipmentId: string) => {
      try {
        setSelectedEquipment(equipmentId);
        const equipmentMethods = customMethods[equipmentId] || [];
        // 使用新的辅助函数获取通用方案
        const commonEquipmentMethods = getCommonMethodsForEquipment(
          equipmentId,
          availableEquipments,
          settings
        );
        const allMethods = [...equipmentMethods, ...commonEquipmentMethods];
        setAvailableMethods(allMethods);

        if (allMethods.length > 0) {
          const firstMethod = allMethods[0];
          const methodIdentifier = firstMethod.name || firstMethod.id || '';
          setSelectedMethod(methodIdentifier);
          updateMethodParams(firstMethod.params);
        } else {
          setSelectedMethod('');
        }
        // 不再在这里关闭选择界面，等待用户选择方案后再关闭
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('选择器具失败:', error);
        }
      }
    },
    [customMethods, updateMethodParams, availableEquipments, settings]
  );

  // 处理方案选择
  const handleMethodSelect = useCallback(
    (methodIdentifier: string) => {
      try {
        const selectedMethodObj = availableMethods.find(
          m => m.name === methodIdentifier || m.id === methodIdentifier
        );
        if (selectedMethodObj) {
          const methodToStore =
            selectedMethodObj.name || selectedMethodObj.id || '';
          setSelectedMethod(methodToStore);
          updateMethodParams(selectedMethodObj.params);
        }
        setShowEquipmentMethodSelector(false);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('选择方案失败:', error);
        }
      }
    },
    [availableMethods, updateMethodParams]
  );

  // 获取当前器具和方案名称 - 使用useMemo优化
  const currentEquipmentName = useMemo(() => {
    // 从availableEquipments中过滤出自定义器具
    const customEquips = availableEquipments.filter(
      eq => 'isCustom' in eq && eq.isCustom
    ) as CustomEquipment[];
    return getEquipmentNameById(selectedEquipment, customEquips) || '未知器具';
  }, [selectedEquipment, availableEquipments]);

  const currentMethodName = useMemo(() => {
    // 如果 selectedMethod 是空字符串，返回"无方案"而不是"未知方案"
    if (!selectedMethod || selectedMethod.trim() === '') {
      return '无方案';
    }
    const method = availableMethods.find(
      m => m.name === selectedMethod || m.id === selectedMethod
    );
    return method?.name || selectedMethod || '未知方案';
  }, [availableMethods, selectedMethod]);

  // 判断是否是添加模式
  const isAdding = !id || isCopy;

  // 根据设置决定是否显示部分区域
  const showFlavorSection =
    !isAdding || (settings?.showFlavorRatingInForm ?? true);
  const showOverallSection =
    !isAdding || (settings?.showOverallRatingInForm ?? true);

  // Inside the component, add a new state for showing/hiding flavor ratings
  const [showFlavorRatings, setShowFlavorRatings] = useState(() => {
    // 初始化时检查是否有任何风味评分大于0
    const hasTasteValues =
      initialData?.taste &&
      Object.values(initialData.taste).some(value => value > 0);

    // 如果有风味评分，默认展开
    if (hasTasteValues) return true;

    // 如果是添加新笔记（没有ID或是复制操作）且设置中开启了默认展开
    if (isAdding && settings?.defaultExpandRating) return true;

    return false;
  });

  // 监听风味评分变化
  useEffect(() => {
    // 检查任何风味评分是否大于0
    const hasTasteValues = Object.values(formData.taste).some(
      value => value > 0
    );

    // 如果有任何风味评分大于0，自动展开风味评分区域
    if (hasTasteValues && !showFlavorRatings) {
      setShowFlavorRatings(true);
    }
  }, [formData.taste, showFlavorRatings]);

  const handleImageSelect = useCallback(
    async (source: 'camera' | 'gallery') => {
      try {
        // 获取图片（已经是base64格式）
        const result = await captureImage({ source });

        // 直接压缩base64图片
        const compressedBase64 = await compressBase64Image(result.dataUrl, {
          maxSizeMB: 0.1,
          maxWidthOrHeight: 1200,
          initialQuality: 0.8,
        });

        // 更新表单数据
        setFormData(prev => ({ ...prev, image: compressedBase64 }));
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('打开相机/相册失败:', error);
        }
      }
    },
    []
  );

  // 处理咖啡豆选择变化
  const handleCoffeeBeanSelect = useCallback((bean: CoffeeBean | null) => {
    setSelectedCoffeeBean(bean);
    setShowCoffeeBeanSelector(false);
    setCoffeeBeanSearchQuery(''); // 清空搜索

    // 更新表单中的咖啡豆信息
    if (bean) {
      setFormData(prev => ({
        ...prev,
        coffeeBeanInfo: {
          name: bean.name || '',
          roastLevel: normalizeRoastLevel(bean.roastLevel),
          roastDate: bean.roastDate || '',
        },
      }));
    } else {
      // 如果取消选择咖啡豆，清空咖啡豆信息
      setFormData(prev => ({
        ...prev,
        coffeeBeanInfo: {
          name: '',
          roastLevel: '中度烘焙',
          roastDate: '',
        },
      }));
    }
  }, []);

  // 保存笔记的处理函数
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 处理咖啡豆变化和容量同步（容量调整记录除外）
    // 注意：对于复制的笔记，不执行容量同步，让 page.tsx 直接扣除
    if (
      initialData.id &&
      initialData.source !== 'capacity-adjustment' &&
      !isCopy
    ) {
      try {
        const {
          CapacitySyncManager,
          updateBeanRemaining,
          increaseBeanRemaining,
        } = await import('@/lib/stores/coffeeBeanStore');
        const currentCoffeeAmount = CapacitySyncManager.extractCoffeeAmount(
          methodParams.coffee
        );

        // 检查咖啡豆是否发生变化
        const currentBeanId = selectedCoffeeBean?.id;
        const beanChanged = originalBeanId !== currentBeanId;

        if (beanChanged) {
          // 咖啡豆发生变化，需要处理双向容量同步
          const originalCoffeeAmount = CapacitySyncManager.extractCoffeeAmount(
            initialData.params?.coffee || '0g'
          );

          // 恢复原咖啡豆的剩余量（如果原来有关联的咖啡豆）
          if (originalBeanId && originalCoffeeAmount > 0) {
            await increaseBeanRemaining(originalBeanId, originalCoffeeAmount);
          }

          // 扣除新咖啡豆的剩余量（如果选择了新的咖啡豆）
          if (currentBeanId && currentCoffeeAmount > 0) {
            await updateBeanRemaining(currentBeanId, currentCoffeeAmount);
          }
        } else if (originalBeanId) {
          // 咖啡豆没有变化，但可能咖啡用量发生了变化
          const oldCoffeeAmount = CapacitySyncManager.extractCoffeeAmount(
            initialData.params?.coffee || '0g'
          );
          const amountDiff = currentCoffeeAmount - oldCoffeeAmount;

          if (Math.abs(amountDiff) > 0.01) {
            if (amountDiff > 0) {
              await updateBeanRemaining(originalBeanId, amountDiff);
            } else {
              await increaseBeanRemaining(originalBeanId, Math.abs(amountDiff));
            }
          }
        }
      } catch (error) {
        console.error('同步咖啡豆容量失败:', error);
      }
    }

    // 规范化器具ID（将名称转换为ID）
    const { normalizeEquipmentId } = await import('@/components/notes/utils');
    const normalizedEquipmentId = await normalizeEquipmentId(
      selectedEquipment || initialData.equipment || ''
    );

    // 创建完整的笔记数据
    const noteData: BrewingNoteData = {
      id: id || Date.now().toString(),
      // 使用当前的时间戳状态
      timestamp: timestamp.getTime(),
      ...formData,
      equipment: normalizedEquipmentId,
      method: selectedMethod || initialData.method,
      params: {
        // 使用当前的方案参数
        coffee: methodParams.coffee,
        water: methodParams.water,
        ratio: methodParams.ratio,
        grindSize: methodParams.grindSize,
        temp: methodParams.temp,
      },
      totalTime: isEspresso
        ? parseFloat(totalTimeStr) || 0
        : initialData.totalTime,
      // 使用当前选中的咖啡豆ID
      beanId: selectedCoffeeBean?.id,
      // 保留容量调整记录的特殊属性
      ...(initialData.source === 'capacity-adjustment'
        ? {
            source: initialData.source,
            changeRecord: initialData.changeRecord,
          }
        : {}),
      // 保留快捷扣除记录的特殊属性
      ...(initialData.source === 'quick-decrement'
        ? {
            source: initialData.source,
            quickDecrementAmount: initialData.quickDecrementAmount,
          }
        : {}),
    };

    try {
      // 同步磨豆机刻度到设置
      if (methodParams.grindSize) {
        const { syncGrinderToSettings } = await import('@/lib/grinder');
        await syncGrinderToSettings(methodParams.grindSize);
      }

      // 保存笔记
      onSave(noteData);

      // 如果提供了保存成功的回调，则调用它
      if (onSaveSuccess) {
        onSaveSuccess();
      }
    } catch (error) {
      // Log error in development only
      if (process.env.NODE_ENV === 'development') {
        console.error('保存笔记时出错:', error);
      }
      alert('保存笔记时出错，请重试');
    }
  };

  const containerClassName =
    'relative flex flex-col h-full overflow-y-auto overscroll-contain';

  return (
    <form
      id={id}
      ref={formRef}
      onSubmit={handleSubmit}
      className={containerClassName}
    >
      {/* 根据hideHeader属性决定是否显示头部 */}
      {!hideHeader && (
        <div className="mb-4 shrink-0">
          <NoteFormHeader
            onSave={() => formRef.current?.requestSubmit()}
            showSaveButton={showSaveButton}
            timestamp={timestamp}
            onTimestampChange={handleTimestampChange}
          />
        </div>
      )}

      {/* Form content - 更新内容区域样式以确保正确滚动 */}
      <div className="grow space-y-6 pb-20">
        {/* 咖啡豆信息 - 有选中咖啡豆、传入咖啡豆或编辑已有记录时显示 */}
        {(selectedCoffeeBean ||
          initialData.coffeeBean ||
          (initialData.id && formData.coffeeBeanInfo.name)) && (
          <div className="space-y-4">
            <div className="mb-3 text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
              {/* 显示选择的咖啡豆信息，只在咖啡豆名称部分添加下划线 */}
              <>
                {initialData.id && coffeeBeans.length > 0 ? (
                  <span
                    onClick={() => {
                      setShowCoffeeBeanSelector(!showCoffeeBeanSelector);
                      if (!showCoffeeBeanSelector) {
                        setCoffeeBeanSearchQuery(''); // 打开时清空搜索
                      }
                    }}
                    className="cursor-pointer border-b border-dashed border-neutral-400 text-xs font-medium tracking-widest text-neutral-500 transition-colors hover:border-neutral-600 hover:text-neutral-700 dark:border-neutral-500 dark:text-neutral-400 dark:hover:border-neutral-400 dark:hover:text-neutral-300"
                  >
                    {selectedCoffeeBean?.name ||
                      formData.coffeeBeanInfo.name ||
                      '未知咖啡豆'}
                  </span>
                ) : (
                  <>
                    {selectedCoffeeBean?.name ||
                      formData.coffeeBeanInfo.name ||
                      '未知咖啡豆'}
                  </>
                )}
                {/* 风味入口 - 直接跟在咖啡豆名称后面，仅当有风味信息时显示 */}
                {selectedCoffeeBean?.flavor &&
                  selectedCoffeeBean.flavor.length > 0 && (
                    <span
                      onClick={() => setShowFlavorInfo(!showFlavorInfo)}
                      className="ml-1 cursor-pointer text-xs text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-400"
                    >
                      /{' '}
                      {showFlavorInfo
                        ? selectedCoffeeBean.flavor.join(' · ')
                        : '显示风味'}
                    </span>
                  )}
              </>
            </div>

            {/* 咖啡豆选择器 - 直接在咖啡豆信息下面 */}
            {initialData.id &&
              coffeeBeans.length > 0 &&
              showCoffeeBeanSelector && (
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
                  {/* 搜索框 */}
                  <div className="border-b border-neutral-200 p-3 dark:border-neutral-800">
                    <input
                      id="coffee-bean-search"
                      name="coffeeBeanSearch"
                      type="text"
                      value={coffeeBeanSearchQuery}
                      onChange={e => setCoffeeBeanSearchQuery(e.target.value)}
                      placeholder="搜索咖啡豆..."
                      className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs placeholder:text-neutral-400 focus:ring-1 focus:ring-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-500"
                    />
                  </div>
                  {/* 选择器内容：限制高度并启用滚动 */}
                  <div
                    ref={setCoffeeBeanScrollContainer}
                    className="max-h-60 overflow-y-auto px-3"
                  >
                    <CoffeeBeanSelector
                      coffeeBeans={coffeeBeans}
                      selectedCoffeeBean={selectedCoffeeBean}
                      onSelect={handleCoffeeBeanSelect}
                      searchQuery={coffeeBeanSearchQuery}
                      showStatusDots={settings?.showStatusDots}
                      scrollParentRef={coffeeBeanScrollContainer ?? undefined}
                    />
                  </div>
                </div>
              )}
          </div>
        )}
        {/* 笔记图片 */}
        <div className="flex w-full items-center gap-2">
          {formData.image ? (
            /* 有图片时：只显示图片 */
            <motion.div
              layoutId="note-image-preview"
              className="relative h-16 w-16 flex-shrink-0 cursor-pointer overflow-hidden rounded bg-neutral-200/40 dark:bg-neutral-800/60"
              onClick={() => setShowImagePreview(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 30,
              }}
            >
              <Image
                src={formData.image}
                alt="笔记图片"
                className="object-cover"
                fill
                sizes="64px"
              />
              {/* 删除按钮 */}
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setFormData(prev => ({ ...prev, image: '' }));
                }}
                className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-800/80 text-white transition-colors hover:bg-red-500 dark:bg-neutral-200/80 dark:text-neutral-800 dark:hover:bg-red-500 dark:hover:text-white"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </motion.div>
          ) : (
            /* 无图片时：显示两个占位框 */
            <>
              {/* 拍照框 */}
              <button
                type="button"
                onClick={() => handleImageSelect('camera')}
                className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded bg-neutral-200/40 transition-colors hover:bg-neutral-200/60 dark:bg-neutral-800/60 dark:hover:bg-neutral-800/80"
                title="拍照"
              >
                <Camera className="h-5 w-5 text-neutral-300 dark:text-neutral-600" />
              </button>

              {/* 相册框 */}
              <button
                type="button"
                onClick={() => handleImageSelect('gallery')}
                className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded bg-neutral-200/40 transition-colors hover:bg-neutral-200/60 dark:bg-neutral-800/60 dark:hover:bg-neutral-800/80"
                title="相册"
              >
                <ImageIcon className="h-5 w-5 text-neutral-300 dark:text-neutral-600" />
              </button>
            </>
          )}
        </div>
        {/* 添加方案参数编辑 - 只在编辑记录时显示 */}
        {initialData?.id && (
          <div className="space-y-4">
            <div
              className="flex items-center justify-between"
              data-equipment-method-selector
            >
              <div className="mr-3 min-w-0 flex-1 text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                <span className="block truncate">
                  方案参数 · {currentEquipmentName}_{currentMethodName}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setShowEquipmentMethodSelector(!showEquipmentMethodSelector)
                }
                className="flex-shrink-0 text-xs font-medium tracking-widest text-neutral-500 underline hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
              >
                [ 选择 ]
              </button>
            </div>

            {/* 器具和方案选择下拉框 */}
            {showEquipmentMethodSelector && (
              <div
                className="space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900"
                data-equipment-method-selector
              >
                {/* 器具选择 */}
                <div className="space-y-2">
                  <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                    选择器具
                  </div>
                  <div className="grid max-h-32 grid-cols-2 gap-2 overflow-y-auto">
                    {availableEquipments.map(equipment => (
                      <button
                        key={equipment.id}
                        type="button"
                        onClick={() => handleEquipmentSelect(equipment.id)}
                        className={`rounded border p-2 text-left text-xs ${
                          selectedEquipment === equipment.id
                            ? 'border-neutral-800 bg-neutral-100 dark:border-white dark:bg-neutral-800'
                            : 'border-neutral-200 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500'
                        }`}
                      >
                        {equipment.name}
                        {'isCustom' in equipment && equipment.isCustom && (
                          <span className="ml-1 text-neutral-400 dark:text-neutral-500">
                            (自定义)
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 方案选择 */}
                {availableMethods.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                      选择方案
                    </div>
                    <div className="max-h-32 space-y-1 overflow-y-auto">
                      {availableMethods.map(method => {
                        // 优先使用名称作为标识符
                        const methodIdentifier = method.name || method.id || '';
                        return (
                          <button
                            key={method.id || method.name}
                            type="button"
                            onClick={() => handleMethodSelect(methodIdentifier)}
                            className={`w-full rounded border p-2 text-left text-xs ${
                              selectedMethod === methodIdentifier
                                ? 'border-neutral-800 bg-neutral-100 dark:border-white dark:bg-neutral-800'
                                : 'border-neutral-200 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500'
                            }`}
                          >
                            {method.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-4 gap-6">
              <div className="relative">
                <input
                  id="coffee-amount"
                  name="coffeeAmount"
                  type="text"
                  inputMode="decimal"
                  value={numericValues.coffee}
                  onChange={e => handleCoffeeChange(e.target.value)}
                  className="w-full rounded-none border-b border-neutral-200 bg-transparent py-2 pr-4 text-xs text-neutral-800 outline-hidden transition-colors placeholder:text-neutral-300 focus:border-neutral-400 dark:border-neutral-800 dark:text-neutral-300 dark:placeholder:text-neutral-600 dark:focus:border-neutral-600"
                  placeholder="15"
                />
                <span className="absolute right-0 bottom-2 text-xs text-neutral-400 dark:text-neutral-500">
                  g
                </span>
              </div>

              {isEspresso ? (
                <>
                  <div>
                    <GrindSizeInput
                      value={methodParams.grindSize}
                      onChange={value =>
                        setMethodParams({
                          ...methodParams,
                          grindSize: value,
                        })
                      }
                      placeholder="中细"
                      inputClassName="w-full rounded-none border-b border-neutral-200 bg-transparent py-2 text-xs text-neutral-800 outline-hidden transition-colors placeholder:text-neutral-300 focus:border-neutral-400 dark:border-neutral-800 dark:text-neutral-300 dark:placeholder:text-neutral-600 dark:focus:border-neutral-600"
                      defaultSyncEnabled={
                        id
                          ? (settings?.grinderDefaultSync?.noteEdit ?? false)
                          : (settings?.grinderDefaultSync?.manualNote ?? true)
                      }
                    />
                  </div>
                  <div className="relative">
                    <input
                      id="total-time"
                      name="totalTime"
                      type="text"
                      inputMode="decimal"
                      value={totalTimeStr}
                      onChange={e => setTotalTimeStr(e.target.value)}
                      className="w-full rounded-none border-b border-neutral-200 bg-transparent py-2 pr-4 text-xs text-neutral-800 outline-hidden transition-colors placeholder:text-neutral-300 focus:border-neutral-400 dark:border-neutral-800 dark:text-neutral-300 dark:placeholder:text-neutral-600 dark:focus:border-neutral-600"
                      placeholder="25"
                    />
                    <span className="absolute right-0 bottom-2 text-xs text-neutral-400 dark:text-neutral-500">
                      s
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      id="water-amount"
                      name="waterAmount"
                      type="text"
                      inputMode="decimal"
                      value={numericValues.water}
                      onChange={e => handleWaterChange(e.target.value)}
                      className="w-full rounded-none border-b border-neutral-200 bg-transparent py-2 pr-4 text-xs text-neutral-800 outline-hidden transition-colors placeholder:text-neutral-300 focus:border-neutral-400 dark:border-neutral-800 dark:text-neutral-300 dark:placeholder:text-neutral-600 dark:focus:border-neutral-600"
                      placeholder="30"
                    />
                    <span className="absolute right-0 bottom-2 text-xs text-neutral-400 dark:text-neutral-500">
                      g
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative overflow-hidden">
                    <div className="flex items-center">
                      <span className="mr-1 shrink-0 text-xs text-neutral-400 dark:text-neutral-500">
                        1:
                      </span>
                      <input
                        id="coffee-ratio"
                        name="coffeeRatio"
                        type="text"
                        inputMode="decimal"
                        value={numericValues.ratio}
                        onChange={e => handleRatioChange(e.target.value)}
                        className="min-w-0 flex-1 rounded-none border-b border-neutral-200 bg-transparent py-2 text-xs text-neutral-800 outline-hidden transition-colors placeholder:text-neutral-300 focus:border-neutral-400 dark:border-neutral-800 dark:text-neutral-300 dark:placeholder:text-neutral-600 dark:focus:border-neutral-600"
                        placeholder="15"
                      />
                    </div>
                  </div>
                  <div>
                    <GrindSizeInput
                      value={methodParams.grindSize}
                      onChange={value =>
                        setMethodParams({
                          ...methodParams,
                          grindSize: value,
                        })
                      }
                      placeholder="中细"
                      inputClassName="w-full rounded-none border-b border-neutral-200 bg-transparent py-2 text-xs text-neutral-800 outline-hidden transition-colors placeholder:text-neutral-300 focus:border-neutral-400 dark:border-neutral-800 dark:text-neutral-300 dark:placeholder:text-neutral-600 dark:focus:border-neutral-600"
                      defaultSyncEnabled={
                        id
                          ? (settings?.grinderDefaultSync?.noteEdit ?? false)
                          : (settings?.grinderDefaultSync?.manualNote ?? true)
                      }
                    />
                  </div>
                  <div className="relative">
                    <input
                      id="water-temperature"
                      name="waterTemperature"
                      type="text"
                      inputMode="decimal"
                      value={numericValues.temp}
                      onChange={e => handleTempChange(e.target.value)}
                      className="w-full rounded-none border-b border-neutral-200 bg-transparent py-2 pr-8 text-xs text-neutral-800 outline-hidden transition-colors placeholder:text-neutral-300 focus:border-neutral-400 dark:border-neutral-800 dark:text-neutral-300 dark:placeholder:text-neutral-600 dark:focus:border-neutral-600"
                      placeholder="92"
                    />
                    <span className="absolute right-0 bottom-2 text-xs text-neutral-400 dark:text-neutral-500">
                      °C
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {/* 风味评分 */}
        {showFlavorSection && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                风味评分
              </div>
              <button
                type="button"
                onClick={() => setShowFlavorRatings(!showFlavorRatings)}
                className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400"
              >
                [ {showFlavorRatings ? '收起' : '展开'} ]
              </button>
            </div>

            {showFlavorRatings && (
              <div className="grid grid-cols-2 gap-8">
                {displayDimensions.map(dimension => {
                  const value = formData.taste[dimension.id] || 0;
                  return (
                    <div key={dimension.id} className="relative space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                          {dimension.label}
                          {dimension.order === 999 && (
                            <span className="ml-1 text-[10px] text-neutral-400 dark:text-neutral-500">
                              (已删除)
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                          [ {value || 0} ]
                        </div>
                      </div>
                      <input
                        id={`taste-${dimension.id}`}
                        name={`taste_${dimension.id}`}
                        type="range"
                        min="0"
                        max="5"
                        step="1"
                        value={value || 0}
                        onChange={e =>
                          setFormData({
                            ...formData,
                            taste: {
                              ...formData.taste,
                              [dimension.id]: parseInt(e.target.value),
                            },
                          })
                        }
                        onTouchStart={tasteHandlers(dimension.id).onTouchStart(
                          value
                        )}
                        onTouchMove={tasteHandlers(dimension.id).onTouchMove}
                        onTouchEnd={tasteHandlers(dimension.id).onTouchEnd}
                        className={SLIDER_STYLES}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {/* 总体评分 */}
        {showOverallSection && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                总体评分
              </div>
              <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                [ {formData.rating.toFixed(1)} ]
              </div>
            </div>
            <div className="relative py-3">
              <input
                id="overall-rating"
                name="overallRating"
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={formData.rating}
                onChange={e =>
                  setFormData({
                    ...formData,
                    rating: parseFloat(e.target.value),
                  })
                }
                onTouchStart={ratingHandlers.onTouchStart(formData.rating)}
                onTouchMove={ratingHandlers.onTouchMove}
                onTouchEnd={ratingHandlers.onTouchEnd}
                className={SLIDER_STYLES}
              />
            </div>
          </div>
        )}
        {/* 笔记 */}
        <div className="space-y-4">
          <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
            笔记
          </div>
          <AutoResizeTextarea
            id="brewing-notes"
            name="brewingNotes"
            value={formData.notes}
            onChange={e =>
              setFormData({
                ...formData,
                notes: e.target.value,
              })
            }
            className="border-b border-neutral-200 pb-4 text-xs font-medium text-neutral-800 placeholder:text-neutral-300 focus:border-neutral-400 dark:border-neutral-800 dark:text-neutral-300 dark:placeholder:text-neutral-600 dark:focus:border-neutral-600"
            placeholder="记录一下这次冲煮的感受、改进点等..."
            minRows={7}
            maxRows={12}
          />
        </div>
      </div>

      {/* 底部保存按钮 - 悬浮固定，仅在显示保存按钮且不隐藏头部时显示 */}
      {showSaveButton && !hideHeader && (
        <div className="pb-safe-bottom fixed bottom-6 left-1/2 z-10 -translate-x-1/2 transform">
          <button
            type="submit"
            className="flex items-center justify-center rounded-full bg-neutral-100 px-6 py-3 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100"
          >
            <span className="font-medium">保存笔记</span>
          </button>
        </div>
      )}

      {/* 图片预览 */}
      {formData.image && (
        <ImagePreview
          src={formData.image}
          alt="笔记图片"
          isOpen={showImagePreview}
          onClose={() => setShowImagePreview(false)}
          layoutId="note-image-preview"
        />
      )}
    </form>
  );
};

export default BrewingNoteForm;
