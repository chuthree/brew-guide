'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { NoteItemProps } from '../types';
import { formatDate, formatRating } from '../utils';

// 动态导入 ImageViewer 组件 - 移除加载占位符
const ImageViewer = dynamic(
  () => import('@/components/common/ui/ImageViewer'),
  {
    ssr: false,
  }
);

// 简洁版笔记项组件
const NoteItemCompact: React.FC<NoteItemProps> = ({
  note,
  equipmentNames,
  onEdit,
  onDelete,
  onCopy,
  unitPriceCache,
  isShareMode = false,
  isSelected = false,
  onToggleSelect,
  isLast = false,
  getValidTasteRatings,
  coffeeBeans = [],
}) => {
  // 图片查看器状态和错误状态
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  // 内容展开状态
  const [isExpanded, setIsExpanded] = useState(false);
  // 内容是否溢出（需要截断）
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  // 预先计算一些条件，避免在JSX中重复计算
  const validTasteRatings = getValidTasteRatings
    ? getValidTasteRatings(note.taste)
    : [];
  const hasTasteRatings = validTasteRatings.length > 0;
  const hasNotes = Boolean(note.notes);
  const equipmentName =
    note.equipment && note.equipment.trim() !== ''
      ? equipmentNames[note.equipment] || note.equipment
      : '未知器具';
  const beanName = note.coffeeBeanInfo?.name;
  const beanUnitPrice = beanName ? unitPriceCache[beanName] || 0 : 0;

  // 检测内容是否溢出
  useEffect(() => {
    if (contentRef.current) {
      const el = contentRef.current;
      setIsOverflowing(el.scrollHeight > el.clientHeight);
    }
  }, [note.notes, note.params, hasTasteRatings]);

  // 获取完整的咖啡豆信息（包括图片）
  const beanInfo = note.beanId
    ? coffeeBeans.find(bean => bean.id === note.beanId)
    : null;

  // 判断是否为意式咖啡笔记
  const isEspresso = React.useMemo(() => {
    // 检查器具ID (兼容自定义意式器具ID格式，通常包含 espresso)
    if (
      note.equipment &&
      (note.equipment.toLowerCase().includes('espresso') ||
        note.equipment.includes('意式'))
    ) {
      return true;
    }
    return false;
  }, [note.equipment]);

  // 处理笔记点击事件
  const handleNoteClick = () => {
    if (isShareMode && onToggleSelect) {
      onToggleSelect(note.id);
    } else {
      // 非分享模式下，触发打开详情事件
      window.dispatchEvent(
        new CustomEvent('noteDetailOpened', {
          detail: {
            note,
            equipmentName,
            beanUnitPrice,
            beanInfo, // 传递完整的咖啡豆信息
          },
        })
      );
    }
  };

  // 构建统一的内容文本
  const buildContentText = (collapsed: boolean = false) => {
    const parts: string[] = [];

    // 方案名称
    if (note.method && note.method.trim() !== '') {
      parts.push(note.method);
    }

    // 器具名称（如果有咖啡豆名称则显示器具）
    if (beanName || !note.method || note.method.trim() === '') {
      if (equipmentName && equipmentName !== beanName) {
        parts.push(equipmentName);
      }
    }

    // 参数信息
    if (note.params) {
      if (isEspresso) {
        // 意式参数
        if (note.params.coffee) parts.push(note.params.coffee);
        if (note.params.grindSize) parts.push(note.params.grindSize);
        if (note.totalTime > 0) parts.push(`${note.totalTime}s`);
        if (note.params.water) parts.push(note.params.water);
      } else {
        // 手冲参数
        if (note.params.coffee) parts.push(note.params.coffee);
        if (note.params.ratio) parts.push(note.params.ratio);
        if (note.params.grindSize) parts.push(note.params.grindSize);
        if (note.params.temp) parts.push(note.params.temp);
      }
    }

    // 风味评分（简化显示）
    if (hasTasteRatings) {
      const tasteText = validTasteRatings
        .map(r => `${r.label} ${r.value}`)
        .join(' · ');
      parts.push(tasteText);
    }

    // 组合元数据信息（带透明度）
    const metaContent = parts.join(' · ');

    // 处理笔记内容：收起时将换行符替换为空格，展开时保留原样
    const notesContent = hasNotes
      ? collapsed
        ? note.notes?.replace(/[\r\n]+/g, ' ')
        : note.notes
      : null;

    // 返回包含元数据和笔记的 JSX
    return (
      <>
        {metaContent && <span className="opacity-60">{metaContent}</span>}
        {metaContent && hasNotes && <span className="opacity-60">，</span>}
        {notesContent}
      </>
    );
  };

  return (
    <div
      className={`group note-item mx-3 mt-3 rounded-md bg-neutral-200/30 first:mt-3 dark:bg-neutral-800/40 ${!isShareMode ? 'cursor-pointer' : 'cursor-pointer'}`}
      onClick={handleNoteClick}
      data-note-id={note.id}
    >
      <div className="flex flex-col p-3">
        {/* 顶部：日期、咖啡豆名称和评分 */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 truncate text-xs font-medium tracking-wide text-neutral-500 dark:text-neutral-400">
            {formatDate(note.timestamp)}
            {beanName && (
              <>
                <span className="mx-1">·</span>
                <span>{beanName}</span>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {note.rating > 0 && (
              <div className="text-xs font-medium tracking-wide text-neutral-500 dark:text-neutral-400">
                {note.rating}/5
              </div>
            )}
            {isShareMode && (
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
            )}
          </div>
        </div>

        {/* 分割线 */}
        <div className="my-3 h-px bg-neutral-200/60 dark:bg-neutral-700/50" />

        {/* 统一内容区域 */}
        <div
          ref={contentRef}
          className={`text-xs leading-relaxed font-medium text-neutral-700 dark:text-neutral-300 ${!isExpanded && !isShareMode ? 'line-clamp-3' : 'whitespace-pre-line'}`}
          onClick={e => {
            // 如果内容没有溢出，不阻止事件冒泡，让卡片点击事件触发进入详情
            if (isOverflowing && !isShareMode) {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }
          }}
        >
          {buildContentText(!isExpanded && !isShareMode)}
        </div>

        {/* 图片区域 - 放在最下面，保持原始比例 */}
        {note.image && (
          <div
            className="relative mt-3 h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded bg-neutral-200/50 dark:bg-neutral-700/30"
            onClick={e => {
              e.stopPropagation();
              if (!imageError) setImageViewerOpen(true);
            }}
          >
            {imageError ? (
              <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500 dark:text-neutral-400">
                加载失败
              </div>
            ) : (
              <Image
                src={note.image}
                alt={beanName || '笔记图片'}
                width={64}
                height={64}
                unoptimized
                className="h-full w-full object-cover"
                priority={false}
                loading="lazy"
                onError={() => setImageError(true)}
              />
            )}
          </div>
        )}

        {/* 图片查看器 */}
        {note.image && !imageError && imageViewerOpen && (
          <ImageViewer
            isOpen={imageViewerOpen}
            imageUrl={note.image}
            alt={beanName || '笔记图片'}
            onClose={() => setImageViewerOpen(false)}
          />
        )}
      </div>
    </div>
  );
};

// 🔥 使用 React.memo 优化组件，避免不必要的重新渲染
// 只有当 props 真正变化时才重新渲染
export default React.memo(NoteItemCompact, (prevProps, nextProps) => {
  // UI 状态检查
  if (
    prevProps.isSelected !== nextProps.isSelected ||
    prevProps.isShareMode !== nextProps.isShareMode ||
    prevProps.isLast !== nextProps.isLast
  ) {
    return false; // props 变化，需要重新渲染
  }

  // 笔记 ID 检查
  if (prevProps.note.id !== nextProps.note.id) {
    return false; // 不同的笔记，需要重新渲染
  }

  // 🔥 关键修复：检查笔记内容是否变化（深度比较）
  // 这样可以捕获笔记编辑后的内容变化
  const prevNote = prevProps.note;
  const nextNote = nextProps.note;

  // 检查可能变化的字段
  if (
    prevNote.timestamp !== nextNote.timestamp ||
    prevNote.rating !== nextNote.rating ||
    prevNote.notes !== nextNote.notes ||
    prevNote.equipment !== nextNote.equipment ||
    prevNote.method !== nextNote.method ||
    prevNote.image !== nextNote.image ||
    prevNote.totalTime !== nextNote.totalTime
  ) {
    return false; // 笔记内容变化，需要重新渲染
  }

  // 检查咖啡豆信息
  if (
    prevNote.coffeeBeanInfo?.name !== nextNote.coffeeBeanInfo?.name ||
    prevNote.coffeeBeanInfo?.roastLevel !== nextNote.coffeeBeanInfo?.roastLevel
  ) {
    return false;
  }

  // 检查参数
  if (
    prevNote.params?.coffee !== nextNote.params?.coffee ||
    prevNote.params?.water !== nextNote.params?.water ||
    prevNote.params?.ratio !== nextNote.params?.ratio ||
    prevNote.params?.grindSize !== nextNote.params?.grindSize ||
    prevNote.params?.temp !== nextNote.params?.temp
  ) {
    return false;
  }

  // 检查口感 - 🔥 修复：检查所有风味维度（包括自定义维度）
  const prevTasteKeys = Object.keys(prevNote.taste || {});
  const nextTasteKeys = Object.keys(nextNote.taste || {});

  // 检查风味维度数量是否变化
  if (prevTasteKeys.length !== nextTasteKeys.length) {
    return false;
  }

  // 检查每个风味维度的值是否变化
  for (const key of nextTasteKeys) {
    if (prevNote.taste?.[key] !== nextNote.taste?.[key]) {
      return false;
    }
  }

  // 检查设备名称映射
  const prevEquipmentName = prevNote.equipment
    ? prevProps.equipmentNames[prevNote.equipment]
    : undefined;
  const nextEquipmentName = nextNote.equipment
    ? nextProps.equipmentNames[nextNote.equipment]
    : undefined;

  if (prevEquipmentName !== nextEquipmentName) {
    return false;
  }

  // 所有检查都通过，不需要重新渲染
  return true;
});
