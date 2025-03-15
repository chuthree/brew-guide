'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { brewingMethods as commonMethods, equipmentList, brandCoffees, APP_VERSION, type Method, type Stage, type Brand, type CoffeeBean } from '@/lib/config'
import CustomMethodForm from '@/components/CustomMethodForm'

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

const tabs = ['器具', '方案', '注水', '记录'] as const
type TabType = typeof tabs[number]

interface Step {
    title: string
    items: string[]
    note: string
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

// Add new component for editable parameters
const EditableParameter = ({
    value,
    onChange,
    unit,
    className = '',
}: {
    value: string
    onChange: (value: string) => void
    unit: string
    className?: string
}) => {
    const [isEditing, setIsEditing] = useState(false)
    const [tempValue, setTempValue] = useState(value)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])

    useEffect(() => {
        setTempValue(value)
    }, [value])

    const handleBlur = () => {
        setIsEditing(false)
        if (tempValue !== value) {
            onChange(tempValue)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleBlur()
        } else if (e.key === 'Escape') {
            setTempValue(value)
            setIsEditing(false)
        }
    }

    return (
        <span
            className={`group relative inline-block ${className} cursor-pointer`}
            onClick={() => setIsEditing(true)}
        >
            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="w-12 border-b border-neutral-300 bg-transparent text-center text-[10px] outline-none sm:text-xs"
                />
            ) : (
                <span className="cursor-pointer hover:text-neutral-600">
                    {value}
                    <span className="ml-0.5">{unit}</span>
                </span>
            )}
        </span>
    )
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

// Add TabButton component at the top level
const TabButton = ({
    tab,
    isActive,
    isDisabled,
    onClick,
    hasSecondaryLine,
}: {
    tab: string
    isActive: boolean
    isDisabled: boolean
    onClick?: () => void
    hasSecondaryLine?: boolean
}) => (
    <div
        onClick={!isDisabled ? onClick : undefined}
        className={`text-xs tracking-widest transition-all duration-300 ${isActive
            ? 'text-neutral-800 dark:text-neutral-100'
            : isDisabled
                ? 'text-neutral-200 dark:text-neutral-700'
                : 'cursor-pointer text-neutral-300 hover:text-neutral-600 dark:text-neutral-600 dark:hover:text-neutral-300'
            }`}
    >
        <span className="relative">
            {tab}
            {/* Secondary line (always below) */}
            <motion.div
                layoutId="secondary-underline"
                animate={{ opacity: hasSecondaryLine ? 1 : 0 }}
                transition={{ duration: 0.3 }}
                className="absolute -bottom-1 left-0 right-0 h-px bg-neutral-200 dark:bg-neutral-700"
            />
            {/* Primary line (always on top) */}
            {isActive && (
                <motion.div
                    layoutId="underline"
                    className="absolute -bottom-1 left-0 right-0 z-10 h-px bg-neutral-800 dark:bg-neutral-100"
                />
            )}
        </span>
    </div>
)

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
}: {
    step: Step
    index: number
    onClick: () => void
    activeTab: string
    selectedMethod: Method | null
    currentStage: number
    onEdit?: () => void
    onDelete?: () => void
}) => {
    const [showActions, setShowActions] = useState(false)

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
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
                    transition={{ duration: 0.2, ease: 'linear' }}
                />
            )}
            <div className={activeTab !== '注水' ? 'cursor-pointer' : ''} onClick={onClick}>
                <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-3">
                        <h3 className="text-xs font-normal tracking-wider">
                            {step.title}
                        </h3>
                        {activeTab === '注水' && selectedMethod && (
                            <div className="flex items-baseline gap-2 text-[10px] text-neutral-400 dark:text-neutral-500">
                                <span>{formatTime(selectedMethod.params.stages[index].time, true)}</span>
                                <span>·</span>
                                <span>{step.items[0]}</span>
                            </div>
                        )}
                    </div>
                    {onEdit && onDelete && (
                        <div className="flex items-center">
                            <AnimatePresence mode="wait">
                                {showActions ? (
                                    <motion.div
                                        key="action-buttons"
                                        initial={{ opacity: 0, scale: 0.9, x: 10 }}
                                        animate={{ opacity: 1, scale: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, x: 10 }}
                                        transition={{ duration: 0.2 }}
                                        className="flex items-center space-x-3"
                                    >
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onEdit()
                                            }}
                                            className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
                                        >
                                            编辑
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onDelete()
                                            }}
                                            className="px-3 py-1.5 text-xs text-red-400 hover:text-red-600"
                                        >
                                            删除
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setShowActions(false)
                                            }}
                                            className="w-7 h-7 flex items-center justify-center rounded-full text-sm text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
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
                                        transition={{ duration: 0.2 }}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setShowActions(true)
                                        }}
                                        className="w-7 h-7 flex items-center justify-center text-xs text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
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
    const [hasNotes, setHasNotes] = useState(false)
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

    // 检查是否有笔记
    useEffect(() => {
        const notes = JSON.parse(localStorage.getItem('brewingNotes') || '[]')
        setHasNotes(notes.length > 0)
    }, [showHistory])

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
        try {
            const savedMethods = localStorage.getItem('customMethods')
            if (savedMethods) {
                setCustomMethods(JSON.parse(savedMethods))
            }
        } catch (error) {
            console.error('Error loading custom methods:', error)
        }
    }, [])

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
        if (selectedMethod) {
            setContent((prev) => ({
                ...prev,
                注水: {
                    steps: selectedMethod.params.stages.map((stage: Stage) => ({
                        title: stage.label,
                        items: [
                            `${stage.water.replace('ml', 'g')}`,
                            stage.detail,
                        ],
                        note: stage.time + '秒',
                    })),
                },
            }))
        }
    }, [selectedMethod])

    useEffect(() => {
        if (selectedEquipment) {
            // 根据设备ID找到对应的设备名称
            const equipmentName = equipmentList.find(e => e.id === selectedEquipment)?.name || selectedEquipment;

            setParameterInfo(() => ({
                equipment: equipmentName,
                method: null,
                params: null,
            }))
        }
    }, [selectedEquipment])

    useEffect(() => {
        if (selectedMethod) {
            setParameterInfo((prev) => ({
                ...prev,
                method: selectedMethod.name,
                params: {
                    coffee: selectedMethod.params.coffee,
                    water: selectedMethod.params.water,
                    ratio: selectedMethod.params.ratio,
                    grindSize: selectedMethod.params.grindSize,
                    temp: selectedMethod.params.temp,
                },
            }))
        } else if (selectedEquipment) {
            setParameterInfo((prev) => ({
                ...prev,
                method: null,
                params: null,
            }))
        }
    }, [selectedMethod, selectedEquipment])

    useEffect(() => {
        if (selectedMethod) {
            setEditableParams({
                coffee: selectedMethod.params.coffee,
                water: selectedMethod.params.water,
                ratio: selectedMethod.params.ratio,
            })
        }
    }, [selectedMethod, selectedEquipment])

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

    // 修改 catch 块中的未使用变量
    useEffect(() => {
        try {
            // 检查本地存储版本
            const storageVersion = localStorage.getItem('brewingNotesVersion')
            const currentVersion = APP_VERSION // 当前数据版本

            if (!storageVersion) {
                // 首次使用或旧版本，初始化版本信息
                localStorage.setItem('brewingNotesVersion', currentVersion)
            }

            // 确保 brewingNotes 存在且格式正确
            const notes = localStorage.getItem('brewingNotes')
            if (notes) {
                try {
                    JSON.parse(notes)
                } catch {
                    // 如果数据格式错误，初始化为空数组
                    localStorage.setItem('brewingNotes', '[]')
                }
            } else {
                localStorage.setItem('brewingNotes', '[]')
            }

            // 检查是否有笔记
            const hasExistingNotes = JSON.parse(localStorage.getItem('brewingNotes') || '[]').length > 0
            setHasNotes(hasExistingNotes)
        } catch (error) {
            console.error('Error initializing storage:', error)
        }
    }, [])

    const handleEquipmentSelect = useCallback((equipmentName: string) => {
        // 根据设备名称找到对应的设备id
        const equipment = equipmentList.find(e => e.name === equipmentName)?.id || equipmentName;
        setSelectedEquipment(equipment);
        setSelectedMethod(null);

        // 如果选择的是聪明杯，确保方案类型设置为通用方案
        if (equipment === 'CleverDripper') {
            setMethodType('common');
            setSelectedBrand(null);
            setSelectedBean(null);
        }

        setActiveTab('方案');
    }, []);

    const handleMethodSelect = useCallback(
        (methodIndex: number) => {
            if (selectedEquipment) {
                if (methodType === 'common') {
                    const method = commonMethods[selectedEquipment as keyof typeof commonMethods][methodIndex]
                    setSelectedMethod(method)
                    setCurrentBrewingMethod({ ...method })
                    setActiveTab('注水')
                } else if (methodType === 'brand') {
                    if (selectedBrand) {
                        const selectedBean = selectedBrand.beans[methodIndex]
                        setSelectedBean(selectedBean)
                        setSelectedMethod(selectedBean.method)
                        setCurrentBrewingMethod({ ...selectedBean.method })
                        setActiveTab('注水')
                    } else {
                        setSelectedBrand(brandCoffees[methodIndex])
                    }
                } else if (methodType === 'custom') {
                    const method = customMethods[selectedEquipment][methodIndex]
                    setSelectedMethod(method)
                    setCurrentBrewingMethod({ ...method })
                    setActiveTab('注水')
                }
            }
        },
        [selectedEquipment, methodType, selectedBrand, customMethods]
    )

    const handleBack = useCallback(() => {
        if (isTimerRunning && !window.confirm('计时器正在运行，确定要返回吗？'))
            return

        if (showHistory) {
            setShowHistory(false)
        } else if (activeTab === '记录') {
            setActiveTab('注水')
            setShowComplete(false)
        } else if (activeTab === '注水') {
            setActiveTab('方案')
            setSelectedMethod(null)
            setSelectedBean(null)
        } else if (activeTab === '方案') {
            if (methodType === 'brand') {
                if (selectedBrand) {
                    setSelectedBrand(null)
                } else {
                    setActiveTab('器具')
                    setSelectedEquipment(null)
                    setMethodType('common')
                    // 重置参数信息
                    setParameterInfo({
                        equipment: null,
                        method: null,
                        params: null,
                    })
                }
            } else {
                setActiveTab('器具')
                setSelectedEquipment(null)
                // 重置参数信息
                setParameterInfo({
                    equipment: null,
                    method: null,
                    params: null,
                })
            }
        }
    }, [activeTab, isTimerRunning, showHistory, methodType, selectedBrand])

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
    const handleSaveNote = (data: BrewingNoteData) => {
        try {
            const notes = JSON.parse(localStorage.getItem('brewingNotes') || '[]')
            const newNote = {
                ...data,
                id: Date.now().toString(),
                timestamp: Date.now(),
            }
            const updatedNotes = [newNote, ...notes]
            localStorage.setItem('brewingNotes', JSON.stringify(updatedNotes))
            setHasNotes(true)
            setActiveTab('注水')
            setShowComplete(false)
        } catch (error) {
            console.error('Error saving note:', error)
            alert('保存笔记时出错，请重试')
        }
    }

    // 保存自定义方案
    const handleSaveCustomMethod = (method: Method) => {
        if (!selectedEquipment) return

        // 检查是否是编辑模式
        const isEditing = editingMethod !== undefined;

        // 创建新的自定义方法列表
        let updatedMethods = [...(customMethods[selectedEquipment] || [])];

        if (isEditing) {
            // 编辑模式：替换现有方法
            updatedMethods = updatedMethods.map(m =>
                m.name === editingMethod?.name ? method : m
            );
        } else {
            // 创建模式：添加新方法
            updatedMethods.push(method);
        }

        const newCustomMethods = {
            ...customMethods,
            [selectedEquipment]: updatedMethods,
        }

        setCustomMethods(newCustomMethods)
        localStorage.setItem('customMethods', JSON.stringify(newCustomMethods))
        setShowCustomForm(false)
        setEditingMethod(undefined)

        // 更新内容显示
        setContent((prev) => {
            // 如果是编辑模式，先移除旧的方案
            const filteredSteps = isEditing
                ? prev.方案.steps.filter(step => step.title !== editingMethod?.name)
                : prev.方案.steps;

            return {
                ...prev,
                方案: {
                    ...prev.方案,
                    steps: [
                        ...filteredSteps,
                        {
                            title: method.name,
                            items: [
                                `水粉比 ${method.params.ratio}`,
                                `总时长 ${formatTime(method.params.stages[method.params.stages.length - 1].time, true)}`,
                                `研磨度 ${method.params.grindSize}`,
                            ],
                            note: '',
                        },
                    ],
                },
            };
        })
    }

    // 处理自定义方案的编辑
    const handleEditCustomMethod = (method: Method) => {
        setEditingMethod(method)
        setShowCustomForm(true)
    }

    // 处理自定义方案的删除
    const handleDeleteCustomMethod = (method: Method) => {
        if (!selectedEquipment) return

        const newCustomMethods = {
            ...customMethods,
            [selectedEquipment]: customMethods[selectedEquipment].filter(
                (m) => m.name !== method.name
            ),
        }

        setCustomMethods(newCustomMethods)
        localStorage.setItem('customMethods', JSON.stringify(newCustomMethods))

        // 更新内容显示
        setContent((prev) => ({
            ...prev,
            方案: {
                ...prev.方案,
                steps: prev.方案.steps.filter((step) => step.title !== method.name),
            },
        }))
    }

    return (
        <div className="flex h-full flex-col overflow-hidden mx-auto max-w-[500px] font-mono text-neutral-800 dark:text-neutral-100">
            {/* Header section */}
            <motion.div
                className={`${isTimerRunning && !showComplete ? 'translate-y-16' : ''} z-10  bg-neutral-50 dark:bg-neutral-900  transition-all duration-600  relative border-b mx-6 mt-6 border-neutral-200 dark:border-neutral-800`}
            >
                <div className={`space-y-4 transition-all ease-in-out duration-300 ${isTimerRunning && !showComplete ? 'opacity-0' : ''}`}><div className="flex w-full items-center justify-between">
                    <div>
                        <h1 className="mt-2 text-xl font-light tracking-wide sm:text-2xl">
                            手冲咖啡冲煮指南
                            <span className="ml-2 text-[8px] text-neutral-300 dark:text-neutral-600">
                                BETA v{APP_VERSION}
                            </span>
                        </h1>
                    </div>
                </div>
                    {/* Parameter information display */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="h-16 sm:h-20"
                    >
                        <div className="space-y-2">
                            <AnimatePresence mode="wait">
                                {showHistory ? (
                                    <motion.div
                                        key="history-info"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.3 }}
                                        className="flex flex-col space-y-1"
                                    >
                                        <div className="text-xs text-neutral-400 dark:text-neutral-500">
                                            浏览历史冲煮记录
                                        </div>
                                    </motion.div>
                                ) : parameterInfo.equipment ? (
                                    <motion.div
                                        key="parameter-info"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.3 }}
                                        className="flex flex-col space-y-1"
                                    >
                                        <div className="flex items-center space-x-3 text-xs text-neutral-500 sm:text-sm dark:text-neutral-400">
                                            <span className="font-light">
                                                {parameterInfo.equipment}
                                            </span>
                                            <AnimatePresence mode="wait">
                                                {parameterInfo.method && (
                                                    <motion.div
                                                        initial={{ opacity: 0, x: 10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: -10 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="flex items-center space-x-3"
                                                    >
                                                        <span className="text-neutral-300 dark:text-neutral-600">
                                                            |
                                                        </span>
                                                        <span className="font-light">
                                                            {parameterInfo.method}
                                                        </span>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                        <AnimatePresence mode="wait">
                                            {parameterInfo.params && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -5 }}
                                                    transition={{ duration: 0.2, delay: 0.1 }}
                                                    className="relative flex flex-wrap gap-2 text-[10px] text-neutral-400 sm:text-xs dark:text-neutral-500"
                                                >
                                                    {editableParams ? (
                                                        <>
                                                            <EditableParameter
                                                                value={editableParams.coffee.replace('g', '')}
                                                                onChange={(v) => handleParamChange('coffee', v)}
                                                                unit="g"
                                                                className="border-b border-dashed border-neutral-200 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
                                                            />
                                                            <span>·</span>
                                                            <EditableParameter
                                                                value={editableParams.water.replace('g', '')}
                                                                onChange={(v) => handleParamChange('water', v)}
                                                                unit="g"
                                                                className="border-b border-dashed border-neutral-200 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
                                                            />
                                                            <span>·</span>
                                                            <EditableParameter
                                                                value={editableParams.ratio.replace('1:', '')}
                                                                onChange={(v) => handleParamChange('ratio', v)}
                                                                unit=""
                                                                className="border-b border-dashed border-neutral-200 before:mr-0.5 before:content-['1:'] hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
                                                            />
                                                            <span>·</span>
                                                            <span>{parameterInfo.params?.grindSize}</span>
                                                            <span>·</span>
                                                            <span>{parameterInfo.params?.temp}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span>{parameterInfo.params?.coffee}</span>
                                                            <span>·</span>
                                                            <span>{parameterInfo.params?.water}</span>
                                                            <span>·</span>
                                                            <span>{parameterInfo.params?.ratio}</span>
                                                            <span>·</span>
                                                            <span>{parameterInfo.params?.grindSize}</span>
                                                            <span>·</span>
                                                            <span>{parameterInfo.params?.temp}</span>
                                                        </>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="empty-state"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.3 }}
                                        className="flex flex-col space-y-1"
                                    >
                                        <div className="text-xs text-neutral-400 dark:text-neutral-500">
                                            选择器具开始冲煮
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>
            </motion.div>

            {/* Content section */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="relative flex flex-1 flex-col overflow-hidden px-6 sm:px-8 w-full"
            >
                {/* Navigation */}
                <motion.div
                    className={`flex items-center justify-between transition-all my-6 duration-300 ${isTimerRunning && !showComplete ? 'opacity-0 pointer-events-none ' : 'opacity-100'}`}

                >
                    <div className="flex items-center space-x-4 sm:space-x-8">
                        {hasNotes && (
                            <>
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <TabButton
                                        tab="笔记"
                                        isActive={showHistory}
                                        isDisabled={isTimerRunning}
                                        onClick={isTimerRunning ? undefined : () => {
                                            if (showHistory) {
                                                setShowHistory(false)
                                            } else {
                                                setShowHistory(true)
                                            }
                                        }}
                                    />
                                </motion.div>
                                <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-700" />
                            </>
                        )}
                        {tabs.slice(0, 3).map((tab) => (
                            <motion.div
                                key={tab}
                                animate={{
                                    opacity: isTimerRunning && activeTab !== tab ? 0.3 : 1
                                }}
                                transition={{ duration: 0.4 }}
                            >
                                <TabButton
                                    tab={tab}
                                    isActive={activeTab === tab && !showHistory}
                                    hasSecondaryLine={activeTab === tab}
                                    isDisabled={
                                        isTimerRunning ||
                                        (tab === '方案' && !selectedEquipment) ||
                                        (tab === '注水' && !selectedMethod)
                                    }
                                    onClick={
                                        isTimerRunning ? undefined :
                                            () => {
                                                if (tab === activeTab && tab !== '注水') {
                                                    // 如果点击当前标签（除了注水），根据层级关系返回上一级
                                                    handleBack()
                                                } else if (
                                                    (tab === '方案' && selectedEquipment) ||
                                                    (tab === '注水' && selectedMethod) ||
                                                    tab === '器具'
                                                ) {
                                                    if (showHistory) {
                                                        setShowHistory(false)
                                                    }

                                                    // 如果当前在记录页面，无论点击哪个标签都需要重置状态
                                                    if (activeTab === '记录') {
                                                        setShowComplete(false)
                                                        if (tab === '器具') {
                                                            setSelectedEquipment(null)
                                                            setSelectedMethod(null)
                                                            setCurrentBrewingMethod(null)
                                                            setParameterInfo({
                                                                equipment: null,
                                                                method: null,
                                                                params: null,
                                                            })
                                                        } else if (tab === '方案') {
                                                            setSelectedMethod(null)
                                                            setCurrentBrewingMethod(null)
                                                            setParameterInfo((prev) => ({
                                                                equipment: prev.equipment,
                                                                method: null,
                                                                params: null,
                                                            }))
                                                        } else if (tab === '注水') {
                                                            // 从记录页面点击注水时，只重置完成状态
                                                            setShowComplete(false)
                                                        }
                                                    } else if (tab !== activeTab) { // 只在切换到不同标签时重置状态
                                                        // 非记录页面的原有逻辑
                                                        if (tab === '器具') {
                                                            setSelectedEquipment(null)
                                                            setSelectedMethod(null)
                                                            setCurrentBrewingMethod(null)
                                                            setParameterInfo({
                                                                equipment: null,
                                                                method: null,
                                                                params: null,
                                                            })
                                                            setShowComplete(false)
                                                        } else if (tab === '方案') {
                                                            setSelectedMethod(null)
                                                            setCurrentBrewingMethod(null)
                                                            setParameterInfo((prev) => ({
                                                                equipment: prev.equipment,
                                                                method: null,
                                                                params: null,
                                                            }))
                                                            setShowComplete(false)
                                                        }
                                                    }
                                                    setActiveTab(tab as TabType)
                                                }
                                            }
                                    }
                                />
                            </motion.div>
                        ))}
                        {showComplete && (
                            <>
                                <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-700" />
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.4, delay: 0.3 }}
                                >
                                    <TabButton
                                        tab="记录"
                                        isActive={activeTab === '记录' && !showHistory}
                                        hasSecondaryLine={activeTab === '记录'}
                                        isDisabled={false}
                                        onClick={() => {
                                            if (showHistory) {
                                                setShowHistory(false)
                                            }
                                            setActiveTab('记录')
                                        }}
                                    />
                                </motion.div>
                            </>
                        )}
                    </div>
                    {(activeTab !== '器具' || showHistory) && (
                        <motion.button
                            onClick={handleBack}
                            animate={{
                                opacity: isTimerRunning ? 0 : 1
                            }}
                            transition={{ duration: 0.4 }}
                            className="text-[10px] tracking-widest text-neutral-400 transition-colors hover:text-neutral-800 sm:text-xs dark:text-neutral-500 dark:hover:text-neutral-300"
                        >
                            [ 返回 ]
                        </motion.button>
                    )}
                </motion.div>

                {/* Content display */}
                <div className={` overflow-y-auto  h-full`}>

                    <AnimatePresence mode="wait">
                        {showHistory ? (
                            <motion.div
                                key="history"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                            >
                                <BrewingHistory
                                    isOpen={showHistory}
                                    onClose={() => setShowHistory(false)}
                                />
                            </motion.div>
                        ) : activeTab === '记录' ? (
                            <motion.div
                                key="note-form"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                            >
                                <BrewingNoteForm
                                    id="brewingNoteForm"
                                    isOpen={true}
                                    onClose={() => setActiveTab('注水')}
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
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className="relative h-full"
                            >
                                {/* 当计时器运行时显示可视化组件 */}
                                <AnimatePresence mode="wait">
                                    {isTimerRunning && !showComplete && currentBrewingMethod ? (
                                        <motion.div
                                            key="pour-visualizer-container"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="flex items-center justify-center"
                                            style={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                width: '100%',
                                                zIndex: 10
                                            }}
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
                                            transition={{ duration: 0.3 }}
                                            className="space-y-6 pr-2"
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
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: -20 }}
                                                        transition={{ duration: 0.3 }}
                                                        className="space-y-6"
                                                    >
                                                        {methodType === 'custom' && (
                                                            <motion.button
                                                                onClick={() => setShowCustomForm(true)}
                                                                whileHover={{ scale: 1.02 }}
                                                                whileTap={{ scale: 0.98 }}
                                                                className="flex items-center justify-center w-full py-4 mb-4 border border-dashed border-neutral-300 rounded-md text-xs text-neutral-500 hover:text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:border-neutral-700 transition-colors"
                                                            >
                                                                <span className="mr-1">+</span> 新建方案
                                                            </motion.button>
                                                        )}
                                                        {content[activeTab as keyof typeof content].steps.map((step, index) => (
                                                            <StageItem
                                                                key={index}
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
                                                                onEdit={methodType === 'custom' ? () => handleEditCustomMethod(customMethods[selectedEquipment!][index]) : undefined}
                                                                onDelete={methodType === 'custom' ? () => handleDeleteCustomMethod(customMethods[selectedEquipment!][index]) : undefined}
                                                            />
                                                        ))}
                                                    </motion.div>
                                                </AnimatePresence>
                                            ) : (
                                                content[activeTab as keyof typeof content].steps.map((step, index) => (
                                                    <StageItem
                                                        key={index}
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
                                                    />
                                                ))
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Timer section */}
                <AnimatePresence mode="wait">
                    {activeTab === '注水' && currentBrewingMethod && !showHistory && (
                        <motion.div
                            key="brewing-timer"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{
                                willChange: "opacity"
                            }}
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
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* 方案类型导航栏 */}
                <AnimatePresence>
                    {
                        activeTab === '方案' && !showHistory && selectedEquipment !== 'CleverDripper' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                                className=" bg-neutral-50 dark:bg-neutral-900 pt-1 w-full pb-9 flex flex-row justify-between"

                            >
                                <div className="flex items-center space-x-4">
                                    <motion.button
                                        onClick={() => {
                                            setMethodType('common')
                                            setSelectedBrand(null)
                                            setSelectedBean(null)
                                        }}
                                        className={`text-xs tracking-wider transition-colors ${methodType === 'common'
                                            ? 'text-neutral-800 dark:text-neutral-100'
                                            : 'text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300'
                                            }`}
                                    >
                                        通用方案
                                    </motion.button>
                                    <motion.span
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="text-neutral-300 dark:text-neutral-600"
                                    >
                                        |
                                    </motion.span>
                                    <div className="flex items-center space-x-2">
                                        <motion.button
                                            onClick={() => {
                                                if (methodType === 'brand' && selectedBrand) {
                                                    setSelectedBrand(null)
                                                } else {
                                                    setMethodType('brand')
                                                }
                                            }}
                                            className={`group flex items-center text-xs tracking-wider transition-colors ${methodType === 'brand'
                                                ? 'text-neutral-800 dark:text-neutral-100'
                                                : 'text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300'
                                                }`}
                                        >
                                            品牌方案
                                        </motion.button>
                                        <AnimatePresence mode="wait">
                                            {methodType === 'brand' && selectedBrand && (
                                                <motion.div
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 10 }}
                                                    transition={{ duration: 0.3 }}
                                                    className="flex items-center space-x-2"
                                                >
                                                    <span className="text-neutral-300 dark:text-neutral-600">·</span>
                                                    <span className="text-xs tracking-wider text-neutral-800 dark:text-neutral-100">
                                                        {selectedBrand.name}
                                                    </span>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                                <motion.button
                                    onClick={() => {
                                        setMethodType('custom')
                                        setSelectedBrand(null)
                                        setSelectedBean(null)
                                    }}
                                    className={`text-xs  tracking-wider transition-colors ${methodType === 'custom'
                                        ? 'text-neutral-800 dark:text-neutral-100'
                                        : 'text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300'
                                        }`}
                                >
                                    自定义方案
                                </motion.button>

                            </motion.div>
                        )
                    }
                </AnimatePresence>
            </motion.div>

            {/* 自定义方案表单 */}
            <AnimatePresence>
                {showCustomForm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                setShowCustomForm(false)
                                setEditingMethod(undefined)
                            }
                        }}
                    >
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{
                                type: "tween",
                                ease: [0.33, 1, 0.68, 1], // cubic-bezier(0.33, 1, 0.68, 1) - easeOutCubic
                                duration: 0.35
                            }}
                            style={{
                                willChange: "transform"
                            }}
                            className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-neutral-900"
                        >
                            {/* 拖动条 */}
                            <div className="sticky top-0 z-10 flex justify-center py-2 bg-white dark:bg-neutral-900">
                                <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                            </div>


                            {/* 表单内容 */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    type: "tween",
                                    ease: "easeOut",
                                    duration: 0.25,
                                    delay: 0.05
                                }}
                                style={{
                                    willChange: "opacity, transform"
                                }}
                                className="px-6 pb-6 overflow-auto max-h-[calc(90vh-40px)]"
                            >
                                <CustomMethodForm
                                    onSave={handleSaveCustomMethod}
                                    onCancel={() => {
                                        setShowCustomForm(false)
                                        setEditingMethod(undefined)
                                    }}
                                    initialMethod={editingMethod}
                                />
                            </motion.div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default PourOverRecipes
