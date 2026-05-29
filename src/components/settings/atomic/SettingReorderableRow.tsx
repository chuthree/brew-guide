import React from 'react';
import { ChevronRight, GripVertical } from 'lucide-react';
import { Reorder, useDragControls } from 'framer-motion';

interface SettingReorderableRowProps<T> {
  value: T;
  label: string;
  isLast: boolean;
  isReorderMode: boolean;
  onOpen: (value: T) => void;
  onDragEnd: () => void;
}

function SettingReorderableRow<T>({
  value,
  label,
  isLast,
  isReorderMode,
  onOpen,
  onDragEnd,
}: SettingReorderableRowProps<T>) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={value}
      dragControls={dragControls}
      dragListener={false}
      onDragEnd={onDragEnd}
      whileDrag={{
        scale: 1.01,
        transition: { duration: 0.1 },
      }}
      className="px-3.5"
      style={{ listStyle: 'none' }}
    >
      <div
        className={`flex items-center py-1 ${
          isLast ? '' : 'border-b border-black/5 dark:border-white/5'
        }`}
      >
        <button
          type="button"
          onClick={() => onOpen(value)}
          disabled={isReorderMode}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left transition-opacity active:opacity-70 disabled:cursor-default disabled:active:opacity-100"
        >
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {label}
          </span>

          <span
            className={`relative -mr-2 flex h-10 shrink-0 items-center justify-center transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
              isReorderMode ? 'w-10' : 'w-8'
            }`}
          >
            <span
              className={`absolute inset-0 flex items-center justify-center text-neutral-400 transition-[opacity,transform,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)] dark:text-neutral-500 ${
                isReorderMode
                  ? 'scale-[0.25] opacity-0 blur-[4px]'
                  : 'blur-0 scale-100 opacity-100'
              }`}
            >
              <ChevronRight className="h-4 w-4" />
            </span>
          </span>
        </button>

        <button
          type="button"
          aria-label={`拖动调整 ${label} 排序`}
          title="拖动排序"
          tabIndex={isReorderMode ? 0 : -1}
          aria-hidden={!isReorderMode}
          onPointerDown={event => dragControls.start(event)}
          className={`-mr-2 -ml-8 flex h-10 w-10 cursor-grab items-center justify-center rounded-lg text-neutral-400 transition-[opacity,transform,filter,background-color] duration-300 ease-[cubic-bezier(0.2,0,0,1)] active:cursor-grabbing active:bg-black/5 dark:text-neutral-500 dark:active:bg-white/5 ${
            isReorderMode
              ? 'blur-0 pointer-events-auto scale-100 opacity-100'
              : 'pointer-events-none scale-[0.25] opacity-0 blur-[4px]'
          }`}
        >
          <GripVertical className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>
    </Reorder.Item>
  );
}

export default SettingReorderableRow;
