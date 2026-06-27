'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { showToast } from '@/components/common/feedback/LightToast';
import {
  PrintConfig,
  EditableContent,
  PrintFieldKey,
  PrintIconPlacement,
  PrintIconSource,
} from './types';
import { processThermalPrintIcon } from './iconProcessing';
import { DEFAULT_ICON_PLACEMENT, normalizePrintIconPlacement } from './config';
import { PRINT_EDITOR_FIELD_LABELS, getPrintFieldOrder } from './fields';
import { getResolvedPrintIcon } from './utils';
import { FieldEditorPanel } from './FieldEditorPanel';

const SOFT_BUTTON_CLASS =
  'rounded bg-neutral-200/50 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700';
const FIELD_BUTTON_BASE_CLASS =
  'h-8 min-w-0 rounded-[3px] px-1.5 text-center text-xs font-medium bg-neutral-100 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700';

const showIconToast = (type: 'success' | 'error', title: string): void => {
  showToast({ type, title, duration: type === 'error' ? 3200 : 1800 });
};

interface ContentEditorProps {
  config: PrintConfig;
  content: EditableContent;
  roasterIcon: string | null;
  onToggleField: (field: keyof PrintConfig['fields']) => void;
  onUpdateField: <K extends keyof EditableContent>(
    field: K,
    value: EditableContent[K]
  ) => void;
  onUpdateIcon: (icon: string) => void;
  onUpdateIconSource: (source: PrintIconSource) => void;
  onUpdateIconPlacement: (placement: PrintIconPlacement) => void;
  onResetContent: () => void;
}

export const ContentEditor: React.FC<ContentEditorProps> = ({
  config,
  content,
  roasterIcon,
  onToggleField,
  onUpdateField,
  onUpdateIcon,
  onUpdateIconSource,
  onUpdateIconPlacement,
  onResetContent,
}) => {
  const [selectedField, setSelectedField] = useState<PrintFieldKey | null>(
    null
  );
  const [isIconProcessing, setIsIconProcessing] = useState(false);
  const iconInputRef = useRef<HTMLInputElement | null>(null);
  const availableFields = getPrintFieldOrder(config.template);
  const resolvedIcon = useMemo(
    () => getResolvedPrintIcon(content, roasterIcon),
    [content, roasterIcon]
  );
  const activeField =
    selectedField && availableFields.includes(selectedField)
      ? selectedField
      : null;

  const handleIconUploadClick = useCallback(() => {
    if (isIconProcessing) return;
    iconInputRef.current?.click();
  }, [isIconProcessing]);

  const handleIconFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      if (!file) return;

      setIsIconProcessing(true);
      try {
        const icon = await processThermalPrintIcon(file);
        onUpdateIcon(icon);
        onUpdateIconSource('custom');
        showIconToast('success', '图标已添加');
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : '图标处理失败，请更换图片后重试';
        showIconToast('error', message);
      }
      setIsIconProcessing(false);
      input.value = '';
    },
    [onUpdateIcon, onUpdateIconSource]
  );

  const updateIconPlacement = useCallback(
    (placement: Partial<PrintIconPlacement>) => {
      onUpdateIconPlacement(
        normalizePrintIconPlacement({
          ...config.iconPlacement,
          ...placement,
        })
      );
    },
    [config.iconPlacement, onUpdateIconPlacement]
  );

  const handleZoomIcon = useCallback(
    (delta: number) => {
      updateIconPlacement({ size: config.iconPlacement.size + delta });
    },
    [config.iconPlacement.size, updateIconPlacement]
  );

  const getFieldButtonClass = useCallback(
    (field: PrintFieldKey) => {
      const selected = activeField === field;
      const visible = config.fields[field];
      const stateClass = visible
        ? 'opacity-100 text-neutral-700 dark:text-neutral-200'
        : 'opacity-50 text-neutral-700 hover:opacity-70 dark:text-neutral-200';
      const selectedClass = selected
        ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100'
        : '';
      return `${FIELD_BUTTON_BASE_CLASS} ${stateClass} ${selectedClass}`;
    },
    [activeField, config.fields]
  );

  const handleFieldButtonClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const field = event.currentTarget.dataset.field as
        | PrintFieldKey
        | undefined;
      if (!field) return;

      setSelectedField(current => (current === field ? null : field));
    },
    []
  );

  const handleRemoveIcon = useCallback(() => {
    onUpdateIcon('');
  }, [onUpdateIcon]);

  const handleZoomIconIn = useCallback(() => {
    handleZoomIcon(2);
  }, [handleZoomIcon]);

  const handleZoomIconOut = useCallback(() => {
    handleZoomIcon(-2);
  }, [handleZoomIcon]);

  const handleResetIconPlacement = useCallback(() => {
    onUpdateIconPlacement(DEFAULT_ICON_PLACEMENT);
  }, [onUpdateIconPlacement]);

  const activeVisible = activeField ? config.fields[activeField] : false;
  const activeStatusLabel =
    activeField === 'icon' && isIconProcessing
      ? '处理中'
      : activeVisible
        ? '显示中'
        : '已隐藏';
  const activeStatusButtonClass = activeVisible
    ? `opacity-100 text-neutral-700 dark:text-neutral-200 ${SOFT_BUTTON_CLASS}`
    : `opacity-60 text-neutral-700 hover:opacity-80 dark:text-neutral-200 ${SOFT_BUTTON_CLASS}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
          字段内容
        </div>
        <button
          type="button"
          onClick={onResetContent}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
        >
          <RotateCcw className="h-3 w-3" />
          重置内容
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {availableFields.map(field => (
          <button
            key={field}
            type="button"
            data-field={field}
            onClick={handleFieldButtonClick}
            className={getFieldButtonClass(field)}
          >
            <div className="truncate leading-none">
              {PRINT_EDITOR_FIELD_LABELS[field]}
            </div>
          </button>
        ))}
      </div>

      {activeField && (
        <FieldEditorPanel
          config={config}
          content={content}
          activeField={activeField}
          activeStatusLabel={activeStatusLabel}
          activeStatusButtonClass={activeStatusButtonClass}
          iconInputRef={iconInputRef}
          roasterIcon={roasterIcon}
          resolvedIcon={resolvedIcon}
          isIconProcessing={isIconProcessing}
          onToggleField={onToggleField}
          onUpdateField={onUpdateField}
          onIconFileChange={handleIconFileChange}
          onIconUploadClick={handleIconUploadClick}
          onIconSourceChange={onUpdateIconSource}
          onRemoveIcon={handleRemoveIcon}
          onZoomIconIn={handleZoomIconIn}
          onZoomIconOut={handleZoomIconOut}
          onResetIconPlacement={handleResetIconPlacement}
        />
      )}
    </div>
  );
};
