import React, { useCallback, useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Method, equipmentList, CustomEquipment, commonMethods, createEditableMethodFromCommon } from '@/lib/core/config';
import StageItem from '@/components/brewing/stages/StageItem';
import StageDivider from '@/components/brewing/stages/StageDivider';
import { SettingsOptions } from '../settings/Settings';
import { TabType, MainTabType, Content, Step as BaseStep } from '@/lib/hooks/useBrewingState';
import { CoffeeBean } from '@/types/app';
import type { BrewingNoteData } from '@/types/app';
import { saveMainTabPreference } from '@/lib/navigation/navigationCache';
import { showToast } from "@/components/common/feedback/GlobalToast";
import { getEquipmentName } from '@/lib/brewing/parameters';
import BottomActionBar from '@/components/layout/BottomActionBar';
import CoffeeBeanList from '@/components/coffee-bean/List/ListView';

import { Search, X, Shuffle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
// 分享模态框已移除，改为直接复制到剪贴板


// 导入随机咖啡豆选择器组件
const CoffeeBeanRandomPicker = dynamic(() => import('@/components/coffee-bean/RandomPicker/CoffeeBeanRandomPicker'), {
    ssr: false,
    loading: () => null
});

// 扩展Step类型，增加固定方案所需的字段
interface Step extends BaseStep {
    customParams?: Record<string, string | number | boolean>;
    icon?: string;
    isPinned?: boolean;
    isDivider?: boolean;
    dividerText?: string;
    explicitMethodType?: 'common' | 'custom';
}

// 动态导入客户端组件
const PourVisualizer = dynamic(() => import('@/components/brewing/PourVisualizer'), {
    ssr: false,
    loading: () => null
});

// 动态导入笔记表单组件
const BrewingNoteForm = dynamic(() => import('@/components/notes/Form/BrewingNoteForm').then(mod => mod.default), {
    ssr: false,
    loading: () => null
});

interface TabContentProps {
    activeMainTab: MainTabType;
    activeTab: TabType;
    content: Content;
    selectedMethod: Method | null;
    currentBrewingMethod: Method | null;
    isTimerRunning: boolean;
    showComplete: boolean;
    currentStage: number;
    isWaiting?: boolean;
    selectedEquipment: string | null;
    selectedCoffeeBean?: string | null;
    selectedCoffeeBeanData?: CoffeeBean | null;
    countdownTime: number | null;
    customMethods: Record<string, Method[]>;
    actionMenuStates: Record<string, boolean>;
    setActionMenuStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    setShowCustomForm: (show: boolean) => void;
    setShowImportForm: (show: boolean) => void;
    settings: SettingsOptions;
    onMethodSelect: (index: number, step?: Step) => void;
    onCoffeeBeanSelect?: (beanId: string | null, bean: CoffeeBean | null) => void;
    onEditMethod: (method: Method) => void;
    onDeleteMethod: (method: Method) => void;
    setActiveMainTab?: (tab: MainTabType) => void;
    resetBrewingState?: (shouldReset: boolean) => void;
    setIsNoteSaved?: (saved: boolean) => void;
    expandedStages?: {
        type: 'pour' | 'wait';
        label: string;
        startTime: number;
        endTime: number;
        time: number;
        pourTime?: number;
        water: string;
        detail: string;
        pourType?: string;
        valveStatus?: 'open' | 'closed';
        originalIndex: number;
    }[];
    customEquipments: CustomEquipment[];
    setShowEquipmentForm: (show: boolean) => void;
    setEditingEquipment: (equipment: CustomEquipment | undefined) => void;
    handleDeleteEquipment: (equipment: CustomEquipment) => Promise<void>;
}

const TabContent: React.FC<TabContentProps> = ({
    activeMainTab,
    activeTab,
    content,
    selectedMethod,
    currentBrewingMethod,
    isTimerRunning,
    showComplete,
    currentStage,
    isWaiting = false,
    selectedEquipment,
    selectedCoffeeBean,
    selectedCoffeeBeanData,
    countdownTime,
    customMethods,
    actionMenuStates,
    setActionMenuStates,
    setShowCustomForm,
    setShowImportForm,
    settings,
    onMethodSelect,
    onCoffeeBeanSelect,
    onEditMethod,
    onDeleteMethod,
    setActiveMainTab,
    resetBrewingState,
    setIsNoteSaved,
    expandedStages,
    customEquipments,
    setShowEquipmentForm,
    setEditingEquipment,
    handleDeleteEquipment,
}) => {
    // 笔记表单状态
    const [noteSaved, setNoteSaved] = useState(false);

    // 本地流速显示设置
    const [localShowFlowRate, setLocalShowFlowRate] = useState(settings.showFlowRate);

    // 添加高亮豆子ID状态
    const [highlightedBeanId, setHighlightedBeanId] = useState<string | null>(null);

    // 添加随机按钮禁用状态
    const [isRandomButtonDisabled, setIsRandomButtonDisabled] = useState(false);

    // 随机选择器状态
    const [showRandomPicker, setShowRandomPicker] = useState(false);
    const [allBeans, setAllBeans] = useState<CoffeeBean[]>([]);

    // 分享功能已简化为直接复制到剪贴板，不再需要模态框状态

    // 监听流速显示设置变化
    useEffect(() => {
        setLocalShowFlowRate(settings.showFlowRate);
    }, [settings.showFlowRate]);

    // 监听流速设置变更事件
    useEffect(() => {
        const handleSettingsChange = (e: CustomEvent) => {
            if (e.detail && e.detail.showFlowRate !== undefined) {
                setLocalShowFlowRate(e.detail.showFlowRate);
            }
        };

        // 添加事件监听
        window.addEventListener('brewing:settingsChange', handleSettingsChange as EventListener);

        // 清理函数
        return () => {
            window.removeEventListener('brewing:settingsChange', handleSettingsChange as EventListener);
        };
    }, []);

    // 触感反馈函数
    const triggerHapticFeedback = useCallback(async () => {
        if (settings?.hapticFeedback) {
            const hapticsUtils = await import('@/lib/ui/haptics');
            hapticsUtils.default.light();
        }
    }, [settings?.hapticFeedback]);

    // 加载所有咖啡豆数据 - 优化：只在首次需要时加载
    useEffect(() => {
        const loadBeans = async () => {
            try {
                const { CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager');
                const beans = await CoffeeBeanManager.getAllBeans();
                setAllBeans(beans);
            } catch (error) {
                console.error('加载咖啡豆失败:', error);
            }
        };

        // 只在没有数据且需要时才加载
        if (activeTab === '咖啡豆' && allBeans.length === 0) {
            loadBeans();
        }
    }, [activeTab, allBeans.length]);

    // 监听咖啡豆更新事件 - 使用 useRef 避免重新挂载
    const handleBeansUpdatedRef = useRef<((event?: Event) => Promise<void>) | null>(null);

    // 创建稳定的事件处理函数
    useEffect(() => {
        handleBeansUpdatedRef.current = async (_event?: Event) => {
            try {
                const { CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager');
                const beans = await CoffeeBeanManager.getAllBeans();
                setAllBeans(beans);
            } catch (error) {
                console.error('更新咖啡豆数据失败:', error);
            }
        };
    });

    // 只在组件挂载时设置事件监听器，避免重复挂载
    useEffect(() => {
        // 组件挂载时立即获取最新数据，防止错过事件
        const loadLatestData = async () => {
            try {
                const { CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager');
                const beans = await CoffeeBeanManager.getAllBeans();
                setAllBeans(beans);
            } catch (error) {
                console.error('挂载时加载数据失败:', error);
            }
        };

        loadLatestData(); // 立即加载最新数据

        const handleBeansUpdated = (_event?: Event) => {
            if (handleBeansUpdatedRef.current) {
                handleBeansUpdatedRef.current(_event);
            }
        };

        window.addEventListener('coffeeBeansUpdated', handleBeansUpdated);

        return () => {
            window.removeEventListener('coffeeBeansUpdated', handleBeansUpdated);
        };
    }, []); // 空依赖数组，只在挂载时执行一次

    // 简化的保存笔记处理 - 统一数据流避免竞态条件
    const handleSaveNote = async (note: BrewingNoteData) => {
        try {
            const Storage = (await import('@/lib/core/storage')).Storage;
            const existingNotesStr = await Storage.get('brewingNotes');
            const existingNotes = existingNotesStr ? JSON.parse(existingNotesStr) : [];

            const isExistingNote = note.id && existingNotes.some((n: BrewingNoteData) => n.id === note.id);
            const noteData = {
                ...note,
                id: note.id || Date.now().toString(),
                timestamp: isExistingNote
                    ? existingNotes.find((n: BrewingNoteData) => n.id === note.id)?.timestamp || Date.now()
                    : Date.now(),
            };

            const updatedNotes = isExistingNote
                ? existingNotes.map((n: BrewingNoteData) => n.id === noteData.id ? noteData : n)
                : [noteData, ...existingNotes];

            // 立即同步更新全局缓存，避免竞态条件
            try {
                const { globalCache } = await import('@/components/notes/List/globalCache');
                globalCache.notes = updatedNotes;

                // 重新计算总消耗量
                const { calculateTotalCoffeeConsumption } = await import('@/components/notes/List/globalCache');
                globalCache.totalConsumption = calculateTotalCoffeeConsumption(updatedNotes);
            } catch (error) {
                console.error('更新全局缓存失败:', error);
            }

            // 保存到存储 - Storage.set() 会自动触发事件
            await Storage.set('brewingNotes', JSON.stringify(updatedNotes));

            setNoteSaved(true);
            setIsNoteSaved?.(true);

            // 扣减咖啡豆用量
            if (selectedCoffeeBean && currentBrewingMethod?.params.coffee) {
                const coffeeAmount = parseFloat(currentBrewingMethod.params.coffee);
                if (!isNaN(coffeeAmount) && coffeeAmount > 0) {
                    const { CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager');
                    await CoffeeBeanManager.updateBeanRemaining(selectedCoffeeBean, coffeeAmount);
                }
            }

            // 清理状态
            localStorage.removeItem('brewingNoteInProgress');

            if (setActiveMainTab) {
                saveMainTabPreference('笔记');
                setActiveMainTab('笔记');
            }

            if (resetBrewingState) {
                resetBrewingState(false);
                localStorage.setItem('shouldStartFromCoffeeBeanStep', 'true');
            }
        } catch {
            alert('保存失败，请重试');
        }
    };

    // 处理关闭笔记表单
    const handleCloseNoteForm = () => {
        if (noteSaved && setActiveMainTab) {
            // 清除笔记进行中的标记
            localStorage.removeItem('brewingNoteInProgress');

            saveMainTabPreference('笔记');
            setActiveMainTab('笔记');
            if (resetBrewingState) {
                resetBrewingState(false);
                localStorage.setItem('shouldStartFromCoffeeBeanStep', 'true');
            }
        } else {
            localStorage.setItem('brewingNoteInProgress', 'false');
        }
    };

    // 获取当前选中的自定义器具
    const getSelectedCustomEquipment = useCallback(() => {
        if (!selectedEquipment) return undefined;

        const equipmentById = customEquipments.find(e => e.id === selectedEquipment);
        if (equipmentById?.animationType) return equipmentById;

        const equipmentByName = customEquipments.find(e => e.name === selectedEquipment);
        if (equipmentByName?.animationType) return equipmentByName;

        return undefined;
    }, [selectedEquipment, customEquipments]);

    // 笔记表单包装组件
    const NoteFormWrapper = () => {
        const [equipmentName, setEquipmentName] = useState('');

        React.useEffect(() => {
            if (selectedEquipment) {
                getEquipmentNameForNote(selectedEquipment).then(setEquipmentName);
            }
        }, [selectedEquipment]);

        return (
            <BrewingNoteForm
                id={undefined}
                isOpen={true}
                onClose={handleCloseNoteForm}
                onSave={handleSaveNote}
                inBrewPage={true}
                initialData={{
                    equipment: equipmentName || selectedEquipment || '',
                    method: currentBrewingMethod?.name || '',
                    params: currentBrewingMethod?.params || {
                        coffee: '15g',
                        water: '225g',
                        ratio: '1:15',
                        grindSize: '中细',
                        temp: '92°C',
                        videoUrl: '',
                        stages: []
                    },
                    totalTime: showComplete && currentBrewingMethod ? currentBrewingMethod.params.stages[currentBrewingMethod.params.stages.length - 1].time : 0,
                    coffeeBean: selectedCoffeeBeanData || undefined
                }}
            />
        );
    };

    // 获取设备名称
    const getEquipmentNameForNote = async (equipmentId: string): Promise<string> => {
        const standardEquipment = equipmentList.find(e => e.id === equipmentId);
        if (standardEquipment) return standardEquipment.name;

        try {
            // 使用动态导入，但只导入一次模块
            const customEquipmentsModule = await import('@/lib/managers/customEquipments');
            const customEquipments = await customEquipmentsModule.loadCustomEquipments();
            return getEquipmentName(equipmentId, equipmentList, customEquipments) || equipmentId;
        } catch (error) {
            console.error('加载自定义设备失败:', error);
            return equipmentId;
        }
    };

    // 检查当前是否为意式咖啡方案
    const isEspressoMethod = currentBrewingMethod?.name?.toLowerCase().includes('意式') ||
                            currentBrewingMethod?.name?.toLowerCase().includes('espresso') ||
                            expandedStages?.some(stage =>
                              stage.pourType === 'extraction' ||
                              stage.pourType === 'beverage');

    // 搜索相关状态和处理
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);

    const buttonBaseClass = "rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100";
    const springTransition = { type: "spring", stiffness: 500, damping: 25 };

    const handleSearchClick = async () => {
        await triggerHapticFeedback();
        setIsSearching(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
    };

    const handleCloseSearch = async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        await triggerHapticFeedback();
        setIsSearching(false);
        setSearchQuery('');
    };

    // 获取编辑器具方法
    const getEditEquipmentHandler = (step: Step) => {
        if (!step.isCustom) return undefined;

        return () => {
            const equipment = customEquipments.find(e => e.name === step.title);
            if (equipment) {
                setEditingEquipment(equipment);
                setShowEquipmentForm(true);
            }
        };
    };

    // 获取删除器具方法
    const getDeleteEquipmentHandler = (step: Step) => {
        if (!step.isCustom) return undefined;

        return () => {
            const equipment = customEquipments.find(e => e.name === step.title);
            if (equipment) {
                handleDeleteEquipment(equipment);
            }
        };
    };

    // 通用方案折叠状态
    const [isCommonMethodsCollapsed, setIsCommonMethodsCollapsed] = useState(false);

    // 简化的随机选择咖啡豆
    const handleRandomBean = async () => {
        if (isRandomButtonDisabled) return;

        await triggerHapticFeedback();
        try {
            if (allBeans.length === 0) {
                const { CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager');
                const beans = await CoffeeBeanManager.getAllBeans();
                setAllBeans(beans);
            }

            const availableBeans = allBeans.filter(bean => {
                if (bean.isInTransit) return false;
                if (!bean.capacity || bean.capacity === '0' || bean.capacity === '0g') return true;
                return parseFloat(bean.remaining || '0') > 0;
            });

            if (availableBeans.length > 0) {
                setShowRandomPicker(true);
                setIsRandomButtonDisabled(true);
                setTimeout(() => setIsRandomButtonDisabled(false), 3000);
            } else {
                showToast({ type: 'info', title: '没有可用的咖啡豆', duration: 2000 });
            }
        } catch (error) {
            console.error('随机选择失败:', error);
            showToast({ type: 'error', title: '随机选择失败', duration: 2000 });
        }
    };

    // 获取基础器具ID的辅助函数
    const getBaseEquipmentId = (equipmentId: string): string => {
        if (equipmentId.includes('-v60-')) return 'V60';
        if (equipmentId.includes('-clever-')) return 'CleverDripper';
        if (equipmentId.includes('-kalita-')) return 'Kalita';
        if (equipmentId.includes('-origami-')) return 'Origami';
        return 'V60'; // 默认
    };

    // 编辑通用方案 - 创建临时副本进入编辑模式，不立即保存
    const editCommonMethod = (step: Step, selectedEquipment: string) => {
        let commonMethodsList = commonMethods[selectedEquipment];

        if (!commonMethodsList && selectedEquipment.startsWith('custom-')) {
            const baseEquipmentId = getBaseEquipmentId(selectedEquipment);
            commonMethodsList = commonMethods[baseEquipmentId];
        }

        if (!commonMethodsList) return;

        const methodIndex = step.methodIndex ?? commonMethodsList.findIndex(m =>
            m.id === step.methodId || m.name === step.title);

        if (methodIndex >= 0 && methodIndex < commonMethodsList.length) {
            // 创建通用方案的临时副本，但不保存到自定义列表
            const methodCopy = createEditableMethodFromCommon(commonMethodsList[methodIndex]);
            // 添加标记表示这是从通用方案创建的新方案
            const methodWithFlag = {
                ...methodCopy,
                _isFromCommonMethod: true, // 临时标记，用于区分编辑模式
                _originalCommonMethod: commonMethodsList[methodIndex] // 保存原始通用方案引用
            };
            // 直接进入编辑模式，不显示成功提示
            onEditMethod(methodWithFlag);
        }
    };

    // 简化的分享处理函数 - 直接复制到剪贴板
    const handleShareMethod = async (method: Method) => {
        try {
            const { copyMethodToClipboard } = await import('@/lib/managers/customMethods');
            await copyMethodToClipboard(method, getSelectedCustomEquipment());
            showToast({
                type: 'success',
                title: '已复制到剪贴板',
                duration: 2000
            });
        } catch (_error) {
            showToast({
                type: 'error',
                title: '复制失败，请重试',
                duration: 2000
            });
        }
    };

    const handleShareEquipment = async (equipment: CustomEquipment) => {
        try {
            const methods = customMethods[equipment.id || equipment.name] || [];
            const { copyEquipmentToClipboard } = await import('@/lib/managers/customMethods');
            await copyEquipmentToClipboard(equipment, methods);
            showToast({
                type: 'success',
                title: '已复制到剪贴板',
                duration: 2000
            });
        } catch (_error) {
            showToast({
                type: 'error',
                title: '复制失败，请重试',
                duration: 2000
            });
        }
    };

    // 获取分享方案的处理函数
    const getShareMethodHandler = (step: Step) => {
        if (activeTab !== '方案') return undefined;

        return () => {
            if (step.isCustom && customMethods[selectedEquipment!]) {
                const methodIndex = customMethods[selectedEquipment!].findIndex(m =>
                    m.id === step.methodId || m.name === step.title);
                if (methodIndex !== -1) {
                    handleShareMethod(customMethods[selectedEquipment!][methodIndex]);
                }
            } else if (!step.isCustom && selectedEquipment) {
                let commonMethodsList = commonMethods[selectedEquipment];
                if (!commonMethodsList && selectedEquipment.startsWith('custom-')) {
                    const baseEquipmentId = getBaseEquipmentId(selectedEquipment);
                    commonMethodsList = commonMethods[baseEquipmentId];
                }
                if (commonMethodsList) {
                    const methodIndex = step.methodIndex ?? commonMethodsList.findIndex(m =>
                        m.id === step.methodId || m.name === step.title);
                    if (methodIndex >= 0 && methodIndex < commonMethodsList.length) {
                        handleShareMethod(commonMethodsList[methodIndex]);
                    }
                }
            }
        };
    };

    // 获取分享器具的处理函数
    const getShareEquipmentHandler = (step: Step) => {
        if (!step.isCustom) return undefined;

        return () => {
            const equipment = customEquipments.find(e => e.name === step.title);
            if (equipment) {
                handleShareEquipment(equipment);
            }
        };
    };

    // 如果不是在冲煮主Tab，不显示内容
    if (activeMainTab !== '冲煮') return null;

    // 渲染咖啡豆列表
    if (activeTab === '咖啡豆') {
        return (
            <>
                <CoffeeBeanList
                    onSelect={(beanId, bean) => {
                        if (onCoffeeBeanSelect) onCoffeeBeanSelect(beanId, bean);
                    }}
                    searchQuery={searchQuery}
                    highlightedBeanId={highlightedBeanId}
                />

                {/* 随机选豆按钮 - 单独放置在搜索工具栏上方 */}
                <div className="fixed bottom-[60px] left-0 right-0 mb-[var(--safe-area-bottom)] p-6 flex justify-end items-center z-10 max-w-[500px] mx-auto pointer-events-none">
                    <motion.button
                        type="button"
                        onClick={handleRandomBean}
                        transition={springTransition}
                        className={`${buttonBaseClass} p-4 flex items-center justify-center pointer-events-auto ${
                            isRandomButtonDisabled ? 'opacity-40 cursor-not-allowed bg-neutral-200 dark:bg-neutral-700' : ''
                        }`}
                        whileHover={isRandomButtonDisabled ? {} : { scale: 1.05 }}
                        whileTap={isRandomButtonDisabled ? {} : { scale: 0.95 }}
                        disabled={isRandomButtonDisabled}
                    >
                        <Shuffle className="w-4 h-4" strokeWidth="3" />
                    </motion.button>
                </div>

                {/* 底部搜索工具栏 */}
                <div className="fixed bottom-0 left-0 right-0 mb-[var(--safe-area-bottom)] p-6 flex justify-end items-center z-10 max-w-[500px] mx-auto pointer-events-none">
                    <div className="flex items-center justify-center gap-2 pointer-events-none">
                        <AnimatePresence mode="popLayout">
                            {isSearching && (
                                <motion.div
                                    key="search-input-container"
                                    initial={{ scale: 0.95, opacity: 0}}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.95, opacity: 0}}
                                    transition={springTransition}
                                    className="flex items-center overflow-hidden pointer-events-auto"
                                >
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="搜索咖啡豆名称..."
                                        className="w-48 text-sm font-medium bg-neutral-100 dark:bg-neutral-800 rounded-full py-[14px] px-5 border-none outline-hidden text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500"
                                        autoComplete="off"
                                        onKeyDown={(e) => e.key === 'Escape' && handleCloseSearch()}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <motion.button
                            type="button"
                            onClick={isSearching ? handleCloseSearch : handleSearchClick}
                            transition={springTransition}
                            className={`${buttonBaseClass} p-4 flex items-center justify-center pointer-events-auto`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {isSearching ? (
                                <X className="w-4 h-4" strokeWidth="3" />
                            ) : (
                                <Search className="w-4 h-4" strokeWidth="3" />
                            )}
                        </motion.button>
                    </div>
                </div>

                {/* 随机选择器 */}
                <CoffeeBeanRandomPicker
                    beans={allBeans}
                    isOpen={showRandomPicker}
                    onClose={() => setShowRandomPicker(false)}
                    onSelect={(bean) => {
                        if (onCoffeeBeanSelect) {
                            onCoffeeBeanSelect(bean.id, bean);
                            setHighlightedBeanId(bean.id);
                            // 4秒后清除高亮
                            setTimeout(() => setHighlightedBeanId(null), 4000);
                        }
                        setShowRandomPicker(false);
                    }}
                />
            </>
        );
    }

    // 渲染笔记表单
    if (activeTab === '记录') {
        return <NoteFormWrapper />;
    }

    // 显示计时器动画 - 添加条件仅在"注水"标签时显示
    if (activeTab === '注水' && !isEspressoMethod && isTimerRunning && !showComplete && currentBrewingMethod) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-full max-w-[300px]">
                    <PourVisualizer
                        isRunning={isTimerRunning && countdownTime === null}
                        currentStage={countdownTime !== null ? -1 : currentStage}
                        stages={expandedStages || []}
                        countdownTime={countdownTime}
                        equipmentId={selectedEquipment || 'V60'}
                        isWaiting={countdownTime !== null ? true : isWaiting}
                        customEquipment={getSelectedCustomEquipment()}
                        key={countdownTime !== null ? 'countdown' : `pour-${currentStage}-${isTimerRunning}`}
                    />
                </div>
            </div>
        );
    }

    // 处理方案为空的情况
    const showEmptyMethodsMessage = activeTab === '方案' &&
                                    selectedEquipment &&
                                    (!customMethods[selectedEquipment] || customMethods[selectedEquipment].length === 0) &&
                                    (!commonMethods[selectedEquipment] || commonMethods[selectedEquipment].length === 0) &&
                                    (content[activeTab]?.steps.length === 0);

    // 渲染默认列表内容
    return (
        <>
            <div className="space-y-4 content-area">
                {showEmptyMethodsMessage ? (
                    <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400 mt-4">
                        [ 当前器具暂无自定义方案，请点击下方按钮添加 ]
                    </div>
                ) : (
                    <>
                        {content[activeTab]?.steps.map((step: Step, index: number) => {
                            // 如果是通用方案分隔符之后的项目，且折叠状态为true，则不显示
                            const isDividerFound = content[activeTab]?.steps.findIndex((s: Step) => s.isDivider) !== -1;
                            const dividerIndex = content[activeTab]?.steps.findIndex((s: Step) => s.isDivider);

                            // 如果通用方案被折叠，且当前项在分隔符之后，则跳过渲染
                            if (isDividerFound && dividerIndex !== -1 && index > dividerIndex && isCommonMethodsCollapsed) {
                                return null;
                            }

                        // 如果是注水标签，检查originalIndex变化来添加阶段分隔线
                        const showStageDivider = activeTab === '注水' &&
                                index > 0 &&
                                step.originalIndex !== undefined &&
                                content[activeTab]?.steps[index-1]?.originalIndex !== undefined &&
                                step.originalIndex !== content[activeTab]?.steps[index-1]?.originalIndex &&
                                (settings?.layoutSettings?.showStageDivider !== false);

                        // 简化的编辑处理函数
                        let editHandler;
                        if (activeTab === '方案') {
                            if (step.isCustom && customMethods[selectedEquipment!]) {
                                const methodIndex = customMethods[selectedEquipment!].findIndex(m =>
                                    m.id === step.methodId || m.name === step.title);
                                if (methodIndex !== -1) {
                                    editHandler = () => onEditMethod(customMethods[selectedEquipment!][methodIndex]);
                                }
                            } else if (!step.isCustom && selectedEquipment) {
                                editHandler = () => editCommonMethod(step, selectedEquipment);
                            }
                        } else if (step.isCustom) {
                            editHandler = getEditEquipmentHandler(step);
                        }

                        // 计算删除方案的处理函数
                        let deleteHandler;
                        if (activeTab === '方案' && step.isCustom && customMethods[selectedEquipment!]) {
                            const methodIndex = customMethods[selectedEquipment!].findIndex(m =>
                                m.id === step.methodId || m.name === step.title);
                            if (methodIndex !== -1) {
                                deleteHandler = () => onDeleteMethod(customMethods[selectedEquipment!][methodIndex]);
                            }
                        } else if (step.isCustom) {
                            deleteHandler = getDeleteEquipmentHandler(step);
                        }

                        // 计算分享处理函数
                        const shareHandler = activeTab === '方案'
                            ? getShareMethodHandler(step)
                            : getShareEquipmentHandler(step);



                            return (
                                <React.Fragment key={step.methodId ? `${step.methodId}-${index}` : `${step.title}-${index}`}>
                                    {showStageDivider && (
                                        <StageDivider stageNumber={step.originalIndex! + 1} key={`divider-${index}`} />
                                    )}
                                    <StageItem
                                        step={step.isDivider ? {...step, onToggleCollapse: setIsCommonMethodsCollapsed} : step}
                                        index={index}
                                        onClick={() => {
                                            if (activeTab === '方案' && !step.isDivider) {
                                                if (step.isCustom && selectedEquipment && customMethods[selectedEquipment]) {
                                                    const methodIndex = customMethods[selectedEquipment].findIndex(m =>
                                                        m.id === step.methodId || m.name === step.title);
                                                    if (methodIndex !== -1) {
                                                        onMethodSelect(methodIndex, { ...step, explicitMethodType: 'custom' });
                                                        return;
                                                    }
                                                } else if (step.isCommonMethod && step.methodIndex !== undefined) {
                                                    onMethodSelect(step.methodIndex, { ...step, explicitMethodType: 'common' });
                                                    return;
                                                }
                                                onMethodSelect(index, step);
                                            }
                                        }}
                                        activeTab={activeTab}
                                        selectedMethod={selectedMethod}
                                        currentStage={currentStage}
                                        onEdit={editHandler}
                                        onDelete={deleteHandler}
                                        onShare={shareHandler}
                                        actionMenuStates={actionMenuStates}
                                        setActionMenuStates={setActionMenuStates}
                                        showFlowRate={localShowFlowRate}
                                        allSteps={content[activeTab]?.steps || []}
                                    />
                                </React.Fragment>
                            );
                        })}
                    </>
                )}
            </div>

            {/* 方案标签底部操作栏 */}
            {activeTab === '方案' && (
                <BottomActionBar
                    buttons={[
                        {
                            icon: '+',
                            text: '新建方案',
                            onClick: () => setShowCustomForm(true)
                        },
                        {
                            icon: '↓',
                            text: '导入方案',
                            onClick: () => setShowImportForm(true)
                        }
                    ]}
                />
            )}

            {/* 分享功能已简化为直接复制到剪贴板，不再需要模态框 */}
        </>
    );
};

export default TabContent;