'use client'

import React, { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import { BrewingNote } from '@/lib/core/config'
import { globalCache } from './globalCache'
import NoteItem from './NoteItem'
import QuickDecrementNoteItem from './QuickDecrementNoteItem'
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
    const [_isFirstLoad, setIsFirstLoad] = useState<boolean>(!globalCache.initialized)
    const [unitPriceCache, _setUnitPriceCache] = useState<Record<string, number>>(globalCache.beanPrices)
    const [showQuickDecrementNotes, setShowQuickDecrementNotes] = useState(false)
    const isLoadingRef = useRef<boolean>(false)

    // 分页相关状态 - 如果缓存有数据，直接初始化分页数据
    const [displayedNotes, setDisplayedNotes] = useState<BrewingNote[]>(() => {
        if (globalCache.initialized && globalCache.filteredNotes.length > 0) {
            return globalCache.filteredNotes.slice(0, PAGE_SIZE);
        }
        return [];
    })
    const [currentPage, setCurrentPage] = useState(1)
    const [hasMore, setHasMore] = useState(() => {
        if (globalCache.initialized && globalCache.filteredNotes.length > 0) {
            return globalCache.filteredNotes.length > PAGE_SIZE;
        }
        return true;
    })
    const [isLoading, setIsLoading] = useState(false)
    const loaderRef = useRef<HTMLDivElement>(null)
    
    // 判断笔记是否为简单的快捷扣除笔记（未经详细编辑）
    const isSimpleQuickDecrementNote = useCallback((note: BrewingNote) => {
        // 如果不是快捷扣除来源，直接返回false
        if (note.source !== 'quick-decrement') return false;
        
        // 通过单个标志检查是否有任何自定义/编辑过的内容
        const hasCustomContent = 
            // 检查是否有详细评分
            (note.taste && Object.values(note.taste).some(value => value > 0)) ||
            // 检查笔记内容是否已编辑（不是默认文本）
            (note.notes && !/^快捷扣除\d+g咖啡豆/.test(note.notes)) ||
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
                    // 重置分页状态
                    setCurrentPage(1);
                    setDisplayedNotes(preFilteredNotes.slice(0, PAGE_SIZE));
                    setHasMore(preFilteredNotes.length > PAGE_SIZE);
                });
                return;
            }

            // 如果全局缓存已初始化，优先使用缓存中的过滤结果
            if (globalCache.initialized && globalCache.notes.length >= 0) {
                // 使用全局缓存中的过滤结果
                const filteredNotes = globalCache.filteredNotes;

                startTransition(() => {
                    setNotes(filteredNotes);
                    setIsFirstLoad(false);
                    // 重置分页状态
                    setCurrentPage(1);
                    setDisplayedNotes(filteredNotes.slice(0, PAGE_SIZE));
                    setHasMore(filteredNotes.length > PAGE_SIZE);
                });
                return;
            }

            isLoadingRef.current = true;

            // 从存储中加载数据
            const { Storage } = await import('@/lib/core/storage');
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
                // 重置分页状态
                setCurrentPage(1);
                setDisplayedNotes(filteredNotes.slice(0, PAGE_SIZE));
                setHasMore(filteredNotes.length > PAGE_SIZE);
            });
        } catch (error) {
            console.error("加载笔记数据失败:", error);
            setIsFirstLoad(false);
            isLoadingRef.current = false;
        }
    }, [sortOption, selectedEquipment, selectedBean, filterMode, preFilteredNotes]);

    // 优化的数据加载逻辑 - 只在首次挂载和强制刷新时加载
    useEffect(() => {
        loadNotes();
    }, [loadNotes]);

    // 专门监听搜索结果变化
    useEffect(() => {
        if (preFilteredNotes) {
            startTransition(() => {
                setNotes(preFilteredNotes);
                // 重置分页状态
                setCurrentPage(1);
                setDisplayedNotes(preFilteredNotes.slice(0, PAGE_SIZE));
                setHasMore(preFilteredNotes.length > PAGE_SIZE);
            });
        }
    }, [preFilteredNotes]);



    // 加载更多笔记
    const loadMoreNotes = useCallback(() => {
        if (!hasMore || isLoading) return;

        setIsLoading(true);

        try {
            // 计算下一页的笔记
            const nextPage = currentPage + 1;
            const endIndex = nextPage * PAGE_SIZE;

            // 使用当前的笔记数据作为数据源
            const newDisplayedNotes = notes.slice(0, endIndex);

            // 如果加载的数量和总数一样，说明没有更多数据了
            const noMoreNotes = newDisplayedNotes.length >= notes.length;

            setDisplayedNotes(newDisplayedNotes);
            setCurrentPage(nextPage);
            setHasMore(!noMoreNotes);
        } catch (error) {
            console.error('加载更多笔记失败:', error);
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, notes, hasMore, isLoading]);

    // 设置IntersectionObserver来监听加载更多的元素
    useEffect(() => {
        if (!loaderRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreNotes();
                }
            },
            { threshold: 0.1 } // 降低阈值，提高加载触发敏感度
        );

        observer.observe(loaderRef.current);

        return () => {
            if (loaderRef.current) {
                observer.unobserve(loaderRef.current);
            }
        };
    }, [hasMore, loadMoreNotes]);

    // 监听笔记更新事件 - 移除重复的customStorageChange监听，由父组件处理
    useEffect(() => {
        // 处理笔记更新事件
        const handleNotesUpdated = () => {
            loadNotes();
        };

        // 只监听特定的笔记更新事件，避免与父组件重复
        window.addEventListener('brewingNotesUpdated', handleNotesUpdated);

        // 全局刷新函数
        window.refreshBrewingNotes = handleNotesUpdated;

        // 清理函数
        return () => {
            window.removeEventListener('brewingNotesUpdated', handleNotesUpdated);
            delete window.refreshBrewingNotes;
        };
    }, [loadNotes]);

    // 处理笔记选择
    const handleToggleSelect = useCallback((noteId: string, enterShareMode?: boolean) => {
        if (onToggleSelect) {
            onToggleSelect(noteId, enterShareMode);
        }
    }, [onToggleSelect]);
    
    // 切换显示变动记录
    const toggleShowQuickDecrementNotes = useCallback(() => {
        setShowQuickDecrementNotes(prev => !prev);
    }, []);

    // 渲染空状态 - 只有在确实没有数据时才显示
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

    // 分隔笔记 - 使用分页后的数据
    const regularNotes = displayedNotes.filter(note => !isSimpleQuickDecrementNote(note));
    const quickDecrementNotes = displayedNotes.filter(note => isSimpleQuickDecrementNote(note));

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
            {quickDecrementNotes.length > 0 && (
                <div className="mt-2">
                    <div
                        className="relative flex items-center mb-2 cursor-pointer"
                        onClick={toggleShowQuickDecrementNotes}
                    >
                        <div className="grow border-t border-neutral-200 dark:border-neutral-800"></div>
                        <button className="flex items-center justify-center mx-3 px-2 py-0.5 rounded-sm text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400 transition-colors">
                            {quickDecrementNotes.length}条变动记录
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