'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar } from '@/components/common/ui/Calendar';

interface NoteFormHeaderProps {
  onSave?: () => void; // 保存按钮的回调
  showSaveButton?: boolean; // 是否显示保存按钮
  timestamp?: Date; // 可选时间戳，默认为当前时间
  onTimestampChange?: (timestamp: Date) => void; // 时间戳修改回调
}

const NoteFormHeader: React.FC<NoteFormHeaderProps> = ({
  onSave: _onSave,
  showSaveButton: _showSaveButton = true,
  timestamp = new Date(),
  onTimestampChange,
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // 处理日期变化
  const handleDateChange = (newDate: Date) => {
    // 保持原有的时分秒，只修改年月日
    const updatedTimestamp = new Date(timestamp);
    updatedTimestamp.setFullYear(newDate.getFullYear());
    updatedTimestamp.setMonth(newDate.getMonth());
    updatedTimestamp.setDate(newDate.getDate());

    onTimestampChange?.(updatedTimestamp);
    setShowDatePicker(false);
  };

  // 点击外部关闭日期选择器
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // 检查是否点击在日期选择器容器内
      if (datePickerRef.current && datePickerRef.current.contains(target)) {
        return;
      }

      // 检查是否点击在 Radix Popover 内容中（年份/月份选择器通过 Portal 渲染）
      const popoverContent = (target as Element).closest?.(
        '[data-radix-popper-content-wrapper]'
      );
      if (popoverContent) {
        return;
      }

      setShowDatePicker(false);
    };

    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDatePicker]);

  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex items-baseline">
        <span className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
          新建记录 ·
        </span>

        {/* 可点击的日期部分 */}
        <div className="relative ml-1" ref={datePickerRef}>
          <button
            type="button"
            onClick={() =>
              onTimestampChange && setShowDatePicker(!showDatePicker)
            }
            className={`text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400 ${
              onTimestampChange
                ? 'cursor-pointer border-b border-dashed border-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-700 dark:border-neutral-500 dark:hover:border-neutral-400 dark:hover:text-neutral-300'
                : 'cursor-default'
            }`}
            disabled={!onTimestampChange}
          >
            {`${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}-${String(timestamp.getDate()).padStart(2, '0')}`}
          </button>

          {/* 日期选择器 */}
          {showDatePicker && onTimestampChange && (
            <div
              className="absolute top-full left-0 z-50 mt-2 rounded-lg border border-neutral-200/50 bg-white shadow-lg dark:border-neutral-800/50 dark:bg-neutral-900"
              style={{ width: '280px' }}
            >
              <Calendar
                selected={timestamp}
                onSelect={handleDateChange}
                locale="zh-CN"
                initialFocus
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoteFormHeader;
