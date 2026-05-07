'use client';

import React from 'react';

import { SettingsOptions } from './Settings';
import {
  SettingPillInput,
  SettingRow,
  SettingSection,
  SettingToggle,
} from './atomic';

interface BeanSummaryCapacityLimitSectionProps {
  settings: SettingsOptions;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
}

const DEFAULT_MAX_DISPLAY_CAPACITY = 1000;

const BeanSummaryCapacityLimitSection: React.FC<
  BeanSummaryCapacityLimitSectionProps
> = ({ settings, handleChange }) => {
  const [capacityInput, setCapacityInput] = React.useState(
    String(
      settings.beanSummaryMaxDisplayCapacity || DEFAULT_MAX_DISPLAY_CAPACITY
    )
  );

  React.useEffect(() => {
    setCapacityInput(
      String(
        settings.beanSummaryMaxDisplayCapacity || DEFAULT_MAX_DISPLAY_CAPACITY
      )
    );
  }, [settings.beanSummaryMaxDisplayCapacity]);

  const commitCapacityInput = React.useCallback(async () => {
    const parsedValue = Number.parseInt(capacityInput, 10);
    const nextValue =
      Number.isFinite(parsedValue) && parsedValue > 0
        ? parsedValue
        : DEFAULT_MAX_DISPLAY_CAPACITY;

    setCapacityInput(String(nextValue));

    if (
      nextValue !==
      (settings.beanSummaryMaxDisplayCapacity || DEFAULT_MAX_DISPLAY_CAPACITY)
    ) {
      await handleChange('beanSummaryMaxDisplayCapacity', nextValue);
    }
  }, [capacityInput, handleChange, settings.beanSummaryMaxDisplayCapacity]);

  return (
    <SettingSection
      title="容量显示"
      footer={
        !settings.enableBeanSummaryCapacityLimit
          ? '限制咖啡豆概要中的剩余容量显示上限。超过上限时，将以 1 kg+ 这类形式展示。'
          : !settings.enableBeanSummaryOverflowWrap
            ? '开启循环显示后，超过上限将从 0 重新累计（不显示 +）。'
            : undefined
      }
    >
      <SettingRow
        label="最大显示容量"
        isLast={!settings.enableBeanSummaryCapacityLimit}
      >
        <SettingToggle
          checked={settings.enableBeanSummaryCapacityLimit || false}
          onChange={checked =>
            handleChange('enableBeanSummaryCapacityLimit', checked)
          }
        />
      </SettingRow>
      {settings.enableBeanSummaryCapacityLimit && (
        <>
          <SettingRow label="超过上限循环显示" isSubSetting>
            <SettingToggle
              checked={settings.enableBeanSummaryOverflowWrap || false}
              onChange={checked =>
                handleChange('enableBeanSummaryOverflowWrap', checked)
              }
            />
          </SettingRow>
          <SettingRow label="显示上限" isSubSetting isLast>
            <SettingPillInput
              value={capacityInput}
              inputMode="numeric"
              suffix="g"
              placeholder="克数"
              onChange={value => {
                const sanitizedValue = value.replace(/\D/g, '');
                setCapacityInput(sanitizedValue);
              }}
              onBlur={() => {
                void commitCapacityInput();
              }}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void commitCapacityInput();
                }
              }}
            />
          </SettingRow>
        </>
      )}
    </SettingSection>
  );
};

export default BeanSummaryCapacityLimitSection;
