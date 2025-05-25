import React, { useCallback, useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Method, equipmentList, CustomEquipment, commonMethods, createEditableMethodFromCommon } from '@/lib/core/config';
import StageItem from '@/components/brewing/stages/StageItem';
import StageDivider from '@/components/brewing/stages/StageDivider';
import { SettingsOptions } from '../settings/Settings';
import { TabType, MainTabType, Content, Step as BaseStep } from '@/lib/hooks/useBrewingState';
import { CoffeeBean } from '@/types/app';
import type { BrewingNoteData } from '@/types/app';
import { CoffeeBeanManager } from '@/lib/managers/coffeeBeanManager';
import { showToast } from "@/components/common/feedback/GlobalToast";
import EquipmentShareModal from '@/components/equipment/share/EquipmentShareModal';
import { getEquipmentName } from '@/lib/brewing/parameters';
import BottomActionBar from '@/components/layout/BottomActionBar';
import CoffeeBeanList from '@/components/coffee-bean/List/ListView';
import MethodShareModal from '@/components/method/share/MethodShareModal';

import { saveCustomMethod } from '@/lib/managers/customMethods';
import { Search, X, Shuffle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';


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
    _isPourVisualizerPreloaded: boolean;
    selectedEquipment: string | null;
    selectedCoffeeBean?: string | null;
    selectedCoffeeBeanData?: CoffeeBean | null;
    countdownTime: number | null;
    _methodType: 'common' | 'custom';
    customMethods: Record<string, Method[]>;
    actionMenuStates: Record<string, boolean>;
    setActionMenuStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    _showCustomForm: boolean;
    setShowCustomForm: (show: boolean) => void;
    _showImportForm: boolean;
    setShowImportForm: (show: boolean) => void;
    settings: SettingsOptions;
    onEquipmentSelect: (name: string) => void;
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
    setCustomEquipments: React.Dispatch<React.SetStateAction<CustomEquipment[]>>;
    setShowEquipmentForm: (show: boolean) => void;
    setEditingEquipment: (equipment: CustomEquipment | undefined) => void;
    handleSaveEquipment: (equipment: CustomEquipment) => Promise<void>;
    handleDeleteEquipment: (equipment: CustomEquipment) => Promise<void>;
    _onShareMethod?: (method: Method) => void;
    setShowEquipmentImportForm: (show: boolean) => void;
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
    _isPourVisualizerPreloaded,
    selectedEquipment,
    selectedCoffeeBean,
    selectedCoffeeBeanData,
    countdownTime,
    _methodType,
    customMethods,
    actionMenuStates,
    setActionMenuStates,
    _showCustomForm,
    setShowCustomForm,
    _showImportForm,
    setShowImportForm,
    settings,
    onEquipmentSelect: _onEquipmentSelect,
    onMethodSelect,
    onCoffeeBeanSelect,
    onEditMethod,
    onDeleteMethod,
    setActiveMainTab,
    resetBrewingState,
    setIsNoteSaved,
    expandedStages,
    customEquipments,
    setCustomEquipments: _setCustomEquipments,
    setShowEquipmentForm,
    setEditingEquipment,
    handleSaveEquipment: _handleSaveEquipment,
    handleDeleteEquipment,
    _onShareMethod,
    setShowEquipmentImportForm: _setShowEquipmentImportForm,
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

    // 加载所有咖啡豆数据
    useEffect(() => {
        const loadBeans = async () => {
            try {
                const beans = await CoffeeBeanManager.getAllBeans();
                setAllBeans(beans);
            } catch (error) {
                console.error('加载咖啡豆失败:', error);
            }
        };

        if (activeTab === '咖啡豆') {
            loadBeans();
        }
    }, [activeTab]);

    // 处理方案类型切换
    const _handleMethodTypeChange = async (type: 'common' | 'custom') => {
        await triggerHapticFeedback();
        window.dispatchEvent(new CustomEvent('methodTypeChange', { detail: type }));
        localStorage.setItem('methodType', type);
    };

    // 处理保存笔记
    const handleSaveNote = async (note: BrewingNoteData) => {
        try {
            const Storage = (await import('@/lib/core/storage')).Storage;
            const existingNotesStr = await Storage.get('brewingNotes');
            const existingNotes = existingNotesStr ? JSON.parse(existingNotesStr) : [];

            const newNote = {
                ...note,
                id: Date.now().toString(),
                timestamp: Date.now(),
            };

            await Storage.set('brewingNotes', JSON.stringify([newNote, ...existingNotes]));
            setNoteSaved(true);

            // 设置全局笔记保存状态
            if (setIsNoteSaved) {
                setIsNoteSaved(true);
            }

            // 减少咖啡豆剩余量
            if (selectedCoffeeBean && currentBrewingMethod?.params.coffee) {
                try {
                    const coffeeAmount = parseFloat(currentBrewingMethod.params.coffee);
                    if (!isNaN(coffeeAmount) && coffeeAmount > 0) {
                        await CoffeeBeanManager.updateBeanRemaining(selectedCoffeeBean, coffeeAmount);
                    }
                } catch {}
            }

            // 清除跳过方案选择的标记（如果存在）
            localStorage.removeItem('skipMethodToNotes');

            // 清除笔记进行中的标记
            localStorage.removeItem('brewingNoteInProgress');

            if (setActiveMainTab) {
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
            // 清除跳过方案选择的标记（如果存在）
            localStorage.removeItem('skipMethodToNotes');

            // 清除笔记进行中的标记
            localStorage.removeItem('brewingNoteInProgress');

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

    // 分享相关状态
    const [showMethodShareModal, setShowMethodShareModal] = useState(false);
    const [sharingMethod, setSharingMethod] = useState<Method | null>(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [sharingEquipment, setSharingEquipment] = useState<CustomEquipment | null>(null);
    const [sharingMethods, setSharingMethods] = useState<Method[]>([]);

    // 处理分享方案
    const handleShareMethod = (method: Method) => {
        try {
            setSharingMethod(method);
            setShowMethodShareModal(true);
        } catch {
            showToast({ type: 'error', title: '准备分享失败，请重试', duration: 2000 });
        }
    };

    // 处理分享器具
    const handleShareEquipment = (equipment: CustomEquipment) => {
        try {
            let methods: Method[] = [];
            if (equipment.id) {
                methods = customMethods[equipment.id] || [];
            }
            if (methods.length === 0 && equipment.name) {
                methods = customMethods[equipment.name] || [];
            }

            setSharingEquipment(equipment);
            setSharingMethods(methods);
            setShowShareModal(true);
        } catch {
            showToast({ type: 'error', title: '准备分享失败，请重试', duration: 2000 });
        }
    };

    // 监听器具分享事件
    useEffect(() => {
        const handleEquipmentShareEvent = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail?.equipment) {
                handleShareEquipment(customEvent.detail.equipment);
            }
        };

        document.addEventListener('equipment:share', handleEquipmentShareEvent);
        return () => {
            document.removeEventListener('equipment:share', handleEquipmentShareEvent);
        };
    }, [customMethods]);

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
                id="brewingNoteForm"
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

    // 获取分享器具方法
    const getShareEquipmentHandler = (step: Step) => {
        if (!step.isCustom) return undefined;

        return () => {
            const equipment = customEquipments.find(e => e.name === step.title);
            if (equipment) {
                handleShareEquipment(equipment);
            }
        };
    };

    // 添加通用方案折叠状态
    const [isCommonMethodsCollapsed, setIsCommonMethodsCollapsed] = useState(false);

    // 随机选择咖啡豆
    const handleRandomBean = async () => {
        // 如果按钮被禁用，直接返回
        if (isRandomButtonDisabled) return;

        await triggerHapticFeedback();
        try {
            // 如果没有豆子数据，先加载
            if (allBeans.length === 0) {
                const beans = await CoffeeBeanManager.getAllBeans();
                setAllBeans(beans);
            }

            // 过滤掉已经用完的豆子
            const availableBeans = allBeans.filter(bean =>
                !(bean.remaining === "0" || bean.remaining === "0g") || !bean.capacity
            );

            if (availableBeans.length > 0) {
                // 打开随机选择器
                setShowRandomPicker(true);

                // 禁用随机按钮3秒，避免重复点击
                setIsRandomButtonDisabled(true);
                setTimeout(() => {
                    setIsRandomButtonDisabled(false);
                }, 3000);
            } else {
                showToast({
                    type: 'info',
                    title: '没有可用的咖啡豆',
                    duration: 2000
                });
            }
        } catch (error) {
            console.error('随机选择咖啡豆失败:', error);
            showToast({
                type: 'error',
                title: '随机选择失败',
                duration: 2000
            });
        }
    };

    // 如果不是在冲煮主Tab，不显示内容
    if (activeMainTab !== '冲煮') return null;

    // 渲染咖啡豆列表
    if (activeTab === '咖啡豆') {
        return (
            <div className="relative">
                <CoffeeBeanList
                    onSelect={(beanId, bean) => {
                        if (onCoffeeBeanSelect) onCoffeeBeanSelect(beanId, bean);
                    }}
                    searchQuery={searchQuery}
                    highlightedBeanId={highlightedBeanId}
                />

                {/* 随机选豆按钮 - 单独放置在搜索工具栏上方 */}
                <div className="fixed bottom-[60px] left-0 right-0 p-6 flex justify-end items-center z-10 max-w-[500px] mx-auto pb-safe-bottom pointer-events-none">
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
                <div className="fixed bottom-0 left-0 right-0 p-6 flex justify-end items-center z-10 max-w-[500px] mx-auto pb-safe-bottom pointer-events-none">
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
                                        className="w-48 text-sm bg-neutral-100 dark:bg-neutral-800 rounded-full py-[14px] px-5 border-none outline-hidden text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500"
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
            </div>
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
                    <>
                        {/* 跳过方案选择选项 - 在没有方案时显示在上面 */}
                        {activeTab === '方案' && selectedEquipment && (
                            <div
                                className="group relative border-l border-neutral-200 dark:border-neutral-800 pl-6 cursor-pointer text-neutral-500 dark:text-neutral-400"
                                onClick={async () => {
                                    await triggerHapticFeedback();
                                    // 触发自定义事件，通知 page.tsx 跳转到记录步骤
                                    document.dispatchEvent(new CustomEvent('brewing:navigateToStep', {
                                        detail: { step: 'notes', fromHistory: true }
                                    }));
                                }}
                            >
                                <div className="cursor-pointer">
                                    <div className="flex items-baseline justify-between">
                                        <div className="flex items-baseline gap-3 min-w-0 overflow-hidden">
                                            <h3 className="text-xs font-normal tracking-wider truncate">
                                                跳过方案选择
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="mt-2">
                                        <p className="text-xs font-light">直接跳到记录</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400 mt-4">
                            [ 当前器具暂无自定义方案，请点击下方按钮添加 ]
                        </div>
                    </>
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

                        // 计算编辑方案的处理函数
                        let editHandler;
                        if (activeTab === '方案') {
                            // 判断是否为自定义方案
                            const isCustomMethod = step.isCustom;

                            if (isCustomMethod && customMethods[selectedEquipment!]) {
                                // 自定义方案可以直接编辑
                                const methodIndex = customMethods[selectedEquipment!].findIndex(m =>
                                    m.id === step.methodId || m.name === step.title);
                                if (methodIndex !== -1) {
                                    editHandler = () => {
                                        onEditMethod(customMethods[selectedEquipment!][methodIndex]);
                                    };
                                }
                            } else if (!isCustomMethod && selectedEquipment) {
                                // 通用方案需要先复制到自定义列表
                                editHandler = () => {
                                    // 获取正确的通用方案列表
                                    let commonMethodsList = commonMethods[selectedEquipment];

                                    // 如果是自定义器具，需要根据其基础类型获取通用方案
                                    if (!commonMethodsList && selectedEquipment.startsWith('custom-')) {
                                        let baseEquipmentId = '';

                                        if (selectedEquipment.includes('-v60-')) {
                                            baseEquipmentId = 'V60';
                                        } else if (selectedEquipment.includes('-clever-')) {
                                            baseEquipmentId = 'CleverDripper';
                                        } else if (selectedEquipment.includes('-kalita-')) {
                                            baseEquipmentId = 'Kalita';
                                        } else if (selectedEquipment.includes('-origami-')) {
                                            baseEquipmentId = 'Origami';
                                        } else {
                                            // 默认使用V60方案
                                            baseEquipmentId = 'V60';
                                        }

                                        commonMethodsList = commonMethods[baseEquipmentId];
                                    }

                                    // 直接使用step.methodIndex获取正确的方案索引
                                    if (commonMethodsList && step.methodIndex !== undefined && step.methodIndex >= 0 &&
                                        step.methodIndex < commonMethodsList.length) {
                                        const methodCopy = createEditableMethodFromCommon(commonMethodsList[step.methodIndex]);
                                        saveCustomMethod(selectedEquipment, methodCopy)
                                            .then(() => {
                                                setTimeout(() => onEditMethod(methodCopy), 100);
                                                showToast({
                                                    type: 'success',
                                                    title: '已复制通用方案到自定义列表',
                                                    duration: 2000
                                                });
                                            })
                                            .catch(() => {
                                                showToast({
                                                    type: 'error',
                                                    title: '复制方案失败，请重试',
                                                    duration: 2000
                                                });
                                            });
                                    } else {
                                        // 回退到原来的查找方式，作为备用措施
                                        const commonMethodIndex = commonMethodsList?.findIndex(m =>
                                            m.id === step.methodId || m.name === step.title);

                                        if (commonMethodsList && commonMethodIndex !== undefined && commonMethodIndex !== -1) {
                                            const methodCopy = createEditableMethodFromCommon(commonMethodsList[commonMethodIndex]);
                                            saveCustomMethod(selectedEquipment, methodCopy)
                                                .then(() => {
                                                    setTimeout(() => onEditMethod(methodCopy), 100);
                                                    showToast({
                                                        type: 'success',
                                                        title: '已复制通用方案到自定义列表',
                                                        duration: 2000
                                                    });
                                                })
                                                .catch(() => {
                                                    showToast({
                                                        type: 'error',
                                                        title: '复制方案失败，请重试',
                                                        duration: 2000
                                                    });
                                                });
                                        }
                                    }
                                };
                            }
                        } else if (step.isCustom) {
                            editHandler = getEditEquipmentHandler(step);
                        }

                        // 计算删除方案的处理函数
                        let deleteHandler;
                        if (activeTab === '方案' && step.isCustom && customMethods[selectedEquipment!]) {
                            // 找到匹配的自定义方案
                            const methodIndex = customMethods[selectedEquipment!].findIndex(m =>
                                m.id === step.methodId || m.name === step.title);
                            if (methodIndex !== -1) {
                                deleteHandler = () => onDeleteMethod(customMethods[selectedEquipment!][methodIndex]);
                            }
                        } else if (step.isCustom) {
                            deleteHandler = getDeleteEquipmentHandler(step);
                        }

                        // 计算分享方案的处理函数
                        let shareHandler;
                        if (activeTab === '方案') {
                            shareHandler = () => {
                                // 判断是自定义方案还是通用方案
                                if (step.isCustom && customMethods[selectedEquipment!]) {
                                    // 查找匹配的自定义方案
                                    const methodIndex = customMethods[selectedEquipment!].findIndex(m =>
                                        m.id === step.methodId || m.name === step.title);
                                    if (methodIndex !== -1) {
                                        handleShareMethod(customMethods[selectedEquipment!][methodIndex]);
                                    }
                                } else if (!step.isCustom && selectedEquipment) {
                                    // 获取正确的通用方案列表
                                    let commonMethodsList = commonMethods[selectedEquipment];

                                    // 如果是自定义器具，需要根据其基础类型获取通用方案
                                    if (!commonMethodsList && selectedEquipment.startsWith('custom-')) {
                                        let baseEquipmentId = '';

                                        if (selectedEquipment.includes('-v60-')) {
                                            baseEquipmentId = 'V60';
                                        } else if (selectedEquipment.includes('-clever-')) {
                                            baseEquipmentId = 'CleverDripper';
                                        } else if (selectedEquipment.includes('-kalita-')) {
                                            baseEquipmentId = 'Kalita';
                                        } else if (selectedEquipment.includes('-origami-')) {
                                            baseEquipmentId = 'Origami';
                                        } else {
                                            // 默认使用V60方案
                                            baseEquipmentId = 'V60';
                                        }

                                        commonMethodsList = commonMethods[baseEquipmentId];
                                    }

                                    // 直接使用step.methodIndex获取正确的方案索引
                                    if (commonMethodsList && step.methodIndex !== undefined && step.methodIndex >= 0 &&
                                        step.methodIndex < commonMethodsList.length) {
                                        handleShareMethod(commonMethodsList[step.methodIndex]);
                                    } else {
                                        // 回退到原来的查找方式
                                        const commonMethodIndex = commonMethodsList?.findIndex(m =>
                                            m.id === step.methodId || m.name === step.title);
                                        if (commonMethodsList && commonMethodIndex !== undefined && commonMethodIndex !== -1) {
                                            handleShareMethod(commonMethodsList[commonMethodIndex]);
                                        }
                                    }
                                }
                            };
                        } else if (step.isCustom) {
                            shareHandler = getShareEquipmentHandler(step);
                        }

                            return (
                                <React.Fragment key={step.methodId ? `${step.methodId}-${index}` : `${step.title}-${index}`}>
                                    {showStageDivider && (
                                        <StageDivider stageNumber={step.originalIndex! + 1} key={`divider-${index}`} />
                                    )}
                                    <StageItem
                                        step={step.isDivider ? {...step, onToggleCollapse: setIsCommonMethodsCollapsed} : step}
                                        index={index}
                                        onClick={() => {
                                            if (activeTab === '方案') {
                                                // 如果是分隔符，不处理点击事件
                                                if (step.isDivider) {
                                                    return;
                                                }

                                                // 根据方案类型确定正确的索引
                                                if (step.isCustom) {
                                                    // 自定义方案：在customMethods中查找匹配的方案
                                                    const methodId = step.methodId;
                                                    if (methodId && selectedEquipment && customMethods[selectedEquipment]) {
                                                        const methodIndex = customMethods[selectedEquipment].findIndex(m =>
                                                            m.id === methodId || m.name === step.title);
                                                        if (methodIndex !== -1) {
                                                            // 使用找到的自定义方案索引，并明确传递"custom"类型
                                                            onMethodSelect(methodIndex, {
                                                                ...step,
                                                                explicitMethodType: 'custom'
                                                            });
                                                            return;
                                                        }
                                                    }
                                                } else if (step.isCommonMethod && step.methodIndex !== undefined) {
                                                    // 通用方案：使用预先存储的methodIndex，并明确传递"common"类型
                                                    onMethodSelect(step.methodIndex, {
                                                        ...step,
                                                        explicitMethodType: 'common'
                                                    });
                                                    return;
                                                }

                                                // 如果不能确定特定类型，使用传统的索引方式
                                                // 默认根据当前类型传递
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

                        {/* 跳过方案选择选项 - 放在方案列表最下面（仅在有方案时显示） */}
                        {activeTab === '方案' && selectedEquipment && !showEmptyMethodsMessage && (
                            <div
                                className="group relative border-l border-neutral-200 dark:border-neutral-800 pl-6 cursor-pointer text-neutral-500 dark:text-neutral-400 mt-4"
                                onClick={async () => {
                                    await triggerHapticFeedback();
                                    // 触发自定义事件，通知 page.tsx 跳转到记录步骤
                                    document.dispatchEvent(new CustomEvent('brewing:navigateToStep', {
                                        detail: { step: 'notes', fromHistory: true }
                                    }));
                                }}
                            >
                                <div className="cursor-pointer">
                                    <div className="flex items-baseline justify-between">
                                        <div className="flex items-baseline gap-3 min-w-0 overflow-hidden">
                                            <h3 className="text-xs font-normal tracking-wider truncate">
                                                跳过方案选择
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="mt-2">
                                        <p className="text-xs font-light">直接跳到记录</p>
                                    </div>
                                </div>
                            </div>
                        )}
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
                            onClick: () => setShowCustomForm(true),
                            highlight: true,
                            id: 'new'
                        },
                        {
                            icon: '↓',
                            text: '导入方案',
                            onClick: () => setShowImportForm(true),
                            highlight: true,
                            id: 'import'
                        }
                    ]}
                    customPresetMode={customEquipments.find(e => e.id === selectedEquipment)?.animationType === 'custom'}
                />
            )}



            {/* 分享模态框 */}
            {sharingEquipment && (
                <EquipmentShareModal
                    isOpen={showShareModal}
                    onClose={() => setShowShareModal(false)}
                    equipment={sharingEquipment}
                    methods={sharingMethods}
                />
            )}
            {sharingMethod && (
                <MethodShareModal
                    isOpen={showMethodShareModal}
                    onClose={() => setShowMethodShareModal(false)}
                    method={sharingMethod}
                    customEquipment={getSelectedCustomEquipment()}
                />
            )}
        </>
    );
};

export default TabContent;