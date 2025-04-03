'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DataManager as DataManagerUtil } from '@/lib/dataManager'
import { APP_VERSION } from '@/lib/config'
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
    const [isExporting, setIsExporting] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [isResetting, setIsResetting] = useState(false)
    const [isFixingBlendBeans, setIsFixingBlendBeans] = useState(false)
    const [showConfirmReset, setShowConfirmReset] = useState(false)
    const [importMode, setImportMode] = useState<'replace' | 'merge'>('merge')
    const [isCompleteReset, setIsCompleteReset] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const isNative = Capacitor.isNativePlatform()

    const handleExport = async () => {
        try {
            setIsExporting(true)
            setStatus({ type: 'info', message: '正在导出数据...' })

            const jsonData = await DataManagerUtil.exportAllData()
            const fileName = `brew-guide-data-${new Date().toISOString().slice(0, 10)}.json`

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
            }
        } catch (_error) {
            setStatus({ type: 'error', message: `导出失败: ${(_error as Error).message}` })
        } finally {
            setIsExporting(false)
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
            setIsImporting(true)
            setStatus({ type: 'info', message: '正在导入数据...' })

            const reader = new FileReader()
            reader.onload = async (event) => {
                try {
                    const jsonString = event.target?.result as string

                    let result
                    if (importMode === 'replace') {
                        result = await DataManagerUtil.importAllData(jsonString)
                    } else {
                        result = await DataManagerUtil.mergeData(jsonString)
                    }

                    if (result.success) {
                        setStatus({ type: 'success', message: result.message })
                        if (onDataChange) {
                            onDataChange()
                        }
                    } else {
                        setStatus({ type: 'error', message: result.message })
                    }
                } catch (_error) {

                    setStatus({ type: 'error', message: `导入失败: ${(_error as Error).message}` })
                } finally {
                    setIsImporting(false)
                    // 重置文件输入，以便可以重新选择同一个文件
                    if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                    }
                }
            }

            reader.onerror = () => {
                setStatus({ type: 'error', message: '读取文件失败' })
                setIsImporting(false)
            }

            reader.readAsText(file)
        } catch (_error) {

            setStatus({ type: 'error', message: `导入失败: ${(_error as Error).message}` })
            setIsImporting(false)
        }
    }

    const handleReset = async () => {
        try {
            setIsResetting(true)
            setStatus({ type: 'info', message: '正在重置数据...' })

            const result = await DataManagerUtil.resetAllData(isCompleteReset)

            if (result.success) {
                setStatus({ type: 'success', message: result.message })
                if (onDataChange) {
                    onDataChange()
                }
            } else {
                setStatus({ type: 'error', message: result.message })
            }
        } catch (_error) {

            setStatus({ type: 'error', message: `重置失败: ${(_error as Error).message}` })
        } finally {
            setIsResetting(false)
            setShowConfirmReset(false)
            setIsCompleteReset(false)
        }
    }

    const handleFixBlendBeans = async () => {
        try {
            setIsFixingBlendBeans(true);
            setStatus({ type: 'info', message: '正在修复拼配豆数据...' });

            const result = await DataManagerUtil.fixBlendBeansData();

            if (result.success) {
                setStatus({ 
                    type: 'success', 
                    message: result.fixedCount > 0 
                        ? `${result.message}，请重启应用确保正常运行` 
                        : result.message 
                });
                
                if (result.fixedCount > 0 && onDataChange) {
                    setTimeout(() => {
                        onDataChange();
                    }, 1500);
                }
            } else {
                setStatus({ type: 'error', message: result.message });
            }
        } catch (_error) {
            setStatus({ type: 'error', message: `修复失败: ${(_error as Error).message}` });
        } finally {
            setIsFixingBlendBeans(false);
        }
    };

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-800"
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
                                disabled={isExporting}
                                className="w-full rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 disabled:opacity-50 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600"
                            >
                                {isExporting ? '导出中...' : '导出所有数据'}
                            </button>
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                {isNative
                                    ? '将所有数据导出到文档目录'
                                    : '将所有数据下载为 JSON 文件'}
                            </p>
                        </div>

                        <div>
                            <div className="mb-2 flex items-center space-x-4">
                                <div className="flex items-center">
                                    <input
                                        type="radio"
                                        id="merge"
                                        name="importMode"
                                        value="merge"
                                        checked={importMode === 'merge'}
                                        onChange={() => setImportMode('merge')}
                                        className="h-4 w-4 text-neutral-600 focus:ring-neutral-500 dark:text-neutral-400"
                                    />
                                    <label
                                        htmlFor="merge"
                                        className="ml-2 text-sm text-neutral-700 dark:text-neutral-300"
                                    >
                                        合并数据
                                    </label>
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="radio"
                                        id="replace"
                                        name="importMode"
                                        value="replace"
                                        checked={importMode === 'replace'}
                                        onChange={() => setImportMode('replace')}
                                        className="h-4 w-4 text-neutral-600 focus:ring-neutral-500 dark:text-neutral-400"
                                    />
                                    <label
                                        htmlFor="replace"
                                        className="ml-2 text-sm text-neutral-700 dark:text-neutral-300"
                                    >
                                        替换数据
                                    </label>
                                </div>
                            </div>

                            <button
                                onClick={handleImportClick}
                                disabled={isImporting}
                                className="w-full rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 disabled:opacity-50 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600"
                            >
                                {isImporting ? '导入中...' : '导入数据'}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                {importMode === 'merge'
                                    ? '将导入的数据与现有数据合并'
                                    : '用导入的数据替换所有现有数据'}
                            </p>
                        </div>

                        <div>
                            <button
                                onClick={handleFixBlendBeans}
                                disabled={isFixingBlendBeans}
                                className="w-full rounded-md bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30"
                            >
                                {isFixingBlendBeans ? '修复中...' : '修复拼配豆数据'}
                            </button>
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                修复可能导致应用崩溃的拼配豆数据问题
                            </p>
                        </div>

                        <div>
                            {!showConfirmReset ? (
                                <button
                                    onClick={() => setShowConfirmReset(true)}
                                    className="w-full rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-800 transition-colors hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                                >
                                    重置所有数据
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
                                                确认重置所有数据
                                            </h3>
                                        </div>
                                        <p className="text-xs text-red-600 dark:text-red-400 mb-4">
                                            此操作无法撤销，所有数据将被删除。建议在重置前先导出备份。
                                        </p>
                                        
                                        <div className="mb-4">
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isCompleteReset}
                                                    onChange={(e) => setIsCompleteReset(e.target.checked)}
                                                    className="h-4 w-4 text-red-600 rounded border-neutral-300 focus:ring-red-500"
                                                />
                                                <span className="ml-2 text-sm text-red-700 dark:text-red-300">
                                                    完全重置（包括所有设置和缓存）
                                                </span>
                                            </label>
                                            <p className="mt-1 text-xs text-red-500 dark:text-red-400 ml-6">
                                                将彻底重置所有数据，包括自定义器具、应用设置和导航状态
                                            </p>
                                        </div>

                                        <div className="flex space-x-2 justify-end">
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmReset(false)}
                                                className="px-3 py-1.5 text-xs rounded-md bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-white transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-600"
                                            >
                                                取消
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleReset}
                                                disabled={isResetting}
                                                className="px-3 py-1.5 text-xs rounded-md bg-red-600 text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                                            >
                                                {isResetting ? '重置中...' : '确认重置'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                删除所有数据并恢复到初始状态
                            </p>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}

export default DataManager 