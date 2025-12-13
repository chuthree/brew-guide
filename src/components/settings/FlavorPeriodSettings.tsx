'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SettingsOptions } from './Settings';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { SettingPage } from './atomic';
import RoasterLogoManager, {
  RoasterConfig,
} from '@/lib/managers/RoasterLogoManager';
import { extractUniqueRoasters } from '@/lib/utils/beanVarietyUtils';
import { CoffeeBeanManager } from '@/lib/managers/coffeeBeanManager';
import { ExtendedCoffeeBean } from '@/components/coffee-bean/List/types';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FlavorPeriodSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
}

const FlavorPeriodSettings: React.FC<FlavorPeriodSettingsProps> = ({
  settings,
  onClose,
  handleChange,
}) => {
  // 控制动画状态
  const [shouldRender, setShouldRender] = React.useState(true);
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
      const beans =
        (await CoffeeBeanManager.getAllBeans()) as ExtendedCoffeeBean[];
      const uniqueRoasters = extractUniqueRoasters(beans);
      const filteredRoasters = uniqueRoasters.filter(r => r !== '未知烘焙商');
      setRoasters(filteredRoasters);
    } catch (error) {
      console.error('Failed to load roasters:', error);
    }
  };

  const loadConfigs = async () => {
    try {
      const allConfigs = await RoasterLogoManager.getAllConfigs();
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

    await RoasterLogoManager.setFlavorPeriod(roaster, newFlavorPeriod);
    await loadConfigs();
  };

  // 辅助函数：更新自定义赏味期设置
  const updateCustomFlavorPeriod = (
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
  };

  if (!shouldRender) return null;

  return (
    <SettingPage
      title="自定义赏味期预设"
      isVisible={isVisible}
      onClose={handleClose}
    >
      {/* 设置内容 */}
      <div className="-mt-4 px-6 py-4">
        {/* 全局默认预设 */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
            全局默认预设
          </h3>

          <div className="space-y-3">
            {/* 浅烘焙设置 */}
            <div className="flex items-center justify-between">
              <div className="w-12 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                浅烘
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1">
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    养豆
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={settings.customFlavorPeriod?.light?.startDay || ''}
                    placeholder="7"
                    onChange={e => {
                      const value =
                        e.target.value === ''
                          ? 0
                          : parseInt(e.target.value) || 0;
                      updateCustomFlavorPeriod('light', 'startDay', value);
                    }}
                    className="w-12 rounded border border-neutral-200 bg-neutral-100 px-2 py-1 text-center text-xs focus:ring-1 focus:ring-neutral-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800"
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
                    min="1"
                    max="90"
                    value={settings.customFlavorPeriod?.light?.endDay || ''}
                    placeholder="60"
                    onChange={e => {
                      const value =
                        e.target.value === ''
                          ? 0
                          : parseInt(e.target.value) || 0;
                      updateCustomFlavorPeriod('light', 'endDay', value);
                    }}
                    className="w-12 rounded border border-neutral-200 bg-neutral-100 px-2 py-1 text-center text-xs focus:ring-1 focus:ring-neutral-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800"
                  />
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    天
                  </span>
                </div>
              </div>
            </div>

            {/* 中烘焙设置 */}
            <div className="flex items-center justify-between">
              <div className="w-12 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                中烘
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1">
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    养豆
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={settings.customFlavorPeriod?.medium?.startDay || ''}
                    placeholder="10"
                    onChange={e => {
                      const value =
                        e.target.value === ''
                          ? 0
                          : parseInt(e.target.value) || 0;
                      updateCustomFlavorPeriod('medium', 'startDay', value);
                    }}
                    className="w-12 rounded border border-neutral-200 bg-neutral-100 px-2 py-1 text-center text-xs focus:ring-1 focus:ring-neutral-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800"
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
                    min="1"
                    max="90"
                    value={settings.customFlavorPeriod?.medium?.endDay || ''}
                    placeholder="60"
                    onChange={e => {
                      const value =
                        e.target.value === ''
                          ? 0
                          : parseInt(e.target.value) || 0;
                      updateCustomFlavorPeriod('medium', 'endDay', value);
                    }}
                    className="w-12 rounded border border-neutral-200 bg-neutral-100 px-2 py-1 text-center text-xs focus:ring-1 focus:ring-neutral-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800"
                  />
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    天
                  </span>
                </div>
              </div>
            </div>

            {/* 深烘焙设置 */}
            <div className="flex items-center justify-between">
              <div className="w-12 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                深烘
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1">
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    养豆
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={settings.customFlavorPeriod?.dark?.startDay || ''}
                    placeholder="14"
                    onChange={e => {
                      const value =
                        e.target.value === ''
                          ? 0
                          : parseInt(e.target.value) || 0;
                      updateCustomFlavorPeriod('dark', 'startDay', value);
                    }}
                    className="w-12 rounded border border-neutral-200 bg-neutral-100 px-2 py-1 text-center text-xs focus:ring-1 focus:ring-neutral-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800"
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
                    min="1"
                    max="90"
                    value={settings.customFlavorPeriod?.dark?.endDay || ''}
                    placeholder="90"
                    onChange={e => {
                      const value =
                        e.target.value === ''
                          ? 0
                          : parseInt(e.target.value) || 0;
                      updateCustomFlavorPeriod('dark', 'endDay', value);
                    }}
                    className="w-12 rounded border border-neutral-200 bg-neutral-100 px-2 py-1 text-center text-xs focus:ring-1 focus:ring-neutral-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800"
                  />
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    天
                  </span>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            添加咖啡豆时，会根据烘焙度自动设定赏味期。空值表示使用默认预设（灰色数字）。
          </p>
        </div>

        {/* 烘焙商特定预设 */}
        {roasters.length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
              <h3 className="text-xs font-medium tracking-wider text-neutral-400 uppercase dark:text-neutral-500">
                烘焙商特定预设 ({roasters.length})
              </h3>
              <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
            </div>

            <div className="space-y-2">
              {roasters.map(roaster => {
                const config = roasterConfigs.get(roaster);
                const isExpanded = expandedRoaster === roaster;
                const flavorPeriod = config?.flavorPeriod || {
                  light: { startDay: 0, endDay: 0 },
                  medium: { startDay: 0, endDay: 0 },
                  dark: { startDay: 0, endDay: 0 },
                };

                return (
                  <div
                    key={roaster}
                    className="overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800"
                  >
                    {/* 烘焙商名称 */}
                    <div
                      className="flex cursor-pointer items-center justify-between px-3 py-2"
                      onClick={() => toggleExpand(roaster)}
                    >
                      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        {roaster}
                      </span>
                      <div className="text-neutral-400">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>

                    {/* 展开区域：赏味期设置 */}
                    <div
                      className="grid transition-all duration-300 ease-in-out"
                      style={{
                        gridTemplateRows: isExpanded ? '1fr' : '0fr',
                      }}
                    >
                      <div className="overflow-hidden">
                        <div className="px-3 pt-3">
                          <div className="space-y-2.5 border-t border-neutral-200 pt-3 dark:border-neutral-700">
                            {/* 浅烘焙 */}
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                                浅烘
                              </span>
                              <div className="flex items-center gap-2.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                    养豆期
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="30"
                                    value={flavorPeriod.light.startDay || ''}
                                    placeholder="默认"
                                    onChange={e =>
                                      handleRoasterFlavorPeriodChange(
                                        roaster,
                                        'light',
                                        'startDay',
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    className="w-14 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-center text-xs focus:border-neutral-400 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800"
                                  />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                    赏味期
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="90"
                                    value={flavorPeriod.light.endDay || ''}
                                    placeholder="默认"
                                    onChange={e =>
                                      handleRoasterFlavorPeriodChange(
                                        roaster,
                                        'light',
                                        'endDay',
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    className="w-14 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-center text-xs focus:border-neutral-400 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* 中烘焙 */}
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                                中烘
                              </span>
                              <div className="flex items-center gap-2.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                    养豆期
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="30"
                                    value={flavorPeriod.medium.startDay || ''}
                                    placeholder="默认"
                                    onChange={e =>
                                      handleRoasterFlavorPeriodChange(
                                        roaster,
                                        'medium',
                                        'startDay',
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    className="w-14 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-center text-xs focus:border-neutral-400 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800"
                                  />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                    赏味期
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="90"
                                    value={flavorPeriod.medium.endDay || ''}
                                    placeholder="默认"
                                    onChange={e =>
                                      handleRoasterFlavorPeriodChange(
                                        roaster,
                                        'medium',
                                        'endDay',
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    className="w-14 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-center text-xs focus:border-neutral-400 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* 深烘焙 */}
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                                深烘
                              </span>
                              <div className="flex items-center gap-2.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                    养豆期
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="30"
                                    value={flavorPeriod.dark.startDay || ''}
                                    placeholder="默认"
                                    onChange={e =>
                                      handleRoasterFlavorPeriodChange(
                                        roaster,
                                        'dark',
                                        'startDay',
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    className="w-14 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-center text-xs focus:border-neutral-400 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800"
                                  />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                    赏味期
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="90"
                                    value={flavorPeriod.dark.endDay || ''}
                                    placeholder="默认"
                                    onChange={e =>
                                      handleRoasterFlavorPeriodChange(
                                        roaster,
                                        'dark',
                                        'endDay',
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    className="w-14 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-center text-xs focus:border-neutral-400 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800"
                                  />
                                </div>
                              </div>
                            </div>

                            <p className="pt-1 text-[10px] text-neutral-400">
                              留空或设为0将使用全局默认设置
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              为特定烘焙商设置专属的赏味期，优先级高于全局默认预设。
            </p>
          </div>
        )}

        {/* 底部空间 */}
        <div className="h-16" />
      </div>
    </SettingPage>
  );
};

export default FlavorPeriodSettings;
