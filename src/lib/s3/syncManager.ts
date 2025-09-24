/**
 * S3同步管理器
 * 处理IndexedDB与S3之间的数据同步
 */

import S3Client, { S3Config } from './s3Client'
import { Storage } from '@/lib/core/storage'

export interface SyncResult {
    success: boolean
    message: string
    uploadedFiles: number
    downloadedFiles: number
    errors: string[]
    conflict?: boolean
    remoteMetadata?: SyncMetadata | null
}

export interface SyncMetadata {
    lastSyncTime: number
    version: string
    deviceId: string
    files?: string[]
    dataHash?: string
}

export class S3SyncManager {
    private client: S3Client | null = null
    private config: S3Config | null = null
    private syncInProgress = false

    /**
     * 初始化同步管理器
     */
    async initialize(config: S3Config): Promise<boolean> {
        try {
            this.config = config
            this.client = new S3Client(config)

            // 测试连接
            const connected = await this.client.testConnection()
            if (!connected) {
                throw new Error('无法连接到S3服务')
            }

            return true
        } catch (error) {
            console.error('S3同步管理器初始化失败:', error)
            return false
        }
    }

    /**
     * 检查是否需要同步
     */
    public async needsSync(): Promise<boolean> {
        try {
            const { dataForHashing } = await this.getLocalData()
            const currentLocalDataHash = await this.generateDataHash(dataForHashing)
            const remoteMetadata = await this.getRemoteMetadata()

            // 如果没有远程元数据，则需要上传
            if (!remoteMetadata) {
                return true
            }

            // 如果哈希值不匹配，则需要同步
            return currentLocalDataHash !== remoteMetadata.dataHash
        } catch (error) {
            console.error('检查同步状态时出错:', error)
            return false // 发生错误时，安全起见返回false
        }
    }

    /**
     * 执行数据同步
     */
    async sync(preferredDirection: 'auto' | 'upload' | 'download' = 'auto'): Promise<SyncResult> {
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
                errors: ['S3同步管理器未正确初始化']
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
            // 添加完整的诊断信息
            console.warn(`📋 S3同步完整诊断信息 [请复制此段给开发者]:`, {
                配置信息: {
                    endpoint: this.config.endpoint,
                    region: this.config.region,
                    bucketName: this.config.bucketName,
                    prefix: this.config.prefix,
                    accessKeyId: this.config.accessKeyId.substring(0, 8) + '***', // 只显示前8位
                },
                时间戳: new Date().toISOString(),
                用户代理: navigator.userAgent,
                页面URL: window.location.href
            })

            // 1. 获取本地数据
            console.warn('开始同步：获取本地数据...')
            const { dataForHashing, fullExportData } = await this.getLocalData()
            console.warn('本地数据获取完成，包含项目:', Object.keys(fullExportData))
            const localFileManifest = this.getDataFileManifest(fullExportData)

            // 2. 计算当前本地数据哈希（仅基于核心数据）
            const currentLocalDataHash = await this.generateDataHash(dataForHashing)
            console.warn('本地数据哈希:', currentLocalDataHash.substring(0, 8))

            // 3. 获取远程元数据
            console.warn('获取远程元数据...')
            const remoteMetadata = await this.getRemoteMetadata()
            console.warn('远程元数据:', remoteMetadata ? '存在' : '不存在')

            const localMetadata = await this.getLocalMetadata()
            console.warn('本地元数据:', localMetadata ? '存在' : '不存在')

            // 4. 决定同步方向
            const direction = this.determineSyncDirection(localMetadata, remoteMetadata, currentLocalDataHash, preferredDirection)

            if (direction === 'conflict') {
                return {
                    success: false,
                    message: '数据冲突，需要用户选择',
                    uploadedFiles: 0,
                    downloadedFiles: 0,
                    errors: ['本地数据和云端数据都发生了变化'],
                    conflict: true,
                    remoteMetadata: remoteMetadata
                }
            }

            let manifestToPersist = localFileManifest
            let finalDataHash = currentLocalDataHash

            switch (direction) {
                case 'upload':
                    console.warn('执行上传操作...')
                    await this.uploadData(fullExportData, result)
                    // 上传后，元数据使用当前本地数据哈希
                    finalDataHash = currentLocalDataHash
                    await this.updateSyncMetadata(manifestToPersist, finalDataHash)
                    break
                case 'download':
                    console.warn('执行下载操作...')
                    const downloadedFiles = await this.downloadData(result, remoteMetadata)
                    if (downloadedFiles.length > 0) {
                        manifestToPersist = downloadedFiles
                    } else if (remoteMetadata?.files?.length) {
                        manifestToPersist = this.sanitizeManifestFiles(remoteMetadata.files)
                    }
                    // 下载后，需要重新计算哈希值
                    finalDataHash = await this.generateDataHash(await this.getLocalData())
                    await this.updateSyncMetadata(manifestToPersist, finalDataHash)
                    break
                case 'none':
                    console.warn('数据已是最新，无需同步')
                    result.message = '数据已是最新'
                    // 即使没有同步操作，也更新本地元数据的时间戳和哈希，以保持一致
                    await this.updateSyncMetadata(localFileManifest, currentLocalDataHash, true)
                    break
            }

            result.success = result.errors.length === 0
            result.message = result.success
                ? `同步完成：上传 ${result.uploadedFiles} 个文件，下载 ${result.downloadedFiles} 个文件`
                : `同步部分完成，遇到 ${result.errors.length} 个错误`

            console.warn('🎯 同步结果:', result)

            // 添加最终诊断结果
            console.warn(`📊 S3同步结果摘要 [请复制此段给开发者]:`, {
                成功状态: result.success,
                上传文件数: result.uploadedFiles,
                下载文件数: result.downloadedFiles,
                错误数量: result.errors.length,
                错误详情: result.errors,
                执行时间: new Date().toISOString()
            })

        } catch (error) {
            const errorMessage = `同步失败: ${error instanceof Error ? error.message : '未知错误'}`
            result.errors.push(errorMessage)
            result.message = '同步失败'
            console.error('同步过程中发生错误:', error)
        } finally {
            this.syncInProgress = false
        }

        return result
    }

    /**
     * 获取本地存储的所有数据
     */
    private async getLocalData(): Promise<{
        dataForHashing: Record<string, unknown>
        fullExportData: Record<string, unknown>
    }> {
        const fullExportData: Record<string, unknown> = {}
        let dataForHashing: Record<string, unknown> = {}

        try {
            // 使用DataManager导出完整的应用数据
            const { DataManager } = await import('@/lib/core/dataManager')
            const fullExportString = await DataManager.exportAllData()
            const exportDataObj = JSON.parse(fullExportString)

            // 完整的导出数据用于上传
            fullExportData['brew-guide-data'] = exportDataObj

            // 仅使用 `data` 字段进行哈希计算
            if (exportDataObj.data) {
                dataForHashing = { 'brew-guide-data': exportDataObj.data }
            } else {
                // 如果没有 `data` 字段，则使用整个对象进行哈希计算（兼容旧格式）
                dataForHashing = fullExportData
            }

            console.warn('获取到完整应用数据:', {
                exportDate: exportDataObj.exportDate,
                appVersion: exportDataObj.appVersion,
                dataKeys: Object.keys(exportDataObj.data),
                totalSize: (fullExportString.length / 1024).toFixed(2) + 'KB'
            })

        } catch (error) {
            console.error('获取完整应用数据失败，尝试获取基础设置:', error)

            // 如果完整导出失败，回退到只获取设置
            try {
                const value = await Storage.get('brewGuideSettings')
                if (value !== null) {
                    try {
                        const settings = JSON.parse(value)
                        fullExportData['brewGuideSettings'] = settings
                        dataForHashing['brewGuideSettings'] = settings
                    } catch {
                        fullExportData['brewGuideSettings'] = value
                        dataForHashing['brewGuideSettings'] = value
                    }
                }
            } catch (fallbackError) {
                console.error('获取基础设置也失败:', fallbackError)
            }
        }

        return { dataForHashing, fullExportData }
    }

    private getDataFileManifest(localData: Record<string, unknown>): string[] {
        return Array.from(new Set(Object.keys(localData)))
            .filter(key => key)
            .map(key => `${key}.json`)
    }

    private sanitizeManifestFiles(files: string[]): string[] {
        const sanitized = new Set<string>()

        files.forEach(file => {
            if (!file) return

            const normalizedFileName = file.endsWith('.json') ? file : `${file}.json`
            const normalized = this.normalizeRemoteObjectKey(normalizedFileName)

            if (normalized) {
                sanitized.add(normalized)
            }
        })

        return Array.from(sanitized)
    }

    /**
     * 上传数据到S3
     */
    private async uploadData(localData: Record<string, unknown>, result: SyncResult): Promise<void> {
        if (!this.client) return

        // 上传每个数据文件
        for (const [key, value] of Object.entries(localData)) {
            try {
                const filename = `${key}.json`
                const content = JSON.stringify(value, null, 2)

                const success = await this.client.uploadFile(filename, content)
                if (success) {
                    result.uploadedFiles++
                } else {
                    result.errors.push(`上传 ${filename} 失败`)
                }
            } catch (error) {
                result.errors.push(`上传 ${key} 时出错: ${error instanceof Error ? error.message : '未知错误'}`)
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

            await this.client.uploadFile('device-info.json', JSON.stringify(deviceInfo, null, 2))
        } catch (error) {
            console.warn('上传设备信息失败:', error)
        }
    }

    /**
     * 从S3下载数据
     */
    private async downloadData(result: SyncResult, remoteMetadata?: SyncMetadata | null): Promise<string[]> {
        if (!this.client) return []

        const filesToDownload = new Set<string>()
        const remoteManifestFiles = remoteMetadata?.files?.length
            ? this.sanitizeManifestFiles(remoteMetadata.files)
            : []

        remoteManifestFiles.forEach(file => filesToDownload.add(file))

        try {
            if (filesToDownload.size === 0) {
                // 列出远程文件（作为兜底方案）
                const files = await this.client.listObjects()
                files.forEach(file => {
                    if (
                        file.key.endsWith('.json') &&
                        !file.key.endsWith('sync-metadata.json') &&
                        !file.key.endsWith('device-info.json')
                    ) {
                        const normalizedKey = this.normalizeRemoteObjectKey(file.key)
                        if (normalizedKey) {
                            filesToDownload.add(normalizedKey)
                        }
                    }
                })
            }

            if (filesToDownload.size === 0) {
                filesToDownload.add('brew-guide-data.json')
            }

            const downloadedFiles: string[] = []

            // 下载每个数据文件
            for (const fileName of Array.from(filesToDownload)) {
                try {
                    console.warn(`下载文件: ${fileName}`)
                    const downloadKey = this.normalizeRemoteObjectKey(fileName)
                    if (!downloadKey) {
                        console.warn('远程对象键名无法规范化，跳过当前文件')
                        continue
                    }

                    const content = await this.client.downloadFile(downloadKey)
                    if (content) {
                        const key = downloadKey.replace(/\.json$/i, '')
                        if (!key) {
                            console.warn('下载到的文件缺少有效键名，跳过本地写入')
                            continue
                        }
                        console.warn(`成功下载文件 ${key}，内容长度: ${content.length}`)

                        try {
                            const data = JSON.parse(content)

                            // 检查是否是完整的导出数据格式
                            if (key === 'brew-guide-data' && data.data && data.exportDate) {
                                console.warn('检测到完整导出数据，开始恢复应用数据...')

                                // 使用DataManager导入完整数据
                                const { DataManager } = await import('@/lib/core/dataManager')
                                await DataManager.importAllData(content)

                                console.warn('完整应用数据导入成功')
                                result.downloadedFiles++
                                downloadedFiles.push('brew-guide-data.json')
                            } else {
                                // 兼容旧格式：直接保存到存储
                                await Storage.set(key, JSON.stringify(data))
                                console.warn(`成功保存 ${key} 到本地存储`)
                                result.downloadedFiles++
                                downloadedFiles.push(`${key}.json`)
                            }
                        } catch (parseError) {
                            console.error(`解析 ${key} 的JSON内容失败:`, parseError)
                            console.warn(`内容片段: ${content.substring(0, 200)}`)
                            result.errors.push(`解析 ${fileName} 的JSON内容失败`)
                        }
                    } else {
                        result.errors.push(`下载 ${fileName} 失败`)
                    }
                } catch (error) {
                    result.errors.push(`处理 ${fileName} 时出错: ${error instanceof Error ? error.message : '未知错误'}`)
                }
            }

            // 触发存储更新事件
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('storageChange', {
                    detail: { key: 's3-sync-complete' }
                }))
            }

            return Array.from(new Set(downloadedFiles))
        } catch (error) {
            result.errors.push(`下载数据失败: ${error instanceof Error ? error.message : '未知错误'}`)
            return []
        }
    }

    private normalizeRemoteObjectKey(objectKey: string): string {
        if (!this.config) {
            return objectKey
        }

        const rawPrefix = this.config.prefix
        const hasPrefix = rawPrefix.length > 0
        const normalizedPrefix = hasPrefix
            ? (rawPrefix.endsWith('/') ? rawPrefix : `${rawPrefix}/`)
            : ''

        let result = objectKey
        if (normalizedPrefix && result.startsWith(normalizedPrefix)) {
            result = result.slice(normalizedPrefix.length)
        } else if (hasPrefix && result.startsWith(rawPrefix)) {
            result = result.slice(rawPrefix.length)
        }

        return result.replace(/^\/+/, '')
    }

    /**
     * 获取远程同步元数据
     */
    private async getRemoteMetadata(): Promise<SyncMetadata | null> {
        if (!this.client) return null

        try {
            const content = await this.client.downloadFile('sync-metadata.json')

            if (content) {
                try {
                    const metadata = JSON.parse(content) as SyncMetadata
                    if (metadata.files && !Array.isArray(metadata.files)) {
                        metadata.files = []
                    }
                    return metadata
                } catch (parseError) {
                    console.warn('解析远程元数据失败，内容可能不是有效的JSON:', parseError)
                    console.warn('返回的内容片段:', content.substring(0, 200))
                    return null
                }
            }
        } catch (error) {
            console.warn('获取远程元数据失败:', error)
        }

        return null
    }

    /**
     * 获取本地同步元数据
     */
    private async getLocalMetadata(): Promise<SyncMetadata | null> {
        try {
            const metadata = await Storage.get('s3-sync-metadata')
            return metadata ? JSON.parse(metadata) : null
        } catch (_error) {
            return null
        }
    }

    /**
     * 决定同步方向
     */
    private determineSyncDirection(
        localMetadata: SyncMetadata | null,
        remoteMetadata: SyncMetadata | null,
        currentDataHash: string,
        preferredDirection: 'auto' | 'upload' | 'download'
    ): 'upload' | 'download' | 'none' | 'conflict' {
        if (preferredDirection === 'upload' || preferredDirection === 'download') {
            console.warn('同步方向由调用方指定:', preferredDirection)
            return preferredDirection
        }

        // 1. 没有远程元数据 -> 上传
        if (!remoteMetadata) {
            console.warn('首次同步：上传本地数据到S3')
            return 'upload'
        }

        // 2. 没有本地元数据 (例如，新设备、重置后) -> 下载
        if (!localMetadata) {
            console.warn('本地无元数据：从S3下载数据')
            return 'download'
        }

        // 至此，本地和远程元数据都存在

        const localDataChanged = localMetadata.dataHash !== currentDataHash
        const remoteDataChangedSinceLastSync = remoteMetadata.dataHash !== localMetadata.dataHash

        console.warn('数据变化检测:', {
            localStoredHash: localMetadata.dataHash?.substring(0, 8) || 'N/A',
            currentDataHash: currentDataHash.substring(0, 8),
            remoteHash: remoteMetadata.dataHash?.substring(0, 8) || 'N/A',
            localChanged: localDataChanged,
            remoteChanged: remoteDataChangedSinceLastSync
        })

        // 如果当前数据与远程数据匹配，则表示已同步
        if (currentDataHash === remoteMetadata.dataHash) {
            console.warn('数据哈希值一致，无需同步')
            return 'none'
        }

        // 如果本地数据已更改，但自上次同步以来远程数据未更改
        // 这意味着我们是唯一进行更改的一方，可以安全上传
        if (localDataChanged && !remoteDataChangedSinceLastSync) {
            console.warn('本地数据已变化，远程未变：上传到S3')
            return 'upload'
        }

        // 如果本地数据未更改，但远程数据已更改
        // 这意味着另一台设备已同步，可以安全下载
        if (!localDataChanged && remoteDataChangedSinceLastSync) {
            console.warn('本地数据未变，远程已更新：从S3下载')
            return 'download'
        }

        // 危险区域：自上次同步以来，本地和远程数据都已更改
        if (localDataChanged && remoteDataChangedSinceLastSync) {
            console.warn('冲突：本地数据和远程数据都已发生变化')
            return 'conflict'
        }

        // 备用情况，理论上不应到达
        console.warn('同步方向决策出现未覆盖的场景，默认不执行任何操作')
        return 'none'
    }

    /**
     * 更新同步元数据
     */
    private async updateSyncMetadata(files: string[], dataHash: string, localOnly = false): Promise<void> {
        const compareAlpha = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' })
        const uniqueFiles = Array.from(new Set(files.filter(Boolean))).sort(compareAlpha)

        const metadata: SyncMetadata = {
            lastSyncTime: Date.now(),
            version: '1.0.0',
            deviceId: await this.getDeviceId(),
            files: uniqueFiles,
            dataHash: dataHash
        }

        // 保存到本地
        await Storage.set('s3-sync-metadata', JSON.stringify(metadata))

        // 上传到S3
        if (this.client && !localOnly) {
            try {
                await this.client.uploadFile('sync-metadata.json', JSON.stringify(metadata, null, 2))
            } catch (error) {
                console.warn('上传同步元数据失败:', error)
            }
        }
    }

    /**
     * 递归地对对象的键进行排序
     */
    private deepSortObject(obj: unknown): unknown {
        if (typeof obj !== 'object' || obj === null) {
            return obj
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.deepSortObject(item))
        }

        const objRecord = obj as Record<string, unknown>
        const sortedObj: Record<string, unknown> = {}
        const compareAlpha = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' })
        const sortedKeys = Object.keys(objRecord).sort(compareAlpha)

        for (const key of sortedKeys) {
            sortedObj[key] = this.deepSortObject(objRecord[key])
        }

        return sortedObj
    }

    /**
     * 生成数据内容哈希
     */
    private async generateDataHash(data: Record<string, unknown>): Promise<string> {
        try {
            // 深度排序对象以确保稳定的字符串表示
            const sortedData = this.deepSortObject(data)
            const sortedDataString = JSON.stringify(sortedData)

            // 使用Web Crypto API生成SHA-256哈希
            const encoder = new TextEncoder()
            const dataBuffer = encoder.encode(sortedDataString)
            const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)

            // 转换为十六进制字符串
            const hashArray = Array.from(new Uint8Array(hashBuffer))
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

            return hashHex
        } catch (error) {
            console.warn('生成数据哈希失败:', error)
            // 如果哈希生成失败，返回基于时间戳的简单标识
            return `fallback-${Date.now()}`
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

export default S3SyncManager
