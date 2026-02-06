'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { NoteItemProps } from '../types';
import { formatDateAbsolute, formatRating } from '../utils';
import { formatNoteBeanDisplayName } from '@/lib/utils/beanVarietyUtils';
import { useSettingsStore } from '@/lib/stores/settingsStore';

// 动态导入 ImageViewer 组件 - 移除加载占位符
const ImageViewer = dynamic(
  () => import('@/components/common/ui/ImageViewer'),
  {
    ssr: false,
  }
);

// 标准列表样式的笔记项组件
const NoteItemStandard: React.FC<NoteItemProps> = ({
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
  // 获取烘焙商相关设置
  const roasterFieldEnabled = useSettingsStore(
    state => state.settings.roasterFieldEnabled
  );
  const roasterSeparator = useSettingsStore(
    state => state.settings.roasterSeparator
  );

  // 图片查看器状态和错误状态
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

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

  // 使用格式化函数动态显示咖啡豆名称
  const beanName = formatNoteBeanDisplayName(note.coffeeBeanInfo, {
    roasterFieldEnabled,
    roasterSeparator,
  });
  const beanUnitPrice = beanName ? unitPriceCache[beanName] || 0 : 0;

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

  return (
    <div
      className={`group space-y-3 px-6 py-5 ${!isLast ? 'border-b border-neutral-200/50 dark:border-neutral-800/50' : ''} ${!isShareMode ? 'cursor-pointer' : 'cursor-pointer'} note-item`}
      onClick={handleNoteClick}
      data-note-id={note.id}
    >
      <div className="flex flex-col space-y-3">
        {/* 图片和基本信息区域 */}
        <div className="flex gap-4">
          {/* 笔记图片 - 只在有图片时显示 */}
          {note.image && (
            <div
              className="relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded border border-neutral-200/50 bg-neutral-100 dark:border-neutral-800/50 dark:bg-neutral-800/20"
              onClick={e => {
                e.stopPropagation();
                if (!imageError) setImageViewerOpen(true);
              }}
            >
              {imageError ? (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500 dark:text-neutral-400">
                  加载失败
                </div>
              ) : (
                <Image
                  src={note.image}
                  alt={beanName || '笔记图片'}
                  height={48}
                  width={48}
                  unoptimized
                  style={{ width: '100%', height: '100%' }}
                  className="object-cover"
                  sizes="48px"
                  priority={false}
                  loading="lazy"
                  onError={() => setImageError(true)}
                />
              )}
            </div>
          )}

          {/* 图片查看器 - 只有当需要显示时才渲染 */}
          {note.image && !imageError && imageViewerOpen && (
            <ImageViewer
              id={`note-item-image-${note.id}`}
              isOpen={imageViewerOpen}
              imageUrl={note.image}
              alt={beanName || '笔记图片'}
              onClose={() => setImageViewerOpen(false)}
            />
          )}

          {/* 名称和标签区域 */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1 overflow-visible">
                <div className="text-xs font-medium wrap-break-word text-neutral-800 dark:text-neutral-100">
                  {/* 根据是否有方案来决定显示内容 */}
                  {note.method && note.method.trim() !== '' ? (
                    // 有方案时的显示逻辑
                    beanName ? (
                      <>
                        {beanName}
                        <span className="mx-1">·</span>
                        <span>{note.method}</span>
                      </>
                    ) : (
                      <>
                        {equipmentName}
                        <span className="mx-1">·</span>
                        <span>{note.method}</span>
                      </>
                    )
                  ) : // 没有方案时的显示逻辑：合并咖啡豆和器具信息
                  beanName ? (
                    beanName === equipmentName ? (
                      // 如果咖啡豆名称和器具名称相同，只显示一个
                      beanName
                    ) : (
                      // 显示咖啡豆和器具，用分割符连接
                      <>
                        {beanName}
                        <span className="mx-1">·</span>
                        <span>{equipmentName}</span>
                      </>
                    )
                  ) : (
                    // 只有器具信息
                    equipmentName
                  )}
                </div>

                {/* 参数信息 - 只要有参数就显示，不依赖于是否有方案 */}
                {note.params && (
                  <div className="mt-1.5 space-x-1 text-xs leading-relaxed font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                    {/* 如果有方案且有咖啡豆名称，显示器具名称 */}
                    {beanName && note.method && note.method.trim() !== '' && (
                      <>
                        <span>{equipmentName}</span>
                        <span>·</span>
                      </>
                    )}

                    {isEspresso ? (
                      // 意式参数：粉量 · 研磨度 · 时间 · 液重
                      <>
                        <span>
                          {note.params.coffee}
                          {beanName && beanUnitPrice > 0 && (
                            <span className="ml-1">
                              ({beanUnitPrice.toFixed(2)}元/克)
                            </span>
                          )}
                        </span>
                        <span className="shrink-0">·</span>
                        <span>{note.params.grindSize || '-'}</span>
                        {note.totalTime > 0 && (
                          <>
                            <span className="shrink-0">·</span>
                            <span>{note.totalTime}s</span>
                          </>
                        )}
                        <span className="shrink-0">·</span>
                        <span>{note.params.water}</span>
                      </>
                    ) : (
                      // 手冲参数：粉量 · 粉水比 · 研磨度 · 温度
                      <>
                        <span>
                          {note.params.coffee}
                          {beanName && beanUnitPrice > 0 && (
                            <span className="ml-1">
                              ({beanUnitPrice.toFixed(2)}元/克)
                            </span>
                          )}
                        </span>
                        <span>·</span>
                        <span>{note.params.ratio}</span>

                        {/* 合并显示研磨度和水温 */}
                        {(note.params.grindSize || note.params.temp) && (
                          <>
                            <span>·</span>
                            {note.params.grindSize && note.params.temp ? (
                              <span>
                                {note.params.grindSize} · {note.params.temp}
                              </span>
                            ) : (
                              <span>
                                {note.params.grindSize || note.params.temp}
                              </span>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              {isShareMode && (
                <div className="relative ml-1 h-[16.5px] shrink-0">
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
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 风味评分 - 只有当存在有效评分(大于0)时才显示 */}
        {hasTasteRatings ? (
          <div className="grid grid-cols-2 gap-4">
            {validTasteRatings.map(rating => (
              <div key={rating.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                    {rating.label}
                  </div>
                  <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                    {rating.value}
                  </div>
                </div>
                <div className="h-px w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800">
                  <div
                    style={{
                      width: `${rating.value === 0 ? 0 : (rating.value / 5) * 100}%`,
                    }}
                    className="h-full bg-neutral-600 dark:bg-neutral-400"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* 时间和评分 */}
        <div className="flex items-baseline justify-between">
          <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
            {formatDateAbsolute(note.timestamp)}
          </div>
          {/* 只有当评分大于 0 时才显示评分 */}
          {note.rating > 0 && (
            <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
              {isShareMode
                ? `总体评分 ${formatRating(note.rating)}`
                : formatRating(note.rating)}
            </div>
          )}
        </div>

        {/* 备注信息 */}
        {hasNotes && (
          <div className="rounded bg-neutral-100 px-1.5 py-1 text-xs font-medium tracking-wide whitespace-pre-line text-neutral-800/70 dark:bg-neutral-800/40 dark:text-neutral-400/85">
            {note.notes}
          </div>
        )}
      </div>
    </div>
  );
};

// 只有当 props 真正变化时才重新渲染
export default React.memo(NoteItemStandard, (prevProps, nextProps) => {
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

  // 关键字段变化检查
  const prevNote = prevProps.note;
  const nextNote = nextProps.note;

  if (
    prevNote.timestamp !== nextNote.timestamp ||
    prevNote.rating !== nextNote.rating ||
    prevNote.notes !== nextNote.notes ||
    prevNote.equipment !== nextNote.equipment ||
    prevNote.method !== nextNote.method ||
    prevNote.image !== nextNote.image ||
    prevNote.totalTime !== nextNote.totalTime
  ) {
    return false;
  }

  if (
    prevNote.coffeeBeanInfo?.name !== nextNote.coffeeBeanInfo?.name ||
    prevNote.coffeeBeanInfo?.roastLevel !== nextNote.coffeeBeanInfo?.roastLevel
  ) {
    return false;
  }

  if (
    prevNote.params?.coffee !== nextNote.params?.coffee ||
    prevNote.params?.water !== nextNote.params?.water ||
    prevNote.params?.ratio !== nextNote.params?.ratio ||
    prevNote.params?.grindSize !== nextNote.params?.grindSize ||
    prevNote.params?.temp !== nextNote.params?.temp
  ) {
    return false;
  }

  const prevTasteKeys = Object.keys(prevNote.taste || {});
  const nextTasteKeys = Object.keys(nextNote.taste || {});

  if (prevTasteKeys.length !== nextTasteKeys.length) {
    return false;
  }

  for (const key of nextTasteKeys) {
    if (prevNote.taste?.[key] !== nextNote.taste?.[key]) {
      return false;
    }
  }

  const prevEquipmentName = prevNote.equipment
    ? prevProps.equipmentNames[prevNote.equipment]
    : undefined;
  const nextEquipmentName = nextNote.equipment
    ? nextProps.equipmentNames[nextNote.equipment]
    : undefined;

  if (prevEquipmentName !== nextEquipmentName) {
    return false;
  }

  return true;
});
