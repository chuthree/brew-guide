/**
 * WebDAV同步管理器
 * 处理IndexedDB与WebDAV服务器之间的数据同步
 */

import SimpleWebDAVClient, { SimpleWebDAVConfig } from './simpleWebdavClient'
import { Storage } from '@/lib/core/storage'

export interface SyncResult {
    success: boolean
    message: string
    uploadedFiles: number
    downloadedFiles: number
    errors: string[]
}

export interface SyncMetadata {
    lastSyncTime: number
    version: string
    deviceId: string
}

export class WebDAVSyncManager {
    private client: SimpleWebDAVClient | null = null
    private config: SimpleWebDAVConfig | null = null
    private syncInProgress = false

    /**
     * 初始化同步管理器
     */
    async initialize(config: SimpleWebDAVConfig): Promise<boolean> {
        try {
            this.config = config
            this.client = new SimpleWebDAVClient(config)

            // 测试连接
            const connected = await this.client.testConnection()
            if (!connected) {
                throw new Error('无法连接到WebDAV服务器')
            }

            // 确保远程目录存在
            await this.client.createDirectory(config.remotePath)

            return true
        } catch (_error) {
            console.error('WebDAV同步管理器初始化失败:', _error)
            return false
        }
    }

    /**
     * 执行数据同步
     */
    async sync(): Promise<SyncResult> {
        if (this.syncInProgress) {
            return {
                success: false,
                message: '同步正在进行中',
                uploadedFiles: 0,
                downloadedFiles: 0,
                errors: ['同步正在进行中，请稍后再试']
            }
        }

        if (!this.client || !this.config) {
            return {
                success: false,
                message: '同步管理器未初始化',
                uploadedFiles: 0,
                downloadedFiles: 0,
                errors: ['WebDAV同步管理器未正确初始化']
            }
        }

        this.syncInProgress = true
        const result: SyncResult = {
            success: false,
            message: '',
            uploadedFiles: 0,
            downloadedFiles: 0,
            errors: []
        }

        try {
            // 1. 获取本地数据
            const localData = await this.getLocalData()

            // 2. 获取远程元数据
            const remoteMetadata = await this.getRemoteMetadata()
            const localMetadata = await this.getLocalMetadata()

            // 3. 决定同步方向
            const shouldUpload = this.shouldUploadData(localMetadata, remoteMetadata)

            if (shouldUpload) {
                // 上传本地数据到服务器
                await this.uploadData(localData, result)
            } else {
                // 从服务器下载数据
                await this.downloadData(result)
            }

            // 4. 更新同步元数据
            await this.updateSyncMetadata()

            result.success = result.errors.length === 0
            result.message = result.success
                ? `同步完成：上传 ${result.uploadedFiles} 个文件，下载 ${result.downloadedFiles} 个文件`
                : `同步部分完成，遇到 ${result.errors.length} 个错误`

        } catch (_error) {
            result.errors.push(`同步失败: ${_error instanceof Error ? _error.message : '未知错误'}`)
            result.message = '同步失败'
        } finally {
            this.syncInProgress = false
        }

        return result
    }

    /**
     * 获取本地存储的所有数据
     */
    private async getLocalData(): Promise<Record<string, unknown>> {
        const data: Record<string, unknown> = {}

        try {
            // 获取存储的keys，这些应该与你的应用数据结构匹配
            const keys = [
                'brewGuideSettings',
                'coffeeBeansData',
                'brewHistoryData',
                'userPreferences',
                'customGrinders',
                'grinderSettings',
                'timerSettings',
                'brewingMethods'
            ]

            for (const key of keys) {
                const value = await Storage.get(key)
                if (value !== null) {
                    try {
                        data[key] = JSON.parse(value)
                    } catch {
                        data[key] = value
                    }
                }
            }

        } catch (_error) {
            console.error('获取本地数据失败:', _error)
        }

        return data
    }

    /**
     * 上传数据到WebDAV服务器
     */
    private async uploadData(localData: Record<string, unknown>, result: SyncResult): Promise<void> {
        if (!this.client || !this.config) return

        // 上传每个数据文件
        for (const [key, value] of Object.entries(localData)) {
            try {
                const filename = `${key}.json`
                const remotePath = `${this.config.remotePath}${filename}`
                const content = JSON.stringify(value, null, 2)

                const success = await this.client.uploadFile(remotePath, content)
                if (success) {
                    result.uploadedFiles++
                } else {
                    result.errors.push(`上传 ${filename} 失败`)
                }
            } catch (_error) {
                result.errors.push(`上传 ${key} 时出错: ${_error instanceof Error ? _error.message : '未知错误'}`)
            }
        }

        // 上传设备信息
        try {
            const deviceInfo = {
                deviceId: await this.getDeviceId(),
                lastSync: Date.now(),
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString()
            }

            const devicePath = `${this.config.remotePath}device-info.json`
            await this.client.uploadFile(devicePath, JSON.stringify(deviceInfo, null, 2))
        } catch (_error) {
            console.warn('上传设备信息失败:', _error)
        }
    }

    /**
     * 从WebDAV服务器下载数据
     */
    private async downloadData(result: SyncResult): Promise<void> {
        if (!this.client || !this.config) return

        try {
            // 列出远程文件
            const files = await this.client.listDirectory(this.config.remotePath)
            const dataFiles = files.filter(file =>
                !file.isDirectory &&
                file.name.endsWith('.json') &&
                file.name !== 'sync-metadata.json' &&
                file.name !== 'device-info.json'
            )

            // 下载每个数据文件
            for (const file of dataFiles) {
                try {
                    const content = await this.client.downloadFile(file.path)
                    if (content) {
                        const key = file.name.replace('.json', '')
                        const data = JSON.parse(content)

                        // 保存到本地存储
                        await Storage.set(key, JSON.stringify(data))

                        result.downloadedFiles++
                    } else {
                        result.errors.push(`下载 ${file.name} 失败`)
                    }
                } catch (_error) {
                    result.errors.push(`处理 ${file.name} 时出错: ${_error instanceof Error ? _error.message : '未知错误'}`)
                }
            }

            // 触发存储更新事件
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('storageChange', {
                    detail: { key: 'webdav-sync-complete' }
                }))
            }

        } catch (_error) {
            result.errors.push(`下载数据失败: ${_error instanceof Error ? _error.message : '未知错误'}`)
        }
    }

    /**
     * 获取远程同步元数据
     */
    private async getRemoteMetadata(): Promise<SyncMetadata | null> {
        if (!this.client || !this.config) return null

        try {
            const metadataPath = `${this.config.remotePath}sync-metadata.json`
            const content = await this.client.downloadFile(metadataPath)

            if (content) {
                return JSON.parse(content) as SyncMetadata
            }
        } catch (_error) {
            console.warn('获取远程元数据失败:', _error)
        }

        return null
    }

    /**
     * 获取本地同步元数据
     */
    private async getLocalMetadata(): Promise<SyncMetadata | null> {
        try {
            const metadata = await Storage.get('webdav-sync-metadata')
            return metadata ? JSON.parse(metadata) : null
        } catch (_error) {
            return null
        }
    }

    /**
     * 判断是否应该上传数据（本地数据较新）
     */
    private shouldUploadData(localMetadata: SyncMetadata | null, remoteMetadata: SyncMetadata | null): boolean {
        // 如果没有远程数据，上传本地数据
        if (!remoteMetadata) return true

        // 如果没有本地元数据，下载远程数据
        if (!localMetadata) return false

        // 比较时间戳，选择较新的数据
        return localMetadata.lastSyncTime > remoteMetadata.lastSyncTime
    }

    /**
     * 更新同步元数据
     */
    private async updateSyncMetadata(): Promise<void> {
        const metadata: SyncMetadata = {
            lastSyncTime: Date.now(),
            version: '1.0.0',
            deviceId: await this.getDeviceId()
        }

        // 保存到本地
        await Storage.set('webdav-sync-metadata', JSON.stringify(metadata))

        // 上传到服务器
        if (this.client && this.config) {
            try {
                const metadataPath = `${this.config.remotePath}sync-metadata.json`
                await this.client.uploadFile(metadataPath, JSON.stringify(metadata, null, 2))
            } catch (_error) {
                console.warn('上传同步元数据失败:', _error)
            }
        }
    }

    /**
     * 获取设备ID
     */
    private async getDeviceId(): Promise<string> {
        let deviceId = await Storage.get('device-id')

        if (!deviceId) {
            // 生成基于浏览器指纹的设备ID
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            if (ctx) {
                ctx.textBaseline = 'top'
                ctx.font = '14px Arial'
                ctx.fillText('Device fingerprint', 2, 2)
            }

            const fingerprint = [
                navigator.userAgent,
                navigator.language,
                screen.width + 'x' + screen.height,
                new Date().getTimezoneOffset(),
                canvas.toDataURL()
            ].join('|')

            // 生成简单的hash
            let hash = 0
            for (let i = 0; i < fingerprint.length; i++) {
                const char = fingerprint.charCodeAt(i)
                hash = ((hash << 5) - hash) + char
                hash = hash & hash // 转换为32位整数
            }

            deviceId = `device-${Math.abs(hash).toString(36)}-${Date.now().toString(36)}`
            await Storage.set('device-id', deviceId)
        }

        return deviceId
    }

    /**
     * 检查同步状态
     */
    isSyncInProgress(): boolean {
        return this.syncInProgress
    }

    /**
     * 获取最后同步时间
     */
    async getLastSyncTime(): Promise<Date | null> {
        const metadata = await this.getLocalMetadata()
        return metadata ? new Date(metadata.lastSyncTime) : null
    }
}

export default WebDAVSyncManager