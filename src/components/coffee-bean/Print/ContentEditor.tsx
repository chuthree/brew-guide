'use client';

import React, { useMemo, useRef, useState } from 'react';
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
import {
  PRINT_EDITOR_FIELD_LABELS,
  getPrintFieldOrder,
  hasPrintFieldContent,
} from './fields';
import { getResolvedPrintIcon } from './utils';
import { FieldEditorPanel } from './FieldEditorPanel';

const SOFT_BUTTON_CLASS =
  'rounded bg-neutral-200/50 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700';
const FIELD_BUTTON_BASE_CLASS =
  'h-8 min-w-0 rounded-[3px] border px-1.5 text-center text-xs font-medium transition-all bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700';

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
  onUpdateFlavorItem: (index: number, value: string) => void;
  onAddFlavor: () => void;
  onRemoveFlavor: (index: number) => void;
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
  onUpdateFlavorItem,
  onAddFlavor,
  onRemoveFlavor,
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
  const contentForVisibility = useMemo(
    () => ({ ...content, icon: resolvedIcon }),
    [content, resolvedIcon]
  );
  const activeField =
    selectedField && availableFields.includes(selectedField)
      ? selectedField
      : null;

  const handleIconUploadClick = () => {
    if (isIconProcessing) return;
    iconInputRef.current?.click();
  };

  const handleIconFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
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
  };

  const updateIconPlacement = (placement: Partial<PrintIconPlacement>) => {
    onUpdateIconPlacement(
      normalizePrintIconPlacement({
        ...config.iconPlacement,
        ...placement,
      })
    );
  };

  const handleZoomIcon = (delta: number) => {
    updateIconPlacement({ size: config.iconPlacement.size + delta });
  };

  const isFieldEmpty = (field: PrintFieldKey): boolean =>
    !hasPrintFieldContent(field, contentForVisibility, config.template);

  const getFieldButtonClass = (field: PrintFieldKey) => {
    const selected = activeField === field;
    const visible = config.fields[field];
    const filledAndVisible = visible && !isFieldEmpty(field);
    const stateClass = filledAndVisible
      ? 'border-neutral-100 opacity-100 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200'
      : 'border-dashed border-neutral-400 opacity-60 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400';
    const selectedClass = selected
      ? 'border-solid border-neutral-400 opacity-100 dark:border-neutral-500'
      : '';
    return `${FIELD_BUTTON_BASE_CLASS} ${stateClass} ${selectedClass}`;
  };

  const activeVisible = activeField ? config.fields[activeField] : false;
  const activeFieldEmpty = activeField ? isFieldEmpty(activeField) : true;
  const activeStatusLabel =
    activeField === 'icon' && isIconProcessing
      ? '处理中'
      : !activeVisible
        ? '已隐藏'
        : activeFieldEmpty
          ? '显示中(缺少内容)'
          : '显示中';
  const activeStatusButtonClass = activeVisible
    ? `border-neutral-100 opacity-100 text-neutral-700 dark:border-neutral-800 dark:text-neutral-200 ${SOFT_BUTTON_CLASS}`
    : `border-dashed border-neutral-400 opacity-60 text-neutral-600 dark:border-neutral-500 dark:text-neutral-300 ${SOFT_BUTTON_CLASS}`;

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
            onClick={() =>
              setSelectedField(current => (current === field ? null : field))
            }
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
          onUpdateFlavorItem={onUpdateFlavorItem}
          onAddFlavor={onAddFlavor}
          onRemoveFlavor={onRemoveFlavor}
          onIconFileChange={handleIconFileChange}
          onIconUploadClick={handleIconUploadClick}
          onIconSourceChange={onUpdateIconSource}
          onRemoveIcon={() => onUpdateIcon('')}
          onZoomIconIn={() => handleZoomIcon(2)}
          onZoomIconOut={() => handleZoomIcon(-2)}
          onResetIconPlacement={() =>
            onUpdateIconPlacement(DEFAULT_ICON_PLACEMENT)
          }
        />
      )}
    </div>
  );
};
