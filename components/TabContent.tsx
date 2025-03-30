import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { Method, equipmentList } from '@/lib/config';
import StageItem from '@/components/StageItem';
import { SettingsOptions } from './Settings';
import { TabType, MainTabType, Content, Step } from '@/lib/hooks/useBrewingState';
import { CoffeeBean } from '@/app/types';
import type { BrewingNoteData } from '@/app/types';
import { CoffeeBeanManager } from '@/lib/coffeeBeanManager';

// 添加TransitionState接口
interface TransitionState {
    isTransitioning: boolean;
    source: string;
}

// 动态导入客户端组件
const PourVisualizer = dynamic(() => import('@/components/PourVisualizer'), {
    ssr: false,
    loading: () => null
});

// 使用新的 CoffeeBeanList 组件替换 CoffeeBeanSelector
const CoffeeBeanList = dynamic(() => import('@/components/CoffeeBeanList'), {
    ssr: false,
    loading: () => null
});

// 动态导入笔记表单组件
const BrewingNoteForm = dynamic(() => import('@/components/BrewingNoteForm'), {
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
    isPourVisualizerPreloaded: boolean;
    selectedEquipment: string | null;
    selectedCoffeeBean?: string | null;
    selectedCoffeeBeanData?: CoffeeBean | null;  // 添加咖啡豆数据
    countdownTime: number | null;
    methodType: 'common' | 'custom';
    customMethods: Record<string, Method[]>;
    actionMenuStates: Record<string, boolean>;
    setActionMenuStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    showCustomForm: boolean;
    setShowCustomForm: (show: boolean) => void;
    showImportForm: boolean;
    setShowImportForm: (show: boolean) => void;
    settings: SettingsOptions;
    onEquipmentSelect: (name: string) => void;
    onMethodSelect: (index: number) => void;
    onCoffeeBeanSelect?: (beanId: string, bean: CoffeeBean) => void;
    onEditMethod: (method: Method) => void;
    onDeleteMethod: (method: Method) => void;
    transitionState: TransitionState;
    setActiveMainTab?: (tab: MainTabType) => void;  // 添加切换主标签页的函数
    resetBrewingState?: (shouldReset: boolean) => void;  // 添加重置brewing状态的函数
    expandedStages?: {
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
    }[];
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
    isPourVisualizerPreloaded,
    selectedEquipment,
    selectedCoffeeBean,
    selectedCoffeeBeanData,  // 获取咖啡豆数据
    countdownTime,
    methodType,
    customMethods,
    actionMenuStates,
    setActionMenuStates,
    showCustomForm,
    setShowCustomForm,
    showImportForm,
    setShowImportForm,
    settings,
    onEquipmentSelect,
    onMethodSelect,
    onCoffeeBeanSelect,
    onEditMethod,
    onDeleteMethod,
    transitionState,
    setActiveMainTab,  // 获取切换主标签页的函数
    resetBrewingState,  // 获取重置brewing状态的函数
    expandedStages
}) => {
    // 笔记表单状态
    const [noteSaved, setNoteSaved] = React.useState(false);

    // 处理保存笔记
    const handleSaveNote = async (note: BrewingNoteData) => {
        try {
            // 从Storage获取现有笔记
            const Storage = (await import('@/lib/storage')).Storage;
            const existingNotesStr = await Storage.get('brewingNotes');
            const existingNotes = existingNotesStr ? JSON.parse(existingNotesStr) : [];

            // 创建新笔记
            const newNote = {
                ...note,
                id: Date.now().toString(),
                timestamp: Date.now(),
            };

            // 将新笔记添加到列表开头
            const updatedNotes = [newNote, ...existingNotes];

            // 存储更新后的笔记列表
            await Storage.set('brewingNotes', JSON.stringify(updatedNotes));

            setNoteSaved(true);

            // 根据咖啡粉量减少咖啡豆的剩余量
            if (selectedCoffeeBean && currentBrewingMethod?.params.coffee) {
                try {
                    const coffeeAmount = parseFloat(currentBrewingMethod.params.coffee);
                    if (!isNaN(coffeeAmount) && coffeeAmount > 0) {
                        await CoffeeBeanManager.updateBeanRemaining(selectedCoffeeBean, coffeeAmount);
                    }
                } catch {
                    // 静默处理错误
                }
            }

            // 成功保存后，跳转到笔记列表并重置brewing状态
            if (setActiveMainTab) {
                setActiveMainTab('笔记');
            }

            // 重置brewing状态，并确保重置后定位到咖啡豆步骤
            if (resetBrewingState) {
                resetBrewingState(false); // 完全重置状态
                // 在localStorage中设置标记，下次进入冲煮页面时从咖啡豆步骤开始
                localStorage.setItem('shouldStartFromCoffeeBeanStep', 'true');
            }

            // 移除成功提示
        } catch {
            alert('保存失败，请重试');
        }
    };

    // 处理关闭笔记表单
    const handleCloseNoteForm = () => {
        if (noteSaved && setActiveMainTab) {
            // 如果已经保存过笔记，跳转到笔记列表并重置brewing状态
            setActiveMainTab('笔记');

            // 重置brewing状态，并确保重置后定位到咖啡豆步骤
            if (resetBrewingState) {
                resetBrewingState(false); // 完全重置状态
                // 在localStorage中设置标记，下次进入冲煮页面时从咖啡豆步骤开始
                localStorage.setItem('shouldStartFromCoffeeBeanStep', 'true');
            }
        } else {
            // 如果没有保存笔记，只设置标记，不做任何其他操作
            localStorage.setItem('brewingNoteInProgress', 'false');

            // 不调用任何重置函数，不清除任何状态
            // 页面的切换由NavigationBar中的点击处理
        }
    };

    // 使用这些变量以避免"未使用变量"的警告
    React.useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            const unusedVars = { showCustomForm, showImportForm, settings, isPourVisualizerPreloaded };
            // 这是为了解决 ESLint 警告，实际上不会执行
            void unusedVars;
        }
    }, [showCustomForm, showImportForm, settings, isPourVisualizerPreloaded]);

    // 如果不是在冲煮主Tab，显示占位内容
    if (activeMainTab !== '冲煮') {
        return null; // 直接返回null，让父组件处理显示内容
    }

    // 显示当前标签页内容
    return (
        <div className="relative h-full px-6 py-6">
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={`content-${activeTab}`}
                    initial={transitionState.source === 'main-tab-click'
                        ? { opacity: 0, y: 10 }
                        : transitionState.source === 'method-type-change'
                            ? { opacity: 0, y: 5 }
                            : { opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={transitionState.source === 'main-tab-click'
                        ? { opacity: 0, y: 5 }
                        : transitionState.source === 'method-type-change'
                            ? { opacity: 0, y: -5 }
                            : { opacity: 0, y: -5 }}
                    transition={{
                        duration: 0.3,
                        ease: "easeOut"
                    }}
                    className="relative h-full"
                >
                    {/* 添加咖啡豆步骤 */}
                    {activeTab === ('咖啡豆' as TabType) ? (
                        <CoffeeBeanList
                            onSelect={(beanId: string | null, bean: CoffeeBean | null) => {
                                if (onCoffeeBeanSelect) onCoffeeBeanSelect(beanId!, bean!);
                            }}
                        />
                    ) : activeTab === ('记录' as TabType) && currentBrewingMethod ? (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className='brewing-form h-full'
                        >
                            <BrewingNoteForm
                                id="brewingNoteForm"
                                isOpen={true}
                                onClose={handleCloseNoteForm}
                                onSave={handleSaveNote}
                                initialData={{
                                    equipment: selectedEquipment ? equipmentList.find(e => e.id === selectedEquipment)?.name || selectedEquipment : '',
                                    method: currentBrewingMethod.name,
                                    params: currentBrewingMethod.params,
                                    totalTime: showComplete ? currentBrewingMethod.params.stages[currentBrewingMethod.params.stages.length - 1].time : 0,
                                    coffeeBean: selectedCoffeeBeanData || undefined
                                }}
                            />
                        </motion.div>
                    ) : isTimerRunning && !showComplete && currentBrewingMethod ? (
                        <div className="flex items-center justify-center w-full h-full">
                            <div className="w-full max-w-[300px]">
                                <PourVisualizer
                                    isRunning={isTimerRunning && countdownTime === null}
                                    currentStage={countdownTime !== null ? -1 : currentStage}
                                    stages={expandedStages || []}
                                    countdownTime={countdownTime}
                                    equipmentId={selectedEquipment || 'V60'}
                                    isWaiting={countdownTime !== null ? true : isWaiting}
                                    key={countdownTime !== null ?
                                        'countdown' : // 倒计时阶段
                                        `pour-${currentStage}-${isTimerRunning}`} // 注水阶段
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {activeTab === '方案' ? (
                                <div className="space-y-5 pb-6">
                                    <AnimatePresence mode="wait" initial={false}>
                                        <motion.div
                                            key={`method-type-${methodType}`}
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -5 }}
                                            transition={{
                                                duration: 0.3,
                                                ease: "easeOut"
                                            }}
                                            className="space-y-5"
                                        >
                                            {methodType === 'custom' && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -5 }}
                                                    transition={{ duration: 0.3, ease: "easeOut" }}
                                                    className="flex space-x-2 mb-4"
                                                >
                                                    <motion.button
                                                        onClick={() => setShowCustomForm(true)}
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        className="flex-1 flex items-center justify-center py-3 border border-dashed border-neutral-300 rounded-md text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400 transition-colors"
                                                    >
                                                        <span className="mr-1">+</span> 新建方案
                                                    </motion.button>
                                                    <motion.button
                                                        onClick={() => setShowImportForm(true)}
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        className="flex-1 flex items-center justify-center py-3 border border-dashed border-neutral-300 rounded-md text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400 transition-colors"
                                                    >
                                                        <span className="mr-1">↓</span> 导入方案
                                                    </motion.button>
                                                </motion.div>
                                            )}

                                            <div className="space-y-5">
                                                {content[activeTab]?.steps.map((step: Step, index: number) => (
                                                    <motion.div
                                                        key={step.methodId || `${step.title}-${index}`}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: 5 }}
                                                        transition={{
                                                            duration: 0.3,
                                                            delay: index * 0.03,
                                                            ease: "easeOut"
                                                        }}
                                                    >
                                                        <StageItem
                                                            step={step}
                                                            index={index}
                                                            onClick={() => {
                                                                if (activeTab === '器具' as TabType) {
                                                                    onEquipmentSelect(step.title);
                                                                } else if (activeTab === '方案' as TabType) {
                                                                    onMethodSelect(index);
                                                                }
                                                            }}
                                                            activeTab={activeTab}
                                                            selectedMethod={selectedMethod}
                                                            currentStage={currentStage}
                                                            onEdit={activeTab === '方案' as TabType && methodType === 'custom' && customMethods[selectedEquipment!] ? () => {
                                                                const method = customMethods[selectedEquipment!][index];
                                                                onEditMethod(method);
                                                            } : undefined}
                                                            onDelete={activeTab === '方案' as TabType && methodType === 'custom' && customMethods[selectedEquipment!] ? () => {
                                                                const method = customMethods[selectedEquipment!][index];
                                                                onDeleteMethod(method);
                                                            } : undefined}
                                                            actionMenuStates={actionMenuStates}
                                                            setActionMenuStates={setActionMenuStates}
                                                            selectedEquipment={selectedEquipment}
                                                            customMethods={customMethods}
                                                        />
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            ) : (
                                <div className="space-y-5 pb-6">
                                    {content[activeTab]?.steps.map((step: Step, index: number) => (
                                        <motion.div
                                            key={step.methodId || `${step.title}-${index}`}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 5 }}
                                            transition={{
                                                duration: 0.3,
                                                delay: index * 0.03,
                                                ease: "easeOut"
                                            }}
                                        >
                                            <StageItem
                                                step={step}
                                                index={index}
                                                onClick={() => {
                                                    if (activeTab === '器具' as TabType) {
                                                        onEquipmentSelect(step.title);
                                                    } else if (activeTab === '方案' as TabType) {
                                                        onMethodSelect(index);
                                                    }
                                                }}
                                                activeTab={activeTab}
                                                selectedMethod={selectedMethod}
                                                currentStage={currentStage}
                                                onEdit={activeTab === '方案' as TabType && methodType === 'custom' && customMethods[selectedEquipment!] ? () => {
                                                    const method = customMethods[selectedEquipment!][index];
                                                    onEditMethod(method);
                                                } : undefined}
                                                onDelete={activeTab === '方案' as TabType && methodType === 'custom' && customMethods[selectedEquipment!] ? () => {
                                                    const method = customMethods[selectedEquipment!][index];
                                                    onDeleteMethod(method);
                                                } : undefined}
                                                actionMenuStates={actionMenuStates}
                                                setActionMenuStates={setActionMenuStates}
                                                selectedEquipment={selectedEquipment}
                                                customMethods={customMethods}
                                            />
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default TabContent; 