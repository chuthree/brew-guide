'use client'

import { useEffect, useState } from 'react'

/**
 * 轻量级提示组件
 * 设计理念：
 * - 底部居中显示，符合移动端用户习惯
 * - 简洁的文本提示，无复杂UI元素
 * - 原生CSS过渡效果，无需动画库依赖
 * - 自动消失
 */

// 提示显示时长（毫秒）
const TOAST_DURATION = 2000

interface ToastOptions {
    type?: 'success' | 'error' | 'info' | 'warning'
    title: string
    duration?: number
}

let showLightToastFn: ((options: ToastOptions) => void) | null = null

export function showToast(options: ToastOptions) {
    if (showLightToastFn) {
        showLightToastFn(options)
    }
}

export function LightToast() {
    const [visible, setVisible] = useState(false)
    const [shouldRender, setShouldRender] = useState(false)
    const [currentToast, setCurrentToast] = useState<ToastOptions | null>(null)

    useEffect(() => {
        showLightToastFn = (options: ToastOptions) => {
            setCurrentToast(options)
            setShouldRender(true)
            // 延迟一帧以触发过渡效果
            requestAnimationFrame(() => {
                setVisible(true)
            })
        }

        return () => {
            showLightToastFn = null
        }
    }, [])

    useEffect(() => {
        if (visible && currentToast) {
            const duration = currentToast.duration || TOAST_DURATION
            const timer = setTimeout(() => {
                setVisible(false)
                // 等待过渡动画完成后再移除元素
                setTimeout(() => {
                    setShouldRender(false)
                    setCurrentToast(null)
                }, 200)
            }, duration)

            return () => clearTimeout(timer)
        }
    }, [visible, currentToast])

    if (!shouldRender || !currentToast) return null

    // 根据类型获取小圆点颜色
    const getDotColor = () => {
        switch (currentToast.type) {
            case 'success':
                return 'bg-green-500'
            case 'error':
                return 'bg-red-500'
            case 'warning':
                return 'bg-yellow-500'
            default:
                return 'bg-blue-500'
        }
    }

    return (
        <div 
            className="fixed left-1/2 bottom-[calc(env(safe-area-inset-bottom)+80px)] z-[9999] pointer-events-none"
            style={{
                transform: visible 
                    ? 'translate(-50%, 0)' 
                    : 'translate(-50%, 10px)',
                opacity: visible ? 1 : 0,
                transition: 'all 0.2s ease-out'
            }}
        >
            <div className="bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl px-5 py-3 rounded-full text-sm font-medium shadow-xl whitespace-nowrap max-w-[280px] text-neutral-900 dark:text-white border border-white/20 dark:border-white/10">
                <div className="flex items-center justify-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getDotColor()}`} />
                    <span>{currentToast.title}</span>
                </div>
            </div>
        </div>
    )
}