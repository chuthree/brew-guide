'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Storage } from '@/lib/storage'
import { SettingsOptions, defaultSettings } from '@/components/Settings'
import hapticsUtils from '@/lib/haptics'
import textZoomUtils from '@/lib/textZoom'
import confetti from 'canvas-confetti'

// 引导步骤类型
export type OnboardingStep = 'welcome' | 'settings' | 'complete'

// 引导页面界面属性
interface OnboardingProps {
    onSettingsChange: (settings: SettingsOptions) => void
    onComplete: () => void
}

// 主组件
const Onboarding: React.FC<OnboardingProps> = ({ onSettingsChange, onComplete }) => {
    // 当前步骤
    const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome')
    // 设置选项
    const [settings, setSettings] = useState<SettingsOptions>(defaultSettings)
    // 音频上下文
    const audioContext = useRef<AudioContext | null>(null)
    // 滑动区域引用
    const sliderRef = useRef<HTMLDivElement>(null)
    // 初始触摸位置
    const touchStartX = useRef(0)
    // 获取前进/后退方向
    const direction = useRef(0)
    // 设置方向
    const previous = useRef(currentStep)
    // 检查TextZoom功能是否可用
    const [isTextZoomEnabled, setIsTextZoomEnabled] = useState(false)
    // 幻刺切换按钮引用
    const phanciToggleRef = useRef<HTMLDivElement>(null)

    // 初始化音频环境
    useEffect(() => {
        if (typeof window !== 'undefined' && 'AudioContext' in window) {
            audioContext.current = new AudioContext()
        }

        // 检查文本缩放功能是否可用
        setIsTextZoomEnabled(textZoomUtils.isAvailable());

        return () => {
            audioContext.current?.close()
        }
    }, [])

    // 更新方向
    useEffect(() => {
        if (previous.current !== currentStep) {
            const steps: OnboardingStep[] = ['welcome', 'settings', 'complete']
            const currentIndex = steps.indexOf(currentStep)
            const previousIndex = steps.indexOf(previous.current)
            direction.current = currentIndex > previousIndex ? 1 : -1
            previous.current = currentStep
        }
    }, [currentStep])

    // 测试播放音效
    const playTestSound = () => {
        if (!audioContext.current) return

        try {
            // 恢复可能被暂停的音频上下文
            if (audioContext.current.state === 'suspended') {
                audioContext.current.resume()
            }

            // 创建振荡器
            const oscillator = audioContext.current.createOscillator()
            oscillator.type = 'sine'
            oscillator.frequency.setValueAtTime(880, audioContext.current.currentTime) // A5音

            // 创建增益节点控制音量
            const gainNode = audioContext.current.createGain()
            gainNode.gain.setValueAtTime(0, audioContext.current.currentTime)
            gainNode.gain.linearRampToValueAtTime(0.3, audioContext.current.currentTime + 0.01)
            gainNode.gain.linearRampToValueAtTime(0, audioContext.current.currentTime + 0.3)

            // 连接节点
            oscillator.connect(gainNode)
            gainNode.connect(audioContext.current.destination)

            // 播放并在0.3秒后停止
            oscillator.start()
            oscillator.stop(audioContext.current.currentTime + 0.3)
        } catch {

        }
    }

    // 测试触感反馈
    const testHapticFeedback = async () => {
        try {
            await hapticsUtils.medium()
        } catch {

        }
    }

    // 触发彩带特效
    const showConfetti = () => {
        if (!phanciToggleRef.current) return;
        
        // 获取按钮元素的位置信息
        const rect = phanciToggleRef.current.getBoundingClientRect();
        const x = (rect.left + rect.width / 2) / window.innerWidth;
        const y = (rect.top + rect.height / 2) / window.innerHeight;
        
        // 创建彩带效果
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { x, y },
            colors: ['#FFD700', '#FF6347', '#9370DB', '#3CB371', '#4682B4'],
            zIndex: 9999,
            shapes: ['square', 'circle'],
            scalar: 0.8,
        });
        
        // 烟花效果
        setTimeout(() => {
            confetti({
                particleCount: 50,
                spread: 90,
                origin: { x, y },
                colors: ['#FFD700', '#FF6347', '#9370DB'],
                zIndex: 9999,
                startVelocity: 30,
                gravity: 0.8,
                shapes: ['star'],
                scalar: 1,
            });
        }, 250);
    }

    // 处理设置变更
    const handleSettingChange = <K extends keyof SettingsOptions>(key: K, value: SettingsOptions[K]) => {
        setSettings(prev => {
            const newSettings = { ...prev, [key]: value }
            return newSettings
        })

        // 当改变声音设置时播放测试音效
        if (key === 'notificationSound' && value === true) {
            playTestSound()
        }

        // 当改变触感设置时提供测试反馈
        if (key === 'hapticFeedback' && value === true) {
            testHapticFeedback()
        }

        // 当改变文本缩放级别时立即应用
        if (key === 'textZoomLevel') {
            textZoomUtils.set(value as number)
        }

        // 当选择幻刺时触发彩带特效
        if (key === 'grindType' && value === '幻刺') {
            showConfetti()
            // 选择幻刺时也提供轻触感反馈
            if (settings.hapticFeedback) {
                hapticsUtils.medium()
            }
        }
    }

    // 处理完成按钮点击
    const handleComplete = async () => {
        try {
            // 保存用户设置
            await Storage.set('brewGuideSettings', JSON.stringify(settings))
            // 标记引导已完成
            await Storage.set('onboardingCompleted', 'true')

            // 应用文本缩放级别
            if (settings.textZoomLevel) {
                await textZoomUtils.set(settings.textZoomLevel);
            }

            // 提供成功的触感反馈（如果启用）
            if (settings.hapticFeedback) {
                await hapticsUtils.success()
            }
            // 提供音效反馈（如果启用）
            if (settings.notificationSound) {
                playTestSound()
                // 延迟关闭卡片，确保音效播放完毕
                setTimeout(() => {
                    // 通知上层组件设置已变更
                    onSettingsChange(settings)
                    // 调用完成回调
                    onComplete()
                }, 500) // 音效持续时间约为300ms，设置500ms以确保播放完毕
                return // 提前返回，避免立即执行下面的代码
            }

            // 如果没有音效，直接完成
            onSettingsChange(settings)
            onComplete()
        } catch {

        }
    }

    // 前进到下一步
    const goToNextStep = () => {
        // 根据当前步骤设置下一步
        switch (currentStep) {
            case 'welcome':
                setCurrentStep('settings')
                break
            case 'settings':
                setCurrentStep('complete')
                break
            case 'complete':
                handleComplete()
                break
            default:
                break
        }

        // 提供轻触感反馈
        if (settings.hapticFeedback) {
            hapticsUtils.light()
        }
    }

    // 返回上一步
    const goToPrevStep = () => {
        // 根据当前步骤设置上一步
        switch (currentStep) {
            case 'settings':
                setCurrentStep('welcome')
                break
            case 'complete':
                setCurrentStep('settings')
                break
            default:
                break
        }

        // 提供轻触感反馈
        if (settings.hapticFeedback) {
            hapticsUtils.light()
        }
    }

    // 处理触摸开始
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX
    }

    // 处理触摸结束
    const handleTouchEnd = (e: React.TouchEvent) => {
        const touchEndX = e.changedTouches[0].clientX
        const diffX = touchEndX - touchStartX.current

        // 如果滑动距离足够大，则切换页面
        if (Math.abs(diffX) > 50) {
            if (diffX > 0) {
                // 向右滑动，返回上一页
                goToPrevStep()
            } else {
                // 向左滑动，前进到下一页
                goToNextStep()
            }
        }
    }

    // 渲染当前步骤内容
    const renderStepContent = () => {
        const commonClassNames = "flex flex-col w-full"

        return (
            <div
                key={currentStep}
                className="w-full h-full flex my-4"
            >
                {currentStep === 'welcome' && (
                    <div className={commonClassNames}>
                        <div className="flex flex-col">
                            <div className="text-center mb-5">
                                <div className="mb-6 flex justify-center">
                                    <div className="w-20 h-20 rounded-full bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
                                        <span className="text-3xl">☕</span>
                                    </div>
                                </div>
                                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                                    欢迎使用手冲咖啡指南
                                </h2>
                                <p className="text-sm mt-2 text-neutral-500 dark:text-neutral-400">
                                    完全离线的咖啡冲煮助手
                                </p>
                            </div>

                            <div className="mt-4 space-y-3">
                                <div className="bg-neutral-50 dark:bg-neutral-900 rounded-xl p-3 flex items-center">
                                    <div className="w-8 h-8 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mr-3">
                                        <span className="text-neutral-700 dark:text-neutral-300">✓</span>
                                    </div>
                                    <p className="text-sm text-neutral-700 dark:text-neutral-300">
                                        专业冲煮方案 - 直观计时指导
                                    </p>
                                </div>

                                <div className="bg-neutral-50 dark:bg-neutral-900 rounded-xl p-3 flex items-center">
                                    <div className="w-8 h-8 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mr-3">
                                        <span className="text-neutral-700 dark:text-neutral-300">✓</span>
                                    </div>
                                    <p className="text-sm text-neutral-700 dark:text-neutral-300">
                                        咖啡豆管理 - 记录风味与烘焙度
                                    </p>
                                </div>

                                <div className="bg-neutral-50 dark:bg-neutral-900 rounded-xl p-3 flex items-center">
                                    <div className="w-8 h-8 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mr-3">
                                        <span className="text-neutral-700 dark:text-neutral-300">✓</span>
                                    </div>
                                    <p className="text-sm text-neutral-700 dark:text-neutral-300">
                                        离线使用 - 露营旅行随时冲煮
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {currentStep === 'settings' && (
                    <div className={commonClassNames}>
                        <div className="text-center mb-5">
                            <div className="mb-6 flex justify-center">
                                <div className="w-20 h-20 rounded-full bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
                                    <span className="text-3xl">⚙️</span>
                                </div>
                            </div>
                            <h2 className="text-xl font-bold mb-6 text-neutral-900 dark:text-white text-center">
                                偏好设置
                            </h2>
                        </div>

                        <div className="w-full space-y-5 mb-4">
                            <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-900 p-4 rounded-xl">
                                <div className="flex flex-col">
                                    <label className="text-sm font-medium text-neutral-900 dark:text-white">
                                        声音提示
                                    </label>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                        计时结束和注水提醒时发出声音
                                    </p>
                                </div>
                                <div
                                    className={`relative w-12 h-6 rounded-full transition-colors duration-200 ease-in-out ${settings.notificationSound ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-200 dark:bg-neutral-800'}`}
                                    onClick={() => handleSettingChange('notificationSound', !settings.notificationSound)}
                                >
                                    <div
                                        className={`absolute top-1 left-1 bg-white dark:bg-black w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${settings.notificationSound ? 'translate-x-6' : ''}`}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-900 p-4 rounded-xl">
                                <div className="flex flex-col">
                                    <label className="text-sm font-medium text-neutral-900 dark:text-white">
                                        震动反馈
                                    </label>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                        注水阶段结束时震动提醒
                                    </p>
                                </div>
                                <div
                                    className={`relative w-12 h-6 rounded-full transition-colors duration-200 ease-in-out ${settings.hapticFeedback ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-200 dark:bg-neutral-800'}`}
                                    onClick={() => handleSettingChange('hapticFeedback', !settings.hapticFeedback)}
                                >
                                    <div
                                        className={`absolute top-1 left-1 bg-white dark:bg-black w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${settings.hapticFeedback ? 'translate-x-6' : ''}`}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-900 p-4 rounded-xl">
                                <div className="flex flex-col">
                                    <label className="text-sm font-medium text-neutral-900 dark:text-white">
                                        幻刺研磨度
                                    </label>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                        使用幻刺(Pro)磨豆机专用刻度
                                    </p>
                                </div>
                                <div
                                    ref={phanciToggleRef}
                                    className={`relative w-12 h-6 rounded-full transition-colors duration-200 ease-in-out ${settings.grindType === '幻刺' ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-200 dark:bg-neutral-800'}`}
                                    onClick={() => handleSettingChange('grindType', settings.grindType === '幻刺' ? '通用' : '幻刺')}
                                >
                                    <div
                                        className={`absolute top-1 left-1 bg-white dark:bg-black w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${settings.grindType === '幻刺' ? 'translate-x-6' : ''}`}
                                    />
                                </div>
                            </div>

                            {/* 文本缩放选项 - 仅在原生应用中显示 */}
                            {isTextZoomEnabled && (
                                <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-900 p-4 rounded-xl">
                                    <div className="flex flex-col">
                                        <label className="text-sm font-medium text-neutral-900 dark:text-white">
                                            文本大小
                                        </label>
                                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                            缩放级别: {settings.textZoomLevel.toFixed(1)}×
                                        </p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => handleSettingChange('textZoomLevel', Math.max(0.8, settings.textZoomLevel - 0.1))}
                                            className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                                            disabled={settings.textZoomLevel <= 0.8}
                                        >
                                            <span className="text-base font-semibold">−</span>
                                        </button>
                                        <button
                                            onClick={() => handleSettingChange('textZoomLevel', 1.0)}
                                            className={`px-2 py-1 text-xs rounded-md transition-colors ${Math.abs(settings.textZoomLevel - 1.0) < 0.05
                                                ? 'bg-neutral-900 dark:bg-white text-white dark:text-black'
                                                : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                                                }`}
                                        >
                                            标准
                                        </button>
                                        <button
                                            onClick={() => handleSettingChange('textZoomLevel', Math.min(1.4, settings.textZoomLevel + 0.1))}
                                            className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                                            disabled={settings.textZoomLevel >= 1.4}
                                        >
                                            <span className="text-base font-semibold">+</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center italic">
                            这些设置后续可以随时在应用设置中修改
                        </p>
                    </div>
                )}

                {currentStep === 'complete' && (
                    <div className={commonClassNames}>
                        <div className="text-center mb-5">
                            <div className="mb-6 flex justify-center">
                                <div className="w-20 h-20 rounded-full bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
                                    <span className="text-3xl">✨</span>
                                </div>
                            </div>
                            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                                准备就绪！
                            </h2>
                            <p className="text-sm mt-2 text-neutral-500 dark:text-neutral-400">
                                随时随地享受完美手冲咖啡
                            </p>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // 渲染进度指示器
    const renderProgressIndicator = () => {
        const steps: OnboardingStep[] = ['welcome', 'settings', 'complete']
        const currentIndex = steps.indexOf(currentStep)

        return (
            <div className="flex justify-center space-x-2 mt-2">
                {steps.map((step, index) => (
                    <div
                        key={step}
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${index === currentIndex
                            ? 'bg-neutral-900 dark:bg-white w-3'
                            : index < currentIndex
                                ? 'bg-neutral-400 dark:bg-neutral-600'
                                : 'bg-neutral-200 dark:bg-neutral-800'
                            }`}
                    />
                ))}
            </div>
        )
    }

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col justify-end"
        >
            {/* 全屏毛玻璃背景 */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-md" />

            {/* 引导内容卡片 */}
            <div className="relative w-full bg-white dark:bg-black rounded-t-2xl pb-safe">

                {/* 内容容器 */}
                <div className="relative h-full flex flex-col pt-4 pb-6 px-5">
                    {/* 上方把手示意 */}
                    <div className="flex justify-center mb-3">
                        <div className="w-10 h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full"></div>
                    </div>

                    {/* 内容区域 */}
                    <div
                        ref={sliderRef}
                        className="flex-1 relative overflow-hidden"
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                    >
                        {renderStepContent()}
                    </div>

                    {/* 底部进度和按钮 */}
                    <div className="mt-auto">
                        {renderProgressIndicator()}

                        <div className="mt-4">
                            {/* 下一步/完成按钮 */}
                            <button
                                onClick={currentStep === 'complete' ? handleComplete : goToNextStep}
                                className="w-full py-3 px-4 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-lg font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
                            >
                                {currentStep === 'complete' ? '开始使用' : '继续'}
                            </button>

                            {/* 上一步按钮（第一步不显示） */}
                            {currentStep !== 'welcome' && (
                                <div className="text-center mt-1">
                                    <span 
                                        onClick={goToPrevStep}
                                        className="text-neutral-500 dark:text-neutral-400 text-xs cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                                    >
                                        返回
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Onboarding 