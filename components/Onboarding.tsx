'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Storage } from '@/lib/storage'
import { SettingsOptions, defaultSettings } from '@/components/Settings'
import textZoomUtils from '@/lib/textZoom'
import confetti from 'canvas-confetti'
import { availableGrinders } from '@/lib/config'

// 设置页面界面属性
interface OnboardingProps {
    onSettingsChange: (settings: SettingsOptions) => void
    onComplete: () => void
}

// 主组件
const Onboarding: React.FC<OnboardingProps> = ({ onSettingsChange, onComplete }) => {
    // 设置选项
    const [settings, setSettings] = useState<SettingsOptions>(defaultSettings)
    // 音频上下文
    const audioContext = useRef<AudioContext | null>(null)
    // 检查TextZoom功能是否可用
    const [isTextZoomEnabled, setIsTextZoomEnabled] = useState(false)

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

    // 触发彩带特效
    const showConfetti = () => {
        // Find the select element wrapper
        const grinderSelectWrapper = document.getElementById('onboarding-grinder-select-wrapper');
        if (!grinderSelectWrapper) return;
        
        // 获取元素的位置信息
        const rect = grinderSelectWrapper.getBoundingClientRect();
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

        // 当改变文本缩放级别时立即应用
        if (key === 'textZoomLevel') {
            textZoomUtils.set(value as number)
        }

        // 当选择幻刺时触发彩带特效
        if (key === 'grindType' && value === 'phanci_pro') {
            showConfetti()
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

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
            {/* 半透明背景 */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

            {/* 设置内容卡片 */}
            <div className="relative w-full bg-white dark:bg-black rounded-t-2xl pb-safe-bottom">
                {/* 内容容器 */}
                <div className="relative flex flex-col pt-4 pb-6 px-5">
                    {/* 上方把手示意 */}
                    <div className="flex justify-center mb-3">
                        <div className="w-10 h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full"></div>
                    </div>

                    {/* 内容区域 */}
                    <div className="relative">
                        <div className="flex flex-col w-full">
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                                    欢迎使用
                                </h2>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
                                    请设置您的偏好，开始完美的使用体验
                                </p>
                            </div>

                            <div className="w-full space-y-4">
                                <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-900 p-4 rounded-xl">
                                    <div className="flex flex-col">
                                        <label className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
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
                                
                                {/* 磨豆机选择 */}
                                <div id="onboarding-grinder-select-wrapper" className="bg-neutral-50 dark:bg-neutral-900 p-4 rounded-xl">
                                    <label className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1 block">
                                        磨豆机类型
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={settings.grindType}
                                            onChange={(e) => handleSettingChange('grindType', e.target.value)}
                                            className="w-full py-2 px-3 text-sm font-medium rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 appearance-none focus:outline-none focus:ring-2 focus:ring-neutral-500"
                                        >
                                            {availableGrinders.map((grinder) => (
                                                <option key={grinder.id} value={grinder.id}>
                                                    {grinder.name}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-700 dark:text-neutral-300">
                                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                        </div>
                                    </div>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                                        选择你的磨豆机，方便查看研磨度参考
                                    </p>
                                </div>

                                {/* 文本缩放选项 - 仅在可用时显示 */}
                                {isTextZoomEnabled && (
                                    <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-900 p-4 rounded-xl">
                                        <div className="flex flex-col">
                                            <label className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
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
                                                    ? 'bg-neutral-900 dark:bg-white text-neutral-100 dark:text-black'
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

                            {/* 底部按钮 */}
                            <div className="mt-8">
                                <button
                                    onClick={handleComplete}
                                    className="w-full py-3 px-4 bg-neutral-900 dark:bg-white text-neutral-100 dark:text-black rounded-xl font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
                                >
                                    开始使用
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Onboarding 