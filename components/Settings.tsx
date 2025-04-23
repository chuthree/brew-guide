'use client'

import React, { useState, useEffect } from 'react'
import { APP_VERSION, availableGrinders } from '@/lib/config'
import { Storage } from '@/lib/storage'
import DataManager from './DataManager'
import hapticsUtils from '@/lib/haptics'
import textZoomUtils from '@/lib/textZoom'
import { useTheme } from 'next-themes'
import { LayoutSettings } from './BrewingTimer'
import confetti from 'canvas-confetti'
import { notifyLanguageChange } from '@/providers/TranslationsProvider'
import { getReferenceGrindSizes, getCategorizedGrindSizes } from '@/lib/grindUtils'

// 定义设置选项接口
export interface SettingsOptions {
    notificationSound: boolean
    hapticFeedback: boolean
    grindType: string
    textZoomLevel: number
    layoutSettings?: LayoutSettings // 添加布局设置
    language: string // 添加语言设置
    showFlowRate: boolean // 添加显示流速选项
}

// 默认设置
export const defaultSettings: SettingsOptions = {
    notificationSound: true,
    hapticFeedback: true,
    grindType: "generic",
    textZoomLevel: 1.0,
    layoutSettings: {
        stageInfoReversed: false,
        progressBarHeight: 4,
        controlsReversed: false,
        alwaysShowTimerInfo: false, // 默认不显示计时器信息
        showStageDivider: true // 默认显示阶段分隔线
    },
    language: 'zh', // 默认使用中文
    showFlowRate: false // 默认不显示流速
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

    // 添加主题颜色更新的 Effect
    useEffect(() => {
        const updateThemeColor = () => {
            const themeColorMeta = document.querySelectorAll('meta[name="theme-color"]');

            // 如果没有找到 meta 标签，创建它们
            if (themeColorMeta.length === 0) {
                const lightMeta = document.createElement('meta');
                lightMeta.name = 'theme-color';
                lightMeta.content = '#fafafa';
                lightMeta.media = '(prefers-color-scheme: light)';
                document.head.appendChild(lightMeta);

                const darkMeta = document.createElement('meta');
                darkMeta.name = 'theme-color';
                darkMeta.content = '#171717';
                darkMeta.media = '(prefers-color-scheme: dark)';
                document.head.appendChild(darkMeta);
            }

            if (theme === 'system') {
                // 对于系统模式，重新创建两个 meta 标签
                themeColorMeta.forEach(meta => meta.remove());

                const lightMeta = document.createElement('meta');
                lightMeta.name = 'theme-color';
                lightMeta.content = '#fafafa';
                lightMeta.media = '(prefers-color-scheme: light)';
                document.head.appendChild(lightMeta);

                const darkMeta = document.createElement('meta');
                darkMeta.name = 'theme-color';
                darkMeta.content = '#171717';
                darkMeta.media = '(prefers-color-scheme: dark)';
                document.head.appendChild(darkMeta);
            } else {
                // 对于明确的主题选择，使用单个 meta 标签
                themeColorMeta.forEach(meta => meta.remove());
                const meta = document.createElement('meta');
                meta.name = 'theme-color';
                meta.content = theme === 'light' ? '#fafafa' : '#171717';
                document.head.appendChild(meta);
            }
        };

        updateThemeColor();

        // 如果是系统模式，添加系统主题变化的监听
        let mediaQuery: MediaQueryList | null = null;
        if (theme === 'system') {
            mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = () => {
                updateThemeColor();
            };
            mediaQuery.addEventListener('change', handleChange);
            return () => {
                mediaQuery?.removeEventListener('change', handleChange);
            };
        }
    }, [theme]);

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

    // 触发彩带特效
    const showConfetti = () => {
        // Find the selected grinder button element
        const selectedGrinderButton = document.getElementById(`grinder-button-${settings.grindType}`);
        if (!selectedGrinderButton) return;
        
        // 获取按钮元素的位置信息
        const rect = selectedGrinderButton.getBoundingClientRect();
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
    const handleChange = async <K extends keyof SettingsOptions>(
        key: K,
        value: SettingsOptions[K]
    ) => {
        // 直接更新设置并保存到存储
        const newSettings = { ...settings, [key]: value }
        setSettings(newSettings)
        await Storage.set('brewGuideSettings', JSON.stringify(newSettings))

        // 当语言设置改变时，触发自定义事件
        if (key === 'language') {
            notifyLanguageChange()
        }

        // 当选择幻刺时触发彩带特效
        if (key === 'grindType' && value === 'phanci_pro') {
            showConfetti();
            // 选择幻刺时也提供触感反馈
            if (settings.hapticFeedback) {
                hapticsUtils.medium();
            }
        }
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
        <div className="fixed inset-0 z-50 flex flex-col bg-neutral-50 dark:bg-neutral-900 max-w-[500px] mx-auto">
            {/* 头部导航栏 */}
            <div 
                className="relative flex items-center justify-center py-4 pt-safe-top border-b border-neutral-200 dark:border-neutral-800"
            >
                <button
                    onClick={onClose}
                    className="absolute left-4 flex items-center justify-center w-10 h-10 rounded-full text-neutral-700 bg-neutral-100 dark:text-neutral-300 dark:bg-neutral-800 transition-colors"
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
                            d="M15 19l-7-7 7-7"
                        />
                    </svg>
                </button>
                <h2 className="text-lg font-medium text-neutral-800 dark:text-neutral-200">设置</h2>
            </div>

            {/* 滚动内容区域 */}
            <div className="flex-1 overflow-y-auto pb-safe-bottom">
                {/* 设置分组 */}
                    {/* 通知设置 */}
                    <section className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-4">
                            通知
                        </h3>
                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-neutral-700 dark:text-neutral-300">
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
                                    <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                                </label>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-neutral-700 dark:text-neutral-300">
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
                                    <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                                </label>
                            </div>
                        </div>
                    </section>

                    

                    {/* 显示设置 */}
                    <section className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-4">
                            显示
                        </h3>

                        {/* 语言选择 */}
                        <div className="space-y-3 mb-6">
                            <div className="text-sm text-neutral-700 dark:text-neutral-300">
                                语言
                            </div>
                            <div className="inline-flex rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800 w-full">
                                <button
                                    className={`flex-1 rounded-md py-3 text-sm font-medium transition-colors ${
                                        settings.language === 'zh'
                                            ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-neutral-100 shadow-sm'
                                            : 'text-neutral-600 dark:text-neutral-400'
                                    }`}
                                    onClick={() => {
                                        handleChange('language', 'zh')
                                        if (settings.hapticFeedback) {
                                            hapticsUtils.light();
                                        }
                                    }}
                                >
                                    中文
                                </button>
                                <button
                                    className={`flex-1 rounded-md py-3 text-sm font-medium transition-colors ${
                                        settings.language === 'en'
                                            ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-neutral-100 shadow-sm'
                                            : 'text-neutral-600 dark:text-neutral-400'
                                    }`}
                                    onClick={() => {
                                        handleChange('language', 'en')
                                        if (settings.hapticFeedback) {
                                            hapticsUtils.light();
                                        }
                                    }}
                                >
                                    English
                                </button>
                            </div>
                        </div>

                        {/* 外观模式切换 */}
                        <div className="space-y-3">
                            <div className="text-sm text-neutral-700 dark:text-neutral-300">
                                外观模式
                            </div>
                            <div className="inline-flex rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800 w-full">
                                <button
                                    className={`flex-1 rounded-md py-3 text-sm font-medium transition-colors ${
                                        theme === 'light'
                                            ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-neutral-100 shadow-sm'
                                            : 'text-neutral-600 dark:text-neutral-400'
                                    }`}
                                    onClick={() => {
                                        setTheme('light')
                                        if (settings.hapticFeedback) {
                                            hapticsUtils.light();
                                        }
                                    }}
                                >
                                    浅色
                                </button>
                                <button
                                    className={`flex-1 rounded-md py-3 text-sm font-medium transition-colors ${
                                        theme === 'dark'
                                            ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-neutral-100 shadow-sm'
                                            : 'text-neutral-600 dark:text-neutral-400'
                                    }`}
                                    onClick={() => {
                                        setTheme('dark')
                                        if (settings.hapticFeedback) {
                                            hapticsUtils.light();
                                        }
                                    }}
                                >
                                    深色
                                </button>
                                <button
                                    className={`flex-1 rounded-md py-3 text-sm font-medium transition-colors ${
                                        theme === 'system'
                                            ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-neutral-100 shadow-sm'
                                            : 'text-neutral-600 dark:text-neutral-400'
                                    }`}
                                    onClick={() => {
                                        setTheme('system')
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
                            <div className="space-y-3">
                                <div className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
                                    文本大小
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-neutral-500">缩放级别: {zoomLevel.toFixed(1)}×</span>
                                        <div className="flex items-center space-x-3">
                                            <button
                                                onClick={() => handleTextZoomChange(Math.max(0.8, zoomLevel - 0.1))}
                                                className="w-10 h-10 flex items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                                                disabled={zoomLevel <= 0.8}
                                            >
                                                <span className="text-xl font-semibold">−</span>
                                            </button>
                                            <button
                                                onClick={() => handleTextZoomChange(1.0)}
                                                className={`px-4 py-2 rounded-md text-sm transition-colors ${
                                                    Math.abs(zoomLevel - 1.0) < 0.05
                                                        ? 'bg-neutral-800 text-neutral-100 dark:bg-neutral-200 dark:text-neutral-900'
                                                        : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                                                }`}
                                            >
                                                标准
                                            </button>
                                            <button
                                                onClick={() => handleTextZoomChange(Math.min(1.4, zoomLevel + 0.1))}
                                                className="w-10 h-10 flex items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                                                disabled={zoomLevel >= 1.4}
                                            >
                                                <span className="text-xl font-semibold">+</span>
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
                                        className="w-full h-1.5 bg-neutral-200 rounded-full appearance-none cursor-pointer dark:bg-neutral-700"
                                    />
                                </div>
                            </div>
                        )}
                    </section>

                    {/* 研磨度设置 */}
                    <section className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-4">
                            研磨度设置
                        </h3>
                        <div className="space-y-4">
                            <div className="text-sm text-neutral-700 dark:text-neutral-300">
                                磨豆机类型
                            </div>
                            <div className="relative">
                                <select
                                    value={settings.grindType}
                                    onChange={(e) => handleChange('grindType', e.target.value)}
                                    className="w-full py-3 px-4 text-sm font-medium rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 appearance-none focus:outline-none focus:ring-2 focus:ring-neutral-500"
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
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                选择你的磨豆机型号，将显示对应的研磨度参考（如果可用）
                            </p>

                            {/* Display grinder specific reference grind sizes if available */}
                            {(() => {
                                const referenceGrindSizes = getReferenceGrindSizes(settings.grindType);
                                
                                if (Object.keys(referenceGrindSizes).length > 0) {
                                    const selectedGrinder = availableGrinders.find(g => g.id === settings.grindType);
                                    
                                    // 使用新函数获取分类后的研磨度数据
                                    const { basicGrindSizes, applicationGrindSizes } = getCategorizedGrindSizes(settings.grindType);
                                    
                                    return (
                                        <div className="mt-3 border-l-2 border-neutral-300 dark:border-neutral-700 pl-4 py-3">
                                            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                                                {selectedGrinder?.name || "磨豆机"} 研磨度参考表
                                            </p>
                                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                                                此表仅作参考，显示通用研磨度与特定磨豆机刻度对照关系
                                            </p>
                                            
                                            {/* 基础研磨度部分 */}
                                            <div className="mb-4">
                                                <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                                                    基础研磨度:
                                                </p>
                                                <div className="grid grid-cols-2 gap-y-3">
                                                    {Object.entries(basicGrindSizes).map(([key, value]) => (
                                                        <div key={key} className="text-sm text-neutral-700 dark:text-neutral-300">
                                                            <span className="font-medium">{key}</span>: {value}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            
                                            {/* 特定应用研磨度部分 */}
                                            {Object.keys(applicationGrindSizes).length > 0 && (
                                                <div>
                                                    <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                                                        特定应用研磨度:
                                                    </p>
                                                    <div className="grid grid-cols-2 gap-y-3">
                                                        {Object.entries(applicationGrindSizes).map(([key, value]) => (
                                                            <div key={key} className="text-sm text-neutral-700 dark:text-neutral-300">
                                                                <span className="font-medium">{key}</span>: {value}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {settings.grindType === 'phanci_pro' && (
                                                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-3">
                                                    手冲中细常用建议：8-9格
                                                </p>
                                            )}
                                            
                                            {/* 数据来源和用户调研信息 */}
                                            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                                    数据来源：网络收集和用户调研，仅供参考
                                                </p>
                                                <div className="mt-2">
                                                    <a 
                                                        href="https://wj.qq.com/s2/19815833/44ae/" 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-blue-600 dark:text-blue-400 flex items-center"
                                                    >
                                                        <span>→ 参与研磨度调研问卷，帮助完善数据</span>
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>
                    </section>

                    {/* 计时器布局设置 */}
                    <section className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-4">
                            计时器布局
                        </h3>
                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                                    阶段信息布局反转
                                </span>
                                <label className="relative inline-flex cursor-pointer items-center">
                                    <input
                                        type="checkbox"
                                        checked={settings.layoutSettings?.stageInfoReversed || false}
                                        onChange={(e) => {
                                            const newLayoutSettings = {
                                                ...settings.layoutSettings,
                                                stageInfoReversed: e.target.checked
                                            };
                                            handleChange('layoutSettings', newLayoutSettings);
                                        }}
                                        className="peer sr-only"
                                    />
                                    <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                                </label>
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                                    控制区布局反转
                                </span>
                                <label className="relative inline-flex cursor-pointer items-center">
                                    <input
                                        type="checkbox"
                                        checked={settings.layoutSettings?.controlsReversed || false}
                                        onChange={(e) => {
                                            const newLayoutSettings = {
                                                ...settings.layoutSettings,
                                                controlsReversed: e.target.checked
                                            };
                                            handleChange('layoutSettings', newLayoutSettings);
                                        }}
                                        className="peer sr-only"
                                    />
                                    <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                                </label>
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                                    始终显示计时器信息
                                </span>
                                <label className="relative inline-flex cursor-pointer items-center">
                                    <input
                                        type="checkbox"
                                        checked={settings.layoutSettings?.alwaysShowTimerInfo || false}
                                        onChange={(e) => {
                                            const newLayoutSettings = {
                                                ...settings.layoutSettings,
                                                alwaysShowTimerInfo: e.target.checked
                                            };
                                            handleChange('layoutSettings', newLayoutSettings);
                                        }}
                                        className="peer sr-only"
                                    />
                                    <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                                </label>
                            </div>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                                开启后，阶段信息和进度条将始终显示，而不仅在计时器运行时显示
                            </p>
                            
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                                    显示阶段分隔线
                                </span>
                                <label className="relative inline-flex cursor-pointer items-center">
                                    <input
                                        type="checkbox"
                                        checked={settings.layoutSettings?.showStageDivider || false}
                                        onChange={(e) => {
                                            const newLayoutSettings = {
                                                ...settings.layoutSettings,
                                                showStageDivider: e.target.checked
                                            };
                                            handleChange('layoutSettings', newLayoutSettings);
                                        }}
                                        className="peer sr-only"
                                    />
                                    <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                                </label>
                            </div>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                                是否在不同阶段之间显示分隔线
                            </p>

                            <div className="flex items-center justify-between">
                                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                                    显示流速
                                </span>
                                <label className="relative inline-flex cursor-pointer items-center">
                                    <input
                                        type="checkbox"
                                        checked={settings.showFlowRate || false}
                                        onChange={(e) => handleChange('showFlowRate', e.target.checked)}
                                        className="peer sr-only"
                                    />
                                    <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                                </label>
                            </div>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                                是否显示当前注水流速
                            </p>
                        
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                                    进度条高度：{settings.layoutSettings?.progressBarHeight || 4}px (默认4px)
                                </span>
                            </div>
                            <input
                                type="range"
                                min="2"
                                max="12"
                                step="1"
                                value={settings.layoutSettings?.progressBarHeight || 4}
                                onChange={(e) => {
                                    const newLayoutSettings = {
                                        ...settings.layoutSettings,
                                        progressBarHeight: parseInt(e.target.value)
                                    };
                                    handleChange('layoutSettings', newLayoutSettings);
                                }}
                                className="w-full h-1.5 bg-neutral-200 rounded-full appearance-none cursor-pointer dark:bg-neutral-700"
                            />
                            {/* 简化预览框 */}
                        <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
                            {/* 阶段信息简化预览 */}
                            <div className={`flex justify-between ${settings.layoutSettings?.stageInfoReversed ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div className="text-sm text-neutral-700 dark:text-neutral-300">阶段信息</div>
                                <div className="text-sm text-neutral-500 dark:text-neutral-400">30s / 60ml</div>
                            </div>
                            
                            {/* 进度条简化预览 */}
                            <div className="my-3">
                                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full" 
                                     style={{ height: `${settings.layoutSettings?.progressBarHeight || 4}px` }}>
                                    <div className="bg-neutral-700 dark:bg-neutral-400 h-full rounded-full w-1/2"></div>
                                </div>
                            </div>
                            
                            {/* 控制区简化预览 */}
                            <div className={`flex justify-between ${settings.layoutSettings?.controlsReversed ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div className="text-sm text-neutral-700 dark:text-neutral-300">00:45 / 50ml</div>
                                <div className="flex space-x-2">
                                    <div className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                                        <div className="w-3 h-3 bg-neutral-700 dark:bg-neutral-400"></div>
                                    </div>
                                    <div className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                                        <div className="w-3 h-3 bg-neutral-700 dark:bg-neutral-400 rotate-45"></div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 flex items-center justify-center">
                                <span>{settings.layoutSettings?.alwaysShowTimerInfo ? '始终显示计时器信息' : '仅在计时器运行时显示信息'}</span>
                            </div>
                        </div>
                        </div>
                    </section>

                    {/* 数据管理 */}
                    <section className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-4">
                            数据管理
                        </h3>
                        <div className="space-y-2">
                            <button
                                onClick={() => setIsDataManagerOpen(true)}
                                className="w-full py-3.5 text-sm font-medium text-neutral-700 border border-neutral-200 rounded-lg transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:border-neutral-700 dark:hover:bg-neutral-800"
                            >
                                打开数据管理
                            </button>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                                导入、导出或重置应用数据
                            </p>
                        </div>
                    </section>

                    {/* 版本信息 */}
                    <div className="px-6 py-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
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