import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Method, CustomEquipment } from '@/lib/core/config'
import { copyMethodToClipboard } from '@/lib/managers/customMethods'
import { showToast } from '../../common/feedback/GlobalToast'

interface MethodShareModalProps {
    isOpen: boolean
    onClose: () => void
    method: Method
    customEquipment?: CustomEquipment
}

const MethodShareModal: React.FC<MethodShareModalProps> = ({
    isOpen,
    onClose,
    method,
    customEquipment
}) => {
    const [isSharing, setIsSharing] = useState(false)
    const [activeOption, setActiveOption] = useState<'text' | 'image'>('text')

    // 处理文字分享
    const handleTextShare = async () => {
        try {
            setIsSharing(true)
            await copyMethodToClipboard(method, customEquipment)
            showToast({
                type: 'success',
                title: '已复制到剪贴板',
                duration: 2000
            })
            onClose()
        } catch (_error) {
            showToast({
                type: 'error',
                title: '复制失败，请重试',
                duration: 2000
            })
        } finally {
            setIsSharing(false)
        }
    }

    // 处理图片分享
    const handleImageShare = async () => {
        // 开发中提示
        showToast({
            type: 'info',
            title: '图片分享功能开发中...',
            duration: 2000
        })
        setIsSharing(false)
    }
    
    // 渲染分享选项
    const renderShareOptions = () => {
        return (
            <div className="space-y-4 mb-6">
                <div
                    className={`p-4 rounded-lg flex items-center cursor-pointer ${
                        activeOption === 'text'
                            ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
                            : 'bg-neutral-100 dark:bg-neutral-800/30 hover:opacity-90'
                    }`}
                    onClick={() => setActiveOption('text')}
                >
                    <div className="mr-3 text-xl">📝</div>
                    <div className="flex-1">
                        <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                            文字分享
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            生成方案文字说明并复制到剪贴板
                        </div>
                    </div>
                    <div>
                        <input
                            type="radio"
                            checked={activeOption === 'text'}
                            onChange={() => setActiveOption('text')}
                            className="w-4 h-4 text-blue-600 bg-neutral-100 border-neutral-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-neutral-800 focus:ring-2 dark:bg-neutral-700 dark:border-neutral-600"
                        />
                    </div>
                </div>

                <div
                    className={`p-4 rounded-lg flex items-center cursor-pointer ${
                        activeOption === 'image'
                            ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
                            : 'bg-neutral-100 dark:bg-neutral-800/30 hover:opacity-90'
                    }`}
                    onClick={() => setActiveOption('image')}
                >
                    <div className="mr-3 text-xl">🖼️</div>
                    <div className="flex-1">
                        <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                            图片分享
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            生成精美的方案卡片图片，适合社交媒体分享
                        </div>
                    </div>
                    <div>
                        <input
                            type="radio"
                            checked={activeOption === 'image'}
                            onChange={() => setActiveOption('image')}
                            className="w-4 h-4 text-blue-600 bg-neutral-100 border-neutral-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-neutral-800 focus:ring-2 dark:bg-neutral-700 dark:border-neutral-600"
                        />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.265 }}
                    className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            onClose()
                        }
                    }}
                >
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{
                            type: 'tween',
                            ease: [0.33, 1, 0.68, 1], // easeOutCubic
                            duration: 0.265
                        }}
                        style={{
                            willChange: 'transform'
                        }}
                        className="absolute inset-x-0 bottom-0 max-w-[500px] mx-auto max-h-[85vh] overflow-auto rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl"
                    >
                        {/* 拖动条 */}
                        <div className="sticky top-0 z-10 flex justify-center py-2 bg-neutral-50 dark:bg-neutral-900">
                            <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                        </div>

                        {/* 内容 */}
                        <div className="px-6 pb-safe-bottom">
                            {/* 标题栏 */}
                            <div className="flex items-center justify-between py-4 mb-2">
                                <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
                                    分享 {method.name}
                                </h3>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </div>

                            {/* 分享选项 */}
                            {renderShareOptions()}

                            {/* 图片预览区域（隐藏但用于生成图片） */}
                            <div className={activeOption === 'image' ? 'mb-4' : 'hidden'}>
                                <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                                    图片预览:
                                </div>
                                <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700 flex items-center justify-center" style={{height: '250px'}}>
                                    <div className="text-xl text-neutral-500 dark:text-neutral-400">
                                        开发中...
                                    </div>
                                </div>
                            </div>

                            {/* 按钮 */}
                            <button
                                onClick={activeOption === 'text' ? handleTextShare : handleImageShare}
                                disabled={isSharing || activeOption === 'image'}
                                className={`w-full mt-2 py-2.5 px-4 rounded-lg transition-colors ${
                                    isSharing || activeOption === 'image'
                                        ? 'bg-neutral-400 dark:bg-neutral-700 cursor-not-allowed text-neutral-300 dark:text-neutral-500'
                                        : 'bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800 hover:opacity-80'
                                }`}
                            >
                                {isSharing 
                                    ? (activeOption === 'text' ? '复制中...' : '开发中...') 
                                    : (activeOption === 'text' ? '复制到剪贴板' : '开发中...')}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default MethodShareModal 