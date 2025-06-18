'use client'

// 导入React和必要的hooks
import React, { useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { equipmentList, APP_VERSION, commonMethods, CustomEquipment, type Method } from '@/lib/core/config'
import { initCapacitor } from '@/lib/app/capacitor'
// 只导入需要的类型
import type { CoffeeBean } from '@/types/app'
import { useBrewingState, MainTabType, BrewingStep, Step } from '@/lib/hooks/useBrewingState'
import { useBrewingParameters } from '@/lib/hooks/useBrewingParameters'
import { useBrewingContent } from '@/lib/hooks/useBrewingContent'
import { useMethodSelector } from '@/lib/hooks/useMethodSelector'
import { EditableParams } from '@/lib/hooks/useBrewingParameters'
import CustomMethodFormModal from '@/components/method/forms/CustomMethodFormModal'
import NavigationBar from '@/components/layout/NavigationBar'
import Settings, { SettingsOptions, defaultSettings } from '@/components/settings/Settings'
import TabContent from '@/components/layout/TabContent'
import MethodTypeSelector from '@/components/method/forms/MethodTypeSelector'
import Onboarding from '@/components/onboarding/Onboarding'
import CoffeeBeanFormModal from '@/components/coffee-bean/Form/Modal'
import ImportModal from '@/components/common/modals/BeanImportModal'
import fontZoomUtils from '@/lib/utils/fontZoomUtils'
import { saveMainTabPreference } from '@/lib/navigation/navigationCache'
import { ViewOption, VIEW_OPTIONS, VIEW_LABELS } from '@/components/coffee-bean/List/types'
import { getStringState, saveStringState } from '@/lib/core/statePersistence'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronsUpDown } from 'lucide-react'
import hapticsUtils from '@/lib/ui/haptics'
import { BREWING_EVENTS } from '@/lib/brewing/constants'
import type { BrewingNoteData } from '@/types/app'
import { updateParameterInfo } from '@/lib/brewing/parameters'
import BrewingNoteFormModal from '@/components/notes/Form/BrewingNoteFormModal'
import CoffeeBeans from '@/components/coffee-bean/List'
import SwipeBackGesture from '@/components/app/SwipeBackGesture'
import { loadCustomEquipments, saveCustomEquipment, deleteCustomEquipment } from '@/lib/managers/customEquipments'
import CustomEquipmentFormModal from '@/components/equipment/forms/CustomEquipmentFormModal'
import EquipmentImportModal from '@/components/equipment/import/EquipmentImportModal'
import DataMigrationModal from '@/components/common/modals/DataMigrationModal'
import { showToast } from '@/components/common/feedback/GlobalToast'

// 为Window对象声明类型扩展
declare global {
    interface Window {
        refreshBrewingNotes?: () => void;
    }
}

// 扩展Step类型，添加explicitMethodType属性
interface ExtendedStep extends Step {
    explicitMethodType?: 'common' | 'custom';
}

interface BlendComponent {
    percentage?: number;
    origin?: string;
    process?: string;
    variety?: string;
}

interface ExtendedCoffeeBean extends CoffeeBean {
    blendComponents?: BlendComponent[];
}

// 动态导入客户端组件
const BrewingTimer = dynamic(() => import('@/components/brewing/BrewingTimer'), { ssr: false, loading: () => null })
const BrewingHistory = dynamic(() => import('@/components/notes/List'), { ssr: false, loading: () => null })

const AppLoader = ({ onInitialized }: { onInitialized: (params: { hasBeans: boolean }) => void }) => {
    useEffect(() => {
        const loadInitialData = async () => {
            // 确保只在客户端执行
            if (typeof window === 'undefined') {
                onInitialized({ hasBeans: false });
                return;
            }

            try {
                // 动态导入所有需要的模块
                const [
                    { Storage },
                    { CoffeeBeanManager }
                ] = await Promise.all([
                    import('@/lib/core/storage'),
                    import('@/lib/managers/coffeeBeanManager')
                ]);

                // 检查咖啡豆状态
                const beans = await CoffeeBeanManager.getAllBeans();
                const hasBeans = beans.length > 0;

                // 初始化版本和storage
                try {
                    const storageVersion = await Storage.get('brewingNotesVersion');
                    if (!storageVersion) {
                        await Storage.set('brewingNotesVersion', APP_VERSION);
                    }

                    // 确保brewingNotes存在且格式正确
                    const notes = await Storage.get('brewingNotes');
                    if (notes && typeof notes === 'string') {
                        try {
                            const parsed = JSON.parse(notes);
                            if (!Array.isArray(parsed)) {
                                await Storage.set('brewingNotes', '[]');
                            }
                        } catch {
                            await Storage.set('brewingNotes', '[]');
                        }
                    } else {
                        await Storage.set('brewingNotes', '[]');
                    }
                } catch {
                    // 静默处理错误
                }

                // 通知初始化完成，传递咖啡豆状态
                onInitialized({ hasBeans });
            } catch {
                // 出错时假定没有咖啡豆
                onInitialized({ hasBeans: false });
            }
        };

        loadInitialData();
    }, [onInitialized]);

    // 加载过程中不显示任何内容
    return null;
};

const AppContainer = () => {
    const [isAppReady, setIsAppReady] = useState(false);
    const [initialHasBeans, setInitialHasBeans] = useState<boolean | null>(null);

    const handleInitialized = useCallback(({ hasBeans }: { hasBeans: boolean }) => {
        setInitialHasBeans(hasBeans);
        setIsAppReady(true);
    }, []);

    // 如果应用未准备好，显示加载器
    if (!isAppReady || initialHasBeans === null) {
        return <AppLoader onInitialized={handleInitialized} />;
    }

    // 应用准备好后，渲染主组件，传入初始咖啡豆状态
    return <PourOverRecipes initialHasBeans={initialHasBeans} />;
};

const PourOverRecipes = ({ initialHasBeans }: { initialHasBeans: boolean }) => {
    // 使用设置相关状态
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settings, setSettings] = useState<SettingsOptions>(() => {
        // 使用默认设置作为初始值，稍后在 useEffect 中异步加载
        return defaultSettings;
    });

    // 咖啡豆表单状态
    const [showBeanForm, setShowBeanForm] = useState(false);
    const [editingBean, setEditingBean] = useState<ExtendedCoffeeBean | null>(null);
    const [beanListKey, setBeanListKey] = useState(0);
    const [showImportBeanForm, setShowImportBeanForm] = useState(false);

    // 自动跳转到笔记的状态
    const [hasAutoNavigatedToNotes, setHasAutoNavigatedToNotes] = useState(false);

    const initialStep: BrewingStep = initialHasBeans ? 'coffeeBean' : 'method';
    const [isStageWaiting, setIsStageWaiting] = useState(false);
    const brewingState = useBrewingState(initialStep);
    const {
        activeMainTab, setActiveMainTab,
        activeBrewingStep, setActiveBrewingStep,
        activeTab, setActiveTab,
        selectedEquipment,
        selectedMethod, setSelectedMethod,
        currentBrewingMethod, setCurrentBrewingMethod,
        isTimerRunning, setIsTimerRunning,
        currentStage, setCurrentStage,
        showHistory, setShowHistory,
        showComplete, setShowComplete,
        methodType, setMethodType,
        countdownTime, setCountdownTime,
        customMethods, setCustomMethods,
        selectedCoffeeBean, selectedCoffeeBeanData, setSelectedCoffeeBean, setSelectedCoffeeBeanData,
        showCustomForm, setShowCustomForm,
        editingMethod, setEditingMethod,
        actionMenuStates, setActionMenuStates,
        showImportForm, setShowImportForm,

        prevMainTabRef,
        resetBrewingState,
        handleEquipmentSelect,
        handleCoffeeBeanSelect,
        handleSaveCustomMethod,
        handleEditCustomMethod,
        handleDeleteCustomMethod,
        navigateToStep
    } = brewingState;

    const parameterHooks = useBrewingParameters();
    const {
        parameterInfo, setParameterInfo,
        editableParams, setEditableParams,
        handleParamChange
    } = parameterHooks;

    const [customEquipments, setCustomEquipments] = useState<CustomEquipment[]>([]);
    const [showEquipmentForm, setShowEquipmentForm] = useState(false);
    const [editingEquipment, setEditingEquipment] = useState<CustomEquipment | undefined>(undefined);
    const [showEquipmentImportForm, setShowEquipmentImportForm] = useState(false);
    const [showDataMigration, setShowDataMigration] = useState(false);
    const [migrationData, setMigrationData] = useState<{
        legacyCount: number;
        totalCount: number;
    } | null>(null);

    // 加载自定义器具
    useEffect(() => {
        const loadEquipments = async () => {
            try {
                const equipments = await loadCustomEquipments();
                setCustomEquipments(equipments);
            } catch (error) {
                // Log error in development only
                if (process.env.NODE_ENV === 'development') {
                    console.error('加载自定义器具失败:', error);
                }
            }
        };

        const handleEquipmentUpdate = () => {
            loadEquipments();
        };

        const handleStorageChange = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail?.key === 'allData' || customEvent.detail?.key === 'customEquipments') {
                loadEquipments();
            }
        };

        loadEquipments();

        window.addEventListener('customEquipmentUpdate', handleEquipmentUpdate);
        window.addEventListener('storage:changed', handleStorageChange);

        return () => {
            window.removeEventListener('customEquipmentUpdate', handleEquipmentUpdate);
            window.removeEventListener('storage:changed', handleStorageChange);
        };
    }, []);

    const contentHooks = useBrewingContent({
        selectedEquipment,
        methodType,
        customMethods,
        selectedMethod,
        settings,
        customEquipments
    });

    const { content, updateBrewingSteps } = contentHooks;

    const methodSelector = useMethodSelector({
        selectedEquipment,
        customMethods,
        setSelectedMethod,
        setCurrentBrewingMethod,
        setEditableParams,
        setParameterInfo,
        setActiveTab,
        setActiveBrewingStep,
        updateBrewingSteps,
    });

    const { handleMethodSelect } = methodSelector;

    useEffect(() => {
        let isMounted = true;

        const initializeApp = async () => {
            try {
                // 初始化应用...



                // 继续原有初始化流程
                // 检查coffee beans而不是直接调用不存在的函数
                let hasCoffeeBeans = initialHasBeans;
                try {
                    const { Storage } = await import('@/lib/core/storage');
                    const beansStr = await Storage.get('coffeeBeans');
                    if (beansStr && typeof beansStr === 'string') {
                        try {
                            const beans = JSON.parse(beansStr);
                            hasCoffeeBeans = Array.isArray(beans) && beans.length > 0;
                        } catch {
                            hasCoffeeBeans = false;
                        }
                    }
                } catch (error) {
                    // Log error in development only
                    if (process.env.NODE_ENV === 'development') {
                        console.error('检查咖啡豆失败:', error);
                    }
                }
                setHasCoffeeBeans(hasCoffeeBeans);

                // 0. 检测数据迁移需求和自动修复
                try {
                    // 导入数据管理工具
                    const { DataManager } = await import('@/lib/core/dataManager');

                    // 检查是否需要数据迁移
                    const migrationSkippedThisSession = sessionStorage.getItem('dataMigrationSkippedThisSession');
                    if (migrationSkippedThisSession !== 'true') {
                        const legacyDetection = await DataManager.detectLegacyBeanData();
                        if (legacyDetection.hasLegacyData && isMounted) {
                            setMigrationData({
                                legacyCount: legacyDetection.legacyCount,
                                totalCount: legacyDetection.totalCount
                            });
                            setShowDataMigration(true);
                        }
                    }

                    // 自动修复拼配豆数据
                    const fixResult = await DataManager.fixBlendBeansData();
                    if (fixResult.fixedCount > 0) {
                        // 自动修复了拼配豆数据
                    }
                } catch (error) {
                    // Log error in development only
                    if (process.env.NODE_ENV === 'development') {
                        console.error('数据检测和修复时出错:', error);
                    }
                    // 继续初始化，不阻止应用启动
                }

                // 1. 加载设置
                try {
                    const { Storage } = await import('@/lib/core/storage');
                    const savedSettings = await Storage.get('brewGuideSettings');
                    if (savedSettings && typeof savedSettings === 'string' && isMounted) {
                        try {
                            const parsedSettings = JSON.parse(savedSettings) as SettingsOptions;
                            setSettings(parsedSettings);

                            // 应用字体缩放级别
                            if (parsedSettings.textZoomLevel) {
                                fontZoomUtils.set(parsedSettings.textZoomLevel);
                            }
                        } catch {
                            // JSON解析失败，使用默认设置
                        }
                    }
                } catch {
                    // 静默处理错误
                }

                // 2. 检查是否首次使用
                try {
                    const { Storage } = await import('@/lib/core/storage');
                    const onboardingCompleted = await Storage.get('onboardingCompleted');
                    if (isMounted) {
                        setShowOnboarding(!onboardingCompleted);
                    }
                } catch {
                    // 静默处理错误
                }

                // 3. 初始化字体缩放
                fontZoomUtils.init();

                // 4. 初始化 Capacitor
                initCapacitor();
            } catch {
                // 静默处理错误
            }
        };

        // 立即执行初始化
        initializeApp();

        // 清理函数
        return () => {
            isMounted = false;
        };
    }, [initialHasBeans]);

    const [hasCoffeeBeans, setHasCoffeeBeans] = useState(initialHasBeans);

    const [currentBeanView, setCurrentBeanView] = useState<ViewOption>(() => {
        try {
            const savedView = getStringState('coffee-beans', 'viewMode', VIEW_OPTIONS.INVENTORY);
            return savedView as ViewOption;
        } catch {
            return VIEW_OPTIONS.INVENTORY;
        }
    });

    // 视图下拉菜单状态
    const [showViewDropdown, setShowViewDropdown] = useState(false);

    // 咖啡豆按钮位置状态
    const [beanButtonPosition, setBeanButtonPosition] = useState<{
        top: number;
        left: number;
        width: number;
    } | null>(null);

    // 获取咖啡豆按钮位置
    const updateBeanButtonPosition = useCallback(() => {
        const beanButton = (window as unknown as { beanButtonRef?: HTMLElement }).beanButtonRef;
        if (beanButton) {
            const rect = beanButton.getBoundingClientRect();
            setBeanButtonPosition({
                top: rect.top + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    }, []);

    // 监听窗口大小变化和滚动，以及下拉菜单状态变化
    useEffect(() => {
        if (showViewDropdown) {
            // 立即更新位置
            updateBeanButtonPosition();

            const handleResize = () => updateBeanButtonPosition();
            const handleScroll = () => updateBeanButtonPosition();

            window.addEventListener('resize', handleResize);
            window.addEventListener('scroll', handleScroll);

            return () => {
                window.removeEventListener('resize', handleResize);
                window.removeEventListener('scroll', handleScroll);
            };
        } else {
            // 下拉菜单关闭时清除位置信息
            setBeanButtonPosition(null);
        }
    }, [showViewDropdown, updateBeanButtonPosition]);

    // 在下拉菜单即将显示时预先获取位置
    const handleToggleViewDropdown = useCallback(() => {
        if (!showViewDropdown) {
            // 在显示下拉菜单之前先获取位置
            updateBeanButtonPosition();
        }
        setShowViewDropdown(!showViewDropdown);
    }, [showViewDropdown, updateBeanButtonPosition]);

    // 处理咖啡豆视图切换
    const handleBeanViewChange = (view: ViewOption) => {
        setCurrentBeanView(view);
        // 保存到本地存储
        saveStringState('coffee-beans', 'viewMode', view);
        // 关闭下拉菜单
        setShowViewDropdown(false);
        // 触感反馈
        if (settings.hapticFeedback) {
            hapticsUtils.light();
        }
    };

    // 点击外部关闭视图下拉菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showViewDropdown) {
                const target = event.target as Element
                // 检查点击是否在视图选择区域外
                if (!target.closest('[data-view-selector]')) {
                    setShowViewDropdown(false)
                }
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showViewDropdown]);



    const handleParamChangeWrapper = async (type: keyof EditableParams, value: string) => {
        await handleParamChange(
            type,
            value,
            selectedMethod,
            currentBrewingMethod,
            updateBrewingSteps,
            setCurrentBrewingMethod,
            selectedCoffeeBean
        );
    };

    const handleExtractionTimeChange = (time: number) => {
        if (!selectedMethod || !selectedMethod.params.stages) return;

        // 只处理意式咖啡，查找萃取步骤
        const isEspresso = selectedMethod.params.stages.some(stage =>
            stage.pourType === 'extraction' ||
            stage.pourType === 'beverage'
        );

        if (!isEspresso) return;

        // 创建新的方法对象
        const updatedMethod = {
            ...selectedMethod,
            params: {
                ...selectedMethod.params,
                stages: selectedMethod.params.stages.map(stage => {
                    // 只更新萃取类型的步骤时间
                    if (stage.pourType === 'extraction') {
                        return { ...stage, time };
                    }
                    return stage;
                })
            }
        };

        // 更新方法
        setSelectedMethod(updatedMethod);

        // 如果在冲煮步骤，同步更新当前冲煮方法
        if (activeBrewingStep === 'brewing') {
            setCurrentBrewingMethod(updatedMethod);
        }
    };

    // 修改标签切换检测逻辑，确保有咖啡豆时始终从咖啡豆步骤开始
    useEffect(() => {
        // 只在activeMainTab为冲煮时执行，避免其他标签页的干扰
        if (activeMainTab === '冲煮') {
            setShowHistory(false);

            // 检查是否是从记录到注水的特殊跳转
            const fromNotesToBrewing = localStorage.getItem("fromNotesToBrewing");

            // 如果是从记录到注水的特殊跳转，不做任何状态重置
            if (fromNotesToBrewing === "true") {
                // 清除标记
                localStorage.removeItem("fromNotesToBrewing");
                return;
            }

            // 检查是否有咖啡豆和是否应该从咖啡豆步骤开始
            const shouldStartFromCoffeeBeanStep = localStorage.getItem('shouldStartFromCoffeeBeanStep');

            // 如果应该从咖啡豆步骤开始且有咖啡豆
            if (shouldStartFromCoffeeBeanStep === 'true' && hasCoffeeBeans) {
                // 重置标记
                localStorage.removeItem('shouldStartFromCoffeeBeanStep');
                // 重置brewing状态
                resetBrewingState(false); // 完全重置状态
                // 设置步骤为咖啡豆，使用统一导航函数
                navigateToStep('coffeeBean');
            }
            // 如果是从其他页面切换过来的
            else if (prevMainTabRef.current !== '冲煮') {
                // 重置状态
                resetBrewingState(false); // 完全重置状态
                // 如果有咖啡豆，从咖啡豆步骤开始，使用统一导航函数
                if (hasCoffeeBeans) {
                    navigateToStep('coffeeBean');
                } else {
                    // 没有咖啡豆，从方案步骤开始，使用统一导航函数
                    navigateToStep('method');
                }
            }
        }

        // 更新前一个标签的引用
        prevMainTabRef.current = activeMainTab;
    }, [activeMainTab, resetBrewingState, prevMainTabRef, setShowHistory, navigateToStep, hasCoffeeBeans]);

    const handleMethodTypeChange = (type: 'common' | 'custom') => {
        const customEquipment = customEquipments.find(
            e => e.id === selectedEquipment || e.name === selectedEquipment
        );

        if (customEquipment && customEquipment.animationType === 'custom' && type === 'common') {
            // 自定义预设器具仅支持自定义方案
            return;
        }

        setMethodType(type);
    };

    const [isCoffeeBrewed, setIsCoffeeBrewed] = useState(showComplete);

    const handleSettingsChange = useCallback(async (newSettings: SettingsOptions) => {
        setSettings(newSettings);
        try {
            const { Storage } = await import('@/lib/core/storage');
            await Storage.set('brewGuideSettings', JSON.stringify(newSettings))

            if (newSettings.textZoomLevel) {
                fontZoomUtils.set(newSettings.textZoomLevel);
            }
        } catch {
            // 静默处理错误
        }
    }, [setSettings]);

    const handleLayoutChange = useCallback((e: CustomEvent) => {
        if (e.detail && e.detail.layoutSettings) {
            // 接收到布局设置变更
            const newSettings = {
                ...settings,
                layoutSettings: e.detail.layoutSettings
            };
            handleSettingsChange(newSettings);
        }
    }, [settings, handleSettingsChange]);

    useEffect(() => {
        const handleBrewingComplete = () => {
            setShowComplete(true);
            setIsCoffeeBrewed(true);
        };

        const handleBrewingReset = () => {
            setHasAutoNavigatedToNotes(false);
            setShowComplete(false);
            setIsCoffeeBrewed(false);
        };

        const handleResetAutoNavigation = () => {
            setHasAutoNavigatedToNotes(false);
        };

        const handleMethodToBrewing = () => {
            setShowComplete(false);
            setIsCoffeeBrewed(false);

            if (selectedEquipment && (currentBrewingMethod || selectedMethod)) {
                const method = currentBrewingMethod || selectedMethod;
                updateParameterInfo(
                    "brewing",
                    selectedEquipment,
                    method,
                    equipmentList,
                    customEquipments
                );
            }
        };

        const handleGetParams = () => {
            if (currentBrewingMethod && currentBrewingMethod.params) {
                const paramsUpdatedEvent = new CustomEvent('brewing:paramsUpdated', {
                    detail: {
                        params: {
                            coffee: currentBrewingMethod.params.coffee,
                            water: currentBrewingMethod.params.water,
                            ratio: currentBrewingMethod.params.ratio,
                            grindSize: currentBrewingMethod.params.grindSize,
                            temp: currentBrewingMethod.params.temp
                        },
                        coffeeBean: selectedCoffeeBeanData ? {
                            name: selectedCoffeeBeanData.name || '',
                            roastLevel: selectedCoffeeBeanData.roastLevel || '中度烘焙',
                            roastDate: selectedCoffeeBeanData.roastDate || ''
                        } : null
                    }
                });
                window.dispatchEvent(paramsUpdatedEvent);
            }
        };

        const handleTimerStatusChange = (e: CustomEvent) => {
            if (typeof e.detail?.isRunning === 'boolean') {
                setIsTimerRunning(e.detail.isRunning);

                if (!e.detail.isRunning) {
                    setCountdownTime(null);
                }
            }
        };

        const handleStageChange = (e: CustomEvent) => {
            if (typeof e.detail?.stage === 'number') {
                setCurrentStage(e.detail.stage);
            } else if (typeof e.detail?.currentStage === 'number') {
                setCurrentStage(e.detail.currentStage);
            }

            if (typeof e.detail?.isWaiting === 'boolean') {
                setIsStageWaiting(e.detail.isWaiting);
            }
        };

        const handleCountdownChange = (e: CustomEvent) => {
            if ('remainingTime' in e.detail) {
                setTimeout(() => {
                    setCountdownTime(e.detail.remainingTime);

                    if (e.detail.remainingTime !== null) {
                        setCurrentStage(-1);
                    }
                }, 0);
            }
        };

        window.addEventListener('brewing:complete', handleBrewingComplete);
        window.addEventListener('brewing:reset', handleBrewingReset);
        window.addEventListener('brewing:resetAutoNavigation', handleResetAutoNavigation);
        window.addEventListener('brewing:methodToBrewing', handleMethodToBrewing);
        window.addEventListener('brewing:getParams', handleGetParams);
        window.addEventListener('brewing:timerStatus', handleTimerStatusChange as EventListener);
        window.addEventListener('brewing:stageChange', handleStageChange as EventListener);
        window.addEventListener('brewing:countdownChange', handleCountdownChange as EventListener);
        window.addEventListener('brewing:layoutChange', handleLayoutChange as EventListener);

        return () => {
            window.removeEventListener('brewing:complete', handleBrewingComplete);
            window.removeEventListener('brewing:reset', handleBrewingReset);
            window.removeEventListener('brewing:resetAutoNavigation', handleResetAutoNavigation);
            window.removeEventListener('brewing:methodToBrewing', handleMethodToBrewing);
            window.removeEventListener('brewing:getParams', handleGetParams);
            window.removeEventListener('brewing:timerStatus', handleTimerStatusChange as EventListener);
            window.removeEventListener('brewing:stageChange', handleStageChange as EventListener);
            window.removeEventListener('brewing:countdownChange', handleCountdownChange as EventListener);
            window.removeEventListener('brewing:layoutChange', handleLayoutChange as EventListener);
        };
    }, [setShowComplete, setIsCoffeeBrewed, setHasAutoNavigatedToNotes, setIsTimerRunning, setCurrentStage, setCountdownTime, setIsStageWaiting, currentBrewingMethod, selectedCoffeeBeanData, selectedEquipment, selectedMethod, customEquipments, handleLayoutChange]);

    const handleBrewingStepClickWrapper = (step: BrewingStep) => {
        // 特殊处理：从注水返回到方案步骤的情况
        if (activeBrewingStep === 'brewing' && step === 'method') {
            // 设置特殊标记，确保可以正常导航
            localStorage.setItem("fromMethodToBrewing", "true");

            // 如果当前在冲煮完成状态，重置相关状态
            if (showComplete || isCoffeeBrewed) {
                setShowComplete(false);
                setIsCoffeeBrewed(false);
            }
        }

        // 检查是否从记录返回到其他步骤，这是一种特殊情况
        if (activeBrewingStep === 'notes' && (step === 'method' || step === 'brewing')) {
            // 触发brewing:reset事件，确保计时器状态正确重置
            window.dispatchEvent(new CustomEvent("brewing:reset"));

            // 确保冲煮状态已重置
            setShowComplete(false);
            setIsCoffeeBrewed(false);
            setHasAutoNavigatedToNotes(false);
        }

        // 使用navigateToStep来处理导航，它会处理更复杂的导航逻辑
        navigateToStep(step, {
            // 如果是从注水到方案，使用特殊选项
            force: (activeBrewingStep === 'brewing' && step === 'method'),
            // 如果是从brewing到method，保留所有状态
            preserveStates: (activeBrewingStep === 'brewing' && step === 'method') ? ["all"] : [],
            preserveCoffeeBean: true,
            preserveEquipment: true,
            preserveMethod: (activeBrewingStep === 'brewing' && step === 'method')
        });

        // 如果是从注水到方案的导航，确保标记被设置
        if (activeBrewingStep === 'brewing' && step === 'method') {
            // 延迟设置标记，确保在其他操作完成后标记依然存在
            setTimeout(() => {
                localStorage.setItem("fromMethodToBrewing", "true");
            }, 100);
        }
    };

    const handleBackClick = useCallback(() => {
        // 定义可导航的步骤映射（与SwipeBackGesture保持一致）
        const NAVIGABLE_STEPS: Record<BrewingStep, BrewingStep | null> = {
            'brewing': 'method', // 从注水步骤返回到方案步骤
            'method': 'coffeeBean', // 从方案步骤返回到咖啡豆步骤
            'coffeeBean': null, // 咖啡豆步骤是第一步，没有返回步骤
            'notes': 'brewing' // 从记录步骤返回到注水步骤
        };

        // 确定当前步骤是否可以返回，以及应返回到哪个步骤
        const getBackStep = (): BrewingStep | null => {
            // 如果当前是方案步骤且没有咖啡豆，则不允许返回到咖啡豆步骤
            if (activeBrewingStep === 'method' && !hasCoffeeBeans) {
                return null;
            }
            return NAVIGABLE_STEPS[activeBrewingStep];
        };

        const backStep = getBackStep();
        if (!backStep) return;
        // 处理从注水步骤返回到方案步骤的特殊情况
        else if (activeBrewingStep === 'brewing' && backStep === 'method') {
            // 设置特殊标记，确保可以正常导航
            localStorage.setItem("fromMethodToBrewing", "true");

            // 使用navigateToStep返回到前一个步骤
            navigateToStep(backStep, {
                force: true,
                preserveStates: ["all"],
                preserveCoffeeBean: true,
                preserveEquipment: true,
                preserveMethod: true
            });
        } else {
            // 特殊处理：从记录步骤返回到注水步骤
            if (activeBrewingStep === 'notes' && backStep === 'brewing') {
                // 触发brewing:reset事件，确保计时器状态正确重置
                window.dispatchEvent(new CustomEvent("brewing:reset"));

                // 重置冲煮完成状态
                setShowComplete(false);
                setIsCoffeeBrewed(false);
                setHasAutoNavigatedToNotes(false);
            }

            // 其他步骤的返回导航
            navigateToStep(backStep, {
                preserveCoffeeBean: true,
                preserveEquipment: activeBrewingStep !== 'method',
                preserveMethod: activeBrewingStep === 'notes'
            });
        }
    }, [activeBrewingStep, hasCoffeeBeans, navigateToStep]);

    const handleMethodSelectWrapper = useCallback(async (index: number, step?: Step) => {
        // 检查是否在冲煮完成状态选择了新的方案
        if (isCoffeeBrewed) {
            // 确保isCoffeeBrewed状态被重置，允许正常的步骤导航
            setIsCoffeeBrewed(false);
        }

        // 确保有有效的设备选择
        if (!selectedEquipment || selectedEquipment.trim() === '') {
            console.error("尝试选择方法但没有有效的设备选择:", { selectedEquipment, index, methodType });
            // 尝试从缓存恢复设备选择
            const { getSelectedEquipmentPreference } = await import('@/lib/hooks/useBrewingState');
            const cachedEquipment = getSelectedEquipmentPreference();
            if (cachedEquipment) {
                console.log("从缓存恢复设备选择:", cachedEquipment);
                // 直接使用handleEquipmentSelect来恢复状态
                handleEquipmentSelect(cachedEquipment);
                // 延迟执行方法选择，等待设备状态更新
                setTimeout(() => {
                    handleMethodSelectWrapper(index, step);
                }, 100);
                return;
            } else {
                console.error("无法恢复设备选择，缓存中也没有设备信息");
                return;
            }
        }

        // 确定使用哪种方法类型：
        // 1. 优先使用step中明确指定的方法类型（使用类型断言访问explicitMethodType）
        // 2. 如果没有明确指定，则使用全局methodType状态
        const effectiveMethodType = (step as ExtendedStep)?.explicitMethodType || methodType;

        // 将正确的参数传递给 handleMethodSelect
        await handleMethodSelect(selectedEquipment, index, effectiveMethodType, step);
    }, [handleMethodSelect, isCoffeeBrewed, setIsCoffeeBrewed, selectedEquipment, methodType, handleEquipmentSelect]);

    useEffect(() => {
        if (showComplete && activeMainTab === '冲煮' && activeBrewingStep === 'brewing' && !hasAutoNavigatedToNotes) {
            // 确保清理替代头部状态
            setShowAlternativeHeader(false);
            setAlternativeHeaderContent(null);

            // 使用setTimeout确保状态更新完成后再跳转
            setTimeout(() => {
                navigateToStep('notes', { force: true });
                setHasAutoNavigatedToNotes(true);
            }, 0);
        }
    }, [showComplete, activeMainTab, activeBrewingStep, navigateToStep, hasAutoNavigatedToNotes]);

    const handleMainTabClick = (tab: MainTabType) => {
        if (tab === activeMainTab) {
            return;
        }

        saveMainTabPreference(tab);
        setActiveMainTab(tab);
    };

    const [showOnboarding, setShowOnboarding] = useState(false)

    const handleOnboardingComplete = () => {
        setShowOnboarding(false)
    }

    const handleImportBean = async (jsonData: string) => {
        try {
            // 尝试从文本中提取数据
            const extractedData = await import('@/lib/utils/jsonUtils').then(
                ({ extractJsonFromText }) => extractJsonFromText(jsonData)
            );

            if (!extractedData) {
                throw new Error('无法从输入中提取有效数据');
            }

            // 检查是否是咖啡豆数据类型，通过类型守卫确保安全访问属性
            const isCoffeeBean = (data: unknown): data is CoffeeBean =>
                data !== null && typeof data === 'object' && 'roastLevel' in data;

            // 检查是否是咖啡豆数组
            const isCoffeeBeanArray = (data: unknown): data is CoffeeBean[] =>
                Array.isArray(data) && data.length > 0 && data.every(isCoffeeBean);

            // 确保提取的数据是咖啡豆或咖啡豆数组
            if (!isCoffeeBean(extractedData) && !isCoffeeBeanArray(extractedData)) {
                throw new Error('导入的数据不是有效的咖啡豆信息');
            }

            const beansToImport = Array.isArray(extractedData) ? extractedData : [extractedData];

            let importCount = 0;
            let lastImportedBean: ExtendedCoffeeBean | null = null;

            // 动态导入 CoffeeBeanManager
            const { CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager');

            // 开始批量操作，禁用单个添加时的事件触发
            CoffeeBeanManager.startBatchOperation();

            try {
                for (const beanData of beansToImport) {
                // 将导入的咖啡豆转换为ExtendedCoffeeBean类型
                const bean = {
                    name: beanData.name,
                    roastLevel: beanData.roastLevel || '浅度烘焙',
                    capacity: beanData.capacity || '200',
                    remaining: beanData.remaining || beanData.capacity || '200',
                    price: beanData.price || '',
                    roastDate: beanData.roastDate || '',
                    flavor: beanData.flavor || [],
                    notes: beanData.notes || '',

                    startDay: beanData.startDay,
                    endDay: beanData.endDay
                } as Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>;

                // 验证必要的字段
                if (!bean.name) {
                    // 导入数据缺少咖啡豆名称，跳过
                    continue;
                }

                // 处理拼配成分
                const beanBlendComponents = (beanData as unknown as Record<string, unknown>).blendComponents;
                if (beanBlendComponents && Array.isArray(beanBlendComponents)) {
                    // 验证拼配成分的格式是否正确
                    const validComponents = beanBlendComponents
                        .filter((comp: unknown) =>
                            comp && (typeof comp === 'object') &&
                            comp !== null &&
                            ('origin' in comp || 'process' in comp || 'variety' in comp)
                        );

                    if (validComponents.length > 0) {
                        bean.blendComponents = validComponents.map((comp: unknown) => {
                            const component = comp as Record<string, unknown>;
                            return {
                                origin: (component.origin as string) || '',
                                process: (component.process as string) || '',
                                variety: (component.variety as string) || '',
                                // 只在明确有百分比时才设置百分比值，否则保持为undefined
                                ...(component.percentage !== undefined ? {
                                    percentage: typeof component.percentage === 'string' ?
                                        parseInt(component.percentage, 10) :
                                        (typeof component.percentage === 'number' ? component.percentage : undefined)
                                } : {})
                            };
                        });
                    }
                } else {
                    // 检查是否有旧格式的字段，如果有则转换为新格式
                    const beanDataRecord = beanData as unknown as Record<string, unknown>;
                    const legacyOrigin = beanDataRecord.origin as string;
                    const legacyProcess = beanDataRecord.process as string;
                    const legacyVariety = beanDataRecord.variety as string;

                    if (legacyOrigin || legacyProcess || legacyVariety) {
                        bean.blendComponents = [{
                            percentage: 100,
                            origin: legacyOrigin || '',
                            process: legacyProcess || '',
                            variety: legacyVariety || ''
                        }];
                    }
                }

                // 确保有beanType字段，默认为手冲
                if (!bean.beanType) {
                    bean.beanType = 'filter';
                }

                    // 添加到数据库
                    const newBean = await CoffeeBeanManager.addBean(bean);
                    lastImportedBean = newBean;
                    importCount++;
                }
            } finally {
                // 结束批量操作，触发更新事件
                CoffeeBeanManager.endBatchOperation();
            }

            if (importCount === 0) {
                throw new Error('没有导入任何有效咖啡豆数据');
            }

            setShowImportBeanForm(false);

            window.dispatchEvent(
                new CustomEvent('coffeeBeanDataChanged', {
                    detail: {
                        action: 'import',
                        importCount: importCount
                    }
                })
            );

            await new Promise(resolve => setTimeout(resolve, 100));
            handleBeanListChange();
            handleMainTabClick('咖啡豆');

            if (importCount === 1 && lastImportedBean) {
                setTimeout(() => {
                    setEditingBean(lastImportedBean);
                    setShowBeanForm(true);
                }, 300);
            }
        } catch (error) {
            // 导入失败
            alert('导入失败: ' + (error instanceof Error ? error.message : '请检查数据格式'));
        }
    };

    const handleBeanForm = (bean: ExtendedCoffeeBean | null = null) => {
        setEditingBean(bean);
        setShowBeanForm(true);
    };

    // 完全重写checkCoffeeBeans函数，简化逻辑
    const checkCoffeeBeans = useCallback(async () => {
        try {
            const { CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager');
            const beans = await CoffeeBeanManager.getAllBeans();
            const hasAnyBeans = beans.length > 0;
            const wasHasBeans = hasCoffeeBeans;
            setHasCoffeeBeans(hasAnyBeans);

            // 咖啡豆从有到无的情况需要特殊处理
            if (!hasAnyBeans && wasHasBeans) {
                // 重置选中的咖啡豆
                setSelectedCoffeeBean(null);
                setSelectedCoffeeBeanData(null);

                // 如果在冲煮页面，执行更彻底的重置
                if (activeMainTab === '冲煮') {
                    // 执行一次完整的状态重置
                    resetBrewingState(false);

                    // 使用统一导航函数确保切换到方案步骤
                    navigateToStep('method', { resetParams: true });

                    // 延迟再次确认步骤，确保UI更新正确
                    setTimeout(() => {
                        navigateToStep('method', { resetParams: true });
                    }, 100);
                }
            }
        } catch (error) {
            // 检查咖啡豆失败
            console.error('检查咖啡豆失败:', error);
        }
    }, [activeMainTab, hasCoffeeBeans, navigateToStep, resetBrewingState, setSelectedCoffeeBean, setSelectedCoffeeBeanData]);

    const handleBeanListChange = useCallback(() => {
        checkCoffeeBeans();
        setBeanListKey(prevKey => prevKey + 1);

        setTimeout(() => {
            checkCoffeeBeans();
        }, 300);
    }, [checkCoffeeBeans]);

    // 修改咖啡豆列表变化的处理
    useEffect(() => {
        // 监听咖啡豆列表变化的自定义事件
        const handleBeanListChanged = (e: CustomEvent<{
            hasBeans: boolean,
            isFirstBean?: boolean,
            lastBeanDeleted?: boolean,
            deletedBeanId?: string  // 添加被删除的咖啡豆ID
        }>) => {
            // 强制检查咖啡豆状态
            checkCoffeeBeans();

            // 特殊处理：当从无到有（首次添加咖啡豆）且在咖啡豆标签页时
            if (e.detail.isFirstBean && activeMainTab === '咖啡豆') {
                // 不自动切换标签页，但记录状态，以便返回到冲煮页面时从咖啡豆步骤开始
                // 通过设置一个标记，等用户手动切换回冲煮页面时处理
                localStorage.setItem('shouldStartFromCoffeeBeanStep', 'true');
            }

            // 特殊处理：删除最后一个咖啡豆的情况
            if (e.detail.lastBeanDeleted) {
                // 强制重置所有状态
                setSelectedCoffeeBean(null);
                setSelectedCoffeeBeanData(null);

                // 无论当前在哪个页面，立即修正冲煮页面状态
                setActiveBrewingStep('method');
                setActiveTab('方案');

                // 如果在咖啡豆页面，不做任何切换
                // 如果在冲煮页面，强制刷新内容
                if (activeMainTab === '冲煮') {
                    // 触发一次重置，确保UI更新
                    resetBrewingState(false);
                    // 如果是在冲煮流程中，强制重新加载内容
                    setTimeout(() => {
                        // 确保已经设置为方案步骤
                        setActiveBrewingStep('method');
                        setActiveTab('方案');
                    }, 100);
                }
            }

            // 特殊处理：删除了当前选中的咖啡豆，但不是最后一个
            else if (e.detail.deletedBeanId && selectedCoffeeBean === e.detail.deletedBeanId) {
                // 重置选中的咖啡豆
                setSelectedCoffeeBean(null);
                setSelectedCoffeeBeanData(null);

                // 在冲煮页面时，如果在咖啡豆步骤，则切换到方案步骤
                if (activeMainTab === '冲煮' && activeBrewingStep === 'coffeeBean') {
                    setActiveBrewingStep('method');
                    setActiveTab('方案');
                }
            }
        };

        // 添加事件监听器
        window.addEventListener('coffeeBeanListChanged', handleBeanListChanged as EventListener);

        // 清理函数
        return () => {
            window.removeEventListener('coffeeBeanListChanged', handleBeanListChanged as EventListener);
        };
    }, [checkCoffeeBeans, activeMainTab, activeBrewingStep, setActiveBrewingStep, setActiveTab, selectedCoffeeBean, setSelectedCoffeeBean, setSelectedCoffeeBeanData, resetBrewingState]);

    // 添加从咖啡豆页面切换回冲煮页面的特殊处理
    useEffect(() => {
        if (activeMainTab === '冲煮') {
            // 检查是否应该从咖啡豆步骤开始
            const shouldStartFromCoffeeBeanStep = localStorage.getItem('shouldStartFromCoffeeBeanStep');
            if (shouldStartFromCoffeeBeanStep === 'true' && hasCoffeeBeans) {
                // 重置标记
                localStorage.removeItem('shouldStartFromCoffeeBeanStep');
                // 设置步骤为咖啡豆
                setActiveBrewingStep('coffeeBean');
                setActiveTab('咖啡豆');
            }
        }
    }, [activeMainTab, hasCoffeeBeans, setActiveBrewingStep, setActiveTab]);

    const handleSaveBean = async (bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>) => {
        try {
            const { CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager');
            const currentBeans = await CoffeeBeanManager.getAllBeans();
            const isFirstBean = !editingBean && currentBeans.length === 0;

            if (editingBean) {
                await CoffeeBeanManager.updateBean(editingBean.id, bean);
            } else {
                await CoffeeBeanManager.addBean(bean);
            }

            setShowBeanForm(false);
            setEditingBean(null);

            window.dispatchEvent(
                new CustomEvent('coffeeBeanDataChanged', {
                    detail: {
                        action: editingBean ? 'update' : 'add',
                        beanId: editingBean?.id,
                        isFirstBean: isFirstBean
                    }
                })
            );

            handleBeanListChange();

            if (isFirstBean) {
                window.dispatchEvent(
                    new CustomEvent('coffeeBeanListChanged', {
                        detail: { hasBeans: true, isFirstBean: true }
                    })
                );
            }

            setTimeout(() => {
                checkCoffeeBeans();
            }, 50);
        } catch (_error) {
            // 保存咖啡豆失败
            alert('保存失败，请重试');
        }
    };

    const handleEquipmentSelectWithName = useCallback((equipmentIdOrName: string) => {
        let standardEquipment = equipmentList.find(e => e.id === equipmentIdOrName);

        if (!standardEquipment) {
            standardEquipment = equipmentList.find(e => e.name === equipmentIdOrName);
        }

        let customEquipment = null;
        for (let i = customEquipments.length - 1; i >= 0; i--) {
            if (customEquipments[i].id === equipmentIdOrName || customEquipments[i].name === equipmentIdOrName) {
                customEquipment = customEquipments[i];
                // 找到匹配的自定义器具
                break;
            }
        }

        const equipmentId = customEquipment?.id || standardEquipment?.id || equipmentIdOrName;
        const equipmentName = customEquipment?.name || standardEquipment?.name || equipmentIdOrName;

        setParameterInfo({
            equipment: equipmentName,
            method: null,
            params: null
        });

        const isCustomPresetEquipment = customEquipment?.animationType === 'custom';

        if (isCustomPresetEquipment) {
            setMethodType('custom');
            // 检测到自定义预设器具，已自动切换到自定义方案模式
        }

        handleEquipmentSelect(equipmentId);

        // 设备选择完成
    }, [handleEquipmentSelect, setParameterInfo, customEquipments, setMethodType]);

    useEffect(() => {
        const preventScrollOnInputs = (e: TouchEvent) => {
            const target = e.target as HTMLElement;
            if (
                target.tagName === 'INPUT' ||
                target.tagName === 'SELECT' ||
                target.tagName === 'TEXTAREA' ||
                target.closest('.autocomplete-dropdown') ||
                target.closest('li') ||
                target.closest('[data-dropdown]') ||
                target.getAttribute('role') === 'listbox' ||
                target.getAttribute('role') === 'option'
            ) {
                e.stopPropagation();
            }
        };

        document.addEventListener('touchmove', preventScrollOnInputs, { passive: true });

        return () => {
            document.removeEventListener('touchmove', preventScrollOnInputs);
        };
    }, []);



    const expandedStagesRef = useRef<{
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
    }[]>([]);

    const handleMigrationComplete = () => {
        setShowDataMigration(false);
        setMigrationData(null);
        handleBeanListChange();
    };

    const handleDataChange = async () => {
        try {
            const { Storage } = await import('@/lib/core/storage');
            const savedSettings = await Storage.get('brewGuideSettings');
            if (savedSettings) {
                setSettings(JSON.parse(savedSettings) as SettingsOptions);
            }
        } catch {
            // 静默处理错误
        }

        try {
            const methods = await import('@/lib/managers/customMethods').then(({ loadCustomMethods }) => {
                return loadCustomMethods();
            });
            setCustomMethods(methods);
        } catch {
            // 静默处理错误
        }

        setSelectedMethod(null);
        alert('数据已更新，应用将重新加载数据');
    };

    // 监听从历史记录直接导航的事件
    useEffect(() => {
        // 注册事件监听
        const handleMainTabNavigation = (e: CustomEvent) => {
            const { tab } = e.detail;
            if (tab) {
                // 保存主标签页选择到缓存
                saveMainTabPreference(tab);
                setActiveMainTab(tab);
            }
        };

        const handleStepNavigation = (e: CustomEvent) => {
            const { step, fromHistory = false, directToBrewing = false } = e.detail;
            if (step) {
                navigateToStep(step, {
                    force: fromHistory || directToBrewing,
                    resetParams: false,
                    preserveStates: [],
                });

                // 如果是直接跳转到注水步骤，设置一个标记
                if (directToBrewing && step === 'brewing') {
                    // 设置一个localStorage标记，指示这是从历史记录直接跳转到注水步骤
                    localStorage.setItem('directToBrewing', 'true');

                    // 添加延迟确保UI已更新
                    setTimeout(() => {
                        // 强制聚焦到注水步骤，确保正确显示内容
                        navigateToStep('brewing', {
                            force: true,
                            resetParams: false,
                            preserveStates: ["all"],
                        });
                    }, 300);
                }
            }
        };

        const handleCoffeeBeanSelection = async (e: CustomEvent) => {
            const { beanName } = e.detail;
            if (beanName) {
                try {
                    // 动态导入 CoffeeBeanManager
                    const { CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager');
                    // 查找匹配的咖啡豆并选择它
                    const bean = await CoffeeBeanManager.getBeanByName(beanName);
                    if (bean) {
                        handleCoffeeBeanSelect(bean.id, bean);
                    }
                } catch (_error) {
                    // 查找咖啡豆失败
                }
            }
        };

        const handleEquipmentSelection = (e: CustomEvent) => {
            const { equipmentName } = e.detail;
            if (equipmentName) {
                // equipmentName 实际上可能是ID或名称，函数会自动处理
                handleEquipmentSelectWithName(equipmentName);
            }
        };

        const handleMethodSelection = (e: CustomEvent) => {
            const { methodName } = e.detail;
            if (methodName) {
                // 查找匹配的方法并选择它
                const allMethods = methodType === 'common'
                    ? commonMethods[selectedEquipment || ''] || []
                    : customMethods[selectedEquipment || ''] || [];

                const methodIndex = allMethods.findIndex(m => m.name === methodName);
                if (methodIndex !== -1) {
                    const selectedMethodObject = allMethods[methodIndex]; // Get the method object
                    // Update parameterInfo when method is selected
                    setParameterInfo(prevInfo => ({
                        ...prevInfo, // Keep existing equipment name
                        method: selectedMethodObject.name,
                        params: {
                            coffee: selectedMethodObject.params.coffee,
                            water: selectedMethodObject.params.water,
                            ratio: selectedMethodObject.params.ratio,
                            grindSize: selectedMethodObject.params.grindSize,
                            temp: selectedMethodObject.params.temp,
                        }
                    }));
                    handleMethodSelectWrapper(methodIndex);
                }
            }
        };

        const handleParamsUpdate = (e: CustomEvent) => {
            const { params } = e.detail;
            if (params) {
                // Update parameterInfo when params change
                setParameterInfo(prevInfo => ({
                    ...prevInfo, // Keep existing equipment and method
                    params: params // Update the params object
                }));
            }
        };

        // 添加方案类型变更事件监听器
        const handleMethodTypeEvent = (e: CustomEvent) => {
            const { detail } = e;
            if (detail) {
                // 调用方案类型切换函数
                handleMethodTypeChange(detail);
            }
        };

        // 添加事件监听
        document.addEventListener(BREWING_EVENTS.NAVIGATE_TO_MAIN_TAB, handleMainTabNavigation as EventListener);
        document.addEventListener(BREWING_EVENTS.NAVIGATE_TO_STEP, handleStepNavigation as EventListener);
        document.addEventListener(BREWING_EVENTS.SELECT_COFFEE_BEAN, handleCoffeeBeanSelection as unknown as EventListener);
        document.addEventListener(BREWING_EVENTS.SELECT_EQUIPMENT, handleEquipmentSelection as EventListener);
        document.addEventListener(BREWING_EVENTS.SELECT_METHOD, handleMethodSelection as EventListener);
        document.addEventListener(BREWING_EVENTS.UPDATE_BREWING_PARAMS, handleParamsUpdate as EventListener);
        window.addEventListener('methodTypeChange', handleMethodTypeEvent as EventListener);

        return () => {
            // 移除事件监听
            document.removeEventListener(BREWING_EVENTS.NAVIGATE_TO_MAIN_TAB, handleMainTabNavigation as EventListener);
            document.removeEventListener(BREWING_EVENTS.NAVIGATE_TO_STEP, handleStepNavigation as EventListener);
            document.removeEventListener(BREWING_EVENTS.SELECT_COFFEE_BEAN, handleCoffeeBeanSelection as unknown as EventListener);
            document.removeEventListener(BREWING_EVENTS.SELECT_EQUIPMENT, handleEquipmentSelection as EventListener);
            document.removeEventListener(BREWING_EVENTS.SELECT_METHOD, handleMethodSelection as EventListener);
            document.removeEventListener(BREWING_EVENTS.UPDATE_BREWING_PARAMS, handleParamsUpdate as EventListener);
            window.removeEventListener('methodTypeChange', handleMethodTypeEvent as EventListener);
        };
    }, [
        navigateToStep,
        handleCoffeeBeanSelect,
        handleEquipmentSelectWithName,
        methodType,
        selectedEquipment,
        customMethods,
        handleMethodSelectWrapper,
        setActiveMainTab,
        setActiveTab,
        handleMethodTypeChange
    ]);

    // 处理从历史记录直接跳转到注水步骤的情况
    useEffect(() => {
        // 检查是否有直接跳转到注水的标记
        const directToBrewing = localStorage.getItem('directToBrewing');
        // 移除未使用的变量
        // const lastNavigationTime = localStorage.getItem('lastNavigationTime');
        const lastNavigatedMethod = localStorage.getItem('lastNavigatedMethod');

        if (directToBrewing === 'true' && activeMainTab === '冲煮') {
            // 清除标记
            localStorage.removeItem('directToBrewing');
            localStorage.removeItem('lastNavigatedMethod');

            console.log("检测到从历史记录跳转的标记", {
                activeMainTab,
                activeBrewingStep,
                selectedEquipment,
                selectedMethod,
                currentBrewingMethod,
                lastNavigatedMethod
            });
        }
    }, [
        navigateToStep,
        handleCoffeeBeanSelect,
        handleEquipmentSelectWithName,
        methodType,
        selectedEquipment,
        customMethods,
        handleMethodSelectWrapper,
        setActiveMainTab,
        setActiveTab,
        handleMethodTypeChange
    ]);

    const [showNoteFormModal, setShowNoteFormModal] = useState(false)
    const [currentEditingNote, setCurrentEditingNote] = useState<Partial<BrewingNoteData>>({})

    const handleAddNote = () => {
        setCurrentEditingNote({
            coffeeBeanInfo: {
                name: '',
                roastLevel: '中度烘焙',
                roastDate: ''
            },
            taste: {
                acidity: 0,
                sweetness: 0,
                bitterness: 0,
                body: 0
            },
            rating: 3,
            notes: ''
        });
        setShowNoteFormModal(true);
    };

    const handleSaveBrewingNote = async (note: BrewingNoteData) => {
        try {
            const { globalCache } = await import('@/components/notes/List/globalCache');
            const { Storage } = await import('@/lib/core/storage');
            const existingNotesStr = await Storage.get('brewingNotes');
            const existingNotes = existingNotesStr ? JSON.parse(existingNotesStr) : [];

            let updatedNotes;
            const newNoteId = note.id || Date.now().toString();
            const isExistingNote = note.id && existingNotes.some((n: BrewingNoteData) => n.id === note.id);

            if (isExistingNote) {
                updatedNotes = existingNotes.map((n: BrewingNoteData) => {
                    if (n.id === note.id) {
                        return {
                            ...note,
                            timestamp: n.timestamp
                        };
                    }
                    return n;
                });
            } else {
                const newNote = {
                    ...note,
                    id: newNoteId,
                    timestamp: note.timestamp || Date.now()
                };

                updatedNotes = [newNote, ...existingNotes];
            }

            globalCache.notes = updatedNotes;

            const { calculateTotalCoffeeConsumption } = await import('@/components/notes/List/globalCache');
            globalCache.totalConsumption = calculateTotalCoffeeConsumption(updatedNotes);

            await Storage.set('brewingNotes', JSON.stringify(updatedNotes));

            setShowNoteFormModal(false);
            setCurrentEditingNote({});

            saveMainTabPreference('笔记');
            setActiveMainTab('笔记');
        } catch (_error) {
            // 保存冲煮笔记失败
            alert('保存失败，请重试');
        }
    };

    const handleSaveEquipment = async (equipment: CustomEquipment, methods?: Method[]) => {
        try {
            await saveCustomEquipment(equipment, methods);
            const updatedEquipments = await loadCustomEquipments();
            setCustomEquipments(updatedEquipments);
            setShowEquipmentForm(false);
            setEditingEquipment(undefined);
        } catch (_error) {
            // 保存器具失败
            alert('保存器具失败，请重试');
        }
    };

    const handleDeleteEquipment = async (equipment: CustomEquipment) => {
        if (window.confirm('确定要删除这个器具吗？')) {
            try {
                await deleteCustomEquipment(equipment.id);
                const updatedEquipments = await loadCustomEquipments();
                setCustomEquipments(updatedEquipments);
            } catch (error) {
                // Log error in development only
                if (process.env.NODE_ENV === 'development') {
                    console.error('删除器具失败:', error);
                }
                alert('删除器具失败，请重试');
            }
        }
    };

    useEffect(() => {
        if (selectedEquipment) {
            const isCustomPresetEquipment = customEquipments.some(
                e => (e.id === selectedEquipment || e.name === selectedEquipment) && e.animationType === 'custom'
            );

            if (isCustomPresetEquipment && methodType !== 'custom') {
                setMethodType('custom');
                // 设备改变：检测到自定义预设器具，已自动切换到自定义方案模式
            }
        }
    }, [selectedEquipment, customEquipments, methodType, setMethodType]);

    const handleImportEquipment = async (equipment: CustomEquipment, methods?: Method[]) => {
        try {
            const originalId = equipment.id;
            // 导入器具原始ID

            // 传递methods参数给handleSaveEquipment
            await handleSaveEquipment(equipment, methods);

            // 导入完成后，直接选择该设备
            if (originalId) {
                // 导入完成，设置选定器具ID
                // 直接使用ID选择设备
                handleEquipmentSelect(originalId);

                // 如果是自定义预设器具，强制设置方法类型为'custom'
                if (equipment.animationType === 'custom') {
                    setMethodType('custom');
                }
            }

            setShowEquipmentImportForm(false);
        } catch (error) {
            // Log error in development only
            if (process.env.NODE_ENV === 'development') {
                console.error('导入器具失败:', error);
            }
        }
    };

    // 加载自定义方法
    useEffect(() => {
        const loadMethods = async () => {
            try {
                const methods = await import('@/lib/managers/customMethods').then(({ loadCustomMethods }) => {
                    return loadCustomMethods();
                });
                setCustomMethods(methods);
            } catch (error) {
                // Log error in development only
                if (process.env.NODE_ENV === 'development') {
                    console.error('加载自定义方法失败:', error);
                }
            }
        };

        // 添加自定义方法更新事件监听器
        const handleMethodUpdate = () => {
            loadMethods();
        };

        // 添加数据变更事件监听器
        const handleStorageChange = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail?.key === 'allData' || customEvent.detail?.key?.startsWith('customMethods')) {
                loadMethods();
            }
        };

        loadMethods();

        // 添加事件监听
        window.addEventListener('customMethodUpdate', handleMethodUpdate);
        window.addEventListener('storage:changed', handleStorageChange);

        // 清理事件监听
        return () => {
            window.removeEventListener('customMethodUpdate', handleMethodUpdate);
            window.removeEventListener('storage:changed', handleStorageChange);
        };
    }, [setCustomMethods]);

    // 添加导航栏替代头部相关状态
    const [alternativeHeaderContent, setAlternativeHeaderContent] = useState<ReactNode | null>(null);
    const [showAlternativeHeader, setShowAlternativeHeader] = useState(false);

    // 监听清理替代头部事件
    useEffect(() => {
        const handleClearAlternativeHeader = () => {
            setShowAlternativeHeader(false);
            setAlternativeHeaderContent(null);
        };

        window.addEventListener('clearAlternativeHeader', handleClearAlternativeHeader);

        return () => {
            window.removeEventListener('clearAlternativeHeader', handleClearAlternativeHeader);
        };
    }, []);

    return (
        <div className="h-full flex flex-col overflow-y-scroll">
            {/* 页面级别的视图选择覆盖层 */}
            <AnimatePresence>
                {showViewDropdown && activeMainTab === '咖啡豆' && (
                    <>
                        {/* 模糊背景 - 移动设备优化的动画 */}
                        <motion.div
                            initial={{
                                opacity: 0,
                                backdropFilter: 'blur(0px)'
                            }}
                            animate={{
                                opacity: 1,
                                backdropFilter: 'blur(20px)',
                                transition: {
                                    opacity: {
                                        duration: 0.2,
                                        ease: [0.25, 0.46, 0.45, 0.94]
                                    },
                                    backdropFilter: {
                                        duration: 0.3,
                                        ease: [0.25, 0.46, 0.45, 0.94]
                                    }
                                }
                            }}
                            exit={{
                                opacity: 0,
                                backdropFilter: 'blur(0px)',
                                transition: {
                                    opacity: {
                                        duration: 0.15,
                                        ease: [0.4, 0.0, 1, 1]
                                    },
                                    backdropFilter: {
                                        duration: 0.2,
                                        ease: [0.4, 0.0, 1, 1]
                                    }
                                }
                            }}
                            className="fixed inset-0 z-[60]"
                            style={{
                                backgroundColor: 'color-mix(in srgb, var(--background) 40%, transparent)',
                                WebkitBackdropFilter: 'blur(4px)'
                            }}
                            onClick={() => setShowViewDropdown(false)}
                        />

                        {beanButtonPosition && (
                            <motion.div
                                initial={{ opacity: 1, scale: 1 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{
                                    opacity: 0,
                                    scale: 0.98,
                                    transition: {
                                        duration: 0.12,
                                        ease: [0.4, 0.0, 1, 1]
                                    }
                                }}
                                className="fixed z-[80]"
                                style={{
                                    top: `${beanButtonPosition.top}px`,
                                    left: `${beanButtonPosition.left}px`,
                                    minWidth: `${beanButtonPosition.width}px`
                                }}
                                data-view-selector
                            >
                                <motion.button
                                    initial={{ opacity: 1 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 1 }}
                                    onClick={() => setShowViewDropdown(false)}
                                    className="text-xs font-medium tracking-widest whitespace-nowrap transition-colors text-left pb-3 flex items-center text-neutral-800 dark:text-neutral-100 cursor-pointer"
                                    style={{ paddingBottom: '12px' }}
                                >
                                    <span className="relative inline-block">
                                        {VIEW_LABELS[currentBeanView]}
                                    </span>
                                    <ChevronsUpDown
                                        size={12}
                                        className="ml-1 text-neutral-400 dark:text-neutral-600"
                                        color="currentColor"
                                    />
                                </motion.button>
                            </motion.div>
                        )}

                        {beanButtonPosition && (
                            <motion.div
                                initial={{
                                    opacity: 0,
                                    y: -8,
                                    scale: 0.96
                                }}
                                animate={{
                                    opacity: 1,
                                    y: 0,
                                    scale: 1,
                                    transition: {
                                        duration: 0.25,
                                        ease: [0.25, 0.46, 0.45, 0.94]
                                    }
                                }}
                                exit={{
                                    opacity: 0,
                                    y: -6,
                                    scale: 0.98,
                                    transition: {
                                        duration: 0.15,
                                        ease: [0.4, 0.0, 1, 1]
                                    }
                                }}
                                className="fixed z-[80]"
                                style={{
                                    top: `${beanButtonPosition.top + 30}px`,
                                    left: `${beanButtonPosition.left}px`,
                                    minWidth: `${beanButtonPosition.width}px`
                                }}
                                data-view-selector
                            >
                                <div className="flex flex-col">
                                    {Object.entries(VIEW_LABELS)
                                        .filter(([key]) => key !== currentBeanView)
                                        .map(([key, label], index) => (
                                            <motion.button
                                                key={key}
                                                initial={{
                                                    opacity: 0,
                                                    y: -6,
                                                    scale: 0.98
                                                }}
                                                animate={{
                                                    opacity: 1,
                                                    y: 0,
                                                    scale: 1,
                                                    transition: {
                                                        delay: index * 0.04,
                                                        duration: 0.2,
                                                        ease: [0.25, 0.46, 0.45, 0.94]
                                                    }
                                                }}
                                                exit={{
                                                    opacity: 0,
                                                    y: -4,
                                                    scale: 0.98,
                                                    transition: {
                                                        delay: (Object.keys(VIEW_LABELS).length - index - 1) * 0.02,
                                                        duration: 0.12,
                                                        ease: [0.4, 0.0, 1, 1]
                                                    }
                                                }}
                                                onClick={() => handleBeanViewChange(key as ViewOption)}
                                                className="text-xs font-medium tracking-widest whitespace-nowrap transition-colors text-left pb-3 flex items-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                                                style={{ paddingBottom: '12px' }}
                                            >
                                                <span className="relative inline-block">
                                                    {label}
                                                </span>
                                                <span className="ml-1 w-3 h-3" />
                                            </motion.button>
                                        ))}
                                </div>
                            </motion.div>
                        )}
                    </>
                )}
            </AnimatePresence>

            <NavigationBar
                activeMainTab={activeMainTab}
                setActiveMainTab={handleMainTabClick}
                activeBrewingStep={activeBrewingStep}
                setActiveBrewingStep={setActiveBrewingStep}
                parameterInfo={parameterInfo}
                setParameterInfo={setParameterInfo}
                editableParams={editableParams}
                setEditableParams={setEditableParams}
                isTimerRunning={isTimerRunning}
                showComplete={showComplete}
                selectedEquipment={selectedEquipment}
                selectedMethod={currentBrewingMethod ? {
                    name: currentBrewingMethod.name,
                    params: {
                        coffee: currentBrewingMethod.params.coffee,
                        water: currentBrewingMethod.params.water,
                        ratio: currentBrewingMethod.params.ratio,
                        grindSize: currentBrewingMethod.params.grindSize,
                        temp: currentBrewingMethod.params.temp,
                        stages: currentBrewingMethod.params.stages.map(stage => ({
                            label: stage.label,
                            time: stage.time || 0,
                            water: stage.water,
                            detail: stage.detail
                        }))
                    }
                } : null}
                handleParamChange={handleParamChangeWrapper}
                handleExtractionTimeChange={handleExtractionTimeChange}
                setShowHistory={setShowHistory}
                setActiveTab={setActiveTab}
                onTitleDoubleClick={() => setIsSettingsOpen(true)}
                settings={settings}
                selectedCoffeeBean={selectedCoffeeBean}
                hasCoffeeBeans={hasCoffeeBeans}
                navigateToStep={navigateToStep}
                onStepClick={handleBrewingStepClickWrapper}
                alternativeHeader={alternativeHeaderContent}
                showAlternativeHeader={showAlternativeHeader}
                currentBeanView={currentBeanView}
                _onBeanViewChange={handleBeanViewChange}
                showViewDropdown={showViewDropdown}
                onToggleViewDropdown={handleToggleViewDropdown}
                customEquipments={customEquipments}
                onEquipmentSelect={handleEquipmentSelectWithName}
                onAddEquipment={() => setShowEquipmentForm(true)}
                onEditEquipment={(equipment) => {
                    setEditingEquipment(equipment);
                    setShowEquipmentForm(true);
                }}
                onDeleteEquipment={handleDeleteEquipment}
                onShareEquipment={async (equipment) => {
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
                }}
                onBackClick={handleBackClick}
            />

            {activeMainTab === '冲煮' && (
                <div
                    className="h-full overflow-y-auto space-y-5 p-6"
                >
                    <TabContent
                        activeMainTab={activeMainTab}
                        activeTab={activeTab}
                        content={content}
                        selectedMethod={selectedMethod as Method}
                        currentBrewingMethod={currentBrewingMethod as Method}
                        isTimerRunning={isTimerRunning}
                        showComplete={showComplete}
                        currentStage={currentStage}
                        isWaiting={isStageWaiting}
                        selectedEquipment={selectedEquipment}
                        selectedCoffeeBean={selectedCoffeeBean}
                        selectedCoffeeBeanData={selectedCoffeeBeanData}
                        countdownTime={countdownTime}
                        customMethods={customMethods}
                        actionMenuStates={actionMenuStates}
                        setActionMenuStates={setActionMenuStates}
                        setShowCustomForm={setShowCustomForm}
                        setShowImportForm={setShowImportForm}
                        settings={settings}
                        onMethodSelect={handleMethodSelectWrapper}
                        onCoffeeBeanSelect={handleCoffeeBeanSelect}
                        onEditMethod={handleEditCustomMethod}
                        onDeleteMethod={handleDeleteCustomMethod}
                        setActiveMainTab={setActiveMainTab}
                        resetBrewingState={resetBrewingState}

                        customEquipments={customEquipments}
                        expandedStages={expandedStagesRef.current}
                        setShowEquipmentForm={setShowEquipmentForm}
                        setEditingEquipment={setEditingEquipment}
                        handleDeleteEquipment={handleDeleteEquipment}
                    />
                </div>
            )}
            {activeMainTab === '笔记' && (
                <BrewingHistory
                    isOpen={true}
                    onClose={() => {
                        saveMainTabPreference('冲煮');
                        setActiveMainTab('冲煮');
                        setShowHistory(false);
                    }}
                    onAddNote={handleAddNote}
                    setAlternativeHeaderContent={setAlternativeHeaderContent}
                    setShowAlternativeHeader={setShowAlternativeHeader}
                />
            )}
            {activeMainTab === '咖啡豆' && (
                <CoffeeBeans
                    key={beanListKey}
                    isOpen={activeMainTab === '咖啡豆'}
                    showBeanForm={handleBeanForm}
                    onShowImport={() => setShowImportBeanForm(true)}
                    externalViewMode={currentBeanView}
                    onExternalViewChange={handleBeanViewChange}
                    settings={{
                        showFlavorPeriod: settings.showFlavorPeriod,
                        showOnlyBeanName: settings.showOnlyBeanName,
                        showFlavorInfo: settings.showFlavorInfo,
                        limitNotesLines: settings.limitNotesLines,
                        notesMaxLines: settings.notesMaxLines
                    }}
                />
            )}

            {activeMainTab === '冲煮' && activeBrewingStep === 'method' && selectedEquipment && (
                <MethodTypeSelector
                    methodType={methodType}
                    settings={settings}
                    onSelectMethodType={handleMethodTypeChange}
                    hideSelector={customEquipments.some(
                        e => (e.id === selectedEquipment || e.name === selectedEquipment) && e.animationType === 'custom'
                    )}
                />
            )}

            {activeMainTab === '冲煮' && activeBrewingStep === 'brewing' && currentBrewingMethod && !showHistory && (
                <BrewingTimer
                    currentBrewingMethod={currentBrewingMethod as Method}
                    onStatusChange={({ isRunning }) => {
                        const event = new CustomEvent('brewing:timerStatus', {
                            detail: {
                                isRunning,
                                status: isRunning ? 'running' : 'stopped'
                            }
                        });
                        window.dispatchEvent(event);
                    }}
                    onStageChange={({ currentStage, progress, isWaiting }) => {
                        const event = new CustomEvent('brewing:stageChange', {
                            detail: {
                                currentStage,
                                stage: currentStage,
                                progress,
                                isWaiting
                            }
                        });
                        window.dispatchEvent(event);
                    }}
                    onCountdownChange={(time) => {
                        setTimeout(() => {
                            const event = new CustomEvent('brewing:countdownChange', {
                                detail: { remainingTime: time }
                            });
                            window.dispatchEvent(event);
                        }, 0);
                    }}
                    onComplete={(isComplete) => {
                        if (isComplete) {
                            const event = new CustomEvent('brewing:complete');
                            window.dispatchEvent(event);
                        }
                    }}
                    onTimerComplete={() => {
                        // 冲煮完成后的处理，确保显示笔记表单
                        // 这里不需要额外设置，因为BrewingTimer组件内部已经处理了显示笔记表单的逻辑
                    }}
                    onExpandedStagesChange={(stages) => {
                        expandedStagesRef.current = stages;
                    }}
                    settings={settings}
                    selectedEquipment={selectedEquipment}
                    isCoffeeBrewed={isCoffeeBrewed}
                    layoutSettings={settings.layoutSettings}
                />
            )}

            {activeMainTab === '冲煮' && (
                <SwipeBackGesture
                    activeBrewingStep={activeBrewingStep}
                    isTimerRunning={isTimerRunning}
                    showComplete={showComplete}
                    navigateToStep={navigateToStep}
                    disabled={false}
                    hasCoffeeBeans={hasCoffeeBeans}
                />
            )}

            <CustomMethodFormModal
                showCustomForm={showCustomForm}
                showImportForm={showImportForm}
                editingMethod={editingMethod}
                selectedEquipment={selectedEquipment}
                customMethods={customMethods}
                onSaveCustomMethod={(method) => {
                    handleSaveCustomMethod(method);
                }}
                onCloseCustomForm={() => {
                    setShowCustomForm(false);
                    setEditingMethod(undefined);
                }}
                onCloseImportForm={() => {
                    setShowImportForm(false);
                }}
            />

            <CoffeeBeanFormModal
                showForm={showBeanForm}
                initialBean={editingBean}
                onSave={handleSaveBean}
                onClose={() => {
                    setShowBeanForm(false);
                    setEditingBean(null);
                }}
            />

            <ImportModal
                showForm={showImportBeanForm}
                onImport={handleImportBean}
                onClose={() => setShowImportBeanForm(false)}
            />

            <BrewingNoteFormModal
                key="note-form-modal"
                showForm={showNoteFormModal}
                initialNote={currentEditingNote}
                onSave={handleSaveBrewingNote}
                onClose={() => {
                    setShowNoteFormModal(false);
                    setCurrentEditingNote({});
                }}
            />

            <Settings
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                settings={settings}
                setSettings={setSettings}
                onDataChange={handleDataChange}
            />

            <CustomEquipmentFormModal
                showForm={showEquipmentForm}
                onClose={() => {
                    setShowEquipmentForm(false);
                    setEditingEquipment(undefined);
                }}
                onSave={handleSaveEquipment}
                editingEquipment={editingEquipment}
                onImport={() => setShowEquipmentImportForm(true)}
            />

            <EquipmentImportModal
                showForm={showEquipmentImportForm}
                onImport={handleImportEquipment}
                onClose={() => setShowEquipmentImportForm(false)}
                existingEquipments={customEquipments}
            />

            {migrationData && (
                <DataMigrationModal
                    isOpen={showDataMigration}
                    onClose={() => setShowDataMigration(false)}
                    legacyCount={migrationData.legacyCount}
                    onMigrationComplete={handleMigrationComplete}
                />
            )}

            {showOnboarding && (
                    <Onboarding
                        onSettingsChange={handleSettingsChange}
                        onComplete={handleOnboardingComplete}
                    />
            )}
        </div>
    )
}

export default AppContainer;