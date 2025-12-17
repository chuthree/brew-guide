'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';

import { CoffeeBean } from '@/types/app';
import { BrewingNote } from '@/lib/core/config';
import { parseDateToTimestamp } from '@/lib/utils/dateUtils';
import { captureImage } from '@/lib/utils/imageCapture';
import { compressImage } from '@/lib/utils/imageCompression';
import {
  calculateFlavorInfo,
  getDefaultFlavorPeriodByRoastLevelSync,
} from '@/lib/utils/flavorPeriodUtils';
import {
  defaultSettings,
  type SettingsOptions,
} from '@/components/settings/Settings';
import HighlightText from '@/components/common/ui/HighlightText';
import { DatePicker } from '@/components/common/ui/DatePicker';
import { getEquipmentName } from '@/components/notes/utils';
import { formatDate, formatRating } from '@/components/notes/utils';
import ActionMenu from '@/components/coffee-bean/ui/action-menu';
import {
  ArrowRight,
  ChevronLeft,
  Camera,
  Image as ImageIcon,
} from 'lucide-react';
import { BREWING_EVENTS } from '@/lib/brewing/constants';
import { useFlavorDimensions } from '@/lib/hooks/useFlavorDimensions';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import RoasterLogoManager from '@/lib/managers/RoasterLogoManager';
import { extractRoasterFromName } from '@/lib/utils/beanVarietyUtils';
import {
  DEFAULT_ORIGINS,
  DEFAULT_PROCESSES,
  DEFAULT_VARIETIES,
  addCustomPreset,
  getFullPresets,
} from '@/components/coffee-bean/Form/constants';

// 烘焙度选项
const ROAST_LEVELS = [
  '极浅烘焙',
  '浅度烘焙',
  '中浅烘焙',
  '中度烘焙',
  '中深烘焙',
  '深度烘焙',
] as const;

// 咖啡豆类型选项
const BEAN_TYPES = [
  { value: 'filter' as const, label: '手冲' },
  { value: 'espresso' as const, label: '意式' },
  { value: 'omni' as const, label: '全能' },
];

// 小尺寸咖啡豆图片组件（用于关联豆子卡片）
const BeanImageSmall: React.FC<{ bean: CoffeeBean }> = ({ bean }) => {
  const [imageError, setImageError] = useState(false);
  const [roasterLogo, setRoasterLogo] = useState<string | null>(null);

  useEffect(() => {
    const loadRoasterLogo = async () => {
      if (!bean.name || bean.image) {
        setRoasterLogo(null);
        return;
      }

      const roasterName = extractRoasterFromName(bean.name);
      if (roasterName && roasterName !== '未知烘焙商') {
        const logo = await RoasterLogoManager.getLogoByRoaster(roasterName);
        setRoasterLogo(logo);
      } else {
        setRoasterLogo(null);
      }
    };

    loadRoasterLogo();
  }, [bean.name, bean.image]);

  return (
    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xs bg-neutral-200/30 dark:bg-neutral-800/40">
      {bean.image && !imageError ? (
        <Image
          src={bean.image}
          alt={bean.name}
          fill
          className="object-cover"
          onError={() => setImageError(true)}
        />
      ) : roasterLogo && !imageError ? (
        <Image
          src={roasterLogo}
          alt={extractRoasterFromName(bean.name) || '烘焙商图标'}
          fill
          className="object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-neutral-400 dark:text-neutral-600">
          {bean.name ? bean.name.charAt(0) : '豆'}
        </div>
      )}
    </div>
  );
};

// 动态导入 ImageViewer 组件
const ImageViewer = dynamic(
  () => import('@/components/common/ui/ImageViewer'),
  {
    ssr: false,
  }
);

// 动态导入 BeanPrintModal 组件
const BeanPrintModal = dynamic(
  () => import('@/components/coffee-bean/Print/BeanPrintModal'),
  {
    ssr: false,
  }
);

// 动态导入 BeanRatingModal 组件
const BeanRatingModal = dynamic(
  () => import('@/components/coffee-bean/Rating/Modal'),
  {
    ssr: false,
  }
);

// 信息项类型定义
interface InfoItem {
  key: string;
  label: string;
  value: string | React.ReactNode;
  type?: 'normal' | 'status';
  color?: string;
}

// 信息网格组件
const InfoGrid: React.FC<{
  items: InfoItem[];
  className?: string;
  isAddMode?: boolean;
  onItemClick?: (key: string) => void;
}> = ({ items, className = '', isAddMode = false, onItemClick }) => {
  if (items.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {items.map(item => (
        <div
          key={item.key}
          className={`flex items-start ${isAddMode && onItemClick ? 'cursor-pointer' : ''}`}
          onClick={() => isAddMode && onItemClick?.(item.key)}
        >
          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {item.label}
          </div>
          <div
            className={`ml-4 text-xs font-medium ${
              item.type === 'status' && item.color
                ? item.color
                : (isAddMode && item.value === '输入') || item.value === '选择'
                  ? 'text-neutral-400 dark:text-neutral-500'
                  : 'text-neutral-800 dark:text-neutral-100'
            } ${item.key === 'roastDate' ? 'whitespace-pre-line' : ''}`}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
};

interface BeanDetailModalProps {
  isOpen: boolean;
  bean: CoffeeBean | null;
  onClose: () => void;
  searchQuery?: string;
  onEdit?: (bean: CoffeeBean) => void;
  onDelete?: (bean: CoffeeBean) => void;
  onShare?: (bean: CoffeeBean) => void;
  onRate?: (bean: CoffeeBean) => void;
  onRepurchase?: (bean: CoffeeBean) => void;
  /** 去烘焙回调 - 将生豆转换为熟豆 */
  onRoast?: (
    greenBean: CoffeeBean,
    roastedBeanTemplate: Omit<CoffeeBean, 'id' | 'timestamp'>
  ) => void;
  /** 转为生豆回调 - 将熟豆转换为生豆（用于迁移旧数据） */
  onConvertToGreen?: (bean: CoffeeBean) => void;
  /** 模式：view 查看/编辑现有豆子，add 添加新豆子 */
  mode?: 'view' | 'add';
  /** 添加模式下的保存回调 */
  onSaveNew?: (bean: Omit<CoffeeBean, 'id' | 'timestamp'>) => void;
  /** 添加模式下的初始豆子状态 */
  initialBeanState?: 'green' | 'roasted';
}

const BeanDetailModal: React.FC<BeanDetailModalProps> = ({
  isOpen,
  bean: propBean,
  onClose,
  searchQuery = '',
  onEdit,
  onDelete,
  onShare,
  onRate,
  onRepurchase,
  onRoast,
  onConvertToGreen,
  mode = 'view',
  onSaveNew,
  initialBeanState = 'roasted',
}) => {
  // 是否为添加模式
  const isAddMode = mode === 'add';

  // 添加模式下的临时 bean 数据
  const [tempBean, setTempBean] = useState<Partial<CoffeeBean>>(() => ({
    name: '',
    beanState: initialBeanState,
    beanType: 'filter',
    capacity: '',
    remaining: '',
    roastLevel: '',
    roastDate: '',
    purchaseDate: '',
    flavor: [],
    notes: '',
    blendComponents: [{ origin: '', estate: '', process: '', variety: '' }],
  }));

  // 重置临时 bean（当模式或初始状态变化时）
  React.useEffect(() => {
    if (isAddMode && isOpen) {
      setTempBean({
        name: '',
        beanState: initialBeanState,
        beanType: 'filter',
        capacity: '',
        remaining: '',
        roastLevel: '',
        roastDate: '',
        purchaseDate: '',
        flavor: [],
        notes: '',
        blendComponents: [{ origin: '', estate: '', process: '', variety: '' }],
      });
    }
  }, [isAddMode, isOpen, initialBeanState]);

  // 使用 Zustand Store 获取实时更新的咖啡豆数据
  // 性能优化：只在当前咖啡豆的 ID 匹配时订阅，避免不必要的重新渲染
  const storeBean = useCoffeeBeanStore(state => {
    if (!propBean) return null;
    return state.beans.find(b => b.id === propBean.id) || null;
  });

  // 优先使用 Store 中的实时数据，如果 Store 中没有（初始加载时），则使用 props 传入的数据
  // 这样既能保证初始显示，又能实时响应数据变化
  // 在添加模式下，使用临时 bean
  const bean = isAddMode ? (tempBean as CoffeeBean) : storeBean || propBean;

  // 获取所有豆子用于查找关联豆
  const allBeans = useCoffeeBeanStore(state => state.beans);

  // 计算关联豆子（仅熟豆显示来源生豆，生豆的关联熟豆融合进烘焙记录显示）
  const relatedBeans = React.useMemo(() => {
    if (!bean) return [];

    // 熟豆：查找来源生豆
    if (bean.beanState !== 'green' && bean.sourceGreenBeanId) {
      const sourceBean = allBeans.find(b => b.id === bean.sourceGreenBeanId);
      return sourceBean ? [sourceBean] : [];
    }

    return [];
  }, [bean, allBeans]);

  const [imageError, setImageError] = useState(false);
  const [roasterLogo, setRoasterLogo] = useState<string | null>(null);
  const [relatedNotes, setRelatedNotes] = useState<BrewingNote[]>([]);
  const [equipmentNames, setEquipmentNames] = useState<Record<string, string>>(
    {}
  );
  // 图片查看器状态
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState('');
  const [noteImageErrors, setNoteImageErrors] = useState<
    Record<string, boolean>
  >({});

  // 控制滑入动画
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // 打印功能状态
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printEnabled, setPrintEnabled] = useState(false);

  // 评分状态
  const [ratingModalOpen, setRatingModalOpen] = useState(false);

  // 标题可见性状态
  const [isTitleVisible, setIsTitleVisible] = useState(true);

  // 评分显示设置
  const [showBeanRating, setShowBeanRating] = useState(false);
  // 详情页显示设置
  const [showBeanInfoDivider, setShowBeanInfoDivider] = useState(true);

  // 变动记录显示状态
  const [showChangeRecords, setShowChangeRecords] = useState(false);

  // 生豆记录显示状态（仅熟豆有此 Tab）
  const [showGreenBeanRecords, setShowGreenBeanRecords] = useState(false);

  // 容量/价格内联编辑状态
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [editingRemaining, setEditingRemaining] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const capacityInputRef = useRef<HTMLInputElement>(null);
  const remainingInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  // 备注编辑状态
  const notesRef = useRef<HTMLDivElement>(null);

  // 烘焙度下拉状态
  const [showRoastLevelDropdown, setShowRoastLevelDropdown] = useState(false);
  const roastLevelRef = useRef<HTMLDivElement>(null);

  // 成分编辑 refs（产地、庄园、处理法、品种）
  const originRef = useRef<HTMLDivElement>(null);
  const estateRef = useRef<HTMLDivElement>(null);
  const processRef = useRef<HTMLDivElement>(null);
  const varietyRef = useRef<HTMLDivElement>(null);

  // 处理显示/隐藏动画
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // 使用 requestAnimationFrame 确保 DOM 已渲染，比 setTimeout 更快更流畅
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      // 重置打印模态框状态，防止下次打开时直接显示打印界面
      setPrintModalOpen(false);
      // 等待动画完成后再移除DOM，并清理数据
      const timer = setTimeout(() => {
        setShouldRender(false);
        // 动画结束后清空数据，为下次打开做准备
        setRelatedNotes([]);
        setEquipmentNames({});
      }, 350); // 与动画时长匹配
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 当咖啡豆改变时，智能重置记录显示状态
  useEffect(() => {
    if (!bean?.id || !isOpen) return;

    const isGreen = bean.beanState === 'green';

    // 分类记录
    const roastingRecords = relatedNotes.filter(note => isRoastingRecord(note));
    const brewingRecords = relatedNotes.filter(
      note => !isSimpleChangeRecord(note) && !isRoastingRecord(note)
    );
    const changeRecords = relatedNotes.filter(note =>
      isSimpleChangeRecord(note)
    );

    // 根据豆子类型确定主记录
    const primaryRecords = isGreen ? roastingRecords : brewingRecords;

    // 熟豆是否有来源生豆
    const hasSourceGreenBean = !isGreen && relatedBeans.length > 0;

    // 优先选择有内容的 Tab
    // 1. 如果有主记录（冲煮/烘焙），默认显示主记录
    // 2. 如果只有变动记录，显示变动记录
    // 3. 如果熟豆只有来源生豆，显示生豆记录
    if (primaryRecords.length > 0) {
      setShowChangeRecords(false);
      setShowGreenBeanRecords(false);
    } else if (changeRecords.length > 0) {
      setShowChangeRecords(true);
      setShowGreenBeanRecords(false);
    } else if (hasSourceGreenBean) {
      setShowChangeRecords(false);
      setShowGreenBeanRecords(true);
    } else {
      // 都没有，重置为默认状态
      setShowChangeRecords(false);
      setShowGreenBeanRecords(false);
    }
  }, [bean?.id, bean?.beanState, relatedNotes, relatedBeans, isOpen]);

  // 加载打印和显示设置
  useEffect(() => {
    const loadPrintSettings = async () => {
      try {
        const { Storage } = await import('@/lib/core/storage');
        const settingsStr = await Storage.get('brewGuideSettings');
        if (settingsStr) {
          const settings = JSON.parse(settingsStr);
          const printEnabledValue = settings.enableBeanPrint === true;
          const showRatingValue = settings.showBeanRating === true;
          const showInfoDividerValue = settings.showBeanInfoDivider !== false; // 默认true
          setPrintEnabled(printEnabledValue);
          setShowBeanRating(showRatingValue);
          setShowBeanInfoDivider(showInfoDividerValue);
        } else {
          setPrintEnabled(false);
          setShowBeanRating(false);
          setShowBeanInfoDivider(true); // 默认显示
        }
      } catch (error) {
        console.error('加载打印设置失败:', error);
        setPrintEnabled(false);
        setShowBeanRating(false);
        setShowBeanInfoDivider(true); // 默认显示
      }
    };

    loadPrintSettings();
  }, [isOpen]);

  // 使用评分维度hook
  const { getValidTasteRatings } = useFlavorDimensions();

  // 监测标题可见性
  useEffect(() => {
    if (!isOpen || !isVisible) {
      // 重置状态
      setIsTitleVisible(true);
      return;
    }

    let observer: IntersectionObserver | null = null;

    // 延迟一下，确保 DOM 已经渲染
    const timer = setTimeout(() => {
      const titleElement = document.getElementById('bean-detail-title');
      if (!titleElement) {
        return;
      }

      // 立即检查一次初始状态，避免闪烁
      const rect = titleElement.getBoundingClientRect();
      const isVisible = rect.top >= 60; // 顶部栏高度
      setIsTitleVisible(isVisible);

      observer = new IntersectionObserver(
        ([entry]) => {
          setIsTitleVisible(entry.isIntersecting);
        },
        {
          threshold: 0,
          rootMargin: '-60px 0px 0px 0px', // 考虑顶部栏的高度
        }
      );

      observer.observe(titleElement);
    }, 100);

    return () => {
      clearTimeout(timer);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [isOpen, isVisible]);

  // 使用统一的历史栈管理
  useModalHistory({
    id: 'bean-detail',
    isOpen,
    onClose: () => {
      // 先触发子页面的退出动画
      onClose();
      // 延迟通知父页面开始恢复动画，避免两个动画重叠造成闪烁
      // 在子页面动画进行到一半时通知，让动画更流畅衔接
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('beanDetailClosing'));
      }, 175); // 350ms 动画的一半
    },
  });

  // 获取 store 的 refreshBeans 方法
  const refreshBeans = useCoffeeBeanStore(state => state.refreshBeans);

  // 监听咖啡豆数据变化事件，刷新 store 数据以保持详情页同步
  useEffect(() => {
    if (!isOpen) return;

    const handleCoffeeBeanDataChanged = () => {
      // 刷新 store 数据，这样详情页的 storeBean 就会自动更新
      refreshBeans();
    };

    window.addEventListener(
      'coffeeBeanDataChanged',
      handleCoffeeBeanDataChanged as EventListener
    );

    return () => {
      window.removeEventListener(
        'coffeeBeanDataChanged',
        handleCoffeeBeanDataChanged as EventListener
      );
    };
  }, [isOpen, refreshBeans]);

  // 重置图片错误状态
  useEffect(() => {
    if (bean?.image) {
      setImageError(false);
    }
  }, [bean?.image]);

  // 初始化备注值
  useEffect(() => {
    if (bean?.notes && notesRef.current) {
      notesRef.current.textContent = bean.notes;
    }
    // 只在切换咖啡豆时初始化，不依赖 notes 值变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bean?.id]);

  // 初始化成分值（产地、庄园、处理法、品种）- 只在切换咖啡豆时初始化
  useEffect(() => {
    const firstComponent = bean?.blendComponents?.[0];
    if (firstComponent) {
      if (originRef.current && firstComponent.origin) {
        originRef.current.textContent = firstComponent.origin;
      }
      if (estateRef.current && firstComponent.estate) {
        estateRef.current.textContent = firstComponent.estate;
      }
      if (processRef.current && firstComponent.process) {
        processRef.current.textContent = firstComponent.process;
      }
      if (varietyRef.current && firstComponent.variety) {
        varietyRef.current.textContent = firstComponent.variety;
      }
    }
    // 只在切换咖啡豆时初始化，不依赖 blendComponents 值变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bean?.id]);

  // 保存备注的函数
  const handleSaveNotes = async (newNotes: string) => {
    // 添加模式：直接更新临时 bean
    if (isAddMode) {
      setTempBean(prev => ({ ...prev, notes: newNotes.trim() }));
      return;
    }

    if (!bean?.id) return;

    try {
      const { CoffeeBeanManager } = await import(
        '@/lib/managers/coffeeBeanManager'
      );

      // 更新备注
      await CoffeeBeanManager.updateBean(bean.id, {
        notes: newNotes.trim(),
      });

      // 触发数据更新事件
      window.dispatchEvent(
        new CustomEvent('coffeeBeanDataChanged', {
          detail: {
            action: 'update',
            beanId: bean.id,
          },
        })
      );
    } catch (error) {
      console.error('保存备注失败:', error);
    }
  };

  // 通用的字段更新函数
  const handleUpdateField = async (updates: Partial<CoffeeBean>) => {
    // 添加模式：直接更新临时 bean
    if (isAddMode) {
      setTempBean(prev => ({ ...prev, ...updates }));
      return;
    }

    if (!bean?.id) return;

    try {
      const { CoffeeBeanManager } = await import(
        '@/lib/managers/coffeeBeanManager'
      );

      await CoffeeBeanManager.updateBean(bean.id, updates);

      // 触发数据更新事件
      window.dispatchEvent(
        new CustomEvent('coffeeBeanDataChanged', {
          detail: {
            action: 'update',
            beanId: bean.id,
          },
        })
      );
    } catch (error) {
      console.error('更新字段失败:', error);
    }
  };

  // 处理烘焙度选择 - 同时自动设置赏味期
  const handleRoastLevelSelect = async (level: string) => {
    setShowRoastLevelDropdown(false);

    let startDay = 0;
    let endDay = 0;

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
          settings.detailedFlavorPeriod || defaultSettings.detailedFlavorPeriod;
      }

      const { extractRoasterFromName } = await import(
        '@/lib/utils/beanVarietyUtils'
      );
      const beanName = isAddMode ? tempBean.name : bean?.name;
      const roasterName = extractRoasterFromName(beanName || '');

      // 使用工具函数获取烘焙度对应的赏味期设置，传入详细模式参数
      const flavorPeriod = getDefaultFlavorPeriodByRoastLevelSync(
        level,
        customFlavorPeriod,
        roasterName,
        detailedEnabled,
        detailedFlavorPeriod
      );
      startDay = flavorPeriod.startDay;
      endDay = flavorPeriod.endDay;
    } catch (error) {
      console.error('获取自定义赏味期设置失败，使用默认值:', error);
      // 使用工具函数获取默认值（会自动从 localStorage 读取设置）
      const flavorPeriod = getDefaultFlavorPeriodByRoastLevelSync(level);
      startDay = flavorPeriod.startDay;
      endDay = flavorPeriod.endDay;
    }

    handleUpdateField({
      roastLevel: level,
      startDay,
      endDay,
    });
  };

  // 处理容量输入
  const handleCapacityBlur = (value: string) => {
    setEditingCapacity(false);
    if (value) {
      const currentRemaining = isAddMode ? tempBean.remaining : bean?.remaining;
      handleUpdateField({
        capacity: value,
        // 如果没有剩余量，默认等于容量
        remaining: currentRemaining || value,
      });
    }
  };

  // 处理剩余量输入
  const handleRemainingBlur = (value: string) => {
    setEditingRemaining(false);
    if (value) {
      handleUpdateField({ remaining: value });
    }
  };

  // 处理价格输入
  const handlePriceBlur = (value: string) => {
    setEditingPrice(false);
    if (value) {
      handleUpdateField({ price: value });
    }
  };

  // 处理日期选择
  const handleDateChange = (
    date: Date,
    field: 'roastDate' | 'purchaseDate'
  ) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    handleUpdateField({ [field]: formattedDate });
  };

  // 解析日期字符串为Date对象
  const parseDateString = (dateStr: string | undefined): Date | undefined => {
    if (!dateStr) return undefined;
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return undefined;
  };

  // 处理成分编辑（单品豆，只有一个 blendComponent）
  const handleBlendComponentUpdate = (
    field: 'origin' | 'estate' | 'process' | 'variety',
    value: string
  ) => {
    if (!bean?.blendComponents) return;

    // 复制当前 blendComponents
    const updatedComponents = [...bean.blendComponents];

    // 如果没有成分，创建一个新的
    if (updatedComponents.length === 0) {
      updatedComponents.push({ [field]: value });
    } else {
      // 更新第一个成分（单品豆）
      updatedComponents[0] = {
        ...updatedComponents[0],
        [field]: value.trim(),
      };
    }

    handleUpdateField({ blendComponents: updatedComponents });
  };

  // 处理产地编辑
  const handleOriginInput = () => {
    if (originRef.current) {
      const value = originRef.current.textContent || '';
      handleBlendComponentUpdate('origin', value);
    }
  };

  // 处理庄园编辑
  const handleEstateInput = () => {
    if (estateRef.current) {
      const value = estateRef.current.textContent || '';
      handleBlendComponentUpdate('estate', value);
    }
  };

  // 处理处理法编辑
  const handleProcessInput = () => {
    if (processRef.current) {
      const value = processRef.current.textContent || '';
      handleBlendComponentUpdate('process', value);
    }
  };

  // 处理品种编辑
  const handleVarietyInput = () => {
    if (varietyRef.current) {
      const value = varietyRef.current.textContent || '';
      handleBlendComponentUpdate('variety', value);
    }
  };

  // 处理图片选择（添加模式用）
  const handleImageSelect = async (source: 'camera' | 'gallery') => {
    try {
      // 获取图片
      const result = await captureImage({ source });

      // 将 dataUrl 转换为 File 对象
      const response = await fetch(result.dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `image.${result.format}`, {
        type: `image/${result.format}`,
      });

      // 压缩图片
      const compressedFile = await compressImage(file, {
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.8,
        maxSizeMB: 0.3,
      });

      // 转换为 base64
      const reader = new FileReader();
      reader.onload = e => {
        const base64 = e.target?.result as string;
        if (isAddMode) {
          setTempBean(prev => ({ ...prev, image: base64 }));
        } else if (bean) {
          handleUpdateField({ image: base64 });
        }
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('图片选择失败:', error);
      }
    }
  };

  // 点击外部关闭烘焙度下拉
  useEffect(() => {
    if (!showRoastLevelDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        roastLevelRef.current &&
        !roastLevelRef.current.contains(e.target as Node)
      ) {
        setShowRoastLevelDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRoastLevelDropdown]);

  // 处理备注内容变化
  const handleNotesInput = () => {
    if (notesRef.current) {
      const newContent = notesRef.current.textContent || '';
      handleSaveNotes(newContent);
    }
  };

  // 工具函数：格式化数字显示
  const formatNumber = (value: string | undefined): string =>
    !value
      ? '0'
      : Number.isInteger(parseFloat(value))
        ? Math.floor(parseFloat(value)).toString()
        : value;

  // 工具函数：格式化日期显示
  const formatDateString = (dateStr: string): string => {
    try {
      const timestamp = parseDateToTimestamp(dateStr);
      const date = new Date(timestamp);
      const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;

      // 计算已过天数
      const today = new Date();
      const todayDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const roastDateOnly = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );
      const daysSinceRoast = Math.ceil(
        (todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24)
      );

      // 如果是今天或未来日期，不显示天数
      if (daysSinceRoast <= 0) {
        return formattedDate;
      }

      return `${formattedDate} (已养豆 ${daysSinceRoast} 天)`;
    } catch {
      return dateStr;
    }
  };

  // 工具函数：计算赏味期信息
  const getFlavorInfo = () => {
    if (!bean) return { phase: '未知', status: '未知状态' };

    const flavorInfo = calculateFlavorInfo(bean);
    return {
      phase: flavorInfo.phase,
      status: flavorInfo.status || '未知状态',
    };
  };

  // 工具函数：生成基础信息项
  const getBasicInfoItems = (): InfoItem[] => {
    const items: InfoItem[] = [];
    const flavorInfo = getFlavorInfo();
    const currentBean = isAddMode ? tempBean : bean;

    // 容量信息 - 显示为：剩余量/总容量
    if (isAddMode || (currentBean?.capacity && currentBean?.remaining)) {
      const capacity = currentBean?.capacity || '';
      const remaining = currentBean?.remaining || '';
      items.push({
        key: 'inventory',
        label: '容量',
        value:
          capacity && remaining
            ? `${formatNumber(remaining)} / ${formatNumber(capacity)} 克`
            : isAddMode
              ? '输入'
              : '',
        type: 'normal',
      });
    }

    // 价格信息 - 显示为：总价(克价)
    if (isAddMode || (currentBean?.price && currentBean?.capacity)) {
      const totalPrice = currentBean?.price || '';
      const capacityNum = parseFloat(currentBean?.capacity || '0');
      const priceNum = parseFloat(totalPrice);
      const pricePerGram =
        !isNaN(priceNum) && !isNaN(capacityNum) && capacityNum > 0
          ? (priceNum / capacityNum).toFixed(2)
          : '0.00';

      items.push({
        key: 'price',
        label: '价格',
        value: totalPrice
          ? `${totalPrice} 元 (${pricePerGram} 元/克)`
          : isAddMode
            ? '输入'
            : '',
        type: 'normal',
      });
    }

    // 日期显示 - 生豆显示购买日期，熟豆显示烘焙日期/在途状态
    const isGreenBeanType = currentBean?.beanState === 'green';

    if (isGreenBeanType) {
      // 生豆：显示购买日期
      if (isAddMode || currentBean?.purchaseDate) {
        items.push({
          key: 'purchaseDate',
          label: '购买日期',
          value: currentBean?.purchaseDate
            ? formatDateString(currentBean.purchaseDate)
            : isAddMode
              ? '点击选择'
              : '',
          type: 'normal',
        });
      }
    } else {
      // 熟豆：显示烘焙日期或在途状态
      if (currentBean?.isInTransit) {
        items.push({
          key: 'roastDate',
          label: '状态',
          value: '在途',
          type: 'normal',
        });
      } else if (isAddMode || currentBean?.roastDate) {
        items.push({
          key: 'roastDate',
          label: '烘焙日期',
          value: currentBean?.roastDate
            ? formatDateString(currentBean.roastDate)
            : isAddMode
              ? '点击选择'
              : '',
          type: 'normal',
        });
      }
    }

    // 赏味期/状态 - 仅对熟豆显示（非添加模式）
    if (!isGreenBeanType && !isAddMode) {
      if (currentBean?.isFrozen) {
        items.push({
          key: 'flavor',
          label: '状态',
          value: '冷冻',
          type: 'normal',
        });
      } else if (currentBean?.roastDate && !currentBean?.isInTransit) {
        items.push({
          key: 'flavor',
          label: '赏味期',
          value: flavorInfo.status,
          type: 'normal',
        });
      }
    }

    return items;
  };

  // 工具函数：创建信息项
  const createInfoItem = (
    key: string,
    label: string,
    blendField: 'origin' | 'estate' | 'process' | 'variety',
    enableHighlight = false
  ): InfoItem | null => {
    if (!bean?.blendComponents) return null;

    // 从所有组件中提取并去重字段值
    const values = Array.from(
      new Set(
        bean.blendComponents
          .map(comp => comp[blendField])
          .filter(
            (value): value is string =>
              typeof value === 'string' && value.trim() !== ''
          )
      )
    );

    if (values.length === 0) return null;

    const text = values.join(', ');
    return {
      key,
      label,
      value:
        enableHighlight && searchQuery ? (
          <HighlightText text={text} highlight={searchQuery} />
        ) : (
          text
        ),
    };
  };

  // 工具函数：生成产地信息项
  const getOriginInfoItems = (): InfoItem[] => {
    const items: InfoItem[] = [];

    // 使用 createInfoItem 函数，避免重复逻辑
    const originItem = createInfoItem('origin', '产地', 'origin', true);
    if (originItem) items.push(originItem);

    const estateItem = createInfoItem('estate', '庄园', 'estate');
    if (estateItem) items.push(estateItem);

    const processItem = createInfoItem('process', '处理法', 'process');
    if (processItem) items.push(processItem);

    const varietyItem = createInfoItem('variety', '品种', 'variety');
    if (varietyItem) items.push(varietyItem);

    // 烘焙度
    if (bean?.roastLevel) {
      items.push({
        key: 'roastLevel',
        label: '烘焙度',
        value: bean.roastLevel,
      });
    }

    return items;
  };

  // 判断是否为简单的变动记录（快捷扣除或容量调整）
  const isSimpleChangeRecord = (note: BrewingNote): boolean => {
    // 只依据 source 字段判断是否为变动记录
    // 不再限制备注内容，允许用户自由修改备注
    return (
      note.source === 'quick-decrement' || note.source === 'capacity-adjustment'
    );
  };

  // 判断是否为烘焙记录
  const isRoastingRecord = (note: BrewingNote): boolean => {
    return note.source === 'roasting';
  };

  // 判断当前豆子是否为生豆
  const isGreenBean = bean?.beanState === 'green';

  // 加载烘焙商logo
  useEffect(() => {
    const loadRoasterLogo = async () => {
      if (!bean?.name || bean?.image) {
        // 如果咖啡豆有自己的图片，不需要加载烘焙商图标
        setRoasterLogo(null);
        return;
      }

      const roasterName = extractRoasterFromName(bean.name);
      if (roasterName && roasterName !== '未知烘焙商') {
        const logo = await RoasterLogoManager.getLogoByRoaster(roasterName);
        setRoasterLogo(logo);
      } else {
        setRoasterLogo(null);
      }
    };

    loadRoasterLogo();
  }, [bean?.name, bean?.image]);

  // 获取相关的冲煮记录
  useEffect(() => {
    const loadRelatedNotes = async () => {
      // 只在打开时加载数据，关闭时保持数据（让数据保持到动画结束）
      if (!bean?.id || !isOpen) {
        return;
      }

      try {
        const { Storage } = await import('@/lib/core/storage');
        const notesStr = await Storage.get('brewingNotes');
        if (!notesStr) {
          setRelatedNotes([]);
          return;
        }

        const allNotes: BrewingNote[] = JSON.parse(notesStr);

        // 过滤出与当前咖啡豆相关的记录
        // 严格按 beanId 匹配，避免同名豆子的笔记混淆问题
        const beanNotes = allNotes.filter(note => {
          return note.beanId === bean.id;
        });

        // 按时间倒序排列，显示所有记录
        const sortedNotes = beanNotes.sort((a, b) => b.timestamp - a.timestamp);

        // 获取所有设备的名称
        const equipmentIds = Array.from(
          new Set(
            sortedNotes
              .map(note => note.equipment)
              .filter((equipment): equipment is string => !!equipment)
          )
        );

        const namesMap: Record<string, string> = {};
        await Promise.all(
          equipmentIds.map(async equipmentId => {
            try {
              const name = await getEquipmentName(equipmentId);
              namesMap[equipmentId] = name;
            } catch (error) {
              console.error(`获取设备名称失败: ${equipmentId}`, error);
              namesMap[equipmentId] = equipmentId;
            }
          })
        );

        setEquipmentNames(namesMap);
        setRelatedNotes(sortedNotes);
      } catch (error) {
        console.error('加载冲煮记录失败:', error);
        setRelatedNotes([]);
      }
    };

    loadRelatedNotes();
  }, [bean?.id, bean?.name, isOpen]);

  // 处理关闭 - 使用统一的历史栈管理器
  const handleClose = () => {
    // 事件通知已移到 beforeClose 中，确保无论是 UI 返回还是浏览器返回都能触发
    modalHistory.back();
  };

  // 处理去冲煮功能
  const handleGoToBrewing = () => {
    handleClose();
    // 等待模态框关闭后再进行导航
    setTimeout(() => {
      // 先切换到冲煮标签页
      document.dispatchEvent(
        new CustomEvent(BREWING_EVENTS.NAVIGATE_TO_MAIN_TAB, {
          detail: { tab: '冲煮' },
        })
      );

      // 再切换到咖啡豆步骤
      setTimeout(() => {
        document.dispatchEvent(
          new CustomEvent(BREWING_EVENTS.NAVIGATE_TO_STEP, {
            detail: { step: 'coffeeBean' },
          })
        );

        // 然后选择当前豆子
        if (bean) {
          setTimeout(() => {
            document.dispatchEvent(
              new CustomEvent(BREWING_EVENTS.SELECT_COFFEE_BEAN, {
                detail: { beanName: bean.name },
              })
            );
          }, 100);
        }
      }, 100);
    }, 300);
  };

  // 处理去记录功能
  const handleGoToNotes = () => {
    handleClose();
    // 保存当前咖啡豆信息，以便笔记页面使用
    if (bean) {
      localStorage.setItem(
        'temp:selectedBean',
        JSON.stringify({
          id: bean.id,
          name: bean.name,
          roastLevel: bean.roastLevel || '',
          roastDate: bean.roastDate || '',
        })
      );
    }

    // 等待模态框关闭后再进行导航
    setTimeout(() => {
      // 先切换到笔记标签页
      document.dispatchEvent(
        new CustomEvent(BREWING_EVENTS.NAVIGATE_TO_MAIN_TAB, {
          detail: { tab: '笔记' },
        })
      );

      // 延迟一段时间后触发创建新笔记事件
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('addNewBrewingNote'));
      }, 300);
    }, 300);
  };

  // 处理去烘焙功能 - 将生豆转换为熟豆
  const handleGoToRoast = () => {
    if (!bean || !onRoast) return;

    // 获取当前日期作为烘焙日期
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 格式

    // 创建熟豆模板，基于生豆信息但：
    // 1. 剩余量为空（用户需要填写烘焙后的重量）
    // 2. 烘焙日期为今天
    // 3. beanState 设为熟豆
    // 4. 保留生豆ID用于追溯
    const roastedBeanTemplate: Omit<CoffeeBean, 'id' | 'timestamp'> = {
      name: bean.name,
      beanState: 'roasted',
      beanType: bean.beanType,
      capacity: '', // 用户需要填写
      remaining: '', // 用户需要填写
      image: bean.image,
      roastLevel: bean.roastLevel,
      roastDate: today,
      flavor: bean.flavor,
      notes: bean.notes,
      brand: bean.brand,
      price: '', // 熟豆价格由用户填写
      blendComponents: bean.blendComponents,
      sourceGreenBeanId: bean.id, // 追溯生豆来源
    };

    // 调用父组件的回调，传递生豆和熟豆模板
    onRoast(bean, roastedBeanTemplate);
  };

  // 处理打印功能
  const handlePrint = () => {
    setPrintModalOpen(true);
  };

  // 只在需要时渲染DOM
  if (!shouldRender) return null;

  return (
    <>
      <div
        className="fixed inset-0 mx-auto flex max-w-[500px] flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-900"
        style={getChildPageStyle(isVisible)}
      >
        {/* 顶部按钮栏 */}
        <div className="pt-safe-top sticky top-0 flex items-center gap-3 bg-neutral-50 p-4 dark:bg-neutral-900">
          {/* 左侧关闭按钮 */}
          <button
            onClick={handleClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
          >
            <ChevronLeft className="-ml-px h-4.5 w-4.5 text-neutral-600 dark:text-neutral-400" />
          </button>

          {/* 居中标题 - 当原标题不可见时显示，占据剩余空间 */}
          <div
            className={`flex min-w-0 flex-1 justify-center transition-all duration-300 ${
              isTitleVisible
                ? 'pointer-events-none opacity-0 blur-xs'
                : 'blur-0 opacity-100'
            }`}
            style={{
              transitionProperty: 'opacity, filter, transform',
              transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
              willChange: 'opacity, filter, transform',
            }}
          >
            <h2 className="max-w-full truncate px-2 text-center text-sm font-medium text-neutral-800 dark:text-neutral-100">
              {isAddMode
                ? tempBean.name || '添加咖啡豆'
                : bean?.name || '未命名'}
            </h2>
          </div>

          {/* 右侧操作按钮 */}
          <div className="flex shrink-0 items-center gap-3">
            {/* 添加模式：显示保存按钮 */}
            {isAddMode &&
              (() => {
                const canSave = !!tempBean.name?.trim();
                return (
                  <button
                    onClick={() => {
                      // 验证必填字段
                      if (!canSave) {
                        return;
                      }

                      // 保存自定义的预设值
                      const components = tempBean.blendComponents || [];

                      components.forEach(component => {
                        // 检查产地是否是自定义值
                        if (component.origin) {
                          if (!DEFAULT_ORIGINS.includes(component.origin)) {
                            addCustomPreset('origins', component.origin);
                          }
                        }
                        // 检查处理法是否是自定义值
                        if (component.process) {
                          if (!DEFAULT_PROCESSES.includes(component.process)) {
                            addCustomPreset('processes', component.process);
                          }
                        }
                        // 检查品种是否是自定义值
                        if (component.variety) {
                          if (!DEFAULT_VARIETIES.includes(component.variety)) {
                            addCustomPreset('varieties', component.variety);
                          }
                        }
                      });

                      // 调用保存回调
                      onSaveNew?.(
                        tempBean as Omit<CoffeeBean, 'id' | 'timestamp'>
                      );
                      handleClose();
                    }}
                    disabled={!canSave}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      canSave
                        ? 'text-neutral-800 dark:text-neutral-100'
                        : 'cursor-not-allowed text-neutral-300 dark:text-neutral-600'
                    }`}
                  >
                    保存
                  </button>
                );
              })()}

            {/* 查看模式：生豆显示"去烘焙"按钮 */}
            {!isAddMode && bean && isGreenBean && onRoast && (
              <button
                onClick={handleGoToRoast}
                className="flex h-8 items-center justify-center rounded-full bg-neutral-100 px-3 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
              >
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  去烘焙
                </span>
              </button>
            )}

            {/* 查看模式：熟豆通过菜单显示"去冲煮/去记录" */}
            {!isAddMode && bean && !isGreenBean && (
              <ActionMenu
                items={[
                  {
                    id: 'brewing',
                    label: '去冲煮',
                    onClick: handleGoToBrewing,
                    color: 'default' as const,
                  },
                  {
                    id: 'notes',
                    label: '去记录',
                    onClick: handleGoToNotes,
                    color: 'default' as const,
                  },
                ]}
                useMorphingAnimation={true}
                triggerClassName="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                triggerChildren={
                  <ArrowRight className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                }
              />
            )}

            {/* 查看模式：原有的操作按钮 */}
            {!isAddMode &&
              bean &&
              (onEdit ||
                onShare ||
                onDelete ||
                printEnabled ||
                onConvertToGreen) && (
                <ActionMenu
                  items={[
                    ...(onDelete
                      ? [
                          {
                            id: 'delete',
                            label: '删除',
                            onClick: () => {
                              onDelete(bean);
                              handleClose();
                            },
                            color: 'danger' as const,
                          },
                        ]
                      : []),
                    // 转为生豆选项 - 仅对没有来源生豆ID的熟豆显示
                    ...(!isGreenBean &&
                    !bean.sourceGreenBeanId &&
                    onConvertToGreen
                      ? [
                          {
                            id: 'convertToGreen',
                            label: '转为生豆',
                            onClick: () => {
                              onConvertToGreen(bean);
                            },
                            color: 'default' as const,
                          },
                        ]
                      : []),
                    ...(printEnabled
                      ? [
                          {
                            id: 'print',
                            label: '打印',
                            onClick: handlePrint,
                            color: 'default' as const,
                          },
                        ]
                      : []),
                    // 统一分享按钮 - 触发事件退出到列表并进入分享模式
                    ...(onShare
                      ? [
                          {
                            id: 'share',
                            label: '分享',
                            onClick: () => {
                              // 关闭详情页
                              handleClose();
                              // 触发分享事件，传递当前咖啡豆 ID
                              setTimeout(() => {
                                window.dispatchEvent(
                                  new CustomEvent('beanShareTriggered', {
                                    detail: { beanId: bean.id },
                                  })
                                );
                              }, 300); // 等待详情页关闭动画
                            },
                            color: 'default' as const,
                          },
                        ]
                      : []),
                    ...(onEdit
                      ? [
                          {
                            id: 'edit',
                            label: '编辑',
                            onClick: () => {
                              onEdit(bean);
                              // 不再关闭详情页，让编辑表单叠加在上面
                            },
                            color: 'default' as const,
                          },
                        ]
                      : []),
                  ].filter(item => item)} // 过滤空项
                  useMorphingAnimation={true}
                  triggerClassName="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                />
              )}
          </div>
        </div>

        {/* 内容区域 */}
        <div
          className="pb-safe-bottom flex-1 overflow-auto"
          style={{
            // 正常情况下允许垂直滚动
            overflowY: 'auto',
            // 使用 CSS 来处理触摸行为
            touchAction: 'pan-y pinch-zoom',
          }}
        >
          {/* 图片区域 - 添加模式或有图片时显示 */}
          {(isAddMode || ((bean?.image || roasterLogo) && !imageError)) && (
            <div className="mb-4">
              <div className="flex cursor-pointer items-end justify-center gap-3 bg-neutral-200/30 px-6 py-3 dark:bg-neutral-800/40">
                {/* 有图片时显示图片 */}
                {(isAddMode ? tempBean.image : bean?.image) && !imageError ? (
                  <div className="relative h-32 overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                    <Image
                      src={(isAddMode ? tempBean.image : bean?.image) || ''}
                      alt={
                        (isAddMode ? tempBean.name : bean?.name) || '咖啡豆图片'
                      }
                      height={192}
                      width={192}
                      className="h-full w-auto object-cover"
                      onError={() => setImageError(true)}
                      onClick={() => {
                        if (!imageError) {
                          const imgUrl = isAddMode
                            ? tempBean.image
                            : bean?.image;
                          if (imgUrl) {
                            setCurrentImageUrl(imgUrl);
                            setImageViewerOpen(true);
                          }
                        }
                      }}
                    />
                    {/* 添加模式下显示删除按钮 */}
                    {isAddMode && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setTempBean(prev => ({ ...prev, image: undefined }));
                        }}
                        className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-800/80 text-white transition-colors hover:bg-red-500"
                      >
                        <span className="text-xs">×</span>
                      </button>
                    )}
                  </div>
                ) : roasterLogo && !imageError && !isAddMode ? (
                  <div className="relative h-32 overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                    <Image
                      src={roasterLogo}
                      alt={
                        extractRoasterFromName(bean?.name || '') || '烘焙商图标'
                      }
                      height={192}
                      width={192}
                      className="h-full w-auto object-cover"
                      onError={() => setImageError(true)}
                      onClick={() => {
                        setCurrentImageUrl(roasterLogo);
                        setImageViewerOpen(true);
                      }}
                    />
                  </div>
                ) : isAddMode ? (
                  /* 添加模式下无图片时显示两个添加按钮 - 底部对齐，相册大拍照小 */
                  <>
                    {/* 拍照盒子 - 小 */}
                    <div className="relative h-20 shrink-0 overflow-hidden bg-neutral-200/50 dark:bg-neutral-800">
                      <button
                        type="button"
                        onClick={() => handleImageSelect('camera')}
                        className="flex h-full w-20 items-center justify-center transition-colors hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80"
                        title="拍照"
                      >
                        <Camera className="h-5 w-5 text-neutral-300 dark:text-neutral-600" />
                      </button>
                    </div>
                    {/* 相册盒子 - 大 */}
                    <div className="relative h-32 overflow-hidden bg-neutral-200/50 dark:bg-neutral-800">
                      <button
                        type="button"
                        onClick={() => handleImageSelect('gallery')}
                        className="flex h-full w-32 items-center justify-center transition-colors hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80"
                        title="相册"
                      >
                        <ImageIcon className="h-6 w-6 text-neutral-300 dark:text-neutral-600" />
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}

          {/* 标题区域 */}
          <div className="mb-4 px-6">
            {isAddMode ? (
              <input
                type="text"
                value={tempBean.name || ''}
                onChange={e => {
                  const newName = e.target.value;
                  setTempBean(prev => {
                    const updated = { ...prev, name: newName };

                    // 从名称中智能提取产地、处理法、品种并自动填充到成分
                    // 使用 getFullPresets 获取完整列表（包括用户保存的自定义预设）
                    if (newName.trim()) {
                      const allOrigins = getFullPresets('origins');
                      const allProcesses = getFullPresets('processes');
                      const allVarieties = getFullPresets('varieties');

                      const extractedOrigin = allOrigins.find(origin =>
                        newName.includes(origin)
                      );
                      const extractedProcess = allProcesses.find(process =>
                        newName.includes(process)
                      );
                      const extractedVariety = allVarieties.find(variety =>
                        newName.includes(variety)
                      );

                      // 只有当提取到信息且对应字段为空时才自动填充
                      if (
                        extractedOrigin ||
                        extractedProcess ||
                        extractedVariety
                      ) {
                        const currentComponents = prev.blendComponents || [
                          { origin: '', estate: '', process: '', variety: '' },
                        ];
                        const newComponents = [...currentComponents];
                        if (newComponents.length > 0) {
                          // 只在字段为空时填充，避免覆盖用户手动输入的内容
                          if (extractedOrigin && !newComponents[0].origin) {
                            newComponents[0] = {
                              ...newComponents[0],
                              origin: extractedOrigin,
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
                          updated.blendComponents = newComponents;
                        }
                      }
                    }

                    return updated;
                  });
                }}
                placeholder="输入咖啡豆名称"
                className="w-full border-b border-dashed border-neutral-300 bg-transparent pb-1 text-sm font-medium text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-neutral-600 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400"
              />
            ) : (
              <h2
                id="bean-detail-title"
                className="text-sm font-medium text-neutral-800 dark:text-neutral-100"
              >
                {searchQuery ? (
                  <HighlightText
                    text={bean?.name || '未命名'}
                    highlight={searchQuery}
                  />
                ) : (
                  bean?.name || '未命名'
                )}
              </h2>
            )}
          </div>

          {bean || isAddMode ? (
            <div className="space-y-3 px-6">
              {/* 咖啡豆信息 */}
              <div className="space-y-3">
                {/* 基础信息 - 使用内联编辑 */}
                {(() => {
                  const currentBean = isAddMode ? tempBean : bean;
                  const capacity = currentBean?.capacity || '';
                  const remaining = currentBean?.remaining || '';
                  const price = currentBean?.price || '';
                  const isGreenBeanType = currentBean?.beanState === 'green';
                  const dateValue = isGreenBeanType
                    ? currentBean?.purchaseDate
                    : currentBean?.roastDate;
                  const dateLabel = isGreenBeanType ? '购买日期' : '烘焙日期';
                  const dateField = isGreenBeanType
                    ? 'purchaseDate'
                    : 'roastDate';

                  // 计算克价
                  const capacityNum = parseFloat(capacity || '0');
                  const priceNum = parseFloat(price);
                  const pricePerGram =
                    !isNaN(priceNum) && !isNaN(capacityNum) && capacityNum > 0
                      ? (priceNum / capacityNum).toFixed(2)
                      : '';

                  // 计算赏味期信息（仅熟豆）
                  // 为添加模式创建临时的 CoffeeBean 结构以计算赏味期
                  const tempBeanForFlavor: CoffeeBean | null =
                    !isGreenBeanType &&
                    currentBean?.roastDate &&
                    !currentBean?.isInTransit &&
                    !currentBean?.isFrozen
                      ? {
                          id: currentBean.id || 'temp',
                          name: currentBean.name || '',
                          roastDate: currentBean.roastDate,
                          roastLevel: currentBean.roastLevel || '',
                          capacity: currentBean.capacity || '0',
                          remaining: currentBean.remaining || '0',
                          timestamp: Date.now(),
                          startDay: currentBean.startDay,
                          endDay: currentBean.endDay,
                        }
                      : null;
                  const flavorInfo = tempBeanForFlavor
                    ? calculateFlavorInfo(tempBeanForFlavor)
                    : null;

                  // 计算已养豆天数
                  const getDaysSinceRoast = (
                    dateStr: string | undefined
                  ): number => {
                    if (!dateStr) return 0;
                    try {
                      const today = new Date();
                      const roastDate = new Date(dateStr);
                      const todayDate = new Date(
                        today.getFullYear(),
                        today.getMonth(),
                        today.getDate()
                      );
                      const roastDateOnly = new Date(
                        roastDate.getFullYear(),
                        roastDate.getMonth(),
                        roastDate.getDate()
                      );
                      return Math.ceil(
                        (todayDate.getTime() - roastDateOnly.getTime()) /
                          (1000 * 60 * 60 * 24)
                      );
                    } catch {
                      return 0;
                    }
                  };
                  const daysSinceRoast = !isGreenBeanType
                    ? getDaysSinceRoast(currentBean?.roastDate)
                    : 0;

                  const hasContent =
                    capacity || price || dateValue || currentBean?.isInTransit;
                  if (!isAddMode && !hasContent) return null;

                  return (
                    <div className="space-y-3">
                      {/* 容量 */}
                      {(isAddMode || (capacity && remaining)) && (
                        <div className="flex items-start">
                          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                            容量
                          </div>
                          <div className="ml-4 flex items-center gap-1 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                            {isAddMode && editingCapacity ? (
                              <input
                                ref={capacityInputRef}
                                type="number"
                                inputMode="decimal"
                                autoFocus
                                defaultValue={capacity}
                                placeholder="总容量"
                                className="w-16 border-b border-neutral-400 bg-transparent outline-none dark:border-neutral-500"
                                onBlur={e => handleCapacityBlur(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    handleCapacityBlur(
                                      (e.target as HTMLInputElement).value
                                    );
                                  }
                                }}
                              />
                            ) : isAddMode && editingRemaining ? (
                              <>
                                <input
                                  ref={remainingInputRef}
                                  type="number"
                                  inputMode="decimal"
                                  autoFocus
                                  defaultValue={remaining}
                                  placeholder="剩余量"
                                  className="w-16 border-b border-neutral-400 bg-transparent outline-none dark:border-neutral-500"
                                  onBlur={e =>
                                    handleRemainingBlur(e.target.value)
                                  }
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      handleRemainingBlur(
                                        (e.target as HTMLInputElement).value
                                      );
                                    }
                                  }}
                                />
                                <span>/ {formatNumber(capacity)} 克</span>
                              </>
                            ) : capacity ? (
                              isAddMode ? (
                                // 添加模式：剩余量和容量分别可点击编辑
                                <>
                                  <span
                                    className="cursor-text"
                                    onClick={() => setEditingRemaining(true)}
                                  >
                                    {formatNumber(remaining) ||
                                      formatNumber(capacity)}
                                  </span>
                                  <span> / </span>
                                  <span
                                    className="cursor-text"
                                    onClick={() => setEditingCapacity(true)}
                                  >
                                    {formatNumber(capacity)}
                                  </span>
                                  <span> 克</span>
                                </>
                              ) : (
                                // 非添加模式：纯展示
                                <span>
                                  {formatNumber(remaining) ||
                                    formatNumber(capacity)}{' '}
                                  / {formatNumber(capacity)} 克
                                </span>
                              )
                            ) : isAddMode ? (
                              <span
                                className="cursor-text text-neutral-400 dark:text-neutral-500"
                                onClick={() => setEditingCapacity(true)}
                              >
                                输入总容量
                              </span>
                            ) : null}
                          </div>
                        </div>
                      )}

                      {/* 价格 */}
                      {(isAddMode || price) && (
                        <div className="flex items-start">
                          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                            价格
                          </div>
                          <div className="ml-4 flex items-center gap-1 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                            {isAddMode && editingPrice ? (
                              <>
                                <input
                                  ref={priceInputRef}
                                  type="number"
                                  inputMode="decimal"
                                  autoFocus
                                  defaultValue={price}
                                  placeholder="价格"
                                  className="w-16 border-b border-neutral-400 bg-transparent outline-none dark:border-neutral-500"
                                  onBlur={e => handlePriceBlur(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      handlePriceBlur(
                                        (e.target as HTMLInputElement).value
                                      );
                                    }
                                  }}
                                />
                                <span>元</span>
                              </>
                            ) : price ? (
                              isAddMode ? (
                                // 添加模式：点击可编辑
                                <span
                                  className="cursor-text"
                                  onClick={() => setEditingPrice(true)}
                                >
                                  {price} 元
                                  {pricePerGram
                                    ? ` (${pricePerGram} 元/克)`
                                    : ''}
                                </span>
                              ) : (
                                // 非添加模式：纯展示
                                <span>
                                  {price} 元
                                  {pricePerGram
                                    ? ` (${pricePerGram} 元/克)`
                                    : ''}
                                </span>
                              )
                            ) : isAddMode ? (
                              <span
                                className="cursor-text text-neutral-400 dark:text-neutral-500"
                                onClick={() => setEditingPrice(true)}
                              >
                                输入价格
                              </span>
                            ) : null}
                          </div>
                        </div>
                      )}

                      {/* 日期 */}
                      {(isAddMode || dateValue || currentBean?.isInTransit) && (
                        <div className="flex items-center">
                          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                            {!isAddMode && currentBean?.isInTransit
                              ? '状态'
                              : dateLabel}
                          </div>
                          <div className="ml-4 flex items-center gap-2 text-xs font-medium">
                            {!isAddMode && currentBean?.isInTransit ? (
                              <span className="whitespace-nowrap text-neutral-800 dark:text-neutral-100">
                                在途
                              </span>
                            ) : isAddMode && bean?.isInTransit ? (
                              <span
                                onClick={() =>
                                  handleUpdateField({ isInTransit: false })
                                }
                                className="cursor-pointer bg-neutral-100 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                              >
                                在途
                              </span>
                            ) : (
                              // 添加模式未选择在途 或 非添加模式
                              <>
                                {dateValue ? (
                                  isAddMode ? (
                                    <DatePicker
                                      date={parseDateString(dateValue)}
                                      onDateChange={date =>
                                        handleDateChange(
                                          date,
                                          dateField as
                                            | 'roastDate'
                                            | 'purchaseDate'
                                        )
                                      }
                                      placeholder={`选择${dateLabel}`}
                                      className="[&_button]:border-0 [&_button]:py-0 [&_button]:text-xs [&_button]:font-medium"
                                      displayFormat="yyyy-MM-dd"
                                    />
                                  ) : (
                                    <span className="whitespace-nowrap text-neutral-800 dark:text-neutral-100">
                                      {formatDateString(dateValue)}
                                    </span>
                                  )
                                ) : (
                                  <DatePicker
                                    date={parseDateString(dateValue)}
                                    onDateChange={date =>
                                      handleDateChange(
                                        date,
                                        dateField as
                                          | 'roastDate'
                                          | 'purchaseDate'
                                      )
                                    }
                                    placeholder={`选择${dateLabel}`}
                                    className="[&_button]:border-0 [&_button]:py-0 [&_button]:text-xs [&_button]:font-medium"
                                  />
                                )}
                                {/* 添加模式：在途状态选项 */}
                                {isAddMode && (
                                  <>
                                    <div className="mx-1 h-3 w-px bg-neutral-200 dark:bg-neutral-700" />
                                    <span
                                      onClick={() =>
                                        handleUpdateField({ isInTransit: true })
                                      }
                                      className="cursor-pointer bg-neutral-100/50 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-neutral-400 dark:bg-neutral-800/50 dark:text-neutral-500"
                                    >
                                      在途
                                    </span>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 赏味期（仅熟豆且有烘焙日期时显示，添加模式下不显示因为下面有设置） */}
                      {!isGreenBeanType && flavorInfo && !isAddMode && (
                        <div className="flex items-start">
                          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                            赏味期
                          </div>
                          <div className="ml-4 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                            {flavorInfo.status}
                          </div>
                        </div>
                      )}

                      {/* 冷冻状态（非添加模式下，冷冻时显示） */}
                      {!isAddMode && bean?.isFrozen && (
                        <div className="flex items-start">
                          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                            状态
                          </div>
                          <div className="ml-4 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                            冷冻
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 虚线分割线 - 开启设置后始终显示 */}
                {showBeanInfoDivider && (
                  <div className="border-t border-dashed border-neutral-200/70 dark:border-neutral-800/70"></div>
                )}

                {/* 产地信息（单品豆时显示）- 支持无感编辑 */}
                {(() => {
                  const isMultipleBlend =
                    bean?.blendComponents && bean.blendComponents.length > 1;
                  const firstComponent = bean?.blendComponents?.[0];

                  // 单品豆且有成分信息时显示可编辑区域
                  if (isMultipleBlend && !isAddMode) return null;

                  // 获取当前值
                  const origin = firstComponent?.origin || '';
                  const estate = firstComponent?.estate || '';
                  const process = firstComponent?.process || '';
                  const variety = firstComponent?.variety || '';
                  const roastLevel = bean?.roastLevel || '';

                  // 查看模式下至少有一个字段有值才显示；添加模式下总是显示
                  if (
                    !isAddMode &&
                    !origin &&
                    !estate &&
                    !process &&
                    !variety &&
                    !roastLevel
                  )
                    return null;

                  return (
                    <div className="space-y-3">
                      {/* 咖啡豆类型 - 添加模式下显示 */}
                      {isAddMode && (
                        <div className="flex items-start">
                          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                            类型
                          </div>
                          <div className="ml-4 flex items-center gap-2">
                            {BEAN_TYPES.map(type => (
                              <span
                                key={type.value}
                                onClick={() =>
                                  handleUpdateField({ beanType: type.value })
                                }
                                className={`cursor-pointer px-1.5 py-0.5 text-xs font-medium ${
                                  bean?.beanType === type.value
                                    ? 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                                    : 'bg-neutral-100/70 text-neutral-400 dark:bg-neutral-800/70 dark:text-neutral-500'
                                }`}
                              >
                                {type.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 产地 */}
                      {(isAddMode || origin) && (
                        <div className="flex items-start">
                          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                            产地
                          </div>
                          <div className="relative ml-4 flex-1">
                            {isAddMode && !origin && (
                              <span
                                className="pointer-events-none absolute top-0 left-0 text-xs font-medium text-neutral-400 dark:text-neutral-500"
                                data-placeholder="origin"
                              >
                                输入产地
                              </span>
                            )}
                            <div
                              ref={originRef}
                              contentEditable
                              suppressContentEditableWarning
                              onInput={e => {
                                const placeholder =
                                  e.currentTarget.parentElement?.querySelector(
                                    '[data-placeholder="origin"]'
                                  ) as HTMLElement;
                                if (placeholder) {
                                  placeholder.style.display = e.currentTarget
                                    .textContent
                                    ? 'none'
                                    : '';
                                }
                              }}
                              onBlur={handleOriginInput}
                              className="cursor-text text-xs font-medium text-neutral-800 outline-none dark:text-neutral-100"
                              style={{ minHeight: '1.25em' }}
                            >
                              {searchQuery ? (
                                <HighlightText
                                  text={origin}
                                  highlight={searchQuery}
                                />
                              ) : (
                                origin
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 庄园 */}
                      {(isAddMode || estate) && (
                        <div className="flex items-start">
                          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                            庄园
                          </div>
                          <div className="relative ml-4 flex-1">
                            {isAddMode && !estate && (
                              <span
                                className="pointer-events-none absolute top-0 left-0 text-xs font-medium text-neutral-400 dark:text-neutral-500"
                                data-placeholder="estate"
                              >
                                输入庄园
                              </span>
                            )}
                            <div
                              ref={estateRef}
                              contentEditable
                              suppressContentEditableWarning
                              onInput={e => {
                                const placeholder =
                                  e.currentTarget.parentElement?.querySelector(
                                    '[data-placeholder="estate"]'
                                  ) as HTMLElement;
                                if (placeholder) {
                                  placeholder.style.display = e.currentTarget
                                    .textContent
                                    ? 'none'
                                    : '';
                                }
                              }}
                              onBlur={handleEstateInput}
                              className="cursor-text text-xs font-medium text-neutral-800 outline-none dark:text-neutral-100"
                              style={{ minHeight: '1.25em' }}
                            >
                              {estate}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 处理法 */}
                      {(isAddMode || process) && (
                        <div className="flex items-start">
                          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                            处理法
                          </div>
                          <div className="relative ml-4 flex-1">
                            {isAddMode && !process && (
                              <span
                                className="pointer-events-none absolute top-0 left-0 text-xs font-medium text-neutral-400 dark:text-neutral-500"
                                data-placeholder="process"
                              >
                                输入处理法
                              </span>
                            )}
                            <div
                              ref={processRef}
                              contentEditable
                              suppressContentEditableWarning
                              onInput={e => {
                                const placeholder =
                                  e.currentTarget.parentElement?.querySelector(
                                    '[data-placeholder="process"]'
                                  ) as HTMLElement;
                                if (placeholder) {
                                  placeholder.style.display = e.currentTarget
                                    .textContent
                                    ? 'none'
                                    : '';
                                }
                              }}
                              onBlur={handleProcessInput}
                              className="cursor-text text-xs font-medium text-neutral-800 outline-none dark:text-neutral-100"
                              style={{ minHeight: '1.25em' }}
                            >
                              {process}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 品种 */}
                      {(isAddMode || variety) && (
                        <div className="flex items-start">
                          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                            品种
                          </div>
                          <div className="relative ml-4 flex-1">
                            {isAddMode && !variety && (
                              <span
                                className="pointer-events-none absolute top-0 left-0 text-xs font-medium text-neutral-400 dark:text-neutral-500"
                                data-placeholder="variety"
                              >
                                输入品种
                              </span>
                            )}
                            <div
                              ref={varietyRef}
                              contentEditable
                              suppressContentEditableWarning
                              onInput={e => {
                                const placeholder =
                                  e.currentTarget.parentElement?.querySelector(
                                    '[data-placeholder="variety"]'
                                  ) as HTMLElement;
                                if (placeholder) {
                                  placeholder.style.display = e.currentTarget
                                    .textContent
                                    ? 'none'
                                    : '';
                                }
                              }}
                              onBlur={handleVarietyInput}
                              className="cursor-text text-xs font-medium text-neutral-800 outline-none dark:text-neutral-100"
                              style={{ minHeight: '1.25em' }}
                            >
                              {variety}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 烘焙度 - 点击下拉选择 */}
                      {(isAddMode || roastLevel) && (
                        <div className="flex items-start">
                          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                            烘焙度
                          </div>
                          <div
                            ref={roastLevelRef}
                            className="relative ml-4 inline-flex"
                          >
                            <span
                              onClick={() =>
                                setShowRoastLevelDropdown(
                                  !showRoastLevelDropdown
                                )
                              }
                              className={`cursor-pointer text-xs font-medium ${isAddMode && !roastLevel ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-800 dark:text-neutral-100'}`}
                            >
                              {roastLevel || (isAddMode ? '选择烘焙度' : '')}
                            </span>
                            {/* 下拉选择框 */}
                            {showRoastLevelDropdown && (
                              <div className="absolute top-full left-0 z-50 mt-1 min-w-[100px] rounded border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
                                {ROAST_LEVELS.map(level => (
                                  <div
                                    key={level}
                                    onClick={() =>
                                      handleRoastLevelSelect(level)
                                    }
                                    className={`cursor-pointer px-3 py-1.5 text-xs font-medium transition-colors ${
                                      level === roastLevel
                                        ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100'
                                        : 'text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-700/50'
                                    }`}
                                  >
                                    {level}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 赏味期设置 - 添加模式下显示 */}
                      {isAddMode && (
                        <div className="flex items-center">
                          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                            赏味期
                          </div>
                          <div className="ml-4 flex items-center gap-2">
                            {bean?.isFrozen ? (
                              <span
                                onClick={() =>
                                  handleUpdateField({ isFrozen: false })
                                }
                                className="cursor-pointer bg-neutral-100 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                              >
                                冷冻
                              </span>
                            ) : (
                              // 未冷冻：显示输入框和冷冻选项
                              <>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  value={bean?.startDay ?? ''}
                                  onChange={e =>
                                    handleUpdateField({
                                      startDay: e.target.value
                                        ? parseInt(e.target.value)
                                        : undefined,
                                    })
                                  }
                                  placeholder="天数"
                                  className="w-10 bg-neutral-100 px-1.5 py-0.5 text-center text-xs font-medium text-neutral-700 outline-none dark:bg-neutral-800 dark:text-neutral-300"
                                />
                                <span className="text-xs text-neutral-400">
                                  ~
                                </span>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  value={bean?.endDay ?? ''}
                                  onChange={e =>
                                    handleUpdateField({
                                      endDay: e.target.value
                                        ? parseInt(e.target.value)
                                        : undefined,
                                    })
                                  }
                                  placeholder="天数"
                                  className="w-10 bg-neutral-100 px-1.5 py-0.5 text-center text-xs font-medium text-neutral-700 outline-none dark:bg-neutral-800 dark:text-neutral-300"
                                />
                                <span className="text-xs text-neutral-400">
                                  天
                                </span>
                                <div className="mx-1 h-3 w-px bg-neutral-200 dark:bg-neutral-700" />
                                <span
                                  onClick={() =>
                                    handleUpdateField({ isFrozen: true })
                                  }
                                  className="cursor-pointer bg-neutral-100/70 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-neutral-400 dark:bg-neutral-800/70 dark:text-neutral-500"
                                >
                                  冷冻
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 拼配成分（拼配豆时显示）- 支持无感编辑 */}
                {bean?.blendComponents && bean.blendComponents.length > 1 && (
                  <div className="flex items-start">
                    <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      拼配成分
                    </div>
                    <div className="ml-4 space-y-2">
                      {bean.blendComponents.map(
                        (
                          comp: {
                            origin?: string;
                            estate?: string;
                            variety?: string;
                            process?: string;
                            percentage?: number;
                          },
                          index: number
                        ) => {
                          // 处理拼配成分字段编辑
                          const handleBlendFieldEdit = (
                            field: 'origin' | 'estate' | 'process' | 'variety',
                            value: string
                          ) => {
                            const updatedComponents = [
                              ...bean.blendComponents!,
                            ];
                            updatedComponents[index] = {
                              ...updatedComponents[index],
                              [field]: value.trim(),
                            };
                            handleUpdateField({
                              blendComponents: updatedComponents,
                            });
                          };

                          return (
                            <div
                              key={index}
                              className="flex items-center gap-1 text-xs font-medium text-neutral-800 dark:text-neutral-100"
                            >
                              {/* 产地 */}
                              {comp.origin && (
                                <span
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={e => {
                                    const newValue =
                                      e.currentTarget.textContent?.trim() || '';
                                    if (newValue !== comp.origin) {
                                      handleBlendFieldEdit('origin', newValue);
                                    }
                                  }}
                                  className="cursor-text outline-none"
                                >
                                  {comp.origin}
                                </span>
                              )}
                              {/* 分隔符 */}
                              {comp.origin && comp.estate && (
                                <span className="text-neutral-400 dark:text-neutral-600">
                                  ·
                                </span>
                              )}
                              {/* 庄园 */}
                              {comp.estate && (
                                <span
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={e => {
                                    const newValue =
                                      e.currentTarget.textContent?.trim() || '';
                                    if (newValue !== comp.estate) {
                                      handleBlendFieldEdit('estate', newValue);
                                    }
                                  }}
                                  className="cursor-text outline-none"
                                >
                                  {comp.estate}
                                </span>
                              )}
                              {/* 分隔符 */}
                              {(comp.origin || comp.estate) &&
                                (comp.variety || comp.process) && (
                                  <span className="text-neutral-400 dark:text-neutral-600">
                                    ·
                                  </span>
                                )}
                              {/* 品种 */}
                              {comp.variety && (
                                <span
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={e => {
                                    const newValue =
                                      e.currentTarget.textContent?.trim() || '';
                                    if (newValue !== comp.variety) {
                                      handleBlendFieldEdit('variety', newValue);
                                    }
                                  }}
                                  className="cursor-text outline-none"
                                >
                                  {comp.variety}
                                </span>
                              )}
                              {/* 分隔符 */}
                              {comp.variety && comp.process && (
                                <span className="text-neutral-400 dark:text-neutral-600">
                                  ·
                                </span>
                              )}
                              {/* 处理法 */}
                              {comp.process && (
                                <span
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={e => {
                                    const newValue =
                                      e.currentTarget.textContent?.trim() || '';
                                    if (newValue !== comp.process) {
                                      handleBlendFieldEdit('process', newValue);
                                    }
                                  }}
                                  className="cursor-text outline-none"
                                >
                                  {comp.process}
                                </span>
                              )}
                              {/* 百分比 */}
                              {comp.percentage !== undefined &&
                                comp.percentage !== null && (
                                  <span className="ml-1 text-neutral-600 dark:text-neutral-400">
                                    {comp.percentage}%
                                  </span>
                                )}
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}

                {/* 风味 - 已有标签可编辑，新增用 input */}
                {(isAddMode || (bean?.flavor && bean.flavor.length > 0)) && (
                  <div className="flex items-start">
                    <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      风味
                    </div>
                    <div className="ml-4 flex flex-1 flex-wrap items-center gap-1">
                      {(() => {
                        const currentFlavors = isAddMode
                          ? tempBean.flavor || []
                          : bean?.flavor || [];

                        const placeholder =
                          currentFlavors.length === 0
                            ? '输入风味，空格分隔'
                            : '+ ';

                        // 计算输入框宽度的函数
                        const calcWidth = (text: string, fallback: string) => {
                          const displayText = text || fallback;
                          // 每个中文字符约 2ch，英文约 1ch，额外加 1ch 余量
                          let len = 0;
                          for (let i = 0; i < displayText.length; i++) {
                            len += displayText.charCodeAt(i) > 127 ? 2 : 1;
                          }
                          return `${len + 1}ch`;
                        };

                        return (
                          <>
                            {/* 已有的风味标签 - contentEditable 支持点击编辑 */}
                            {currentFlavors.map(
                              (flavor: string, index: number) => (
                                <span
                                  key={index}
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={e => {
                                    const newValue =
                                      e.currentTarget.textContent?.trim() || '';
                                    if (newValue !== flavor) {
                                      const newFlavors = [...currentFlavors];
                                      if (newValue === '') {
                                        newFlavors.splice(index, 1);
                                      } else {
                                        newFlavors[index] = newValue;
                                      }
                                      handleUpdateField({ flavor: newFlavors });
                                    }
                                  }}
                                  className="cursor-text bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700 outline-none dark:bg-neutral-800/40 dark:text-neutral-300"
                                >
                                  {flavor}
                                </span>
                              )
                            )}
                            {/* 添加模式：输入框宽度自适应内容或 placeholder */}
                            {isAddMode && (
                              <input
                                type="text"
                                placeholder={placeholder}
                                onInput={e => {
                                  const input = e.currentTarget;
                                  input.style.width = calcWidth(
                                    input.value,
                                    placeholder
                                  );
                                }}
                                onKeyDown={e => {
                                  // 输入法组合中不处理
                                  if (e.nativeEvent.isComposing) return;

                                  const input = e.currentTarget;
                                  const value = input.value.trim();

                                  if (e.key === ' ' || e.key === 'Enter') {
                                    if (value) {
                                      e.preventDefault();
                                      handleUpdateField({
                                        flavor: [...currentFlavors, value],
                                      });
                                      input.value = '';
                                      input.style.width = calcWidth('', '+');
                                    }
                                  }

                                  // 退格键：把最后一个标签移回输入框继续编辑
                                  if (
                                    e.key === 'Backspace' &&
                                    !value &&
                                    currentFlavors.length > 0
                                  ) {
                                    e.preventDefault();
                                    const lastFlavor =
                                      currentFlavors[currentFlavors.length - 1];
                                    const newFlavors = currentFlavors.slice(
                                      0,
                                      -1
                                    );
                                    handleUpdateField({ flavor: newFlavors });
                                    input.value = lastFlavor;
                                    input.style.width = calcWidth(
                                      lastFlavor,
                                      '+'
                                    );
                                  }
                                }}
                                onBlur={e => {
                                  const input = e.currentTarget;
                                  const value = input.value.trim();
                                  if (value) {
                                    handleUpdateField({
                                      flavor: [...currentFlavors, value],
                                    });
                                    input.value = '';
                                  }
                                  // 失焦后根据新 placeholder 调整宽度
                                  const newPlaceholder =
                                    currentFlavors.length === 0 && !value
                                      ? '输入风味，空格分隔'
                                      : '+ ';
                                  input.style.width = calcWidth(
                                    '',
                                    newPlaceholder
                                  );
                                }}
                                className="bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700 placeholder:text-neutral-400 focus:outline-none dark:bg-neutral-800 dark:text-neutral-300 dark:placeholder:text-neutral-500"
                                style={{ width: calcWidth('', placeholder) }}
                              />
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* 备注 */}
                {(isAddMode || bean?.notes) && (
                  <div className="flex items-start">
                    <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      备注
                    </div>
                    <div className="relative ml-4 flex-1">
                      {isAddMode && !tempBean.notes && (
                        <span
                          className="pointer-events-none absolute top-0 left-0 text-xs font-medium text-neutral-400 dark:text-neutral-500"
                          data-placeholder="notes"
                        >
                          输入备注
                        </span>
                      )}
                      <div
                        ref={notesRef}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={e => {
                          const placeholder =
                            e.currentTarget.parentElement?.querySelector(
                              '[data-placeholder="notes"]'
                            ) as HTMLElement;
                          if (placeholder) {
                            placeholder.style.display = e.currentTarget
                              .textContent
                              ? 'none'
                              : '';
                          }
                        }}
                        onBlur={handleNotesInput}
                        className="cursor-text text-xs font-medium whitespace-pre-wrap text-neutral-800 outline-none dark:text-neutral-100"
                        style={{
                          minHeight: '1.5em',
                          wordBreak: 'break-word',
                        }}
                      >
                        {(() => {
                          const currentNotes = isAddMode
                            ? tempBean.notes
                            : bean?.notes;
                          if (!currentNotes) return '';
                          if (searchQuery) {
                            return (
                              <HighlightText
                                text={currentNotes || ''}
                                highlight={searchQuery}
                                className="text-neutral-700 dark:text-neutral-300"
                              />
                            );
                          }
                          return currentNotes;
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 个人榜单评价区域 - 根据设置和内容决定是否显示 */}
              {!isAddMode &&
                (showBeanRating ||
                  (bean?.overallRating && bean.overallRating > 0)) && (
                  <div className="border-t border-neutral-200/40 pt-3 dark:border-neutral-800/40">
                    {bean?.overallRating && bean.overallRating > 0 ? (
                      // 已有评价，显示评价内容
                      <div
                        className="cursor-pointer space-y-3"
                        onClick={() => {
                          setRatingModalOpen(true);
                        }}
                      >
                        {/* 评分 */}
                        <div className="flex items-start">
                          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                            评分
                          </div>
                          <div className="ml-4 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                            {bean?.overallRating} / 5
                          </div>
                        </div>

                        {/* 评价备注 */}
                        {bean?.ratingNotes && bean.ratingNotes.trim() && (
                          <div className="flex items-start">
                            <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                              评价
                            </div>
                            <div className="ml-4 text-xs font-medium whitespace-pre-line text-neutral-800 dark:text-neutral-100">
                              {bean?.ratingNotes}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      // 无评价，显示添加提示
                      <div className="flex items-start">
                        <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                          评分
                        </div>
                        <button
                          onClick={() => {
                            setRatingModalOpen(true);
                          }}
                          className="ml-4 text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-400"
                        >
                          + 添加评价
                        </button>
                      </div>
                    )}
                  </div>
                )}

              {/* 相关冲煮记录 - 简化布局 - 只在有记录时显示 */}
              {(() => {
                // 分类记录 - 根据豆子类型不同处理
                // 烘焙记录（仅生豆显示）
                const roastingRecords = relatedNotes.filter(note =>
                  isRoastingRecord(note)
                );
                // 普通冲煮记录（不包括烘焙记录和变动记录）
                const brewingRecords = relatedNotes.filter(
                  note => !isSimpleChangeRecord(note) && !isRoastingRecord(note)
                );
                // 变动记录（快捷扣除、容量调整）
                const changeRecords = relatedNotes.filter(note =>
                  isSimpleChangeRecord(note)
                );

                // 根据豆子类型决定显示哪些记录
                // 生豆：显示烘焙记录 + 变动记录
                // 熟豆：显示冲煮记录 + 变动记录 + 生豆记录
                const primaryRecords = isGreenBean
                  ? roastingRecords
                  : brewingRecords;
                const secondaryRecords = changeRecords;

                // 熟豆是否有来源生豆
                const hasSourceGreenBean =
                  !isGreenBean && relatedBeans.length > 0;

                // 如果都没有记录（且熟豆没有来源生豆），直接返回null，不显示这个区域
                if (
                  primaryRecords.length === 0 &&
                  secondaryRecords.length === 0 &&
                  !hasSourceGreenBean
                ) {
                  return null;
                }

                // 标签文案
                const primaryLabel = isGreenBean ? '烘焙记录' : '冲煮记录';
                const secondaryLabel = '变动记录';
                const greenBeanLabel = '生豆记录';

                // 当前选中的 Tab：0=primary, 1=secondary, 2=greenBean
                // 使用 showChangeRecords 作为基础状态，新增 showGreenBeanRecords
                // 为了简化，复用 showChangeRecords: false=primary, true=secondary
                // 新增状态用于生豆记录

                return (
                  <div className="border-t border-neutral-200/40 pt-3 dark:border-neutral-800/40">
                    {/* Tab切换按钮 - 只显示存在的类型 */}
                    <div className="flex items-center gap-2">
                      {primaryRecords.length > 0 && (
                        <button
                          onClick={() => {
                            setShowChangeRecords(false);
                            setShowGreenBeanRecords(false);
                          }}
                          className={`text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 ${
                            !showChangeRecords && !showGreenBeanRecords
                              ? 'opacity-100'
                              : 'opacity-50'
                          }`}
                        >
                          {primaryLabel} ({primaryRecords.length})
                        </button>
                      )}
                      {secondaryRecords.length > 0 && (
                        <button
                          onClick={() => {
                            setShowChangeRecords(true);
                            setShowGreenBeanRecords(false);
                          }}
                          className={`text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 ${
                            showChangeRecords ? 'opacity-100' : 'opacity-50'
                          }`}
                        >
                          {secondaryLabel} ({secondaryRecords.length})
                        </button>
                      )}
                      {hasSourceGreenBean && (
                        <button
                          onClick={() => {
                            setShowChangeRecords(false);
                            setShowGreenBeanRecords(true);
                          }}
                          className={`text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 ${
                            showGreenBeanRecords ? 'opacity-100' : 'opacity-50'
                          }`}
                        >
                          {greenBeanLabel} ({relatedBeans.length})
                        </button>
                      )}
                    </div>

                    {/* 记录列表 */}
                    <div className="mt-3 space-y-2">
                      {/* 生豆记录 - 仅熟豆且有关联生豆时显示 */}
                      {showGreenBeanRecords &&
                        hasSourceGreenBean &&
                        relatedBeans.map(relatedBean => (
                          <div
                            key={`source-${relatedBean.id}`}
                            className="rounded bg-neutral-200 p-1.5 dark:bg-neutral-800/40"
                          >
                            <div className="flex items-center gap-3">
                              {/* 图片 */}
                              <BeanImageSmall bean={relatedBean} />

                              {/* 信息 */}
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-xs font-medium text-neutral-800 dark:text-neutral-100">
                                  {relatedBean.name}
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                  <span>{relatedBean.purchaseDate || '-'}</span>
                                  {(relatedBean.remaining ||
                                    relatedBean.capacity) && (
                                    <>
                                      <span>·</span>
                                      <span>
                                        {formatNumber(relatedBean.remaining)}/
                                        {formatNumber(relatedBean.capacity)}g
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      {/* 冲煮记录或变动记录 */}
                      {!showGreenBeanRecords &&
                        (showChangeRecords
                          ? secondaryRecords
                          : primaryRecords
                        ).map(note => {
                          const isChangeRecord = isSimpleChangeRecord(note);
                          const isRoasting = isRoastingRecord(note);

                          return (
                            <div
                              key={note.id}
                              className="rounded bg-neutral-100 p-1.5 dark:bg-neutral-800/40"
                            >
                              {/* card wrapper */}
                              {isChangeRecord ? (
                                // 变动记录（快捷扣除和容量调整）
                                <div className="flex items-center gap-2 opacity-80">
                                  {/* 变动量标签 */}
                                  {(() => {
                                    let displayLabel = '0g';

                                    if (note.source === 'quick-decrement') {
                                      // 快捷扣除记录
                                      const amount =
                                        note.quickDecrementAmount || 0;
                                      displayLabel = `-${amount}g`;
                                    } else if (
                                      note.source === 'capacity-adjustment'
                                    ) {
                                      // 容量调整记录
                                      const capacityAdjustment =
                                        note.changeRecord?.capacityAdjustment;
                                      const changeAmount =
                                        capacityAdjustment?.changeAmount || 0;
                                      const changeType =
                                        capacityAdjustment?.changeType || 'set';

                                      if (changeType === 'increase') {
                                        displayLabel = `+${Math.abs(changeAmount)}g`;
                                      } else if (changeType === 'decrease') {
                                        displayLabel = `-${Math.abs(changeAmount)}g`;
                                      } else {
                                        displayLabel = `${capacityAdjustment?.newAmount || 0}g`;
                                      }
                                    }

                                    return (
                                      <div className="w-12 overflow-hidden rounded-xs bg-neutral-200/50 px-1 py-px text-center text-xs font-medium whitespace-nowrap text-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-300">
                                        {displayLabel}
                                      </div>
                                    );
                                  })()}

                                  {/* 备注 - 弹性宽度，占用剩余空间 */}
                                  {note.notes && (
                                    <div
                                      className="min-w-0 flex-1 truncate text-xs text-neutral-600 dark:text-neutral-300"
                                      title={note.notes}
                                    >
                                      {note.notes}
                                    </div>
                                  )}

                                  {/* 日期 - 固定宽度 */}
                                  <div
                                    className="w-20 overflow-hidden text-right text-xs font-medium tracking-wide whitespace-nowrap text-neutral-600 dark:text-neutral-400"
                                    title={formatDate(note.timestamp)}
                                  >
                                    {formatDate(note.timestamp)}
                                  </div>
                                </div>
                              ) : isRoasting ? (
                                // 烘焙记录（生豆特有）- 尝试查找关联的熟豆并渲染为卡片
                                (() => {
                                  const roastedBeanId =
                                    note.changeRecord?.roastingRecord
                                      ?.roastedBeanId;
                                  const roastedBean = roastedBeanId
                                    ? allBeans.find(b => b.id === roastedBeanId)
                                    : null;

                                  if (roastedBean) {
                                    // 找到了关联的熟豆，渲染为卡片
                                    return (
                                      <div className="flex items-center gap-3">
                                        {/* 图片 */}
                                        <BeanImageSmall bean={roastedBean} />

                                        {/* 信息 */}
                                        <div className="min-w-0 flex-1">
                                          <div className="truncate text-xs font-medium text-neutral-800 dark:text-neutral-100">
                                            {roastedBean.name}
                                          </div>
                                          <div className="mt-0.5 flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                            <span>
                                              {roastedBean.roastDate || '-'}
                                            </span>
                                            {(roastedBean.remaining ||
                                              roastedBean.capacity) && (
                                              <>
                                                <span>·</span>
                                                <span>
                                                  {formatNumber(
                                                    roastedBean.remaining
                                                  )}
                                                  /
                                                  {formatNumber(
                                                    roastedBean.capacity
                                                  )}
                                                  g
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  } else {
                                    // 未找到关联熟豆（可能已删除），保持原有简单文本显示
                                    return (
                                      <div className="flex items-center gap-2 opacity-80">
                                        {/* 烘焙量标签 */}
                                        <div className="w-12 overflow-hidden rounded-xs bg-neutral-200/50 px-1 py-px text-center text-xs font-medium whitespace-nowrap text-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-300">
                                          -
                                          {note.changeRecord?.roastingRecord
                                            ?.roastedAmount || 0}
                                          g
                                        </div>

                                        {/* 熟豆名称 - 弹性宽度 */}
                                        {note.changeRecord?.roastingRecord
                                          ?.roastedBeanName && (
                                          <div className="flex min-w-0 flex-1 items-center gap-1 text-xs text-neutral-600 dark:text-neutral-300">
                                            <span className="text-neutral-400 dark:text-neutral-600">
                                              →
                                            </span>
                                            <span className="truncate">
                                              {
                                                note.changeRecord.roastingRecord
                                                  .roastedBeanName
                                              }
                                            </span>
                                          </div>
                                        )}

                                        {/* 日期 - 固定宽度 */}
                                        <div
                                          className="w-20 overflow-hidden text-right text-xs font-medium tracking-wide whitespace-nowrap text-neutral-600 dark:text-neutral-400"
                                          title={formatDate(note.timestamp)}
                                        >
                                          {formatDate(note.timestamp)}
                                        </div>
                                      </div>
                                    );
                                  }
                                })()
                              ) : (
                                // 普通冲煮记录
                                <div className="space-y-3">
                                  {/* 图片和标题参数区域 */}
                                  <div className="flex gap-4">
                                    {/* 笔记图片 - 只在有图片时显示 */}
                                    {note.image && (
                                      <div
                                        className="relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded border border-neutral-200/50 bg-neutral-100 dark:border-neutral-700/40 dark:bg-neutral-800/20"
                                        onClick={e => {
                                          e.stopPropagation();
                                          if (
                                            !noteImageErrors[note.id] &&
                                            note.image
                                          ) {
                                            setCurrentImageUrl(note.image);
                                            setImageViewerOpen(true);
                                          }
                                        }}
                                      >
                                        {noteImageErrors[note.id] ? (
                                          <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500 dark:text-neutral-400">
                                            加载失败
                                          </div>
                                        ) : (
                                          <Image
                                            src={note.image}
                                            alt={bean?.name || '笔记图片'}
                                            height={48}
                                            width={48}
                                            unoptimized
                                            style={{
                                              width: '100%',
                                              height: '100%',
                                            }}
                                            className="object-cover"
                                            sizes="48px"
                                            priority={false}
                                            loading="lazy"
                                            onError={() =>
                                              setNoteImageErrors(prev => ({
                                                ...prev,
                                                [note.id]: true,
                                              }))
                                            }
                                          />
                                        )}
                                      </div>
                                    )}

                                    {/* 名称和标签区域 */}
                                    <div className="min-w-0 flex-1">
                                      <div className="space-y-1.5">
                                        {/* 标题行 - 复杂的显示逻辑 */}
                                        <div className="text-xs font-medium wrap-break-word text-neutral-800 dark:text-neutral-100">
                                          {note.method &&
                                          note.method.trim() !== '' ? (
                                            // 有方案时的显示逻辑
                                            bean?.name ? (
                                              <>
                                                {bean.name}
                                                <span className="mx-1">·</span>
                                                <span>{note.method}</span>
                                              </>
                                            ) : (
                                              <>
                                                {note.equipment
                                                  ? equipmentNames[
                                                      note.equipment
                                                    ] || note.equipment
                                                  : '未知器具'}
                                                <span className="mx-1">·</span>
                                                <span>{note.method}</span>
                                              </>
                                            )
                                          ) : // 没有方案时的显示逻辑
                                          bean?.name ? (
                                            bean.name ===
                                            (note.equipment
                                              ? equipmentNames[
                                                  note.equipment
                                                ] || note.equipment
                                              : '未知器具') ? (
                                              bean.name
                                            ) : (
                                              <>
                                                {bean.name}
                                                <span className="mx-1">·</span>
                                                <span>
                                                  {note.equipment
                                                    ? equipmentNames[
                                                        note.equipment
                                                      ] || note.equipment
                                                    : '未知器具'}
                                                </span>
                                              </>
                                            )
                                          ) : note.equipment ? (
                                            equipmentNames[note.equipment] ||
                                            note.equipment
                                          ) : (
                                            '未知器具'
                                          )}
                                        </div>

                                        {/* 参数信息 - 无论是否有方案都显示 */}
                                        {note.params && (
                                          <div className="mt-1.5 space-x-1 text-xs leading-relaxed font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                                            {bean?.name && (
                                              <>
                                                <span>
                                                  {note.equipment
                                                    ? equipmentNames[
                                                        note.equipment
                                                      ] || note.equipment
                                                    : '未知器具'}
                                                </span>
                                                <span>·</span>
                                              </>
                                            )}
                                            <span>{note.params.coffee}</span>
                                            <span>·</span>
                                            <span>{note.params.ratio}</span>
                                            {(note.params.grindSize ||
                                              note.params.temp) && (
                                              <>
                                                <span>·</span>
                                                <span>
                                                  {[
                                                    note.params.grindSize,
                                                    note.params.temp,
                                                  ]
                                                    .filter(Boolean)
                                                    .join(' · ')}
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* 风味评分 - 只有当存在有效评分(大于0)时才显示 */}
                                  {(() => {
                                    const validTasteRatings =
                                      getValidTasteRatings(note.taste);
                                    const hasTasteRatings =
                                      validTasteRatings.length > 0;

                                    return hasTasteRatings ? (
                                      <div className="grid grid-cols-2 gap-4">
                                        {validTasteRatings.map(rating => (
                                          <div
                                            key={rating.id}
                                            className="space-y-1"
                                          >
                                            <div className="flex items-center justify-between">
                                              <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                                                {rating.label}
                                              </div>
                                              <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                                                {rating.value}
                                              </div>
                                            </div>
                                            <div className="h-px w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-700/50">
                                              <div
                                                style={{
                                                  width: `${rating.value === 0 ? 0 : (rating.value / 5) * 100}%`,
                                                }}
                                                className="h-full bg-neutral-600 dark:bg-neutral-300"
                                              />
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : null;
                                  })()}

                                  {/* 时间和评分 */}
                                  <div className="flex items-baseline justify-between">
                                    <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                                      {formatDate(note.timestamp)}
                                    </div>
                                    {/* 只有当评分大于 0 时才显示评分 */}
                                    {note.rating > 0 && (
                                      <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                                        {formatRating(note.rating)}
                                      </div>
                                    )}
                                  </div>

                                  {/* 备注信息 */}
                                  {note.notes && note.notes.trim() && (
                                    <div className="rounded bg-neutral-200/30 px-1.5 py-1 text-xs font-medium tracking-wide whitespace-pre-line text-neutral-800/70 dark:bg-neutral-800/40 dark:text-neutral-400/85">
                                      {note.notes}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : null}
        </div>
      </div>

      {/* 图片查看器 */}
      {currentImageUrl && imageViewerOpen && (
        <ImageViewer
          isOpen={imageViewerOpen}
          imageUrl={currentImageUrl}
          alt="笔记图片"
          onClose={() => {
            setImageViewerOpen(false);
            setCurrentImageUrl('');
          }}
        />
      )}

      {/* 打印模态框 */}
      {printEnabled && (
        <BeanPrintModal
          isOpen={printModalOpen}
          bean={bean}
          onClose={() => setPrintModalOpen(false)}
        />
      )}

      {/* 评分模态框 */}
      <BeanRatingModal
        showModal={ratingModalOpen}
        coffeeBean={bean}
        onClose={() => setRatingModalOpen(false)}
        onSave={async (id: string, ratings: Partial<CoffeeBean>) => {
          try {
            // 导入 CoffeeBeanManager
            const { CoffeeBeanManager } = await import(
              '@/lib/managers/coffeeBeanManager'
            );
            // 更新评分 - 使用 updateBeanRatings 方法以清除评分缓存
            await CoffeeBeanManager.updateBeanRatings(id, ratings);
            // 触发数据更新事件，包含详细信息
            window.dispatchEvent(
              new CustomEvent('coffeeBeanDataChanged', {
                detail: {
                  action: 'update',
                  beanId: id,
                },
              })
            );
          } catch (error) {
            console.error('保存评分失败:', error);
          }
        }}
      />
    </>
  );
};

export default BeanDetailModal;
