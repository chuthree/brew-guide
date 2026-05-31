'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { CoffeeBean } from '@/types/app';
import { BrewingNote } from '@/lib/core/config';
import { useFlavorDimensions } from '@/lib/hooks/useFlavorDimensions';
import { formatDateAbsolute, formatRating } from '@/components/notes/utils';
import { BeanImageSmall } from './BeanImageSection';
import { formatNumber } from '../utils';
import { isSimpleChangeRecord, isRoastingRecord } from '../types';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import {
  formatBeanDisplayName,
  type RoasterSettings,
} from '@/lib/utils/beanVarietyUtils';
import { getBeanUnitPrice } from '@/lib/notes/noteDisplay';

interface RelatedRecordsSectionProps {
  relatedNotes: BrewingNote[];
  relatedBeans: CoffeeBean[];
  equipmentNames: Record<string, string>;
  isGreenBean: boolean;
  allBeans: CoffeeBean[];
  bean: CoffeeBean | null;
  showChangeRecords: boolean;
  showGreenBeanRecords: boolean;
  setShowChangeRecords: (show: boolean) => void;
  setShowGreenBeanRecords: (show: boolean) => void;
  onImageClick: (imageUrl: string, backImageUrl?: string) => void;
  onOpenNoteDetail?: (detail: {
    note: BrewingNote;
    equipmentName: string;
    beanUnitPrice: number;
    beanInfo?: CoffeeBean | null;
  }) => void;
  onEditNote?: (note: BrewingNote) => void;
}

const RelatedRecordsSection: React.FC<RelatedRecordsSectionProps> = React.memo(
  ({
    relatedNotes,
    relatedBeans,
    equipmentNames,
    isGreenBean,
    allBeans,
    bean,
    showChangeRecords,
    showGreenBeanRecords,
    setShowChangeRecords,
    setShowGreenBeanRecords,
    onImageClick,
    onOpenNoteDetail,
    onEditNote,
  }) => {
    const { getValidTasteRatings } = useFlavorDimensions();
    const [noteImageErrors, setNoteImageErrors] = useState<
      Record<string, boolean>
    >({});

    // 获取设置：是否显示容量调整记录
    const showCapacityAdjustmentRecords = useSettingsStore(
      state => state.settings.showCapacityAdjustmentRecords ?? true
    );

    // 获取烘焙商字段设置（只在主组件获取一次，通过 props 传递给子组件）
    const roasterFieldEnabled = useSettingsStore(
      state => state.settings.roasterFieldEnabled
    );
    const roasterSeparator = useSettingsStore(
      state => state.settings.roasterSeparator
    );
    const roasterSettings = useMemo<RoasterSettings>(
      () => ({
        roasterFieldEnabled,
        roasterSeparator,
      }),
      [roasterFieldEnabled, roasterSeparator]
    );

    // 过滤后的笔记（根据设置过滤容量调整记录）
    const filteredNotes = useMemo(() => {
      if (showCapacityAdjustmentRecords) {
        return relatedNotes;
      }
      return relatedNotes.filter(note => note.source !== 'capacity-adjustment');
    }, [relatedNotes, showCapacityAdjustmentRecords]);

    // 分类记录（使用 useMemo 缓存）
    const { roastingRecords, brewingRecords, changeRecords } = useMemo(() => {
      const roasting = filteredNotes.filter(note => isRoastingRecord(note));
      const brewing = filteredNotes.filter(
        note => !isSimpleChangeRecord(note) && !isRoastingRecord(note)
      );
      const change = filteredNotes.filter(note => isSimpleChangeRecord(note));

      return {
        roastingRecords: roasting,
        brewingRecords: brewing,
        changeRecords: change,
      };
    }, [filteredNotes]);

    const primaryRecords = isGreenBean ? roastingRecords : brewingRecords;
    const secondaryRecords = changeRecords;
    const hasSourceGreenBean = !isGreenBean && relatedBeans.length > 0;

    // 如果都没有记录，不显示
    if (
      primaryRecords.length === 0 &&
      secondaryRecords.length === 0 &&
      !hasSourceGreenBean
    ) {
      return null;
    }

    const primaryLabel = isGreenBean ? '烘焙记录' : '冲煮记录';
    const secondaryLabel = '变动记录';
    const greenBeanLabel = '生豆记录';

    return (
      <div className="border-t border-neutral-200/40 pt-3 dark:border-neutral-800/40">
        {/* Tab切换按钮 */}
        <div className="flex items-center gap-2">
          {primaryRecords.length > 0 && (
            <button
              onClick={() => {
                setShowChangeRecords(false);
                setShowGreenBeanRecords(false);
              }}
              className={`text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 ${
                !showChangeRecords && !showGreenBeanRecords
                  ? 'opacity-100'
                  : 'opacity-50'
              }`}
            >
              {primaryLabel} ({primaryRecords.length})
            </button>
          )}
          {secondaryRecords.length > 0 && (
            <button
              onClick={() => {
                setShowChangeRecords(true);
                setShowGreenBeanRecords(false);
              }}
              className={`text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 ${
                showChangeRecords ? 'opacity-100' : 'opacity-50'
              }`}
            >
              {secondaryLabel} ({secondaryRecords.length})
            </button>
          )}
          {hasSourceGreenBean && (
            <button
              onClick={() => {
                setShowChangeRecords(false);
                setShowGreenBeanRecords(true);
              }}
              className={`text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 ${
                showGreenBeanRecords ? 'opacity-100' : 'opacity-50'
              }`}
            >
              {greenBeanLabel} ({relatedBeans.length})
            </button>
          )}
        </div>

        {/* 记录列表 */}
        <div className="mt-3 space-y-2">
          {/* 生豆记录 */}
          {showGreenBeanRecords &&
            hasSourceGreenBean &&
            relatedBeans.map(relatedBean => (
              <div
                key={`source-${relatedBean.id}`}
                className="rounded bg-neutral-100 p-1.5 dark:bg-neutral-800/40"
              >
                <div className="flex items-center gap-3">
                  <BeanImageSmall bean={relatedBean} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-neutral-800 dark:text-neutral-100">
                      {formatBeanDisplayName(relatedBean, roasterSettings)}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      <span>{relatedBean.purchaseDate || '-'}</span>
                      {(relatedBean.remaining || relatedBean.capacity) && (
                        <>
                          <span>·</span>
                          <span>
                            {formatNumber(relatedBean.remaining)}/
                            {formatNumber(relatedBean.capacity)}g
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

          {/* 冲煮记录或变动记录 */}
          {!showGreenBeanRecords &&
            (showChangeRecords ? secondaryRecords : primaryRecords).map(
              note => {
                const isChangeRecord = isSimpleChangeRecord(note);
                const isRoasting = isRoastingRecord(note);
                const isEditableRecord = !!onEditNote && !isRoasting;
                const isClickableBrewingRecord =
                  !isChangeRecord &&
                  !isRoasting &&
                  (!!onOpenNoteDetail || isEditableRecord);
                const content = (
                  <>
                    {isChangeRecord ? (
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
                        onImageClick={onImageClick}
                        onOpenNoteDetail={
                          isEditableRecord ? undefined : onOpenNoteDetail
                        }
                      />
                    )}
                  </>
                );

                if (isEditableRecord) {
                  return (
                    <button
                      type="button"
                      key={note.id}
                      onClick={() => onEditNote?.(note)}
                      className="block w-full cursor-pointer rounded bg-neutral-100 p-1.5 text-left dark:bg-neutral-800/40"
                    >
                      {content}
                    </button>
                  );
                }

                return (
                  <div
                    key={note.id}
                    className={`rounded bg-neutral-100 p-1.5 dark:bg-neutral-800/40 ${
                      isClickableBrewingRecord
                        ? 'cursor-pointer'
                        : 'cursor-default'
                    }`}
                  >
                    {content}
                  </div>
                );
              }
            )}
        </div>
      </div>
    );
  }
);

RelatedRecordsSection.displayName = 'RelatedRecordsSection';

// 变动记录项
const ChangeRecordItem: React.FC<{ note: BrewingNote }> = React.memo(
  ({ note }) => {
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
        {note.notes && (
          <div
            className="min-w-0 flex-1 truncate text-xs text-neutral-600 dark:text-neutral-300"
            title={note.notes}
          >
            {note.notes}
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
  }
);

ChangeRecordItem.displayName = 'ChangeRecordItem';

// 烘焙记录项
const RoastingRecordItem: React.FC<{
  note: BrewingNote;
  allBeans: CoffeeBean[];
  roasterSettings: RoasterSettings;
}> = React.memo(({ note, allBeans, roasterSettings }) => {
  const roastedBeanId = note.changeRecord?.roastingRecord?.roastedBeanId;
  const roastedBean = roastedBeanId
    ? allBeans.find(b => b.id === roastedBeanId)
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

  // 未找到关联熟豆
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

// 冲煮记录项
const BrewingRecordItem: React.FC<{
  note: BrewingNote;
  bean: CoffeeBean | null;
  allBeans: CoffeeBean[];
  equipmentNames: Record<string, string>;
  getValidTasteRatings: (taste: BrewingNote['taste']) => Array<{
    id: string;
    label: string;
    value: number;
  }>;
  noteImageErrors: Record<string, boolean>;
  setNoteImageErrors: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  onImageClick: (imageUrl: string, backImageUrl?: string) => void;
  onOpenNoteDetail?: (detail: {
    note: BrewingNote;
    equipmentName: string;
    beanUnitPrice: number;
    beanInfo?: CoffeeBean | null;
  }) => void;
}> = React.memo(
  ({
    note,
    bean,
    allBeans,
    equipmentNames,
    getValidTasteRatings,
    noteImageErrors,
    setNoteImageErrors,
    onImageClick,
    onOpenNoteDetail,
  }) => {
    const validTasteRatings = getValidTasteRatings(note.taste);
    const hasTasteRatings = validTasteRatings.length > 0;
    const noteBean =
      (note.beanId
        ? allBeans.find(candidate => candidate.id === note.beanId) || null
        : null) || bean;
    const equipmentName = note.equipment
      ? equipmentNames[note.equipment] || note.equipment
      : '';
    const beanUnitPrice = getBeanUnitPrice(noteBean);

    const titleParts = [
      equipmentName || '未知器具',
      note.method?.trim() || '',
    ].filter(Boolean);

    const content = (
      <>
        {/* 图片和标题参数区域 */}
        <div className="flex gap-3">
          {/* 笔记图片 */}
          {note.image && (
            <div
              className="relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded border border-neutral-200/50 bg-neutral-100 dark:border-neutral-700/40 dark:bg-neutral-800/20"
              onClick={e => {
                e.stopPropagation();
                if (!noteImageErrors[note.id] && note.image) {
                  onImageClick(note.image, undefined);
                }
              }}
            >
              {noteImageErrors[note.id] ? (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500 dark:text-neutral-400">
                  加载失败
                </div>
              ) : (
                <Image
                  src={note.image}
                  alt={bean?.name || '笔记图片'}
                  height={48}
                  width={48}
                  unoptimized
                  style={{ width: '100%', height: '100%' }}
                  className="object-cover"
                  sizes="48px"
                  priority={false}
                  loading="lazy"
                  onError={() =>
                    setNoteImageErrors(prev => ({
                      ...prev,
                      [note.id]: true,
                    }))
                  }
                />
              )}
            </div>
          )}

          {/* 名称和标签区域 */}
          <div className="min-w-0 flex-1">
            <div className="space-y-1.5">
              {/* 标题行 */}
              <div className="text-xs font-medium wrap-break-word text-neutral-800 dark:text-neutral-100">
                {titleParts.map((part, index) => (
                  <React.Fragment key={`${part}-${index}`}>
                    {index > 0 && <span className="mx-1">·</span>}
                    <span>{part}</span>
                  </React.Fragment>
                ))}
              </div>

              {/* 参数信息 */}
              {note.params &&
                (() => {
                  // 判断是否为意式咖啡笔记
                  const isEspresso =
                    note.equipment &&
                    (note.equipment.toLowerCase().includes('espresso') ||
                      note.equipment.includes('意式'));

                  return (
                    <div className="mt-1.5 space-x-1 text-xs leading-relaxed font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                      {isEspresso ? (
                        // 意式参数：粉量 · 研磨度 · 时间 · 液重
                        <>
                          <span>{note.params.coffee}</span>
                          <span className="shrink-0">·</span>
                          <span>{note.params.grindSize || '-'}</span>
                          {(note.totalTime || 0) > 0 && (
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
                          <span>{note.params.coffee}</span>
                          <span>·</span>
                          <span>{note.params.ratio}</span>
                          {(note.params.grindSize || note.params.temp) && (
                            <>
                              <span>·</span>
                              <span>
                                {[note.params.grindSize, note.params.temp]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}
            </div>
          </div>
        </div>

        {/* 风味评分 */}
        {hasTasteRatings && (
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

        {/* 时间和评分 */}
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

        {/* 备注信息 */}
        {note.notes && note.notes.trim() && (
          <div className="rounded bg-neutral-200/30 px-1.5 py-1 text-xs font-medium tracking-wide whitespace-pre-line text-neutral-800/70 dark:bg-neutral-800/40 dark:text-neutral-400/85">
            {note.notes}
          </div>
        )}
      </>
    );

    if (!onOpenNoteDetail) {
      return <div className="block w-full space-y-3 text-left">{content}</div>;
    }

    return (
      <button
        type="button"
        className="block w-full cursor-pointer space-y-3 text-left"
        onClick={() =>
          onOpenNoteDetail({
            note,
            equipmentName,
            beanUnitPrice,
            beanInfo: noteBean,
          })
        }
      >
        {content}
      </button>
    );
  }
);

BrewingRecordItem.displayName = 'BrewingRecordItem';

export default RelatedRecordsSection;
