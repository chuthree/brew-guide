'use client'

import React, { useState, useMemo } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { BrewingNote } from '@/lib/core/config'

// 动态导入 ImageViewer 组件
const ImageViewer = dynamic(() => import('@/components/common/ui/ImageViewer'), {
    ssr: false
})

interface DateImageFlowViewProps {
    notes: BrewingNote[]
    onNoteClick: (note: BrewingNote) => void
    isShareMode?: boolean
    selectedNotes?: string[]
    onToggleSelect?: (noteId: string, enterShareMode?: boolean) => void
}

interface GroupedNotes {
    [date: string]: BrewingNote[]
}

// 中文日期格式化函数
const formatChineseDate = (timestamp: number, showYear: boolean = true): string => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    if (showYear) {
        return `${year}年${month}月${day}日`;
    } else {
        return `${month}月${day}日`;
    }
}

// 获取日期的年份
const getYear = (timestamp: number): number => {
    return new Date(timestamp).getFullYear();
}

const DateImageFlowView: React.FC<DateImageFlowViewProps> = ({
    notes,
    onNoteClick,
    isShareMode = false,
    selectedNotes = [],
    onToggleSelect
}) => {
    const [imageViewerOpen, setImageViewerOpen] = useState(false)
    const [selectedImage, setSelectedImage] = useState<{ url: string; alt: string } | null>(null)

    // 只显示有图片的笔记
    const notesWithImages = useMemo(() => 
        notes.filter(note => note.image),
        [notes]
    )

    // 按日期分组笔记
    const groupedNotes = useMemo(() => {
        if (notesWithImages.length === 0) return {}

        // 首先检查是否只有一个年份
        const years = new Set(notesWithImages.map(note => getYear(note.timestamp)))
        const showYear = years.size > 1

        const groups: GroupedNotes = {}

        notesWithImages.forEach(note => {
            const dateKey = formatChineseDate(note.timestamp, showYear)
            if (!groups[dateKey]) {
                groups[dateKey] = []
            }
            groups[dateKey].push(note)
        })

        // 按日期排序（最新的在前）
        const sortedGroups: GroupedNotes = {}
        Object.keys(groups)
            .sort((a, b) => {
                // 获取每个组中最新的时间戳进行排序
                const aLatest = Math.max(...groups[a].map(note => note.timestamp))
                const bLatest = Math.max(...groups[b].map(note => note.timestamp))
                return bLatest - aLatest
            })
            .forEach(date => {
                // 每个日期内的笔记按时间排序（最新的在前）
                sortedGroups[date] = groups[date].sort((a, b) => b.timestamp - a.timestamp)
            })

        return sortedGroups
    }, [notesWithImages])

    const handleImageClick = (note: BrewingNote, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!isShareMode && note.image) {
            setSelectedImage({
                url: note.image,
                alt: note.coffeeBeanInfo?.name || '笔记图片'
            })
            setImageViewerOpen(true)
        }
    }

    const handleNoteClick = (note: BrewingNote) => {
        if (isShareMode && onToggleSelect) {
            onToggleSelect(note.id, !selectedNotes.includes(note.id))
        } else {
            onNoteClick(note)
        }
    }

    if (notesWithImages.length === 0) {
        return (
            <div className="flex items-center justify-center py-20 text-neutral-500 dark:text-neutral-400 text-sm">
                暂无包含图片的笔记
            </div>
        )
    }

    return (
        <div className="pb-20">
            {Object.entries(groupedNotes).map(([date, dateNotes]) => (
                <div key={date}>
                    {/* 日期标题 */}
                    <div className="px-6 py-2 sticky top-0 bg-neutral-50 dark:bg-neutral-900 z-10">
                        <div className="text-xs font-medium text-neutral-800 dark:text-neutral-100 tracking-wide">
                            {date}
                            {/* <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                                ({dateNotes.length} 张图片)
                            </span> */}
                        </div>
                    </div>

                    {/* 该日期的图片网格 - 一行三列 */}
                    <div className="grid grid-cols-3 gap-1 px-1">
                        {dateNotes.map((note) => {
                            const beanName = note.coffeeBeanInfo?.name || '未知豆子'
                            const isSelected = selectedNotes.includes(note.id)

                            return (
                                <div
                                    key={note.id}
                                    className={`relative aspect-square cursor-pointer ${
                                        isShareMode && isSelected 
                                            ? 'ring-2 ring-blue-500 ring-offset-1' 
                                            : ''
                                    }`}
                                    onClick={() => handleNoteClick(note)}
                                >
                                    {/* 图片容器 */}
                                    <div className="relative w-full h-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                                        {note.image && (
                                            <Image
                                                src={note.image}
                                                alt={beanName}
                                                fill
                                                className="object-cover"
                                                sizes="(max-width: 768px) 33vw, 200px"
                                                loading="lazy"
                                                onClick={(e) => handleImageClick(note, e)}
                                            />
                                        )}
                                    </div>

                                    {/* 分享模式下的选择指示器 */}
                                    {isShareMode && (
                                        <div className="absolute top-1 right-1">
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                                isSelected 
                                                    ? 'bg-blue-500 border-blue-500' 
                                                    : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600'
                                            }`}>
                                                {isSelected && (
                                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            ))}

            {/* 图片查看器 */}
            {selectedImage && (
                <ImageViewer
                    isOpen={imageViewerOpen}
                    imageUrl={selectedImage.url}
                    alt={selectedImage.alt}
                    onClose={() => {
                        setImageViewerOpen(false)
                        setSelectedImage(null)
                    }}
                />
            )}
        </div>
    )
}

export default DateImageFlowView
