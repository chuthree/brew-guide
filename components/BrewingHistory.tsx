'use client'

import React, { useState, useEffect, useCallback } from 'react'
import type { BrewingNote } from '@/lib/config'
import type { BrewingNoteData, CoffeeBean } from '@/app/types'
import type { Method } from '@/lib/config'
import BrewingNoteForm from './BrewingNoteForm'
import { Storage } from '@/lib/storage'
import { equipmentList } from '@/lib/config'
import { getEquipmentName as getEquipmentNameUtil } from '@/lib/brewing/parameters'
import ActionMenu from './ui/action-menu'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from './ui/select'

// 消息提示状态接口
interface ToastState {
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
}

// 为Window对象声明类型扩展
declare global {
    interface Window {
        refreshBrewingNotes?: () => void;
    }
}

// 排序类型定义
const SORT_OPTIONS = {
    TIME_DESC: 'time_desc',
    TIME_ASC: 'time_asc',
    RATING_DESC: 'rating_desc',
    RATING_ASC: 'rating_asc',
} as const;

type SortOption = typeof SORT_OPTIONS[keyof typeof SORT_OPTIONS];

// 排序选项的显示名称
const SORT_LABELS: Record<SortOption, string> = {
    [SORT_OPTIONS.TIME_DESC]: '时间',
    [SORT_OPTIONS.TIME_ASC]: '时间',
    [SORT_OPTIONS.RATING_DESC]: '评分',
    [SORT_OPTIONS.RATING_ASC]: '评分',
};

interface BrewingHistoryProps {
    isOpen: boolean
    onClose: () => void
    onOptimizingChange?: (isOptimizing: boolean) => void
    onNavigateToBrewing?: (note: BrewingNote) => void
    onAddNote?: () => void
}

const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
    })
}

const formatRating = (rating: number) => {
    return `[ ${rating}/5 ]`
}

// 获取设备名称的辅助函数
const getEquipmentName = async (equipmentId: string): Promise<string> => {
    // 首先尝试在标准设备列表中查找
    const standardEquipment = equipmentList.find(e => e.id === equipmentId);
    if (standardEquipment) return standardEquipment.name;

    // 如果没找到，加载自定义设备列表并查找
    try {
        const { loadCustomEquipments } = await import('@/lib/customEquipments');
        const customEquipments = await loadCustomEquipments();

        // 使用工具函数获取设备名称
        const equipmentName = getEquipmentNameUtil(equipmentId, equipmentList, customEquipments);
        return equipmentName || equipmentId;
    } catch (error) {
        console.error('加载自定义设备失败:', error);
        return equipmentId; // 出错时返回原始ID
    }
};

const BrewingHistory: React.FC<BrewingHistoryProps> = ({ isOpen, onOptimizingChange, onNavigateToBrewing, onAddNote }) => {
    const [notes, setNotes] = useState<BrewingNote[]>([])
    const [sortOption, setSortOption] = useState<SortOption>(SORT_OPTIONS.TIME_DESC)
    const [optimizingNote, setOptimizingNote] = useState<(Partial<BrewingNoteData> & { coffeeBean?: CoffeeBean | null }) | null>(null)
    const [editingNote, setEditingNote] = useState<(Partial<BrewingNoteData> & { coffeeBean?: CoffeeBean | null }) | null>(null)
    const [forceRefreshKey, setForceRefreshKey] = useState(0); // 添加一个强制刷新的key
    const [toast, setToast] = useState<ToastState>({ visible: false, message: '', type: 'info' });
    // 添加设备名称缓存状态
    const [equipmentNames, setEquipmentNames] = useState<Record<string, string>>({});
    // 添加筛选状态
    const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
    const [availableEquipments, setAvailableEquipments] = useState<string[]>([]);
    const [filteredNotes, setFilteredNotes] = useState<BrewingNote[]>([]);
    // 添加新的状态
    const [filterMode, setFilterMode] = useState<'equipment' | 'bean'>('equipment');
    const [selectedBean, setSelectedBean] = useState<string | null>(null);
    const [availableBeans, setAvailableBeans] = useState<string[]>([]);

    // 显示消息提示
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ visible: true, message, type });
        setTimeout(() => {
            setToast(prev => ({ ...prev, visible: false }));
        }, 3000);
    };

    // 排序笔记的函数，用useCallback包装以避免无限渲染
    const sortNotes = useCallback((notesToSort: BrewingNote[]): BrewingNote[] => {
        switch (sortOption) {
            case SORT_OPTIONS.TIME_DESC:
                return [...notesToSort].sort((a, b) => b.timestamp - a.timestamp)
            case SORT_OPTIONS.TIME_ASC:
                return [...notesToSort].sort((a, b) => a.timestamp - b.timestamp)
            case SORT_OPTIONS.RATING_DESC:
                return [...notesToSort].sort((a, b) => b.rating - a.rating)
            case SORT_OPTIONS.RATING_ASC:
                return [...notesToSort].sort((a, b) => a.rating - b.rating)
            default:
                return notesToSort
        }
    }, [sortOption])

    // 加载笔记的函数 - 使用useCallback包装
    const loadNotes = useCallback(async () => {
        try {
            const savedNotes = await Storage.get('brewingNotes');
            const parsedNotes = savedNotes ? JSON.parse(savedNotes) : [];
            const sortedNotes = sortNotes(parsedNotes);
            setNotes(sortedNotes);

            // 收集所有设备ID和咖啡豆
            const equipmentIds = Array.from(new Set(sortedNotes.map(note => note.equipment)));
            const beanNames = Array.from(new Set(sortedNotes
                .map(note => note.coffeeBeanInfo?.name)
                .filter((name): name is string => name !== undefined && name !== null && name !== '')
            ));
            
            setAvailableEquipments(equipmentIds);
            setAvailableBeans(beanNames);

            // 根据当前筛选模式过滤笔记
            let filtered = sortedNotes;
            if (filterMode === 'equipment' && selectedEquipment) {
                filtered = filtered.filter(note => note.equipment === selectedEquipment);
            } else if (filterMode === 'bean' && selectedBean) {
                filtered = filtered.filter(note => note.coffeeBeanInfo?.name === selectedBean);
            }
            setFilteredNotes(filtered);

            // 加载所有设备的名称
            const namesMap: Record<string, string> = {};
            for (const id of equipmentIds) {
                if (id) {
                    namesMap[id] = await getEquipmentName(id);
                }
            }
            setEquipmentNames(namesMap);
        } catch (_error) {
            setNotes([]);
            setFilteredNotes([]);
            setAvailableEquipments([]);
            setAvailableBeans([]);
        }
    }, [sortOption, sortNotes, filterMode, selectedEquipment, selectedBean]);

    // 当isOpen状态变化时重新加载数据
    useEffect(() => {
        if (isOpen) {
            loadNotes();
        }
    }, [isOpen, loadNotes]);

    // 强制刷新的效果
    useEffect(() => {
        loadNotes();
    }, [forceRefreshKey, loadNotes]);

    // 添加本地存储变化监听
    useEffect(() => {
        // 立即加载，不管是否显示
        loadNotes();

        // 监听其他标签页的存储变化（仅在 Web 平台有效）
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'brewingNotes') {
                loadNotes();
            }
        };

        // 监听自定义的storage:changed事件，用于同一页面内的通信
        const handleCustomStorageChange = (e: CustomEvent) => {
            if (e.detail && e.detail.key === 'brewingNotes') {
                loadNotes();
                // 强制刷新
                setForceRefreshKey(prev => prev + 1);
            }
        };

        // 创建更通用的刷新函数以便外部可以调用
        const refreshList = () => {
            loadNotes();
            setForceRefreshKey(prev => prev + 1);
        };

        // 挂载到window对象上，使其可以从任何位置调用
        window.refreshBrewingNotes = refreshList;

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('storage:changed', handleCustomStorageChange as EventListener);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('storage:changed', handleCustomStorageChange as EventListener);
            // 清理window上的引用
            delete window.refreshBrewingNotes;
        };
    }, [loadNotes]);

    useEffect(() => {
        // 当排序选项变化时，重新排序笔记
        setNotes(prevNotes => {
            const sorted = sortNotes([...prevNotes]);
            // 更新筛选后的笔记
            updateFilteredNotes(sorted);
            return sorted;
        });
    }, [sortOption, sortNotes]);

    // 更新筛选后的笔记
    const updateFilteredNotes = useCallback((notesToFilter: BrewingNote[]) => {
        if (filterMode === 'equipment' && selectedEquipment) {
            setFilteredNotes(notesToFilter.filter(note => note.equipment === selectedEquipment));
        } else if (filterMode === 'bean' && selectedBean) {
            setFilteredNotes(notesToFilter.filter(note => note.coffeeBeanInfo?.name === selectedBean));
        } else {
            setFilteredNotes(notesToFilter);
        }
    }, [selectedEquipment, selectedBean, filterMode]);

    // 当选择的设备或咖啡豆变化时，更新筛选后的笔记
    useEffect(() => {
        updateFilteredNotes(notes);
    }, [selectedEquipment, selectedBean, filterMode, notes, updateFilteredNotes]);

    const handleDelete = async (noteId: string) => {
        if (window.confirm('确定要删除这条笔记吗？')) {
            try {
                const updatedNotes = notes.filter(note => note.id !== noteId)
                await Storage.set('brewingNotes', JSON.stringify(updatedNotes))
                const sortedNotes = sortNotes(updatedNotes);
                setNotes(sortedNotes);

                // 更新设备名称缓存，移除不再使用的设备
                const remainingEquipmentIds = Array.from(new Set(sortedNotes.map(note => note.equipment)));
                const updatedEquipmentNames = { ...equipmentNames };

                // 移除不再使用的设备名称
                Object.keys(updatedEquipmentNames).forEach(id => {
                    if (!remainingEquipmentIds.includes(id)) {
                        delete updatedEquipmentNames[id];
                    }
                });

                setEquipmentNames(updatedEquipmentNames);
            } catch {
                // 删除失败时提示用户
                showToast('删除笔记时出错，请重试', 'error');
            }
        }
    }

    const handleSaveEdit = async (updatedData: BrewingNoteData) => {
        try {
            const existingNotesStr = await Storage.get('brewingNotes');
            const existingNotes = existingNotesStr ? JSON.parse(existingNotesStr) : [];

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
                );

                await Storage.set('brewingNotes', JSON.stringify(updatedNotes));
                const sortedNotes = sortNotes(updatedNotes);
                setNotes(sortedNotes);

                // 更新设备名称缓存
                if (updatedData.equipment) {
                    const equipmentName = await getEquipmentName(updatedData.equipment as string);
                    setEquipmentNames(prev => ({
                        ...prev,
                        [updatedData.equipment as string]: equipmentName
                    }));
                }

                setEditingNote(null);
                showToast('笔记已更新', 'success');
            }
            else {
                const newNote = {
                    ...updatedData,
                    id: Date.now().toString(),
                    timestamp: Date.now()
                };

                const updatedNotes = [newNote, ...existingNotes];
                await Storage.set('brewingNotes', JSON.stringify(updatedNotes));
                const sortedNotes = sortNotes(updatedNotes);
                setNotes(sortedNotes);

                // 更新设备名称缓存
                if (newNote.equipment) {
                    const equipmentName = await getEquipmentName(newNote.equipment as string);
                    setEquipmentNames(prev => ({
                        ...prev,
                        [newNote.equipment as string]: equipmentName
                    }));
                }

                showToast('笔记已保存', 'success');
            }
        } catch (error) {
            console.error('保存笔记失败:', error);
            // 保存失败时提示用户
            showToast('保存笔记时出错，请重试', 'error');
        }
    };

    // 修改新建笔记处理函数
    const handleAddNote = () => {
        if (onAddNote) {
            onAddNote();
        }
    }

    // 处理点击方案名称跳转到冲煮页面
    const handleMethodClick = (note: BrewingNote, e: React.MouseEvent) => {
        e.stopPropagation(); // 防止冒泡

        // 添加标记，表明是从方法点击
        localStorage.setItem("clickedFromMethod", "true");

        // 记录点击的方法名
        localStorage.setItem("clickedMethodName", note.method || "");

        // 从localStorage获取自定义方案数据
        const customMethodsStr = localStorage.getItem("customMethods");
        console.log("当前笔记方案信息:", {
            method: note.method,
            equipment: note.equipment
        });

        if (customMethodsStr) {
            try {
                const customMethods = JSON.parse(customMethodsStr);
                console.log("当前设备自定义方案:", note.equipment ? customMethods[note.equipment] : "无");

                // 如果是自定义方案，记录方案ID
                if (note.equipment && customMethods[note.equipment]) {
                    const customMethod = customMethods[note.equipment].find((m: Method) => m.name === note.method);
                    if (customMethod && customMethod.id) {
                        localStorage.setItem("clickedMethodId", customMethod.id);
                    }
                }
            } catch {
                // 忽略解析错误
            }
        }

        // 跳转到冲煮页面
        if (onNavigateToBrewing) {
            onNavigateToBrewing(note);
        }
    }

    // 添加咖啡豆筛选处理函数
    const handleBeanClick = useCallback((beanName: string | null) => {
        setSelectedBean(beanName);
        if (beanName === null) {
            setFilteredNotes(notes);
        } else {
            setFilteredNotes(notes.filter(note => note.coffeeBeanInfo?.name === beanName));
        }
    }, [notes]);

    // 更新设备筛选处理函数
    const handleEquipmentClick = useCallback((equipment: string | null) => {
        setSelectedEquipment(equipment);
        if (equipment === null) {
            setFilteredNotes(notes);
        } else {
            setFilteredNotes(notes.filter(note => note.equipment === equipment));
        }
    }, [notes]);

    // 添加筛选模式切换处理函数
    const handleFilterModeChange = useCallback((mode: 'equipment' | 'bean') => {
        setFilterMode(mode);
        // 重置选择状态
        setSelectedEquipment(null);
        setSelectedBean(null);
        setFilteredNotes(notes);
    }, [notes]);

    if (!isOpen) return null

    return (
        <div className="h-full flex flex-col">
            {editingNote ? (
                <div className="h-full p-6 brewing-form">
                    <BrewingNoteForm
                        id={editingNote.id}
                        isOpen={true}
                        onClose={() => setEditingNote(null)}
                        onSave={handleSaveEdit}
                        initialData={editingNote}
                    />
                </div>
            ) : optimizingNote ? (
                <div className="h-full p-6 brewing-form">
                    <button
                        data-action="back"
                        onClick={() => {
                            setOptimizingNote(null)
                            if (onOptimizingChange) {
                                onOptimizingChange(false)
                            }
                        }}
                        className="hidden"
                    />
                    <BrewingNoteForm
                        id={optimizingNote.id}
                        isOpen={true}
                        onClose={() => {
                            setOptimizingNote(null)
                            if (onOptimizingChange) {
                                onOptimizingChange(false)
                            }
                        }}
                        onSave={(updatedData) => {
                            // 保存更新后的笔记
                            handleSaveEdit(updatedData);
                            // 关闭优化模式
                            setOptimizingNote(null);
                            if (onOptimizingChange) {
                                onOptimizingChange(false);
                            }
                        }}
                        initialData={optimizingNote}
                        showOptimizationByDefault={true}
                    />
                </div>
            ) : (
                <>
                    <div className="pt-6 space-y-6 sticky top-0 bg-neutral-50 dark:bg-neutral-900 z-20">
                        {/* 排序控件和数量显示 */}
                        <div className="flex justify-between items-center mb-6 px-6">
                            <div className="text-xs tracking-wide text-neutral-800 dark:text-white">
                                {selectedEquipment 
                                    ? `${filteredNotes.length}/${notes.length} 条记录` 
                                    : `${notes.length} 条记录`}
                            </div>
                            <Select
                                value={sortOption}
                                onValueChange={(value) => setSortOption(value as SortOption)}
                            >
                                <SelectTrigger
                                    variant="minimal"
                                    className="w-auto min-w-[65px] tracking-wide text-neutral-800 dark:text-white transition-colors hover:opacity-80 text-right"
                                >
                                    <div className="flex items-center justify-end w-full">
                                        {SORT_LABELS[sortOption]}
                                        {!sortOption.includes('desc') ? (
                                            <svg className="w-3 h-3 ml-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="4" y1="6" x2="11" y2="6" />
                                                <line x1="4" y1="12" x2="11" y2="12" />
                                                <line x1="4" y1="18" x2="13" y2="18" />
                                                <polyline points="15 15 18 18 21 15" />
                                                <line x1="18" y1="6" x2="18" y2="18" />
                                            </svg>
                                        ) : (
                                            <svg className="w-3 h-3 ml-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="4" y1="6" x2="11" y2="6" />
                                                <line x1="4" y1="12" x2="11" y2="12" />
                                                <line x1="4" y1="18" x2="13" y2="18" />
                                                <polyline points="15 9 18 6 21 9" />
                                                <line x1="18" y1="6" x2="18" y2="18" />
                                            </svg>
                                        )}
                                    </div>
                                </SelectTrigger>
                                <SelectContent
                                    position="popper"
                                    sideOffset={5}
                                    className="border-neutral-200/70 dark:border-neutral-800/70 shadow-lg backdrop-blur-sm bg-white/95 dark:bg-neutral-900/95 rounded-lg overflow-hidden"
                                >
                                    {Object.values(SORT_OPTIONS).map((value) => (
                                        <SelectItem
                                            key={value}
                                            value={value}
                                            className="tracking-wide text-neutral-800 dark:text-white data-[highlighted]:opacity-80 transition-colors"
                                        >
                                            <div className="flex items-center justify-between w-full">
                                                <span>{SORT_LABELS[value].split(' ')[0]}</span>
                                                {!value.includes('desc') ? (
                                                    <svg className="w-3 h-3 ml-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="4" y1="6" x2="11" y2="6" />
                                                        <line x1="4" y1="12" x2="11" y2="12" />
                                                        <line x1="4" y1="18" x2="13" y2="18" />
                                                        <polyline points="15 15 18 18 21 15" />
                                                        <line x1="18" y1="6" x2="18" y2="18" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-3 h-3 ml-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="4" y1="6" x2="11" y2="6" />
                                                        <line x1="4" y1="12" x2="11" y2="12" />
                                                        <line x1="4" y1="18" x2="13" y2="18" />
                                                        <polyline points="15 9 18 6 21 9" />
                                                        <line x1="18" y1="6" x2="18" y2="18" />
                                                    </svg>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 设备筛选选项卡 */}
                        {(availableEquipments.length > 0 || availableBeans.length > 0) && (
                            <div className="relative">
                                <div className="border-b border-neutral-200 dark:border-neutral-800 px-6 relative">
                                    <div className="flex overflow-x-auto no-scrollbar pr-14">
                                        {filterMode === 'equipment' ? (
                                            <>
                                                <button
                                                    onClick={() => handleEquipmentClick(null)}
                                                    className={`pb-1.5 mr-3 text-[11px] whitespace-nowrap relative ${selectedEquipment === null ? 'text-neutral-800 dark:text-white' : 'text-neutral-600 dark:text-neutral-400'}`}
                                                >
                                                    <span className="relative">全部记录</span>
                                                    {selectedEquipment === null && (
                                                        <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                                    )}
                                                </button>
                                                {availableEquipments.map(equipment => (
                                                    <button
                                                        key={equipment}
                                                        onClick={() => handleEquipmentClick(equipment)}
                                                        className={`pb-1.5 mx-3 text-[11px] whitespace-nowrap relative ${selectedEquipment === equipment ? 'text-neutral-800 dark:text-white' : 'text-neutral-600 dark:text-neutral-400'}`}
                                                    >
                                                        <span className="relative">{equipmentNames[equipment] || equipment}</span>
                                                        {selectedEquipment === equipment && (
                                                            <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                                        )}
                                                    </button>
                                                ))}
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleBeanClick(null)}
                                                    className={`pb-1.5 mr-3 text-[11px] whitespace-nowrap relative ${selectedBean === null ? 'text-neutral-800 dark:text-white' : 'text-neutral-600 dark:text-neutral-400'}`}
                                                >
                                                    <span className="relative">全部记录</span>
                                                    {selectedBean === null && (
                                                        <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                                    )}
                                                </button>
                                                {availableBeans.map(bean => (
                                                    <button
                                                        key={bean}
                                                        onClick={() => handleBeanClick(bean)}
                                                        className={`pb-1.5 mx-3 text-[11px] whitespace-nowrap relative ${selectedBean === bean ? 'text-neutral-800 dark:text-white' : 'text-neutral-600 dark:text-neutral-400'}`}
                                                    >
                                                        <span className="relative">{bean}</span>
                                                        {selectedBean === bean && (
                                                            <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                                                        )}
                                                    </button>
                                                ))}
                                            </>
                                        )}
                                    </div>

                                    {/* 筛选模式切换按钮 - 固定在右侧 */}
                                    <div className="absolute right-6 top-0 bottom-0 flex items-center bg-gradient-to-l from-neutral-50 via-neutral-50 to-transparent dark:from-neutral-900 dark:via-neutral-900 pl-6">
                                        <button
                                            onClick={() => handleFilterModeChange(filterMode === 'equipment' ? 'bean' : 'equipment')}
                                            className={`pb-1.5 text-[11px] whitespace-nowrap relative text-neutral-800 dark:text-white font-normal`}
                                        >
                                            <span className="relative mr-1">{filterMode === 'equipment' ? '器具' : '咖啡豆'}</span>
                                            <span className="relative">/</span>

                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-hidden">
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
                                    {filteredNotes.map((note, index) => (
                                        <div
                                            key={note.id}
                                            className={`group space-y-3 px-6 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900/70 ${index === filteredNotes.length - 1 ? '' : 'border-b border-neutral-200 dark:border-neutral-800'}`}
                                        >
                                            <div className="flex flex-col space-y-3">
                                                {/* 标题和操作菜单 */}
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[11px] font-normal break-words text-neutral-800 dark:text-white pr-2">
                                                            {note.coffeeBeanInfo?.name ? (
                                                                <>
                                                                    {note.coffeeBeanInfo.name}
                                                                    <span className="text-neutral-600 dark:text-neutral-400 mx-1">·</span>
                                                                    <button
                                                                        onClick={(e) => handleMethodClick(note, e)}
                                                                        className="hover:text-neutral-800 dark:hover:text-white transition-colors"
                                                                    >
                                                                        {note.method}
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {equipmentNames[note.equipment] || note.equipment}
                                                                    <span className="text-neutral-600 dark:text-neutral-400 mx-1">·</span>
                                                                    <button
                                                                        onClick={(e) => handleMethodClick(note, e)}
                                                                        className="hover:text-neutral-800 dark:hover:text-white transition-colors"
                                                                    >
                                                                        {note.method}
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex-shrink-0 ml-1 relative">
                                                        <ActionMenu
                                                            items={[
                                                                {
                                                                    id: 'edit',
                                                                    label: '编辑',
                                                                    onClick: () => {
                                                                        setEditingNote({
                                                                            ...note,
                                                                            coffeeBeanInfo: note.coffeeBeanInfo || undefined
                                                                        });
                                                                    }
                                                                },
                                                                {
                                                                    id: 'optimize',
                                                                    label: '优化',
                                                                    onClick: () => {
                                                                        setOptimizingNote({
                                                                            ...note,
                                                                            coffeeBeanInfo: note.coffeeBeanInfo || undefined
                                                                        });
                                                                        if (onOptimizingChange) {
                                                                            onOptimizingChange(true);
                                                                        }
                                                                    }
                                                                },
                                                                {
                                                                    id: 'delete',
                                                                    label: '删除',
                                                                    onClick: () => handleDelete(note.id),
                                                                    color: 'danger'
                                                                }
                                                            ]}
                                                        />
                                                    </div>
                                                </div>

                                                {/* 方案信息 */}
                                                <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400 space-x-1">
                                                    {note.coffeeBeanInfo?.name && (
                                                        <>
                                                            <span>{equipmentNames[note.equipment] || note.equipment}</span>
                                                            <span>·</span>
                                                        </>
                                                    )}
                                                    {note.params && (
                                                        <>
                                                            <span>{note.params.coffee}</span>
                                                            <span>·</span>
                                                            <span>{note.params.ratio}</span>

                                                            {/* 合并显示研磨度和水温 */}
                                                            {(note.params.grindSize || note.params.temp) && (
                                                                <>
                                                                    <span>·</span>
                                                                    {note.params.grindSize && note.params.temp ? (
                                                                        <span>{note.params.grindSize} · {note.params.temp}</span>
                                                                    ) : (
                                                                        <span>{note.params.grindSize || note.params.temp}</span>
                                                                    )}
                                                                </>
                                                            )}
                                                        </>
                                                    )}
                                                </div>

                                                {/* 风味评分 */}
                                                <div className="grid grid-cols-2 gap-4">
                                                    {Object.entries(note.taste).map(([key, value], _i) => (
                                                        <div key={key} className="space-y-1">
                                                            <div className="flex items-center justify-between">
                                                                <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                                                    {(() => {
                                                                        switch (key) {
                                                                            case 'acidity':
                                                                                return '酸度';
                                                                            case 'sweetness':
                                                                                return '甜度';
                                                                            case 'bitterness':
                                                                                return '苦度';
                                                                            case 'body':
                                                                                return '醇度';
                                                                            default:
                                                                                return key;
                                                                        }
                                                                    })()}
                                                                </div>
                                                                <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                                                    {value}
                                                                </div>
                                                            </div>
                                                            <div className="h-px w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800">
                                                                <div
                                                                    style={{ width: `${(value / 5) * 100}%` }}
                                                                    className="h-full bg-neutral-800 dark:bg-neutral-100"
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* 时间和评分 */}
                                                <div className="flex items-baseline justify-between">
                                                    <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                                        {formatDate(note.timestamp)}
                                                    </div>
                                                    <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                                        {formatRating(note.rating)}
                                                    </div>
                                                </div>

                                                {/* 备注信息 */}
                                                {note.notes && (
                                                    <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                                        {note.notes}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 添加笔记按钮 */}
                    <div className="bottom-action-bar">
                        <div className="absolute bottom-full left-0 right-0 h-12 bg-gradient-to-t from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
                        <div className="relative max-w-[500px] mx-auto flex items-center bg-neutral-50 dark:bg-neutral-900 py-4">
                            <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
                            <button
                                onClick={handleAddNote}
                                className="flex items-center justify-center text-[11px] text-neutral-800 dark:text-white hover:opacity-80 mx-3"
                            >
                                <span className="mr-1">+</span> 添加笔记
                            </button>
                            <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
                        </div>
                    </div>
                </>
            )}

            {/* Toast消息组件 */}
            {toast.visible && (
                <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-md shadow-lg text-sm transition-opacity duration-300 ease-in-out bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                    <div className={`text-center ${toast.type === 'error' ? 'text-red-500 dark:text-red-400' : toast.type === 'success' ? 'text-emerald-600 dark:text-emerald-500' : 'text-neutral-800 dark:text-white'}`}>
                        {toast.message}
                    </div>
                </div>
            )}
        </div>
    )
}

export default BrewingHistory