'use client'

import React, { useState, useEffect, useRef, useCallback, useReducer } from 'react'
import { Storage } from '@/lib/core/storage'
import { BrewingNote } from '@/lib/core/config'
import { BrewingHistoryProps } from '../types'
import SortSelector from './SortSelector'
import FilterTabs from './FilterTabs'
import AddNoteButton from './AddNoteButton'
import Toast from '../ui/Toast'
import { BrewingNoteForm } from '@/components/notes'
import { BrewingNoteData } from '@/types/app'
import { getEquipmentName, normalizeEquipmentId } from '../utils'
import { globalCache, saveSelectedEquipmentPreference, saveSelectedBeanPreference, saveFilterModePreference, saveSortOptionPreference, calculateTotalCoffeeConsumption, formatConsumption, initializeGlobalCache } from './globalCache'
import ListView from './ListView'
import { SortOption } from '../types'
import { exportSelectedNotes } from '../Share/NotesExporter'

// 为Window对象声明类型扩展
declare global {
    interface Window {
        refreshBrewingNotes?: () => void;
    }
}

const BrewingHistory: React.FC<BrewingHistoryProps> = ({ isOpen, onClose: _onClose, onAddNote }) => {
    // 用于跟踪用户选择
    const [sortOption, setSortOption] = useState<SortOption>(globalCache.sortOption)
    const [filterMode, setFilterMode] = useState<'equipment' | 'bean'>(globalCache.filterMode)
    const [selectedEquipment, setSelectedEquipment] = useState<string | null>(globalCache.selectedEquipment)
    const [selectedBean, setSelectedBean] = useState<string | null>(globalCache.selectedBean)
    const [editingNote, setEditingNote] = useState<BrewingNoteData | null>(null)
    
    // 分享模式状态
    const [isShareMode, setIsShareMode] = useState(false)
    const [selectedNotes, setSelectedNotes] = useState<string[]>([])
    const [isSaving, setIsSaving] = useState(false)
    
    // 预览容器引用
    const notesContainerRef = useRef<HTMLDivElement>(null)
    
    // Toast消息状态
    const [toast, setToast] = useState({
        visible: false,
        message: '',
        type: 'info' as 'success' | 'error' | 'info'
    })
    
    // 计算总咖啡消耗量
    const totalCoffeeConsumption = useRef(globalCache.totalConsumption || 0)
    const [, _forceUpdate] = useReducer(x => x + 1, 0)

    // 强制组件重新渲染的函数
    const triggerRerender = useCallback(() => {
        _forceUpdate()
    }, [])
    
    // 加载可用设备和咖啡豆列表
    const loadEquipmentsAndBeans = useCallback(async () => {
        try {
            // 避免未打开状态下加载数据
            if (!isOpen) return;
            
            // 从存储中加载数据
            const savedNotes = await Storage.get('brewingNotes');
            const parsedNotes: BrewingNote[] = savedNotes ? JSON.parse(savedNotes) : [];
            
            // 收集设备ID并规范化
            const rawEquipmentIds = parsedNotes
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
            
            // 获取设备名称
            const namesMap: Record<string, string> = {};
            const equipmentPromises: Promise<void>[] = [];
            
            for (const id of uniqueEquipmentIds) {
                equipmentPromises.push(
                    getEquipmentName(id).then(name => {
                        namesMap[id] = name;
                    })
                );
            }
            
            if (equipmentPromises.length > 0) {
                await Promise.all(equipmentPromises);
            }
            
            // 收集所有不重复的咖啡豆名称
            const beanNames = Array.from(new Set(
                parsedNotes
                    .map(note => note.coffeeBeanInfo?.name)
                    .filter((name): name is string => name !== undefined && name !== null && name !== '')
            ));
            
            // 更新全局缓存
            globalCache.equipmentNames = namesMap;
            globalCache.availableEquipments = uniqueEquipmentIds;
            globalCache.availableBeans = beanNames;
            globalCache.notes = parsedNotes; // 确保全局缓存中有最新的笔记数据
            
            // 计算总消耗量并更新全局缓存
            const totalConsumption = calculateTotalCoffeeConsumption(parsedNotes);
            globalCache.totalConsumption = totalConsumption; // 更新全局缓存中的消耗量
            totalCoffeeConsumption.current = totalConsumption;
            
            // 根据当前筛选条件更新过滤后的笔记列表
            let filteredNotes = parsedNotes;
            if (filterMode === 'equipment' && selectedEquipment) {
                filteredNotes = parsedNotes.filter(note => note.equipment === selectedEquipment);
            } else if (filterMode === 'bean' && selectedBean) {
                filteredNotes = parsedNotes.filter(note => 
                    note.coffeeBeanInfo?.name === selectedBean
                );
            }
            globalCache.filteredNotes = filteredNotes;
            
            // 确保globalCache.initialized设置为true
            globalCache.initialized = true;
            
            // 触发重新渲染以更新显示
            triggerRerender();
            
            // 触发brewingNotesUpdated事件，更新ListView组件
            if (window.refreshBrewingNotes) {
                window.refreshBrewingNotes();
            }
        } catch (error) {
            console.error("加载设备和咖啡豆数据失败:", error);
        }
    }, [isOpen, filterMode, selectedEquipment, selectedBean, triggerRerender]);
    
    // 初始化 - 确保在组件挂载时正确初始化数据
    useEffect(() => {
        if (isOpen) {
            // 确保全局缓存已初始化
            (async () => {
                if (!globalCache.initialized) {
                    await initializeGlobalCache();
                    
                    // 从全局缓存更新状态
                    setSortOption(globalCache.sortOption);
                    setFilterMode(globalCache.filterMode);
                    setSelectedEquipment(globalCache.selectedEquipment);
                    setSelectedBean(globalCache.selectedBean);
                    totalCoffeeConsumption.current = globalCache.totalConsumption;
                    
                    // 触发重新渲染
                    triggerRerender();
                }
                
                // 无论全局缓存是否已初始化，都重新加载数据以确保最新
                loadEquipmentsAndBeans();
            })();
        }
    }, [isOpen, loadEquipmentsAndBeans, triggerRerender]);
    
    // 监听存储变化
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'brewingNotes' && e.newValue !== null) {
                loadEquipmentsAndBeans();
            }
        };
        
        const handleCustomStorageChange = (e: CustomEvent) => {
            if (e.detail?.key === 'brewingNotes') {
                loadEquipmentsAndBeans();
            }
        };
        
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('customStorageChange', handleCustomStorageChange as EventListener);
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('customStorageChange', handleCustomStorageChange as EventListener);
        };
    }, [loadEquipmentsAndBeans]);
    
    // 显示消息提示
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ visible: true, message, type });
        setTimeout(() => {
            setToast(prev => ({ ...prev, visible: false }));
        }, 3000);
    };
    
    // 处理删除笔记
    const handleDelete = async (noteId: string) => {
        try {
            const savedNotes = await Storage.get('brewingNotes');
            if (!savedNotes) return;
            
            const notes = JSON.parse(savedNotes) as BrewingNote[];
            const updatedNotes = notes.filter(note => note.id !== noteId);
            
            await Storage.set('brewingNotes', JSON.stringify(updatedNotes));
            
            // 派发自定义事件以通知其他组件
            const event = new CustomEvent('customStorageChange', {
                detail: { key: 'brewingNotes' }
            });
            window.dispatchEvent(event);
            
            showToast('笔记已删除', 'success');
        } catch (error) {
            console.error('删除笔记失败:', error);
            showToast('删除笔记失败', 'error');
        }
    };
    
    // 处理保存编辑
    const handleSaveEdit = async (updatedData: BrewingNoteData) => {
        if (!editingNote) return;
        
        try {
            const savedNotes = await Storage.get('brewingNotes');
            const notes = savedNotes ? JSON.parse(savedNotes) as BrewingNote[] : [];
            
            let updated = false;
            const updatedNotes = notes.map(note => {
                if (note.id === editingNote.id) {
                    updated = true;
                    // 创建更新后的笔记
                    const updatedNote: BrewingNote = {
                        ...note,
                        equipment: updatedData.equipment || note.equipment,
                        method: updatedData.method || note.method,
                        params: {
                            coffee: updatedData.params?.coffee || note.params.coffee,
                            water: updatedData.params?.water || note.params.water,
                            ratio: updatedData.params?.ratio || note.params.ratio,
                            grindSize: updatedData.params?.grindSize || note.params.grindSize,
                            temp: updatedData.params?.temp || note.params.temp
                        },
                        rating: updatedData.rating !== undefined ? updatedData.rating : note.rating,
                        taste: updatedData.taste || note.taste,
                        notes: updatedData.notes || note.notes,
                        totalTime: updatedData.totalTime || note.totalTime
                    };
                    
                    // 单独处理 coffeeBeanInfo
                    if (updatedData.coffeeBeanInfo) {
                        updatedNote.coffeeBeanInfo = {
                            name: updatedData.coffeeBeanInfo.name,
                            roastLevel: updatedData.coffeeBeanInfo.roastLevel,
                            roastDate: updatedData.coffeeBeanInfo.roastDate
                        };
                    }
                    
                    return updatedNote;
                }
                return note;
            });
            
            if (updated) {
                await Storage.set('brewingNotes', JSON.stringify(updatedNotes));
                
                // 派发自定义事件以通知其他组件
                const event = new CustomEvent('customStorageChange', {
                    detail: { key: 'brewingNotes' }
                });
                window.dispatchEvent(event);
                
                setEditingNote(null);
                showToast('笔记已更新', 'success');
            }
        } catch (error) {
            console.error('更新笔记失败:', error);
            showToast('更新笔记失败', 'error');
        }
    };
    
    // 处理点击笔记
    const handleNoteClick = (note: BrewingNote) => {
        setEditingNote({
            id: note.id,
            timestamp: note.timestamp,
            equipment: note.equipment,
            method: note.method,
            params: note.params,
            coffeeBeanInfo: note.coffeeBeanInfo || {
                name: '', // 提供默认值
                roastLevel: ''
            },
            rating: note.rating,
            taste: note.taste,
            notes: note.notes,
            totalTime: note.totalTime
        });
    };
    
    // 处理添加笔记
    const handleAddNote = () => {
        if (onAddNote) {
            onAddNote();
        }
    };
    
    // 处理排序选项变化
    const handleSortChange = (option: typeof sortOption) => {
        setSortOption(option);
        saveSortOptionPreference(option);
        globalCache.sortOption = option;
    };
    
    // 处理过滤模式变化
    const handleFilterModeChange = (mode: 'equipment' | 'bean') => {
        setFilterMode(mode);
        saveFilterModePreference(mode);
        globalCache.filterMode = mode;
    };
    
    // 处理设备选择变化
    const handleEquipmentClick = (equipment: string | null) => {
        setSelectedEquipment(equipment);
        saveSelectedEquipmentPreference(equipment);
        globalCache.selectedEquipment = equipment;
    };
    
    // 处理咖啡豆选择变化
    const handleBeanClick = (bean: string | null) => {
        setSelectedBean(bean);
        saveSelectedBeanPreference(bean);
        globalCache.selectedBean = bean;
    };
    
    // 处理笔记选择/取消选择
    const handleToggleSelect = (noteId: string, enterShareMode = false) => {
        // 如果需要进入分享模式
        if (enterShareMode && !isShareMode) {
            setIsShareMode(true);
            setSelectedNotes([noteId]);
            return;
        }
        
        // 在已有选择中切换选中状态
        setSelectedNotes(prev => {
            if (prev.includes(noteId)) {
                return prev.filter(id => id !== noteId);
            } else {
                return [...prev, noteId];
            }
        });
    };
    
    // 取消分享模式
    const handleCancelShare = () => {
        setIsShareMode(false);
        setSelectedNotes([]);
    };
    
    // 保存并分享笔记截图
    const handleSaveNotes = async () => {
        if (selectedNotes.length === 0 || isSaving) return;
        
        setIsSaving(true);
        
        try {
            // 调用导出组件函数
            await exportSelectedNotes({
                selectedNotes,
                notesContainerRef,
                onSuccess: (message) => showToast(message, 'success'),
                onError: (message) => showToast(message, 'error'),
                onComplete: () => {
                    setIsSaving(false);
                    handleCancelShare();
                }
            });
        } catch (error) {
            console.error('导出笔记失败:', error);
            showToast('导出笔记失败', 'error');
            setIsSaving(false);
        }
    };
    
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
                                    ? (globalCache.filteredNotes.length === globalCache.notes.length
                                        ? `${globalCache.notes.length} 条记录，已消耗 ${formatConsumption(globalCache.totalConsumption || totalCoffeeConsumption.current)}`
                                        : `${globalCache.filteredNotes.length}/${globalCache.notes.length} 条记录，已消耗 ${formatConsumption(globalCache.totalConsumption || totalCoffeeConsumption.current)}`)
                                    : `${globalCache.notes.length} 条记录，已消耗 ${formatConsumption(globalCache.totalConsumption || totalCoffeeConsumption.current)}`}
                            </div>
                            <SortSelector sortOption={sortOption} onSortChange={handleSortChange} />
                        </div>

                        {/* 设备筛选选项卡 */}
                        <FilterTabs
                            filterMode={filterMode}
                            selectedEquipment={selectedEquipment}
                            selectedBean={selectedBean}
                            availableEquipments={globalCache.availableEquipments}
                            availableBeans={globalCache.availableBeans}
                            equipmentNames={globalCache.equipmentNames}
                            onFilterModeChange={handleFilterModeChange}
                            onEquipmentClick={handleEquipmentClick}
                            onBeanClick={handleBeanClick}
                        />
                    </div>

                    <div className="w-full h-full overflow-y-auto scroll-with-bottom-bar" ref={notesContainerRef}>
                        {/* 笔记列表视图 */}
                        <ListView
                            sortOption={sortOption}
                            selectedEquipment={selectedEquipment}
                            selectedBean={selectedBean}
                            filterMode={filterMode}
                            onNoteClick={handleNoteClick}
                            onDeleteNote={handleDelete}
                            isShareMode={isShareMode}
                            selectedNotes={selectedNotes}
                            onToggleSelect={handleToggleSelect}
                        />
                    </div>

                    {/* 底部操作栏 - 分享模式下显示保存和取消按钮 */}
                    {isShareMode ? (
                        <div className="bottom-action-bar">
                            <div className="absolute bottom-full left-0 right-0 h-12 bg-gradient-to-t from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
                            <div className="relative max-w-[500px] mx-auto flex items-center bg-neutral-50 dark:bg-neutral-900 pb-safe-bottom">
                                <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
                                <button
                                    onClick={handleCancelShare}
                                    className="flex items-center justify-center text-[11px] text-neutral-800 dark:text-neutral-100 hover:opacity-80 mx-3"
                                >
                                    取消
                                </button>
                                <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
                                <button
                                    onClick={handleSaveNotes}
                                    disabled={selectedNotes.length === 0 || isSaving}
                                    className={`flex items-center justify-center text-[11px] text-neutral-800 dark:text-neutral-100 hover:opacity-80 mx-3 ${
                                        (selectedNotes.length === 0 || isSaving) ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                >
                                    {isSaving ? '生成中...' : `保存为图片 (${selectedNotes.length})`}
                                </button>
                                <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
                            </div>
                        </div>
                        
                    ) : (
                        <AddNoteButton onAddNote={handleAddNote} />
                    )}
                </>
            )}

            {/* 消息提示 */}
            <Toast
                visible={toast.visible}
                message={toast.message}
                type={toast.type}
            />
        </div>
    );
};

export default BrewingHistory; 