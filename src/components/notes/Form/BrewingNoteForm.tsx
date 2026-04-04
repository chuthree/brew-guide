'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';

import type {
  BrewingNoteData,
  CoffeeBean,
  SelectableCoffeeBean,
} from '@/types/app';
import { isPendingCoffeeBean } from '@/lib/utils/coffeeBeanUtils';

import { captureImage, compressBase64Image } from '@/lib/utils/imageCapture';
import {
  Camera,
  Image as ImageIcon,
  Plus,
  CornerDownRight,
} from 'lucide-react';
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
import {
  normalizeBrewingNoteParams,
  normalizeBrewingNoteSelection,
} from '@/lib/notes/noteDisplay';
import { SettingsOptions } from '@/components/settings/Settings';
import { FlavorDimension, DEFAULT_FLAVOR_DIMENSIONS } from '@/lib/core/db';
import {
  getFlavorDimensionsSync,
  getHistoricalLabelsSync,
  createEmptyTasteRatings,
  migrateTasteRatings,
  useSettingsStore,
} from '@/lib/stores/settingsStore';
import {
  formatBeanDisplayName,
  formatNoteBeanDisplayName,
} from '@/lib/utils/beanVarietyUtils';

import CoffeeBeanPickerDrawer from './CoffeeBeanPickerDrawer';
import { useCoffeeBeanData } from './hooks/useCoffeeBeanData';
import ImagePreview from '@/components/common/ImagePreview';
import GrindSizeInput from '@/components/ui/GrindSizeInput';
import FeatureListItem from './FeatureListItem';
import DatePickerDrawer from './DatePickerDrawer';
import EquipmentMethodPickerDrawer, {
  type EquipmentMethodSelection,
} from './EquipmentMethodPickerDrawer';
import RatingDrawer from './RatingDrawer';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { BrewingNoteDraftData } from './brewingNoteDraft';

// 动画类型到器具ID的映射
const ANIMATION_TYPE_MAPPING: Record<string, string> = {
  v60: 'V60',
  clever: 'CleverDripper',
  espresso: 'Espresso',
  kalita: 'Kalita',
  origami: 'Origami',
};

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

// 类型定义 - 使用动态的风味评分类型
interface TasteRatings {
  [key: string]: number;
}

interface FormData {
  coffeeBeanInfo: {
    name: string;
    roastLevel: string;
    roaster?: string; // 烘焙商名称（可选）
  };
  image?: string;
  images: string[]; // 多图支持
  rating: number;
  taste: TasteRatings;
  notes: string;
}

const EMPTY_METHOD_PARAMS = {
  coffee: '',
  water: '',
  ratio: '',
  grindSize: '',
  temp: '',
};

interface BrewingNoteFormProps {
  id?: string;
  onClose: () => void;
  onSave: (data: BrewingNoteData) => void;
  initialData: Partial<BrewingNoteData> & {
    coffeeBean?: SelectableCoffeeBean | null;
  };
  inBrewPage?: boolean;
  showSaveButton?: boolean;
  onSaveSuccess?: () => void;
  hideHeader?: boolean;
  onTimestampChange?: (timestamp: Date) => void;
  settings?: SettingsOptions;
  isCopy?: boolean; // 标记是否是复制操作
  // 快捷记录模式相关
  isQuickMode?: boolean;
  onQuickModeChange?: (isQuick: boolean) => void;
  onDraftChange?: (draft: BrewingNoteDraftData) => void;
  syncInitialDataChanges?: boolean;
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
  const roastLevel =
    beanInfo && 'roastLevel' in beanInfo
      ? beanInfo.roastLevel
      : initialData.coffeeBeanInfo?.roastLevel;
  const roaster =
    beanInfo && 'roaster' in beanInfo
      ? beanInfo.roaster
      : initialData.coffeeBeanInfo?.roaster;
  return {
    name: beanInfo?.name || '',
    roastLevel: normalizeRoastLevel(roastLevel),
    roaster,
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
  isQuickMode: externalIsQuickMode,
  onQuickModeChange,
  onDraftChange,
  syncInitialDataChanges = true,
}) => {
  // 获取烘焙商显示设置
  const roasterFieldEnabled = useSettingsStore(
    state => state.settings.roasterFieldEnabled
  );
  const roasterSeparator = useSettingsStore(
    state => state.settings.roasterSeparator
  );
  const roasterSettings = useMemo(
    () => ({ roasterFieldEnabled, roasterSeparator }),
    [roasterFieldEnabled, roasterSeparator]
  );

  // 评分维度数据
  const [flavorDimensions, setFlavorDimensions] = useState<FlavorDimension[]>(
    []
  );
  const [displayDimensions, setDisplayDimensions] = useState<FlavorDimension[]>(
    []
  );

  // 咖啡豆数据和状态管理
  // 支持已有豆子(CoffeeBean)和待创建豆子(PendingCoffeeBean)
  const { beans: coffeeBeans } = useCoffeeBeanData();
  const [selectedCoffeeBean, setSelectedCoffeeBean] =
    useState<SelectableCoffeeBean | null>(initialData.coffeeBean || null);
  const [showCoffeeBeanPickerDrawer, setShowCoffeeBeanPickerDrawer] =
    useState(false);
  const [originalBeanId] = useState<string | undefined>(initialData.beanId); // 记录原始的beanId用于容量同步
  const [showImagePreview, setShowImagePreview] = useState(false); // 控制图片预览
  const [previewImageIndex, setPreviewImageIndex] = useState(0); // 当前预览图片的索引
  // 🔥 标记用户是否主动选择了咖啡豆（用于防止 initialData 变化覆盖用户选择）
  const userSelectedBeanRef = useRef(false);
  const [showBeanFlavorTags, setShowBeanFlavorTags] = useState(false);
  // 图片选择 input ref
  const imageInputRef = useRef<HTMLInputElement>(null);

  // 新的抽屉状态
  const [showDatePickerDrawer, setShowDatePickerDrawer] = useState(false);
  const [showEquipmentMethodDrawer, setShowEquipmentMethodDrawer] =
    useState(false);
  const [showRatingDrawer, setShowRatingDrawer] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    coffeeBeanInfo: getInitialCoffeeBeanInfo(initialData),
    image: typeof initialData.image === 'string' ? initialData.image : '',
    images:
      initialData.images || (initialData.image ? [initialData.image] : []),
    rating: initialData?.rating ?? 0,
    taste: initialData?.taste || {},
    notes: initialData?.notes || '',
  });
  const initialTasteSeed = syncInitialDataChanges ? initialData.taste : null;

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
    ...EMPTY_METHOD_PARAMS,
    ...normalizeBrewingNoteParams(initialData?.params),
  });

  // 分离的数值状态（用于输入框显示）
  const [numericValues, setNumericValues] = useState(() => ({
    coffee: extractNumericValue(initialData?.params?.coffee || ''),
    water: extractNumericValue(initialData?.params?.water || ''),
    temp: extractNumericValue(initialData?.params?.temp || ''),
    ratio: extractNumericValue(
      (initialData?.params?.ratio || '').split(':')[1] || ''
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
  const [selectedEquipment, setSelectedEquipment] = useState(
    initialData.equipment || ''
  );
  const [selectedMethod, setSelectedMethod] = useState(
    initialData.method || ''
  );

  const applyMethodParams = useCallback(
    (params?: Partial<Method['params']>, totalTimeOverride?: string) => {
      const normalizedParams = {
        ...EMPTY_METHOD_PARAMS,
        ...normalizeBrewingNoteParams(params),
      };

      setMethodParams(normalizedParams);
      setNumericValues({
        coffee: extractNumericValue(normalizedParams.coffee),
        water: extractNumericValue(normalizedParams.water),
        temp: extractNumericValue(normalizedParams.temp),
        ratio: extractNumericValue(normalizedParams.ratio.split(':')[1] || ''),
      });

      if (typeof totalTimeOverride === 'string') {
        setTotalTimeStr(totalTimeOverride);
        return;
      }

      const totalTime =
        params?.stages?.reduce(
          (acc, stage) => acc + (stage.duration || 0),
          0
        ) || 0;
      setTotalTimeStr(totalTime > 0 ? String(totalTime) : '');
    },
    []
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

  // 快捷扣除量状态（仅用于快捷扣除记录编辑）
  const [quickDecrementAmount, setQuickDecrementAmount] = useState<string>(
    () => {
      if (initialData.source === 'quick-decrement') {
        return String(initialData.quickDecrementAmount || 0);
      }
      return '';
    }
  );
  // 容量调整量状态（仅用于容量调整记录编辑）
  const [capacityAdjustmentAmount, setCapacityAdjustmentAmount] =
    useState<string>(() => {
      if (
        initialData.source === 'capacity-adjustment' &&
        initialData.changeRecord?.capacityAdjustment
      ) {
        const amount = initialData.changeRecord.capacityAdjustment.changeAmount;
        if (typeof amount === 'number' && !isNaN(amount)) {
          return String(Math.abs(amount));
        }
      }
      if (initialData.params?.coffee) {
        return extractNumericValue(initialData.params.coffee);
      }
      return '';
    });
  const [isCapacityAdjustmentIncrease, setIsCapacityAdjustmentIncrease] =
    useState<boolean>(() => {
      if (
        initialData.source === 'capacity-adjustment' &&
        initialData.changeRecord?.capacityAdjustment
      ) {
        const changeType =
          initialData.changeRecord.capacityAdjustment.changeType;
        if (changeType === 'increase') return true;
        if (changeType === 'decrease') return false;
        const amount = initialData.changeRecord.capacityAdjustment.changeAmount;
        if (typeof amount === 'number') return amount >= 0;
      }
      return false;
    });

  // 监听initialData.totalTime的变化
  useEffect(() => {
    if (initialData.totalTime) {
      setTotalTimeStr(String(initialData.totalTime));
    }
  }, [initialData.totalTime]);

  const formRef = useRef<HTMLFormElement>(null);
  const generatedNoteIdRef = useRef(
    id || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (id) {
      generatedNoteIdRef.current = id;
    }
  }, [id]);

  // 创建显示维度（包含历史维度）
  const createDisplayDimensions = (
    currentDimensions: FlavorDimension[],
    tasteData: Record<string, number>
  ) => {
    const historicalLabels = getHistoricalLabelsSync();
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
    const loadFlavorDimensions = () => {
      try {
        const dimensions = getFlavorDimensionsSync();
        setFlavorDimensions(dimensions);

        // 如果是新笔记或者现有笔记缺少风味数据，初始化风味评分
        if (!initialTasteSeed || Object.keys(initialTasteSeed).length === 0) {
          const emptyTaste = createEmptyTasteRatings(dimensions);
          setFormData(prev => ({ ...prev, taste: emptyTaste }));
          setDisplayDimensions(dimensions);
        } else {
          // 迁移现有的风味评分数据以确保兼容性
          const migratedTaste = migrateTasteRatings(
            initialTasteSeed,
            dimensions
          );
          setFormData(prev => ({ ...prev, taste: migratedTaste }));

          // 创建包含历史维度的显示维度列表
          const displayDims = createDisplayDimensions(
            dimensions,
            initialTasteSeed
          );
          setDisplayDimensions(displayDims);
        }
      } catch (error) {
        console.error('加载评分维度失败:', error);
      }
    };

    loadFlavorDimensions();
  }, [initialTasteSeed]);

  // 监听评分维度变化
  useEffect(() => {
    const handleFlavorDimensionsChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { dimensions } = customEvent.detail;
      setFlavorDimensions(dimensions);

      // 更新表单数据以匹配新的维度
      setFormData(prev => {
        const migratedTaste = migrateTasteRatings(prev.taste, dimensions);
        return { ...prev, taste: migratedTaste };
      });

      // 重新创建显示维度列表
      const currentTaste = formData.taste;
      const displayDims = createDisplayDimensions(dimensions, currentTaste);
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
          const { filterHiddenEquipments } =
            await import('@/lib/stores/settingsStore');
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
    const handleMethodParamsChange = (e: CustomEvent) => {
      if (e.detail?.params) {
        applyMethodParams(e.detail.params);
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
        case 'water': {
          const waterValue = parseFloat(value);
          if (isNaN(waterValue) || waterValue <= 0) return;

          setMethodParams(prev => ({
            ...prev,
            water: `${waterValue}g`,
          }));
          setNumericValues(prev => ({
            ...prev,
            water: String(waterValue),
          }));
          break;
        }
        case 'time': {
          const timeValue = parseFloat(value);
          if (isNaN(timeValue) || timeValue < 0) return;
          setTotalTimeStr(String(timeValue));
          break;
        }
      }
    };

    document.addEventListener(
      'methodParamsChanged',
      handleMethodParamsChange as EventListener
    );
    window.addEventListener(
      'brewing:updateNoteParams',
      handleUpdateNoteParams as EventListener
    );

    return () => {
      document.removeEventListener(
        'methodParamsChanged',
        handleMethodParamsChange as EventListener
      );
      window.removeEventListener(
        'brewing:updateNoteParams',
        handleUpdateNoteParams as EventListener
      );
    };
  }, [applyMethodParams, methodParams]);

  // 更新方案参数的通用函数
  const updateMethodParams = useCallback(
    (params: Method['params']) => {
      applyMethodParams(params);
    },
    [applyMethodParams]
  );

  // 简化的数据更新逻辑
  const prevInitialDataRef = useRef<typeof initialData>(initialData);

  useEffect(() => {
    if (!syncInitialDataChanges) {
      prevInitialDataRef.current = initialData;
      return;
    }

    const prev = prevInitialDataRef.current;
    const current = initialData;

    // 如果用户已经主动选择了咖啡豆，不要让 initialData 的变化覆盖用户的选择
    if (userSelectedBeanRef.current) {
      // 只更新 prevInitialDataRef，不更新状态
      prevInitialDataRef.current = current;
      return;
    }

    // 检查咖啡豆信息变化
    const beanChanged =
      prev.coffeeBean?.id !== current.coffeeBean?.id ||
      prev.coffeeBeanInfo?.name !== current.coffeeBeanInfo?.name;

    if (beanChanged) {
      const beanInfo = current.coffeeBean || current.coffeeBeanInfo;
      const roastLevel =
        beanInfo && 'roastLevel' in beanInfo
          ? beanInfo.roastLevel
          : current.coffeeBeanInfo?.roastLevel;
      const roastDate =
        beanInfo && 'roastDate' in beanInfo
          ? beanInfo.roastDate
          : current.coffeeBeanInfo?.roastDate;
      const roaster =
        beanInfo && 'roaster' in beanInfo
          ? beanInfo.roaster
          : current.coffeeBeanInfo?.roaster;

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
          roastLevel: normalizeRoastLevel(roastLevel),
          roastDate: roastDate || '',
          roaster,
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
          ? migrateTasteRatings(current.taste, flavorDimensions)
          : prev.taste,
        notes: current.notes || prev.notes,
      }));
    }

    // 检查参数变化
    if (JSON.stringify(prev.params) !== JSON.stringify(current.params)) {
      applyMethodParams(
        current.params,
        current.totalTime ? String(current.totalTime) : ''
      );
    }

    prevInitialDataRef.current = current;
  }, [
    applyMethodParams,
    initialData,
    selectedCoffeeBean?.id,
    flavorDimensions,
    syncInitialDataChanges,
  ]);

  // 判断是否是添加模式（提前声明，供 updateRating 使用）
  const isAdding = !id || isCopy;

  // 判断是否是快捷扣除记录编辑模式
  const isQuickDecrementEdit =
    !isAdding && initialData.source === 'quick-decrement';

  // 判断是否是容量调整记录编辑模式
  const isCapacityAdjustmentEdit =
    !isAdding && initialData.source === 'capacity-adjustment';

  // 跟踪当前是否处于快捷记录模式（用于切换按钮）
  // 优先使用外部传入的状态，否则使用内部状态
  const [internalIsQuickMode, setInternalIsQuickMode] =
    useState(isQuickDecrementEdit);
  const isQuickMode =
    externalIsQuickMode !== undefined
      ? externalIsQuickMode
      : internalIsQuickMode;

  // 判断是否应该隐藏图片功能（仅在变动记录/快捷扣除记录的快捷模式下隐藏）
  const shouldHideImage =
    (isCapacityAdjustmentEdit || isQuickDecrementEdit) && isQuickMode;

  // 切换模式的处理函数
  const handleToggleQuickMode = useCallback(() => {
    const newMode = !isQuickMode;
    if (onQuickModeChange) {
      onQuickModeChange(newMode);
    } else {
      setInternalIsQuickMode(newMode);
    }
  }, [isQuickMode, onQuickModeChange]);

  // 暴露切换函数和状态给父组件
  useEffect(() => {
    if (isQuickDecrementEdit) {
      // 通知父组件这是快捷扣除记录
      window.dispatchEvent(
        new CustomEvent('brewingNoteFormMounted', {
          detail: {
            isQuickDecrementEdit,
            isQuickMode,
            noteId: id,
          },
        })
      );
    }
  }, [isQuickDecrementEdit, isQuickMode, id]);

  // 监听外部的切换请求
  useEffect(() => {
    const handleToggleRequest = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.noteId === id) {
        handleToggleQuickMode();
      }
    };

    window.addEventListener('toggleQuickMode', handleToggleRequest);
    return () => {
      window.removeEventListener('toggleQuickMode', handleToggleRequest);
    };
  }, [id, handleToggleQuickMode]);

  // 自适应 textarea 高度
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // 重置高度以获取正确的 scrollHeight
    textarea.style.height = 'auto';
    // 设置为内容高度
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  // 监听内容变化，自动调整高度
  useEffect(() => {
    adjustTextareaHeight();
  }, [formData.notes, adjustTextareaHeight]);

  // 创建评分更新函数
  // 总体评分更新函数，支持风味评分跟随设置
  const updateRating = useCallback(
    (value: number) => {
      setFormData(prev => {
        const newFormData = { ...prev, rating: value };

        // 判断是否需要同步风味评分
        // 条件：1) 是添加模式 2) 开启了跟随设置 3) 用户未手动修改过风味评分
        const shouldSyncFlavor =
          isAdding &&
          settings?.flavorRatingFollowOverall &&
          !userModifiedFlavorRatingsRef.current;

        if (shouldSyncFlavor && flavorDimensions.length > 0) {
          // 将总评(0-5, step 0.5)映射到风味评分
          // 如果开启半星精度，保留0.5；否则向下取整
          const syncedFlavorValue = settings?.flavorRatingHalfStep
            ? value
            : Math.floor(value);

          // 更新所有风味维度的评分
          const syncedTaste: Record<string, number> = {};
          flavorDimensions.forEach(dimension => {
            syncedTaste[dimension.id] = syncedFlavorValue;
          });
          newFormData.taste = syncedTaste;
        }

        return newFormData;
      });
    },
    [
      isAdding,
      settings?.flavorRatingFollowOverall,
      settings?.flavorRatingHalfStep,
      flavorDimensions,
    ]
  );

  // 风味评分更新函数，标记用户已手动修改
  const updateTasteRating = useCallback(
    (key: string) => (value: number) => {
      // 标记用户已手动修改风味评分
      userModifiedFlavorRatingsRef.current = true;
      // 标记风味评分不再是仅同步状态
      flavorRatingsOnlySyncedRef.current = false;

      setFormData(prev => ({
        ...prev,
        taste: { ...prev.taste, [key]: value },
      }));
    },
    []
  );

  /**
   * 检查参数是否为空占位符（快捷记录）
   *
   * 快捷记录只保存 coffee 字段，其他参数为空字符串
   * 当用户从快捷记录切换到普通笔记并选择方案时，
   * 应该忽略这些空占位符，使用方案的默认参数
   */
  const isEmptyPlaceholder = useCallback(
    (params?: Partial<Method['params']>): boolean => {
      if (!params) return true;
      const { coffee, water, ratio, grindSize, temp } = params;
      // 只有 coffee 有值，其他字段都是空的，认为是空占位符
      return !!coffee && !water && !ratio && !grindSize && !temp;
    },
    []
  );

  // 处理器具方案选择抽屉的选择结果
  const handleEquipmentMethodSelection = useCallback(
    (selection: EquipmentMethodSelection) => {
      try {
        // 更新器具
        setSelectedEquipment(selection.equipmentId);

        // 更新方案
        if (selection.methodId) {
          setSelectedMethod(selection.methodName || selection.methodId);
          // 如果有方案参数，更新参数
          if (selection.method?.params) {
            updateMethodParams(selection.method.params);
          }
        } else {
          // 没有选择方案，清空方案
          setSelectedMethod('');
          if (selectedMethod) {
            applyMethodParams(undefined, '');
          }
        }

        // 关闭抽屉
        setShowEquipmentMethodDrawer(false);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('选择器具方案失败:', error);
        }
      }
    },
    [applyMethodParams, selectedMethod, updateMethodParams]
  );

  // 获取当前器具和方案名称 - 使用useMemo优化
  const currentEquipmentName = useMemo(() => {
    // 从availableEquipments中过滤出自定义器具
    const customEquips = availableEquipments.filter(
      eq => 'isCustom' in eq && eq.isCustom
    ) as CustomEquipment[];
    if (!selectedEquipment) return '';
    return getEquipmentNameById(selectedEquipment, customEquips) || '';
  }, [selectedEquipment, availableEquipments]);

  const currentMethodName = useMemo(() => {
    if (!selectedMethod || selectedMethod.trim() === '') {
      return '';
    }
    const method = availableMethods.find(
      m => m.name === selectedMethod || m.id === selectedMethod
    );
    return method?.name || selectedMethod || '';
  }, [availableMethods, selectedMethod]);

  const equipmentMethodValue = useMemo(
    () =>
      [currentEquipmentName, currentMethodName].filter(Boolean).join(' · ') ||
      '可选',
    [currentEquipmentName, currentMethodName]
  );

  // 根据设置和现有数据决定是否显示评分区域
  // 规则：
  // 1. 如果设置开启了评分功能，显示评分区域
  // 2. 如果当前笔记已有评分数据（总体评分或风味评分），无论设置如何都显示
  const hasExistingRatingData = useMemo(() => {
    return (
      formData.rating > 0 ||
      Object.values(formData.taste).some(value => value > 0)
    );
  }, [formData.rating, formData.taste]);

  const showRatingSection =
    (settings?.showOverallRatingInForm ?? true) || hasExistingRatingData;

  // 🎯 风味评分跟随总评功能相关状态
  // 标记用户是否手动修改过风味评分（一旦手动修改，总评变化不再影响风味评分）
  const userModifiedFlavorRatingsRef = useRef(false);
  // 标记风味评分是否仅来自于总评同步（用于保存时判断是否要保存风味评分）
  const flavorRatingsOnlySyncedRef = useRef(true);

  // 初始化时检查是否有风味评分数据，用于标记非仅同步状态
  useEffect(() => {
    const hasTasteValues =
      initialData?.taste &&
      Object.values(initialData.taste).some(value => value > 0);
    if (hasTasteValues) {
      flavorRatingsOnlySyncedRef.current = false;
    }
  }, [initialData?.taste]);

  // 处理相册图片上传（使用 HTML input，与咖啡豆图片识别保持一致）
  const handleGalleryUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const remainCount = 9 - formData.images.length;
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif',
      ];
      const validFiles: File[] = [];

      for (let i = 0; i < Math.min(files.length, remainCount); i++) {
        const file = files[i];
        if (allowedTypes.includes(file.type) && file.size <= 50 * 1024 * 1024) {
          validFiles.push(file);
        }
      }

      if (validFiles.length === 0) return;

      try {
        // 读取所有文件为 base64
        const newImagesBase64 = await Promise.all(
          validFiles.map(
            file =>
              new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
              })
          )
        );

        // 压缩所有新图片
        const compressedImages = await Promise.all(
          newImagesBase64.map(base64 =>
            compressBase64Image(base64, {
              maxSizeMB: 0.1,
              maxWidthOrHeight: 1200,
              initialQuality: 0.8,
            })
          )
        );

        // 更新表单数据
        setFormData(prev => {
          const newImages = [...prev.images, ...compressedImages];
          return {
            ...prev,
            image: newImages[0],
            images: newImages,
          };
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('图片处理失败:', error);
        }
      }

      // 清除 input 值，允许再次选择同一文件
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    },
    [formData.images.length]
  );

  const handleImageSelect = useCallback(
    async (source: 'camera' | 'gallery') => {
      // 检查是否已达到最大数量
      if (formData.images.length >= 9) {
        alert('最多只能上传9张图片');
        return;
      }

      if (source === 'gallery') {
        // 使用 HTML input 选择图片（与咖啡豆图片识别保持一致）
        imageInputRef.current?.click();
        return;
      }

      // 拍照使用 captureImage
      try {
        const result = await captureImage({ source });
        const newImagesBase64 = [result.dataUrl];

        // 压缩所有新图片
        const compressedImages = await Promise.all(
          newImagesBase64.map(base64 =>
            compressBase64Image(base64, {
              maxSizeMB: 0.1,
              maxWidthOrHeight: 1200,
              initialQuality: 0.8,
            })
          )
        );

        // 更新表单数据
        setFormData(prev => {
          const newImages = [...prev.images, ...compressedImages];
          return {
            ...prev,
            image: newImages[0], // 始终保持第一张为封面图
            images: newImages,
          };
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('打开相机失败:', error);
        }
      }
    },
    [formData.images.length]
  );

  // 处理咖啡豆选择变化（支持已有豆子和待创建豆子）
  const handleCoffeeBeanSelect = useCallback(
    (bean: SelectableCoffeeBean | null) => {
      // 标记用户已主动选择咖啡豆，防止 initialData 变化覆盖用户选择
      userSelectedBeanRef.current = true;

      setSelectedCoffeeBean(bean);

      // 更新表单中的咖啡豆信息
      if (bean) {
        // 待创建的豆子只有名称，其他信息为空
        const isPending = isPendingCoffeeBean(bean);

        // 分别存储 name 和 roaster，不在这里格式化
        // 显示时根据当前设置动态格式化
        const beanName = isPending
          ? bean.name || ''
          : (bean as CoffeeBean).name;
        const beanRoaster = isPending
          ? undefined
          : (bean as CoffeeBean).roaster;

        setFormData(prev => ({
          ...prev,
          coffeeBeanInfo: {
            name: beanName,
            roastLevel: isPending
              ? '中度烘焙'
              : normalizeRoastLevel((bean as CoffeeBean).roastLevel),
            roastDate: isPending ? '' : (bean as CoffeeBean).roastDate || '',
            roaster: beanRoaster,
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
            roaster: undefined,
          },
        }));
      }
    },
    []
  );

  // 保存笔记的处理函数
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    try {
      // 提取当前咖啡用量（用于容量计算和新建豆子）
      const {
        CapacitySyncManager,
        updateBeanRemaining,
        increaseBeanRemaining,
      } = await import('@/lib/stores/coffeeBeanStore');
      const currentCoffeeAmount = CapacitySyncManager.extractCoffeeAmount(
        isQuickDecrementEdit && isQuickMode
          ? `${parseFloat(quickDecrementAmount) || 0}g`
          : methodParams.coffee
      );

      // 处理待创建的咖啡豆
      // 如果选中的是 PendingCoffeeBean，在保存笔记时创建它
      let finalBeanId: string | undefined;

      if (selectedCoffeeBean && isPendingCoffeeBean(selectedCoffeeBean)) {
        try {
          const { useCoffeeBeanStore } =
            await import('@/lib/stores/coffeeBeanStore');
          const addBean = useCoffeeBeanStore.getState().addBean;

          // 创建新咖啡豆，容量和剩余量基于本次冲煮用量
          // 容量 = 咖啡用量（首次使用的量即为总容量）
          // 剩余量 = 0（本次冲煮已用完）
          const coffeeAmountStr =
            currentCoffeeAmount > 0 ? `${currentCoffeeAmount}g` : '';
          const newBean = await addBean({
            name: selectedCoffeeBean.name,
            capacity: coffeeAmountStr,
            remaining: '0',
          });

          finalBeanId = newBean.id;

          // 更新 selectedCoffeeBean 为真实的豆子（用于后续逻辑）
          setSelectedCoffeeBean(newBean);
        } catch (error) {
          console.error('创建咖啡豆失败:', error);
          alert('创建咖啡豆失败，请重试');
          return;
        }
      } else if (
        selectedCoffeeBean &&
        !isPendingCoffeeBean(selectedCoffeeBean)
      ) {
        // 已有豆子，使用其 ID
        finalBeanId = selectedCoffeeBean.id;

        // 判断是否是新建笔记（没有ID或是复制操作）
        const isNewNote = !initialData.id || isCopy;

        if (isNewNote) {
          // 新建笔记：直接扣除咖啡豆剩余量
          if (currentCoffeeAmount > 0) {
            try {
              await updateBeanRemaining(
                selectedCoffeeBean.id,
                currentCoffeeAmount
              );
            } catch (error) {
              console.error('扣除咖啡豆剩余量失败:', error);
            }
          }
        } else if (initialData.source !== 'capacity-adjustment') {
          // 编辑模式且非容量调整记录：处理容量同步
          try {
            const currentBeanId = selectedCoffeeBean.id;
            const beanChanged = originalBeanId !== currentBeanId;

            if (beanChanged) {
              // 咖啡豆发生变化，需要处理双向容量同步
              const originalCoffeeAmount =
                CapacitySyncManager.extractCoffeeAmount(
                  initialData.params?.coffee || '0g'
                );

              // 恢复原咖啡豆的剩余量（如果原来有关联的咖啡豆）
              if (originalBeanId && originalCoffeeAmount > 0) {
                await increaseBeanRemaining(
                  originalBeanId,
                  originalCoffeeAmount
                );
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
                  await increaseBeanRemaining(
                    originalBeanId,
                    Math.abs(amountDiff)
                  );
                }
              }
            }
          } catch (error) {
            console.error('同步咖啡豆容量失败:', error);
          }
        }
      }

      // 规范化器具ID（将名称转换为ID）
      const { normalizeEquipmentId } = await import('@/components/notes/utils');
      const normalizedEquipmentId =
        await normalizeEquipmentId(selectedEquipment);
      const normalizedSelection = normalizeBrewingNoteSelection({
        equipment: normalizedEquipmentId,
        method: selectedMethod,
      });
      const finalEquipment = normalizedSelection.equipment;
      const finalMethod = normalizedSelection.method;
      const finalParams = normalizeBrewingNoteParams(methodParams);
      const finalTotalTime = parseFloat(totalTimeStr);

      // 处理风味评分数据
      // 如果满足以下任一条件，不保存风味评分：
      // 1. 用户关闭了风味评分显示
      // 2. 用户只变更了总体评分，但风味评分完全没有手动修改过（仅来自同步）
      let finalTaste = formData.taste;
      if (
        !settings?.showFlavorRatingInForm ||
        (isAdding &&
          settings?.flavorRatingFollowOverall &&
          flavorRatingsOnlySyncedRef.current)
      ) {
        // 不保存风味评分
        finalTaste = {};
      }

      const isConvertingToNormal = isQuickDecrementEdit && !isQuickMode;
      const preservedSource = isConvertingToNormal
        ? undefined
        : initialData.source;
      const preservedChangeRecord = isConvertingToNormal
        ? undefined
        : initialData.changeRecord;
      const quickDecrementAmountValue =
        preservedSource === 'quick-decrement'
          ? parseFloat(quickDecrementAmount) || 0
          : undefined;

      // 创建完整的笔记数据
      const noteData: BrewingNoteData = {
        id: id || generatedNoteIdRef.current,
        // 使用当前的时间戳状态
        timestamp: timestamp.getTime(),
        ...formData,
        taste: finalTaste, // 使用处理后的风味评分
        ...(finalEquipment && { equipment: finalEquipment }),
        ...(finalMethod && { method: finalMethod }),
        ...(finalParams && { params: finalParams }),
        ...(finalTotalTime > 0 && { totalTime: finalTotalTime }),
        // 使用最终确定的咖啡豆ID（可能是新建的或已有的）
        beanId: finalBeanId,
        ...(preservedSource && { source: preservedSource }),
        ...(preservedChangeRecord && { changeRecord: preservedChangeRecord }),
        ...(preservedSource === 'quick-decrement' && {
          quickDecrementAmount: quickDecrementAmountValue,
        }),
        ...(isConvertingToNormal && {
          source: undefined,
          quickDecrementAmount: undefined,
          changeRecord: undefined,
        }),
      };

      // 容量调整记录：同步 changeRecord 与显示的调整量
      if (
        isCapacityAdjustmentEdit &&
        preservedChangeRecord?.capacityAdjustment
      ) {
        if (!noteData.params) {
          noteData.params = {};
        }
        const rawAmount = parseFloat(capacityAdjustmentAmount);
        const amount = isNaN(rawAmount) ? 0 : rawAmount;
        const signedChange = (isCapacityAdjustmentIncrease ? 1 : -1) * amount;
        const originalAmount =
          preservedChangeRecord.capacityAdjustment.originalAmount;
        const newAmount =
          typeof originalAmount === 'number'
            ? originalAmount + signedChange
            : preservedChangeRecord.capacityAdjustment.newAmount;
        const changeType =
          signedChange > 0 ? 'increase' : signedChange < 0 ? 'decrease' : 'set';

        noteData.changeRecord = {
          ...preservedChangeRecord,
          capacityAdjustment: {
            ...preservedChangeRecord.capacityAdjustment,
            changeAmount: signedChange,
            changeType,
            newAmount,
          },
        };
        noteData.params.coffee = `${amount}g`;
      }

      // 如果是快捷扣除记录且处于快捷模式，同步更新 params.coffee 字段
      if (isQuickDecrementEdit && isQuickMode && noteData.params) {
        noteData.params.coffee = `${parseFloat(quickDecrementAmount) || 0}g`;
      }

      if (isQuickDecrementEdit && isQuickMode && !noteData.params) {
        noteData.params = {
          coffee: `${parseFloat(quickDecrementAmount) || 0}g`,
        };
      }

      try {
        // 同步磨豆机刻度到设置
        if (methodParams.grindSize && finalEquipment && finalMethod) {
          const { syncGrinderToSettings } = await import('@/lib/grinder');
          const coffeeBeanContext = selectedCoffeeBean
            ? {
                name:
                  'name' in selectedCoffeeBean
                    ? selectedCoffeeBean.name
                    : formData.coffeeBeanInfo.name,
                roaster:
                  'roaster' in selectedCoffeeBean
                    ? selectedCoffeeBean.roaster
                    : formData.coffeeBeanInfo.roaster,
              }
            : formData.coffeeBeanInfo.name
              ? {
                  name: formData.coffeeBeanInfo.name,
                  roaster: formData.coffeeBeanInfo.roaster,
                }
              : undefined;

          await syncGrinderToSettings(
            methodParams.grindSize,
            finalEquipment,
            finalMethod,
            coffeeBeanContext
          );
        }

        // 保存笔记
        await Promise.resolve(onSave(noteData));

        // 如果提供了保存成功的回调，则调用它
        if (onSaveSuccess) {
          await Promise.resolve(onSaveSuccess());
        }
      } catch (error) {
        // Log error in development only
        if (process.env.NODE_ENV === 'development') {
          console.error('保存笔记时出错:', error);
        }
        alert('保存笔记时出错，请重试');
      }
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const containerClassName = 'relative grid min-h-full grid-rows-[1fr_auto]';

  // 格式化日期显示
  const formatDateDisplay = (date: Date) => {
    return format(date, 'yyyy/MM/dd HH:mm', { locale: zhCN });
  };

  // 获取咖啡豆显示名称
  const getCoffeeBeanDisplayName = () => {
    if (selectedCoffeeBean && !isPendingCoffeeBean(selectedCoffeeBean)) {
      return formatBeanDisplayName(
        selectedCoffeeBean as CoffeeBean,
        roasterSettings
      );
    }
    if (selectedCoffeeBean?.name) {
      return selectedCoffeeBean.name;
    }
    if (formData.coffeeBeanInfo.name) {
      return formatNoteBeanDisplayName(
        formData.coffeeBeanInfo,
        roasterSettings
      );
    }
    return '';
  };

  useEffect(() => {
    setShowBeanFlavorTags(false);
  }, [
    selectedCoffeeBean && !isPendingCoffeeBean(selectedCoffeeBean)
      ? (selectedCoffeeBean as CoffeeBean).id
      : 'pending',
  ]);

  // 获取咖啡豆风味标签预览
  const getCoffeeBeanFlavorPreview = () => {
    if (!selectedCoffeeBean || isPendingCoffeeBean(selectedCoffeeBean)) {
      return null;
    }

    const flavors = (selectedCoffeeBean as CoffeeBean).flavor || [];
    if (flavors.length === 0) return null;

    return (
      <AnimatePresence initial={false} mode="popLayout">
        {showBeanFlavorTags ? (
          <motion.div
            key="flavors"
            className="scrollbar-hide flex w-full gap-1.5 overflow-x-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {flavors.map((flavor, index) => (
              <button
                type="button"
                key={`${flavor}-${index}`}
                onClick={() => setShowBeanFlavorTags(false)}
                className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-sm font-medium text-neutral-600 dark:bg-neutral-800/40 dark:text-neutral-400"
              >
                {flavor}
              </button>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="toggle"
            className="scrollbar-hide flex w-full gap-1.5 overflow-x-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <button
              type="button"
              onClick={() => setShowBeanFlavorTags(true)}
              className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded bg-neutral-100/80 px-1.5 py-0.5 text-sm font-medium text-neutral-500 transition-all duration-150 ease-out hover:bg-neutral-100 hover:text-neutral-600 dark:bg-neutral-800/40 dark:text-neutral-500 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-400"
            >
              <CornerDownRight className="h-3.5 w-3.5" />
              显示风味
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  // 获取方案参数预览
  const getMethodParamsPreview = () => {
    if (isEspresso) {
      const parsedTime = parseFloat(totalTimeStr);
      const timeValue =
        !Number.isNaN(parsedTime) && parsedTime > 0 ? `${parsedTime}s` : '';

      const params = [
        methodParams.coffee && { label: '粉量', value: methodParams.coffee },
        methodParams.grindSize && {
          label: '研磨',
          value: methodParams.grindSize,
        },
        timeValue && { label: '时长', value: timeValue },
        methodParams.water && { label: '液重', value: methodParams.water },
      ].filter(Boolean) as { label: string; value: string }[];

      if (params.length === 0) return null;

      return (
        <div className="scrollbar-hide flex w-full gap-1.5 overflow-x-auto">
          {params.map(param => (
            <span
              key={param.label}
              className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-sm font-medium text-neutral-600 dark:bg-neutral-800/40 dark:text-neutral-400"
            >
              {param.value}
            </span>
          ))}
        </div>
      );
    }

    // 非意式参数预览
    const params = [
      methodParams.coffee && { label: '粉量', value: methodParams.coffee },
      methodParams.ratio && { label: '比例', value: methodParams.ratio },
      methodParams.grindSize && {
        label: '研磨',
        value: methodParams.grindSize,
      },
      methodParams.temp && { label: '水温', value: methodParams.temp },
    ].filter(Boolean) as { label: string; value: string }[];

    if (params.length === 0) return null;

    return (
      <div className="scrollbar-hide flex w-full gap-1.5 overflow-x-auto">
        {params.map(param => (
          <span
            key={param.label}
            className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-sm font-medium text-neutral-600 dark:bg-neutral-800/40 dark:text-neutral-400"
          >
            {param.value}
          </span>
        ))}
      </div>
    );
  };

  // 获取风味评分预览（只要有一个维度>0，就显示所有维度包括0分的）
  const getFlavorRatingPreview = () => {
    if (displayDimensions.length === 0) return null;

    // 检查是否至少有一个维度的评分大于0
    const hasAnyRating = displayDimensions.some(
      dim => (formData.taste[dim.id] || 0) > 0
    );
    if (!hasAnyRating) return null;

    return (
      <div className="scrollbar-hide flex w-full gap-1.5 overflow-x-auto">
        {displayDimensions.map(dim => {
          const value = formData.taste[dim.id] || 0;
          return (
            <span
              key={dim.id}
              className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-sm font-medium text-neutral-600 dark:bg-neutral-800/40 dark:text-neutral-400"
            >
              {dim.label}&nbsp;
              {settings?.flavorRatingHalfStep ? value.toFixed(1) : value}
            </span>
          );
        })}
      </div>
    );
  };

  // 获取总体评分显示值
  const getOverallRatingDisplay = () => {
    return formData.rating > 0 ? formData.rating.toFixed(1) : '';
  };

  const initialMethodStages = useMemo(() => {
    if (initialData?.stages && initialData.stages.length > 0) {
      return initialData.stages;
    }
    const parsedTime = parseFloat(totalTimeStr);
    if (!Number.isNaN(parsedTime) && parsedTime > 0) {
      return [
        {
          label: '萃取',
          detail: '',
          duration: parsedTime,
          pourType: 'extraction',
        },
      ];
    }
    return undefined;
  }, [initialData?.stages, totalTimeStr]);

  // 处理风味评分变化（从抽屉）
  const handleTasteChange = useCallback((newTaste: Record<string, number>) => {
    // 标记用户已手动修改风味评分
    userModifiedFlavorRatingsRef.current = true;
    flavorRatingsOnlySyncedRef.current = false;
    setFormData(prev => ({ ...prev, taste: newTaste }));
  }, []);

  const lastEmittedDraftRef = useRef<string | null>(null);

  useEffect(() => {
    if (!onDraftChange) {
      return;
    }

    const parsedTotalTime = parseFloat(totalTimeStr);
    const totalTime =
      !Number.isNaN(parsedTotalTime) && parsedTotalTime > 0
        ? parsedTotalTime
        : undefined;
    const images = formData.images || [];
    const image = images[0] || '';
    const beanId =
      selectedCoffeeBean && !isPendingCoffeeBean(selectedCoffeeBean)
        ? selectedCoffeeBean.id
        : undefined;

    const nextDraft = {
      id,
      timestamp: timestamp.getTime(),
      coffeeBean: selectedCoffeeBean,
      beanId,
      coffeeBeanInfo: formData.coffeeBeanInfo,
      image,
      images,
      rating: formData.rating,
      taste: formData.taste,
      notes: formData.notes,
      equipment: selectedEquipment,
      method: selectedMethod,
      params: methodParams,
      totalTime,
      source: initialData.source,
      changeRecord: initialData.changeRecord,
      quickDecrementAmount: initialData.quickDecrementAmount,
    };
    const nextDraftSignature = JSON.stringify(nextDraft);

    if (lastEmittedDraftRef.current === nextDraftSignature) {
      return;
    }

    lastEmittedDraftRef.current = nextDraftSignature;
    onDraftChange(nextDraft);
  }, [
    formData,
    id,
    initialData.changeRecord,
    initialData.quickDecrementAmount,
    initialData.source,
    methodParams,
    onDraftChange,
    selectedCoffeeBean,
    selectedEquipment,
    selectedMethod,
    timestamp,
    totalTimeStr,
  ]);

  return (
    <form
      id={id}
      ref={formRef}
      onSubmit={handleSubmit}
      className={containerClassName}
    >
      {/* 笔记内容输入区域 */}
      <div className="flex-1 pb-4">
        <textarea
          ref={textareaRef}
          id="brewing-notes"
          name="brewingNotes"
          value={formData.notes}
          onChange={e => {
            setFormData({
              ...formData,
              notes: e.target.value,
            });
          }}
          className="min-h-[120px] w-full resize-none overflow-hidden border-none bg-transparent text-sm font-medium text-neutral-800 placeholder:text-neutral-300 focus:outline-none dark:text-neutral-200 dark:placeholder:text-neutral-600"
          placeholder="记录一下这杯的感受..."
        />
      </div>

      {/* 下方：图片和功能列表 */}
      <div className="w-full min-w-0 shrink-0">
        {/* 图片区域 - 仿朋友圈九宫格 */}
        {!shouldHideImage && (
          <div className="mb-4">
            {formData.images.length === 0 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleImageSelect('camera')}
                  className="flex h-24 w-24 shrink-0 items-center justify-center rounded bg-neutral-100 transition-colors dark:bg-neutral-800/40"
                  title="拍照"
                >
                  <Camera
                    className="h-8 w-8 text-neutral-200 dark:text-neutral-800"
                    strokeWidth={1.5}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => handleImageSelect('gallery')}
                  className="flex h-24 w-24 shrink-0 items-center justify-center rounded bg-neutral-100 transition-colors dark:bg-neutral-800/40"
                  title="相册"
                >
                  <ImageIcon
                    className="h-8 w-8 text-neutral-200 dark:text-neutral-800"
                    strokeWidth={1.5}
                  />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {formData.images.map((img, index) => (
                  <motion.div
                    key={index}
                    layoutId={`note-image-${index}`}
                    className="relative aspect-square cursor-pointer overflow-hidden rounded bg-neutral-200/40 dark:bg-neutral-800/60"
                    onClick={() => {
                      setPreviewImageIndex(index);
                      setShowImagePreview(true);
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Image
                      src={img}
                      alt={`笔记图片 ${index + 1}`}
                      className="h-full w-full object-cover"
                      width={200}
                      height={200}
                      unoptimized
                    />
                  </motion.div>
                ))}

                {/* 添加按钮 */}
                {formData.images.length < 9 && (
                  <button
                    type="button"
                    onClick={() => handleImageSelect('gallery')}
                    className="flex aspect-square items-center justify-center rounded bg-neutral-100 transition-colors dark:bg-neutral-800/40"
                    title="添加图片"
                  >
                    <Plus
                      className="h-8 w-8 text-neutral-300 dark:text-neutral-600"
                      strokeWidth={1.5}
                    />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 功能列表 */}
        <div className="">
          {/* 日期 */}
          <FeatureListItem
            label="日期"
            value={formatDateDisplay(timestamp)}
            onClick={() => setShowDatePickerDrawer(true)}
            isFirst={true}
          />

          {/* 咖啡豆 */}
          <FeatureListItem
            label="咖啡豆"
            value={getCoffeeBeanDisplayName()}
            onClick={() => setShowCoffeeBeanPickerDrawer(true)}
            preview={getCoffeeBeanFlavorPreview()}
          />

          {/* 快捷扣除量 - 仅快捷模式显示 */}
          {isQuickDecrementEdit && isQuickMode && (
            <div className="flex items-center border-b border-neutral-200/50 py-3 dark:border-neutral-800/50">
              <span className="shrink-0 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                扣除量
              </span>
              <div className="ml-auto flex items-center gap-2">
                <input
                  type="tel"
                  inputMode="decimal"
                  pattern="^\\d*(\\.\\d+)?$"
                  value={quickDecrementAmount}
                  onChange={e => {
                    const nextValue = e.target.value;
                    if (!validateNumericInput(nextValue)) return;
                    setQuickDecrementAmount(nextValue);
                  }}
                  className="w-20 bg-transparent py-1 text-right text-sm font-medium text-neutral-800 outline-none dark:text-neutral-300"
                  placeholder="0"
                />
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  g
                </span>
              </div>
            </div>
          )}

          {/* 容量调整量 - 仅容量调整记录显示 */}
          {isCapacityAdjustmentEdit && (
            <div className="border-b border-neutral-200/50 py-3 dark:border-neutral-800/50">
              <div className="flex items-center">
                <span className="shrink-0 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  {isCapacityAdjustmentIncrease ? '增加量 (+)' : '减少量 (-)'}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <input
                    type="tel"
                    inputMode="decimal"
                    pattern="^\\d*(\\.\\d+)?$"
                    value={capacityAdjustmentAmount}
                    onChange={e => {
                      const nextValue = e.target.value;
                      if (!validateNumericInput(nextValue)) return;
                      setCapacityAdjustmentAmount(nextValue);
                    }}
                    className="w-20 bg-transparent py-1 text-right text-sm font-medium text-neutral-800 outline-none dark:text-neutral-300"
                    placeholder="0"
                  />
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    g
                  </span>
                </div>
              </div>
              <div className="mt-2 flex justify-start">
                <button
                  type="button"
                  onClick={() =>
                    setIsCapacityAdjustmentIncrease(
                      prevIncrease => !prevIncrease
                    )
                  }
                  className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded bg-neutral-100/80 px-1.5 py-0.5 text-sm font-medium text-neutral-500 transition-all duration-150 ease-out hover:bg-neutral-100 hover:text-neutral-600 dark:bg-neutral-800/40 dark:text-neutral-500 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-400"
                >
                  <CornerDownRight className="h-3.5 w-3.5" />
                  {isCapacityAdjustmentIncrease
                    ? '切换为减少量'
                    : '切换为增加量'}
                </button>
              </div>
            </div>
          )}

          {/* 器具方案 - 编辑模式且非快捷模式时显示 */}
          {!isAdding &&
            !isCapacityAdjustmentEdit &&
            (!isQuickDecrementEdit || !isQuickMode) &&
            (initialData?.id || selectedEquipment) && (
              <FeatureListItem
                label="器具方案"
                value={equipmentMethodValue}
                onClick={() => setShowEquipmentMethodDrawer(true)}
                preview={getMethodParamsPreview()}
              />
            )}

          {/* 评分（合并风味评分和总体评分） - 非快捷模式时显示 */}
          {showRatingSection &&
            !isCapacityAdjustmentEdit &&
            (!isQuickDecrementEdit || !isQuickMode) && (
              <FeatureListItem
                label="评分"
                value={getOverallRatingDisplay()}
                onClick={() => setShowRatingDrawer(true)}
                preview={getFlavorRatingPreview()}
                isLast={true}
              />
            )}
        </div>

        {/* 保存按钮 */}
        {showSaveButton && (
          <div className="pb-safe-bottom flex justify-center pt-4">
            <button
              type="submit"
              className="flex items-center justify-center rounded-full bg-neutral-100 px-6 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
            >
              保存笔记
            </button>
          </div>
        )}
      </div>

      {/* 图片预览 */}
      {formData.images[previewImageIndex] && (
        <ImagePreview
          src={formData.images[previewImageIndex]}
          alt="笔记图片"
          isOpen={showImagePreview}
          onClose={() => setShowImagePreview(false)}
          layoutId={`note-image-${previewImageIndex}`}
          onDelete={() => {
            const newImages = [...formData.images];
            newImages.splice(previewImageIndex, 1);
            setFormData(prev => ({
              ...prev,
              images: newImages,
              image: newImages[0] || '',
            }));
            setShowImagePreview(false);
          }}
        />
      )}

      {/* 日期选择抽屉 */}
      <DatePickerDrawer
        isOpen={showDatePickerDrawer}
        onClose={() => setShowDatePickerDrawer(false)}
        date={timestamp}
        onDateChange={handleTimestampChange}
      />

      {/* 咖啡豆选择抽屉 */}
      <CoffeeBeanPickerDrawer
        isOpen={showCoffeeBeanPickerDrawer}
        onClose={() => setShowCoffeeBeanPickerDrawer(false)}
        onSelect={handleCoffeeBeanSelect}
        selectedBean={selectedCoffeeBean}
        showStatusDots={settings?.showStatusDots}
        hapticFeedback={settings?.hapticFeedback}
      />

      {/* 器具方案选择抽屉 */}
      <EquipmentMethodPickerDrawer
        isOpen={showEquipmentMethodDrawer}
        onClose={() => setShowEquipmentMethodDrawer(false)}
        onSelect={handleEquipmentMethodSelection}
        selectedEquipmentId={selectedEquipment}
        selectedMethodId={selectedMethod}
        initialParams={{
          ...methodParams,
          ...(initialMethodStages && { stages: initialMethodStages }),
        }}
        settings={settings}
        hapticFeedback={settings?.hapticFeedback}
      />

      {/* 评分抽屉（合并风味评分和总体评分） */}
      <RatingDrawer
        isOpen={showRatingDrawer}
        onClose={() => setShowRatingDrawer(false)}
        rating={formData.rating}
        onRatingChange={updateRating}
        taste={formData.taste}
        onTasteChange={handleTasteChange}
        displayDimensions={displayDimensions}
        halfStep={settings?.flavorRatingHalfStep}
        beanName={getCoffeeBeanDisplayName()}
        showOverallRating={true}
        showFlavorRating={settings?.showFlavorRatingInForm ?? true}
        flavorFollowOverall={settings?.flavorRatingFollowOverall ?? false}
        isAdding={isAdding}
        overallUseSlider={settings?.overallRatingUseSlider ?? false}
      />

      {/* 隐藏的图片选择 input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        className="hidden"
        onChange={handleGalleryUpload}
      />
    </form>
  );
};

export default BrewingNoteForm;
