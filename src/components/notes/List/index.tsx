'use client'

import React, { useState, useEffect, useRef, useCallback, useReducer, useMemo } from 'react'
import { Storage } from '@/lib/core/storage'
import { BrewingNote } from '@/lib/core/config'
import { BrewingHistoryProps } from '../types'

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
import NoteFormHeader from '@/components/notes/ui/NoteFormHeader'

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
    setAlternativeHeaderContent,
    setShowAlternativeHeader
}) => {
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

        // 修复笔记中的方案ID和咖啡豆信息
        const fixMethodIdsInNotes = async () => {
            try {
                // 获取现有笔记
                const savedNotes = await Storage.get('brewingNotes')
                if (!savedNotes) return
                
                let parsedNotes: BrewingNote[] = JSON.parse(savedNotes)
                let hasChanges = false
                

                
                // 加载自定义方案数据，用于查找ID对应的方案名称
                let customMethods: Record<string, any[]> = {}
                try {
                    const customMethodsModule = await import('@/lib/managers/customMethods')
                    customMethods = await customMethodsModule.loadCustomMethods()
                } catch (error) {
                    console.error('加载自定义方案失败:', error)
                }
                
                // 检查每条笔记
                parsedNotes = parsedNotes.map(note => {
                    let noteFixed = false
                    
                    // 1. 检查方案名称是否是ID格式 (UUID格式或以"method-"开头)
                    if (note.method && typeof note.method === 'string' && 
                        (note.method.startsWith('method-') || 
                         /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(note.method))) {
                        const methodId = note.method
                        
                        // 查找对应的方案
                        if (customMethods && Object.keys(customMethods).length > 0) {
                            // 遍历所有设备的方案
                            for (const equipmentId in customMethods) {
                                const methods = customMethods[equipmentId]
                                if (Array.isArray(methods)) {
                                    // 查找匹配的方案
                                    const method = methods.find(m => m.id === methodId)
                                    if (method && method.name) {
                                        // 更新为方案名称
                                        note.method = method.name
                                        noteFixed = true
                                        break
                                    }
                                }
                            }
                        }
                    }
                    
                    // 2. 检查咖啡豆信息是否完整
                    // 如果有beanId但coffeeBeanInfo不完整，尝试加载咖啡豆信息
                    if (note.beanId && (!note.coffeeBeanInfo || !note.coffeeBeanInfo.name)) {
                        console.log(`笔记 ${note.id} 有beanId但咖啡豆信息不完整`)
                        noteFixed = true
                    }
                    
                    // 3. 移除多余的coffeeBean对象 (使用类型断言处理)
                    if ((note as any).coffeeBean) {
                        delete (note as any).coffeeBean
                        noteFixed = true
                    }
                    
                    if (noteFixed) {
                        hasChanges = true
                    }
                    
                    return note
                })
                
                // 如果有修改，保存更新后的笔记
                if (hasChanges) {
                    await Storage.set('brewingNotes', JSON.stringify(parsedNotes))
                    console.log('已修复笔记数据问题')
                    
                    // 触发重新加载
                    loadEquipmentsAndBeans()
                }
            } catch (error) {
                console.error('修复笔记数据失败:', error)
            }
        }
        
        // 如果是打开状态才执行修复
        if (isOpen) {
            fixMethodIdsInNotes()
        }
        
        window.addEventListener('storage', handleStorageChange)
        window.addEventListener('customStorageChange', handleCustomStorageChange as EventListener)
        
        return () => {
            window.removeEventListener('storage', handleStorageChange)
            window.removeEventListener('customStorageChange', handleCustomStorageChange as EventListener)
        }
    }, [isOpen, loadEquipmentsAndBeans])
    
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
    
    // 处理笔记点击 - 添加导航栏替代头部支持
    const handleNoteClick = (note: BrewingNote) => {
        // 准备要编辑的笔记数据
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
            totalTime: note.totalTime
        };
        
        // 设置编辑笔记数据
        setEditingNote(noteToEdit);
        
        // 如果提供了导航栏替代头部功能，则使用
        if (setAlternativeHeaderContent && setShowAlternativeHeader) {
            // 获取原始时间戳作为Date对象
            const timestamp = new Date(note.timestamp);
            
            // 创建笔记编辑头部内容
            const headerContent = (
                <NoteFormHeader
                    isEditMode={true}
                    onBack={() => {
                        // 关闭编辑并恢复正常导航栏
                        setEditingNote(null);
                        setShowAlternativeHeader(false);
                        setAlternativeHeaderContent(null);
                    }}
                    onSave={() => {
                        // 获取表单元素并触发提交
                        const form = document.querySelector('form');
                        if (form) {
                            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                        }
                    }}
                    showSaveButton={true}
                    timestamp={timestamp}
                />
            );
            
            // 设置替代头部内容并显示
            setAlternativeHeaderContent(headerContent);
            setShowAlternativeHeader(true);
        }
    };
    
    // 处理保存编辑 - 添加导航栏替代头部支持
    const handleSaveEdit = async (updatedData: BrewingNoteData) => {
        try {
            // 获取现有笔记
            const savedNotes = await Storage.get('brewingNotes')
            let parsedNotes: BrewingNote[] = savedNotes ? JSON.parse(savedNotes) : []

            // 查找并更新指定笔记
            parsedNotes = parsedNotes.map(note => {
                if (note.id === updatedData.id) {
                    return updatedData as BrewingNote
                }
                return note
            })

            // 保存更新后的笔记
            await Storage.set('brewingNotes', JSON.stringify(parsedNotes))

            // 立即更新全局缓存，确保UI能立即反映变化
            globalCache.notes = parsedNotes;

            // 重新计算过滤后的笔记
            let filteredNotes = parsedNotes;
            if (filterMode === 'equipment' && selectedEquipment) {
                filteredNotes = parsedNotes.filter(note => note.equipment === selectedEquipment);
            } else if (filterMode === 'bean' && selectedBean) {
                filteredNotes = parsedNotes.filter(note =>
                    note.coffeeBeanInfo?.name === selectedBean
                );
            }
            globalCache.filteredNotes = filteredNotes;

            // 重新计算总消耗量
            globalCache.totalConsumption = calculateTotalCoffeeConsumption(parsedNotes);

            // 触发重新渲染
            triggerRerender();

            // 触发存储变更事件
            window.dispatchEvent(new CustomEvent('customStorageChange', {
                detail: { key: 'brewingNotes' }
            }))

            // 关闭编辑
            setEditingNote(null)

            // 如果提供了导航栏替代头部功能，则关闭它
            if (setShowAlternativeHeader) {
                setShowAlternativeHeader(false);
            }
            if (setAlternativeHeaderContent) {
                setAlternativeHeaderContent(null);
            }

            // 显示成功提示
            showToast('笔记已更新', 'success')
        } catch (error) {
            console.error('更新笔记失败:', error)
            showToast('更新笔记失败', 'error')
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
    
    // 搜索过滤逻辑 - 从ListView组件移到这里，确保记录数量显示和列表内容一致
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
    }, [isSearching, searchQuery, globalCache.filteredNotes]);
    
    // 计算当前筛选或搜索结果的消耗量
    const currentConsumption = useMemo(() => {
        // 搜索状态下，计算搜索结果的消耗量
        if (isSearching && searchQuery.trim()) {
            return calculateTotalCoffeeConsumption(searchFilteredNotes);
        }
        
        // 筛选状态下，使用已筛选的笔记计算消耗量
        if (selectedEquipment || selectedBean) {
            return calculateTotalCoffeeConsumption(globalCache.filteredNotes);
        }
        
        // 无筛选时，返回所有笔记的总消耗量
        return globalCache.totalConsumption || totalCoffeeConsumption.current;
    }, [isSearching, searchQuery, searchFilteredNotes, selectedEquipment, selectedBean, globalCache.filteredNotes, globalCache.totalConsumption, totalCoffeeConsumption]);
    
    if (!isOpen) return null;
    
    return (
        <div className="h-full flex flex-col overflow-y-scroll">
            {editingNote ? (
                <BrewingNoteForm
                    id={editingNote.id}
                    isOpen={true}
                    onClose={() => {
                        setEditingNote(null);
                        // 如果使用了替代头部，同时关闭它
                        if (setShowAlternativeHeader) {
                            setShowAlternativeHeader(false);
                        }
                        if (setAlternativeHeaderContent) {
                            setAlternativeHeaderContent(null);
                        }
                    }}
                    onSave={handleSaveEdit}
                    initialData={editingNote}
                    hideHeader={!!setAlternativeHeaderContent && !!setShowAlternativeHeader}
                />
            ) : (
                <>
                    <div className="pt-6 space-y-6 sticky top-0 bg-neutral-50 dark:bg-neutral-900 z-20 flex-none">
                        {/* 数量显示 */}
                        <div className="flex justify-between items-center mb-6 px-6">
                            <div className="text-xs font-medium tracking-wide text-neutral-800 dark:text-neutral-100 break-words">
                                {(isSearching && searchQuery.trim())
                                    ? `${searchFilteredNotes.length} 条记录，已消耗 ${formatConsumption(currentConsumption)}`
                                    : `${selectedEquipment || selectedBean
                                        ? globalCache.filteredNotes.length
                                        : globalCache.notes.length} 条记录，已消耗 ${formatConsumption(currentConsumption)}`}
                            </div>
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
                            sortOption={sortOption}
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
                                    className="flex items-center justify-center text-[11px] text-neutral-800 dark:text-neutral-100 hover:opacity-80 mx-3"
                                >
                                    取消
                                </button>
                                <div className="grow border-t border-neutral-200 dark:border-neutral-800"></div>
                                <button
                                    onClick={handleSaveNotes}
                                    disabled={selectedNotes.length === 0 || isSaving}
                                    className={`flex items-center justify-center text-[11px] text-neutral-800 dark:text-neutral-100 hover:opacity-80 mx-3 ${
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