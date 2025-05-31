'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface OptimizedImageProps {
    src: string
    alt: string
    width?: number
    height?: number
    className?: string
    priority?: boolean
    sizes?: string
    onLoad?: () => void
    onError?: () => void
    placeholder?: 'blur' | 'empty'
    blurDataURL?: string
    // 新增性能优化属性
    lazy?: boolean
    preload?: boolean
    quality?: number
    // 响应式图片支持
    responsive?: boolean
    aspectRatio?: string
    // 渐进式加载
    _progressive?: boolean
    // 错误回退
    fallbackSrc?: string
    // 加载状态
    showLoadingState?: boolean
    loadingClassName?: string
    errorClassName?: string
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
    src,
    alt,
    width = 80,
    height = 80,
    className,
    priority = false,
    sizes = '80px',
    onLoad,
    onError,
    placeholder = 'empty',
    blurDataURL,
    lazy = true,
    preload = false,
    quality = 75,
    responsive = false,
    aspectRatio,
    _progressive = true,
    fallbackSrc,
    showLoadingState = true,
    loadingClassName = 'animate-pulse bg-neutral-200 dark:bg-neutral-700',
    errorClassName = 'bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-xs text-neutral-500'
}) => {
    const [isLoading, setIsLoading] = useState(true)
    const [hasError, setHasError] = useState(false)
    const [currentSrc, setCurrentSrc] = useState(src)
    const [isInView, setIsInView] = useState(!lazy || priority)
    const imgRef = useRef<HTMLDivElement>(null)

    // Intersection Observer for lazy loading
    useEffect(() => {
        if (!lazy || priority || isInView || typeof window === 'undefined') return

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setIsInView(true)
                        observer.disconnect()
                    }
                })
            },
            {
                rootMargin: '50px', // 提前50px开始加载
                threshold: 0.1
            }
        )

        if (imgRef.current) {
            observer.observe(imgRef.current)
        }

        return () => observer.disconnect()
    }, [lazy, priority, isInView])

    // 预加载逻辑
    useEffect(() => {
        if (preload && src && typeof window !== 'undefined') {
            const link = document.createElement('link')
            link.rel = 'preload'
            link.as = 'image'
            link.href = src
            document.head.appendChild(link)

            return () => {
                if (document.head.contains(link)) {
                    document.head.removeChild(link)
                }
            }
        }
    }, [preload, src])

    const handleLoad = useCallback(() => {
        setIsLoading(false)
        onLoad?.()
    }, [onLoad])

    const handleError = useCallback(() => {
        setIsLoading(false)
        setHasError(true)
        
        // 尝试使用回退图片
        if (fallbackSrc && currentSrc !== fallbackSrc) {
            setCurrentSrc(fallbackSrc)
            setHasError(false)
            setIsLoading(true)
            return
        }
        
        onError?.()
    }, [onError, fallbackSrc, currentSrc])

    // 计算容器样式
    const containerStyle = responsive && aspectRatio ? {
        aspectRatio
    } : {
        width: width,
        height: height
    }

    // 如果还没有进入视口且启用了懒加载，显示占位符
    if (!isInView) {
        return (
            <div
                ref={imgRef}
                className={cn(loadingClassName, className)}
                style={containerStyle}
            />
        )
    }

    // 如果有错误且没有回退图片，显示错误状态
    if (hasError) {
        return (
            <div
                className={cn(errorClassName, className)}
                style={containerStyle}
            >
                失败
            </div>
        )
    }

    return (
        <div
            ref={imgRef}
            className={cn('relative overflow-hidden', className)}
            style={containerStyle}
        >
            {/* 加载状态 */}
            {isLoading && showLoadingState && (
                <div
                    className={cn(
                        'absolute inset-0 z-10',
                        loadingClassName
                    )}
                />
            )}

            {/* 实际图片 */}
            <Image
                src={currentSrc}
                alt={alt}
                width={responsive ? undefined : width}
                height={responsive ? undefined : height}
                fill={responsive}
                className={cn(
                    'transition-opacity duration-300',
                    isLoading ? 'opacity-0' : 'opacity-100',
                    responsive ? 'object-cover' : ''
                )}
                style={responsive ? undefined : { width: '100%', height: '100%', objectFit: 'cover' }}
                sizes={sizes}
                priority={priority}
                loading={priority ? 'eager' : 'lazy'}
                quality={quality}
                placeholder={placeholder}
                blurDataURL={blurDataURL}
                unoptimized={true} // 静态导出模式需要
                onLoad={handleLoad}
                onError={handleError}
            />
        </div>
    )
}

export default OptimizedImage
