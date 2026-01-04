'use client';

import React from 'react';
import { SettingsOptions } from './Settings';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { ButtonGroup } from '../ui/ButtonGroup';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import {
  SettingPage,
  SettingSection,
  SettingRow,
  SettingToggle,
  SettingSlider,
} from './atomic';

import BeanPreview from './BeanPreview';

interface BeanSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
}

const BeanSettings: React.FC<BeanSettingsProps> = ({
  settings: _settings,
  onClose,
  handleChange: _handleChange,
}) => {
  const settings = useSettingsStore(state => state.settings) as SettingsOptions;
  const updateSettings = useSettingsStore(state => state.updateSettings);

  const handleChange = React.useCallback(
    async <K extends keyof SettingsOptions>(
      key: K,
      value: SettingsOptions[K]
    ) => {
      await updateSettings({ [key]: value } as any);
    },
    [updateSettings]
  );

  const [isVisible, setIsVisible] = React.useState(false);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  const handleCloseWithAnimation = React.useCallback(() => {
    setIsVisible(false);
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));
    setTimeout(() => {
      onCloseRef.current();
    }, 350);
  }, []);

  useModalHistory({
    id: 'bean-settings',
    isOpen: true,
    onClose: handleCloseWithAnimation,
  });

  const handleClose = () => {
    modalHistory.back();
  };

  React.useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });
  }, []);

  return (
    <SettingPage title="咖啡豆设置" isVisible={isVisible} onClose={handleClose}>
      {/* 预览区域 */}
      <BeanPreview settings={settings} />

      <SettingSection title="概要" className="mt-6">
        <SettingRow label="详细剩余量">
          <SettingToggle
            checked={settings.showBeanSummary || false}
            onChange={checked => handleChange('showBeanSummary', checked)}
          />
        </SettingRow>
        <SettingRow label="预计杯数" isLast>
          <SettingToggle
            checked={settings.showEstimatedCups || false}
            onChange={checked => handleChange('showEstimatedCups', checked)}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="列表">
        <SettingRow label="日期模式">
          <div className="flex h-0 items-center">
            <ButtonGroup
              value={settings.dateDisplayMode || 'date'}
              options={[
                { value: 'date', label: '日期' },
                { value: 'flavorPeriod', label: '赏味期' },
                { value: 'agingDays', label: '养豆天数' },
              ]}
              onChange={value =>
                handleChange(
                  'dateDisplayMode',
                  value as 'date' | 'flavorPeriod' | 'agingDays'
                )
              }
            />
          </div>
        </SettingRow>

        <SettingRow label="价格">
          <SettingToggle
            checked={settings.showPrice !== false}
            onChange={checked => handleChange('showPrice', checked)}
          />
        </SettingRow>

        {settings.showPrice !== false && (
          <SettingRow label="总价">
            <SettingToggle
              checked={settings.showTotalPrice || false}
              onChange={checked => handleChange('showTotalPrice', checked)}
            />
          </SettingRow>
        )}

        <SettingRow label="状态点">
          <SettingToggle
            checked={settings.showStatusDots || false}
            onChange={checked => handleChange('showStatusDots', checked)}
          />
        </SettingRow>

        <SettingRow label="备注" isLast={settings.showBeanNotes === false}>
          <SettingToggle
            checked={settings.showBeanNotes !== false}
            onChange={checked => handleChange('showBeanNotes', checked)}
          />
        </SettingRow>

        {settings.showBeanNotes !== false && (
          <>
            <SettingRow label="风味">
              <SettingToggle
                checked={settings.showFlavorInfo || false}
                onChange={checked => handleChange('showFlavorInfo', checked)}
              />
            </SettingRow>
            <SettingRow label="备注行数限制" isLast={!settings.limitNotesLines}>
              <SettingToggle
                checked={settings.limitNotesLines || false}
                onChange={checked => handleChange('limitNotesLines', checked)}
              />
            </SettingRow>
            {settings.limitNotesLines && (
              <SettingRow isLast vertical>
                <SettingSlider
                  min={1}
                  max={5}
                  step={1}
                  value={settings.notesMaxLines || 3}
                  onChange={val => handleChange('notesMaxLines', val)}
                  minLabel="1行"
                  maxLabel="5行"
                  showTicks
                />
              </SettingRow>
            )}
          </>
        )}
      </SettingSection>

      <SettingSection title="详情页">
        <SettingRow label="标签打印">
          <SettingToggle
            checked={settings.enableBeanPrint || false}
            onChange={checked => handleChange('enableBeanPrint', checked)}
          />
        </SettingRow>
        <SettingRow label="评分" isLast>
          <SettingToggle
            checked={settings.showBeanRating || false}
            onChange={checked => handleChange('showBeanRating', checked)}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="添加">
        <SettingRow label="自动填充图片">
          <SettingToggle
            checked={settings.autoFillRecognitionImage || false}
            onChange={checked =>
              handleChange('autoFillRecognitionImage', checked)
            }
          />
        </SettingRow>
        <SettingRow label="庄园" isLast>
          <SettingToggle
            checked={settings.showEstateField || false}
            onChange={checked => handleChange('showEstateField', checked)}
          />
        </SettingRow>
      </SettingSection>
    </SettingPage>
  );
};

export default BeanSettings;
