'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Minus, RotateCcw } from 'lucide-react';
import { PrintConfig, EditableContent, PrintFieldKey } from './types';
import { DatePicker } from '@/components/common/ui/DatePicker';
import {
  PRINT_EDITOR_FIELD_LABELS,
  PRINT_FIELD_ORDER,
  PRINT_TEXT_FIELD_PLACEHOLDERS,
  PrintTextFieldKey,
  hasPrintFieldContent,
} from './fields';

const INPUT_CLASS =
  'w-full rounded border border-neutral-200/50 bg-white px-2 py-1.5 text-xs focus:ring-2 focus:ring-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800';
const SOFT_BUTTON_CLASS =
  'rounded bg-neutral-200/50 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700';
const FIELD_BUTTON_BASE_CLASS =
  'h-8 min-w-0 rounded-[3px] border px-1.5 text-center text-xs font-medium transition-all bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700';

const createEditorItemKey = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `editor-item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

interface ContentEditorProps {
  config: PrintConfig;
  content: EditableContent;
  onToggleField: (field: keyof PrintConfig['fields']) => void;
  onUpdateField: <K extends keyof EditableContent>(
    field: K,
    value: EditableContent[K]
  ) => void;
  onUpdateFlavorItem: (index: number, value: string) => void;
  onAddFlavor: () => void;
  onRemoveFlavor: (index: number) => void;
  onResetContent: () => void;
}

export const ContentEditor: React.FC<ContentEditorProps> = ({
  config,
  content,
  onToggleField,
  onUpdateField,
  onUpdateFlavorItem,
  onAddFlavor,
  onRemoveFlavor,
  onResetContent,
}) => {
  const fieldsToRender = PRINT_FIELD_ORDER;
  const [selectedField, setSelectedField] = useState<PrintFieldKey | null>(null);
  const [flavorKeys, setFlavorKeys] = useState<string[]>(() =>
    content.flavor.map(() => createEditorItemKey())
  );
  const activeField =
    selectedField && fieldsToRender.includes(selectedField) ? selectedField : null;
  const editorPanelRef = useRef<HTMLDivElement | null>(null);

  const autoResizeTextarea = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  useEffect(() => {
    if (!editorPanelRef.current) {
      return;
    }
    const textareas = editorPanelRef.current.querySelectorAll(
      'textarea[data-autosize="true"]'
    );
    textareas.forEach(textarea => autoResizeTextarea(textarea as HTMLTextAreaElement));
  }, [content, activeField]);

  const visibleFlavorKeys = useMemo(() => {
    if (flavorKeys.length >= content.flavor.length) {
      return flavorKeys.slice(0, content.flavor.length);
    }

    return [
      ...flavorKeys,
      ...Array.from(
        { length: content.flavor.length - flavorKeys.length },
        createEditorItemKey
      ),
    ];
  }, [content.flavor.length, flavorKeys]);

  const handleAddFlavor = () => {
    setFlavorKeys([...visibleFlavorKeys, createEditorItemKey()]);
    onAddFlavor();
  };

  const handleRemoveFlavor = (index: number) => {
    setFlavorKeys(visibleFlavorKeys.filter((_, i) => i !== index));
    onRemoveFlavor(index);
  };

  const renderTextInput = (field: PrintTextFieldKey, placeholder: string) => (
    <textarea
      data-autosize="true"
      value={content[field]}
      onChange={e => onUpdateField(field, e.target.value)}
      onInput={e => autoResizeTextarea(e.currentTarget)}
      className={`${INPUT_CLASS} min-h-[32px] overflow-hidden resize-none leading-[1.4]`}
      placeholder={placeholder}
      rows={1}
    />
  );

  const renderFlavorEditor = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div />
        <button
          type="button"
          onClick={handleAddFlavor}
          className={`flex h-6 w-6 items-center justify-center ${SOFT_BUTTON_CLASS}`}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
      <div className="space-y-2">
        {content.flavor.map((flavor, index) => (
          <div
            key={visibleFlavorKeys[index] ?? `flavor-item-${index}`}
            className="flex items-center gap-2"
          >
            <textarea
              data-autosize="true"
              value={flavor}
              onChange={e => onUpdateFlavorItem(index, e.target.value)}
              onInput={e => autoResizeTextarea(e.currentTarget)}
              className={`${INPUT_CLASS} min-h-[32px] flex-1 overflow-hidden resize-none leading-[1.4]`}
              placeholder="风味描述"
              rows={1}
            />
            <button
              type="button"
              onClick={() => handleRemoveFlavor(index)}
              className={`flex h-6 w-6 items-center justify-center ${SOFT_BUTTON_CLASS}`}
            >
              <Minus className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderDateInput = () => (
    <div className="text-xs">
      <DatePicker
        date={content.roastDate ? new Date(content.roastDate) : undefined}
        onDateChange={date => {
          onUpdateField('roastDate', date.toISOString().split('T')[0]);
        }}
        placeholder="选择烘焙日期"
        locale="zh-CN"
      />
    </div>
  );

  const isFieldEmpty = (field: PrintFieldKey): boolean =>
    !hasPrintFieldContent(field, content, config.template);

  const renderFieldEditor = (field: PrintFieldKey) => {
    switch (field) {
      case 'name':
        return (
          <div className="space-y-2">
            <div className="space-y-1">
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                烘焙商（可选）
              </div>
              <textarea
                data-autosize="true"
                value={content.roaster}
                onChange={e => onUpdateField('roaster', e.target.value)}
                onInput={e => autoResizeTextarea(e.currentTarget)}
                className={`${INPUT_CLASS} min-h-[32px] overflow-hidden resize-none leading-[1.4]`}
                placeholder="默认使用咖啡豆中的烘焙商，可手动修改"
                rows={1}
              />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                名称
              </div>
              {renderTextInput('name', PRINT_TEXT_FIELD_PLACEHOLDERS.name)}
            </div>
          </div>
        );
      case 'roastDate':
        return renderDateInput();
      case 'origin':
        return renderTextInput('origin', PRINT_TEXT_FIELD_PLACEHOLDERS.origin);
      case 'estate':
        return renderTextInput('estate', PRINT_TEXT_FIELD_PLACEHOLDERS.estate);
      case 'process':
        return renderTextInput('process', PRINT_TEXT_FIELD_PLACEHOLDERS.process);
      case 'variety':
        return renderTextInput('variety', PRINT_TEXT_FIELD_PLACEHOLDERS.variety);
      case 'roastLevel':
        return renderTextInput(
          'roastLevel',
          PRINT_TEXT_FIELD_PLACEHOLDERS.roastLevel
        );
      case 'flavor':
        return renderFlavorEditor();
      case 'weight':
        return renderTextInput('weight', PRINT_TEXT_FIELD_PLACEHOLDERS.weight);
      case 'notes':
        return (
          <textarea
            data-autosize="true"
            value={content.notes}
            onChange={e => onUpdateField('notes', e.target.value)}
            onInput={e => autoResizeTextarea(e.currentTarget)}
            className={`${INPUT_CLASS} min-h-[72px] overflow-hidden resize-none`}
            placeholder="备注信息"
            rows={3}
          />
        );
      default:
        return null;
    }
  };

  const activeVisible = activeField ? config.fields[activeField] : false;
  const activeFieldEmpty = activeField ? isFieldEmpty(activeField) : true;
  const activeStatusLabel = !activeVisible
    ? '已隐藏'
    : activeFieldEmpty
      ? '显示中(缺少内容)'
      : '显示中';
  const activeStatusButtonClass = activeVisible
    ? `border-neutral-100 opacity-100 text-neutral-700 dark:border-neutral-800 dark:text-neutral-200 ${SOFT_BUTTON_CLASS}`
    : `border-dashed border-neutral-400 opacity-60 text-neutral-600 dark:border-neutral-500 dark:text-neutral-300 ${SOFT_BUTTON_CLASS}`;

  const getFieldButtonClass = (field: PrintFieldKey) => {
    const selected = activeField === field;
    const visible = config.fields[field];
    const empty = isFieldEmpty(field);
    const filledAndVisible = visible && !empty;
    const stateClass = `${
      filledAndVisible
        ? 'border-neutral-100 opacity-100 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200'
        : 'border-dashed border-neutral-400 opacity-60 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400'
    }`;
    const selectedClass = selected
      ? 'border-solid border-neutral-400 opacity-100 dark:border-neutral-500'
      : '';
    return `${FIELD_BUTTON_BASE_CLASS} ${stateClass} ${selectedClass}`;
  };

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
        {fieldsToRender.map(field => (
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
        <div
          ref={editorPanelRef}
          className="space-y-2 rounded bg-neutral-100 p-3 dark:bg-neutral-800/50"
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0 truncate text-xs font-medium text-neutral-700 dark:text-neutral-200">
              {PRINT_EDITOR_FIELD_LABELS[activeField]}
            </div>
            <button
              type="button"
              onClick={() => onToggleField(activeField)}
              className={`shrink-0 whitespace-nowrap rounded border px-2 py-1 text-xs font-medium leading-none transition-colors ${activeStatusButtonClass}`}
            >
              {activeStatusLabel}
            </button>
          </div>

          {renderFieldEditor(activeField)}
        </div>
      )}
    </div>
  );
};
