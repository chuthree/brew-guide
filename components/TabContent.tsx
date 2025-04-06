import React, { useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Method, equipmentList, CustomEquipment, commonMethods } from '@/lib/config';
import StageItem from '@/components/StageItem';
import { SettingsOptions } from './Settings';
import { TabType, MainTabType, Content, Step } from '@/lib/hooks/useBrewingState';
import { CoffeeBean } from '@/app/types';
import type { BrewingNoteData } from '@/app/types';
import { CoffeeBeanManager } from '@/lib/coffeeBeanManager';
import { v4 as _uuidv4 } from 'uuid';
import { copyMethodToClipboard } from "@/lib/customMethods";
import { showToast } from "@/components/ui/toast";

// 动态导入客户端组件
const PourVisualizer = dynamic(() => import('@/components/PourVisualizer'), {
    ssr: false,
    loading: () => null
});

// 动态导入CoffeeBeanList组件
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
    selectedCoffeeBeanData?: CoffeeBean | null;
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
    onMethodSelect: (index: number, step?: Step) => void;
    onCoffeeBeanSelect?: (beanId: string, bean: CoffeeBean) => void;
    onEditMethod: (method: Method) => void;
    onDeleteMethod: (method: Method) => void;
    setActiveMainTab?: (tab: MainTabType) => void;
    resetBrewingState?: (shouldReset: boolean) => void;
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
    customEquipments: CustomEquipment[];
    setCustomEquipments: React.Dispatch<React.SetStateAction<CustomEquipment[]>>;
    setShowEquipmentForm: (show: boolean) => void;
    setEditingEquipment: (equipment: CustomEquipment | undefined) => void;
    handleSaveEquipment: (equipment: CustomEquipment) => Promise<void>;
    handleDeleteEquipment: (equipment: CustomEquipment) => Promise<void>;
    _onShareMethod?: (method: Method) => void;
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
    selectedCoffeeBeanData,
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
    setActiveMainTab,
    resetBrewingState,
    expandedStages,
    customEquipments,
    setCustomEquipments: _setCustomEquipments,
    setShowEquipmentForm,
    setEditingEquipment,
    handleSaveEquipment: _handleSaveEquipment,
    handleDeleteEquipment,
    _onShareMethod,
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

    // 获取当前选中的自定义器具
    const getSelectedCustomEquipment = useCallback(() => {
        if (!selectedEquipment) return undefined;
        
        // 首先尝试通过ID匹配
        const equipmentById = customEquipments.find(e => e.id === selectedEquipment);
        if (equipmentById?.animationType) {
            console.log('找到自定义器具(通过ID):', {
                id: equipmentById.id,
                name: equipmentById.name,
                animationType: equipmentById.animationType,
                hasCustomShape: Boolean(equipmentById.customShapeSvg),
                svgLength: equipmentById.customShapeSvg?.length || 0
            });
            return equipmentById;
        }
        
        // 如果ID匹配失败，尝试通过名称匹配
        const equipmentByName = customEquipments.find(e => e.name === selectedEquipment);
        if (equipmentByName?.animationType) {
            console.log('找到自定义器具(通过名称):', {
                id: equipmentByName.id,
                name: equipmentByName.name,
                animationType: equipmentByName.animationType,
                hasCustomShape: Boolean(equipmentByName.customShapeSvg),
                svgLength: equipmentByName.customShapeSvg?.length || 0
            });
            return equipmentByName;
        }
        
        // 未找到匹配的自定义器具
        console.log('未找到匹配的自定义器具:', {
            selectedEquipment,
            customEquipmentsCount: customEquipments.length
        });
        return undefined;
    }, [selectedEquipment, customEquipments]);

    // 使用这些变量以避免"未使用变量"的警告
    React.useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            const unusedVars = { showCustomForm, showImportForm, settings, isPourVisualizerPreloaded };
            // 这是为了解决 ESLint 警告，实际上不会执行
            void unusedVars;
        }
    }, [showCustomForm, showImportForm, settings, isPourVisualizerPreloaded]);

    // 处理分享方案
    const handleShareMethod = async (method: Method) => {
        try {
            await copyMethodToClipboard(method);
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

    // 如果不是在冲煮主Tab，显示占位内容
    if (activeMainTab !== '冲煮') {
        return null; // 直接返回null，让父组件处理显示内容
    }

    // 显示当前标签页内容
    return (
        <>
            {/* 添加咖啡豆步骤 */}
            {activeTab === ('咖啡豆' as TabType) ? (
                <CoffeeBeanList
                    onSelect={(beanId: string | null, bean: CoffeeBean | null) => {
                        if (onCoffeeBeanSelect) onCoffeeBeanSelect(beanId!, bean!);
                    }}
                />
            ) : activeTab === ('记录' as TabType) && currentBrewingMethod ? (
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
            ) : isTimerRunning && !showComplete && currentBrewingMethod ? (
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
                            key={countdownTime !== null ?
                                'countdown' : // 倒计时阶段
                                `pour-${currentStage}-${isTimerRunning}`} // 注水阶段
                        />
                    </div>
                </div>
            ) : (
                <>
                    {/* 添加器具按钮 */}
                    {activeTab === '器具' && (
                        <div className="flex space-x-2 mb-4">
                            <button
                                onClick={() => setShowEquipmentForm(true)}
                                className="flex-1 flex items-center justify-center py-3 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-md text-xs text-neutral-800 dark:text-white transition-colors hover:opacity-80"
                            >
                                <span className="mr-1">+</span> 添加器具
                            </button>
                        </div>
                    )}

                    {activeTab === '方案' && methodType === 'custom' && (
                        <div className="flex space-x-2">
                            <button
                                onClick={() => setShowCustomForm(true)}
                                className="flex-1 flex items-center justify-center py-3 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-md text-xs text-neutral-800 dark:text-white transition-colors hover:opacity-80"
                            >
                                <span className="mr-1">+</span> 新建方案
                            </button>
                            <button
                                onClick={() => setShowImportForm(true)}
                                className="flex-1 flex items-center justify-center py-3 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-md text-xs text-neutral-800 dark:text-white transition-colors hover:opacity-80"
                            >
                                <span className="mr-1">↓</span> 导入方案
                            </button>
                        </div>
                    )}

                    {content[activeTab]?.steps.map((step: Step, index: number) => (
                        <StageItem
                            key={step.methodId ? `${step.methodId}-${index}` : `${step.title}-${index}`}
                            step={step}
                            index={index}
                            onClick={() => {
                                if (activeTab === '器具' as TabType) {
                                    onEquipmentSelect(step.title);
                                } else if (activeTab === '方案' as TabType) {
                                    console.log('方案点击:', {
                                        title: step.title,
                                        index,
                                        methodType,
                                        selectedEquipment,
                                        isCustom: step.isCustom,
                                        isCommonMethod: step.isCommonMethod,
                                        methodIndex: step.methodIndex,
                                        fullStep: step  // 添加完整的 step 对象
                                    });
                                    // 传递完整的 step 对象给 onMethodSelect 方法
                                    onMethodSelect(index, step);
                                }
                            }}
                            activeTab={activeTab}
                            selectedMethod={selectedMethod}
                            currentStage={currentStage}
                            onEdit={activeTab === '方案' as TabType && methodType === 'custom' && customMethods[selectedEquipment!] ? () => {
                                const method = customMethods[selectedEquipment!][index];
                                onEditMethod(method);
                            } : step.isCustom ? () => {
                                const equipment = customEquipments.find(e => e.name === step.title);
                                if (equipment) {
                                    setEditingEquipment(equipment);
                                    setShowEquipmentForm(true);
                                }
                            } : undefined}
                            onDelete={activeTab === '方案' as TabType && methodType === 'custom' && customMethods[selectedEquipment!] ? () => {
                                const method = customMethods[selectedEquipment!][index];
                                onDeleteMethod(method);
                            } : step.isCustom ? () => {
                                const equipment = customEquipments.find(e => e.name === step.title);
                                if (equipment) {
                                    handleDeleteEquipment(equipment);
                                }
                            } : undefined}
                            onShare={activeTab === '方案' as TabType ? () => {
                                if (methodType === 'custom' && customMethods[selectedEquipment!]) {
                                    const method = customMethods[selectedEquipment!][index];
                                    handleShareMethod(method);
                                } else if (methodType === 'common' && selectedEquipment) {
                                    const method = commonMethods[selectedEquipment];
                                    if (method && method[index]) {
                                        handleShareMethod(method[index]);
                                    }
                                }
                            } : undefined}
                            actionMenuStates={actionMenuStates}
                            setActionMenuStates={setActionMenuStates}
                        />
                    ))}
                </>
            )}
        </>
    );
};

export default TabContent; 