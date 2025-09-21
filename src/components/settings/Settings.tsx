'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { APP_VERSION, sponsorsList } from '@/lib/core/config'
import DataManager from '../common/data/DataManager'
import hapticsUtils from '@/lib/ui/haptics'
import fontZoomUtils from '@/lib/utils/fontZoomUtils'
import { useTheme } from 'next-themes'
import { LayoutSettings } from '../brewing/Timer/Settings'
import {
  BackupReminderSettings,
  BackupReminderUtils,
  BACKUP_REMINDER_INTERVALS,
  BackupReminderInterval
} from '@/lib/utils/backupReminderUtils'
import S3SyncManager, { SyncResult } from '@/lib/s3/syncManager'

import Image from 'next/image'
import GrinderSettings from './GrinderSettings'
import { motion, AnimatePresence } from 'framer-motion'
// 导入Lottie动画JSON文件
import chuchuAnimation from '../../../public/animations/chuchu-animation.json'

// 按钮组组件
interface ButtonGroupProps<T extends string> {
    value: T
    options: { value: T; label: string }[]
    onChange: (value: T) => void
    className?: string
}

function ButtonGroup<T extends string>({ value, options, onChange, className = '' }: ButtonGroupProps<T>) {
    return (
        <div className={`inline-flex rounded bg-neutral-100/60 p-0.5 dark:bg-neutral-800/60 ${className}`}>
            {options.map((option) => (
                <button
                    key={option.value}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-all  ${
                        value === option.value
                            ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'
                            : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                    }`}
                    onClick={() => onChange(option.value)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    )
}

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
    dateDisplayMode: 'date' | 'flavorPeriod' | 'agingDays' // 日期显示模式：日期/赏味期/养豆天数
    showFlavorInfo: boolean // 是否在备注中显示风味信息
    limitNotesLines: boolean // 是否限制备注显示行数
    notesMaxLines: number // 备注最大显示行数
    showTotalPrice: boolean // 是否显示总价格而不是单价
    customGrinders?: CustomGrinder[] // 添加自定义磨豆机列表
    simpleBeanFormMode: boolean // 咖啡豆表单简单模式
    safeAreaMargins?: {
        top: number // 顶部边距
        bottom: number // 底部边距
    }
    // 自定义赏味期设置
    customFlavorPeriod?: {
        light: { startDay: number; endDay: number } // 浅烘焙
        medium: { startDay: number; endDay: number } // 中烘焙
        dark: { startDay: number; endDay: number } // 深烘焙
    }
    // 备份提醒设置
    backupReminder?: BackupReminderSettings
    // S3同步设置
    s3Sync?: {
        enabled: boolean
        accessKeyId: string
        secretAccessKey: string
        region: string
        bucketName: string
        prefix: string
        endpoint?: string // 自定义端点，用于七牛云等S3兼容服务
        syncMode: 'manual'
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
        showStageDivider: true, // 默认显示阶段分隔线
        compactMode: false // 默认不启用简洁模式
    },
    showFlowRate: false, // 默认不显示流速
    username: '', // 默认用户名为空
    decrementPresets: [15, 16, 18], // 默认的库存扣除量预设值
    showOnlyBeanName: true, // 默认简化咖啡豆名称
    dateDisplayMode: 'date', // 默认显示烘焙日期
    showFlavorInfo: false, // 默认不显示风味信息
    limitNotesLines: true, // 默认限制备注显示行数
    notesMaxLines: 1, // 默认最大显示1行
    showTotalPrice: false, // 默认显示单价
    customGrinders: [], // 默认无自定义磨豆机
    simpleBeanFormMode: false, // 默认使用完整表单模式
    safeAreaMargins: {
        top: 38, // 默认顶部边距 42px
        bottom: 38 // 默认底部边距 42px
    },
    // 默认自定义赏味期设置 - 初始为空，使用预设值
    customFlavorPeriod: {
        light: { startDay: 0, endDay: 0 }, // 0表示使用预设值：养豆7天，赏味期30天
        medium: { startDay: 0, endDay: 0 }, // 0表示使用预设值：养豆10天，赏味期30天
        dark: { startDay: 0, endDay: 0 } // 0表示使用预设值：养豆14天，赏味期60天
    },
    // 备份提醒设置默认为undefined，将在运行时从BackupReminderUtils加载
    backupReminder: undefined,
    // S3同步设置默认值
    s3Sync: {
        enabled: false,
        accessKeyId: '',
        secretAccessKey: '',
        region: 'cn-south-1',
        bucketName: '',
        prefix: 'brew-guide-data/',
        endpoint: '', // 自定义端点
        syncMode: 'manual'
    }
}

interface SettingsProps {
    isOpen: boolean
    onClose: () => void
    settings: SettingsOptions
    setSettings: (settings: SettingsOptions) => void
    onDataChange?: () => void
}

type S3SyncSettings = NonNullable<SettingsOptions['s3Sync']>

const normalizeS3Settings = (incoming?: SettingsOptions['s3Sync'] | null): S3SyncSettings => {
    const defaults = defaultSettings.s3Sync!

    if (!incoming) {
        return { ...defaults }
    }

    const sanitizedRecord = { ...(incoming || {}) } as Record<string, unknown>
    delete sanitizedRecord.autoSync
    delete sanitizedRecord.syncInterval

    const withDefaults: S3SyncSettings = {
        ...defaults,
        ...(sanitizedRecord as Partial<S3SyncSettings>),
        syncMode: 'manual'
    }

    return {
        ...withDefaults,
        endpoint: withDefaults.endpoint || ''
    }
}

const Settings: React.FC<SettingsProps> = ({
    isOpen,
    onClose,
    settings,
    setSettings,
    onDataChange,
}) => {
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
    // 添加数据管理状态
    const [isDataManagerOpen, setIsDataManagerOpen] = useState(false)

    // 添加字体缩放状态追踪
    const [zoomLevel, setZoomLevel] = useState(settings.textZoomLevel || 1.0)

    // 添加检查字体缩放是否可用的状态
    const [isFontZoomEnabled, setIsFontZoomEnabled] = useState(false)

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
    const lottieRef = useRef<unknown>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [LottieComponent, setLottieComponent] = useState<any>(null)

    // 备份提醒相关状态
    const [backupReminderSettings, setBackupReminderSettings] = useState<BackupReminderSettings | null>(null)
    const [nextReminderText, setNextReminderText] = useState('')

    // S3同步相关状态
    const [s3Settings, setS3Settings] = useState<S3SyncSettings>(() => normalizeS3Settings(settings.s3Sync))
    const [s3Status, setS3Status] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
    const [s3Error, setS3Error] = useState<string>('')
    const [showS3SecretKey, setShowS3SecretKey] = useState(false)
    const [s3Expanded, setS3Expanded] = useState(false)
    const [syncManager, setSyncManager] = useState<S3SyncManager | null>(null)
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
    const [isSyncing, setIsSyncing] = useState(false)

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

    // 当settings.s3Sync发生变化时更新s3Settings状态
    useEffect(() => {
        if (settings.s3Sync) {
            const normalized = normalizeS3Settings(settings.s3Sync)
            setS3Settings(normalized)
            console.warn('🔄 S3设置已从localStorage加载:', normalized)
        }
    }, [settings.s3Sync]);

    // 加载备份提醒设置
    useEffect(() => {
        const loadBackupReminderSettings = async () => {
            try {
                const reminderSettings = await BackupReminderUtils.getSettings()
                setBackupReminderSettings(reminderSettings)

                const nextText = await BackupReminderUtils.getNextReminderText()
                setNextReminderText(nextText)
            } catch (error) {
                console.error('加载备份提醒设置失败:', error)
            }
        }

        loadBackupReminderSettings()
    }, []);

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

    // 初始化时检查字体缩放功能是否可用并加载当前缩放级别
    useEffect(() => {
        // 检查字体缩放功能是否可用
        setIsFontZoomEnabled(fontZoomUtils.isAvailable());

        const loadFontZoomLevel = () => {
            if (fontZoomUtils.isAvailable()) {
                const currentZoom = fontZoomUtils.get();
                setZoomLevel(currentZoom);
            }
        };

        if (isOpen) {
            loadFontZoomLevel();
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
    const { Storage } = await import('@/lib/core/storage');
    await Storage.set('brewGuideSettings', JSON.stringify(newSettings))

    // 触发自定义事件通知其他组件设置已更改
    window.dispatchEvent(new CustomEvent('storageChange', {
        detail: { key: 'brewGuideSettings' }
    }))


}

    // 处理备份提醒设置变更
    const handleBackupReminderChange = async (enabled: boolean) => {
        try {
            await BackupReminderUtils.setEnabled(enabled)
            const updatedSettings = await BackupReminderUtils.getSettings()
            setBackupReminderSettings(updatedSettings)

            const nextText = await BackupReminderUtils.getNextReminderText()
            setNextReminderText(nextText)

            // 触发震动反馈
            if (settings.hapticFeedback) {
                hapticsUtils.light();
            }
        } catch (error) {
            console.error('更新备份提醒设置失败:', error)
        }
    }

    // 处理备份提醒间隔变更
    const handleBackupIntervalChange = async (interval: BackupReminderInterval) => {
        try {
            await BackupReminderUtils.updateInterval(interval)
            const updatedSettings = await BackupReminderUtils.getSettings()
            setBackupReminderSettings(updatedSettings)

            const nextText = await BackupReminderUtils.getNextReminderText()
            setNextReminderText(nextText)

            // 触发震动反馈
            if (settings.hapticFeedback) {
                hapticsUtils.light();
            }
        } catch (error) {
            console.error('更新备份提醒间隔失败:', error)
        }
    }

    // 处理S3设置变更
    const handleS3SettingChange = <K extends keyof S3SyncSettings>(
        key: K,
        value: S3SyncSettings[K]
    ) => {
        const newS3Settings = normalizeS3Settings({ ...s3Settings, [key]: value } as S3SyncSettings)
        setS3Settings(newS3Settings)
        handleChange('s3Sync', newS3Settings)
    }

    // 执行同步（仅手动）
    const performSync = useCallback(async () => {
        if (!syncManager) {
            setS3Error('请先测试连接')
            return
        }

        if (isSyncing) {
            setS3Error('同步正在进行中')
            return
        }

        setIsSyncing(true)
        setS3Error('')

        try {
            const result: SyncResult = await syncManager.sync('auto')

            if (result.success) {
                const lastSync = await syncManager.getLastSyncTime()
                setLastSyncTime(lastSync)

                if (settings.hapticFeedback) {
                    hapticsUtils.medium()
                }

                onDataChange?.()
            } else {
                setS3Error(result.message || '同步失败')
            }
        } catch (error) {
            console.error('同步失败:', error)
            setS3Error(`同步失败: ${error instanceof Error ? error.message : '未知错误'}`)
        } finally {
            setIsSyncing(false)
        }
    }, [syncManager, isSyncing, settings.hapticFeedback, onDataChange])

    // 测试S3连接
    const testS3Connection = async () => {
        if (!s3Settings.accessKeyId || !s3Settings.secretAccessKey || !s3Settings.bucketName) {
            setS3Error('请填写完整的S3配置信息')
            setS3Status('error')
            return
        }

        setS3Status('connecting')
        setS3Error('')

        try {
            const manager = new S3SyncManager()
            const connected = await manager.initialize({
                region: s3Settings.region,
                accessKeyId: s3Settings.accessKeyId,
                secretAccessKey: s3Settings.secretAccessKey,
                bucketName: s3Settings.bucketName,
                prefix: s3Settings.prefix,
                endpoint: s3Settings.endpoint || undefined
            })

            if (connected) {
                setS3Status('connected')
                setSyncManager(manager)

                // 获取最后同步时间
                const lastSync = await manager.getLastSyncTime()
                setLastSyncTime(lastSync)

                if (settings.hapticFeedback) {
                    hapticsUtils.light()
                }
            } else {
                setS3Status('error')
                setS3Error('连接失败，请检查S3配置信息')
            }
        } catch (error) {
            setS3Status('error')
            setS3Error(`连接失败: ${error instanceof Error ? error.message : '未知错误'}`)
        }
    }



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
                // Log error in development only
                if (process.env.NODE_ENV === 'development') {
                    console.warn('音频播放失败:', err)
                }
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
                                        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">赞赏码（开发不易，希望能支持一下，求求了 www～）</p>
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
                                        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">交流群（9 月 26 日前有效）</p>
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
                            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
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
                            <ButtonGroup
                                value={theme || 'system'}
                                options={[
                                    { value: 'light', label: '浅色' },
                                    { value: 'dark', label: '深色' },
                                    { value: 'system', label: '系统' }
                                ]}
                                onChange={(value) => {
                                    setTheme(value)
                                    if (settings.hapticFeedback) {
                                        hapticsUtils.light();
                                    }
                                }}
                            />
                        </div>

                        {/* 字体缩放设置 - 统一的字体缩放功能 */}
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
                                type="text"
                                inputMode="decimal"
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

                        {/* 日期显示模式 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                日期显示模式
                            </div>
                            <ButtonGroup
                                value={settings.dateDisplayMode || 'date'}
                                options={[
                                    { value: 'date', label: '日期' },
                                    { value: 'flavorPeriod', label: '赏味期' },
                                    { value: 'agingDays', label: '养豆天数' }
                                ]}
                                onChange={(value) => handleChange('dateDisplayMode', value as 'date' | 'flavorPeriod' | 'agingDays')}
                            />
                        </div>

                        {/* 显示总价格 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                显示总价格
                            </div>
                            <label className="relative inline-flex cursor-pointer items-center">
                                <input
                                    type="checkbox"
                                    checked={settings.showTotalPrice || false}
                                    onChange={(e) => handleChange('showTotalPrice', e.target.checked)}
                                    className="peer sr-only"
                                />
                                <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                            </label>
                        </div>

                        {/* 显示风味信息 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                显示风味信息
                            </div>
                            <label className="relative inline-flex cursor-pointer items-center">
                                <input
                                    type="checkbox"
                                    checked={settings.showFlavorInfo || false}
                                    onChange={(e) => handleChange('showFlavorInfo', e.target.checked)}
                                    className="peer sr-only"
                                />
                                <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                            </label>
                        </div>

                        {/* 限制备注显示行数 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                限制备注显示行数
                            </div>
                            <label className="relative inline-flex cursor-pointer items-center">
                                <input
                                    type="checkbox"
                                    checked={settings.limitNotesLines || false}
                                    onChange={(e) => handleChange('limitNotesLines', e.target.checked)}
                                    className="peer sr-only"
                                />
                                <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                            </label>
                        </div>

                        {/* 备注最大显示行数 - 只有在开启限制时才显示 */}
                        {settings.limitNotesLines && (
                            <div className="ml-4 border-l-2 border-neutral-200 dark:border-neutral-700 pl-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                        最大显示行数
                                    </div>
                                    <div className="text-sm text-neutral-400 dark:text-neutral-500">
                                        {settings.notesMaxLines || 3}行
                                    </div>
                                </div>
                                <div className="px-1">
                                    <input
                                        type="range"
                                        min="1"
                                        max="6"
                                        step="1"
                                        value={settings.notesMaxLines || 3}
                                        onChange={(e) => handleChange('notesMaxLines', parseInt(e.target.value))}
                                        className="w-full h-1.5 bg-neutral-200 rounded-full appearance-none cursor-pointer dark:bg-neutral-700"
                                    />
                                    <div className="flex justify-between mt-1 text-xs text-neutral-500">
                                        <span>1行</span>
                                        <span>6行</span>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* 自定义赏味期设置组 */}
                <div className="px-6 py-4">
                    <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                        自定义赏味期预设
                    </h3>
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
                                        value={settings.customFlavorPeriod?.light?.startDay === 0 ? '' : settings.customFlavorPeriod?.light?.startDay || ''}
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
                                        value={settings.customFlavorPeriod?.light?.endDay === 0 ? '' : settings.customFlavorPeriod?.light?.endDay || ''}
                                        placeholder="30"
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
                                        value={settings.customFlavorPeriod?.medium?.startDay === 0 ? '' : settings.customFlavorPeriod?.medium?.startDay || ''}
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
                                        value={settings.customFlavorPeriod?.medium?.endDay === 0 ? '' : settings.customFlavorPeriod?.medium?.endDay || ''}
                                        placeholder="30"
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
                                        value={settings.customFlavorPeriod?.dark?.startDay === 0 ? '' : settings.customFlavorPeriod?.dark?.startDay || ''}
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
                                        value={settings.customFlavorPeriod?.dark?.endDay === 0 ? '' : settings.customFlavorPeriod?.dark?.endDay || ''}
                                        placeholder="60"
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
                        添加咖啡豆时，会根据烘焙度自动设定赏味期。
                    </h3>
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

                    {/* S3功能说明 */}
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                            <strong>S3 云同步</strong>：将您的冲煮数据、咖啡豆信息等同步到S3兼容的对象存储服务。
                        </p>
                    </div>

                    {/* S3同步设置 */}
                    <div className="space-y-4 mb-6">
                        {/* S3主开关 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                S3 云同步
                            </div>
                            <div className="flex items-center space-x-2">
                                {/* 连接状态指示器 */}
                                <div className={`w-2 h-2 rounded-full ${
                                    s3Status === 'connected' ? 'bg-green-500' :
                                    s3Status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                                    s3Status === 'error' ? 'bg-red-500' :
                                    'bg-neutral-300 dark:bg-neutral-600'
                                }`} />
                                <label className="relative inline-flex cursor-pointer items-center">
                                    <input
                                        type="checkbox"
                                        checked={s3Settings.enabled}
                                        onChange={(e) => handleS3SettingChange('enabled', e.target.checked)}
                                        className="peer sr-only"
                                    />
                                    <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                                </label>
                            </div>
                        </div>

                        {/* S3详细设置 - 仅在启用时显示 */}
                        {s3Settings.enabled && (
                            <div className="ml-4 space-y-4 border-l-2 border-neutral-200 dark:border-neutral-700 pl-4">
                                {/* 展开/收起按钮 */}
                                <button
                                    onClick={() => setS3Expanded(!s3Expanded)}
                                    className="flex items-center justify-between w-full py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100"
                                >
                                    <span>S3配置</span>
                                    <svg
                                        className={`w-4 h-4 transition-transform ${s3Expanded ? 'rotate-180' : ''}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {s3Expanded && (
                                    <div className="space-y-3">
                                        {/* 区域 */}
                                        <div>
                                            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                                                区域 (Region)
                                            </label>
                                            <input
                                                type="text"
                                                value={s3Settings.region}
                                                onChange={(e) => handleS3SettingChange('region', e.target.value)}
                                                placeholder="cn-south-1"
                                                className="w-full py-2 px-3 text-sm bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                            />
                                        </div>

                                        {/* 自定义端点 */}
                                        <div>
                                            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                                                自定义端点 (可选)
                                            </label>
                                            <input
                                                type="url"
                                                value={s3Settings.endpoint || ''}
                                                onChange={(e) => handleS3SettingChange('endpoint', e.target.value)}
                                                placeholder="https://bucket-name.s3.cn-south-1.qiniucs.com (七牛云格式)"
                                                className="w-full py-2 px-3 text-sm bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                            />
                                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                                七牛云格式：https://bucket名称.s3.区域.qiniucs.com，留空使用AWS标准端点
                                            </p>
                                        </div>

                                        {/* Bucket名称 */}
                                        <div>
                                            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                                                Bucket名称
                                            </label>
                                            <input
                                                type="text"
                                                value={s3Settings.bucketName}
                                                onChange={(e) => handleS3SettingChange('bucketName', e.target.value)}
                                                placeholder="my-bucket-name"
                                                className="w-full py-2 px-3 text-sm bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                            />
                                        </div>

                                        {/* Access Key ID */}
                                        <div>
                                            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                                                Access Key ID
                                            </label>
                                            <input
                                                type="text"
                                                value={s3Settings.accessKeyId}
                                                onChange={(e) => handleS3SettingChange('accessKeyId', e.target.value)}
                                                placeholder="AKIA..."
                                                className="w-full py-2 px-3 text-sm bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                            />
                                        </div>

                                        {/* Secret Access Key */}
                                        <div>
                                            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                                                Secret Access Key
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showS3SecretKey ? "text" : "password"}
                                                    value={s3Settings.secretAccessKey}
                                                    onChange={(e) => handleS3SettingChange('secretAccessKey', e.target.value)}
                                                    placeholder="密钥"
                                                    className="w-full py-2 px-3 pr-10 text-sm bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowS3SecretKey(!showS3SecretKey)}
                                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        {showS3SecretKey ? (
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464m1.414 1.414L8.464 8.464m5.656 5.656L15.536 15.536m-1.414-1.414L15.536 15.536" />
                                                        ) : (
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        )}
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>

                                        {/* 前缀 */}
                                        <div>
                                            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                                                文件前缀
                                            </label>
                                            <input
                                                type="text"
                                                value={s3Settings.prefix}
                                                onChange={(e) => handleS3SettingChange('prefix', e.target.value)}
                                                placeholder="brew-guide-data/"
                                                className="w-full py-2 px-3 text-sm bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                            />
                                        </div>

                                        {/* 测试连接按钮 */}
                                        <button
                                            onClick={testS3Connection}
                                            disabled={s3Status === 'connecting'}
                                            className="w-full py-2 px-3 text-sm font-medium text-white bg-neutral-700 hover:bg-neutral-800 disabled:bg-neutral-400 rounded transition-colors"
                                        >
                                            {s3Status === 'connecting' ? '连接中...' : '测试连接'}
                                        </button>

                                        {/* 错误信息 */}
                                        {s3Error && (
                                            <div className="p-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded">
                                                {s3Error}
                                            </div>
                                        )}

                                        {/* 同步模式说明 */}
                                        {s3Status === 'connected' && (
                                            <div className="space-y-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                                                        同步模式
                                                    </div>
                                                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                                        完全手动
                                                    </span>
                                                </div>

                                                <div className="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-100/60 dark:bg-neutral-800/60 p-2 rounded leading-relaxed">
                                                    不会自动同步，请在需要时手动点击下方按钮触发同步。
                                                </div>

                                                <button
                                                    onClick={performSync}
                                                    disabled={isSyncing}
                                                    className="w-full py-2 px-3 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                                                >
                                                    {isSyncing ? '同步中...' : '立即同步'}
                                                </button>

                                                {lastSyncTime && (
                                                    <div className="text-xs text-neutral-400 dark:text-neutral-500">
                                                        最后同步：{lastSyncTime.toLocaleString('zh-CN', {
                                                            month: 'numeric',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 简化的状态说明 */}
                                {!s3Expanded && (
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                        {s3Status === 'connected'
                                            ? '已连接 - 需手动触发同步'
                                            : s3Status === 'error'
                                                ? '连接失败 - 点击配置查看详情'
                                                : '未配置 - 点击配置设置S3信息'}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 备份提醒设置 */}
                    {backupReminderSettings && (
                        <>
                            {/* 备份提醒开关 */}
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                    备份提醒
                                </div>
                                <label className="relative inline-flex cursor-pointer items-center">
                                    <input
                                        type="checkbox"
                                        checked={backupReminderSettings.enabled}
                                        onChange={(e) => handleBackupReminderChange(e.target.checked)}
                                        className="peer sr-only"
                                    />
                                    <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                                </label>
                            </div>

                            {/* 提醒间隔设置 */}
                            {backupReminderSettings.enabled && (
                                <div className="mt-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                            提醒频率
                                        </div>
                                        {nextReminderText && (
                                            <div className="text-xs text-neutral-400 dark:text-neutral-500">
                                                下次：{nextReminderText}
                                            </div>
                                        )}
                                    </div>
                                    <ButtonGroup
                                        value={backupReminderSettings.interval.toString()}
                                        options={[
                                            { value: BACKUP_REMINDER_INTERVALS.WEEKLY.toString(), label: '每周' },
                                            { value: BACKUP_REMINDER_INTERVALS.BIWEEKLY.toString(), label: '每两周' },
                                            { value: BACKUP_REMINDER_INTERVALS.MONTHLY.toString(), label: '每月' }
                                        ]}
                                        onChange={(value) => handleBackupIntervalChange(parseInt(value) as BackupReminderInterval)}
                                        className="w-full"
                                    />
                                </div>
                            )}
                        </>
                    )}

                    {/* 数据管理按钮 */}
                    <div className={backupReminderSettings ? "mt-6" : ""}>
                        <button
                            onClick={() => setIsDataManagerOpen(true)}
                            className="w-full py-3 text-sm font-medium text-neutral-800 bg-neutral-100 rounded-lg transition-colors hover:bg-neutral-200 dark:text-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                        >
                            数据管理
                        </button>
                    </div>
                </div>

                {/* 意见反馈组 */}
                <div className="px-6 py-4">
                    <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                        意见反馈
                    </h3>
                    <button
                        onClick={() => {
                            window.open('https://wj.qq.com/s2/19403076/7f02/', '_blank');
                            if (settings.hapticFeedback) {
                                hapticsUtils.light();
                            }
                        }}
                        className="w-full py-3 text-sm font-medium text-neutral-800 bg-neutral-100 rounded-lg transition-colors hover:bg-neutral-200 dark:text-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                    >
                        提交反馈
                    </button>
                </div>


                {/* 版本信息 */}
                <div className="px-6 pt-12 text-xs text-center text-neutral-400 dark:text-neutral-600">
                    <p>[版本号]</p>
                    <p>v{APP_VERSION}</p>

                    <p className='mt-12'>[感谢]</p>

                    <p>感谢以下赞助者的支持</p>
                    <p className="mt-4 mx-auto max-w-48 text-left leading-relaxed">
                        {sponsorsList
                            .sort((a, b) => {
                                const isAEnglish = /^[A-Za-z0-9\s:]+$/.test(a.charAt(0));
                                const isBEnglish = /^[A-Za-z0-9\s:]+$/.test(b.charAt(0));

                                if (isAEnglish && !isBEnglish) return -1;
                                if (!isAEnglish && isBEnglish) return 1;
                                return a.localeCompare(b, 'zh-CN');
                            })
                            .join('、')}
                        、and You
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
