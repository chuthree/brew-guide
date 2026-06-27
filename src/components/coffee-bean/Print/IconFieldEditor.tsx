'use client';

import React, { useCallback } from 'react';
import { ImageIcon, Minus, Plus, RotateCcw, Upload, X } from 'lucide-react';
import { IMAGE_FILE_ACCEPT } from '@/lib/images/imageFormat';
import { PrintIconSource } from './types';

const SOFT_BUTTON_CLASS =
  'rounded bg-neutral-200/50 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700';

const getSourceButtonClass = (selected: boolean, empty: boolean): string =>
  `flex h-8 min-w-0 items-center gap-1.5 rounded px-1.5 text-left text-xs font-medium transition-colors disabled:opacity-50 ${
    selected
      ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100'
      : empty
        ? 'bg-neutral-200/35 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700'
        : 'bg-neutral-200/50 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
  }`;

interface IconSwatchProps {
  icon: string | null;
  label: string;
}

const IconSwatch: React.FC<IconSwatchProps> = ({ icon, label }) => (
  <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900">
    {icon ? (
      <span
        aria-hidden="true"
        className="block h-full w-full bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${icon}")` }}
      />
    ) : (
      <ImageIcon className="h-4 w-4" aria-label={label} />
    )}
  </span>
);

interface PlacementControlsProps {
  visible: boolean;
  isProcessing: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onResetPlacement: () => void;
}

const PlacementControls: React.FC<PlacementControlsProps> = ({
  visible,
  isProcessing,
  onZoomOut,
  onZoomIn,
  onResetPlacement,
}) => {
  if (!visible) return null;

  return (
    <div className="ml-auto flex shrink-0 gap-1">
      <button
        type="button"
        onClick={onZoomOut}
        disabled={isProcessing}
        aria-label="缩小图标"
        title="缩小图标"
        className={`flex h-8 w-8 items-center justify-center disabled:opacity-50 ${SOFT_BUTTON_CLASS}`}
      >
        <Minus className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        disabled={isProcessing}
        aria-label="放大图标"
        title="放大图标"
        className={`flex h-8 w-8 items-center justify-center disabled:opacity-50 ${SOFT_BUTTON_CLASS}`}
      >
        <Plus className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onResetPlacement}
        disabled={isProcessing}
        aria-label="复位图标位置"
        title="复位图标位置"
        className={`flex h-8 w-8 items-center justify-center disabled:opacity-50 ${SOFT_BUTTON_CLASS}`}
      >
        <RotateCcw className="h-3 w-3" />
      </button>
    </div>
  );
};

interface IconFieldEditorProps {
  customIcon: string;
  roasterIcon: string | null;
  selectedSource: PrintIconSource;
  resolvedIcon: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isProcessing: boolean;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadClick: () => void;
  onSourceChange: (source: PrintIconSource) => void;
  onRemove: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetPlacement: () => void;
}

export const IconFieldEditor: React.FC<IconFieldEditorProps> = ({
  customIcon,
  roasterIcon,
  selectedSource,
  resolvedIcon,
  inputRef,
  isProcessing,
  onFileChange,
  onUploadClick,
  onSourceChange,
  onRemove,
  onZoomIn,
  onZoomOut,
  onResetPlacement,
}) => {
  const hasCustomIcon = customIcon.trim().length > 0;
  const hasRoasterIcon = Boolean(roasterIcon);
  const effectiveSource =
    selectedSource === 'roaster' && hasRoasterIcon ? 'roaster' : 'custom';
  const handleSourceClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const source = event.currentTarget.dataset.source as
        | PrintIconSource
        | undefined;

      if (!source) return;

      if (source === 'custom' && !hasCustomIcon) {
        onUploadClick();
        return;
      }

      onSourceChange(source);
    },
    [hasCustomIcon, onSourceChange, onUploadClick]
  );

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_FILE_ACCEPT}
        className="hidden"
        aria-label="选择图标图片"
        onChange={onFileChange}
      />

      {hasRoasterIcon && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-source="roaster"
            onClick={handleSourceClick}
            disabled={isProcessing}
            aria-pressed={selectedSource === 'roaster'}
            className={getSourceButtonClass(
              selectedSource === 'roaster',
              false
            )}
          >
            <IconSwatch icon={roasterIcon} label="烘焙商图标" />
            <span className="min-w-0 truncate">烘焙商</span>
          </button>
          <button
            type="button"
            data-source="custom"
            onClick={handleSourceClick}
            disabled={isProcessing}
            aria-pressed={selectedSource === 'custom'}
            className={getSourceButtonClass(
              selectedSource === 'custom',
              !hasCustomIcon
            )}
          >
            <IconSwatch icon={customIcon || null} label="自定义图标" />
            <span className="min-w-0 truncate">自定义</span>
          </button>
        </div>
      )}

      <div className="flex w-full flex-wrap items-center gap-2">
        {effectiveSource === 'custom' && (
          <div className="flex min-w-0 gap-2">
            <button
              type="button"
              onClick={onUploadClick}
              disabled={isProcessing}
              className={`flex h-8 items-center gap-1.5 px-2 text-xs font-medium disabled:opacity-50 ${SOFT_BUTTON_CLASS}`}
            >
              <Upload className="h-3 w-3" />
              {isProcessing ? '处理中' : hasCustomIcon ? '更换' : '添加'}
            </button>
            {hasCustomIcon && (
              <button
                type="button"
                onClick={onRemove}
                disabled={isProcessing}
                className={`flex h-8 items-center gap-1.5 px-2 text-xs font-medium disabled:opacity-50 ${SOFT_BUTTON_CLASS}`}
              >
                <X className="h-3 w-3" />
                移除
              </button>
            )}
          </div>
        )}
        <PlacementControls
          visible={Boolean(resolvedIcon)}
          isProcessing={isProcessing}
          onZoomOut={onZoomOut}
          onZoomIn={onZoomIn}
          onResetPlacement={onResetPlacement}
        />
      </div>
    </div>
  );
};
