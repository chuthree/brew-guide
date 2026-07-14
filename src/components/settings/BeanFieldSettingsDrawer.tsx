'use client';

import React from 'react';

import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import {
  BEAN_FIELD_DEFINITIONS,
  BEAN_FIELD_GROUP_LABELS,
  resolveBeanFieldConfig,
  type BeanFieldConfig,
  type BeanFieldId,
  type BeanFieldGroupId,
} from '@/lib/coffee-beans/beanFields';
import type { SettingsOptions } from './Settings';
import SettingSelector, {
  type SettingSelectorOption,
} from './atomic/SettingSelector';
import SettingRow from './atomic/SettingRow';
import SettingSection from './atomic/SettingSection';
import SettingToggle from './atomic/SettingToggle';
import { useScrollToHighlightedSetting } from './atomic/SettingSearchHighlightContext';
import { makeSettingRowSearchId } from './settingsSearch';

const ROASTER_SETTING_ID = makeSettingRowSearchId('烘焙商');
const ROASTER_SEPARATOR_SETTING_ID = makeSettingRowSearchId('烘焙商分隔符');
const ROASTER_SEPARATOR_OPTIONS: SettingSelectorOption<' ' | '/'>[] = [
  { value: ' ', label: '空格' },
  { value: '/', label: '/' },
];
const EMPTY_SCROLL_FADE = { top: false, bottom: false };
const SCROLL_CONTAINER_STYLE: React.CSSProperties = {
  maxHeight: 'calc(88dvh - 3rem - env(safe-area-inset-bottom))',
};

interface BeanFieldSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BeanFieldSettingsRowProps {
  fieldId: BeanFieldId;
  label: string;
  settingId: string;
  isEnabled: boolean;
  isLast: boolean;
  onToggle: (fieldId: BeanFieldId, checked: boolean) => void;
}

const BeanFieldSettingsRow: React.FC<BeanFieldSettingsRowProps> = ({
  fieldId,
  label,
  settingId,
  isEnabled,
  isLast,
  onToggle,
}) => {
  const handleToggle = React.useCallback(
    (checked: boolean) => {
      onToggle(fieldId, checked);
    },
    [fieldId, onToggle]
  );

  return (
    <SettingRow label={label} settingId={settingId} isLast={isLast}>
      <SettingToggle checked={isEnabled} onChange={handleToggle} />
    </SettingRow>
  );
};

const BeanFieldSettingsDrawer: React.FC<BeanFieldSettingsDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const highlightedSettingId = useScrollToHighlightedSetting(isOpen);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [scrollFade, setScrollFade] = React.useState(EMPTY_SCROLL_FADE);
  const settings = useSettingsStore(state => state.settings) as SettingsOptions;
  const updateSettings = useSettingsStore(state => state.updateSettings);
  const handleRoasterFieldToggle = React.useCallback(
    (checked: boolean) => {
      void updateSettings({ roasterFieldEnabled: checked });
    },
    [updateSettings]
  );
  const handleRoasterSeparatorChange = React.useCallback(
    (value: ' ' | '/') => {
      void updateSettings({ roasterSeparator: value });
    },
    [updateSettings]
  );
  const showRoasterSeparator =
    settings.roasterFieldEnabled !== false ||
    highlightedSettingId === ROASTER_SEPARATOR_SETTING_ID;
  const beanFieldConfig = React.useMemo(
    () => resolveBeanFieldConfig(settings),
    [settings]
  );
  const enabledBeanFieldIdSet = React.useMemo(
    () =>
      new Set(
        beanFieldConfig.fields
          .filter(field => field.enabled)
          .map(field => field.id)
      ),
    [beanFieldConfig]
  );

  const updateBeanFieldConfig = React.useCallback(
    async (nextConfig: BeanFieldConfig) => {
      await updateSettings({ beanFieldConfig: nextConfig });
    },
    [updateSettings]
  );

  const toggleBeanField = React.useCallback(
    (fieldId: BeanFieldId, checked: boolean) => {
      const nextFields = beanFieldConfig.fields.map(field =>
        field.id === fieldId ? { ...field, enabled: checked } : field
      );
      void updateBeanFieldConfig({ version: 1, fields: nextFields });
    },
    [beanFieldConfig.fields, updateBeanFieldConfig]
  );

  const updateScrollFade = React.useCallback(() => {
    const element = scrollContainerRef.current;
    if (!element) return;

    const canScroll = element.scrollHeight > element.clientHeight + 1;
    const nextFade = {
      top: canScroll && element.scrollTop > 1,
      bottom:
        canScroll &&
        element.scrollTop + element.clientHeight < element.scrollHeight - 1,
    };

    setScrollFade(current =>
      current.top === nextFade.top && current.bottom === nextFade.bottom
        ? current
        : nextFade
    );
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;

    const frame = requestAnimationFrame(updateScrollFade);
    const element = scrollContainerRef.current;
    const resizeObserver =
      element && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updateScrollFade)
        : null;

    if (element && resizeObserver) {
      resizeObserver.observe(element);
    }

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
    };
  }, [isOpen, showRoasterSeparator, updateScrollFade]);

  return (
    <ActionDrawer
      isOpen={isOpen}
      onClose={onClose}
      historyId="bean-field-settings"
    >
      <ActionDrawer.Content className="mb-0! space-y-0!">
        <div className="relative">
          <div
            ref={scrollContainerRef}
            onScroll={updateScrollFade}
            className="overflow-x-hidden overflow-y-auto overscroll-contain"
            style={SCROLL_CONTAINER_STYLE}
          >
            <SettingSection title="基础" className="-mx-6">
              <SettingRow
                label="烘焙商"
                settingId={ROASTER_SETTING_ID}
                isLast={!showRoasterSeparator}
              >
                <SettingToggle
                  checked={settings.roasterFieldEnabled !== false}
                  onChange={handleRoasterFieldToggle}
                />
              </SettingRow>
              {showRoasterSeparator && (
                <SettingRow
                  label="烘焙商分隔符"
                  settingId={ROASTER_SEPARATOR_SETTING_ID}
                  isLast
                  isSubSetting
                >
                  <SettingSelector
                    value={settings.roasterSeparator || ' '}
                    options={ROASTER_SEPARATOR_OPTIONS}
                    ariaLabel="烘焙商分隔符"
                    onChange={handleRoasterSeparatorChange}
                  />
                </SettingRow>
              )}
            </SettingSection>

            {(['origin', 'processing', 'variety'] as BeanFieldGroupId[]).map(
              group => {
                const fields = BEAN_FIELD_DEFINITIONS.filter(
                  definition => definition.group === group
                );

                return (
                  <SettingSection
                    key={group}
                    title={BEAN_FIELD_GROUP_LABELS[group]}
                    className="-mx-6"
                  >
                    {fields.map((definition, index) => {
                      const isEnabled = enabledBeanFieldIdSet.has(
                        definition.id
                      );
                      const label =
                        definition.id === 'origin' ? '产地' : definition.label;
                      const settingId = makeSettingRowSearchId(label);

                      return (
                        <BeanFieldSettingsRow
                          key={definition.id}
                          fieldId={definition.id}
                          label={label}
                          settingId={settingId}
                          isEnabled={isEnabled}
                          isLast={index === fields.length - 1}
                          onToggle={toggleBeanField}
                        />
                      );
                    })}
                  </SettingSection>
                );
              }
            )}
          </div>
          <div
            className={`fade-mask-to-b pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-white transition-opacity duration-200 dark:bg-neutral-900 ${
              scrollFade.top ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div
            className={`fade-mask-to-t pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-white transition-opacity duration-200 dark:bg-neutral-900 ${
              scrollFade.bottom ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      </ActionDrawer.Content>
    </ActionDrawer>
  );
};

export default BeanFieldSettingsDrawer;
