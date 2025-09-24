'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { ChevronLeft} from 'lucide-react'
import { DataManager as DataManagerUtil } from '@/lib/core/dataManager'
import { compressBase64Image } from '@/lib/utils/imageCapture'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { SettingsOptions } from './Settings'
import { ButtonGroup } from '../ui/ButtonGroup'
import { motion, AnimatePresence } from 'framer-motion'
import S3SyncManager, { SyncResult, SyncMetadata } from '@/lib/s3/syncManager'
import {
  BackupReminderSettings,
  BackupReminderUtils,
  BACKUP_REMINDER_INTERVALS,
  BackupReminderInterval
} from '@/lib/utils/backupReminderUtils'
import hapticsUtils from '@/lib/ui/haptics'

type S3SyncSettings = NonNullable<SettingsOptions['s3Sync']>

const normalizeS3Settings = (incoming?: SettingsOptions['s3Sync'] | null): S3SyncSettings => {
    const defaults = {
        enabled: false,
        accessKeyId: '',
        secretAccessKey: '',
        region: 'cn-south-1',
        bucketName: '',
        prefix: 'brew-guide-data/',
        endpoint: '',
        syncMode: 'manual' as const
    }

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

interface DataSettingsProps {
    settings: SettingsOptions
    onClose: () => void
    handleChange: <K extends keyof SettingsOptions>(key: K, value: SettingsOptions[K]) => void | Promise<void>
    onDataChange?: () => void
}

const DataSettings: React.FC<DataSettingsProps> = ({
    settings,
    onClose,
    handleChange,
    onDataChange
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info' | null; message: string }>({
        type: null,
        message: ''
    })
    const [showConfirmReset, setShowConfirmReset] = useState(false)
    const [isCompressing, setIsCompressing] = useState(false)
    const [compressionProgress, setCompressionProgress] = useState({ current: 0, total: 0 })
    const isNative = Capacitor.isNativePlatform()

    // 压缩图片功能
    const getBase64ImageSize = (base64: string): number => {
        if (!base64 || !base64.includes(',')) return 0
        const base64Data = base64.split(',')[1]
        return Math.floor(base64Data.length * 0.75) // base64 to bytes conversion
    }

    // 压缩咖啡豆图片
    const handleCompressImages = async () => {
        try {
            setIsCompressing(true)
            setStatus({ type: 'info', message: '正在检测需要压缩的图片...' })

            // 动态导入Storage
            const { Storage } = await import('@/lib/core/storage')

            // 获取所有咖啡豆数据
            const coffeeBeansData = await Storage.get('coffeeBeans')
            if (!coffeeBeansData) {
                setStatus({ type: 'info', message: '没有找到咖啡豆数据' })
                return
            }

            const coffeeBeans = JSON.parse(coffeeBeansData)
            if (!Array.isArray(coffeeBeans)) {
                setStatus({ type: 'error', message: '咖啡豆数据格式错误' })
                return
            }

            // 找出需要压缩的图片（大于200KB）
            const beansNeedCompression = coffeeBeans.filter((bean: { id: string; name: string; image?: string }) => {
                if (!bean.image) return false
                const imageSize = getBase64ImageSize(bean.image)
                return imageSize > 200 * 1024 // 200KB
            })

            if (beansNeedCompression.length === 0) {
                setStatus({ type: 'success', message: '所有图片都已经是压缩状态，无需处理' })
                return
            }

            setCompressionProgress({ current: 0, total: beansNeedCompression.length })
            setStatus({ type: 'info', message: `发现 ${beansNeedCompression.length} 张图片需要压缩，正在处理...` })

            // 逐个压缩图片
            for (let i = 0; i < beansNeedCompression.length; i++) {
                const bean = beansNeedCompression[i]
                setCompressionProgress({ current: i + 1, total: beansNeedCompression.length })
                setStatus({ type: 'info', message: `正在压缩第 ${i + 1}/${beansNeedCompression.length} 张图片: ${bean.name}` })

                try {
                    // 压缩图片
                    const compressedImage = await compressBase64Image(bean.image!)

                    // 更新咖啡豆数组中的图片
                    const beanIndex = coffeeBeans.findIndex((b: { id: string }) => b.id === bean.id)
                    if (beanIndex !== -1) {
                        coffeeBeans[beanIndex].image = compressedImage
                    }

                    // 短暂延迟，避免UI阻塞
                    await new Promise(resolve => setTimeout(resolve, 100))
                } catch (error) {
                    console.error(`压缩图片失败: ${bean.name}`, error)
                    // 继续处理下一张图片
                }
            }

            // 保存更新后的咖啡豆数据
            await Storage.set('coffeeBeans', JSON.stringify(coffeeBeans))

            setStatus({ type: 'success', message: `图片压缩完成！已处理 ${beansNeedCompression.length} 张图片` })

            // 通知父组件数据已更改
            if (onDataChange) {
                onDataChange()
            }
        } catch (error) {
            console.error('图片压缩失败:', error)
            setStatus({ type: 'error', message: `图片压缩失败: ${(error as Error).message}` })
        } finally {
            setIsCompressing(false)
            setCompressionProgress({ current: 0, total: 0 })
        }
    }

    // 数据导出功能
    const handleExport = async () => {
        try {
            const getLocalDateString = (date: Date) => {
                const year = date.getFullYear();
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const day = date.getDate().toString().padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            const jsonData = await DataManagerUtil.exportAllData()
            const fileName = `brew-guide-data-${getLocalDateString(new Date())}.json`

            if (isNative) {
                try {
                    // 先将文件写入临时目录
                    await Filesystem.writeFile({
                        path: fileName,
                        data: jsonData,
                        directory: Directory.Cache,
                        encoding: Encoding.UTF8
                    })

                    // 获取临时文件的URI
                    const uriResult = await Filesystem.getUri({
                        path: fileName,
                        directory: Directory.Cache
                    })

                    // 使用分享功能让用户选择保存位置
                    await Share.share({
                        title: '导出数据',
                        text: '请选择保存位置',
                        url: uriResult.uri,
                        dialogTitle: '导出数据'
                    })

                    // 清理临时文件
                    await Filesystem.deleteFile({
                        path: fileName,
                        directory: Directory.Cache
                    })

                    setStatus({
                        type: 'success',
                        message: '数据已成功导出'
                    })

                    // 标记备份完成
                    try {
                        await BackupReminderUtils.markBackupCompleted()
                    } catch (error) {
                        console.error('标记备份完成失败:', error)
                    }
                } catch (error) {
                    throw new Error(`保存文件失败: ${(error as Error).message}`)
                }
            } else {
                // Web平台的处理保持不变
                const blob = new Blob([jsonData], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = fileName
                document.body.appendChild(a)
                a.click()

                // 清理
                setTimeout(() => {
                    document.body.removeChild(a)
                    URL.revokeObjectURL(url)
                }, 100)

                setStatus({ type: 'success', message: '数据导出成功，文件已下载' })

                // 标记备份完成
                try {
                    await BackupReminderUtils.markBackupCompleted()
                } catch (error) {
                    console.error('标记备份完成失败:', error)
                }
            }
        } catch (_error) {
            setStatus({ type: 'error', message: `导出失败: ${(_error as Error).message}` })
        }
    }

    // 数据导入功能
    const handleImportClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click()
        }
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            const reader = new FileReader()
            reader.onload = async (event) => {
                try {
                    const jsonString = event.target?.result as string
                    const result = await DataManagerUtil.importAllData(jsonString)

                    if (result.success) {
                        setStatus({ type: 'success', message: result.message })
                        if (onDataChange) {
                            onDataChange()
                        }
                        
                        // 触发笔记全局缓存的重新初始化
                        try {
                            // 触发全局缓存重置事件
                            window.dispatchEvent(new CustomEvent('globalCacheReset'));
                            
                            // 异步重新初始化全局缓存，不阻塞UI
                            import('@/components/notes/List/globalCache')
                                .then(({ initializeGlobalCache }) => initializeGlobalCache())
                                .catch(err => console.error('重新初始化笔记缓存失败:', err));
                        } catch (cacheError) {
                            console.error('重置笔记缓存事件失败:', cacheError);
                        }
                    } else {
                        setStatus({ type: 'error', message: result.message })
                    }
                } catch (_error) {
                    setStatus({ type: 'error', message: `导入失败: ${(_error as Error).message}` })
                } finally {
                    // 重置文件输入，以便可以重新选择同一个文件
                    if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                    }
                }
            }

            reader.onerror = () => {
                setStatus({ type: 'error', message: '读取文件失败' })
            }

            reader.readAsText(file)
        } catch (_error) {
            setStatus({ type: 'error', message: `导入失败: ${(_error as Error).message}` })
        }
    }

    // 重置数据功能
    const handleReset = async () => {
        try {
            const result = await DataManagerUtil.resetAllData(true)

            if (result.success) {
                setStatus({ type: 'success', message: result.message })
                if (onDataChange) {
                    onDataChange()
                }
                
                // 重置时只需触发事件，页面刷新会重新初始化
                window.dispatchEvent(new CustomEvent('globalCacheReset'));

                // 设置一个短暂延迟后刷新页面
                setTimeout(() => {
                    window.location.reload()
                }, 1000) // 延迟1秒，让用户能看到成功消息
            } else {
                setStatus({ type: 'error', message: result.message })
            }
        } catch (_error) {
            setStatus({ type: 'error', message: `重置失败: ${(_error as Error).message}` })
        } finally {
            setShowConfirmReset(false)
        }
    }

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
    }, [])

    // 当settings.s3Sync发生变化时更新s3Settings状态
    useEffect(() => {
        if (settings.s3Sync) {
            const normalized = normalizeS3Settings(settings.s3Sync)
            setS3Settings(normalized)

            if (
                normalized.enabled &&
                normalized.lastConnectionSuccess &&
                normalized.accessKeyId &&
                normalized.secretAccessKey &&
                normalized.bucketName
            ) {
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
                        setS3Expanded(false)
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
    }, [settings.s3Sync])

    // 处理备份提醒设置变更
    const handleBackupReminderChange = async (enabled: boolean) => {
        try {
            await BackupReminderUtils.setEnabled(enabled)
            const updatedSettings = await BackupReminderUtils.getSettings()
            setBackupReminderSettings(updatedSettings)

            const nextText = await BackupReminderUtils.getNextReminderText()
            setNextReminderText(nextText)

            if (settings.hapticFeedback) {
                hapticsUtils.light()
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

            if (settings.hapticFeedback) {
                hapticsUtils.light()
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

    // 执行同步
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
                return
            }

            if (result.success) {
                const lastSync = await syncManager.getLastSyncTime()
                setLastSyncTime(lastSync)
                setIsSyncNeeded(false)

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
                setS3Expanded(true)

                const newS3Settings = { ...s3Settings, lastConnectionSuccess: true }
                handleChange('s3Sync', newS3Settings)

                const lastSync = await manager.getLastSyncTime()
                setLastSyncTime(lastSync)

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

    return (
        <motion.div
            className="fixed inset-0 z-50 flex flex-col bg-neutral-50 dark:bg-neutral-900 max-w-[500px] mx-auto"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{
                duration: 0.35,
                ease: [0.36, 0.66, 0.04, 1]
            }}
        >
            {/* 头部导航栏 */}
            <div className="relative flex items-center justify-center py-4 pt-safe-top">
                <button
                    onClick={onClose}
                    className="absolute left-4 flex items-center justify-center w-10 h-10 rounded-full text-neutral-700 dark:text-neutral-300"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-md font-medium text-neutral-800 dark:text-neutral-200">
                    数据管理
                </h2>
            </div>

            {/* 滚动内容区域 */}
            <div className="relative flex-1 overflow-y-auto pb-safe-bottom divide-y divide-neutral-200 dark:divide-neutral-800">
                {/* 顶部渐变阴影 */}
                <div className="sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none first:border-b-0"></div>

                {/* 云同步设置组 */}
                <div className="px-6 py-4 -mt-8">
                    <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                        云同步
                    </h3>

                    <div className="space-y-5">
                        {/* S3主开关 */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                    S3 云同步
                                </div>
                                {/* 连接状态指示器 */}
                                <div className={`w-2 h-2 rounded-full ${
                                    s3Status === 'connected' ? 'bg-green-500' :
                                    s3Status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                                    s3Status === 'error' ? 'bg-red-500' :
                                    'bg-neutral-300 dark:bg-neutral-600'
                                }`} />
                            </div>
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

                        {/* S3详细设置 - 仅在启用时显示 */}
                        {s3Settings.enabled && (
                            <div className="ml-0 space-y-4">
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
                                                className="w-full py-2 px-3 text-sm bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-500"
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
                                                placeholder="https://bucket-name.s3.cn-south-1.qiniucs.com"
                                                className="w-full py-2 px-3 text-sm bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-500"
                                            />
                                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                                七牛云等兼容S3服务的端点，留空使用AWS标准端点
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
                                                className="w-full py-2 px-3 text-sm bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-500"
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
                                                className="w-full py-2 px-3 text-sm bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-500"
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
                                                    className="w-full py-2 px-3 pr-10 text-sm bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-500"
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
                                                className="w-full py-2 px-3 text-sm bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-500"
                                            />
                                        </div>

                                        {/* 测试连接按钮 */}
                                        <button
                                            onClick={testS3Connection}
                                            disabled={s3Status === 'connecting'}
                                            className="w-full py-2 px-3 text-sm font-medium text-white bg-neutral-700 hover:bg-neutral-800 disabled:bg-neutral-400 rounded-md transition-colors"
                                        >
                                            {s3Status === 'connecting' ? '连接中...' : '测试连接'}
                                        </button>

                                        {/* 错误信息 */}
                                        {s3Error && (
                                            <div className="p-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md">
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
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 状态简要说明 */}
                                {!s3Expanded && (
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                        {s3Status === 'connected'
                                            ? '已连接，手动同步模式'
                                            : s3Status === 'error'
                                                ? '连接失败，请检查配置'
                                                : '未配置，点击展开设置'}
                                    </p>
                                )}

                                {/* 同步按钮 */}
                                {s3Status === 'connected' && (
                                    <div className="mt-4 space-y-3">
                                        <button
                                            onClick={() => performSync('auto')}
                                            disabled={isSyncing}
                                            className="w-full py-2 px-3 text-sm font-medium text-white bg-neutral-700 hover:bg-neutral-800 disabled:bg-neutral-400 rounded-md transition-colors"
                                        >
                                            {isSyncing ? '同步中...' : isSyncNeeded ? '需要同步' : '立即同步'}
                                        </button>
                                        <div className="text-xs text-neutral-400 dark:text-neutral-500">
                                            {isSyncNeeded && <div className="text-orange-500 dark:text-orange-400">检测到数据变更，建议同步</div>}
                                            {lastSyncTime && (
                                                <div>
                                                    最后同步：{lastSyncTime.toLocaleString('zh-CN', {
                                                        month: 'numeric',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 备份提醒设置组 */}
                {backupReminderSettings && (
                    <div className="px-6 py-4">
                        <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                            数据备份提醒
                        </h3>

                        <div className="space-y-5">
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
                                <div>
                                    <div className="flex items-center justify-between mb-3">
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
                        </div>
                    </div>
                )}

                {/* 数据管理设置组 */}
                <div className="px-6 py-4">
                    <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                        数据管理
                    </h3>

                    {status.type && (
                        <div className={`mb-4 rounded-md p-3 text-sm ${
                            status.type === 'success'
                                ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                : status.type === 'error'
                                    ? 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                    : 'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                        }`}>
                            {status.message}
                        </div>
                    )}

                    <div className="space-y-5">
                        {/* 导出按钮 */}
                        <div>
                            <button
                                onClick={handleExport}
                                className="w-full rounded-md text-sm py-2 px-4 font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                            >
                                导出数据
                            </button>
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                {isNative ? '将数据导出到文档目录' : '将数据下载为 JSON 文件'}
                            </p>
                        </div>

                        {/* 导入按钮 */}
                        <div>
                            <button
                                onClick={handleImportClick}
                                className="w-full rounded-md text-sm py-2 px-4 font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                            >
                                导入数据（替换）
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                导入数据将替换所有现有数据
                            </p>
                        </div>

                        {/* 重置按钮 */}
                        <div>
                            {!showConfirmReset ? (
                                <button
                                    onClick={() => setShowConfirmReset(true)}
                                    className="w-full rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-800 transition-colors hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                                >
                                    重置数据
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20">
                                        <div className="flex items-center space-x-2 mb-3">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-5 w-5 text-red-600 dark:text-red-400"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                                                确认重置数据
                                            </h3>
                                        </div>
                                        <p className="text-xs text-red-600 dark:text-red-400 mb-3">
                                            此操作无法撤销，数据将被删除。建议在重置前先导出备份。
                                        </p>
                                        <p className="text-xs text-red-600 dark:text-red-400 mb-4">
                                            将彻底重置数据，包括自定义器具、应用设置和导航状态。
                                        </p>
                                        <div className="flex space-x-2 justify-end">
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmReset(false)}
                                                className="px-3 py-1.5 text-xs rounded-md bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-600"
                                            >
                                                取消
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleReset}
                                                className="px-3 py-1.5 text-xs rounded-md bg-red-600 text-neutral-100 transition-colors hover:bg-red-700"
                                            >
                                                确认重置
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                                完全删除数据并恢复到初始状态，包括设置和缓存
                            </p>
                        </div>
                    </div>
                </div>

                {/* 工具设置组 */}
                <div className="px-6 py-4">
                    <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                        工具
                    </h3>

                    <div className="space-y-5">
                        {/* 图片压缩功能 */}
                        <div>
                            <button
                                onClick={handleCompressImages}
                                disabled={isCompressing}
                                className="w-full rounded-md text-sm py-2 px-4 font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isCompressing ? (
                                    <span className="flex items-center justify-center">
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        压缩中...
                                    </span>
                                ) : (
                                    '图片补压'
                                )}
                            </button>
                            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                                压缩大于 200KB 的图片，降低存储占用。适用于之前未自动压缩的图片。（仅咖啡豆图片）
                            </p>
                            {isCompressing && compressionProgress.total > 0 && (
                                <div className="mt-3">
                                    <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                                        <span>进度</span>
                                        <span>{compressionProgress.current}/{compressionProgress.total}</span>
                                    </div>
                                    <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5">
                                        <div
                                            className="bg-orange-600 h-1.5 rounded-full transition-all duration-300"
                                            style={{ width: `${(compressionProgress.current / compressionProgress.total) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>



            {/* 冲突解决模态框 - 半屏 */}
            <AnimatePresence>
                {showConflictModal && (
                    <motion.div
                        className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/40 dark:bg-black/60"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowConflictModal(false)}
                    >
                        <motion.div
                            className="w-full max-w-[500px] mx-auto bg-neutral-100 dark:bg-neutral-800 rounded-t-2xl shadow-2xl p-5 pb-safe-bottom"
                            initial={{ y: "100%" }}
                            animate={{ y: "0%" }}
                            exit={{ y: "100%" }}
                             transition={{ 
    duration: 0.35,
    ease: [0.36, 0.66, 0.04, 1]
  }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="text-center mb-4">
                                <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">数据同步冲突</h3>
                                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                                    检测到云端数据已更新，请选择操作
                                </p>
                            </div>

                            <div className="p-4 mb-4 bg-neutral-200/60 dark:bg-neutral-900/60 rounded text-center">
                                <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                    云端数据
                                </p>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                    {conflictRemoteMetadata && conflictRemoteMetadata.lastSyncTime
                                        ? `最后更新于 ${new Date(
                                            conflictRemoteMetadata.lastSyncTime
                                        ).toLocaleString('zh-CN', {
                                            month: 'numeric',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}`
                                        : '无法获取云端数据时间'}
                                </p>
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={() => handleConflictResolution('download')}
                                    className="w-full py-3 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                                >
                                    下载云端数据 (推荐)
                                </button>
                                <button
                                    onClick={() => handleConflictResolution('upload')}
                                    className="w-full py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-500"
                                >
                                    上传本地数据 (将覆盖云端)
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

export default DataSettings