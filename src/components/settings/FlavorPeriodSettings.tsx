'use client';

import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { SettingsOptions } from './Settings';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';

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
    <div
      className="fixed inset-0 mx-auto flex max-w-[500px] flex-col bg-neutral-50 dark:bg-neutral-900"
      style={getChildPageStyle(isVisible)}
    >
      {/* 头部导航栏 */}
      <div className="pt-safe-top relative flex items-center justify-center py-4">
        <button
          onClick={handleClose}
          className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 dark:text-neutral-300"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-md font-medium text-neutral-800 dark:text-neutral-200">
          自定义赏味期预设
        </h2>
      </div>

      {/* 滚动内容区域 */}
      <div className="pb-safe-bottom relative flex-1 divide-y divide-neutral-200 overflow-y-auto dark:divide-neutral-800">
        {/* 顶部渐变阴影 */}
        <div className="pointer-events-none sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 to-transparent first:border-b-0 dark:from-neutral-900"></div>

        {/* 设置内容 */}
        <div className="-mt-4 px-6 py-4">
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
          <h3 className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
            添加咖啡豆时，会根据烘焙度自动设定赏味期。空值表示使用默认预设（灰色数字）。
          </h3>
        </div>
      </div>
    </div>
  );
};

export default FlavorPeriodSettings;
