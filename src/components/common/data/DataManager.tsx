'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DataManager as DataManagerUtil } from '@/lib/core/dataManager'
import { BackupReminderUtils } from '@/lib/utils/backupReminderUtils'
import { compressBase64Image } from '@/lib/utils/imageCapture'
import { APP_VERSION } from '@/lib/core/config'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

interface DataManagerProps {
    isOpen: boolean
    onClose: () => void
    onDataChange?: () => void
}

const DataManager: React.FC<DataManagerProps> = ({ isOpen, onClose, onDataChange }) => {
    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info' | null; message: string }>({
        type: null,
        message: ''
    })


    const [showConfirmReset, setShowConfirmReset] = useState(false)
    const [isCompressing, setIsCompressing] = useState(false)
    const [compressionProgress, setCompressionProgress] = useState({ current: 0, total: 0 })
    const fileInputRef = useRef<HTMLInputElement>(null)

    const isNative = Capacitor.isNativePlatform()

    // 检测图片大小（字节）
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

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-800 mx-6"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-medium">数据管理</h2>
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

                    <div className="mb-6 text-xs text-neutral-500 dark:text-neutral-400">
                        <p>管理您的应用数据，包括导出、导入和重置</p>
                        <p className="mt-1">当前版本: v{APP_VERSION}</p>
                    </div>

                    {status.type && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`mb-4 rounded-md p-3 text-sm ${status.type === 'success'
                                ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                : status.type === 'error'
                                    ? 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                    : 'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                                }`}
                        >
                            {status.message}
                        </motion.div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <button
                                onClick={handleExport}
                                className="w-full rounded text-sm py-2 font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-500"
                            >
                                <span className="text-neutral-800 dark:text-neutral-200">导出</span>数据
                            </button>
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                {isNative
                                    ? '将数据导出到文档目录'
                                    : '将数据下载为 JSON 文件'}
                            </p>
                        </div>

                        <div>
                            <button
                                onClick={handleImportClick}
                                className="w-full rounded text-sm py-2 font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-500"
                            >
                               <span className="text-neutral-800 dark:text-neutral-200">导入</span>数据（<span className="text-neutral-800 dark:text-neutral-200">替换</span>）
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

                        <div>
                            {!showConfirmReset ? (
                                <button
                                    onClick={() => setShowConfirmReset(true)}
                                    className="w-full rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-800 transition-colors hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                                >
                                    重置数据
                                </button>
                            ) : (
                                <div className="mt-4">
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
                                        <p className="text-xs text-red-600 dark:text-red-400 mb-4">
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
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                完全删除数据并恢复到初始状态，包括设置和缓存
                            </p>
                        </div>

                        {/* 分割线 */}
                        <div className="my-6 border-t border-neutral-200 dark:border-neutral-700"></div>

                        {/* 图片压缩功能 */}
                        <div className="space-y-4">
                            <div>
                                <button
                                    onClick={handleCompressImages}
                                    disabled={isCompressing}
                                    className="w-full rounded text-sm py-2 font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                        <span className="text-neutral-800 dark:text-neutral-200">补压图片</span>
                                    )}
                                </button>
                                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                    压缩大于 200KB 的图片，降低存储占用。适用于之前未自动压缩的图片。（仅咖啡豆图片）
                                </p>
                                {isCompressing && compressionProgress.total > 0 && (
                                    <div className="mt-2">
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
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}

export default DataManager
