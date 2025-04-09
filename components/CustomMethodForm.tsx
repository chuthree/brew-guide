'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type Method, CustomEquipment } from '@/lib/config'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import AutoResizeTextarea from './AutoResizeTextarea'
import { formatGrindSize } from '@/lib/grindUtils'
import { SettingsOptions } from '@/components/Settings'
import { Storage } from '@/lib/storage'

// 自定义注水动画类型
interface _CustomPourAnimation {
    id: string;
    name: string;
    customAnimationSvg: string;
    isSystemDefault?: boolean;
    pourType?: 'center' | 'circle' | 'ice' | 'other';
}

// 定义基础的 Stage 类型
interface _Stage {
    time: number;
    pourTime?: number;
    label: string;
    water: string;
    detail: string;
    pourType?: string;
    valveStatus?: 'open' | 'closed';
}

// 扩展Stage类型以支持自定义注水动画ID
type _ExtendedPourType = string;

// 扩展Stage类型
interface _ExtendedStage extends _Stage {
    pourType?: _ExtendedPourType;
}

// 修改 Method 接口以使用新的 Stage 类型
interface _Method extends Omit<Method, 'params'> {
    params: {
        coffee: string;
        water: string;
        ratio: string;
        grindSize: string;
        temp: string;
        videoUrl: string;
        stages: _Stage[];
    };
}

// 定义步骤类型
type _Step = 'name' | 'params' | 'stages' | 'complete';

// 修改组件 props 类型
interface CustomMethodFormProps {
    initialMethod?: _Method;
    customEquipment: CustomEquipment;
    onSave: (method: _Method) => void;
    onBack: () => void;
}

const CustomMethodForm: React.FC<CustomMethodFormProps> = ({
    initialMethod,
    customEquipment,
    onSave,
    onBack,
}) => {
    // 当前步骤状态
    const [currentStep, setCurrentStep] = useState<_Step>('name')
    const formRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const stagesContainerRef = useRef<HTMLDivElement>(null)
    const newStageRef = useRef<HTMLDivElement>(null)

    // 添加一个状态来跟踪正在编辑的累计时间输入
    const [editingCumulativeTime, setEditingCumulativeTime] = useState<{ index: number, value: string } | null>(null)
    // 添加一个状态来跟踪正在编辑的累计水量输入
    const [editingCumulativeWater, setEditingCumulativeWater] = useState<{ index: number, value: string } | null>(null)

    const [method, setMethod] = useState<_Method>(() => {
        // 如果有初始方法，直接使用
        if (initialMethod) {
            // 如果是聪明杯，确保从标签中移除阀门状态标记
            if (customEquipment.hasValve && initialMethod.params.stages) {
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

        // 检查是否是自定义预设类型
        const isCustomPreset = customEquipment.animationType === 'custom';
        console.log(`[CustomMethodForm] 器具类型: ${customEquipment.animationType}, 是否自定义预设: ${isCustomPreset}`);

        // 对于自定义预设，不设置初始步骤，让用户完全自由创建
        if (isCustomPreset) {
            console.log('[CustomMethodForm] 自定义预设器具，不使用预置步骤');
            return {
                name: '',
                params: {
                    coffee: '15g',
                    water: '225g', // 15 * 15 = 225
                    ratio: '1:15',
                    grindSize: '中细',
                    temp: '92°C',
                    videoUrl: '',
                    stages: [], // 不添加任何初始步骤
                },
            };
        }

        // 确定默认注水类型，基于自定义器具的配置
        let defaultPourType: 'center' | 'circle' | 'ice' | 'other' = 'circle';
        
        // 检查自定义器具是否有自定义注水动画
        if (customEquipment.customPourAnimations && customEquipment.customPourAnimations.length > 0) {
            // 查找默认注水动画
            const defaultAnimation = customEquipment.customPourAnimations.find(
                anim => anim.isSystemDefault && anim.pourType
            );
            
            if (defaultAnimation && defaultAnimation.pourType) {
                console.log(`[CustomMethodForm] 使用自定义器具的默认注水类型: ${defaultAnimation.pourType}`);
                defaultPourType = defaultAnimation.pourType;
            } else if (customEquipment.customPourAnimations.length > 0) {
                // 如果没有默认动画，使用第一个动画的注水类型（如果有）
                const firstAnimation = customEquipment.customPourAnimations[0];
                if (firstAnimation.pourType) {
                    console.log(`[CustomMethodForm] 使用自定义器具的第一个注水类型: ${firstAnimation.pourType}`);
                    defaultPourType = firstAnimation.pourType;
                }
            }
        } else {
            // 根据器具类型选择默认注水类型
            console.log(`[CustomMethodForm] 使用基于器具类型的默认注水类型，器具类型: ${customEquipment.animationType}`);
            switch (customEquipment.animationType) {
                case 'v60':
                case 'origami':
                    defaultPourType = 'circle'; // V60和Origami默认使用绕圈注水
                    break;
                case 'kalita':
                    defaultPourType = 'center'; // Kalita默认使用中心注水
                    break;
                default:
                    defaultPourType = 'circle'; // 默认使用绕圈注水
            }
        }

        // 创建初始步骤和基本参数
        const initialStage: _Stage = {
            time: 25,
            pourTime: 10,
            label: '焖蒸',
            water: '30g', // 咖啡粉量的2倍
            detail: '使咖啡粉充分吸水并释放气体，提升萃取效果',
            pourType: defaultPourType,
            ...(customEquipment.hasValve ? { valveStatus: 'closed' as 'closed' | 'open' } : {})
        };

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
        grindType: '通用',
        textZoomLevel: 1.0,
        language: 'zh'
    });

    // 加载设置
    useEffect(() => {
        if (localSettings) {
            setLocalSettings(localSettings);
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
    }, [localSettings]);

    // 点击外部关闭
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (formRef.current && !formRef.current.contains(event.target as Node)) {
                // 确保 onBack 是一个函数
                if (typeof onBack === 'function') {
                    onBack();
                }
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [onBack])

    // 自动聚焦输入框
    useEffect(() => {
        if (currentStep === 'name' && inputRef.current) {
            inputRef.current.focus()
        }
    }, [currentStep])

    // 步骤配置
    const steps: { id: _Step; label: string }[] = [
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
            // 只处理步骤切换
            setCurrentStep(steps[currentIndex + 1].id)
        }
        // 移除了提交逻辑，因为这已经在handleButtonClick中处理
    }

    // 上一步/返回
    const handleBack = () => {
        const steps: { id: _Step }[] = [
            { id: 'name' },
            { id: 'params' },
            { id: 'stages' },
            { id: 'complete' }
        ];
        const currentIndex = steps.findIndex(step => step.id === currentStep);
        if (currentIndex > 0) {
            setCurrentStep(steps[currentIndex - 1].id);
        } else {
            onBack();
        }
    }

    const getDefaultStageLabel = (pourType: string) => {
        // 检查是否是自定义预设
        const isCustomPreset = customEquipment.animationType === 'custom';
        
        // 对于自定义预设的"other"类型，使用空标签
        if (isCustomPreset && pourType === 'other') {
            return '';
        }
        
        // 检查是否是自定义注水动画ID
        if (customEquipment.customPourAnimations) {
            const customAnimation = customEquipment.customPourAnimations.find(
                anim => anim.id === pourType
            );
            if (customAnimation) {
                return customAnimation.name;
            }
        }
        
        // 首先检查自定义器具是否有对应注水类型的自定义标签
        if (customEquipment.customPourAnimations) {
            const animation = customEquipment.customPourAnimations.find(
                anim => anim.pourType === pourType
            );
            if (animation && animation.name) {
                return animation.name;
            }
        }
        
        // 默认标签
        switch (pourType) {
            case 'circle':
                return '绕圈注水'
            case 'center':
                return '中心注水'
            case 'ice':
                return '冰块注水'
            case 'other':
                return ''
            default:
                return '注水'
        }
    }

    const getDefaultStageDetail = (pourType: string) => {
        // 检查是否是自定义预设
        const isCustomPreset = customEquipment.animationType === 'custom';
        
        // 对于自定义预设的"other"类型，使用空详情
        if (isCustomPreset && pourType === 'other') {
            return '';
        }
        
        // 检查是否是自定义注水动画ID
        if (customEquipment.customPourAnimations) {
            const customAnimation = customEquipment.customPourAnimations.find(
                anim => anim.id === pourType
            );
            if (customAnimation) {
                return `使用${customAnimation.name}注水`;
            }
        }
        
        // 针对不同注水类型的默认详情
        switch (pourType) {
            case 'circle':
                return '中心向外缓慢画圈注水，均匀萃取咖啡风味'
            case 'center':
                return '中心定点注水，降低萃取率'
            case 'ice':
                return '添加冰块，降低温度进行冷萃'
            case 'other':
                return ''
            default:
                return '注水'
        }
    }

    const handleStageChange = (index: number, field: keyof _Stage, value: string | number) => {
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
            stage[field] = value as string
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
        // 检查是否是自定义预设
        const isCustomPreset = customEquipment.animationType === 'custom';
        
        // 对于自定义预设，尝试使用第一个自定义动画作为默认值
        let defaultPourType: string | undefined = undefined;
        if (isCustomPreset && customEquipment.customPourAnimations && customEquipment.customPourAnimations.length > 0) {
            // 使用第一个非系统默认的自定义动画
            const firstCustomAnimation = customEquipment.customPourAnimations.find(anim => !anim.isSystemDefault);
            if (firstCustomAnimation) {
                defaultPourType = firstCustomAnimation.id;
                console.log('[CustomMethodForm] 使用第一个自定义动画作为默认值:', {
                    name: firstCustomAnimation.name,
                    id: firstCustomAnimation.id
                });
            }
        }
        
        // 所有新添加的步骤都使用空值
        const newStage: _Stage = {
            time: 0,
            // pourTime默认为undefined而不是0
            label: '',
            water: '',
            detail: '',
            pourType: isCustomPreset ? (defaultPourType as string) : 'circle',
            ...(customEquipment.hasValve ? { valveStatus: 'closed' as 'closed' | 'open' } : {})
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
        const finalMethod = JSON.parse(JSON.stringify(method)) as _Method;

        // 如果是聪明杯，将阀门状态添加到步骤名称中
        if (customEquipment.hasValve && finalMethod.params.stages) {
            finalMethod.params.stages = finalMethod.params.stages.map(stage => {
                if (stage.valveStatus) {
                    const valveStatusText = stage.valveStatus === 'open' ? '[开阀]' : '[关阀]';
                    // 确保没有重复添加
                    const baseLabel = stage.label.replace(/\s*\[开阀\]|\s*\[关阀\]/g, '').trim();
                    return {
                        ...stage,
                        label: `${valveStatusText}${baseLabel}`.trim()
                    };
                }
                return stage;
            });
        }

        try {

            // 保存方法
            onSave(finalMethod);


            // 如果有需要，可以在这里添加返回主页面的逻辑
        } catch {

            // 可以在这里添加用户友好的错误提示
            alert('保存方案失败，请重试');
        }
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
        const stage = { ...newStages[index] } as _ExtendedStage
        const isCustomPreset = customEquipment.animationType === 'custom';

        // 检查是否选择了自定义注水动画（自定义注水动画的值是ID而不是pourType类型）
        const isCustomAnimation = value !== 'center' && value !== 'circle' && value !== 'ice' && value !== 'other';
        
        console.log('[CustomMethodForm] 选择注水类型:', {
            value,
            isCustomAnimation,
            customAnimations: customEquipment.customPourAnimations,
            matchedAnimation: customEquipment.customPourAnimations?.find(anim => anim.id === value)
        });
        
        if (isCustomAnimation) {
            // 查找对应的自定义注水动画
            const customAnimation = customEquipment.customPourAnimations?.find(anim => anim.id === value);
            
            if (customAnimation) {
                console.log(`[CustomMethodForm] 选择了自定义注水动画:`, {
                    name: customAnimation.name,
                    id: customAnimation.id,
                    pourType: value
                });
                
                // 直接使用自定义动画的 ID 作为 pourType
                stage.pourType = value as string;
                
                // 更新标签和详情（如果为空）
                if (!stage.label || stage.label === getDefaultStageLabel('center') || 
                    stage.label === getDefaultStageLabel('circle') || 
                    stage.label === getDefaultStageLabel('ice') || 
                    stage.label === getDefaultStageLabel('other') ||
                    stage.label === '注水') {
                    stage.label = customAnimation.name;
                }
                
                // 如果详情为空或是默认详情，使用自定义动画的名称作为详情
                if (!stage.detail || 
                    stage.detail === getDefaultStageDetail('center') || 
                    stage.detail === getDefaultStageDetail('circle') || 
                    stage.detail === getDefaultStageDetail('ice') || 
                    stage.detail === getDefaultStageDetail('other') ||
                    stage.detail === '注水' ||
                    stage.detail === '使咖啡粉充分吸水并释放气体，提升萃取效果') {
                    stage.detail = `使用${customAnimation.name}注水`;
                }
                
                // 将新的stage对象赋值给当前的stage
                newStages[index] = stage;
                
                setMethod({
                    ...method,
                    params: {
                        ...method.params,
                        stages: newStages,
                    },
                });
                
                // 提前返回，不执行后面的逻辑
                return;
            }
        } else {
            // 原有的标准注水类型处理逻辑
            // 更新注水类型
            stage.pourType = value as string;

            // 处理标签和详情
            // 对于自定义预设，如果选择'other'，不做特殊处理，保留用户输入
            if (isCustomPreset && value === 'other') {
                // 保持标签和详情不变
            }
            // 如果选择的是"其他方式"，清空之前自动填写的步骤名称和详细说明
            else if (value === 'other') {
                stage.label = ''
                stage.detail = ''
            }
            // 如果选择的不是"其他方式"，且标签为空或是默认标签，则更新标签
            else if (
                !stage.label ||
                stage.label === '绕圈注水' ||
                stage.label === '中心注水' ||
                stage.label === '冰块注水' ||
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
                    stage.detail === '添加冰块，降低温度进行冷萃' ||
                    stage.detail === '自定义注水方式' ||
                    stage.detail === '注水' ||
                    stage.detail === '使咖啡粉充分吸水并释放气体，提升萃取效果'
                )
            ) {
                stage.detail = getDefaultStageDetail(value)
            }
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
                        className="flex flex-col items-center pt-10 pb-20"
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
                        className="space-y-10 max-w-md mx-auto pt-10 pb-20"
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
                                                    className={`w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400 appearance-none ${!stage.pourType ? 'text-neutral-500 dark:text-neutral-400' : ''}`}
                                                >
                                                    <option value="" disabled>请选择注水方式</option>
                                                    {/* 显示自定义器具的自定义注水动画 */}
                                                    {customEquipment.customPourAnimations && customEquipment.customPourAnimations.length > 0 ? (
                                                        <>
                                                            {/* 用户创建的自定义注水动画 */}
                                                            {customEquipment.customPourAnimations
                                                                .filter(anim => !anim.isSystemDefault)
                                                                .map(animation => (
                                                                    <option key={animation.id} value={animation.id}>
                                                                        {animation.name}
                                                                    </option>
                                                                ))
                                                            }
                                                            {/* 如果不是自定义预设，才显示系统默认注水方式 */}
                                                            {customEquipment.animationType !== 'custom' && (
                                                                <>
                                                                    {/* 系统默认注水方式 */}
                                                                    {customEquipment.customPourAnimations
                                                                        .filter(anim => anim.isSystemDefault && anim.pourType)
                                                                        .map(animation => (
                                                                            <option key={animation.id} value={animation.pourType || ''}>
                                                                                {animation.name}
                                                                            </option>
                                                                        ))
                                                                    }
                                                                    {/* 如果没有中心注水/绕圈注水/冰块注水的系统预设，添加它们 */}
                                                                    {!customEquipment.customPourAnimations.some(a => a.pourType === 'center') && 
                                                                        <option value="center">中心注水</option>
                                                                    }
                                                                    {!customEquipment.customPourAnimations.some(a => a.pourType === 'circle') && 
                                                                        <option value="circle">绕圈注水</option>
                                                                    }
                                                                    {!customEquipment.customPourAnimations.some(a => a.pourType === 'ice') && 
                                                                        <option value="ice">冰块注水</option>
                                                                    }
                                                                    <option value="other">其他方式</option>
                                                                </>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            {/* 自定义预设器具显示更简化的选项列表 */}
                                                            {customEquipment.animationType === 'custom' ? (
                                                                <>
                                                                    <option value="other">自定义方式</option>
                                                                    {/* 添加提示信息 */}
                                                                    <option value="" disabled style={{ fontStyle: 'italic', color: '#999' }}>
                                                                        提示：可在器具设置中添加自定义注水动画
                                                                    </option>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <option value="center">中心注水</option>
                                                                    <option value="circle">绕圈注水</option>
                                                                    <option value="ice">冰块注水</option>
                                                                    <option value="other">其他方式</option>
                                                                </>
                                                            )}
                                                        </>
                                                    )}
                                                </select>
                                            </div>
                                            <div className="col-span-2 space-y-2">
                                                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                                    步骤名称
                                                </label>
                                                <div className="relative">
                                                    {customEquipment.hasValve && (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleValveStatus(index)}
                                                            className={`absolute left-0 bottom-2 px-2 py-1 text-xs rounded ${stage.valveStatus === 'open'
                                                                ? 'text-green-600 dark:text-green-400'
                                                                : 'text-red-600 dark:text-red-400'
                                                                }`}
                                                        >
                                                            {stage.valveStatus === 'open' ? '[开阀]' : '[关阀]'}
                                                        </button>
                                                    )}
                                                    <input
                                                        type="text"
                                                        value={stage.label}
                                                        onChange={(e) => handleStageChange(index, 'label', e.target.value)}
                                                        placeholder="请输入步骤名称"
                                                        className={`w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400 ${customEquipment.hasValve ? 'pl-12' : ''}`}
                                                    />
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

                                                        // 如果时长有效且注水时长未设置或超出合理范围，则自动设置注水时长
                                                        if (stageTime > 0 && (!stage.pourTime || stage.pourTime > stageTime)) {
                                                            handleStageChange(index, 'pourTime', stageTime);
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
                                                    value={stage.pourTime !== undefined && stage.pourTime !== null ? stage.pourTime : ''}
                                                    onChange={(e) => {
                                                        const value = e.target.value
                                                        // 允许为真正的空值
                                                        if (value === '') {
                                                            // 删除pourTime属性而不是设置为null
                                                            const newStage = { ...stage };
                                                            delete newStage.pourTime;

                                                            const newStages = [...method.params.stages];
                                                            newStages[index] = newStage;

                                                            setMethod({
                                                                ...method,
                                                                params: {
                                                                    ...method.params,
                                                                    stages: newStages,
                                                                },
                                                            });
                                                        } else {
                                                            // 获取用户输入的值
                                                            const pourTime = parseInt(value);

                                                            // 计算当前阶段的实际可用时长
                                                            const previousTime = index > 0 ? method.params.stages[index - 1].time || 0 : 0;
                                                            const stageTime = stage.time - previousTime;

                                                            // 如果注水时长超过阶段时长，则修正为阶段时长
                                                            if (pourTime > stageTime && stageTime > 0) {
                                                                handleStageChange(index, 'pourTime', stageTime);
                                                            } else {
                                                                handleStageChange(index, 'pourTime', pourTime);
                                                            }
                                                        }
                                                    }}
                                                    onBlur={(e) => {
                                                        // 在失去焦点时再次验证和调整
                                                        const value = e.target.value;

                                                        // 如果输入为空，则删除pourTime属性
                                                        if (!value.trim()) {
                                                            const newStage = { ...stage };
                                                            delete newStage.pourTime;

                                                            const newStages = [...method.params.stages];
                                                            newStages[index] = newStage;

                                                            setMethod({
                                                                ...method,
                                                                params: {
                                                                    ...method.params,
                                                                    stages: newStages,
                                                                },
                                                            });
                                                            return;
                                                        }

                                                        // 如果有值，确保不超过阶段时长
                                                        const pourTime = parseInt(value);
                                                        const previousTime = index > 0 ? method.params.stages[index - 1].time || 0 : 0;
                                                        const stageTime = stage.time - previousTime;

                                                        if (pourTime > stageTime && stageTime > 0) {
                                                            handleStageChange(index, 'pourTime', stageTime);
                                                        }
                                                    }}
                                                    placeholder="可选"
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

                                                            // 确保累计水量不超过总水量
                                                            const totalWater = parseInt(method.params.water || '0');
                                                            if (water > totalWater) {
                                                                handleStageChange(index, 'water', `${totalWater}`);
                                                            } else {
                                                                handleStageChange(index, 'water', `${water}`);
                                                            }
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
                                                            const totalWater = parseInt(method.params.water || '0');
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
        const isCustomPreset = customEquipment.animationType === 'custom';

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
                            // 针对自定义预设器具放宽一些验证要求
                            if (isCustomPreset) {
                                // 基本验证 - 对自定义预设只验证时间和水量
                                const basicValidation = stage.time > 0 && !!stage.water.trim();
                                
                                // 如果是聪明杯，验证阀门状态
                                if (customEquipment.hasValve) {
                                    return basicValidation &&
                                        (stage.valveStatus === 'open' || stage.valveStatus === 'closed');
                                }
                                
                                return basicValidation;
                            } else {
                                // 标准器具的正常验证
                                const basicValidation =
                                    stage.time > 0 &&
                                    !!stage.label.trim() &&
                                    !!stage.water.trim() &&
                                    !!stage.pourType;
                                // 注水时长和详细说明可以为空，不作为必填项
                                
                                // 如果是聪明杯，验证阀门状态
                                if (customEquipment.hasValve) {
                                    return basicValidation &&
                                        (stage.valveStatus === 'open' || stage.valveStatus === 'closed');
                                }
                                
                                return basicValidation;
                            }
                        });
                case 'complete':
                    return true;
                default:
                    return true;
            }
        };

        // 检查当前步骤是否有效
        const stepValid = isStepValid();


        // 处理按钮点击
        const handleButtonClick = () => {


            if (isLastStep) {
                // 如果是最后一步，直接提交

                try {
                    handleSubmit();
                } catch {

                }
            } else {
                // 否则进入下一步

                handleNextStep();
            }
        };

        return (
            <div className="modal-bottom-button flex items-center justify-center">
                <button
                    type="button"
                    onClick={handleButtonClick}
                    disabled={!stepValid}
                    className={`
                        flex items-center justify-center p-4
                        ${!stepValid ? 'opacity-50 cursor-not-allowed' : ''}
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