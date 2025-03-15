'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// 定义类型以替代 any
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// 扩展 Window 接口以包含 beforeinstallprompt 事件
declare global {
    interface WindowEventMap {
        beforeinstallprompt: BeforeInstallPromptEvent;
    }
}

export default function PWAPrompt() {
    const [showInstallPrompt, setShowInstallPrompt] = useState(false)
    const [showUpdatePrompt, setShowUpdatePrompt] = useState(false)
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [isIOS, setIsIOS] = useState(false)

    useEffect(() => {
        // 检测是否是 iOS 设备
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream
        setIsIOS(isIOSDevice)

        // 检测是否已经安装 PWA
        const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as Navigator & { standalone?: boolean }).standalone === true

        // 如果是 iOS 设备且没有安装，显示 iOS 特定的安装提示
        if (isIOSDevice && !isInstalled) {
            setShowInstallPrompt(true)
        }

        // 对于非 iOS 设备，监听 beforeinstallprompt 事件
        const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
            // 不要阻止默认行为，这样浏览器可以显示安装横幅
            // e.preventDefault() 这行被移除了
            setDeferredPrompt(e)
            if (!isInstalled) {
                setShowInstallPrompt(true)
            }
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

        // 存储当前会话标识，用于判断是否是新会话
        const sessionId = Date.now().toString();
        if (!sessionStorage.getItem('pwa_session_id')) {
            sessionStorage.setItem('pwa_session_id', sessionId);
        }
        const isNewSession = sessionStorage.getItem('pwa_session_id') === sessionId;

        // 监听 PWA 更新
        if ('serviceWorker' in navigator) {
            // 使用一个标志来跟踪是否已经显示过更新提示
            let hasShownUpdatePrompt = false;

            navigator.serviceWorker.addEventListener('controllerchange', () => {
                // 只有在页面刷新前未显示过更新提示时才显示
                // 并且不是首次加载（新会话）
                if (!hasShownUpdatePrompt && !isNewSession) {
                    hasShownUpdatePrompt = true;
                    // 检查是否是由于新 service worker 激活导致的 controllerchange
                    // 而不是首次加载
                    setTimeout(() => {
                        setShowUpdatePrompt(true);
                    }, 1000); // 延迟一秒，避免与初始加载混淆
                }
            });
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
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

    const handleUpdate = () => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((registration) => {
                registration.update().then(() => {
                    window.location.reload()
                })
            })
        }
    }

    return (
        <AnimatePresence>
            {/* {(showInstallPrompt || showUpdatePrompt) && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                    className="fixed bottom-6 mx-auto z-50 left-6 right-6 max-w-[500px] "
                >
                    {showInstallPrompt && (
                        <div className="flex flex-col space-y-6 border-l border-neutral-200 pl-6 bg-neutral-50/80 backdrop-blur-sm dark:bg-neutral-900/80 dark:border-neutral-800">
                            <div className="space-y-2">
                                <h3 className="text-xs font-normal tracking-wider text-neutral-800 dark:text-neutral-100">
                                    添加到主屏幕
                                </h3>
                                {isIOS ? (
                                    <div className="space-y-1">
                                        <p className="text-[10px] tracking-wide text-neutral-500 dark:text-neutral-400">
                                            在 Safari 浏览器中：
                                        </p>
                                        <ol className="space-y-1 text-[10px] tracking-wide text-neutral-500 dark:text-neutral-400">
                                            <li>1. 点击底部的分享按钮</li>
                                            <li>2. 选择添加到主屏幕</li>
                                            <li>3. 点击添加完成安装</li>
                                        </ol>
                                    </div>
                                ) : (
                                    <p className="text-[10px] tracking-wide text-neutral-500 dark:text-neutral-400">
                                        将应用添加到主屏幕，获得更好的使用体验
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center justify-end space-x-4">
                                <button
                                    onClick={() => setShowInstallPrompt(false)}
                                    className="text-[10px] tracking-widest text-neutral-400 transition-colors hover:text-neutral-800 dark:text-neutral-500 dark:hover:text-neutral-300"
                                >
                                    [ 稍后 ]
                                </button>
                                {!isIOS && (
                                    <button
                                        onClick={handleInstall}
                                        className="text-[10px] tracking-widest text-neutral-800 transition-colors hover:text-neutral-600 dark:text-neutral-100 dark:hover:text-neutral-300"
                                    >
                                        [ 安装 ]
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {showUpdatePrompt && (
                        <div className="flex flex-col space-y-6 border-l border-neutral-200 pl-6 bg-neutral-50/80 backdrop-blur-sm dark:bg-neutral-900/80 dark:border-neutral-800">
                            <div className="space-y-2">
                                <h3 className="text-xs font-normal tracking-wider text-neutral-800 dark:text-neutral-100">
                                    更新可用
                                </h3>
                                <p className="text-[10px] tracking-wide text-neutral-500 dark:text-neutral-400">
                                    新版本已就绪，立即更新获取最新功能
                                </p>
                            </div>
                            <div className="flex items-center justify-end space-x-4">
                                <button
                                    onClick={() => setShowUpdatePrompt(false)}
                                    className="text-[10px] tracking-widest text-neutral-400 transition-colors hover:text-neutral-800 dark:text-neutral-500 dark:hover:text-neutral-300"
                                >
                                    [ 稍后 ]
                                </button>
                                <button
                                    onClick={handleUpdate}
                                    className="text-[10px] tracking-widest text-neutral-800 transition-colors hover:text-neutral-600 dark:text-neutral-100 dark:hover:text-neutral-300"
                                >
                                    [ 更新 ]
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>
            )} */}
        </AnimatePresence>
    )
} 