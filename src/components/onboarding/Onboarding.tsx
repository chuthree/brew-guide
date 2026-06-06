'use client';

import React, { useEffect, useReducer } from 'react';
import Image from 'next/image';
import { Capacitor } from '@capacitor/core';
import { Lock, Layers, Share2 } from 'lucide-react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import SettingToggle from '@/components/settings/atomic/SettingToggle';
import {
  SettingsOptions,
  defaultSettings,
} from '@/components/settings/Settings';
import {
  canDisableMainNavigationTab,
  deriveNavigationSettings,
  getMainNavigationTabLabel,
  MAIN_NAVIGATION_TABS,
  mergeNavigationSettings,
  normalizeNavigationSettings,
  type MainNavigationTab,
} from '@/lib/navigation/navigationSettings';
import PersistentStorageManager, {
  isPersistentStorageSupported,
  isPWAMode,
} from '@/lib/utils/persistentStorage';
import { useSettingsStore } from '@/lib/stores/settingsStore';

interface OnboardingProps {
  onSettingsChange: (settings: SettingsOptions) => void;
  onComplete: () => void;
}

type OnboardingStep = 'welcome' | 'features';
type NavigationSettingsValue = NonNullable<
  SettingsOptions['navigationSettings']
>;

interface OnboardingState {
  isOpen: boolean;
  step: OnboardingStep;
  isCompleting: boolean;
  navigationSettings: NavigationSettingsValue;
  isPersisted: boolean;
  canRequestPersist: boolean;
}

type OnboardingAction =
  | { type: 'go-to-step'; step: OnboardingStep }
  | { type: 'complete-started' }
  | {
      type: 'persist-status';
      isPersisted: boolean;
      canRequestPersist?: boolean;
    }
  | { type: 'navigation-changed'; navigationSettings: NavigationSettingsValue };

const createInitialState = (): OnboardingState => ({
  isOpen: true,
  step: 'welcome',
  isCompleting: false,
  navigationSettings: normalizeNavigationSettings(
    defaultSettings.navigationSettings
  ),
  isPersisted: false,
  canRequestPersist: false,
});

const onboardingReducer = (
  state: OnboardingState,
  action: OnboardingAction
): OnboardingState => {
  switch (action.type) {
    case 'go-to-step':
      return { ...state, step: action.step };
    case 'complete-started':
      return { ...state, isCompleting: true, isOpen: false };
    case 'persist-status':
      return {
        ...state,
        isPersisted: action.isPersisted,
        canRequestPersist: action.canRequestPersist ?? state.canRequestPersist,
      };
    case 'navigation-changed':
      return { ...state, navigationSettings: action.navigationSettings };
  }
};

const highlights = [
  {
    icon: Lock,
    title: '本地存储',
    description: '完全免费且开源，数据默认保存在本机设备中，隐私由你自己掌控。',
  },
  {
    icon: Layers,
    title: '一站管理',
    description: '从辅助冲煮、豆仓库存到品鉴笔记，常用咖啡流程都能覆盖。',
  },
  {
    icon: Share2,
    title: '轻松分享',
    description: '支持数据导入导出，方便迁移、备份和分享冲煮心得。',
  },
];

const Onboarding: React.FC<OnboardingProps> = ({
  onSettingsChange,
  onComplete,
}) => {
  const [state, dispatch] = useReducer(
    onboardingReducer,
    undefined,
    createInitialState
  );
  const {
    isOpen,
    step,
    isCompleting,
    navigationSettings,
    isPersisted,
    canRequestPersist,
  } = state;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__onboardingOpen = isOpen;
    window.dispatchEvent(
      new CustomEvent('onboarding-visibility', {
        detail: { open: isOpen },
      })
    );
  }, [isOpen]);

  useEffect(() => {
    const checkPlatform = async () => {
      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        dispatch({ type: 'persist-status', isPersisted: true });
        return;
      }

      const pwaMode = isPWAMode();

      if (pwaMode && isPersistentStorageSupported()) {
        try {
          const persisted = await PersistentStorageManager.checkPersisted();
          dispatch({
            type: 'persist-status',
            isPersisted: persisted,
            canRequestPersist: true,
          });
        } catch (error) {
          console.error('检查持久化状态失败:', error);
          dispatch({
            type: 'persist-status',
            isPersisted: false,
            canRequestPersist: true,
          });
        }
      }
    };

    checkPlatform();
  }, []);

  const derivedNavigation = deriveNavigationSettings(navigationSettings);

  const handleFeatureToggle = (tab: MainNavigationTab) => {
    const currentNavigation = normalizeNavigationSettings(navigationSettings);
    const isEnabled = currentNavigation.visibleTabs[tab];

    if (isEnabled && !canDisableMainNavigationTab(currentNavigation, tab)) {
      return;
    }

    dispatch({
      type: 'navigation-changed',
      navigationSettings: mergeNavigationSettings(currentNavigation, {
        visibleTabs: {
          ...currentNavigation.visibleTabs,
          [tab]: !isEnabled,
        },
      }),
    });
  };

  const handleComplete = async () => {
    if (isCompleting) return;

    dispatch({ type: 'complete-started' });

    try {
      if (canRequestPersist && !isPersisted) {
        PersistentStorageManager.requestPersist().catch(error => {
          console.error('请求持久化存储失败:', error);
        });
      }

      const { Storage } = await import('@/lib/core/storage');
      await Storage.set('onboardingCompleted', 'true');
      Storage.setSync('onboardingCompleted', 'true');

      try {
        const { db } = await import('@/lib/core/db');
        await db.settings.put({ key: 'onboardingCompleted', value: 'true' });
      } catch (error) {
        console.error('写入引导完成状态到 IndexedDB 失败:', error);
      }

      const selectedSettings: SettingsOptions = {
        ...defaultSettings,
        navigationSettings: normalizeNavigationSettings(navigationSettings),
      };

      try {
        await useSettingsStore.getState().importSettings(selectedSettings);
        onSettingsChange(selectedSettings);
      } catch (error) {
        console.error('导入默认设置失败:', error);
      }
    } catch (error) {
      console.error('完成引导设置时发生错误:', error);
    }
  };

  const handleExitComplete = () => {
    if (isCompleting) {
      onComplete();
    }
  };

  return (
    <ActionDrawer
      isOpen={isOpen}
      onClose={() => undefined}
      dismissible={false}
      disableHistory
      historyId="onboarding"
      onExitComplete={handleExitComplete}
    >
      <ActionDrawer.Switcher activeKey={step}>
        {step === 'welcome' ? (
          <div>
            <div className="mb-6 flex flex-col items-start gap-6">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[1.125rem]">
                <Image
                  src="/images/icons/app/icon-192x192.png"
                  alt="Brew Guide"
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                />
              </div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
                欢迎使用 &quot;Brew Guide&quot;
              </h2>
            </div>

            <ActionDrawer.Content className="mb-24! space-y-5">
              {highlights.map(item => {
                const Icon = item.icon;

                return (
                  <div key={item.title} className="flex items-start gap-4">
                    <Icon className="mt-1.5 h-7 w-7 shrink-0 text-neutral-700 dark:text-neutral-300" />
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200">
                        {item.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </ActionDrawer.Content>

            <ActionDrawer.Actions>
              <ActionDrawer.PrimaryButton
                className="w-full"
                onClick={() =>
                  dispatch({ type: 'go-to-step', step: 'features' })
                }
              >
                继续
              </ActionDrawer.PrimaryButton>
            </ActionDrawer.Actions>
          </div>
        ) : (
          <div>
            <div className="mb-6 space-y-2">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                你需要哪些功能？
              </h2>
            </div>

            <ActionDrawer.Content className="mb-8! space-y-2">
              <div className="overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800/40">
                {MAIN_NAVIGATION_TABS.map((tab, index) => {
                  const checked = derivedNavigation.visibleTabs[tab];
                  const disabled =
                    checked &&
                    !canDisableMainNavigationTab(navigationSettings, tab);
                  return (
                    <div key={tab} className="flex w-full items-stretch px-3.5">
                      <div
                        className={`flex min-w-0 flex-1 items-center gap-3 py-3.5 ${
                          index !== MAIN_NAVIGATION_TABS.length - 1
                            ? 'border-b border-black/5 dark:border-white/5'
                            : ''
                        }`}
                      >
                        <div className="mr-3 min-w-0 flex-1">
                          <div className="text-sm leading-none font-medium text-neutral-800 dark:text-neutral-200">
                            {getMainNavigationTabLabel(tab)}
                          </div>
                        </div>
                        <SettingToggle
                          checked={checked}
                          disabled={disabled}
                          onChange={() => handleFeatureToggle(tab)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </ActionDrawer.Content>

            <ActionDrawer.Actions>
              <ActionDrawer.PrimaryButton
                className="w-full"
                onClick={handleComplete}
                disabled={isCompleting}
              >
                开始使用
              </ActionDrawer.PrimaryButton>
            </ActionDrawer.Actions>
          </div>
        )}
      </ActionDrawer.Switcher>
    </ActionDrawer>
  );
};

export default Onboarding;
