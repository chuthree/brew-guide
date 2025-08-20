'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import BrewingNoteForm from './BrewingNoteForm'
import { BrewingNoteData } from '@/types/app'
import { SettingsOptions } from '@/components/settings/Settings'
import { Calendar } from '@/components/common/ui/Calendar'

interface BrewingNoteEditModalProps {
    showModal: boolean
    initialData: BrewingNoteData
    onSave: (data: BrewingNoteData) => void
    onClose: () => void
    settings?: SettingsOptions
}

const BrewingNoteEditModal: React.FC<BrewingNoteEditModalProps> = ({
    showModal,
    initialData,
    onSave,
    onClose,
    settings
}) => {
    // 时间戳状态管理
    const [timestamp, setTimestamp] = useState<Date>(new Date(initialData.timestamp))

    // 日期选择器状态
    const [showDatePicker, setShowDatePicker] = useState(false)
    const datePickerRef = useRef<HTMLDivElement>(null)

    // 内部动画状态
    const [isClosing, setIsClosing] = useState(false)

    // 重置时间戳当初始数据变化时
    useEffect(() => {
        setTimestamp(new Date(initialData.timestamp))
    }, [initialData.timestamp])

    // 处理时间戳变化
    const handleTimestampChange = useCallback((newTimestamp: Date) => {
        setTimestamp(newTimestamp)
    }, [])

    // 处理日期变化
    const handleDateChange = useCallback((newDate: Date) => {
        // 保持原有的时分秒，只修改年月日
        const updatedTimestamp = new Date(timestamp)
        updatedTimestamp.setFullYear(newDate.getFullYear())
        updatedTimestamp.setMonth(newDate.getMonth())
        updatedTimestamp.setDate(newDate.getDate())

        setTimestamp(updatedTimestamp)
        setShowDatePicker(false)
    }, [timestamp])

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

    // 处理保存
    const handleSave = useCallback((updatedData: BrewingNoteData) => {
        // 确保使用最新的时间戳
        const finalData = {
            ...updatedData,
            timestamp: timestamp.getTime()
        }
        onSave(finalData)
    }, [onSave, timestamp])

    // 处理关闭 - 先触发退出动画，然后调用父组件关闭
    const handleClose = useCallback(() => {
        if (!isClosing) {
            setIsClosing(true)
            // 等待退出动画完成后再调用父组件的关闭回调
            setTimeout(() => {
                onClose()
            }, 265) // 与动画持续时间一致
        }
    }, [isClosing, onClose])

    // 处理保存按钮点击
    const handleSaveClick = useCallback(() => {
        // 触发表单提交
        const form = document.querySelector(`form[id="${initialData.id}"]`) as HTMLFormElement
        if (form) {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
        }
    }, [initialData.id])

    return (
        <AnimatePresence>
            {showModal && !isClosing && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.265 }}
                    className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs"
                    onClick={handleClose}
                >
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{
                            type: "tween",
                            ease: [0.33, 1, 0.68, 1], // cubic-bezier(0.33, 1, 0.68, 1) - easeOutCubic
                            duration: 0.265
                        }}
                        style={{
                            willChange: "transform"
                        }}
                        className="absolute inset-x-0 bottom-0 max-w-[500px] mx-auto max-h-[90vh] overflow-hidden rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 拖动条 */}
                        <div className="sticky top-0 z-10 flex justify-center py-2 bg-neutral-50 dark:bg-neutral-900">
                            <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                        </div>

                        {/* 表单内容 */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                type: "tween",
                                ease: "easeOut",
                                duration: 0.265,
                                delay: 0.05
                            }}
                            style={{
                                willChange: "opacity, transform"
                            }}
                            className="px-6 pb-safe-bottom overflow-auto max-h-[calc(90vh-40px)]"
                        >
                            <div className="flex flex-col">
                                {/* 顶部标题栏 */}
                                <div className="flex items-center justify-between mt-3 mb-6">
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        className="rounded-full p-2"
                                    >
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="text-neutral-800 dark:text-neutral-200"
                                        >
                                            <path
                                                d="M19 12H5M5 12L12 19M5 12L12 5"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    </button>

                                    {/* 中间的时间戳编辑区域 */}
                                    <div className="flex items-baseline">
                                        <span className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                                            编辑记录 ·
                                        </span>

                                        {/* 可点击的日期部分 */}
                                        <div className="relative ml-1" ref={datePickerRef}>
                                            <button
                                                type="button"
                                                onClick={() => setShowDatePicker(!showDatePicker)}
                                                className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400 border-b border-dashed border-neutral-400 dark:border-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:border-neutral-600 dark:hover:border-neutral-400 transition-colors cursor-pointer"
                                            >
                                                {`${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}-${String(timestamp.getDate()).padStart(2, '0')}`}
                                            </button>

                                            {/* 日期选择器 */}
                                            {showDatePicker && (
                                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50 bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-800" style={{ width: '280px' }}>
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

                                    {/* 占位元素，保持布局平衡 */}
                                    <div className="w-12"></div>
                                </div>

                                {/* 表单内容容器 */}
                                <div className="flex-1 pb-20">
                                    <BrewingNoteForm
                                        id={initialData.id}
                                        isOpen={true}
                                        onClose={handleClose}
                                        onSave={handleSave}
                                        initialData={initialData}
                                        inBrewPage={true}
                                        showSaveButton={false}
                                        hideHeader={true}
                                        onTimestampChange={handleTimestampChange}
                                        settings={settings}
                                    />
                                </div>
                            </div>

                            {/* 底部保存按钮 - 悬浮固定 */}
                            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-10 pb-safe-bottom">
                                <button
                                    type="button"
                                    onClick={handleSaveClick}
                                    className="rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 px-6 py-3 flex items-center justify-center"
                                >
                                    <span className="font-medium">保存笔记</span>
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default BrewingNoteEditModal
