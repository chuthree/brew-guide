'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';

import { SettingsOptions } from './Settings';
import hapticsUtils from '@/lib/ui/haptics';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';

interface StockSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
}

const StockSettings: React.FC<StockSettingsProps> = ({
  settings,
  onClose,
  handleChange,
}) => {
  // 历史栈管理
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    window.history.pushState({ modal: 'stock-settings' }, '');

    const handlePopState = () => onCloseRef.current();
    window.addEventListener('popstate', handlePopState);

    return () => window.removeEventListener('popstate', handlePopState);
  }, []); // 空依赖数组，确保只在挂载时执行一次

  // 关闭处理
  const handleClose = () => {
    // 立即触发退出动画
    setIsVisible(false);

    // 立即通知父组件子设置正在关闭
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));

    // 等待动画完成后再真正关闭
    setTimeout(() => {
      if (window.history.state?.modal === 'stock-settings') {
        window.history.back();
      } else {
        onClose();
      }
    }, 350); // 与 IOS_TRANSITION_CONFIG.duration 一致
  };

  // 控制动画状态
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // 处理显示/隐藏动画
  useEffect(() => {
    setShouldRender(true);
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const [decrementValue, setDecrementValue] = useState<string>('');
  const [decrementPresets, setDecrementPresets] = useState<number[]>(
    settings.decrementPresets || []
  );

  useEffect(() => {
    if (settings.decrementPresets) {
      setDecrementPresets(settings.decrementPresets);
    }
  }, [settings.decrementPresets]);

  const addDecrementPreset = () => {
    const value = parseFloat(decrementValue);
    if (!isNaN(value) && value > 0) {
      const formattedValue = parseFloat(value.toFixed(1));
      if (!decrementPresets.includes(formattedValue)) {
        const newPresets = [...decrementPresets, formattedValue].sort(
          (a, b) => a - b
        );
        setDecrementPresets(newPresets);
        handleChange('decrementPresets', newPresets);
        setDecrementValue('');
        if (settings.hapticFeedback) {
          hapticsUtils.light();
        }
      }
    }
  };

  const removeDecrementPreset = (value: number) => {
    const newPresets = decrementPresets.filter(v => v !== value);
    setDecrementPresets(newPresets);
    handleChange('decrementPresets', newPresets);
    if (settings.hapticFeedback) {
      hapticsUtils.light();
    }
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
        <h2 className="text-lg font-medium text-neutral-800 dark:text-neutral-200">
          库存扣除预设值
        </h2>
      </div>

      <div className="pb-safe-bottom relative flex-1 overflow-y-auto">
        <div className="pointer-events-none sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 to-transparent dark:from-neutral-900"></div>
        <div className="-mt-4 px-6 py-4">
          {/* 功能开关选项 */}
          <div className="mb-8 space-y-4">
            {/* ALL扣除选项开关 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  启用&ldquo;全部扣除&rdquo;选项
                </div>
                <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  显示ALL按钮，可一次性扣除剩余库存
                </div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={settings.enableAllDecrementOption}
                  onChange={e =>
                    handleChange('enableAllDecrementOption', e.target.checked)
                  }
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
              </label>
            </div>

            {/* 自定义输入选项开关 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  启用自定义扣除输入
                </div>
                <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  允许用户在快捷扣除框中输入任意数字
                </div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={settings.enableCustomDecrementInput}
                  onChange={e =>
                    handleChange('enableCustomDecrementInput', e.target.checked)
                  }
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
              </label>
            </div>
          </div>

          {/* 预设值管理 */}
          <div className="mb-2">
            <h3 className="mb-3 text-sm font-medium text-neutral-800 dark:text-neutral-200">
              预设扣除值管理
            </h3>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {decrementPresets.map(value => (
              <button
                key={value}
                onClick={() => removeDecrementPreset(value)}
                className="rounded bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
              >
                -{value}g ×
              </button>
            ))}

            <div className="flex h-9">
              <input
                type="text"
                inputMode="decimal"
                value={decrementValue}
                onChange={e => {
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  const dotCount = (value.match(/\./g) || []).length;
                  let sanitizedValue =
                    dotCount > 1
                      ? value.substring(0, value.lastIndexOf('.'))
                      : value;
                  const dotIndex = sanitizedValue.indexOf('.');
                  if (dotIndex !== -1 && dotIndex < sanitizedValue.length - 2) {
                    sanitizedValue = sanitizedValue.substring(0, dotIndex + 2);
                  }
                  setDecrementValue(sanitizedValue);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addDecrementPreset();
                  }
                }}
                placeholder="克数"
                className="w-16 rounded-l rounded-r-none bg-neutral-100 px-2 py-1.5 text-sm focus:ring-1 focus:ring-neutral-500 focus:outline-hidden dark:bg-neutral-800"
              />
              <button
                onClick={addDecrementPreset}
                disabled={
                  !decrementValue ||
                  isNaN(parseFloat(decrementValue)) ||
                  parseFloat(decrementValue) <= 0
                }
                className="rounded-r bg-neutral-700 px-2 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-20 dark:bg-neutral-600"
              >
                +
              </button>
            </div>
          </div>
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
            点击预设值可以删除，输入克数后按回车或点击“+”可以添加新的预设值。
          </p>
        </div>
      </div>
    </div>
  );
};

export default StockSettings;
