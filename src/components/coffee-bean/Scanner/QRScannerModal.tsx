'use client'

import React, { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Upload, X, AlertCircle } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { scanQRCode, scanImageFile, isScannerAvailable } from '@/lib/utils/qrScannerUtils'
import { isValidBeanQRCode, deserializeBeanFromQRCode } from '@/lib/utils/beanQRCodeUtils'
import type { CoffeeBean } from '@/types/app'

interface QRScannerModalProps {
    isOpen: boolean
    onClose: () => void
    onScanSuccess: (bean: Partial<CoffeeBean>) => void
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({
    isOpen,
    onClose,
    onScanSuccess
}) => {
    const [isScanning, setIsScanning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [scannerAvailable, setScannerAvailable] = useState<{
        native: boolean
        webAPI: boolean
        fileUpload: boolean
    } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // 检查扫描器可用性，并在关闭时重置状态
    React.useEffect(() => {
        if (isOpen) {
            isScannerAvailable().then(setScannerAvailable)
        } else {
            // 关闭时重置所有状态
            setIsScanning(false)
            setError(null)
        }
    }, [isOpen])

    // 历史栈管理
    React.useEffect(() => {
        if (!isOpen) return

        window.history.pushState({ modal: 'qr-scanner' }, '')

        const handlePopState = () => {
            onClose()
        }

        window.addEventListener('popstate', handlePopState)

        return () => {
            window.removeEventListener('popstate', handlePopState)
        }
    }, [isOpen, onClose])

    // 处理关闭
    const handleClose = useCallback(() => {
        if (window.history.state?.modal === 'qr-scanner') {
            window.history.back()
        } else {
            onClose()
        }
    }, [onClose])

    // 处理扫描结果
    const handleScanResult = useCallback((qrData: string) => {
        // 验证是否为咖啡豆二维码
        if (!isValidBeanQRCode(qrData)) {
            setError('这不是有效的咖啡豆二维码')
            setIsScanning(false)
            return
        }

        // 解析数据
        const bean = deserializeBeanFromQRCode(qrData)
        if (!bean) {
            setError('无法解析二维码数据')
            setIsScanning(false)
            return
        }

        // 成功 - 先重置状态再关闭
        setIsScanning(false)
        onScanSuccess(bean)
        handleClose()
    }, [onScanSuccess, handleClose])

    // 相机扫描
    const handleCameraScan = useCallback(async () => {
        setError(null)
        setIsScanning(true)

        try {
            const result = await scanQRCode()

            if (result.success && result.data) {
                handleScanResult(result.data)
            } else if (result.error === 'web_file_required') {
                // Web 平台需要文件选择
                setError('Web 端请使用上传图片功能')
                setIsScanning(false)
            } else {
                setError(result.error || '扫描失败')
                setIsScanning(false)
            }
        } catch (error) {
            console.error('Scan error:', error)
            setError('扫描失败，请重试')
            setIsScanning(false)
        }
    }, [handleScanResult])

    // 文件上传扫描
    const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        setError(null)
        setIsScanning(true)

        try {
            const result = await scanImageFile(file)

            if (result.success && result.data) {
                handleScanResult(result.data)
            } else {
                setError(result.error || '未能识别二维码')
                setIsScanning(false)
            }
        } catch (error) {
            console.error('File scan error:', error)
            setError('识别失败，请重试')
            setIsScanning(false)
        }

        // 清空 input，允许重新选择同一文件
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }, [handleScanResult])

    // 触发文件选择
    const handleUploadClick = useCallback(() => {
        fileInputRef.current?.click()
    }, [])

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* 背景遮罩 */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.265 }}
                        onClick={handleClose}
                        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs"
                    />

                    {/* 模态框内容 */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{
                            type: "tween",
                            ease: [0.33, 1, 0.68, 1],
                            duration: 0.265
                        }}
                        style={{ willChange: "transform" }}
                        className="fixed inset-x-0 bottom-0 z-50 max-w-[500px] mx-auto max-h-[85vh] overflow-hidden rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl"
                    >
                        {/* 拖动条 */}
                        <div className="sticky top-0 z-10 flex justify-center py-2 bg-neutral-50 dark:bg-neutral-900">
                            <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                        </div>

                        {/* 内容区域 */}
                        <div className="px-6 pb-safe-bottom overflow-auto max-h-[calc(85vh-40px)]">
                            {/* 标题栏 */}
                            <div className="flex items-center justify-between mt-3 mb-6">
                                <h2 className="text-lg font-medium text-neutral-800 dark:text-neutral-100">
                                    扫描二维码
                                </h2>
                                <button
                                    onClick={handleClose}
                                    className="p-2 -mr-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                >
                                    <X className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                                </button>
                            </div>

                            {/* 说明文字 */}
                            <div className="mb-6">
                                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                                    {Capacitor.isNativePlatform()
                                        ? '使用相机扫描咖啡豆二维码，或从相册选择包含二维码的图片'
                                        : '上传包含咖啡豆二维码的图片进行识别'}
                                </p>
                            </div>

                            {/* 错误提示 */}
                            {error && (
                                <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-600 dark:text-red-400">
                                        {error}
                                    </p>
                                </div>
                            )}

                            {/* 操作按钮 */}
                            <div className="flex flex-col gap-3 mb-4">
                                {/* 相机扫描（仅移动端） */}
                                {scannerAvailable?.native && (
                                    <button
                                        onClick={handleCameraScan}
                                        disabled={isScanning}
                                        className="flex items-center justify-center gap-3 py-4 bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                                    >
                                        <Camera className="w-5 h-5" />
                                        <span className="text-sm font-medium">
                                            {isScanning ? '扫描中...' : '打开相机扫描'}
                                        </span>
                                    </button>
                                )}

                                {/* 上传图片 */}
                                <button
                                    onClick={handleUploadClick}
                                    disabled={isScanning}
                                    className="flex items-center justify-center gap-3 py-4 bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                    <Upload className="w-5 h-5" />
                                    <span className="text-sm font-medium">
                                        {isScanning ? '识别中...' : Capacitor.isNativePlatform() ? '从相册选择' : '上传图片'}
                                    </span>
                                </button>

                                {/* 隐藏的文件输入 */}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                            </div>

                            {/* 使用提示 */}
                            <div className="pb-4">
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
                                    支持从咖啡豆分享功能生成的二维码
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}

export default QRScannerModal
