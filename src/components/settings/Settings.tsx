'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { APP_VERSION, sponsorsList } from '@/lib/core/config'
import DataManager from '../common/data/DataManager'
import hapticsUtils from '@/lib/ui/haptics'

import { useTheme } from 'next-themes'
import { LayoutSettings } from '../brewing/Timer/Settings'
import {
  BackupReminderSettings,
  BackupReminderUtils,
  BACKUP_REMINDER_INTERVALS,
  BackupReminderInterval
} from '@/lib/utils/backupReminderUtils'
import S3SyncManager, { SyncResult, SyncMetadata } from '@/lib/s3/syncManager'
import { ChevronLeft, ChevronRight, RefreshCw, Loader, Monitor, SlidersHorizontal, Archive, List, CalendarDays, Timer, Database } from 'lucide-react'

import Image from 'next/image'
import GrinderSettings from './GrinderSettings'
import StockSettings from './StockSettings' // 导入新的组件
import BeanSettings from './BeanSettings' // 导入新的组件
import FlavorPeriodSettings from './FlavorPeriodSettings'
import TimerSettings from './TimerSettings'
import { motion, AnimatePresence } from 'framer-motion'
// 导入Lottie动画JSON文件
import chuchuAnimation from '../../../public/animations/chuchu-animation.json'

// 导入ButtonGroup组件
import { ButtonGroup } from '../ui/ButtonGroup'
import DisplaySettings from './DisplaySettings'
import DataSettings from './DataSettings'
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
        lastConnectionSuccess?: boolean
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
    // 添加数据管理状态
    const [isDataManagerOpen, setIsDataManagerOpen] = useState(false)

    // 获取主题相关方法
    const { theme } = useTheme()

    // 添加显示设置状态
    const [showDisplaySettings, setShowDisplaySettings] = useState(false)

    // 添加研磨度设置状态
    const [showGrinderSettings, setShowGrinderSettings] = useState(false)

    // 添加库存扣除预设值设置状态
    const [showStockSettings, setShowStockSettings] = useState(false)

    // 添加豆仓列表显示设置状态
    const [showBeanSettings, setShowBeanSettings] = useState(false)

    // 添加赏味期设置状态
    const [showFlavorPeriodSettings, setShowFlavorPeriodSettings] = useState(false)

    // 添加计时器布局设置状态
    const [showTimerSettings, setShowTimerSettings] = useState(false)

    // 添加数据管理设置状态
    const [showDataSettings, setShowDataSettings] = useState(false)

    // 添加二维码显示状态
    const [showQRCodes, setShowQRCodes] = useState(false)
    // 添加显示哪种二维码的状态
    const [qrCodeType, setQrCodeType] = useState<'appreciation' | 'group' | null>(null)



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
    const [showConflictModal, setShowConflictModal] = useState(false)
    const [conflictRemoteMetadata, setConflictRemoteMetadata] = useState<SyncMetadata | null>(null)
    const [isSyncNeeded, setIsSyncNeeded] = useState(false)

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



    // 当settings.s3Sync发生变化时更新s3Settings状态，并根据上次成功状态自动尝试连接
    useEffect(() => {
        if (settings.s3Sync) {
            const normalized = normalizeS3Settings(settings.s3Sync)
            setS3Settings(normalized)
            console.warn('🔄 S3设置已从localStorage加载:', normalized)

            // 如果上次连接成功，则自动尝试连接
            if (
                normalized.enabled &&
                normalized.lastConnectionSuccess &&
                normalized.accessKeyId &&
                normalized.secretAccessKey &&
                normalized.bucketName
            ) {
                // 使用一个函数来避免在useEffect中直接使用async函数
                const autoConnect = async () => {
                    const manager = new S3SyncManager()
                    const connected = await manager.initialize({
                        region: normalized.region,
                        accessKeyId: normalized.accessKeyId,
                        secretAccessKey: normalized.secretAccessKey,
                        bucketName: normalized.bucketName,
                        prefix: normalized.prefix,
                        endpoint: normalized.endpoint || undefined
                    })

                    if (connected) {
                        setS3Status('connected')
                        setSyncManager(manager)
                        const lastSync = await manager.getLastSyncTime()
                        setLastSyncTime(lastSync)
                        setS3Expanded(false) // 连接成功后默认不展开
                        // 检查是否需要同步
                        const needsSync = await manager.needsSync()
                        setIsSyncNeeded(needsSync)
                    } else {
                        setS3Status('error')
                        setS3Error('自动连接失败，请检查配置')
                    }
                }
                autoConnect()
            }
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
        const newS3Settings = normalizeS3Settings({ ...s3Settings, [key]: value, lastConnectionSuccess: false } as S3SyncSettings)
        setS3Settings(newS3Settings)
        handleChange('s3Sync', newS3Settings)
    }

    // 执行同步（仅手动）
    const performSync = useCallback(async (direction: 'auto' | 'upload' | 'download' = 'auto') => {
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
            const result: SyncResult = await syncManager.sync(direction)

            if (result.conflict) {
                setConflictRemoteMetadata(result.remoteMetadata || null)
                setShowConflictModal(true)
                setS3Error('数据冲突：本地和云端数据都已更改。')
                return // 等待用户选择
            }

            if (result.success) {
                const lastSync = await syncManager.getLastSyncTime()
                setLastSyncTime(lastSync)
                setIsSyncNeeded(false) // 同步成功后，重置状态

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

    const handleConflictResolution = async (direction: 'upload' | 'download') => {
        setShowConflictModal(false)
        await performSync(direction)
    }

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
                setS3Expanded(true) // 连接成功后自动展开

                // 保存连接成功的状态
                const newS3Settings = { ...s3Settings, lastConnectionSuccess: true }
                handleChange('s3Sync', newS3Settings)

                // 获取最后同步时间
                const lastSync = await manager.getLastSyncTime()
                setLastSyncTime(lastSync)

                // 检查是否需要同步
                const needsSync = await manager.needsSync()
                setIsSyncNeeded(needsSync)

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
                className="relative flex items-center justify-center py-4 pt-safe-top"
            >
                <button
                    onClick={onClose}
                    className="absolute left-4 flex items-center justify-center w-10 h-10 rounded-full text-neutral-700 bg-neutral-100 dark:text-neutral-300 dark:bg-neutral-800 transition-colors"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-md font-medium text-neutral-800 dark:text-neutral-200">设置</h2>
                {/* 同步按钮 */}
                {s3Status === 'connected' && (
                    <button
                        onClick={() => performSync('auto')}
                        disabled={isSyncing}
                        className="absolute right-4 flex items-center justify-center w-10 h-10 rounded-full text-neutral-700 bg-neutral-100 dark:text-neutral-300 dark:bg-neutral-800 transition-colors"
                    >
                        {isSyncing ? (
                            <Loader className="animate-spin h-5 w-5" />
                        ) : (
                            <RefreshCw className="h-5 w-5" />
                        )}
                        {isSyncNeeded && !isSyncing && (
                            <span className="absolute top-1.5 right-1.5 block w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-neutral-100 dark:border-neutral-800"></span>
                        )}
                    </button>
                )}
            </div>

            {/* 滚动内容区域 - 新的简洁设计 */}
            <div className="relative flex-1 overflow-y-auto pb-safe-bottom divide-y divide-neutral-200 dark:divide-neutral-800">
                {/* 顶部渐变阴影（随滚动粘附）*/}
                <div className="sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none first:border-b-0"></div>
                {/* 赞助支持 */}
                <div className="px-6 py-4 -mt-8">
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
                            className="flex items-center justify-between py-3 px-4 text-sm font-medium text-neutral-800 bg-neutral-100 rounded transition-colors hover:bg-neutral-200 dark:text-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
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
                            className="flex items-center justify-between py-3 px-4 text-sm font-medium text-neutral-800 bg-neutral-100 rounded transition-colors hover:bg-neutral-200 dark:text-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
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
                                        <div className="w-full aspect-square relative rounded overflow-hidden">
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
                                        <div className="w-full aspect-square relative rounded overflow-hidden invisible">
                                            <div className="w-full h-full" />
                                        </div>
                                        <p className="mt-2 text-xs invisible">占位</p>
                                    </div>
                                </>
                            ) : qrCodeType === 'group' ? (
                                <>
                                    <div className="flex flex-col items-center opacity-0">
                                        <div className="w-full aspect-square relative rounded overflow-hidden invisible">
                                            <div className="w-full h-full" />
                                        </div>
                                        <p className="mt-2 text-xs invisible">占位</p>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <div className="w-full aspect-square relative rounded overflow-hidden">
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
                                className="w-full py-2 px-3 text-sm font-medium rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 appearance-none focus:outline-hidden focus:ring-2 focus:ring-neutral-500"
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

                {/* 按钮组 */}
                <div className="px-6 py-4 space-y-4">
                    <button
                        onClick={() => setShowDisplaySettings(true)}
                        className="w-full py-3 px-4 text-sm font-medium text-neutral-800 bg-neutral-100 rounded transition-colors hover:bg-neutral-200 dark:text-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-between"
                    >
                        <div className="flex items-center space-x-3">
                            <Monitor className="h-4 w-4 text-neutral-500" />
                            <span>显示设置</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-neutral-400" />
                    </button>
                    <button
                        onClick={() => setShowBeanSettings(true)}
                        className="w-full py-3 px-4 text-sm font-medium text-neutral-800 bg-neutral-100 rounded transition-colors hover:bg-neutral-200 dark:text-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-between"
                    >
                        <div className="flex items-center space-x-3">
                            <List className="h-4 w-4 text-neutral-500" />
                            <span>豆仓列表显示设置</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-neutral-400" />
                    </button>
                    <button
                        onClick={() => setShowGrinderSettings(true)}
                        className="w-full py-3 px-4 text-sm font-medium text-neutral-800 bg-neutral-100 rounded transition-colors hover:bg-neutral-200 dark:text-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-between"
                    >
                        <div className="flex items-center space-x-3">
                            <SlidersHorizontal className="h-4 w-4 text-neutral-500" />
                            <span>研磨度设置</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-neutral-400" />
                    </button>
                    <button
                        onClick={() => setShowStockSettings(true)}
                        className="w-full py-3 px-4 text-sm font-medium text-neutral-800 bg-neutral-100 rounded transition-colors hover:bg-neutral-200 dark:text-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-between"
                    >
                        <div className="flex items-center space-x-3">
                            <Archive className="h-4 w-4 text-neutral-500" />
                            <span>库存扣除预设值</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-neutral-400" />
                    </button>
                    <button
                        onClick={() => setShowFlavorPeriodSettings(true)}
                        className="w-full py-3 px-4 text-sm font-medium text-neutral-800 bg-neutral-100 rounded transition-colors hover:bg-neutral-200 dark:text-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-between"
                    >
                        <div className="flex items-center space-x-3">
                            <CalendarDays className="h-4 w-4 text-neutral-500" />
                            <span>赏味期预设值</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-neutral-400" />
                    </button>
                    <button
                        onClick={() => setShowTimerSettings(true)}
                        className="w-full py-3 px-4 text-sm font-medium text-neutral-800 bg-neutral-100 rounded transition-colors hover:bg-neutral-200 dark:text-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-between"
                    >
                        <div className="flex items-center space-x-3">
                            <Timer className="h-4 w-4 text-neutral-500" />
                            <span>计时器布局</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-neutral-400" />
                    </button>
                </div>

                    







                {/* 数据管理入口按钮 */}
                <div className="px-6 py-4">
                    <button
                        onClick={() => setShowDataSettings(true)}
                        className="w-full py-3 px-4 text-sm font-medium text-neutral-800 bg-neutral-100 rounded transition-colors hover:bg-neutral-200 dark:text-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-between"
                    >
                        <div className="flex items-center space-x-3">
                            <Database className="h-4 w-4 text-neutral-500" />
                            <span>数据管理</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-neutral-400" />
                    </button>
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
                        className="w-full py-3 text-sm font-medium text-neutral-800 bg-neutral-100 rounded transition-colors hover:bg-neutral-200 dark:text-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
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

            {/* 显示设置组件 */}
            <AnimatePresence>
                {showDisplaySettings && (
                    <DisplaySettings
                        settings={settings}
                        onClose={() => setShowDisplaySettings(false)}
                        handleChange={handleChange}
                    />
                )}
            </AnimatePresence>

            {/* 研磨度设置组件 */}
            <AnimatePresence>
                {showGrinderSettings && (
                    <GrinderSettings
                        settings={settings}
                        onClose={() => setShowGrinderSettings(false)}
                        handleChange={handleChange}
                    />
                )}
            </AnimatePresence>

            {/* 库存扣除预设值设置组件 */}
            <AnimatePresence>
                {showStockSettings && (
                    <StockSettings
                        settings={settings}
                        onClose={() => setShowStockSettings(false)}
                        handleChange={handleChange}
                    />
                )}
            </AnimatePresence>

            {/* 豆仓列表显示设置组件 */}
            <AnimatePresence>
                {showBeanSettings && (
                    <BeanSettings
                        settings={settings}
                        onClose={() => setShowBeanSettings(false)}
                        handleChange={handleChange}
                    />
                )}
            </AnimatePresence>

            {/* 赏味期设置组件 */}
            <AnimatePresence>
                {showFlavorPeriodSettings && (
                    <FlavorPeriodSettings
                        settings={settings}
                        onClose={() => setShowFlavorPeriodSettings(false)}
                        handleChange={handleChange}
                    />
                )}
            </AnimatePresence>

            {/* 计时器布局设置组件 */}
            <AnimatePresence>
                {showTimerSettings && (
                    <TimerSettings
                        settings={settings}
                        onClose={() => setShowTimerSettings(false)}
                        handleChange={handleChange}
                    />
                )}
            </AnimatePresence>

            {/* 数据管理设置组件 */}
            <AnimatePresence>
                {showDataSettings && (
                    <DataSettings
                        settings={settings}
                        onClose={() => setShowDataSettings(false)}
                        handleChange={handleChange}
                        onDataChange={onDataChange}
                    />
                )}
            </AnimatePresence>

        </div>
    )
}

export default Settings
