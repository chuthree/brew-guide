'use client'

import React, { ReactNode, useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Search, X } from 'lucide-react'

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
    preserveState?: boolean
    onStepChange?: (index: number) => void
    currentStep?: number
    setCurrentStep?: React.Dispatch<React.SetStateAction<number>>
}

const SteppedFormModal: React.FC<SteppedFormModalProps> = ({
    showForm,
    onClose,
    onComplete,
    steps,
    initialStep = 0,
    preserveState = false,
    onStepChange,
    currentStep,
    setCurrentStep
}) => {
    const [internalStepIndex, setInternalStepIndex] = useState(initialStep)
    
    // 使用外部或内部状态控制当前步骤
    const currentStepIndex = currentStep !== undefined ? currentStep : internalStepIndex
    const setCurrentStepIndex = setCurrentStep || setInternalStepIndex
    
    // 搜索相关状态
    const [isSearching, setIsSearching] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const searchInputRef = useRef<HTMLInputElement>(null)
    
    // 模态框DOM引用
    const modalRef = useRef<HTMLDivElement>(null)

    // 当初始化步骤变化时更新当前步骤
    useEffect(() => {
        if (showForm) {
            setCurrentStepIndex(initialStep)
        }
    }, [showForm, initialStep, setCurrentStepIndex])

    // 当不显示表单且不保持状态时，重置为初始步骤
    useEffect(() => {
        if (!showForm && !preserveState) {
            setCurrentStepIndex(initialStep)
            setIsSearching(false)
            setSearchQuery('')
        }
    }, [showForm, preserveState, initialStep, setCurrentStepIndex])

    // 获取当前步骤
    const currentStepContent = steps[currentStepIndex]

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
            // 重置搜索状态
            setIsSearching(false);
            setSearchQuery('');
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
            // 重置搜索状态
            setIsSearching(false);
            setSearchQuery('');
        } else {
            onComplete()
        }
    }
    
    // 处理搜索按钮点击
    const handleSearchClick = () => {
        setIsSearching(true);
        setTimeout(() => {
            searchInputRef.current?.focus();
        }, 100);
    }
    
    // 处理关闭搜索
    const handleCloseSearch = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setIsSearching(false);
        setSearchQuery('');
    }
    
    // 检查当前步骤是否为咖啡豆选择步骤
    const isCoffeeBeanStep = currentStepContent?.id === 'coffeeBean';

    // 通用按钮基础样式
    const buttonBaseClass = "rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100";

    // 创建一个包含搜索字段的内容
    const contentWithSearchProps = React.useMemo(() => {
        if (!isCoffeeBeanStep) return currentStepContent.content;
        
        // 为咖啡豆选择器添加搜索查询参数
        return React.cloneElement(
            currentStepContent.content as React.ReactElement,
            { searchQuery }
        );
    }, [currentStepContent?.content, isCoffeeBeanStep, searchQuery]);

    // 渲染下一步按钮
    const renderNextButton = () => {
        const isLastStep = currentStepIndex === steps.length - 1;
        const isValid = currentStepContent?.isValid !== false;
        
        const springTransition = {
            type: "spring",
            stiffness: 500,
            damping: 25
        };
        
        return (
            <div className="modal-bottom-button flex items-center justify-center">
                <div className="flex items-center justify-center gap-2">
                    {/* 搜索输入框 */}
                    <AnimatePresence mode="popLayout">
                        {isValid && isCoffeeBeanStep && isSearching && (
                            <motion.div
                                key="search-input-container"
                                layout
                                initial={{ scale: 0.95, opacity: 0, x: 15 }}
                                animate={{ scale: 1, opacity: 1, x: 0 }}
                                exit={{ scale: 0.95, opacity: 0, x: 15 }}
                                transition={springTransition}
                                className="flex items-center gap-2"
                            >
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="搜索咖啡豆名称..."
                                    className="w-48 text-sm bg-neutral-100 dark:bg-neutral-800 rounded-full py-[14px] px-5 border-none outline-none text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500"
                                    autoComplete="off"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                            handleCloseSearch();
                                        }
                                    }}
                                />
                                <motion.button
                                    type="button"
                                    onClick={handleCloseSearch}
                                    className={`${buttonBaseClass} p-4 flex-shrink-0`}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <X className="w-4 h-4" strokeWidth="3" />
                                </motion.button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* 下一步/完成按钮 */}
                    {isValid && !(isCoffeeBeanStep && isSearching) && (
                        <motion.button
                            key="next-button"
                            layout
                            type="button"
                            onClick={isCoffeeBeanStep ? handleSearchClick : handleNext}
                            transition={springTransition}
                            initial={{ scale: 0.95, opacity: 0, x: 15 }}
                            animate={{ scale: 1, opacity: 1, x: 0 }}
                            className={`
                                ${buttonBaseClass} flex items-center justify-center
                                ${isLastStep && !isCoffeeBeanStep ? 'px-6 py-3' : 'px-5 py-3'}
                            `}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {isLastStep && !isCoffeeBeanStep ? (
                                <span className="font-medium">保存笔记</span>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">{isCoffeeBeanStep ? "搜索" : "下一步"}</span>
                                    {isCoffeeBeanStep ? (
                                        <Search className="w-4 h-4" strokeWidth="3" />
                                    ) : (
                                        <ArrowRight className="w-4 h-4" strokeWidth="3" />
                                    )}
                                </div>
                            )}
                        </motion.button>
                    )}
                </div>
            </div>
        );
    };

    // 直接使用CSS控制显示/隐藏，而不是条件渲染
    return (
        <div 
            ref={modalRef}
            className={`fixed inset-0 z-50 transition-opacity duration-200 ${showForm ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        >
            <div 
                className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                onClick={onClose}
            >
                <div 
                    className="absolute inset-x-0 bottom-0 max-w-[500px] mx-auto max-h-[80vh] overflow-hidden rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl transition-transform duration-200"
                    style={{ 
                        transform: showForm ? 'translateY(0)' : 'translateY(100%)',
                        willChange: "transform" 
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* 拖动条 */}
                    <div className="sticky top-0 z-10 flex justify-center py-2 bg-neutral-50 dark:bg-neutral-900">
                        <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                    </div>

                    {/* 表单内容 */}
                    <div className="px-6 pb-safe-bottom overflow-auto max-h-[calc(80vh-40px)]">
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

                            {/* 步骤内容 */}
                            <div className="flex-1 overflow-y-auto pb-4">
                                {currentStepContent && (
                                    <div className="space-y-6">
                                        {contentWithSearchProps}
                                    </div>
                                )}
                            </div>

                            {/* 底部按钮区域 */}
                            {renderNextButton()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SteppedFormModal 