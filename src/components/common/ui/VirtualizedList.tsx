'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'

interface VirtualizedListProps<T> {
    items: T[]
    itemHeight: number
    containerHeight: number
    renderItem: (item: T, index: number, isVisible: boolean) => React.ReactNode
    className?: string
    overscan?: number // 预渲染的额外项目数量
    onScroll?: (scrollTop: number) => void
    // 性能优化选项
    enableSmoothScrolling?: boolean
    bufferSize?: number
    // 动态高度支持
    estimatedItemHeight?: number
    getItemHeight?: (index: number) => number
}

function VirtualizedList<T>({
    items,
    itemHeight,
    containerHeight,
    renderItem,
    className,
    overscan = 5,
    onScroll,
    enableSmoothScrolling = true,
    bufferSize = 10,
    estimatedItemHeight,
    getItemHeight
}: VirtualizedListProps<T>) {
    const [scrollTop, setScrollTop] = useState(0)
    const [isScrolling, setIsScrolling] = useState(false)
    const scrollElementRef = useRef<HTMLDivElement>(null)
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // 计算可见范围
    const visibleRange = useMemo(() => {
        const containerScrollTop = scrollTop
        const containerScrollBottom = containerScrollTop + containerHeight

        // 使用动态高度或固定高度
        const actualItemHeight = estimatedItemHeight || itemHeight
        
        const startIndex = Math.max(
            0,
            Math.floor(containerScrollTop / actualItemHeight) - overscan
        )
        
        const endIndex = Math.min(
            items.length - 1,
            Math.ceil(containerScrollBottom / actualItemHeight) + overscan
        )

        return { startIndex, endIndex }
    }, [scrollTop, containerHeight, itemHeight, estimatedItemHeight, overscan, items.length])

    // 计算总高度
    const totalHeight = useMemo(() => {
        if (getItemHeight) {
            return items.reduce((total, _, index) => total + getItemHeight(index), 0)
        }
        return items.length * (estimatedItemHeight || itemHeight)
    }, [items.length, itemHeight, estimatedItemHeight, getItemHeight])

    // 计算偏移量
    const offsetY = useMemo(() => {
        if (getItemHeight) {
            let offset = 0
            for (let i = 0; i < visibleRange.startIndex; i++) {
                offset += getItemHeight(i)
            }
            return offset
        }
        return visibleRange.startIndex * (estimatedItemHeight || itemHeight)
    }, [visibleRange.startIndex, itemHeight, estimatedItemHeight, getItemHeight])

    // 获取可见项目
    const visibleItems = useMemo(() => {
        return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1)
    }, [items, visibleRange.startIndex, visibleRange.endIndex])

    // 滚动处理
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const scrollTop = e.currentTarget.scrollTop
        setScrollTop(scrollTop)
        setIsScrolling(true)
        onScroll?.(scrollTop)

        // 清除之前的超时
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current)
        }

        // 设置新的超时来检测滚动结束
        scrollTimeoutRef.current = setTimeout(() => {
            setIsScrolling(false)
        }, 150)
    }, [onScroll])

    // 清理超时
    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current)
            }
        }
    }, [])

    // 滚动到指定项目
    const _scrollToItem = useCallback((index: number, align: 'start' | 'center' | 'end' = 'start') => {
        if (!scrollElementRef.current) return

        let targetScrollTop: number

        if (getItemHeight) {
            let offset = 0
            for (let i = 0; i < index; i++) {
                offset += getItemHeight(i)
            }
            targetScrollTop = offset
        } else {
            targetScrollTop = index * (estimatedItemHeight || itemHeight)
        }

        // 根据对齐方式调整
        if (align === 'center') {
            targetScrollTop -= containerHeight / 2
        } else if (align === 'end') {
            targetScrollTop -= containerHeight - (estimatedItemHeight || itemHeight)
        }

        targetScrollTop = Math.max(0, Math.min(targetScrollTop, totalHeight - containerHeight))

        if (enableSmoothScrolling) {
            scrollElementRef.current.scrollTo({
                top: targetScrollTop,
                behavior: 'smooth'
            })
        } else {
            scrollElementRef.current.scrollTop = targetScrollTop
        }
    }, [containerHeight, itemHeight, estimatedItemHeight, totalHeight, enableSmoothScrolling, getItemHeight])

    return (
        <div
            ref={scrollElementRef}
            className={cn(
                'overflow-auto',
                enableSmoothScrolling && 'scroll-smooth',
                className
            )}
            style={{ height: containerHeight }}
            onScroll={handleScroll}
        >
            {/* 总容器，用于维持滚动条的正确高度 */}
            <div style={{ height: totalHeight, position: 'relative' }}>
                {/* 可见项目容器 */}
                <div
                    style={{
                        transform: `translateY(${offsetY}px)`,
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                    }}
                >
                    {visibleItems.map((item, index) => {
                        const actualIndex = visibleRange.startIndex + index
                        const isVisible = !isScrolling || index < bufferSize
                        
                        return (
                            <div
                                key={actualIndex}
                                style={{
                                    height: getItemHeight ? getItemHeight(actualIndex) : (estimatedItemHeight || itemHeight),
                                    overflow: 'hidden'
                                }}
                            >
                                {renderItem(item, actualIndex, isVisible)}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

// 导出组件和相关类型
export default VirtualizedList
export type { VirtualizedListProps }
