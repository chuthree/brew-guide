'use client'

import React, { useState, useEffect, useCallback } from 'react'
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

    // 加载笔记的函数 - 使用useCallback包装
    const loadNotes = useCallback(async () => {
        try {
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
            
        } catch (_error) {
            setNotes([])
            setFilteredNotes([])
            setAvailableEquipments([])
            setAvailableBeans([])
            setTotalCoffeeConsumption(0)
            setTotalCost(0)
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
        } else if (filterMode === 'bean' && selectedBean) {
            setFilteredNotes(notesToFilter.filter(note => note.coffeeBeanInfo?.name === selectedBean))
        } else {
            setFilteredNotes(notesToFilter)
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
        } else {
            setFilteredNotes(notes.filter(note => note.coffeeBeanInfo?.name === beanName))
        }
    }, [notes])

    // 更新设备筛选处理函数
    const handleEquipmentClick = useCallback((equipment: string | null) => {
        setSelectedEquipment(equipment)
        if (equipment === null) {
            setFilteredNotes(notes)
        } else {
            // 注意：这里不立即更新filteredNotes，而是通过useEffect中的updateFilteredNotes来处理
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
                                {filteredNotes.map((note) => (
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