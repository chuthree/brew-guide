'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { useSyncStatusStore } from '@/lib/stores/syncStatusStore';
import {
  useScrollToSelected,
  useScrollBorder,
} from '@/lib/equipment/useScrollToSelected';
import DesktopGlobalSearch from '@/components/layout/DesktopGlobalSearch';

import { Equal, ArrowLeft, ChevronsUpDown, Upload } from 'lucide-react';

// Apple 风格的加载指示器 - 多条线段围成一圈
const AppleSpinner: React.FC<{ className?: string }> = ({ className = '' }) => {
  const lines = 8;
  return (
    <div className={`relative ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="absolute top-1/2 left-1/2 h-[30%] w-[8%] origin-[center_170%] rounded-full bg-current"
          style={{
            transform: `translateX(-50%) translateY(-170%) rotate(${i * (360 / lines)}deg)`,
            opacity: 1 - (i / lines) * 0.75,
            animation: `apple-spinner ${lines * 0.1}s linear infinite`,
            animationDelay: `${-i * 0.1}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes apple-spinner {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0.25;
          }
        }
      `}</style>
    </div>
  );
};
import { saveMainTabPreference } from '@/lib/navigation/navigationCache';
import {
  ViewOption,
  VIEW_LABELS,
  SIMPLIFIED_VIEW_LABELS,
  VIEW_OPTIONS,
} from '@/components/coffee-bean/List/constants';

// 统一类型定义
type MainTabType = '冲煮' | '咖啡豆' | '笔记';
type BrewingStep = 'coffeeBean' | 'method' | 'brewing' | 'notes';

interface EditableParams {
  coffee: string;
  water: string;
  ratio: string;
  grindSize: string;
  temp: string;
  time?: string;
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

// 优化的 TabButton 组件 - 使用更简洁的条件渲染和样式计算
interface TabButtonProps {
  tab: string;
  isActive: boolean;
  isDisabled?: boolean;
  onClick?: () => void;
  className?: string;
  dataTab?: string;
}

const TabButton: React.FC<TabButtonProps> = ({
  tab,
  isActive,
  isDisabled = false,
  onClick,
  className = '',
  dataTab,
}) => {
  const baseClasses =
    'text-xs font-medium tracking-widest whitespace-nowrap pb-3 md:pb-0';
  const stateClasses = isActive
    ? 'text-neutral-800 dark:text-neutral-100'
    : isDisabled
      ? 'text-neutral-300 dark:text-neutral-600'
      : 'cursor-pointer text-neutral-500 dark:text-neutral-400';

  return (
    <div
      onClick={!isDisabled && onClick ? onClick : undefined}
      className={`${baseClasses} ${stateClasses} ${className}`}
      data-tab={dataTab}
    >
      <span className="relative inline-block">{tab}</span>
    </div>
  );
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

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
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

// 下拉上传的同步状态类型
type PullSyncStatus =
  | 'idle'
  | 'pulling'
  | 'ready'
  | 'syncing'
  | 'success'
  | 'error';

// 下拉触发阈值（需要下拉更多距离才能触发，避免误触）
const PULL_THRESHOLD = 100;

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
  // 下拉上传相关 props
  cloudSyncEnabled?: boolean;
  onPullToSync?: () => Promise<{ success: boolean; message?: string }>;
  // 大屏幕宽度调整相关 props
  width?: number;
  isResizing?: boolean;
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
  cloudSyncEnabled = false,
  onPullToSync,
  width,
  isResizing,
}) => {
  const { canGoBack } = useNavigation(
    activeBrewingStep,
    activeMainTab,
    hasCoffeeBeans,
    settings.showCoffeeBeanSelectionStep
  );

  // 获取同步状态（只在同步时显示转圈）
  const syncStatus = useSyncStatusStore(state => state.status);
  const syncProvider = useSyncStatusStore(state => state.provider);
  const isInitialSyncing = useSyncStatusStore(state => state.isInitialSyncing);

  // 判断是否正在同步
  const isSyncing = syncStatus === 'syncing' || isInitialSyncing;

  const {
    visibleTabs = { brewing: true, coffeeBean: true, notes: true },
    pinnedViews = [],
    coffeeBeanViews = {
      [VIEW_OPTIONS.INVENTORY]: true,
      [VIEW_OPTIONS.RANKING]: true,
      [VIEW_OPTIONS.STATS]: true,
    },
  } = settings.navigationSettings || {};

  // 类型断言：pinnedViews 从 db 存储时为 string[]，运行时实际为 ViewOption[]
  const typedPinnedViews = pinnedViews as ViewOption[];

  // 计算可用视图数量
  const availableViewsCount = Object.values(VIEW_OPTIONS).filter(view => {
    if (typedPinnedViews.includes(view)) return false;
    return coffeeBeanViews[view] !== false;
  }).length;

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
    (visibleTabs.coffeeBean && availableViewsCount > 0 ? 1 : 0) +
    typedPinnedViews.length +
    (visibleTabs.notes ? 1 : 0);

  // 可滚动导航栏
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 使用现有的滚动 hooks
  useScrollToSelected({
    selectedItem: getSelectedTabId(),
    containerRef: scrollContainerRef,
    delay: 100,
  });

  const { showLeftBorder, showRightBorder } = useScrollBorder({
    containerRef: scrollContainerRef,
    itemCount: tabCount,
  });

  // 获取第一个未被固定且允许显示的视图作为默认视图
  const getFirstAvailableView = useCallback(() => {
    const allViews = Object.values(VIEW_OPTIONS);
    const availableView = allViews.find(view => {
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
  const [displayOverlay, setDisplayOverlay] =
    useState<Partial<EditableParams> | null>(null);

  // ==================== 下拉上传状态和逻辑 ====================
  const [pullDistance, setPullDistance] = useState(0);
  const [pullSyncStatus, setPullSyncStatus] = useState<PullSyncStatus>('idle');
  const [pullSyncMessage, setPullSyncMessage] = useState('');
  const touchStartY = useRef<number>(0);
  const isTrackingPull = useRef(false);

  // 重置下拉状态
  const resetPullState = useCallback(() => {
    setPullDistance(0);
    setPullSyncStatus('idle');
    setPullSyncMessage('');
    isTrackingPull.current = false;
  }, []);

  // 执行同步
  const performPullSync = useCallback(async () => {
    if (pullSyncStatus === 'syncing' || !onPullToSync) return;

    setPullSyncStatus('syncing');

    if (settings.hapticFeedback) {
      hapticsUtils.medium();
    }

    try {
      const result = await onPullToSync();

      // 使用 Toast 提示结果
      const { showToast } =
        await import('@/components/common/feedback/LightToast');

      if (result.success) {
        if (settings.hapticFeedback) {
          hapticsUtils.success();
        }
        showToast({
          type: 'success',
          title: result.message || '上传成功',
          duration: 2000,
        });
      } else {
        if (settings.hapticFeedback) {
          hapticsUtils.error();
        }
        showToast({
          type: 'error',
          title: result.message || '上传失败',
          duration: 2500,
        });
      }

      // 立即重置状态
      resetPullState();
    } catch (error) {
      if (settings.hapticFeedback) {
        hapticsUtils.error();
      }

      const { showToast } =
        await import('@/components/common/feedback/LightToast');
      showToast({
        type: 'error',
        title: error instanceof Error ? error.message : '上传失败',
        duration: 2500,
      });

      resetPullState();
    }
  }, [pullSyncStatus, onPullToSync, settings.hapticFeedback, resetPullState]);

  // 下拉触摸开始
  const handlePullTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!cloudSyncEnabled || !onPullToSync || pullSyncStatus === 'syncing')
        return;

      touchStartY.current = e.touches[0].clientY;
      isTrackingPull.current = true;
    },
    [cloudSyncEnabled, onPullToSync, pullSyncStatus]
  );

  // 下拉触摸移动
  const handlePullTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (
        !cloudSyncEnabled ||
        !isTrackingPull.current ||
        pullSyncStatus === 'syncing'
      )
        return;

      const currentY = e.touches[0].clientY;
      const deltaY = currentY - touchStartY.current;

      // 只在下拉时响应
      if (deltaY > 0) {
        // 阻尼效果
        const distance = Math.min(deltaY * 0.5, PULL_THRESHOLD * 1.5);
        setPullDistance(distance);

        if (distance >= PULL_THRESHOLD) {
          if (pullSyncStatus !== 'ready') {
            setPullSyncStatus('ready');
            if (settings.hapticFeedback) {
              hapticsUtils.light();
            }
          }
        } else {
          if (pullSyncStatus !== 'pulling' && pullSyncStatus !== 'idle') {
            setPullSyncStatus('pulling');
          }
        }
      }
    },
    [cloudSyncEnabled, pullSyncStatus, settings.hapticFeedback]
  );

  // 下拉触摸结束
  const handlePullTouchEnd = useCallback(() => {
    if (!cloudSyncEnabled || pullSyncStatus === 'syncing') return;

    if (pullSyncStatus === 'ready' && pullDistance >= PULL_THRESHOLD) {
      // 触发同步
      performPullSync();
    } else {
      // 重置
      resetPullState();
    }

    isTrackingPull.current = false;
  }, [
    cloudSyncEnabled,
    pullSyncStatus,
    pullDistance,
    performPullSync,
    resetPullState,
  ]);

  // 获取下拉指示器颜色
  const getPullIndicatorColor = () => {
    switch (pullSyncStatus) {
      case 'syncing':
        return 'text-neutral-600 dark:text-neutral-300';
      case 'ready':
        return 'text-neutral-700 dark:text-neutral-200';
      default:
        return 'text-neutral-400 dark:text-neutral-500';
    }
  };

  // 获取下拉指示器图标
  const getPullIndicatorIcon = () => {
    if (pullSyncStatus === 'syncing') {
      return (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      );
    }
    // 上传图标默认朝上，不需要旋转
    return <Upload className="h-4 w-4" />;
  };

  // 获取下拉显示文本
  const getPullDisplayText = () => {
    switch (pullSyncStatus) {
      case 'ready':
        return '松开上传';
      case 'syncing':
        return '正在上传...';
      default:
        return '下拉上传';
    }
  };

  // 是否显示下拉指示器
  const showPullIndicator =
    cloudSyncEnabled &&
    onPullToSync &&
    (pullDistance > 0 || pullSyncStatus === 'syncing');
  // ==================== 下拉上传状态和逻辑结束 ====================

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
      const allViews = Object.values(VIEW_OPTIONS);
      const enabledViews = allViews.filter(
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
      setDisplayOverlay(null);
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
          setDisplayOverlay(prev => ({
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
          setDisplayOverlay(prev => ({
            ...prev,
            ratio: `1:${ratioValue}`,
            water: `${calculatedWater}g`,
          }));
          break;
        }
        case 'grindSize': {
          setDisplayOverlay(prev => ({
            ...prev,
            grindSize: value,
          }));
          break;
        }
        case 'temp': {
          const formattedTemp = value.includes('°C') ? value : `${value}°C`;
          setDisplayOverlay(prev => ({
            ...prev,
            temp: formattedTemp,
          }));
          break;
        }
        case 'water': {
          const waterValue = value.includes('g') ? value : `${value}g`;
          setDisplayOverlay(prev => ({
            ...prev,
            water: waterValue,
          }));
          break;
        }
        case 'time': {
          const timeValue = value.replace(/[sS秒]/g, '');
          setDisplayOverlay(prev => ({
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
  }, [activeBrewingStep, editableParams, displayOverlay]);

  // 🎯 当 editableParams 变为 null 或步骤不是 notes 时，清除显示叠加层
  useEffect(() => {
    if (!editableParams || activeBrewingStep !== 'notes') {
      setDisplayOverlay(null);
    }
  }, [editableParams, activeBrewingStep]);

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
  const isDesktopBackLayout = Boolean(canGoBack() && onBackClick);
  const showDesktopTopTabs = !isDesktopBackLayout;
  const isNoCoffeeBeanMode =
    !hasCoffeeBeans || settings.showCoffeeBeanSelectionStep === false;
  const desktopContentTopSpacingClass =
    showDesktopTopTabs && isNoCoffeeBeanMode ? 'md:mt-6' : 'md:mt-0';
  const desktopEquipmentTopSpacingClass =
    showDesktopTopTabs && isNoCoffeeBeanMode ? 'md:mt-7' : 'md:mt-0';

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

  // 计算下拉时的额外高度
  const pullExtraHeight = showPullIndicator
    ? pullSyncStatus === 'syncing'
      ? 40
      : Math.min(pullDistance, PULL_THRESHOLD * 1.2)
    : 0;

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
    <motion.div
      className={`${isPwaBannerVisible ? 'pt-6' : 'pt-safe-top'} sticky top-0 border-b transition-colors duration-300 ease-in-out md:relative md:flex md:h-full md:shrink-0 md:flex-col md:overflow-y-auto md:border-r md:border-b-0 ${
        isResizing
          ? ''
          : 'md:transition-[width,border-color] md:duration-350 md:ease-[cubic-bezier(0.4,0,0.2,1)]'
      } ${
        activeBrewingStep === 'brewing' || activeBrewingStep === 'notes'
          ? 'border-transparent md:border-neutral-200/50 dark:md:border-neutral-800/50'
          : 'border-neutral-200/50 dark:border-neutral-800/50'
      }`}
      style={{
        width: width ? `${width}px` : undefined,
      }}
      transition={{ duration: 0.3 }}
      onTouchStart={handlePullTouchStart}
      onTouchMove={handlePullTouchMove}
      onTouchEnd={handlePullTouchEnd}
    >
      {/* 下拉上传指示器 - 绝对定位，在整个导航栏（安全区域 + 下拉区域 + 标签区域）内居中 - 仅移动端显示 */}
      {showPullIndicator && (
        <div
          className="absolute inset-x-0 top-0 z-50 flex items-center justify-center md:hidden"
          style={{
            // 总高度 = 安全区域 + 下拉区域 + 导航栏标签高度(约30px)
            height: `calc(env(safe-area-inset-top) + ${pullExtraHeight}px + 30px)`,
            opacity: Math.min(1, pullDistance / (PULL_THRESHOLD * 0.6)),
            transition:
              pullSyncStatus === 'syncing' ? 'opacity 0.3s ease-out' : 'none',
            pointerEvents: 'none',
          }}
        >
          <div
            className={`flex items-center gap-2 text-xs font-medium ${getPullIndicatorColor()}`}
          >
            {getPullIndicatorIcon()}
            <span>{getPullDisplayText()}</span>
          </div>
        </div>
      )}

      {/* 下拉上传指示器区域 - 占位用，撑开高度 - 仅移动端 */}
      <div
        className="md:hidden"
        style={{
          height: `${pullExtraHeight}px`,
          transition:
            pullSyncStatus === 'syncing' || pullDistance === 0
              ? 'height 0.3s ease-out'
              : 'none',
        }}
      />

      <AnimatePresence initial={false}>
        {activeMainTab !== '冲煮' && (
          <motion.div
            key="desktop-global-search"
            className="hidden overflow-hidden md:block"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
              opacity: { duration: 0.16 },
            }}
          >
            <DesktopGlobalSearch
              enabled={true}
              settings={settings}
              customEquipments={customEquipments}
              onSelectBean={(bean, searchQuery) => {
                handleMainTabClick('咖啡豆');
                window.dispatchEvent(
                  new CustomEvent('beanDetailOpened', {
                    detail: {
                      bean,
                      searchQuery,
                    },
                  })
                );
              }}
              onSelectNote={({
                note,
                equipmentName,
                beanUnitPrice,
                beanInfo,
              }) => {
                handleMainTabClick('笔记');
                window.dispatchEvent(
                  new CustomEvent('noteDetailOpened', {
                    detail: {
                      note,
                      equipmentName,
                      beanUnitPrice,
                      beanInfo,
                    },
                  })
                );
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 修改：创建一个固定高度的容器，用于包含默认头部和替代头部 */}
      {/* 移动端使用 min-h 和绝对定位实现切换动画，桌面端使用常规流式布局 */}
      <div className="relative min-h-[30px] w-full md:static md:min-h-0">
        {/* 修改：将AnimatePresence用于透明度变化而非高度变化 */}
        <AnimatePresence mode="wait">
          {showAlternativeHeader ? (
            // 替代头部 - 移动端绝对定位，桌面端相对定位
            <motion.div
              key="alternative-header"
              className="absolute top-0 right-0 left-0 w-full px-6 md:relative md:inset-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {alternativeHeader}
            </motion.div>
          ) : (
            // 默认头部 - 移动端绝对定位，桌面端相对定位
            <motion.div
              key="default-header"
              className="absolute top-0 right-0 left-0 w-full px-6 md:relative md:inset-auto"
              initial={{ opacity: shouldHideHeader ? 0 : 1 }}
              animate={{ opacity: shouldHideHeader ? 0 : 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ pointerEvents: shouldHideHeader ? 'none' : 'auto' }}
            >
              <div className="flex items-start justify-between md:flex-col">
                {/* 设置入口按钮图标 - 扩大触碰区域 */}
                <div
                  onClick={handleTitleClick}
                  className="-mt-3 -ml-3 flex cursor-pointer items-center pt-3 pr-4 pb-3 pl-3 text-[12px] tracking-widest text-neutral-500 dark:text-neutral-400"
                >
                  <div className="relative flex h-4 w-4 items-center justify-center">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {syncProvider === 'supabase' && isSyncing ? (
                        <motion.div
                          key="spinner"
                          initial={{
                            opacity: 0,
                            scale: 0.5,
                            filter: 'blur(4px)',
                          }}
                          animate={{
                            opacity: 1,
                            scale: 1,
                            filter: 'blur(0px)',
                          }}
                          exit={{ opacity: 0, scale: 0.5, filter: 'blur(4px)' }}
                          transition={{
                            duration: 0.3,
                            ease: [0.23, 1, 0.32, 1], // cubic-bezier for smooth feel
                          }}
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          <AppleSpinner className="h-3.5 w-3.5" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="icon"
                          initial={{
                            opacity: 0,
                            scale: 0.5,
                            filter: 'blur(4px)',
                          }}
                          animate={{
                            opacity: 1,
                            scale: 1,
                            filter: 'blur(0px)',
                          }}
                          exit={{ opacity: 0, scale: 0.5, filter: 'blur(4px)' }}
                          transition={{
                            duration: 0.3,
                            ease: [0.23, 1, 0.32, 1],
                          }}
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          {canGoBack() && onBackClick ? (
                            <ArrowLeft className="h-4 w-4" />
                          ) : (
                            <Equal className="h-4 w-4" />
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
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
                          tab="冲煮"
                          isActive={activeMainTab === '冲煮'}
                          onClick={() => handleMainTabClick('冲煮')}
                          dataTab="冲煮"
                        />
                      </div>
                    )}

                    {visibleTabs.coffeeBean && availableViewsCount > 0 && (
                      <div className="relative shrink-0">
                        {/* 咖啡豆按钮 - 带下拉菜单 */}
                        <div
                          ref={el => {
                            // 将按钮引用传递给父组件
                            if (el && typeof window !== 'undefined') {
                              (
                                window as Window & {
                                  beanButtonRef?: HTMLDivElement;
                                }
                              ).beanButtonRef = el;
                            }
                          }}
                          onClick={handleBeanTabClick}
                          className="flex cursor-pointer items-center pb-3 text-xs font-medium tracking-widest whitespace-nowrap transition-opacity duration-100 md:pb-0"
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

                          {/* 下拉图标容器 - 使用动画宽度避免布局抖动 */}
                          <motion.div
                            className="flex items-center justify-center overflow-hidden"
                            initial={false}
                            animate={{
                              width:
                                activeMainTab === '咖啡豆' &&
                                !isCurrentViewPinned &&
                                availableViewsCount > 1
                                  ? '12px'
                                  : '0px',
                              marginLeft:
                                activeMainTab === '咖啡豆' &&
                                !isCurrentViewPinned &&
                                availableViewsCount > 1
                                  ? '4px'
                                  : '0px',
                              transition: {
                                duration: 0.35,
                                ease: [0.25, 0.46, 0.45, 0.94], // Apple的标准缓动
                              },
                            }}
                          >
                            <AnimatePresence mode="wait">
                              {activeMainTab === '咖啡豆' &&
                                !isCurrentViewPinned &&
                                availableViewsCount > 1 && (
                                  <motion.div
                                    key="chevron-icon"
                                    initial={{
                                      opacity: 0,
                                      scale: 0.8,
                                    }}
                                    animate={{
                                      opacity: 1,
                                      scale: 1,
                                      transition: {
                                        duration: 0.35,
                                        ease: [0.25, 0.46, 0.45, 0.94], // Apple的标准缓动
                                        opacity: { duration: 0.25, delay: 0.1 }, // 稍微延迟透明度动画
                                        scale: { duration: 0.35 },
                                      },
                                    }}
                                    exit={{
                                      opacity: 0,
                                      scale: 0.8,
                                      transition: {
                                        duration: 0.15,
                                        ease: [0.4, 0.0, 1, 1], // Apple的退出缓动
                                        opacity: { duration: 0.15 },
                                        scale: { duration: 0.15 },
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
                        </div>
                      </div>
                    )}

                    {/* Pinned Views */}
                    {typedPinnedViews.map(view => (
                      <div key={view} className="shrink-0">
                        <TabButton
                          tab={
                            settings.simplifiedViewLabels
                              ? SIMPLIFIED_VIEW_LABELS[view]
                              : VIEW_LABELS[view]
                          }
                          isActive={
                            activeMainTab === '咖啡豆' &&
                            currentBeanView === view
                          }
                          onClick={() => handlePinnedViewClick(view)}
                          dataTab={view}
                        />
                      </div>
                    ))}

                    {visibleTabs.notes && (
                      <div className="shrink-0">
                        <TabButton
                          tab="笔记"
                          isActive={activeMainTab === '笔记'}
                          onClick={() => handleMainTabClick('笔记')}
                          dataTab="笔记"
                        />
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 仅当不显示替代头部内容时才显示参数栏和步骤指示器 */}
      {!showAlternativeHeader && (
        <AnimatePresence mode="wait">
          {shouldShowContent && (
            <motion.div
              key="content-container"
              className="overflow-hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                duration: 0.25,

                opacity: { duration: 0.15 },
              }}
            >
              {/* 参数栏 - 添加高度动画 */}
              <AnimatePresence mode="wait">
                {shouldShowParams && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      duration: 0.3,
                      ease: [0.4, 0, 0.2, 1],
                      opacity: { duration: 0.2 },
                    }}
                    className="overflow-hidden"
                  >
                    <div
                      className={`bg-neutral-100 px-6 py-2 text-xs font-medium text-neutral-500 md:px-6 md:py-3 dark:bg-neutral-800/40 dark:text-neutral-400 ${desktopContentTopSpacingClass}`}
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
                                  <span className="mx-1 shrink-0 md:hidden">
                                    ·
                                  </span>
                                  <span className="hidden shrink-0 text-neutral-300 md:inline dark:text-neutral-700">
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
                                  <span className="shrink-0 md:hidden">·</span>
                                  <span className="hidden shrink-0 text-neutral-300 md:inline dark:text-neutral-700">
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
                                    defaultSyncEnabled={
                                      settings.grinderDefaultSync
                                        ?.navigationBar ?? true
                                    }
                                  />
                                  <span className="shrink-0 md:hidden">·</span>
                                  <span className="hidden shrink-0 text-neutral-300 md:inline dark:text-neutral-700">
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
                                  <span className="shrink-0 md:hidden">·</span>
                                  <span className="hidden shrink-0 text-neutral-300 md:inline dark:text-neutral-700">
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
                                  <span className="shrink-0 md:hidden">·</span>
                                  <span className="hidden shrink-0 text-neutral-300 md:inline dark:text-neutral-700">
                                    /
                                  </span>
                                  <span className="whitespace-nowrap">
                                    {parameterInfo.params.grindSize || ''}
                                  </span>
                                  <span className="shrink-0 md:hidden">·</span>
                                  <span className="hidden shrink-0 text-neutral-300 md:inline dark:text-neutral-700">
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
                                  <span className="shrink-0 md:hidden">·</span>
                                  <span className="hidden shrink-0 text-neutral-300 md:inline dark:text-neutral-700">
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
                                <span className="shrink-0 md:hidden">·</span>
                                <span className="hidden shrink-0 text-neutral-300 md:inline dark:text-neutral-700">
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
                                {parameterInfo.params?.grindSize && (
                                  <>
                                    <span className="shrink-0 md:hidden">
                                      ·
                                    </span>
                                    <span className="hidden shrink-0 text-neutral-300 md:inline dark:text-neutral-700">
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
                                      defaultSyncEnabled={
                                        settings.grinderDefaultSync
                                          ?.navigationBar ?? true
                                      }
                                    />
                                  </>
                                )}
                                {parameterInfo.params?.temp && (
                                  <>
                                    <span className="shrink-0 md:hidden">
                                      ·
                                    </span>
                                    <span className="hidden shrink-0 text-neutral-300 md:inline dark:text-neutral-700">
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
                                <span className="shrink-0 md:hidden">·</span>
                                <span className="hidden shrink-0 text-neutral-300 md:inline dark:text-neutral-700">
                                  /
                                </span>
                                <span className="whitespace-nowrap">
                                  {parameterInfo.params.ratio}
                                </span>
                                <span className="shrink-0 md:hidden">·</span>
                                <span className="hidden shrink-0 text-neutral-300 md:inline dark:text-neutral-700">
                                  /
                                </span>
                                <span className="whitespace-nowrap">
                                  {parameterInfo.params.grindSize || ''}
                                </span>
                                <span className="shrink-0 md:hidden">·</span>
                                <span className="hidden shrink-0 md:inline">
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
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 器具分类栏 - 只在方案步骤时显示，添加动画效果 */}
              <AnimatePresence mode="wait">
                {activeBrewingStep === 'method' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      duration: 0.3,
                      ease: [0.4, 0, 0.2, 1],
                      opacity: { duration: 0.2 },
                    }}
                    className="mx-6 overflow-hidden"
                  >
                    <EquipmentBar
                      selectedEquipment={selectedEquipment}
                      customEquipments={customEquipments}
                      onEquipmentSelect={onEquipmentSelect || (() => {})}
                      onToggleManagementDrawer={handleToggleManagementDrawer}
                      settings={settings}
                      className={desktopEquipmentTopSpacingClass}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* 桌面端同步指示器 - 固定在导航栏底部 */}
      {syncProvider === 'supabase' && isSyncing && (
        <div className="mt-auto hidden px-6 pb-6 md:block">
          <div className="flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500">
            <AppleSpinner className="h-3 w-3" />
            <span>同步中</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default NavigationBar;
