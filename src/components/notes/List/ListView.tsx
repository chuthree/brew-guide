'use client'

import React, { useState, useEffect, useCallback, useTransition } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { BrewingNote } from '@/lib/core/config'
import NoteItem from './NoteItem'
import ChangeRecordNoteItem from './ChangeRecordNoteItem'
import GalleryView from './GalleryView'
import DateImageFlowView from './DateImageFlowView'

// 定义组件属性接口
interface NotesListViewProps {
    selectedEquipment: string | null;
    selectedBean: string | null;
    filterMode: 'equipment' | 'bean';
    onNoteClick: (note: BrewingNote) => void;
    onDeleteNote: (noteId: string) => Promise<void>;
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
}

const NotesListView: React.FC<NotesListViewProps> = ({
    selectedEquipment,
    selectedBean,
    filterMode,
    onNoteClick,
    onDeleteNote,
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
    beanPrices = {}
}) => {
    const [_isPending, startTransition] = useTransition()
    const [notes, setNotes] = useState<BrewingNote[]>([])  // 初始化为空数组，完全依赖props
    const [unitPriceCache] = useState<Record<string, number>>(beanPrices)
    const [showQuickDecrementNotes, setShowQuickDecrementNotes] = useState(false)

    // 判断笔记是否为变动记录（快捷扣除或容量调整）
    const isChangeRecord = useCallback((note: BrewingNote) => {
        return note.source === 'quick-decrement' || note.source === 'capacity-adjustment';
    }, []);
    
    // 直接响应preFilteredNotes的变化
    useEffect(() => {
        if (preFilteredNotes) {
            startTransition(() => {
                setNotes(preFilteredNotes);
            });
        }
    }, [preFilteredNotes]);

    const handleToggleSelect = useCallback((noteId: string, enterShareMode?: boolean) => {
        onToggleSelect?.(noteId, enterShareMode);
    }, [onToggleSelect]);

    const toggleShowQuickDecrementNotes = useCallback(() => {
        setShowQuickDecrementNotes(prev => !prev);
    }, []);

    if (notes.length === 0) {
        return (
            <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                {isSearching && searchQuery.trim()
                    ? `[ 没有找到匹配"${searchQuery.trim()}"的冲煮记录 ]`
                    : (selectedEquipment && filterMode === 'equipment')
                    ? `[ 没有使用${equipmentNames[selectedEquipment] || selectedEquipment}的冲煮记录 ]`
                    : (selectedBean && filterMode === 'bean')
                    ? `[ 没有使用${selectedBean}的冲煮记录 ]`
                    : '[ 暂无冲煮记录 ]'}
            </div>
        );
    }

    const regularNotes = notes.filter(note => !isChangeRecord(note));
    const changeRecordNotes = notes.filter(note => isChangeRecord(note));

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
            )
        } else {
            return (
                <GalleryView
                    notes={allRegularNotes}
                    onNoteClick={onNoteClick}
                    isShareMode={isShareMode}
                    selectedNotes={selectedNotes}
                    onToggleSelect={handleToggleSelect}
                />
            )
        }
    }

    // 列表模式
    return (
        <div className="pb-20">
            <Virtuoso
                data={regularNotes}
                customScrollParent={scrollParentRef}
                components={{
                    Footer: () => (
                        <div className="mt-2">
                            {changeRecordNotes.length > 0 && (
                                <>
                                    <div
                                        className="relative flex items-center mb-2 cursor-pointer"
                                        onClick={toggleShowQuickDecrementNotes}
                                    >
                                        <div className="grow border-t border-neutral-200 dark:border-neutral-800"></div>
                                        <button className="flex items-center justify-center mx-3 px-2 py-0.5 rounded-sm text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400 transition-colors">
                                            {changeRecordNotes.length}条变动记录
                                            <svg
                                                className={`ml-1 w-3 h-3 transition-transform duration-200 ${showQuickDecrementNotes ? 'rotate-180' : ''}`}
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </button>
                                        <div className="grow border-t border-neutral-200 dark:border-neutral-800"></div>
                                    </div>
                                    {showQuickDecrementNotes && (
                                        <div className="opacity-80">
                                            {changeRecordNotes.map((note) => (
                                                <ChangeRecordNoteItem
                                                    key={note.id}
                                                    note={note}
                                                    onEdit={onNoteClick}
                                                    onDelete={onDeleteNote}
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
                    )
                }}
                itemContent={(index, note) => (
                    <NoteItem
                        key={note.id}
                        note={note}
                        equipmentNames={equipmentNames}
                        onEdit={onNoteClick}
                        onDelete={onDeleteNote}
                        unitPriceCache={unitPriceCache}
                        isShareMode={isShareMode}
                        isSelected={selectedNotes.includes(note.id)}
                        onToggleSelect={handleToggleSelect}
                        isLast={index === regularNotes.length - 1}
                    />
                )}
            />
        </div>
    );
};

export default NotesListView;
