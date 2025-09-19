/**
 * WebDAV客户端 - 静态部署兼容版本
 * 使用fetch API实现，无需外部依赖，支持CORS代理
 */

import CORSProxyManager, { ProxyConfig } from './corsProxy'

export interface WebDAVConfig {
    serverUrl: string
    username: string
    password: string
    remotePath: string
    proxy?: ProxyConfig
}

export interface WebDAVFile {
    name: string
    path: string
    size: number
    lastModified: Date
    isDirectory: boolean
}

export class WebDAVClient {
    private config: WebDAVConfig
    private authHeader: string

    constructor(config: WebDAVConfig) {
        this.config = config
        this.authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`)
    }

    /**
     * 测试连接
     */
    async testConnection(): Promise<boolean> {
        try {
            const response = await this.propfind(this.config.remotePath, 0)
            return response.ok
        } catch (_error) {
            console.error('WebDAV连接测试失败:', _error)
            return false
        }
    }

    /**
     * 创建目录
     */
    async createDirectory(path: string): Promise<boolean> {
        try {
            const url = this.buildUrl(path)
            const headers = this.createHeaders({
                'Content-Type': 'application/xml'
            })

            const response = await fetch(url, {
                method: 'MKCOL',
                headers
            })
            return response.ok || response.status === 405 // 405表示目录已存在
        } catch (_error) {
            console.error('创建目录失败:', _error)
            return false
        }
    }

    /**
     * 上传文件
     */
    async uploadFile(remotePath: string, content: string | ArrayBuffer): Promise<boolean> {
        try {
            const url = this.buildUrl(remotePath)
            const headers = this.createHeaders({
                'Content-Type': remotePath.endsWith('.json') ? 'application/json' : 'application/octet-stream'
            })

            const response = await fetch(url, {
                method: 'PUT',
                headers,
                body: content
            })
            return response.ok
        } catch (_error) {
            console.error('上传文件失败:', _error)
            return false
        }
    }

    /**
     * 下载文件
     */
    async downloadFile(remotePath: string): Promise<string | null> {
        try {
            const url = this.buildUrl(remotePath)
            const headers = this.createHeaders()

            const response = await fetch(url, {
                method: 'GET',
                headers
            })

            if (response.ok) {
                return await response.text()
            }
            return null
        } catch (_error) {
            console.error('下载文件失败:', _error)
            return null
        }
    }

    /**
     * 列出目录内容
     */
    async listDirectory(remotePath: string): Promise<WebDAVFile[]> {
        try {
            const response = await this.propfind(remotePath, 1)
            if (!response.ok) {
                return []
            }

            const xmlText = await response.text()
            return this.parseDirectoryListing(xmlText, remotePath)
        } catch (_error) {
            console.error('列出目录失败:', _error)
            return []
        }
    }

    /**
     * 删除文件
     */
    async deleteFile(remotePath: string): Promise<boolean> {
        try {
            const url = this.buildUrl(remotePath)
            const headers = this.createHeaders()

            const response = await fetch(url, {
                method: 'DELETE',
                headers
            })
            return response.ok
        } catch (_error) {
            console.error('删除文件失败:', _error)
            return false
        }
    }

    /**
     * 检查文件是否存在
     */
    async fileExists(remotePath: string): Promise<boolean> {
        try {
            const url = this.buildUrl(remotePath)
            const headers = this.createHeaders()

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
     * 获取文件信息
     */
    async getFileInfo(remotePath: string): Promise<WebDAVFile | null> {
        try {
            const response = await this.propfind(remotePath, 0)
            if (!response.ok) {
                return null
            }

            const xmlText = await response.text()
            const files = this.parseDirectoryListing(xmlText, remotePath)
            return files.length > 0 ? files[0] : null
        } catch (_error) {
            console.error('获取文件信息失败:', _error)
            return null
        }
    }

    /**
     * 构建完整URL（包含代理）
     */
    private buildUrl(path: string): string {
        const baseUrl = this.config.serverUrl.replace(/\/$/, '')
        const cleanPath = path.startsWith('/') ? path : `/${path}`
        const originalUrl = `${baseUrl}${cleanPath}`

        // 应用代理配置
        if (this.config.proxy) {
            return CORSProxyManager.getProxiedUrl(originalUrl, this.config.proxy)
        }

        return originalUrl
    }

    /**
     * 创建请求headers（包含代理相关headers）
     */
    private createHeaders(additionalHeaders: HeadersInit = {}): HeadersInit {
        const baseHeaders = {
            'Authorization': this.authHeader,
            ...additionalHeaders
        }

        // 如果使用代理，添加代理相关headers
        if (this.config.proxy) {
            return CORSProxyManager.createProxyHeaders(baseHeaders, this.config.proxy)
        }

        return baseHeaders
    }

    /**
     * 执行PROPFIND请求
     */
    private async propfind(path: string, depth: number): Promise<Response> {
        const url = this.buildUrl(path)
        const propfindXml = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:">
    <D:allprop/>
</D:propfind>`

        const headers = this.createHeaders({
            'Content-Type': 'application/xml',
            'Depth': depth.toString()
        })

        return fetch(url, {
            method: 'PROPFIND',
            headers,
            body: propfindXml
        })
    }

    /**
     * 解析目录列表XML
     */
    private parseDirectoryListing(xmlText: string, basePath: string): WebDAVFile[] {
        try {
            const parser = new DOMParser()
            const doc = parser.parseFromString(xmlText, 'text/xml')
            const responses = doc.querySelectorAll('response')
            const files: WebDAVFile[] = []

            responses.forEach(response => {
                const hrefElement = response.querySelector('href')
                const propstatElement = response.querySelector('propstat')

                if (!hrefElement || !propstatElement) return

                const href = hrefElement.textContent || ''
                const decodedHref = decodeURIComponent(href)

                // 跳过当前目录本身
                if (decodedHref === basePath || decodedHref === basePath + '/') return

                const resourcetypeElement = propstatElement.querySelector('resourcetype')
                const isDirectory = resourcetypeElement?.querySelector('collection') !== null

                const getlastmodifiedElement = propstatElement.querySelector('getlastmodified')
                const getcontentlengthElement = propstatElement.querySelector('getcontentlength')

                const lastModified = getlastmodifiedElement?.textContent
                    ? new Date(getlastmodifiedElement.textContent)
                    : new Date()

                const size = getcontentlengthElement?.textContent
                    ? parseInt(getcontentlengthElement.textContent, 10)
                    : 0

                const pathParts = decodedHref.split('/')
                const name = pathParts[pathParts.length - (isDirectory ? 2 : 1)] || 'Unknown'

                files.push({
                    name,
                    path: decodedHref,
                    size,
                    lastModified,
                    isDirectory
                })
            })

            return files
        } catch (_error) {
            console.error('解析目录列表失败:', _error)
            return []
        }
    }
}

export default WebDAVClient