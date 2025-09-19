/**
 * 适配静态部署的WebDAV客户端
 * 开发环境使用Next.js代理，生产环境直接连接
 */

export interface SimpleWebDAVConfig {
    serverUrl: string
    username: string
    password: string
    remotePath: string
}

export interface WebDAVFile {
    name: string
    path: string
    size: number
    lastModified: Date
    isDirectory: boolean
}

export class SimpleWebDAVClient {
    private config: SimpleWebDAVConfig
    private authHeader: string
    private isDev: boolean

    constructor(config: SimpleWebDAVConfig) {
        this.config = config
        this.authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`)
        // 生产环境总是直接连接
        this.isDev = false
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
            const response = await fetch(url, {
                method: 'MKCOL',
                headers: this.buildHeaders({
                    'Content-Type': 'application/xml'
                })
            })
            return response.ok || response.status === 405
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
            const response = await fetch(url, {
                method: 'PUT',
                headers: this.buildHeaders({
                    'Content-Type': remotePath.endsWith('.json') ? 'application/json' : 'application/octet-stream'
                }),
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
            const response = await fetch(url, {
                method: 'GET',
                headers: this.buildHeaders()
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
            const response = await fetch(url, {
                method: 'DELETE',
                headers: this.buildHeaders()
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
            const response = await fetch(url, {
                method: 'HEAD',
                headers: this.buildHeaders()
            })
            return response.ok
        } catch (_error) {
            return false
        }
    }

    /**
     * 构建URL
     */
    private buildUrl(path: string): string {
        const cleanPath = path.startsWith('/') ? path : `/${path}`

        if (this.isDev) {
            // 开发环境：使用Next.js rewrite代理
            return `/webdav-proxy${cleanPath}`
        } else {
            // 生产环境：直接连接WebDAV服务器
            const baseUrl = this.config.serverUrl.replace(/\/$/, '')
            return `${baseUrl}${cleanPath}`
        }
    }

    /**
     * 构建请求头
     */
    private buildHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
        return {
            'Authorization': this.authHeader,
            ...additionalHeaders
        }
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

        return fetch(url, {
            method: 'PROPFIND',
            headers: this.buildHeaders({
                'Content-Type': 'application/xml',
                'Depth': depth.toString()
            }),
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

export default SimpleWebDAVClient