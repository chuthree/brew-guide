'use client'

interface CacheEntry<T> {
    data: T
    timestamp: number
    expiresAt: number
    accessCount: number
    lastAccessed: number
}

interface CacheOptions {
    maxSize?: number
    defaultTTL?: number // Time to live in milliseconds
    enableLRU?: boolean // Least Recently Used eviction
    enableCompression?: boolean
    onEvict?: (key: string, data: any) => void
}

class OptimizedCache<T = any> {
    private cache = new Map<string, CacheEntry<T>>()
    private accessOrder: string[] = []
    private options: Required<CacheOptions>

    constructor(options: CacheOptions = {}) {
        this.options = {
            maxSize: options.maxSize || 100,
            defaultTTL: options.defaultTTL || 5 * 60 * 1000, // 5 minutes
            enableLRU: options.enableLRU ?? true,
            enableCompression: options.enableCompression ?? false,
            onEvict: options.onEvict || (() => {})
        }
    }

    set(key: string, data: T, ttl?: number): void {
        const now = Date.now()
        const expiresAt = now + (ttl || this.options.defaultTTL)

        // 如果缓存已满，执行清理
        if (this.cache.size >= this.options.maxSize) {
            this.evictOldest()
        }

        // 压缩数据（如果启用）
        const processedData = this.options.enableCompression ? this.compress(data) : data

        const entry: CacheEntry<T> = {
            data: processedData,
            timestamp: now,
            expiresAt,
            accessCount: 0,
            lastAccessed: now
        }

        this.cache.set(key, entry)
        
        // 更新访问顺序
        if (this.options.enableLRU) {
            this.updateAccessOrder(key)
        }
    }

    get(key: string): T | null {
        const entry = this.cache.get(key)
        
        if (!entry) {
            return null
        }

        const now = Date.now()

        // 检查是否过期
        if (now > entry.expiresAt) {
            this.delete(key)
            return null
        }

        // 更新访问信息
        entry.accessCount++
        entry.lastAccessed = now

        // 更新LRU顺序
        if (this.options.enableLRU) {
            this.updateAccessOrder(key)
        }

        // 解压缩数据（如果启用了压缩）
        return this.options.enableCompression ? this.decompress(entry.data) : entry.data
    }

    has(key: string): boolean {
        const entry = this.cache.get(key)
        if (!entry) return false

        // 检查是否过期
        if (Date.now() > entry.expiresAt) {
            this.delete(key)
            return false
        }

        return true
    }

    delete(key: string): boolean {
        const entry = this.cache.get(key)
        if (entry) {
            this.options.onEvict(key, entry.data)
        }

        // 从访问顺序中移除
        const index = this.accessOrder.indexOf(key)
        if (index > -1) {
            this.accessOrder.splice(index, 1)
        }

        return this.cache.delete(key)
    }

    clear(): void {
        // 触发所有项目的evict回调
        this.cache.forEach((entry, key) => {
            this.options.onEvict(key, entry.data)
        })

        this.cache.clear()
        this.accessOrder = []
    }

    // 获取缓存统计信息
    getStats() {
        const now = Date.now()
        let expiredCount = 0
        let totalAccessCount = 0

        this.cache.forEach((entry) => {
            if (now > entry.expiresAt) {
                expiredCount++
            }
            totalAccessCount += entry.accessCount
        })

        return {
            size: this.cache.size,
            maxSize: this.options.maxSize,
            expiredCount,
            totalAccessCount,
            hitRate: totalAccessCount > 0 ? (this.cache.size / totalAccessCount) : 0,
            memoryUsage: this.estimateMemoryUsage()
        }
    }

    // 清理过期项目
    cleanup(): number {
        const now = Date.now()
        let cleanedCount = 0
        const keysToDelete: string[] = []

        this.cache.forEach((entry, key) => {
            if (now > entry.expiresAt) {
                keysToDelete.push(key)
            }
        })

        keysToDelete.forEach(key => {
            this.delete(key)
            cleanedCount++
        })

        return cleanedCount
    }

    // 预热缓存
    async warmup(keys: string[], dataLoader: (key: string) => Promise<T>): Promise<void> {
        const promises = keys.map(async (key) => {
            if (!this.has(key)) {
                try {
                    const data = await dataLoader(key)
                    this.set(key, data)
                } catch (error) {
                    console.warn(`Failed to warmup cache for key: ${key}`, error)
                }
            }
        })

        await Promise.all(promises)
    }

    private updateAccessOrder(key: string): void {
        // 移除旧位置
        const index = this.accessOrder.indexOf(key)
        if (index > -1) {
            this.accessOrder.splice(index, 1)
        }
        
        // 添加到末尾（最近访问）
        this.accessOrder.push(key)
    }

    private evictOldest(): void {
        if (this.options.enableLRU && this.accessOrder.length > 0) {
            // LRU: 移除最少使用的
            const oldestKey = this.accessOrder[0]
            this.delete(oldestKey)
        } else {
            // 移除最早添加的
            const firstKey = this.cache.keys().next().value
            if (firstKey) {
                this.delete(firstKey)
            }
        }
    }

    private compress(_data: T): T {
        // 简单的压缩实现（实际项目中可以使用更复杂的压缩算法）
        if (typeof _data === 'string') {
            return _data as T // 可以在这里实现字符串压缩
        }
        return _data
    }

    private decompress(_data: T): T {
        // 对应的解压缩实现
        return _data
    }

    private estimateMemoryUsage(): number {
        // 估算内存使用量（字节）
        let size = 0
        this.cache.forEach((entry, key) => {
            size += key.length * 2 // 字符串按2字节计算
            size += JSON.stringify(entry).length * 2
        })
        return size
    }
}

// 创建全局缓存实例
export const globalImageCache = new OptimizedCache<string>({
    maxSize: 50,
    defaultTTL: 30 * 60 * 1000, // 30分钟
    enableLRU: true,
    onEvict: (key, _data) => {
        console.log(`Image cache evicted: ${key}`)
    }
})

export const globalDataCache = new OptimizedCache<any>({
    maxSize: 100,
    defaultTTL: 10 * 60 * 1000, // 10分钟
    enableLRU: true,
    onEvict: (key, _data) => {
        console.log(`Data cache evicted: ${key}`)
    }
})

export default OptimizedCache
