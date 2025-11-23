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

import { Equal, ArrowLeft, ChevronsUpDown } from 'lucide-react';
import { saveMainTabPreference } from '@/lib/navigation/navigationCache';
import {
  ViewOption,
  VIEW_LABELS,
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
          time?: number;
          [key: string]: unknown;
        }>;
      };
    } | null
  ) =>
    method?.params?.stages?.find(stage => stage.pourType === 'extraction')
      ?.time || 0,

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
    'text-xs font-medium tracking-widest whitespace-nowrap pb-3';
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
        time: number;
        water: string;
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
  hasCoffeeBeans?: boolean
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

    // 如果在方案步骤但没有咖啡豆，也是第一步，不显示返回按钮
    if (activeBrewingStep === 'method' && !hasCoffeeBeans) return false;

    // 其他步骤检查是否有上一步
    return NAVIGABLE_STEPS[activeBrewingStep] !== null;
  }, [activeBrewingStep, activeMainTab, hasCoffeeBeans]);

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
}) => {
  const { canGoBack } = useNavigation(
    activeBrewingStep,
    activeMainTab,
    hasCoffeeBeans
  );

  const {
    visibleTabs = { brewing: true, coffeeBean: true, notes: true },
    pinnedViews = [],
    coffeeBeanViews = {
      [VIEW_OPTIONS.INVENTORY]: true,
      [VIEW_OPTIONS.RANKING]: true,
      [VIEW_OPTIONS.BLOGGER]: true,
      [VIEW_OPTIONS.STATS]: true,
    },
  } = settings.navigationSettings || {};

  // 计算可用视图数量
  const availableViewsCount = Object.values(VIEW_OPTIONS).filter(view => {
    if (pinnedViews.includes(view)) return false;
    return coffeeBeanViews[view] !== false;
  }).length;

  // 判断当前视图是否被固定
  const isCurrentViewPinned =
    currentBeanView && pinnedViews.includes(currentBeanView);

  // 获取第一个未被固定且允许显示的视图作为默认视图
  const getFirstAvailableView = useCallback(() => {
    const allViews = Object.values(VIEW_OPTIONS);
    const availableView = allViews.find(view => {
      // 必须未被固定
      if (pinnedViews.includes(view)) return false;
      // 必须允许显示 (默认为 true)
      return coffeeBeanViews[view] !== false;
    });
    // 如果没有可用的，回退到库存视图
    return availableView || VIEW_OPTIONS.INVENTORY;
  }, [pinnedViews, coffeeBeanViews]);

  // 自动纠正当前视图：如果当前视图既未被固定，又被禁用，则切换到第一个可用视图
  useEffect(() => {
    // 1. 如果没有当前视图，但有可用视图，立即选择一个
    if (!currentBeanView && availableViewsCount > 0) {
      const nextView = getFirstAvailableView();
      onBeanViewChange?.(nextView);
      return;
    }

    if (!currentBeanView) return;

    const isPinned = pinnedViews.includes(currentBeanView);
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
    pinnedViews,
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
      if (pinnedViews.length > 0) {
        onBeanViewChange?.(pinnedViews[0]);
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
    pinnedViews,
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
      !pinnedViews.includes(currentBeanView) &&
      coffeeBeanViews[currentBeanView] !== false
    ) {
      lastUnpinnedViewRef.current = currentBeanView;
    }
    // 如果 ref 为空（初始化），尝试设置一个默认值
    else if (!lastUnpinnedViewRef.current) {
      lastUnpinnedViewRef.current = getFirstAvailableView();
    }
  }, [currentBeanView, pinnedViews, coffeeBeanViews, getFirstAvailableView]);

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

  // 处理抽屉开关
  const handleToggleManagementDrawer = () => {
    onToggleEquipmentManagement?.();
  };

  // 获取当前视图的显示名称
  const getCurrentViewLabel = () => {
    // 如果当前视图被固定，显示最后一次选中的非固定视图
    if (isCurrentViewPinned) {
      return lastUnpinnedViewRef.current
        ? VIEW_LABELS[lastUnpinnedViewRef.current]
        : VIEW_LABELS[getFirstAvailableView()];
    }

    // 检查 currentBeanView 是否有效（未被固定且启用）
    const isCurrentValid =
      currentBeanView &&
      !pinnedViews.includes(currentBeanView) &&
      coffeeBeanViews[currentBeanView] !== false;

    if (isCurrentValid) {
      return VIEW_LABELS[currentBeanView];
    } else {
      // 如果当前视图无效，显示第一个可用视图的名称
      // 注意：这里只是显示上的修正，实际状态切换由 useEffect 处理
      // 这样可以解决视觉上的延迟
      const fallbackView = getFirstAvailableView();
      return VIEW_LABELS[fallbackView];
    }
  };

  // 处理咖啡豆按钮点击
  const handleBeanTabClick = () => {
    if (activeMainTab === '咖啡豆' && !isCurrentViewPinned) {
      // 如果已经在咖啡豆页面且不是固定视图，切换下拉菜单显示状态
      if (availableViewsCount > 1) {
        onToggleViewDropdown?.();
      }
    } else {
      // 如果不在咖啡豆页面，或者当前是固定视图
      handleMainTabClick('咖啡豆');

      // 如果当前是固定视图，切换回最后一次选中的非固定视图
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
        const { loadCustomEquipments } = await import(
          '@/lib/managers/customEquipments'
        );
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

  const _handleTimeChange = (value: string) => {
    if (handleExtractionTimeChange && selectedMethod) {
      const time = parseInt(value, 10) || 0;
      handleExtractionTimeChange(time);
    }
  };

  // 获取器具名称
  const getSelectedEquipmentName = () => {
    if (!selectedEquipment) return null;
    return getEquipmentName(selectedEquipment, equipmentList, customEquipments);
  };

  return (
    <motion.div
      className={`pt-safe-top sticky top-0 border-b transition-colors duration-300 ease-in-out ${
        activeBrewingStep === 'brewing' || activeBrewingStep === 'notes'
          ? 'border-transparent'
          : 'border-neutral-200 dark:border-neutral-800'
      }`}
      transition={{ duration: 0.3 }}
    >
      {/* 修改：创建一个固定高度的容器，用于包含默认头部和替代头部 */}
      <div className="relative min-h-[30px] w-full">
        {/* 修改：将AnimatePresence用于透明度变化而非高度变化 */}
        <AnimatePresence mode="wait">
          {showAlternativeHeader ? (
            // 替代头部 - 使用绝对定位
            <motion.div
              key="alternative-header"
              className="absolute top-0 right-0 left-0 w-full px-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {alternativeHeader}
            </motion.div>
          ) : (
            // 默认头部 - 使用绝对定位
            <motion.div
              key="default-header"
              className="absolute top-0 right-0 left-0 w-full px-6"
              initial={{ opacity: shouldHideHeader ? 0 : 1 }}
              animate={{ opacity: shouldHideHeader ? 0 : 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ pointerEvents: shouldHideHeader ? 'none' : 'auto' }}
            >
              <div className="flex items-start justify-between">
                {/* 设置入口按钮图标 - 扩大触碰区域 */}
                <div
                  onClick={handleTitleClick}
                  className="-mt-3 -ml-3 flex cursor-pointer items-center pt-3 pr-4 pb-3 pl-3 text-[12px] tracking-widest text-neutral-500 dark:text-neutral-400"
                >
                  {canGoBack() && onBackClick ? (
                    <ArrowLeft className="mr-1 h-4 w-4" />
                  ) : (
                    <Equal className="h-4 w-4" />
                  )}
                  {!(canGoBack() && onBackClick) && <span></span>}
                </div>

                {/* 主导航按钮 - 保持固定高度避免抖动 */}
                <div className="flex items-center space-x-6">
                  {visibleTabs.brewing && (
                    <div style={navItemStyle}>
                      <TabButton
                        tab="冲煮"
                        isActive={activeMainTab === '冲煮'}
                        onClick={() => handleMainTabClick('冲煮')}
                        dataTab="冲煮"
                      />
                    </div>
                  )}

                  {visibleTabs.coffeeBean && availableViewsCount > 0 && (
                    <div style={navItemStyle} className="relative">
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
                        className="flex cursor-pointer items-center pb-3 text-xs font-medium tracking-widest whitespace-nowrap transition-opacity duration-100"
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
                        data-view-selector
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
                  {pinnedViews.map(view => (
                    <div key={view} style={navItemStyle}>
                      <TabButton
                        tab={VIEW_LABELS[view]}
                        isActive={
                          activeMainTab === '咖啡豆' && currentBeanView === view
                        }
                        onClick={() => handlePinnedViewClick(view)}
                      />
                    </div>
                  ))}

                  {visibleTabs.notes && (
                    <div style={navItemStyle}>
                      <TabButton
                        tab="笔记"
                        isActive={activeMainTab === '笔记'}
                        onClick={() => handleMainTabClick('笔记')}
                        dataTab="笔记"
                      />
                    </div>
                  )}
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
                    <div className="bg-neutral-100 px-6 py-2 text-xs font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                      <div className="flex items-center justify-between gap-3">
                        {/* 左侧：方案名称区域 - 使用省略号 */}
                        <div className="flex min-w-0 flex-1 items-center overflow-hidden">
                          {parameterInfo.method && (
                            <span className="truncate">
                              {getSelectedEquipmentName() && (
                                <span>
                                  {getSelectedEquipmentName()}
                                  <span className="mx-1">·</span>
                                </span>
                              )}
                              {parameterInfo.method}
                            </span>
                          )}
                        </div>

                        {/* 右侧：参数区域 - 固定不压缩 */}
                        {parameterInfo.params && (
                          <div className="flex shrink-0 items-center">
                            {espressoUtils.isEspresso(selectedMethod) ? (
                              // 意式参数显示
                              editableParams ? (
                                <div className="flex items-center space-x-1 sm:space-x-2">
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
                                  <span className="shrink-0">·</span>
                                  <EditableParameter
                                    value={
                                      displayOverlay?.grindSize ||
                                      editableParams.grindSize
                                    }
                                    onChange={v =>
                                      handleParamChange('grindSize', v)
                                    }
                                    unit=""
                                  />
                                  <span className="shrink-0">·</span>
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
                                  <span className="shrink-0">·</span>
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
                                  className="flex cursor-pointer items-center space-x-1 transition-colors hover:text-neutral-700 sm:space-x-2 dark:hover:text-neutral-300"
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
                                  <span className="shrink-0">·</span>
                                  <span className="whitespace-nowrap">
                                    {parameterInfo.params.grindSize || ''}
                                  </span>
                                  <span className="shrink-0">·</span>
                                  <span className="whitespace-nowrap">
                                    {espressoUtils.formatTime(
                                      espressoUtils.getExtractionTime(
                                        selectedMethod
                                      )
                                    )}
                                    s
                                  </span>
                                  <span className="shrink-0">·</span>
                                  <span className="whitespace-nowrap">
                                    {parameterInfo.params.water}
                                  </span>
                                </div>
                              )
                            ) : // 原有参数显示
                            editableParams ? (
                              <div className="flex items-center space-x-1 sm:space-x-2">
                                <EditableParameter
                                  value={(
                                    displayOverlay?.coffee ||
                                    editableParams.coffee
                                  ).replace('g', '')}
                                  onChange={v => handleParamChange('coffee', v)}
                                  unit="g"
                                />
                                <span className="shrink-0">·</span>
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
                                    <span className="shrink-0">·</span>
                                    <EditableParameter
                                      value={
                                        displayOverlay?.grindSize ||
                                        editableParams.grindSize
                                      }
                                      onChange={v =>
                                        handleParamChange('grindSize', v)
                                      }
                                      unit=""
                                    />
                                  </>
                                )}
                                {parameterInfo.params?.temp && (
                                  <>
                                    <span className="shrink-0">·</span>
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
                                className="flex cursor-pointer items-center space-x-1 transition-colors hover:text-neutral-700 sm:space-x-2 dark:hover:text-neutral-300"
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
                                <span className="shrink-0">·</span>
                                <span className="whitespace-nowrap">
                                  {parameterInfo.params.ratio}
                                </span>
                                <span className="shrink-0">·</span>
                                <span className="whitespace-nowrap">
                                  {parameterInfo.params.grindSize || ''}
                                </span>
                                <span className="shrink-0">·</span>
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
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
};

export default NavigationBar;
