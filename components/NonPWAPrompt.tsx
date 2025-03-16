'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function NonPWAPrompt() {
    const [showPrompt, setShowPrompt] = useState(false)

    useEffect(() => {
        // setShowPrompt(true)

        // 恢复原始检测逻辑
        // 检测是否是独立模式（PWA 模式）
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as Navigator & { standalone?: boolean }).standalone === true

        // 检查是否在 24 小时内已经关闭过提示
        const lastClosedTime = localStorage.getItem('nonPwaPromptClosed')
        const hasClosedRecently = lastClosedTime &&
            (Date.now() - parseInt(lastClosedTime)) < 24 * 60 * 60 * 1000

        // 如果不是独立模式，且 24 小时内没有关闭过提示，显示提示
        if (!isStandalone && !hasClosedRecently) {
            // 延迟显示提示，让用户先看到应用内容
            const timer = setTimeout(() => {
                // 检查是否有其他提示正在显示（通过检查 DOM 中是否有 PWAPrompt 的可见元素）
                const pwaPromptVisible = document.querySelector('.pwa-prompt-visible')
                if (!pwaPromptVisible) {
                    setShowPrompt(true)
                }
            }, 2000) // 延长延迟时间，确保 PWAPrompt 有足够时间显示

            return () => clearTimeout(timer)
        }
    }, [])

    // 关闭提示
    const handleClose = () => {
        setShowPrompt(false)

        // 存储用户已关闭提示的状态，24小时内不再显示
        localStorage.setItem('nonPwaPromptClosed', Date.now().toString())
    }

    return (
        <AnimatePresence>
            {showPrompt && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-6 non-pwa-prompt-visible"
                >
                    <div
                        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                        onClick={handleClose}
                    />

                    {/* 便签样式盒子 */}
                    <motion.div
                        className="relative max-w-md w-full p-8 transform rotate-2 overflow-hidden"
                        style={{
                            backgroundImage: 'url("/img-noise-361x370.png")',
                            backgroundBlendMode: 'overlay',
                        }}
                        initial={{ y: 20, rotate: -2 }}
                        animate={{ y: 0, rotate: 2 }}
                        exit={{ y: 20, rotate: 4 }}
                        whileHover={{ rotate: 0, scale: 1.02 }}
                        transition={{
                            duration: 0.4,
                            ease: [0.23, 1, 0.32, 1],
                            rotate: { duration: 0.3 }
                        }}
                    >


                        {/* 便签内容 - 简洁的白色文字 */}
                        <div className="h-full flex flex-col justify-between font-mono relative">
                            <div className="space-y-6">
                                <p className="text-sm text-white font-bold leading-relaxed relative tracking-wide">
                                    开发者手搓手冲咖啡机去了，网站问题记得在群里@(C)HU3哦～
                                </p>

                                <p className="text-sm text-white font-bold tracking-wide">
                                    对了，别忘了将应用添加到主屏幕www
                                </p>
                            </div>

                            {/* 关闭按钮 */}
                            <div className="pt-4 flex justify-end relative">
                                <button
                                    onClick={handleClose}
                                    className="text-xs font-bold tracking-widest text-white transition-colors px-4 py-1.5 "
                                >
                                    [ 知道了 ]
                                </button>
                            </div>
                        </div>




                        {/* 纸张边缘微妙的不规则性 */}
                        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/10 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/10 to-transparent" />
                        <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-gradient-to-b from-transparent via-black/10 to-transparent" />
                        <div className="absolute top-0 bottom-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-black/10 to-transparent" />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
} 