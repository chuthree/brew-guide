'use client'
// 导入React和必要的hooks
import React, { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { equipmentList, APP_VERSION, commonMethods } from '@/lib/config'
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
import { navigateFromHistoryToBrewing } from '@/lib/brewing/navigation'
import type { BrewingNote } from '@/lib/config'
import type { BrewingNoteData } from '@/app/types'
import { BREWING_EVENTS } from '@/lib/brewing/constants'
import BrewingNoteFormModalNew from '@/components/BrewingNoteFormModalNew'
import ErrorBoundary from '@/components/ErrorBoundary'
import CoffeeBeans from '@/components/CoffeeBeans'
import SwipeBackGesture from '@/components/SwipeBackGesture'

// 为Window对象声明类型扩展
declare global {
    interface Window {
        refreshBrewingNotes?: () => void;
    }
}

// 添加ExtendedCoffeeBean类型
interface BlendComponent {
    percentage: number;  // 百分比 (1-100)
    origin?: string;     // 产地
    process?: string;    // 处理法
    variety?: string;    // 品种
}

interface ExtendedCoffeeBean extends CoffeeBean {
    blendComponents?: BlendComponent[];
}

// 动态导入客户端组件
const BrewingTimer = dynamic(() => import('@/components/BrewingTimer'), { ssr: false, loading: () => null })
const BrewingHistory = dynamic(() => import('@/components/BrewingHistory'), { ssr: false, loading: () => null })

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
    const [editingBean, setEditingBean] = useState<ExtendedCoffeeBean | null>(null);
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

    // 使用自定义Hooks，传入初始步骤
    const initialStep: BrewingStep = initialHasBeans ? 'coffeeBean' : 'equipment';

    // 添加一个状态来跟踪当前阶段是否为等待阶段
    const [isStageWaiting, setIsStageWaiting] = useState(false);

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
                // 0. 自动修复可能存在的数据问题
                try {
                    // 导入数据管理工具
                    const { DataManager } = await import('@/lib/dataManager');
                    // 自动修复拼配豆数据
                    const fixResult = await DataManager.fixBlendBeansData();
                    if (fixResult.fixedCount > 0) {
                        console.log(`自动修复了${fixResult.fixedCount}个存在问题的拼配豆数据`);
                    }
                } catch (error) {
                    console.error('自动修复数据时出错:', error);
                    // 继续初始化，不阻止应用启动
                }

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
        setMethodType(type);
    };

    // 添加一个状态来跟踪冲煮是否完成以及笔记是否进行中
    // 初始化为与showComplete相同的值，确保页面加载时状态一致
    const [isCoffeeBrewed, setIsCoffeeBrewed] = useState(showComplete);

    // 监听冲煮完成和重置事件
    useEffect(() => {
        const handleBrewingComplete = () => {
            // 当冲煮完成时，设置完成状态
            setShowComplete(true);
            setIsCoffeeBrewed(true);
        };

        const handleBrewingReset = () => {
            // 重置自动跳转标志
            setHasAutoNavigatedToNotes(false);
            // 确保showComplete状态被重置
            setShowComplete(false);
            // 重置冲煮状态
            setIsCoffeeBrewed(false);
        };

        const handleMethodToBrewing = () => {
            // 重置冲煮完成状态，但保留其他状态
            setShowComplete(false);
            setIsCoffeeBrewed(false);
        };

        const handleGetParams = () => {
            if (currentBrewingMethod && currentBrewingMethod.params) {
                // 发送参数更新事件，包含最新的参数数据
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

                // 当计时器状态变为非运行时，确保清除倒计时状态
                if (!e.detail.isRunning) {
                    setCountdownTime(null);
                }
            }
        };

        const handleStageChange = (e: CustomEvent) => {
            // 处理stage/currentStage属性
            if (typeof e.detail?.stage === 'number') {
                setCurrentStage(e.detail.stage);
            } else if (typeof e.detail?.currentStage === 'number') {
                setCurrentStage(e.detail.currentStage);
            }

            // 检查并更新等待状态
            if (typeof e.detail?.isWaiting === 'boolean') {
                setIsStageWaiting(e.detail.isWaiting);
            }
        };

        const handleCountdownChange = (e: CustomEvent) => {
            if ('remainingTime' in e.detail) {
                // 使用 setTimeout 包装状态更新，避免在渲染期间更新状态
                setTimeout(() => {
                    // 直接设置倒计时状态，无需复杂逻辑
                    setCountdownTime(e.detail.remainingTime);

                    // 倒计时期间将 currentStage 设为 -1
                    if (e.detail.remainingTime !== null) {
                        setCurrentStage(-1);
                    }
                }, 0);
            }
        };

        // 添加事件监听
        window.addEventListener('brewing:complete', handleBrewingComplete);
        window.addEventListener('brewing:reset', handleBrewingReset);
        window.addEventListener('brewing:methodToBrewing', handleMethodToBrewing);
        window.addEventListener('brewing:getParams', handleGetParams);
        window.addEventListener('brewing:timerStatus', handleTimerStatusChange as EventListener);
        window.addEventListener('brewing:stageChange', handleStageChange as EventListener);
        window.addEventListener('brewing:countdownChange', handleCountdownChange as EventListener);

        // 清理函数
        return () => {
            window.removeEventListener('brewing:complete', handleBrewingComplete);
            window.removeEventListener('brewing:reset', handleBrewingReset);
            window.removeEventListener('brewing:methodToBrewing', handleMethodToBrewing);
            window.removeEventListener('brewing:getParams', handleGetParams);
            window.removeEventListener('brewing:timerStatus', handleTimerStatusChange as EventListener);
            window.removeEventListener('brewing:stageChange', handleStageChange as EventListener);
            window.removeEventListener('brewing:countdownChange', handleCountdownChange as EventListener);
        };
    }, [setShowComplete, setIsCoffeeBrewed, setHasAutoNavigatedToNotes, setIsTimerRunning, setCurrentStage, setCountdownTime, setIsStageWaiting, currentBrewingMethod, selectedCoffeeBeanData]);

    // 修改处理步骤点击的包装函数，允许在冲煮完成后切换到记录
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
    };

    // 修改方法选择的包装函数
    const handleMethodSelectWrapper = useCallback(async (index: number) => {
        // 检查是否在冲煮完成状态选择了新的方案
        if (isCoffeeBrewed) {
            // 确保isCoffeeBrewed状态被重置，允许正常的步骤导航
            setIsCoffeeBrewed(false);
        }

        await handleMethodSelect(index);
    }, [handleMethodSelect, isCoffeeBrewed, setIsCoffeeBrewed]);

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

    // 处理主标签切换
    const handleMainTabClick = (tab: MainTabType) => {
        // 如果点击的是当前激活的主标签，不执行任何操作
        if (tab === activeMainTab) {
            return;
        }

        // 更新主标签
        setActiveMainTab(tab);
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
            let lastImportedBean: ExtendedCoffeeBean | null = null;
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

                // 处理拼配成分，确保百分比是数字类型
                if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
                    // 定义拼配成分接口
                    interface BlendComponentInput {
                        percentage?: string | number;
                        origin?: string;
                        process?: string;
                        variety?: string;
                        [key: string]: unknown;
                    }
                    
                    // 先验证拼配成分的格式是否正确
                    const validComponents = bean.blendComponents.filter((comp: BlendComponentInput) => 
                        comp && (typeof comp === 'object') && 
                        (comp.percentage !== undefined) &&
                        (comp.origin !== undefined || comp.process !== undefined || comp.variety !== undefined)
                    );
                    
                    if (validComponents.length > 0) {
                        bean.blendComponents = validComponents.map((comp: { percentage: string | number }) => ({
                            ...comp,
                            percentage: typeof comp.percentage === 'string' ?
                                parseInt(comp.percentage, 10) : comp.percentage
                        }));
                    } else if (bean.type === '拼配') {
                        console.warn('拼配豆数据格式不正确，重置拼配成分');
                        // 如果是拼配豆但没有有效的拼配成分，创建一个默认成分
                        bean.blendComponents = [{
                            percentage: 100,
                            origin: bean.origin || '',
                            process: bean.process || '',
                            variety: bean.variety || ''
                        }];
                    } else {
                        // 非拼配豆，移除无效的拼配成分
                        delete bean.blendComponents;
                    }
                }

                // 添加到数据库
                const newBean = await CoffeeBeanManager.addBean(bean);
                lastImportedBean = newBean;
                importCount++;
            }

            if (importCount === 0) {
                throw new Error('没有导入任何有效咖啡豆数据');
            }

            // 关闭导入表单
            setShowImportBeanForm(false);

            // 更新咖啡豆状态
            handleBeanListChange();

            // 切换到咖啡豆标签页，跳过过渡动画
            handleMainTabClick('咖啡豆');

            // 如果只导入了一个咖啡豆，直接打开编辑表单
            if (importCount === 1 && lastImportedBean) {
                // 短暂延迟以确保UI更新
                setTimeout(() => {
                    setEditingBean(lastImportedBean);
                    setShowBeanForm(true);
                }, 300);
            }
        } catch (error) {
            console.error('导入失败:', error);
            alert('导入失败: ' + (error instanceof Error ? error.message : '请检查数据格式'));
        }
    };

    // 处理咖啡豆表单
    const handleBeanForm = (bean: ExtendedCoffeeBean | null = null) => {
        setEditingBean(bean);
        setShowBeanForm(true);
    };

    // 处理AI方案生成
    const handleGenerateAIRecipe = (bean: ExtendedCoffeeBean) => {
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
    const handleSaveBean = async (bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>) => {
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
    const handleEquipmentSelectWithName = useCallback((equipmentName: string) => {
        const equipment = equipmentList.find(e => e.name === equipmentName)?.id || equipmentName;

        // 更新parameterInfo，添加设备信息
        setParameterInfo({
            equipment: equipmentName,
            method: null,
            params: null
        });

        handleEquipmentSelect(equipment);
    }, [handleEquipmentSelect, setParameterInfo]);

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

    // 监听从历史记录直接导航的事件
    useEffect(() => {
        // 注册事件监听
        const handleMainTabNavigation = (e: CustomEvent) => {
            const { tab } = e.detail;
            if (tab) {
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

        const handleCoffeeBeanSelection = (e: CustomEvent) => {
            const { beanName } = e.detail;
            if (beanName) {
                // 查找匹配的咖啡豆并选择它
                CoffeeBeanManager.getBeanByName(beanName).then(bean => {
                    if (bean) {
                        handleCoffeeBeanSelect(bean.id, bean);
                    }
                });
            }
        };

        const handleEquipmentSelection = (e: CustomEvent) => {
            const { equipmentName } = e.detail;
            if (equipmentName) {
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
                    handleMethodSelectWrapper(methodIndex);
                }
            }
        };

        const handleParamsUpdate = (e: CustomEvent) => {
            // 注意: 暂未实现参数更新逻辑，保留此函数以匹配事件监听需要
            const { params } = e.detail;
            if (params) {
                // 将在未来实现
                console.log("参数更新请求", params);
            }
        };

        // 添加事件监听
        document.addEventListener(BREWING_EVENTS.NAVIGATE_TO_MAIN_TAB, handleMainTabNavigation as EventListener);
        document.addEventListener(BREWING_EVENTS.NAVIGATE_TO_STEP, handleStepNavigation as EventListener);
        document.addEventListener(BREWING_EVENTS.SELECT_COFFEE_BEAN, handleCoffeeBeanSelection as EventListener);
        document.addEventListener(BREWING_EVENTS.SELECT_EQUIPMENT, handleEquipmentSelection as EventListener);
        document.addEventListener(BREWING_EVENTS.SELECT_METHOD, handleMethodSelection as EventListener);
        document.addEventListener(BREWING_EVENTS.UPDATE_BREWING_PARAMS, handleParamsUpdate as EventListener);

        return () => {
            // 移除事件监听
            document.removeEventListener(BREWING_EVENTS.NAVIGATE_TO_MAIN_TAB, handleMainTabNavigation as EventListener);
            document.removeEventListener(BREWING_EVENTS.NAVIGATE_TO_STEP, handleStepNavigation as EventListener);
            document.removeEventListener(BREWING_EVENTS.SELECT_COFFEE_BEAN, handleCoffeeBeanSelection as EventListener);
            document.removeEventListener(BREWING_EVENTS.SELECT_EQUIPMENT, handleEquipmentSelection as EventListener);
            document.removeEventListener(BREWING_EVENTS.SELECT_METHOD, handleMethodSelection as EventListener);
            document.removeEventListener(BREWING_EVENTS.UPDATE_BREWING_PARAMS, handleParamsUpdate as EventListener);
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
        setActiveTab
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

            // 确保已经加载了所有必要的数据后，再次导航到注水步骤
            if (selectedEquipment && (selectedMethod || currentBrewingMethod)) {
                // 延迟一点时间确保UI和数据都已准备好
                setTimeout(() => {
                    // 确保是在注水步骤
                    if (activeBrewingStep !== 'brewing') {
                        console.log("强制导航到注水步骤");
                        navigateToStep('brewing', {
                            force: true,
                            resetParams: false,
                            preserveStates: ["all"],
                        });
                    }

                    // 确保处于注水标签
                    if (activeTab !== '注水') {
                        console.log("强制切换到注水标签");
                        setActiveTab('注水');
                    }

                    // 双重保险：再次检查并强制状态
                    setTimeout(() => {
                        if (activeBrewingStep !== 'brewing' || activeTab !== '注水') {
                            console.log("第二次强制导航到注水步骤");
                            navigateToStep('brewing', {
                                force: true,
                                resetParams: false,
                                preserveStates: ["all"],
                            });
                            setActiveTab('注水');
                        }
                    }, 500);
                }, 800);
            } else {
                console.log("无法导航到注水步骤，缺少必要数据", {
                    selectedEquipment,
                    selectedMethod,
                    currentBrewingMethod
                });
            }
        }
    }, [
        activeMainTab,
        selectedEquipment,
        selectedMethod,
        currentBrewingMethod,
        activeBrewingStep,
        activeTab,
        navigateToStep,
        setActiveTab
    ]);

    // 添加从历史记录跳转到冲煮的处理函数
    const handleNavigateFromHistory = useCallback((note: BrewingNote) => {
        // 传递当前是否在笔记标签页
        navigateFromHistoryToBrewing(note, activeMainTab === '笔记');
    }, [activeMainTab]);

    // 添加检查强制导航标记的逻辑
    useEffect(() => {
        // 检查是否有强制导航到冲煮页面的标记
        const forceNavigate = localStorage.getItem('forceNavigateToBrewing');
        const navigationStep = localStorage.getItem('navigationStep') || 'start';

        if (forceNavigate === 'true') {
            console.log("检测到强制导航标记，当前步骤:", navigationStep, {
                activeMainTab,
                activeBrewingStep,
                selectedEquipment,
                selectedMethod,
                currentBrewingMethod
            });

            switch (navigationStep) {
                case 'start':
                    // 第一步：切换到冲煮标签页
                    setActiveMainTab('冲煮');
                    localStorage.setItem('navigationStep', 'selectEquipment');
                    break;

                case 'selectEquipment':
                    // 第二步：选择设备（只有当成功切换到冲煮标签页后）
                    if (activeMainTab === '冲煮') {
                        const equipment = localStorage.getItem('forceNavigationEquipment');
                        if (equipment) {
                            console.log("选择设备:", equipment);
                            handleEquipmentSelectWithName(equipment);
                            localStorage.setItem('navigationStep', 'selectMethod');
                        } else {
                            // 如果没有设备信息，跳过这一步
                            localStorage.setItem('navigationStep', 'selectMethod');
                        }
                    }
                    break;

                case 'selectMethod':
                    // 第三步：选择方案（只有当设备已选择）
                    if (selectedEquipment) {
                        const method = localStorage.getItem('forceNavigationMethod');
                        // 获取方案类型（默认为common）
                        const forceMethodType = localStorage.getItem('forceNavigationMethodType') || 'common';

                        console.log("方案选择过程:", {
                            method,
                            forceMethodType,
                            currentMethodType: methodType,
                            hasCustomMethods: customMethods[selectedEquipment]?.length > 0,
                            customMethodsCount: customMethods[selectedEquipment]?.length || 0
                        });

                        if (method) {
                            // 根据方案类型选择不同的方案列表
                            console.log("尝试选择方案:", method, "类型:", forceMethodType);

                            // 定义回退到通用方案的函数
                            const fallbackToCommonMethod = () => {
                                // 如果是通用方案，或者自定义方案未找到，尝试在通用方案中查找
                                const allMethods = commonMethods[selectedEquipment] || [];
                                console.log("可用通用方案:", allMethods.map(m => m.name));

                                // 查找精确匹配的方案
                                const methodIndex = allMethods.findIndex(m => m.name === method);

                                if (methodIndex !== -1) {
                                    // 如果找到通用方案，切换回通用方案模式
                                    setMethodType('common');
                                    console.log("找到通用方案，索引:", methodIndex, "名称:", allMethods[methodIndex].name);

                                    // 确保类型切换生效后再选择方案
                                    setTimeout(() => {
                                        handleMethodSelectWrapper(methodIndex);
                                        localStorage.setItem('navigationStep', 'navigateToBrewing');
                                    }, 100);
                                } else {
                                    // 如果通用方案中也没找到，直接进入注水步骤
                                    console.log("通用方案中也没找到匹配项，直接进入注水步骤");
                                    localStorage.setItem('navigationStep', 'navigateToBrewing');
                                }
                            };

                            if (forceMethodType === 'custom') {
                                // 如果是自定义方案，先切换到自定义方案模式
                                setMethodType('custom');
                                console.log("已切换到自定义方案模式");

                                // 确保方案类型应用后再执行方案选择
                                setTimeout(() => {
                                    // 查找匹配的自定义方案
                                    if (customMethods[selectedEquipment] && customMethods[selectedEquipment].length > 0) {
                                        const customMethodIndex = customMethods[selectedEquipment].findIndex(m =>
                                            m.name === method
                                        );

                                        if (customMethodIndex !== -1) {
                                            console.log("找到自定义方案，索引:", customMethodIndex, "名称:", customMethods[selectedEquipment][customMethodIndex].name);
                                            handleMethodSelectWrapper(customMethodIndex);
                                            localStorage.setItem('navigationStep', 'navigateToBrewing');
                                        } else {
                                            console.log("未找到匹配的自定义方案，尝试回退到通用方案");
                                            console.log("可用自定义方案:", customMethods[selectedEquipment].map(m => m.name));

                                            // 未找到自定义方案时，回退到通用方案
                                            fallbackToCommonMethod();
                                        }
                                    } else {
                                        console.log("该设备下没有自定义方案，尝试回退到通用方案");
                                        fallbackToCommonMethod();
                                    }
                                }, 100);
                            }
                            // 仅在是通用方案时才直接检查通用方案
                            else if (forceMethodType === 'common') {
                                fallbackToCommonMethod();
                            }
                        }
                    } else {
                        console.log("设备未选择，无法选择方案");
                        localStorage.setItem('navigationStep', 'navigateToBrewing');
                    }
                    break;

                case 'navigateToBrewing':
                    // 第四步：导航到注水步骤（只有当方案已选择）
                    if (selectedEquipment && (selectedMethod || currentBrewingMethod)) {
                        console.log("准备导航到注水步骤");
                        // 导航到注水步骤
                        navigateToStep('brewing', {
                            force: true,
                            resetParams: false,
                            preserveStates: ["all"],
                        });

                        // 确保处于注水标签
                        setActiveTab('注水');

                        // 导航完成，清除标记
                        localStorage.removeItem('forceNavigateToBrewing');
                        localStorage.removeItem('navigationStep');
                        localStorage.removeItem('forceNavigationEquipment');
                        localStorage.removeItem('forceNavigationMethod');
                        localStorage.removeItem('forceNavigationParams');

                        console.log("导航完成");
                    } else {
                        console.log("方案未正确加载，无法导航到注水步骤");
                        // 清除标记，避免循环
                        localStorage.removeItem('forceNavigateToBrewing');
                        localStorage.removeItem('navigationStep');
                        localStorage.removeItem('forceNavigationEquipment');
                        localStorage.removeItem('forceNavigationMethod');
                        localStorage.removeItem('forceNavigationParams');
                    }
                    break;

                default:
                    // 未知状态，清除标记
                    localStorage.removeItem('forceNavigateToBrewing');
                    localStorage.removeItem('navigationStep');
                    localStorage.removeItem('forceNavigationEquipment');
                    localStorage.removeItem('forceNavigationMethod');
                    localStorage.removeItem('forceNavigationParams');
                    break;
            }
        }
    }, [
        activeMainTab,
        activeBrewingStep,
        selectedEquipment,
        selectedMethod,
        currentBrewingMethod,
        handleEquipmentSelectWithName,
        handleMethodSelectWrapper,
        navigateToStep,
        setActiveMainTab,
        setActiveTab,
        customMethods,
        setMethodType,
        methodType
    ]);

    // 添加冲煮笔记表单状态
    const [showNoteFormModal, setShowNoteFormModal] = useState(false)
    const [currentEditingNote, setCurrentEditingNote] = useState<Partial<BrewingNoteData>>({})

    // 添加处理函数
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
    };

    // 处理保存冲煮笔记
    const handleSaveBrewingNote = async (note: BrewingNoteData) => {
        try {
            // 获取现有笔记
            const existingNotesStr = await Storage.get('brewingNotes');
            const existingNotes = existingNotesStr ? JSON.parse(existingNotesStr) : [];

            let updatedNotes;
            const newNoteId = note.id || Date.now().toString();
            
            // 检查是否是真正的现有笔记（有ID并且在现有笔记中能找到）
            const isExistingNote = note.id && existingNotes.some((n: BrewingNoteData) => n.id === note.id);
            
            if (isExistingNote) {
                // 更新现有笔记
                updatedNotes = existingNotes.map((n: BrewingNoteData) =>
                    n.id === note.id ? note : n
                );
            } else {
                // 添加新笔记 - 使用笔记自带的ID或生成新ID
                const newNote = {
                    ...note,
                    id: newNoteId,
                    timestamp: note.timestamp || Date.now()
                };
                
                updatedNotes = [newNote, ...existingNotes];
            }
            
            // 使用localStorage和Storage API保存
            localStorage.setItem('brewingNotes', JSON.stringify(updatedNotes));
            await Storage.set('brewingNotes', JSON.stringify(updatedNotes));
            
            // 触发自定义事件通知
            const dataChangeEvent = new CustomEvent('storage:changed', { 
                detail: { key: 'brewingNotes', id: newNoteId } 
            });
            window.dispatchEvent(dataChangeEvent);
            
            // 如果window上有刷新方法，调用它
            if (window.refreshBrewingNotes) {
                setTimeout(() => window.refreshBrewingNotes?.(), 50);
            }

            // 关闭表单
            setShowNoteFormModal(false);
            setCurrentEditingNote({});
            
            // 切换到笔记选项卡
            setActiveMainTab('笔记');
        } catch (error) {
            console.error('保存冲煮笔记失败:', error);
            alert('保存失败，请重试');
        }
    };

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
            {activeMainTab === '冲煮' && (
                <div
                    className="h-full overflow-y-auto space-y-5 p-6"
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
                        setActiveMainTab={setActiveMainTab}
                        resetBrewingState={resetBrewingState}
                        expandedStages={expandedStagesRef.current}
                    />
                </div>
            )}
            {activeMainTab === '笔记' && (
                <div className="flex-1 overflow-auto">
                    <BrewingHistory
                        isOpen={true}
                        onClose={() => {
                            setActiveMainTab('冲煮');
                            setShowHistory(false);
                        }}
                        onOptimizingChange={setIsOptimizing}
                        onNavigateToBrewing={handleNavigateFromHistory}
                        onAddNote={handleAddNote}
                    />
                </div>
            )}
            {activeMainTab === '咖啡豆' && (
                <ErrorBoundary>
                    <CoffeeBeans
                        key={beanListKey}
                        isOpen={activeMainTab === '咖啡豆'}
                        showBeanForm={handleBeanForm}
                        onShowImport={() => setShowImportBeanForm(true)}
                        onGenerateAIRecipe={handleGenerateAIRecipe}
                    />
                </ErrorBoundary>
            )}

            {/* 底部工具栏 - 根据当前状态显示不同内容 */}
            <div>
                {/* 方案类型选择器 */}
                {activeMainTab === '冲煮' && activeBrewingStep === 'method' && selectedEquipment && (
                    <MethodTypeSelector
                        methodType={methodType}
                        settings={settings}
                        onSelectMethodType={handleMethodTypeChange}
                    />
                )}

                {/* 计时器 */}
                {activeMainTab === '冲煮' && activeBrewingStep === 'brewing' && currentBrewingMethod && !showHistory && (
                    <BrewingTimer
                        currentBrewingMethod={currentBrewingMethod}
                        onStatusChange={({ isRunning }) => {
                            // 使用事件而不是直接更新状态
                            const event = new CustomEvent('brewing:timerStatus', {
                                detail: {
                                    isRunning,
                                    status: isRunning ? 'running' : 'stopped'
                                }
                            });
                            window.dispatchEvent(event);
                        }}
                        onStageChange={({ currentStage, progress, isWaiting }) => {
                            // 使用事件而不是直接更新状态
                            const event = new CustomEvent('brewing:stageChange', {
                                detail: {
                                    currentStage,
                                    stage: currentStage, // 兼容旧的处理方式
                                    progress,
                                    isWaiting
                                }
                            });
                            window.dispatchEvent(event);
                        }}
                        onCountdownChange={(time) => {
                            // 避免直接调用事件分发，改用 setTimeout
                            setTimeout(() => {
                                const event = new CustomEvent('brewing:countdownChange', {
                                    detail: { remainingTime: time }
                                });
                                window.dispatchEvent(event);
                            }, 0);
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
                        selectedEquipment={selectedEquipment}
                        isCoffeeBrewed={isCoffeeBrewed}
                        layoutSettings={settings.layoutSettings}
                    />
                )}

                {/* 添加滑动返回手势组件 */}
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
            </div>

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
            />

            {/* 冲煮笔记表单模态框组件 */}
            <BrewingNoteFormModalNew
                key="note-form-modal"
                showForm={showNoteFormModal}
                initialNote={currentEditingNote}
                onSave={handleSaveBrewingNote}
                onClose={() => {
                    setShowNoteFormModal(false);
                    setCurrentEditingNote({});
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