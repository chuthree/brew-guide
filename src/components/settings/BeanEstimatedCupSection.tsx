'use client';

import React from 'react';
import type { SettingsOptions } from './Settings';
import {
  ESTIMATED_CUP_DOSE_ITEMS,
  formatEstimatedCupDose,
  normalizeEstimatedCupDoseSettings,
  parseEstimatedCupDoseInput,
  sanitizeEstimatedCupDoseInput,
  type EstimatedCupBeanType,
} from '@/lib/settings/estimatedCupDose';
import {
  SettingPillInput,
  SettingRow,
  SettingSection,
  SettingToggle,
} from './atomic';

interface BeanEstimatedCupSectionProps {
  settings: SettingsOptions;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
}

const BeanEstimatedCupSection: React.FC<BeanEstimatedCupSectionProps> = ({
  settings,
  handleChange,
}) => {
  const estimatedCupDoseSettings = React.useMemo(
    () => normalizeEstimatedCupDoseSettings(settings.estimatedCupDoseSettings),
    [settings.estimatedCupDoseSettings]
  );
  const [estimatedCupDoseInputs, setEstimatedCupDoseInputs] = React.useState(
    () => ({
      filter: formatEstimatedCupDose(estimatedCupDoseSettings.filter),
      espresso: formatEstimatedCupDose(estimatedCupDoseSettings.espresso),
      omni: formatEstimatedCupDose(estimatedCupDoseSettings.omni),
    })
  );

  React.useEffect(() => {
    setEstimatedCupDoseInputs({
      filter: formatEstimatedCupDose(estimatedCupDoseSettings.filter),
      espresso: formatEstimatedCupDose(estimatedCupDoseSettings.espresso),
      omni: formatEstimatedCupDose(estimatedCupDoseSettings.omni),
    });
  }, [estimatedCupDoseSettings]);

  const handleEstimatedCupDoseInputChange = React.useCallback(
    (beanType: EstimatedCupBeanType, value: string) => {
      setEstimatedCupDoseInputs(currentInputs => ({
        ...currentInputs,
        [beanType]: sanitizeEstimatedCupDoseInput(value),
      }));
    },
    []
  );

  const commitEstimatedCupDoseInput = React.useCallback(
    async (beanType: EstimatedCupBeanType) => {
      const currentValue = estimatedCupDoseSettings[beanType];
      const parsedValue = parseEstimatedCupDoseInput(
        estimatedCupDoseInputs[beanType]
      );
      const nextValue = parsedValue ?? currentValue;

      setEstimatedCupDoseInputs(currentInputs => ({
        ...currentInputs,
        [beanType]: formatEstimatedCupDose(nextValue),
      }));

      if (nextValue === currentValue) {
        return;
      }

      await handleChange('estimatedCupDoseSettings', {
        ...estimatedCupDoseSettings,
        [beanType]: nextValue,
      });
    },
    [estimatedCupDoseInputs, estimatedCupDoseSettings, handleChange]
  );

  return (
    <SettingSection title="概要" className="mt-6">
      <SettingRow label="详细剩余量">
        <SettingToggle
          checked={settings.showBeanSummary || false}
          onChange={checked => handleChange('showBeanSummary', checked)}
        />
      </SettingRow>
      <SettingRow label="预计杯数" isLast={!settings.showEstimatedCups}>
        <SettingToggle
          checked={settings.showEstimatedCups || false}
          onChange={checked => handleChange('showEstimatedCups', checked)}
        />
      </SettingRow>
      {settings.showEstimatedCups &&
        ESTIMATED_CUP_DOSE_ITEMS.map((item, index) => {
          const isLast = index === ESTIMATED_CUP_DOSE_ITEMS.length - 1;

          return (
            <SettingRow
              key={item.key}
              label={item.label}
              isSubSetting
              isLast={isLast}
            >
              <SettingPillInput
                value={estimatedCupDoseInputs[item.key]}
                inputMode="decimal"
                suffix="g"
                placeholder="克重"
                onChange={value =>
                  handleEstimatedCupDoseInputChange(item.key, value)
                }
                onBlur={() => {
                  void commitEstimatedCupDoseInput(item.key);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void commitEstimatedCupDoseInput(item.key);
                  }
                }}
              />
            </SettingRow>
          );
        })}
    </SettingSection>
  );
};

export default BeanEstimatedCupSection;
