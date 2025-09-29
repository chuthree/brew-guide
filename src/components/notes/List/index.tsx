'use client'

/*
 * 笔记列表组件 - 存储架构说明
 * 
 * 数据存储分层：
 * 1. 笔记数据 (brewingNotes): 存储在 IndexedDB 中 (通过 Storage API)
 * 2. UI 偏好设置: 存储在 localStorage 中 (视图模式、图片流设置等)
 * 3. 筛选偏好: 存储在 localStorage 中 (通过 globalCache.ts)
 * 
 * 事件监听：
 * - storage: localStorage 变化 (仅 UI 偏好设置)
 * - customStorageChange: IndexedDB 变化 (笔记数据)
 * - storage:changed: 存储系统统一事件 (笔记数据)
 * - coffeeBeansUpdated: 咖啡豆数据变化
 * - brewingNotesUpdated: 笔记数据变化
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { BrewingNote } from '@/lib/core/config'
import { BrewingHistoryProps } from '../types'

import FilterTabs from './FilterTabs'
import AddNoteButton from './AddNoteButton'
import Toast from '../ui/Toast'

import BrewingNoteEditModal from '../Form/BrewingNoteEditModal'
import ChangeRecordEditModal from '../Form/ChangeRecordEditModal'
import { BrewingNoteData } from '@/types/app'
import { globalCache, saveSelectedEquipmentPreference, saveSelectedBeanPreference, saveFilterModePreference, saveSortOptionPreference, calculateTotalCoffeeConsumption, formatConsumption, getSelectedEquipmentPreference, getSelectedBeanPreference, getFilterModePreference, getSortOptionPreference } from './globalCache'
import ListView from './ListView'
import { SortOption } from '../types'
import { exportSelectedNotes } from '../Share/NotesExporter'
import { useEnhancedNotesFiltering } from './hooks/useEnhancedNotesFiltering'
import { extractExtractionTime, sortNotes } from '../utils'






const BrewingHistory: React.FC<BrewingHistoryProps> = ({
    isOpen,
    onClose: _onClose,
    onAddNote,
    setAlternativeHeaderContent: _setAlternativeHeaderContent, // 不再使用，保留以兼容接口
    setShowAlternativeHeader: _setShowAlternativeHeader, // 不再使用，保留以兼容接口
    settings
}) => {
    // 用于跟踪用户选择 - 从本地存储初始化
    const [sortOption, setSortOption] = useState<SortOption>(getSortOptionPreference())
    const [filterMode, setFilterMode] = useState<'equipment' | 'bean'>(getFilterModePreference())
    const [selectedEquipment, setSelectedEquipment] = useState<string | null>(getSelectedEquipmentPreference())
    const [selectedBean, setSelectedBean] = useState<string | null>(getSelectedBeanPreference())
    
    // 搜索排序状态 - 独立于普通排序，可选的
    const [searchSortOption, setSearchSortOption] = useState<SortOption | null>(null)
    const [editingNote, setEditingNote] = useState<BrewingNoteData | null>(null)
    const [editingChangeRecord, setEditingChangeRecord] = useState<BrewingNote | null>(null)

    // 模态显示状态
    const [showChangeRecordEditModal, setShowChangeRecordEditModal] = useState(false)
    
    // 分享模式状态
    const [isShareMode, setIsShareMode] = useState(false)
    const [selectedNotes, setSelectedNotes] = useState<string[]>([])
    const [isSaving, setIsSaving] = useState(false)
    
    // 搜索相关状态
    const [isSearching, setIsSearching] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    // 显示模式状态（持久化记忆 - 使用 localStorage 存储 UI 偏好设置）
    const [viewMode, setViewMode] = useState<'list' | 'gallery'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('notes-view-mode') as 'list' | 'gallery') || 'list'
        }
        return 'list'
    })

    // 图片流模式状态（持久化记忆 - 使用 localStorage 存储 UI 偏好设置）
    const [isImageFlowMode, setIsImageFlowMode] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('notes-is-image-flow-mode') === 'true'
        }
        return false
    })

    // 带日期图片流模式状态（持久化记忆 - 使用 localStorage 存储 UI 偏好设置）
    const [isDateImageFlowMode, setIsDateImageFlowMode] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('notes-is-date-image-flow-mode') === 'true'
        }
        return false
    })

    // 记住用户上次使用的图片流模式类型（持久化存储 - 使用 localStorage 存储 UI 偏好设置）
    const [lastImageFlowType, setLastImageFlowType] = useState<'normal' | 'date'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('notes-last-image-flow-type') as 'normal' | 'date') || 'normal'
        }
        return 'normal'
    })

    // 优雅的图片流模式记忆管理
    const updateImageFlowMemory = useCallback((type: 'normal' | 'date') => {
        setLastImageFlowType(type)
        if (typeof window !== 'undefined') {
            localStorage.setItem('notes-last-image-flow-type', type)
        }
    }, [])

    // 优雅的显示模式持久化管理
    const updateViewMode = useCallback((mode: 'list' | 'gallery') => {
        setViewMode(mode)
        if (typeof window !== 'undefined') {
            localStorage.setItem('notes-view-mode', mode)
        }
    }, [])

    const updateImageFlowState = useCallback((normal: boolean, date: boolean) => {
        setIsImageFlowMode(normal)
        setIsDateImageFlowMode(date)
        if (typeof window !== 'undefined') {
            localStorage.setItem('notes-is-image-flow-mode', normal.toString())
            localStorage.setItem('notes-is-date-image-flow-mode', date.toString())
        }
    }, [])

    // 优雅的图片流模式状态管理
    const setImageFlowMode = useCallback((normal: boolean, date: boolean, rememberChoice: boolean = true) => {
        updateImageFlowState(normal, date)

        // 如果需要记住选择，更新记忆
        if (rememberChoice && (normal || date)) {
            updateImageFlowMemory(date ? 'date' : 'normal')
        }

        // 如果开启了任何图片流模式，切换到gallery视图
        if (normal || date) {
            updateViewMode('gallery')
        }
    }, [updateImageFlowMemory, updateViewMode, updateImageFlowState])

    // 页面加载时恢复显示模式状态的一致性检查
    useEffect(() => {
        // 确保状态一致性：如果是gallery模式但两个图片流模式都是false，恢复到用户偏好
        if (viewMode === 'gallery' && !isImageFlowMode && !isDateImageFlowMode) {
            const useDate = lastImageFlowType === 'date';
            updateImageFlowState(!useDate, useDate);
        }
        // 如果是list模式但有图片流模式开启，关闭图片流模式
        else if (viewMode === 'list' && (isImageFlowMode || isDateImageFlowMode)) {
            updateImageFlowState(false, false);
        }
    }, [isDateImageFlowMode, isImageFlowMode, lastImageFlowType, updateImageFlowState, viewMode]) // 添加所有依赖项
    
    // 本地状态管理笔记数据 - 需要在Hook之前声明
    const [notes, setNotes] = useState<BrewingNote[]>([]);
    const [equipmentNames, setEquipmentNames] = useState<Record<string, string>>({});

    // 预览容器引用
    const notesContainerRef = useRef<HTMLDivElement>(null)
    
    // Toast消息状态
    const [toast, setToast] = useState({
        visible: false,
        message: '',
        type: 'info' as 'success' | 'error' | 'info'
    })
    
    // 使用增强的笔记筛选Hook
    const {
        filteredNotes,
        totalCount,
        totalConsumption,
        availableEquipments,
        availableBeans,
        debouncedUpdateFilters
    } = useEnhancedNotesFiltering({
        notes: notes,
        sortOption,
        filterMode,
        selectedEquipment,
        selectedBean,
        searchQuery,
        isSearching,
        preFilteredNotes: undefined // 暂时不使用，我们需要重新组织逻辑
    })

    // 搜索过滤逻辑 - 在Hook之后定义以避免循环依赖
    const searchFilteredNotes = useMemo(() => {
        if (!isSearching || !searchQuery.trim()) return filteredNotes;

        const query = searchQuery.toLowerCase().trim();
        const queryTerms = query.split(/\s+/).filter(term => term.length > 0);

        // 从原始笔记开始搜索，而不是从已排序的filteredNotes
        const baseNotes = filteredNotes.length > 0 ? filteredNotes : notes;
        const notesWithScores = baseNotes.map((note: BrewingNote) => {
            const equipment = note.equipment?.toLowerCase() || '';
            const method = note.method?.toLowerCase() || '';
            const beanName = note.coffeeBeanInfo?.name?.toLowerCase() || '';
            const roastLevel = note.coffeeBeanInfo?.roastLevel?.toLowerCase() || '';
            const notes = note.notes?.toLowerCase() || '';
            const coffee = note.params?.coffee?.toLowerCase() || '';
            const water = note.params?.water?.toLowerCase() || '';
            const ratio = note.params?.ratio?.toLowerCase() || '';
            const grindSize = note.params?.grindSize?.toLowerCase() || '';
            const temp = note.params?.temp?.toLowerCase() || '';
            const tasteInfo = `酸度${note.taste?.acidity || 0} 甜度${note.taste?.sweetness || 0} 苦度${note.taste?.bitterness || 0} 醇厚度${note.taste?.body || 0}`.toLowerCase();
            const dateInfo = note.timestamp ? new Date(note.timestamp).toLocaleDateString() : '';
            const totalTime = note.totalTime ? `${note.totalTime}秒` : '';
            const ratingText = note.rating ? `评分${note.rating} ${note.rating}分 ${note.rating}星`.toLowerCase() : '';

            const searchableTexts = [
                { text: beanName, weight: 3 },
                { text: equipment, weight: 2 },
                { text: method, weight: 2 },
                { text: notes, weight: 2 },
                { text: roastLevel, weight: 1 },
                { text: coffee, weight: 1 },
                { text: water, weight: 1 },
                { text: ratio, weight: 1 },
                { text: grindSize, weight: 1 },
                { text: temp, weight: 1 },
                { text: tasteInfo, weight: 1 },
                { text: dateInfo, weight: 1 },
                { text: totalTime, weight: 1 },
                { text: ratingText, weight: 1 }
            ];

            let score = 0;
            let allTermsMatch = true;

            for (const term of queryTerms) {
                const termMatches = searchableTexts.some(({ text }) => text.includes(term));
                if (!termMatches) {
                    allTermsMatch = false;
                    break;
                }

                for (const { text, weight } of searchableTexts) {
                    if (text.includes(term)) {
                        score += weight;
                        if (text === term) {
                            score += weight * 2;
                        }
                        if (text.startsWith(term)) {
                            score += weight;
                        }
                    }
                }
            }

            return { note, score, matches: allTermsMatch };
        });

        type NoteWithScore = { note: BrewingNote; score: number; matches: boolean };
        const matchingNotes = notesWithScores.filter((item: NoteWithScore) => item.matches);
        
        // 获取匹配的笔记
        const matchedNotesOnly = matchingNotes.map((item: NoteWithScore) => item.note);
        
        // 对搜索结果应用排序选项：优先使用搜索排序，否则使用普通排序
        const effectiveSortOption = searchSortOption || sortOption;
        const sortedMatchedNotes = sortNotes(matchedNotesOnly, effectiveSortOption);
        
        return sortedMatchedNotes;
    }, [isSearching, searchQuery, filteredNotes, notes, searchSortOption, sortOption]);

    // 检测搜索结果中是否有萃取时间数据
    const hasExtractionTimeData = useMemo(() => {
        if (!isSearching || !searchQuery.trim()) return false;
        
        // 检查搜索结果中是否有至少一条笔记包含萃取时间信息
        return searchFilteredNotes.some(note => {
            const extractionTime = extractExtractionTime(note.notes || '');
            return extractionTime !== null;
        });
    }, [isSearching, searchQuery, searchFilteredNotes]);

    // 计算总咖啡消耗量
    const totalCoffeeConsumption = useRef(0)



    // 简化的数据加载函数 - 直接加载并更新状态
    const loadNotesData = useCallback(async () => {
        try {
            const { Storage } = await import('@/lib/core/storage');
            const savedNotes = await Storage.get('brewingNotes');
            const parsedNotes: BrewingNote[] = savedNotes ? JSON.parse(savedNotes) : [];

            // 直接更新本地状态
            setNotes(parsedNotes);

            // 获取设备名称映射
            const { equipmentList } = await import('@/lib/core/config');
            const { loadCustomEquipments } = await import('@/lib/managers/customEquipments');
            const customEquipments = await loadCustomEquipments();

            const namesMap: Record<string, string> = {};
            equipmentList.forEach(equipment => {
                namesMap[equipment.id] = equipment.name;
            });
            customEquipments.forEach(equipment => {
                namesMap[equipment.id] = equipment.name;
            });

            setEquipmentNames(namesMap);

            // 更新总消耗量引用
            totalCoffeeConsumption.current = calculateTotalCoffeeConsumption(parsedNotes);

        } catch (error) {
            console.error("加载笔记数据失败:", error);
        }
    }, []);
    
    // 简化初始化 - 直接加载数据
    useEffect(() => {
        if (isOpen) {
            loadNotesData();
        }
    }, [isOpen, loadNotesData]);


    
    // 简化存储监听 - 只监听关键的数据变化事件
    useEffect(() => {
        if (!isOpen) return;

        const handleDataChange = () => {
            loadNotesData();
        };

        // 监听笔记数据变化事件
        window.addEventListener('storage:changed', (e) => {
            const event = e as CustomEvent;
            if (event.detail?.key === 'brewingNotes') {
                handleDataChange();
            }
        });

        window.addEventListener('brewingNotesUpdated', handleDataChange);

        return () => {
            window.removeEventListener('storage:changed', handleDataChange);
            window.removeEventListener('brewingNotesUpdated', handleDataChange);
        }
    }, [isOpen, loadNotesData])
    
    // 显示消息提示
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ visible: true, message, type });
        setTimeout(() => {
            setToast(prev => ({ ...prev, visible: false }));
        }, 3000);
    };
    
    // 处理删除笔记 - 统一数据流避免竞态条件，并恢复咖啡豆容量
    const handleDelete = async (noteId: string) => {
        try {
            const { Storage } = await import('@/lib/core/storage');
            const savedNotes = await Storage.get('brewingNotes');
            if (!savedNotes) return;

            const notes = JSON.parse(savedNotes) as BrewingNote[];

            // 找到要删除的笔记
            const noteToDelete = notes.find(note => note.id === noteId);
            if (!noteToDelete) {
                console.warn('未找到要删除的笔记:', noteId);
                return;
            }

            // 添加确认对话框
            let noteName = '此笔记';
            if (noteToDelete.source === 'quick-decrement') {
                noteName = `${noteToDelete.coffeeBeanInfo?.name || '未知咖啡豆'}的快捷扣除记录`;
            } else if (noteToDelete.source === 'capacity-adjustment') {
                noteName = `${noteToDelete.coffeeBeanInfo?.name || '未知咖啡豆'}的容量调整记录`;
            } else {
                noteName = noteToDelete.method || '此笔记';
            }
            
            if (!window.confirm(`确认要删除"${noteName}"吗？`)) {
                return;
            }

            // 恢复咖啡豆容量（根据笔记类型采用不同的恢复策略）
            try {
                if (noteToDelete.source === 'capacity-adjustment') {
                    // 处理容量调整记录的恢复（简化版本）
                    const beanId = noteToDelete.beanId;
                    const capacityAdjustment = noteToDelete.changeRecord?.capacityAdjustment;

                    if (beanId && capacityAdjustment) {
                        const changeAmount = capacityAdjustment.changeAmount;
                        if (typeof changeAmount === 'number' && !isNaN(changeAmount) && changeAmount !== 0) {
                            const { CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager');

                            // 获取当前咖啡豆信息
                            const currentBean = await CoffeeBeanManager.getBeanById(beanId);
                            if (currentBean) {
                                const currentRemaining = parseFloat(currentBean.remaining || '0');
                                const restoredRemaining = currentRemaining - changeAmount; // 反向操作
                                let finalRemaining = Math.max(0, restoredRemaining);

                                // 确保不超过总容量
                                if (currentBean.capacity) {
                                    const totalCapacity = parseFloat(currentBean.capacity);
                                    if (!isNaN(totalCapacity) && totalCapacity > 0) {
                                        finalRemaining = Math.min(finalRemaining, totalCapacity);
                                    }
                                }

                                const formattedRemaining = CoffeeBeanManager.formatNumber(finalRemaining);
                                await CoffeeBeanManager.updateBean(beanId, {
                                    remaining: formattedRemaining
                                });


                            }
                        }
                    }
                } else {
                    // 处理快捷扣除记录和普通笔记的恢复
                    const { extractCoffeeAmountFromNote, getNoteAssociatedBeanId } = await import('../utils');
                    const coffeeAmount = extractCoffeeAmountFromNote(noteToDelete);
                    const beanId = getNoteAssociatedBeanId(noteToDelete);

                    if (beanId && coffeeAmount > 0) {
                        const { CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager');
                        await CoffeeBeanManager.increaseBeanRemaining(beanId, coffeeAmount);

                    }
                }
            } catch (error) {
                console.error('恢复咖啡豆容量失败:', error);
                // 容量恢复失败不应阻止笔记删除，但需要记录错误
            }

            // 删除笔记
            const updatedNotes = notes.filter(note => note.id !== noteId);

            // 直接更新本地状态
            setNotes(updatedNotes);

            // 更新总消耗量
            totalCoffeeConsumption.current = calculateTotalCoffeeConsumption(updatedNotes);

            // 保存到存储 - Storage.set() 会自动触发事件
            await Storage.set('brewingNotes', JSON.stringify(updatedNotes));

            // 主动刷新数据，确保UI立即更新
            await loadNotesData();
            
            showToast('笔记已删除', 'success');
        } catch (error) {
            console.error('删除笔记失败:', error);
            showToast('删除笔记失败', 'error');
        }
    };
    
    // 处理笔记点击 - 区分变动记录和普通笔记，使用模态弹窗
    const handleNoteClick = (note: BrewingNote) => {
        // 检查是否为变动记录
        const isChangeRecord = note.source === 'quick-decrement' || note.source === 'capacity-adjustment';

        if (isChangeRecord) {
            // 设置编辑变动记录并显示模态
            setEditingChangeRecord(note);
            setShowChangeRecordEditModal(true);
        } else {
            // 准备要编辑的普通笔记数据
            const noteToEdit = {
                id: note.id,
                timestamp: note.timestamp,
                equipment: note.equipment,
                method: note.method,
                params: note.params,
                coffeeBeanInfo: note.coffeeBeanInfo || {
                    name: '', // 提供默认值
                    roastLevel: ''
                },
                image: note.image,
                rating: note.rating,
                taste: note.taste,
                notes: note.notes,
                totalTime: note.totalTime,
                // 确保包含beanId字段，这是咖啡豆容量同步的关键
                beanId: note.beanId
            };

            // 设置编辑普通笔记数据并显示模态
            setEditingNote(noteToEdit);
        }
    };
    
    // 处理保存编辑 - 添加导航栏替代头部支持
    const handleSaveEdit = async (updatedData: BrewingNoteData) => {
        try {
            // 获取现有笔记
            const { Storage } = await import('@/lib/core/storage');
            const savedNotes = await Storage.get('brewingNotes')
            let parsedNotes: BrewingNote[] = savedNotes ? JSON.parse(savedNotes) : []

            // 查找并更新指定笔记
            parsedNotes = parsedNotes.map(note => {
                if (note.id === updatedData.id) {
                    return updatedData as BrewingNote
                }
                return note
            })

            // 直接更新本地状态
            setNotes(parsedNotes);

            // 更新总消耗量
            totalCoffeeConsumption.current = calculateTotalCoffeeConsumption(parsedNotes);

            // 数据处理现在由 useEnhancedNotesFiltering Hook 自动处理

            // 保存更新后的笔记 - Storage.set() 会自动触发事件
            await Storage.set('brewingNotes', JSON.stringify(parsedNotes))

            // 主动刷新数据，确保UI立即更新
            await loadNotesData();

            // 关闭模态和编辑状态
            setEditingNote(null)

            // 显示成功提示
            showToast('笔记已更新', 'success')
        } catch (error) {
            console.error('更新笔记失败:', error)
            showToast('更新笔记失败', 'error')
        }
    }

    // 处理变动记录转换为普通笔记
    const handleConvertToNormalNote = (convertedNote: BrewingNote) => {
        // 关闭变动记录编辑模态
        setEditingChangeRecord(null)
        setShowChangeRecordEditModal(false)

        // 准备普通笔记数据
        const noteToEdit = {
            id: convertedNote.id,
            timestamp: convertedNote.timestamp,
            equipment: convertedNote.equipment || '',
            method: convertedNote.method || '',
            params: convertedNote.params || {
                coffee: '',
                water: '',
                ratio: '',
                grindSize: '',
                temp: ''
            },
            coffeeBeanInfo: convertedNote.coffeeBeanInfo || {
                name: '',
                roastLevel: ''
            },
            image: convertedNote.image,
            rating: convertedNote.rating || 3,
            taste: convertedNote.taste || {
                acidity: 0,
                sweetness: 0,
                bitterness: 0,
                body: 0
            },
            notes: convertedNote.notes || '',
            totalTime: convertedNote.totalTime || 0,
            beanId: convertedNote.beanId
        };

        // 打开普通笔记编辑模态
        setEditingNote(noteToEdit);
    };

    // 处理变动记录保存
    const handleSaveChangeRecord = async (updatedRecord: BrewingNote) => {
        try {
            // 获取现有笔记
            const { Storage } = await import('@/lib/core/storage');
            const savedNotes = await Storage.get('brewingNotes')
            let parsedNotes: BrewingNote[] = savedNotes ? JSON.parse(savedNotes) : []

            // 找到原始记录以计算容量变化差异
            const originalRecord = parsedNotes.find(note => note.id === updatedRecord.id);

            // 同步咖啡豆容量变化
            if (originalRecord && updatedRecord.beanId) {
                try {
                    const { CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager');

                    // 计算原始变化量和新变化量
                    let originalChangeAmount = 0;
                    let newChangeAmount = 0;

                    if (originalRecord.source === 'quick-decrement') {
                        originalChangeAmount = -(originalRecord.quickDecrementAmount || 0);
                    } else if (originalRecord.source === 'capacity-adjustment') {
                        originalChangeAmount = originalRecord.changeRecord?.capacityAdjustment?.changeAmount || 0;
                    }

                    if (updatedRecord.source === 'quick-decrement') {
                        newChangeAmount = -(updatedRecord.quickDecrementAmount || 0);
                    } else if (updatedRecord.source === 'capacity-adjustment') {
                        newChangeAmount = updatedRecord.changeRecord?.capacityAdjustment?.changeAmount || 0;
                    }

                    // 计算需要调整的容量差异
                    const capacityDiff = newChangeAmount - originalChangeAmount;

                    if (Math.abs(capacityDiff) > 0.01) {
                        // 获取当前咖啡豆信息
                        const currentBean = await CoffeeBeanManager.getBeanById(updatedRecord.beanId);
                        if (currentBean) {
                            const currentRemaining = parseFloat(currentBean.remaining || '0');
                            const newRemaining = Math.max(0, currentRemaining + capacityDiff);

                            // 确保不超过总容量
                            let finalRemaining = newRemaining;
                            if (currentBean.capacity) {
                                const totalCapacity = parseFloat(currentBean.capacity);
                                if (!isNaN(totalCapacity) && totalCapacity > 0) {
                                    finalRemaining = Math.min(finalRemaining, totalCapacity);
                                }
                            }

                            const formattedRemaining = CoffeeBeanManager.formatNumber(finalRemaining);
                            await CoffeeBeanManager.updateBean(updatedRecord.beanId, {
                                remaining: formattedRemaining
                            });


                        }
                    }
                } catch (error) {
                    console.error('同步咖啡豆容量失败:', error);
                    // 不阻止记录保存，但显示警告
                    showToast('记录已保存，但容量同步失败', 'error');
                }
            }

            // 查找并更新指定变动记录
            parsedNotes = parsedNotes.map(note => {
                if (note.id === updatedRecord.id) {
                    return updatedRecord
                }
                return note
            })

            // 直接更新本地状态
            setNotes(parsedNotes);

            // 更新总消耗量
            totalCoffeeConsumption.current = calculateTotalCoffeeConsumption(parsedNotes);

            // 保存更新后的笔记 - Storage.set() 会自动触发事件
            await Storage.set('brewingNotes', JSON.stringify(parsedNotes))

            // 主动刷新数据，确保UI立即更新
            await loadNotesData();

            // 关闭模态和编辑状态
            setEditingChangeRecord(null)
            setShowChangeRecordEditModal(false)

            // 显示成功提示
            showToast('变动记录已更新', 'success')
        } catch (error) {
            console.error('更新变动记录失败:', error)
            showToast('更新变动记录失败', 'error')
        }
    }


    
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
        // 已保存到本地存储
        // 数据筛选由 useEnhancedNotesFiltering Hook 自动处理
        debouncedUpdateFilters({ sortOption: option });
    };

    // 处理搜索排序选项变化 - 独立于普通排序
    const handleSearchSortChange = (option: SortOption | null) => {
        setSearchSortOption(option);
        // 搜索排序不需要持久化存储，因为它是临时的
    };

    // 处理显示模式变化
    const handleViewModeChange = useCallback((mode: 'list' | 'gallery') => {
        updateViewMode(mode);
    }, [updateViewMode]);

    // 优雅的图片流模式切换处理
    const handleToggleImageFlowMode = useCallback(() => {
        const newMode = !isImageFlowMode;
        if (newMode) {
            // 开启普通图片流：关闭带日期模式，记住选择
            setImageFlowMode(true, false, true);
        } else {
            // 关闭图片流：回到列表模式
            setImageFlowMode(false, false, false);
            updateViewMode('list');
        }
    }, [isImageFlowMode, setImageFlowMode, updateViewMode]);

    const handleToggleDateImageFlowMode = useCallback(() => {
        const newMode = !isDateImageFlowMode;
        if (newMode) {
            // 开启带日期图片流：关闭普通模式，记住选择
            setImageFlowMode(false, true, true);
        } else {
            // 关闭图片流：回到列表模式
            setImageFlowMode(false, false, false);
            updateViewMode('list');
        }
    }, [isDateImageFlowMode, setImageFlowMode, updateViewMode]);

    // 智能切换图片流模式（用于双击"全部"）
    const handleSmartToggleImageFlow = useCallback(() => {
        const isInImageFlowMode = viewMode === 'gallery' && (isImageFlowMode || isDateImageFlowMode);

        if (isInImageFlowMode) {
            // 当前在图片流模式，切换到列表模式
            setImageFlowMode(false, false, false);
            updateViewMode('list');
        } else {
            // 当前在列表模式，根据记忆恢复到用户偏好的图片流模式
            const useDate = lastImageFlowType === 'date';
            setImageFlowMode(!useDate, useDate, false); // 不更新记忆，因为这是恢复操作
        }
    }, [viewMode, isImageFlowMode, isDateImageFlowMode, lastImageFlowType, setImageFlowMode, updateViewMode]);

    // 处理过滤模式变化
    const handleFilterModeChange = (mode: 'equipment' | 'bean') => {
        setFilterMode(mode);
        saveFilterModePreference(mode);
        // 已保存到本地存储
        // 切换模式时清空选择
        setSelectedEquipment(null);
        setSelectedBean(null);
        saveSelectedEquipmentPreference(null);
        saveSelectedBeanPreference(null);
        globalCache.selectedEquipment = null;
        globalCache.selectedBean = null;
        // 数据筛选由 useEnhancedNotesFiltering Hook 自动处理
        debouncedUpdateFilters({ filterMode: mode, selectedEquipment: null, selectedBean: null });
    };

    // 处理设备选择变化
    const handleEquipmentClick = useCallback((equipment: string | null) => {
        setSelectedEquipment(equipment);
        saveSelectedEquipmentPreference(equipment);
        // 已保存到本地存储
        // 数据筛选由 useEnhancedNotesFiltering Hook 自动处理
        debouncedUpdateFilters({ selectedEquipment: equipment });
    }, [debouncedUpdateFilters]);

    // 处理咖啡豆选择变化
    const handleBeanClick = useCallback((bean: string | null) => {
        setSelectedBean(bean);
        saveSelectedBeanPreference(bean);
        // 已保存到本地存储
        // 数据筛选由 useEnhancedNotesFiltering Hook 自动处理
        debouncedUpdateFilters({ selectedBean: bean });
    }, [debouncedUpdateFilters]);
    
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
    
    // 处理搜索按钮点击
    const handleSearchClick = () => {
        setIsSearching(!isSearching);
        if (isSearching) {
            // 退出搜索时：清空搜索查询并重置搜索排序状态
            setSearchQuery('');
            setSearchSortOption(null);
        }
    };
    
    // 处理搜索输入变化
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };
    
    // 处理搜索框键盘事件
    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            setIsSearching(false);
            setSearchQuery('');
            setSearchSortOption(null); // 重置搜索排序状态
        }
    };
    
    // 计算当前显示的消耗量 - 使用Hook提供的数据
    const currentConsumption = useMemo(() => {
        // 搜索状态下，计算搜索结果的消耗量
        if (isSearching && searchQuery.trim()) {
            return calculateTotalCoffeeConsumption(searchFilteredNotes);
        }

        // 其他情况使用Hook计算的总消耗量
        return totalConsumption;
    }, [isSearching, searchQuery, searchFilteredNotes, totalConsumption]);

    // 计算图片流模式下的统计信息
    const imageFlowStats = useMemo(() => {
        if (!isImageFlowMode && !isDateImageFlowMode) {
            return null;
        }

        // 获取当前显示的笔记（搜索模式下使用搜索结果，否则使用筛选结果）
        const currentNotes = (isSearching && searchQuery.trim()) ? searchFilteredNotes : filteredNotes;

        // 过滤出有图片的笔记
        const notesWithImages = currentNotes.filter(note => note.image && note.image.trim() !== '');

        // 计算有图片笔记的消耗量
        const imageNotesConsumption = calculateTotalCoffeeConsumption(notesWithImages);

        return {
            count: notesWithImages.length,
            consumption: imageNotesConsumption,
            notes: notesWithImages
        };
    }, [isImageFlowMode, isDateImageFlowMode, isSearching, searchQuery, searchFilteredNotes, filteredNotes]);

    // 计算图片流模式下的可用设备和豆子列表
    const imageFlowAvailableOptions = useMemo(() => {
        if (!isImageFlowMode && !isDateImageFlowMode) {
            return {
                equipments: availableEquipments,
                beans: availableBeans
            };
        }

        // 基于原始的所有笔记数据来计算有图片的分类选项
        // 这样确保即使选择了某个分类，其他分类选项仍然可见
        const allOriginalNotes = globalCache.notes; // 使用原始的、未经筛选的笔记数据

        // 如果是搜索模式，基于搜索结果；否则基于所有原始笔记
        const baseNotes = (isSearching && searchQuery.trim()) ? searchFilteredNotes : allOriginalNotes;

        // 过滤出有图片的记录
        const allNotesWithImages = baseNotes.filter(note => note.image && note.image.trim() !== '');

        // 获取有图片记录的设备列表
        const equipmentSet = new Set<string>();
        allNotesWithImages.forEach(note => {
            if (note.equipment) {
                equipmentSet.add(note.equipment);
            }
        });

        // 获取有图片记录的豆子列表
        const beanSet = new Set<string>();
        allNotesWithImages.forEach(note => {
            if (note.coffeeBeanInfo?.name) {
                beanSet.add(note.coffeeBeanInfo.name);
            }
        });

        return {
            equipments: Array.from(equipmentSet).sort(),
            beans: Array.from(beanSet).sort()
        };
    }, [isImageFlowMode, isDateImageFlowMode, isSearching, searchQuery, searchFilteredNotes, availableEquipments, availableBeans]);

    // 在图片流模式下，如果当前选中的设备或豆子没有图片记录，自动切换到"全部"
    useEffect(() => {
        if (!imageFlowStats) return;

        const { equipments, beans } = imageFlowAvailableOptions;

        // 检查当前选中的设备是否在有图片的设备列表中
        if (filterMode === 'equipment' && selectedEquipment && !equipments.includes(selectedEquipment)) {
            handleEquipmentClick(null);
        }

        // 检查当前选中的豆子是否在有图片的豆子列表中
        if (filterMode === 'bean' && selectedBean && !beans.includes(selectedBean)) {
            handleBeanClick(null);
        }
    }, [imageFlowStats, imageFlowAvailableOptions, filterMode, selectedEquipment, selectedBean, handleEquipmentClick, handleBeanClick]);
    
    if (!isOpen) return null;
    
    return (
        <>
            {/* 主要内容区域 - 始终显示笔记列表 */}
                    <div className="pt-6 space-y-6 sticky top-0 bg-neutral-50 dark:bg-neutral-900 z-20 flex-none">
                        {/* 数量显示 */}
                        <div className="flex justify-between items-center mb-6 px-6">
                            <div className="text-xs font-medium tracking-wide text-neutral-800 dark:text-neutral-100 break-words">
                                {(() => {
                                    // 图片流模式下显示有图片的记录统计
                                    if (imageFlowStats) {
                                        return imageFlowStats.count === 0
                                            ? ""
                                            : `${imageFlowStats.count} 条图片记录，已消耗 ${formatConsumption(imageFlowStats.consumption)}`;
                                    }

                                    // 普通模式下显示总记录统计
                                    return totalCount === 0
                                        ? "" // 当没有笔记记录时不显示统计信息
                                        : (isSearching && searchQuery.trim())
                                            ? `${searchFilteredNotes.length} 条记录，已消耗 ${formatConsumption(currentConsumption)}`
                                            : `${totalCount} 条记录，已消耗 ${formatConsumption(currentConsumption)}`;
                                })()}
                            </div>
                        </div>

                        {/* 设备筛选选项卡 */}
                        <FilterTabs
                            filterMode={filterMode}
                            selectedEquipment={selectedEquipment}
                            selectedBean={selectedBean}
                            availableEquipments={imageFlowAvailableOptions.equipments}
                            availableBeans={imageFlowAvailableOptions.beans}
                            equipmentNames={equipmentNames}
                            onFilterModeChange={handleFilterModeChange}
                            onEquipmentClick={handleEquipmentClick}
                            onBeanClick={handleBeanClick}
                            isSearching={isSearching}
                            searchQuery={searchQuery}
                            onSearchClick={handleSearchClick}
                            onSearchChange={handleSearchChange}
                            onSearchKeyDown={handleSearchKeyDown}
                            sortOption={sortOption}
                            onSortChange={handleSortChange}
                            viewMode={viewMode}
                            onViewModeChange={handleViewModeChange}
                            isImageFlowMode={isImageFlowMode}
                            onToggleImageFlowMode={handleToggleImageFlowMode}
                            isDateImageFlowMode={isDateImageFlowMode}
                            onToggleDateImageFlowMode={handleToggleDateImageFlowMode}
                            onSmartToggleImageFlow={handleSmartToggleImageFlow}
                            settings={settings}
                            hasExtractionTimeData={hasExtractionTimeData}
                            searchSortOption={searchSortOption || undefined}
                            onSearchSortChange={handleSearchSortChange}
                        />
                    </div>

                    <div
                        className="w-full h-full overflow-y-auto scroll-with-bottom-bar"
                        ref={notesContainerRef}
                    >
                        {/* 笔记列表视图 - 始终传递正确的笔记数据 */}
                        <ListView
                            selectedEquipment={selectedEquipment}
                            selectedBean={selectedBean}
                            filterMode={filterMode}
                            onNoteClick={handleNoteClick}
                            onDeleteNote={handleDelete}
                            isShareMode={isShareMode}
                            selectedNotes={selectedNotes}
                            onToggleSelect={handleToggleSelect}
                            searchQuery={searchQuery}
                            isSearching={isSearching}
                            preFilteredNotes={isSearching && searchQuery.trim() ? searchFilteredNotes : filteredNotes}
                            viewMode={viewMode}
                            isDateImageFlowMode={isDateImageFlowMode}
                            scrollParentRef={notesContainerRef.current || undefined}
                            equipmentNames={equipmentNames}
                            beanPrices={{}}
                        />
                    </div>

                    {/* 底部操作栏 - 分享模式下显示保存和取消按钮，图片流模式下隐藏添加按钮 */}
                    {isShareMode ? (
                        <div className="bottom-action-bar">
                            <div className="absolute bottom-full left-0 right-0 h-12 bg-linear-to-t from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
                            <div className="relative max-w-[500px] mx-auto flex items-center bg-neutral-50 dark:bg-neutral-900 pb-safe-bottom">
                                <div className="grow border-t border-neutral-200 dark:border-neutral-800"></div>
                                <button
                                    onClick={handleCancelShare}
                                    className="flex items-center justify-center text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:opacity-80 mx-3"
                                >
                                    取消
                                </button>
                                <div className="grow border-t border-neutral-200 dark:border-neutral-800"></div>
                                <button
                                    onClick={handleSaveNotes}
                                    disabled={selectedNotes.length === 0 || isSaving}
                                    className={`flex items-center justify-center text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:opacity-80 mx-3 ${
                                        (selectedNotes.length === 0 || isSaving) ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                >
                                    {isSaving ? '生成中...' : `保存为图片 (${selectedNotes.length})`}
                                </button>
                                <div className="grow border-t border-neutral-200 dark:border-neutral-800"></div>
                            </div>
                        </div>
                    ) : !isImageFlowMode && !isDateImageFlowMode && (
                        <AddNoteButton onAddNote={handleAddNote} />
                    )}

            {/* 模态组件 */}
            <BrewingNoteEditModal
                showModal={!!editingNote}
                initialData={editingNote}
                onSave={handleSaveEdit}
                onClose={() => {
                    setEditingNote(null)
                }}
                settings={settings}
            />

            {editingChangeRecord && (
                <ChangeRecordEditModal
                    showModal={showChangeRecordEditModal}
                    initialData={editingChangeRecord}
                    onSave={handleSaveChangeRecord}
                    onConvertToNormalNote={handleConvertToNormalNote}
                    onClose={() => {
                        setEditingChangeRecord(null)
                        setShowChangeRecordEditModal(false)
                    }}
                    settings={settings}
                />
            )}

            {/* 消息提示 */}
            <Toast
                visible={toast.visible}
                message={toast.message}
                type={toast.type}
            />
        </>
    );
};

export default BrewingHistory; 
