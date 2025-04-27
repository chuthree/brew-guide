'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Storage } from '@/lib/storage'
import { BrewingHistoryProps, EditingNoteData, SortOption, SORT_OPTIONS, ToastState } from '../types'
import SortSelector from './SortSelector'
import FilterTabs from './FilterTabs'
import AddNoteButton from './AddNoteButton'
import NoteItem from './NoteItem'
import Toast from '../ui/Toast'
import { BrewingNoteForm } from '@/components/Notes'
import { BrewingNoteData } from '@/app/types'
import type { BrewingNote } from '@/lib/config'
import { 
    sortNotes, 
    formatConsumption, 
    calculateTotalCoffeeConsumption, 
    calculateTotalCost, 
    getCoffeeBeanUnitPrice, 
    getEquipmentName,
    normalizeEquipmentId
} from '../utils'

// 为Window对象声明类型扩展
declare global {
    interface Window {
        refreshBrewingNotes?: () => void;
    }
}

// 每页加载的笔记数量
const PAGE_SIZE = 10;

// 缓存已加载的笔记数据，避免频繁重新加载
let cachedNotes: BrewingNote[] | null = null;
// 缓存设备名称，避免重复加载
let cachedEquipmentNames: Record<string, string> = {};
// 缓存咖啡豆单价，避免重复计算
let cachedBeanPrices: Record<string, number> = {};

const BrewingHistory: React.FC<BrewingHistoryProps> = ({ isOpen, onClose: _onClose, onAddNote }) => {
    const [notes, setNotes] = useState<BrewingNote[]>(cachedNotes || [])
    const [sortOption, setSortOption] = useState<SortOption>(SORT_OPTIONS.TIME_DESC)
    const [editingNote, setEditingNote] = useState<EditingNoteData | null>(null)
    const [forceRefreshKey, _setForceRefreshKey] = useState(0)
    const [toast, setToast] = useState<ToastState>({ visible: false, message: '', type: 'info' })
    // 设备名称缓存状态
    const [equipmentNames, setEquipmentNames] = useState<Record<string, string>>(cachedEquipmentNames)
    // 筛选状态
    const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null)
    const [availableEquipments, setAvailableEquipments] = useState<string[]>([])
    const [filteredNotes, setFilteredNotes] = useState<BrewingNote[]>([])
    // 分页状态
    const [displayedNotes, setDisplayedNotes] = useState<BrewingNote[]>([])
    const [currentPage, setCurrentPage] = useState(1)
    const [hasMore, setHasMore] = useState(true)
    const [isLoading, setIsLoading] = useState(false)
    const [isFirstLoad, setIsFirstLoad] = useState(!cachedNotes)
    const loaderRef = useRef<HTMLDivElement>(null)
    const isLoadingRef = useRef(false) // 用于防止并发加载请求
    // 新的状态
    const [filterMode, setFilterMode] = useState<'equipment' | 'bean'>('equipment')
    const [selectedBean, setSelectedBean] = useState<string | null>(null)
    const [availableBeans, setAvailableBeans] = useState<string[]>([])
    // 总消耗量和总花费状态
    const [totalCoffeeConsumption, setTotalCoffeeConsumption] = useState<number>(0)
    const [_totalCost, setTotalCost] = useState<number>(0)
    const [unitPriceCache, setUnitPriceCache] = useState<Record<string, number>>(cachedBeanPrices)

    // 显示消息提示
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ visible: true, message, type })
        setTimeout(() => {
            setToast(prev => ({ ...prev, visible: false }))
        }, 3000)
    }

    // 加载更多笔记 - 优化分页加载逻辑
    const loadMoreNotes = useCallback(() => {
        if (!hasMore || isLoading || isLoadingRef.current) return;
        
        isLoadingRef.current = true;
        setIsLoading(true);
        
        // 计算下一页的笔记
        const nextPage = currentPage + 1;
        const endIndex = nextPage * PAGE_SIZE;
        
        // 使用筛选后的笔记作为数据源
        const newDisplayedNotes = filteredNotes.slice(0, endIndex);
        
        // 如果加载的数量和筛选后的总数一样，说明没有更多数据了
        const noMoreNotes = newDisplayedNotes.length >= filteredNotes.length;
        
        // 使用较短的延迟
        setTimeout(() => {
            setDisplayedNotes(newDisplayedNotes);
            setCurrentPage(nextPage);
            setHasMore(!noMoreNotes);
            setIsLoading(false);
            isLoadingRef.current = false;
        }, 100);
    }, [currentPage, filteredNotes, hasMore, isLoading]);

    // 设置IntersectionObserver来监听加载更多的元素
    useEffect(() => {
        if (!loaderRef.current) return;
        
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreNotes();
                }
            },
            { threshold: 0.5 }
        );
        
        observer.observe(loaderRef.current);
        
        return () => {
            if (loaderRef.current) {
                observer.unobserve(loaderRef.current);
            }
        };
    }, [hasMore, loadMoreNotes]);
    
    // 更新筛选后的笔记，优化以减少不必要的计算
    const updateFilteredNotes = useCallback((notesToFilter: BrewingNote[]) => {
        let filtered = notesToFilter;
        
        if (filterMode === 'equipment' && selectedEquipment) {
            filtered = notesToFilter.filter(note => note.equipment === selectedEquipment);
        } else if (filterMode === 'bean' && selectedBean) {
            filtered = notesToFilter.filter(note => note.coffeeBeanInfo?.name === selectedBean);
        }
        
        setFilteredNotes(filtered);
        
        // 重置分页，只加载第一页数据
        setCurrentPage(1);
        setDisplayedNotes(filtered.slice(0, PAGE_SIZE));
        setHasMore(filtered.length > PAGE_SIZE);
        
        // 计算总消耗量
        const consumption = calculateTotalCoffeeConsumption(filtered);
        setTotalCoffeeConsumption(consumption);
        
        return filtered;
    }, [selectedEquipment, selectedBean, filterMode]);
    
    // 加载笔记的函数 - 优化以减少重复计算和请求
    const loadNotes = useCallback(async () => {
        // 防止并发加载
        if (isLoadingRef.current) return;
        isLoadingRef.current = true;
        
        try {
            // 如果是首次加载，显示加载状态
            if (!cachedNotes) {
                setIsLoading(true);
                setIsFirstLoad(true);
            }
            
            // 从存储中加载数据
            const savedNotes = await Storage.get('brewingNotes');
            const parsedNotes = savedNotes ? JSON.parse(savedNotes) : [];
            const sortedNotes = sortNotes(parsedNotes, sortOption);
            
            // 更新缓存和状态
            cachedNotes = sortedNotes;
            setNotes(sortedNotes);
            
            // 收集设备ID并规范化
            const rawEquipmentIds = sortedNotes
                .map(note => note.equipment)
                .filter(Boolean) as string[];
            
            // 规范化设备ID - 确保相同设备只出现一次
            const normalizedEquipmentMap: Record<string, string> = {};
            
            // 首先尝试将所有设备ID规范化
            for (const id of rawEquipmentIds) {
                try {
                    const normalizedId = await normalizeEquipmentId(id);
                    normalizedEquipmentMap[id] = normalizedId;
                } catch (error) {
                    console.error(`规范化设备ID失败: ${id}`, error);
                    normalizedEquipmentMap[id] = id; // 失败时使用原始ID
                }
            }
            
            // 根据规范化的ID去重
            const uniqueEquipmentIds = Array.from(new Set(
                Object.values(normalizedEquipmentMap)
            ));
            
            // 仅获取未缓存的设备名称
            const namesMap: Record<string, string> = { ...cachedEquipmentNames };
            const equipmentPromises: Promise<void>[] = [];
            
            for (const id of uniqueEquipmentIds) {
                if (!namesMap[id]) {
                    equipmentPromises.push(
                        getEquipmentName(id).then(name => {
                            namesMap[id] = name;
                        })
                    );
                }
            }
            
            if (equipmentPromises.length > 0) {
                await Promise.all(equipmentPromises);
                cachedEquipmentNames = namesMap;
                setEquipmentNames(namesMap);
            }
            
            // 收集所有不重复的咖啡豆名称
            const beanNames = Array.from(new Set(
                sortedNotes
                    .map(note => note.coffeeBeanInfo?.name)
                    .filter((name): name is string => name !== undefined && name !== null && name !== '')
            ));
            
            // 设置可用设备ID和咖啡豆名称
            setAvailableEquipments(uniqueEquipmentIds);
            setAvailableBeans(beanNames);
            
            // 更新筛选后的笔记
            const filtered = updateFilteredNotes(sortedNotes);
            
            // 只在必要时获取咖啡豆价格
            const priceCache: Record<string, number> = { ...cachedBeanPrices };
            const pricePromises: Promise<void>[] = [];
            
            for (const bean of beanNames) {
                if (priceCache[bean] === undefined) {
                    pricePromises.push(
                        getCoffeeBeanUnitPrice(bean).then(price => {
                            priceCache[bean] = price;
                        })
                    );
                }
            }
            
            if (pricePromises.length > 0) {
                await Promise.all(pricePromises);
                cachedBeanPrices = priceCache;
                setUnitPriceCache(priceCache);
            }
            
            // 计算总花费 - 只对筛选后的笔记计算
            const cost = await calculateTotalCost(filtered);
            setTotalCost(cost);
            
        } catch (error) {
            console.error('加载笔记失败:', error);
            setNotes([]);
            setFilteredNotes([]);
            setDisplayedNotes([]);
            setAvailableEquipments([]);
            setAvailableBeans([]);
            setTotalCoffeeConsumption(0);
            setTotalCost(0);
        } finally {
            setIsLoading(false);
            setIsFirstLoad(false);
            isLoadingRef.current = false;
        }
    }, [sortOption, updateFilteredNotes]);

    // 当isOpen状态变化时重新加载数据
    useEffect(() => {
        if (isOpen) {
            loadNotes();
        }
    }, [isOpen, loadNotes]);

    // 强制刷新的效果
    useEffect(() => {
        if (forceRefreshKey > 0) {
            // 清除缓存以强制重新加载
            cachedNotes = null;
            loadNotes();
        }
    }, [forceRefreshKey, loadNotes]);

    // 当排序选项变化时，重新排序笔记
    useEffect(() => {
        // 如果没有笔记数据，则不执行排序
        if (notes.length === 0) return;
        
        const sorted = sortNotes([...notes], sortOption);
        setNotes(sorted);
        updateFilteredNotes(sorted);
    }, [sortOption, notes.length, updateFilteredNotes]);

    // 添加本地存储变化监听 - 优化为单独的effect
    useEffect(() => {
        // 监听其他标签页的存储变化
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'brewingNotes') {
                // 清除缓存以确保获取最新数据
                cachedNotes = null;
                loadNotes();
            }
        };

        // 监听自定义的storage:changed事件
        const handleCustomStorageChange = (e: CustomEvent) => {
            if (e.detail && e.detail.key === 'brewingNotes') {
                // 清除缓存以确保获取最新数据
                cachedNotes = null;
                loadNotes();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('storage:changed', handleCustomStorageChange as EventListener);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('storage:changed', handleCustomStorageChange as EventListener);
        };
    }, [loadNotes]);

    // 创建全局刷新函数
    useEffect(() => {
        const refreshList = () => {
            // 清除缓存以确保获取最新数据
            cachedNotes = null;
            loadNotes();
        };

        // 挂载到window对象上
        window.refreshBrewingNotes = refreshList;

        return () => {
            // 清理window上的引用
            delete window.refreshBrewingNotes;
        };
    }, [loadNotes]);

    // 只在组件挂载时加载一次初始数据
    useEffect(() => {
        const loadInitialNotes = async () => {
            try {
                // 先检查存储中是否有笔记数据
                const savedNotes = await Storage.get('brewingNotes');
                if (savedNotes && !cachedNotes) {
                    loadNotes();
                }
            } catch (error) {
                console.error('加载初始笔记数据失败:', error);
            }
        };
        
        loadInitialNotes();
    }, [loadNotes]);

    // 当选择的设备或咖啡豆变化时，更新筛选后的笔记
    useEffect(() => {
        if (notes.length > 0) {
            updateFilteredNotes(notes);
        }
    }, [selectedEquipment, selectedBean, filterMode, updateFilteredNotes, notes]);
    
    const handleDelete = async (noteId: string) => {
        if (window.confirm('确定要删除这条笔记吗？')) {
            try {
                const updatedNotes = notes.filter(note => note.id !== noteId);
                await Storage.set('brewingNotes', JSON.stringify(updatedNotes));
                
                // 更新缓存和状态
                const sortedNotes = sortNotes(updatedNotes, sortOption);
                cachedNotes = sortedNotes;
                setNotes(sortedNotes);

                // 更新筛选后的笔记
                updateFilteredNotes(sortedNotes);

                // 更新设备名称缓存，移除不再使用的设备
                const remainingEquipmentIds = Array.from(new Set(sortedNotes.map(note => note.equipment)));
                const updatedEquipmentNames = { ...equipmentNames };

                // 移除不再使用的设备名称
                Object.keys(updatedEquipmentNames).forEach(id => {
                    if (!remainingEquipmentIds.includes(id)) {
                        delete updatedEquipmentNames[id];
                    }
                });

                cachedEquipmentNames = updatedEquipmentNames;
                setEquipmentNames(updatedEquipmentNames);
                
                showToast('笔记已删除', 'success');
            } catch (error) {
                console.error('删除笔记失败:', error);
                showToast('删除笔记时出错，请重试', 'error');
            }
        }
    };

    const handleSaveEdit = async (updatedData: BrewingNoteData) => {
        try {
            const existingNotesStr = await Storage.get('brewingNotes');
            const existingNotes = existingNotesStr ? JSON.parse(existingNotesStr) : [];
            let updatedNotes: BrewingNote[];

            if (editingNote?.id) {
                // 编辑现有笔记
                updatedNotes = existingNotes.map((note: BrewingNoteData) =>
                    note.id === editingNote.id
                        ? {
                            ...note,
                            coffeeBeanInfo: updatedData.coffeeBeanInfo,
                            rating: updatedData.rating,
                            taste: updatedData.taste,
                            notes: updatedData.notes,
                            equipment: updatedData.equipment,
                            method: updatedData.method,
                            params: updatedData.params,
                        }
                        : note
                );

                showToast('笔记已更新', 'success');
            } else {
                // 添加新笔记
                const newNote = {
                    ...updatedData,
                    id: Date.now().toString(),
                    timestamp: Date.now()
                };

                updatedNotes = [newNote, ...existingNotes];
                showToast('笔记已保存', 'success');
            }

            await Storage.set('brewingNotes', JSON.stringify(updatedNotes));
            
            // 更新缓存和状态
            const sortedNotes = sortNotes(updatedNotes, sortOption);
            cachedNotes = sortedNotes;
            setNotes(sortedNotes);
            
            // 重新执行筛选和分页
            updateFilteredNotes(sortedNotes);

            // 更新设备名称缓存
            if (updatedData.equipment) {
                const equipmentId = updatedData.equipment as string;
                if (!equipmentNames[equipmentId]) {
                    const equipmentName = await getEquipmentName(equipmentId);
                    const updatedEquipmentNames = {
                        ...equipmentNames,
                        [equipmentId]: equipmentName
                    };
                    cachedEquipmentNames = updatedEquipmentNames;
                    setEquipmentNames(updatedEquipmentNames);
                }
            }

            // 重置编辑状态
            setEditingNote(null);
            
        } catch (error) {
            console.error('保存笔记失败:', error);
            showToast('保存笔记时出错，请重试', 'error');
        }
    };

    // 修改新建笔记处理函数
    const handleAddNote = () => {
        if (onAddNote) {
            onAddNote();
        }
    };

    // 添加咖啡豆筛选处理函数 - 简化为使用updateFilteredNotes
    const handleBeanClick = useCallback((beanName: string | null) => {
        setSelectedBean(beanName);
        // 筛选逻辑由useEffect处理
    }, []);

    // 更新设备筛选处理函数 - 简化为使用updateFilteredNotes
    const handleEquipmentClick = useCallback((equipment: string | null) => {
        setSelectedEquipment(equipment);
        // 筛选逻辑由useEffect处理
    }, []);

    // 添加筛选模式切换处理函数
    const handleFilterModeChange = useCallback((mode: 'equipment' | 'bean') => {
        setFilterMode(mode);
        // 重置选择状态
        setSelectedEquipment(null);
        setSelectedBean(null);
        // 筛选逻辑由useEffect处理
    }, []);

    if (!isOpen) return null;

    return (
        <div className="h-full flex flex-col">
            {editingNote ? (
                <BrewingNoteForm
                    id={editingNote.id}
                    isOpen={true}
                    onClose={() => setEditingNote(null)}
                    onSave={handleSaveEdit}
                    initialData={editingNote}
                />
            ) : (
                <>
                    <div className="pt-6 space-y-6 sticky top-0 bg-neutral-50 dark:bg-neutral-900 z-20">
                        {/* 排序控件和数量显示 */}
                        <div className="flex justify-between items-center mb-6 px-6">
                            <div className="text-xs tracking-wide text-neutral-800 dark:text-neutral-100">
                                {selectedEquipment || selectedBean
                                    ? `${filteredNotes.length}/${notes.length} 条记录，已消耗 ${formatConsumption(totalCoffeeConsumption)}` 
                                    : `${notes.length} 条记录，已消耗 ${formatConsumption(totalCoffeeConsumption)}`}
                            </div>
                            <SortSelector sortOption={sortOption} onSortChange={setSortOption} />
                        </div>

                        {/* 设备筛选选项卡 */}
                        <FilterTabs
                            filterMode={filterMode}
                            selectedEquipment={selectedEquipment}
                            selectedBean={selectedBean}
                            availableEquipments={availableEquipments}
                            availableBeans={availableBeans}
                            equipmentNames={equipmentNames}
                            onFilterModeChange={handleFilterModeChange}
                            onEquipmentClick={handleEquipmentClick}
                            onBeanClick={handleBeanClick}
                        />
                    </div>

                    <div className="w-full h-full overflow-y-auto scroll-with-bottom-bar">
                        {/* 显示加载状态 */}
                        {isFirstLoad ? (
                            <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                加载中...
                            </div>
                        ) : filteredNotes.length === 0 ? (
                            <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                {(selectedEquipment && filterMode === 'equipment')
                                    ? `[ 没有使用${equipmentNames[selectedEquipment] || selectedEquipment}的冲煮记录 ]` 
                                    : (selectedBean && filterMode === 'bean')
                                    ? `[ 没有使用${selectedBean}的冲煮记录 ]`
                                    : '[ 暂无冲煮记录 ]'}
                            </div>
                        ) : (
                            <div className="pb-20">
                                {displayedNotes.map((note) => (
                                    <NoteItem
                                        key={note.id}
                                        note={note}
                                        equipmentNames={equipmentNames}
                                        unitPriceCache={unitPriceCache}
                                        onEdit={(note) => {
                                            setEditingNote({
                                                ...note,
                                                coffeeBeanInfo: note.coffeeBeanInfo || undefined
                                            })
                                        }}
                                        onDelete={handleDelete}
                                    />
                                ))}
                                
                                {/* 加载更多指示器 */}
                                {hasMore && (
                                    <div 
                                        ref={loaderRef} 
                                        className="flex justify-center items-center py-4"
                                    >
                                        {isLoading ? (
                                            <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                                正在加载更多...
                                            </div>
                                        ) : (
                                            <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                                上滑加载更多
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 添加笔记按钮 */}
                    <AddNoteButton onAddNote={handleAddNote} />
                </>
            )}

            {/* Toast消息组件 */}
            <Toast
                visible={toast.visible}
                message={toast.message}
                type={toast.type}
            />
        </div>
    )
}

export default BrewingHistory 