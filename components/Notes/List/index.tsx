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
    const loaderRef = useRef<HTMLDivElement>(null)
    // 新的状态
    const [filterMode, setFilterMode] = useState<'equipment' | 'bean'>('equipment')
    const [selectedBean, setSelectedBean] = useState<string | null>(null)
    const [availableBeans, setAvailableBeans] = useState<string[]>([])
    // 总消耗量和总花费状态
    const [totalCoffeeConsumption, setTotalCoffeeConsumption] = useState<number>(0)
    const [_totalCost, setTotalCost] = useState<number>(0)
    const [unitPriceCache, setUnitPriceCache] = useState<Record<string, number>>({})

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
        
        // 计算下一页的笔记
        const nextPage = currentPage + 1;
        const startIndex = 0;
        const endIndex = nextPage * PAGE_SIZE;
        
        // 使用筛选后的笔记作为数据源
        const newDisplayedNotes = filteredNotes.slice(startIndex, endIndex);
        
        // 如果加载的数量和筛选后的总数一样，说明没有更多数据了
        const noMoreNotes = newDisplayedNotes.length >= filteredNotes.length;
        
        // 更新状态
        setTimeout(() => {
            setDisplayedNotes(newDisplayedNotes);
            setCurrentPage(nextPage);
            setHasMore(!noMoreNotes);
            setIsLoading(false);
        }, 300); // 添加短暂延迟让加载体验更自然
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
    
    // 加载笔记的函数 - 使用useCallback包装
    const loadNotes = useCallback(async () => {
        try {
            setIsLoading(true);
            const savedNotes = await Storage.get('brewingNotes')
            const parsedNotes = savedNotes ? JSON.parse(savedNotes) : []
            const sortedNotes = sortNotes(parsedNotes, sortOption)
            setNotes(sortedNotes)

            // 收集所有设备ID和咖啡豆
            const rawEquipmentIds = sortedNotes.map(note => note.equipment).filter(Boolean)
            
            // 规范化所有设备ID
            const normalizedEquipmentIdsPromises = rawEquipmentIds.map(id => 
                id ? normalizeEquipmentId(id) : Promise.resolve('')
            )
            const normalizedEquipmentIds = await Promise.all(normalizedEquipmentIdsPromises)
            
            // 过滤掉空值，并确保唯一性
            const uniqueEquipmentIds = Array.from(new Set(normalizedEquipmentIds.filter(Boolean)))
            
            const beanNames = Array.from(new Set(sortedNotes
                .map(note => note.coffeeBeanInfo?.name)
                .filter((name): name is string => name !== undefined && name !== null && name !== '')
            ))
            
            setAvailableEquipments(uniqueEquipmentIds)
            setAvailableBeans(beanNames)

            // 重新调整筛选逻辑以匹配规范化后的ID
            let filtered = sortedNotes
            if (filterMode === 'equipment' && selectedEquipment) {
                // 使用非严格匹配，以便可以匹配到不同形式的同一设备
                filtered = await asyncFilter(sortedNotes, async (note) => {
                    if (!note.equipment) return false
                    const normalizedNoteEquipment = await normalizeEquipmentId(note.equipment)
                    return normalizedNoteEquipment === selectedEquipment
                })
            } else if (filterMode === 'bean' && selectedBean) {
                filtered = sortedNotes.filter(note => note.coffeeBeanInfo?.name === selectedBean)
            }
            setFilteredNotes(filtered)
            
            // 重置分页状态
            setCurrentPage(1)
            setDisplayedNotes(filtered.slice(0, PAGE_SIZE))
            setHasMore(filtered.length > PAGE_SIZE)

            // 加载所有设备的名称
            const namesMap: Record<string, string> = {}
            for (const id of uniqueEquipmentIds) {
                if (id) {
                    namesMap[id] = await getEquipmentName(id)
                }
            }
            setEquipmentNames(namesMap)
            
            // 计算总消耗量
            const consumption = calculateTotalCoffeeConsumption(filtered)
            setTotalCoffeeConsumption(consumption)
            
            // 计算总花费
            const cost = await calculateTotalCost(filtered)
            setTotalCost(cost)
            
            // 创建咖啡豆单位价格缓存
            const priceCache: Record<string, number> = {}
            for (const bean of beanNames) {
                if (bean) {
                    priceCache[bean] = await getCoffeeBeanUnitPrice(bean)
                }
            }
            setUnitPriceCache(priceCache)
            setIsLoading(false);
            
        } catch (_error) {
            setNotes([])
            setFilteredNotes([])
            setDisplayedNotes([])
            setAvailableEquipments([])
            setAvailableBeans([])
            setTotalCoffeeConsumption(0)
            setTotalCost(0)
            setIsLoading(false);
        }
    }, [sortOption, filterMode, selectedEquipment, selectedBean])

    // 当isOpen状态变化时重新加载数据
    useEffect(() => {
        if (isOpen) {
            loadNotes()
        }
    }, [isOpen, loadNotes])

    // 强制刷新的效果
    useEffect(() => {
        loadNotes()
    }, [forceRefreshKey, loadNotes])

    // 添加本地存储变化监听
    useEffect(() => {
        // 立即加载，不管是否显示
        loadNotes()

        // 监听其他标签页的存储变化（仅在 Web 平台有效）
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'brewingNotes') {
                loadNotes()
            }
        }

        // 监听自定义的storage:changed事件，用于同一页面内的通信
        const handleCustomStorageChange = (e: CustomEvent) => {
            if (e.detail && e.detail.key === 'brewingNotes') {
                loadNotes()
                // 强制刷新
                setForceRefreshKey(prev => prev + 1)
            }
        }

        // 创建更通用的刷新函数以便外部可以调用
        const refreshList = () => {
            loadNotes()
            setForceRefreshKey(prev => prev + 1)
        }

        // 挂载到window对象上，使其可以从任何位置调用
        window.refreshBrewingNotes = refreshList

        window.addEventListener('storage', handleStorageChange)
        window.addEventListener('storage:changed', handleCustomStorageChange as EventListener)

        return () => {
            window.removeEventListener('storage', handleStorageChange)
            window.removeEventListener('storage:changed', handleCustomStorageChange as EventListener)
            // 清理window上的引用
            delete window.refreshBrewingNotes
        }
    }, [loadNotes])

    useEffect(() => {
        // 当排序选项变化时，重新排序笔记
        setNotes(prevNotes => {
            const sorted = sortNotes([...prevNotes], sortOption)
            // 更新筛选后的笔记
            updateFilteredNotes(sorted)
            return sorted
        })
    }, [sortOption])

    // 更新筛选后的笔记
    const updateFilteredNotes = useCallback(async (notesToFilter: BrewingNote[]) => {
        if (filterMode === 'equipment' && selectedEquipment) {
            // 使用异步过滤器来处理规范化ID
            const filtered = await asyncFilter(notesToFilter, async (note) => {
                if (!note.equipment) return false
                const normalizedNoteEquipment = await normalizeEquipmentId(note.equipment)
                return normalizedNoteEquipment === selectedEquipment
            })
            setFilteredNotes(filtered)
            // 重置分页
            setCurrentPage(1)
            setDisplayedNotes(filtered.slice(0, PAGE_SIZE))
            setHasMore(filtered.length > PAGE_SIZE)
        } else if (filterMode === 'bean' && selectedBean) {
            const filtered = notesToFilter.filter(note => note.coffeeBeanInfo?.name === selectedBean)
            setFilteredNotes(filtered)
            // 重置分页
            setCurrentPage(1)
            setDisplayedNotes(filtered.slice(0, PAGE_SIZE))
            setHasMore(filtered.length > PAGE_SIZE)
        } else {
            setFilteredNotes(notesToFilter)
            // 重置分页
            setCurrentPage(1)
            setDisplayedNotes(notesToFilter.slice(0, PAGE_SIZE))
            setHasMore(notesToFilter.length > PAGE_SIZE)
        }
    }, [selectedEquipment, selectedBean, filterMode])

    // 当选择的设备或咖啡豆变化时，更新筛选后的笔记
    useEffect(() => {
        updateFilteredNotes(notes)
    }, [selectedEquipment, selectedBean, filterMode, notes, updateFilteredNotes])
    
    const handleDelete = async (noteId: string) => {
        if (window.confirm('确定要删除这条笔记吗？')) {
            try {
                const updatedNotes = notes.filter(note => note.id !== noteId)
                await Storage.set('brewingNotes', JSON.stringify(updatedNotes))
                const sortedNotes = sortNotes(updatedNotes, sortOption)
                setNotes(sortedNotes)

                // 更新筛选后的笔记
                const updatedFilteredNotes = filteredNotes.filter(note => note.id !== noteId)
                setFilteredNotes(updatedFilteredNotes)
                
                // 更新展示的笔记
                const updatedDisplayedNotes = displayedNotes.filter(note => note.id !== noteId)
                
                // 如果当前页面显示的笔记数量低于页面大小并且还有更多笔记可以加载，则自动加载更多
                if (updatedDisplayedNotes.length < PAGE_SIZE && updatedFilteredNotes.length > updatedDisplayedNotes.length) {
                    const newDisplayedNotes = updatedFilteredNotes.slice(0, currentPage * PAGE_SIZE)
                    setDisplayedNotes(newDisplayedNotes)
                    setHasMore(newDisplayedNotes.length < updatedFilteredNotes.length)
                } else {
                    setDisplayedNotes(updatedDisplayedNotes)
                    setHasMore(updatedDisplayedNotes.length < updatedFilteredNotes.length)
                }

                // 更新设备名称缓存，移除不再使用的设备
                const remainingEquipmentIds = Array.from(new Set(sortedNotes.map(note => note.equipment)))
                const updatedEquipmentNames = { ...equipmentNames }

                // 移除不再使用的设备名称
                Object.keys(updatedEquipmentNames).forEach(id => {
                    if (!remainingEquipmentIds.includes(id)) {
                        delete updatedEquipmentNames[id]
                    }
                })

                setEquipmentNames(updatedEquipmentNames)
            } catch {
                // 删除失败时提示用户
                showToast('删除笔记时出错，请重试', 'error')
            }
        }
    }

    const handleSaveEdit = async (updatedData: BrewingNoteData) => {
        try {
            const existingNotesStr = await Storage.get('brewingNotes')
            const existingNotes = existingNotesStr ? JSON.parse(existingNotesStr) : []

            if (editingNote?.id) {
                const updatedNotes = existingNotes.map((note: BrewingNoteData) =>
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
                )

                await Storage.set('brewingNotes', JSON.stringify(updatedNotes))
                const sortedNotes = sortNotes(updatedNotes, sortOption)
                setNotes(sortedNotes)
                
                // 重新执行筛选和分页
                await updateFilteredNotes(sortedNotes)

                // 更新设备名称缓存
                if (updatedData.equipment) {
                    const equipmentName = await getEquipmentName(updatedData.equipment as string)
                    setEquipmentNames(prev => ({
                        ...prev,
                        [updatedData.equipment as string]: equipmentName
                    }))
                }

                setEditingNote(null)
                showToast('笔记已更新', 'success')
            }
            else {
                const newNote = {
                    ...updatedData,
                    id: Date.now().toString(),
                    timestamp: Date.now()
                }

                const updatedNotes = [newNote, ...existingNotes]
                await Storage.set('brewingNotes', JSON.stringify(updatedNotes))
                const sortedNotes = sortNotes(updatedNotes, sortOption)
                setNotes(sortedNotes)
                
                // 重新执行筛选和分页
                await updateFilteredNotes(sortedNotes)

                // 更新设备名称缓存
                if (newNote.equipment) {
                    const equipmentName = await getEquipmentName(newNote.equipment as string)
                    setEquipmentNames(prev => ({
                        ...prev,
                        [newNote.equipment as string]: equipmentName
                    }))
                }

                showToast('笔记已保存', 'success')
            }
        } catch (error) {
            console.error('保存笔记失败:', error)
            // 保存失败时提示用户
            showToast('保存笔记时出错，请重试', 'error')
        }
    }

    // 修改新建笔记处理函数
    const handleAddNote = () => {
        if (onAddNote) {
            onAddNote()
        }
    }

    // 添加咖啡豆筛选处理函数
    const handleBeanClick = useCallback((beanName: string | null) => {
        setSelectedBean(beanName)
        if (beanName === null) {
            setFilteredNotes(notes)
            // 重置分页
            setCurrentPage(1)
            setDisplayedNotes(notes.slice(0, PAGE_SIZE))
            setHasMore(notes.length > PAGE_SIZE)
        } else {
            const filtered = notes.filter(note => note.coffeeBeanInfo?.name === beanName)
            setFilteredNotes(filtered)
            // 重置分页
            setCurrentPage(1)
            setDisplayedNotes(filtered.slice(0, PAGE_SIZE))
            setHasMore(filtered.length > PAGE_SIZE)
        }
    }, [notes])

    // 更新设备筛选处理函数
    const handleEquipmentClick = useCallback((equipment: string | null) => {
        setSelectedEquipment(equipment)
        if (equipment === null) {
            setFilteredNotes(notes)
            // 重置分页
            setCurrentPage(1)
            setDisplayedNotes(notes.slice(0, PAGE_SIZE))
            setHasMore(notes.length > PAGE_SIZE)
        } else {
            // 注意：这里不立即更新filteredNotes，而是通过updateFilteredNotes来处理
            // 这样可以确保异步过滤器正确工作
            updateFilteredNotes(notes)
        }
    }, [notes, updateFilteredNotes])

    // 添加筛选模式切换处理函数
    const handleFilterModeChange = useCallback((mode: 'equipment' | 'bean') => {
        setFilterMode(mode)
        // 重置选择状态
        setSelectedEquipment(null)
        setSelectedBean(null)
        setFilteredNotes(notes)
        // 重置分页
        setCurrentPage(1)
        setDisplayedNotes(notes.slice(0, PAGE_SIZE))
        setHasMore(notes.length > PAGE_SIZE)
    }, [notes])

    if (!isOpen) return null

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
                        {/* 笔记列表 */}
                        {filteredNotes.length === 0 ? (
                            <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                {selectedEquipment 
                                    ? `[ 没有使用${equipmentNames[selectedEquipment] || selectedEquipment}的冲煮记录 ]` 
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