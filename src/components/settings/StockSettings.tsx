'use client';

import React, { useState, useEffect } from 'react';

import { SettingsOptions, defaultSettings } from './Settings';
import hapticsUtils from '@/lib/ui/haptics';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { SettingPage } from './atomic';

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
  // 控制动画状态
  const [shouldRender, setShouldRender] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

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
    id: 'stock-settings',
    isOpen: true,
    onClose: handleCloseWithAnimation,
  });

  // UI 返回按钮点击处理
  const handleClose = () => {
    modalHistory.back();
  };

  // 处理显示/隐藏动画（入场动画）
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });
  }, []);

  // ===== 熟豆扣除预设值状态 =====
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

  // ===== 生豆烘焙预设值状态 =====
  const [greenBeanRoastValue, setGreenBeanRoastValue] = useState<string>('');
  const [greenBeanRoastPresets, setGreenBeanRoastPresets] = useState<number[]>(
    settings.greenBeanRoastPresets || defaultSettings.greenBeanRoastPresets
  );

  useEffect(() => {
    if (settings.greenBeanRoastPresets) {
      setGreenBeanRoastPresets(settings.greenBeanRoastPresets);
    }
  }, [settings.greenBeanRoastPresets]);

  const addGreenBeanRoastPreset = () => {
    const value = parseFloat(greenBeanRoastValue);
    if (!isNaN(value) && value > 0) {
      const formattedValue = parseFloat(value.toFixed(1));
      if (!greenBeanRoastPresets.includes(formattedValue)) {
        const newPresets = [...greenBeanRoastPresets, formattedValue].sort(
          (a, b) => a - b
        );
        setGreenBeanRoastPresets(newPresets);
        handleChange('greenBeanRoastPresets', newPresets);
        setGreenBeanRoastValue('');
        if (settings.hapticFeedback) {
          hapticsUtils.light();
        }
      }
    }
  };

  const removeGreenBeanRoastPreset = (value: number) => {
    const newPresets = greenBeanRoastPresets.filter(v => v !== value);
    setGreenBeanRoastPresets(newPresets);
    handleChange('greenBeanRoastPresets', newPresets);
    if (settings.hapticFeedback) {
      hapticsUtils.light();
    }
  };

  if (!shouldRender) return null;

  return (
    <SettingPage
      title="库存扣除预设值"
      isVisible={isVisible}
      onClose={handleClose}
    >
      <div className="-mt-4 px-6 py-4">
        {/* ===== 熟豆扣除设置区域 ===== */}
        <div className="mb-8">
          <h3 className="mb-4 text-base font-medium text-neutral-800 dark:text-neutral-200">
            熟豆库存扣除
          </h3>

          {/* 功能开关选项 */}
          <div className="mb-6 space-y-4">
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
            <h4 className="mb-3 text-sm font-medium text-neutral-800 dark:text-neutral-200">
              预设扣除值管理
            </h4>
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
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            点击预设值可以删除，输入克数后按回车或点击"+"可以添加新的预设值。
          </p>
        </div>

        {/* 生豆烘焙设置区域 - 仅当生豆库功能启用时显示 */}
        {settings.enableGreenBeanInventory && (
          <>
            {/* 分隔线 */}
            <div className="my-6 border-t border-neutral-200 dark:border-neutral-700"></div>

            {/* ===== 生豆烘焙设置区域 ===== */}
            <div className="mb-4">
              <h3 className="mb-4 text-base font-medium text-neutral-800 dark:text-neutral-200">
                生豆快捷烘焙
              </h3>

              {/* 功能开关选项 */}
              <div className="mb-6 space-y-4">
                {/* ALL烘焙选项开关 */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                      启用&ldquo;全部烘焙&rdquo;选项
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      显示ALL按钮，可一次性烘焙剩余库存
                    </div>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={
                        settings.enableAllGreenBeanRoastOption ??
                        defaultSettings.enableAllGreenBeanRoastOption
                      }
                      onChange={e =>
                        handleChange(
                          'enableAllGreenBeanRoastOption',
                          e.target.checked
                        )
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
                      启用自定义烘焙量输入
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      允许用户在快捷烘焙框中输入任意数字
                    </div>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={
                        settings.enableCustomGreenBeanRoastInput ??
                        defaultSettings.enableCustomGreenBeanRoastInput
                      }
                      onChange={e =>
                        handleChange(
                          'enableCustomGreenBeanRoastInput',
                          e.target.checked
                        )
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                  </label>
                </div>
              </div>

              {/* 预设值管理 */}
              <div className="mb-2">
                <h4 className="mb-3 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  预设烘焙量管理
                </h4>
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                {greenBeanRoastPresets.map(value => (
                  <button
                    key={value}
                    onClick={() => removeGreenBeanRoastPreset(value)}
                    className="rounded bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                  >
                    -{value}g ×
                  </button>
                ))}

                <div className="flex h-9">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={greenBeanRoastValue}
                    onChange={e => {
                      const value = e.target.value.replace(/[^0-9.]/g, '');
                      const dotCount = (value.match(/\./g) || []).length;
                      let sanitizedValue =
                        dotCount > 1
                          ? value.substring(0, value.lastIndexOf('.'))
                          : value;
                      const dotIndex = sanitizedValue.indexOf('.');
                      if (
                        dotIndex !== -1 &&
                        dotIndex < sanitizedValue.length - 2
                      ) {
                        sanitizedValue = sanitizedValue.substring(
                          0,
                          dotIndex + 2
                        );
                      }
                      setGreenBeanRoastValue(sanitizedValue);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addGreenBeanRoastPreset();
                      }
                    }}
                    placeholder="克数"
                    className="w-16 rounded-l rounded-r-none bg-neutral-100 px-2 py-1.5 text-sm focus:ring-1 focus:ring-neutral-500 focus:outline-hidden dark:bg-neutral-800"
                  />
                  <button
                    onClick={addGreenBeanRoastPreset}
                    disabled={
                      !greenBeanRoastValue ||
                      isNaN(parseFloat(greenBeanRoastValue)) ||
                      parseFloat(greenBeanRoastValue) <= 0
                    }
                    className="rounded-r bg-neutral-700 px-2 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-20 dark:bg-neutral-600"
                  >
                    +
                  </button>
                </div>
              </div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                点击预设值可以删除，输入克数后按回车或点击"+"可以添加新的预设值。
              </p>
            </div>
          </>
        )}
      </div>
    </SettingPage>
  );
};

export default StockSettings;
