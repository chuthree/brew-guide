'use client';

import React from 'react';
import { RotateCcw } from 'lucide-react';
import { PrintConfig, TEMPLATE_OPTIONS } from './types';

interface LayoutSettingsProps {
  config: PrintConfig;
  onToggleOrientation: () => void;
  onUpdateTemplate: (template: PrintConfig['template']) => void;
  onUpdateMargin: (margin: number) => void;
  onUpdateFontSize: (fontSize: number) => void;
  onUpdateFontWeight: (fontWeight: number) => void;
  onReset: () => void;
}

export const LayoutSettings: React.FC<LayoutSettingsProps> = ({
  config,
  onToggleOrientation,
  onUpdateTemplate,
  onUpdateMargin,
  onUpdateFontSize,
  onUpdateFontWeight,
  onReset,
}) => {
  const cycleTemplate = () => {
    const idx = TEMPLATE_OPTIONS.findIndex(t => t.id === config.template);
    const next = TEMPLATE_OPTIONS[(idx + 1) % TEMPLATE_OPTIONS.length];
    onUpdateTemplate(next.id);
  };

  const currentTemplateName =
    TEMPLATE_OPTIONS.find(t => t.id === config.template)?.name ||
    config.template;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
          布局设置
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
        >
          <RotateCcw className="h-3 w-3" /> 重置
        </button>
      </div>

      {/* 方向和模板 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onToggleOrientation}
          className="rounded bg-neutral-100 px-3 py-2 text-xs font-medium hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
        >
          {config.orientation === 'landscape' ? '横向 ↔' : '纵向 ↕'}
        </button>
        <button
          onClick={cycleTemplate}
          className="rounded bg-neutral-100 px-3 py-2 text-xs font-medium hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
        >
          {currentTemplateName}
        </button>
      </div>

      {/* 滑块 */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="mb-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            边距 {config.margin}
          </div>
          <input
            type="range"
            min="1"
            max="8"
            value={config.margin}
            onChange={e => onUpdateMargin(parseInt(e.target.value))}
            className="slider h-2 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 dark:bg-neutral-700"
          />
        </div>
        <div>
          <div className="mb-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            字号 {config.fontSize}
          </div>
          <input
            type="range"
            min="6"
            max="24"
            value={config.fontSize}
            onChange={e => onUpdateFontSize(parseInt(e.target.value))}
            className="slider h-2 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 dark:bg-neutral-700"
          />
        </div>
        <div>
          <div className="mb-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            字重 {config.fontWeight}
          </div>
          <input
            type="range"
            min="300"
            max="900"
            step="100"
            value={config.fontWeight}
            onChange={e => onUpdateFontWeight(parseInt(e.target.value))}
            className="slider h-2 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 dark:bg-neutral-700"
          />
        </div>
      </div>
    </div>
  );
};
