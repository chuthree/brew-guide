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

    // 为 Capacitor 定义接口
    interface Window {
        Capacitor?: {
            isNative: boolean;
            platform: string;
        };
    }
}

export default function AppInstallAndUpdatePrompt() {
    const [showInstallPrompt, setShowInstallPrompt] = useState(false)
    const [showUpdatePrompt, setShowUpdatePrompt] = useState(false)
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [isIOS, setIsIOS] = useState(false)
    const [isCapacitor, setIsCapacitor] = useState(false)

    useEffect(() => {
        // 检测是否在 Capacitor 环境中运行
        const checkIsCapacitor = () => {
            // 检查是否存在 Capacitor 全局对象
            const isCapacitorApp = typeof window.Capacitor !== 'undefined';
            // 或者检查 URL scheme
            const isCapacitorScheme = window.location.protocol === 'capacitor:';
            // 或者检查 User Agent 中是否包含特定标识
            const isCapacitorUA = navigator.userAgent.includes('capacitor');

            return isCapacitorApp || isCapacitorScheme || isCapacitorUA;
        };

        const capacitorApp = checkIsCapacitor();
        setIsCapacitor(capacitorApp);

        // 如果是 Capacitor 应用，不显示安装提示
        if (capacitorApp) {
            return;
        }

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

            // 监听 Service Worker 更新
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

            // 定期检查 Service Worker 更新
            const checkForUpdates = async () => {
                try {
                    const registration = await navigator.serviceWorker.ready;
                    await registration.update();
                } catch (error) {
                    console.warn('检查 Service Worker 更新失败:', error);
                }
            };

            // 页面可见时检查更新
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    checkForUpdates();
                }
            });

            // 定期检查更新（每30分钟）
            const updateInterval = setInterval(checkForUpdates, 30 * 60 * 1000);

            // 清理定时器
            return () => {
                clearInterval(updateInterval);
            };
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
                // 用户接受了安装提示
            } else {
                // 用户拒绝了安装提示
            }
            setDeferredPrompt(null)
            setShowInstallPrompt(false)
        } catch (error) {
            console.error('安装提示失败:', error)
        }
    }

    const handleUpdate = async () => {
        if ('serviceWorker' in navigator) {
            try {
                // 清除相关缓存
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    const chunkCacheNames = cacheNames.filter(name =>
                        name.includes('js-chunks') ||
                        name.includes('static-resources') ||
                        name.includes('next-static') ||
                        name.includes('pages') ||
                        name.includes('pages-rsc')
                    );

                    await Promise.all(
                        chunkCacheNames.map(cacheName => {
                            console.warn('清除缓存:', cacheName);
                            return caches.delete(cacheName);
                        })
                    );
                }

                // 更新 Service Worker
                const registration = await navigator.serviceWorker.ready;
                await registration.update();

                // 强制刷新页面
                window.location.reload();
            } catch (error) {
                console.error('更新 Service Worker 失败:', error);
                // 即使出错也要刷新页面
                window.location.reload();
            }
        }
    }

    // 如果是 Capacitor 应用，不显示任何提示
    if (isCapacitor) {
        return null;
    }

    return (
        <AnimatePresence>
            {(showInstallPrompt || showUpdatePrompt) && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                    className="fixed bottom-6 mx-auto z-50 left-6 right-6 max-w-[500px] pwa-prompt-visible"
                >
                    {showInstallPrompt && (
                        <div className="flex flex-col space-y-6 border-l border-neutral-200 pl-6 bg-neutral-50/80 backdrop-blur-xs dark:bg-neutral-900/80 dark:border-neutral-800">
                            <div className="space-y-2">
                                <h3 className="text-xs font-normal tracking-wider text-neutral-800 dark:text-neutral-100">
                                    添加到主屏幕（强烈建议！✨）
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
                                    className="text-[10px] tracking-widest text-neutral-400 transition-colors dark:text-neutral-500"
                                >
                                    [ 稍后 ]
                                </button>
                                {!isIOS && (
                                    <button
                                        onClick={handleInstall}
                                        className="text-[10px] tracking-widest text-neutral-800 transition-colors dark:text-neutral-100"
                                    >
                                        [ 安装 ]
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {showUpdatePrompt && (
                        <div className="flex flex-col space-y-6 border-l border-neutral-200 pl-6 bg-neutral-50/80 backdrop-blur-xs dark:bg-neutral-900/80 dark:border-neutral-800">
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
                                    className="text-[10px] tracking-widest text-neutral-400 transition-colors dark:text-neutral-500"
                                >
                                    [ 稍后 ]
                                </button>
                                <button
                                    onClick={handleUpdate}
                                    className="text-[10px] tracking-widest text-neutral-800 transition-colors dark:text-neutral-100"
                                >
                                    [ 更新 ]
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    )
} 