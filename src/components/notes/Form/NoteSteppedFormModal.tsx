'use client'

import React, { ReactNode, useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { ArrowLeft, ArrowRight, Search, X, Shuffle } from 'lucide-react'
import { CoffeeBeanManager } from '@/lib/managers/coffeeBeanManager'
import { showToast } from "@/components/common/feedback/GlobalToast"

export interface Step {
    id: string
    label: string
    content: ReactNode
    isValid?: boolean
}

interface NoteSteppedFormModalProps {
    showForm: boolean
    onClose: () => void
    onComplete: () => void
    steps: Step[]
    initialStep?: number
    preserveState?: boolean
    onStepChange?: (index: number) => void
    currentStep?: number
    setCurrentStep?: React.Dispatch<React.SetStateAction<number>>
    onRandomBean?: (isLongPress?: boolean) => void
}

// 暴露给父组件的方法
export interface NoteSteppedFormHandle {
    handleBackStep: () => boolean
}

const NoteSteppedFormModal = forwardRef<NoteSteppedFormHandle, NoteSteppedFormModalProps>(({
    showForm,
    onClose,
    onComplete,
    steps,
    initialStep = 0,
    preserveState = false,
    onStepChange,
    currentStep,
    setCurrentStep,
    onRandomBean
}, ref) => {
    const [internalStepIndex, setInternalStepIndex] = useState(initialStep)

    // 使用外部或内部状态控制当前步骤
    const currentStepIndex = currentStep !== undefined ? currentStep : internalStepIndex
    const setCurrentStepIndex = setCurrentStep || setInternalStepIndex

    // 搜索相关状态
    const [isSearching, setIsSearching] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const searchInputRef = useRef<HTMLInputElement>(null)

    // 添加高亮咖啡豆ID状态
    const [highlightedBeanId, setHighlightedBeanId] = useState<string | null>(null)

    // 添加随机按钮禁用状态
    const [isRandomButtonDisabled, setIsRandomButtonDisabled] = useState(false)

    // 模态框DOM引用
    const modalRef = useRef<HTMLDivElement>(null)
    const contentScrollRef = useRef<HTMLDivElement>(null)

    // 暴露给父组件的方法
    useImperativeHandle(ref, () => ({
        // 返回 true 表示处理了返回（返回上一步），false 表示已在第一步
        handleBackStep: () => {
            if (currentStepIndex > 0) {
                const newIndex = currentStepIndex - 1;
                setCurrentStepIndex(newIndex);
                if (onStepChange) {
                    onStepChange(newIndex);
                }
                // 重置搜索状态
                setIsSearching(false);
                setSearchQuery('');
                // 重置高亮状态
                setHighlightedBeanId(null);
                return true; // 处理了返回
            }
            return false; // 已经在第一步，无法再返回
        }
    }), [currentStepIndex, setCurrentStepIndex, onStepChange])

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
            setHighlightedBeanId(null)
            setIsRandomButtonDisabled(false)
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
            // 重置高亮状态
            setHighlightedBeanId(null);
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
            // 重置高亮状态
            setHighlightedBeanId(null);
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

        // 为咖啡豆选择器添加搜索查询参数和高亮ID
        return React.cloneElement(
            currentStepContent.content as React.ReactElement<{
                searchQuery?: string;
                highlightedBeanId?: string | null;
                scrollParentRef?: HTMLElement;
            }>,
            {
                searchQuery,
                highlightedBeanId,
                // 将内容区滚动容器传给虚拟列表，保证在模态内全高滚动
                scrollParentRef: contentScrollRef.current || modalRef.current || undefined
            }
        );
    }, [currentStepContent?.content, isCoffeeBeanStep, searchQuery, highlightedBeanId]);

    // 随机选择咖啡豆
    const handleRandomBean = async (isLongPress: boolean = false) => {
        // 如果提供了自定义随机豆子方法，则调用它
        if (onRandomBean) {
            onRandomBean(isLongPress);
            return;
        }

        // 如果按钮被禁用，直接返回
        if (isRandomButtonDisabled) return;

        try {
            const allBeans = await CoffeeBeanManager.getAllBeans();
            // 过滤掉已经用完的豆子和在途状态的豆子
            const availableBeans = allBeans.filter(bean => {
                // 过滤掉在途状态的咖啡豆
                if (bean.isInTransit) {
                    return false;
                }

                // 如果没有设置容量，则显示（因为无法判断是否用完）
                if (!bean.capacity || bean.capacity === '0' || bean.capacity === '0g') {
                    return true;
                }

                // 如果设置了容量，则检查剩余量是否大于0
                const remaining = parseFloat(bean.remaining || '0');
                return remaining > 0;
            });

            if (availableBeans.length > 0) {
                const randomIndex = Math.floor(Math.random() * availableBeans.length);
                const randomBean = availableBeans[randomIndex];

                // 设置高亮豆子ID，而不是直接选择
                setHighlightedBeanId(randomBean.id);

                // 4秒后清除高亮状态
                setTimeout(() => {
                    setHighlightedBeanId(null);
                }, 4000);
            } else {
                showToast({
                    type: 'info',
                    title: '没有可用的咖啡豆',
                    duration: 2000
                });
            }
        } catch (error) {
            // Log error in development only
            if (process.env.NODE_ENV === 'development') {
                console.error('随机选择咖啡豆失败:', error);
            }
            showToast({
                type: 'error',
                title: '随机选择失败',
                duration: 2000
            });
        }
    };

    // 渲染下一步按钮
    const renderNextButton = () => {
        const isLastStep = currentStepIndex === steps.length - 1;
        const isValid = currentStepContent?.isValid !== false;

        return (
            <div className="modal-bottom-button flex items-center justify-center">
                <div className="flex items-center justify-center gap-2">
                    {/* 搜索输入框 */}
                    {isValid && isCoffeeBeanStep && isSearching && (
                        <div className="flex items-center gap-2">
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="搜索咖啡豆名称..."
                                className="w-48 text-sm font-medium bg-neutral-100 dark:bg-neutral-800 rounded-full py-[14px] px-5 border-none outline-hidden text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500"
                                autoComplete="off"
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                        handleCloseSearch();
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={handleCloseSearch}
                                className={`${buttonBaseClass} p-4 shrink-0`}
                            >
                                <X className="w-4 h-4" strokeWidth="3" />
                            </button>
                        </div>
                    )}

                    {/* 下一步/完成按钮 */}
                    {isValid && !(isCoffeeBeanStep && isSearching) && (
                        <button
                            type="button"
                            onClick={isCoffeeBeanStep ? handleSearchClick : handleNext}
                            className={`
                                ${buttonBaseClass} flex items-center justify-center
                                ${isLastStep && !isCoffeeBeanStep ? 'px-6 py-3' : 'px-5 py-3'}
                            `}
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
                        </button>
                    )}

                    {/* 随机选择按钮 - 仅在咖啡豆步骤且未处于搜索状态时显示 */}
                    {isValid && isCoffeeBeanStep && !isSearching && (
                        <button
                            type="button"
                            onClick={() => handleRandomBean(false)}
                            onMouseDown={(_e) => {
                                if (isRandomButtonDisabled) return;
                                
                                // 长按逻辑
                                const timer = setTimeout(() => {
                                    handleRandomBean(true);
                                }, 500); // 500ms 长按
                                
                                const handleMouseUp = () => {
                                    clearTimeout(timer);
                                    document.removeEventListener('mouseup', handleMouseUp);
                                };
                                document.addEventListener('mouseup', handleMouseUp);
                            }}
                            onTouchStart={(_e) => {
                                if (isRandomButtonDisabled) return;
                                
                                // 触摸长按
                                const timer = setTimeout(() => {
                                    handleRandomBean(true);
                                }, 500);
                                
                                const handleTouchEnd = () => {
                                    clearTimeout(timer);
                                    document.removeEventListener('touchend', handleTouchEnd);
                                };
                                document.addEventListener('touchend', handleTouchEnd);
                            }}
                            className={`${buttonBaseClass} p-4 flex items-center justify-center ${
                                isRandomButtonDisabled ? 'opacity-40 cursor-not-allowed bg-neutral-200 dark:bg-neutral-700' : ''
                            }`}
                            disabled={isRandomButtonDisabled}
                        >
                            <Shuffle className="w-4 h-4" strokeWidth="3" />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    // 简单的淡入淡出效果
    return (
        <div
            ref={modalRef}
            className={`fixed inset-0 z-50 px-6 pt-safe-top pb-safe-bottom max-w-[500px] mx-auto bg-neutral-50 dark:bg-neutral-900 transition-opacity duration-200 ${showForm ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} flex flex-col overflow-hidden`}
        >
            {/* 顶部导航栏 */}
            <div className="flex items-center justify-between mb-6">
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
            <div className="flex-1 overflow-y-auto pb-4" ref={contentScrollRef}>
                {currentStepContent && (
                    <div className="space-y-6">
                        {contentWithSearchProps}
                    </div>
                )}
            </div>

            {/* 底部按钮区域 */}
            {renderNextButton()}
        </div>
    )
})

NoteSteppedFormModal.displayName = 'NoteSteppedFormModal'

export default NoteSteppedFormModal
