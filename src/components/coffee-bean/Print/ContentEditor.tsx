'use client';

import React, { useState } from 'react';
import { Edit, Check, Plus, Minus } from 'lucide-react';
import {
  PrintConfig,
  EditableContent,
  FIELD_LABELS,
  FIELD_ORDER,
} from './types';
import { DatePicker } from '@/components/common/ui/DatePicker';

const INPUT_CLASS =
  'w-full rounded border border-neutral-200/50 bg-white px-2 py-1.5 text-xs focus:ring-2 focus:ring-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800';
const LABEL_CLASS = 'mb-1 block text-xs text-neutral-500 dark:text-neutral-400';

interface ContentEditorProps {
  config: PrintConfig;
  content: EditableContent;
  extractedBrandName: string;
  onToggleField: (field: keyof PrintConfig['fields']) => void;
  onUpdateField: <K extends keyof EditableContent>(
    field: K,
    value: EditableContent[K]
  ) => void;
  onUpdateFlavorItem: (index: number, value: string) => void;
  onAddFlavor: () => void;
  onRemoveFlavor: (index: number) => void;
  onResetContent: () => void;
  onUpdateBrandName: (brandName: string) => void;
}

export const ContentEditor: React.FC<ContentEditorProps> = ({
  config,
  content,
  extractedBrandName,
  onToggleField,
  onUpdateField,
  onUpdateFlavorItem,
  onAddFlavor,
  onRemoveFlavor,
  onResetContent,
  onUpdateBrandName,
}) => {
  const [editMode, setEditMode] = useState(false);
  const isMinimal = config.template === 'minimal';

  const TextInput: React.FC<{
    label: string;
    field: keyof EditableContent;
    placeholder: string;
  }> = ({ label, field, placeholder }) => (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      <input
        type="text"
        value={content[field] as string}
        onChange={e => onUpdateField(field, e.target.value as never)}
        className={INPUT_CLASS}
        placeholder={placeholder}
      />
    </div>
  );

  const FlavorEditor = () => (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className={LABEL_CLASS}>风味</label>
        <button
          onClick={onAddFlavor}
          className="flex h-5 w-5 items-center justify-center rounded bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
      <div className="space-y-2">
        {content.flavor.map((flavor, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={flavor}
              onChange={e => onUpdateFlavorItem(index, e.target.value)}
              className={INPUT_CLASS}
              placeholder="风味描述"
            />
            <button
              onClick={() => onRemoveFlavor(index)}
              className="flex h-5 w-5 items-center justify-center rounded bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50"
            >
              <Minus className="h-3 w-3 text-red-600 dark:text-red-400" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const DateInput = () => (
    <div>
      <label className={LABEL_CLASS}>烘焙日期</label>
      <div className="text-xs">
        <DatePicker
          date={content.roastDate ? new Date(content.roastDate) : undefined}
          onDateChange={date => {
            onUpdateField('roastDate', date.toISOString().split('T')[0]);
          }}
          placeholder="选择烘焙日期"
          locale="zh-CN"
          className=""
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
          {isMinimal ? '编辑内容' : '显示内容'}
        </div>
        <button
          onClick={() => setEditMode(!editMode)}
          className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-all ${
            editMode
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700'
          }`}
        >
          {editMode ? (
            <>
              <Check className="h-3 w-3" /> 完成
            </>
          ) : (
            <>
              <Edit className="h-3 w-3" /> 编辑
            </>
          )}
        </button>
      </div>

      {/* 字段选择器 - 仅详细模板 */}
      {!isMinimal && (
        <div className="grid grid-cols-4 gap-1.5">
          {FIELD_ORDER.map(field => (
            <button
              key={field}
              onClick={() => onToggleField(field)}
              className={`rounded px-2.5 py-2 text-center text-xs font-medium transition-all ${
                config.fields[field]
                  ? 'bg-neutral-800 text-white dark:bg-neutral-700'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700'
              }`}
            >
              {FIELD_LABELS[field]}
            </button>
          ))}
        </div>
      )}

      {/* 编辑区域 */}
      {editMode && (
        <div className="mt-4 space-y-3 rounded bg-neutral-50 p-3 dark:bg-neutral-800/50">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
              编辑内容
            </div>
            <button
              onClick={onResetContent}
              className="px-2 py-1 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
            >
              重置
            </button>
          </div>

          {isMinimal ? (
            <>
              <div>
                <label className={LABEL_CLASS}>
                  品牌名称（可选，留空则自动从名称中提取）
                </label>
                <input
                  type="text"
                  value={config.brandName}
                  onChange={e => onUpdateBrandName(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder={`自动提取: ${extractedBrandName || '名称空格前的部分'}`}
                />
              </div>
              <TextInput
                label="名称"
                field="name"
                placeholder="例如：辛鹿 野草莓"
              />
              <DateInput />
              <TextInput
                label="产地（可选）"
                field="origin"
                placeholder="产地信息"
              />
              <TextInput
                label="处理法（可选）"
                field="process"
                placeholder="例如：水洗、日晒"
              />
              <TextInput
                label="品种（可选）"
                field="variety"
                placeholder="例如：卡杜拉、瑰夏"
              />
              <TextInput
                label="烘焙度（可选）"
                field="roastLevel"
                placeholder="烘焙度"
              />
              <FlavorEditor />
              <div className="my-2 border-t border-neutral-200/50 dark:border-neutral-700" />
              <TextInput label="克数" field="weight" placeholder="例如：250" />
              <div>
                <label className={LABEL_CLASS}>备注（可选）</label>
                <textarea
                  value={content.notes}
                  onChange={e => onUpdateField('notes', e.target.value)}
                  className={INPUT_CLASS + ' resize-none'}
                  placeholder="其他备注信息"
                  rows={2}
                />
              </div>
            </>
          ) : (
            <>
              {config.fields.name && (
                <TextInput label="名称" field="name" placeholder="咖啡豆名称" />
              )}
              {config.fields.roastDate && <DateInput />}
              {config.fields.origin && (
                <TextInput label="产地" field="origin" placeholder="产地信息" />
              )}
              {config.fields.process && (
                <TextInput
                  label="处理法"
                  field="process"
                  placeholder="处理法"
                />
              )}
              {config.fields.variety && (
                <TextInput
                  label="品种"
                  field="variety"
                  placeholder="咖啡品种"
                />
              )}
              {config.fields.roastLevel && (
                <TextInput
                  label="烘焙度"
                  field="roastLevel"
                  placeholder="烘焙度"
                />
              )}
              {config.fields.flavor && <FlavorEditor />}
              {config.fields.notes && (
                <div>
                  <label className={LABEL_CLASS}>备注</label>
                  <textarea
                    value={content.notes}
                    onChange={e => onUpdateField('notes', e.target.value)}
                    className={INPUT_CLASS + ' resize-none'}
                    placeholder="备注信息"
                    rows={2}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
