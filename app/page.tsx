'use client'
// 导入React和必要的hooks
import React, { useState, useEffect, useCallback } from 'react'
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
import { CoffeeBeanManager } from '@/lib/coffeeBeanManager'

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
        selectedCoffeeBean, selectedCoffeeBeanData,
        showCustomForm, setShowCustomForm,
        editingMethod, setEditingMethod,
        actionMenuStates, setActionMenuStates,
        showImportForm, setShowImportForm,
        setIsOptimizing,
        prevMainTabRef,
        resetBrewingState,
        jumpToImport,
        handleBrewingStepClick,
        handleEquipmentSelect,
        handleCoffeeBeanSelect,
        handleSaveCustomMethod,
        handleEditCustomMethod,
        handleDeleteCustomMethod
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
        selectedMethod
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
        updateBrewingSteps
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
                        setSettings(JSON.parse(savedSettings) as SettingsOptions);
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

    // 添加一个单独的 useEffect 来处理主标签切换
    useEffect(() => {
        if (activeMainTab === '冲煮') {
            // 从其他标签切换回冲煮标签时，确保关闭历史记录显示
            if (showHistory) {
                setShowHistory(false);
            }
        }
    }, [activeMainTab, showHistory, setShowHistory]);

    // 采用单一数据流，移除双向映射
    useEffect(() => {
        if (activeMainTab === '冲煮') {
            // 仅当 activeBrewingStep 变化时同步 activeTab
            // 这样建立单向数据流：activeBrewingStep => activeTab
            switch (activeBrewingStep) {
                case 'coffeeBean':
                    setActiveTab('咖啡豆');
                    break;
                case 'equipment':
                    setActiveTab('器具');
                    break;
                case 'method':
                    setActiveTab('方案');
                    break;
                case 'brewing':
                    setActiveTab('注水');
                    break;
                case 'notes':
                    setActiveTab('记录');
                    break;
                default:
                    break;
            }
        }
    }, [activeBrewingStep, activeMainTab, setActiveTab]);

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

    // 添加一个新的状态来跟踪是否是保存后的跳转
    const [isNoteSaved, setIsNoteSaved] = useState(false);

    // 修改标签切换检测逻辑，确保有咖啡豆时始终从咖啡豆步骤开始
    useEffect(() => {
        // 处理标签切换，特别是从笔记切换到冲煮时的情况
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
                // 设置步骤为咖啡豆
                setActiveBrewingStep('coffeeBean');
                setActiveTab('咖啡豆');
            }
            // 如果是从笔记页面切换过来的且笔记已保存，也重置状态
            else if (prevMainTabRef.current === '笔记' && isNoteSaved) {
                // 重置状态
                resetBrewingState(false); // 完全重置状态
                // 如果有咖啡豆，从咖啡豆步骤开始
                if (hasCoffeeBeans) {
                    setActiveBrewingStep('coffeeBean');
                    setActiveTab('咖啡豆');
                } else {
                    // 没有咖啡豆，从器具步骤开始
                    setActiveBrewingStep('equipment');
                    setActiveTab('器具');
                }
                // 重置标志
                setIsNoteSaved(false);
            }
        }

        // 更新前一个标签的引用
        prevMainTabRef.current = activeMainTab;
    }, [activeMainTab, resetBrewingState, prevMainTabRef, setShowHistory, isNoteSaved, setActiveBrewingStep, setActiveTab, hasCoffeeBeans]);

    // 修改步骤点击的包装函数
    const handleBrewingStepClickWrapper = (step: BrewingStep) => {
        setTransitionState({ isTransitioning: true, source: 'navigation-click' });

        // 调用原始处理函数
        handleBrewingStepClick(step);

        // 使用setTimeout重置状态，延长到350ms确保动画完成
        setTimeout(() => setTransitionState({ isTransitioning: false, source: '' }), 350);
    };

    // 修改方法选择的包装函数
    const handleMethodSelectWrapper = async (index: number) => {
        setTransitionState({ isTransitioning: true, source: 'content-click' });

        await handleMethodSelect(index);
        // 使用setTimeout重置状态，延长到350ms确保动画完成
        setTimeout(() => setTransitionState({ isTransitioning: false, source: '' }), 350);
    };

    // 处理冲煮完成后自动切换到笔记页面
    useEffect(() => {
        if (showComplete && activeMainTab === '冲煮' && activeBrewingStep === 'brewing') {
            // 添加延迟，等待音效播放完成
            const timer = setTimeout(() => {
                setActiveBrewingStep('notes');
                setActiveTab('记录');
            }, 1000); // 延迟1秒，确保音效和触感反馈都完成

            return () => clearTimeout(timer);
        }
    }, [showComplete, activeMainTab, activeBrewingStep, setActiveBrewingStep, setActiveTab]);

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
        } catch {
            // 静默处理错误
        }
    }

    // 处理引导完成
    const handleOnboardingComplete = () => {
        setShowOnboarding(false)
    }

    // 处理咖啡豆表单
    const handleBeanForm = (bean: CoffeeBean | null = null) => {
        setEditingBean(bean);
        setShowBeanForm(true);
    };

    // 完全重写checkCoffeeBeans函数，简化逻辑
    const checkCoffeeBeans = useCallback(async () => {
        try {
            const beans = await CoffeeBeanManager.getAllBeans();
            const hasAnyBeans = beans.length > 0;
            const wasHasBeans = hasCoffeeBeans;
            setHasCoffeeBeans(hasAnyBeans);

            // 只在冲煮页面且咖啡豆状态变化时调整步骤
            if (activeMainTab === '冲煮') {
                // 咖啡豆从有到无：切换到器具步骤
                if (!hasAnyBeans && wasHasBeans && activeBrewingStep === 'coffeeBean') {
                    setActiveBrewingStep('equipment');
                    setActiveTab('器具');
                }
                // 咖啡豆从无到有：切换到咖啡豆步骤
                else if (hasAnyBeans && !wasHasBeans) {
                    setActiveBrewingStep('coffeeBean');
                    setActiveTab('咖啡豆');
                }
            }
        } catch {
            // 静默处理错误
            setHasCoffeeBeans(false);
        }
    }, [activeBrewingStep, setActiveBrewingStep, setActiveTab, hasCoffeeBeans, activeMainTab]);

    // 当添加或删除咖啡豆时，更新状态
    const handleBeanListChange = useCallback(() => {
        checkCoffeeBeans();
        // 增加beanListKey以触发重新渲染
        setBeanListKey(prevKey => prevKey + 1);
    }, [checkCoffeeBeans]);

    // 修改咖啡豆列表变化的处理
    useEffect(() => {
        // 监听咖啡豆列表变化的自定义事件
        const handleBeanListChanged = (e: CustomEvent<{ hasBeans: boolean, isFirstBean?: boolean, lastBeanDeleted?: boolean }>) => {
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
                // 立即修正冲煮页面状态，但不切换页面
                if (activeMainTab === '冲煮' && activeBrewingStep === 'coffeeBean') {
                    setActiveBrewingStep('equipment');
                    setActiveTab('器具');
                }
                // 不强制切换到冲煮页面
            }
        };

        // 添加事件监听器
        window.addEventListener('coffeeBeanListChanged', handleBeanListChanged as EventListener);

        // 清理函数
        return () => {
            window.removeEventListener('coffeeBeanListChanged', handleBeanListChanged as EventListener);
        };
    }, [checkCoffeeBeans, activeMainTab, activeBrewingStep, setActiveBrewingStep, setActiveTab]);

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

        // 在每次进入冲煮页面时，检查笔记状态，如果有未保存的笔记，清除标记但不重置状态
        if (activeMainTab === '冲煮' && (brewingNoteInProgress === 'true' || fromNotesToBrewing === 'true')) {
            // 只清除笔记状态标记，完全不改变任何其他状态
            localStorage.setItem('brewingNoteInProgress', 'false');

            // 清除特殊跳转标记
            if (fromNotesToBrewing === 'true') {
                localStorage.removeItem('fromNotesToBrewing');
            }

            // 如果当前在记录页面，只切换回注水页面但不做任何状态重置
            if (activeBrewingStep === 'notes') {
                // 只改变当前步骤，完全保留所有参数
                setActiveBrewingStep('brewing');
                setActiveTab('注水');

                // 关闭笔记表单（如果有）
                const event = new CustomEvent('closeBrewingNoteForm', { detail: { force: true } });
                window.dispatchEvent(event);
            }
        }
    }, [activeMainTab, activeBrewingStep, setActiveBrewingStep, setActiveTab]);

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
                            isPourVisualizerPreloaded={isPourVisualizerPreloaded}
                            selectedEquipment={selectedEquipment}
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
                            onAddNewCoffeeBean={() => handleBeanForm()}
                            onEditMethod={handleEditCustomMethod}
                            onDeleteMethod={handleDeleteCustomMethod}
                            transitionState={transitionState}
                            selectedCoffeeBean={selectedCoffeeBean}
                            selectedCoffeeBeanData={selectedCoffeeBeanData}
                            setActiveMainTab={setActiveMainTab}
                            resetBrewingState={resetBrewingState}
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
                            isOpen={true}
                            onClose={() => setActiveMainTab('冲煮')}
                            showBeanForm={handleBeanForm}
                            key={beanListKey}
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
                            onStatusChange={({ isRunning }) => setIsTimerRunning(isRunning)}
                            onStageChange={({ currentStage }) => {
                                setCurrentStage(currentStage);
                            }}
                            onComplete={(isComplete) => {
                                setShowComplete(isComplete);
                            }}
                            onTimerComplete={() => {
                                // 冲煮完成后的处理，确保显示笔记表单
                                // 这里不需要额外设置，因为BrewingTimer组件内部已经处理了显示笔记表单的逻辑
                            }}
                            onCountdownChange={(time) => setCountdownTime(time)}
                            settings={settings}
                            onJumpToImport={jumpToImport}
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
                onSaveCustomMethod={handleSaveCustomMethod}
                onCloseCustomForm={() => {
                    setShowCustomForm(false);
                    setEditingMethod(undefined);
                }}
                onCloseImportForm={() => setShowImportForm(false)}
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