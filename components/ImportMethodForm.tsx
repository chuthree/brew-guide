'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Check } from 'lucide-react'
import { type Method } from '@/lib/config'
import { parseMethodFromJson, getExampleJson } from '@/lib/jsonUtils'

interface ImportMethodFormProps {
    onSave: (method: Method) => void
    onCancel: () => void
    existingMethods?: Method[]
}

// 定义步骤类型
type Step = 'input' | 'complete'

const ImportMethodForm: React.FC<ImportMethodFormProps> = ({
    onSave,
    onCancel,
    existingMethods = [],
}) => {
    // 当前步骤状态
    const [currentStep, setCurrentStep] = useState<Step>('input')
    const [jsonInput, setJsonInput] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [parsedMethod, setParsedMethod] = useState<Method | null>(null)
    const formRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // 点击外部关闭
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (formRef.current && !formRef.current.contains(event.target as Node)) {
                onCancel()
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [onCancel])

    // 自动聚焦文本框
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.focus()
        }
    }, [])

    // 步骤配置
    const steps: { id: Step; label: string }[] = [
        { id: 'input', label: '导入配置' },
        { id: 'complete', label: '完成' }
    ]

    // 获取当前步骤索引
    const getCurrentStepIndex = () => {
        return steps.findIndex(step => step.id === currentStep)
    }

    // 使用示例JSON
    const useExampleJson = () => {
        setJsonInput(getExampleJson())
    }

    const handleImport = () => {
        try {
            setError(null)
            const method = parseMethodFromJson(jsonInput)

            if (!method) {
                setError('解析JSON失败，请检查格式')
                return
            }

            // 检查是否已存在同名方案
            const existingMethod = existingMethods.find(m => m.name === method.name)
            if (existingMethod) {
                setError(`已存在同名方案"${method.name}"，请修改后再导入`)
                return
            }

            // 设置解析后的方法
            setParsedMethod(method)
            setCurrentStep('complete')
        } catch (err) {
            setError('JSON格式错误，请检查输入')
            console.error('JSON解析错误:', err)
        }
    }

    const handleSave = () => {
        if (parsedMethod) {
            onSave(parsedMethod)
        }
    }

    const handleBack = () => {
        if (currentStep === 'complete') {
            setCurrentStep('input')
        } else {
            onCancel()
        }
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
        duration: 0.3
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
            case 'input':
                return (
                    <motion.div
                        key="input-step"
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                        className="space-y-6"
                    >
                        <div className="text-center space-y-4">
                            <h2 className="text-xl font-medium text-neutral-800 dark:text-neutral-200">
                                粘贴配置JSON
                            </h2>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                请粘贴AI优化后返回的JSON配置(或朋友分享的)
                            </p>
                        </div>

                        <div className="space-y-4">
                            <textarea
                                ref={textareaRef}
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                placeholder='{"equipment": "V60", "method": "改良分段式一刀流", "params": {...}}'
                                className="w-full h-64 p-4 text-xs border border-neutral-200 dark:border-neutral-700 rounded-md bg-neutral-50 dark:bg-neutral-800 outline-none focus:border-neutral-400 dark:focus:border-neutral-500"
                            />
                            <div className="flex justify-between items-center">
                                <button
                                    type="button"
                                    onClick={useExampleJson}
                                    className="text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
                                >
                                    使用示例JSON
                                </button>
                                {error && (
                                    <div className="text-sm text-red-500 dark:text-red-400">
                                        {error}
                                    </div>
                                )}
                            </div>
                        </div>
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
                                配置解析成功
                            </h3>
                            <p className="text-neutral-600 dark:text-neutral-400">
                                已成功解析冲煮方案配置
                            </p>
                        </div>
                        <div className="w-full max-w-sm space-y-4 px-4">
                            <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                                <span className="text-sm text-neutral-500 dark:text-neutral-400">方案名称</span>
                                <span className="text-sm font-medium">{parsedMethod?.name}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                                <span className="text-sm text-neutral-500 dark:text-neutral-400">咖啡粉量</span>
                                <span className="text-sm font-medium">{parsedMethod?.params.coffee}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                                <span className="text-sm text-neutral-500 dark:text-neutral-400">水量</span>
                                <span className="text-sm font-medium">{parsedMethod?.params.water}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                                <span className="text-sm text-neutral-500 dark:text-neutral-400">粉水比</span>
                                <span className="text-sm font-medium">{parsedMethod?.params.ratio}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                                <span className="text-sm text-neutral-500 dark:text-neutral-400">步骤数量</span>
                                <span className="text-sm font-medium">{parsedMethod?.params.stages.length}个</span>
                            </div>
                        </div>
                        {/* 底部渐变阴影 - 提示有更多内容 */}
                        <div className="sticky w-full bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white dark:from-neutral-900 to-transparent pointer-events-none"></div>
                    </motion.div>
                )
            default:
                return null
        }
    }

    // 渲染下一步按钮
    const renderNextButton = () => {
        // 验证当前步骤是否可以进行下一步
        const isStepValid = () => {
            switch (currentStep) {
                case 'input':
                    return !!jsonInput.trim();
                default:
                    return true;
            }
        };

        return (
            <div className="flex items-center justify-center my-8">
                {currentStep === 'input' ? (
                    <button
                        type="button"
                        onClick={handleImport}
                        disabled={!isStepValid()}
                        className={`
                            px-6 py-3 rounded-full text-sm font-medium
                            ${isStepValid()
                                ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800 hover:opacity-90'
                                : 'bg-neutral-300 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 cursor-not-allowed'}
                        `}
                    >
                        解析配置
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={handleSave}
                        className="bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800 px-6 py-3 rounded-full font-medium hover:opacity-80"
                    >
                        <span className="font-medium">导入方案</span>
                    </button>
                )}
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
                    className="rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
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

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto pr-2">
                <AnimatePresence mode="wait">
                    {renderStepContent()}
                </AnimatePresence>
            </div>

            {/* 下一步按钮 */}
            {renderNextButton()}
        </motion.div>
    )
}

export default ImportMethodForm 