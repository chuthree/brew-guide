'use client';

import React from 'react';

import { SettingsOptions, defaultSettings } from './Settings';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { ButtonGroup } from '@/components/ui/ButtonGroup';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import {
  SettingPage,
  SettingSection,
  SettingRow,
  SettingToggle,
} from './atomic';

interface RandomCoffeeBeanSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void;
}

const RandomCoffeeBeanSettings: React.FC<RandomCoffeeBeanSettingsProps> = ({
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
    <SettingPage
      title="随机咖啡豆设置"
      isVisible={isVisible}
      onClose={handleClose}
    >
      <SettingSection title="随机类型">
        <SettingRow
          label="长按随机不同类型咖啡豆"
          isLast={!randomSettings.enableLongPressRandomType}
        >
          <SettingToggle
            checked={randomSettings.enableLongPressRandomType}
            onChange={handleLongPressRandomChange}
          />
        </SettingRow>

        {randomSettings.enableLongPressRandomType && (
          <SettingRow
            label="长按时随机的类型"
            description={`点击随机${
              randomSettings.defaultRandomType === 'espresso' ? '手冲' : '意式'
            }豆，长按随机${
              randomSettings.defaultRandomType === 'espresso' ? '意式' : '手冲'
            }豆`}
            isLast
          >
            <div className="flex h-0 items-center">
              <ButtonGroup
                value={randomSettings.defaultRandomType}
                options={[
                  { value: 'espresso', label: '意式' },
                  { value: 'filter', label: '手冲' },
                ]}
                onChange={val =>
                  handleDefaultRandomTypeChange(val as 'espresso' | 'filter')
                }
              />
            </div>
          </SettingRow>
        )}
      </SettingSection>

      <SettingSection title="随机范围">
        <SettingRow label="养豆期">
          <SettingToggle
            checked={randomSettings.flavorPeriodRanges.aging}
            onChange={checked =>
              handleFlavorPeriodRangeChange('aging', checked)
            }
          />
        </SettingRow>

        <SettingRow label="赏味期">
          <SettingToggle
            checked={randomSettings.flavorPeriodRanges.optimal}
            onChange={checked =>
              handleFlavorPeriodRangeChange('optimal', checked)
            }
          />
        </SettingRow>

        <SettingRow label="衰退期">
          <SettingToggle
            checked={randomSettings.flavorPeriodRanges.decline}
            onChange={checked =>
              handleFlavorPeriodRangeChange('decline', checked)
            }
          />
        </SettingRow>

        <SettingRow label="冷冻">
          <SettingToggle
            checked={randomSettings.flavorPeriodRanges.frozen}
            onChange={checked =>
              handleFlavorPeriodRangeChange('frozen', checked)
            }
          />
        </SettingRow>

        <SettingRow label="在途">
          <SettingToggle
            checked={randomSettings.flavorPeriodRanges.inTransit}
            onChange={checked =>
              handleFlavorPeriodRangeChange('inTransit', checked)
            }
          />
        </SettingRow>

        <SettingRow label="未知状态" isLast>
          <SettingToggle
            checked={randomSettings.flavorPeriodRanges.unknown}
            onChange={checked =>
              handleFlavorPeriodRangeChange('unknown', checked)
            }
          />
        </SettingRow>
      </SettingSection>
    </SettingPage>
  );
};

export default RandomCoffeeBeanSettings;
