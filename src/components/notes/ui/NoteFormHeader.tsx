'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Calendar } from '@/components/common/ui/Calendar'

interface NoteFormHeaderProps {
    onSave?: () => void; // 保存按钮的回调
    showSaveButton?: boolean; // 是否显示保存按钮
    timestamp?: Date; // 可选时间戳，默认为当前时间
    onTimestampChange?: (timestamp: Date) => void; // 时间戳修改回调
}

const NoteFormHeader: React.FC<NoteFormHeaderProps> = ({
    onSave: _onSave,
    showSaveButton: _showSaveButton = true,
    timestamp = new Date(),
    onTimestampChange,
}) => {
    const [showDatePicker, setShowDatePicker] = useState(false)
    const datePickerRef = useRef<HTMLDivElement>(null)

    // 处理日期变化
    const handleDateChange = (newDate: Date) => {
        // 保持原有的时分秒，只修改年月日
        const updatedTimestamp = new Date(timestamp)
        updatedTimestamp.setFullYear(newDate.getFullYear())
        updatedTimestamp.setMonth(newDate.getMonth())
        updatedTimestamp.setDate(newDate.getDate())

        onTimestampChange?.(updatedTimestamp)
        setShowDatePicker(false)
    }

    // 点击外部关闭日期选择器
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
                setShowDatePicker(false)
            }
        }

        if (showDatePicker) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showDatePicker])

    return (
        <div className="flex items-center justify-between w-full">
            <div className="flex items-baseline">
                <span className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">新建记录 ·</span>

                {/* 可点击的日期部分 */}
                <div className="relative ml-1" ref={datePickerRef}>
                    <button
                        type="button"
                        onClick={() => onTimestampChange && setShowDatePicker(!showDatePicker)}
                        className={`text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400 ${
                            onTimestampChange
                                ? 'border-b border-dashed border-neutral-400 dark:border-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:border-neutral-600 dark:hover:border-neutral-400 transition-colors cursor-pointer'
                                : 'cursor-default'
                        }`}
                        disabled={!onTimestampChange}
                    >
                        {`${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}-${String(timestamp.getDate()).padStart(2, '0')}`}
                    </button>

                    {/* 日期选择器 */}
                    {showDatePicker && onTimestampChange && (
                        <div className="absolute top-full left-0 mt-2 z-50 bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-800" style={{ width: '280px' }}>
                            <Calendar
                                selected={timestamp}
                                onSelect={handleDateChange}
                                locale="zh-CN"
                                initialFocus
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default NoteFormHeader 