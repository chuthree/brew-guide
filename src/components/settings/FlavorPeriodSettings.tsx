'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SettingsOptions, defaultSettings } from './Settings';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { SettingPage } from './atomic';
import SettingSection from './atomic/SettingSection';
import SettingRow from './atomic/SettingRow';
import {
  getRoasterConfigsSync,
  getSettingsStore,
  useSettingsStore,
} from '@/lib/stores/settingsStore';
import { RoasterConfig } from '@/lib/core/db';
import { extractUniqueRoasters } from '@/lib/utils/beanVarietyUtils';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { ExtendedCoffeeBean } from '@/components/coffee-bean/List/types';
import { ChevronDown } from 'lucide-react';

interface FlavorPeriodSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
}

const FlavorPeriodSettings: React.FC<FlavorPeriodSettingsProps> = ({
  settings: _settings,
  onClose,
  handleChange: _handleChange,
}) => {
  // 使用 settingsStore 获取设置
  const settings = useSettingsStore(state => state.settings) as SettingsOptions;
  const updateSettings = useSettingsStore(state => state.updateSettings);

  // 使用 settingsStore 的 handleChange
  const handleChange = React.useCallback(
    async <K extends keyof SettingsOptions>(
      key: K,
      value: SettingsOptions[K]
    ) => {
      await updateSettings({ [key]: value } as any);
    },
    [updateSettings]
  );

  // 控制动画状态
  const [_shouldRender, _setShouldRender] = React.useState(true);
  const [isVisible, setIsVisible] = React.useState(false);

  // 烘焙商相关状态
  const [roasters, setRoasters] = useState<string[]>([]);
  const [roasterConfigs, setRoasterConfigs] = useState<
    Map<string, RoasterConfig>
  >(new Map());
  const [expandedRoaster, setExpandedRoaster] = useState<string | null>(null);

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
    id: 'flavor-period-settings',
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

  // 加载烘焙商列表和配置
  useEffect(() => {
    loadRoasters();
    loadConfigs();
  }, []);

  const loadRoasters = async () => {
    try {
      const beans = useCoffeeBeanStore.getState().beans as ExtendedCoffeeBean[];
      const uniqueRoasters = extractUniqueRoasters(beans);
      const filteredRoasters = uniqueRoasters.filter(r => r !== '未知烘焙商');
      setRoasters(filteredRoasters);
    } catch (error) {
      console.error('Failed to load roasters:', error);
    }
  };

  const loadConfigs = () => {
    try {
      const allConfigs = getRoasterConfigsSync();
      const configMap = new Map<string, RoasterConfig>();
      allConfigs.forEach(config => {
        configMap.set(config.roasterName, config);
      });
      setRoasterConfigs(configMap);
    } catch (error) {
      console.error('Failed to load configs:', error);
    }
  };

  const toggleExpand = (roasterName: string) => {
    setExpandedRoaster(expandedRoaster === roasterName ? null : roasterName);
  };

  const handleRoasterFlavorPeriodChange = async (
    roaster: string,
    type: 'light' | 'medium' | 'dark',
    field: 'startDay' | 'endDay',
    value: number
  ) => {
    const currentConfig = roasterConfigs.get(roaster);
    const currentFlavorPeriod = currentConfig?.flavorPeriod || {
      light: { startDay: 0, endDay: 0 },
      medium: { startDay: 0, endDay: 0 },
      dark: { startDay: 0, endDay: 0 },
    };

    const newFlavorPeriod = {
      ...currentFlavorPeriod,
      [type]: {
        ...currentFlavorPeriod[type],
        [field]: value,
      },
    };

    await getSettingsStore().updateRoasterConfig(roaster, {
      flavorPeriod: newFlavorPeriod,
    });
    loadConfigs();
  };

  // 辅助函数：更新自定义赏味期设置
  const updateCustomFlavorPeriod = useCallback(
    (
      roastType: 'light' | 'medium' | 'dark',
      field: 'startDay' | 'endDay',
      value: number
    ) => {
      const current = settings.customFlavorPeriod || {
        light: { startDay: 0, endDay: 0 },
        medium: { startDay: 0, endDay: 0 },
        dark: { startDay: 0, endDay: 0 },
      };

      const newCustomFlavorPeriod = {
        ...current,
        [roastType]: {
          ...current[roastType],
          [field]: value,
        },
      };
      handleChange('customFlavorPeriod', newCustomFlavorPeriod);
    },
    [settings.customFlavorPeriod, handleChange]
  );

  const renderFlavorInputs = (
    startDay: number,
    endDay: number,
    onStartChange: (val: number) => void,
    onEndChange: (val: number) => void,
    placeholderStart: string,
    placeholderEnd: string
  ) => (
    <div className="flex items-center space-x-3">
      <div className="flex items-center space-x-1">
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          养豆
        </span>
        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min="0"
          max="30"
          defaultValue={startDay || ''}
          key={`start-${startDay}`}
          placeholder={placeholderStart}
          onBlur={e => {
            const value =
              e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
            onStartChange(value);
          }}
          className="w-12 rounded border border-neutral-200/50 bg-neutral-100 px-2 py-1 text-center text-xs focus:ring-1 focus:ring-neutral-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800"
        />
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          天
        </span>
      </div>
      <div className="flex items-center space-x-1">
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          赏味
        </span>
        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min="1"
          max="90"
          defaultValue={endDay || ''}
          key={`end-${endDay}`}
          placeholder={placeholderEnd}
          onBlur={e => {
            const value =
              e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
            onEndChange(value);
          }}
          className="w-12 rounded border border-neutral-200/50 bg-neutral-100 px-2 py-1 text-center text-xs focus:ring-1 focus:ring-neutral-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800"
        />
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          天
        </span>
      </div>
    </div>
  );

  return (
    <SettingPage
      title="自定义赏味期预设"
      isVisible={isVisible}
      onClose={handleClose}
    >
      <div className="mt-4">
        {/* 全局默认预设 */}
        <SettingSection
          title="全局默认预设"
          footer="添加咖啡豆时，会根据烘焙度自动设定赏味期。"
        >
          <SettingRow label="浅烘">
            {renderFlavorInputs(
              settings.customFlavorPeriod?.light?.startDay || 0,
              settings.customFlavorPeriod?.light?.endDay || 0,
              val => updateCustomFlavorPeriod('light', 'startDay', val),
              val => updateCustomFlavorPeriod('light', 'endDay', val),
              '7',
              '60'
            )}
          </SettingRow>
          <SettingRow label="中烘">
            {renderFlavorInputs(
              settings.customFlavorPeriod?.medium?.startDay || 0,
              settings.customFlavorPeriod?.medium?.endDay || 0,
              val => updateCustomFlavorPeriod('medium', 'startDay', val),
              val => updateCustomFlavorPeriod('medium', 'endDay', val),
              '10',
              '60'
            )}
          </SettingRow>
          <SettingRow label="深烘" isLast>
            {renderFlavorInputs(
              settings.customFlavorPeriod?.dark?.startDay || 0,
              settings.customFlavorPeriod?.dark?.endDay || 0,
              val => updateCustomFlavorPeriod('dark', 'startDay', val),
              val => updateCustomFlavorPeriod('dark', 'endDay', val),
              '14',
              '90'
            )}
          </SettingRow>
        </SettingSection>

        {/* 烘焙商特定预设 */}
        {roasters.length > 0 && (
          <SettingSection
            title={`烘焙商特定预设 (${roasters.length})`}
            footer="为特定烘焙商设置专属的赏味期，优先级高于全局默认预设。"
          >
            {roasters.map((roaster, index) => {
              const config = roasterConfigs.get(roaster);
              const isExpanded = expandedRoaster === roaster;
              const isLast = index === roasters.length - 1;

              const flavorPeriod = config?.flavorPeriod || {
                light: { startDay: 0, endDay: 0 },
                medium: { startDay: 0, endDay: 0 },
                dark: { startDay: 0, endDay: 0 },
              };

              return (
                <div key={roaster} className="flex w-full flex-col">
                  {/* Header */}
                  <button
                    onClick={() => toggleExpand(roaster)}
                    className="relative flex w-full items-center justify-between py-3.5 pr-3.5 pl-3.5"
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        {roaster}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ChevronDown
                        className={`h-4 w-4 text-neutral-400/60 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                    {/* Separator */}
                    {!isLast && !isExpanded && (
                      <div className="absolute right-0 bottom-0 left-3.5 h-px bg-black/5 dark:bg-white/5" />
                    )}
                  </button>

                  {/* Expanded Content */}
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isExpanded
                        ? 'grid-rows-[1fr] opacity-100'
                        : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-3.5 pb-3.5">
                        <div className="space-y-2.5 border-t border-black/5 pt-3 dark:border-white/5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                              浅烘
                            </span>
                            {renderFlavorInputs(
                              flavorPeriod.light.startDay,
                              flavorPeriod.light.endDay,
                              val =>
                                handleRoasterFlavorPeriodChange(
                                  roaster,
                                  'light',
                                  'startDay',
                                  val
                                ),
                              val =>
                                handleRoasterFlavorPeriodChange(
                                  roaster,
                                  'light',
                                  'endDay',
                                  val
                                ),
                              '默认',
                              '默认'
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                              中烘
                            </span>
                            {renderFlavorInputs(
                              flavorPeriod.medium.startDay,
                              flavorPeriod.medium.endDay,
                              val =>
                                handleRoasterFlavorPeriodChange(
                                  roaster,
                                  'medium',
                                  'startDay',
                                  val
                                ),
                              val =>
                                handleRoasterFlavorPeriodChange(
                                  roaster,
                                  'medium',
                                  'endDay',
                                  val
                                ),
                              '默认',
                              '默认'
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                              深烘
                            </span>
                            {renderFlavorInputs(
                              flavorPeriod.dark.startDay,
                              flavorPeriod.dark.endDay,
                              val =>
                                handleRoasterFlavorPeriodChange(
                                  roaster,
                                  'dark',
                                  'startDay',
                                  val
                                ),
                              val =>
                                handleRoasterFlavorPeriodChange(
                                  roaster,
                                  'dark',
                                  'endDay',
                                  val
                                ),
                              '默认',
                              '默认'
                            )}
                          </div>
                        </div>
                      </div>
                      {!isLast && (
                        <div className="ml-3.5 h-px bg-black/5 dark:bg-white/5" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </SettingSection>
        )}

        {/* 底部空间 */}
        <div className="h-16" />
      </div>
    </SettingPage>
  );
};

export default FlavorPeriodSettings;
