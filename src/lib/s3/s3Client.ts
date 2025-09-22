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
            this.logSummary('test-connection', {
                service: 'generic',
                ok: true
            })
            return true
        } catch (error) {
            console.error('S3连接测试失败:', error)
            this.logSummary('test-connection', {
                service: 'generic',
                ok: false,
                error: error instanceof Error ? error.message : String(error)
            })
            return false
        }
    }

    /**
     * 测试七牛云连接
     */
    private async testQiniuConnection(): Promise<boolean> {
        try {
            // 七牛云常用对象检测方式：尝试获取同步元数据文件
            const { response, baseUrl } = await this.headObject('sync-metadata.json')
            const metadataExists = response.ok
            const reachable = metadataExists || response.status === 404

            this.logSummary('test-connection', {
                service: 'qiniu',
                ok: reachable,
                method: 'head-object',
                metadataExists,
                status: response.status,
                presigned: response.url !== baseUrl
            })

            return reachable
        } catch (error) {
            console.error('七牛云连接测试失败:', error)
            this.logSummary('test-connection', {
                service: 'qiniu',
                ok: false,
                error: error instanceof Error ? error.message : String(error)
            })
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

            const { requestUrl, headers } = await this.prepareRequest(
                'PUT',
                url,
                {
                    'Content-Type': key.endsWith('.json') ? 'application/json' : 'application/octet-stream'
                },
                content
            )

            const response = await fetch(requestUrl, {
                method: 'PUT',
                headers,
                body: content
            })

            this.logSummary('upload', {
                key,
                fullKey,
                url: requestUrl,
                status: response.status,
                ok: response.ok,
                contentType: headers['Content-Type']
            })

            if (!response.ok) {
                const responseText = await response.text()
                console.error('❌ 上传失败，响应内容:', responseText.substring(0, 500))
            }

            return response.ok
        } catch (error) {
            console.error('❌ 上传文件失败:', error)
            this.logSummary('upload', {
                key,
                ok: false,
                error: error instanceof Error ? error.message : String(error)
            })
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

            const { requestUrl, headers } = await this.prepareRequest('GET', url)

            const response = await fetch(requestUrl, {
                method: 'GET',
                headers
            })

            let errorSnippet: string | undefined
            if (!response.ok) {
                try {
                    errorSnippet = (await response.clone().text()).slice(0, 200)
                } catch (_e) {
                    errorSnippet = undefined
                }
            }

            this.logSummary('download', {
                key,
                fullKey,
                url: requestUrl,
                status: response.status,
                ok: response.ok,
                presigned: requestUrl !== url,
                errorSnippet
            })

            if (response.ok) {
                const content = await response.text()

                // 检查是否返回了HTML内容（通常是错误页面）
                if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) {
                    console.error(`❌ 文件 ${key} 返回了HTML内容，可能是错误页面`)
                    return null
                }

                return content
            }

            return null
        } catch (error) {
            console.error('❌ 下载文件失败:', error)
            this.logSummary('download', {
                key,
                ok: false,
                error: error instanceof Error ? error.message : String(error)
            })
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
                'prefix': fullPrefix,
                'max-keys': maxKeys.toString()
            })

            const path = `/${this.config.bucketName}?${params.toString()}`
            const url = this.buildUrl(path)

            const { requestUrl, headers } = await this.prepareRequest('GET', url)

            const response = await fetch(requestUrl, {
                method: 'GET',
                headers
            })

            let errorSnippet: string | undefined
            if (!response.ok) {
                try {
                    errorSnippet = (await response.clone().text()).slice(0, 200)
                } catch (_e) {
                    errorSnippet = undefined
                }
            }

            this.logSummary('list', {
                prefix,
                fullPrefix,
                url: requestUrl,
                status: response.status,
                ok: response.ok,
                presigned: requestUrl !== url,
                errorSnippet
            })

            if (!response.ok) {
                if (response.status === 403) {
                    console.warn('列出对象时收到403，返回空列表以避免中断同步流程')
                    return []
                }
                throw new Error(`列出对象失败: ${response.status} ${response.statusText}`)
            }

            const xmlText = await response.text()
            return this.parseListObjectsResponse(xmlText)
        } catch (error) {
            console.error('列出对象失败:', error)
            this.logSummary('list', {
                prefix,
                ok: false,
                error: error instanceof Error ? error.message : String(error)
            })
            throw error
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

            const { requestUrl, headers } = await this.prepareRequest('DELETE', url)

            const response = await fetch(requestUrl, {
                method: 'DELETE',
                headers
            })

            this.logSummary('delete', {
                key,
                fullKey,
                url: requestUrl,
                status: response.status,
                ok: response.ok
            })

            return response.ok
        } catch (error) {
            console.error('❌ 删除文件失败:', error)
            this.logSummary('delete', {
                key,
                ok: false,
                error: error instanceof Error ? error.message : String(error)
            })
            return false
        }
    }

    /**
     * 检查文件是否存在
     */
    async fileExists(key: string): Promise<boolean> {
        try {
            const { response, fullKey, baseUrl } = await this.headObject(key)
            const exists = response.ok

            this.logSummary('head', {
                key,
                fullKey,
                url: response.url,
                status: response.status,
                ok: exists,
                presigned: response.url !== baseUrl
            })

            return exists
        } catch (_error) {
            this.logSummary('head', {
                key,
                ok: false
            })
            return false
        }
    }

    private async headObject(
        key: string
    ): Promise<{ response: Response; fullKey: string; baseUrl: string }> {
        const fullKey = this.getFullKey(key)

        // 统一使用buildUrl方法构建URL
        const url = this.buildUrl(`/${fullKey}`)

        const { requestUrl, headers } = await this.prepareRequest('HEAD', url)

        const response = await fetch(requestUrl, {
            method: 'HEAD',
            headers
        })

        return {
            response,
            fullKey,
            baseUrl: url
        }
    }

    /**
     * 构建完整的对象键名
     */
    private getFullKey(key: string): string {
        const normalizedKey = key.replace(/^\/+/, '')

        const rawPrefix = (this.config.prefix || '').replace(/^\/+/, '')
        if (!rawPrefix) {
            return normalizedKey
        }

        const normalizedPrefix = rawPrefix.endsWith('/') ? rawPrefix : `${rawPrefix}/`
        return normalizedPrefix + normalizedKey
    }

    /**
     * 构建URL
     */
    private buildUrl(path: string): string {
        if (this.config.endpoint) {
            // 使用自定义端点 - 七牛云等服务
            const { resolvedEndpoint: endpoint } = this.resolveEndpoint(this.config.endpoint)

            // 移除末尾的斜杠
            const normalizedEndpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint

            // 七牛云的S3端点格式：https://bucket-name.s3.region.qiniucs.com
            // bucket名称已经包含在域名中，路径应该直接从prefix开始
            if (normalizedEndpoint.includes('qiniucs.com') || normalizedEndpoint.includes(this.config.bucketName)) {
                // 对于七牛云，路径不应该包含bucket名称
                let cleanPath = path

                // 如果路径以 /bucket-name/ 开头，需要移除它
                const bucketSlashPrefix = `/${this.config.bucketName}/`
                if (cleanPath.startsWith(bucketSlashPrefix)) {
                    cleanPath = cleanPath.substring(bucketSlashPrefix.length)
                }

                const bucketDirectPrefix = `/${this.config.bucketName}`
                if (cleanPath === bucketDirectPrefix) {
                    cleanPath = ''
                } else if (cleanPath.startsWith(`${bucketDirectPrefix}?`)) {
                    cleanPath = cleanPath.substring(bucketDirectPrefix.length)
                }

                // 确保路径以 / 开头
                const finalPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`
                return `${normalizedEndpoint}${finalPath}`
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

    private async prepareRequest(
        method: string,
        url: string,
        additionalHeaders: Record<string, string> = {},
        payload: string | ArrayBuffer | null = null
    ): Promise<{ requestUrl: string; headers: Record<string, string> }> {
        if (this.isQiniu()) {
            const normalizedHeaders = this.getQiniuSignedHeaders(additionalHeaders)
            const { requestUrl: presignedUrl, signedHeaders } = await this.createPresignedUrl(
                method,
                url,
                60,
                normalizedHeaders
            )

            return {
                requestUrl: presignedUrl,
                headers: this.filterHeadersBySignedList(additionalHeaders, signedHeaders)
            }
        }

        const headers = await this.createAuthHeaders(method, url, additionalHeaders, payload)

        return {
            requestUrl: url,
            headers
        }
    }

    private isQiniu(): boolean {
        return !!this.config.endpoint && this.config.endpoint.includes('qiniu')
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

    private getQiniuSignedHeaders(headers: Record<string, string>): Record<string, string> {
        const signedHeaders: Record<string, string> = {}

        Object.entries(headers).forEach(([key, value]) => {
            const lowerKey = key.toLowerCase()

            // 只签名浏览器安全允许的简单头，避免触发额外的CORS预检
            if (lowerKey === 'content-type') {
                signedHeaders[lowerKey] = value.trim()
            }
        })

        return signedHeaders
    }

    private filterHeadersBySignedList(
        headers: Record<string, string>,
        signedHeaders: string[]
    ): Record<string, string> {
        const normalizedSigned = new Set(signedHeaders.map(header => header.toLowerCase()))
        const filtered: Record<string, string> = {}

        Object.entries(headers).forEach(([key, value]) => {
            if (normalizedSigned.has(key.toLowerCase())) {
                filtered[key] = value
            }
        })

        return filtered
    }

    private async createPresignedUrl(
        method: string,
        url: string,
        expiresInSeconds = 60,
        headersToSign: Record<string, string> = {}
    ): Promise<{ requestUrl: string; signedHeaders: string[] }> {
        const requestUrl = new URL(url)

        const now = new Date()
        const amzDate = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
        const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')
        const credentialScope = `${dateStamp}/${this.config.region}/s3/aws4_request`

        requestUrl.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256')
        requestUrl.searchParams.set('X-Amz-Credential', `${this.config.accessKeyId}/${credentialScope}`)
        requestUrl.searchParams.set('X-Amz-Date', amzDate)
        requestUrl.searchParams.set('X-Amz-Expires', expiresInSeconds.toString())
        requestUrl.searchParams.set('X-Amz-Content-Sha256', 'UNSIGNED-PAYLOAD')

        const canonicalHeadersMap = new Map<string, string>()
        canonicalHeadersMap.set('host', requestUrl.host)

        Object.entries(headersToSign).forEach(([key, value]) => {
            canonicalHeadersMap.set(key.toLowerCase(), value.trim())
        })

        const sortedHeaderKeys = Array.from(canonicalHeadersMap.keys()).sort()
        const canonicalHeaders = sortedHeaderKeys
            .map(key => `${key}:${canonicalHeadersMap.get(key)}`)
            .join('\n') + '\n'

        requestUrl.searchParams.set('X-Amz-SignedHeaders', sortedHeaderKeys.join(';'))

        const canonicalRequest = [
            method.toUpperCase(),
            this.getCanonicalUri(requestUrl.pathname),
            this.getCanonicalQueryString(requestUrl.searchParams),
            canonicalHeaders,
            sortedHeaderKeys.join(';'),
            'UNSIGNED-PAYLOAD'
        ].join('\n')

        const stringToSign = [
            'AWS4-HMAC-SHA256',
            amzDate,
            credentialScope,
            await this.hashSha256(canonicalRequest)
        ].join('\n')

        const signingKey = await this.getSignatureKey(dateStamp)
        const signature = await this.hmacSha256Hex(signingKey, stringToSign)

        requestUrl.searchParams.set('X-Amz-Signature', signature)

        return {
            requestUrl: requestUrl.toString(),
            signedHeaders: sortedHeaderKeys
        }
    }

    private logSummary(event: string, detail: Record<string, unknown>): void {
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
            console.warn(`[S3:${event}]`, detail)
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
