'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, ArrowRight, AlertTriangle } from 'lucide-react'
import { DataManager } from '@/lib/core/dataManager'

interface DataMigrationModalProps {
    isOpen: boolean
    onClose: () => void
    legacyCount: number
    onMigrationComplete: () => void
}

const DataMigrationModal: React.FC<DataMigrationModalProps> = ({
    isOpen,
    onClose,
    legacyCount,
    onMigrationComplete
}) => {
    const [isBackingUp, setIsBackingUp] = useState(false)
    const [isMigrating, setIsMigrating] = useState(false)
    const [backupCompleted, setBackupCompleted] = useState(false)
    const [migrationCompleted, setMigrationCompleted] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // 处理备份数据
    const handleBackup = async () => {
        try {
            setIsBackingUp(true)
            setError(null)

            const jsonData = await DataManager.exportAllData()
            const fileName = `brew-guide-backup-${new Date().toISOString().slice(0, 10)}.json`

            // 创建下载链接
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

            setBackupCompleted(true)
        } catch (error) {
            setError(`备份失败: ${(error as Error).message}`)
        } finally {
            setIsBackingUp(false)
        }
    }

    // 处理数据迁移
    const handleMigration = async () => {
        try {
            setIsMigrating(true)
            setError(null)

            const result = await DataManager.migrateLegacyBeanData()
            
            if (result.success) {
                setMigrationCompleted(true)
                // 延迟通知父组件迁移完成
                setTimeout(() => {
                    onMigrationComplete()
                }, 1500)
            } else {
                setError(result.message)
            }
        } catch (error) {
            setError(`迁移失败: ${(error as Error).message}`)
        } finally {
            setIsMigrating(false)
        }
    }

    // 跳过迁移
    const handleSkip = () => {
        // 设置一个会话级标记，表示用户在本次会话中选择跳过迁移
        // 使用sessionStorage而不是localStorage，这样刷新页面后会重新提示
        sessionStorage.setItem('dataMigrationSkippedThisSession', 'true')
        onClose()
    }

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                {/* 背景遮罩 */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    onClick={migrationCompleted ? onClose : undefined}
                />

                {/* 模态框 */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-md mx-4 bg-white dark:bg-neutral-800 rounded-lg shadow-xl"
                >
                    {/* 头部 */}
                    <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
                        <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                                数据格式升级
                            </h2>
                        </div>
                        {migrationCompleted && (
                            <button
                                onClick={onClose}
                                className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    {/* 内容 */}
                    <div className="p-6">
                        {!migrationCompleted ? (
                            <>
                                <div className="mb-6">
                                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                                        检测到您有 <span className="font-semibold text-neutral-900 dark:text-neutral-100">{legacyCount}</span> 个咖啡豆使用旧的数据格式。
                                        为了获得更好的体验，建议升级到新格式。
                                    </p>
                                    <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-4 text-xs text-neutral-600 dark:text-neutral-400">
                                        <p className="mb-2">新格式的优势：</p>
                                        <ul className="space-y-1 ml-4">
                                            <li>• 更好的品种分类显示</li>
                                            <li>• 支持拼配豆的详细信息</li>
                                            <li>• 更准确的数据统计</li>
                                        </ul>
                                    </div>
                                </div>

                                {error && (
                                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    {/* 备份按钮 */}
                                    <button
                                        onClick={handleBackup}
                                        disabled={isBackingUp}
                                        className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                                            backupCompleted
                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-default'
                                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                                        }`}
                                    >
                                        <Download className="w-4 h-4" />
                                        <span>
                                            {isBackingUp ? '备份中...' : backupCompleted ? '✓ 备份完成' : '1. 备份当前数据'}
                                        </span>
                                    </button>

                                    {/* 迁移按钮 */}
                                    <button
                                        onClick={handleMigration}
                                        disabled={!backupCompleted || isMigrating}
                                        className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                                            !backupCompleted
                                                ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
                                                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                                        }`}
                                    >
                                        <ArrowRight className="w-4 h-4" />
                                        <span>
                                            {isMigrating ? '迁移中...' : '2. 开始数据迁移'}
                                        </span>
                                    </button>

                                    {/* 跳过按钮 */}
                                    <button
                                        onClick={handleSkip}
                                        className="w-full px-4 py-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                                    >
                                        暂时跳过
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="text-center">
                                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: 0.2 }}
                                        className="text-green-600 dark:text-green-400 text-2xl"
                                    >
                                        ✓
                                    </motion.div>
                                </div>
                                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                                    迁移完成！
                                </h3>
                                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
                                    已成功将 {legacyCount} 个咖啡豆升级到新格式。
                                    现在您可以享受更好的分类显示和数据统计功能。
                                </p>
                                <button
                                    onClick={onClose}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    继续使用
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}

export default DataMigrationModal
