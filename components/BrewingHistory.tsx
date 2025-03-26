'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { BrewingNote } from '@/lib/config'
import type { BrewingNoteData, CoffeeBean } from '@/app/types'
import BrewingNoteForm from './BrewingNoteForm'
import BrewingNoteFormModalNew from './BrewingNoteFormModalNew'
import { Storage } from '@/lib/storage'
import { equipmentList } from '@/lib/config'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './ui/select'

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
    [SORT_OPTIONS.TIME_DESC]: '时间 (新→旧)',
    [SORT_OPTIONS.TIME_ASC]: '时间 (旧→新)',
    [SORT_OPTIONS.RATING_DESC]: '评分 (高→低)',
    [SORT_OPTIONS.RATING_ASC]: '评分 (低→高)',
};

interface BrewingHistoryProps {
    isOpen: boolean
    onClose: () => void
    onOptimizingChange?: (isOptimizing: boolean) => void
    onNavigateToBrewing?: (note: BrewingNote) => void
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
const getEquipmentName = (equipmentId: string): string => {
    const equipment = equipmentList.find(e => e.id === equipmentId);
    return equipment ? equipment.name : equipmentId; // 如果找不到匹配的设备，则返回原始ID
};

const BrewingHistory: React.FC<BrewingHistoryProps> = ({ isOpen, onOptimizingChange, onNavigateToBrewing }) => {
    const [notes, setNotes] = useState<BrewingNote[]>([])
    const [sortOption, setSortOption] = useState<SortOption>(SORT_OPTIONS.TIME_DESC)
    const [optimizingNote, setOptimizingNote] = useState<(Partial<BrewingNoteData> & { coffeeBean?: CoffeeBean | null }) | null>(null)
    const [editingNote, setEditingNote] = useState<(Partial<BrewingNoteData> & { coffeeBean?: CoffeeBean | null }) | null>(null)
    const [actionMenuStates, setActionMenuStates] = useState<Record<string, boolean>>({})
    const [showNoteFormModal, setShowNoteFormModal] = useState(false)
    const [currentEditingNote, setCurrentEditingNote] = useState<Partial<BrewingNoteData>>({})

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
            const savedNotes = await Storage.get('brewingNotes')
            const parsedNotes = savedNotes ? JSON.parse(savedNotes) : []
            setNotes(sortNotes(parsedNotes))
        } catch {
            // 加载失败时设置空数组
            setNotes([])
        }
    }, [sortNotes])

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

        window.addEventListener('storage', handleStorageChange)
        return () => window.removeEventListener('storage', handleStorageChange)
    }, [sortOption, loadNotes])

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
                alert('删除笔记时出错，请重试')
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
            }
        } catch (error) {
            console.error('保存笔记失败:', error);
            alert('保存笔记时出错，请重试');
        }
    };

    // 修改新建笔记处理函数
    const handleAddNote = () => {
        setCurrentEditingNote({
            coffeeBeanInfo: {
                name: '',
                roastLevel: '中度烘焙',
                roastDate: ''
            },
            taste: {
                acidity: 3,
                sweetness: 3,
                bitterness: 3,
                body: 3
            },
            rating: 3,
            notes: ''
        });
        setShowNoteFormModal(true);
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
        <AnimatePresence mode="wait">
            {editingNote ? (
                <motion.div
                    key="edit-form"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="h-full p-6"
                    id="brewing-history-component"
                >
                    <BrewingNoteForm
                        id={editingNote.id}
                        isOpen={true}
                        onClose={() => setEditingNote(null)}
                        onSave={handleSaveEdit}
                        initialData={editingNote}
                    />
                </motion.div>
            ) : optimizingNote ? (
                <motion.div
                    key="optimize-form"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="h-full p-6"
                    id="brewing-history-component"
                >
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
                </motion.div>
            ) : (
                <motion.div
                    key="notes-list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="space-y-6"
                    id="brewing-history-component"
                >
                    <div className="p-6 space-y-6">
                        {/* 排序控件和数量显示 */}
                        <div className="flex justify-between items-center mb-6">
                            <div className="text-xs tracking-wide text-neutral-500 dark:text-neutral-400">
                                共 {notes.length} 条记录
                            </div>
                            <Select
                                value={sortOption}
                                onValueChange={(value) => setSortOption(value as SortOption)}
                            >
                                <SelectTrigger
                                    variant="minimal"
                                    className="w-auto min-w-[90px] tracking-wide text-neutral-500 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-400 transition-colors group"
                                >
                                    <div className="flex items-center">
                                        <SelectValue />
                                        <svg
                                            className="mr-1 w-3 h-3 opacity-90 transition-opacity"
                                            viewBox="0 0 15 15"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                        >
                                            <path d="M4.5 6.5L7.5 3.5L10.5 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                                            <path d="M4.5 8.5L7.5 11.5L10.5 8.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
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
                                            className="tracking-wide text-neutral-500 dark:text-neutral-400 data-[highlighted]:text-neutral-600 dark:data-[highlighted]:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/70 transition-colors"
                                        >
                                            {SORT_LABELS[value]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 笔记列表 */}
                        {notes.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400"
                            >
                                [ 暂无冲煮记录 ]
                            </motion.div>
                        ) : (
                            <div className="space-y-6 pb-24">
                                {notes.map((note, index) => (
                                    <motion.div
                                        key={note.id}
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        transition={{
                                            duration: 0.2,
                                            delay: Math.min(index * 0.05, 0.3),
                                            ease: "easeOut"
                                        }}
                                        className="group space-y-4 border-l border-neutral-200/50 pl-6 dark:border-neutral-800"
                                    >
                                        <div className="flex flex-col space-y-4">
                                            <div className="space-y-2">
                                                <div className="flex items-baseline justify-between">
                                                    <div className="flex items-baseline space-x-2 min-w-0 overflow-hidden">
                                                        <div className="text-[10px] truncate">
                                                            {getEquipmentName(note.equipment)}
                                                        </div>
                                                        {note.method && (
                                                            <>
                                                                <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400 shrink-0">
                                                                    ·
                                                                </div>
                                                                <div
                                                                    className="text-[10px] font-light tracking-wide truncate cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-500 transition-colors group flex items-center"
                                                                    onClick={(e) => handleMethodClick(note, e)}
                                                                    title="点击跳转到注水步骤"
                                                                >
                                                                    <span className="border-b border-dashed border-neutral-400 dark:border-neutral-600 group-hover:border-emerald-500 dark:group-hover:border-emerald-500">
                                                                        {note.method}
                                                                    </span>
                                                                    <svg
                                                                        className="ml-1 w-3 h-3 opacity-50 group-hover:opacity-100 group-hover:text-emerald-500 transition-all"
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
                                                        <AnimatePresence mode="wait">
                                                            {actionMenuStates[note.id] ? (
                                                                <motion.div
                                                                    key="action-buttons"
                                                                    initial={{ opacity: 0, scale: 0.98 }}
                                                                    animate={{ opacity: 1, scale: 1 }}
                                                                    exit={{ opacity: 0 }}
                                                                    transition={{ duration: 0.15, ease: "easeOut" }}
                                                                    className="flex items-baseline space-x-3"
                                                                >
                                                                    <button
                                                                        onClick={() => handleEdit(note)}
                                                                        className="px-2 text-xs text-neutral-500 dark:text-neutral-400"
                                                                    >
                                                                        编辑
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleOptimize(note)}
                                                                        className="px-2 text-xs text-emerald-600 dark:text-emerald-500 font-medium"
                                                                    >
                                                                        优化
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDelete(note.id)}
                                                                        className="px-2 text-xs text-red-400"
                                                                    >
                                                                        删除
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setActionMenuStates(prev => ({
                                                                                ...prev,
                                                                                [note.id]: false
                                                                            }))
                                                                        }}
                                                                        className="w-7 h-7 flex items-center justify-center rounded-full text-sm text-neutral-400"
                                                                    >
                                                                        ×
                                                                    </button>
                                                                </motion.div>
                                                            ) : (
                                                                <motion.button
                                                                    key="more-button"
                                                                    initial={{ opacity: 0, scale: 0.98 }}
                                                                    animate={{ opacity: 1, scale: 1 }}
                                                                    exit={{ opacity: 0 }}
                                                                    transition={{ duration: 0.15, ease: "easeOut" }}
                                                                    onClick={() => {
                                                                        setActionMenuStates(prev => ({
                                                                            ...prev,
                                                                            [note.id]: true
                                                                        }))
                                                                    }}
                                                                    className="w-7 h-7 flex items-center justify-center text-xs text-neutral-500 dark:text-neutral-400"
                                                                >
                                                                    ···
                                                                </motion.button>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-2 text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                                                    {note.coffeeBeanInfo?.name && (
                                                        <>
                                                            <span>{note.coffeeBeanInfo.name}</span>
                                                            <span>·</span>
                                                        </>
                                                    )}
                                                    <span>{note.coffeeBeanInfo?.roastLevel}</span>
                                                    {note.coffeeBeanInfo?.roastDate && (
                                                        <>
                                                            <span>·</span>
                                                            <span>{note.coffeeBeanInfo.roastDate}</span>
                                                        </>
                                                    )}
                                                    {note.params && (
                                                        <>
                                                            <span>·</span>
                                                            <span>{note.params.coffee}</span>
                                                            <span>·</span>
                                                            <span>{note.params.water}</span>
                                                            <span>·</span>
                                                            <span>{note.params.ratio}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                {Object.entries(note.taste).map(([key, value], i) => (
                                                    <motion.div
                                                        key={key}
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: 0.1 + i * 0.05, duration: 0.3 }}
                                                        className="space-y-1"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                                                                {
                                                                    {
                                                                        acidity: '酸度',
                                                                        sweetness: '甜度',
                                                                        bitterness: '苦度',
                                                                        body: '醇度',
                                                                    }[key]
                                                                }
                                                            </div>
                                                            <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                                                                [ {value} ]
                                                            </div>
                                                        </div>
                                                        <motion.div
                                                            className="h-px w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800"
                                                        >
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${(value / 5) * 100}%` }}
                                                                transition={{
                                                                    delay: 0.15 + i * 0.05,
                                                                    duration: 0.5,
                                                                    ease: "easeOut"
                                                                }}
                                                                className="h-full bg-neutral-800 dark:bg-neutral-100"
                                                            />
                                                        </motion.div>
                                                    </motion.div>
                                                ))}
                                            </div>

                                            <div className="flex items-baseline justify-between">
                                                <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                                                    {formatDate(note.timestamp)}
                                                </div>
                                                <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                                                    {formatRating(note.rating)}
                                                </div>
                                            </div>

                                            {note.notes && (
                                                <div className="text-[10px] tracking-widest  text-neutral-500 dark:text-neutral-400">
                                                    {note.notes}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 添加笔记按钮 */}
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="bottom-action-bar"
                    >
                        <div className="absolute bottom-full left-0 right-0 h-12 bg-gradient-to-t from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
                        <div className="relative flex items-center bg-neutral-50 dark:bg-neutral-900 py-4">
                            <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
                            <motion.button
                                onClick={handleAddNote}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex items-center justify-center text-[11px] text-neutral-500 dark:text-neutral-400 mx-3"
                            >
                                <span className="mr-1">+</span> 添加笔记
                            </motion.button>
                            <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
                        </div>
                    </motion.div>
                </motion.div>
            )}

            {/* 添加笔记表单模态框 */}
            <BrewingNoteFormModalNew
                key="note-form-modal"
                showForm={showNoteFormModal}
                initialNote={currentEditingNote}
                onSave={handleSaveEdit}
                onClose={() => {
                    setShowNoteFormModal(false);
                    setCurrentEditingNote({});
                }}
            />
        </AnimatePresence>
    )
}

export default BrewingHistory