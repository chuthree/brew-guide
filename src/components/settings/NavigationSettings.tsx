'use client';

import React from 'react';
import { SettingsOptions } from './Settings';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import hapticsUtils from '@/lib/ui/haptics';
import { showToast } from '@/components/common/feedback/LightToast';
import {
  SettingPage,
  SettingSection,
  SettingRow,
  SettingToggle,
} from './atomic';
import {
  VIEW_LABELS,
  SIMPLIFIED_VIEW_LABELS,
  type ViewOption,
} from '@/components/coffee-bean/List/constants';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import {
  canDisableCoffeeBeanView,
  canDisableMainNavigationTab,
  COFFEE_BEAN_VIEW_ORDER,
  deriveNavigationSettings,
  mergeNavigationSettings,
  normalizeNavigationSettings,
} from '@/lib/navigation/navigationSettings';

interface NavigationSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
}

const NavigationSettings: React.FC<NavigationSettingsProps> = ({
  settings: _settings,
  onClose,
  handleChange: _handleChange,
}) => {
  const settings = useSettingsStore(state => state.settings) as SettingsOptions;
  const updateSettings = useSettingsStore(state => state.updateSettings);
  const updateNavigationSettings = useSettingsStore(
    state => state.updateNavigationSettings
  );

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

  const derivedNavigation = React.useMemo(
    () => deriveNavigationSettings(settings.navigationSettings),
    [settings.navigationSettings]
  );

  const currentNavigation = React.useMemo(
    () => normalizeNavigationSettings(settings.navigationSettings),
    [settings.navigationSettings]
  );

  const commitNavigationSettings = React.useCallback(
    async (
      updates: Partial<NonNullable<SettingsOptions['navigationSettings']>>
    ) => {
      const nextNavigation = mergeNavigationSettings(
        currentNavigation,
        updates
      );

      if (
        deriveNavigationSettings(nextNavigation).renderedMainTabs.length === 0
      ) {
        showToast({ type: 'error', title: '至少需要保留一个主导航标签页' });
        return false;
      }

      await updateNavigationSettings(nextNavigation);

      if (settings.hapticFeedback) {
        hapticsUtils.light();
      }

      return true;
    },
    [currentNavigation, settings.hapticFeedback, updateNavigationSettings]
  );

  const handleMainTabToggle = (tab: 'brewing' | 'coffeeBean' | 'notes') => {
    if (
      currentNavigation.visibleTabs[tab] &&
      !canDisableMainNavigationTab(settings.navigationSettings, tab)
    ) {
      showToast({ type: 'error', title: '至少需要保留一个主导航标签页' });
      return;
    }

    void commitNavigationSettings({
      visibleTabs: {
        ...currentNavigation.visibleTabs,
        [tab]: !currentNavigation.visibleTabs[tab],
      },
    });
  };

  const handleBeanViewToggle = (view: ViewOption) => {
    if (
      currentNavigation.coffeeBeanViews[view] &&
      !canDisableCoffeeBeanView(settings.navigationSettings, view)
    ) {
      showToast({ type: 'error', title: '至少保留一个视图' });
      return;
    }

    void commitNavigationSettings({
      coffeeBeanViews: {
        ...currentNavigation.coffeeBeanViews,
        [view]: !currentNavigation.coffeeBeanViews[view],
      },
    });
  };

  const handlePinViewToggle = (view: ViewOption) => {
    const currentPinned = currentNavigation.pinnedViews as ViewOption[];
    let newPinned: ViewOption[];
    const isPinning = !currentPinned.includes(view); // 判断是固定还是取消固定

    if (currentPinned.includes(view)) {
      newPinned = currentPinned.filter(v => v !== view);
    } else {
      newPinned = [...currentPinned, view];
    }

    void commitNavigationSettings({
      pinnedViews: newPinned,
    }).then(success => {
      if (!success || !isPinning) {
        return;
      }

      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('viewPinned', {
            detail: { pinnedView: view },
          })
        );
      }, 0);
    });
  };

  const getLabel = (view: ViewOption) => {
    return settings.simplifiedViewLabels
      ? SIMPLIFIED_VIEW_LABELS[view]
      : VIEW_LABELS[view];
  };

  return (
    <SettingPage title="导航栏" isVisible={isVisible} onClose={handleClose}>
      <SettingSection title="通用" className="-mt-4">
        <SettingRow label="简化标签名称" isLast>
          <SettingToggle
            checked={settings.simplifiedViewLabels ?? false}
            onChange={checked =>
              void updateSettings({ simplifiedViewLabels: checked })
            }
          />
        </SettingRow>
      </SettingSection>

      <SettingSection
        title="主导航显示"
        footer="至少需要保留一个主导航标签页"
      >
        <SettingRow label="冲煮">
          <SettingToggle
            checked={derivedNavigation.visibleTabs.brewing}
            disabled={
              !canDisableMainNavigationTab(
                settings.navigationSettings,
                'brewing'
              )
            }
            onChange={() => handleMainTabToggle('brewing')}
          />
        </SettingRow>
        {derivedNavigation.canConfigureCoffeeBeanMainTab && (
          <SettingRow label={settings.simplifiedViewLabels ? '库存' : '咖啡豆库存'}>
            <SettingToggle
              checked={derivedNavigation.showCoffeeBeanMainTab}
              disabled={
                currentNavigation.visibleTabs.coffeeBean &&
                !canDisableMainNavigationTab(
                  settings.navigationSettings,
                  'coffeeBean'
                )
              }
              onChange={() => handleMainTabToggle('coffeeBean')}
            />
          </SettingRow>
        )}
        <SettingRow label="笔记" isLast>
          <SettingToggle
            checked={derivedNavigation.visibleTabs.notes}
            disabled={
              !canDisableMainNavigationTab(settings.navigationSettings, 'notes')
            }
            onChange={() => handleMainTabToggle('notes')}
          />
        </SettingRow>
      </SettingSection>

      {COFFEE_BEAN_VIEW_ORDER.some(
        view => !derivedNavigation.pinnedViews.includes(view)
      ) && (
        <SettingSection
          title="视图显示"
          footer="控制在咖啡豆页面下拉菜单中显示的视图选项"
        >
          {COFFEE_BEAN_VIEW_ORDER.filter(
            view => !derivedNavigation.pinnedViews.includes(view)
          ).map((view, index, array) => (
            <SettingRow
              key={view}
              label={getLabel(view)}
              isLast={index === array.length - 1}
            >
              <SettingToggle
                checked={derivedNavigation.coffeeBeanViews[view] ?? true}
                disabled={
                  derivedNavigation.coffeeBeanViews[view] &&
                  !canDisableCoffeeBeanView(settings.navigationSettings, view)
                }
                onChange={() => handleBeanViewToggle(view)}
              />
            </SettingRow>
          ))}
        </SettingSection>
      )}

      <SettingSection
        title="固定视图"
        footer="开启后，该视图将作为独立标签页显示在主导航栏右侧"
      >
        {COFFEE_BEAN_VIEW_ORDER.map((view, index, array) => (
          <SettingRow
            key={view}
            label={getLabel(view)}
            isLast={index === array.length - 1}
          >
            <SettingToggle
              checked={derivedNavigation.pinnedViews.includes(view)}
              onChange={() => handlePinViewToggle(view)}
            />
          </SettingRow>
        ))}
      </SettingSection>
    </SettingPage>
  );
};

export default NavigationSettings;
