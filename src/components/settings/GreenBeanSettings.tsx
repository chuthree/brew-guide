'use client';

import React, { useState, useEffect } from 'react';
import { SettingsOptions, defaultSettings } from './Settings';
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
import {
  makeSettingRowSearchId,
  shouldRevealGreenBeanSearchSettings,
} from './settingsSearch';

interface GreenBeanSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
}

const GreenBeanSettings: React.FC<GreenBeanSettingsProps> = ({
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
    // 立即触发退出动画
    setIsVisible(false);

    // 立即通知父组件子设置正在关闭
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));

    // 等待动画完成后真正关闭
    setTimeout(() => {
      onCloseRef.current();
    }, 350); // 与 IOS_TRANSITION_CONFIG.duration 一致
  }, []);

  // 使用统一的历史栈管理系统
  useModalHistory({
    id: 'green-bean-settings',
    isOpen: true, // 子设置页面挂载即为打开状态
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

  // ===== 生豆烘焙预设值状态 =====
  const [greenBeanRoastValue, setGreenBeanRoastValue] = useState<string>('');
  const [isAddingPreset, setIsAddingPreset] = useState(false);
  const [deletingPreset, setDeletingPreset] = useState<number | null>(null);
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
        setIsAddingPreset(false);
        if (settings.hapticFeedback) {
          hapticsUtils.light();
        }
      }
    }
  };

  const removeGreenBeanRoastPreset = (value: number) => {
    const newPresets = greenBeanRoastPresets.filter(v => v !== value);
    setGreenBeanRoastPresets(newPresets);
    setDeletingPreset(null);
    handleChange('greenBeanRoastPresets', newPresets);
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
    `${greenBeanRoastPresets.join(',')}:${isAddingPreset}`
  );
  const isPresetSectionHighlighted =
    highlightedSettingId === makeSettingRowSearchId('预设快捷烘焙量');
  const [hasRevealedSearchDetails, setHasRevealedSearchDetails] =
    React.useState(false);
  const shouldRevealSearchDetails = shouldRevealGreenBeanSearchSettings(
    highlightedSettingId
  );

  React.useEffect(() => {
    if (shouldRevealSearchDetails) {
      setHasRevealedSearchDetails(true);
    }
  }, [shouldRevealSearchDetails]);

  const showGreenBeanDetails =
    Boolean(settings.enableGreenBeanInventory) ||
    hasRevealedSearchDetails;

  return (
    <SettingPage title="生豆库" isVisible={isVisible} onClose={handleClose}>
      <SettingSection
        title="生豆库"
        footer="轻点库存概要中的“咖啡豆”，切换生豆库与熟豆库。"
        className="-mt-4"
      >
        <SettingRow label="生豆库" isLast>
          <SettingToggle
            checked={settings.enableGreenBeanInventory || false}
            onChange={checked =>
              handleChange('enableGreenBeanInventory', checked)
            }
          />
        </SettingRow>
      </SettingSection>

      {showGreenBeanDetails && (
        <>
          <SettingSection title="快捷烘焙">
            <SettingRow label="全部烘焙">
              <SettingToggle
                checked={
                  settings.enableAllGreenBeanRoastOption ??
                  defaultSettings.enableAllGreenBeanRoastOption
                }
                onChange={checked =>
                  handleChange('enableAllGreenBeanRoastOption', checked)
                }
              />
            </SettingRow>
            <SettingRow label="自定义烘焙量" isLast>
              <SettingToggle
                checked={
                  settings.enableCustomGreenBeanRoastInput ??
                  defaultSettings.enableCustomGreenBeanRoastInput
                }
                onChange={checked =>
                  handleChange('enableCustomGreenBeanRoastInput', checked)
                }
              />
            </SettingRow>
          </SettingSection>

          <SettingSection title="预设快捷烘焙量" contentShape="card">
            <div
              data-settings-search-id={makeSettingRowSearchId('预设快捷烘焙量')}
              className={`transition-colors ${
                isPresetSectionHighlighted
                  ? 'bg-neutral-200/70 dark:bg-neutral-700/45'
                  : ''
              }`}
            >
              {isAddingPreset ? (
                <SettingRow vertical isLast={greenBeanRoastPresets.length === 0}>
                  <div className="flex h-4 min-w-0 items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label="烘焙克数"
                      value={greenBeanRoastValue}
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
                        setGreenBeanRoastValue(sanitizedValue);
                      }}
                      onBlur={() => {
                        if (!greenBeanRoastValue.trim()) setIsAddingPreset(false);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addGreenBeanRoastPreset();
                        } else if (e.key === 'Escape') {
                          setIsAddingPreset(false);
                          setGreenBeanRoastValue('');
                        }
                      }}
                      placeholder="输入烘焙克数（g）"
                      autoFocus
                      className="h-4 min-w-0 flex-1 appearance-none bg-transparent p-0 text-sm leading-none font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
                    />
                    <button
                      type="button"
                      onClick={addGreenBeanRoastPreset}
                      disabled={
                        !greenBeanRoastValue ||
                        isNaN(parseFloat(greenBeanRoastValue)) ||
                        parseFloat(greenBeanRoastValue) <= 0 ||
                        greenBeanRoastPresets.includes(
                          parseFloat(parseFloat(greenBeanRoastValue).toFixed(1))
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
                  isLast={greenBeanRoastPresets.length === 0}
                >
                  <span className="flex h-4 items-center text-sm leading-none font-medium text-neutral-900 dark:text-neutral-100">
                    添加预设
                  </span>
                </SettingRow>
              )}
              {greenBeanRoastPresets.map((value, index) => (
                <SettingRow
                  key={value}
                  vertical
                  isLast={index === greenBeanRoastPresets.length - 1}
                >
                  <div className="flex h-4 min-w-0 items-center justify-between gap-3 text-sm leading-none font-medium text-neutral-900 dark:text-neutral-100">
                    <span className="min-w-0 truncate">{value} g</span>
                    <button
                      type="button"
                      aria-label={`${deletingPreset === value ? '确认删除' : '删除'} ${value} g 的烘焙预设`}
                      onClick={e => {
                        e.stopPropagation();
                        if (deletingPreset === value) {
                          removeGreenBeanRoastPreset(value);
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

          <SettingSection
            title="数据转换"
            footer={
              <div className="space-y-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                <p>
                  在生豆库功能上线前，你可能用熟豆记录来管理生豆。此功能可将这些旧数据转换为正确的生豆库格式。
                </p>
                <p>
                  转换后，已用掉的部分会变成「烘焙记录 +
                  新熟豆」，剩余部分保留在生豆中。原有的冲煮笔记会自动迁移到新熟豆，快捷扣除等变动记录会被清理。
                </p>
                <p className="text-neutral-400 dark:text-neutral-500">
                  仅限未关联生豆来源的熟豆使用，数据变动较大，建议先备份。
                </p>
              </div>
            }
          >
            <SettingRow label="熟豆转生豆" isLast>
              <SettingToggle
                checked={settings.enableConvertToGreen || false}
                onChange={checked =>
                  handleChange('enableConvertToGreen', checked)
                }
              />
            </SettingRow>
          </SettingSection>
        </>
      )}
    </SettingPage>
  );
};

export default GreenBeanSettings;
