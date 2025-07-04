'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { CoffeeBean } from '@/types/app'

// 简单的全局缓存，避免重复加载
const globalBeanCache = {
    beans: [] as CoffeeBean[],
    initialized: false,
    isLoading: false,
    lastUpdated: 0
}

// 缓存有效期（5分钟）
const CACHE_DURATION = 5 * 60 * 1000

/**
 * 冲煮界面专用的咖啡豆数据Hook
 * 提供优化的数据加载和缓存机制
 */
export const useCoffeeBeanData = () => {
    const [beans, setBeans] = useState<CoffeeBean[]>(globalBeanCache.beans)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const isLoadingRef = useRef(false)

    // 检查缓存是否有效
    const isCacheValid = useCallback(() => {
        const now = Date.now()
        return globalBeanCache.initialized && 
               globalBeanCache.beans.length > 0 && 
               (now - globalBeanCache.lastUpdated) < CACHE_DURATION
    }, [])

    // 加载咖啡豆数据
    const loadBeans = useCallback(async (forceReload = false) => {
        // 防止重复加载
        if (isLoadingRef.current) return

        try {
            // 如果缓存有效且不强制重新加载，使用缓存数据
            if (!forceReload && isCacheValid()) {
                setBeans(globalBeanCache.beans)
                return
            }

            isLoadingRef.current = true
            setIsLoading(true)
            setError(null)

            // 动态导入CoffeeBeanManager
            const { CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager')
            
            // 如果强制重新加载，清除CoffeeBeanManager的缓存
            if (forceReload) {
                CoffeeBeanManager.clearCache()
            }

            const loadedBeans = await CoffeeBeanManager.getAllBeans()

            // 更新全局缓存
            globalBeanCache.beans = loadedBeans
            globalBeanCache.initialized = true
            globalBeanCache.isLoading = false
            globalBeanCache.lastUpdated = Date.now()

            setBeans(loadedBeans)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '加载咖啡豆数据失败'
            setError(errorMessage)
            console.error('加载咖啡豆数据失败:', err)
        } finally {
            isLoadingRef.current = false
            setIsLoading(false)
        }
    }, [isCacheValid])

    // 根据ID查找咖啡豆
    const findBeanById = useCallback((id: string): CoffeeBean | null => {
        return beans.find(bean => bean.id === id) || null
    }, [beans])

    // 根据名称查找咖啡豆
    const findBeanByName = useCallback((name: string): CoffeeBean | null => {
        return beans.find(bean => bean.name === name) || null
    }, [beans])

    // 获取可用的咖啡豆（过滤掉用完的和在途的）
    const getAvailableBeans = useCallback(() => {
        return beans.filter(bean => {
            // 过滤掉在途状态的咖啡豆
            if (bean.isInTransit) {
                return false
            }

            // 如果没有设置容量，则直接显示
            if (!bean.capacity || bean.capacity === '0' || bean.capacity === '0g') {
                return true
            }

            // 考虑remaining可能是字符串或者数字
            const remaining = typeof bean.remaining === 'string'
                ? parseFloat(bean.remaining)
                : Number(bean.remaining)

            // 只过滤掉有容量设置且剩余量为0的咖啡豆
            return remaining > 0
        })
    }, [beans])

    // 监听咖啡豆数据更新事件
    useEffect(() => {
        const handleCoffeeBeanDataChanged = () => {
            // 数据变更时强制重新加载
            loadBeans(true)
        }

        // 监听全局咖啡豆数据变更事件
        if (typeof window !== 'undefined') {
            window.addEventListener('coffeeBeanDataChanged', handleCoffeeBeanDataChanged)
            
            return () => {
                window.removeEventListener('coffeeBeanDataChanged', handleCoffeeBeanDataChanged)
            }
        }
    }, [loadBeans])

    // 初始化时加载数据
    useEffect(() => {
        loadBeans()
    }, [loadBeans])

    return {
        beans,
        isLoading,
        error,
        loadBeans,
        findBeanById,
        findBeanByName,
        getAvailableBeans,
        // 提供一些有用的计算属性
        totalBeans: beans.length,
        availableBeans: getAvailableBeans(),
        isCacheValid: isCacheValid()
    }
}

/**
 * 清除全局缓存（用于测试或特殊情况）
 */
export const clearGlobalBeanCache = () => {
    globalBeanCache.beans = []
    globalBeanCache.initialized = false
    globalBeanCache.isLoading = false
    globalBeanCache.lastUpdated = 0
}
