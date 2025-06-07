'use client'

import React, { useState, useEffect, useRef } from 'react'
import { APP_VERSION, sponsorsList } from '@/lib/core/config'
import { Storage } from '@/lib/core/storage'
import DataManager from '../common/data/DataManager'
import hapticsUtils from '@/lib/ui/haptics'
import textZoomUtils from '@/lib/utils/textZoomUtils'
import { useTheme } from 'next-themes'
import { LayoutSettings } from '../brewing/Timer/Settings'

import Image from 'next/image'
import GrinderSettings from './GrinderSettings'
import { motion, AnimatePresence } from 'framer-motion'
// 导入Lottie动画JSON文件
import chuchuAnimation from '../../../public/animations/chuchu-animation.json'

// 自定义磨豆机接口
export interface CustomGrinder {
    id: string
    name: string
    grindSizes: Record<string, string>
    isCustom: true
}

// 定义设置选项接口
export interface SettingsOptions {
    notificationSound: boolean
    hapticFeedback: boolean
    grindType: string
    textZoomLevel: number
    layoutSettings?: LayoutSettings // 添加布局设置
    showFlowRate: boolean // 添加显示流速选项
    username: string // 添加用户名
    decrementPresets: number[] // 添加咖啡豆库存快捷扣除量预设值
    showOnlyBeanName: boolean // 是否只显示咖啡豆名称
    showFlavorPeriod: boolean // 是否显示赏味期信息而不是烘焙日期
    customGrinders?: CustomGrinder[] // 添加自定义磨豆机列表
    simpleBeanFormMode: boolean // 咖啡豆表单简单模式
    safeAreaMargins?: {
        top: number // 顶部边距
        bottom: number // 底部边距
    }
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
    showFlowRate: false, // 默认不显示流速
    username: '', // 默认用户名为空
    decrementPresets: [15, 16, 18], // 默认的库存扣除量预设值
    showOnlyBeanName: true, // 默认简化咖啡豆名称
    showFlavorPeriod: false, // 默认显示烘焙日期而不是赏味期
    customGrinders: [], // 默认无自定义磨豆机
    simpleBeanFormMode: false, // 默认使用完整表单模式
    safeAreaMargins: {
        top: 38, // 默认顶部边距 42px
        bottom: 38 // 默认底部边距 42px
    }
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
    // 添加显示哪种二维码的状态
    const [qrCodeType, setQrCodeType] = useState<'appreciation' | 'group' | null>(null)

    // 新增用于编辑扣除量预设的状态
    const [decrementValue, setDecrementValue] = useState<string>('')
    const [decrementPresets, setDecrementPresets] = useState<number[]>(
        settings.decrementPresets || defaultSettings.decrementPresets
    )

    // 添加彩蛋动画状态
    const [showEasterEgg, setShowEasterEgg] = useState(false)
    const lottieRef = useRef<any>(null)
    const [LottieComponent, setLottieComponent] = useState<any>(null)

    // 创建音效播放引用
    const audioRef = useRef<HTMLAudioElement | null>(null)

    // 初始化音频元素和Lottie组件
    useEffect(() => {
        // 仅在客户端创建音频元素
        if (typeof window !== 'undefined') {
            audioRef.current = new Audio('/sounds/notification-pings.mp3')

            // 预加载Lottie组件
            import('lottie-react').then(module => {
                setLottieComponent(() => module.default)
            })
        }
    }, [])

    // 当settings发生变化时更新decrementPresets状态
    useEffect(() => {
        if (settings.decrementPresets) {
            setDecrementPresets(settings.decrementPresets);
        }
    }, [settings.decrementPresets]);

    // 添加主题颜色更新的 Effect
    useEffect(() => {
        // 确保只在客户端执行
        if (typeof window === 'undefined') return;

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

    // showConfetti 函数已移到 GrinderSettings 组件中

    // 处理设置变更
const handleChange = async <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
) => {
    // 直接更新设置并保存到存储
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    await Storage.set('brewGuideSettings', JSON.stringify(newSettings))

    // 触发自定义事件通知其他组件设置已更改
    window.dispatchEvent(new CustomEvent('storageChange', {
        detail: { key: 'brewGuideSettings' }
    }))


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

    // 添加预设值函数
    const addDecrementPreset = () => {
        const value = parseFloat(decrementValue)
        if (!isNaN(value) && value > 0) {
            // 保留一位小数
            const formattedValue = parseFloat(value.toFixed(1))

            // 检查是否已经存在该预设值
            if (!decrementPresets.includes(formattedValue)) {
                const newPresets = [...decrementPresets, formattedValue].sort((a, b) => a - b)
                setDecrementPresets(newPresets)
                handleChange('decrementPresets', newPresets)
                setDecrementValue('')

                // 提供触感反馈
                if (settings.hapticFeedback) {
                    hapticsUtils.light()
                }
            }
        }
    }

    // 删除预设值函数
    const removeDecrementPreset = (value: number) => {
        const newPresets = decrementPresets.filter(v => v !== value)
        setDecrementPresets(newPresets)
        handleChange('decrementPresets', newPresets)

        // 提供触感反馈
        if (settings.hapticFeedback) {
            hapticsUtils.light()
        }
    }

    // 处理Lottie动画完成事件
    const handleAnimationComplete = () => {
        // 立即停止音频播放
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
        }

        // 动画播放结束后关闭弹窗
        setTimeout(() => {
            setShowEasterEgg(false)
        }, 500)
    }

    // 处理彩蛋动画 - 简化为一次点击即触发
    const handleEasterEgg = () => {
        if (showEasterEgg) return

        setShowEasterEgg(true)

        // 触发震动反馈
        if (settings.hapticFeedback) {
            hapticsUtils.medium()
        }

        // 播放音效
        if (audioRef.current && settings.notificationSound) {
            // 重置音频播放位置
            audioRef.current.currentTime = 0
            // 播放音效
            audioRef.current.play().catch(err => {
                console.log('音频播放失败:', err)
            })
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
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => {
                                if (qrCodeType === 'appreciation') {
                                    setQrCodeType(null);
                                    setShowQRCodes(false);
                                } else {
                                    setQrCodeType('appreciation');
                                    setShowQRCodes(true);
                                }
                            }}
                            className="flex items-center justify-between py-3 px-4 text-sm font-medium text-neutral-800 bg-neutral-100 rounded-lg transition-colors hover:bg-neutral-200 dark:text-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                        >
                            <span>{qrCodeType === 'appreciation' ? '收起二维码' : '赞赏码'}</span>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`h-4 w-4 ml-2 text-neutral-600 dark:text-neutral-400 transition-transform ${qrCodeType === 'appreciation' ? 'rotate-180' : ''}`}
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
                        <button
                            onClick={() => {
                                if (qrCodeType === 'group') {
                                    setQrCodeType(null);
                                    setShowQRCodes(false);
                                } else {
                                    setQrCodeType('group');
                                    setShowQRCodes(true);
                                }
                            }}
                            className="flex items-center justify-between py-3 px-4 text-sm font-medium text-neutral-800 bg-neutral-100 rounded-lg transition-colors hover:bg-neutral-200 dark:text-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                        >
                            <span>{qrCodeType === 'group' ? '收起二维码' : '交流群'}</span>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`h-4 w-4 ml-2 text-neutral-600 dark:text-neutral-400 transition-transform ${qrCodeType === 'group' ? 'rotate-180' : ''}`}
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
                    </div>

                    {showQRCodes && (
                        <div className="mt-4 grid grid-cols-2 gap-4">
                            {qrCodeType === 'appreciation' ? (
                                <>
                                    <div className="flex flex-col items-center">
                                        <div className="w-full aspect-square relative rounded-lg overflow-hidden">
                                            <Image
                                                src="/images/content/appreciation-code.jpg"
                                                alt="赞赏码"
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">赞赏码</p>
                                    </div>
                                    <div className="flex flex-col items-center opacity-0">
                                        <div className="w-full aspect-square relative rounded-lg overflow-hidden invisible">
                                            <div className="w-full h-full" />
                                        </div>
                                        <p className="mt-2 text-xs invisible">占位</p>
                                    </div>
                                </>
                            ) : qrCodeType === 'group' ? (
                                <>
                                    <div className="flex flex-col items-center opacity-0">
                                        <div className="w-full aspect-square relative rounded-lg overflow-hidden invisible">
                                            <div className="w-full h-full" />
                                        </div>
                                        <p className="mt-2 text-xs invisible">占位</p>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <div className="w-full aspect-square relative rounded-lg overflow-hidden">
                                            <Image
                                                src="https://coffee.chu3.top/images/content/group-code.jpg"
                                                alt="交流群"
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">交流群</p>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    )}
                </div>

                {/* 个人信息设置组 */}
                <div className="px-6 py-4">
                    <div className="space-y-4">
                        {/* 用户名 */}
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-2">
                                用户名
                            </label>
                            <input
                                type="text"
                                id="username"
                                value={settings.username}
                                onChange={(e) => handleChange('username', e.target.value)}
                                placeholder="请输入您的用户名"
                                className="w-full py-2 px-3 text-sm font-medium rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 appearance-none focus:outline-hidden focus:ring-2 focus:ring-neutral-500"
                            />
                            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                                用于在分享时显示签名
                            </p>
                        </div>
                    </div>
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
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
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
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
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
                        {/* 外观模式 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                外观模式
                            </div>
                            <div className="text-sm text-neutral-400 dark:text-neutral-500">
                                <div className="inline-flex rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
                                    <button
                                        className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                            theme === 'light'
                                                ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-neutral-100 shadow-xs'
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
                                                ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-neutral-100 shadow-xs'
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
                                                ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-neutral-100 shadow-xs'
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
                                    <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
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
                                            className={`px-2 py-0.5 rounded-sm ${Math.abs(zoomLevel - 1.0) < 0.05 ? 'bg-neutral-800 text-neutral-100 dark:bg-neutral-200 dark:text-neutral-900' : ''}`}
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

                {/* 安全区域边距设置组 */}
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-400">
                            安全区域边距
                        </h3>
                        <button
                            onClick={() => {
                                const defaultMargins = defaultSettings.safeAreaMargins!;
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
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
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
                                        const currentMargins = settings.safeAreaMargins || defaultSettings.safeAreaMargins!;
                                        const newMargins = {
                                            ...currentMargins,
                                            top: defaultSettings.safeAreaMargins!.top
                                        };
                                        handleChange('safeAreaMargins', newMargins);
                                        if (settings.hapticFeedback) {
                                            hapticsUtils.light();
                                        }
                                    }}
                                    className="text-sm text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors px-1 py-0.5 rounded"
                                    title="点击重置为默认值"
                                >
                                    {settings.safeAreaMargins?.top || defaultSettings.safeAreaMargins!.top}px
                                </button>
                            </div>
                            <div className="px-1">
                                <input
                                    type="range"
                                    min="12"
                                    max="84"
                                    step="2"
                                    value={settings.safeAreaMargins?.top || defaultSettings.safeAreaMargins!.top}
                                    onChange={(e) => {
                                        const currentMargins = settings.safeAreaMargins || defaultSettings.safeAreaMargins!;
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
                                        const currentMargins = settings.safeAreaMargins || defaultSettings.safeAreaMargins!;
                                        const newMargins = {
                                            ...currentMargins,
                                            bottom: defaultSettings.safeAreaMargins!.bottom
                                        };
                                        handleChange('safeAreaMargins', newMargins);
                                        if (settings.hapticFeedback) {
                                            hapticsUtils.light();
                                        }
                                    }}
                                    className="text-sm text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors px-1 py-0.5 rounded"
                                    title="点击重置为默认值"
                                >
                                    {settings.safeAreaMargins?.bottom || defaultSettings.safeAreaMargins!.bottom}px
                                </button>
                            </div>
                            <div className="px-1">
                                <input
                                    type="range"
                                    min="20"
                                    max="80"
                                    step="2"
                                    value={settings.safeAreaMargins?.bottom || defaultSettings.safeAreaMargins!.bottom}
                                    onChange={(e) => {
                                        const currentMargins = settings.safeAreaMargins || defaultSettings.safeAreaMargins!;
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

                {/* 研磨度设置组 */}
<GrinderSettings
    settings={settings}
    handleChange={handleChange}
/>

                {/* 库存扣除量预设值设置组 */}
                <div className="px-6 py-4">
                    <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                        库存扣除预设值
                    </h3>

                    <div className="flex gap-2 mb-3 flex-wrap">
                        {decrementPresets.map((value) => (
                            <button
                                key={value}
                                onClick={() => removeDecrementPreset(value)}
                                className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                            >
                                -{value}g ×
                            </button>
                        ))}

                        <div className="flex h-9">
                            <input
                                type="tel"
                                value={decrementValue}
                                onChange={(e) => {
                                    // 限制只能输入数字和小数点
                                    const value = e.target.value.replace(/[^0-9.]/g, '');

                                    // 确保只有一个小数点
                                    const dotCount = (value.match(/\./g) || []).length;
                                    let sanitizedValue = dotCount > 1 ?
                                        value.substring(0, value.lastIndexOf('.')) :
                                        value;

                                    // 限制小数点后只能有一位数字
                                    const dotIndex = sanitizedValue.indexOf('.');
                                    if (dotIndex !== -1 && dotIndex < sanitizedValue.length - 2) {
                                        sanitizedValue = sanitizedValue.substring(0, dotIndex + 2);
                                    }

                                    setDecrementValue(sanitizedValue);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        addDecrementPreset()
                                    }
                                }}
                                placeholder="克数"
                                className="w-16 py-1.5 px-2 text-sm bg-neutral-100 dark:bg-neutral-800 border-y border-l border-neutral-200/50 dark:border-neutral-700 rounded-l-lg rounded-r-none focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                            />
                            <button
                                onClick={addDecrementPreset}
                                disabled={!decrementValue || isNaN(parseFloat(decrementValue)) || parseFloat(decrementValue) <= 0}
                                className="py-1.5 px-2 bg-neutral-700 dark:bg-neutral-600 text-white rounded-r-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                +
                            </button>
                        </div>
                    </div>
                </div>

                {/* 咖啡豆显示设置组 */}
                <div className="px-6 py-4">
                    <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                        豆仓列表显示设置
                    </h3>

                    <div className="space-y-5">
                        {/* 简化咖啡豆名称 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                简化咖啡豆名称
                            </div>
                            <label className="relative inline-flex cursor-pointer items-center">
                                <input
                                    type="checkbox"
                                    checked={settings.showOnlyBeanName || false}
                                    onChange={(e) => handleChange('showOnlyBeanName', e.target.checked)}
                                    className="peer sr-only"
                                />
                                <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                            </label>
                        </div>

                        {/* 显示赏味期信息 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                显示赏味期信息
                            </div>
                            <label className="relative inline-flex cursor-pointer items-center">
                                <input
                                    type="checkbox"
                                    checked={settings.showFlavorPeriod || false}
                                    onChange={(e) => handleChange('showFlavorPeriod', e.target.checked)}
                                    className="peer sr-only"
                                />
                                <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* 计时器布局设置组 */}
                <div className="px-6 py-4">
                    <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                        计时器布局
                    </h3>

                    <div className="space-y-5">

                        {/* 阶段信息布局反转 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
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
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
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
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
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
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
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
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
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
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
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

                    {/* 添加彩蛋按钮 */}
                    <div className="mt-8 flex justify-center">
                        <button
                            onClick={handleEasterEgg}
                            className="opacity-30 hover:opacity-50 dark:opacity-20 dark:hover:opacity-40 transition-opacity duration-300 focus:outline-none"
                            aria-label="Easter Egg"
                        >
                            <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-neutral-400 dark:border-t-neutral-600" />
                        </button>
                    </div>

                    {/* 彩蛋动画 - Lottie版本 */}
                    <AnimatePresence>
                        {showEasterEgg && typeof window !== 'undefined' && (
                            <motion.div
                                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 dark:bg-black/40"
                                initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                                animate={{ opacity: 1, backdropFilter: "blur(3px)" }}
                                exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                                transition={{ duration: 0.4 }}
                                onClick={() => setShowEasterEgg(false)}
                            >
                                <motion.div
                                    className="relative w-32 h-32"
                                    initial={{ scale: 0.5, y: 20, filter: "blur(8px)" }}
                                    animate={{ scale: 1, y: 0, filter: "blur(0px)" }}
                                    exit={{ scale: 0.8, y: 10, filter: "blur(8px)" }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 300,
                                        damping: 20,
                                        filter: { duration: 0.3 }
                                    }}
                                >
                                    {/* Lottie动画 */}
                                    {LottieComponent && (
                                        <LottieComponent
                                            lottieRef={lottieRef}
                                            animationData={chuchuAnimation}
                                            loop={false}
                                            autoplay={true}
                                            onComplete={handleAnimationComplete}
                                            style={{ width: '100%', height: '100%' }}
                                            rendererSettings={{
                                                preserveAspectRatio: 'xMidYMid slice',
                                                progressiveLoad: true
                                            }}
                                        />
                                    )}
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
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