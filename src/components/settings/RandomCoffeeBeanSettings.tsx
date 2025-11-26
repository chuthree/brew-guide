'use client';

import React from 'react';

import { ChevronLeft } from 'lucide-react';
import { SettingsOptions, defaultSettings } from './Settings';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';

interface RandomCoffeeBeanSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void;
}

const RandomCoffeeBeanSettings: React.FC<RandomCoffeeBeanSettingsProps> = ({
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
    id: 'random-coffee-bean-settings',
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

  // 获取当前随机咖啡豆设置，如果不存在则使用默认值
  const randomSettings =
    settings.randomCoffeeBeans || defaultSettings.randomCoffeeBeans!;

  // 处理长按随机类型设置变更
  const handleLongPressRandomChange = (enabled: boolean) => {
    const newSettings = {
      ...randomSettings,
      enableLongPressRandomType: enabled,
    };
    handleChange('randomCoffeeBeans', newSettings);
  };

  // 处理默认随机类型设置变更
  const handleDefaultRandomTypeChange = (type: 'espresso' | 'filter') => {
    const newSettings = {
      ...randomSettings,
      defaultRandomType: type,
    };
    handleChange('randomCoffeeBeans', newSettings);
  };

  // 处理赏味期范围设置变更
  const handleFlavorPeriodRangeChange = (
    period: keyof typeof randomSettings.flavorPeriodRanges,
    enabled: boolean
  ) => {
    const newSettings = {
      ...randomSettings,
      flavorPeriodRanges: {
        ...randomSettings.flavorPeriodRanges,
        [period]: enabled,
      },
    };
    handleChange('randomCoffeeBeans', newSettings);
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
          随机咖啡豆设置
        </h2>
      </div>

      {/* 滚动内容区域 */}
      <div className="pb-safe-bottom flex-1 overflow-y-auto">
        {/* 顶部渐变阴影 */}
        <div className="pointer-events-none sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 to-transparent first:border-b-0 dark:from-neutral-900"></div>

        {/* 长按随机类型设置 */}
        <div className="-mt-4 px-6 py-4">
          <h3 className="mb-3 text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
            随机类型
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
                长按切换咖啡豆类型
              </label>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                开启后，点击随机按钮选择一种类型，长按随机按钮选择另一种类型
              </p>
            </div>
            <label className="relative ml-4 inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={randomSettings.enableLongPressRandomType}
                onChange={e => handleLongPressRandomChange(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
            </label>
          </div>

          {/* 默认随机类型设置 - 仅在启用长按功能时显示 */}
          {randomSettings.enableLongPressRandomType && (
            <div className="mt-4 rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
              <label className="mb-3 block text-sm font-medium text-neutral-800 dark:text-neutral-200">
                长按时选择的类型
              </label>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => handleDefaultRandomTypeChange('espresso')}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    randomSettings.defaultRandomType === 'espresso'
                      ? 'bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900'
                      : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  意式
                </button>
                <button
                  type="button"
                  onClick={() => handleDefaultRandomTypeChange('filter')}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    randomSettings.defaultRandomType === 'filter'
                      ? 'bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900'
                      : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  手冲
                </button>
              </div>
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                点击随机：选择
                {randomSettings.defaultRandomType === 'espresso'
                  ? '手冲'
                  : '意式'}
                豆 • 长按随机：选择
                {randomSettings.defaultRandomType === 'espresso'
                  ? '意式'
                  : '手冲'}
                豆
              </p>
            </div>
          )}
        </div>

        {/* 赏味期范围设置 */}
        <div className="px-6 py-4">
          <h3 className="mb-3 text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
            赏味期范围
          </h3>
          <p className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">
            选择随机咖啡豆的赏味期状态范围，不选择任何项目时将包含所有状态
          </p>

          <div className="space-y-4">
            {/* 养豆期 */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  养豆期
                </span>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  正在养豆阶段的咖啡豆
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={randomSettings.flavorPeriodRanges.aging}
                  onChange={e =>
                    handleFlavorPeriodRangeChange('aging', e.target.checked)
                  }
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
              </label>
            </div>

            {/* 赏味期 */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  赏味期
                </span>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  处于最佳赏味期的咖啡豆
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={randomSettings.flavorPeriodRanges.optimal}
                  onChange={e =>
                    handleFlavorPeriodRangeChange('optimal', e.target.checked)
                  }
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
              </label>
            </div>

            {/* 衰退期 */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  衰退期
                </span>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  已过赏味期的咖啡豆
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={randomSettings.flavorPeriodRanges.decline}
                  onChange={e =>
                    handleFlavorPeriodRangeChange('decline', e.target.checked)
                  }
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
              </label>
            </div>

            {/* 冷冻 */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  冷冻
                </span>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  冷冻保存的咖啡豆
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={randomSettings.flavorPeriodRanges.frozen}
                  onChange={e =>
                    handleFlavorPeriodRangeChange('frozen', e.target.checked)
                  }
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
              </label>
            </div>

            {/* 在途 */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  在途
                </span>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  运输中的咖啡豆
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={randomSettings.flavorPeriodRanges.inTransit}
                  onChange={e =>
                    handleFlavorPeriodRangeChange('inTransit', e.target.checked)
                  }
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
              </label>
            </div>

            {/* 未知 */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  未知状态
                </span>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  无法确定赏味期状态的咖啡豆
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={randomSettings.flavorPeriodRanges.unknown}
                  onChange={e =>
                    handleFlavorPeriodRangeChange('unknown', e.target.checked)
                  }
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RandomCoffeeBeanSettings;
