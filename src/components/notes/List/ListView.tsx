'use client'

import React, { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import { BrewingNote } from '@/lib/core/config'
import { Storage } from '@/lib/core/storage'
import { globalCache } from './globalCache'
import NoteItem from './NoteItem'
import QuickDecrementNoteItem from './QuickDecrementNoteItem'
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
    const [isFirstLoad, setIsFirstLoad] = useState<boolean>(!globalCache.initialized)
    const [unitPriceCache, _setUnitPriceCache] = useState<Record<string, number>>(globalCache.beanPrices)
    const [showQuickDecrementNotes, setShowQuickDecrementNotes] = useState(false)
    const isLoadingRef = useRef<boolean>(false)
    
    // 判断笔记是否为简单的快捷扣除笔记（未经详细编辑）
    const isSimpleQuickDecrementNote = useCallback((note: BrewingNote) => {
        // 如果不是快捷扣除来源，直接返回false
        if (note.source !== 'quick-decrement') return false;
        
        // 通过单个标志检查是否有任何自定义/编辑过的内容
        const hasCustomContent = 
            // 检查是否有详细评分
            (note.taste && Object.values(note.taste).some(value => value > 0)) ||
            // 检查笔记内容是否已编辑（不是默认文本）
            (note.notes && !/^快捷扣除\d+g咖啡豆$/.test(note.notes)) ||
            // 检查是否有评分
            note.rating > 0 ||
            // 检查是否设置了冲煮方法和设备
            note.method || (note.equipment && note.equipment !== '未指定') ||
            // 检查是否有图片
            !!note.image;
        
        // 返回是否是简单笔记（没有自定义内容）
        return !hasCustomContent;
    }, []);
    
    // 加载笔记数据 - 优化加载流程以避免不必要的加载状态显示
    const loadNotes = useCallback(async () => {
        if (isLoadingRef.current) return;
        
        try {
            // 如果已经有预过滤的笔记列表，则直接使用
            if (preFilteredNotes) {
                startTransition(() => {
                    setNotes(preFilteredNotes);
                    setIsFirstLoad(false);
                });
                return;
            }
            
            // 只在首次加载或数据为空时显示加载状态
            const shouldShowLoading = !globalCache.initialized || globalCache.notes.length === 0;
            if (shouldShowLoading) {
                isLoadingRef.current = true;
                setIsFirstLoad(true);
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
            
            // 更新全局缓存
            globalCache.notes = sortedNotes;
            globalCache.filteredNotes = filteredNotes;
            globalCache.initialized = true;
                
            // 使用 useTransition 包裹状态更新，避免界面闪烁
            startTransition(() => {
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
    }, [sortOption, selectedEquipment, selectedBean, filterMode, preFilteredNotes]);

    // 当过滤条件变化或预过滤笔记列表更新时重新加载数据
    useEffect(() => {
        // 立即加载数据，不使用setTimeout延迟
        loadNotes();
    }, [loadNotes, sortOption, selectedEquipment, selectedBean, filterMode, preFilteredNotes]);

    // 确保在组件挂载时立即初始化数据
    useEffect(() => {
        // 如果全局缓存中已有数据，立即使用
        if (globalCache.filteredNotes.length > 0) {
            setNotes(globalCache.filteredNotes);
            setIsFirstLoad(false);
        } else {
            // 否则加载新数据
            loadNotes();
        }
    }, [loadNotes]);

    // 专门监听搜索结果变化
    useEffect(() => {
        if (preFilteredNotes) {
            startTransition(() => {
                setNotes(preFilteredNotes);
            });
        }
    }, [preFilteredNotes]);

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
    
    // 切换显示快捷扣除笔记
    const toggleShowQuickDecrementNotes = useCallback(() => {
        setShowQuickDecrementNotes(prev => !prev);
    }, []);

    // 渲染加载中状态
    if (isFirstLoad) {
        return (
            <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                加载中...
            </div>
        );
    }

    // 渲染空状态
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
    
    // 分隔笔记
    const regularNotes = notes.filter(note => !isSimpleQuickDecrementNote(note));
    const quickDecrementNotes = notes.filter(note => isSimpleQuickDecrementNote(note));

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
            {/* 快捷扣除笔记区域 */}
            {quickDecrementNotes.length > 0 && (
                <div className="mt-2">
                    <div
                        className="relative flex items-center mb-2 cursor-pointer"
                        onClick={toggleShowQuickDecrementNotes}
                    >
                        <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
                        <button className="flex items-center justify-center mx-3 px-2 py-0.5 rounded text-[10px] text-neutral-600 dark:text-neutral-400 transition-colors">
                            {quickDecrementNotes.length}条快捷扣除记录
                            <svg
                                className={`ml-1 w-3 h-3 transition-transform duration-200 ${showQuickDecrementNotes ? 'rotate-180' : ''}`}
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                        <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
                    </div>

                    {/* 快捷扣除笔记列表 - 仅在展开时显示 */}
                    {showQuickDecrementNotes && (
                        <div className="opacity-80">
                            {quickDecrementNotes.map((note) => (
                                <QuickDecrementNoteItem
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
        </div>
    );
};

export default NotesListView; 