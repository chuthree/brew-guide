'use client'

import React, { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import { BrewingNote } from '@/lib/core/config'
import { Storage } from '@/lib/core/storage'
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
    searchQuery?: string;
    isSearching?: boolean;
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
    isSearching = false
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
            
            // 搜索过滤
            if (isSearching && searchQuery.trim()) {
                const query = searchQuery.toLowerCase().trim();
                
                // 将查询拆分为多个关键词，移除空字符串
                const queryTerms = query.split(/\s+/).filter(term => term.length > 0);
                
                // 给每个笔记计算匹配分数
                const notesWithScores = filteredNotes.map(note => {
                    // 预处理各个字段，转化为小写并确保有值
                    const equipment = note.equipment?.toLowerCase() || '';
                    const method = note.method?.toLowerCase() || '';
                    const beanName = note.coffeeBeanInfo?.name?.toLowerCase() || '';
                    const roastLevel = note.coffeeBeanInfo?.roastLevel?.toLowerCase() || '';
                    const notes = note.notes?.toLowerCase() || '';
                    
                    // 处理参数信息
                    const coffee = note.params?.coffee?.toLowerCase() || '';
                    const water = note.params?.water?.toLowerCase() || '';
                    const ratio = note.params?.ratio?.toLowerCase() || '';
                    const grindSize = note.params?.grindSize?.toLowerCase() || '';
                    const temp = note.params?.temp?.toLowerCase() || '';
                    
                    // 处理口味评分信息
                    const tasteInfo = `酸度${note.taste?.acidity || 0} 甜度${note.taste?.sweetness || 0} 苦度${note.taste?.bitterness || 0} 醇厚度${note.taste?.body || 0}`.toLowerCase();
                    
                    // 处理时间信息
                    const dateInfo = note.timestamp ? new Date(note.timestamp).toLocaleDateString() : '';
                    const totalTime = note.totalTime ? `${note.totalTime}秒` : '';
                    
                    // 将评分转换为可搜索文本，如"评分4"、"4分"、"4星"
                    const ratingText = note.rating ? `评分${note.rating} ${note.rating}分 ${note.rating}星`.toLowerCase() : '';
                    
                    // 组合所有可搜索文本到一个数组，为不同字段分配权重
                    const searchableTexts = [
                        { text: beanName, weight: 3 },          // 豆子名称权重最高
                        { text: equipment, weight: 2 },         // 设备名称权重较高
                        { text: method, weight: 2 },            // 冲煮方法权重较高
                        { text: notes, weight: 2 },             // 笔记内容权重较高
                        { text: roastLevel, weight: 1 },        // 烘焙度权重一般
                        { text: coffee, weight: 1 },            // 咖啡粉量权重一般
                        { text: water, weight: 1 },             // 水量权重一般
                        { text: ratio, weight: 1 },             // 比例权重一般
                        { text: grindSize, weight: 1 },         // 研磨度权重一般
                        { text: temp, weight: 1 },              // 水温权重一般
                        { text: tasteInfo, weight: 1 },         // 口味信息权重一般
                        { text: dateInfo, weight: 1 },          // 日期信息权重一般
                        { text: totalTime, weight: 1 },         // 总时间权重一般
                        { text: ratingText, weight: 1 }         // 评分文本权重一般
                    ];
                    
                    // 计算匹配分数 - 所有匹配关键词的权重总和
                    let score = 0;
                    let allTermsMatch = true;
                    
                    for (const term of queryTerms) {
                        // 检查当前关键词是否至少匹配一个字段
                        const termMatches = searchableTexts.some(({ text }) => text.includes(term));
                        
                        if (!termMatches) {
                            allTermsMatch = false;
                            break;
                        }
                        
                        // 累加匹配到的权重
                        for (const { text, weight } of searchableTexts) {
                            if (text.includes(term)) {
                                score += weight;
                                
                                // 精确匹配整个字段给予额外加分
                                if (text === term) {
                                    score += weight * 2;
                                }
                                
                                // 匹配字段开头给予额外加分
                                if (text.startsWith(term)) {
                                    score += weight;
                                }
                            }
                        }
                    }
                    
                    return {
                        note,
                        score,
                        matches: allTermsMatch
                    };
                });
                
                // 过滤掉不匹配所有关键词的笔记
                const matchingNotes = notesWithScores.filter(item => item.matches);
                
                // 根据分数排序，分数高的在前面
                matchingNotes.sort((a, b) => b.score - a.score);
                
                // 返回排序后的笔记列表
                filteredNotes = matchingNotes.map(item => item.note);
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
    }, [sortOption, selectedEquipment, selectedBean, filterMode, searchQuery, isSearching]);

    // 当过滤条件变化时重新加载数据
    useEffect(() => {
        // 立即加载数据，不使用setTimeout延迟
        loadNotes();
    }, [loadNotes, sortOption, selectedEquipment, selectedBean, filterMode, searchQuery, isSearching]);

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
    }, []);

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