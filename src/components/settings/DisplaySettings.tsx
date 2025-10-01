'use client'

import React from 'react'
import { ChevronLeft } from 'lucide-react'
import { SettingsOptions } from './Settings'
import { useTheme } from 'next-themes'
import fontZoomUtils from '@/lib/utils/fontZoomUtils'
import hapticsUtils from '@/lib/ui/haptics'
import { ButtonGroup } from '@/components/ui/ButtonGroup'


interface DisplaySettingsProps {
    settings: SettingsOptions
    onClose: () => void
    handleChange: <K extends keyof SettingsOptions>(key: K, value: SettingsOptions[K]) => void | Promise<void>
}

const DisplaySettings: React.FC<DisplaySettingsProps> = ({
    settings,
    onClose,
    handleChange
}) => {
    const { theme, setTheme } = useTheme()
    const [zoomLevel, setZoomLevel] = React.useState(settings.textZoomLevel || 1.0)
    const [isFontZoomEnabled, setIsFontZoomEnabled] = React.useState(false)

    // 历史栈管理
    React.useEffect(() => {
        window.history.pushState({ modal: 'display-settings' }, '')
        
        const handlePopState = () => onClose()
        window.addEventListener('popstate', handlePopState)
        
        return () => window.removeEventListener('popstate', handlePopState)
    }, [onClose])

    // 关闭处理
    const handleClose = () => {
        if (window.history.state?.modal === 'display-settings') {
            window.history.back()
        } else {
            onClose()
        }
    }

    // 控制动画状态
    const [shouldRender, setShouldRender] = React.useState(false)
    const [isVisible, setIsVisible] = React.useState(false)

    // 处理显示/隐藏动画
    React.useEffect(() => {
        setShouldRender(true)
        // 短暂延迟确保 DOM 渲染，然后触发滑入动画
        const timer = setTimeout(() => setIsVisible(true), 10)
        return () => clearTimeout(timer)
    }, [])

    // 检查字体缩放功能是否可用
    React.useEffect(() => {
        setIsFontZoomEnabled(fontZoomUtils.isAvailable());
    }, [])

    // 处理字体缩放变更
    const handleFontZoomChange = async (newValue: number) => {
        setZoomLevel(newValue);
        fontZoomUtils.set(newValue);
        await handleChange('textZoomLevel', newValue);

        // 触发震动反馈
        if (settings.hapticFeedback) {
            hapticsUtils.light();
        }
    }

    if (!shouldRender) return null

    return (
        <div
            className={`
                fixed inset-0 z-50 flex flex-col bg-neutral-50 dark:bg-neutral-900 max-w-[500px] mx-auto
                transition-transform duration-[350ms] ease-[cubic-bezier(0.36,0.66,0.04,1)]
                ${isVisible ? 'translate-x-0' : 'translate-x-full'}
            `}
        >
            {/* 头部导航栏 */}
            <div className="relative flex items-center justify-center py-4 pt-safe-top">
                <button
                    onClick={handleClose}
                    className="absolute left-4 flex items-center justify-center w-10 h-10 rounded-full text-neutral-700 dark:text-neutral-300"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-md font-medium text-neutral-800 dark:text-neutral-200">显示设置</h2>
            </div>

            {/* 滚动内容区域 */}
            <div className="relative flex-1 overflow-y-auto pb-safe-bottom">
                {/* 顶部渐变阴影 */}
                <div className="sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none first:border-b-0"></div>

                {/* 显示设置组 */}
                <div className="px-6 py-4 -mt-4">
                    <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                        显示
                    </h3>

                    <div className="space-y-5">
                        {/* 外观模式 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                外观模式
                            </div>
                            <ButtonGroup
                                value={theme || 'system'}
                                options={[
                                    { value: 'light', label: '浅色' },
                                    { value: 'dark', label: '深色' },
                                    { value: 'system', label: '系统' }
                                ]}
                                onChange={(value: string) => {
                                    setTheme(value)
                                    if (settings.hapticFeedback) {
                                        hapticsUtils.light();
                                    }
                                }}
                            />
                        </div>

                        {/* 字体缩放设置 */}
                        {isFontZoomEnabled && (
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                        字体大小
                                    </div>
                                    <div className="text-sm text-neutral-400 dark:text-neutral-500">
                                        {zoomLevel.toFixed(1)}×
                                    </div>
                                </div>
                                <div className="px-1">
                                    <input
                                        type="range"
                                        min="0.8"
                                        max="1.4"
                                        step="0.1"
                                        value={zoomLevel}
                                        onChange={(e) => handleFontZoomChange(parseFloat(e.target.value))}
                                        className="w-full h-1.5 bg-neutral-200 rounded-full appearance-none cursor-pointer dark:bg-neutral-700"
                                    />
                                    <div className="flex justify-between mt-1 text-xs text-neutral-500">
                                        <span>小</span>
                                        <span>大</span>
                                    </div>
                                </div>
                                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                                    调整应用的字体大小，设置会自动保存
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 安全区域边距设置组 */}
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-400">
                            安全区域边距
                        </h3>
                        <button
                            onClick={() => {
                                const defaultMargins = {
                                    top: 38,
                                    bottom: 38
                                };
                                handleChange('safeAreaMargins', defaultMargins);
                                if (settings.hapticFeedback) {
                                    hapticsUtils.light();
                                }
                            }}
                            className="text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors px-2 py-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                            还原默认
                        </button>
                    </div>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                        调整应用界面的上下边距，影响导航栏和内容区域的间距
                    </p>

                    <div className="space-y-4">
                        {/* 顶部边距 */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                    顶部边距
                                </div>
                                <button
                                    onClick={() => {
                                        const currentMargins = settings.safeAreaMargins || { top: 38, bottom: 38 };
                                        const newMargins = {
                                            ...currentMargins,
                                            top: 38
                                        };
                                        handleChange('safeAreaMargins', newMargins);
                                        if (settings.hapticFeedback) {
                                            hapticsUtils.light();
                                        }
                                    }}
                                    className="text-sm text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors px-1 py-0.5 rounded"
                                    title="点击重置为默认值"
                                >
                                    {settings.safeAreaMargins?.top || 38}px
                                </button>
                            </div>
                            <div className="px-1">
                                <input
                                    type="range"
                                    min="12"
                                    max="84"
                                    step="2"
                                    value={settings.safeAreaMargins?.top || 38}
                                    onChange={(e) => {
                                        const currentMargins = settings.safeAreaMargins || { top: 38, bottom: 38 };
                                        const newMargins = {
                                            ...currentMargins,
                                            top: parseInt(e.target.value)
                                        };
                                        handleChange('safeAreaMargins', newMargins);
                                    }}
                                    className="w-full h-1.5 bg-neutral-200 rounded-full appearance-none cursor-pointer dark:bg-neutral-700"
                                />
                                <div className="flex justify-between mt-1 text-xs text-neutral-500">
                                    <span>20px</span>
                                    <span>80px</span>
                                </div>
                            </div>
                        </div>

                        {/* 底部边距 */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                    底部边距
                                </div>
                                <button
                                    onClick={() => {
                                        const currentMargins = settings.safeAreaMargins || { top: 38, bottom: 38 };
                                        const newMargins = {
                                            ...currentMargins,
                                            bottom: 38
                                        };
                                        handleChange('safeAreaMargins', newMargins);
                                        if (settings.hapticFeedback) {
                                            hapticsUtils.light();
                                        }
                                    }}
                                    className="text-sm text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors px-1 py-0.5 rounded"
                                    title="点击重置为默认值"
                                >
                                    {settings.safeAreaMargins?.bottom || 38}px
                                </button>
                            </div>
                            <div className="px-1">
                                <input
                                    type="range"
                                    min="20"
                                    max="80"
                                    step="2"
                                    value={settings.safeAreaMargins?.bottom || 38}
                                    onChange={(e) => {
                                        const currentMargins = settings.safeAreaMargins || { top: 38, bottom: 38 };
                                        const newMargins = {
                                            ...currentMargins,
                                            bottom: parseInt(e.target.value)
                                        };
                                        handleChange('safeAreaMargins', newMargins);
                                    }}
                                    className="w-full h-1.5 bg-neutral-200 rounded-full appearance-none cursor-pointer dark:bg-neutral-700"
                                />
                                <div className="flex justify-between mt-1 text-xs text-neutral-500">
                                    <span>20px</span>
                                    <span>80px</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DisplaySettings
