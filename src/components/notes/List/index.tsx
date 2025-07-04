'use client'

import React, { useState, useEffect, useRef, useCallback, useReducer, useMemo } from 'react'
import { BrewingNote } from '@/lib/core/config'
import { BrewingHistoryProps } from '../types'

import FilterTabs from './FilterTabs'
import AddNoteButton from './AddNoteButton'
import Toast from '../ui/Toast'

import BrewingNoteEditModal from '../Form/BrewingNoteEditModal'
import ChangeRecordEditModal from '../Form/ChangeRecordEditModal'
import { BrewingNoteData } from '@/types/app'
import { getEquipmentName, normalizeEquipmentId } from '../utils'
import { globalCache, saveSelectedEquipmentPreference, saveSelectedBeanPreference, saveFilterModePreference, saveSortOptionPreference, calculateTotalCoffeeConsumption, formatConsumption, initializeGlobalCache } from './globalCache'
import ListView from './ListView'
import { SortOption } from '../types'
import { exportSelectedNotes } from '../Share/NotesExporter'
import { useEnhancedNotesFiltering } from './hooks/useEnhancedNotesFiltering'




// 为Window对象声明类型扩展
declare global {
    interface Window {
        refreshBrewingNotes?: () => void;
    }
}

const BrewingHistory: React.FC<BrewingHistoryProps> = ({
    isOpen,
    onClose: _onClose,
    onAddNote,
    setAlternativeHeaderContent: _setAlternativeHeaderContent, // 不再使用，保留以兼容接口
    setShowAlternativeHeader: _setShowAlternativeHeader, // 不再使用，保留以兼容接口
    settings
}) => {
    // 用于跟踪用户选择
    const [sortOption, setSortOption] = useState<SortOption>(globalCache.sortOption)
    const [filterMode, setFilterMode] = useState<'equipment' | 'bean'>(globalCache.filterMode)
    const [selectedEquipment, setSelectedEquipment] = useState<string | null>(globalCache.selectedEquipment)
    const [selectedBean, setSelectedBean] = useState<string | null>(globalCache.selectedBean)
    const [editingNote, setEditingNote] = useState<BrewingNoteData | null>(null)
    const [editingChangeRecord, setEditingChangeRecord] = useState<BrewingNote | null>(null)

    // 模态显示状态
    const [showNoteEditModal, setShowNoteEditModal] = useState(false)
    const [showChangeRecordEditModal, setShowChangeRecordEditModal] = useState(false)
    
    // 分享模式状态
    const [isShareMode, setIsShareMode] = useState(false)
    const [selectedNotes, setSelectedNotes] = useState<string[]>([])
    const [isSaving, setIsSaving] = useState(false)
    
    // 搜索相关状态
    const [isSearching, setIsSearching] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    
    // 预览容器引用
    const notesContainerRef = useRef<HTMLDivElement>(null)
    
    // Toast消息状态
    const [toast, setToast] = useState({
        visible: false,
        message: '',
        type: 'info' as 'success' | 'error' | 'info'
    })
    
    // 搜索过滤逻辑 - 需要在Hook之前定义
    const searchFilteredNotes = useMemo(() => {
        if (!isSearching || !searchQuery.trim()) return globalCache.filteredNotes;

        const query = searchQuery.toLowerCase().trim();

        // 将查询拆分为多个关键词，移除空字符串
        const queryTerms = query.split(/\s+/).filter(term => term.length > 0);

        // 给每个笔记计算匹配分数
        const notesWithScores = globalCache.filteredNotes.map(note => {
            // 预处理各个字段，转化为小写并确保有值
            const equipment = note.equipment?.toLowerCase() || '';
            const method = note.method?.toLowerCase() || '';
            const beanName = note.coffeeBeanInfo?.name?.toLowerCase() || '';
            const roastLevel = note.coffeeBeanInfo?.roastLevel?.toLowerCase() || '';
            const notes = note.notes?.toLowerCase() || '';

            // 处理参数信息
            const coffee = note.params?.coffee?.toLowerCase() || '';
            const water = note.params?.water?.toLowerCase() || '';
            const ratio = note.params?.ratio?.toLowerCase() || '';
            const grindSize = note.params?.grindSize?.toLowerCase() || '';
            const temp = note.params?.temp?.toLowerCase() || '';

            // 处理口味评分信息
            const tasteInfo = `酸度${note.taste?.acidity || 0} 甜度${note.taste?.sweetness || 0} 苦度${note.taste?.bitterness || 0} 醇厚度${note.taste?.body || 0}`.toLowerCase();

            // 处理时间信息
            const dateInfo = note.timestamp ? new Date(note.timestamp).toLocaleDateString() : '';
            const totalTime = note.totalTime ? `${note.totalTime}秒` : '';

            // 将评分转换为可搜索文本，如"评分4"、"4分"、"4星"
            const ratingText = note.rating ? `评分${note.rating} ${note.rating}分 ${note.rating}星`.toLowerCase() : '';

            // 组合所有可搜索文本到一个数组，为不同字段分配权重
            const searchableTexts = [
                { text: beanName, weight: 3 },          // 豆子名称权重最高
                { text: equipment, weight: 2 },         // 设备名称权重较高
                { text: method, weight: 2 },            // 冲煮方法权重较高
                { text: notes, weight: 2 },             // 笔记内容权重较高
                { text: roastLevel, weight: 1 },        // 烘焙度权重一般
                { text: coffee, weight: 1 },            // 咖啡粉量权重一般
                { text: water, weight: 1 },             // 水量权重一般
                { text: ratio, weight: 1 },             // 比例权重一般
                { text: grindSize, weight: 1 },         // 研磨度权重一般
                { text: temp, weight: 1 },              // 水温权重一般
                { text: tasteInfo, weight: 1 },         // 口味信息权重一般
                { text: dateInfo, weight: 1 },          // 日期信息权重一般
                { text: totalTime, weight: 1 },         // 总时间权重一般
                { text: ratingText, weight: 1 }         // 评分文本权重一般
            ];

            // 计算匹配分数 - 所有匹配关键词的权重总和
            let score = 0;
            let allTermsMatch = true;

            for (const term of queryTerms) {
                // 检查当前关键词是否至少匹配一个字段
                const termMatches = searchableTexts.some(({ text }) => text.includes(term));

                if (!termMatches) {
                    allTermsMatch = false;
                    break;
                }

                // 累加匹配到的权重
                for (const { text, weight } of searchableTexts) {
                    if (text.includes(term)) {
                        score += weight;

                        // 精确匹配整个字段给予额外加分
                        if (text === term) {
                            score += weight * 2;
                        }

                        // 匹配字段开头给予额外加分
                        if (text.startsWith(term)) {
                            score += weight;
                        }
                    }
                }
            }

            return {
                note,
                score,
                matches: allTermsMatch
            };
        });

        // 过滤掉不匹配所有关键词的笔记
        const matchingNotes = notesWithScores.filter(item => item.matches);

        // 根据分数排序，分数高的在前面
        matchingNotes.sort((a, b) => b.score - a.score);

        // 返回排序后的笔记列表
        return matchingNotes.map(item => item.note);
    }, [isSearching, searchQuery]);

    // 使用增强的笔记筛选Hook
    const {
        filteredNotes,
        totalCount,
        totalConsumption,
        availableEquipments,
        availableBeans,
        debouncedUpdateFilters
    } = useEnhancedNotesFiltering({
        notes: globalCache.notes,
        sortOption,
        filterMode,
        selectedEquipment,
        selectedBean,
        searchQuery,
        isSearching,
        preFilteredNotes: isSearching && searchQuery.trim() ? searchFilteredNotes : undefined
    })

    // 计算总咖啡消耗量
    const totalCoffeeConsumption = useRef(globalCache.totalConsumption || 0)
    const [, _forceUpdate] = useReducer(x => x + 1, 0)

    // 强制组件重新渲染的函数
    const triggerRerender = useCallback(() => {
        _forceUpdate()
    }, [])

    // 更新全局缓存的函数
    const updateGlobalCache = useCallback(() => {
        globalCache.filteredNotes = filteredNotes
        globalCache.totalConsumption = totalConsumption
        totalCoffeeConsumption.current = totalConsumption

        // 触发重新渲染
        if (typeof window !== 'undefined' && window.refreshBrewingNotes) {
            window.refreshBrewingNotes()
        }
        triggerRerender()
    }, [filteredNotes, totalConsumption, triggerRerender])

    // 当筛选结果变化时更新全局缓存
    useEffect(() => {
        updateGlobalCache()
    }, [updateGlobalCache])

    // 清理重复器具的工具函数
    const cleanupDuplicateEquipments = useCallback(async (notes: BrewingNote[]): Promise<BrewingNote[]> => {
        const normalizedEquipmentMap: Record<string, string> = {};
        let hasChanges = false;

        // 构建规范化映射
        for (const note of notes) {
            if (note.equipment && !normalizedEquipmentMap[note.equipment]) {
                try {
                    const normalizedId = await normalizeEquipmentId(note.equipment);
                    normalizedEquipmentMap[note.equipment] = normalizedId;
                    if (normalizedId !== note.equipment) {
                        hasChanges = true;
                    }
                } catch (error) {
                    console.error(`规范化设备ID失败: ${note.equipment}`, error);
                    normalizedEquipmentMap[note.equipment] = note.equipment;
                }
            }
        }

        // 如果有变化，更新笔记中的器具ID
        if (hasChanges) {
            const updatedNotes = notes.map(note => {
                if (note.equipment && normalizedEquipmentMap[note.equipment] !== note.equipment) {
                    return {
                        ...note,
                        equipment: normalizedEquipmentMap[note.equipment]
                    };
                }
                return note;
            });

            // 保存更新后的笔记
            try {
                const { Storage } = await import('@/lib/core/storage');
                await Storage.set('brewingNotes', JSON.stringify(updatedNotes));
            } catch (error) {
                console.error('保存清理后的笔记失败:', error);
            }

            return updatedNotes;
        }

        return notes;
    }, []);

    // 加载可用设备和咖啡豆列表
    const loadEquipmentsAndBeans = useCallback(async () => {
        try {
            // 避免未打开状态下加载数据
            if (!isOpen) return;

            // 从存储中加载数据
            const { Storage } = await import('@/lib/core/storage');
            const savedNotes = await Storage.get('brewingNotes');
            let parsedNotes: BrewingNote[] = savedNotes ? JSON.parse(savedNotes) : [];

            // 清理重复器具（一次性修复历史数据）
            parsedNotes = await cleanupDuplicateEquipments(parsedNotes);

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
            
            // 收集所有不重复的咖啡豆名称 - 优先使用最新的咖啡豆名称
            const beanNamesSet = new Set<string>();

            // 动态导入咖啡豆管理器
            const { CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager');

            for (const note of parsedNotes) {
                let beanName = '';

                // 优先通过 beanId 获取最新的咖啡豆名称
                if (note.beanId) {
                    try {
                        const bean = await CoffeeBeanManager.getBeanById(note.beanId);
                        if (bean?.name) {
                            beanName = bean.name;
                        }
                    } catch (error) {
                        console.warn('获取咖啡豆信息失败:', error);
                    }
                }

                // 如果通过 beanId 没有找到，使用笔记中存储的名称
                if (!beanName && note.coffeeBeanInfo?.name) {
                    beanName = note.coffeeBeanInfo.name;
                }

                if (beanName) {
                    beanNamesSet.add(beanName);
                }
            }

            const beanNames = Array.from(beanNamesSet);
            
            // 更新全局缓存
            globalCache.equipmentNames = namesMap;
            globalCache.availableEquipments = uniqueEquipmentIds;
            globalCache.availableBeans = beanNames;
            globalCache.notes = parsedNotes; // 确保全局缓存中有最新的笔记数据
            
            // 计算总消耗量并更新全局缓存
            const totalConsumption = calculateTotalCoffeeConsumption(parsedNotes);
            globalCache.totalConsumption = totalConsumption;
            totalCoffeeConsumption.current = totalConsumption;

            // 更新全局缓存的原始数据
            globalCache.notes = parsedNotes;

            // 确保globalCache.initialized设置为true
            globalCache.initialized = true;

            // 数据处理现在由 useEnhancedNotesFiltering Hook 自动处理
        } catch (error) {
            console.error("加载设备和咖啡豆数据失败:", error);
        }
    }, [isOpen, cleanupDuplicateEquipments]);
    
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
                // 总是重新加载数据以确保UI同步，但避免重复的网络请求
                loadEquipmentsAndBeans();
            }
        };

        // 监听咖啡豆更新事件
        const handleCoffeeBeansUpdated = () => {
            loadEquipmentsAndBeans();
        };

        // 监听笔记更新事件（由咖啡豆管理器触发）
        const handleBrewingNotesUpdated = () => {
            loadEquipmentsAndBeans();
        };


        window.addEventListener('storage', handleStorageChange)
        window.addEventListener('customStorageChange', handleCustomStorageChange as EventListener)
        window.addEventListener('coffeeBeansUpdated', handleCoffeeBeansUpdated)
        window.addEventListener('brewingNotesUpdated', handleBrewingNotesUpdated)

        return () => {
            window.removeEventListener('storage', handleStorageChange)
            window.removeEventListener('customStorageChange', handleCustomStorageChange as EventListener)
            window.removeEventListener('coffeeBeansUpdated', handleCoffeeBeansUpdated)
            window.removeEventListener('brewingNotesUpdated', handleBrewingNotesUpdated)
        }
    }, [isOpen, loadEquipmentsAndBeans])
    
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

            // 立即同步更新全局缓存
            globalCache.notes = updatedNotes;

            // 重新计算总消耗量
            globalCache.totalConsumption = calculateTotalCoffeeConsumption(updatedNotes);

            // 保存到存储 - Storage.set() 会自动触发事件
            await Storage.set('brewingNotes', JSON.stringify(updatedNotes));

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
            setShowNoteEditModal(true);
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

            // 立即更新全局缓存
            globalCache.notes = parsedNotes;

            // 重新计算总消耗量
            globalCache.totalConsumption = calculateTotalCoffeeConsumption(parsedNotes);

            // 数据处理现在由 useEnhancedNotesFiltering Hook 自动处理

            // 保存更新后的笔记 - Storage.set() 会自动触发事件
            await Storage.set('brewingNotes', JSON.stringify(parsedNotes))

            // 关闭模态和编辑状态
            setEditingNote(null)
            setShowNoteEditModal(false)

            // 显示成功提示
            showToast('笔记已更新', 'success')
        } catch (error) {
            console.error('更新笔记失败:', error)
            showToast('更新笔记失败', 'error')
        }
    }

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

            // 立即更新全局缓存
            globalCache.notes = parsedNotes;

            // 重新计算总消耗量
            globalCache.totalConsumption = calculateTotalCoffeeConsumption(parsedNotes);

            // 数据处理现在由 useEnhancedNotesFiltering Hook 自动处理

            // 保存更新后的笔记 - Storage.set() 会自动触发事件
            await Storage.set('brewingNotes', JSON.stringify(parsedNotes))

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
        globalCache.sortOption = option;
        // 数据筛选由 useEnhancedNotesFiltering Hook 自动处理
        debouncedUpdateFilters({ sortOption: option });
    };

    // 处理过滤模式变化
    const handleFilterModeChange = (mode: 'equipment' | 'bean') => {
        setFilterMode(mode);
        saveFilterModePreference(mode);
        globalCache.filterMode = mode;
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
    const handleEquipmentClick = (equipment: string | null) => {
        setSelectedEquipment(equipment);
        saveSelectedEquipmentPreference(equipment);
        globalCache.selectedEquipment = equipment;
        // 数据筛选由 useEnhancedNotesFiltering Hook 自动处理
        debouncedUpdateFilters({ selectedEquipment: equipment });
    };

    // 处理咖啡豆选择变化
    const handleBeanClick = (bean: string | null) => {
        setSelectedBean(bean);
        saveSelectedBeanPreference(bean);
        globalCache.selectedBean = bean;
        // 数据筛选由 useEnhancedNotesFiltering Hook 自动处理
        debouncedUpdateFilters({ selectedBean: bean });
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
    
    // 处理搜索按钮点击
    const handleSearchClick = () => {
        setIsSearching(!isSearching);
        if (isSearching) {
            // 清空搜索查询
            setSearchQuery('');
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
    
    if (!isOpen) return null;
    
    return (
        <>
            {/* 主要内容区域 - 始终显示笔记列表 */}
                    <div className="pt-6 space-y-6 sticky top-0 bg-neutral-50 dark:bg-neutral-900 z-20 flex-none">
                        {/* 数量显示 */}
                        <div className="flex justify-between items-center mb-6 px-6">
                            <div className="text-xs font-medium tracking-wide text-neutral-800 dark:text-neutral-100 break-words">
                                {(isSearching && searchQuery.trim())
                                    ? `${searchFilteredNotes.length} 条记录，已消耗 ${formatConsumption(currentConsumption)}`
                                    : `${totalCount} 条记录，已消耗 ${formatConsumption(currentConsumption)}`}
                            </div>
                        </div>

                        {/* 设备筛选选项卡 */}
                        <FilterTabs
                            filterMode={filterMode}
                            selectedEquipment={selectedEquipment}
                            selectedBean={selectedBean}
                            availableEquipments={availableEquipments}
                            availableBeans={availableBeans}
                            equipmentNames={globalCache.equipmentNames}
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
                        />
                    </div>

                    <div className="w-full h-full overflow-y-auto scroll-with-bottom-bar" ref={notesContainerRef}>
                        {/* 笔记列表视图 - 直接传递已过滤的搜索结果 */}
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
                            preFilteredNotes={isSearching && searchQuery.trim() ? searchFilteredNotes : undefined}
                        />
                    </div>

                    {/* 底部操作栏 - 分享模式下显示保存和取消按钮 */}
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
                    ) : (
                        <AddNoteButton onAddNote={handleAddNote} />
                    )}

            {/* 模态组件 */}
            {editingNote && (
                <BrewingNoteEditModal
                    showModal={showNoteEditModal}
                    initialData={editingNote}
                    onSave={handleSaveEdit}
                    onClose={() => {
                        setEditingNote(null)
                        setShowNoteEditModal(false)
                    }}
                    settings={settings}
                />
            )}

            {editingChangeRecord && (
                <ChangeRecordEditModal
                    showModal={showChangeRecordEditModal}
                    initialData={editingChangeRecord}
                    onSave={handleSaveChangeRecord}
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