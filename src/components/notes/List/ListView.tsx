'use client'

import React, { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import { BrewingNote } from '@/lib/core/config'
import { globalCache } from './globalCache'
import NoteItem from './NoteItem'
import ChangeRecordNoteItem from './ChangeRecordNoteItem'
import { sortNotes } from '../utils'
import { SortOption } from '../types'

// 分页配置
const PAGE_SIZE = 5

// 定义组件属性接口
interface NotesListViewProps {
    sortOption: SortOption;
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
}

const NotesListView: React.FC<NotesListViewProps> = ({
    sortOption,
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
    preFilteredNotes
}) => {
    const [_isPending, startTransition] = useTransition()
    const [notes, setNotes] = useState<BrewingNote[]>(globalCache.filteredNotes)
    const [unitPriceCache] = useState<Record<string, number>>(globalCache.beanPrices)
    const [showQuickDecrementNotes, setShowQuickDecrementNotes] = useState(false)
    const isLoadingRef = useRef<boolean>(false)

    // 分页状态
    const [displayedNotes, setDisplayedNotes] = useState<BrewingNote[]>(() =>
        globalCache.initialized && globalCache.filteredNotes.length > 0
            ? globalCache.filteredNotes.slice(0, PAGE_SIZE)
            : []
    )
    const [currentPage, setCurrentPage] = useState(1)
    const [hasMore, setHasMore] = useState(() =>
        globalCache.initialized && globalCache.filteredNotes.length > 0
            ? globalCache.filteredNotes.length > PAGE_SIZE
            : true
    )
    const [isLoading, setIsLoading] = useState(false)
    const loaderRef = useRef<HTMLDivElement>(null)
    


    // 判断笔记是否为变动记录（快捷扣除或容量调整）
    const isChangeRecord = useCallback((note: BrewingNote) => {
        return note.source === 'quick-decrement' || note.source === 'capacity-adjustment';
    }, []);
    
    // 加载笔记数据
    const loadNotes = useCallback(async () => {
        if (isLoadingRef.current) return;

        try {
            if (preFilteredNotes) {
                startTransition(() => {
                    setNotes(preFilteredNotes);
                    setCurrentPage(1);
                    setDisplayedNotes(preFilteredNotes.slice(0, PAGE_SIZE));
                    setHasMore(preFilteredNotes.length > PAGE_SIZE);
                });
                return;
            }

            if (globalCache.initialized && globalCache.notes.length >= 0) {
                const filteredNotes = globalCache.filteredNotes;
                startTransition(() => {
                    setNotes(filteredNotes);
                    setCurrentPage(1);
                    setDisplayedNotes(filteredNotes.slice(0, PAGE_SIZE));
                    setHasMore(filteredNotes.length > PAGE_SIZE);
                });
                return;
            }

            isLoadingRef.current = true;

            const { Storage } = await import('@/lib/core/storage');
            const savedNotes = await Storage.get('brewingNotes');
            let parsedNotes: BrewingNote[] = savedNotes ? JSON.parse(savedNotes) : [];

            // 修复快捷扣除记录
            let needsUpdate = false;
            parsedNotes = parsedNotes.map(note => {
                if (note.source === 'quick-decrement') {
                    const updatedNote = { ...note };
                    if (updatedNote.equipment === undefined) { updatedNote.equipment = ''; needsUpdate = true; }
                    if (updatedNote.method === undefined) { updatedNote.method = ''; needsUpdate = true; }
                    if (updatedNote.totalTime === undefined) { updatedNote.totalTime = 0; needsUpdate = true; }
                    return updatedNote;
                }
                return note;
            });

            if (needsUpdate) {
                await Storage.set('brewingNotes', JSON.stringify(parsedNotes));
            }

            const sortedNotes = sortNotes(parsedNotes, sortOption);

            let filteredNotes = sortedNotes;
            if (filterMode === 'equipment' && selectedEquipment) {
                filteredNotes = sortedNotes.filter(note => note.equipment === selectedEquipment);
            } else if (filterMode === 'bean' && selectedBean) {
                filteredNotes = sortedNotes.filter(note => note.coffeeBeanInfo?.name === selectedBean);
            }

            globalCache.notes = sortedNotes;
            globalCache.filteredNotes = filteredNotes;
            globalCache.initialized = true;

            startTransition(() => {
                setNotes(filteredNotes);
                isLoadingRef.current = false;
                setCurrentPage(1);
                setDisplayedNotes(filteredNotes.slice(0, PAGE_SIZE));
                setHasMore(filteredNotes.length > PAGE_SIZE);
            });
        } catch (error) {
            // Log error in development only
            if (process.env.NODE_ENV === 'development') {
                console.error("加载笔记数据失败:", error);
            }
            isLoadingRef.current = false;
        }
    }, [sortOption, selectedEquipment, selectedBean, filterMode, preFilteredNotes]);

    useEffect(() => {
        loadNotes();
    }, [loadNotes]);

    useEffect(() => {
        if (preFilteredNotes) {
            startTransition(() => {
                setNotes(preFilteredNotes);
                setCurrentPage(1);
                setDisplayedNotes(preFilteredNotes.slice(0, PAGE_SIZE));
                setHasMore(preFilteredNotes.length > PAGE_SIZE);
            });
        }
    }, [preFilteredNotes]);

    const loadMoreNotes = useCallback(() => {
        if (!hasMore || isLoading) return;

        setIsLoading(true);
        const nextPage = currentPage + 1;
        const endIndex = nextPage * PAGE_SIZE;
        const newDisplayedNotes = notes.slice(0, endIndex);

        setDisplayedNotes(newDisplayedNotes);
        setCurrentPage(nextPage);
        setHasMore(newDisplayedNotes.length < notes.length);
        setIsLoading(false);
    }, [currentPage, notes, hasMore, isLoading]);

    useEffect(() => {
        if (!loaderRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreNotes();
                }
            },
            { threshold: 0.1 }
        );

        observer.observe(loaderRef.current);
        return () => observer.disconnect();
    }, [hasMore, loadMoreNotes]);

    useEffect(() => {
        const handleNotesUpdated = () => loadNotes();
        window.addEventListener('brewingNotesUpdated', handleNotesUpdated);
        window.refreshBrewingNotes = handleNotesUpdated;

        return () => {
            window.removeEventListener('brewingNotesUpdated', handleNotesUpdated);
            delete window.refreshBrewingNotes;
        };
    }, [loadNotes]);

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
                    ? `[ 没有使用${globalCache.equipmentNames[selectedEquipment] || selectedEquipment}的冲煮记录 ]`
                    : (selectedBean && filterMode === 'bean')
                    ? `[ 没有使用${selectedBean}的冲煮记录 ]`
                    : '[ 暂无冲煮记录 ]'}
            </div>
        );
    }

    const regularNotes = displayedNotes.filter(note => !isChangeRecord(note));
    const changeRecordNotes = displayedNotes.filter(note => isChangeRecord(note));

    return (
        <div className="pb-20">
            {/* 普通笔记列表 */}
            <div>
            {regularNotes.map((note) => (
                <NoteItem
                    key={note.id}
                    note={note}
                    equipmentNames={globalCache.equipmentNames}
                    onEdit={onNoteClick}
                    onDelete={onDeleteNote}
                    unitPriceCache={unitPriceCache}
                    isShareMode={isShareMode}
                    isSelected={selectedNotes.includes(note.id)}
                    onToggleSelect={handleToggleSelect}
                />
            ))}
            </div>
            {/* 变动记录区域 */}
            {changeRecordNotes.length > 0 && (
                <div className="mt-2">
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

                    {/* 变动记录列表 - 仅在展开时显示 */}
                    {showQuickDecrementNotes && (
                        <div className="opacity-80">
                            {/* 所有变动记录（快捷扣除和容量调整） */}
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
                </div>
            )}

            {/* 加载更多触发器 */}
            {hasMore && (
                <div
                    ref={loaderRef}
                    className="flex h-16 items-center justify-center text-[10px] tracking-widest text-neutral-400 dark:text-neutral-600"
                >
                    {isLoading ? '加载中...' : ''}
                </div>
            )}
        </div>
    );
};

export default NotesListView;