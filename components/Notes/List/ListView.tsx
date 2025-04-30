'use client'

import React, { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import { BrewingNote } from '@/lib/config'
import { Storage } from '@/lib/storage'
import { globalCache } from './globalCache'
import NoteItem from './NoteItem'
import { sortNotes } from '../utils'
import { SortOption } from '../types'

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
    onToggleSelect
}) => {
    const [_isPending, startTransition] = useTransition()
    const [notes, setNotes] = useState<BrewingNote[]>(globalCache.filteredNotes)
    const [isFirstLoad, setIsFirstLoad] = useState<boolean>(!globalCache.initialized)
    const [unitPriceCache, _setUnitPriceCache] = useState<Record<string, number>>(globalCache.beanPrices)
    const isLoadingRef = useRef<boolean>(false)
    
    // 加载笔记数据 - 优化加载流程以避免不必要的加载状态显示
    const loadNotes = useCallback(async () => {
        // 防止并发加载
        if (isLoadingRef.current) return;
        
        try {
            // 只在首次加载或数据为空时显示加载状态
            const shouldShowLoading = !globalCache.initialized || globalCache.notes.length === 0;
            if (shouldShowLoading) {
                isLoadingRef.current = true;
            }
            
            // 从存储中加载数据
            const savedNotes = await Storage.get('brewingNotes');
            const parsedNotes: BrewingNote[] = savedNotes ? JSON.parse(savedNotes) : [];
            
            // 排序笔记
            const sortedNotes = sortNotes(parsedNotes, sortOption);
            
            // 过滤笔记
            let filteredNotes = sortedNotes;
            if (filterMode === 'equipment' && selectedEquipment) {
                filteredNotes = sortedNotes.filter(note => note.equipment === selectedEquipment);
            } else if (filterMode === 'bean' && selectedBean) {
                filteredNotes = sortedNotes.filter(note => 
                    note.coffeeBeanInfo?.name === selectedBean
                );
            }
            
            // 使用 useTransition 包裹状态更新，避免界面闪烁
            startTransition(() => {
                // 更新全局缓存
                globalCache.notes = sortedNotes;
                globalCache.filteredNotes = filteredNotes;
                globalCache.initialized = true;
                
                // 更新本地状态
                setNotes(filteredNotes);
                setIsFirstLoad(false);
                isLoadingRef.current = false;
            });
        } catch (error) {
            console.error("加载笔记数据失败:", error);
            setIsFirstLoad(false);
            isLoadingRef.current = false;
        }
    }, [sortOption, selectedEquipment, selectedBean, filterMode]);

    // 当过滤条件变化时重新加载数据
    useEffect(() => {
        // 使用setTimeout让UI可以先渲染出来
        setTimeout(() => {
            loadNotes();
        }, 0);
    }, [loadNotes, sortOption, selectedEquipment, selectedBean, filterMode]);

    // 监听笔记更新事件
    useEffect(() => {
        // 处理笔记更新事件
        const handleNotesUpdated = () => {
            loadNotes();
        };

        // 添加事件监听
        window.addEventListener('brewingNotesUpdated', handleNotesUpdated);
        window.addEventListener('customStorageChange', handleNotesUpdated as EventListener);
        
        // 全局刷新函数
        window.refreshBrewingNotes = handleNotesUpdated;
        
        // 清理函数
        return () => {
            window.removeEventListener('brewingNotesUpdated', handleNotesUpdated);
            window.removeEventListener('customStorageChange', handleNotesUpdated as EventListener);
            delete window.refreshBrewingNotes;
        };
    }, [loadNotes]);

    // 处理笔记选择
    const handleToggleSelect = useCallback((noteId: string, enterShareMode?: boolean) => {
        if (onToggleSelect) {
            onToggleSelect(noteId, enterShareMode);
        }
    }, [onToggleSelect]);

    if (isFirstLoad) {
        return (
            <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                加载中...
            </div>
        );
    }

    if (notes.length === 0) {
        return (
            <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                {(selectedEquipment && filterMode === 'equipment')
                    ? `[ 没有使用${globalCache.equipmentNames[selectedEquipment] || selectedEquipment}的冲煮记录 ]` 
                    : (selectedBean && filterMode === 'bean')
                    ? `[ 没有使用${selectedBean}的冲煮记录 ]`
                    : '[ 暂无冲煮记录 ]'}
            </div>
        );
    }

    return (
        <div className="pb-20">
            {notes.map((note) => (
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
    );
};

export default NotesListView; 