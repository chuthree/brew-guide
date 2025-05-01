'use client'

import React, { useState, useEffect, useRef } from 'react'

import type { BrewingNoteData, CoffeeBean } from '@/app/types'
import AutoResizeTextarea from '@/components/AutoResizeTextarea'

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
    inBrewPage?: boolean; // 添加属性，标识是否在冲煮页面中
    showSaveButton?: boolean; // 是否显示保存按钮
}

const BrewingNoteForm: React.FC<BrewingNoteFormProps> = ({
    id,
    isOpen,
    onClose,
    onSave,
    initialData,
    inBrewPage = false, // 默认不在冲煮页面
    showSaveButton = true, // 默认显示保存按钮
}) => {
    // 处理咖啡豆数据，如果有提供coffeeBean则使用，否则使用coffeeBeanInfo
    const initialCoffeeBeanInfo = initialData.coffeeBean
        ? {
            name: initialData.coffeeBean.name || '',
            roastLevel: initialData.coffeeBean.roastLevel || '中度烘焙',
        }
        : {
            name: initialData.coffeeBeanInfo?.name || '',
            roastLevel: initialData.coffeeBeanInfo?.roastLevel || '中度烘焙',
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

    // 添加方案参数状态
    const [methodParams, setMethodParams] = useState({
        coffee: initialData?.params?.coffee || '15g',
        water: initialData?.params?.water || '225g',
        ratio: initialData?.params?.ratio || '1:15',
        grindSize: initialData?.params?.grindSize || '中细',
        temp: initialData?.params?.temp || '92°C',
    });
    
    // 添加表单ref
    const formRef = useRef<HTMLFormElement>(null)

    // Update form data when initialData changes
    useEffect(() => {
        if (initialData) {
            // 标准化烘焙度值，确保与下拉列表选项匹配
            const normalizeRoastLevel = (roastLevel?: string): string => {
                if (!roastLevel) return '中度烘焙';
                
                // 如果已经是完整格式，直接返回
                if (roastLevel.endsWith('烘焙')) return roastLevel;
                
                // 否则添加"烘焙"后缀
                if (roastLevel === '极浅') return '极浅烘焙';
                if (roastLevel === '浅度') return '浅度烘焙';
                if (roastLevel === '中浅') return '中浅烘焙';
                if (roastLevel === '中度') return '中度烘焙';
                if (roastLevel === '中深') return '中深烘焙';
                if (roastLevel === '深度') return '深度烘焙';
                
                // 尝试匹配部分字符串
                if (roastLevel.includes('极浅')) return '极浅烘焙';
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
                }
                : {
                    name: initialData.coffeeBeanInfo?.name || '',
                    roastLevel: normalizeRoastLevel(initialData.coffeeBeanInfo?.roastLevel),
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
        const newValue = Math.round(percentage * 5)

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

    useEffect(() => {
        // 添加全局触摸事件处理
        document.addEventListener('touchend', handleTouchEnd)

        return () => {
            document.removeEventListener('touchend', handleTouchEnd)
        }
    }, [])

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

    // 保存笔记的处理函数
    const handleSubmit = (e: React.FormEvent) => {
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
            // 保存笔记
            onSave(noteData);
        } catch (error) {
            console.error('保存笔记时出错:', error);
            alert('保存笔记时出错，请重试');
        }
    }

    if (!isOpen) return null

    // 动态设置容器 padding，在冲煮页面时不需要额外 padding
    const containerClassName = `relative flex h-full flex-col space-y-4 ${!inBrewPage ? 'p-6 pt-4' : ''} overflow-auto`;

    return (
        <form 
            id={id} 
            ref={formRef}
            onSubmit={handleSubmit}
            className={containerClassName}
        >
            {/* Header with timestamp */}
            <div className="flex items-baseline justify-between bg-neutral-50 dark:bg-neutral-900 py-2 z-10">
                <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                    {`${initialData?.id ? '编辑记录' : '新建记录'} · ${new Date().toLocaleString('zh-CN', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                    })}`}
                </div>
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
                    {showSaveButton && (
                        <button
                            type="submit"
                            className="text-[10px] tracking-widest text-emerald-600 transition-colors dark:text-emerald-500 font-medium"
                        >
                            [ 保存 ]
                        </button>
                    )}
                </div>
            </div>

            {/* Form content */}
            <div className="flex-1 space-y-6 pb-6">
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
                                    <option value="极浅烘焙">极浅烘焙</option>
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
                                                    body: '口感',
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
                                            step="1"
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
        </form>
    )
}

export default BrewingNoteForm 