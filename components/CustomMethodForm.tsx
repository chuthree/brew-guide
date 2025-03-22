'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type Method, type Stage } from '@/lib/config'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import AutoResizeTextarea from './AutoResizeTextarea'
import { formatGrindSize } from '@/lib/grindUtils'
import { SettingsOptions } from '@/components/Settings'
import { Storage } from '@/lib/storage'

interface CustomMethodFormProps {
    onSave: (method: Method) => void
    onCancel: () => void
    initialMethod?: Method
    selectedEquipment?: string | null
    settings?: SettingsOptions
}

// 定义步骤类型
type Step = 'name' | 'params' | 'stages' | 'complete'

const CustomMethodForm: React.FC<CustomMethodFormProps> = ({
    onSave,
    onCancel,
    initialMethod,
    selectedEquipment,
    settings,
}) => {
    // 当前步骤状态
    const [currentStep, setCurrentStep] = useState<Step>('name')
    const formRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const stagesContainerRef = useRef<HTMLDivElement>(null)
    const newStageRef = useRef<HTMLDivElement>(null)

    // 添加一个状态来跟踪正在编辑的累计时间输入
    const [editingCumulativeTime, setEditingCumulativeTime] = useState<{ index: number, value: string } | null>(null)
    // 添加一个状态来跟踪正在编辑的累计水量输入
    const [editingCumulativeWater, setEditingCumulativeWater] = useState<{ index: number, value: string } | null>(null)

    const [method, setMethod] = useState<Method>(() => {
        // 如果有初始方法，直接使用
        if (initialMethod) {
            // 如果是聪明杯，确保从标签中移除阀门状态标记
            if (selectedEquipment === 'CleverDripper' && initialMethod.params.stages) {
                const cleanedMethod = { ...initialMethod };
                cleanedMethod.params = { ...initialMethod.params };
                cleanedMethod.params.stages = initialMethod.params.stages.map(stage => ({
                    ...stage,
                    label: stage.label.replace(/\s*\[开阀\]|\s*\[关阀\]/g, '').trim()
                }));
                return cleanedMethod;
            }
            return initialMethod;
        }

        // 否则创建新方法，并预设第一个步骤和基本参数
        const initialStage: Stage = {
            time: 25,
            pourTime: 10,
            label: '焖蒸',
            water: '30g', // 咖啡粉量的2倍
            detail: '使咖啡粉充分吸水并释放气体，提升萃取效果',
            pourType: 'circle',
            ...(selectedEquipment === 'CleverDripper' ? { valveStatus: 'closed' as 'closed' | 'open' } : {})
        };

        // 不再自动给步骤名称添加阀门状态
        /* 
        if (selectedEquipment === 'CleverDripper') {
            initialStage.label = '焖蒸 [关阀]';
        }
        */

        return {
            name: '',
            params: {
                coffee: '15g',
                water: '225g', // 15 * 15 = 225
                ratio: '1:15',
                grindSize: '中细',
                temp: '92°C',
                videoUrl: '',
                stages: [initialStage],
            },
        };
    })

    // 获取设置，如果没有提供设置，则使用默认设置
    const [localSettings, setLocalSettings] = useState<SettingsOptions>({
        notificationSound: true,
        hapticFeedback: true,
        grindType: '通用'
    });

    // 加载设置
    useEffect(() => {
        if (settings) {
            setLocalSettings(settings);
        } else {
            // 尝试从存储中加载设置
            const loadSettings = async () => {
                const savedSettings = await Storage.get('brewGuideSettings');
                if (savedSettings) {
                    setLocalSettings(JSON.parse(savedSettings) as SettingsOptions);
                }
            };
            loadSettings();
        }
    }, [settings]);

    // 点击外部关闭
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (formRef.current && !formRef.current.contains(event.target as Node)) {
                onCancel()
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [onCancel])

    // 自动聚焦输入框
    useEffect(() => {
        if (currentStep === 'name' && inputRef.current) {
            inputRef.current.focus()
        }
    }, [currentStep])

    // 步骤配置
    const steps: { id: Step; label: string }[] = [
        { id: 'name', label: '方案名称' },
        { id: 'params', label: '基本参数' },
        { id: 'stages', label: '冲泡步骤' },
        { id: 'complete', label: '完成' }
    ]

    // 获取当前步骤索引
    const getCurrentStepIndex = () => {
        return steps.findIndex(step => step.id === currentStep)
    }

    // 下一步
    const handleNextStep = () => {
        const currentIndex = getCurrentStepIndex()
        if (currentIndex < steps.length - 1) {
            setCurrentStep(steps[currentIndex + 1].id)
        } else {
            handleSubmit()
        }
    }

    // 上一步/返回
    const handleBack = () => {
        const currentIndex = getCurrentStepIndex()
        if (currentIndex > 0) {
            setCurrentStep(steps[currentIndex - 1].id)
        } else {
            onCancel()
        }
    }

    const getDefaultStageLabel = (pourType: string) => {
        switch (pourType) {
            case 'circle':
                return '绕圈注水'
            case 'center':
                return '中心注水'
            case 'other':
                return ''
            default:
                return '注水'
        }
    }

    const getDefaultStageDetail = (pourType: string) => {
        switch (pourType) {
            case 'circle':
                return '中心向外缓慢画圈注水，均匀萃取咖啡风味'
            case 'center':
                return '中心定点注水，降低萃取率'
            case 'other':
                return ''
            default:
                return '注水'
        }
    }

    const handleStageChange = (index: number, field: keyof Stage, value: string | number) => {
        const newStages = [...method.params.stages]
        const stage = { ...newStages[index] }

        if (field === 'water') {
            // 更新水量时自动调整总水量，但只在有值的情况下
            const oldWater = stage.water ? parseInt(stage.water) : 0
            const newWater = typeof value === 'string' && value ? parseInt(value) : 0
            const diff = newWater - oldWater

            if (method.params.water) {
                const totalWater = parseInt(method.params.water)
                setMethod({
                    ...method,
                    params: {
                        ...method.params,
                        water: `${totalWater + diff}g`,
                    },
                })
            }
        }

        // 修复类型错误
        if (field === 'time' || field === 'pourTime') {
            stage[field] = value as number
            // 当更新注水时间时，确保它不超过当前阶段的总时间
            if (field === 'pourTime' && stage.time !== undefined && (stage.pourTime ?? 0) > stage.time) {
                stage.pourTime = stage.time
            }
        } else if (field === 'label' || field === 'detail' || field === 'water') {
            if (field === 'water' && typeof value === 'string' && value) {
                stage[field] = `${value}g`
            } else {
                stage[field] = value as string
            }
        } else if (field === 'pourType') {
            stage[field] = value as 'center' | 'circle' | 'other'
        }

        newStages[index] = stage
        setMethod({
            ...method,
            params: {
                ...method.params,
                stages: newStages,
            },
        })
    }

    const addStage = () => {
        // 所有新添加的步骤都使用空值，不预设注水方式
        const newStage: Stage = {
            time: 0,
            pourTime: 0,
            label: '',
            water: '',
            detail: '',
            pourType: '' as 'center' | 'circle' | 'other', // 不预设注水方式，但保持类型正确
            ...(selectedEquipment === 'CleverDripper' ? { valveStatus: 'closed' as 'closed' | 'open' } : {}) // 如果是聪明杯，默认设置阀门状态为关闭
        };

        setMethod({
            ...method,
            params: {
                ...method.params,
                stages: [...method.params.stages, newStage],
            },
        })

        // 设置一个标记，表示需要滚动到新步骤
        newStageRef.current = {} as HTMLDivElement

        // 使用setTimeout确保DOM已更新
        setTimeout(() => {
            if (stagesContainerRef.current && newStageRef.current) {
                const newStageElement = stagesContainerRef.current.lastElementChild as HTMLElement
                if (newStageElement) {
                    // 修改滚动行为，考虑底部阴影的高度
                    newStageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    // 额外向上滚动一些距离，确保底部阴影不会遮挡新添加的步骤
                    setTimeout(() => {
                        if (stagesContainerRef.current) {
                            const container = stagesContainerRef.current.parentElement;
                            if (container) {
                                container.scrollTop += 20; // 向下额外滚动20px，确保新步骤完全可见
                            }
                        }
                    }, 300);
                }
            }
        }, 100)
    }

    const removeStage = (index: number) => {
        const newStages = [...method.params.stages]
        newStages.splice(index, 1)
        setMethod({
            ...method,
            params: {
                ...method.params,
                stages: newStages,
            },
        })
    }

    const handleSubmit = () => {
        // 创建一个方法的深拷贝，以便修改
        const finalMethod = JSON.parse(JSON.stringify(method)) as Method;

        // 如果是聪明杯，将阀门状态添加到步骤名称中
        if (selectedEquipment === 'CleverDripper' && finalMethod.params.stages) {
            finalMethod.params.stages = finalMethod.params.stages.map(stage => {
                if (stage.valveStatus) {
                    const valveStatusText = stage.valveStatus === 'open' ? '[开阀]' : '[关阀]';
                    // 确保没有重复添加
                    const baseLabel = stage.label.replace(/\s*\[开阀\]|\s*\[关阀\]/g, '').trim();
                    return {
                        ...stage,
                        label: `${baseLabel} ${valveStatusText}`.trim()
                    };
                }
                return stage;
            });
        }

        // 保存方法
        onSave(finalMethod);
    }

    const handleCoffeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const coffee = e.target.value
        // 根据咖啡粉量和水粉比计算总水量
        const ratio = method.params.ratio.replace('1:', '')
        let totalWater = ''

        if (coffee && ratio) {
            totalWater = `${Math.round(parseInt(coffee) * parseFloat(ratio))}g`
        }

        // 更新第一个步骤的水量（咖啡粉量的2倍）
        const newStages = [...method.params.stages];
        if (newStages.length > 0 && coffee) {
            const waterAmount = Math.round(parseInt(coffee) * 2);
            newStages[0].water = `${waterAmount}g`;
        }

        setMethod({
            ...method,
            params: {
                ...method.params,
                coffee: `${coffee}g`,
                water: totalWater, // 更新总水量
                stages: newStages, // 更新步骤
            },
        })
    }

    const handleRatioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const ratio = e.target.value
        // 根据咖啡粉量和水粉比计算总水量
        const coffee = method.params.coffee.replace('g', '')
        let totalWater = ''

        if (coffee && ratio) {
            totalWater = `${Math.round(parseInt(coffee) * parseFloat(ratio))}g`
        }

        // 更新第一个步骤的水量（咖啡粉量的2倍）
        const newStages = [...method.params.stages];
        if (newStages.length > 0 && coffee) {
            const waterAmount = Math.round(parseInt(coffee) * 2);
            newStages[0].water = `${waterAmount}g`;
        }

        setMethod({
            ...method,
            params: {
                ...method.params,
                ratio: `1:${ratio}`,
                water: totalWater, // 更新总水量
                stages: newStages, // 更新步骤
            },
        })
    }

    const handleTempChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const temp = e.target.value;
        setMethod({
            ...method,
            params: {
                ...method.params,
                temp: temp ? `${temp}°C` : '',
            },
        })
    }

    const calculateTotalTime = () => {
        // 如果没有步骤，返回0
        if (method.params.stages.length === 0) return 0;

        // 返回最后一个有时间的步骤的时间
        for (let i = method.params.stages.length - 1; i >= 0; i--) {
            const stage = method.params.stages[i];
            if (stage.time) {
                return stage.time;
            }
        }

        // 如果没有找到有时间的步骤，返回0
        return 0;
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    // 格式化水量显示
    const formatWater = (water: string | undefined) => {
        if (!water) return '0g';
        return water.endsWith('g') ? water : `${water}g`;
    }

    const handlePourTypeChange = (index: number, value: string) => {
        const newStages = [...method.params.stages]
        const stage = { ...newStages[index] }

        // 更新注水类型
        stage.pourType = value as 'center' | 'circle' | 'other'

        // 如果选择的是"其他方式"，清空之前自动填写的步骤名称和详细说明
        if (value === 'other') {
            stage.label = ''
            stage.detail = ''
        }
        // 如果选择的不是"其他方式"，且标签为空或是默认标签，则更新标签
        else if (
            !stage.label ||
            stage.label === '绕圈注水' ||
            stage.label === '中心注水' ||
            stage.label === '自定义注水' ||
            stage.label === '注水'
        ) {
            stage.label = getDefaultStageLabel(value)
        }

        // 如果选择的是"其他方式"，已经在上面清空了详细说明
        // 如果选择的不是"其他方式"，且详情为空或是默认详情，则更新详情
        if (
            value !== 'other' &&
            (
                !stage.detail ||
                stage.detail === '中心向外缓慢画圈注水，均匀萃取咖啡风味' ||
                stage.detail === '中心定点注水，降低萃取率' ||
                stage.detail === '自定义注水方式' ||
                stage.detail === '注水' ||
                stage.detail === '使咖啡粉充分吸水并释放气体，提升萃取效果'
            )
        ) {
            stage.detail = getDefaultStageDetail(value)
        }

        newStages[index] = stage
        setMethod({
            ...method,
            params: {
                ...method.params,
                stages: newStages,
            },
        })
    }

    // 处理阀门状态变更 - 直接切换开关状态
    const toggleValveStatus = (index: number) => {
        const newStages = [...method.params.stages]
        const stage = { ...newStages[index] }

        // 切换阀门状态
        const newStatus = stage.valveStatus === 'open' ? 'closed' : 'open'
        stage.valveStatus = newStatus

        // 我们不再修改标签内容，只更新阀门状态
        // 保留原始的标签内容，移除可能已存在的阀门状态标记
        const baseLabel = stage.label.replace(/\s*\[开阀\]|\s*\[关阀\]/g, '')
        stage.label = baseLabel.trim()

        newStages[index] = stage
        setMethod({
            ...method,
            params: {
                ...method.params,
                stages: newStages,
            },
        })
    }

    // 计算当前已使用的水量
    const calculateCurrentWater = () => {
        // 如果没有步骤，返回0
        if (method.params.stages.length === 0) return 0;

        // 找到最后一个有水量的步骤
        for (let i = method.params.stages.length - 1; i >= 0; i--) {
            const stage = method.params.stages[i];
            if (stage.water) {
                return parseInt(stage.water.replace('g', ''));
            }
        }

        // 如果没有找到有水量的步骤，返回0
        return 0;
    }

    // 添加动画变体
    const pageVariants = {
        initial: {
            opacity: 0,
            x: 20,
            scale: 0.95,
        },
        in: {
            opacity: 1,
            x: 0,
            scale: 1,
        },
        out: {
            opacity: 0,
            x: -20,
            scale: 0.95,
        }
    }

    const pageTransition = {
        type: "tween",
        ease: "anticipate",
        duration: 0.26
    }

    // 渲染进度条
    const renderProgressBar = () => {
        const currentIndex = getCurrentStepIndex()
        const progress = ((currentIndex + 1) / steps.length) * 100

        return (
            <div className="w-full h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div
                    className="h-full bg-neutral-800 dark:bg-neutral-200 transition-all duration-300 ease-in-out"
                    style={{ width: `${progress}%` }}
                />
            </div>
        )
    }

    // 渲染步骤内容
    const renderStepContent = () => {
        switch (currentStep) {
            case 'name':
                return (
                    <motion.div
                        key="name-step"
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                        className="flex flex-col items-center justify-center h-full"
                    >
                        <div className="text-center space-y-8 max-w-sm">
                            <h2 className="text-xl font-medium text-neutral-800 dark:text-neutral-200">
                                {initialMethod ? '编辑你的冲煮方案名称' : '给你的冲煮方案起个名字'}
                            </h2>
                            <div className="relative flex justify-center">
                                <div className="relative inline-block">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={method.name}
                                        onChange={(e) => setMethod({ ...method, name: e.target.value })}
                                        placeholder="叫做..."
                                        autoFocus={true}
                                        className={`
                                            text-center text-lg py-2 bg-transparent outline-none
                                            focus:border-neutral-800 dark:focus:border-neutral-400
                                        `}
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )

            case 'params':
                return (
                    <motion.div
                        key="params-step"
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                        className="space-y-10 max-w-md mx-auto flex flex-col items-center justify-center h-full"
                    >
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                    咖啡粉量
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        placeholder='例如：15'
                                        value={method.params.coffee.replace('g', '')}
                                        onChange={handleCoffeeChange}
                                        onFocus={(e) => e.target.select()}
                                        className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                                    />
                                    <span className="absolute right-0 bottom-2 text-neutral-500 dark:text-neutral-400">g</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                    水粉比
                                </label>
                                <div className="relative">
                                    <span className="absolute left-0 bottom-2 text-neutral-500 dark:text-neutral-400">1:</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        placeholder='例如：15'
                                        value={method.params.ratio.replace('1:', '')}
                                        onChange={handleRatioChange}
                                        onFocus={(e) => e.target.select()}
                                        className="w-full py-2 pl-6 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                    研磨度 {localSettings.grindType === '幻刺' && <span className="text-xs text-neutral-400">（将自动转换为幻刺刻度）</span>}
                                </label>
                                <input
                                    type="text"
                                    value={method.params.grindSize || ''}
                                    onChange={(e) => setMethod({
                                        ...method,
                                        params: {
                                            ...method.params,
                                            grindSize: e.target.value
                                        }
                                    })}
                                    onFocus={(e) => e.target.select()}
                                    placeholder={
                                        localSettings.grindType === "幻刺"
                                            ? "例如：中细 (8-9格)"
                                            : undefined
                                    }
                                    className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                                />
                                {method.params.grindSize && localSettings.grindType === '幻刺' && (
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                        幻刺研磨度：{formatGrindSize(method.params.grindSize, '幻刺')}
                                    </p>
                                )}

                                {/* 研磨度参考提示 */}
                                {!method.params.grindSize && (
                                    <div className="mt-1 text-xs space-y-1">
                                        <p className="text-neutral-500 dark:text-neutral-400">研磨度参考:</p>
                                        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                            <p className="text-neutral-500 dark:text-neutral-400">· 意式: 极细/特细</p>
                                            <p className="text-neutral-500 dark:text-neutral-400">· 摩卡壶: 细</p>
                                            <p className="text-neutral-500 dark:text-neutral-400">· 手冲: 中细{localSettings.grindType === '幻刺' && " (8-9格)"}</p>
                                            <p className="text-neutral-500 dark:text-neutral-400">· 法压: 中粗/粗</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                    水温
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        placeholder='例如：92'
                                        value={method.params.temp ? method.params.temp.replace('°C', '') : ''}
                                        onChange={handleTempChange}
                                        onFocus={(e) => e.target.select()}
                                        className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                                    />
                                    <span className="absolute right-0 bottom-2 text-neutral-500 dark:text-neutral-400">°C</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )

            case 'stages':
                return (
                    <motion.div
                        key="stages-step"
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                        className="space-y-8 max-w-md mx-auto relative"
                    >
                        {/* 顶部固定导航 */}
                        <div className="sticky top-0 pt-2 pb-4 bg-neutral-50 dark:bg-neutral-900 z-10 flex flex-col border-b border-neutral-200 dark:border-neutral-700">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-base font-medium text-neutral-800 dark:text-neutral-200">
                                    冲煮步骤
                                </h3>
                                <button
                                    type="button"
                                    onClick={addStage}
                                    className="text-sm text-neutral-600 dark:text-neutral-400"
                                >
                                    + 添加步骤
                                </button>
                            </div>

                            <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                                <div>
                                    总时间: {formatTime(calculateTotalTime())}
                                </div>
                                <div>
                                    总水量: {calculateCurrentWater()}g / {formatWater(method.params.water)}
                                </div>
                            </div>

                            {/* 顶部渐变阴影 - 作为导航的伪元素 */}
                            <div className="absolute mt-[72px] left-0 right-0 h-12 -bottom-12 bg-gradient-to-b from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
                        </div>

                        {/* 步骤内容 */}
                        <div className="space-y-10 pt-2 m-0" ref={stagesContainerRef}>

                            {method.params.stages.map((stage, index) => (
                                <div
                                    key={index}
                                    className="space-y-6 pb-6 border-neutral-200 dark:border-neutral-700 transition-colors duration-200"
                                    ref={index === method.params.stages.length - 1 ? newStageRef : null}
                                >
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                            步骤 {index + 1}
                                        </h4>
                                        {method.params.stages.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeStage(index)}
                                                className="text-xs text-neutral-500 dark:text-neutral-400"
                                            >
                                                删除
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-6">
                                        <div className="grid grid-cols-3 gap-6">
                                            <div className="space-y-2">
                                                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                                    注水方式
                                                </label>
                                                <select
                                                    value={stage.pourType}
                                                    onChange={(e) => handlePourTypeChange(index, e.target.value)}
                                                    className={`w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400 appearance-none ${!stage.pourType ? 'text-neutral-400 dark:text-neutral-500' : ''}`}
                                                >
                                                    <option value="" disabled>请选择注水方式</option>
                                                    <option value="center">中心注水</option>
                                                    <option value="circle">绕圈注水</option>
                                                    <option value="other">其他方式</option>
                                                </select>
                                            </div>
                                            <div className="col-span-2 space-y-2">
                                                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                                    步骤名称
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={stage.label}
                                                        onChange={(e) => handleStageChange(index, 'label', e.target.value)}
                                                        placeholder="请输入步骤名称"
                                                        className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                                                    />
                                                    {selectedEquipment === 'CleverDripper' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleValveStatus(index)}
                                                            className={`absolute right-0 bottom-2 px-2 py-1 text-xs rounded ${stage.valveStatus === 'open'
                                                                ? 'text-green-600 dark:text-green-400'
                                                                : 'text-red-600 dark:text-red-400'
                                                                }`}
                                                        >
                                                            {stage.valveStatus === 'open' ? '[开阀]' : '[关阀]'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                                    累计时间（秒）
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={
                                                        editingCumulativeTime && editingCumulativeTime.index === index
                                                            ? editingCumulativeTime.value
                                                            : stage.time ? stage.time.toString() : ''
                                                    }
                                                    onChange={(e) => {
                                                        // 更新本地编辑状态
                                                        setEditingCumulativeTime({
                                                            index,
                                                            value: e.target.value
                                                        });

                                                        // 如果输入为空，允许清空
                                                        if (!e.target.value.trim()) {
                                                            handleStageChange(index, 'time', 0);
                                                            return;
                                                        }

                                                        // 直接使用用户输入的值
                                                        const time = parseInt(e.target.value);
                                                        handleStageChange(index, 'time', time);
                                                    }}
                                                    onBlur={(e) => {
                                                        // 清除编辑状态
                                                        setEditingCumulativeTime(null);

                                                        // 在失去焦点时进行验证和调整
                                                        const value = e.target.value;

                                                        // 如果输入为空，设置为0
                                                        if (!value.trim()) {
                                                            handleStageChange(index, 'time', 0);
                                                            return;
                                                        }

                                                        // 直接使用用户输入的值
                                                        const time = parseInt(value) || 0;
                                                        handleStageChange(index, 'time', time);

                                                        // 自动设置注水时间
                                                        // 计算本阶段的时间（当前累计时间减去前一阶段的累计时间）
                                                        const previousTime = index > 0 ? method.params.stages[index - 1].time || 0 : 0;
                                                        const stageTime = time - previousTime;

                                                        // 只有当注水时间未设置或大于阶段时间时才自动设置
                                                        if (!stage.pourTime || stageTime < stage.pourTime) {
                                                            handleStageChange(index, 'pourTime', stageTime > 0 ? stageTime : 0);
                                                        }
                                                    }}
                                                    onFocus={(e) => e.target.select()}
                                                    className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                                    注水时间（秒）
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={stage.pourTime || ''}
                                                    onChange={(e) => {
                                                        const value = e.target.value
                                                        handleStageChange(index, 'pourTime', value ? parseInt(value) : 0)
                                                    }}
                                                    className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                                    累计水量
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        value={
                                                            editingCumulativeWater && editingCumulativeWater.index === index
                                                                ? editingCumulativeWater.value
                                                                : stage.water ? parseInt(stage.water.replace('g', '')).toString() : ''
                                                        }
                                                        onChange={(e) => {
                                                            // 更新本地编辑状态
                                                            setEditingCumulativeWater({
                                                                index,
                                                                value: e.target.value
                                                            });

                                                            // 如果输入为空，允许清空
                                                            if (!e.target.value.trim()) {
                                                                handleStageChange(index, 'water', '');
                                                                return;
                                                            }

                                                            // 直接使用用户输入的值
                                                            const water = parseInt(e.target.value);
                                                            handleStageChange(index, 'water', `${water}`);
                                                        }}
                                                        onBlur={(e) => {
                                                            // 清除编辑状态
                                                            setEditingCumulativeWater(null);

                                                            // 在失去焦点时进行验证和调整
                                                            const value = e.target.value;

                                                            // 如果输入为空，清空水量
                                                            if (!value.trim()) {
                                                                handleStageChange(index, 'water', '');
                                                                return;
                                                            }

                                                            // 直接使用用户输入的值
                                                            const water = parseInt(value) || 0;

                                                            // 确保累计水量不超过总水量
                                                            const totalWater = parseInt(method.params.water?.replace('', '') || '0');
                                                            if (water > totalWater) {
                                                                handleStageChange(index, 'water', `${totalWater}`);
                                                            } else {
                                                                handleStageChange(index, 'water', `${water}`);
                                                            }
                                                        }}
                                                        onFocus={(e) => e.target.select()}
                                                        className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                                                    />
                                                    <span className="absolute right-0 bottom-2 text-neutral-500 dark:text-neutral-400">g</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                                详细说明
                                            </label>
                                            <AutoResizeTextarea
                                                value={stage.detail}
                                                onChange={(e) => handleStageChange(index, 'detail', e.target.value)}
                                                placeholder="描述这个阶段的注水方式"
                                                className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 底部渐变阴影 - 提示有更多内容 */}
                        <div className="sticky bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
                    </motion.div>
                )

            case 'complete':
                return (
                    <motion.div
                        key="complete-step"
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                        className="flex flex-col items-center justify-center pt-10 space-y-8 text-center relative"
                    >
                        <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                            <Check className="w-8 h-8 text-neutral-800 dark:text-neutral-200" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-medium text-neutral-800 dark:text-neutral-200">
                                {initialMethod ? '方案编辑完成' : '方案创建完成'}
                            </h3>
                            <p className="text-neutral-600 dark:text-neutral-400">
                                你的咖啡冲煮方案已经准备就绪
                            </p>
                        </div>
                        <div className="w-full max-w-sm space-y-4 px-4">
                            <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                                <span className="text-sm text-neutral-500 dark:text-neutral-400">方案名称</span>
                                <span className="text-sm font-medium">{method.name}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                                <span className="text-sm text-neutral-500 dark:text-neutral-400">咖啡粉量</span>
                                <span className="text-sm font-medium">{method.params.coffee}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                                <span className="text-sm text-neutral-500 dark:text-neutral-400">水量</span>
                                <span className="text-sm font-medium">{method.params.water}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                                <span className="text-sm text-neutral-500 dark:text-neutral-400">粉水比</span>
                                <span className="text-sm font-medium">{method.params.ratio}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                                <span className="text-sm text-neutral-500 dark:text-neutral-400">总时间</span>
                                <span className="text-sm font-medium">{formatTime(calculateTotalTime())}</span>
                            </div>
                        </div>
                        {/* 底部渐变阴影 - 提示有更多内容 */}
                        <div className="sticky w-full bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
                    </motion.div>
                )

            default:
                return null
        }
    }

    // 渲染下一步按钮
    const renderNextButton = () => {
        const isLastStep = getCurrentStepIndex() === steps.length - 1

        // 验证当前步骤是否可以进行下一步
        const isStepValid = () => {
            switch (currentStep) {
                case 'name':
                    return !!method.name.trim();
                case 'params':
                    return !!method.params.coffee.trim() &&
                        !!method.params.water.trim() &&
                        !!method.params.ratio.trim() &&
                        !!method.params.temp.trim() &&
                        !!method.params.grindSize.trim();
                case 'stages':
                    return method.params.stages.length > 0 &&
                        method.params.stages.every(stage => {
                            // 基本验证
                            const basicValidation =
                                stage.time > 0 &&
                                !!stage.label.trim() &&
                                !!stage.water.trim() &&
                                !!stage.detail.trim() &&
                                !!stage.pourType;

                            // 如果是聪明杯，验证阀门状态
                            if (selectedEquipment === 'CleverDripper') {
                                return basicValidation &&
                                    (stage.valveStatus === 'open' || stage.valveStatus === 'closed');
                            }

                            return basicValidation;
                        });
                default:
                    return true;
            }
        };

        return (
            <div className="flex items-center justify-center my-8">
                <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={!isStepValid()}
                    className={`
                        flex items-center justify-center p-4
                                                        ${!isStepValid() ? 'opacity-50 cursor-not-allowed' : ''}
                                                        ${isLastStep ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800 px-6 py-3 rounded-full' : ''}
                    `}
                >
                    {isLastStep ? (
                        <span className="font-medium">完成</span>
                    ) : (
                        <div className="flex items-center relative">
                            <div className="w-24 h-0.5 bg-neutral-800 dark:bg-neutral-200"></div>
                            <div className="absolute -right-1 transform translate-x-0">
                                <ArrowRight className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
                            </div>
                        </div>
                    )}
                </button>
            </div>
        )
    }

    return (
        <motion.div
            ref={formRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col h-[calc(100vh-12rem)]"
        >
            {/* 顶部导航栏 */}
            <div className="flex items-center justify-between mt-3 mb-6">
                <button
                    type="button"
                    onClick={handleBack}
                    className="rounded-full"
                >
                    <ArrowLeft className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
                </button>
                <div className="w-full px-4">
                    {renderProgressBar()}

                </div>
                <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    {getCurrentStepIndex() + 1}/{steps.length}
                </div>
            </div>

            {/* 步骤内容 */}
            <div className="flex-1 overflow-y-auto pr-2">
                <AnimatePresence mode="wait">
                    {renderStepContent()}
                </AnimatePresence>
            </div>

            {/* 下一步按钮 */}
            {renderNextButton()}
        </motion.div >
    )
}

export default CustomMethodForm 