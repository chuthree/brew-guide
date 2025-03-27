'use client'

import React, { useState, useEffect } from 'react'
import { APP_VERSION } from '@/lib/config'
import { Storage } from '@/lib/storage'
import DataManager from './DataManager'
import hapticsUtils from '@/lib/haptics'
import textZoomUtils from '@/lib/textZoom'
import { useTheme } from 'next-themes'

// 定义设置选项接口
export interface SettingsOptions {
    notificationSound: boolean
    hapticFeedback: boolean
    grindType: "通用" | "幻刺"
    textZoomLevel: number
}

// 默认设置
export const defaultSettings: SettingsOptions = {
    notificationSound: true,
    hapticFeedback: true,
    grindType: "通用",
    textZoomLevel: 1.0,
}

interface SettingsProps {
    isOpen: boolean
    onClose: () => void
    settings: SettingsOptions
    setSettings: (settings: SettingsOptions) => void
    onDataChange?: () => void
}

const Settings: React.FC<SettingsProps> = ({
    isOpen,
    onClose,
    settings,
    setSettings,
    onDataChange,
}) => {
    // 添加数据管理状态
    const [isDataManagerOpen, setIsDataManagerOpen] = useState(false)

    // 添加文本缩放状态追踪
    const [zoomLevel, setZoomLevel] = useState(settings.textZoomLevel || 1.0)

    // 添加检查TextZoom是否可用的状态
    const [isTextZoomEnabled, setIsTextZoomEnabled] = useState(false)

    // 获取主题相关方法
    const { theme, setTheme } = useTheme()

    // 初始化时检查TextZoom功能是否可用并加载当前缩放级别
    useEffect(() => {
        // 检查TextZoom功能是否可用
        setIsTextZoomEnabled(textZoomUtils.isAvailable());

        const loadTextZoomLevel = async () => {
            if (textZoomUtils.isAvailable()) {
                const currentZoom = await textZoomUtils.get();
                setZoomLevel(currentZoom);
            }
        };

        if (isOpen) {
            loadTextZoomLevel();
        }
    }, [isOpen]);

    // 处理设置变更
    const handleChange = async <K extends keyof SettingsOptions>(
        key: K,
        value: SettingsOptions[K]
    ) => {
        // 直接更新设置并保存到存储
        const newSettings = { ...settings, [key]: value }
        setSettings(newSettings)
        await Storage.set('brewGuideSettings', JSON.stringify(newSettings))
    }

    // 处理文本缩放变更
    const handleTextZoomChange = async (newValue: number) => {
        setZoomLevel(newValue);
        await textZoomUtils.set(newValue);
        await handleChange('textZoomLevel', newValue);

        // 触发震动反馈
        if (settings.hapticFeedback) {
            hapticsUtils.light();
        }
    }

    // 如果不是打开状态，不渲染任何内容
    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={onClose} // 点击背景关闭设置
        >
            <div
                className="w-full max-w-md rounded-lg bg-white/90 p-6 shadow-lg backdrop-blur-sm dark:bg-neutral-800/90"
                onClick={(e) => e.stopPropagation()} // 防止点击内容区域关闭设置
            >
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-light tracking-wide">设置</h2>
                    <button
                        onClick={onClose}
                        className="rounded-full p-1 text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                <div className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
                    <p>双击应用标题可打开此面板，点击任意处关闭</p>
                </div>

                <div className="space-y-5">
                    {/* 通知设置 */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                            通知
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                                    提示音
                                </span>
                                <label className="relative inline-flex cursor-pointer items-center">
                                    <input
                                        type="checkbox"
                                        checked={settings.notificationSound}
                                        onChange={(e) =>
                                            handleChange('notificationSound', e.target.checked)
                                        }
                                        className="peer sr-only"
                                    />
                                    <div className="peer h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-500 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                                </label>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                                    震动反馈
                                </span>
                                <label className="relative inline-flex cursor-pointer items-center">
                                    <input
                                        type="checkbox"
                                        checked={settings.hapticFeedback}
                                        onChange={(e) => {
                                            // 如果开启触感反馈，提供一个预览
                                            if (e.target.checked) {
                                                hapticsUtils.medium();
                                                setTimeout(() => hapticsUtils.light(), 200);
                                            }
                                            handleChange('hapticFeedback', e.target.checked);
                                        }}
                                        className="peer sr-only"
                                    />
                                    <div className="peer h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-500 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* 显示设置 */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                            显示
                        </h3>

                        {/* 外观模式切换 */}
                        <div className="space-y-2">
                            <div className="text-sm text-neutral-600 dark:text-neutral-400">
                                外观模式
                            </div>
                            <div className="flex rounded-md bg-neutral-100 dark:bg-neutral-700">
                                <button
                                    className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${theme === 'light'
                                        ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-800'
                                        : 'text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-600'
                                        }`}
                                    onClick={() => {
                                        setTheme('light')
                                        // 触发震动反馈
                                        if (settings.hapticFeedback) {
                                            hapticsUtils.light();
                                        }
                                    }}
                                >
                                    浅色
                                </button>
                                <button
                                    className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${theme === 'dark'
                                        ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-800'
                                        : 'text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-600'
                                        }`}
                                    onClick={() => {
                                        setTheme('dark')
                                        // 触发震动反馈
                                        if (settings.hapticFeedback) {
                                            hapticsUtils.light();
                                        }
                                    }}
                                >
                                    深色
                                </button>
                                <button
                                    className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${theme === 'system'
                                        ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-800'
                                        : 'text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-600'
                                        }`}
                                    onClick={() => {
                                        setTheme('system')
                                        // 触发震动反馈
                                        if (settings.hapticFeedback) {
                                            hapticsUtils.light();
                                        }
                                    }}
                                >
                                    跟随系统
                                </button>
                            </div>
                        </div>

                        {/* 文本缩放设置 - 只在原生应用中显示 */}
                        {isTextZoomEnabled && (
                            <div className="space-y-2 mt-3">
                                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                                    文本大小
                                </div>
                                <div className="flex flex-col space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-neutral-500">缩放级别: {zoomLevel.toFixed(1)}×</span>
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => handleTextZoomChange(Math.max(0.8, zoomLevel - 0.1))}
                                                className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-800 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                                                disabled={zoomLevel <= 0.8}
                                            >
                                                <span className="text-lg font-semibold">−</span>
                                            </button>
                                            <button
                                                onClick={() => handleTextZoomChange(1.0)}
                                                className={`px-3 py-1 text-xs rounded-md transition-colors ${Math.abs(zoomLevel - 1.0) < 0.05
                                                    ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-800'
                                                    : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-600'
                                                    }`}
                                            >
                                                标准
                                            </button>
                                            <button
                                                onClick={() => handleTextZoomChange(Math.min(1.4, zoomLevel + 0.1))}
                                                className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-800 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                                                disabled={zoomLevel >= 1.4}
                                            >
                                                <span className="text-lg font-semibold">+</span>
                                            </button>
                                        </div>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.8"
                                        max="1.4"
                                        step="0.1"
                                        value={zoomLevel}
                                        onChange={(e) => handleTextZoomChange(parseFloat(e.target.value))}
                                        className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer dark:bg-neutral-700"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 研磨度设置 */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                            研磨度设置
                        </h3>
                        <div className="space-y-2">
                            <div className="text-sm text-neutral-600 dark:text-neutral-400">
                                研磨度类型
                            </div>
                            <div className="flex rounded-md bg-neutral-100 dark:bg-neutral-700">
                                <button
                                    className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${settings.grindType === '通用'
                                        ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-800'
                                        : 'text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-600'
                                        }`}
                                    onClick={() => handleChange('grindType', '通用')}
                                >
                                    通用
                                </button>
                                <button
                                    className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${settings.grindType === '幻刺'
                                        ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-800'
                                        : 'text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-600'
                                        }`}
                                    onClick={() => handleChange('grindType', '幻刺')}
                                >
                                    幻刺
                                </button>
                            </div>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                选择&quot;幻刺&quot;将显示专用于幻刺(Pro)磨豆机的研磨度设置
                            </p>

                            {settings.grindType === '幻刺' && (
                                <div className="mt-2 space-y-2 bg-neutral-50 dark:bg-neutral-800 p-3 rounded-md">
                                    <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                                        幻刺(Pro)研磨度参考
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="text-xs text-neutral-600 dark:text-neutral-400">
                                            <span className="font-medium">意式</span>: 2-4格
                                        </div>
                                        <div className="text-xs text-neutral-600 dark:text-neutral-400">
                                            <span className="font-medium">摩卡壶</span>: 3-6.5格
                                        </div>
                                        <div className="text-xs text-neutral-600 dark:text-neutral-400">
                                            <span className="font-medium text-neutral-800 dark:text-neutral-200">手冲</span>: 6-10格
                                        </div>
                                        <div className="text-xs text-neutral-600 dark:text-neutral-400">
                                            <span className="font-medium">法压壶</span>: 9-11.5格
                                        </div>
                                        <div className="text-xs text-neutral-600 dark:text-neutral-400">
                                            <span className="font-medium">冷萃</span>: 8-12格
                                        </div>
                                    </div>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                        手冲中细常用建议：8-9格
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 数据管理 */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                            数据管理
                        </h3>
                        <div className="space-y-3">
                            <button
                                onClick={() => setIsDataManagerOpen(true)}
                                className="w-full rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600"
                            >
                                打开数据管理
                            </button>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                导入、导出或重置应用数据
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-5 text-center text-xs text-neutral-500 dark:text-neutral-400">
                    v{APP_VERSION}
                </div>
            </div>

            {/* 数据管理组件 */}
            {isDataManagerOpen && (
                <DataManager
                    isOpen={isDataManagerOpen}
                    onClose={() => setIsDataManagerOpen(false)}
                    onDataChange={onDataChange}
                />
            )}
        </div>
    )
}

export default Settings 