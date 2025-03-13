'use client'

import React, { useState, useEffect } from 'react'
// import { motion } from 'framer-motion'

// Helper function to format time
// const formatTime = (seconds: number) => {
//     const mins = Math.floor(seconds / 60)
//     const secs = seconds % 60
//     return `${mins}:${secs.toString().padStart(2, '0')}`
// }

// 从 page.tsx 导入 BrewingNoteData 类型
import type { BrewingNoteData } from '@/app/page'

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
}

const BrewingNoteForm: React.FC<BrewingNoteFormProps> = ({
    id,
    isOpen,
    onClose,
    onSave,
    initialData,
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
                {/* Header with timestamp */}
                <div className="flex items-baseline justify-between">
                    <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                        {initialData?.id ? '编辑记录' : '新建记录'} · {new Date().toLocaleString('zh-CN', {
                            month: 'numeric',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: 'numeric',
                        })}
                    </div>
                    <div className="flex items-center space-x-4">
                        <button
                            type="submit"
                            className="text-[10px] tracking-widest text-neutral-500 transition-colors hover:text-neutral-800 dark:text-neutral-500 dark:hover:text-neutral-300"
                        >
                            [ 保存 ]
                        </button>
                    </div>
                </div>

                {/* Form content */}
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
            </form>
        </div>
    )
}

export default BrewingNoteForm