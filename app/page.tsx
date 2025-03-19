'use client'
import React, { useState, useEffect } from 'react'
import { motion as m, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { equipmentList, APP_VERSION } from '@/lib/config'
import { Storage } from '@/lib/storage'
import { initCapacitor } from './capacitor'
import type { BrewingNoteData } from '@/app/types'
import { useBrewingState, MainTabType } from '@/lib/hooks/useBrewingState'
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

// 添加内容转换状态类型
interface TransitionState {
    isTransitioning: boolean;
    source: string;
}

// 动态导入客户端组件
const BrewingTimer = dynamic(() => import('@/components/BrewingTimer'), { ssr: false })
const BrewingHistory = dynamic(() => import('@/components/BrewingHistory'), { ssr: false })
const BrewingNoteForm = dynamic(() => import('@/components/BrewingNoteForm'), { ssr: false })

// 手冲咖啡配方页面组件
const PourOverRecipes = () => {
    // 使用设置相关状态
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settings, setSettings] = useState<SettingsOptions>(() => {
        // 使用默认设置作为初始值，稍后在 useEffect 中异步加载
        return defaultSettings;
    });

    // 添加动画过渡状态
    const [transitionState, setTransitionState] = useState<TransitionState>({
        isTransitioning: false,
        source: ''
    });

    // 使用自定义Hooks
    const brewingState = useBrewingState();
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
        currentTime, setCurrentTime,
        methodType, setMethodType,
        countdownTime, setCountdownTime,
        isPourVisualizerPreloaded,
        customMethods, setCustomMethods,
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
        handleSaveNote,
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
        setSelectedMethod,
        setCurrentBrewingMethod,
        setEditableParams,
        setParameterInfo,
        setActiveTab,
        setActiveBrewingStep,
        updateBrewingSteps
    });

    const { handleMethodSelect } = methodSelector;

    // 添加异步加载设置的 useEffect
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const savedSettings = await Storage.get('brewGuideSettings');
                if (savedSettings) {
                    setSettings(JSON.parse(savedSettings) as SettingsOptions);
                }
            } catch (error) {
                console.error('Error loading settings:', error);
            }
        };

        loadSettings();
    }, []);

    // 处理双击标题打开设置
    const handleTitleDoubleClick = () => {
        setIsSettingsOpen(true);
    };

    // 处理参数变更的包装函数，修复any类型问题
    const handleParamChangeWrapper = (type: keyof EditableParams, value: string) => {
        handleParamChange(
            type,
            value,
            selectedMethod,
            currentBrewingMethod,
            updateBrewingSteps,
            setCurrentBrewingMethod
        );
    };

    // 将现有的 activeTab 映射到新的 activeBrewingStep
    useEffect(() => {
        if (activeMainTab === '冲煮') {
            // 从其他标签切换回冲煮标签时，确保关闭历史记录显示
            if (showHistory) {
                setShowHistory(false);
            }

            // 映射旧的 activeTab 到新的 activeBrewingStep
            switch (activeTab) {
                case '器具':
                    setActiveBrewingStep('equipment');
                    break;
                case '方案':
                    setActiveBrewingStep('method');
                    break;
                case '注水':
                    setActiveBrewingStep('brewing');
                    break;
                case '记录':
                    setActiveBrewingStep('notes');
                    break;
                default:
                    break;
            }
        }
    }, [activeTab, activeMainTab, showHistory, activeBrewingStep, setActiveBrewingStep, setShowHistory]);

    // 修改存储初始化部分
    useEffect(() => {
        const initStorage = async () => {
            try {
                // 检查存储版本
                const storageVersion = await Storage.get('brewingNotesVersion');
                const currentVersion = APP_VERSION; // 当前数据版本

                if (!storageVersion) {
                    // 首次使用或旧版本，初始化版本信息
                    await Storage.set('brewingNotesVersion', currentVersion);
                }

                // 确保 brewingNotes 存在且格式正确
                const notes = await Storage.get('brewingNotes');
                if (notes) {
                    try {
                        JSON.parse(notes);
                    } catch {
                        // 如果数据格式错误，初始化为空数组
                        await Storage.set('brewingNotes', '[]');
                    }
                } else {
                    await Storage.set('brewingNotes', '[]');
                }
            } catch (error) {
                console.error('Error initializing storage:', error);
            }
        };

        initStorage();

        // 初始化 Capacitor
        initCapacitor();
    }, []);

    // 在 Settings 组件中添加 onDataChange 属性
    const handleDataChange = async () => {
        // 重新加载设置
        try {
            const savedSettings = await Storage.get('brewGuideSettings');
            if (savedSettings) {
                setSettings(JSON.parse(savedSettings) as SettingsOptions);
            }
        } catch (error) {
            console.error('Error loading settings after data change:', error);
        }

        // 重新加载自定义方案
        try {
            const methods = await import('@/lib/customMethods').then(({ loadCustomMethods }) => {
                return loadCustomMethods();
            });
            setCustomMethods(methods);
        } catch (error) {
            console.error('Error loading custom methods after data change:', error);
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

    // 修改标签切换检测逻辑
    useEffect(() => {
        // 处理标签切换，特别是从笔记切换到冲煮时的情况
        if (activeMainTab === '冲煮') {
            setShowHistory(false);

            // 如果是从笔记页面切换过来的，且笔记已保存，则重置状态
            if (prevMainTabRef.current === '笔记' && isNoteSaved) {
                // 重置状态
                resetBrewingState();
                // 强制切换到器具选择页面
                setActiveBrewingStep('equipment');
                setActiveTab('器具');
                // 重置标志
                setIsNoteSaved(false);
            }
        }

        // 更新前一个标签的引用
        prevMainTabRef.current = activeMainTab;
    }, [activeMainTab, resetBrewingState, prevMainTabRef, setShowHistory, isNoteSaved, setActiveBrewingStep, setActiveTab]);

    // 修改保存笔记的处理函数
    const handleSaveNoteWrapper = async (data: BrewingNoteData) => {
        setIsNoteSaved(true); // 设置保存标志
        await handleSaveNote(data);
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

    // 修改步骤点击的包装函数
    const handleBrewingStepClickWrapper = (step: 'equipment' | 'method' | 'brewing' | 'notes') => {
        setTransitionState({ isTransitioning: true, source: 'navigation-click' });

        // 确保在导航时更新正确的参数信息
        if (step === 'equipment') {
            // 切换到器具步骤时，清空方法和参数信息
            setParameterInfo({
                equipment: null,
                method: null,
                params: null
            });
        } else if (step === 'method' && selectedEquipment) {
            // 切换到方法步骤时，保留器具信息
            const equipmentName = equipmentList.find(e => e.id === selectedEquipment)?.name || selectedEquipment;
            setParameterInfo({
                equipment: equipmentName,
                method: null,
                params: null
            });
        } else if (step === 'brewing' && selectedEquipment && currentBrewingMethod) {
            // 切换到注水步骤时，显示完整参数信息
            const equipmentName = equipmentList.find(e => e.id === selectedEquipment)?.name || selectedEquipment;
            setParameterInfo({
                equipment: equipmentName,
                method: currentBrewingMethod.name,
                params: {
                    coffee: currentBrewingMethod.params.coffee,
                    water: currentBrewingMethod.params.water,
                    ratio: currentBrewingMethod.params.ratio,
                    grindSize: currentBrewingMethod.params.grindSize,
                    temp: currentBrewingMethod.params.temp
                }
            });
            // 如果需要，也可以设置可编辑参数
            setEditableParams({
                coffee: currentBrewingMethod.params.coffee,
                water: currentBrewingMethod.params.water,
                ratio: currentBrewingMethod.params.ratio
            });
        } else if (step === 'notes' && selectedEquipment && currentBrewingMethod) {
            // 切换到记录步骤时，保持完整参数信息
            const equipmentName = equipmentList.find(e => e.id === selectedEquipment)?.name || selectedEquipment;
            setParameterInfo({
                equipment: equipmentName,
                method: currentBrewingMethod.name,
                params: {
                    coffee: currentBrewingMethod.params.coffee,
                    water: currentBrewingMethod.params.water,
                    ratio: currentBrewingMethod.params.ratio,
                    grindSize: currentBrewingMethod.params.grindSize,
                    temp: currentBrewingMethod.params.temp
                }
            });
        }

        handleBrewingStepClick(step);
        // 使用setTimeout重置状态，延长到350ms确保动画完成
        setTimeout(() => setTransitionState({ isTransitioning: false, source: '' }), 350);
    };

    // 修改方法选择的包装函数
    const handleMethodSelectWrapper = (index: number) => {
        setTransitionState({ isTransitioning: true, source: 'content-click' });
        handleMethodSelect(index);
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
            }, 1000); // 延迟1.5秒，确保音效和触感反馈都完成

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

    // 初始化设置
    useEffect(() => {
        const initSettings = async () => {
            try {
                const savedSettings = await Storage.get('brewGuideSettings')
                if (savedSettings) {
                    setSettings(JSON.parse(savedSettings))
                }

                // 检查是否是首次使用
                const onboardingCompleted = await Storage.get('onboardingCompleted')
                setShowOnboarding(!onboardingCompleted)
            } catch (error) {
                console.error('初始化设置失败:', error)
            }
        }

        initSettings()
    }, [])

    // 处理设置变更
    const handleSettingsChange = async (newSettings: SettingsOptions) => {
        try {
            setSettings(newSettings)
            await Storage.set('brewGuideSettings', JSON.stringify(newSettings))
        } catch (error) {
            console.error('保存设置失败:', error)
        }
    }

    // 处理引导完成
    const handleOnboardingComplete = () => {
        setShowOnboarding(false)
    }

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
            />

            {/* 内容区域 - 简化内边距和间距 */}
            <div className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait" initial={false}>
                    {activeMainTab === '笔记' ? (
                        <m.div
                            key="history"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="h-full"
                        >
                            <BrewingHistory
                                isOpen={showHistory}
                                onClose={() => setShowHistory(false)}
                                onOptimizingChange={(isOptimizing) => setIsOptimizing(isOptimizing)}
                                onJumpToImport={jumpToImport}
                            />
                        </m.div>
                    ) : activeTab === '记录' ? (
                        <m.div
                            key="note-form"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className=""
                        >
                            <BrewingNoteForm
                                id="brewingNoteForm"
                                isOpen={true}
                                onClose={() => {
                                    // 用户取消记录，返回到注水页面
                                    setActiveTab('注水');
                                    setActiveBrewingStep('brewing');
                                }}
                                onSave={handleSaveNoteWrapper}
                                initialData={{
                                    equipment: selectedEquipment ? (equipmentList.find(e => e.id === selectedEquipment)?.name || selectedEquipment) : undefined,
                                    method: currentBrewingMethod?.name,
                                    params: currentBrewingMethod?.params,
                                    totalTime: currentTime
                                }}
                                onJumpToImport={jumpToImport}
                            />
                        </m.div>
                    ) : (
                        // 为TabContent添加单独的motion.div包装，确保在主标签切换时有动画效果
                        <m.div
                            key="brew-content"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="h-full"
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
                                onEditMethod={handleEditCustomMethod}
                                onDeleteMethod={handleDeleteCustomMethod}
                                transitionState={transitionState}
                            />
                        </m.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 底部工具栏 - 根据当前状态显示不同内容 */}
            <AnimatePresence mode="wait" initial={false}>
                {/* 方案类型选择器 */}
                {activeMainTab === '冲煮' && activeBrewingStep === 'method' && selectedEquipment && (
                    <m.div
                        key="method-selector"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
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
                        exit={{ opacity: 0, y: 5 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                        <BrewingTimer
                            currentBrewingMethod={currentBrewingMethod}
                            onStatusChange={({ isRunning }) => setIsTimerRunning(isRunning)}
                            onStageChange={({ currentStage }) => {
                                setCurrentStage(currentStage)
                            }}
                            onComplete={(isComplete, totalTime) => {
                                setShowComplete(isComplete)
                                setCurrentTime(totalTime || 0)
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
                    setShowCustomForm(false)
                    setEditingMethod(undefined)
                }}
                onCloseImportForm={() => setShowImportForm(false)}
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
            {showOnboarding && (
                <Onboarding
                    onSettingsChange={handleSettingsChange}
                    onComplete={handleOnboardingComplete}
                />
            )}
        </div>
    )
}

export default PourOverRecipes 