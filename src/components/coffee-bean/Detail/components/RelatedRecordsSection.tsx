'use client';

import React, {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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

type RelatedRecordTab = 'primary' | 'change' | 'green';

interface RelatedRecordTabPage {
  key: RelatedRecordTab;
  label: string;
  count: number;
  onSelect: () => void;
}

const getPageOffsetX = (pageIndex: number, activePageIndex: number) => {
  if (pageIndex < activePageIndex) {
    return 'calc(var(--page-slide-distance) * -1)';
  }
  if (pageIndex > activePageIndex) {
    return 'var(--page-slide-distance)';
  }
  return '0px';
};

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
    const sectionId = useId();
    const { getValidTasteRatings } = useFlavorDimensions();
    const [noteImageErrors, setNoteImageErrors] = useState<
      Record<string, boolean>
    >({});
    const pageRefs = useRef<
      Partial<Record<RelatedRecordTab, HTMLDivElement | null>>
    >({});
    const [slideHeight, setSlideHeight] = useState<number | null>(null);

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
      !hasPrimaryRecords || hasSecondaryRecords || hasSourceGreenBean;
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

    const primaryLabel = isGreenBean ? '烘焙记录' : '冲煮记录';
    const secondaryLabel = '变动记录';
    const greenBeanLabel = '生豆记录';

    const recordTabs = useMemo<RelatedRecordTabPage[]>(() => {
      const tabs: RelatedRecordTabPage[] = [];

      if (hasPrimaryRecords) {
        tabs.push({
          key: 'primary',
          label: primaryLabel,
          count: primaryRecords.length,
          onSelect: showPrimaryRecordTab,
        });
      }

      if (hasSecondaryRecords) {
        tabs.push({
          key: 'change',
          label: secondaryLabel,
          count: secondaryRecords.length,
          onSelect: showChangeRecordTab,
        });
      }

      if (hasSourceGreenBean) {
        tabs.push({
          key: 'green',
          label: greenBeanLabel,
          count: relatedBeans.length,
          onSelect: showGreenBeanRecordTab,
        });
      }

      return tabs;
    }, [
      hasPrimaryRecords,
      hasSecondaryRecords,
      hasSourceGreenBean,
      primaryLabel,
      primaryRecords.length,
      relatedBeans.length,
      secondaryRecords.length,
      showChangeRecordTab,
      showGreenBeanRecordTab,
      showPrimaryRecordTab,
    ]);

    const activePageIndex = Math.max(
      recordTabs.findIndex(tab => tab.key === activeTab),
      0
    );
    const activePageId = String(activePageIndex + 1);

    const setPageRef = useCallback(
      (tab: RelatedRecordTab, node: HTMLDivElement | null) => {
        pageRefs.current[tab] = node;
      },
      []
    );

    const updateSlideHeight = useCallback(() => {
      const activeNode = pageRefs.current[activeTab];
      if (!activeNode) return;

      const nextHeight = activeNode.offsetHeight;
      setSlideHeight(currentHeight =>
        currentHeight === nextHeight ? currentHeight : nextHeight
      );
    }, [activeTab]);

    useLayoutEffect(() => {
      const activeNode = pageRefs.current[activeTab];
      if (!activeNode) return;

      updateSlideHeight();

      if (typeof ResizeObserver === 'undefined') {
        return undefined;
      }

      const observer = new ResizeObserver(updateSlideHeight);
      observer.observe(activeNode);

      return () => observer.disconnect();
    }, [activeTab, updateSlideHeight]);

    // 如果都没有记录，不显示
    if (
      relatedNotesLoading ||
      (!hasPrimaryRecords && !hasSecondaryRecords && !hasSourceGreenBean)
    ) {
      return null;
    }

    return (
      <div className="border-t border-neutral-200/40 pt-3 dark:border-neutral-800/40">
        {/* Tab切换按钮 */}
        {showTabs && (
          <div
            className="flex items-center gap-2"
            role="tablist"
            aria-label="关联记录分类"
          >
            {recordTabs.map(tab => (
              <button
                key={tab.key}
                id={`${sectionId}-tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                aria-controls={`${sectionId}-panel-${tab.key}`}
                onClick={tab.onSelect}
                className={`text-xs font-medium text-neutral-500 tabular-nums transition-[color,opacity] duration-200 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 ${
                  activeTab === tab.key ? 'opacity-100' : 'opacity-50'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        )}

        {/* 记录列表 */}
        <div
          className={`t-page-slide ${showTabs ? 'mt-3' : ''}`}
          data-page={activePageId}
          data-measured={slideHeight === null ? 'false' : 'true'}
          style={{
            height: slideHeight === null ? undefined : `${slideHeight}px`,
          }}
        >
          {recordTabs.map((tab, index) => {
            const isActive = tab.key === activeTab;
            const records =
              tab.key === 'change' ? secondaryRecords : primaryRecords;

            return (
              <div
                key={tab.key}
                id={`${sectionId}-panel-${tab.key}`}
                className="t-page"
                role={showTabs ? 'tabpanel' : undefined}
                aria-labelledby={
                  showTabs ? `${sectionId}-tab-${tab.key}` : undefined
                }
                aria-hidden={!isActive}
                data-active-page={isActive ? 'true' : undefined}
                data-page-id={String(index + 1)}
                style={
                  {
                    '--t-page-from-x': getPageOffsetX(index, activePageIndex),
                  } as React.CSSProperties
                }
              >
                <div
                  ref={node => setPageRef(tab.key, node)}
                  className="space-y-2"
                >
                  {tab.key === 'green'
                    ? relatedBeans.map(relatedBean => (
                        <div
                          key={`source-${relatedBean.id}`}
                          className="rounded bg-neutral-100 p-1.5 dark:bg-neutral-800/40"
                        >
                          <SourceGreenBeanItem
                            bean={relatedBean}
                            roasterSettings={roasterSettings}
                          />
                        </div>
                      ))
                    : records.map(note => (
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
                      ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

RelatedRecordsSection.displayName = 'RelatedRecordsSection';

export default RelatedRecordsSection;
