'use client';

import React, { useState } from 'react';
import { X, Edit, Check, Plus, RotateCcw } from 'lucide-react';
import { PrintConfig, PresetSize } from './types';

interface SizeSettingsProps {
  config: PrintConfig;
  presetSizes: PresetSize[];
  onSelectSize: (width: number, height: number) => void;
  onAddSize: (width: number, height: number) => void;
  onRemoveSize: (index: number) => void;
  onResetSizes: () => void;
}

export const SizeSettings: React.FC<SizeSettingsProps> = ({
  config,
  presetSizes,
  onSelectSize,
  onAddSize,
  onRemoveSize,
  onResetSizes,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [newWidth, setNewWidth] = useState('');
  const [newHeight, setNewHeight] = useState('');

  const handleAdd = () => {
    const w = parseInt(newWidth);
    const h = parseInt(newHeight);
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      onAddSize(w, h);
      setNewWidth('');
      setNewHeight('');
    }
  };

  const toggleEdit = () => {
    setEditMode(!editMode);
    if (editMode) {
      setNewWidth('');
      setNewHeight('');
    }
  };

  const inputClass =
    'w-16 rounded border border-neutral-200/50 bg-white px-2 py-1.5 text-xs focus:ring-2 focus:ring-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
          尺寸设置
        </div>
        <button
          onClick={toggleEdit}
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

      {/* 预设尺寸 */}
      <div className="flex flex-wrap gap-2">
        {presetSizes.map((size, index) => (
          <div key={size.label} className="relative">
            <button
              onClick={() => !editMode && onSelectSize(size.width, size.height)}
              disabled={editMode}
              className={`rounded px-3 py-2 text-xs font-medium transition-all ${
                config.width === size.width &&
                config.height === size.height &&
                !editMode
                  ? 'bg-neutral-800 text-white dark:bg-neutral-700'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
              } ${editMode ? 'pr-7' : ''}`}
            >
              {size.label}
            </button>
            {editMode && (
              <button
                onClick={() => onRemoveSize(index)}
                className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 编辑模式 */}
      {editMode && (
        <div className="space-y-2 rounded bg-neutral-100 p-3 dark:bg-neutral-800/50">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={newWidth}
              onChange={e => setNewWidth(e.target.value)}
              className={inputClass}
              placeholder="宽"
            />
            <span className="text-xs text-neutral-400">×</span>
            <input
              type="number"
              value={newHeight}
              onChange={e => setNewHeight(e.target.value)}
              className={inputClass}
              placeholder="高"
            />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              mm
            </span>
            <button
              onClick={handleAdd}
              disabled={!newWidth || !newHeight}
              className="flex h-7 items-center gap-1 rounded bg-neutral-800 px-2 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-700 dark:hover:bg-neutral-600"
            >
              <Plus className="h-3 w-3" /> 添加
            </button>
          </div>
          <button
            onClick={onResetSizes}
            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
          >
            <RotateCcw className="h-3 w-3" /> 重置为默认
          </button>
        </div>
      )}
    </div>
  );
};
