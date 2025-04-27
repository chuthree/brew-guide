'use client'

import React, { useState, useEffect, useCallback, useTransition } from 'react'
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
}

const NotesListView: React.FC<NotesListViewProps> = ({
    sortOption,
    selectedEquipment,
    selectedBean,
    filterMode,
    onNoteClick,
    onDeleteNote
}) => {
    const [_isPending, startTransition] = useTransition()
    const [notes, setNotes] = useState<BrewingNote[]>(globalCache.filteredNotes)
    const [isLoading, setIsLoading] = useState(globalCache.filteredNotes.length === 0)
    const [_equipmentNames, _setEquipmentNames] = useState<Record<string, string>>(globalCache.equipmentNames)
    const [unitPriceCache, _setUnitPriceCache] = useState<Record<string, number>>(globalCache.beanPrices)

    // 加载笔记数据
    const loadNotes = useCallback(async () => {
        try {
            setIsLoading(true);
            
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
                
                // 更新本地状态
                setNotes(filteredNotes);
                setIsLoading(false);
            });
        } catch (error) {
            console.error("加载笔记数据失败:", error);
            setIsLoading(false);
        }
    }, [sortOption, selectedEquipment, selectedBean, filterMode]);

    // 当过滤条件变化时重新加载数据
    useEffect(() => {
        loadNotes();
    }, [loadNotes, sortOption, selectedEquipment, selectedBean, filterMode]);

    // 监听笔记更新事件
    useEffect(() => {
        // 处理笔记更新事件
        const handleNotesUpdated = () => {
            loadNotes();
        };

        // 添加事件监听
        window.addEventListener('brewingNotesUpdated', handleNotesUpdated);
        
        // 全局刷新函数
        window.refreshBrewingNotes = handleNotesUpdated;
        
        // 清理函数
        return () => {
            window.removeEventListener('brewingNotesUpdated', handleNotesUpdated);
            delete window.refreshBrewingNotes;
        };
    }, [loadNotes]);

    if (isLoading) {
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
                />
            ))}
        </div>
    );
};

export default NotesListView; 