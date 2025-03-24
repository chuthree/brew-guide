'use client'
// 导入React和必要的hooks
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion as m, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { equipmentList, APP_VERSION } from '@/lib/config'
import { Storage } from '@/lib/storage'
import { initCapacitor } from './capacitor'
// 只导入需要的类型
import type { CoffeeBean } from '@/app/types'
import { useBrewingState, MainTabType, BrewingStep } from '@/lib/hooks/useBrewingState'
import { useBrewingParameters } from '@/lib/hooks/useBrewingParameters'
import { useBrewingContent } from '@/lib/hooks/useBrewingContent'
import { useMethodSelector } from '@/lib/hooks/useMethodSelector'
import { EditableParams } from '@/lib/hooks/useBrewingParameters'
import CustomMethodFormModal from '@/components/CustomMethodFormModal'
import NavigationBar from '@/components/NavigationBar'
import Settings, { SettingsOptions, defaultSettings } from '@/components/Settings'
import TabContent from '@/components/TabContent'
import MethodTypeSelector from '@/components/MethodTypeSelector'
import Onboarding from '@/components/Onboarding'
import CoffeeBeanFormModal from '@/components/CoffeeBeanFormModal'
import ImportModal from '@/components/ImportModal'
import { CoffeeBeanManager } from '@/lib/coffeeBeanManager'
import AIRecipeModal from '@/components/AIRecipeModal'
import textZoomUtils from '@/lib/textZoom'

// 添加内容转换状态类型
interface TransitionState {
    isTransitioning: boolean;
    source: string;
}

// 动态导入客户端组件
const BrewingTimer = dynamic(() => import('@/components/BrewingTimer'), { ssr: false, loading: () => null })
const BrewingHistory = dynamic(() => import('@/components/BrewingHistory'), { ssr: false, loading: () => null })
// BrewingNoteForm在计时器组件内部使用，在页面级别不直接使用
const CoffeeBeansComponent = dynamic(() => import('@/components/CoffeeBeans'), { ssr: false, loading: () => null })

// 添加一个静态加载器组件，处理初始化过程
const AppLoader = ({ onInitialized }: { onInitialized: (params: { hasBeans: boolean }) => void }) => {
    useEffect(() => {
        const loadInitialData = async () => {
            try {
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
                    if (notes) {
                        try {
                            JSON.parse(notes);
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

// 主应用容器，处理初始化流程
const AppContainer = () => {
    // 添加应用初始化状态
    const [isAppReady, setIsAppReady] = useState(false);
    // 添加初始咖啡豆状态
    const [initialHasBeans, setInitialHasBeans] = useState<boolean | null>(null);

    // 处理初始化完成
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

// 手冲咖啡配方页面组件 - 添加初始咖啡豆状态参数
const PourOverRecipes = ({ initialHasBeans }: { initialHasBeans: boolean }) => {
    // 使用设置相关状态
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settings, setSettings] = useState<SettingsOptions>(() => {
        // 使用默认设置作为初始值，稍后在 useEffect 中异步加载
        return defaultSettings;
    });

    // 咖啡豆表单状态
    const [showBeanForm, setShowBeanForm] = useState(false);
    const [editingBean, setEditingBean] = useState<CoffeeBean | null>(null);
    // 添加一个用于强制重新渲染咖啡豆列表的key
    const [beanListKey, setBeanListKey] = useState(0);
    // 导入咖啡豆状态
    const [showImportBeanForm, setShowImportBeanForm] = useState(false);

    // AI方案生成器状态
    const [showAIRecipeModal, setShowAIRecipeModal] = useState(false);
    const [selectedBeanForAI, setSelectedBeanForAI] = useState<CoffeeBean | null>(null);
    // 添加一个标志，跟踪是否是从AI方案跳转过来
    const [isFromAIRecipe, setIsFromAIRecipe] = useState(false);

    // 添加一个状态来跟踪是否已经自动跳转过
    const [hasAutoNavigatedToNotes, setHasAutoNavigatedToNotes] = useState(false);

    // 添加动画过渡状态
    const [transitionState, setTransitionState] = useState<TransitionState>({
        isTransitioning: false,
        source: ''
    });

    // 使用自定义Hooks，传入初始步骤
    const initialStep: BrewingStep = initialHasBeans ? 'coffeeBean' : 'equipment';

    // 创建自定义的useBrewingState hook调用，传入初始步骤
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
        isPourVisualizerPreloaded,
        customMethods, setCustomMethods,
        selectedCoffeeBean, selectedCoffeeBeanData, setSelectedCoffeeBean, setSelectedCoffeeBeanData,
        showCustomForm, setShowCustomForm,
        editingMethod, setEditingMethod,
        actionMenuStates, setActionMenuStates,
        showImportForm, setShowImportForm,
        setIsOptimizing,
        isNoteSaved, setIsNoteSaved,
        prevMainTabRef,
        resetBrewingState,
        jumpToImport,
        autoNavigateToBrewingAfterImport,
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

    const contentHooks = useBrewingContent({
        selectedEquipment,
        methodType,
        customMethods,
        selectedMethod,
        settings
    });

    const { content, updateBrewingSteps } = contentHooks;

    const methodSelector = useMethodSelector({
        selectedEquipment,
        methodType,
        customMethods,
        selectedCoffeeBean,
        setSelectedMethod,
        setCurrentBrewingMethod,
        setEditableParams,
        setParameterInfo,
        setActiveTab,
        setActiveBrewingStep,
        updateBrewingSteps,
        showComplete,
        resetBrewingState
    });

    const { handleMethodSelect } = methodSelector;

    // 统一初始化函数 - 只加载额外的设置和引导状态，咖啡豆状态已经在AppLoader中处理
    useEffect(() => {
        let isMounted = true; // 标记组件是否已挂载

        // 简化的初始化函数
        const initializeApp = async () => {
            try {
                // 1. 加载设置
                try {
                    const savedSettings = await Storage.get('brewGuideSettings');
                    if (savedSettings && isMounted) {
                        const parsedSettings = JSON.parse(savedSettings) as SettingsOptions;
                        setSettings(parsedSettings);

                        // 应用文本缩放级别
                        if (parsedSettings.textZoomLevel) {
                            await textZoomUtils.set(parsedSettings.textZoomLevel);
                        }
                    }
                } catch {
                    // 静默处理错误
                }

                // 2. 检查是否首次使用
                try {
                    const onboardingCompleted = await Storage.get('onboardingCompleted');
                    if (isMounted) {
                        setShowOnboarding(!onboardingCompleted);
                    }
                } catch {
                    // 静默处理错误
                }

                // 3. 初始化 Capacitor
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
    }, []);

    // 添加检查是否有咖啡豆的状态 - 使用传入的初始状态
    const [hasCoffeeBeans, setHasCoffeeBeans] = useState(initialHasBeans);

    // 处理双击标题打开设置
    const handleTitleDoubleClick = () => {
        setIsSettingsOpen(true);
    };

    // 处理参数变更的包装函数，修复any类型问题
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
            // 如果是从笔记页面切换过来的且笔记已保存，也重置状态
            else if (prevMainTabRef.current === '笔记' && isNoteSaved) {
                // 重置状态
                resetBrewingState(false); // 完全重置状态
                // 如果有咖啡豆，从咖啡豆步骤开始，使用统一导航函数
                if (hasCoffeeBeans) {
                    navigateToStep('coffeeBean');
                } else {
                    // 没有咖啡豆，从器具步骤开始，使用统一导航函数
                    navigateToStep('equipment');
                }
                // 重置标志
                setIsNoteSaved(false);
            }
        }

        // 更新前一个标签的引用
        prevMainTabRef.current = activeMainTab;
    }, [activeMainTab, resetBrewingState, prevMainTabRef, setShowHistory, isNoteSaved, navigateToStep, hasCoffeeBeans, setIsNoteSaved]);

    // 处理方法类型切换
    const handleMethodTypeChange = (type: 'common' | 'custom') => {
        // 设置动画过渡状态
        setTransitionState({
            isTransitioning: true,
            source: 'method-type-change'
        });

        setMethodType(type);

        // 延长到350ms确保动画完成
        setTimeout(() => {
            setTransitionState({
                isTransitioning: false,
                source: ''
            });
        }, 350);
    };

    // 添加一个状态来跟踪冲煮是否完成以及笔记是否进行中
    // 初始化为与showComplete相同的值，确保页面加载时状态一致
    const [isCoffeeBrewed, setIsCoffeeBrewed] = useState(showComplete);

    // 监听冲煮完成和重置事件
    useEffect(() => {
        // 确保isCoffeeBrewed始终跟踪showComplete的变化
        setIsCoffeeBrewed(showComplete);

        // 处理冲煮完成事件
        const handleBrewingComplete = () => {
            setIsCoffeeBrewed(true);
        };

        // 处理冲煮重置事件
        const handleBrewingReset = () => {
            setIsCoffeeBrewed(false);
        };

        // 添加事件监听器
        window.addEventListener('brewing:complete', handleBrewingComplete);
        window.addEventListener('brewing:reset', handleBrewingReset);

        // 清理事件监听器
        return () => {
            window.removeEventListener('brewing:complete', handleBrewingComplete);
            window.removeEventListener('brewing:reset', handleBrewingReset);
        };
    }, [showComplete]);

    // 修改处理步骤点击的包装函数，允许在冲煮完成后切换到记录
    const handleBrewingStepClickWrapper = (step: BrewingStep) => {
        // 设置过渡状态，启用页面动画
        setTransitionState({ isTransitioning: true, source: 'navigation-click' });



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

        // 检查是否从记录返回到方案，这是一种特殊情况
        if (activeBrewingStep === 'notes' && step === 'method') {

            // 确保冲煮状态已重置
            setShowComplete(false);
            setIsCoffeeBrewed(false);
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

        // 使用setTimeout重置状态，延长到350ms确保动画完成
        setTimeout(() => setTransitionState({ isTransitioning: false, source: '' }), 350);
    };

    // 修改方法选择的包装函数
    const handleMethodSelectWrapper = async (index: number) => {
        setTransitionState({ isTransitioning: true, source: 'content-click' });

        // 检查是否在冲煮完成状态选择了新的方案
        if (isCoffeeBrewed) {

            // 确保isCoffeeBrewed状态被重置，允许正常的步骤导航
            setIsCoffeeBrewed(false);
        }

        await handleMethodSelect(index);
        // 使用setTimeout重置状态，延长到350ms确保动画完成
        setTimeout(() => setTransitionState({ isTransitioning: false, source: '' }), 350);
    };

    // 处理冲煮完成后自动切换到笔记页面
    useEffect(() => {
        // 只有在冲煮刚刚完成且没有自动跳转过的情况下才执行自动跳转
        if (showComplete && activeMainTab === '冲煮' && activeBrewingStep === 'brewing' && !hasAutoNavigatedToNotes) {
            // 添加延迟，等待音效播放完成
            const timer = setTimeout(() => {
                // 使用统一导航函数而不是直接设置状态
                navigateToStep('notes', { force: true });
                // 标记已经自动跳转过
                setHasAutoNavigatedToNotes(true);
            }, 1000); // 延迟1秒，确保音效和触感反馈都完成

            return () => clearTimeout(timer);
        }
    }, [showComplete, activeMainTab, activeBrewingStep, navigateToStep, hasAutoNavigatedToNotes]);

    // 处理主标签切换 - 增加过渡动画效果
    const handleMainTabClick = (tab: MainTabType) => {
        // 如果点击的是当前激活的主标签，不执行任何操作
        if (tab === activeMainTab) {
            return;
        }

        // 设置动画过渡状态
        setTransitionState({
            isTransitioning: true,
            source: 'main-tab-click'
        });

        // 更新主标签
        setActiveMainTab(tab);

        // 延长到350ms确保动画完成
        setTimeout(() => {
            setTransitionState({
                isTransitioning: false,
                source: ''
            });
        }, 350);
    };

    const [showOnboarding, setShowOnboarding] = useState(false)

    // 处理设置变更
    const handleSettingsChange = async (newSettings: SettingsOptions) => {
        setSettings(newSettings);
        try {
            await Storage.set('brewGuideSettings', JSON.stringify(newSettings))

            // 如果文本缩放设置发生变化，应用新的缩放级别
            if (newSettings.textZoomLevel) {
                await textZoomUtils.set(newSettings.textZoomLevel);
            }
        } catch {
            // 静默处理错误
        }
    }

    // 处理引导完成
    const handleOnboardingComplete = () => {
        setShowOnboarding(false)
    }

    // 处理导入咖啡豆
    const handleImportBean = async (jsonData: string) => {
        try {
            // 尝试从文本中提取数据
            const extractedData = await import('@/lib/jsonUtils').then(
                ({ extractJsonFromText }) => extractJsonFromText(jsonData)
            );

            if (!extractedData) {
                throw new Error('无法从输入中提取有效数据');
            }

            // 检查数据是单个对象还是数组
            const beansToImport = Array.isArray(extractedData) ? extractedData : [extractedData];

            let importCount = 0;
            for (const bean of beansToImport) {
                // 验证必要的字段
                if (!bean.name) {
                    console.warn('导入数据缺少咖啡豆名称，跳过');
                    continue;
                }

                // 确保有容量（默认为200g）
                if (!bean.capacity) {
                    bean.capacity = "200";
                }

                // 确保烘焙度有默认值
                if (!bean.roastLevel) {
                    bean.roastLevel = '浅度烘焙';
                }

                // 添加到数据库
                await CoffeeBeanManager.addBean(bean);
                importCount++;
            }

            if (importCount === 0) {
                throw new Error('没有导入任何有效咖啡豆数据');
            }

            // 关闭导入表单
            setShowImportBeanForm(false);

            // 更新咖啡豆状态
            handleBeanListChange();

            alert(`成功导入 ${importCount} 款咖啡豆`);
        } catch (error) {
            console.error('导入失败:', error);
            alert('导入失败: ' + (error instanceof Error ? error.message : '请检查数据格式'));
        }
    };

    // 处理咖啡豆表单
    const handleBeanForm = (bean: CoffeeBean | null = null) => {
        setEditingBean(bean);
        setShowBeanForm(true);
    };

    // 处理AI方案生成
    const handleGenerateAIRecipe = (bean: CoffeeBean) => {
        setSelectedBeanForAI(bean);
        setShowAIRecipeModal(true);
    };

    // 完全重写checkCoffeeBeans函数，简化逻辑
    const checkCoffeeBeans = useCallback(async () => {
        try {
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

                    // 使用统一导航函数确保切换到器具步骤
                    navigateToStep('equipment', { resetParams: true });

                    // 延迟再次确认步骤，确保UI更新正确
                    setTimeout(() => {
                        navigateToStep('equipment', { resetParams: true });
                    }, 100);
                }
            }
        } catch {

        }
    }, [activeMainTab, hasCoffeeBeans, navigateToStep, resetBrewingState, setSelectedCoffeeBean, setSelectedCoffeeBeanData]);

    // 当添加或删除咖啡豆时，更新状态
    const handleBeanListChange = useCallback(() => {
        // 先执行咖啡豆状态检查
        checkCoffeeBeans();

        // 增加beanListKey以触发重新渲染
        setBeanListKey(prevKey => prevKey + 1);

        // 延迟再次检查，确保状态已更新
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
                setActiveBrewingStep('equipment');
                setActiveTab('器具');

                // 如果在咖啡豆页面，不做任何切换
                // 如果在冲煮页面，强制刷新内容
                if (activeMainTab === '冲煮') {
                    // 触发一次重置，确保UI更新
                    resetBrewingState(false);
                    // 如果是在冲煮流程中，强制重新加载内容
                    setTimeout(() => {
                        // 确保已经设置为器具步骤
                        setActiveBrewingStep('equipment');
                        setActiveTab('器具');
                    }, 100);
                }
            }

            // 特殊处理：删除了当前选中的咖啡豆，但不是最后一个
            else if (e.detail.deletedBeanId && selectedCoffeeBean === e.detail.deletedBeanId) {
                // 重置选中的咖啡豆
                setSelectedCoffeeBean(null);
                setSelectedCoffeeBeanData(null);

                // 在冲煮页面时，如果在咖啡豆步骤，则切换到器具步骤
                if (activeMainTab === '冲煮' && activeBrewingStep === 'coffeeBean') {
                    setActiveBrewingStep('equipment');
                    setActiveTab('器具');
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

    // 简化处理保存咖啡豆
    const handleSaveBean = async (bean: Omit<CoffeeBean, 'id' | 'timestamp'>) => {
        try {
            const isFirstBean = !(await CoffeeBeanManager.getAllBeans()).length;

            if (editingBean) {
                // 更新现有咖啡豆
                await CoffeeBeanManager.updateBean(editingBean.id, bean);
            } else {
                // 添加新咖啡豆
                await CoffeeBeanManager.addBean(bean);
            }

            // 关闭表单
            setShowBeanForm(false);
            setEditingBean(null);

            // 如果当前在咖啡豆标签页，触发一次标签切换来刷新列表
            if (activeMainTab === '咖啡豆') {
                // 通过临时切换到其他标签再切回来，触发组件重新加载
                setActiveMainTab('冲煮');
                setTimeout(() => {
                    setActiveMainTab('咖啡豆');
                }, 10);
            }

            // 更新咖啡豆状态
            handleBeanListChange();

            // 判断是否是首次添加咖啡豆，如果是则触发特殊事件
            if (isFirstBean) {
                // 触发首次添加咖啡豆的事件
                window.dispatchEvent(
                    new CustomEvent('coffeeBeanListChanged', {
                        detail: { hasBeans: true, isFirstBean: true }
                    })
                );
            }

            // 异步更新状态后立即检查一次咖啡豆状态
            setTimeout(() => {
                checkCoffeeBeans();
            }, 50);
        } catch {
            // 静默处理错误
            alert('保存失败，请重试');
        }
    };

    // 处理选择器具但从参数传入设备名称的情况
    const handleEquipmentSelectWithName = (equipmentName: string) => {
        setTransitionState({ isTransitioning: true, source: 'content-click' });
        const equipment = equipmentList.find(e => e.name === equipmentName)?.id || equipmentName;

        // 更新parameterInfo，添加设备信息
        setParameterInfo({
            equipment: equipmentName,
            method: null,
            params: null
        });

        handleEquipmentSelect(equipment);
        // 使用setTimeout重置状态，延长到350ms确保动画完成
        setTimeout(() => setTransitionState({ isTransitioning: false, source: '' }), 350);
    };

    // 当前页面相关初始化
    useEffect(() => {
        // 初始化
    }, []);

    // 触摸事件处理，防止在交互组件上滑动时触发页面滚动
    useEffect(() => {
        const preventScrollOnInputs = (e: TouchEvent) => {
            const target = e.target as HTMLElement;
            // 检查触摸目标是否是输入相关元素或其容器
            if (
                target.tagName === 'INPUT' ||
                target.tagName === 'SELECT' ||
                target.tagName === 'TEXTAREA' ||
                target.closest('.autocomplete-dropdown') || // 为下拉菜单添加这个类名
                target.closest('li') ||
                target.closest('[data-dropdown]') || // 为下拉容器添加这个属性
                target.getAttribute('role') === 'listbox' ||
                target.getAttribute('role') === 'option'
            ) {
                // 防止事件冒泡，避免触发页面滚动
                e.stopPropagation();
            }
        };

        document.addEventListener('touchmove', preventScrollOnInputs, { passive: true });

        return () => {
            document.removeEventListener('touchmove', preventScrollOnInputs);
        };
    }, []);

    // 在冲煮页面组件初始化时，添加对笔记状态的处理
    useEffect(() => {
        // 检查是否有未完成的笔记记录过程
        const brewingNoteInProgress = localStorage.getItem('brewingNoteInProgress');

        // 检查是否是从记录到注水的特殊跳转
        const fromNotesToBrewing = localStorage.getItem("fromNotesToBrewing");

        // 在每次进入冲煮页面时，检查笔记状态
        if (activeMainTab === '冲煮') {
            // 如果有未保存的笔记或者从记录到注水的特殊跳转，确保状态一致
            if (brewingNoteInProgress === 'true' || fromNotesToBrewing === 'true') {
                // 确保isCoffeeBrewed为true
                setIsCoffeeBrewed(true);

                // 只有在特殊跳转时才清除标记
                if (fromNotesToBrewing === 'true') {
                    localStorage.removeItem('fromNotesToBrewing');
                }
            }
        }
    }, [activeMainTab, setIsCoffeeBrewed]);

    // 添加等待状态
    const [isStageWaiting, setIsStageWaiting] = useState(false);

    // 添加扩展阶段状态 - 使用ref而不是state
    const expandedStagesRef = useRef<{
        type: 'pour' | 'wait';
        label: string;
        startTime: number;
        endTime: number;
        time: number;
        pourTime?: number;
        water: string;
        detail: string;
        pourType?: 'center' | 'circle' | 'ice' | 'other';
        valveStatus?: 'open' | 'closed';
        originalIndex: number;
    }[]>([]);

    // 在 Settings 组件中添加 onDataChange 属性
    const handleDataChange = async () => {
        try {
            // 重新加载设置
            const savedSettings = await Storage.get('brewGuideSettings');
            if (savedSettings) {
                setSettings(JSON.parse(savedSettings) as SettingsOptions);
            }
        } catch {
            // 静默处理错误
        }

        try {
            // 重新加载自定义方案
            const methods = await import('@/lib/customMethods').then(({ loadCustomMethods }) => {
                return loadCustomMethods();
            });
            setCustomMethods(methods);
        } catch {
            // 静默处理错误
        }

        // 重置当前选择的方案
        setSelectedMethod(null);

        // 显示通知
        alert('数据已更新，应用将重新加载数据');
    };

    // 添加更多事件监听器用于安全地更新状态
    useEffect(() => {
        // 添加事件监听
        const handleBrewingComplete = () => {
            setTimeout(() => {
                setShowComplete(true);

            }, 0);
        };

        const handleBrewingReset = () => {
            setTimeout(() => {
                setShowComplete(false);
                setIsTimerRunning(false);
                setCurrentStage(0);
                setCountdownTime(0);

            }, 0);
        };

        const handleMethodToBrewing = () => {
            // 清空冲煮完成状态，但保留其他状态
            setTimeout(() => {
                setShowComplete(false);

            }, 0);
        };

        const handleTimerStatusChange = (e: CustomEvent) => {
            if (e?.detail) {
                setTimeout(() => {
                    setIsTimerRunning(e.detail.isRunning);

                }, 0);
            }
        };

        const handleStageChange = (e: CustomEvent) => {
            if (e?.detail) {
                setTimeout(() => {
                    // 检查是否有currentStage属性，兼容不同的事件格式
                    if ('currentStage' in e.detail) {
                        setCurrentStage(e.detail.currentStage as number);
                    } else if ('stage' in e.detail) {
                        setCurrentStage(e.detail.stage as number);
                    }

                    // 如果有isWaiting属性，也设置它
                    if ('isWaiting' in e.detail) {
                        setIsStageWaiting(e.detail.isWaiting as boolean);
                    }

                    // 记录详细日志，帮助调试

                }, 0);
            }
        };

        const handleCountdownChange = (e: CustomEvent) => {
            if (e?.detail) {
                setTimeout(() => {
                    setCountdownTime(e.detail.time as number);

                }, 0);
            }
        };

        window.addEventListener('brewing:complete', handleBrewingComplete);
        window.addEventListener('brewing:reset', handleBrewingReset);
        window.addEventListener('brewing:methodToBrewing', handleMethodToBrewing);
        window.addEventListener('brewing:timerStatus', handleTimerStatusChange as EventListener);
        window.addEventListener('brewing:stageChange', handleStageChange as EventListener);
        window.addEventListener('brewing:countdownChange', handleCountdownChange as EventListener);

        // 清理函数
        return () => {
            window.removeEventListener('brewing:complete', handleBrewingComplete);
            window.removeEventListener('brewing:reset', handleBrewingReset);
            window.removeEventListener('brewing:methodToBrewing', handleMethodToBrewing);
            window.removeEventListener('brewing:timerStatus', handleTimerStatusChange as EventListener);
            window.removeEventListener('brewing:stageChange', handleStageChange as EventListener);
            window.removeEventListener('brewing:countdownChange', handleCountdownChange as EventListener);
        };
    }, []);

    // 监听冲煮重置事件，重置自动跳转标志和状态
    useEffect(() => {
        const handleBrewingReset = () => {
            // 重置自动跳转标志
            setHasAutoNavigatedToNotes(false);
            // 确保showComplete状态被重置
            setShowComplete(false);
            // 重置冲煮状态
            setIsCoffeeBrewed(false);


        };

        // 添加从方案到注水特殊跳转事件处理
        const handleMethodToBrewing = () => {
            // 重置冲煮完成状态，但保留其他状态
            setShowComplete(false);
            setIsCoffeeBrewed(false);

            // 确保设置了允许从注水返回到方案的特殊标记
            localStorage.setItem("fromMethodToBrewing", "true");


        };

        window.addEventListener('brewing:reset', handleBrewingReset);
        window.addEventListener('brewing:methodToBrewing', handleMethodToBrewing);

        return () => {
            window.removeEventListener('brewing:reset', handleBrewingReset);
            window.removeEventListener('brewing:methodToBrewing', handleMethodToBrewing);
        };
    }, [setShowComplete]);

    return (
        <div className="flex h-full flex-col overflow-hidden mx-auto max-w-[500px] font-mono text-neutral-800 dark:text-neutral-100">
            {/* 使用 NavigationBar 组件替换原有的导航栏 */}
            <NavigationBar
                activeMainTab={activeMainTab}
                setActiveMainTab={handleMainTabClick}
                activeBrewingStep={activeBrewingStep}
                setActiveBrewingStep={handleBrewingStepClickWrapper}
                parameterInfo={parameterInfo}
                setParameterInfo={setParameterInfo}
                editableParams={editableParams}
                setEditableParams={setEditableParams}
                isTimerRunning={isTimerRunning}
                showComplete={showComplete}
                selectedEquipment={selectedEquipment}
                selectedMethod={currentBrewingMethod}
                handleParamChange={handleParamChangeWrapper}
                setShowHistory={setShowHistory}
                setActiveTab={setActiveTab}
                onTitleDoubleClick={handleTitleDoubleClick}
                settings={settings}
                selectedCoffeeBean={selectedCoffeeBean}
                hasCoffeeBeans={hasCoffeeBeans}
                navigateToStep={navigateToStep}
                onStepClick={handleBrewingStepClickWrapper}
            />

            {/* 内容区域 */}
            <AnimatePresence mode="wait">
                {activeMainTab === '冲煮' && (
                    <m.div
                        key="brew-content"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="h-full overflow-y-auto"
                    >
                        <TabContent
                            activeMainTab={activeMainTab}
                            activeTab={activeTab}
                            content={content}
                            selectedMethod={selectedMethod}
                            currentBrewingMethod={currentBrewingMethod}
                            isTimerRunning={isTimerRunning}
                            showComplete={showComplete}
                            currentStage={currentStage}
                            isWaiting={isStageWaiting}
                            isPourVisualizerPreloaded={isPourVisualizerPreloaded}
                            selectedEquipment={selectedEquipment}
                            selectedCoffeeBean={selectedCoffeeBean}
                            selectedCoffeeBeanData={selectedCoffeeBeanData}
                            countdownTime={countdownTime}
                            methodType={methodType}
                            customMethods={customMethods}
                            actionMenuStates={actionMenuStates}
                            setActionMenuStates={setActionMenuStates}
                            showCustomForm={showCustomForm}
                            setShowCustomForm={setShowCustomForm}
                            showImportForm={showImportForm}
                            setShowImportForm={setShowImportForm}
                            settings={settings}
                            onEquipmentSelect={handleEquipmentSelectWithName}
                            onMethodSelect={handleMethodSelectWrapper}
                            onCoffeeBeanSelect={handleCoffeeBeanSelect}
                            onEditMethod={handleEditCustomMethod}
                            onDeleteMethod={handleDeleteCustomMethod}
                            transitionState={transitionState}
                            setActiveMainTab={setActiveMainTab}
                            resetBrewingState={resetBrewingState}
                            expandedStages={expandedStagesRef.current}
                        />
                    </m.div>
                )}
                {activeMainTab === '笔记' && (
                    <m.div
                        key="notes-tab"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.3 }}
                        className="flex-1 overflow-auto"
                    >
                        <BrewingHistory
                            isOpen={true}
                            onClose={() => {
                                setActiveMainTab('冲煮');
                                setShowHistory(false);
                            }}
                            onOptimizingChange={setIsOptimizing}
                            onJumpToImport={jumpToImport}
                        />
                    </m.div>
                )}
                {activeMainTab === '咖啡豆' && (
                    <m.div
                        key="coffee-beans-tab"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.3 }}
                        className="flex-1 overflow-auto"
                    >
                        <CoffeeBeansComponent
                            key={beanListKey}
                            isOpen={activeMainTab === '咖啡豆'}
                            showBeanForm={handleBeanForm}
                            onShowImport={() => setShowImportBeanForm(true)}
                            onJumpToImport={jumpToImport}
                            onGenerateAIRecipe={handleGenerateAIRecipe}
                        />
                    </m.div>
                )}
            </AnimatePresence>

            {/* 底部工具栏 - 根据当前状态显示不同内容 */}
            <AnimatePresence mode="wait" initial={false}>
                {/* 方案类型选择器 */}
                {activeMainTab === '冲煮' && activeBrewingStep === 'method' && selectedEquipment && (
                    <m.div
                        key="method-selector"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{
                            duration: 0.28,
                            ease: "easeOut",
                            exit: { duration: 0.2 }
                        }}
                    >
                        <MethodTypeSelector
                            methodType={methodType}
                            settings={settings}
                            onSelectMethodType={handleMethodTypeChange}
                        />
                    </m.div>
                )}

                {/* 计时器 */}
                {activeMainTab === '冲煮' && activeBrewingStep === 'brewing' && currentBrewingMethod && !showHistory && (
                    <m.div
                        key="brewing-timer"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{
                            duration: 0.28,
                            ease: "easeOut",
                            exit: { duration: 0.2 }
                        }}
                    >
                        <BrewingTimer
                            currentBrewingMethod={currentBrewingMethod}
                            onStatusChange={({ isRunning }) => {
                                // 使用事件而不是直接更新状态
                                const event = new CustomEvent('brewing:timerStatus', {
                                    detail: { isRunning }
                                });
                                window.dispatchEvent(event);
                            }}
                            onStageChange={({ currentStage, isWaiting }) => {
                                // 使用事件而不是直接更新状态
                                const event = new CustomEvent('brewing:stageChange', {
                                    detail: { currentStage, isWaiting }
                                });
                                window.dispatchEvent(event);
                            }}
                            onCountdownChange={(time) => {
                                // 使用事件而不是直接更新状态
                                const event = new CustomEvent('brewing:countdownChange', {
                                    detail: { time }
                                });
                                window.dispatchEvent(event);
                            }}
                            onComplete={(isComplete) => {
                                if (isComplete) {
                                    // 触发一个事件而不是直接更新状态
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
                            onJumpToImport={jumpToImport}
                            selectedEquipment={selectedEquipment}
                            isCoffeeBrewed={isCoffeeBrewed}
                        />
                    </m.div>
                )}
            </AnimatePresence>

            {/* 使用自定义方案表单模态框组件 */}
            <CustomMethodFormModal
                showCustomForm={showCustomForm}
                showImportForm={showImportForm}
                editingMethod={editingMethod}
                selectedEquipment={selectedEquipment}
                customMethods={customMethods}
                onSaveCustomMethod={(method) => {
                    // 保存方法
                    handleSaveCustomMethod(method);

                    // 如果是从AI方案导入的，自动跳转到注水步骤
                    if (isFromAIRecipe) {
                        // 确保方法有ID
                        if (method.id) {


                            // 等待保存完成后跳转
                            setTimeout(() => {
                                // 自动跳转到注水步骤（使用保存后的方法ID）
                                autoNavigateToBrewingAfterImport(method.id);
                                // 重置标志
                                setIsFromAIRecipe(false);
                            }, 100); // 减少延迟，确保更流畅的体验
                        } else {

                            setIsFromAIRecipe(false);
                        }
                    }
                }}
                onCloseCustomForm={() => {
                    setShowCustomForm(false);
                    setEditingMethod(undefined);
                }}
                onCloseImportForm={() => {
                    setShowImportForm(false);
                    // 如果关闭导入表单但未导入，也重置标志
                    if (isFromAIRecipe) {
                        setIsFromAIRecipe(false);
                    }
                }}
                settings={settings}
            />

            {/* 咖啡豆表单模态框组件 */}
            <CoffeeBeanFormModal
                showForm={showBeanForm}
                initialBean={editingBean}
                onSave={handleSaveBean}
                onClose={() => {
                    setShowBeanForm(false);
                    setEditingBean(null);
                }}
            />

            {/* 导入咖啡豆模态框组件 */}
            <ImportModal
                showForm={showImportBeanForm}
                onImport={handleImportBean}
                onClose={() => setShowImportBeanForm(false)}
            />

            {/* AI 方案生成器模态框组件 */}
            <AIRecipeModal
                showModal={showAIRecipeModal}
                onClose={() => setShowAIRecipeModal(false)}
                coffeeBean={selectedBeanForAI}
                onJumpToImport={() => {
                    // 设置标志，表示是从AI方案跳转过来
                    setIsFromAIRecipe(true);
                    jumpToImport();
                    setShowAIRecipeModal(false);
                }}
            />

            {/* 设置组件 - 放在页面级别确保正确覆盖整个内容 */}
            <Settings
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                settings={settings}
                setSettings={setSettings}
                onDataChange={handleDataChange}
            />

            {/* 引导组件 */}
            {
                showOnboarding && (
                    <Onboarding
                        onSettingsChange={handleSettingsChange}
                        onComplete={handleOnboardingComplete}
                    />
                )
            }
        </div>
    )
}

// 导出AppContainer而不是PourOverRecipes，确保初始化逻辑正确执行
export default AppContainer; 