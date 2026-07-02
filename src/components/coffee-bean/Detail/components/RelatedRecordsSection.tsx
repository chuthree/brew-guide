'use client';

import React, { useCallback, useMemo, useState } from 'react';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import { useFlavorDimensions } from '@/lib/hooks/useFlavorDimensions';
import { isSimpleChangeRecord, isRoastingRecord } from '../types';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import type { RoasterSettings } from '@/lib/utils/beanVarietyUtils';
import { RelatedRecordCard, SourceGreenBeanItem } from './RelatedRecordItems';

interface RelatedRecordsSectionProps {
  relatedNotes: BrewingNote[];
  relatedBeans: CoffeeBean[];
  equipmentNames: Record<string, string>;
  isGreenBean: boolean;
  allBeans: CoffeeBean[];
  bean: CoffeeBean | null;
  showChangeRecords: boolean;
  showGreenBeanRecords: boolean;
  relatedNotesLoading?: boolean;
  setShowChangeRecords: (show: boolean) => void;
  setShowGreenBeanRecords: (show: boolean) => void;
  onImageClick?: (
    imageUrl: string,
    backImageUrl?: string,
    sourceElement?: HTMLElement | null
  ) => void;
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
    relatedNotesLoading = false,
    setShowChangeRecords,
    setShowGreenBeanRecords,
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
    const useClassicNotesListStyle = useSettingsStore(
      state => state.settings.useClassicNotesListStyle ?? false
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
    const hasPrimaryRecords = primaryRecords.length > 0;
    const hasSecondaryRecords = secondaryRecords.length > 0;
    const showTabs =
      isGreenBean ||
      !hasPrimaryRecords ||
      hasSecondaryRecords ||
      hasSourceGreenBean;
    const activeTab =
      showGreenBeanRecords && hasSourceGreenBean
        ? 'green'
        : showChangeRecords && hasSecondaryRecords
          ? 'change'
          : hasPrimaryRecords
            ? 'primary'
            : hasSecondaryRecords
              ? 'change'
              : 'green';

    const showPrimaryRecordTab = useCallback(() => {
      setShowChangeRecords(false);
      setShowGreenBeanRecords(false);
    }, [setShowChangeRecords, setShowGreenBeanRecords]);

    const showChangeRecordTab = useCallback(() => {
      setShowChangeRecords(true);
      setShowGreenBeanRecords(false);
    }, [setShowChangeRecords, setShowGreenBeanRecords]);

    const showGreenBeanRecordTab = useCallback(() => {
      setShowChangeRecords(false);
      setShowGreenBeanRecords(true);
    }, [setShowChangeRecords, setShowGreenBeanRecords]);

    // 如果都没有记录，不显示
    if (
      relatedNotesLoading ||
      (!hasPrimaryRecords && !hasSecondaryRecords && !hasSourceGreenBean)
    ) {
      return null;
    }

    const primaryLabel = isGreenBean ? '烘焙记录' : '冲煮记录';
    const secondaryLabel = '变动记录';
    const greenBeanLabel = '生豆记录';

    return (
      <div className="border-t border-neutral-200/40 pt-3 dark:border-neutral-800/40">
        {/* Tab切换按钮 */}
        {showTabs && (
          <div className="flex items-center gap-2">
            {hasPrimaryRecords && (
              <button
                type="button"
                onClick={showPrimaryRecordTab}
                className={`text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 ${
                  activeTab === 'primary' ? 'opacity-100' : 'opacity-50'
                }`}
              >
                {primaryLabel} ({primaryRecords.length})
              </button>
            )}
            {hasSecondaryRecords && (
              <button
                type="button"
                onClick={showChangeRecordTab}
                className={`text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 ${
                  activeTab === 'change' ? 'opacity-100' : 'opacity-50'
                }`}
              >
                {secondaryLabel} ({secondaryRecords.length})
              </button>
            )}
            {hasSourceGreenBean && (
              <button
                type="button"
                onClick={showGreenBeanRecordTab}
                className={`text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 ${
                  activeTab === 'green' ? 'opacity-100' : 'opacity-50'
                }`}
              >
                {greenBeanLabel} ({relatedBeans.length})
              </button>
            )}
          </div>
        )}

        {/* 记录列表 */}
        <div className={showTabs ? 'mt-3 space-y-2' : 'space-y-2'}>
          {/* 生豆记录 */}
          {activeTab === 'green' &&
            hasSourceGreenBean &&
            relatedBeans.map(relatedBean => (
              <div
                key={`source-${relatedBean.id}`}
                className="rounded bg-neutral-100 p-1.5 dark:bg-neutral-800/40"
              >
                <SourceGreenBeanItem
                  bean={relatedBean}
                  roasterSettings={roasterSettings}
                />
              </div>
            ))}

          {/* 冲煮记录或变动记录 */}
          {activeTab !== 'green' &&
            (activeTab === 'change' ? secondaryRecords : primaryRecords).map(
              note => (
                <RelatedRecordCard
                  key={note.id}
                  note={note}
                  bean={bean}
                  allBeans={allBeans}
                  equipmentNames={equipmentNames}
                  getValidTasteRatings={getValidTasteRatings}
                  noteImageErrors={noteImageErrors}
                  setNoteImageErrors={setNoteImageErrors}
                  useClassicNotesListStyle={useClassicNotesListStyle}
                  roasterSettings={roasterSettings}
                  onOpenNoteDetail={onOpenNoteDetail}
                  onEditNote={onEditNote}
                />
              )
            )}
        </div>
      </div>
    );
  }
);

RelatedRecordsSection.displayName = 'RelatedRecordsSection';

export default RelatedRecordsSection;
