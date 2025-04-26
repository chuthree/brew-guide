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
    normalizeEquipmentId, 
    getEquipmentName, 
    asyncFilter 
} from '../utils'

// 为Window对象声明类型扩展
declare global {
    interface Window {
        refreshBrewingNotes?: () => void;
    }
}

// 每页加载的笔记数量
const PAGE_SIZE = 10;

const BrewingHistory: React.FC<BrewingHistoryProps> = ({ isOpen, onClose: _onClose, onAddNote }) => {
    const [allNotes, setAllNotes] = useState<BrewingNote[]>([])
    const [notes, setNotes] = useState<BrewingNote[]>([])
    const [sortOption, setSortOption] = useState<SortOption>(SORT_OPTIONS.TIME_DESC)
    const [editingNote, setEditingNote] = useState<EditingNoteData | null>(null)
    const [forceRefreshKey, setForceRefreshKey] = useState(0)
    const [toast, setToast] = useState<ToastState>({ visible: false, message: '', type: 'info' })
    // 设备名称缓存状态
    const [equipmentNames, setEquipmentNames] = useState<Record<string, string>>({})
    // 筛选状态
    const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null)
    const [availableEquipments, setAvailableEquipments] = useState<string[]>([])
    const [filteredNotes, setFilteredNotes] = useState<BrewingNote[]>([])
    // 分页状态
    const [displayedNotes, setDisplayedNotes] = useState<BrewingNote[]>([])
    const [currentPage, setCurrentPage] = useState(1)
    const [hasMore, setHasMore] = useState(true)
    const [isLoading, setIsLoading] = useState(false)
    const [isInitialLoading, setIsInitialLoading] = useState(true)
    const loaderRef = useRef<HTMLDivElement>(null)
    // 新的状态
    const [filterMode, setFilterMode] = useState<'equipment' | 'bean'>('equipment')
    const [selectedBean, setSelectedBean] = useState<string | null>(null)
    const [availableBeans, setAvailableBeans] = useState<string[]>([])
    // 总消耗量和总花费状态
    const [totalCoffeeConsumption, setTotalCoffeeConsumption] = useState<number>(0)
    const [_totalCost, setTotalCost] = useState<number>(0)
    const [unitPriceCache, setUnitPriceCache] = useState<Record<string, number>>({})
    // 延迟处理参考
    const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // 显示消息提示
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ visible: true, message, type })
        setTimeout(() => {
            setToast(prev => ({ ...prev, visible: false }))
        }, 3000)
    }

    // 加载更多笔记
    const loadMoreNotes = useCallback(() => {
        if (!hasMore || isLoading) return;
        
        setIsLoading(true);
        
        // 使用setTimeout为了不阻塞UI渲染
        setTimeout(() => {
            try {
                // 计算下一页的笔记
                const nextPage = currentPage + 1;
                const endIndex = nextPage * PAGE_SIZE;
                
                // 使用筛选后的笔记作为数据源
                const newDisplayedNotes = filteredNotes.slice(0, endIndex);
                
                // 如果加载的数量和筛选后的总数一样，说明没有更多数据了
                const noMoreNotes = newDisplayedNotes.length >= filteredNotes.length;
                
                setDisplayedNotes(newDisplayedNotes);
                setCurrentPage(nextPage);
                setHasMore(!noMoreNotes);
            } catch (error) {
                console.error('加载更多笔记失败:', error);
            } finally {
                setIsLoading(false);
            }
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
    
    // 初始化数据载入
    const initializeData = useCallback(async () => {
        try {
            setIsInitialLoading(true);
            
            // 读取所有笔记
            const savedNotes = await Storage.get('brewingNotes')
            if (!savedNotes) {
                setIsInitialLoading(false);
                return;
            }
            
            // 首先设置所有笔记
            const parsedNotes = JSON.parse(savedNotes) || [];
            setAllNotes(parsedNotes);
            
            // 对所有笔记排序
            const sortedNotes = sortNotes(parsedNotes, sortOption);
            setNotes(sortedNotes);
            
            // 先快速加载第一页数据，显示界面
            setFilteredNotes(sortedNotes);
            setDisplayedNotes(sortedNotes.slice(0, PAGE_SIZE));
            setHasMore(sortedNotes.length > PAGE_SIZE);
            setIsInitialLoading(false);
            
            // 然后异步处理设备ID和咖啡豆信息
            processingTimeoutRef.current = setTimeout(() => {
                processNotesMetadata(sortedNotes);
            }, 100);
            
        } catch (error) {
            console.error('初始化数据失败:', error);
            setIsInitialLoading(false);
            setAllNotes([]);
            setNotes([]);
            setFilteredNotes([]);
            setDisplayedNotes([]);
            setHasMore(false);
        }
    }, [sortOption]);
    
    // 处理笔记元数据（设备ID、咖啡豆等信息）- 拆分成单独函数降低复杂度
    const processNotesMetadata = async (sortedNotes: BrewingNote[]) => {
        try {
            // 收集所有设备ID
            const rawEquipmentIds = sortedNotes.map(note => note.equipment).filter(Boolean);
            
            // 规范化所有设备ID (批量处理)
            const normalizedEquipmentIdsPromises = rawEquipmentIds.map(id => 
                id ? normalizeEquipmentId(id) : Promise.resolve('')
            );
            const normalizedEquipmentIds = await Promise.all(normalizedEquipmentIdsPromises);
            
            // 过滤掉空值，并确保唯一性
            const uniqueEquipmentIds = Array.from(new Set(normalizedEquipmentIds.filter(Boolean)));
            setAvailableEquipments(uniqueEquipmentIds);
            
            // 收集咖啡豆名称
            const beanNames = Array.from(new Set(sortedNotes
                .map(note => note.coffeeBeanInfo?.name)
                .filter((name): name is string => name !== undefined && name !== null && name !== '')
            ));
            setAvailableBeans(beanNames);
            
            // 应用筛选 - 延迟处理，不阻塞UI
            let filtered = sortedNotes;
            if (filterMode === 'equipment' && selectedEquipment) {
                // 异步筛选设备
                filtered = await asyncFilter(sortedNotes, async (note) => {
                    if (!note.equipment) return false;
                    const normalizedNoteEquipment = await normalizeEquipmentId(note.equipment);
                    return normalizedNoteEquipment === selectedEquipment;
                });
            } else if (filterMode === 'bean' && selectedBean) {
                // 同步筛选咖啡豆
                filtered = sortedNotes.filter(note => note.coffeeBeanInfo?.name === selectedBean);
            }
            
            // 更新过滤后的笔记
            setFilteredNotes(filtered);
            setDisplayedNotes(filtered.slice(0, currentPage * PAGE_SIZE));
            setHasMore(filtered.length > currentPage * PAGE_SIZE);
            
            // 延迟加载设备名称和计算消耗量 - 这些操作相对耗时但不影响核心功能
            setTimeout(async () => {
                await loadEquipmentNames(uniqueEquipmentIds);
                calculateConsumption(filtered);
                await buildUnitPriceCache(beanNames);
            }, 300);
            
        } catch (error) {
            console.error('处理笔记元数据失败:', error);
            // 出错时保持当前状态，不影响用户体验
        }
    };
    
    // 加载设备名称 - 拆分为单独函数
    const loadEquipmentNames = async (equipmentIds: string[]) => {
        try {
            const namesMap: Record<string, string> = {};
            // 批量处理设备名称
            const namePromises = equipmentIds.map(async (id) => {
                if (id) {
                    const name = await getEquipmentName(id);
                    return { id, name };
                }
                return null;
            });
            
            const results = await Promise.all(namePromises);
            results.forEach(result => {
                if (result) {
                    namesMap[result.id] = result.name;
                }
            });
            
            setEquipmentNames(namesMap);
        } catch (error) {
            console.error('加载设备名称失败:', error);
        }
    };
    
    // 计算消耗量 - 拆分为单独函数
    const calculateConsumption = async (notes: BrewingNote[]) => {
        try {
            // 计算总消耗量
            const consumption = calculateTotalCoffeeConsumption(notes);
            setTotalCoffeeConsumption(consumption);
            
            // 计算总花费 - 这个可能比较耗时
            const cost = await calculateTotalCost(notes);
            setTotalCost(cost);
        } catch (error) {
            console.error('计算消耗量失败:', error);
        }
    };
    
    // 构建咖啡豆单价缓存 - 拆分为单独函数
    const buildUnitPriceCache = async (beanNames: string[]) => {
        try {
            const priceCache: Record<string, number> = {};
            // 批量处理单价
            const pricePromises = beanNames.map(async (bean) => {
                if (bean) {
                    const price = await getCoffeeBeanUnitPrice(bean);
                    return { bean, price };
                }
                return null;
            });
            
            const results = await Promise.all(pricePromises);
            results.forEach(result => {
                if (result) {
                    priceCache[result.bean] = result.price;
                }
            });
            
            setUnitPriceCache(priceCache);
        } catch (error) {
            console.error('构建咖啡豆单价缓存失败:', error);
        }
    };

    // 当isOpen状态变化时重新加载数据
    useEffect(() => {
        if (isOpen) {
            initializeData();
        }
        
        // 组件卸载时清除所有定时器
        return () => {
            if (processingTimeoutRef.current) {
                clearTimeout(processingTimeoutRef.current);
            }
        };
    }, [isOpen, initializeData]);

    // 强制刷新的效果
    useEffect(() => {
        initializeData();
    }, [forceRefreshKey, initializeData]);

    // 添加本地存储变化监听
    useEffect(() => {
        // 监听其他标签页的存储变化（仅在 Web 平台有效）
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'brewingNotes') {
                initializeData();
            }
        }

        // 监听自定义的storage:changed事件，用于同一页面内的通信
        const handleCustomStorageChange = (e: CustomEvent) => {
            if (e.detail && e.detail.key === 'brewingNotes') {
                initializeData();
                // 强制刷新
                setForceRefreshKey(prev => prev + 1);
            }
        }

        // 创建更通用的刷新函数以便外部可以调用
        const refreshList = () => {
            initializeData();
            setForceRefreshKey(prev => prev + 1);
        }

        // 挂载到window对象上，使其可以从任何位置调用
        window.refreshBrewingNotes = refreshList;

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('storage:changed', handleCustomStorageChange as EventListener);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('storage:changed', handleCustomStorageChange as EventListener);
            // 清理window上的引用
            delete window.refreshBrewingNotes;
            
            // 清除所有定时器
            if (processingTimeoutRef.current) {
                clearTimeout(processingTimeoutRef.current);
            }
        }
    }, [initializeData]);

    // 当排序选项变化时
    useEffect(() => {
        if (allNotes.length === 0) return;
        
        // 异步处理以不阻塞UI
        setIsLoading(true);
        
        setTimeout(() => {
            try {
                // 重新排序所有笔记
                const sorted = sortNotes([...allNotes], sortOption);
                setNotes(sorted);
                
                // 应用筛选
                applyFilters(sorted);
            } catch (error) {
                console.error('排序失败:', error);
            } finally {
                setIsLoading(false);
            }
        }, 0);
    }, [sortOption, allNotes]);

    // 应用筛选 - 独立为一个函数
    const applyFilters = useCallback(async (notesToFilter: BrewingNote[]) => {
        try {
            setIsLoading(true);
            
            let filtered: BrewingNote[] = notesToFilter;
            
            if (filterMode === 'equipment' && selectedEquipment) {
                // 异步过滤设备
                filtered = await asyncFilter(notesToFilter, async (note) => {
                    if (!note.equipment) return false;
                    const normalizedNoteEquipment = await normalizeEquipmentId(note.equipment);
                    return normalizedNoteEquipment === selectedEquipment;
                });
            } else if (filterMode === 'bean' && selectedBean) {
                // 同步过滤咖啡豆
                filtered = notesToFilter.filter(note => note.coffeeBeanInfo?.name === selectedBean);
            }
            
            // 更新过滤后的笔记
            setFilteredNotes(filtered);
            
            // 重置分页状态
            setCurrentPage(1);
            setDisplayedNotes(filtered.slice(0, PAGE_SIZE));
            setHasMore(filtered.length > PAGE_SIZE);
            
            // 重新计算消耗 - 延迟执行，优先显示UI
            setTimeout(() => {
                calculateConsumption(filtered);
            }, 100);
        } catch (error) {
            console.error('应用筛选失败:', error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedEquipment, selectedBean, filterMode]);

    // 当选择的设备或咖啡豆变化时
    useEffect(() => {
        if (notes.length > 0) {
            applyFilters(notes);
        }
    }, [selectedEquipment, selectedBean, filterMode, notes, applyFilters]);
    
    // 删除笔记
    const handleDelete = async (noteId: string) => {
        if (window.confirm('确定要删除这条笔记吗？')) {
            try {
                setIsLoading(true);
                
                // 从所有列表中移除笔记
                const updatedAllNotes = allNotes.filter(note => note.id !== noteId);
                const updatedNotes = notes.filter(note => note.id !== noteId);
                const updatedFilteredNotes = filteredNotes.filter(note => note.id !== noteId);
                const updatedDisplayedNotes = displayedNotes.filter(note => note.id !== noteId);
                
                // 持久化到存储
                await Storage.set('brewingNotes', JSON.stringify(updatedAllNotes));
                
                // 更新状态
                setAllNotes(updatedAllNotes);
                setNotes(updatedNotes);
                setFilteredNotes(updatedFilteredNotes);
                
                // 如果当前页面显示的笔记数量低于页面大小并且还有更多笔记可以加载，则自动加载更多
                if (updatedDisplayedNotes.length < PAGE_SIZE && updatedFilteredNotes.length > updatedDisplayedNotes.length) {
                    const newDisplayedNotes = updatedFilteredNotes.slice(0, currentPage * PAGE_SIZE);
                    setDisplayedNotes(newDisplayedNotes);
                    setHasMore(newDisplayedNotes.length < updatedFilteredNotes.length);
                } else {
                    setDisplayedNotes(updatedDisplayedNotes);
                    setHasMore(updatedDisplayedNotes.length < updatedFilteredNotes.length);
                }
                
                // 延迟更新设备名称和消耗量
                setTimeout(() => {
                    // 更新设备名称缓存，移除不再使用的设备
                    const remainingEquipmentIds = Array.from(new Set(updatedNotes.map(note => note.equipment)));
                    const updatedEquipmentNames = { ...equipmentNames };
    
                    // 移除不再使用的设备名称
                    Object.keys(updatedEquipmentNames).forEach(id => {
                        if (!remainingEquipmentIds.includes(id)) {
                            delete updatedEquipmentNames[id];
                        }
                    });
    
                    setEquipmentNames(updatedEquipmentNames);
                    
                    // 更新消耗量
                    calculateConsumption(updatedFilteredNotes);
                }, 100);
            } catch (error) {
                console.error('删除笔记失败:', error);
                // 删除失败时提示用户
                showToast('删除笔记时出错，请重试', 'error');
            } finally {
                setIsLoading(false);
            }
        }
    }

    // 保存编辑/新建的笔记
    const handleSaveEdit = async (updatedData: BrewingNoteData) => {
        try {
            setIsLoading(true);
            const existingNotesStr = await Storage.get('brewingNotes');
            const existingNotes = existingNotesStr ? JSON.parse(existingNotesStr) : [];

            let updatedNotes;
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
                // 创建新笔记
                const newNote = {
                    ...updatedData,
                    id: Date.now().toString(),
                    timestamp: Date.now()
                };
                updatedNotes = [newNote, ...existingNotes];
                showToast('笔记已保存', 'success');
            }

            // 持久化到存储
            await Storage.set('brewingNotes', JSON.stringify(updatedNotes));
            
            // 更新内存中的数据
            setAllNotes(updatedNotes);
            
            // 排序和应用筛选 - 但要延迟执行，先关闭编辑界面
            const sortedNotes = sortNotes(updatedNotes, sortOption);
            setNotes(sortedNotes);
            
            // 关闭编辑界面
            setEditingNote(null);
            
            // 延迟处理其他更新，让UI先响应
            setTimeout(async () => {
                // 更新设备名称和应用筛选
                if (updatedData.equipment) {
                    const equipmentName = await getEquipmentName(updatedData.equipment as string);
                    setEquipmentNames(prev => ({
                        ...prev,
                        [updatedData.equipment as string]: equipmentName
                    }));
                }
                
                // 重新执行筛选和分页
                await applyFilters(sortedNotes);
            }, 50);
        } catch (error) {
            console.error('保存笔记失败:', error);
            // 保存失败时提示用户
            showToast('保存笔记时出错，请重试', 'error');
        } finally {
            setIsLoading(false);
        }
    }

    // 添加新笔记
    const handleAddNote = () => {
        if (onAddNote) {
            onAddNote();
        }
    }

    // 咖啡豆筛选处理
    const handleBeanClick = useCallback((beanName: string | null) => {
        setSelectedBean(beanName);
        
        // 实际筛选操作通过useEffect和applyFilters完成
    }, []);

    // 设备筛选处理
    const handleEquipmentClick = useCallback((equipment: string | null) => {
        setSelectedEquipment(equipment);
        
        // 实际筛选操作通过useEffect和applyFilters完成
    }, []);

    // 筛选模式切换
    const handleFilterModeChange = useCallback((mode: 'equipment' | 'bean') => {
        setFilterMode(mode);
        // 重置选择状态
        setSelectedEquipment(null);
        setSelectedBean(null);
        
        // 实际筛选操作通过useEffect和applyFilters完成
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
                                {selectedEquipment 
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
                        {/* 初始加载中状态 */}
                        {isInitialLoading && (
                            <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                加载笔记中...
                            </div>
                        )}
                        
                        {/* 无笔记状态 */}
                        {!isInitialLoading && filteredNotes.length === 0 && (
                            <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                {selectedEquipment 
                                    ? `[ 没有使用${equipmentNames[selectedEquipment] || selectedEquipment}的冲煮记录 ]` 
                                    : '[ 暂无冲煮记录 ]'}
                            </div>
                        )}
                        
                        {/* 笔记列表 */}
                        {!isInitialLoading && filteredNotes.length > 0 && (
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