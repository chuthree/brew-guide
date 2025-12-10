'use client';

import React from 'react';
import { SettingsOptions } from './Settings';
import hapticsUtils from '@/lib/ui/haptics';
import { showToast } from '@/components/common/feedback/LightToast';
import { SettingPage } from './atomic';
import {
  ViewOption,
  VIEW_LABELS,
  SIMPLIFIED_VIEW_LABELS,
  VIEW_OPTIONS,
} from '@/components/coffee-bean/List/constants';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';

interface NavigationSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
}

const NavigationSettings: React.FC<NavigationSettingsProps> = ({
  settings,
  onClose,
  handleChange,
}) => {
  // 控制动画状态
  const [shouldRender, setShouldRender] = React.useState(true);
  const [isVisible, setIsVisible] = React.useState(false);

  // 用于保存最新的 onClose 引用
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  // 关闭处理函数（带动画）
  const handleCloseWithAnimation = React.useCallback(() => {
    setIsVisible(false);
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));
    setTimeout(() => {
      onCloseRef.current();
    }, 350);
  }, []);

  // 使用统一的历史栈管理系统
  useModalHistory({
    id: 'navigation-settings',
    isOpen: true,
    onClose: handleCloseWithAnimation,
  });

  // UI 返回按钮点击处理
  const handleClose = () => {
    modalHistory.back();
  };

  // 处理显示/隐藏动画（入场动画）
  React.useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });
  }, []);

  // 处理主导航显示切换
  const handleMainTabToggle = (tab: 'brewing' | 'coffeeBean' | 'notes') => {
    const current = settings.navigationSettings || {
      visibleTabs: {
        brewing: true,
        coffeeBean: true,
        notes: true,
      },
      coffeeBeanViews: {
        [VIEW_OPTIONS.INVENTORY]: true,
        [VIEW_OPTIONS.RANKING]: true,
        [VIEW_OPTIONS.STATS]: true,
      },
      pinnedViews: [],
    };

    const currentVisibleTabs = current.visibleTabs;

    // 至少保留一个标签页
    const activeCount =
      Object.values(currentVisibleTabs).filter(Boolean).length;
    if (currentVisibleTabs[tab] && activeCount <= 1) {
      showToast({ type: 'error', title: '至少保留一个标签页' });
      return;
    }

    const newVisibleTabs = {
      ...currentVisibleTabs,
      [tab]: !currentVisibleTabs[tab],
    };
    handleChange('navigationSettings', {
      ...current,
      visibleTabs: newVisibleTabs,
    });

    if (settings.hapticFeedback) {
      hapticsUtils.light();
    }
  };

  // 处理咖啡豆视图显示切换
  const handleBeanViewToggle = (view: ViewOption) => {
    const current = settings.navigationSettings || {
      visibleTabs: {
        brewing: true,
        coffeeBean: true,
        notes: true,
      },
      coffeeBeanViews: {
        [VIEW_OPTIONS.INVENTORY]: true,
        [VIEW_OPTIONS.RANKING]: true,
        [VIEW_OPTIONS.STATS]: true,
      },
      pinnedViews: [],
    };

    const currentBeanViews = current.coffeeBeanViews;

    // 至少保留一个视图
    const activeCount = Object.values(currentBeanViews).filter(Boolean).length;
    if (currentBeanViews[view] && activeCount <= 1) {
      showToast({ type: 'error', title: '至少保留一个视图' });
      return;
    }

    const newBeanViews = {
      ...currentBeanViews,
      [view]: !currentBeanViews[view],
    };
    handleChange('navigationSettings', {
      ...current,
      coffeeBeanViews: newBeanViews,
    });

    if (settings.hapticFeedback) {
      hapticsUtils.light();
    }
  };

  // 处理视图固定切换
  const handlePinViewToggle = (view: ViewOption) => {
    const current = settings.navigationSettings || {
      visibleTabs: {
        brewing: true,
        coffeeBean: true,
        notes: true,
      },
      coffeeBeanViews: {
        [VIEW_OPTIONS.INVENTORY]: true,
        [VIEW_OPTIONS.RANKING]: true,
        [VIEW_OPTIONS.STATS]: true,
      },
      pinnedViews: [],
    };

    const currentPinned = current.pinnedViews;
    let newPinned: ViewOption[];
    const isPinning = !currentPinned.includes(view); // 判断是固定还是取消固定

    if (currentPinned.includes(view)) {
      newPinned = currentPinned.filter(v => v !== view);
    } else {
      newPinned = [...currentPinned, view];
    }

    handleChange('navigationSettings', {
      ...current,
      pinnedViews: newPinned,
    });

    // 如果正在固定视图，触发事件通知需要切换当前视图
    if (isPinning) {
      // 使用 setTimeout 确保在状态更新后触发事件，避免主界面使用旧的 settings 计算可用视图
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('viewPinned', {
            detail: { pinnedView: view },
          })
        );
      }, 0);
    }

    if (settings.hapticFeedback) {
      hapticsUtils.light();
    }
  };

  if (!shouldRender) {
    return null;
  }

  const visibleTabs = settings.navigationSettings?.visibleTabs || {
    brewing: true,
    coffeeBean: true,
    notes: true,
  };

  const coffeeBeanViews = settings.navigationSettings?.coffeeBeanViews || {
    [VIEW_OPTIONS.INVENTORY]: true,
    [VIEW_OPTIONS.RANKING]: true,
    [VIEW_OPTIONS.STATS]: true,
  };

  const pinnedViews = settings.navigationSettings?.pinnedViews || [];

  // 计算未被固定的视图中，有多少是被启用的
  const availableUnpinnedViewsCount = Object.values(VIEW_OPTIONS).filter(
    view => {
      if (pinnedViews.includes(view)) return false;
      return coffeeBeanViews[view] !== false;
    }
  ).length;

  // 开关组件
  const Switch = ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: () => void;
  }) => (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
    </label>
  );

  const getLabel = (view: ViewOption) => {
    return settings.simplifiedViewLabels
      ? SIMPLIFIED_VIEW_LABELS[view]
      : VIEW_LABELS[view];
  };

  return (
    <SettingPage title="导航栏设置" isVisible={isVisible} onClose={handleClose}>
      {/* 通用设置 */}
      <div className="-mt-4 px-6 py-4">
        <h3 className="mb-3 text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
          通用
        </h3>
        <div className="space-y-4 rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              简化标签名称
            </span>
            <Switch
              checked={settings.simplifiedViewLabels ?? false}
              onChange={() =>
                handleChange(
                  'simplifiedViewLabels',
                  !settings.simplifiedViewLabels
                )
              }
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          开启后，导航栏标签将使用更简洁的名称（如“库存”代替“咖啡豆库存”）
        </p>
      </div>

      {/* 主导航显示设置 */}
      <div className="px-6 py-4">
        <h3 className="mb-3 text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
          主导航显示
        </h3>
        <div className="space-y-4 rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              冲煮
            </span>
            <Switch
              checked={visibleTabs.brewing}
              onChange={() => handleMainTabToggle('brewing')}
            />
          </div>
          {availableUnpinnedViewsCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                {settings.simplifiedViewLabels ? '库存' : '咖啡豆库存'}
              </span>
              <Switch
                checked={visibleTabs.coffeeBean}
                onChange={() => handleMainTabToggle('coffeeBean')}
              />
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              笔记
            </span>
            <Switch
              checked={visibleTabs.notes}
              onChange={() => handleMainTabToggle('notes')}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          至少需要保留一个主导航标签页
        </p>
      </div>

      {/* 咖啡豆视图显示设置 */}
      {visibleTabs.coffeeBean && availableUnpinnedViewsCount > 0 && (
        <div className="px-6 py-4">
          <h3 className="mb-3 text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
            视图显示
          </h3>
          <div className="space-y-4 rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
            {Object.values(VIEW_OPTIONS)
              .filter(view => !pinnedViews.includes(view))
              .map(view => (
                <div key={view} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    {getLabel(view)}
                  </span>
                  <Switch
                    checked={coffeeBeanViews[view] ?? true}
                    onChange={() => handleBeanViewToggle(view)}
                  />
                </div>
              ))}
          </div>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            控制在咖啡豆页面下拉菜单中显示的视图选项
          </p>
        </div>
      )}

      {/* 视图固定设置 */}
      <div className="px-6 py-4">
        <h3 className="mb-3 text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
          固定视图
        </h3>
        <div className="space-y-4 rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
          {Object.values(VIEW_OPTIONS).map(view => (
            <div key={view} className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                {getLabel(view)}
              </span>
              <Switch
                checked={pinnedViews.includes(view)}
                onChange={() => handlePinViewToggle(view)}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          开启后，该视图将作为独立标签页显示在主导航栏右侧
        </p>
      </div>
    </SettingPage>
  );
};

export default NavigationSettings;
