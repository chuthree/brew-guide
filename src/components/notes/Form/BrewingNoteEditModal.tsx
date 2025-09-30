'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import BrewingNoteForm from './BrewingNoteForm'
import { BrewingNoteData } from '@/types/app'
import { SettingsOptions } from '@/components/settings/Settings'
import { Calendar } from '@/components/common/ui/Calendar'

interface BrewingNoteEditModalProps {
    showModal: boolean
    initialData: BrewingNoteData | null
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
    const [timestamp, setTimestamp] = useState<Date>(new Date(initialData?.timestamp || Date.now()))

    // 日期选择器状态
    const [showDatePicker, setShowDatePicker] = useState(false)
    const datePickerRef = useRef<HTMLDivElement>(null)

    // 内部动画状态
    const [isClosing, setIsClosing] = useState(false)
    const [isAnimating, setIsAnimating] = useState(false)

    // 重置时间戳当初始数据变化时
    useEffect(() => {
        if (initialData) {
            setTimestamp(new Date(initialData.timestamp))
            setIsClosing(false) // 重置关闭状态
            setIsAnimating(false) // 重置动画状态
        }
    }, [initialData])

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
        if (!isClosing && !isAnimating) {
            setIsAnimating(true)
            setIsClosing(true)
            
            // 如果历史栈中有我们添加的条目，触发返回
            if (window.history.state?.modal === 'brewing-note-edit') {
                window.history.back()
            } else {
                // 否则直接关闭
                // 等待退出动画完成后再调用父组件的关闭回调
                setTimeout(() => {
                    onClose()
                    setIsAnimating(false)
                }, 200) // 匹配新的动画持续时间
            }
        }
    }, [isClosing, isAnimating, onClose])

    // 历史栈管理 - 支持硬件返回键和浏览器返回按钮
    useEffect(() => {
        if (!showModal) return

        // 添加模态框历史记录
        window.history.pushState({ modal: 'brewing-note-edit' }, '')

        // 监听返回事件
        const handlePopState = () => {
            onClose()
        }

        window.addEventListener('popstate', handlePopState)

        return () => {
            window.removeEventListener('popstate', handlePopState)
        }
    }, [showModal, onClose])

    // 移动端优化：防止背景滚动
    useEffect(() => {
        if (showModal && !isClosing) {
            // 防止背景页面滚动
            document.body.style.overflow = 'hidden'
            document.body.style.position = 'fixed'
            document.body.style.width = '100%'
        } else {
            // 恢复背景页面滚动
            document.body.style.overflow = ''
            document.body.style.position = ''
            document.body.style.width = ''
        }

        return () => {
            // 清理函数
            document.body.style.overflow = ''
            document.body.style.position = ''
            document.body.style.width = ''
        }
    }, [showModal, isClosing])

    // 处理保存按钮点击
    const handleSaveClick = useCallback(() => {
        if (!initialData) return
        // 触发表单提交
        const form = document.querySelector(`form[id="${initialData.id}"]`) as HTMLFormElement
        if (form) {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
        }
    }, [initialData])

    return (
        <AnimatePresence mode="wait">
            {showModal && !isClosing && initialData && (
                <motion.div
                    initial={{ opacity: 0}}
                    animate={{ opacity: 1}}
                    exit={{ opacity: 0}}
                    transition={{ 
                        duration: 0.2, 
                        ease: [0.25, 0.46, 0.45, 0.94] // 移动端友好的缓动函数
                    }}
                    style={{
                        willChange: "opacity, transform", // 启用硬件加速
                    }}
                    className="fixed px-6 pt-safe-top pb-safe-bottom overflow-auto max-w-[500px] mx-auto inset-0 z-50 bg-neutral-50 dark:bg-neutral-900"
                >
            {/* 顶部标题栏 */}
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-full p-3 -ml-1 touch-manipulation"
                    style={{
                        WebkitTapHighlightColor: 'transparent', // 移除点击高亮
                        minWidth: '44px', // 移动端最小触摸区域
                        minHeight: '44px'
                    }}
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
            <div className="flex-1">
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

            {/* 底部保存按钮 - 使用sticky定位相对于容器固定 */}
            <div className="modal-bottom-button flex items-center justify-center">
                <button
                    type="button"
                    onClick={handleSaveClick}
                    className="rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 px-6 py-3 flex items-center justify-center"
                >
                    <span className="font-medium">保存笔记</span>
                </button>
            </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default BrewingNoteEditModal
