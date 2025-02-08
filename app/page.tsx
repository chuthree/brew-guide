'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import BrewingTimer from '@/components/BrewingTimer'
import { brewingMethods as commonMethods, equipmentList, brandCoffees, type Method, type Stage, type Brand, type CoffeeBean } from '@/lib/config'
import BrewingHistory from '@/components/BrewingHistory'
import BrewingNoteForm from '@/components/BrewingNoteForm'

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
        type: 'common' | 'brand'
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
    stageProgress,
}: {
    step: any
    index: number
    onClick: () => void
    activeTab: string
    selectedMethod: Method | null
    currentStage: number
    stageProgress: number
}) => (
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
        onClick={onClick}
    >
        {activeTab === '注水' && index === currentStage && (
            <motion.div
                className="absolute -left-px top-0 h-full w-px origin-top bg-neutral-800 dark:bg-neutral-100"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: stageProgress / 100 }}
                transition={{ duration: 0.3, ease: 'linear' }}
            />
        )}
        <div className={activeTab !== '注水' ? 'cursor-pointer' : ''}>
            <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-3">
                    <h3 className="text-xs font-normal tracking-wider">
                        {step.title}
                    </h3>
                    {activeTab === '注水' && selectedMethod && (
                        <div className="flex items-baseline gap-2 text-[10px] text-neutral-400 dark:text-neutral-500">
                            <span>{step.items[0]}</span>
                            <span>·</span>
                            <span>{formatTime(selectedMethod.params.stages[index].time, true)}</span>
                        </div>
                    )}
                </div>
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
    const [stageProgress, setStageProgress] = useState(0)
    const [showHistory, setShowHistory] = useState(false)
    const [hasNotes, setHasNotes] = useState(false)
    const [showComplete, setShowComplete] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [isOffline, setIsOffline] = useState(!navigator.onLine)
    const [methodType, setMethodType] = useState<'common' | 'brand'>('common')
    const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
    const [selectedBean, setSelectedBean] = useState<CoffeeBean | null>(null)

    useEffect(() => {
        const handleOnline = () => setIsOffline(false)
        const handleOffline = () => setIsOffline(true)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    // 检查是否有笔记
    useEffect(() => {
        const notes = JSON.parse(localStorage.getItem('brewingNotes') || '[]')
        setHasNotes(notes.length > 0)
    }, [showHistory])

    useEffect(() => {
        if (selectedEquipment) {
            setContent((prev) => ({
                ...prev,
                方案: {
                    type: methodType,
                    selectedBrand,
                    steps: methodType === 'common'
                        ? commonMethods[selectedEquipment as keyof typeof commonMethods].map((method) => ({
                            title: method.name,
                            items: [
                                `咖啡粉 ${method.params.coffee} | 水量 ${method.params.water}`,
                                `水温 ${method.params.temp} | 研磨度 ${method.params.grindSize}`,
                            ],
                            note: '',
                        }))
                        : selectedBrand
                            ? selectedBrand.beans.map((bean) => ({
                                title: bean.name,
                                items: [
                                    bean.description,
                                    `烘焙度：${bean.roastLevel}`,
                                    // `推荐参数：${bean.method.params.coffee} | ${bean.method.params.water} | ${bean.method.params.temp}`,
                                ],
                                note: '',
                            }))
                            : brandCoffees.map((brand) => ({
                                title: brand.name,
                                items: [brand.description],
                                note: '',
                            })),
                },
            }))
        }
    }, [selectedEquipment, methodType, selectedBrand])

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
            setParameterInfo((prev) => ({
                equipment: selectedEquipment,
                method: null,
                params: null,
            }))
        } else {
            setParameterInfo({
                equipment: null,
                method: null,
                params: null,
            })
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
    }, [selectedMethod])

    useEffect(() => {
        if (selectedMethod) {
            setEditableParams({
                coffee: selectedMethod.params.coffee,
                water: selectedMethod.params.water,
                ratio: selectedMethod.params.ratio,
            })
        } else {
            setEditableParams(null)
        }
    }, [selectedMethod])

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

    // 添加数据迁移和版本控制
    useEffect(() => {
        try {
            // 检查本地存储版本
            const storageVersion = localStorage.getItem('brewingNotesVersion')
            const currentVersion = '1.0' // 当前数据版本

            if (!storageVersion) {
                // 首次使用或旧版本，初始化版本信息
                localStorage.setItem('brewingNotesVersion', currentVersion)
            }

            // 确保 brewingNotes 存在且格式正确
            const notes = localStorage.getItem('brewingNotes')
            if (notes) {
                try {
                    JSON.parse(notes)
                } catch (e) {
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

    const handleEquipmentSelect = useCallback((equipment: string) => {
        setSelectedEquipment(equipment)
        setSelectedMethod(null)
        setActiveTab('方案')
    }, [])

    const handleMethodSelect = useCallback(
        (methodIndex: number) => {
            if (selectedEquipment) {
                if (methodType === 'common') {
                    const method = commonMethods[selectedEquipment as keyof typeof commonMethods][methodIndex]
                    setSelectedMethod(method)
                    setCurrentBrewingMethod({ ...method })
                    setActiveTab('注水')
                } else if (selectedBrand) {
                    const selectedBean = selectedBrand.beans[methodIndex]
                    setSelectedBean(selectedBean)
                    setSelectedMethod(selectedBean.method)
                    setCurrentBrewingMethod({ ...selectedBean.method })
                    setActiveTab('注水')
                } else {
                    setSelectedBrand(brandCoffees[methodIndex])
                }
            }
        },
        [selectedEquipment, methodType, selectedBrand]
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
                }
            } else {
                setActiveTab('器具')
                setSelectedEquipment(null)
            }
        }
    }, [activeTab, isTimerRunning, showHistory, methodType, selectedBrand])

    const handleParamChange = (type: keyof EditableParams, value: string) => {
        if (!editableParams || !selectedMethod || !currentBrewingMethod) return

        const currentCoffee = extractNumber(editableParams.coffee)
        const currentRatioNumber = extractRatioNumber(editableParams.ratio)
        const currentWater = extractNumber(editableParams.water)

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
    const handleSaveNote = (data: any) => {
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

    return (
        <div className="mx-auto flex min-h-screen max-w-[500px] flex-col bg-neutral-50 px-8 py-6 font-mono text-neutral-800 sm:px-12 sm:py-8 dark:bg-neutral-900 dark:text-neutral-100">
            {/* Title section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{
                    opacity: isTimerRunning && !showComplete ? 0.3 : 1,
                    y: 0,
                    height: isTimerRunning && !showComplete ? "60px" : "auto"
                }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="mb-6 border-b border-neutral-200 overflow-hidden sm:mb-16 dark:border-neutral-800"
            >
                <div className={`space-y-4 transition-all duration-500 ${isTimerRunning && !showComplete ? 'opacity-30' : ''}`}>
                    <div className="flex  w-full items-center justify-between">

                        <div>
                            <div className="text-[10px] tracking-widest text-neutral-400 sm:text-xs dark:text-neutral-500">
                                POUR OVER COFFEE GUIDE{' '}
                                <span className="ml-2 text-[8px] text-neutral-300 dark:text-neutral-600">
                                    BETA v1.9.6
                                </span>

                            </div>
                            <h1 className="mt-2 text-xl font-light tracking-wide sm:text-2xl">
                                手冲咖啡冲煮指南
                            </h1>
                            <div>
                            </div>
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
                className="relative flex flex-1 flex-col pb-6"
            >
                {/* Navigation */}
                <motion.div
                    className="mb-6 flex items-center justify-between sm:mb-8"
                    animate={{
                        opacity: isTimerRunning && !showComplete ? 0.4 : 1,
                        height: isTimerRunning && !showComplete ? "40px" : "auto",
                        marginBottom: isTimerRunning && !showComplete ? "1rem" : "2rem"
                    }}
                    transition={{ duration: 0.5 }}
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
                                    scale: isTimerRunning ? 0.9 : 1,
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
                                opacity: isTimerRunning ? 0 : 1,
                                x: isTimerRunning ? 20 : 0
                            }}
                            transition={{ duration: 0.4 }}
                            className="text-[10px] tracking-widest text-neutral-400 transition-colors hover:text-neutral-800 sm:text-xs dark:text-neutral-500 dark:hover:text-neutral-300"
                        >
                            [ 返回 ]
                        </motion.button>
                    )}
                </motion.div>

                {/* Content display */}
                <div className="relative flex-1 overflow-y-auto pb-[200px] sm:pb-[180px]">
                    <AnimatePresence mode="wait">
                        {showHistory ? (
                            <motion.div
                                key="history"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                                className="absolute inset-0"
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
                                className="absolute inset-0"
                            >
                                <BrewingNoteForm
                                    id="brewingNoteForm"
                                    isOpen={true}
                                    onClose={() => setActiveTab('注水')}
                                    onSave={handleSaveNote}
                                    initialData={{
                                        equipment: selectedEquipment,
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
                                className="absolute inset-0 space-y-6 pr-2"
                            >
                                <AnimatePresence mode="wait">
                                    {activeTab === '方案' ? (
                                        <motion.div
                                            key={`${methodType}-${selectedBrand?.name || 'none'}`}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.3 }}
                                            className="space-y-6"
                                        >
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
                                                    stageProgress={stageProgress}
                                                />
                                            ))}
                                        </motion.div>
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
                                                stageProgress={stageProgress}
                                            />
                                        ))
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
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                bottom: 0,
                                willChange: "opacity"
                            }}
                        >
                            <BrewingTimer
                                currentBrewingMethod={currentBrewingMethod}
                                onStatusChange={({ isRunning }) => setIsTimerRunning(isRunning)}
                                onStageChange={({ currentStage, progress }) => {
                                    setCurrentStage(currentStage)
                                    setStageProgress(progress)
                                }}
                                onComplete={(isComplete) => setShowComplete(isComplete)}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* 方案类型导航栏 */}
                <AnimatePresence mode="wait">
                    {activeTab === '方案' && !showHistory && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                            className="mb-6 flex items-center space-x-4"
                        >
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
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
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
                                            setSelectedBean(null)
                                        } else {
                                            setMethodType('brand')
                                        }
                                    }}
                                    className={`group flex items-center text-xs tracking-wider transition-colors ${methodType === 'brand'
                                        ? 'text-neutral-800 dark:text-neutral-100'
                                        : 'text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300'
                                        }`}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
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
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    )
}

export default PourOverRecipes
