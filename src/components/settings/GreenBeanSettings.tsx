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
} from './atomic';

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
  const [shouldRender, setShouldRender] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  // 用于保存最新的 onClose 引用
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

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
    <SettingPage title="生豆库" isVisible={isVisible} onClose={handleClose}>
      <SettingSection
        title="生豆库"
        footer="在咖啡豆库存概要中点击「咖啡豆」来切换生豆/熟豆库"
        className="-mt-4"
      >
        <SettingRow label="启用生豆库" isLast>
          <SettingToggle
            checked={settings.enableGreenBeanInventory || false}
            onChange={checked =>
              handleChange('enableGreenBeanInventory', checked)
            }
          />
        </SettingRow>
      </SettingSection>

      {settings.enableGreenBeanInventory && (
        <>
          <SettingSection title="快捷烘焙">
            <SettingRow
              label={'启用"全部烘焙"选项'}
              description="显示ALL按钮，可一次性烘焙剩余库存"
            >
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
            <SettingRow
              label="启用自定义烘焙量输入"
              description="允许用户在快捷烘焙框中输入任意数字"
              isLast
            >
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

          <SettingSection title="预设快捷烘焙量">
            <div className="p-4">
              <div className="mb-3 flex flex-wrap gap-2">
                {greenBeanRoastPresets.map(value => (
                  <button
                    key={value}
                    onClick={() => removeGreenBeanRoastPreset(value)}
                    className="rounded bg-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600"
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
                    className="w-16 rounded-l rounded-r-none bg-neutral-200 px-2 py-1.5 text-sm focus:ring-1 focus:ring-neutral-500 focus:outline-hidden dark:bg-neutral-700"
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
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                点击预设值可以删除，输入克数后按回车或点击"+"可以添加新的预设值。
              </p>
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
