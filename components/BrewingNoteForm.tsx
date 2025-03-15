'use client'

import React, { useState, useEffect } from 'react'
// import { motion } from 'framer-motion'
// import { motion } from 'framer-motion'

// Helper function to format time
// const formatTime = (seconds: number) => {
//     const mins = Math.floor(seconds / 60)
//     const secs = seconds % 60
//     return `${mins}:${secs.toString().padStart(2, '0')}`
// }

// 从 page.tsx 导入 BrewingNoteData 类型
import type { BrewingNoteData } from '@/app/page'
import { generateOptimizationJson } from '@/lib/jsonUtils'

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
    initialData: Partial<BrewingNoteData>;
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
    const [formData, setFormData] = useState<FormData>({
        coffeeBeanInfo: {
            name: initialData?.coffeeBeanInfo?.name || '',
            roastLevel: initialData?.coffeeBeanInfo?.roastLevel || '中度烘焙',
            roastDate: initialData?.coffeeBeanInfo?.roastDate || '',
        },
        rating: initialData?.rating || 3,
        taste: {
            acidity: initialData?.taste?.acidity || 3,
            sweetness: initialData?.taste?.sweetness || 3,
            bitterness: initialData?.taste?.bitterness || 3,
            body: initialData?.taste?.body || 3,
        },
        notes: initialData?.notes || '',
    })

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


    // Update form data when initialData changes
    useEffect(() => {
        if (initialData) {
            setFormData({
                coffeeBeanInfo: {
                    name: initialData.coffeeBeanInfo?.name || '',
                    roastLevel: initialData.coffeeBeanInfo?.roastLevel || '中度烘焙',
                    roastDate: initialData.coffeeBeanInfo?.roastDate || '',
                },
                rating: initialData.rating || 3,
                taste: {
                    acidity: initialData.taste?.acidity || 3,
                    sweetness: initialData.taste?.sweetness || 3,
                    bitterness: initialData.taste?.bitterness || 3,
                    body: initialData.taste?.body || 3,
                },
                notes: initialData.notes || '',
            })
        }
    }, [initialData])

    // 添加useEffect来处理showOptimizationByDefault的变化
    useEffect(() => {
        // 当外部传入的showOptimizationByDefault变化时，更新内部状态
        setShowOptimization(showOptimizationByDefault)
    }, [showOptimizationByDefault])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const noteData = {
            id: id || Date.now().toString(),
            timestamp: Date.now(),
            ...formData,
            equipment: initialData.equipment,
            method: initialData.method,
            params: initialData.params,
            totalTime: initialData.totalTime,
        }

        // 直接更新 localStorage
        try {
            const existingNotes = JSON.parse(localStorage.getItem('brewingNotes') || '[]')
            const updatedNotes = id
                ? existingNotes.map((note: BrewingNoteData) => (note.id === id ? noteData : note))
                : [noteData, ...existingNotes]

            localStorage.setItem('brewingNotes', JSON.stringify(updatedNotes))
            onSave(noteData)
            onClose()
        } catch (error) {
            console.error('Error saving note:', error)
            alert('保存笔记时出错，请重试')
        }
    }

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

        // 使用工具函数生成优化JSON
        const configJson = generateOptimizationJson(
            initialData.equipment || '',
            initialData.method || '',
            {
                name: formData.coffeeBeanInfo.name || '',
                roastLevel: formData.coffeeBeanInfo.roastLevel || '中度烘焙',
                roastDate: formData.coffeeBeanInfo.roastDate || '',
            },
            initialData.params || {
                coffee: '',
                water: '',
                ratio: '',
                grindSize: '',
                temp: '',
            },
            Array.isArray(initialData.stages) ? initialData.stages : [],
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
            } catch (err) {
                reject(err);
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

    if (!isOpen) return null

    return (
        <div className="h-full w-full overflow-auto overscroll-none bg-neutral-50 dark:bg-neutral-900">
            <form id={id} onSubmit={handleSubmit} className="relative flex h-full flex-col space-y-8">
                {/* 隐藏的返回按钮，仅用于导航栏返回按钮查找 */}
                <button
                    type="button"
                    onClick={onClose}
                    data-action="back"
                    className="hidden"
                />

                {/* Header with timestamp */}
                <div className="flex items-baseline justify-between">
                    <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                        {showOptimization
                            ? '优化冲煮方案'
                            : `${initialData?.id ? '编辑记录' : '新建记录'} · ${new Date().toLocaleString('zh-CN', {
                                month: 'numeric',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: 'numeric',
                            })}`
                        }
                    </div>
                    {!showOptimization && (
                        <div className="flex items-center space-x-4">
                            <button
                                type="submit"
                                className="text-[10px] tracking-widest text-neutral-500 transition-colors hover:text-neutral-800 dark:text-neutral-500 dark:hover:text-neutral-300"
                            >
                                [ 保存 ]
                            </button>
                        </div>
                    )}
                </div>

                {/* Form content */}
                {!showOptimization ? (
                    <div className="flex-1 space-y-8 overflow-auto pb-8">
                        {/* 咖啡豆信息 */}
                        <div className="space-y-4">
                            <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
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
                                            <option>浅度烘焙</option>
                                            <option>中浅烘焙</option>
                                            <option>中度烘焙</option>
                                            <option>中深烘焙</option>
                                            <option>深度烘焙</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 风味评分 */}
                        <div className="space-y-4">
                            <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                                风味评分
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                                {Object.entries(formData.taste).map(([key, value]) => (
                                    <div key={key} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
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
                                                [ {value} ]
                                            </div>
                                        </div>
                                        <div className="relative py-4 -my-4">
                                            <input
                                                type="range"
                                                min="1"
                                                max="5"
                                                value={value}
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
                        </div>

                        {/* 总体评分 */}
                        <div className="space-y-4">
                            <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
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
                                            : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-400'
                                            }`}
                                    >
                                        [ {star} ]
                                    </button>
                                ))}
                            </div>
                        </div>


                        {/* 笔记 */}
                        <div className="space-y-4">
                            <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                                笔记
                            </div>
                            <textarea
                                value={formData.notes}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        notes: e.target.value,
                                    })
                                }
                                className="w-full resize-none border-b border-neutral-200 rounded-none bg-transparent text-xs outline-none transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300"
                                placeholder="记录一下这次冲煮的感受、改进点等..."
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 space-y-8 overflow-auto pb-8">
                        {/* 理想风味设置 */}
                        <div className="space-y-4">
                            <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                                理想风味设置
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                                {Object.entries(idealTaste).map(([key, value]) => (
                                    <div key={key} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
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
                                                <span className="mx-1 text-neutral-400 dark:text-neutral-500">→</span>
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
                            <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                                优化目标
                            </div>
                            <textarea
                                value={optimizationNotes}
                                onChange={(e) => setOptimizationNotes(e.target.value)}
                                className="w-full resize-none border-b border-neutral-200 rounded-none bg-transparent text-xs outline-none transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300"
                                placeholder="还有其他优化目标？例如：提升层次感、增加果香、改善口感..."
                            />
                        </div>

                        {/* 生成优化提示词 */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                                    优化提示词
                                </div>
                                <button
                                    type="button"
                                    onClick={generateOptimizationPrompt}
                                    className="text-[10px] tracking-widest text-emerald-600 transition-colors hover:text-emerald-700 dark:text-emerald-500 dark:hover:text-emerald-400 font-medium"
                                >
                                    [ 生成优化提示词 ]
                                </button>
                            </div>

                            {optimizationPrompt && (
                                <div className="space-y-4 mt-2 p-4 border border-neutral-200 dark:border-neutral-700 rounded-md bg-neutral-50 dark:bg-neutral-800/50">
                                    <div className="flex justify-between items-center">
                                        <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                                            将提示词复制给 AI(推荐 DeepSeek)
                                        </div>
                                        <div className="flex space-x-4">

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    copyTextToClipboard(optimizationPrompt)
                                                        .then(() => alert('提示词已复制到剪贴板'))
                                                        .catch(err => {
                                                            console.error('复制失败:', err);
                                                            alert('复制失败，请手动复制');
                                                        })
                                                }}
                                                className="text-[10px] tracking-widest text-neutral-500 transition-colors hover:text-neutral-800 dark:text-neutral-500 dark:hover:text-neutral-300"
                                            >
                                                [ 复制提示词 ]
                                            </button>
                                        </div>
                                    </div>
                                    <textarea
                                        value={optimizationPrompt}
                                        readOnly
                                        className="w-full h-64 resize-none border border-neutral-200 rounded-md bg-neutral-50 dark:bg-neutral-800 dark:border-neutral-700 text-xs p-4 outline-none text-neutral-800 dark:text-neutral-300 overflow-auto"
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