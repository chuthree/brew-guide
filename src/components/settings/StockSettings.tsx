'use client';

import React, { useState, useEffect } from 'react';

import { SettingsOptions } from './Settings';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import hapticsUtils from '@/lib/ui/haptics';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import {
  SettingPage,
  SettingSection,
  SettingRow,
  SettingToggle,
  useScrollToHighlightedSetting,
} from './atomic';
import { makeSettingRowSearchId } from './settingsSearch';

interface StockSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
}

const StockSettings: React.FC<StockSettingsProps> = ({
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
  const [isVisible, setIsVisible] = useState(false);

  // 用于保存最新的 onClose 引用
  const onCloseRef = React.useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

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
    skipPageExitTransitionOnHistory: true,
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
  const [isAddingPreset, setIsAddingPreset] = useState(false);
  const [deletingPreset, setDeletingPreset] = useState<number | null>(null);
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
        setIsAddingPreset(false);
        if (settings.hapticFeedback) {
          hapticsUtils.light();
        }
      }
    }
  };

  const removeDecrementPreset = (value: number) => {
    const newPresets = decrementPresets.filter(v => v !== value);
    setDecrementPresets(newPresets);
    setDeletingPreset(null);
    handleChange('decrementPresets', newPresets);
    if (settings.hapticFeedback) {
      hapticsUtils.light();
    }
  };

  useEffect(() => {
    if (deletingPreset === null) return;

    const handleClick = () => setDeletingPreset(null);
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [deletingPreset]);

  const highlightedSettingId = useScrollToHighlightedSetting(
    `${decrementPresets.join(',')}:${isAddingPreset}`
  );
  const isPresetSectionHighlighted =
    highlightedSettingId === makeSettingRowSearchId('预设快捷扣除量');

  return (
    <SettingPage title="库存扣除" isVisible={isVisible} onClose={handleClose}>
      <SettingSection title="熟豆库存扣除" className="-mt-4">
        <SettingRow label="全部扣除">
          <SettingToggle
            checked={settings.enableAllDecrementOption}
            onChange={checked =>
              handleChange('enableAllDecrementOption', checked)
            }
          />
        </SettingRow>
        <SettingRow label="自定义扣除量" isLast>
          <SettingToggle
            checked={settings.enableCustomDecrementInput}
            onChange={checked =>
              handleChange('enableCustomDecrementInput', checked)
            }
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="预设快捷扣除量" contentShape="card">
        <div
          data-settings-search-id={makeSettingRowSearchId('预设快捷扣除量')}
          className={`transition-colors ${
            isPresetSectionHighlighted
              ? 'bg-neutral-200/70 dark:bg-neutral-700/45'
              : ''
          }`}
        >
          {isAddingPreset ? (
            <SettingRow vertical isLast={decrementPresets.length === 0}>
              <div className="flex h-4 min-w-0 items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="扣除克数"
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
                  onBlur={() => {
                    if (!decrementValue.trim()) setIsAddingPreset(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addDecrementPreset();
                    } else if (e.key === 'Escape') {
                      setIsAddingPreset(false);
                      setDecrementValue('');
                    }
                  }}
                  placeholder="输入扣除克数（g）"
                  autoFocus
                  className="h-4 min-w-0 flex-1 appearance-none bg-transparent p-0 text-sm leading-none font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
                />
                <button
                  type="button"
                  onClick={addDecrementPreset}
                  disabled={
                    !decrementValue ||
                    isNaN(parseFloat(decrementValue)) ||
                    parseFloat(decrementValue) <= 0 ||
                    decrementPresets.includes(
                      parseFloat(parseFloat(decrementValue).toFixed(1))
                    )
                  }
                  className="shrink-0 cursor-pointer text-sm leading-none font-medium text-neutral-600 active:opacity-70 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-300"
                >
                  添加
                </button>
              </div>
            </SettingRow>
          ) : (
            <SettingRow
              onClick={() => setIsAddingPreset(true)}
              isLast={decrementPresets.length === 0}
            >
              <span className="flex h-4 items-center text-sm leading-none font-medium text-neutral-900 dark:text-neutral-100">
                添加预设
              </span>
            </SettingRow>
          )}
          {decrementPresets.map((value, index) => (
            <SettingRow
              key={value}
              vertical
              isLast={index === decrementPresets.length - 1}
            >
              <div className="flex h-4 min-w-0 items-center justify-between gap-3 text-sm leading-none font-medium text-neutral-900 dark:text-neutral-100">
                <span className="min-w-0 truncate">{value} g</span>
                <button
                  type="button"
                  aria-label={`${deletingPreset === value ? '确认删除' : '删除'} ${value} g 的扣除预设`}
                  onClick={e => {
                    e.stopPropagation();
                    if (deletingPreset === value) {
                      removeDecrementPreset(value);
                    } else {
                      setDeletingPreset(value);
                    }
                  }}
                  className={`shrink-0 cursor-pointer text-sm leading-none font-medium active:opacity-70 ${
                    deletingPreset === value
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-neutral-600 dark:text-neutral-300'
                  }`}
                >
                  {deletingPreset === value ? '确认删除' : '删除'}
                </button>
              </div>
            </SettingRow>
          ))}
        </div>
      </SettingSection>
    </SettingPage>
  );
};

export default StockSettings;
