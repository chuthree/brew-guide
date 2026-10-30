'use client';

import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import NavigationSection from './NavigationSection';
import { equipmentList, type CustomEquipment } from '@/lib/core/config';
import hapticsUtils from '@/lib/ui/haptics';
import { SettingsOptions } from '@/components/settings/Settings';
import { BREWING_EVENTS, ParameterInfo } from '@/lib/brewing/constants';
import { listenToEvent } from '@/lib/brewing/events';
import {
  updateParameterInfo,
  getEquipmentName,
} from '@/lib/brewing/parameters';
import EquipmentBar from '@/components/equipment/EquipmentBar';
import GrindSizeInput from '@/components/ui/GrindSizeInput';
import { selectIsSyncing, useSyncStatusStore } from '@/lib/stores/syncStatusStore';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  useScrollToSelected,
  useScrollBorder,
} from '@/lib/equipment/useScrollToSelected';
import { NavigationSettingsButton } from '@/components/layout/NavigationControls';

import { Equal, ArrowLeft, ChevronsUpDown, RefreshCw } from 'lucide-react';

import { saveMainTabPreference } from '@/lib/navigation/navigationCache';
import {
  COFFEE_BEAN_VIEW_ORDER,
  deriveNavigationSettings,
} from '@/lib/navigation/navigationSettings';
import {
  ViewOption,
  VIEW_LABELS,
  SIMPLIFIED_VIEW_LABELS,
  VIEW_OPTIONS,
} from '@/components/coffee-bean/List/constants';

// 统一类型定义
type MainTabType = '冲煮' | '咖啡豆' | '笔记';
type BrewingStep = 'coffeeBean' | 'method' | 'brewing' | 'notes';

const TabButton = ({
  isActive,
  dataTab,
  children,
  ...props
}: React.ComponentProps<'button'> & {
  isActive: boolean;
  dataTab: string;
}) => (
  <button
    type="button"
    {...props}
    aria-current={isActive ? 'page' : undefined}
    data-tab={dataTab}
    className={`flex items-center rounded-sm pb-3 text-xs font-medium tracking-widest whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400/50 focus-visible:ring-offset-4 focus-visible:ring-offset-neutral-50 md:pb-0 dark:focus-visible:ring-neutral-500/60 dark:focus-visible:ring-offset-neutral-900 ${
      isActive
        ? 'text-neutral-800 dark:text-neutral-100'
        : 'cursor-pointer text-neutral-500 dark:text-neutral-400'
    }`}
  >
    <span className="relative inline-block">{children}</span>
  </button>
);

interface EditableParams {
  coffee: string;
  water: string;
  ratio: string;
  grindSize: string;
  temp: string;
  time?: string;
}

interface DisplayOverlayState {
  step: BrewingStep;
  params: EditableParams;
  value: Partial<EditableParams>;
}

// 意式咖啡相关工具函数
const espressoUtils = {
  isEspresso: (
    method: {
      params?: {
        stages?: Array<{ pourType?: string; [key: string]: unknown }>;
      };
    } | null
  ) =>
    method?.params?.stages?.some(stage =>
      ['extraction', 'beverage'].includes(stage.pourType || '')
    ) || false,

  getExtractionTime: (
    method: {
      params?: {
        stages?: Array<{
          pourType?: string;
          duration?: number;
          [key: string]: unknown;
        }>;
      };
    } | null
  ) => {
    const extractionStage = method?.params?.stages?.find(
      stage => stage.pourType === 'extraction'
    );
    return extractionStage?.duration ?? 0;
  },

  formatTime: (seconds: number) => `${seconds}`,
};

// 优化的EditableParameter组件 - 使用更简洁的逻辑和hooks
interface EditableParameterProps {
  value: string;
  onChange: (value: string) => void;
  unit: string;
  className?: string;
  prefix?: string;
  disabled?: boolean;
}

const EditableParameter: React.FC<EditableParameterProps> = ({
  value,
  onChange,
  unit,
  className = '',
  prefix = '',
  disabled = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [tempValue, setTempValue] = useState(value);

  useLayoutEffect(() => {
    if (!isEditing || !inputRef.current) return;

    const input = inputRef.current;
    input.focus({ preventScroll: true });

    const cursorPosition = input.value.length;
    input.setSelectionRange(cursorPosition, cursorPosition);
  }, [isEditing]);

  useEffect(() => {
    setTempValue(value);
  }, [value]);

  const handleSubmit = useCallback(() => {
    setIsEditing(false);
    if (tempValue !== value) onChange(tempValue);
  }, [tempValue, value, onChange]);

  const handleCancel = useCallback(() => {
    setTempValue(value);
    setIsEditing(false);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSubmit();
      else if (e.key === 'Escape') handleCancel();
    },
    [handleSubmit, handleCancel]
  );

  if (disabled) {
    return (
      <span className={`inline-flex items-center ${className}`}>
        {prefix && <span className="shrink-0">{prefix}</span>}
        <span className="whitespace-nowrap">{value}</span>
        {unit && <span className="ml-0.5 shrink-0">{unit}</span>}
      </span>
    );
  }

  // 计算输入框宽度：中文字符按2倍计算，英文字符按1倍计算
  const calculateInputSize = (str: string) => {
    let width = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      // 检测中文字符（包括中文标点）
      if (/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(char)) {
        width += 2;
      } else {
        width += 1;
      }
    }
    return Math.max(width || 1, 2);
  };

  return (
    <span
      className={`group relative inline-flex min-w-0 cursor-pointer items-center border-b border-dashed border-neutral-300 pb-0.5 dark:border-neutral-600 ${className}`}
      onClick={() => setIsEditing(true)}
    >
      {prefix && <span className="shrink-0">{prefix}</span>}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={tempValue}
          onChange={e => setTempValue(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          className="max-w-none min-w-0 bg-transparent text-center text-xs outline-hidden"
          size={calculateInputSize(tempValue)}
        />
      ) : (
        <span className="inline-flex items-center whitespace-nowrap">
          {value}
          {unit && <span className="ml-0.5 shrink-0">{unit}</span>}
        </span>
      )}
    </span>
  );
};

const getPwaBannerVisible = () => {
  if (typeof window === 'undefined') return false;
  return (window as any).__pwaInstallBannerVisible === true;
};

interface NavigationBarProps {
  activeMainTab: MainTabType;
  setActiveMainTab: (tab: MainTabType) => void;
  activeBrewingStep: BrewingStep;
  parameterInfo: ParameterInfo;
  setParameterInfo: (info: ParameterInfo) => void;
  editableParams: EditableParams | null;
  setEditableParams: (params: EditableParams | null) => void;
  isTimerRunning: boolean;
  showComplete: boolean;
  selectedEquipment: string | null;
  selectedMethod: {
    name: string;
    params: {
      coffee: string;
      water: string;
      ratio: string;
      grindSize: string;
      temp: string;
      stages: Array<{
        label: string;
        duration?: number;
        water?: string;
        detail: string;
        pourType?: string;
      }>;
    };
  } | null;
  handleParamChange: (type: keyof EditableParams, value: string) => void;
  setShowHistory: (show: boolean) => void;
  onTitleDoubleClick: () => void;
  settings: SettingsOptions;
  hasCoffeeBeans?: boolean;
  alternativeHeader?: React.ReactNode;
  showAlternativeHeader?: boolean;
  currentBeanView?: ViewOption;
  showViewDropdown?: boolean;
  onToggleViewDropdown?: () => void;
  onBeanViewChange?: (view: ViewOption) => void;
  handleExtractionTimeChange?: (time: number) => void;
  customEquipments?: CustomEquipment[];
  onEquipmentSelect?: (equipmentId: string) => void;
  onAddEquipment?: () => void;
  onEditEquipment?: (equipment: CustomEquipment) => void;
  onDeleteEquipment?: (equipment: CustomEquipment) => void;
  onShareEquipment?: (equipment: CustomEquipment) => void;
  onToggleEquipmentManagement?: () => void;
  onBackClick?: () => void;
  // 大屏幕宽度调整相关 props
  width?: number;
  isResizing?: boolean;
  isDesktopLayout?: boolean;
  sidebarCollapseControl?: React.ReactNode;
  sidebarControlVisibility?: 'reveal' | 'always';
  showDesktopBorder?: boolean;
}

// 意式咖啡相关工具函数 - 优化为更简洁的实现
// const espressoUtils = {
//     isEspresso: (method: { params?: { stages?: Array<{ pourType?: string; [key: string]: unknown }> } } | null) =>
//         method?.params?.stages?.some((stage) =>
//             ['extraction', 'beverage'].includes(stage.pourType || '')) || false,

//     getExtractionTime: (method: { params?: { stages?: Array<{ pourType?: string; time?: number; [key: string]: unknown }> } } | null) =>
//         method?.params?.stages?.find((stage) => stage.pourType === 'extraction')?.time || 0,

//     formatTime: (seconds: number) => `${seconds}`
// }

// 导航相关常量和工具
const NAVIGABLE_STEPS: Record<BrewingStep, BrewingStep | null> = {
  brewing: 'method',
  method: 'coffeeBean',
  coffeeBean: null,
  notes: 'brewing',
};

// 自定义Hook：处理导航逻辑
const useNavigation = (
  activeBrewingStep: BrewingStep,
  activeMainTab: MainTabType,
  hasCoffeeBeans?: boolean,
  showCoffeeBeanSelectionStep?: boolean
) => {
  const canGoBack = useCallback((): boolean => {
    // 如果当前在笔记页面，不显示返回按钮
    if (activeMainTab === '笔记') return false;

    // 如果当前在咖啡豆页面，不显示返回按钮
    if (activeMainTab === '咖啡豆') return false;

    // 只有在冲煮页面才考虑返回逻辑
    if (activeMainTab !== '冲煮') return false;

    // 咖啡豆步骤是第一步，不显示返回按钮
    if (activeBrewingStep === 'coffeeBean') return false;

    // 根据设置决定是否显示咖啡豆选择步骤
    const showBeanStep = showCoffeeBeanSelectionStep !== false;

    // 如果在方案步骤但没有咖啡豆或设置关闭，也是第一步，不显示返回按钮
    if (activeBrewingStep === 'method' && (!hasCoffeeBeans || !showBeanStep))
      return false;

    // 其他步骤检查是否有上一步
    return NAVIGABLE_STEPS[activeBrewingStep] !== null;
  }, [
    activeBrewingStep,
    activeMainTab,
    hasCoffeeBeans,
    showCoffeeBeanSelectionStep,
  ]);

  return { canGoBack };
};

const NavigationBar: React.FC<NavigationBarProps> = ({
  activeMainTab,
  setActiveMainTab,
  activeBrewingStep,
  parameterInfo,
  setParameterInfo,
  editableParams,
  setEditableParams,
  isTimerRunning,
  showComplete,
  selectedEquipment,
  selectedMethod,
  handleParamChange,
  setShowHistory,
  onTitleDoubleClick,
  settings,
  hasCoffeeBeans,
  alternativeHeader,
  showAlternativeHeader = false,
  currentBeanView,
  showViewDropdown,
  onToggleViewDropdown,
  onBeanViewChange,
  handleExtractionTimeChange,
  customEquipments = [],
  onEquipmentSelect,
  onAddEquipment: _onAddEquipment,
  onEditEquipment: _onEditEquipment,
  onDeleteEquipment: _onDeleteEquipment,
  onShareEquipment: _onShareEquipment,
  onToggleEquipmentManagement,
  onBackClick,
  width,
  isResizing,
  isDesktopLayout = false,
  sidebarCollapseControl,
  sidebarControlVisibility: _sidebarControlVisibility = 'reveal',
  showDesktopBorder = true,
}) => {
  const reduceMotion = useReducedMotion();
  const animateNavigation = !isDesktopLayout && !reduceMotion;
  const { canGoBack } = useNavigation(
    activeBrewingStep,
    activeMainTab,
    hasCoffeeBeans,
    settings.showCoffeeBeanSelectionStep
  );

  const isSyncing = useSyncStatusStore(selectIsSyncing);

  const isDesktopBackLayout = Boolean(canGoBack() && onBackClick);
  const showDesktopTopTabs = !isDesktopBackLayout;
  const [isSidebarControlVisible, setIsSidebarControlVisible] = useState(false);
  const showSidebarCollapseControl =
    isDesktopLayout && Boolean(sidebarCollapseControl);

  const derivedNavigation = deriveNavigationSettings(
    settings.navigationSettings
  );
  const { visibleTabs, coffeeBeanViews, showCoffeeBeanMainTab } =
    derivedNavigation;
  const typedPinnedViews = derivedNavigation.pinnedViews;
  const availableViewsCount = derivedNavigation.enabledUnpinnedViews.length;

  // 判断当前视图是否被固定
  const isCurrentViewPinned =
    currentBeanView && typedPinnedViews.includes(currentBeanView);

  // 计算当前选中的 tab 标识（用于滚动定位）
  const getSelectedTabId = useCallback(() => {
    if (activeMainTab === '咖啡豆') {
      if (isCurrentViewPinned && currentBeanView) {
        return currentBeanView;
      }
      return 'bean-view-selector';
    }
    return activeMainTab;
  }, [activeMainTab, currentBeanView, isCurrentViewPinned]);

  // 计算 tab 数量
  const tabCount =
    (visibleTabs.brewing ? 1 : 0) +
    (showCoffeeBeanMainTab ? 1 : 0) +
    typedPinnedViews.length +
    (visibleTabs.notes ? 1 : 0);

  // 可滚动导航栏
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 使用现有的滚动 hooks
  useScrollToSelected({
    selectedItem: getSelectedTabId(),
    containerRef: scrollContainerRef,
    itemCount: tabCount,
  });

  const { showLeftBorder, showRightBorder } = useScrollBorder({
    containerRef: scrollContainerRef,
    itemCount: tabCount,
  });

  // 获取第一个未被固定且允许显示的视图作为默认视图
  const getFirstAvailableView = useCallback(() => {
    const availableView = COFFEE_BEAN_VIEW_ORDER.find(view => {
      // 必须未被固定
      if (typedPinnedViews.includes(view)) return false;
      // 必须允许显示 (默认为 true)
      return coffeeBeanViews[view] !== false;
    });
    // 如果没有可用的，回退到库存视图
    return availableView || VIEW_OPTIONS.INVENTORY;
  }, [typedPinnedViews, coffeeBeanViews]);

  // 自动纠正当前视图：如果当前视图既未被固定，又被禁用，则切换到第一个可用视图
  useEffect(() => {
    // 1. 如果没有当前视图，但有可用视图，立即选择一个
    if (!currentBeanView && availableViewsCount > 0) {
      const nextView = getFirstAvailableView();
      onBeanViewChange?.(nextView);
      return;
    }

    if (!currentBeanView) return;

    const isPinned = typedPinnedViews.includes(currentBeanView);
    const isEnabled = coffeeBeanViews[currentBeanView] !== false;

    // 2. 如果当前视图既没被固定，也没被启用显示，且还有其他可用视图
    if (!isPinned && !isEnabled && availableViewsCount > 0) {
      const nextView = getFirstAvailableView();
      if (nextView !== currentBeanView) {
        onBeanViewChange?.(nextView);
      }
    }
  }, [
    currentBeanView,
    typedPinnedViews,
    coffeeBeanViews,
    availableViewsCount,
    getFirstAvailableView,
    onBeanViewChange,
  ]);

  // 处理当所有非固定视图都被禁用时，如果当前处于咖啡豆主标签页，需要跳转
  useEffect(() => {
    if (
      activeMainTab === '咖啡豆' &&
      !isCurrentViewPinned &&
      availableViewsCount === 0
    ) {
      // 优先跳转到第一个固定的视图
      if (typedPinnedViews.length > 0) {
        onBeanViewChange?.(typedPinnedViews[0]);
      } else {
        // 如果没有固定视图，跳转到其他可见的主标签页
        if (visibleTabs.brewing) {
          setActiveMainTab('冲煮');
        } else if (visibleTabs.notes) {
          setActiveMainTab('笔记');
        }
      }
    }
  }, [
    activeMainTab,
    isCurrentViewPinned,
    availableViewsCount,
    typedPinnedViews,
    visibleTabs,
    setActiveMainTab,
    onBeanViewChange,
  ]);

  // 记录最后一次选中的非固定视图
  const lastUnpinnedViewRef = useRef<ViewOption | null>(null);

  // 初始化或更新 lastUnpinnedViewRef
  useEffect(() => {
    // 如果当前视图未被固定且启用，更新记录
    if (
      currentBeanView &&
      !typedPinnedViews.includes(currentBeanView) &&
      coffeeBeanViews[currentBeanView] !== false
    ) {
      lastUnpinnedViewRef.current = currentBeanView;
    }
    // 如果 ref 为空（初始化），尝试设置一个默认值
    else if (!lastUnpinnedViewRef.current) {
      lastUnpinnedViewRef.current = getFirstAvailableView();
    }

    // 检查记录的视图是否变得无效（被固定或被禁用）
    // 这在 settings 异步加载完成后特别重要
    if (
      lastUnpinnedViewRef.current &&
      (typedPinnedViews.includes(lastUnpinnedViewRef.current) ||
        coffeeBeanViews[lastUnpinnedViewRef.current] === false)
    ) {
      lastUnpinnedViewRef.current = getFirstAvailableView();
    }
  }, [
    currentBeanView,
    typedPinnedViews,
    coffeeBeanViews,
    getFirstAvailableView,
  ]);

  const navItemStyle = {
    opacity: !(canGoBack() && onBackClick) ? 1 : 0,
    pointerEvents: !(canGoBack() && onBackClick) ? 'auto' : 'none',
    visibility: !(canGoBack() && onBackClick) ? 'visible' : 'hidden',
  } as const;

  const handlePinnedViewClick = (view: ViewOption) => {
    if (activeMainTab !== '咖啡豆') {
      handleMainTabClick('咖啡豆');
    }
    onBeanViewChange?.(view);

    if (settings.hapticFeedback) {
      hapticsUtils.light();
    }
  };

  // 🎯 笔记步骤中参数显示的叠加层状态（仅用于UI显示，不影响实际数据）
  const [displayOverlayState, setDisplayOverlayState] =
    useState<DisplayOverlayState | null>(null);
  const displayOverlay =
    activeBrewingStep === 'notes' &&
    editableParams &&
    displayOverlayState?.step === activeBrewingStep &&
    displayOverlayState.params === editableParams
      ? displayOverlayState.value
      : null;
  const updateDisplayOverlay = useCallback(
    (
      updater: (
        current: Partial<EditableParams> | null
      ) => Partial<EditableParams>
    ) => {
      if (activeBrewingStep !== 'notes' || !editableParams) return;

      setDisplayOverlayState(current => {
        const currentValue =
          current?.step === activeBrewingStep &&
          current.params === editableParams
            ? current.value
            : null;

        return {
          step: activeBrewingStep,
          params: editableParams,
          value: updater(currentValue),
        };
      });
    },
    [activeBrewingStep, editableParams]
  );

  // 处理抽屉开关
  const handleToggleManagementDrawer = () => {
    onToggleEquipmentManagement?.();
  };

  // 获取当前视图的显示名称
  const getCurrentViewLabel = () => {
    const labels = settings.simplifiedViewLabels
      ? SIMPLIFIED_VIEW_LABELS
      : VIEW_LABELS;

    // 如果当前视图被固定，显示最后一次选中的非固定视图
    if (isCurrentViewPinned) {
      return lastUnpinnedViewRef.current
        ? labels[lastUnpinnedViewRef.current]
        : labels[getFirstAvailableView()];
    }

    // 检查 currentBeanView 是否有效（未被固定且启用）
    const isCurrentValid =
      currentBeanView &&
      !typedPinnedViews.includes(currentBeanView) &&
      coffeeBeanViews[currentBeanView] !== false;

    if (isCurrentValid) {
      return labels[currentBeanView];
    } else {
      // 如果当前视图无效，显示第一个可用视图的名称
      // 注意：这里只是显示上的修正，实际状态切换由 useEffect 处理
      // 这样可以解决视觉上的延迟
      const fallbackView = getFirstAvailableView();
      return labels[fallbackView];
    }
  };

  // 处理咖啡豆按钮点击
  const handleBeanTabClick = () => {
    // 只剩两个可用视图时，点击直接切换视图，不弹出下拉
    if (
      activeMainTab === '咖啡豆' &&
      !isCurrentViewPinned &&
      availableViewsCount === 2
    ) {
      // 找到另一个可用视图
      const enabledViews = COFFEE_BEAN_VIEW_ORDER.filter(
        v => !typedPinnedViews.includes(v) && coffeeBeanViews[v] !== false
      );
      if (enabledViews.length === 2 && currentBeanView) {
        const nextView = enabledViews.find(v => v !== currentBeanView);
        if (nextView && nextView !== currentBeanView) {
          onBeanViewChange?.(nextView);
        }
      }
      return;
    }
    // 其余情况保持原有逻辑
    if (activeMainTab === '咖啡豆' && !isCurrentViewPinned) {
      if (availableViewsCount > 1) {
        onToggleViewDropdown?.();
      }
    } else {
      handleMainTabClick('咖啡豆');
      if (isCurrentViewPinned) {
        const targetView =
          lastUnpinnedViewRef.current || getFirstAvailableView();
        onBeanViewChange?.(targetView);
      }
    }
  };

  const handleTitleClick = () => {
    if (settings.hapticFeedback) {
      hapticsUtils.light();
    }

    if (canGoBack() && onBackClick) {
      // 🎯 修复：直接调用 onBackClick，让它内部处理历史栈逻辑
      // onBackClick 会检查 window.history.state?.brewingStep 并决定是否调用 history.back()
      onBackClick();
    } else {
      onTitleDoubleClick();
    }
  };

  useEffect(() => {
    const handleStepChanged = async (detail: { step: BrewingStep }) => {
      const methodForUpdate = selectedMethod
        ? {
            name: selectedMethod.name,
            params: {
              ...selectedMethod.params,
            },
          }
        : null;

      try {
        const { loadCustomEquipments } =
          await import('@/lib/stores/customEquipmentStore');
        const customEquipments = await loadCustomEquipments();
        updateParameterInfo(
          detail.step,
          selectedEquipment,
          methodForUpdate,
          equipmentList,
          customEquipments
        );
      } catch (error) {
        console.error('加载自定义设备失败:', error);
        updateParameterInfo(
          detail.step,
          selectedEquipment,
          methodForUpdate,
          equipmentList
        );
      }

      // 🎯 步骤改变时清除显示叠加层
      setDisplayOverlayState(null);
    };

    return listenToEvent(BREWING_EVENTS.STEP_CHANGED, handleStepChanged);
  }, [selectedEquipment, selectedMethod]);

  useEffect(() => {
    const handleParameterInfoUpdate = (detail: ParameterInfo) => {
      setParameterInfo(detail);
    };

    return listenToEvent(
      BREWING_EVENTS.PARAMS_UPDATED,
      handleParameterInfoUpdate
    );
  }, [setParameterInfo]);

  // 🎯 监听笔记步骤中的导航栏显示更新事件
  useEffect(() => {
    const handleNavbarDisplayUpdate = (e: CustomEvent) => {
      if (activeBrewingStep !== 'notes' || !editableParams) return;

      const { type, value } = e.detail;

      // 获取当前显示值（优先使用叠加层，否则使用原始值）
      const getCurrentDisplayValue = (key: keyof EditableParams) => {
        return displayOverlay?.[key] || editableParams[key] || '';
      };

      const currentCoffeeNum = parseFloat(
        getCurrentDisplayValue('coffee').replace('g', '')
      );
      const currentRatioNum = parseFloat(
        getCurrentDisplayValue('ratio').split(':')[1]
      );

      switch (type) {
        case 'coffee': {
          const coffeeValue = parseFloat(value);
          if (isNaN(coffeeValue) || coffeeValue <= 0) return;

          const calculatedWater = Math.round(coffeeValue * currentRatioNum);
          updateDisplayOverlay(prev => ({
            ...prev,
            coffee: `${coffeeValue}g`,
            water: `${calculatedWater}g`,
          }));
          break;
        }
        case 'ratio': {
          const ratioValue = parseFloat(value);
          if (isNaN(ratioValue) || ratioValue <= 0) return;

          const calculatedWater = Math.round(currentCoffeeNum * ratioValue);
          updateDisplayOverlay(prev => ({
            ...prev,
            ratio: `1:${ratioValue}`,
            water: `${calculatedWater}g`,
          }));
          break;
        }
        case 'grindSize': {
          updateDisplayOverlay(prev => ({
            ...prev,
            grindSize: value,
          }));
          break;
        }
        case 'temp': {
          const formattedTemp = value.includes('°C') ? value : `${value}°C`;
          updateDisplayOverlay(prev => ({
            ...prev,
            temp: formattedTemp,
          }));
          break;
        }
        case 'water': {
          const waterValue = value.includes('g') ? value : `${value}g`;
          updateDisplayOverlay(prev => ({
            ...prev,
            water: waterValue,
          }));
          break;
        }
        case 'time': {
          const timeValue = value.replace(/[sS秒]/g, '');
          updateDisplayOverlay(prev => ({
            ...prev,
            time: timeValue,
          }));
          break;
        }
      }
    };

    window.addEventListener(
      'brewing:updateNavbarDisplay',
      handleNavbarDisplayUpdate as EventListener
    );

    return () => {
      window.removeEventListener(
        'brewing:updateNavbarDisplay',
        handleNavbarDisplayUpdate as EventListener
      );
    };
  }, [activeBrewingStep, editableParams, displayOverlay, updateDisplayOverlay]);

  const shouldHideHeader =
    activeBrewingStep === 'brewing' && isTimerRunning && !showComplete;

  const handleMainTabClick = (tab: MainTabType) => {
    if (activeMainTab === tab) return;

    if (settings.hapticFeedback) {
      hapticsUtils.light();
    }

    // 保存主标签页选择到缓存
    saveMainTabPreference(tab);

    setActiveMainTab(tab);
    if (tab === '笔记') {
      setShowHistory(true);
    } else if (activeMainTab === '笔记') {
      setShowHistory(false);
    }
  };

  const shouldShowContent =
    activeMainTab === '冲煮' &&
    (!isTimerRunning || showComplete || activeBrewingStep === 'notes');
  const shouldShowParams = parameterInfo.method;
  const hasGrindSizeParameter =
    parameterInfo.params?.grindSize !== undefined &&
    parameterInfo.params?.grindSize !== null;
  const isNoCoffeeBeanMode =
    !hasCoffeeBeans || settings.showCoffeeBeanSelectionStep === false;
  const desktopContentTopSpacingClass =
    showDesktopTopTabs && isNoCoffeeBeanMode ? 'md:mt-6' : 'md:mt-0';
  const shouldOffsetDesktopEquipmentFromBackHeader =
    isDesktopBackLayout && activeBrewingStep === 'method';
  const desktopEquipmentTopSpacingClass =
    shouldOffsetDesktopEquipmentFromBackHeader
      ? 'md:mt-2'
      : showDesktopTopTabs && isNoCoffeeBeanMode
        ? 'md:mt-7'
        : 'md:mt-0';

  const _handleTimeChange = (value: string) => {
    if (activeBrewingStep === 'notes') {
      handleParamChange('time', value);
      return;
    }

    if (handleExtractionTimeChange && selectedMethod) {
      const time = parseInt(value, 10) || 0;
      handleExtractionTimeChange(time);
      // 同步更新 editableParams.time
      if (editableParams) {
        setEditableParams({
          ...editableParams,
          time: `${time}`,
        });
      }
    }
  };

  // 获取器具名称
  const getSelectedEquipmentName = () => {
    if (!selectedEquipment) return null;
    return getEquipmentName(selectedEquipment, equipmentList, customEquipments);
  };

  const [isPwaBannerVisible, setIsPwaBannerVisible] = useState(false);

  useEffect(() => {
    setIsPwaBannerVisible(getPwaBannerVisible());
    const handleBanner = (event: Event) => {
      const detail = (event as CustomEvent<{ visible?: boolean }>).detail;
      if (typeof detail?.visible === 'boolean') {
        setIsPwaBannerVisible(detail.visible);
      }
    };
    window.addEventListener('pwa-install-banner', handleBanner);
    return () => {
      window.removeEventListener('pwa-install-banner', handleBanner);
    };
  }, []);

  return (
    <div
      className={`${isPwaBannerVisible ? 'pt-6' : 'pt-safe-top'} sticky top-0 border-b transition-colors duration-300 ease-in-out md:relative md:flex md:h-full md:shrink-0 md:flex-col md:overflow-y-auto md:border-b-0 ${showDesktopBorder ? 'md:border-r' : ''} ${
        activeBrewingStep === 'brewing' || activeBrewingStep === 'notes'
          ? 'border-transparent md:border-neutral-200/50 dark:md:border-neutral-800/50'
          : 'border-neutral-200/50 dark:border-neutral-800/50'
      }`}
      style={{
        width: isDesktopLayout && width ? `${width}px` : '100%',
      }}
    >
      {/* 修改：创建一个固定高度的容器，用于包含默认头部和替代头部 */}
      {/* 移动端固定头部占位，桌面端使用常规流式布局 */}
      <div className="relative min-h-7.5 w-full md:static md:min-h-0">
        {/* 直接替换头部，不保留已退出页面的内容 */}
        <React.Fragment>
          {showAlternativeHeader ? (
            // 替代头部 - 移动端绝对定位，桌面端相对定位
            <div
              key="alternative-header"
              className="absolute top-0 right-0 left-0 w-full px-6 md:relative md:inset-auto"
            >
              {alternativeHeader}
            </div>
          ) : (
            // 默认头部 - 移动端绝对定位，桌面端相对定位
            <div
              key="default-header"
              className="absolute top-0 right-0 left-0 w-full px-6 md:relative md:inset-auto"
              style={{
                opacity: shouldHideHeader ? 0 : 1,
                pointerEvents: shouldHideHeader ? 'none' : 'auto',
                transition: animateNavigation
                  ? 'opacity 160ms cubic-bezier(0.23, 1, 0.32, 1)'
                  : 'none',
              }}
            >
              <div className="flex items-start justify-between md:block">
                <div
                  className="flex shrink-0 items-start md:w-full md:items-center md:justify-between"
                  onMouseEnter={() => setIsSidebarControlVisible(true)}
                  onMouseLeave={() => setIsSidebarControlVisible(false)}
                  onTouchStart={() => setIsSidebarControlVisible(true)}
                  onFocus={() => setIsSidebarControlVisible(true)}
                  onBlur={event => {
                    if (
                      !event.currentTarget.contains(
                        event.relatedTarget as Node | null
                      )
                    ) {
                      setIsSidebarControlVisible(false);
                    }
                  }}
                >
                  {/* 设置入口按钮图标 - 扩大触碰区域 */}
                  <NavigationSettingsButton
                    placement="sidebar"
                    title={
                      canGoBack() && onBackClick
                        ? '返回'
                        : isSyncing
                          ? '正在同步，点击打开设置'
                          : '设置'
                    }
                    ariaLabel={canGoBack() && onBackClick ? '返回' : '设置'}
                    ariaBusy={isSyncing}
                    onClick={handleTitleClick}
                  >
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.div
                        key={isSyncing ? 'spinner' : 'icon'}
                        initial={
                          animateNavigation
                            ? { opacity: 0, scale: 0.5, filter: 'blur(4px)' }
                            : false
                        }
                        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                        exit={{
                          opacity: 0,
                          scale: animateNavigation ? 0.5 : 1,
                          filter: animateNavigation ? 'blur(4px)' : 'blur(0px)',
                        }}
                        transition={{
                          duration: animateNavigation ? 0.3 : 0,
                          ease: [0.23, 1, 0.32, 1],
                        }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        {isSyncing ? (
                          reduceMotion ? (
                            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <LoadingSpinner className="h-3.5 w-3.5" />
                          )
                        ) : canGoBack() && onBackClick ? (
                          <ArrowLeft className="h-4 w-4" />
                        ) : (
                          <Equal className="h-4 w-4" />
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </NavigationSettingsButton>

                  {showSidebarCollapseControl && isSidebarControlVisible && (
                    <div className="-mt-3 -mr-3 hidden h-10 w-10 shrink-0 items-center justify-center md:flex">
                      {sidebarCollapseControl}
                    </div>
                  )}
                </div>

                {/* 主导航按钮 - 移动端可滚动，桌面端垂直排列 */}
                {/* 桌面端：当显示返回按钮时（进入方案后），完全隐藏导航 tab 容器 */}
                <div
                  className={`relative flex min-w-0 flex-1 items-center md:mt-2 md:min-w-0 md:flex-none md:flex-col md:items-start ${
                    isDesktopBackLayout ? 'md:hidden' : ''
                  }`}
                  style={navItemStyle}
                >
                  {/* 左侧渐变阴影 - 仅移动端 */}
                  <div
                    className={`pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-6 transition-opacity duration-200 md:hidden ${
                      showLeftBorder ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={{
                      background:
                        'linear-gradient(to right, var(--background), transparent)',
                    }}
                  />

                  {/* 可滚动容器 - 仅移动端滚动，默认右对齐 */}
                  <div
                    ref={scrollContainerRef}
                    className="scrollbar-hide ml-auto flex items-center space-x-6 overflow-x-auto md:ml-0 md:flex-col md:items-start md:space-y-4 md:space-x-0 md:overflow-visible"
                    style={{
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none',
                    }}
                  >
                    {visibleTabs.brewing && (
                      <div className="shrink-0">
                        <TabButton
                          isActive={activeMainTab === '冲煮'}
                          onClick={() => handleMainTabClick('冲煮')}
                          dataTab="冲煮"
                        >
                          冲煮
                        </TabButton>
                      </div>
                    )}

                    {showCoffeeBeanMainTab && (
                      <div className="relative shrink-0">
                        {/* 咖啡豆按钮 - 带下拉菜单 */}
                        <button
                          type="button"
                          ref={el => {
                            // 将按钮引用传递给父组件
                            if (el && typeof window !== 'undefined') {
                              (
                                window as Window & {
                                  beanButtonRef?: HTMLElement;
                                }
                              ).beanButtonRef = el;
                            }
                          }}
                          onClick={handleBeanTabClick}
                          aria-current={
                            activeMainTab === '咖啡豆' && !isCurrentViewPinned
                              ? 'page'
                              : undefined
                          }
                          aria-label="切换咖啡豆视图"
                          aria-expanded={
                            availableViewsCount > 2
                              ? showViewDropdown
                              : undefined
                          }
                          aria-controls={
                            availableViewsCount > 2
                              ? 'bean-view-options'
                              : undefined
                          }
                          className="flex cursor-pointer items-center rounded-sm pb-3 text-xs font-medium tracking-widest whitespace-nowrap transition-opacity duration-100 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/50 focus-visible:ring-offset-4 focus-visible:ring-offset-neutral-50 md:pb-0 dark:focus-visible:ring-neutral-500/60 dark:focus-visible:ring-offset-neutral-900"
                          style={{
                            opacity:
                              showViewDropdown &&
                              activeMainTab === '咖啡豆' &&
                              !isCurrentViewPinned
                                ? 0
                                : 1,
                            pointerEvents:
                              showViewDropdown &&
                              activeMainTab === '咖啡豆' &&
                              !isCurrentViewPinned
                                ? 'none'
                                : 'auto',
                            ...(showViewDropdown &&
                            activeMainTab === '咖啡豆' &&
                            !isCurrentViewPinned
                              ? { visibility: 'hidden' as const }
                              : {}),
                          }}
                          data-tab="bean-view-selector"
                        >
                          <span
                            className={`relative inline-block ${
                              activeMainTab === '咖啡豆' && !isCurrentViewPinned
                                ? 'text-neutral-800 dark:text-neutral-100'
                                : 'text-neutral-500 dark:text-neutral-400'
                            }`}
                          >
                            {getCurrentViewLabel()}
                          </span>

                          {/* 下拉图标出现和收起时平滑调整占位 */}
                          <motion.div
                            className="flex items-center justify-center overflow-hidden"
                            initial={false}
                            animate={{
                              width:
                                activeMainTab === '咖啡豆' &&
                                !isCurrentViewPinned &&
                                availableViewsCount > 1
                                  ? 12
                                  : 0,
                              marginLeft:
                                activeMainTab === '咖啡豆' &&
                                !isCurrentViewPinned &&
                                availableViewsCount > 1
                                  ? 4
                                  : 0,
                            }}
                            transition={{
                              duration: animateNavigation ? 0.35 : 0,
                              ease: [0.25, 0.46, 0.45, 0.94],
                            }}
                          >
                            <AnimatePresence mode="wait">
                              {activeMainTab === '咖啡豆' &&
                                !isCurrentViewPinned &&
                                availableViewsCount > 1 && (
                                  <motion.div
                                    key="chevron-icon"
                                    initial={
                                      animateNavigation
                                        ? { opacity: 0, scale: 0.8 }
                                        : false
                                    }
                                    animate={{
                                      opacity: 1,
                                      scale: 1,
                                      transition: {
                                        duration: animateNavigation ? 0.35 : 0,
                                        ease: [0.25, 0.46, 0.45, 0.94],
                                        opacity: {
                                          duration: animateNavigation ? 0.25 : 0,
                                          delay: animateNavigation ? 0.1 : 0,
                                        },
                                      },
                                    }}
                                    exit={{
                                      opacity: 0,
                                      scale: animateNavigation ? 0.8 : 1,
                                      transition: {
                                        duration: animateNavigation ? 0.15 : 0,
                                        ease: [0.4, 0, 1, 1],
                                      },
                                    }}
                                    className="flex h-3 w-3 shrink-0 items-center justify-center"
                                  >
                                    <ChevronsUpDown
                                      size={12}
                                      className="text-neutral-400 dark:text-neutral-600"
                                      color="currentColor"
                                    />
                                  </motion.div>
                                )}
                            </AnimatePresence>
                          </motion.div>
                        </button>
                      </div>
                    )}

                    {/* Pinned Views */}
                    {typedPinnedViews.map(view => (
                      <div key={view} className="shrink-0">
                        <TabButton
                          isActive={
                            activeMainTab === '咖啡豆' &&
                            currentBeanView === view
                          }
                          onClick={() => handlePinnedViewClick(view)}
                          dataTab={view}
                        >
                          {settings.simplifiedViewLabels
                            ? SIMPLIFIED_VIEW_LABELS[view]
                            : VIEW_LABELS[view]}
                        </TabButton>
                      </div>
                    ))}

                    {visibleTabs.notes && (
                      <div className="shrink-0">
                        <TabButton
                          isActive={activeMainTab === '笔记'}
                          onClick={() => handleMainTabClick('笔记')}
                          dataTab="笔记"
                        >
                          笔记
                        </TabButton>
                      </div>
                    )}
                  </div>

                  {/* 右侧渐变阴影 - 仅移动端 */}
                  <div
                    className={`pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-6 transition-opacity duration-200 md:hidden ${
                      showRightBorder ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={{
                      background:
                        'linear-gradient(to left, var(--background), transparent)',
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </React.Fragment>
      </div>

      {/* 仅当不显示替代头部内容时才显示参数栏和步骤指示器 */}
      <div className="overflow-hidden">
        {/* 参数栏 */}
        <NavigationSection
          open={
            !showAlternativeHeader && shouldShowContent && Boolean(shouldShowParams)
          }
          animated={animateNavigation}
          className="overflow-hidden"
        >
          <div
            className={`bg-neutral-100 px-6 py-2 text-xs font-medium text-neutral-500 select-text md:px-6 md:py-3 dark:bg-neutral-800/40 dark:text-neutral-400 ${desktopContentTopSpacingClass}`}
          >
            <div className="flex items-center justify-between gap-3 md:flex-col md:items-start md:gap-6">
              {/* 左侧：方案名称区域 - 使用省略号 */}
              <div className="flex min-w-0 flex-1 items-center overflow-hidden md:w-full md:flex-none md:flex-col md:items-start md:gap-1">
                {parameterInfo.method && (
                  <>
                    {getSelectedEquipmentName() && (
                      <span className="truncate md:text-wrap">
                        {getSelectedEquipmentName()}
                      </span>
                    )}
                    {getSelectedEquipmentName() && (
                      <>
                        <span className="mx-1 shrink-0 select-none md:hidden">
                          ·
                        </span>
                        <span className="hidden shrink-0 text-neutral-300 select-none md:inline dark:text-neutral-700">
                          /
                        </span>
                      </>
                    )}
                    <span className="truncate md:text-wrap">
                      {parameterInfo.method}
                    </span>
                  </>
                )}
              </div>

              {/* 右侧：参数区域 - 固定不压缩 - 桌面端全宽显示 */}
              {parameterInfo.params && (
                <div className="flex shrink-0 items-center md:w-full md:flex-col md:items-start md:gap-1">
                  {espressoUtils.isEspresso(selectedMethod) ? (
                    // 意式参数显示
                    editableParams ? (
                      <div className="flex items-center space-x-1 sm:space-x-2 md:flex-col md:items-start md:space-y-2 md:space-x-0">
                        <EditableParameter
                          value={(
                            displayOverlay?.coffee ||
                            editableParams.coffee
                          ).replace('g', '')}
                          onChange={v =>
                            handleParamChange('coffee', v)
                          }
                          unit="g"
                        />
                        <span className="shrink-0 select-none md:hidden">
                          ·
                        </span>
                        <span className="hidden shrink-0 text-neutral-300 select-none md:inline dark:text-neutral-700">
                          /
                        </span>
                        <GrindSizeInput
                          value={
                            displayOverlay?.grindSize ||
                            editableParams.grindSize
                          }
                          onChange={v =>
                            handleParamChange('grindSize', v)
                          }
                          className="inline-flex min-w-0"
                          inputClassName="w-auto bg-transparent text-center text-xs outline-hidden border-b border-dashed border-neutral-300 pb-0.5 dark:border-neutral-600"
                          autoWidth
                        />
                        <span className="shrink-0 select-none md:hidden">
                          ·
                        </span>
                        <span className="hidden shrink-0 text-neutral-300 select-none md:inline dark:text-neutral-700">
                          /
                        </span>
                        <EditableParameter
                          value={
                            displayOverlay?.time ||
                            editableParams.time ||
                            espressoUtils.formatTime(
                              espressoUtils.getExtractionTime(
                                selectedMethod
                              )
                            )
                          }
                          onChange={v => _handleTimeChange(v)}
                          unit="s"
                        />
                        <span className="shrink-0 select-none md:hidden">
                          ·
                        </span>
                        <span className="hidden shrink-0 text-neutral-300 select-none md:inline dark:text-neutral-700">
                          /
                        </span>
                        <EditableParameter
                          value={(
                            displayOverlay?.water ||
                            editableParams.water
                          ).replace('g', '')}
                          onChange={v =>
                            handleParamChange('water', v)
                          }
                          unit="g"
                        />
                      </div>
                    ) : (
                      <div
                        className="flex cursor-pointer items-center space-x-1 transition-colors hover:text-neutral-700 sm:space-x-2 md:flex-col md:items-start md:space-y-2 md:space-x-0 dark:hover:text-neutral-300"
                        onClick={() => {
                          if (selectedMethod && !isTimerRunning) {
                            setEditableParams({
                              coffee: selectedMethod.params.coffee,
                              water: selectedMethod.params.water,
                              ratio: selectedMethod.params.ratio,
                              grindSize:
                                selectedMethod.params.grindSize,
                              temp: selectedMethod.params.temp,
                              time: espressoUtils.formatTime(
                                espressoUtils.getExtractionTime(
                                  selectedMethod
                                )
                              ),
                            });
                          }
                        }}
                      >
                        <span className="whitespace-nowrap">
                          {parameterInfo.params.coffee}
                        </span>
                        <span className="shrink-0 select-none md:hidden">
                          ·
                        </span>
                        <span className="hidden shrink-0 text-neutral-300 select-none md:inline dark:text-neutral-700">
                          /
                        </span>
                        <span className="whitespace-nowrap">
                          {parameterInfo.params.grindSize || ''}
                        </span>
                        <span className="shrink-0 select-none md:hidden">
                          ·
                        </span>
                        <span className="hidden shrink-0 text-neutral-300 select-none md:inline dark:text-neutral-700">
                          /
                        </span>
                        <span className="whitespace-nowrap">
                          {espressoUtils.formatTime(
                            espressoUtils.getExtractionTime(
                              selectedMethod
                            )
                          )}
                          s
                        </span>
                        <span className="shrink-0 select-none md:hidden">
                          ·
                        </span>
                        <span className="hidden shrink-0 text-neutral-300 select-none md:inline dark:text-neutral-700">
                          /
                        </span>
                        <span className="whitespace-nowrap">
                          {parameterInfo.params.water}
                        </span>
                      </div>
                    )
                  ) : // 原有参数显示
                  editableParams ? (
                    <div className="flex items-center space-x-1 sm:space-x-2 md:flex-col md:items-start md:space-y-2 md:space-x-0">
                      <EditableParameter
                        value={(
                          displayOverlay?.coffee ||
                          editableParams.coffee
                        ).replace('g', '')}
                        onChange={v => handleParamChange('coffee', v)}
                        unit="g"
                      />
                      <span className="shrink-0 select-none md:hidden">
                        ·
                      </span>
                      <span className="hidden shrink-0 text-neutral-300 select-none md:inline dark:text-neutral-700">
                        /
                      </span>
                      <EditableParameter
                        value={(
                          displayOverlay?.ratio ||
                          editableParams.ratio
                        ).replace('1:', '')}
                        onChange={v => handleParamChange('ratio', v)}
                        unit=""
                        prefix="1:"
                      />
                      {hasGrindSizeParameter && (
                        <>
                          <span className="shrink-0 select-none md:hidden">
                            ·
                          </span>
                          <span className="hidden shrink-0 text-neutral-300 select-none md:inline dark:text-neutral-700">
                            /
                          </span>
                          <GrindSizeInput
                            value={
                              displayOverlay?.grindSize ||
                              editableParams.grindSize
                            }
                            onChange={v =>
                              handleParamChange('grindSize', v)
                            }
                            className="inline-flex min-w-0"
                            inputClassName="w-auto bg-transparent text-center text-xs outline-hidden border-b border-dashed border-neutral-300 pb-0.5 dark:border-neutral-600"
                            autoWidth
                          />
                        </>
                      )}
                      {parameterInfo.params?.temp && (
                        <>
                          <span className="shrink-0 select-none md:hidden">
                            ·
                          </span>
                          <span className="hidden shrink-0 text-neutral-300 select-none md:inline dark:text-neutral-700">
                            /
                          </span>
                          <EditableParameter
                            value={(
                              displayOverlay?.temp ||
                              editableParams.temp
                            ).replace('°C', '')}
                            onChange={v =>
                              handleParamChange('temp', v)
                            }
                            unit="°C"
                          />
                        </>
                      )}
                    </div>
                  ) : (
                    <div
                      className="flex cursor-pointer items-center space-x-1 transition-colors hover:text-neutral-700 sm:space-x-2 md:flex-col md:items-start md:space-y-2 md:space-x-0 dark:hover:text-neutral-300"
                      onClick={() => {
                        if (selectedMethod && !isTimerRunning) {
                          setEditableParams({
                            coffee: selectedMethod.params.coffee,
                            water: selectedMethod.params.water,
                            ratio: selectedMethod.params.ratio,
                            grindSize:
                              selectedMethod.params.grindSize,
                            temp: selectedMethod.params.temp,
                          });
                        }
                      }}
                    >
                      <span className="whitespace-nowrap">
                        {parameterInfo.params.coffee}
                      </span>
                      <span className="shrink-0 select-none md:hidden">
                        ·
                      </span>
                      <span className="hidden shrink-0 text-neutral-300 select-none md:inline dark:text-neutral-700">
                        /
                      </span>
                      <span className="whitespace-nowrap">
                        {parameterInfo.params.ratio}
                      </span>
                      <span className="shrink-0 select-none md:hidden">
                        ·
                      </span>
                      <span className="hidden shrink-0 text-neutral-300 select-none md:inline dark:text-neutral-700">
                        /
                      </span>
                      <span className="whitespace-nowrap">
                        {parameterInfo.params.grindSize || ''}
                      </span>
                      <span className="shrink-0 select-none md:hidden">
                        ·
                      </span>
                      <span className="hidden shrink-0 select-none md:inline">
                        /
                      </span>
                      <span className="whitespace-nowrap">
                        {parameterInfo.params.temp}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </NavigationSection>

        {/* 器具分类栏 - 只在方案步骤时显示 */}
        <NavigationSection
          open={
            !showAlternativeHeader && shouldShowContent && activeBrewingStep === 'method'
          }
          animated={animateNavigation}
          className="mx-6 overflow-hidden md:mr-3"
        >
          <EquipmentBar
            selectedEquipment={selectedEquipment}
            customEquipments={customEquipments}
            onEquipmentSelect={onEquipmentSelect || (() => {})}
            onToggleManagementDrawer={handleToggleManagementDrawer}
            settings={settings}
            className={desktopEquipmentTopSpacingClass}
          />
        </NavigationSection>
      </div>
    </div>
  );
};

export default NavigationBar;
