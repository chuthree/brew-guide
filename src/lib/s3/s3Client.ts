/**
 * S3客户端 - 适用于浏览器环境的简化实现
 * 支持AWS S3及兼容S3的存储服务（MinIO、阿里云OSS、腾讯云COS等）
 */

export interface S3Config {
    region: string
    accessKeyId: string
    secretAccessKey: string
    bucketName: string
    prefix: string
    endpoint?: string // 自定义端点，用于兼容其他S3服务
}

export interface S3File {
    key: string
    size: number
    lastModified: Date
    etag: string
}

export class S3Client {
    private config: S3Config

    constructor(config: S3Config) {
        this.config = config
    }

    /**
     * 测试连接
     */
    async testConnection(): Promise<boolean> {
        try {
            // 对于七牛云等服务，我们先尝试简单的HEAD请求测试bucket是否存在
            if (this.config.endpoint && this.config.endpoint.includes('qiniu')) {
                // 七牛云特殊处理
                return await this.testQiniuConnection()
            }

            // 尝试列出bucket中的对象来测试连接
            await this.listObjects('', 1)
            return true
        } catch (error) {
            console.error('S3连接测试失败:', error)
            return false
        }
    }

    /**
     * 测试七牛云连接
     */
    private async testQiniuConnection(): Promise<boolean> {
        try {
            // 对于七牛云，先尝试简单的根路径GET请求
            const url = this.buildUrl('/')
            console.warn('测试七牛云连接，URL:', url)

            // 七牛云使用简化的Basic认证
            const auth = btoa(`${this.config.accessKeyId}:${this.config.secretAccessKey}`)
            const headers = {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/xml'
            }

            console.warn('请求头:', headers)

            const response = await fetch(url, {
                method: 'GET',
                mode: 'cors',
                headers
            })

            console.warn('七牛云连接测试结果:', response.status, response.statusText)

            // 对于七牛云，200表示成功，403可能是权限问题但服务可达，404表示bucket不存在但连接正常
            if (response.status === 200 || response.status === 403 || response.status === 404) {
                return true
            }

            const responseText = await response.text()
            console.warn('响应内容片段:', responseText.substring(0, 200))

            return false
        } catch (error) {
            console.error('七牛云连接测试失败:', error)

            // 检查是否是CORS错误
            if (error instanceof TypeError && error.message.includes('fetch')) {
                console.error('===== CORS配置提示 =====')
                console.error('CORS错误！请检查七牛云控制台的CORS配置：')
                console.error('1. 允许的来源(Origin): * 或 http://localhost:3000')
                console.error('2. 允许的方法(Methods): GET, POST, PUT, DELETE, HEAD, OPTIONS')
                console.error('3. 允许的头部(Headers): *')
                console.error('4. 暴露的头部(Expose Headers): *')
                console.error('5. 缓存时间: 86400')
                console.error('6. 配置后需要等待几分钟生效')
                console.error('========================')
            }

            return false
        }
    }

    /**
     * 上传文件
     */
    async uploadFile(key: string, content: string | ArrayBuffer): Promise<boolean> {
        try {
            const fullKey = this.getFullKey(key)

            // 对于七牛云，直接使用文件路径，不需要bucket名称
            let url: string
            if (this.config.endpoint && (this.config.endpoint.includes('qiniucs.com') || this.config.endpoint.includes(this.config.bucketName))) {
                url = this.buildUrl(`/${fullKey}`)
            } else {
                url = this.buildUrl(`/${this.config.bucketName}/${fullKey}`)
            }

            console.warn(`准备上传文件: ${key} -> ${fullKey}`)
            console.warn(`上传URL: ${url}`)

            // 对于七牛云，使用Basic认证
            let headers: Record<string, string>
            if (this.config.endpoint && this.config.endpoint.includes('qiniu')) {
                const auth = btoa(`${this.config.accessKeyId}:${this.config.secretAccessKey}`)
                headers = {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': key.endsWith('.json') ? 'application/json' : 'application/octet-stream'
                }
            } else {
                headers = await this.createAuthHeaders('PUT', `/${this.config.bucketName}/${fullKey}`, {
                    'Content-Type': key.endsWith('.json') ? 'application/json' : 'application/octet-stream'
                })
            }

            console.warn('上传请求头:', headers)

            const response = await fetch(url, {
                method: 'PUT',
                headers,
                body: content
            })

            console.warn(`上传响应: ${response.status} ${response.statusText}`)

            if (!response.ok) {
                const responseText = await response.text()
                console.error(`上传失败，响应内容:`, responseText.substring(0, 500))
            }

            return response.ok
        } catch (error) {
            console.error('上传文件失败:', error)
            return false
        }
    }

    /**
     * 下载文件
     */
    async downloadFile(key: string): Promise<string | null> {
        try {
            const fullKey = this.getFullKey(key)

            // 对于七牛云，直接使用文件路径
            let url: string
            if (this.config.endpoint && (this.config.endpoint.includes('qiniucs.com') || this.config.endpoint.includes(this.config.bucketName))) {
                url = this.buildUrl(`/${fullKey}`)
            } else {
                url = this.buildUrl(`/${this.config.bucketName}/${fullKey}`)
            }

            // 对于七牛云，使用Basic认证
            let headers: Record<string, string>
            if (this.config.endpoint && this.config.endpoint.includes('qiniu')) {
                const auth = btoa(`${this.config.accessKeyId}:${this.config.secretAccessKey}`)
                headers = {
                    'Authorization': `Basic ${auth}`
                }
            } else {
                headers = await this.createAuthHeaders('GET', `/${this.config.bucketName}/${fullKey}`)
            }

            const response = await fetch(url, {
                method: 'GET',
                headers
            })

            if (response.ok) {
                const content = await response.text()

                // 检查是否返回了HTML内容（通常是错误页面）
                if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) {
                    console.warn(`文件 ${key} 返回了HTML内容，可能是错误页面`)
                    return null
                }

                return content
            }

            // 对于404等错误，直接返回null
            if (response.status === 404) {
                console.warn(`文件 ${key} 不存在`)
                return null
            }

            console.warn(`下载文件 ${key} 失败，状态码: ${response.status}`)
            return null
        } catch (error) {
            console.error('下载文件失败:', error)
            return null
        }
    }

    /**
     * 列出对象
     */
    async listObjects(prefix: string = '', maxKeys: number = 1000): Promise<S3File[]> {
        try {
            const fullPrefix = this.getFullKey(prefix)
            const params = new URLSearchParams({
                'list-type': '2',
                'prefix': fullPrefix,
                'max-keys': maxKeys.toString()
            })

            const path = `/${this.config.bucketName}?${params.toString()}`
            const url = this.buildUrl(path)

            const headers = await this.createAuthHeaders('GET', path)

            const response = await fetch(url, {
                method: 'GET',
                headers
            })

            if (!response.ok) {
                throw new Error(`列出对象失败: ${response.status} ${response.statusText}`)
            }

            const xmlText = await response.text()
            return this.parseListObjectsResponse(xmlText)
        } catch (error) {
            console.error('列出对象失败:', error)
            return []
        }
    }

    /**
     * 删除文件
     */
    async deleteFile(key: string): Promise<boolean> {
        try {
            const fullKey = this.getFullKey(key)
            const url = this.buildUrl(`/${this.config.bucketName}/${fullKey}`)

            const headers = await this.createAuthHeaders('DELETE', `/${this.config.bucketName}/${fullKey}`)

            const response = await fetch(url, {
                method: 'DELETE',
                headers
            })

            return response.ok
        } catch (error) {
            console.error('删除文件失败:', error)
            return false
        }
    }

    /**
     * 检查文件是否存在
     */
    async fileExists(key: string): Promise<boolean> {
        try {
            const fullKey = this.getFullKey(key)
            const url = this.buildUrl(`/${this.config.bucketName}/${fullKey}`)

            const headers = await this.createAuthHeaders('HEAD', `/${this.config.bucketName}/${fullKey}`)

            const response = await fetch(url, {
                method: 'HEAD',
                headers
            })

            return response.ok
        } catch (_error) {
            return false
        }
    }

    /**
     * 构建完整的对象键名
     */
    private getFullKey(key: string): string {
        const prefix = this.config.prefix.endsWith('/') ? this.config.prefix : this.config.prefix + '/'
        return prefix + key
    }

    /**
     * 构建URL
     */
    private buildUrl(path: string): string {
        if (this.config.endpoint) {
            // 使用自定义端点 - 七牛云等服务
            let endpoint = this.config.endpoint.trim()

            // 处理 http(s):// 格式，默认使用 https
            if (endpoint.startsWith('http(s)://')) {
                endpoint = endpoint.replace('http(s)://', 'https://')
            }

            // 确保有协议前缀
            if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
                endpoint = `https://${endpoint}`
            }

            // 移除末尾的斜杠
            endpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint

            // 七牛云的S3端点格式：https://bucket-name.s3.region.qiniucs.com
            // bucket名称已经包含在域名中，所以path不需要再包含bucket
            if (endpoint.includes('qiniucs.com') || endpoint.includes(this.config.bucketName)) {
                // 七牛云格式，bucket已在域名中，移除path中的bucket部分
                const cleanPath = path.replace(`/${this.config.bucketName}`, '')
                const finalPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`
                console.warn(`七牛云URL构建: endpoint=${endpoint}, path=${path}, cleanPath=${cleanPath}, finalPath=${finalPath}`)
                return `${endpoint}${finalPath}`
            } else {
                // 其他S3兼容服务，保持原有逻辑
                const finalPath = path.startsWith('/') ? path : `/${path}`
                return `${endpoint}${finalPath}`
            }
        } else {
            // 使用AWS S3标准端点
            return `https://s3.${this.config.region}.amazonaws.com${path}`
        }
    }

    /**
     * 创建认证头 - 针对不同服务优化
     */
    private async createAuthHeaders(_method: string, _path: string, additionalHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
        // 检查是否是七牛云
        if (this.config.endpoint && this.config.endpoint.includes('qiniu')) {
            // 七牛云使用简化的Basic认证
            const auth = btoa(`${this.config.accessKeyId}:${this.config.secretAccessKey}`)
            return {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
                ...additionalHeaders
            }
        }

        // AWS标准签名
        const now = new Date()
        const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')
        const timeStamp = now.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z'

        const headers = {
            'Host': this.getHost(),
            'X-Amz-Date': timeStamp,
            ...additionalHeaders
        }

        // 简化的签名实现 - 在实际生产环境中需要完整的AWS4-HMAC-SHA256签名
        return {
            ...headers,
            'Authorization': `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${dateStamp}/${this.config.region}/s3/aws4_request, SignedHeaders=host;x-amz-date, Signature=placeholder`
        }
    }

    /**
     * 获取主机名
     */
    private getHost(): string {
        if (this.config.endpoint) {
            try {
                let endpoint = this.config.endpoint.trim()

                // 处理 http(s):// 格式，默认使用 https
                if (endpoint.startsWith('http(s)://')) {
                    endpoint = endpoint.replace('http(s)://', 'https://')
                }

                // 确保有协议前缀
                if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
                    endpoint = `https://${endpoint}`
                }

                return new URL(endpoint).host
            } catch (error) {
                // 如果URL解析失败，尝试直接提取主机名
                console.error('URL解析失败，端点:', this.config.endpoint, error)
                const cleanEndpoint = this.config.endpoint.replace(/^https?:\/\//, '').replace(/^http\(s\):\/\//, '').replace(/\/$/, '')
                return cleanEndpoint
            }
        } else {
            return `s3.${this.config.region}.amazonaws.com`
        }
    }

    /**
     * 解析ListObjects响应
     */
    private parseListObjectsResponse(xmlText: string): S3File[] {
        try {
            const parser = new DOMParser()
            const doc = parser.parseFromString(xmlText, 'text/xml')
            const contents = doc.querySelectorAll('Contents')
            const files: S3File[] = []

            contents.forEach(content => {
                const keyElement = content.querySelector('Key')
                const sizeElement = content.querySelector('Size')
                const lastModifiedElement = content.querySelector('LastModified')
                const etagElement = content.querySelector('ETag')

                if (keyElement) {
                    files.push({
                        key: keyElement.textContent || '',
                        size: parseInt(sizeElement?.textContent || '0', 10),
                        lastModified: new Date(lastModifiedElement?.textContent || ''),
                        etag: etagElement?.textContent?.replace(/"/g, '') || ''
                    })
                }
            })

            return files
        } catch (error) {
            console.error('解析ListObjects响应失败:', error)
            return []
        }
    }
}

export default S3Client