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
import SettingToggle from './atomic/SettingToggle';

interface BeanFieldSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BeanFieldSettingsRowProps {
  fieldId: BeanFieldId;
  label: string;
  isEnabled: boolean;
  isLast: boolean;
  onToggle: (fieldId: BeanFieldId, checked: boolean) => void;
}

const BeanFieldSettingsRow: React.FC<BeanFieldSettingsRowProps> = ({
  fieldId,
  label,
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
    <div className="flex items-stretch px-3.5">
      <div
        className={`flex min-w-0 flex-1 items-center justify-between py-3.5 ${
          !isLast ? 'border-b border-black/5 dark:border-white/5' : ''
        }`}
      >
        <div className="mr-4 min-w-0">
          <div className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">
            {label}
          </div>
        </div>
        <SettingToggle checked={isEnabled} onChange={handleToggle} />
      </div>
    </div>
  );
};

const BeanFieldSettingsDrawer: React.FC<BeanFieldSettingsDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const settings = useSettingsStore(state => state.settings) as SettingsOptions;
  const updateSettings = useSettingsStore(state => state.updateSettings);
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

  return (
    <ActionDrawer
      isOpen={isOpen}
      onClose={onClose}
      historyId="bean-field-settings"
    >
      <ActionDrawer.Content className="mb-8!">
        <div className="mb-5 px-1">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            咖啡豆字段
          </h2>
        </div>

        {(['origin', 'processing', 'variety'] as BeanFieldGroupId[]).map(
          group => {
            const fields = BEAN_FIELD_DEFINITIONS.filter(
              definition => definition.group === group
            );

            return (
              <div key={group} className="mb-5">
                <div className="mb-2 px-1 text-xs font-semibold tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
                  {BEAN_FIELD_GROUP_LABELS[group]}
                </div>
                <div className="overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800/60">
                  {fields.map((definition, index) => {
                    const isEnabled = enabledBeanFieldIdSet.has(definition.id);
                    const label =
                      definition.id === 'origin' ? '产地' : definition.label;

                    return (
                      <BeanFieldSettingsRow
                        key={definition.id}
                        fieldId={definition.id}
                        label={label}
                        isEnabled={isEnabled}
                        isLast={index === fields.length - 1}
                        onToggle={toggleBeanField}
                      />
                    );
                  })}
                </div>
              </div>
            );
          }
        )}
      </ActionDrawer.Content>
    </ActionDrawer>
  );
};

export default BeanFieldSettingsDrawer;
