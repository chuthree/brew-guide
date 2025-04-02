'use client'

import React, { useState, useEffect, useCallback } from 'react'
import type { BrewingNote } from '@/lib/config'
import type { BrewingNoteData, CoffeeBean } from '@/app/types'
import BrewingNoteForm from './BrewingNoteForm'
import { Storage } from '@/lib/storage'
import { equipmentList } from '@/lib/config'
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

// 添加计算天数差的辅助函数
const calculateDaysAfterRoast = (roastDate: string, brewDate: number): string => {
    const roast = new Date(roastDate);
    const brew = new Date(brewDate);
    const diffTime = Math.abs(brew.getTime() - roast.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '烘焙当天';
    if (diffDays === 1) return '烘焙1天后';
    return `烘焙${diffDays}天后`;
}

const formatRating = (rating: number) => {
    return `[ ${rating}/5 ]`
}

// 获取设备名称的辅助函数
const getEquipmentName = (equipmentId: string): string => {
    const equipment = equipmentList.find(e => e.id === equipmentId);
    return equipment ? equipment.name : equipmentId; // 如果找不到匹配的设备，则返回原始ID
};

const BrewingHistory: React.FC<BrewingHistoryProps> = ({ isOpen, onOptimizingChange, onNavigateToBrewing, onAddNote }) => {
    const [notes, setNotes] = useState<BrewingNote[]>([])
    const [sortOption, setSortOption] = useState<SortOption>(SORT_OPTIONS.TIME_DESC)
    const [optimizingNote, setOptimizingNote] = useState<(Partial<BrewingNoteData> & { coffeeBean?: CoffeeBean | null }) | null>(null)
    const [editingNote, setEditingNote] = useState<(Partial<BrewingNoteData> & { coffeeBean?: CoffeeBean | null }) | null>(null)
    const [forceRefreshKey, setForceRefreshKey] = useState(0); // 添加一个强制刷新的key
    const [toast, setToast] = useState<ToastState>({ visible: false, message: '', type: 'info' });

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
            setNotes(sortNotes(parsedNotes));
        } catch (_error) {
            // 加载失败时设置空数组
            setNotes([]);
        }
    }, [sortOption, sortNotes]);

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
        setNotes(prevNotes => sortNotes([...prevNotes]))
    }, [sortOption, sortNotes])

    const handleDelete = async (noteId: string) => {
        if (window.confirm('确定要删除这条笔记吗？')) {
            try {
                const updatedNotes = notes.filter(note => note.id !== noteId)
                await Storage.set('brewingNotes', JSON.stringify(updatedNotes))
                setNotes(sortNotes(updatedNotes))
            } catch {
                // 删除失败时提示用户
                showToast('删除笔记时出错，请重试', 'error');
            }
        }
    }

    const handleEdit = (note: BrewingNote) => {
        const formattedNote: Partial<BrewingNoteData> & { coffeeBean?: CoffeeBean | null } = {
            id: note.id,
            timestamp: note.timestamp,
            coffeeBeanInfo: {
                name: note.coffeeBeanInfo?.name || '',
                roastLevel: note.coffeeBeanInfo?.roastLevel || '中度烘焙',
                roastDate: note.coffeeBeanInfo?.roastDate || '',
            },
            rating: note.rating || 3,
            taste: {
                acidity: note.taste?.acidity || 3,
                sweetness: note.taste?.sweetness || 3,
                bitterness: note.taste?.bitterness || 3,
                body: note.taste?.body || 3,
            },
            notes: note.notes || '',
            equipment: note.equipment,
            method: note.method,
            params: note.params,
            totalTime: note.totalTime,
        }
        setEditingNote(formattedNote)
    }

    const handleOptimize = (note: BrewingNote) => {
        const formattedNote: Partial<BrewingNoteData> & { coffeeBean?: CoffeeBean | null } = {
            id: note.id,
            timestamp: note.timestamp,
            coffeeBeanInfo: {
                name: note.coffeeBeanInfo?.name || '',
                roastLevel: note.coffeeBeanInfo?.roastLevel || '中度烘焙',
                roastDate: note.coffeeBeanInfo?.roastDate || '',
            },
            rating: note.rating || 3,
            taste: {
                acidity: note.taste?.acidity || 3,
                sweetness: note.taste?.sweetness || 3,
                bitterness: note.taste?.bitterness || 3,
                body: note.taste?.body || 3,
            },
            notes: note.notes || '',
            equipment: note.equipment,
            method: note.method,
            params: note.params,
            totalTime: note.totalTime,
        }
        setOptimizingNote(formattedNote)
        if (onOptimizingChange) {
            onOptimizingChange(true)
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
                setNotes(sortNotes(updatedNotes));
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
                setNotes(sortNotes(updatedNotes));
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

                // 检查note.equipment是否存在，并且其对应的设备下是否有此方案
                if (note.equipment && customMethods[note.equipment]) {
                    // 检查设备对应的自定义方案列表中是否有匹配项
                    const methodName = note.method || "";
                    const isCustomMethod = customMethods[note.equipment].some(
                        (method: { name: string; id?: string; params: Record<string, string> }) =>
                            method.name === methodName
                    );

                    // 存储方案类型 - 直接设置为forceNavigationMethodType
                    const methodType = isCustomMethod ? "custom" : "common";
                    localStorage.setItem("forceNavigationMethodType", methodType);
                    console.log("方案类型判断:", methodType, "- 直接设置为forceNavigationMethodType");

                    // 关键修复：确保自定义方案导航有正确的步骤标识
                    if (isCustomMethod) {
                        // 设置完成后直接进入导航流程，使用 start 作为初始步骤
                        localStorage.setItem("navigationStep", "start");
                    }
                } else {
                    console.log("无法在自定义方案中找到匹配设备:", note.equipment);
                    localStorage.setItem("forceNavigationMethodType", "common");
                    // 确保设置了导航步骤
                    localStorage.setItem("navigationStep", "start");
                }
            } catch (error) {
                console.error("解析自定义方案出错:", error);
                localStorage.setItem("forceNavigationMethodType", "common"); // 出错时默认为通用方案
                localStorage.setItem("navigationStep", "start");
            }
        } else {
            console.log("没有自定义方案记录，默认为通用方案");
            localStorage.setItem("forceNavigationMethodType", "common");
            localStorage.setItem("navigationStep", "start");
        }

        if (onNavigateToBrewing) {
            onNavigateToBrewing(note);
        }
    }

    if (!isOpen) return null

    return (
        <div>
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
                <div className="space-y-5 scroll-with-bottom-bar brewing-form">
                    <div className="p-6 space-y-6">
                        {/* 排序控件和数量显示 */}
                        <div className="flex justify-between items-center mb-6">
                            <div className="text-xs tracking-wide text-neutral-800 dark:text-white">
                                共 {notes.length} 条记录
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

                        {/* 笔记列表 */}
                        {notes.length === 0 ? (
                            <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                [ 暂无冲煮记录 ]
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {notes.map((note, _index) => (
                                    <div
                                        key={note.id}
                                        className="group space-y-4 border-l border-neutral-200 dark:border-neutral-800 pl-6"
                                    >
                                        <div className="flex flex-col space-y-4">
                                            <div className="space-y-2">
                                                <div className="flex items-baseline justify-between">
                                                    <div className="flex items-baseline space-x-2 min-w-0 overflow-hidden">
                                                        <div className="text-[10px] truncate text-neutral-800 dark:text-white">
                                                            {getEquipmentName(note.equipment)}
                                                        </div>
                                                        {note.method && (
                                                            <>
                                                                <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400 shrink-0">
                                                                    ·
                                                                </div>
                                                                <div
                                                                    className="text-[10px] font-light tracking-wide truncate cursor-pointer hover:opacity-80 transition-colors group flex items-center text-neutral-800 dark:text-white"
                                                                    onClick={(e) => handleMethodClick(note, e)}
                                                                    title="点击跳转到注水步骤"
                                                                >
                                                                    <span className="border-b border-dashed border-neutral-400 dark:border-neutral-600 group-hover:border-neutral-800 dark:group-hover:border-white">
                                                                        {note.method}
                                                                    </span>
                                                                    <svg
                                                                        className="ml-1 w-3 h-3 opacity-50 group-hover:opacity-100 transition-all"
                                                                        viewBox="0 0 24 24"
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        strokeWidth="2"
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                    >
                                                                        <path d="M5 12h14M12 5l7 7-7 7" />
                                                                    </svg>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>

                                                    <div className="flex items-baseline ml-2 shrink-0">
                                                        <ActionMenu
                                                            items={[
                                                                {
                                                                    id: 'edit',
                                                                    label: '编辑',
                                                                    onClick: () => handleEdit(note),
                                                                    color: 'default'
                                                                },
                                                                {
                                                                    id: 'optimize',
                                                                    label: '优化',
                                                                    onClick: () => handleOptimize(note),
                                                                    color: 'success'
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

                                                <div className="flex flex-wrap gap-2 text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                                    {/* 咖啡豆信息（最重要的信息）*/}
                                                    {note.coffeeBeanInfo?.name && (
                                                        <span>{note.coffeeBeanInfo.name}</span>
                                                    )}
                                                    
                                                    {note.coffeeBeanInfo?.name && note.coffeeBeanInfo?.roastLevel && <span>·</span>}
                                                    
                                                    {note.coffeeBeanInfo?.roastLevel && (
                                                        <span>{note.coffeeBeanInfo.roastLevel}</span>
                                                    )}
                                                    
                                                    {note.coffeeBeanInfo?.roastDate && (
                                                        <>
                                                            <span>·</span>
                                                            <span>{calculateDaysAfterRoast(note.coffeeBeanInfo.roastDate, note.timestamp)}</span>
                                                        </>
                                                    )}
                                                    
                                                    {/* 基本冲煮参数（次重要信息）*/}
                                                    {note.params && (
                                                        <>
                                                            <span>·</span>
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
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                {Object.entries(note.taste).map(([key, value], _i) => (
                                                    <div
                                                        key={key}
                                                        className="space-y-1"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                                                {
                                                                    {
                                                                        acidity: '酸度',
                                                                        sweetness: '甜度',
                                                                        bitterness: '苦度',
                                                                        body: '醇度',
                                                                    }[key]
                                                                }
                                                            </div>
                                                            <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                                                [ {value} ]
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

                                            <div className="flex items-baseline justify-between">
                                                <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                                    {formatDate(note.timestamp)}
                                                </div>
                                                <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                                    {formatRating(note.rating)}
                                                </div>
                                            </div>

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

                    {/* 添加笔记按钮 */}
                    <div className="bottom-action-bar">
                        <div className="absolute bottom-full left-0 right-0 h-12 bg-gradient-to-t from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
                        <div className="relative flex items-center bg-neutral-50 dark:bg-neutral-900 py-4">
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
                </div>
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