'use client'

import React, { useEffect, useState, useRef } from 'react'

interface PerformanceMetrics {
    renderTime: number
    memoryUsage?: number
    fps: number
    loadTime: number
}

interface PerformanceMonitorProps {
    enabled?: boolean
    showOverlay?: boolean
    onMetricsUpdate?: (metrics: PerformanceMetrics) => void
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
    enabled = process.env.NODE_ENV === 'development',
    showOverlay = false,
    onMetricsUpdate
}) => {
    const [metrics, setMetrics] = useState<PerformanceMetrics>({
        renderTime: 0,
        memoryUsage: 0,
        fps: 0,
        loadTime: 0
    })

    const frameCountRef = useRef(0)
    const lastTimeRef = useRef(typeof window !== 'undefined' ? performance.now() : 0)
    const renderStartRef = useRef(0)

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') return

        // 记录组件加载时间
        const loadStartTime = performance.now()

        // FPS 监控
        let animationId: number
        const measureFPS = () => {
            frameCountRef.current++
            const currentTime = performance.now()

            if (currentTime - lastTimeRef.current >= 1000) {
                const fps = Math.round((frameCountRef.current * 1000) / (currentTime - lastTimeRef.current))

                setMetrics(prev => {
                    const newMetrics = {
                        ...prev,
                        fps,
                        loadTime: currentTime - loadStartTime,
                        memoryUsage: typeof window !== 'undefined' && (performance as any).memory?.usedJSHeapSize
                            ? (performance as any).memory.usedJSHeapSize / 1024 / 1024
                            : 0
                    }
                    onMetricsUpdate?.(newMetrics)
                    return newMetrics
                })

                frameCountRef.current = 0
                lastTimeRef.current = currentTime
            }

            animationId = requestAnimationFrame(measureFPS)
        }

        // 渲染时间监控
        const measureRenderTime = () => {
            renderStartRef.current = performance.now()

            // 使用 setTimeout 来测量渲染完成时间
            setTimeout(() => {
                const renderTime = performance.now() - renderStartRef.current
                setMetrics(prev => ({
                    ...prev,
                    renderTime
                }))
            }, 0)
        }

        measureFPS()
        measureRenderTime()

        return () => {
            if (animationId) {
                cancelAnimationFrame(animationId)
            }
        }
    }, [enabled, onMetricsUpdate])

    // 性能警告检查
    const getPerformanceStatus = () => {
        if (metrics.fps < 30) return { status: 'poor', color: 'text-red-500' }
        if (metrics.fps < 50) return { status: 'fair', color: 'text-yellow-500' }
        return { status: 'good', color: 'text-green-500' }
    }

    const performanceStatus = getPerformanceStatus()

    if (!enabled || !showOverlay) return null

    return (
        <div className="fixed top-4 right-4 z-50 bg-black/80 text-white p-3 rounded-lg text-xs font-mono backdrop-blur-sm">
            <div className="space-y-1">
                <div className="flex justify-between gap-4">
                    <span>FPS:</span>
                    <span className={performanceStatus.color}>{metrics.fps}</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span>渲染时间:</span>
                    <span>{metrics.renderTime.toFixed(2)}ms</span>
                </div>
                {metrics.memoryUsage && metrics.memoryUsage > 0 && (
                    <div className="flex justify-between gap-4">
                        <span>内存:</span>
                        <span>{metrics.memoryUsage.toFixed(1)}MB</span>
                    </div>
                )}
                <div className="flex justify-between gap-4">
                    <span>加载时间:</span>
                    <span>{metrics.loadTime.toFixed(0)}ms</span>
                </div>
                <div className="border-t border-white/20 pt-1 mt-2">
                    <span className={`text-xs ${performanceStatus.color}`}>
                        {performanceStatus.status === 'good' && '性能良好'}
                        {performanceStatus.status === 'fair' && '性能一般'}
                        {performanceStatus.status === 'poor' && '性能较差'}
                    </span>
                </div>
            </div>
        </div>
    )
}

// 性能监控 Hook
export const usePerformanceMonitor = (enabled = false) => {
    const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
    const [isSlowRender, setIsSlowRender] = useState(false)

    useEffect(() => {
        if (!enabled) return

        const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries()
            entries.forEach((entry) => {
                if (entry.entryType === 'measure') {
                    const renderTime = entry.duration
                    setIsSlowRender(renderTime > 16) // 超过16ms认为是慢渲染
                }
            })
        })

        observer.observe({ entryTypes: ['measure'] })

        return () => observer.disconnect()
    }, [enabled])

    const markRenderStart = (name: string) => {
        if (enabled) {
            performance.mark(`${name}-start`)
        }
    }

    const markRenderEnd = (name: string) => {
        if (enabled) {
            performance.mark(`${name}-end`)
            performance.measure(name, `${name}-start`, `${name}-end`)
        }
    }

    return {
        metrics,
        isSlowRender,
        markRenderStart,
        markRenderEnd,
        setMetrics
    }
}

export default PerformanceMonitor
