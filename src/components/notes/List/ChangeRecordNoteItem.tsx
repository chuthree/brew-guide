'use client';

import React from 'react';
import { formatDate } from '../utils';
import ActionMenu from '@/components/coffee-bean/ui/action-menu';
import { BrewingNote } from '@/lib/core/config';

interface ChangeRecordNoteItemProps {
  note: BrewingNote;
  onEdit?: (note: BrewingNote) => void;
  onDelete?: (noteId: string) => Promise<void>;
  onCopy?: (noteId: string) => Promise<void>;
  isShareMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (noteId: string, enterShareMode?: boolean) => void;
}

const ChangeRecordNoteItem: React.FC<ChangeRecordNoteItemProps> = ({
  note,
  onEdit,
  onDelete,
  onCopy,
  isShareMode = false,
  isSelected = false,
  onToggleSelect,
}) => {
  // 获取笔记的关键信息
  const beanName = note.coffeeBeanInfo?.name || '未知咖啡豆';
  const dateFormatted = note.timestamp ? formatDate(note.timestamp) : '';

  // 根据记录类型生成显示标签
  const getDisplayLabel = () => {
    if (note.source === 'quick-decrement') {
      // 快捷扣除记录
      const amount = note.quickDecrementAmount || 0;
      return `-${amount}g`;
    } else if (note.source === 'capacity-adjustment') {
      // 容量调整记录
      const capacityAdjustment = note.changeRecord?.capacityAdjustment;
      const changeAmount = capacityAdjustment?.changeAmount || 0;
      const changeType = capacityAdjustment?.changeType || 'set';

      if (changeType === 'increase') {
        return `+${Math.abs(changeAmount)}g`;
      } else if (changeType === 'decrease') {
        return `-${Math.abs(changeAmount)}g`;
      } else {
        return `${capacityAdjustment?.newAmount || 0}g`;
      }
    }

    return '0g';
  };

  // 处理点击事件
  const handleClick = () => {
    if (isShareMode && onToggleSelect) {
      onToggleSelect(note.id);
    } else if (onEdit) {
      onEdit(note);
    }
  };

  return (
    <div
      className={`group border-b border-neutral-200 px-6 py-3 last:border-b-0 dark:border-neutral-800 ${isShareMode ? 'cursor-pointer' : ''}`}
      onClick={isShareMode ? handleClick : undefined}
      data-note-id={note.id}
    >
      <div className="flex items-center justify-between">
        {/* 左侧信息区域 */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* 咖啡豆名称 - 固定宽度 */}
          <div
            className="w-20 truncate text-xs font-medium text-neutral-800 dark:text-neutral-100"
            title={beanName}
          >
            {beanName}
          </div>

          {/* 变动量标签 - 固定宽度 */}
          <div className="w-12 overflow-hidden rounded-xs bg-neutral-100 px-1 py-px text-center text-xs font-medium whitespace-nowrap text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
            {getDisplayLabel()}
          </div>

          {/* 备注 - 弹性宽度，占用剩余空间 */}
          {note.notes && (
            <div
              className="min-w-0 flex-1 truncate text-xs text-neutral-500 dark:text-neutral-400"
              title={note.notes}
            >
              {note.notes}
            </div>
          )}

          {/* 日期 - 固定宽度 */}
          <div
            className="w-20 overflow-hidden text-right text-xs font-medium tracking-wide whitespace-nowrap text-neutral-600 dark:text-neutral-400"
            title={dateFormatted}
          >
            {dateFormatted}
          </div>
        </div>

        {/* 右侧操作区域 */}
        <div className="ml-2 shrink-0">
          {isShareMode ? (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={e => {
                e.stopPropagation();
                if (onToggleSelect) onToggleSelect(note.id);
              }}
              onClick={e => e.stopPropagation()}
              className="relative h-4 w-4 appearance-none rounded-sm border border-neutral-300 text-xs checked:bg-neutral-800 checked:after:absolute checked:after:top-1/2 checked:after:left-1/2 checked:after:-translate-x-1/2 checked:after:-translate-y-1/2 checked:after:text-white checked:after:content-['✓'] dark:border-neutral-700 dark:checked:bg-neutral-200 dark:checked:after:text-black"
            />
          ) : (
            <ActionMenu
              items={[
                {
                  id: 'edit',
                  label: '编辑',
                  onClick: () => onEdit && onEdit(note),
                },
                {
                  id: 'copy',
                  label: '复制',
                  onClick: () => onCopy && onCopy(note.id),
                },
                {
                  id: 'delete',
                  label: '删除',
                  onClick: () => onDelete && onDelete(note.id),
                  color: 'danger',
                },
                {
                  id: 'share',
                  label: '分享',
                  onClick: () => {
                    if (onToggleSelect) {
                      onToggleSelect(note.id, true);
                    }
                  },
                },
              ]}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ChangeRecordNoteItem;
