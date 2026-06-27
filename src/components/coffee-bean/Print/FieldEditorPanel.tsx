'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { DatePicker } from '@/components/common/ui/DatePicker';
import {
  PrintConfig,
  EditableContent,
  PrintFieldKey,
  PrintIconSource,
} from './types';
import { IconFieldEditor } from './IconFieldEditor';
import {
  PRINT_EDITOR_FIELD_LABELS,
  PRINT_TEXT_FIELD_PLACEHOLDERS,
  PrintTextFieldKey,
} from './fields';
import { getLocalDateString, parseLocalDateString } from './utils';

const INPUT_SHELL_CLASS =
  'flex min-h-8 w-full gap-2 rounded bg-neutral-200/50 px-2 text-xs font-medium text-neutral-700 transition-colors focus-within:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:focus-within:bg-neutral-700';
const INPUT_LABEL_CLASS = 'shrink-0 text-neutral-500 dark:text-neutral-400';
const INPUT_TEXTAREA_CLASS =
  'min-w-0 flex-1 resize-none overflow-hidden bg-transparent py-1.5 text-xs leading-[1.4] text-neutral-800 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500';
const DATE_PICKER_TRIGGER_CLASS =
  'h-8 justify-start border-0 border-b-0 bg-transparent py-0 text-xs font-medium text-neutral-800 focus-within:border-transparent dark:border-transparent dark:text-neutral-100 dark:focus-within:border-transparent';

const autoResizeTextarea = (textarea: HTMLTextAreaElement) => {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
};

type TextEditableField = PrintTextFieldKey | 'roaster' | 'notes';

interface InlineTextAreaProps {
  field?: TextEditableField;
  label?: string;
  value: string;
  placeholder: string;
  rows?: number;
  multiline?: boolean;
  textAreaClassName?: string;
  onUpdateField?: (field: TextEditableField, value: string) => void;
  onValueChange?: (value: string) => void;
}

const InlineTextArea: React.FC<InlineTextAreaProps> = ({
  field,
  label,
  value,
  placeholder,
  rows = 1,
  multiline = false,
  textAreaClassName = 'min-h-[20px]',
  onUpdateField,
  onValueChange,
}) => {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const nextValue = event.target.value;

      if (field && onUpdateField) {
        onUpdateField(field, nextValue);
      } else {
        onValueChange?.(nextValue);
      }
    },
    [field, onUpdateField, onValueChange]
  );

  const handleInput = useCallback(
    (event: React.FormEvent<HTMLTextAreaElement>) => {
      autoResizeTextarea(event.currentTarget);
    },
    []
  );

  return (
    <label
      className={`${INPUT_SHELL_CLASS} ${multiline ? 'items-start py-1.5' : 'items-center'}`}
    >
      {label && (
        <span className={`${INPUT_LABEL_CLASS} ${multiline ? 'pt-1' : ''}`}>
          {label}
        </span>
      )}
      <textarea
        data-autosize="true"
        value={value}
        onChange={handleChange}
        onInput={handleInput}
        className={`${INPUT_TEXTAREA_CLASS} ${textAreaClassName}`}
        placeholder={placeholder}
        rows={rows}
      />
    </label>
  );
};

interface FlavorFieldEditorProps {
  flavors: string[];
  onUpdateFlavor: (flavors: string[]) => void;
}

const FlavorFieldEditor: React.FC<FlavorFieldEditorProps> = ({
  flavors,
  onUpdateFlavor,
}) => {
  const value = flavors.join(' / ');

  const handleChange = useCallback(
    (nextValue: string) => {
      onUpdateFlavor(nextValue.trim() ? [nextValue] : []);
    },
    [onUpdateFlavor]
  );

  return (
    <InlineTextArea
      value={value}
      placeholder="风味描述"
      onValueChange={handleChange}
    />
  );
};

type FieldOption = 'nameSeparator' | 'contentBottomAligned' | 'packDate';

interface FieldOptionSwitchProps {
  label: string;
  field: FieldOption;
  checked: boolean;
  onToggleField: (field: keyof PrintConfig['fields']) => void;
}

const FieldOptionSwitch: React.FC<FieldOptionSwitchProps> = ({
  label,
  field,
  checked,
  onToggleField,
}) => {
  const handleChange = useCallback(() => {
    onToggleField(field);
  }, [field, onToggleField]);

  return (
    <label className="flex h-8 w-full cursor-pointer items-center justify-between gap-3 rounded bg-neutral-200/50 px-2 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        className="peer sr-only"
      />
      <span className="relative h-4 w-7 shrink-0 rounded-full bg-neutral-300 transition-colors peer-checked:bg-neutral-600 after:absolute after:top-0.5 after:left-0.5 after:h-3 after:w-3 after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:after:translate-x-3 dark:bg-neutral-600 dark:peer-checked:bg-neutral-400" />
    </label>
  );
};

interface FieldEditorPanelProps {
  config: PrintConfig;
  content: EditableContent;
  activeField: PrintFieldKey;
  activeStatusLabel: string;
  activeStatusButtonClass: string;
  iconInputRef: React.RefObject<HTMLInputElement | null>;
  roasterIcon: string | null;
  resolvedIcon: string;
  isIconProcessing: boolean;
  onToggleField: (field: keyof PrintConfig['fields']) => void;
  onUpdateField: <K extends keyof EditableContent>(
    field: K,
    value: EditableContent[K]
  ) => void;
  onIconFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onIconUploadClick: () => void;
  onIconSourceChange: (source: PrintIconSource) => void;
  onRemoveIcon: () => void;
  onZoomIconIn: () => void;
  onZoomIconOut: () => void;
  onResetIconPlacement: () => void;
}

export const FieldEditorPanel: React.FC<FieldEditorPanelProps> = ({
  config,
  content,
  activeField,
  activeStatusLabel,
  activeStatusButtonClass,
  iconInputRef,
  roasterIcon,
  resolvedIcon,
  isIconProcessing,
  onToggleField,
  onUpdateField,
  onIconFileChange,
  onIconUploadClick,
  onIconSourceChange,
  onRemoveIcon,
  onZoomIconIn,
  onZoomIconOut,
  onResetIconPlacement,
}) => {
  const editorPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editorPanelRef.current) {
      return;
    }
    const textareas = editorPanelRef.current.querySelectorAll(
      'textarea[data-autosize="true"]'
    );
    textareas.forEach(textarea =>
      autoResizeTextarea(textarea as HTMLTextAreaElement)
    );
  }, [content, activeField]);

  const updateTextField = useCallback(
    (field: TextEditableField, value: string) => {
      onUpdateField(field, value);
    },
    [onUpdateField]
  );

  const handleDateChange = useCallback(
    (date: Date) => {
      onUpdateField('roastDate', getLocalDateString(date));
    },
    [onUpdateField]
  );

  const handlePackDateChange = useCallback(
    (date: Date) => {
      onUpdateField('packDate', getLocalDateString(date));
    },
    [onUpdateField]
  );

  const handleToggleActiveField = useCallback(() => {
    onToggleField(activeField);
  }, [activeField, onToggleField]);

  const handleTogglePackDate = useCallback(
    (field: keyof PrintConfig['fields']) => {
      if (!config.fields.packDate) {
        onUpdateField('packDate', getLocalDateString());
      }
      onToggleField(field);
    },
    [config.fields.packDate, onToggleField, onUpdateField]
  );

  const handleUpdateFlavor = useCallback(
    (flavors: string[]) => {
      onUpdateField('flavor', flavors);
    },
    [onUpdateField]
  );

  const renderFieldEditor = () => {
    switch (activeField) {
      case 'name':
        return (
          <div className="space-y-2">
            <InlineTextArea
              field="roaster"
              label="烘焙商"
              value={content.roaster}
              placeholder="默认使用咖啡豆中的烘焙商，可手动修改"
              onUpdateField={updateTextField}
            />
            <InlineTextArea
              field="name"
              value={content.name}
              placeholder={PRINT_TEXT_FIELD_PLACEHOLDERS.name}
              onUpdateField={updateTextField}
            />
            {config.template === 'detailed' && (
              <div className="space-y-1.5">
                <FieldOptionSwitch
                  label="显示分隔线"
                  field="nameSeparator"
                  checked={config.fields.nameSeparator}
                  onToggleField={onToggleField}
                />
                <FieldOptionSwitch
                  label="内容贴底"
                  field="contentBottomAligned"
                  checked={config.fields.contentBottomAligned}
                  onToggleField={onToggleField}
                />
              </div>
            )}
          </div>
        );
      case 'roastDate':
        return (
          <div className="space-y-2">
            <div className={`${INPUT_SHELL_CLASS} items-center`}>
              <DatePicker
                date={parseLocalDateString(content.roastDate)}
                onDateChange={handleDateChange}
                placeholder="选择日期"
                locale="zh-CN"
                className="min-w-0 flex-1"
                triggerClassName={DATE_PICKER_TRIGGER_CLASS}
                displayFormat="yyyy-MM-dd"
              />
            </div>
            <FieldOptionSwitch
              label="分装日期"
              field="packDate"
              checked={config.fields.packDate}
              onToggleField={handleTogglePackDate}
            />
            {config.fields.packDate && (
              <div className={`${INPUT_SHELL_CLASS} items-center`}>
                <DatePicker
                  date={parseLocalDateString(content.packDate)}
                  onDateChange={handlePackDateChange}
                  placeholder="选择分装日期"
                  locale="zh-CN"
                  className="min-w-0 flex-1"
                  triggerClassName={DATE_PICKER_TRIGGER_CLASS}
                  displayFormat="yyyy-MM-dd"
                />
              </div>
            )}
          </div>
        );
      case 'origin':
        return (
          <InlineTextArea
            field="origin"
            value={content.origin}
            placeholder={PRINT_TEXT_FIELD_PLACEHOLDERS.origin}
            onUpdateField={updateTextField}
          />
        );
      case 'estate':
        return (
          <InlineTextArea
            field="estate"
            value={content.estate}
            placeholder={PRINT_TEXT_FIELD_PLACEHOLDERS.estate}
            onUpdateField={updateTextField}
          />
        );
      case 'process':
        return (
          <InlineTextArea
            field="process"
            value={content.process}
            placeholder={PRINT_TEXT_FIELD_PLACEHOLDERS.process}
            onUpdateField={updateTextField}
          />
        );
      case 'variety':
        return (
          <InlineTextArea
            field="variety"
            value={content.variety}
            placeholder={PRINT_TEXT_FIELD_PLACEHOLDERS.variety}
            onUpdateField={updateTextField}
          />
        );
      case 'roastLevel':
        return (
          <InlineTextArea
            field="roastLevel"
            value={content.roastLevel}
            placeholder={PRINT_TEXT_FIELD_PLACEHOLDERS.roastLevel}
            onUpdateField={updateTextField}
          />
        );
      case 'flavor':
        return (
          <FlavorFieldEditor
            flavors={content.flavor}
            onUpdateFlavor={handleUpdateFlavor}
          />
        );
      case 'weight':
        return (
          <InlineTextArea
            field="weight"
            value={content.weight}
            placeholder={PRINT_TEXT_FIELD_PLACEHOLDERS.weight}
            onUpdateField={updateTextField}
          />
        );
      case 'notes':
        return (
          <InlineTextArea
            field="notes"
            value={content.notes}
            placeholder="备注信息"
            rows={3}
            multiline
            textAreaClassName="min-h-[56px] py-1"
            onUpdateField={updateTextField}
          />
        );
      case 'icon':
        return (
          <IconFieldEditor
            customIcon={content.icon}
            roasterIcon={roasterIcon}
            selectedSource={content.iconSource}
            resolvedIcon={resolvedIcon}
            inputRef={iconInputRef}
            isProcessing={isIconProcessing}
            onFileChange={onIconFileChange}
            onUploadClick={onIconUploadClick}
            onSourceChange={onIconSourceChange}
            onRemove={onRemoveIcon}
            onZoomIn={onZoomIconIn}
            onZoomOut={onZoomIconOut}
            onResetPlacement={onResetIconPlacement}
          />
        );
      default:
        return null;
    }
  };

  return (
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
          onClick={handleToggleActiveField}
          className={`shrink-0 rounded px-2 py-1 text-xs leading-none font-medium whitespace-nowrap transition-colors ${activeStatusButtonClass}`}
        >
          {activeStatusLabel}
        </button>
      </div>

      {renderFieldEditor()}
    </div>
  );
};
