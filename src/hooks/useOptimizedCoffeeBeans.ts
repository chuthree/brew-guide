'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { ExtendedCoffeeBean, BeanType } from '@/components/coffee-bean/List/types'
import { CoffeeBeanManager } from '@/lib/managers/coffeeBeanManager'
import { globalCache, isBeanEmpty } from '@/components/coffee-bean/List/globalCache'

interface UseOptimizedCoffeeBeansOptions {
    enableVirtualization?: boolean
    cacheTimeout?: number
    preloadImages?: boolean
    batchSize?: number
}

interface UseOptimizedCoffeeBeansReturn {
    beans: ExtendedCoffeeBean[]
    filteredBeans: ExtendedCoffeeBean[]
    isLoading: boolean
    isFirstLoad: boolean
    error: Error | null
    // 过滤和排序
    selectedVariety: string | null
    selectedBeanType: BeanType
    showEmptyBeans: boolean
    availableVarieties: string[]
    // 操作方法
    setSelectedVariety: (variety: string | null) => void
    setSelectedBeanType: (type: BeanType) => void
    setShowEmptyBeans: (show: boolean) => void
    refreshBeans: () => Promise<void>
    // 性能优化方法
    preloadBeanImages: () => void
    clearCache: () => void
}

export function useOptimizedCoffeeBeans(
    options: UseOptimizedCoffeeBeansOptions = {}
): UseOptimizedCoffeeBeansReturn {
    const {
        enableVirtualization: _enableVirtualization = true,
        cacheTimeout = 10 * 60 * 1000, // 10分钟
        preloadImages = true,
        batchSize = 20
    } = options

    // 状态管理
    const [beans, setBeans] = useState<ExtendedCoffeeBean[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isFirstLoad, setIsFirstLoad] = useState(true)
    const [error, setError] = useState<Error | null>(null)
    
    // 过滤状态
    const [selectedVariety, setSelectedVariety] = useState<string | null>(globalCache.selectedVariety)
    const [selectedBeanType, setSelectedBeanType] = useState<BeanType>(globalCache.selectedBeanType)
    const [showEmptyBeans, setShowEmptyBeans] = useState(globalCache.showEmptyBeans)

    // 性能优化相关
    const loadingRef = useRef(false)
    const cacheTimestampRef = useRef<number>(0)
    const imagePreloadRef = useRef<Set<string>>(new Set())

    // 计算过滤后的咖啡豆
    const filteredBeans = useMemo(() => {
        let filtered = beans

        // 根据是否显示空豆子过滤
        if (!showEmptyBeans) {
            filtered = filtered.filter(bean => !isBeanEmpty(bean))
        }

        // 根据豆子类型过滤
        if (selectedBeanType !== 'all') {
            filtered = filtered.filter(bean => bean.beanType === selectedBeanType)
        }

        // 根据品种过滤
        if (selectedVariety) {
            filtered = filtered.filter(bean => bean.variety === selectedVariety)
        }

        // 过滤掉在途状态的咖啡豆
        filtered = filtered.filter(bean => !bean.isInTransit)

        return filtered
    }, [beans, selectedVariety, selectedBeanType, showEmptyBeans])

    // 计算可用品种
    const availableVarieties = useMemo(() => {
        const varieties = new Set<string>()
        beans.forEach(bean => {
            if (bean.variety && !bean.isInTransit) {
                varieties.add(bean.variety)
            }
        })
        return Array.from(varieties).sort()
    }, [beans])

    // 图片预加载函数
    const preloadBeanImages = useCallback(() => {
        if (!preloadImages) return

        const imagesToPreload = filteredBeans
            .slice(0, batchSize)
            .map(bean => bean.image)
            .filter((image): image is string => !!image && !imagePreloadRef.current.has(image))

        imagesToPreload.forEach(imageUrl => {
            if (imagePreloadRef.current.has(imageUrl)) return

            const img = new Image()
            img.src = imageUrl
            img.onload = () => {
                imagePreloadRef.current.add(imageUrl)
            }
            img.onerror = () => {
                console.warn(`Failed to preload image: ${imageUrl}`)
            }
        })
    }, [filteredBeans, batchSize, preloadImages])

    // 加载咖啡豆数据
    const loadBeans = useCallback(async (forceRefresh = false) => {
        if (loadingRef.current) return
        
        // 检查缓存是否有效
        const now = Date.now()
        const cacheValid = !forceRefresh && 
            globalCache.initialized && 
            globalCache.beans.length > 0 && 
            (now - cacheTimestampRef.current) < cacheTimeout

        if (cacheValid) {
            setBeans(globalCache.beans)
            setIsFirstLoad(false)
            return
        }

        try {
            loadingRef.current = true
            setIsLoading(true)
            setError(null)

            const loadedBeans = await CoffeeBeanManager.getAllBeans() as ExtendedCoffeeBean[]

            // 更新缓存
            globalCache.beans = loadedBeans
            globalCache.initialized = true
            cacheTimestampRef.current = now

            setBeans(loadedBeans)
            setIsFirstLoad(false)
        } catch (err) {
            const error = err instanceof Error ? err : new Error('加载咖啡豆数据失败')
            setError(error)
            console.error('加载咖啡豆数据失败:', error)
        } finally {
            setIsLoading(false)
            loadingRef.current = false
        }
    }, [cacheTimeout])

    // 刷新数据
    const refreshBeans = useCallback(() => {
        return loadBeans(true)
    }, [loadBeans])

    // 清除缓存
    const clearCache = useCallback(() => {
        globalCache.beans = []
        globalCache.initialized = false
        cacheTimestampRef.current = 0
        imagePreloadRef.current.clear()
        CoffeeBeanManager.clearCache()
    }, [])

    // 更新全局缓存中的过滤状态
    useEffect(() => {
        globalCache.selectedVariety = selectedVariety
        globalCache.selectedBeanType = selectedBeanType
        globalCache.showEmptyBeans = showEmptyBeans
    }, [selectedVariety, selectedBeanType, showEmptyBeans])

    // 初始加载
    useEffect(() => {
        loadBeans()
    }, [loadBeans])

    // 预加载图片
    useEffect(() => {
        if (filteredBeans.length > 0) {
            // 延迟预加载，避免阻塞主线程
            const timeoutId = setTimeout(preloadBeanImages, 100)
            return () => clearTimeout(timeoutId)
        }
    }, [filteredBeans, preloadBeanImages])

    return {
        beans,
        filteredBeans,
        isLoading,
        isFirstLoad,
        error,
        selectedVariety,
        selectedBeanType,
        showEmptyBeans,
        availableVarieties,
        setSelectedVariety,
        setSelectedBeanType,
        setShowEmptyBeans,
        refreshBeans,
        preloadBeanImages,
        clearCache
    }
}
