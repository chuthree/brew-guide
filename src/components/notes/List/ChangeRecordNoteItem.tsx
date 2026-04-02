'use client';

import React, { useMemo } from 'react';
import ActionMenu from '@/components/coffee-bean/ui/action-menu';
import { BrewingNote } from '@/lib/core/config';
import { formatNoteBeanDisplayName } from '@/lib/utils/beanVarietyUtils';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { formatDateAbsolute } from '../utils';
import {
  buildCoffeeBeanLookup,
  resolveNoteCoffeeBeanInfo,
} from '@/lib/notes/noteDisplay';

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
  // 获取烘焙商相关设置
  const roasterFieldEnabled = useSettingsStore(
    state => state.settings.roasterFieldEnabled
  );
  const roasterSeparator = useSettingsStore(
    state => state.settings.roasterSeparator
  );

  // 通过 beanId 获取咖啡豆信息（用于旧数据兼容）
  const beans = useCoffeeBeanStore(state => state.beans);
  const linkedBean = useMemo(() => {
    if (!note.beanId) return null;
    return beans.find(b => b.id === note.beanId) || null;
  }, [note.beanId, beans]);
  const coffeeBeanLookup = useMemo(() => buildCoffeeBeanLookup(beans), [beans]);

  // 获取烘焙记录中的熟豆信息（用于显示格式化的熟豆名称）
  const roastingRecord = note.changeRecord?.roastingRecord;
  const roastedBean = useMemo(() => {
    if (!roastingRecord?.roastedBeanId) return null;
    return beans.find(b => b.id === roastingRecord.roastedBeanId) || null;
  }, [roastingRecord?.roastedBeanId, beans]);

  // 构建用于显示的咖啡豆信息，优先使用笔记中的 roaster，否则从关联咖啡豆获取
  const displayBeanInfo = useMemo(
    () => resolveNoteCoffeeBeanInfo(note, coffeeBeanLookup, linkedBean),
    [note, coffeeBeanLookup, linkedBean]
  );

  // 构建用于显示的熟豆信息（烘焙记录用）
  const displayRoastedBeanInfo = useMemo(() => {
    if (!roastingRecord?.roastedBeanName) return null;
    return {
      name: roastingRecord.roastedBeanName,
      roaster: roastedBean?.roaster,
    };
  }, [roastingRecord?.roastedBeanName, roastedBean?.roaster]);

  // 使用格式化函数动态显示咖啡豆名称
  const beanName =
    formatNoteBeanDisplayName(displayBeanInfo, {
      roasterFieldEnabled,
      roasterSeparator,
    }) || '未知咖啡豆';
  const dateFormatted = note.timestamp ? formatDateAbsolute(note.timestamp) : '';

  // 判断是否是烘焙记录
  const isRoastingRecord = note.source === 'roasting';

  // 格式化熟豆显示名称
  const roastedBeanDisplayName = formatNoteBeanDisplayName(
    displayRoastedBeanInfo,
    {
      roasterFieldEnabled,
      roasterSeparator,
    }
  );

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
    } else if (note.source === 'roasting') {
      // 烘焙记录 - 显示为扣除生豆的量
      const amount = roastingRecord?.roastedAmount || 0;
      return `-${amount}g`;
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
      className={`group border-b border-neutral-200/50 px-6 py-3 last:border-b-0 dark:border-neutral-800/50 ${isShareMode ? 'cursor-pointer' : ''}`}
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

          {/* 变动量标签 - 统一使用 neutral 色调 */}
          <div className="w-12 overflow-hidden rounded-xs bg-neutral-100 px-1 py-px text-center text-xs font-medium whitespace-nowrap text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
            {getDisplayLabel()}
          </div>

          {/* 烘焙记录：显示转换后的熟豆名称 */}
          {isRoastingRecord && roastedBeanDisplayName && (
            <div className="flex min-w-0 flex-1 items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="text-neutral-400 dark:text-neutral-600">→</span>
              <span
                className="truncate text-neutral-600 dark:text-neutral-300"
                title={roastedBeanDisplayName}
              >
                {roastedBeanDisplayName}
              </span>
            </div>
          )}

          {/* 备注 - 弹性宽度，占用剩余空间（非烘焙记录显示） */}
          {!isRoastingRecord && note.notes && (
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

// 🔥 使用 React.memo 优化组件
export default React.memo(ChangeRecordNoteItem, (prevProps, nextProps) => {
  // UI 状态检查
  if (
    prevProps.isSelected !== nextProps.isSelected ||
    prevProps.isShareMode !== nextProps.isShareMode
  ) {
    return false; // props 变化，需要重新渲染
  }

  // 笔记 ID 检查
  if (prevProps.note.id !== nextProps.note.id) {
    return false; // 不同的笔记，需要重新渲染
  }

  // 🔥 检查笔记内容是否变化
  const prevNote = prevProps.note;
  const nextNote = nextProps.note;

  // 检查可能变化的字段
  if (
    prevNote.timestamp !== nextNote.timestamp ||
    prevNote.notes !== nextNote.notes ||
    prevNote.quickDecrementAmount !== nextNote.quickDecrementAmount
  ) {
    return false;
  }

  // 检查咖啡豆信息（包括烘焙商字段，用于名称显示）
  if (
    prevNote.coffeeBeanInfo?.name !== nextNote.coffeeBeanInfo?.name ||
    prevNote.coffeeBeanInfo?.roastLevel !==
      nextNote.coffeeBeanInfo?.roastLevel ||
    prevNote.coffeeBeanInfo?.roaster !== nextNote.coffeeBeanInfo?.roaster
  ) {
    return false;
  }

  // 检查变动记录详情
  if (
    prevNote.changeRecord?.capacityAdjustment?.changeAmount !==
      nextNote.changeRecord?.capacityAdjustment?.changeAmount ||
    prevNote.changeRecord?.capacityAdjustment?.changeType !==
      nextNote.changeRecord?.capacityAdjustment?.changeType
  ) {
    return false;
  }

  // 检查烘焙记录详情
  if (
    prevNote.changeRecord?.roastingRecord?.roastedAmount !==
      nextNote.changeRecord?.roastingRecord?.roastedAmount ||
    prevNote.changeRecord?.roastingRecord?.roastedBeanName !==
      nextNote.changeRecord?.roastingRecord?.roastedBeanName
  ) {
    return false;
  }

  // 所有检查都通过，不需要重新渲染
  return true;
});
