'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Storage } from '@/lib/storage'
import { BrewingNote } from '@/lib/config'
import { BrewingHistoryProps, EditingNoteData, ToastState } from '../types'
import SortSelector from './SortSelector'
import FilterTabs from './FilterTabs'
import AddNoteButton from './AddNoteButton'
import Toast from '../ui/Toast'
import { BrewingNoteForm } from '@/components/Notes'
import { BrewingNoteData } from '@/app/types'
import { getEquipmentName, normalizeEquipmentId } from '../utils'
import { globalCache, getSelectedEquipmentPreference, getSelectedBeanPreference, getFilterModePreference, getSortOptionPreference, saveSelectedEquipmentPreference, saveSelectedBeanPreference, saveFilterModePreference, saveSortOptionPreference, calculateTotalCoffeeConsumption, formatConsumption } from './globalCache'
import ListView from './ListView'

// 为Window对象声明类型扩展
declare global {
    interface Window {
        refreshBrewingNotes?: () => void;
    }
}

const BrewingHistory: React.FC<BrewingHistoryProps> = ({ isOpen, onClose: _onClose, onAddNote }) => {
    // 基本状态
    const [sortOption, setSortOption] = useState(globalCache.sortOption)
    const [editingNote, setEditingNote] = useState<EditingNoteData | null>(null)
    const [toast, setToast] = useState<ToastState>({ visible: false, message: '', type: 'info' })
    
    // 过滤状态
    const [filterMode, setFilterMode] = useState<'equipment' | 'bean'>(globalCache.filterMode)
    const [selectedEquipment, setSelectedEquipment] = useState<string | null>(globalCache.selectedEquipment)
    const [selectedBean, setSelectedBean] = useState<string | null>(globalCache.selectedBean)
    
    // 统计状态
    const [totalCoffeeConsumption, setTotalCoffeeConsumption] = useState<number>(0)
    
    // 加载可用设备和咖啡豆列表
    const loadEquipmentsAndBeans = useCallback(async () => {
        try {
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
            
            // 计算总消耗量
            const totalConsumption = calculateTotalCoffeeConsumption(parsedNotes);
            setTotalCoffeeConsumption(totalConsumption);
            
        } catch (error) {
            console.error("加载设备和咖啡豆数据失败:", error);
        }
    }, []);
    
    // 初始化
    useEffect(() => {
        if (isOpen) {
            loadEquipmentsAndBeans();
            
            // 从localStorage读取首选项
            setSortOption(getSortOptionPreference());
            setFilterMode(getFilterModePreference());
            setSelectedEquipment(getSelectedEquipmentPreference());
            setSelectedBean(getSelectedBeanPreference());
        }
    }, [isOpen, loadEquipmentsAndBeans]);
    
    // 监听存储变化
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'brewingNotes' && e.newValue !== null) {
                loadEquipmentsAndBeans();
                
                if (window.refreshBrewingNotes) {
                    window.refreshBrewingNotes();
                }
            }
        };
        
        const handleCustomStorageChange = (e: CustomEvent) => {
            if (e.detail?.key === 'brewingNotes') {
                loadEquipmentsAndBeans();
                
                if (window.refreshBrewingNotes) {
                    window.refreshBrewingNotes();
                }
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
                    return {
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
                        coffeeBeanInfo: updatedData.coffeeBeanInfo 
                            ? {
                                name: updatedData.coffeeBeanInfo.name,
                                roastLevel: updatedData.coffeeBeanInfo.roastLevel,
                                roastDate: updatedData.coffeeBeanInfo.roastDate
                            } 
                            : note.coffeeBeanInfo,
                        rating: updatedData.rating !== undefined ? updatedData.rating : note.rating,
                        taste: updatedData.taste || note.taste,
                        notes: updatedData.notes || note.notes,
                        totalTime: updatedData.totalTime || note.totalTime
                    };
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
            coffeeBeanInfo: note.coffeeBeanInfo,
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
                                    ? `${globalCache.filteredNotes.length}/${globalCache.notes.length} 条记录，已消耗 ${formatConsumption(totalCoffeeConsumption)}` 
                                    : `${globalCache.notes.length} 条记录，已消耗 ${formatConsumption(totalCoffeeConsumption)}`}
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

                    <div className="w-full h-full overflow-y-auto scroll-with-bottom-bar">
                        {/* 笔记列表视图 */}
                        <ListView
                            sortOption={sortOption}
                            selectedEquipment={selectedEquipment}
                            selectedBean={selectedBean}
                            filterMode={filterMode}
                            onNoteClick={handleNoteClick}
                            onDeleteNote={handleDelete}
                        />
                    </div>

                    {/* 添加笔记按钮 */}
                    <AddNoteButton onAddNote={handleAddNote} />
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