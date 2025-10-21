/**
 * 同步相关的工具函数
 */

import type { FileMetadata } from './types'

/**
 * 计算字符串或 ArrayBuffer 的 SHA-256 哈希值
 */
export async function calculateHash(data: string | ArrayBuffer): Promise<string> {
    try {
        const buffer = typeof data === 'string'
            ? new TextEncoder().encode(data)
            : new Uint8Array(data)

        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } catch (error) {
        console.error('计算哈希失败:', error)
        // 返回一个基于内容长度和时间戳的后备值
        return `fallback-${data.toString().length}-${Date.now()}`
    }
}

/**
 * 为本地数据创建文件元数据
 * 这里解决了原来的 bug：不再包含动态的 exportDate
 */
export async function createFileMetadata(
    key: string,
    content: string,
    mtimeCli?: number
): Promise<FileMetadata> {
    const hash = await calculateHash(content)
    const size = new TextEncoder().encode(content).length

    return {
        key,
        size,
        mtimeCli: mtimeCli || Date.now(),
        hash,
        syncedAt: Date.now()
    }
}

/**
 * 从导出的数据对象创建文件元数据映射
 * 关键修复：排除动态字段（exportDate, timestamp 等）后再计算哈希
 */
export async function createFilesMetadataFromData(
    dataMap: Record<string, unknown>
): Promise<Record<string, FileMetadata>> {
    const filesMetadata: Record<string, FileMetadata> = {}

    for (const [key, value] of Object.entries(dataMap)) {
        try {
            // 如果是完整的导出对象，只取 data 字段计算哈希
            let dataForHash = value
            
            if (
                typeof value === 'object' && 
                value !== null && 
                'data' in value &&
                'exportDate' in value
            ) {
                // 这是完整的导出格式，只使用 data 字段
                dataForHash = (value as { data: unknown }).data
            }

            // 规范化数据以获得稳定的哈希值
            const normalizedData = normalizeDataForHash(dataForHash)
            const content = JSON.stringify(normalizedData)
            
            filesMetadata[key] = await createFileMetadata(key, content)
        } catch (error) {
            console.error(`创建文件 ${key} 的元数据失败:`, error)
        }
    }

    return filesMetadata
}

/**
 * 规范化数据以获得稳定的哈希值
 * 关键：移除所有动态时间戳、排序键名
 */
export function normalizeDataForHash(data: unknown): unknown {
    if (data === null || data === undefined) {
        return data
    }

    if (typeof data !== 'object') {
        return data
    }

    if (Array.isArray(data)) {
        return data.map(item => normalizeDataForHash(item))
    }

    // 对象类型
    const obj = data as Record<string, unknown>
    const normalized: Record<string, unknown> = {}

    // 需要排除的动态字段
    const excludeFields = new Set([
        'exportDate',
        'timestamp',
        'lastModified',
        'syncedAt',
        'lastSyncTime',
        '_timestamp', // 任何以 _ 开头的时间戳字段
        'updatedAt',
        'createdAt'
    ])

    // 获取所有键并排序
    const keys = Object.keys(obj)
        .filter(key => !excludeFields.has(key))
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

    // 递归规范化每个值
    for (const key of keys) {
        normalized[key] = normalizeDataForHash(obj[key])
    }

    return normalized
}

/**
 * 比较两个文件元数据是否相同
 */
export function areFilesEqual(file1: FileMetadata, file2: FileMetadata): boolean {
    // 优先比较哈希值
    if (file1.hash && file2.hash && file1.hash !== '' && file2.hash !== '') {
        return file1.hash === file2.hash
    }

    // 后备：比较大小和修改时间
    return file1.size === file2.size && file1.mtimeCli === file2.mtimeCli
}

/**
 * 生成设备指纹 ID
 */
export async function generateDeviceId(): Promise<string> {
    try {
        // 尝试从多个来源收集设备特征
        const features: string[] = [
            navigator.userAgent,
            navigator.language,
            screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
            new Date().getTimezoneOffset().toString(),
            navigator.hardwareConcurrency?.toString() || '',
            navigator.maxTouchPoints?.toString() || ''
        ]

        // 如果支持 Canvas 指纹
        try {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            if (ctx) {
                ctx.textBaseline = 'top'
                ctx.font = '14px Arial'
                ctx.fillStyle = '#f60'
                ctx.fillRect(0, 0, 100, 20)
                ctx.fillStyle = '#069'
                ctx.fillText('Device fingerprint', 2, 2)
                features.push(canvas.toDataURL())
            }
        } catch {
            // Canvas 指纹可能被阻止
        }

        const fingerprint = features.join('|')
        const hash = await calculateHash(fingerprint)
        
        return `device-${hash.substring(0, 16)}`
    } catch (error) {
        console.error('生成设备 ID 失败:', error)
        // 后备方案：随机 ID
        return `device-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`
    }
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

/**
 * 格式化时间差
 */
export function formatTimeDiff(timestamp: number): string {
    const now = Date.now()
    const diff = now - timestamp
    
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (days > 0) return `${days} 天前`
    if (hours > 0) return `${hours} 小时前`
    if (minutes > 0) return `${minutes} 分钟前`
    if (seconds > 0) return `${seconds} 秒前`
    return '刚刚'
}

/**
 * 安全的 JSON 解析
 */
export function safeJsonParse<T = unknown>(
    text: string,
    fallback: T
): T {
    try {
        return JSON.parse(text) as T
    } catch {
        return fallback
    }
}

/**
 * 深度克隆对象
 */
export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj
    }

    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item)) as unknown as T
    }

    const cloned: Record<string, unknown> = {}
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            cloned[key] = deepClone(obj[key])
        }
    }

    return cloned as T
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null

    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            timeout = null
            func(...args)
        }

        if (timeout) {
            clearTimeout(timeout)
        }
        timeout = setTimeout(later, wait)
    }
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean = false

    return function executedFunction(...args: Parameters<T>) {
        if (!inThrottle) {
            func(...args)
            inThrottle = true
            setTimeout(() => {
                inThrottle = false
            }, limit)
        }
    }
}
