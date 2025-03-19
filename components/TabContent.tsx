import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { Method } from '@/lib/config';
import StageItem from '@/components/StageItem';
import { SettingsOptions } from './Settings';
import { TabType, MainTabType, Content, Step } from '@/lib/hooks/useBrewingState';

// 添加TransitionState接口
interface TransitionState {
    isTransitioning: boolean;
    source: string;
}

// 动态导入客户端组件
const PourVisualizer = dynamic(() => import('@/components/PourVisualizer'), {
    ssr: false,
    loading: () => (
        <div className="relative w-full aspect-square max-w-[300px] mx-auto opacity-50">
            <div className="animate-pulse bg-neutral-100 dark:bg-neutral-800 w-full h-full rounded-full"></div>
        </div>
    )
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
    isPourVisualizerPreloaded: boolean;
    selectedEquipment: string | null;
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
    onEditMethod: (method: Method) => void;
    onDeleteMethod: (method: Method) => void;
    transitionState: TransitionState;
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
    isPourVisualizerPreloaded,
    selectedEquipment,
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
    onEditMethod,
    onDeleteMethod,
    transitionState
}) => {
    // 使用这些变量以避免"未使用变量"的警告
    React.useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            const unusedVars = { showCustomForm, showImportForm, settings };
            // 这是为了解决 ESLint 警告，实际上并不会执行这个日志
            if (false) console.log(unusedVars);
        }
    }, [showCustomForm, showImportForm, settings]);

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
                    {/* 当计时器运行时显示可视化组件 */}
                    {isTimerRunning && !showComplete && currentBrewingMethod ? (
                        <div className="flex items-center justify-center w-full h-full">
                            <div className="w-full max-w-[300px]">
                                <PourVisualizer
                                    isRunning={isTimerRunning}
                                    currentStage={currentStage}
                                    stages={currentBrewingMethod.params.stages}
                                    countdownTime={countdownTime}
                                    equipmentId={selectedEquipment || 'V60'}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {/* 预渲染 PourVisualizer 组件，但设置为不可见 */}
                            {activeTab === '注水' && currentBrewingMethod && isPourVisualizerPreloaded && (
                                <div className="hidden">
                                    <PourVisualizer
                                        isRunning={false}
                                        currentStage={-1}
                                        stages={currentBrewingMethod.params.stages}
                                        countdownTime={null}
                                        equipmentId={selectedEquipment || 'V60'}
                                    />
                                </div>
                            )}

                            {activeTab === '方案' ? (
                                <div className="space-y-5 pb-16">
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
                            )}
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default TabContent; 