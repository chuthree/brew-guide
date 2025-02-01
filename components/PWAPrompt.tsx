'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function PWAPrompt() {
    const [showInstallPrompt, setShowInstallPrompt] = useState(false)
    const [showUpdatePrompt, setShowUpdatePrompt] = useState(false)
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
    const [isIOS, setIsIOS] = useState(false)
    const lastUpdateCheck = useRef(0)

    useEffect(() => {
        // 检测是否是 iOS 设备
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
        setIsIOS(isIOSDevice)

        // 检测是否已经安装 PWA
        const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true

        // 如果是 iOS 设备且没有安装，显示 iOS 特定的安装提示
        if (isIOSDevice && !isInstalled) {
            setShowInstallPrompt(true)
        }

        // iOS 特定的页面可见性检测
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                const now = Date.now()
                // 每5分钟才检查一次更新，避免频繁检查
                if (now - lastUpdateCheck.current > 5 * 60 * 1000) {
                    checkForUpdates()
                    lastUpdateCheck.current = now
                }
            }
        }

        // 页面获得焦点时检查更新
        const handleFocus = () => {
            const now = Date.now()
            if (now - lastUpdateCheck.current > 5 * 60 * 1000) {
                checkForUpdates()
                lastUpdateCheck.current = now
            }
        }

        // 对于非 iOS 设备，监听 beforeinstallprompt 事件
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault()
            setDeferredPrompt(e)
            if (!isInstalled) {
                setShowInstallPrompt(true)
            }
        })

        // 监听 PWA 更新
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                setShowUpdatePrompt(true)
            })
        }

        // 更新检测处理
        const checkForUpdates = async () => {
            if ('serviceWorker' in navigator) {
                try {
                    const registration = await navigator.serviceWorker.ready

                    // 强制检查更新
                    await registration.update()

                    // 检查缓存是否过期
                    const cacheKeys = await caches.keys()
                    for (const key of cacheKeys) {
                        const cache = await caches.open(key)
                        const requests = await cache.keys()
                        for (const request of requests) {
                            // 重新验证主要资源
                            if (request.url.includes(window.location.origin)) {
                                try {
                                    const response = await fetch(request)
                                    if (response.ok) {
                                        await cache.put(request, response)
                                    }
                                } catch (error) {
                                    console.warn('更新缓存失败:', error)
                                }
                            }
                        }
                    }

                    // 监听更新
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    setShowUpdatePrompt(true)
                                }
                            })
                        }
                    })
                } catch (error) {
                    console.warn('检查更新失败:', error)
                }
            }
        }

        // 添加事件监听器
        document.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('focus', handleFocus)

        // 初始检查
        checkForUpdates()
        lastUpdateCheck.current = Date.now()

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('focus', handleFocus)
        }
    }, [])

    const handleInstall = async () => {
        if (isIOS) {
            setShowInstallPrompt(false)
            return
        }

        if (!deferredPrompt) return

        try {
            await deferredPrompt.prompt()
            const choiceResult = await deferredPrompt.userChoice
            if (choiceResult.outcome === 'accepted') {
                console.log('用户接受了安装提示')
            }
            setDeferredPrompt(null)
            setShowInstallPrompt(false)
        } catch (err) {
            console.error('安装 PWA 时出错:', err)
        }
    }

    const handleUpdate = async () => {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.ready
                await registration.update()

                if (isIOS) {
                    // iOS 上使用更温和的更新方式
                    const cache = await caches.open('offlineCache')
                    await cache.delete(window.location.href)
                    window.location.reload()
                } else {
                    // 其他平台使用正常的更新流程
                    window.location.reload()
                }
            } catch (error) {
                console.warn('更新失败:', error)
                // 如果更新失败，强制刷新页面
                window.location.reload()
            }
        }
    }

    return (
        <AnimatePresence>
            {(showInstallPrompt || showUpdatePrompt) && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="fixed bottom-0 left-0 right-0 p-4 flex justify-center"
                >
                    <div className="border-l-4 border-zinc-500 dark:border-zinc-400 bg-white dark:bg-zinc-900 p-4 shadow-lg max-w-md w-full">
                        {showInstallPrompt && (
                            <div className="flex flex-col gap-2">
                                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                                    安装 Brew Guide 到您的设备
                                </p>
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => setShowInstallPrompt(false)}
                                        className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                                    >
                                        [取消]
                                    </button>
                                    <button
                                        onClick={handleInstall}
                                        className="text-sm text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                    >
                                        [安装]
                                    </button>
                                </div>
                            </div>
                        )}
                        {showUpdatePrompt && (
                            <div className="flex flex-col gap-2">
                                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                                    有新版本可用，是否更新？
                                </p>
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => setShowUpdatePrompt(false)}
                                        className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                                    >
                                        [稍后]
                                    </button>
                                    <button
                                        onClick={handleUpdate}
                                        className="text-sm text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                    >
                                        [更新]
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
} 