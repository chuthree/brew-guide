'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { brewingMethods as commonMethods, equipmentList, brandCoffees, APP_VERSION, type Method, type Stage, type Brand, type CoffeeBean } from '@/lib/config'
import { loadCustomMethods, saveCustomMethod, deleteCustomMethod, copyMethodToClipboard } from '@/lib/customMethods'
import CustomMethodFormModal from '@/components/CustomMethodFormModal'
import NavigationBar from '@/components/NavigationBar'
import Settings, { SettingsOptions, defaultSettings } from '@/components/Settings'
import { initCapacitor } from './capacitor'
import { Storage } from '@/lib/storage'

// 动态导入客户端组件
const BrewingTimer = dynamic(() => import('@/components/BrewingTimer'), { ssr: false })
const BrewingHistory = dynamic(() => import('@/components/BrewingHistory'), { ssr: false })
const BrewingNoteForm = dynamic(() => import('@/components/BrewingNoteForm'), { ssr: false })
const PourVisualizer = dynamic(() => import('@/components/PourVisualizer'), {
    ssr: false,
    loading: () => (
        <div className="relative w-full aspect-square max-w-[300px] mx-auto opacity-50">
            <div className="animate-pulse bg-neutral-100 dark:bg-neutral-800 w-full h-full rounded-full"></div>
        </div>
    )
})

// 定义标签类型
type TabType = '器具' | '方案' | '注水' | '记录';

// 添加新的主导航类型
type MainTabType = '冲煮' | '咖啡豆' | '笔记';
// 修改冲煮步骤类型
type BrewingStep = 'coffeeBean' | 'equipment' | 'method' | 'brewing' | 'notes';

interface Step {
    title: string
    items: string[]
    note: string
    methodId?: string
}

interface Content {
    器具: {
        steps: Step[]
    }
    方案: {
        steps: Step[]
        type: 'common' | 'brand' | 'custom'
        selectedBrand?: Brand | null
    }
    注水: {
        steps: Step[]
    }
    记录: {
        steps: Step[]
    }
}

const initialContent: Content = {
    器具: {
        steps: equipmentList.map(equipment => ({
            title: equipment.name,
            items: equipment.description,
            note: equipment.note || '',
        })),
    },
    方案: {
        steps: [],
        type: 'common'
    },
    注水: {
        steps: [],
    },
    记录: {
        steps: [],
    },
}

// 更新formatTime函数,支持更简洁的时间显示
const formatTime = (seconds: number, compact: boolean = false) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60

    if (compact) {
        // 简洁模式: 1'20" 或 45"
        return mins > 0
            ? `${mins}'${secs.toString().padStart(2, '0')}"`
            : `${secs}"`
    }
    // 完整模式: 1:20 (用于主计时器显示)
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Add new interface for parameter display
interface ParameterInfo {
    equipment: string | null
    method: string | null
    params: {
        coffee?: string
        water?: string
        ratio?: string
        grindSize?: string
        temp?: string
    } | null
}

// Add new interfaces for parameter editing
interface EditableParams {
    coffee: string
    water: string
    ratio: string
}

// Update the extractNumber function to handle ratio specifically
const extractNumber = (str: string) => {
    const match = str.match(/[\d.]+/)
    return match ? parseFloat(match[0]) : 0
}

// Add a function to extract ratio number
const extractRatioNumber = (ratioStr: string) => {
    // Remove "1:" prefix and extract the number
    const match = ratioStr.match(/1:(\d+\.?\d*)/)
    return match ? parseFloat(match[1]) : 0
}

// Add a helper function for ratio formatting
const formatRatio = (ratio: number) => {
    return Number.isInteger(ratio) ? ratio.toString() : ratio.toFixed(1)
}

// 修改 StageItem 组件
const StageItem = ({
    step,
    index,
    onClick,
    activeTab,
    selectedMethod,
    currentStage,
    onEdit,
    onDelete,
    actionMenuStates,
    setActionMenuStates,
    selectedEquipment,
    customMethods,
}: {
    step: Step
    index: number
    onClick: () => void
    activeTab: string
    selectedMethod: Method | null
    currentStage: number
    onEdit?: () => void
    onDelete?: () => void
    actionMenuStates: Record<string, boolean>
    setActionMenuStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
    selectedEquipment?: string | null
    customMethods?: Record<string, Method[]>
}) => {
    // 创建一个唯一的ID来标识这个卡片
    const cardId = `${activeTab}-${step.methodId || step.title}-${index}`
    // 检查这个卡片的菜单是否应该显示
    const showActions = actionMenuStates[cardId] || false
    // 添加复制成功状态
    const [copySuccess, setCopySuccess] = useState(false)

    // 处理分享方法
    const handleShare = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        if (onEdit && activeTab === ('方案' as TabType) && selectedEquipment && customMethods && customMethods[selectedEquipment]) {
            try {
                const method = customMethods[selectedEquipment][index]
                copyMethodToClipboard(method)
                    .then(() => {
                        setCopySuccess(true)
                        setTimeout(() => setCopySuccess(false), 2000)
                    })
                    .catch(err => {
                        console.error('复制失败:', err)
                        alert('复制失败，请手动复制')
                    })
            } catch (err) {
                console.error('复制失败:', err)
            }
        }
    }, [onEdit, activeTab, index, selectedEquipment, customMethods])

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.26, delay: 0.05 }}
            className={`group relative border-l border-neutral-200 pl-6 dark:border-neutral-800 ${activeTab === '注水' && index === currentStage
                ? 'text-neutral-800 dark:text-neutral-100'
                : activeTab === '注水' && index < currentStage
                    ? 'text-neutral-400 dark:text-neutral-500'
                    : 'text-neutral-500 dark:text-neutral-400'
                }`}
        >
            {activeTab === '注水' && index === currentStage && (
                <motion.div
                    className="absolute -left-px top-0 h-full w-px bg-neutral-800 dark:bg-neutral-100"
                    initial={{ scaleY: 0, transformOrigin: "top" }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.26, ease: 'linear' }}
                />
            )}
            <div className={activeTab !== '注水' ? 'cursor-pointer' : ''} onClick={onClick}>
                <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-3 min-w-0 overflow-hidden">
                        <h3 className="text-xs font-normal tracking-wider truncate">
                            {step.title}
                        </h3>
                        {activeTab === '注水' && selectedMethod && (
                            <div className="flex items-baseline gap-2 text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0">
                                <span>{formatTime(selectedMethod.params.stages[index].time, true)}</span>
                                <span>·</span>
                                <span>{step.items[0]}</span>
                            </div>
                        )}
                    </div>
                    {onEdit && onDelete && (
                        <div className="flex items-baseline ml-2 shrink-0">
                            <AnimatePresence mode="wait">
                                {showActions ? (
                                    <motion.div
                                        key="action-buttons"
                                        initial={{ opacity: 0, scale: 0.9, x: 10 }}
                                        animate={{ opacity: 1, scale: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, x: 10 }}
                                        transition={{ duration: 0.26 }}
                                        className="flex items-baseline space-x-3"
                                    >
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onEdit()
                                            }}
                                            className="px-2  text-xs text-neutral-400  dark:text-neutral-500"
                                        >
                                            编辑
                                        </button>
                                        <button
                                            onClick={handleShare}
                                            className="px-2  text-xs text-blue-400 dark:text-blue-500 relative"
                                        >
                                            {copySuccess ? '已复制' : '分享'}
                                            {copySuccess && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -10 }}
                                                    className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-neutral-800 dark:bg-neutral-700 text-white px-2 py-1 rounded text-[10px] whitespace-nowrap"
                                                >
                                                    已复制到剪贴板
                                                </motion.div>
                                            )}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onDelete()
                                            }}
                                            className="px-2 text-xs text-red-400"
                                        >
                                            删除
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                // 更新全局状态对象，关闭当前卡片的菜单
                                                setActionMenuStates(prev => ({
                                                    ...prev,
                                                    [cardId]: false
                                                }))
                                            }}
                                            className="w-7 h-7 flex items-center justify-center rounded-full text-sm text-neutral-400"
                                        >
                                            ×
                                        </button>
                                    </motion.div>
                                ) : (
                                    <motion.button
                                        key="more-button"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ duration: 0.26 }}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            // 更新全局状态对象，打开当前卡片的菜单
                                            setActionMenuStates(prev => ({
                                                ...prev,
                                                [cardId]: true
                                            }))
                                        }}
                                        className="w-7 h-7 flex items-center justify-center text-xs text-neutral-400 dark:text-neutral-500"
                                    >
                                        ···
                                    </motion.button>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
                <div className="mt-2">
                    {activeTab === '注水' ? (
                        <p className="text-xs font-light">{step.items[1]}</p>
                    ) : (
                        <ul className="space-y-1">
                            {step.items.map((item: string, i: number) => (
                                <li key={i} className="text-xs font-light">
                                    {item}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </motion.div>
    )
}

// 修改 BrewingNoteData 接口，避免使用 any
export interface BrewingNoteData {
    id: string;
    timestamp: number;
    equipment?: string;
    method?: string;
    params?: {
        coffee: string;
        water: string;
        ratio: string;
        grindSize: string;
        temp: string;
    };
    stages?: Stage[];
    totalTime?: number;
    coffeeBeanInfo: {
        name: string;
        roastLevel: string;
        roastDate?: string;
    };
    rating: number;
    taste: {
        acidity: number;
        sweetness: number;
        bitterness: number;
        body: number;
    };
    notes: string;
    [key: string]: unknown; // 使用 unknown 代替 any
}

// 手冲咖啡配方页面组件
const PourOverRecipes = () => {
    // 添加主导航状态
    const [activeMainTab, setActiveMainTab] = useState<MainTabType>('冲煮');
    // 修改冲煮步骤状态
    const [activeBrewingStep, setActiveBrewingStep] = useState<BrewingStep>('equipment');

    const [activeTab, setActiveTab] = useState<TabType>('器具')
    const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null)
    const [selectedMethod, setSelectedMethod] = useState<Method | null>(null)
    const [content, setContent] = useState<Content>(initialContent)
    const [parameterInfo, setParameterInfo] = useState<ParameterInfo>({
        equipment: null,
        method: null,
        params: null,
    })
    const [editableParams, setEditableParams] = useState<EditableParams | null>(null)
    const [currentBrewingMethod, setCurrentBrewingMethod] = useState<Method | null>(null)
    const [isTimerRunning, setIsTimerRunning] = useState(false)
    const [currentStage, setCurrentStage] = useState(-1)
    const [showHistory, setShowHistory] = useState(false)
    const [showComplete, setShowComplete] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [methodType, setMethodType] = useState<'common' | 'brand' | 'custom'>('common')
    const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
    const [selectedBean, setSelectedBean] = useState<CoffeeBean | null>(null)
    const [countdownTime, setCountdownTime] = useState<number | null>(null)
    const [isPourVisualizerPreloaded, setIsPourVisualizerPreloaded] = useState(false)
    const [customMethods, setCustomMethods] = useState<Record<string, Method[]>>({})
    const [showCustomForm, setShowCustomForm] = useState(false)
    const [editingMethod, setEditingMethod] = useState<Method | undefined>(undefined)
    // 添加一个新的状态来跟踪每个卡片的菜单状态
    const [actionMenuStates, setActionMenuStates] = useState<Record<string, boolean>>({})
    // 添加导入方案表单状态
    const [showImportForm, setShowImportForm] = useState(false)

    // 添加设置相关状态
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settings, setSettings] = useState<SettingsOptions>(() => {
        // 使用默认设置作为初始值，稍后在 useEffect 中异步加载
        return defaultSettings;
    });

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
    }, [activeTab, activeMainTab, showHistory]);

    // 处理主导航标签切换
    useEffect(() => {
        // 当切换到不同的主导航标签时，更新UI状态
        if (activeMainTab === '咖啡豆') {
            // 切换到咖啡豆标签时，保留当前的冲煮设置，但不显示参数信息条
            // 不需要额外操作，因为参数信息条已经通过条件渲染控制只在冲煮标签显示
        } else if (activeMainTab === '笔记') {
            // 切换到笔记标签时，保留当前的冲煮设置，但不显示参数信息条
            // 不需要额外操作，因为参数信息条已经通过条件渲染控制只在冲煮标签显示
        } else if (activeMainTab === '冲煮') {
            // 切换回冲煮标签时，根据当前步骤恢复显示参数信息条和步骤指示器
            // 如果当前步骤是咖啡豆，确保参数信息条为空
            if (activeBrewingStep === 'coffeeBean') {
                setParameterInfo({
                    equipment: null,
                    method: null,
                    params: null,
                });
            }
            // 如果当前步骤是器具，但没有选择器具，确保参数信息条为空
            else if (activeBrewingStep === 'equipment' && !selectedEquipment) {
                setParameterInfo({
                    equipment: null,
                    method: null,
                    params: null,
                });
            }
            // 如果当前步骤是方案，但没有选择方案，确保参数信息条只显示器具
            else if (activeBrewingStep === 'method' && !selectedMethod && selectedEquipment) {
                const equipmentName = equipmentList.find(e => e.id === selectedEquipment)?.name || selectedEquipment;
                setParameterInfo({
                    equipment: equipmentName,
                    method: null,
                    params: null,
                });
            }
            // 其他情况下，参数信息条已经通过其他逻辑正确设置
        }
    }, [activeMainTab, activeBrewingStep, selectedEquipment, selectedMethod]);

    // 预加载 PourVisualizer 组件
    useEffect(() => {
        // 当用户选择了器具后就开始预加载 PourVisualizer 组件
        if (selectedEquipment && !isPourVisualizerPreloaded) {
            // 使用动态导入预加载组件
            const preloadComponent = async () => {
                // 动态导入PourVisualizer组件，组件内部会自动处理图片预加载
                await import('@/components/PourVisualizer')
            }

            preloadComponent()
            setIsPourVisualizerPreloaded(true)
        }
    }, [selectedEquipment, isPourVisualizerPreloaded])

    // 加载自定义方案
    useEffect(() => {
        const loadMethods = async () => {
            try {
                const methods = await loadCustomMethods();
                setCustomMethods(methods);
            } catch (error) {
                console.error('Error loading custom methods:', error);
            }
        };

        loadMethods();
    }, []);

    useEffect(() => {
        if (selectedEquipment) {
            // 如果是聪明杯，强制使用通用方案
            if (selectedEquipment === 'CleverDripper' && methodType !== 'common') {
                setMethodType('common');
                setSelectedBrand(null);
                setSelectedBean(null);
            }

            setContent((prev) => {
                const methodsForEquipment = methodType === 'custom'
                    ? customMethods[selectedEquipment] || []
                    : commonMethods[selectedEquipment as keyof typeof commonMethods] || []

                return {
                    ...prev,
                    方案: {
                        type: methodType,
                        selectedBrand,
                        steps: methodType === 'common'
                            ? methodsForEquipment.map((method) => {
                                const totalTime = method.params.stages[method.params.stages.length - 1].time
                                return {
                                    title: method.name,
                                    items: [
                                        `水粉比 ${method.params.ratio}`,
                                        `总时长 ${formatTime(totalTime, true)}`,
                                        `研磨度 ${method.params.grindSize}`,
                                    ],
                                    note: '',
                                }
                            })
                            : methodType === 'brand'
                                ? selectedBrand
                                    ? selectedBrand.beans.map((bean) => ({
                                        title: bean.name,
                                        items: [
                                            bean.description,
                                            `烘焙度：${bean.roastLevel}`,
                                        ],
                                        note: '',
                                    }))
                                    : brandCoffees.map((brand) => ({
                                        title: brand.name,
                                        items: [brand.description],
                                        note: '',
                                    }))
                                : methodsForEquipment.map((method) => ({
                                    title: method.name,
                                    items: [
                                        `水粉比 ${method.params.ratio}`,
                                        `总时长 ${formatTime(method.params.stages[method.params.stages.length - 1].time, true)}`,
                                        `研磨度 ${method.params.grindSize}`,
                                    ],
                                    note: '',
                                })),
                    },
                }
            })
        }
    }, [selectedEquipment, methodType, selectedBrand, customMethods])

    useEffect(() => {
        if (showComplete) {
            // 先恢复界面状态
            setIsTimerRunning(false)
            // 然后延迟一小段时间后跳转到记录页面，让用户能看到恢复的动画
            const timer = setTimeout(() => {
                setActiveTab('记录')
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [showComplete])

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
    }, []);

    const handleEquipmentSelect = useCallback((equipmentName: string) => {
        // 如果当前在笔记标签，先切换回冲煮标签
        if (activeMainTab !== '冲煮') {
            setActiveMainTab('冲煮');
            setShowHistory(false);
            // 在状态更新后再处理器具选择，避免状态不一致
            setTimeout(() => handleEquipmentSelect(equipmentName), 0);
            return;
        }

        // 根据设备名称找到对应的设备id
        const equipment = equipmentList.find(e => e.name === equipmentName)?.id || equipmentName;

        // 重置方案相关状态
        setSelectedMethod(null);
        setCurrentBrewingMethod(null);
        setEditableParams(null);

        // 设置新的设备
        setSelectedEquipment(equipment);

        // 如果选择的是聪明杯，确保方案类型设置为通用方案
        if (equipment === 'CleverDripper') {
            setMethodType('common');
            setSelectedBrand(null);
            setSelectedBean(null);
        }

        // 设置参数信息条显示选择的器具
        const displayName = equipmentList.find(e => e.id === equipment)?.name || equipmentName;
        setParameterInfo({
            equipment: displayName,
            method: null,
            params: null,
        });

        // 更新方案列表内容
        const methodsForEquipment = methodType === 'custom'
            ? customMethods[equipment] || []
            : commonMethods[equipment as keyof typeof commonMethods] || [];

        setContent((prev) => ({
            ...prev,
            方案: {
                type: methodType,
                selectedBrand,
                steps: methodType === 'common'
                    ? methodsForEquipment.map((method) => {
                        const totalTime = method.params.stages[method.params.stages.length - 1].time;
                        return {
                            title: method.name,
                            items: [
                                `水粉比 ${method.params.ratio}`,
                                `总时长 ${formatTime(totalTime, true)}`,
                                `研磨度 ${method.params.grindSize}`,
                            ],
                            note: '',
                        };
                    })
                    : methodType === 'brand'
                        ? selectedBrand
                            ? selectedBrand.beans.map((bean) => ({
                                title: bean.name,
                                items: [
                                    bean.description,
                                    `烘焙度：${bean.roastLevel}`,
                                ],
                                note: '',
                            }))
                            : brandCoffees.map((brand) => ({
                                title: brand.name,
                                items: [brand.description],
                                note: '',
                            }))
                        : methodsForEquipment.map((method) => ({
                            title: method.name,
                            items: [
                                `水粉比 ${method.params.ratio}`,
                                `总时长 ${formatTime(method.params.stages[method.params.stages.length - 1].time, true)}`,
                                `研磨度 ${method.params.grindSize}`,
                            ],
                            note: '',
                        })),
            },
        }));

        setActiveTab('方案');
        setActiveBrewingStep('method');
    }, [activeMainTab, setActiveMainTab, setShowHistory, methodType, selectedBrand, customMethods]);

    const handleMethodSelect = useCallback(
        (methodIndex: number) => {
            // 如果当前在笔记标签，先切换回冲煮标签
            if (activeMainTab !== '冲煮') {
                setActiveMainTab('冲煮');
                setShowHistory(false);
                // 在状态更新后再处理方案选择，避免状态不一致
                setTimeout(() => handleMethodSelect(methodIndex), 0);
                return;
            }

            if (selectedEquipment) {
                let method: Method | null = null;

                if (methodType === 'common') {
                    method = commonMethods[selectedEquipment as keyof typeof commonMethods][methodIndex];
                } else if (methodType === 'brand') {
                    if (selectedBrand) {
                        const selectedBean = selectedBrand.beans[methodIndex];
                        setSelectedBean(selectedBean);
                        method = selectedBean.method;
                    } else {
                        setSelectedBrand(brandCoffees[methodIndex]);
                        return; // 仅选择品牌，不选择方案
                    }
                } else if (methodType === 'custom') {
                    method = customMethods[selectedEquipment][methodIndex];
                }

                if (method) {
                    // 即使是相同的方案，也强制更新状态和参数信息
                    setCurrentBrewingMethod({ ...method });

                    // 先设置为null，然后再设置新值，确保即使是相同的方案也会触发更新
                    setSelectedMethod(null);

                    // 使用setTimeout确保状态更新是分开的
                    setTimeout(() => {
                        setSelectedMethod(method);

                        // 直接更新参数信息，不依赖于useEffect
                        setParameterInfo((prev) => ({
                            ...prev,
                            method: method.name,
                            params: {
                                coffee: method.params.coffee,
                                water: method.params.water,
                                ratio: method.params.ratio,
                                grindSize: method.params.grindSize,
                                temp: method.params.temp,
                            },
                        }));

                        // 直接更新可编辑参数，不依赖于useEffect
                        setEditableParams({
                            coffee: method.params.coffee,
                            water: method.params.water,
                            ratio: method.params.ratio,
                        });

                        // 更新注水步骤内容
                        setContent((prev) => ({
                            ...prev,
                            注水: {
                                steps: method.params.stages.map((stage: Stage) => ({
                                    title: stage.label,
                                    items: [
                                        `${stage.water.replace('ml', 'g')}`,
                                        stage.detail,
                                    ],
                                    note: stage.time + '秒',
                                })),
                            },
                        }));

                        setActiveTab('注水');
                        setActiveBrewingStep('brewing');
                    }, 0);
                }
            }
        },
        [selectedEquipment, methodType, selectedBrand, customMethods, activeMainTab, setActiveMainTab, setShowHistory, setActiveBrewingStep, setContent]
    )

    const handleParamChange = (type: keyof EditableParams, value: string) => {
        if (!editableParams || !selectedMethod || !currentBrewingMethod) return

        const currentCoffee = extractNumber(editableParams.coffee)
        const currentRatioNumber = extractRatioNumber(editableParams.ratio)

        let newParams = { ...editableParams }
        const parsedValue = parseFloat(value)

        if (isNaN(parsedValue) || parsedValue <= 0) return

        switch (type) {
            case 'coffee': {
                const calculatedWater = Math.round(parsedValue * currentRatioNumber)
                newParams = {
                    coffee: `${parsedValue}g`,
                    water: `${calculatedWater}g`,
                    ratio: editableParams.ratio,
                }
                const waterRatio = calculatedWater / extractNumber(selectedMethod.params.water)
                const updatedStages = selectedMethod.params.stages.map((stage) => ({
                    ...stage,
                    water: `${Math.round(extractNumber(stage.water) * waterRatio)}g`,
                }))
                updateBrewingSteps(updatedStages)
                const updatedMethod = {
                    ...currentBrewingMethod,
                    params: {
                        ...currentBrewingMethod.params,
                        coffee: `${parsedValue}g`,
                        water: `${calculatedWater}g`,
                        stages: updatedStages
                    }
                }
                setCurrentBrewingMethod(updatedMethod)
                break
            }
            case 'water': {
                const calculatedRatio = parsedValue / currentCoffee
                newParams = {
                    coffee: editableParams.coffee,
                    water: `${parsedValue}g`,
                    ratio: `1:${formatRatio(calculatedRatio)}`,
                }
                const waterRatio = parsedValue / extractNumber(selectedMethod.params.water)
                const updatedStages = selectedMethod.params.stages.map((stage) => ({
                    ...stage,
                    water: `${Math.round(extractNumber(stage.water) * waterRatio)}g`,
                }))
                updateBrewingSteps(updatedStages)
                const updatedMethod = {
                    ...currentBrewingMethod,
                    params: {
                        ...currentBrewingMethod.params,
                        water: `${parsedValue}g`,
                        ratio: `1:${formatRatio(calculatedRatio)}`,
                        stages: updatedStages
                    }
                }
                setCurrentBrewingMethod(updatedMethod)
                break
            }
            case 'ratio': {
                const calculatedWater = Math.round(currentCoffee * parsedValue)
                newParams = {
                    coffee: editableParams.coffee,
                    water: `${calculatedWater}g`,
                    ratio: `1:${formatRatio(parsedValue)}`,
                }
                const waterRatio = calculatedWater / extractNumber(selectedMethod.params.water)
                const updatedStages = selectedMethod.params.stages.map((stage) => ({
                    ...stage,
                    water: `${Math.round(extractNumber(stage.water) * waterRatio)}g`,
                }))
                updateBrewingSteps(updatedStages)
                const updatedMethod = {
                    ...currentBrewingMethod,
                    params: {
                        ...currentBrewingMethod.params,
                        water: `${calculatedWater}g`,
                        ratio: `1:${formatRatio(parsedValue)}`,
                        stages: updatedStages
                    }
                }
                setCurrentBrewingMethod(updatedMethod)
                break
            }
        }

        setEditableParams(newParams)
        setParameterInfo((prev) => ({
            ...prev,
            params: {
                ...prev.params!,
                ...newParams,
            },
        }))
    }

    const updateBrewingSteps = (updatedStages: Stage[]) => {
        setContent((prev) => ({
            ...prev,
            注水: {
                steps: updatedStages.map((stage) => ({
                    title: stage.label,
                    items: [`${stage.water}`, stage.detail],
                    note: stage.time + '秒',
                })),
            },
        }))
    }

    // 修改保存笔记的处理函数
    const handleSaveNote = async (data: BrewingNoteData) => {
        try {
            const notesStr = await Storage.get('brewingNotes');
            const notes = notesStr ? JSON.parse(notesStr) : [];

            // 确保包含stages数据
            let stages: Stage[] = [];
            if (selectedMethod && selectedMethod.params.stages) {
                stages = selectedMethod.params.stages;
            }

            const newNote = {
                ...data,
                id: Date.now().toString(),
                timestamp: Date.now(),
                stages: stages, // 添加stages数据
            };
            const updatedNotes = [newNote, ...notes];
            await Storage.set('brewingNotes', JSON.stringify(updatedNotes));
            setActiveTab('注水');
            setShowComplete(false);
        } catch (error) {
            console.error('Error saving note:', error);
            alert('保存笔记时出错，请重试');
        }
    };

    // 保存自定义方案
    const handleSaveCustomMethod = async (method: Method) => {
        try {
            const result = await saveCustomMethod(
                method,
                selectedEquipment,
                customMethods,
                editingMethod
            );
            setCustomMethods(result.newCustomMethods);
            setSelectedMethod(result.methodWithId);
            setShowCustomForm(false);
            setEditingMethod(undefined);
        } catch (error) {
            console.error('Error saving custom method:', error);
            alert('保存自定义方案时出错，请重试');
        }
    };

    // 处理自定义方案的编辑
    const handleEditCustomMethod = (method: Method) => {
        setEditingMethod(method)
        setShowCustomForm(true)
    }

    // 处理自定义方案的删除
    const handleDeleteCustomMethod = async (method: Method) => {
        if (window.confirm(`确定要删除方案"${method.name}"吗？`)) {
            try {
                const newCustomMethods = await deleteCustomMethod(
                    method,
                    selectedEquipment,
                    customMethods
                );
                setCustomMethods(newCustomMethods);

                // 如果删除的是当前选中的方案，重置选中的方案
                if (selectedMethod && selectedMethod.id === method.id) {
                    setSelectedMethod(null);
                }
            } catch (error) {
                console.error('Error deleting custom method:', error);
                alert('删除自定义方案时出错，请重试');
            }
        }
    };

    // 处理冲煮步骤点击
    const handleBrewingStepClick = (step: BrewingStep) => {
        // 如果当前在笔记标签，先切换回冲煮标签
        if (activeMainTab !== '冲煮') {
            setActiveMainTab('冲煮');
            setShowHistory(false);
            // 在状态更新后再处理步骤点击，避免状态不一致
            setTimeout(() => handleBrewingStepClick(step), 0);
            return;
        }

        // 如果计时器正在运行，不允许切换步骤
        if (isTimerRunning && !showComplete) {
            return;
        }

        // 获取步骤索引，用于判断是否是回到上一步
        const stepOrder = ['coffeeBean', 'equipment', 'method', 'brewing', 'notes'];
        const currentStepIndex = stepOrder.indexOf(activeBrewingStep);
        const targetStepIndex = stepOrder.indexOf(step);

        // 实现新的导航逻辑：
        // 1. 允许用户返回上一步（targetStepIndex < currentStepIndex）
        // 2. 允许用户前进到下一步，但只能是相邻的下一步（targetStepIndex === currentStepIndex + 1）
        // 3. 咖啡豆步骤可以随时访问
        // 4. 从记录步骤可以返回到任何步骤
        if (step !== 'coffeeBean' &&
            activeBrewingStep !== 'notes' &&
            targetStepIndex > currentStepIndex &&
            targetStepIndex !== currentStepIndex + 1) {
            // 不允许跳过步骤前进，直接返回
            return;
        }

        // 关键修改：对所有步骤实施相同的逻辑，一旦返回就必须重新选择才能前进
        // 从器具步骤到方案步骤
        if (step === 'method' && activeBrewingStep === 'equipment' && !selectedEquipment) {
            // 如果没有选择器具，不允许进入方案步骤
            return;
        }
        // 从方案步骤到注水步骤
        if (step === 'brewing' && activeBrewingStep === 'method' && !selectedMethod) {
            // 如果没有选择方案，不允许进入注水步骤
            return;
        }
        // 从注水步骤到记录步骤
        if (step === 'notes' && activeBrewingStep === 'brewing' && !showComplete) {
            // 如果没有完成冲煮，不允许进入记录步骤
            return;
        }

        // 如果是回到咖啡豆步骤，重置所有选择
        if (step === 'coffeeBean') {
            setSelectedEquipment(null);
            setSelectedMethod(null);
            setCurrentBrewingMethod(null);
            setEditableParams(null);
            setParameterInfo({
                equipment: null,
                method: null,
                params: null,
            });
        }
        // 如果回到器具步骤，重置方案和注水相关状态
        else if (step === 'equipment' && targetStepIndex < currentStepIndex) {
            // 重置器具选择，强制用户重新选择器具
            setSelectedEquipment(null);
            setSelectedMethod(null);
            setCurrentBrewingMethod(null);
            setEditableParams(null);
            setParameterInfo({
                equipment: null,
                method: null,
                params: null,
            });
        }
        // 如果回到方案步骤，重置注水相关状态
        else if (step === 'method' && targetStepIndex < currentStepIndex) {
            // 重置注水相关状态，并且重置方案选择，强制用户重新选择方案
            setIsTimerRunning(false);
            setCurrentStage(-1);
            setCountdownTime(null);
            setSelectedMethod(null);
            setCurrentBrewingMethod(null);
            setEditableParams(null);

            // 更新参数信息，只保留设备信息
            if (selectedEquipment) {
                const equipmentName = equipmentList.find(e => e.id === selectedEquipment)?.name || selectedEquipment;
                setParameterInfo({
                    equipment: equipmentName,
                    method: null,
                    params: null,
                });
            }
        }
        // 如果回到注水步骤，重置记录相关状态
        else if (step === 'brewing' && targetStepIndex < currentStepIndex) {
            // 重置计时器状态，强制用户重新开始冲煮
            setIsTimerRunning(false);
            setCurrentStage(-1);
            setCountdownTime(null);
            setShowComplete(false);
        }

        // 如果点击的步骤被禁用，不执行任何操作
        const disabledSteps: BrewingStep[] = [];
        if (!selectedEquipment) {
            disabledSteps.push('method', 'brewing', 'notes');
        } else if (!selectedMethod) {
            disabledSteps.push('brewing', 'notes');
        } else if (!showComplete) {
            disabledSteps.push('notes');
        }

        if (disabledSteps.includes(step)) {
            return;
        }

        // 当离开当前步骤时，重置相关状态
        if (activeBrewingStep !== step) {
            // 如果离开咖啡豆步骤，重置所有选择
            if (activeBrewingStep === 'coffeeBean' && step !== 'coffeeBean') {
                // 不需要额外操作，因为咖啡豆步骤本身就是初始状态
            }

            // 如果离开器具步骤，重置方案和注水相关状态
            else if (activeBrewingStep === 'equipment' && step !== 'equipment') {
                setSelectedMethod(null);
                setCurrentBrewingMethod(null);
                setEditableParams(null);
                // 保留selectedEquipment，但更新参数信息
                if (selectedEquipment) {
                    const equipmentName = equipmentList.find(e => e.id === selectedEquipment)?.name || selectedEquipment;
                    setParameterInfo({
                        equipment: equipmentName,
                        method: null,
                        params: null,
                    });
                }
            }

            // 如果离开方案步骤，重置注水相关状态
            else if (activeBrewingStep === 'method' && step !== 'method') {
                // 如果没有选择方案就离开，则重置方案相关状态
                if (!selectedMethod) {
                    setSelectedMethod(null);
                    setCurrentBrewingMethod(null);
                    setEditableParams(null);
                }
            }

            // 如果离开注水步骤，重置计时器状态
            else if (activeBrewingStep === 'brewing' && step !== 'brewing') {
                setIsTimerRunning(false);
                setCurrentStage(-1);
                setCountdownTime(null);
            }

            // 如果离开记录步骤，重置完成状态
            else if (activeBrewingStep === 'notes' && step !== 'notes') {
                setShowComplete(false);
            }
        }

        // 根据步骤更新对应的旧状态
        switch (step) {
            case 'coffeeBean':
                // 处理咖啡豆选择
                // 重置参数信息显示和相关状态
                setParameterInfo({
                    equipment: null,
                    method: null,
                    params: null,
                });
                setSelectedEquipment(null);
                setSelectedMethod(null);
                setEditableParams(null);
                break;
            case 'equipment':
                setActiveTab('器具');
                // 完全清空参数信息条，因为用户正在选择器具
                setParameterInfo({
                    equipment: null,
                    method: null,
                    params: null,
                });
                // 重置方法选择，但保留设备选择
                setSelectedMethod(null);
                setEditableParams(null);
                break;
            case 'method':
                if (selectedEquipment) {
                    setActiveTab('方案');
                    // 保持设备信息，清空方法和参数信息
                    const equipmentName = equipmentList.find(e => e.id === selectedEquipment)?.name || selectedEquipment;
                    setParameterInfo({
                        equipment: equipmentName,
                        method: null,
                        params: null,
                    });
                }
                break;
            case 'brewing':
                if (selectedMethod) {
                    setActiveTab('注水');
                }
                break;
            case 'notes':
                if (showComplete) {
                    setActiveTab('记录');
                }
                break;
        }
        setActiveBrewingStep(step);
    };

    useEffect(() => {
        // 初始化 Capacitor
        initCapacitor();

        // 其他初始化代码...
        // ... existing code ...
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
            const methods = await loadCustomMethods();
            setCustomMethods(methods);
        } catch (error) {
            console.error('Error loading custom methods after data change:', error);
        }

        // 重置当前选择的方案
        setSelectedMethod(null);

        // 显示通知
        alert('数据已更新，应用将重新加载数据');
    };

    return (
        <div className="flex h-full flex-col overflow-hidden mx-auto max-w-[500px] font-mono text-neutral-800 dark:text-neutral-100">
            {/* 使用 NavigationBar 组件替换原有的导航栏 */}
            <NavigationBar
                activeMainTab={activeMainTab}
                setActiveMainTab={setActiveMainTab}
                activeBrewingStep={activeBrewingStep}
                setActiveBrewingStep={handleBrewingStepClick}
                parameterInfo={parameterInfo}
                setParameterInfo={setParameterInfo}
                editableParams={editableParams}
                setEditableParams={setEditableParams}
                isTimerRunning={isTimerRunning}
                showComplete={showComplete}
                selectedEquipment={selectedEquipment}
                selectedMethod={currentBrewingMethod}
                handleParamChange={handleParamChange}
                setShowHistory={setShowHistory}
                setActiveTab={setActiveTab}
                onTitleDoubleClick={handleTitleDoubleClick}
            />

            {/* 内容区域 - 简化内边距和间距 */}
            <div className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">
                    {activeMainTab === '笔记' ? (
                        <motion.div
                            key="history"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.26 }}
                            className="h-full"
                        >
                            <BrewingHistory
                                isOpen={true}
                                onClose={() => {
                                    setActiveMainTab('冲煮');
                                    setShowHistory(false);
                                }}
                            />
                        </motion.div>
                    ) : activeMainTab === '咖啡豆' ? (
                        <motion.div
                            key="coffee-beans"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.26 }}
                            className="h-full px-6 py-4"
                        >
                            {/* 咖啡豆管理界面将在这里实现 */}
                            <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                                [ 咖啡豆管理功能即将推出 ]
                            </div>
                        </motion.div>
                    ) : activeBrewingStep === 'coffeeBean' ? (
                        <motion.div
                            key="coffee-bean-selection"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.26 }}
                            className="h-full px-6 py-4"
                        >
                            {/* 咖啡豆选择界面将在这里实现 */}
                            <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                                [ 咖啡豆选择功能即将推出 ]
                            </div>
                        </motion.div>
                    ) : activeTab === '记录' ? (
                        <motion.div
                            key="note-form"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.26 }}
                            className=""
                        >
                            <BrewingNoteForm
                                id="brewingNoteForm"
                                isOpen={true}
                                onClose={() => {
                                    setActiveTab('注水');
                                    setActiveBrewingStep('brewing');
                                }}
                                onSave={handleSaveNote}
                                initialData={{
                                    equipment: selectedEquipment ? (equipmentList.find(e => e.id === selectedEquipment)?.name || selectedEquipment) : undefined,
                                    method: currentBrewingMethod?.name,
                                    params: currentBrewingMethod?.params,
                                    totalTime: currentTime,
                                    coffeeBeanInfo: methodType === 'brand' && selectedBean ? {
                                        name: selectedBean.name,
                                        roastLevel: selectedBean.roastLevel,
                                        roastDate: '',
                                    } : undefined
                                }}
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.26 }}
                            className="relative h-full px-6 py-6"
                        >
                            {/* 当计时器运行时显示可视化组件 */}
                            <AnimatePresence mode="wait">
                                {isTimerRunning && !showComplete && currentBrewingMethod ? (
                                    <motion.div
                                        key="pour-visualizer-container"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 400,
                                            damping: 30,
                                            opacity: { duration: 0.26 }
                                        }}
                                        className="flex items-center justify-center w-full h-full"
                                    >
                                        <div
                                            key="pour-visualizer-inner"
                                            className="w-full max-w-[300px]"
                                        >
                                            <PourVisualizer
                                                isRunning={isTimerRunning}
                                                currentStage={currentStage}
                                                stages={currentBrewingMethod.params.stages}
                                                countdownTime={countdownTime}
                                                equipmentId={selectedEquipment || 'V60'}
                                            />
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="steps-list-container"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 300,
                                            damping: 30,
                                            opacity: { duration: 0.26 }
                                        }}
                                        className="space-y-5"
                                    >
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
                                            <AnimatePresence mode="wait">
                                                <motion.div
                                                    key={`${methodType}-${selectedBrand?.name || 'none'}`}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{ duration: 0.26 }}
                                                    className="space-y-5 pb-16"
                                                >
                                                    {methodType === 'custom' && (
                                                        <div className="flex space-x-2 mb-4">
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
                                                        </div>
                                                    )}
                                                    <AnimatePresence initial={false}>
                                                        {content[activeTab as keyof typeof content].steps.map((step, index) => (
                                                            <motion.div
                                                                key={step.methodId || `${step.title}-${index}`}
                                                                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                                                                animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
                                                                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                                                transition={{ duration: 0.26 }}
                                                            >
                                                                <StageItem
                                                                    step={step}
                                                                    index={index}
                                                                    onClick={() => {
                                                                        if (activeTab === ('器具' as TabType)) {
                                                                            handleEquipmentSelect(step.title)
                                                                        } else if (activeTab === ('方案' as TabType)) {
                                                                            handleMethodSelect(index)
                                                                        }
                                                                    }}
                                                                    activeTab={activeTab}
                                                                    selectedMethod={selectedMethod}
                                                                    currentStage={currentStage}
                                                                    onEdit={activeTab === ('方案' as TabType) && methodType === 'custom' && customMethods[selectedEquipment!] ? () => {
                                                                        const method = customMethods[selectedEquipment!][index];
                                                                        handleEditCustomMethod(method);
                                                                    } : undefined}
                                                                    onDelete={activeTab === ('方案' as TabType) && methodType === 'custom' && customMethods[selectedEquipment!] ? () => {
                                                                        const method = customMethods[selectedEquipment!][index];
                                                                        handleDeleteCustomMethod(method);
                                                                    } : undefined}
                                                                    actionMenuStates={actionMenuStates}
                                                                    setActionMenuStates={setActionMenuStates}
                                                                    selectedEquipment={selectedEquipment}
                                                                    customMethods={customMethods}
                                                                />
                                                            </motion.div>
                                                        ))}
                                                    </AnimatePresence>
                                                </motion.div>
                                            </AnimatePresence>
                                        ) : (
                                            <AnimatePresence initial={false}>
                                                {content[activeTab as keyof typeof content].steps.map((step, index) => (
                                                    <motion.div
                                                        key={step.methodId || `${step.title}-${index}`}
                                                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                                                        animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
                                                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                                        transition={{ duration: 0.26 }}
                                                    >
                                                        <StageItem
                                                            step={step}
                                                            index={index}
                                                            onClick={() => {
                                                                if (activeTab === ('器具' as TabType)) {
                                                                    handleEquipmentSelect(step.title)
                                                                } else if (activeTab === ('方案' as TabType)) {
                                                                    handleMethodSelect(index)
                                                                }
                                                            }}
                                                            activeTab={activeTab}
                                                            selectedMethod={selectedMethod}
                                                            currentStage={currentStage}
                                                            onEdit={activeTab === ('方案' as TabType) && methodType === 'custom' && customMethods[selectedEquipment!] ? () => {
                                                                const method = customMethods[selectedEquipment!][index];
                                                                handleEditCustomMethod(method);
                                                            } : undefined}
                                                            onDelete={activeTab === ('方案' as TabType) && methodType === 'custom' && customMethods[selectedEquipment!] ? () => {
                                                                const method = customMethods[selectedEquipment!][index];
                                                                handleDeleteCustomMethod(method);
                                                            } : undefined}
                                                            actionMenuStates={actionMenuStates}
                                                            setActionMenuStates={setActionMenuStates}
                                                            selectedEquipment={selectedEquipment}
                                                            customMethods={customMethods}
                                                        />
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 底部工具栏 - 根据当前状态显示不同内容 */}
            <AnimatePresence>
                {/* 方案类型选择器 */}
                {activeMainTab === '冲煮' && activeBrewingStep === 'method' && selectedEquipment !== 'CleverDripper' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.26 }}
                        className="bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 pt-3 pb-safe px-6 px-safe"
                    >
                        <div className="flex justify-between items-center">
                            <div className="flex space-x-4">
                                <button
                                    onClick={() => {
                                        setMethodType('common');
                                        setSelectedBrand(null);
                                        setSelectedBean(null);
                                    }}
                                    className={`text-[12px] tracking-wider transition-colors ${methodType === 'common'
                                        ? 'text-neutral-800 dark:text-neutral-100'
                                        : 'text-neutral-400 dark:text-neutral-500 '
                                        }`}
                                >
                                    通用方案
                                </button>

                                <span
                                    className="text-neutral-300 dark:text-neutral-600"
                                >
                                    |
                                </span>
                                <button
                                    onClick={() => {
                                        if (methodType === 'brand' && selectedBrand) {
                                            setSelectedBrand(null);
                                        } else {
                                            setMethodType('brand');
                                        }
                                    }}
                                    className={`text-[12px] tracking-wider transition-colors ${methodType === 'brand'
                                        ? 'text-neutral-800 dark:text-neutral-100'
                                        : 'text-neutral-400 dark:text-neutral-500'
                                        }`}
                                >
                                    品牌方案
                                    {methodType === 'brand' && selectedBrand && (
                                        <span className="ml-1 text-[10px]">· {selectedBrand.name}</span>
                                    )}
                                </button>
                            </div>
                            <button
                                onClick={() => {
                                    setMethodType('custom');
                                    setSelectedBrand(null);
                                    setSelectedBean(null);
                                }}
                                className={`text-[12px] tracking-wider transition-colors ${methodType === 'custom'
                                    ? 'text-neutral-800 dark:text-neutral-100'
                                    : 'text-neutral-400 dark:text-neutral-500'
                                    }`}
                            >
                                自定义方案
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* 计时器 */}
                {activeMainTab === '冲煮' && activeBrewingStep === 'brewing' && currentBrewingMethod && !showHistory && (
                    <motion.div
                        key="brewing-timer"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 30,
                            opacity: { duration: 0.26 }
                        }}
                        className='px-6 px-safe pb-safe'
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
                        />
                    </motion.div>
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
        </div>
    )
}

export default PourOverRecipes
