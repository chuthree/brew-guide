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

            const headers = await this.createAuthHeaders('GET', url)

            console.warn('请求头:', headers)

            // 带认证头进行请求
            const response = await fetch(url, {
                method: 'GET',
                mode: 'cors',
                headers
            })

            console.warn('七牛云连接测试结果:', response.status, response.statusText)

            // 对于七牛云，200表示成功，403可能是权限问题但服务可达，404表示bucket不存在但连接正常
            if (response.status === 200 || response.status === 403 || response.status === 404) {
                console.warn('✅ 七牛云服务可达，CORS配置正常')
                return true
            }

            // 如果状态码不是预期的，尝试获取更多信息
            const responseText = await response.text()
            console.warn('响应内容片段:', responseText.substring(0, 200))

            return false
        } catch (error) {
            console.error('七牛云连接测试失败:', error)
            return false
        }
    }

    /**
     * 上传文件
     */
    async uploadFile(key: string, content: string | ArrayBuffer): Promise<boolean> {
        try {
            const fullKey = this.getFullKey(key)

            // 统一使用buildUrl方法构建URL
            const url = this.buildUrl(`/${fullKey}`)

            console.warn(`📤 准备上传文件: ${key} -> ${fullKey}`)
            console.warn(`📤 上传URL: ${url}`)

            const headers = await this.createAuthHeaders(
                'PUT',
                url,
                {
                    'Content-Type': key.endsWith('.json') ? 'application/json' : 'application/octet-stream'
                },
                content
            )

            console.warn('📤 上传请求头:', headers)

            const response = await fetch(url, {
                method: 'PUT',
                headers,
                body: content
            })

            console.warn(`📤 上传响应: ${response.status} ${response.statusText}`)

            if (!response.ok) {
                const responseText = await response.text()
                console.error(`❌ 上传失败，响应内容:`, responseText.substring(0, 500))
            } else {
                console.warn(`✅ 文件上传成功: ${fullKey}`)
            }

            return response.ok
        } catch (error) {
            console.error('❌ 上传文件失败:', error)
            return false
        }
    }

    /**
     * 下载文件
     */
    async downloadFile(key: string): Promise<string | null> {
        try {
            const fullKey = this.getFullKey(key)

            // 统一使用buildUrl方法构建URL
            const url = this.buildUrl(`/${fullKey}`)

            console.warn(`📥 准备下载文件: ${key} -> ${fullKey}`)
            console.warn(`📥 下载URL: ${url}`)

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

            console.warn(`📥 下载响应: ${response.status} ${response.statusText}`)

            if (response.ok) {
                const content = await response.text()

                // 检查是否返回了HTML内容（通常是错误页面）
                if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) {
                    console.warn(`❌ 文件 ${key} 返回了HTML内容，可能是错误页面`)
                    return null
                }

                console.warn(`✅ 文件下载成功: ${fullKey}, 大小: ${content.length} 字符`)
                return content
            }

            // 对于404等错误，直接返回null
            if (response.status === 404) {
                console.warn(`📁 文件 ${key} 不存在`)
                return null
            }

            console.warn(`❌ 下载文件 ${key} 失败，状态码: ${response.status}`)
            return null
        } catch (error) {
            console.error('❌ 下载文件失败:', error)
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

            const headers = await this.createAuthHeaders('GET', url)

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

            // 统一使用buildUrl方法构建URL
            const url = this.buildUrl(`/${fullKey}`)

            console.warn(`🗑️ 准备删除文件: ${key} -> ${fullKey}`)
            console.warn(`🗑️ 删除URL: ${url}`)

            // 对于七牛云，使用Basic认证
            const headers = await this.createAuthHeaders('DELETE', url)

            const response = await fetch(url, {
                method: 'DELETE',
                headers
            })

            console.warn(`🗑️ 删除响应: ${response.status} ${response.statusText}`)

            if (response.ok) {
                console.warn(`✅ 文件删除成功: ${fullKey}`)
            } else {
                console.warn(`❌ 文件删除失败: ${fullKey}`)
            }

            return response.ok
        } catch (error) {
            console.error('❌ 删除文件失败:', error)
            return false
        }
    }

    /**
     * 检查文件是否存在
     */
    async fileExists(key: string): Promise<boolean> {
        try {
            const fullKey = this.getFullKey(key)

            // 统一使用buildUrl方法构建URL
            const url = this.buildUrl(`/${fullKey}`)

            console.warn(`🔍 检查文件是否存在: ${key} -> ${fullKey}`)
            console.warn(`🔍 检查URL: ${url}`)

            // 对于七牛云，使用Basic认证
            const headers = await this.createAuthHeaders('HEAD', url)

            const response = await fetch(url, {
                method: 'HEAD',
                headers
            })

            console.warn(`🔍 检查响应: ${response.status} ${response.statusText}`)

            const exists = response.ok
            console.warn(`${exists ? '✅' : '❌'} 文件${exists ? '存在' : '不存在'}: ${fullKey}`)

            return exists
        } catch (_error) {
            console.warn(`❌ 检查文件存在性失败: ${key}`)
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
            const { resolvedEndpoint: endpoint, selectedProtocol } = this.resolveEndpoint(this.config.endpoint)

            // 移除末尾的斜杠
            const normalizedEndpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint

            // 七牛云的S3端点格式：https://bucket-name.s3.region.qiniucs.com
            // bucket名称已经包含在域名中，路径应该直接从prefix开始
            if (normalizedEndpoint.includes('qiniucs.com') || normalizedEndpoint.includes(this.config.bucketName)) {
                // 对于七牛云，路径不应该包含bucket名称
                let cleanPath = path

                // 如果路径以 /bucket-name/ 开头，需要移除它
                const bucketPrefix = `/${this.config.bucketName}/`
                if (cleanPath.startsWith(bucketPrefix)) {
                    cleanPath = cleanPath.substring(bucketPrefix.length)
                }

                // 确保路径以 / 开头
                const finalPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`
                const finalUrl = `${normalizedEndpoint}${finalPath}`

                console.warn(`🎯 七牛云URL构建:`, {
                    原始端点: this.config.endpoint,
                    处理后端点: normalizedEndpoint,
                    选用协议: selectedProtocol,
                    原始路径: path,
                    清理后路径: cleanPath,
                    最终路径: finalPath,
                    最终URL: finalUrl,
                    bucket名称: this.config.bucketName,
                    前缀: this.config.prefix
                })

                return finalUrl
            } else {
                // 其他S3兼容服务，保持原有逻辑
                const finalPath = path.startsWith('/') ? path : `/${path}`
                return `${normalizedEndpoint}${finalPath}`
            }
        } else {
            // 使用AWS S3标准端点
            return `https://s3.${this.config.region}.amazonaws.com${path}`
        }
    }

    /**
     * 创建认证头 - 针对不同服务优化
     */
    private async createAuthHeaders(
        method: string,
        url: string,
        additionalHeaders: Record<string, string> = {},
        payload: string | ArrayBuffer | null = null
    ): Promise<Record<string, string>> {
        const requestUrl = new URL(url)

        const now = new Date()
        const amzDate = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
        const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')

        const payloadHash = await this.hashSha256(payload ?? '')

        const canonicalHeadersMap = new Map<string, string>()
        canonicalHeadersMap.set('host', requestUrl.host)
        canonicalHeadersMap.set('x-amz-date', amzDate)
        canonicalHeadersMap.set('x-amz-content-sha256', payloadHash)

        Object.entries(additionalHeaders).forEach(([key, value]) => {
            canonicalHeadersMap.set(key.toLowerCase(), value.trim())
        })

        const sortedHeaderKeys = Array.from(canonicalHeadersMap.keys()).sort()
        const canonicalHeaders = sortedHeaderKeys
            .map(key => `${key}:${canonicalHeadersMap.get(key)}`)
            .join('\n') + '\n'

        const signedHeaders = sortedHeaderKeys.join(';')

        const canonicalRequest = [
            method.toUpperCase(),
            this.getCanonicalUri(requestUrl.pathname),
            this.getCanonicalQueryString(requestUrl.searchParams),
            canonicalHeaders,
            signedHeaders,
            payloadHash
        ].join('\n')

        const credentialScope = `${dateStamp}/${this.config.region}/s3/aws4_request`
        const stringToSign = [
            'AWS4-HMAC-SHA256',
            amzDate,
            credentialScope,
            await this.hashSha256(canonicalRequest)
        ].join('\n')

        const signingKey = await this.getSignatureKey(dateStamp)
        const signature = await this.hmacSha256Hex(signingKey, stringToSign)

        const headers: Record<string, string> = {
            'X-Amz-Date': amzDate,
            'X-Amz-Content-Sha256': payloadHash,
            ...additionalHeaders,
            'Authorization': `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
        }

        return headers
    }

    /**
     * 将配置中的端点统一解析为可用协议
     */
    private resolveEndpoint(endpoint: string) {
        let trimmed = endpoint.trim()
        let selectedProtocol: 'https' | 'http' = 'https'

        if (trimmed.startsWith('http(s)://')) {
            // 默认优先使用 https，除非用户显式以 http:// 开头
            selectedProtocol = 'https'
            trimmed = `https://${trimmed.slice('http(s)://'.length)}`
        } else if (trimmed.startsWith('https://')) {
            selectedProtocol = 'https'
        } else if (trimmed.startsWith('http://')) {
            selectedProtocol = 'http'
        } else {
            // 缺少协议时默认使用 https
            trimmed = `https://${trimmed}`
            selectedProtocol = 'https'
        }

        return {
            resolvedEndpoint: trimmed,
            selectedProtocol
        }
    }

    private getCanonicalUri(pathname: string): string {
        const safePath = pathname || '/'
        return safePath
            .split('/')
            .map(segment => encodeURIComponent(segment))
            .join('/')
            .replace(/%2F/g, '/')
    }

    private getCanonicalQueryString(searchParams: URLSearchParams): string {
        const params: string[] = []
        const entries = Array.from(searchParams.entries()).sort(([aKey, aValue], [bKey, bValue]) => {
            if (aKey === bKey) {
                return aValue.localeCompare(bValue)
            }
            return aKey.localeCompare(bKey)
        })

        entries.forEach(([key, value]) => {
            params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        })

        return params.join('&')
    }

    private async hashSha256(data: string | ArrayBuffer): Promise<string> {
        const buffer = typeof data === 'string'
            ? new TextEncoder().encode(data)
            : new Uint8Array(data)

        const hashBuffer = await this.getSubtleCrypto().digest('SHA-256', buffer)
        return this.toHex(new Uint8Array(hashBuffer))
    }

    private async hmacSha256(key: ArrayBuffer | Uint8Array | string, data: string): Promise<ArrayBuffer> {
        const keyBuffer = typeof key === 'string'
            ? new TextEncoder().encode(key)
            : key instanceof Uint8Array
                ? key
                : new Uint8Array(key)

        const cryptoKey = await this.getSubtleCrypto().importKey(
            'raw',
            keyBuffer,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        )

        return this.getSubtleCrypto().sign('HMAC', cryptoKey, new TextEncoder().encode(data))
    }

    private async hmacSha256Hex(key: ArrayBuffer, data: string): Promise<string> {
        const signatureBuffer = await this.hmacSha256(key, data)
        return this.toHex(new Uint8Array(signatureBuffer))
    }

    private async getSignatureKey(dateStamp: string): Promise<ArrayBuffer> {
        const kDate = await this.hmacSha256(`AWS4${this.config.secretAccessKey}`, dateStamp)
        const kRegion = await this.hmacSha256(kDate, this.config.region)
        const kService = await this.hmacSha256(kRegion, 's3')
        return this.hmacSha256(kService, 'aws4_request')
    }

    private toHex(buffer: Uint8Array): string {
        return Array.from(buffer)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
    }

    private getSubtleCrypto(): SubtleCrypto {
        const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
        if (!cryptoObj || !cryptoObj.subtle) {
            throw new Error('当前环境不支持 Web Crypto API，无法生成 AWS 签名')
        }
        return cryptoObj.subtle
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
