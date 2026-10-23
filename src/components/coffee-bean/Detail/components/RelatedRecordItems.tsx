'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import {
  formatDate,
  formatDateAbsolute,
  formatRating,
} from '@/components/notes/utils';
import { BeanImageSmall } from './BeanImageSection';
import { formatNumber } from '../utils';
import {
  formatBeanDisplayName,
  type RoasterSettings,
} from '@/lib/utils/beanVarietyUtils';
import {
  getBeanUnitPrice,
  normalizeBrewingNoteParams,
  getNoteEspressoParamParts,
  resolveNoteEquipmentName,
  resolveNoteMethodName,
} from '@/lib/notes/noteDisplay';
import { useBrewingNoteImagesWhenVisible } from '@/lib/hooks/useBrewingNoteImages';
import { getDataUrlImageDimensions } from '@/lib/images/dimensions';
import { isSimpleChangeRecord, isRoastingRecord } from '../types';
import { openImageViewer } from '@/lib/ui/imageViewer';

const SINGLE_NOTE_IMAGE_MAX_WIDTH = 140;
const SINGLE_NOTE_IMAGE_MAX_HEIGHT = 180;

const isVisibleText = (value: string | null | undefined): value is string =>
  Boolean(value);

type TasteRating = {
  id: string;
  label: string;
  value: number;
};

type OpenRelatedNoteDetailHandler = (detail: {
  note: BrewingNote;
  equipmentName: string;
  beanUnitPrice: number;
  beanInfo?: CoffeeBean | null;
}) => void;

export const SourceGreenBeanItem: React.FC<{
  bean: CoffeeBean;
  roasterSettings: RoasterSettings;
}> = React.memo(({ bean, roasterSettings }) => (
  <div className="flex items-center gap-3">
    <BeanImageSmall bean={bean} />
    <div className="min-w-0 flex-1">
      <div className="truncate text-xs font-medium text-neutral-800 dark:text-neutral-100">
        {formatBeanDisplayName(bean, roasterSettings)}
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        <span>{bean.purchaseDate || '-'}</span>
        {(bean.remaining || bean.capacity) && (
          <>
            <span>·</span>
            <span>
              {formatNumber(bean.remaining)}/{formatNumber(bean.capacity)}g
            </span>
          </>
        )}
      </div>
    </div>
  </div>
));

SourceGreenBeanItem.displayName = 'SourceGreenBeanItem';

export const ChangeRecordItem: React.FC<{ note: BrewingNote }> = React.memo(
  ({ note }) => {
    const noteText = note.notes?.trim();
    let displayLabel = '0g';

    if (note.source === 'quick-decrement') {
      const amount = note.quickDecrementAmount || 0;
      displayLabel = `-${amount}g`;
    } else if (note.source === 'capacity-adjustment') {
      const capacityAdjustment = note.changeRecord?.capacityAdjustment;
      const changeAmount = capacityAdjustment?.changeAmount || 0;
      const changeType = capacityAdjustment?.changeType || 'set';

      if (changeType === 'increase') {
        displayLabel = `+${Math.abs(changeAmount)}g`;
      } else if (changeType === 'decrease') {
        displayLabel = `-${Math.abs(changeAmount)}g`;
      } else {
        displayLabel = `${capacityAdjustment?.newAmount || 0}g`;
      }
    }

    return (
      <div className="flex items-center gap-2 opacity-80">
        <div className="w-12 overflow-hidden rounded-xs bg-neutral-200/50 px-1 py-px text-center text-xs font-medium whitespace-nowrap text-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-300">
          {displayLabel}
        </div>
        <div
          className="min-w-0 flex-1 truncate text-xs text-neutral-600 dark:text-neutral-300"
          title={noteText || undefined}
        >
          {noteText}
        </div>
        <div
          className="w-20 overflow-hidden text-right text-xs font-medium tracking-wide whitespace-nowrap text-neutral-600 dark:text-neutral-400"
          title={formatDateAbsolute(note.timestamp)}
        >
          {formatDateAbsolute(note.timestamp)}
        </div>
      </div>
    );
  }
);

ChangeRecordItem.displayName = 'ChangeRecordItem';

export const RoastingRecordItem: React.FC<{
  note: BrewingNote;
  allBeans: CoffeeBean[];
  roasterSettings: RoasterSettings;
}> = React.memo(({ note, allBeans, roasterSettings }) => {
  const roastedBeanId = note.changeRecord?.roastingRecord?.roastedBeanId;
  const roastedBean = roastedBeanId
    ? allBeans.find(bean => bean.id === roastedBeanId)
    : null;

  if (roastedBean) {
    return (
      <div className="flex items-center gap-3">
        <BeanImageSmall bean={roastedBean} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-neutral-800 dark:text-neutral-100">
            {formatBeanDisplayName(roastedBean, roasterSettings)}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            <span>{roastedBean.roastDate || '-'}</span>
            {(roastedBean.remaining || roastedBean.capacity) && (
              <>
                <span>·</span>
                <span>
                  {formatNumber(roastedBean.remaining)}/
                  {formatNumber(roastedBean.capacity)}g
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 opacity-80">
      <div className="w-12 overflow-hidden rounded-xs bg-neutral-200/50 px-1 py-px text-center text-xs font-medium whitespace-nowrap text-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-300">
        -{note.changeRecord?.roastingRecord?.roastedAmount || 0}g
      </div>
      {note.changeRecord?.roastingRecord?.roastedBeanName && (
        <div className="flex min-w-0 flex-1 items-center gap-1 text-xs text-neutral-600 dark:text-neutral-300">
          <span className="text-neutral-400 dark:text-neutral-600">→</span>
          <span className="truncate">
            {note.changeRecord.roastingRecord.roastedBeanName}
          </span>
        </div>
      )}
      <div
        className="w-20 overflow-hidden text-right text-xs font-medium tracking-wide whitespace-nowrap text-neutral-600 dark:text-neutral-400"
        title={formatDateAbsolute(note.timestamp)}
      >
        {formatDateAbsolute(note.timestamp)}
      </div>
    </div>
  );
});

RoastingRecordItem.displayName = 'RoastingRecordItem';

const getSingleNoteImageFrame = (
  imageUrl: string | undefined
): { width: number; height: number; style: React.CSSProperties } => {
  const dimensions = getDataUrlImageDimensions(imageUrl);

  if (!dimensions) {
    return {
      width: SINGLE_NOTE_IMAGE_MAX_WIDTH,
      height: SINGLE_NOTE_IMAGE_MAX_WIDTH,
      style: {
        width: SINGLE_NOTE_IMAGE_MAX_WIDTH,
        height: SINGLE_NOTE_IMAGE_MAX_WIDTH,
      },
    };
  }

  const aspectRatio = dimensions.width / dimensions.height;
  const maxFrameRatio =
    SINGLE_NOTE_IMAGE_MAX_WIDTH / SINGLE_NOTE_IMAGE_MAX_HEIGHT;
  const width = Math.max(
    1,
    aspectRatio >= maxFrameRatio
      ? SINGLE_NOTE_IMAGE_MAX_WIDTH
      : Math.round(SINGLE_NOTE_IMAGE_MAX_HEIGHT * aspectRatio)
  );
  const height = Math.max(
    1,
    aspectRatio >= maxFrameRatio
      ? Math.round(SINGLE_NOTE_IMAGE_MAX_WIDTH / aspectRatio)
      : SINGLE_NOTE_IMAGE_MAX_HEIGHT
  );

  return {
    width,
    height,
    style: {
      width,
      height,
      aspectRatio: `${dimensions.width} / ${dimensions.height}`,
    },
  };
};

interface RelatedNoteImageGalleryProps {
  noteId: string;
  noteImages: string[];
  imageSlotCount: number;
  noteImageError: boolean;
  onImageClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onImageError: () => void;
}

const RelatedNoteImageGallery = React.memo(function RelatedNoteImageGallery({
  noteId,
  noteImages,
  imageSlotCount,
  noteImageError,
  onImageClick,
  onImageError,
}: RelatedNoteImageGalleryProps) {
  if (imageSlotCount <= 0) return null;

  const isSingleNoteImage = imageSlotCount === 1;
  const imageSlots = Array.from({ length: imageSlotCount }, (_, position) => ({
    key: `${noteId}-image-slot-${position + 1}`,
    image: noteImages[position] ?? '',
    position,
  }));
  const singleImageFrame = isSingleNoteImage
    ? getSingleNoteImageFrame(imageSlots[0]?.image)
    : null;

  return (
    <div
      data-related-note-images
      className={`mt-2 gap-1 ${
        isSingleNoteImage
          ? 'flex'
          : imageSlotCount === 2 || imageSlotCount === 4
            ? 'grid max-w-50 grid-cols-2'
            : 'grid max-w-75 grid-cols-3'
      }`}
    >
      {imageSlots.map(({ key, image, position }) => (
        <button
          key={key}
          type="button"
          className={`pointer-events-auto relative cursor-pointer overflow-hidden rounded-[3px] border border-neutral-200/50 dark:border-neutral-800/50 ${
            isSingleNoteImage ? 'inline-flex shrink-0' : 'block aspect-square'
          } appearance-none bg-transparent p-0`}
          style={singleImageFrame?.style}
          data-image-index={position}
          onClick={onImageClick}
          aria-label={image ? `查看笔记图片 ${position + 1}` : '笔记图片加载中'}
        >
          {noteImageError ? (
            <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500 dark:text-neutral-400">
              加载失败
            </div>
          ) : !image ? (
            <div className="h-full w-full bg-neutral-100 dark:bg-neutral-800/40" />
          ) : (
            <Image
              src={image}
              alt={`笔记图片 ${position + 1}`}
              width={isSingleNoteImage ? singleImageFrame?.width : 96}
              height={isSingleNoteImage ? singleImageFrame?.height : 96}
              unoptimized
              className={
                isSingleNoteImage
                  ? 'block h-full w-full object-contain'
                  : 'block h-full w-full object-cover'
              }
              sizes={
                isSingleNoteImage ? `${singleImageFrame?.width}px` : '96px'
              }
              onError={onImageError}
              loading="lazy"
            />
          )}
        </button>
      ))}
    </div>
  );
});

const formatTasteRatingValue = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

interface ClassicBrewingRecordContentProps {
  note: BrewingNote;
  bean: CoffeeBean | null;
  titleParts: string[];
  paramParts: string[];
  validTasteRatings: TasteRating[];
  noteImage?: string;
  noteImageError: boolean;
  onNoteImageClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onNoteImageError: () => void;
}

const ClassicBrewingRecordContent = React.memo(
  function ClassicBrewingRecordContent({
    note,
    bean,
    titleParts,
    paramParts,
    validTasteRatings,
    noteImage,
    noteImageError,
    onNoteImageClick,
    onNoteImageError,
  }: ClassicBrewingRecordContentProps) {
    const hasTasteRatings = validTasteRatings.length > 0;
    const hasTextSummary = titleParts.length > 0 || paramParts.length > 0;
    const hasSummaryContent = Boolean(noteImage || hasTextSummary);

    return (
      <>
        {hasSummaryContent && (
          <div className="flex gap-3">
            {noteImage && (
              <button
                type="button"
                className="pointer-events-auto relative size-14 shrink-0 cursor-pointer overflow-hidden rounded border border-neutral-200/50 bg-neutral-100 p-0 dark:border-neutral-700/40 dark:bg-neutral-800/20"
                onClick={onNoteImageClick}
              >
                {noteImageError ? (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500 dark:text-neutral-400">
                    加载失败
                  </div>
                ) : (
                  <Image
                    src={noteImage}
                    alt={bean?.name || '笔记图片'}
                    height={48}
                    width={48}
                    unoptimized
                    style={{ width: '100%', height: '100%' }}
                    className="object-cover"
                    sizes="48px"
                    priority={false}
                    loading="lazy"
                    onError={onNoteImageError}
                  />
                )}
              </button>
            )}

            {hasTextSummary && (
              <div className="min-w-0 flex-1">
                <div className="space-y-1.5">
                  {titleParts.length > 0 && (
                    <div className="text-xs font-medium wrap-break-word text-neutral-800 dark:text-neutral-100">
                      {titleParts.map((part, index) => (
                        <React.Fragment key={`${part}-${index}`}>
                          {index > 0 && <span className="mx-1">·</span>}
                          <span>{part}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                  {paramParts.length > 0 && (
                    <div className="mt-1.5 space-x-1 text-xs leading-relaxed font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                      {paramParts.map((part, index) => (
                        <React.Fragment key={`${part}-${index}`}>
                          {index > 0 && <span className="shrink-0">·</span>}
                          <span>{part}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {hasTasteRatings && (
          <div className="grid grid-cols-2 gap-4">
            {validTasteRatings.map(rating => (
              <div key={rating.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                    {rating.label}
                  </div>
                  <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                    {formatTasteRatingValue(rating.value)}
                  </div>
                </div>
                <div className="h-px w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-700/50">
                  <div
                    style={{
                      width: `${rating.value === 0 ? 0 : (rating.value / 5) * 100}%`,
                    }}
                    className="h-full bg-neutral-600 dark:bg-neutral-300"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-baseline justify-between">
          <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
            {formatDateAbsolute(note.timestamp)}
          </div>
          {note.rating > 0 && (
            <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
              {formatRating(note.rating)}
            </div>
          )}
        </div>

        {note.notes && note.notes.trim() && (
          <div className="rounded bg-neutral-200/30 px-1.5 py-1 text-xs font-medium tracking-wide whitespace-pre-line text-neutral-800/70 dark:bg-neutral-800/40 dark:text-neutral-400/85">
            {note.notes}
          </div>
        )}
      </>
    );
  }
);

interface ModernBrewingRecordContentProps {
  note: BrewingNote;
  noteImages: string[];
  imageSlotCount: number;
  grindSize?: string;
  noteImageError: boolean;
  onNoteImageClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onNoteImageError: () => void;
}

const ModernBrewingRecordContent = React.memo(
  function ModernBrewingRecordContent({
    note,
    noteImages,
    imageSlotCount,
    grindSize,
    noteImageError,
    onNoteImageClick,
    onNoteImageError,
  }: ModernBrewingRecordContentProps) {
    const hasNotes = Boolean(note.notes?.trim());

    return (
      <div className="flex gap-3.5">
        <div className="min-w-0 flex-1 space-y-1.5">
          {hasNotes && (
            <div className="text-xs font-medium tracking-wide whitespace-pre-line text-neutral-600 dark:text-neutral-400">
              {note.notes}
            </div>
          )}

          <RelatedNoteImageGallery
            noteId={note.id}
            noteImages={noteImages}
            imageSlotCount={imageSlotCount}
            noteImageError={noteImageError}
            onImageClick={onNoteImageClick}
            onImageError={onNoteImageError}
          />

          <div className="mt-2 text-xs leading-tight font-medium text-neutral-500/60 dark:text-neutral-500/60">
            {formatDate(note.timestamp)}
            {grindSize && (
              <>
                {' · '}
                {grindSize}
              </>
            )}
            {note.rating > 0 && (
              <>
                {' · '}
                {note.rating}
                /5分
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
);

export const BrewingRecordItem: React.FC<{
  note: BrewingNote;
  bean: CoffeeBean | null;
  allBeans: CoffeeBean[];
  equipmentNames: Record<string, string>;
  getValidTasteRatings: (taste: BrewingNote['taste']) => TasteRating[];
  noteImageErrors: Record<string, boolean>;
  setNoteImageErrors: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  useClassicNotesListStyle: boolean;
  onOpenNoteDetail?: OpenRelatedNoteDetailHandler;
}> = React.memo(
  ({
    note,
    bean,
    allBeans,
    equipmentNames,
    getValidTasteRatings,
    noteImageErrors,
    setNoteImageErrors,
    useClassicNotesListStyle,
    onOpenNoteDetail,
  }) => {
    const validTasteRatings = getValidTasteRatings(note.taste);
    const inlineNoteImages = useMemo(() => {
      if (note.images && note.images.length > 0) return note.images;
      if (note.image) return [note.image];
      return [];
    }, [note.images, note.image]);
    const { ref: imageLoadRef, images: noteImages } =
      useBrewingNoteImagesWhenVisible(note.id, inlineNoteImages);
    const noteImage = noteImages[0];
    const imageSlotCount = noteImages.length;
    const noteImageError = Boolean(noteImageErrors[note.id]);
    const noteBean =
      (note.beanId
        ? allBeans.find(candidate => candidate.id === note.beanId) || null
        : null) || bean;
    const equipmentName = resolveNoteEquipmentName(note, equipmentNames);
    const beanUnitPrice = getBeanUnitPrice(noteBean);
    const normalizedParams = useMemo(
      () => normalizeBrewingNoteParams(note.params),
      [note.params]
    );

    const titleParts = useMemo(
      () => [equipmentName, resolveNoteMethodName(note)].filter(isVisibleText),
      [equipmentName, note.method, note.methodName]
    );
    const isEspresso = useMemo(
      () =>
        Boolean(
          note.equipment &&
          (note.equipment.toLowerCase().includes('espresso') ||
            note.equipment.includes('意式'))
        ),
      [note.equipment]
    );
    const paramParts = useMemo(() => {
      if (!normalizedParams) {
        return [];
      }

      if (isEspresso) {
        return getNoteEspressoParamParts(note);
      }

      const textureText = [normalizedParams.grindSize, normalizedParams.temp]
        .filter(isVisibleText)
        .join(' · ');

      return [
        normalizedParams.coffee,
        normalizedParams.ratio,
        textureText,
      ].filter(isVisibleText);
    }, [isEspresso, normalizedParams, note]);
    const footerGrindSize = isEspresso ? normalizedParams?.grindSize : '';

    const handleNoteImageError = React.useCallback(() => {
      setNoteImageErrors(prev => ({
        ...prev,
        [note.id]: true,
      }));
    }, [note.id, setNoteImageErrors]);

    const handleClassicNoteImageClick = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (noteImage && !noteImageError) {
          openImageViewer({
            url: noteImage,
            alt: '笔记图片 1',
            items: noteImages.map((url, itemIndex) => ({
              url,
              alt: `笔记图片 ${itemIndex + 1}`,
            })),
            index: 0,
            sourceElement: event.currentTarget,
            sourceElements: [event.currentTarget],
          });
        }
      },
      [noteImage, noteImageError, noteImages]
    );

    const handleModernNoteImageClick = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();

        if (noteImageError) {
          return;
        }

        const imageIndex = event.currentTarget.dataset.imageIndex;
        if (!imageIndex) {
          return;
        }

        const index = Number(imageIndex);
        if (!Number.isInteger(index)) {
          return;
        }

        const imageUrl = noteImages[index];
        if (!imageUrl) {
          return;
        }

        const galleryElement = event.currentTarget.closest(
          '[data-related-note-images]'
        );
        const sourceElements = galleryElement
          ? Array.from(
              galleryElement.querySelectorAll<HTMLElement>('[data-image-index]')
            )
          : [event.currentTarget];

        openImageViewer({
          url: imageUrl,
          alt: `笔记图片 ${index + 1}`,
          items: noteImages.map((url, itemIndex) => ({
            url,
            alt: `笔记图片 ${itemIndex + 1}`,
          })),
          index,
          sourceElement: event.currentTarget,
          sourceElements,
        });
      },
      [noteImageError, noteImages]
    );

    const content = useClassicNotesListStyle ? (
      <ClassicBrewingRecordContent
        note={note}
        bean={bean}
        titleParts={titleParts}
        paramParts={paramParts}
        validTasteRatings={validTasteRatings}
        noteImage={noteImage}
        noteImageError={noteImageError}
        onNoteImageClick={handleClassicNoteImageClick}
        onNoteImageError={handleNoteImageError}
      />
    ) : (
      <ModernBrewingRecordContent
        note={note}
        noteImages={noteImages}
        imageSlotCount={imageSlotCount}
        grindSize={footerGrindSize}
        noteImageError={noteImageError}
        onNoteImageClick={handleModernNoteImageClick}
        onNoteImageError={handleNoteImageError}
      />
    );

    const handleOpenNoteDetail = React.useCallback(() => {
      onOpenNoteDetail?.({
        note,
        equipmentName,
        beanUnitPrice,
        beanInfo: noteBean,
      });
    }, [beanUnitPrice, equipmentName, note, noteBean, onOpenNoteDetail]);
    if (!onOpenNoteDetail) {
      return (
        <div ref={imageLoadRef} className="block w-full space-y-3 text-left">
          {content}
        </div>
      );
    }

    return (
      <div
        ref={imageLoadRef}
        className="relative block w-full space-y-3 text-left"
      >
        <button
          type="button"
          aria-label="查看冲煮记录详情"
          className="absolute inset-0 z-0 cursor-pointer appearance-none rounded bg-transparent p-0"
          onClick={handleOpenNoteDetail}
        />
        <div className="pointer-events-none relative z-10">{content}</div>
      </div>
    );
  }
);

BrewingRecordItem.displayName = 'BrewingRecordItem';

export const RelatedRecordCard: React.FC<{
  note: BrewingNote;
  bean: CoffeeBean | null;
  allBeans: CoffeeBean[];
  equipmentNames: Record<string, string>;
  getValidTasteRatings: (taste: BrewingNote['taste']) => TasteRating[];
  noteImageErrors: Record<string, boolean>;
  setNoteImageErrors: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  useClassicNotesListStyle: boolean;
  roasterSettings: RoasterSettings;
  onOpenNoteDetail?: OpenRelatedNoteDetailHandler;
  onEditNote?: (note: BrewingNote) => void;
}> = React.memo(
  ({
    note,
    bean,
    allBeans,
    equipmentNames,
    getValidTasteRatings,
    noteImageErrors,
    setNoteImageErrors,
    useClassicNotesListStyle,
    roasterSettings,
    onOpenNoteDetail,
    onEditNote,
  }) => {
    const isChangeRecord = isSimpleChangeRecord(note);
    const isRoasting = isRoastingRecord(note);
    const canEditRecord = !!onEditNote && !isRoasting;
    const shouldOpenNoteDetail =
      !isChangeRecord && !isRoasting && !!onOpenNoteDetail;
    const shouldEditRecord =
      canEditRecord && (isChangeRecord || !shouldOpenNoteDetail);
    const isClickableBrewingRecord = shouldOpenNoteDetail || shouldEditRecord;

    const handleEditRecord = React.useCallback(() => {
      onEditNote?.(note);
    }, [note, onEditNote]);

    const content = isChangeRecord ? (
      <ChangeRecordItem note={note} />
    ) : isRoasting ? (
      <RoastingRecordItem
        note={note}
        allBeans={allBeans}
        roasterSettings={roasterSettings}
      />
    ) : (
      <BrewingRecordItem
        note={note}
        bean={bean}
        allBeans={allBeans}
        equipmentNames={equipmentNames}
        getValidTasteRatings={getValidTasteRatings}
        noteImageErrors={noteImageErrors}
        setNoteImageErrors={setNoteImageErrors}
        useClassicNotesListStyle={useClassicNotesListStyle}
        onOpenNoteDetail={shouldOpenNoteDetail ? onOpenNoteDetail : undefined}
      />
    );

    if (shouldEditRecord) {
      return (
        <button
          type="button"
          onClick={handleEditRecord}
          className="block w-full cursor-pointer rounded bg-neutral-100 p-1.5 text-left dark:bg-neutral-800/40"
        >
          {content}
        </button>
      );
    }

    return (
      <div
        className={`rounded bg-neutral-100 p-1.5 dark:bg-neutral-800/40 ${
          isClickableBrewingRecord ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        {content}
      </div>
    );
  }
);

RelatedRecordCard.displayName = 'RelatedRecordCard';
