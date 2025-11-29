'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { BrewingNote } from '@/lib/core/config';
import NoteItem from './NoteItem';
import ChangeRecordNoteItem from './ChangeRecordNoteItem';
import GalleryView from './GalleryView';
import DateImageFlowView from './DateImageFlowView';
import { useFlavorDimensions } from '@/lib/hooks/useFlavorDimensions';

// 定义组件属性接口
interface NotesListViewProps {
  selectedEquipment: string | null;
  selectedBean: string | null;
  filterMode: 'equipment' | 'bean' | 'date';
  onNoteClick: (note: BrewingNote) => void;
  onDeleteNote: (noteId: string) => Promise<void>;
  onCopyNote?: (noteId: string) => Promise<void>;
  isShareMode?: boolean;
  selectedNotes?: string[];
  onToggleSelect?: (noteId: string, enterShareMode?: boolean) => void;
  searchQuery?: string;
  isSearching?: boolean;
  preFilteredNotes?: BrewingNote[];
  viewMode?: 'list' | 'gallery';
  isDateImageFlowMode?: boolean;
  // 外部滚动容器（Virtuoso 使用）
  scrollParentRef?: HTMLElement;
  // 设备名称映射和价格缓存
  equipmentNames?: Record<string, string>;
  beanPrices?: Record<string, number>;
  // 咖啡豆列表
  coffeeBeans?: import('@/types/app').CoffeeBean[];
}

const NotesListView: React.FC<NotesListViewProps> = ({
  selectedEquipment,
  selectedBean,
  filterMode,
  onNoteClick,
  onDeleteNote,
  onCopyNote,
  isShareMode = false,
  selectedNotes = [],
  onToggleSelect,
  searchQuery = '',
  isSearching = false,
  preFilteredNotes,
  viewMode = 'list',
  isDateImageFlowMode = false,
  scrollParentRef,
  equipmentNames = {},
  beanPrices = {},
  coffeeBeans = [],
}) => {
  const [unitPriceCache] = useState<Record<string, number>>(beanPrices);
  const [showQuickDecrementNotes, setShowQuickDecrementNotes] = useState(false);

  // 使用风味维度hook - 在父组件中调用一次，然后传递给所有子组件
  const { getValidTasteRatings } = useFlavorDimensions();

  // 🔥 直接使用 preFilteredNotes，不需要内部 state
  const notes = preFilteredNotes || [];

  // 判断笔记是否为变动记录 - 纯函数，不需要缓存
  const isChangeRecord = (note: BrewingNote) => {
    return (
      note.source === 'quick-decrement' ||
      note.source === 'capacity-adjustment' ||
      note.source === 'roasting'
    );
  };

  // 🔥 使用 useMemo 缓存分离后的笔记,避免重复计算
  const { regularNotes, changeRecordNotes } = useMemo(() => {
    const regular: BrewingNote[] = [];
    const changeRecords: BrewingNote[] = [];

    notes.forEach(note => {
      if (isChangeRecord(note)) {
        changeRecords.push(note);
      } else {
        regular.push(note);
      }
    });

    return { regularNotes: regular, changeRecordNotes: changeRecords };
  }, [notes]);

  const handleToggleSelect = useCallback(
    (noteId: string, enterShareMode?: boolean) => {
      onToggleSelect?.(noteId, enterShareMode);
    },
    [onToggleSelect]
  );

  const toggleShowQuickDecrementNotes = useCallback(() => {
    setShowQuickDecrementNotes(prev => !prev);
  }, []);

  if (notes.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
        {isSearching && searchQuery.trim()
          ? `[ 没有找到匹配"${searchQuery.trim()}"的冲煮记录 ]`
          : selectedEquipment && filterMode === 'equipment'
            ? `[ 没有使用${equipmentNames[selectedEquipment] || selectedEquipment}的冲煮记录 ]`
            : selectedBean && filterMode === 'bean'
              ? `[ 没有使用${selectedBean}的冲煮记录 ]`
              : '[ 暂无冲煮记录 ]'}
      </div>
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
          onNoteClick={onNoteClick}
          isShareMode={isShareMode}
          selectedNotes={selectedNotes}
          onToggleSelect={handleToggleSelect}
        />
      );
    } else {
      return (
        <GalleryView
          notes={allRegularNotes}
          onNoteClick={onNoteClick}
          isShareMode={isShareMode}
          selectedNotes={selectedNotes}
          onToggleSelect={handleToggleSelect}
        />
      );
    }
  }

  // 列表模式
  return (
    <div className="pb-20">
      <Virtuoso
        data={regularNotes}
        customScrollParent={scrollParentRef}
        // 🔥 性能优化配置
        overscan={200}
        increaseViewportBy={{ top: 200, bottom: 200 }}
        components={{
          Footer: () => (
            <div className="mt-2">
              {changeRecordNotes.length > 0 && (
                <>
                  <div
                    className="relative mb-2 flex cursor-pointer items-center"
                    onClick={toggleShowQuickDecrementNotes}
                  >
                    <div className="grow border-t border-neutral-200 dark:border-neutral-800"></div>
                    <button className="mx-3 flex items-center justify-center rounded-sm px-2 py-0.5 text-xs font-medium tracking-wide text-neutral-600 transition-colors dark:text-neutral-400">
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
                    </button>
                    <div className="grow border-t border-neutral-200 dark:border-neutral-800"></div>
                  </div>
                  {showQuickDecrementNotes && (
                    <div className="opacity-80">
                      {changeRecordNotes.map(note => (
                        <ChangeRecordNoteItem
                          key={note.id}
                          note={note}
                          onEdit={onNoteClick}
                          onDelete={onDeleteNote}
                          onCopy={onCopyNote}
                          isShareMode={isShareMode}
                          isSelected={selectedNotes.includes(note.id)}
                          onToggleSelect={handleToggleSelect}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ),
        }}
        itemContent={(index, note) => (
          <NoteItem
            key={note.id}
            note={note}
            equipmentNames={equipmentNames}
            onEdit={onNoteClick}
            onDelete={onDeleteNote}
            onCopy={onCopyNote}
            unitPriceCache={unitPriceCache}
            isShareMode={isShareMode}
            isSelected={selectedNotes.includes(note.id)}
            onToggleSelect={handleToggleSelect}
            isLast={index === regularNotes.length - 1}
            getValidTasteRatings={getValidTasteRatings}
            coffeeBeans={coffeeBeans}
          />
        )}
      />
    </div>
  );
};

export default NotesListView;
