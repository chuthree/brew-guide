'use client'

import React, { useState, useEffect } from 'react'
import { APP_VERSION, availableGrinders, sponsorsList } from '@/lib/config'
import { Storage } from '@/lib/storage'
import DataManager from './DataManager'
import hapticsUtils from '@/lib/haptics'
import textZoomUtils from '@/lib/textZoom'
import { useTheme } from 'next-themes'
import { LayoutSettings } from './Brewing/Timer/Settings'
import confetti from 'canvas-confetti'
import { notifyLanguageChange } from '@/providers/TranslationsProvider'
import { getReferenceGrindSizes, getCategorizedGrindSizes } from '@/lib/grindUtils'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/CoffeeBean/ui/select'
import Image from 'next/image'

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
        alwaysShowTimerInfo: true, // 默认显示计时器信息
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

    // 添加二维码显示状态
    const [showQRCodes, setShowQRCodes] = useState(false)

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

            {/* 滚动内容区域 - 新的简洁设计 */}
            <div className="flex-1 overflow-y-auto pb-safe-bottom divide-y divide-neutral-200 dark:divide-neutral-800">
                {/* 赞助支持 */}
                <div className="px-6 py-4">
                    <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                        支持 & 交流
                    </h3>
                    <button
                        onClick={() => setShowQRCodes(!showQRCodes)}
                        className="w-full flex items-center justify-between py-3 px-4 text-sm font-medium text-neutral-800 bg-neutral-100 rounded-lg transition-colors hover:bg-neutral-200 dark:text-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                    >
                        <span>{showQRCodes ? '收起二维码' : '点击展开二维码'}</span>
                        <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className={`h-4 w-4 ml-2 text-neutral-600 dark:text-neutral-400 transition-transform ${showQRCodes ? 'rotate-180' : ''}`}
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                        >
                            <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={1.5} 
                                d="M19 9l-7 7-7-7" 
                            />
                        </svg>
                    </button>
                    
                    {showQRCodes && (
                        <div className="mt-4 grid grid-cols-2 gap-4">
                            <div className="flex flex-col items-center">
                                <div className="w-full aspect-square relative rounded-lg overflow-hidden">
                                    <Image 
                                        src="/appreciationCode.jpg" 
                                        alt="赞赏码" 
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                                <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">赞赏码</p>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="w-full aspect-square relative rounded-lg overflow-hidden">
                                    <Image 
                                        src="/groupCode.jpg" 
                                        alt="交流群" 
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                                <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">交流群</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* 时间框架设置组 */}
                <div className="px-6 py-4">
                    <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                        通知
                    </h3>
                    
                    {/* 统一样式的设置项 */}
                    <div className="space-y-5">
                        {/* 提示音 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-neutral-800 dark:text-neutral-200">
                                提示音
                            </div>
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
                        
                        {/* 震动反馈 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-neutral-800 dark:text-neutral-200">
                                震动反馈
                            </div>
                            <label className="relative inline-flex cursor-pointer items-center">
                                <input
                                    type="checkbox"
                                    checked={settings.hapticFeedback}
                                    onChange={(e) => {
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
                </div>

                {/* 显示设置组 */}
                <div className="px-6 py-4">
                    <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-40 mb-3">
                        显示
                    </h3>

                    <div className="space-y-5">
                        {/* 语言选择 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-neutral-800 dark:text-neutral-200">
                                语言(Beta)
                            </div>
                            <div className="text-sm text-neutral-400 dark:text-neutral-500">
                                <div className="inline-flex rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
                                    <button
                                        className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
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
                                        className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
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
                        </div>
                        
                        {/* 外观模式 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-neutral-800 dark:text-neutral-200">
                                外观模式
                            </div>
                            <div className="text-sm text-neutral-400 dark:text-neutral-500">
                                <div className="inline-flex rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
                                    <button
                                        className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
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
                                        className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
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
                                        className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
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
                                        系统
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        {/* 文本缩放设置 - 只在原生应用中显示 */}
                        {isTextZoomEnabled && (
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-sm text-neutral-800 dark:text-neutral-200">
                                        文本大小
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
                                        onChange={(e) => handleTextZoomChange(parseFloat(e.target.value))}
                                        className="w-full h-1.5 bg-neutral-200 rounded-full appearance-none cursor-pointer dark:bg-neutral-700"
                                    />
                                    <div className="flex justify-between mt-1 text-xs text-neutral-500">
                                        <span>小</span>
                                        <span 
                                            className={`px-2 py-0.5 rounded ${Math.abs(zoomLevel - 1.0) < 0.05 ? 'bg-neutral-800 text-neutral-100 dark:bg-neutral-200 dark:text-neutral-900' : ''}`}
                                            onClick={() => handleTextZoomChange(1.0)}
                                        >
                                            标准
                                        </span>
                                        <span>大</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 研磨度设置组 */}
                <div className="px-6 py-4">
                    <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                        研磨度设置
                    </h3>
                    
                    <div className="flex items-center justify-between py-2">
                        <label 
                            htmlFor={`grinder-select-${settings.grindType}`}
                            className="text-sm font-medium text-neutral-800 dark:text-neutral-200"
                        >
                            磨豆机类型
                        </label>
                        <div className="relative">
                            <Select
                                value={settings.grindType}
                                onValueChange={(value) => handleChange('grindType', value)}
                            >
                                <SelectTrigger 
                                    variant="minimal"
                                    className="w-auto text-right text-sm text-neutral-600 dark:text-neutral-400"
                                >
                                    <SelectValue placeholder="选择磨豆机" />
                                    <svg 
                                        className="h-4 w-4 ml-1 text-neutral-500" 
                                        xmlns="http://www.w3.org/2000/svg" 
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                    >
                                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                                    </svg>
                                </SelectTrigger>
                                <SelectContent className="max-h-[40vh] overflow-y-auto">
                                    {availableGrinders.map((grinder) => (
                                        <SelectItem
                                            key={grinder.id}
                                            value={grinder.id}
                                        >
                                            {grinder.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Display grinder specific reference grind sizes if available */}
                    {(() => {
                        const referenceGrindSizes = getReferenceGrindSizes(settings.grindType);
                        
                        if (Object.keys(referenceGrindSizes).length > 0) {
                            const selectedGrinder = availableGrinders.find(g => g.id === settings.grindType);
                            const { basicGrindSizes, applicationGrindSizes } = getCategorizedGrindSizes(settings.grindType);
                            
                            return (
                                <div className="mt-3 border-l-2 border-neutral-300 dark:border-neutral-700 pl-4 py-2">
                                    <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                                        {selectedGrinder?.name || "磨豆机"} 研磨度参考
                                    </p>
                                    
                                    {/* 基础研磨度部分 */}
                                    <div className="mb-3">
                                        <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                                            基础研磨度:
                                        </p>
                                        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                            {Object.entries(basicGrindSizes).map(([key, value]) => (
                                                <div key={key} className="flex justify-between text-sm text-neutral-700 dark:text-neutral-300">
                                                    <span className="font-medium">{key}</span>
                                                    <span>{value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* 特定应用研磨度部分 */}
                                    {Object.keys(applicationGrindSizes).length > 0 && (
                                        <div className="mb-3">
                                            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                                                特定应用研磨度:
                                            </p>
                                            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                                {Object.entries(applicationGrindSizes).map(([key, value]) => (
                                                    <div key={key} className="flex justify-between text-sm text-neutral-700 dark:text-neutral-300">
                                                        <span className="font-medium">{key}</span>
                                                        <span>{value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {settings.grindType === 'phanci_pro' && (
                                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                                            手冲中细常用建议：8-9格
                                        </p>
                                    )}
                                    
                                    {/* 数据来源和用户调研信息 */}
                                    <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
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
                                                <span>→ 参与研磨度调研问卷</span>
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}
                </div>

                {/* 计时器布局设置组 */}
                <div className="px-6 py-4">
                    <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                        计时器布局
                    </h3>
                    
                    <div className="space-y-5">
                        {/* 阶段信息布局反转 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-neutral-800 dark:text-neutral-200">
                                阶段信息布局反转
                            </div>
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
                        
                        {/* 控制区布局反转 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-neutral-800 dark:text-neutral-200">
                                控制区布局反转
                            </div>
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
                        
                        {/* 始终显示计时器信息 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-neutral-800 dark:text-neutral-200">
                                始终显示计时器信息
                            </div>
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
                        
                        {/* 显示阶段分隔线 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-neutral-800 dark:text-neutral-200">
                                显示阶段分隔线
                            </div>
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

                        {/* 显示流速 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-neutral-800 dark:text-neutral-200">
                                显示流速
                            </div>
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
                        
                        {/* 进度条高度 */}
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-sm text-neutral-800 dark:text-neutral-200">
                                进度条高度
                            </div>
                            <div className="text-sm text-neutral-400 dark:text-neutral-500">
                                {settings.layoutSettings?.progressBarHeight || 4}px (默认 4px)
                            </div>
                        </div>
                        <div className="px-1 mb-3">
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
                            <div className="flex justify-between mt-1 text-xs text-neutral-500">
                                <span>细</span>
                                <span>粗</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 数据管理组 */}
                <div className="px-6 py-4">
                    <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                        数据管理
                    </h3>
                    <button
                        onClick={() => setIsDataManagerOpen(true)}
                        className="w-full py-3 text-sm font-medium text-neutral-800 bg-neutral-100 rounded-lg transition-colors hover:bg-neutral-200 dark:text-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                    >
                        打开数据管理
                    </button>
                </div>

                {/* 版本信息 */}
                <div className="px-6 pt-12 text-xs text-center text-neutral-400 dark:text-neutral-600">
                    <p>[版本号]</p>
                    <p>v{APP_VERSION}</p>

                    <p className='mt-12'>[来自开发者的小废话]</p>
                    <div className="mt-4 whitespace-pre-wrap text-left mx-auto max-w-52 leading-relaxed">
                       Hi！感谢你愿意尝试这个小工具，还看到了这里， 
                       <br /><br />
                       起初，因为自己记不住方案，也把握不好注水节奏，就开发了这个小工具
                       <br /> <br />
                       没想到发到群里后，能收到这么多支持和反馈，还认识到了好多大佬！
                       <br /> <br />
                       真的谢谢你们，希望我们能一起进步ww
                    </div>

                    <p className='mt-12'>[感谢]</p>

                    <p>感谢以下赞助者的支持</p>
                    <p className="mt-4 mx-auto max-w-56">
                        {sponsorsList
                            .sort((a, b) => {
                                const isAEnglish = /^[A-Za-z0-9\s:]+$/.test(a.charAt(0));
                                const isBEnglish = /^[A-Za-z0-9\s:]+$/.test(b.charAt(0));
                                
                                if (isAEnglish && !isBEnglish) return -1;
                                if (!isAEnglish && isBEnglish) return 1;
                                return a.localeCompare(b, 'zh-CN');
                            })
                            .join('、')}
                        {' 。 and You。'}
                    </p>
                    <p className="mt-12">
                        <a
                            href="https://github.com/chu3/brew-guide" 
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            GitHub
                        </a>
                    </p>
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