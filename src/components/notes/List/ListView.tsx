'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { BrewingNote } from '@/lib/core/config';
import type { CoffeeBean } from '@/types/app';
import NoteItem from './NoteItem';
import NoteItemStandard from './NoteItemStandard';
import ChangeRecordNoteItem from './ChangeRecordNoteItem';
import GalleryView from './GalleryView';
import DateImageFlowView from './DateImageFlowView';
import { useFlavorDimensions } from '@/lib/hooks/useFlavorDimensions';
import { SettingsOptions } from '@/components/settings/Settings';
import type { NotesViewMode } from '../types';
import type { NotesTableColumnKey } from './tableColumns';
import {
  buildCoffeeBeanLookup,
  getBeanUnitPrice,
  resolveNoteBean,
  resolveNoteEquipmentName,
} from '@/lib/notes/noteDisplay';
import TableView from './TableView';
import { isChangeRecordNote, shouldHideNoteInList } from './noteListModel';

const EMPTY_NOTES: BrewingNote[] = [];
const EMPTY_SELECTED_NOTES: string[] = [];
const EMPTY_EQUIPMENT_NAMES: Record<string, string> = {};
const EMPTY_COFFEE_BEANS: CoffeeBean[] = [];
const EMPTY_TABLE_COLUMNS: NotesTableColumnKey[] = [];
const NOTES_VIRTUOSO_OVERSCAN = 200;
const NOTES_VIRTUOSO_INCREASE_VIEWPORT_BY = { top: 200, bottom: 200 };

type VirtuosoListProps = React.HTMLAttributes<HTMLDivElement> & {
  ref?: React.Ref<HTMLDivElement>;
};

interface NotesVirtuosoContext {
  changeRecordNotes: BrewingNote[];
  showQuickDecrementNotes: boolean;
  onToggleShowQuickDecrementNotes: () => void;
  renderChangeRecordNote: (note: BrewingNote) => React.ReactNode;
}

const NotesVirtuosoList = ({
  style,
  children,
  ref,
  ...props
}: VirtuosoListProps) => (
  <div ref={ref} style={style} {...props}>
    {children}
  </div>
);

const NotesVirtuosoFooter = ({
  context,
}: {
  context?: NotesVirtuosoContext;
}) => {
  if (!context) return <div className="mt-2" />;

  const {
    changeRecordNotes,
    showQuickDecrementNotes,
    onToggleShowQuickDecrementNotes,
    renderChangeRecordNote,
  } = context;

  return (
    <div className="mt-2">
      {changeRecordNotes.length > 0 && (
        <>
          <button
            type="button"
            className="relative mb-2 flex w-full cursor-pointer items-center border-0 bg-transparent p-0"
            onClick={onToggleShowQuickDecrementNotes}
            aria-expanded={showQuickDecrementNotes}
          >
            <div className="grow border-t border-neutral-200/50 dark:border-neutral-800/50"></div>
            <span className="mx-3 flex items-center justify-center rounded-sm px-2 py-0.5 text-xs font-medium tracking-wide text-neutral-600 transition-colors dark:text-neutral-400">
              {changeRecordNotes.length}条变动记录
              <svg
                className={`ml-1 h-3 w-3 transition-transform duration-200 ${showQuickDecrementNotes ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6 9L12 15L18 9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div className="grow border-t border-neutral-200/50 dark:border-neutral-800/50"></div>
          </button>
          {showQuickDecrementNotes && (
            <div className="opacity-80">
              {changeRecordNotes.map(renderChangeRecordNote)}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const NOTES_VIRTUOSO_COMPONENTS = {
  List: NotesVirtuosoList,
  Footer: NotesVirtuosoFooter,
};
const getNoteVirtuosoItemKey = (_index: number, note: BrewingNote) => note.id;

// 定义组件属性接口
interface NotesListViewProps {
  selectedEquipment: string | null;
  filterMode: 'equipment' | 'date';
  onNoteClick: (note: BrewingNote) => void;
  onDeleteNote: (noteId: string) => Promise<void>;
  isShareMode?: boolean;
  selectedNotes?: string[];
  onToggleSelect?: (noteId: string, enterShareMode?: boolean) => void;
  searchQuery?: string;
  isSearching?: boolean;
  emptyStateMessage?: string | null;
  emptyRecordLabel?: string;
  preFilteredNotes?: BrewingNote[];
  viewMode?: NotesViewMode;
  isDateImageFlowMode?: boolean;
  // 外部滚动容器（Virtuoso 使用）
  scrollParentRef?: HTMLElement;
  // 设备名称映射
  equipmentNames?: Record<string, string>;
  // 咖啡豆列表
  coffeeBeans?: CoffeeBean[];
  // 设置
  settings?: SettingsOptions;
  tableVisibleColumns?: NotesTableColumnKey[];
  activeNoteId?: string | null;
  noteImageCounts?: Map<string, number>;
}

const NotesListView: React.FC<NotesListViewProps> = ({
  selectedEquipment,
  filterMode,
  onNoteClick,
  onDeleteNote,
  isShareMode = false,
  selectedNotes = EMPTY_SELECTED_NOTES,
  onToggleSelect,
  searchQuery = '',
  isSearching = false,
  emptyStateMessage,
  emptyRecordLabel = '冲煮记录',
  preFilteredNotes,
  viewMode = 'list',
  isDateImageFlowMode = false,
  scrollParentRef,
  equipmentNames = EMPTY_EQUIPMENT_NAMES,
  coffeeBeans = EMPTY_COFFEE_BEANS,
  settings,
  tableVisibleColumns = EMPTY_TABLE_COLUMNS,
  activeNoteId,
  noteImageCounts,
}) => {
  const [showQuickDecrementNotes, setShowQuickDecrementNotes] = useState(false);

  // 使用评分维度hook - 在父组件中调用一次，然后传递给所有子组件
  const { getValidTasteRatings } = useFlavorDimensions();

  // 🔥 直接使用 preFilteredNotes，不需要内部 state
  const notes = preFilteredNotes || EMPTY_NOTES;
  const coffeeBeanLookup = useMemo(
    () => buildCoffeeBeanLookup(coffeeBeans),
    [coffeeBeans]
  );

  const isChangeRecord = useCallback(
    (note: BrewingNote) => isChangeRecordNote(note, settings),
    [settings]
  );

  const shouldFilterOut = useCallback(
    (note: BrewingNote) => shouldHideNoteInList(note, settings),
    [settings]
  );

  // 🔥 使用 useMemo 缓存分离后的笔记,避免重复计算
  const { regularNotes, changeRecordNotes } = useMemo(() => {
    const regular: BrewingNote[] = [];
    const changeRecords: BrewingNote[] = [];

    notes.forEach(note => {
      // 先检查是否应该被过滤掉
      if (shouldFilterOut(note)) {
        return;
      }

      if (isChangeRecord(note)) {
        changeRecords.push(note);
      } else {
        regular.push(note);
      }
    });

    return { regularNotes: regular, changeRecordNotes: changeRecords };
  }, [notes, isChangeRecord, shouldFilterOut]);

  const handleToggleSelect = useCallback(
    (noteId: string, enterShareMode?: boolean) => {
      onToggleSelect?.(noteId, enterShareMode);
    },
    [onToggleSelect]
  );

  const toggleShowQuickDecrementNotes = useCallback(() => {
    setShowQuickDecrementNotes(prev => !prev);
  }, []);

  const renderChangeRecordNote = useCallback(
    (note: BrewingNote) => (
      <ChangeRecordNoteItem
        key={note.id}
        note={note}
        onEdit={onNoteClick}
        onDelete={onDeleteNote}
        isShareMode={isShareMode}
        isSelected={selectedNotes.includes(note.id)}
        onToggleSelect={handleToggleSelect}
      />
    ),
    [
      handleToggleSelect,
      isShareMode,
      onDeleteNote,
      onNoteClick,
      selectedNotes,
    ]
  );

  const virtuosoContext = useMemo<NotesVirtuosoContext>(
    () => ({
      changeRecordNotes,
      showQuickDecrementNotes,
      onToggleShowQuickDecrementNotes: toggleShowQuickDecrementNotes,
      renderChangeRecordNote,
    }),
    [
      changeRecordNotes,
      renderChangeRecordNote,
      showQuickDecrementNotes,
      toggleShowQuickDecrementNotes,
    ]
  );

  const handleImageFlowNoteClick = useCallback(
    (note: BrewingNote) => {
      const equipmentName = resolveNoteEquipmentName(note, equipmentNames);
      const beanInfo = resolveNoteBean(note, coffeeBeanLookup);
      const beanUnitPrice = getBeanUnitPrice(beanInfo);

      window.dispatchEvent(
        new CustomEvent('noteDetailOpened', {
          detail: {
            note,
            equipmentName,
            beanUnitPrice,
            beanInfo,
          },
        })
      );
    },
    [coffeeBeanLookup, equipmentNames]
  );
  const useClassicNotesListStyle = settings?.useClassicNotesListStyle ?? false;
  const NoteItemComponent = useClassicNotesListStyle
    ? NoteItemStandard
    : NoteItem;
  const renderRegularNoteItem = useCallback(
    (index: number, note: BrewingNote) => (
      <NoteItemComponent
        key={note.id}
        note={note}
        equipmentNames={equipmentNames}
        onEdit={onNoteClick}
        onDelete={onDeleteNote}
        isShareMode={isShareMode}
        isSelected={selectedNotes.includes(note.id)}
        onToggleSelect={handleToggleSelect}
        isFirst={index === 0}
        isLast={index === regularNotes.length - 1}
        getValidTasteRatings={getValidTasteRatings}
        coffeeBeans={coffeeBeans}
        coffeeBeanLookup={coffeeBeanLookup}
        storedImageCount={noteImageCounts?.get(note.id)}
      />
    ),
    [
      NoteItemComponent,
      coffeeBeanLookup,
      coffeeBeans,
      equipmentNames,
      getValidTasteRatings,
      handleToggleSelect,
      isShareMode,
      noteImageCounts,
      onDeleteNote,
      onNoteClick,
      regularNotes.length,
      selectedNotes,
    ]
  );

  if (notes.length === 0) {
    const fallbackEmptyStateMessage =
      isSearching && searchQuery.trim()
        ? `[ 没有找到匹配"${searchQuery.trim()}"的${emptyRecordLabel} ]`
        : selectedEquipment && filterMode === 'equipment'
          ? `[ 没有使用${equipmentNames[selectedEquipment] || selectedEquipment}的${emptyRecordLabel} ]`
          : emptyRecordLabel === '烘焙记录'
            ? '[ 暂无烘焙记录 ]'
            : `[ 暂无${emptyRecordLabel}，请点击下方按钮添加 ]`;

    return emptyStateMessage === null ? null : (
      <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
        {emptyStateMessage ?? fallbackEmptyStateMessage}
      </div>
    );
  }

  if (viewMode === 'table') {
    return (
      <TableView
        notes={[...regularNotes, ...changeRecordNotes]}
        equipmentNames={equipmentNames}
        coffeeBeanLookup={coffeeBeanLookup}
        visibleColumns={tableVisibleColumns}
        isShareMode={isShareMode}
        selectedNotes={selectedNotes}
        onToggleSelect={handleToggleSelect}
        activeNoteId={activeNoteId}
      />
    );
  }

  // 图片流模式 - 使用完整的笔记数据，不受分页限制
  if (viewMode === 'gallery') {
    // 使用完整的笔记数据（优先使用预筛选的笔记，否则使用全部笔记）
    const allNotes = preFilteredNotes || notes;
    const allRegularNotes = allNotes.filter(note => !isChangeRecord(note));

    // 根据是否是带日期图片流模式选择不同的组件
    if (isDateImageFlowMode) {
      return (
        <DateImageFlowView
          notes={allRegularNotes}
          onNoteClick={handleImageFlowNoteClick}
          isShareMode={isShareMode}
          selectedNotes={selectedNotes}
          onToggleSelect={handleToggleSelect}
        />
      );
    } else {
      return (
        <GalleryView
          notes={allRegularNotes}
          onNoteClick={handleImageFlowNoteClick}
          isShareMode={isShareMode}
          selectedNotes={selectedNotes}
          onToggleSelect={handleToggleSelect}
        />
      );
    }
  }

  // 列表模式
  if (regularNotes.length === 0 && changeRecordNotes.length > 0) {
    return (
      <div className="pb-20 opacity-80">
        {changeRecordNotes.map(renderChangeRecordNote)}
      </div>
    );
  }

  return (
    <div className="pb-20">
      <Virtuoso
        data={regularNotes}
        customScrollParent={scrollParentRef}
        computeItemKey={getNoteVirtuosoItemKey}
        overscan={NOTES_VIRTUOSO_OVERSCAN}
        increaseViewportBy={NOTES_VIRTUOSO_INCREASE_VIEWPORT_BY}
        components={NOTES_VIRTUOSO_COMPONENTS}
        context={virtuosoContext}
        skipAnimationFrameInResizeObserver
        itemContent={renderRegularNoteItem}
      />
    </div>
  );
};

export default NotesListView;
