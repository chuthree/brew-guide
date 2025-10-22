'use client'

import React from 'react'
import { ChevronLeft } from 'lucide-react'
import { SettingsOptions } from './Settings'
import { getChildPageStyle } from '@/lib/navigation/pageTransition'


interface FlavorPeriodSettingsProps {
    settings: SettingsOptions
    onClose: () => void
    handleChange: <K extends keyof SettingsOptions>(key: K, value: SettingsOptions[K]) => void | Promise<void>
}

const FlavorPeriodSettings: React.FC<FlavorPeriodSettingsProps> = ({
    settings,
    onClose,
    handleChange
}) => {
    // 历史栈管理
    const onCloseRef = React.useRef(onClose)
    onCloseRef.current = onClose
    
    React.useEffect(() => {
        window.history.pushState({ modal: 'flavor-period-settings' }, '')
        
        const handlePopState = () => onCloseRef.current()
        window.addEventListener('popstate', handlePopState)
        
        return () => window.removeEventListener('popstate', handlePopState)
    }, []) // 空依赖数组，确保只在挂载时执行一次

    // 关闭处理
    const handleClose = () => {
        // 立即触发退出动画
        setIsVisible(false)
        
        // 立即通知父组件子设置正在关闭
        window.dispatchEvent(new CustomEvent('subSettingsClosing'))
        
        // 等待动画完成后再真正关闭
        setTimeout(() => {
            if (window.history.state?.modal === 'flavor-period-settings') {
                window.history.back()
            } else {
                onClose()
            }
        }, 350) // 与 IOS_TRANSITION_CONFIG.duration 一致
    }

    // 控制动画状态
    const [shouldRender, setShouldRender] = React.useState(false)
    const [isVisible, setIsVisible] = React.useState(false)

    // 处理显示/隐藏动画
    React.useEffect(() => {
        setShouldRender(true)
        const timer = setTimeout(() => setIsVisible(true), 10)
        return () => clearTimeout(timer)
    }, [])

    // 辅助函数：更新自定义赏味期设置
    const updateCustomFlavorPeriod = (
        roastType: 'light' | 'medium' | 'dark',
        field: 'startDay' | 'endDay',
        value: number
    ) => {
        const current = settings.customFlavorPeriod || {
            light: { startDay: 0, endDay: 0 },
            medium: { startDay: 0, endDay: 0 },
            dark: { startDay: 0, endDay: 0 }
        };

        const newCustomFlavorPeriod = {
            ...current,
            [roastType]: {
                ...current[roastType],
                [field]: value
            }
        };
        handleChange('customFlavorPeriod', newCustomFlavorPeriod);
    };

    if (!shouldRender) return null

    return (
        <div
            className="fixed inset-0 z-[60] flex flex-col bg-neutral-50 dark:bg-neutral-900 max-w-[500px] mx-auto"
            style={getChildPageStyle(isVisible)}
        >
            {/* 头部导航栏 */}
            <div className="relative flex items-center justify-center py-4 pt-safe-top">
                <button
                    onClick={handleClose}
                    className="absolute left-4 flex items-center justify-center w-10 h-10 rounded-full text-neutral-700 dark:text-neutral-300"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-md font-medium text-neutral-800 dark:text-neutral-200">
                    自定义赏味期预设
                </h2>
            </div>

            {/* 滚动内容区域 */}
            <div className="relative flex-1 overflow-y-auto pb-safe-bottom divide-y divide-neutral-200 dark:divide-neutral-800">
                {/* 顶部渐变阴影 */}
                <div className="sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none first:border-b-0"></div>

                {/* 设置内容 */}
                <div className="px-6 py-4 -mt-4">
                    <div className="space-y-3">
                        {/* 浅烘焙设置 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200 w-12">
                                浅烘
                            </div>
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-1">
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">养豆</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="30"
                                        value={settings.customFlavorPeriod?.light?.startDay || ''}
                                        placeholder="7"
                                        onChange={(e) => {
                                            const value = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                                            updateCustomFlavorPeriod('light', 'startDay', value);
                                        }}
                                        className="w-12 py-1 px-2 text-xs text-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                    />
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">天</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">赏味</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="90"
                                        value={settings.customFlavorPeriod?.light?.endDay || ''}
                                        placeholder="60"
                                        onChange={(e) => {
                                            const value = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                                            updateCustomFlavorPeriod('light', 'endDay', value);
                                        }}
                                        className="w-12 py-1 px-2 text-xs text-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                    />
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">天</span>
                                </div>
                            </div>
                        </div>

                        {/* 中烘焙设置 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200 w-12">
                                中烘
                            </div>
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-1">
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">养豆</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="30"
                                        value={settings.customFlavorPeriod?.medium?.startDay || ''}
                                        placeholder="10"
                                        onChange={(e) => {
                                            const value = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                                            updateCustomFlavorPeriod('medium', 'startDay', value);
                                        }}
                                        className="w-12 py-1 px-2 text-xs text-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                    />
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">天</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">赏味</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="90"
                                        value={settings.customFlavorPeriod?.medium?.endDay || ''}
                                        placeholder="60"
                                        onChange={(e) => {
                                            const value = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                                            updateCustomFlavorPeriod('medium', 'endDay', value);
                                        }}
                                        className="w-12 py-1 px-2 text-xs text-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                    />
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">天</span>
                                </div>
                            </div>
                        </div>

                        {/* 深烘焙设置 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200 w-12">
                                深烘
                            </div>
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-1">
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">养豆</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="30"
                                        value={settings.customFlavorPeriod?.dark?.startDay || ''}
                                        placeholder="14"
                                        onChange={(e) => {
                                            const value = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                                            updateCustomFlavorPeriod('dark', 'startDay', value);
                                        }}
                                        className="w-12 py-1 px-2 text-xs text-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                    />
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">天</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">赏味</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="90"
                                        value={settings.customFlavorPeriod?.dark?.endDay || ''}
                                        placeholder="90"
                                        onChange={(e) => {
                                            const value = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                                            updateCustomFlavorPeriod('dark', 'endDay', value);
                                        }}
                                        className="w-12 py-1 px-2 text-xs text-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                    />
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">天</span>
                                </div>
                            </div>
                        </div>
                    </div>
                     <h3 className="text-sm text-neutral-500 dark:text-neutral-400 mt-3">
                        添加咖啡豆时，会根据烘焙度自动设定赏味期。空值表示使用默认预设（灰色数字）。
                    </h3>
                </div>
            </div>
        </div>
    )
}

export default FlavorPeriodSettings
