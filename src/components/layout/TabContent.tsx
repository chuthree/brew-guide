import React, { useCallback, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Method, equipmentList, CustomEquipment, commonMethods, createEditableMethodFromCommon } from '@/lib/core/config';
import StageItem from '@/components/Brewing/stages/StageItem';
import StageDivider from '@/components/Brewing/stages/StageDivider';
import { SettingsOptions } from '../settings/Settings';
import { TabType, MainTabType, Content, Step as BaseStep } from '@/lib/hooks/useBrewingState';
import { CoffeeBean } from '@/types/app';
import type { BrewingNoteData } from '@/types/app';
import { CoffeeBeanManager } from '@/lib/managers/coffeeBeanManager';
import { v4 as _uuidv4 } from 'uuid';
import { showToast } from "@/components/common/feedback/GlobalToast";
import EquipmentShareModal from '@/components/equipment/share/EquipmentShareModal';
import { getEquipmentName } from '@/lib/brewing/parameters';
import BottomActionBar from '@/components/layout/BottomActionBar';
import CoffeeBeanList from '@/components/coffee-bean/List/ListView';
import MethodShareModal from '@/components/method/share/MethodShareModal';
import { saveCustomMethod } from '@/lib/managers/customMethods';

// 扩展Step类型，增加固定方案所需的字段
interface Step extends BaseStep {
    customParams?: Record<string, string | number | boolean>;
    icon?: string;
    isPinned?: boolean;
}

// 动态导入客户端组件
const PourVisualizer = dynamic(() => import('@/components/Brewing/PourVisualizer'), {
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
    setShowEquipmentImportForm,
}) => {
    // 笔记表单状态
    const [noteSaved, setNoteSaved] = React.useState(false);

    const [_showNoteForm, _setShowNoteForm] = React.useState(false);
    const [_noteFormData, _setNoteFormData] = React.useState<Partial<BrewingNoteData> | null>(null);
    
    // 添加本地流速显示设置状态
    const [localShowFlowRate, setLocalShowFlowRate] = React.useState(settings.showFlowRate);
    
    // 监听流速设置变化
    React.useEffect(() => {
        // 从props更新本地状态
        setLocalShowFlowRate(settings.showFlowRate);
        
        // 监听计时器组件发出的设置变更事件
        const handleSettingsChange = (e: CustomEvent<{showFlowRate?: boolean}>) => {
            if (e.detail && e.detail.showFlowRate !== undefined) {
                setLocalShowFlowRate(e.detail.showFlowRate);
            }
        };
        
        window.addEventListener('brewing:settingsChange', handleSettingsChange as EventListener);
        
        return () => {
            window.removeEventListener('brewing:settingsChange', handleSettingsChange as EventListener);
        };
    }, [settings.showFlowRate]);

    // 获取器具名称的函数
    const _getEquipmentDisplayName = (equipmentId: string): string => {
        // 先在预设器具中查找
        const predefinedEquipment = equipmentList.find(e => e.id === equipmentId);
        if (predefinedEquipment) return predefinedEquipment.name;

        // 再在自定义器具中查找
        const customEquipment = customEquipments.find(e => e.id === equipmentId);
        if (customEquipment) return customEquipment.name;

        return '未知器具';
    };

    // 处理方案类型切换
    const handleMethodTypeChange = (type: 'common' | 'custom') => {
        if (settings?.hapticFeedback) {
            (async () => {
                const hapticsUtils = await import('@/lib/ui/haptics');
                hapticsUtils.default.light(); 
            })();
        }
        
        // 触发方案类型变更
        const event = new CustomEvent('methodTypeChange', { detail: type });
        window.dispatchEvent(event);
        
        // 存储当前方案类型
        localStorage.setItem('methodType', type);
    };

    // 处理保存笔记
    const handleSaveNote = async (note: BrewingNoteData) => {
        try {
            // 从Storage获取现有笔记
            const Storage = (await import('@/lib/core/storage')).Storage;
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
            return equipmentById;
        }

        // 如果ID匹配失败，尝试通过名称匹配
        const equipmentByName = customEquipments.find(e => e.name === selectedEquipment);
        if (equipmentByName?.animationType) {
            return equipmentByName;
        }

        // 未找到匹配的自定义器具
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

    // 添加新的状态
    const [showMethodShareModal, setShowMethodShareModal] = useState(false);
    const [sharingMethod, setSharingMethod] = useState<Method | null>(null);

    // 处理分享方案
    const handleShareMethod = async (method: Method) => {
        try {
            // 设置要分享的方案并显示分享模态框
            setSharingMethod(method);
            setShowMethodShareModal(true);
        } catch (_error) {
            showToast({
                type: 'error',
                title: '准备分享失败，请重试',
                duration: 2000
            });
        }
    };

    // 获取设备名称的辅助函数
    const getEquipmentNameForNote = async (equipmentId: string): Promise<string> => {
        // 首先尝试在标准设备列表中查找
        const standardEquipment = equipmentList.find(e => e.id === equipmentId);
        if (standardEquipment) return standardEquipment.name;

        // 如果没找到，加载自定义设备列表并查找
        try {
            const { loadCustomEquipments } = await import('@/lib/managers/customEquipments');
            const customEquipments = await loadCustomEquipments();

            // 使用工具函数获取设备名称
            const equipmentName = getEquipmentName(equipmentId, equipmentList, customEquipments);
            return equipmentName || equipmentId;
        } catch (error) {
            console.error('加载自定义设备失败:', error);
            return equipmentId; // 出错时返回原始ID
        }
    };

    // 分享器具相关状态
    const [showShareModal, setShowShareModal] = useState(false);
    const [sharingEquipment, setSharingEquipment] = useState<CustomEquipment | null>(null);
    const [sharingMethods, setSharingMethods] = useState<Method[]>([]);

    // 笔记表单包装组件，用于异步加载设备名称
    const NoteFormWrapper = () => {
        const [equipmentName, setEquipmentName] = useState<string>('');

        // 在组件挂载时加载设备名称
        useEffect(() => {
            const loadEquipmentName = async () => {
                if (selectedEquipment) {
                    const name = await getEquipmentNameForNote(selectedEquipment);
                    setEquipmentName(name);
                }
            };

            loadEquipmentName();
        }, [selectedEquipment]);

        return (
            <BrewingNoteForm
                id="brewingNoteForm"
                isOpen={true}
                onClose={handleCloseNoteForm}
                onSave={handleSaveNote}
                inBrewPage={true}
                initialData={{
                    equipment: equipmentName || (selectedEquipment || ''),
                    method: currentBrewingMethod!.name,
                    params: currentBrewingMethod!.params,
                    totalTime: showComplete ? currentBrewingMethod!.params.stages[currentBrewingMethod!.params.stages.length - 1].time : 0,
                    coffeeBean: selectedCoffeeBeanData || undefined
                }}
            />
        );
    };

    // 处理分享器具
    const handleShareEquipment = async (equipment: CustomEquipment) => {
        try {
            // 获取器具对应的自定义方案（不包含通用方案）
            let methods: Method[] = [];
            if (equipment.id) {
                // 如果器具有ID，尝试从 customMethods 中获取对应的方案
                methods = customMethods[equipment.id] || [];
            }

            // 如果没有找到方案，尝试使用器具名称查找
            if (methods.length === 0 && equipment.name) {
                methods = customMethods[equipment.name] || [];
            }

            // 注意：不再添加通用方案，因为通用方案是根据器具类型预设的
            // 用户导入器具后，会根据器具类型自动获得对应的通用方案

            // 设置要分享的器具和方案
            setSharingEquipment(equipment);
            setSharingMethods(methods);
            setShowShareModal(true);
        } catch (_error) {
            showToast({
                type: 'error',
                title: '准备分享失败，请重试',
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
                <NoteFormWrapper />

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
                    {/* 列表内容容器，添加适当的底部padding */}
                    <div className="space-y-4 content-area">
                        {/* 常规方案列表 */}
                        {activeTab === '方案' as TabType && methodType === 'custom' && 
                         selectedEquipment && (!customMethods[selectedEquipment] || customMethods[selectedEquipment].length === 0) ? (
                            <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                [ 当前器具暂无自定义方案，请点击下方按钮添加 ]
                            </div>
                        ) : (
                            content[activeTab]?.steps.map((step: Step, index: number) => {
                                // 如果是注水标签，检查originalIndex变化来添加阶段分隔线
                                const showStageDivider = activeTab === '注水' as TabType && 
                                    index > 0 && 
                                    step.originalIndex !== undefined && 
                                    content[activeTab]?.steps[index-1]?.originalIndex !== undefined &&
                                    step.originalIndex !== content[activeTab]?.steps[index-1]?.originalIndex &&
                                    (settings?.layoutSettings?.showStageDivider !== false); // 根据设置决定是否显示分隔线

                                return (
                                <React.Fragment key={step.methodId ? `${step.methodId}-${index}` : `${step.title}-${index}`}>
                                    {/* 在注水标签页中，检测originalIndex变化添加分隔线 */}
                                    {showStageDivider && (
                                        <StageDivider stageNumber={step.originalIndex! + 1} key={`divider-${index}`} />
                                    )}
                                    <StageItem
                                        step={step}
                                        index={index}
                                        onClick={() => {
                                            if (activeTab === '器具' as TabType) {
                                                onEquipmentSelect(step.title);
                                            } else if (activeTab === '方案' as TabType) {
                                                // 传递完整的 step 对象给 onMethodSelect 方法
                                                onMethodSelect(index, step);
                                            }
                                        }}
                                        activeTab={activeTab}
                                        selectedMethod={selectedMethod}
                                        currentStage={currentStage}
                                        onEdit={activeTab === '方案' as TabType ? 
                                            methodType === 'custom' && customMethods[selectedEquipment!] ? 
                                                () => {
                                                    const method = customMethods[selectedEquipment!][index];
                                                    onEditMethod(method);
                                                } 
                                            : methodType === 'common' && selectedEquipment ? 
                                                () => {
                                                    // 当编辑通用方案时，创建一个副本并添加到自定义方案列表
                                                    const commonMethodsList = commonMethods[selectedEquipment];
                                                    if (commonMethodsList && commonMethodsList[index]) {
                                                        const methodCopy = createEditableMethodFromCommon(commonMethodsList[index]);
                                                        // 将副本添加到自定义方案列表
                                                        saveCustomMethod(selectedEquipment, methodCopy)
                                                            .then(() => {
                                                                // 添加成功后切换到自定义方案列表并开始编辑
                                                                handleMethodTypeChange('custom');
                                                                // 延迟一下，确保自定义方案列表已更新
                                                                setTimeout(() => {
                                                                    onEditMethod(methodCopy);
                                                                }, 100);
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
                                            : undefined
                                        : step.isCustom ? 
                                            () => {
                                                const equipment = customEquipments.find(e => e.name === step.title);
                                                if (equipment) {
                                                    setEditingEquipment(equipment);
                                                    setShowEquipmentForm(true);
                                                }
                                            } 
                                        : undefined}
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
                                            // 对于方案列表，无论是通用方案还是自定义方案都可以分享
                                            if (methodType === 'custom' && customMethods[selectedEquipment!]) {
                                                const method = customMethods[selectedEquipment!][index];
                                                handleShareMethod(method);
                                            } else if (methodType === 'common' && selectedEquipment) {
                                                const commonMethodsList = commonMethods[selectedEquipment];
                                                if (commonMethodsList && commonMethodsList[index]) {
                                                    handleShareMethod(commonMethodsList[index]);
                                                }
                                            }
                                        } : step.isCustom ? () => {
                                            const equipment = customEquipments.find(e => e.name === step.title);
                                            if (equipment) {
                                                handleShareEquipment(equipment);
                                            }
                                        } : undefined}
                                        actionMenuStates={actionMenuStates}
                                        setActionMenuStates={setActionMenuStates}
                                        showFlowRate={localShowFlowRate}
                                        allSteps={content[activeTab]?.steps || []}
                                    />
                                </React.Fragment>
                                );
                            })
                        )}
                    </div>

                    {/* 方案标签底部操作栏 - 特殊布局 */}
                    {activeTab === '方案' && (
                        <BottomActionBar
                            buttons={[
                                // 方案类型选择按钮
                                { 
                                    text: '通用方案',
                                    onClick: () => handleMethodTypeChange('common'),
                                    active: methodType === 'common',
                                    highlight: true,
                                    id: 'common'
                                },
                                { 
                                    text: '自定义方案',
                                    onClick: () => handleMethodTypeChange('custom'),
                                    active: methodType === 'custom',
                                    highlight: true,
                                    id: 'custom'
                                },
                                
                                // 创建方案按钮（始终显示，但在非自定义方案模式下半透明且不可点击）
                                {
                                    icon: '+',
                                    text: '新建方案',
                                    onClick: methodType === 'custom' ? () => setShowCustomForm(true) : () => {},
                                    highlight: methodType === 'custom',
                                    className: methodType !== 'custom' ? 'opacity-30 pointer-events-none' : '',
                                    id: 'new'
                                },
                                // 导入方案按钮（始终显示，但在非自定义方案模式下半透明且不可点击）
                                {
                                    icon: '↓',
                                    text: '导入方案',
                                    onClick: methodType === 'custom' ? () => setShowImportForm(true) : () => {},
                                    highlight: methodType === 'custom',
                                    className: methodType !== 'custom' ? 'opacity-30 pointer-events-none' : '',
                                    id: 'import'
                                }
                            ]}
                            customPresetMode={customEquipments.find(e => e.id === selectedEquipment)?.animationType === 'custom'}
                        />
                    )}

                    {/* 添加器具按钮 */}
                    {activeTab === '器具' && (
                        <BottomActionBar
                            buttons={[
                                {
                                    icon: '+',
                                    text: '添加器具',
                                    onClick: () => setShowEquipmentForm(true),
                                    highlight: true
                                },
                                {
                                    icon: '↓',
                                    text: '导入器具',
                                    onClick: () => setShowEquipmentImportForm(true),
                                    highlight: true
                                }
                            ]}
                        />
                    )}
                </>
            )}
            {/* 器具分享模态框 */}
            {sharingEquipment && (
                <EquipmentShareModal
                    isOpen={showShareModal}
                    onClose={() => setShowShareModal(false)}
                    equipment={sharingEquipment}
                    methods={sharingMethods}
                />
            )}
            {/* 方案分享模态框 */}
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