'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { ChevronRight } from 'lucide-react';
import { NoteItemProps } from '../types';
import { formatDate, formatRating } from '../utils';
import {
  formatNoteBeanDisplayName,
  getBeanDisplayInitial,
  getRoasterName,
} from '@/lib/utils/beanVarietyUtils';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useBrewingNoteStore } from '@/lib/stores/brewingNoteStore';
import { openImageViewer } from '@/lib/ui/imageViewer';

// 动态导入 RatingRadarDrawer 组件
const RatingRadarDrawer = dynamic(
  () => import('@/components/notes/Detail/RatingRadarDrawer'),
  {
    ssr: false,
  }
);

const SINGLE_IMAGE_MAX_WIDTH = 140;
const SINGLE_IMAGE_MAX_HEIGHT = 180;
const singleImageSizeCache = new Map<
  string,
  { width: number; height: number }
>();

const getConstrainedSize = (
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
) => {
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
};

// 优化笔记项组件以避免不必要的重渲染
const NoteItem: React.FC<NoteItemProps> = ({
  note,
  equipmentNames,
  onEdit,
  onDelete,
  onCopy,
  unitPriceCache,
  isShareMode = false,
  isSelected = false,
  onToggleSelect,
  isFirst = false,
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
  const roasterSettings = {
    roasterFieldEnabled,
    roasterSeparator,
  };

  // 获取评分维度入口显示设置
  const showRatingDimensionsEntry = useSettingsStore(
    state => state.settings.showRatingDimensionsEntry ?? false
  );

  // 图片错误状态
  const [imageError, setImageError] = useState(false);
  const [noteImageError, setNoteImageError] = useState(false);

  // 评分雷达图抽屉状态
  const [showRatingRadar, setShowRatingRadar] = useState(false);

  // 获取所有笔记用于对比
  const allNotes = useBrewingNoteStore(state => state.notes);

  // 获取该咖啡豆的所有有风味评分的笔记（用于对比）
  const compareNotes = React.useMemo(() => {
    if (!note.beanId) return [];
    return allNotes
      .filter(
        n =>
          n.beanId === note.beanId &&
          n.taste &&
          Object.values(n.taste).some(v => v > 0)
      )
      .map(n => ({
        id: n.id,
        timestamp: n.timestamp,
        taste: n.taste,
        method: n.method,
      }));
  }, [note.beanId, allNotes]);

  // 获取笔记图片列表
  const noteImages = React.useMemo(() => {
    if (note.images && note.images.length > 0) return note.images;
    if (note.image) return [note.image];
    return [];
  }, [note.images, note.image]);

  // 预先计算一些条件，避免在JSX中重复计算
  const validTasteRatings = getValidTasteRatings
    ? getValidTasteRatings(note.taste)
    : [];
  const hasTasteRatings = validTasteRatings.length > 0;
  const hasNotes = Boolean(note.notes);
  const isSingleNoteImage = noteImages.length === 1;
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

  // 获取烘焙商图片
  const roasterLogo = React.useMemo(() => {
    if (!beanInfo?.roaster) return null;
    const settings = useSettingsStore.getState().settings;
    const roasterLogos = (settings as any).roasterLogos || {};
    return roasterLogos[beanInfo.roaster] || null;
  }, [beanInfo?.roaster]);

  const singleImageUrl = isSingleNoteImage ? noteImages[0] : '';
  const cachedSingleImageSize = useMemo(
    () => (singleImageUrl ? singleImageSizeCache.get(singleImageUrl) : null),
    [singleImageUrl]
  );
  const [singleImageSize, setSingleImageSize] = useState<{
    width: number;
    height: number;
  } | null>(cachedSingleImageSize ?? null);

  useEffect(() => {
    setSingleImageSize(cachedSingleImageSize ?? null);
  }, [cachedSingleImageSize, singleImageUrl]);

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
    <>
      <div
        className={`group px-6 ${isFirst ? 'pt-5' : 'pt-3.5'} pb-3.5 ${!isLast ? 'border-b border-neutral-200/50 dark:border-neutral-800/50' : ''} ${!isShareMode ? 'cursor-pointer' : 'cursor-pointer'} note-item`}
        onClick={handleNoteClick}
        data-note-id={note.id}
      >
        <div className="flex gap-3.5">
          {/* 咖啡豆图片 - 方形带圆角，固定在左侧 */}
          <div
            className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded border border-neutral-200/50 bg-neutral-100 dark:border-neutral-800/50 dark:bg-neutral-800/20"
            onClick={e => {
              e.stopPropagation();
              if ((beanInfo?.image || roasterLogo) && !imageError)
                openImageViewer({
                  url: beanInfo?.image || roasterLogo || '',
                  alt: beanInfo?.image
                    ? beanName || '咖啡豆图片'
                    : beanInfo
                      ? getRoasterName(beanInfo, roasterSettings) +
                        ' 烘焙商图标'
                      : '烘焙商图标',
                  backUrl: beanInfo?.backImage,
                });
            }}
          >
            {beanInfo?.image && !imageError ? (
              <Image
                src={beanInfo.image}
                alt={beanName || '咖啡豆图片'}
                height={48}
                width={48}
                unoptimized
                style={{ width: '100%', height: '100%' }}
                className="object-cover"
                sizes="48px"
                priority={false}
                loading="lazy"
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                onError={() => setImageError(true)}
              />
            ) : roasterLogo && !imageError ? (
              <Image
                src={roasterLogo}
                alt={
                  beanInfo
                    ? getRoasterName(beanInfo, roasterSettings) + ' 烘焙商图标'
                    : '烘焙商图标'
                }
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
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-neutral-400 dark:text-neutral-600">
                {beanInfo
                  ? getBeanDisplayInitial(beanInfo)
                  : beanName?.charAt(0) || '?'}
              </div>
            )}
          </div>

          {/* 内容区域 - 垂直排列，使用统一的间距系统 */}
          <div className="min-w-0 flex-1 space-y-1.5">
            {/* 咖啡豆名称 */}
            {(beanName || isShareMode) && (
              <div className="flex items-start justify-between gap-3">
                {beanName && (
                  <div className="min-w-0 flex-1 truncate text-xs leading-tight font-medium text-neutral-800 dark:text-neutral-100">
                    {beanName}
                  </div>
                )}
                {isShareMode && (
                  <div className="relative h-[16.5px]">
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
            )}

            {/* 备注信息 */}
            {hasNotes && (
              <div className="text-xs font-medium tracking-wide whitespace-pre-line text-neutral-600 dark:text-neutral-400">
                {note.notes}
              </div>
            )}

            {/* 笔记图片 - 仿微信朋友圈九宫格 */}
            {noteImages.length > 0 && (
              <div
                className={`mt-2 gap-1 ${
                  isSingleNoteImage
                    ? 'flex'
                    : noteImages.length === 2 || noteImages.length === 4
                      ? 'grid max-w-50 grid-cols-2'
                      : 'grid max-w-75 grid-cols-3'
                }`}
                onClick={e => e.stopPropagation()}
              >
                {noteImages.map((img, index) => (
                  <div
                    key={index}
                    className={`relative cursor-pointer overflow-hidden rounded-[3px] border border-neutral-200/50 dark:border-neutral-800/50 ${
                      isSingleNoteImage ? 'inline-flex' : 'block aspect-square'
                    }`}
                    style={
                      isSingleNoteImage && singleImageSize
                        ? {
                            width: singleImageSize.width,
                            height: singleImageSize.height,
                          }
                        : undefined
                    }
                    onClick={() => {
                      if (!noteImageError) {
                        openImageViewer({
                          url: img,
                          alt: `笔记图片 ${index + 1}`,
                        });
                      }
                    }}
                  >
                    {noteImageError ? (
                      <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500 dark:text-neutral-400">
                        加载失败
                      </div>
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={img}
                        alt={`笔记图片 ${index + 1}`}
                        width={isSingleNoteImage ? singleImageSize?.width : 96}
                        height={
                          isSingleNoteImage ? singleImageSize?.height : 96
                        }
                        className={
                          isSingleNoteImage
                            ? 'block h-auto max-h-45 w-auto max-w-35'
                            : 'block h-full w-full object-cover'
                        }
                        style={
                          isSingleNoteImage && singleImageSize
                            ? {
                                width: singleImageSize.width,
                                height: singleImageSize.height,
                              }
                            : undefined
                        }
                        onLoad={e => {
                          if (!isSingleNoteImage) return;
                          const target = e.currentTarget;
                          const naturalWidth = target.naturalWidth || 0;
                          const naturalHeight = target.naturalHeight || 0;
                          if (naturalWidth <= 0 || naturalHeight <= 0) return;
                          const constrained = getConstrainedSize(
                            naturalWidth,
                            naturalHeight,
                            SINGLE_IMAGE_MAX_WIDTH,
                            SINGLE_IMAGE_MAX_HEIGHT
                          );
                          singleImageSizeCache.set(img, constrained);
                          setSingleImageSize(constrained);
                        }}
                        onError={() => setNoteImageError(true)}
                        loading="lazy"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 时间和评分 */}
            <div className="mt-2 text-xs leading-tight font-medium text-neutral-500/60 dark:text-neutral-500/60">
              {formatDate(note.timestamp)}
              {note.rating > 0 && (
                <>
                  {' · '}
                  {note.rating}
                  /5分
                </>
              )}
            </div>

            {/* 评分维度入口 - 仿微信朋友圈样式 */}
            {showRatingDimensionsEntry && hasTasteRatings && (
              <div
                className="mt-2 -mr-6 border-t border-neutral-200/50 pt-2 pr-6 dark:border-neutral-800/50"
                data-export-hidden="true"
              >
                <div
                  className="dark:text-neutral-00 flex cursor-pointer items-center text-xs text-neutral-500 transition-colors"
                  onClick={e => {
                    e.stopPropagation();
                    setShowRatingRadar(true);
                  }}
                >
                  <span className="">
                    评分维度 {validTasteRatings.length} 项
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-600" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 评分雷达图抽屉 */}
      {hasTasteRatings && (
        <RatingRadarDrawer
          isOpen={showRatingRadar}
          onClose={() => setShowRatingRadar(false)}
          ratings={validTasteRatings}
          overallRating={note.rating}
          beanName={beanName}
          note={note.notes}
          currentNoteId={note.id}
          compareNotes={compareNotes}
        />
      )}
    </>
  );
};

// 只有当 props 真正变化时才重新渲染
export default React.memo(NoteItem, (prevProps, nextProps) => {
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
    prevNote.images?.length !== nextNote.images?.length ||
    (prevNote.images &&
      nextNote.images &&
      prevNote.images.some((img, i) => img !== nextNote.images![i])) ||
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

  // 检查口感 - 🔥 修复：检查所有评分维度（包括自定义维度）
  const prevTasteKeys = Object.keys(prevNote.taste || {});
  const nextTasteKeys = Object.keys(nextNote.taste || {});

  // 检查评分维度数量是否变化
  if (prevTasteKeys.length !== nextTasteKeys.length) {
    return false;
  }

  // 检查每个评分维度的值是否变化
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
