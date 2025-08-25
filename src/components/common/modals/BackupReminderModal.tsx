'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BackupReminderUtils, BackupReminderType } from '@/lib/utils/backupReminderUtils'
import { DataManager as DataManagerUtil } from '@/lib/core/dataManager'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

interface BackupReminderModalProps {
  isOpen: boolean
  onClose: () => void
  reminderType?: BackupReminderType | null
}

const BackupReminderModal: React.FC<BackupReminderModalProps> = ({
  isOpen,
  onClose,
  reminderType = null
}) => {
  const [nextReminderText, setNextReminderText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle')
  const [exportMessage, setExportMessage] = useState('')

  // 加载下次提醒时间文本
  useEffect(() => {
    if (isOpen) {
      BackupReminderUtils.getNextReminderText().then(setNextReminderText)
    }
  }, [isOpen])

  const handleBackupNow = async () => {
    setIsLoading(true)
    setExportStatus('exporting')
    setExportMessage('正在导出数据...')

    try {
      const jsonData = await DataManagerUtil.exportAllData()
      const fileName = `brew-guide-data-${new Date().toISOString().slice(0, 10)}.json`
      const isNative = Capacitor.isNativePlatform()

      if (isNative) {
        // 移动端处理
        await Filesystem.writeFile({
          path: fileName,
          data: jsonData,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        })

        const uriResult = await Filesystem.getUri({
          path: fileName,
          directory: Directory.Cache
        })

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
      } else {
        // Web端处理
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
      }

      // 标记备份完成
      await BackupReminderUtils.markBackupCompleted()

      setExportStatus('success')
      setExportMessage('数据导出成功！')

      // 延迟关闭弹窗
      setTimeout(() => {
        onClose()
      }, 1500)

    } catch (error) {
      console.error('导出失败:', error)
      setExportStatus('error')
      setExportMessage(`导出失败: ${(error as Error).message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemindLater = async () => {
    setIsLoading(true)
    try {
      await BackupReminderUtils.markReminderShown()
      onClose()
    } catch (error) {
      console.error('设置提醒失败:', error)
    } finally {
      setIsLoading(false)
    }
  }





  // 根据提醒类型获取标题和描述
  const getReminderContent = () => {
    switch (reminderType) {
      case 'hasDataNeverBackedUp':
        return {
          title: '备份数据',
          description: '检测到您有一些数据，建议备份以防丢失'
        }
      case 'firstTimeAfterDays':
        return {
          title: '备份数据',
          description: '建议定期备份您的冲煮记录和咖啡豆数据'
        }
      case 'periodicReminder':
        return {
          title: '备份提醒',
          description: '定期备份可以防止数据丢失'
        }
      default:
        return {
          title: '备份提醒',
          description: '建议备份您的数据'
        }
    }
  }

  const { title, description } = getReminderContent()

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景模糊 */}
          <motion.div
            initial={{ backdropFilter: "blur(0px)" }}
            animate={{ backdropFilter: "blur(8px)" }}
            exit={{ backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50"
            onClick={onClose}
          />

          {/* 拟态框 */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.2 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100) {
                onClose()
              }
            }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-neutral-800 backdrop-blur-xl rounded-t-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 拖拽指示器 */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-neutral-300 dark:bg-neutral-600 rounded-full" />
            </div>

            <div className="px-6 pb-6 pb-safe">
              {/* 标题 */}
              <div className="mb-5">
                <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-1">
                  {exportStatus === 'exporting' ? '正在备份' :
                   exportStatus === 'success' ? '备份完成' :
                   exportStatus === 'error' ? '备份失败' : title}
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {exportMessage || description}
                </p>
              </div>

              {/* 主要操作按钮 */}
              <button
                onClick={handleBackupNow}
                disabled={isLoading || exportStatus === 'success'}
                className="w-full bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 disabled:bg-neutral-400 dark:bg-neutral-100 dark:hover:bg-neutral-200 dark:active:bg-neutral-300 dark:disabled:bg-neutral-600 text-white dark:text-neutral-900 font-medium py-3.5 rounded-full transition-all duration-150 active:scale-[0.98]"
              >
                {exportStatus === 'exporting' ? '正在备份...' :
                 exportStatus === 'success' ? '备份完成' :
                 exportStatus === 'error' ? '重试备份' : '立即备份'}
              </button>

              {/* 次要操作和信息 - 仅在非导出状态下显示 */}
              {exportStatus === 'idle' && (
                <div className="mt-3 flex items-center justify-between text-xs">
                  <button
                    onClick={handleRemindLater}
                    disabled={isLoading}
                    className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 py-2 transition-colors duration-150"
                  >
                    稍后提醒
                  </button>

                  {nextReminderText && (
                    <span className="text-neutral-400 dark:text-neutral-500">
                      下次：{nextReminderText}
                    </span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default BackupReminderModal
