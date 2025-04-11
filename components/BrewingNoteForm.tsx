'use client'

import React, { useState, useEffect, useRef } from 'react'

// 从 types.ts 导入 BrewingNoteData 类型
import type { BrewingNoteData, CoffeeBean } from '@/app/types'
import { generateOptimizationJson } from '@/lib/jsonUtils'
import { brewingMethods, type Method, type Stage } from '@/lib/config'
// import { Storage } from '@/lib/storage'
import AutoResizeTextarea from './AutoResizeTextarea'
import { Capacitor } from '@capacitor/core'
import { BeanMethodManager } from '@/lib/beanMethodManager'

interface TasteRatings {
    acidity: number;
    sweetness: number;
    bitterness: number;
    body: number;
}

interface FormData {
    coffeeBeanInfo: {
        name: string;
        roastLevel: string;
        roastDate: string;
    };
    rating: number;
    taste: TasteRatings;
    notes: string;
}

interface BrewingNoteFormProps {
    id?: string;
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: BrewingNoteData) => void;
    initialData: Partial<BrewingNoteData> & {
        coffeeBean?: CoffeeBean | null;
    };
    showOptimizationByDefault?: boolean;
}

const BrewingNoteForm: React.FC<BrewingNoteFormProps> = ({
    id,
    isOpen,
    onClose,
    onSave,
    initialData,
    showOptimizationByDefault = false,
}) => {
    // 处理咖啡豆数据，如果有提供coffeeBean则使用，否则使用coffeeBeanInfo
    const initialCoffeeBeanInfo = initialData.coffeeBean
        ? {
            name: initialData.coffeeBean.name || '',
            roastLevel: initialData.coffeeBean.roastLevel || '中度烘焙',
            roastDate: initialData.coffeeBean.roastDate || ''
        }
        : {
            name: initialData.coffeeBeanInfo?.name || '',
            roastLevel: initialData.coffeeBeanInfo?.roastLevel || '中度烘焙',
            roastDate: initialData.coffeeBeanInfo?.roastDate || '',
        };

    const [formData, setFormData] = useState<FormData>({
        coffeeBeanInfo: initialCoffeeBeanInfo,
        rating: initialData?.rating || 3,
        taste: {
            acidity: initialData?.taste?.acidity || 0,
            sweetness: initialData?.taste?.sweetness || 0,
            bitterness: initialData?.taste?.bitterness || 0,
            body: initialData?.taste?.body || 0,
        },
        notes: initialData?.notes || '',
    });

    // 添加优化相关状态，初始化理想风味为当前风味
    const [showOptimization, setShowOptimization] = useState(showOptimizationByDefault) // 控制是否显示优化界面，由外部传入默认值
    const [idealTaste, setIdealTaste] = useState<TasteRatings>({
        acidity: initialData?.taste?.acidity || 3,
        sweetness: initialData?.taste?.sweetness || 3,
        bitterness: initialData?.taste?.bitterness || 3,
        body: initialData?.taste?.body || 3,
    })
    const [optimizationNotes, setOptimizationNotes] = useState('')
    const [optimizationPrompt, setOptimizationPrompt] = useState('')

    // 添加方案参数状态
    const [methodParams, setMethodParams] = useState({
        coffee: initialData?.params?.coffee || '15g',
        water: initialData?.params?.water || '225g',
        ratio: initialData?.params?.ratio || '1:15',
        grindSize: initialData?.params?.grindSize || '中细',
        temp: initialData?.params?.temp || '92°C',
    });

    // 添加保存成功状态
    const [saveSuccess, setSaveSuccess] = useState(false);

    // 添加平台检测状态
    const [isAndroid, setIsAndroid] = useState(false)
    const [isIOS, setIsIOS] = useState(false)
    
    // 添加表单ref
    const formRef = useRef<HTMLFormElement>(null)
    
    // 检测平台
    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            const platform = Capacitor.getPlatform()
            setIsAndroid(platform === 'android')
            setIsIOS(platform === 'ios')
        }
    }, [])
    
    // 监听输入框聚焦，确保滚动到可见区域
    useEffect(() => {
        if (!isOpen) return
        
        const form = formRef.current
        if (!form) return
        
        const handleInputFocus = (e: Event) => {
            const target = e.target as HTMLElement
            
            // 确定是否为输入元素
            if (
                target && 
                (target.tagName === 'INPUT' || 
                 target.tagName === 'TEXTAREA' || 
                 target.tagName === 'SELECT')
            ) {
                // 为所有平台添加自动滚动
                setTimeout(() => {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    })
                }, 300)
            }
        }
        
        // 监听表单内的聚焦事件
        form.addEventListener('focusin', handleInputFocus)
        
        return () => {
            form.removeEventListener('focusin', handleInputFocus)
        }
    }, [isOpen])

    // Update form data when initialData changes
    useEffect(() => {
        if (initialData) {
            // 标准化烘焙度值，确保与下拉列表选项匹配
            const normalizeRoastLevel = (roastLevel?: string): string => {
                if (!roastLevel) return '中度烘焙';
                
                // 如果已经是完整格式，直接返回
                if (roastLevel.endsWith('烘焙')) return roastLevel;
                
                // 否则添加"烘焙"后缀
                if (roastLevel === '浅度') return '浅度烘焙';
                if (roastLevel === '中浅') return '中浅烘焙';
                if (roastLevel === '中度') return '中度烘焙';
                if (roastLevel === '中深') return '中深烘焙';
                if (roastLevel === '深度') return '深度烘焙';
                
                // 尝试匹配部分字符串
                if (roastLevel.includes('浅')) return '浅度烘焙';
                if (roastLevel.includes('中浅')) return '中浅烘焙';
                if (roastLevel.includes('中深')) return '中深烘焙';
                if (roastLevel.includes('深')) return '深度烘焙';
                if (roastLevel.includes('中')) return '中度烘焙';
                
                // 默认返回中度烘焙
                return '中度烘焙';
            };
            
            // 重新处理咖啡豆数据
            const coffeeBeanInfo = initialData.coffeeBean
                ? {
                    name: initialData.coffeeBean.name || '',
                    roastLevel: normalizeRoastLevel(initialData.coffeeBean.roastLevel),
                    roastDate: initialData.coffeeBean.roastDate || ''
                }
                : {
                    name: initialData.coffeeBeanInfo?.name || '',
                    roastLevel: normalizeRoastLevel(initialData.coffeeBeanInfo?.roastLevel),
                    roastDate: initialData.coffeeBeanInfo?.roastDate || '',
                };

            setFormData({
                coffeeBeanInfo: coffeeBeanInfo,
                rating: initialData.rating || 3,
                taste: {
                    acidity: initialData.taste?.acidity || 0,
                    sweetness: initialData.taste?.sweetness || 0,
                    bitterness: initialData.taste?.bitterness || 0,
                    body: initialData.taste?.body || 0,
                },
                notes: initialData.notes || '',
            })

            // 更新方案参数
            if (initialData.params) {
                setMethodParams({
                    coffee: initialData.params.coffee || '15g',
                    water: initialData.params.water || '225g',
                    ratio: initialData.params.ratio || '1:15',
                    grindSize: initialData.params.grindSize || '中细',
                    temp: initialData.params.temp || '92°C',
                });
            }

            // Show flavor ratings section if any rating is greater than 0
            if (initialData.taste && Object.values(initialData.taste).some(value => value > 0)) {
                setShowFlavorRatings(true);
            }
        }
    }, [initialData])

    // 添加useEffect来处理showOptimizationByDefault的变化
    useEffect(() => {
        // 当外部传入的showOptimizationByDefault变化时，更新内部状态
        setShowOptimization(showOptimizationByDefault)
    }, [showOptimizationByDefault])

    const [isFromBeanMethod, setIsFromBeanMethod] = useState(false)
    const [currentBeanMethodId, setCurrentBeanMethodId] = useState<string | null>(null)

    // 在组件加载时检查是否来自常用方案
    useEffect(() => {
        const checkBeanMethod = async () => {
            if (!initialData.coffeeBean?.id) return;
            
            try {
                const methods = await BeanMethodManager.getBeanMethods(initialData.coffeeBean.id);
                const matchingMethod = methods.find(method => 
                    method.equipmentId === initialData.equipment &&
                    method.methodId === initialData.method
                );
                
                if (matchingMethod) {
                    setIsFromBeanMethod(true);
                    setCurrentBeanMethodId(matchingMethod.id);
                }
            } catch (error) {
                console.error('检查常用方案时出错:', error);
            }
        };
        
        checkBeanMethod();
    }, [initialData.coffeeBean?.id, initialData.equipment, initialData.method]);

    // 保存笔记的处理函数
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // 创建完整的笔记数据
        const noteData: BrewingNoteData = {
            id: id || Date.now().toString(),
            timestamp: Date.now(),
            ...formData,
            equipment: initialData.equipment,
            method: initialData.method,
            params: methodParams,
            totalTime: initialData.totalTime,
        };

        try {
            // 如果是来自常用方案，则更新常用方案的参数
            if (isFromBeanMethod && currentBeanMethodId) {
                await BeanMethodManager.updateMethod(currentBeanMethodId, {
                    params: {
                        coffee: methodParams.coffee,
                        water: methodParams.water,
                        grindSize: methodParams.grindSize,
                        temp: methodParams.temp,
                        ratio: methodParams.ratio
                    }
                });
            }

            // 保存笔记
            onSave(noteData);
        } catch (error) {
            console.error('保存笔记时出错:', error);
            alert('保存笔记时出错，请重试');
        }
    }

    // 保存为常用方案的处理函数
    const saveAsBeanMethod = async () => {
        // 检查是否选择了咖啡豆
        if (!initialData.coffeeBean?.id) {
            alert('请先选择咖啡豆，才能保存为常用方案');
            return;
        }

        // 确保有设备和方法信息
        if (!initialData.equipment || !initialData.method) {
            alert('缺少设备或方法信息，无法保存为常用方案');
            return;
        }

        try {
            // 创建方案数据
            const beanMethod = {
                beanId: initialData.coffeeBean.id,
                equipmentId: initialData.equipment,
                methodId: initialData.method,
                notes: formData.notes || '',
                params: {
                    coffee: methodParams.coffee,
                    water: methodParams.water,
                    ratio: methodParams.ratio || '1:15',
                    grindSize: methodParams.grindSize,
                    temp: methodParams.temp
                }
            };

            // 保存为咖啡豆的常用方案
            const result = await BeanMethodManager.addMethod(beanMethod);
            
            if (result) {
                // 显示成功状态
                setSaveSuccess(true);
                
                // 3秒后自动隐藏成功提示
                setTimeout(() => {
                    setSaveSuccess(false);
                }, 3000);
                
                // 同时保存笔记
                const noteData: BrewingNoteData = {
                    id: id || Date.now().toString(),
                    timestamp: Date.now(),
                    ...formData,
                    equipment: initialData.equipment,
                    method: initialData.method,
                    params: methodParams,
                    totalTime: initialData.totalTime,
                };
                
                onSave(noteData);
            } else {
                alert('保存常用方案失败，请重试');
            }
        } catch (error) {
            console.error('保存常用方案出错:', error);
            alert('保存常用方案时出错，请重试');
        }
    };

    const [isDragging, /*setIsDragging*/] = useState(false)
    const [currentValue, setCurrentValue] = useState<number | null>(null)

    const handleTouchStart = (key: string, value: number) => (e: React.TouchEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setCurrentValue(value)
    }

    const handleTouchMove = (key: string) => (e: React.TouchEvent) => {
        if (currentValue === null) return

        const touch = e.touches[0]
        const target = e.currentTarget as HTMLInputElement
        const rect = target.getBoundingClientRect()
        const width = rect.width
        const x = touch.clientX - rect.left
        const percentage = Math.max(0, Math.min(1, x / width))
        const newValue = Math.round(percentage * 4) + 1

        if (newValue !== currentValue) {
            setFormData({
                ...formData,
                taste: {
                    ...formData.taste,
                    [key]: newValue,
                },
            })
            setCurrentValue(newValue)
        }
    }

    const handleTouchEnd = () => {
        setCurrentValue(null)
    }

    // 处理优化相关的触摸事件
    const handleOptimizationTouchStart = (key: string, value: number) => (e: React.TouchEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setCurrentValue(value)
    }

    const handleOptimizationTouchMove = (key: string) => (e: React.TouchEvent) => {
        if (currentValue === null) return

        const touch = e.touches[0]
        const target = e.currentTarget as HTMLInputElement
        const rect = target.getBoundingClientRect()
        const width = rect.width
        const x = touch.clientX - rect.left
        const percentage = Math.max(0, Math.min(1, x / width))
        const newValue = Math.round(percentage * 4) + 1

        if (newValue !== currentValue) {
            setIdealTaste({
                ...idealTaste,
                [key]: newValue,
            })
            setCurrentValue(newValue)
        }
    }

    // 生成优化提示词
    const generateOptimizationPrompt = () => {
        if (!initialData) return

        // 计算理想风味与当前风味的差异
        const tasteDifference = {
            acidity: idealTaste.acidity - formData.taste.acidity,
            sweetness: idealTaste.sweetness - formData.taste.sweetness,
            bitterness: idealTaste.bitterness - formData.taste.bitterness,
            body: idealTaste.body - formData.taste.body,
        }

        const tasteChanges = Object.entries(tasteDifference).map(([key, diff]) => {
            const tasteName = {
                acidity: '酸度',
                sweetness: '甜度',
                bitterness: '苦度',
                body: '醇度',
            }[key]

            if (diff > 0) {
                return `${tasteName}需要增加${diff}点`
            } else if (diff < 0) {
                return `${tasteName}需要减少${Math.abs(diff)}点`
            }
            return null
        }).filter(Boolean).join('，')

        // 获取stages数据
        let stages: Stage[] = [];
        // 首先尝试从initialData.stages获取
        if (Array.isArray(initialData.stages)) {
            stages = initialData.stages;
        }
        // 如果没有，尝试从brewingMethods中获取
        else if (initialData.equipment && initialData.method) {
            // 查找对应的方法
            if (brewingMethods[initialData.equipment]) {
                const method = brewingMethods[initialData.equipment].find(
                    (m: Method) => m.name === initialData.method
                );
                if (method && Array.isArray(method.params.stages)) {
                    stages = method.params.stages;
                }
            }
        }

        // 使用工具函数生成优化JSON
        const configJson = generateOptimizationJson(
            initialData.equipment || '',
            initialData.method || '',
            {
                name: formData.coffeeBeanInfo.name || '',
                roastLevel: formData.coffeeBeanInfo.roastLevel || '中度烘焙',
                roastDate: formData.coffeeBeanInfo.roastDate || '',
            },
            methodParams, // 使用当前编辑的方案参数
            stages, // 使用获取到的stages
            formData.taste,
            idealTaste,
            formData.notes || '',
            optimizationNotes || ''
        )

        const prompt = `
我正在进行手冲咖啡，需要优化我的冲煮方案以达到理想风味。

## 当前配置信息
\`\`\`json
${configJson}
\`\`\`

## 风味变化需求
${tasteChanges ? `需要调整：${tasteChanges}` : '保持当前风味平衡，但希望整体提升品质'}

## 优化目标
${optimizationNotes || '提升整体风味平衡性和层次感'}

## 请提供以下内容
1. 详细的冲煮参数调整建议，包括研磨度、水温、注水方式、时间等
2. 优化后的完整配置（请保持与上面JSON格式一致，我需要导入系统）
3. 每个调整的具体原因和预期效果

## 字段说明
stages数组中的每个阶段必须包含以下字段：
- time: 累计时间（秒），表示从开始冲煮到当前阶段结束的总秒数
- label: 操作简要描述，如"焖蒸"、"绕圈注水"、"中心注水"等
- water: 累计水量（克），表示到当前阶段结束时的总水量
- detail: 详细操作说明或补充信息
- pourTime: 当前阶段实际注水时间（秒）
- pourType: 注水方式，必须是以下值之一：
  * "center": 中心注水
  * "circle": 绕圈注水
  * "ice": 冰滴
  * "other": 其他方式

请确保返回的JSON格式正确，stages数组中的每个阶段都必须包含上述所有字段。

注意：请在回复中包含一个完整的JSON配置块，格式与上面提供的相同，这样我可以直接复制并导入系统。
`
        setOptimizationPrompt(prompt)
    }

    // 兼容性更好的复制文本方法
    const copyTextToClipboard = async (text: string) => {
        // 首先尝试使用现代API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }

        // 回退方法：创建临时textarea元素
        const textArea = document.createElement('textarea');
        textArea.value = text;

        // 设置样式使其不可见
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);

        // 选择文本并复制
        textArea.focus();
        textArea.select();

        return new Promise<void>((resolve, reject) => {
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    resolve();
                } else {
                    reject(new Error('复制命令执行失败'));
                }
            } catch (_err) {
                reject(_err);
            } finally {
                document.body.removeChild(textArea);
            }
        });
    }

    useEffect(() => {
        // 添加全局触摸事件处理
        const preventScroll = (e: TouchEvent) => {
            if (isDragging) {
                e.preventDefault()
            }
        }

        document.addEventListener('touchmove', preventScroll, { passive: false })
        document.addEventListener('touchend', handleTouchEnd)

        return () => {
            document.removeEventListener('touchmove', preventScroll)
            document.removeEventListener('touchend', handleTouchEnd)
        }
    }, [isDragging])

    // 处理咖啡粉量变化
    const handleCoffeeChange = (value: string) => {
        const newMethodParams = {
            ...methodParams,
            coffee: value,
        };
        
        // 根据新的咖啡粉量和当前粉水比计算水量
        const coffeeMatch = value.match(/(\d+(\.\d+)?)/);
        const ratioMatch = methodParams.ratio.match(/1:(\d+(\.\d+)?)/);
        
        if (coffeeMatch && ratioMatch) {
            const coffeeValue = parseFloat(coffeeMatch[0]);
            const ratioValue = parseFloat(ratioMatch[1]);
            
            if (!isNaN(coffeeValue) && !isNaN(ratioValue) && coffeeValue > 0) {
                const waterValue = Math.round(coffeeValue * ratioValue);
                newMethodParams.water = `${waterValue}g`;
            }
        }
        
        setMethodParams(newMethodParams);
    };

    // Inside the component, add a new state for showing/hiding flavor ratings
    const [showFlavorRatings, setShowFlavorRatings] = useState(false);

    if (!isOpen) return null

    // 为平台添加特定类名
    const platformClass = isAndroid ? 'android-form' : isIOS ? 'ios-form' : ''

    return (
        <div className={`h-full w-full overflow-auto overscroll-none bg-neutral-50 dark:bg-neutral-900 brewing-note-form ${platformClass}`}>
        <form 
            id={id} 
            ref={formRef}
            onSubmit={handleSubmit} 
            className="relative flex h-full flex-col space-y-8"
        >
            {/* 隐藏的返回按钮，仅用于导航栏返回按钮查找 */}
            <button
                type="button"
                onClick={onClose}
                data-action="back"
                className="hidden"
            />

            {/* Header with timestamp */}
            <div className="flex items-baseline justify-between">
                <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                    {showOptimization
                        ? '优化冲煮方案'
                        : `${isFromBeanMethod ? '常用方案 · ' : ''}${initialData?.id ? '编辑记录' : '新建记录'} · ${new Date().toLocaleString('zh-CN', {
                            month: 'numeric',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: 'numeric',
                        })}`
                    }
                </div>
                {!showOptimization ? (
                    <div className="flex items-center space-x-4">
                        {initialData?.id && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="text-[10px] tracking-widest text-neutral-500 transition-colors dark:text-neutral-500"
                            >
                                [ 返回 ]
                            </button>
                        )}
                        <button
                            type="submit"
                            className="text-[10px] tracking-widest text-emerald-600 transition-colors dark:text-emerald-500 font-medium"
                        >
                            [ 保存 ]
                        </button>
                        {/* 添加"保存为常用方案"按钮 - 仅当选择了咖啡豆且不是来自常用方案时显示 */}
                        {initialData.coffeeBean?.id && !isFromBeanMethod && (
                            <button
                                type="button"
                                onClick={saveAsBeanMethod}
                                className={`text-[10px] tracking-widest transition-colors ${
                                    saveSuccess 
                                    ? 'text-emerald-600 dark:text-emerald-500' 
                                    : 'text-blue-600 dark:text-blue-500'
                                } font-medium`}
                            >
                                [ {saveSuccess ? '已保存为常用方案' : '保存为常用方案'} ]
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center space-x-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-[10px] tracking-widest text-neutral-500 transition-colors dark:text-neutral-500"
                        >
                            [ 返回 ]
                        </button>
                    </div>
                )}
            </div>

            {/* Form content */}
            {!showOptimization ? (
                <div className="flex-1 space-y-8 overflow-auto pb-8">
                    {/* 咖啡豆信息 */}
                    <div className="space-y-4">
                        <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                            咖啡豆信息
                        </div>
                        <div className="grid gap-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <input
                                        type="text"
                                        value={formData.coffeeBeanInfo.name}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                coffeeBeanInfo: {
                                                    ...formData.coffeeBeanInfo,
                                                    name: e.target.value,
                                                },
                                            })
                                        }
                                        className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-none transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                        placeholder="咖啡豆名称"
                                    />
                                </div>
                                <div>
                                    <select
                                        value={formData.coffeeBeanInfo.roastLevel}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                coffeeBeanInfo: {
                                                    ...formData.coffeeBeanInfo,
                                                    roastLevel: e.target.value,
                                                },
                                            })
                                        }
                                        className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-none transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 text-neutral-800 dark:text-neutral-300"
                                    >
                                        <option value="浅度烘焙">浅度烘焙</option>
                                        <option value="中浅烘焙">中浅烘焙</option>
                                        <option value="中度烘焙">中度烘焙</option>
                                        <option value="中深烘焙">中深烘焙</option>
                                        <option value="深度烘焙">深度烘焙</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 添加方案参数编辑 - 只在编辑记录时显示 */}
                    {initialData?.id && (
                    <div className="space-y-4">
                        <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                            方案参数
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <input
                                    type="text"
                                    value={methodParams.coffee}
                                    onChange={(e) => handleCoffeeChange(e.target.value)}
                                    className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-none transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                    placeholder="咖啡粉量 (如: 15g)"
                                />
                            </div>
                            <div>
                                <input
                                    type="text"
                                    value={methodParams.ratio}
                                    onChange={(e) => {
                                        const newRatio = e.target.value;
                                        const newMethodParams = {
                                            ...methodParams,
                                            ratio: newRatio,
                                        };
                                        
                                        // 根据新的粉水比和当前咖啡粉量计算水量
                                        const coffeeMatch = methodParams.coffee.match(/(\d+(\.\d+)?)/);
                                        if (coffeeMatch && newRatio) {
                                            const coffeeValue = parseFloat(coffeeMatch[0]);
                                            const ratioValue = parseFloat(newRatio.replace('1:', ''));
                                            if (!isNaN(coffeeValue) && !isNaN(ratioValue) && coffeeValue > 0) {
                                                const waterValue = Math.round(coffeeValue * ratioValue);
                                                newMethodParams.water = `${waterValue}g`;
                                            }
                                        }
                                        
                                        setMethodParams(newMethodParams);
                                    }}
                                    className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-none transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                    placeholder="粉水比 (如: 1:15)"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-6">
                            <div>
                                <input
                                    type="text"
                                    value={methodParams.grindSize}
                                    onChange={(e) => setMethodParams({...methodParams, grindSize: e.target.value})}
                                    className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-none transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                    placeholder="研磨度 (如: 中细)"
                                />
                            </div>
                            <div>
                                <input
                                    type="text"
                                    value={methodParams.temp}
                                    onChange={(e) => setMethodParams({...methodParams, temp: e.target.value})}
                                    className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-none transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                    placeholder="水温 (如: 92°C)"
                                />
                            </div>
                        </div>
                    </div>
                    )}

                    {/* 风味评分 */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                                风味评分
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowFlavorRatings(!showFlavorRatings)}
                                className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400"
                            >
                                [ {showFlavorRatings ? '收起' : '展开'} ]
                            </button>
                        </div>
                        
                        {showFlavorRatings && (
                            <div className="grid grid-cols-2 gap-8">
                                {Object.entries(formData.taste).map(([key, value]) => (
                                    <div key={key} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                                                {
                                                    {
                                                        acidity: '酸度',
                                                        sweetness: '甜度',
                                                        bitterness: '苦度',
                                                        body: '醇度',
                                                    }[key]
                                                }
                                            </div>
                                            <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                                [ {value || 0} ]
                                            </div>
                                        </div>
                                        <div className="relative py-4 -my-4">
                                            <input
                                                type="range"
                                                min="0"
                                                max="5"
                                                value={value || 0}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        taste: {
                                                            ...formData.taste,
                                                            [key]: parseInt(e.target.value),
                                                        },
                                                    })
                                                }
                                                onTouchStart={handleTouchStart(key, value)}
                                                onTouchMove={handleTouchMove(key)}
                                                onTouchEnd={handleTouchEnd}
                                                className="relative h-[1px] w-full appearance-none bg-neutral-300 dark:bg-neutral-600 cursor-pointer touch-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-neutral-800 dark:[&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-neutral-800 dark:[&::-moz-range-thumb]:bg-white"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 总体评分 */}
                    <div className="space-y-4">
                        <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                            总体评分
                        </div>
                        <div className="flex items-center space-x-6">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() =>
                                        setFormData({
                                            ...formData,
                                            rating: star,
                                        })
                                    }
                                    className={`text-[10px] tracking-widest transition-colors ${star <= formData.rating
                                        ? 'text-neutral-600 dark:text-neutral-300'
                                        : 'text-neutral-300 dark:text-neutral-600'
                                        }`}
                                >
                                    [ {star} ]
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 笔记 */}
                    <div className="space-y-4">
                        <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                            笔记
                        </div>
                        <AutoResizeTextarea
                            value={formData.notes}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    notes: e.target.value,
                                })
                            }
                            className="text-xs border-b border-neutral-200 focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 pb-4"
                            placeholder="记录一下这次冲煮的感受、改进点等..."
                        />
                    </div>
                </div>
            ) : (
                <div className="flex-1 space-y-8 overflow-auto pb-8">
                    {/* 添加方案参数编辑到优化界面 - 只在编辑记录时显示 */}
                    {initialData?.id && (
                    <div className="space-y-4">
                        <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                            方案参数调整
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <input
                                    type="text"
                                    value={methodParams.coffee}
                                    onChange={(e) => handleCoffeeChange(e.target.value)}
                                    className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-none transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                    placeholder="咖啡粉量 (如: 15g)"
                                />
                            </div>
                            <div>
                                <input
                                    type="text"
                                    value={methodParams.ratio}
                                    onChange={(e) => {
                                        const newRatio = e.target.value;
                                        const newMethodParams = {
                                            ...methodParams,
                                            ratio: newRatio,
                                        };
                                        
                                        // 根据新的粉水比和当前咖啡粉量计算水量
                                        const coffeeMatch = methodParams.coffee.match(/(\d+(\.\d+)?)/);
                                        if (coffeeMatch && newRatio) {
                                            const coffeeValue = parseFloat(coffeeMatch[0]);
                                            const ratioValue = parseFloat(newRatio.replace('1:', ''));
                                            if (!isNaN(coffeeValue) && !isNaN(ratioValue) && coffeeValue > 0) {
                                                const waterValue = Math.round(coffeeValue * ratioValue);
                                                newMethodParams.water = `${waterValue}g`;
                                            }
                                        }
                                        
                                        setMethodParams(newMethodParams);
                                    }}
                                    className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-none transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                    placeholder="粉水比 (如: 1:15)"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-6">
                            <div>
                                <input
                                    type="text"
                                    value={methodParams.grindSize}
                                    onChange={(e) => setMethodParams({...methodParams, grindSize: e.target.value})}
                                    className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-none transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                    placeholder="研磨度 (如: 中细)"
                                />
                            </div>
                            <div>
                                <input
                                    type="text"
                                    value={methodParams.temp}
                                    onChange={(e) => setMethodParams({...methodParams, temp: e.target.value})}
                                    className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-none transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                    placeholder="水温 (如: 92°C)"
                                />
                            </div>
                        </div>
                    </div>
                    )}

                    {/* 理想风味设置 */}
                    <div className="space-y-4">
                        <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                            理想风味设置
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                            {Object.entries(idealTaste).map(([key, value]) => (
                                <div key={key} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                                            {
                                                {
                                                    acidity: '理想酸度',
                                                    sweetness: '理想甜度',
                                                    bitterness: '理想苦度',
                                                    body: '理想醇度',
                                                }[key]
                                            }
                                        </div>
                                        <div className="flex items-center text-[10px] tracking-widest">
                                            <span className="text-neutral-500 dark:text-neutral-500">
                                                [ {formData.taste[key as keyof TasteRatings]} ]
                                            </span>
                                            <span className="mx-1 text-neutral-500 dark:text-neutral-400">→</span>
                                            <span className="text-neutral-600 dark:text-neutral-400">
                                                [ {value} ]
                                            </span>
                                        </div>
                                    </div>
                                    <div className="relative py-4 -my-4">
                                        <input
                                            type="range"
                                            min="1"
                                            max="5"
                                            value={value}
                                            onChange={(e) =>
                                                setIdealTaste({
                                                    ...idealTaste,
                                                    [key]: parseInt(e.target.value),
                                                })
                                            }
                                            onTouchStart={handleOptimizationTouchStart(key, value)}
                                            onTouchMove={handleOptimizationTouchMove(key)}
                                            onTouchEnd={handleTouchEnd}
                                            className="relative h-[1px] w-full appearance-none bg-neutral-300 dark:bg-neutral-600 cursor-pointer touch-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-neutral-800 dark:[&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-neutral-800 dark:[&::-moz-range-thumb]:bg-white"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 优化目标 */}
                    <div className="space-y-4">
                        <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                            优化目标
                        </div>
                        <AutoResizeTextarea
                            value={optimizationNotes}
                            onChange={(e) => setOptimizationNotes(e.target.value)}
                            className="text-xs border-b border-neutral-200 pb-4 focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300"
                            placeholder="还有其他优化目标？例如：提升层次感、增加果香、改善口感..."
                        />
                    </div>

                    {/* 生成优化提示词 */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                                优化提示词
                            </div>
                            <button
                                type="button"
                                onClick={generateOptimizationPrompt}
                                className="text-[10px] tracking-widest text-emerald-600 transition-colors dark:text-emerald-500 font-medium"
                            >
                                [ 生成优化提示词 ]
                            </button>
                        </div>

                        {optimizationPrompt && (
                            <div className="space-y-4 mt-2 p-4 border border-neutral-200 dark:border-neutral-700 rounded-md bg-neutral-50 dark:bg-neutral-800/50">
                                <div className="flex justify-between items-center">
                                    <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                                        将提示词复制给 AI(推荐 DeepSeek)
                                    </div>
                                    <div className="flex space-x-4">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                copyTextToClipboard(optimizationPrompt)
                                                    .then(() => {
                                                        // 成功复制后显示提示
                                                        alert('提示词已复制到剪贴板');
                                                        // 保存当前数据
                                                        const noteData = {
                                                            id: id || Date.now().toString(),
                                                            timestamp: Date.now(),
                                                            ...formData,
                                                            equipment: initialData.equipment,
                                                            method: initialData.method,
                                                            params: methodParams, // 使用当前编辑的方案参数
                                                            totalTime: initialData.totalTime,
                                                        };
                                                        // 调用onSave保存当前数据
                                                        onSave(noteData);
                                                    })
                                                    .catch(() => {
                                                        alert('复制失败，请手动复制');
                                                    })
                                            }}
                                            className="text-[10px] tracking-widest text-emerald-600 font-medium transition-colors dark:text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400"
                                        >
                                            [ 复制提示词 ]
                                        </button>
                                    </div>
                                </div>
                                <AutoResizeTextarea
                                    value={optimizationPrompt}
                                    readOnly
                                    className="text-xs border border-neutral-200 rounded-md bg-neutral-50 dark:bg-neutral-800 dark:border-neutral-700 p-4 text-neutral-800 dark:text-neutral-300"
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </form>
        </div>
    )
}

export default BrewingNoteForm