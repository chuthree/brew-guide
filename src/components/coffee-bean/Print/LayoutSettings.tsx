'use client';

import React from 'react';
import { RotateCcw } from 'lucide-react';
import ElasticSlider from '@/components/common/ui/ElasticSlider';
import { PrintConfig, TEMPLATE_OPTIONS } from './types';

interface LayoutSettingsProps {
  config: PrintConfig;
  onToggleOrientation: () => void;
  onUpdateTemplate: (template: PrintConfig['template']) => void;
  onUpdateMargin: (margin: number) => void;
  onCommitMargin: (margin: number) => void;
  onUpdateFontSize: (fontSize: number) => void;
  onCommitFontSize: (fontSize: number) => void;
  onUpdateFontWeight: (fontWeight: number) => void;
  onCommitFontWeight: (fontWeight: number) => void;
  onReset: () => void;
}

const formatIntegerSliderValue = (value: number) => value.toString();
const PRINT_SETTINGS_SLIDER_HEIGHT = 32;
const PRINT_SETTINGS_SLIDER_RADIUS = 4;
const PRINT_SETTINGS_SLIDER_TEXT_CLASS_NAME = 'text-xs';
const PRINT_SETTINGS_SLIDER_TRACK_CLASS_NAME =
  'bg-neutral-100 dark:bg-neutral-800';
const PRINT_SETTINGS_SLIDER_FILL_CLASS_NAME =
  'bg-neutral-200/45 group-data-[active=true]/elastic-slider:bg-neutral-200/60 dark:bg-neutral-700/25 dark:group-data-[active=true]/elastic-slider:bg-neutral-700/35';
const PRINT_SETTINGS_SLIDER_HANDLE_CLASS_NAME =
  'bg-neutral-400/80 dark:bg-neutral-500/80';
const PRINT_SETTINGS_SLIDER_HASH_MARK_CLASS_NAME =
  'group-data-[active=true]/elastic-slider:bg-neutral-400/15 dark:group-data-[active=true]/elastic-slider:bg-neutral-500/25';

export const LayoutSettings: React.FC<LayoutSettingsProps> = ({
  config,
  onToggleOrientation,
  onUpdateTemplate,
  onUpdateMargin,
  onCommitMargin,
  onUpdateFontSize,
  onCommitFontSize,
  onUpdateFontWeight,
  onCommitFontWeight,
  onReset,
}) => {
  const cycleTemplate = React.useCallback(() => {
    const idx = TEMPLATE_OPTIONS.findIndex(t => t.id === config.template);
    const next = TEMPLATE_OPTIONS[(idx + 1) % TEMPLATE_OPTIONS.length];
    onUpdateTemplate(next.id);
  }, [config.template, onUpdateTemplate]);

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
          type="button"
          onClick={onReset}
          className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
        >
          <RotateCcw className="h-3 w-3" /> 重置布局
        </button>
      </div>

      {/* 方向和模板 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onToggleOrientation}
          className="rounded bg-neutral-100 px-3 py-2 text-xs font-medium hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
        >
          {config.orientation === 'landscape' ? '横向 ↔' : '纵向 ↕'}
        </button>
        <button
          type="button"
          onClick={cycleTemplate}
          className="rounded bg-neutral-100 px-3 py-2 text-xs font-medium hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
        >
          {currentTemplateName}
        </button>
      </div>

      {/* 滑块 */}
      <div className="grid grid-cols-3 gap-2">
        <div data-vaul-no-drag>
          <ElasticSlider
            label="边距"
            min={1}
            max={8}
            step={1}
            height={PRINT_SETTINGS_SLIDER_HEIGHT}
            radius={PRINT_SETTINGS_SLIDER_RADIUS}
            value={config.margin}
            onValueChange={onUpdateMargin}
            onValueCommit={onCommitMargin}
            formatValue={formatIntegerSliderValue}
            trackClassName={PRINT_SETTINGS_SLIDER_TRACK_CLASS_NAME}
            fillClassName={PRINT_SETTINGS_SLIDER_FILL_CLASS_NAME}
            handleClassName={PRINT_SETTINGS_SLIDER_HANDLE_CLASS_NAME}
            hashMarkClassName={PRINT_SETTINGS_SLIDER_HASH_MARK_CLASS_NAME}
            textClassName={PRINT_SETTINGS_SLIDER_TEXT_CLASS_NAME}
            aria-label="打印边距"
          />
        </div>
        <div data-vaul-no-drag>
          <ElasticSlider
            label="字号"
            min={6}
            max={24}
            step={1}
            height={PRINT_SETTINGS_SLIDER_HEIGHT}
            radius={PRINT_SETTINGS_SLIDER_RADIUS}
            value={config.fontSize}
            onValueChange={onUpdateFontSize}
            onValueCommit={onCommitFontSize}
            formatValue={formatIntegerSliderValue}
            trackClassName={PRINT_SETTINGS_SLIDER_TRACK_CLASS_NAME}
            fillClassName={PRINT_SETTINGS_SLIDER_FILL_CLASS_NAME}
            handleClassName={PRINT_SETTINGS_SLIDER_HANDLE_CLASS_NAME}
            hashMarkClassName={PRINT_SETTINGS_SLIDER_HASH_MARK_CLASS_NAME}
            textClassName={PRINT_SETTINGS_SLIDER_TEXT_CLASS_NAME}
            aria-label="打印字号"
          />
        </div>
        <div data-vaul-no-drag>
          <ElasticSlider
            label="字重"
            min={300}
            max={900}
            step={100}
            height={PRINT_SETTINGS_SLIDER_HEIGHT}
            radius={PRINT_SETTINGS_SLIDER_RADIUS}
            value={config.fontWeight}
            onValueChange={onUpdateFontWeight}
            onValueCommit={onCommitFontWeight}
            formatValue={formatIntegerSliderValue}
            trackClassName={PRINT_SETTINGS_SLIDER_TRACK_CLASS_NAME}
            fillClassName={PRINT_SETTINGS_SLIDER_FILL_CLASS_NAME}
            handleClassName={PRINT_SETTINGS_SLIDER_HANDLE_CLASS_NAME}
            hashMarkClassName={PRINT_SETTINGS_SLIDER_HASH_MARK_CLASS_NAME}
            textClassName={PRINT_SETTINGS_SLIDER_TEXT_CLASS_NAME}
            aria-label="打印字重"
          />
        </div>
      </div>
    </div>
  );
};
