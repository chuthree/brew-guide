'use client'

import React, { ReactNode, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'

export interface Step {
    id: string
    label: string
    content: ReactNode
    isValid?: boolean
}

interface SteppedFormModalProps {
    showForm: boolean
    onClose: () => void
    onComplete: () => void
    steps: Step[]
    initialStep?: number
    title?: string
    preserveState?: boolean
    onStepChange?: (index: number) => void
}

const SteppedFormModal: React.FC<SteppedFormModalProps> = ({
    showForm,
    onClose,
    onComplete,
    steps,
    initialStep = 0,
    title,
    preserveState = false,
    onStepChange
}) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(initialStep)

    // 当initialStep变化时更新当前步骤
    useEffect(() => {
        if (showForm) {
            setCurrentStepIndex(initialStep);
        }
    }, [showForm, initialStep]);

    // 当不显示表单且不保持状态时，重置为初始步骤
    useEffect(() => {
        if (!showForm && !preserveState) {
            setCurrentStepIndex(initialStep);
        }
    }, [showForm, preserveState, initialStep]);

    // 获取当前步骤
    const currentStep = steps[currentStepIndex]

    // 计算进度
    const progress = ((currentStepIndex + 1) / steps.length) * 100

    // 渲染进度条
    const renderProgressBar = () => {
        return (
            <div className="w-full h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div
                    className="h-full bg-neutral-800 dark:bg-neutral-200 transition-all duration-300 ease-in-out"
                    style={{ width: `${progress}%` }}
                />
            </div>
        )
    }

    // 处理上一步/返回
    const handleBack = () => {
        if (currentStepIndex > 0) {
            const newIndex = currentStepIndex - 1;
            setCurrentStepIndex(newIndex);
            if (onStepChange) {
                onStepChange(newIndex);
            }
        } else {
            onClose()
        }
    }

    // 处理下一步
    const handleNext = () => {
        if (currentStepIndex < steps.length - 1) {
            const newIndex = currentStepIndex + 1;
            setCurrentStepIndex(newIndex);
            if (onStepChange) {
                onStepChange(newIndex);
            }
        } else {
            onComplete()
        }
    }

    // 步骤过渡动画
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

    return (
        <AnimatePresence>
            {showForm && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.265 }}
                    className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            onClose()
                        }
                    }}
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
                        className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-hidden rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl"
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
                            className="px-6 px-safe pb-6 pb-safe overflow-auto max-h-[calc(80vh-40px)]"
                        >
                            <div className="flex flex-col">
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
                                        {currentStepIndex + 1}/{steps.length}
                                    </div>
                                </div>

                                {/* 标题 (如果提供) */}
                                {title && (
                                    <h3 className="text-base font-medium text-center mb-6">{title}</h3>
                                )}

                                {/* 步骤内容 */}
                                <div className="flex-1 overflow-y-auto pb-4">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={currentStep.id}
                                            initial="initial"
                                            animate="in"
                                            exit="out"
                                            variants={pageVariants}
                                            transition={pageTransition}
                                            className="space-y-6"
                                        >
                                            {currentStep.content}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>

                                {/* 下一步按钮 */}
                                <div className="modal-bottom-button flex items-center justify-center">
                                    <button
                                        type="button"
                                        onClick={handleNext}
                                        disabled={currentStep.isValid === false}
                                        className={`
                        flex items-center justify-center rounded-full
                        ${currentStep.isValid === false ? 'opacity-50 cursor-not-allowed' : ''}
                        ${currentStepIndex === steps.length - 1
                                                ? 'bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800 px-6 py-3 text-sm font-medium'
                                                : 'p-4 bg-neutral-50/80 dark:bg-neutral-900/80 backdrop-blur-md'
                                            }
                      `}
                                    >
                                        {currentStepIndex === steps.length - 1 ? (
                                            <span>完成</span>
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
                            </div>
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default SteppedFormModal 