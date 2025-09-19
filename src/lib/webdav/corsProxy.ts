/**
 * CORS代理工具
 * 为静态部署的应用提供WebDAV CORS解决方案
 */

export interface ProxyConfig {
    enabled: boolean
    type: 'cors-anywhere' | 'allorigins' | 'custom'
    customUrl?: string
}

export class CORSProxyManager {
    private static readonly PROXY_SERVICES = {
        'cors-anywhere': 'https://cors-anywhere.herokuapp.com/',
        'allorigins': 'https://api.allorigins.win/raw?url=',
        // 可以添加更多公共代理服务
    }

    /**
     * 获取代理后的URL
     */
    static getProxiedUrl(originalUrl: string, config: ProxyConfig): string {
        if (!config.enabled) {
            return originalUrl
        }

        switch (config.type) {
            case 'cors-anywhere':
                return this.PROXY_SERVICES['cors-anywhere'] + originalUrl

            case 'allorigins':
                return this.PROXY_SERVICES['allorigins'] + encodeURIComponent(originalUrl)

            case 'custom':
                if (config.customUrl) {
                    const proxyUrl = config.customUrl.endsWith('/')
                        ? config.customUrl
                        : config.customUrl + '/'
                    return proxyUrl + originalUrl
                }
                return originalUrl

            default:
                return originalUrl
        }
    }

    /**
     * 测试代理服务是否可用
     */
    static async testProxy(config: ProxyConfig): Promise<boolean> {
        if (!config.enabled) return true

        try {
            const testUrl = this.getProxiedUrl('https://httpbin.org/get', config)
            const response = await fetch(testUrl, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            return response.ok
        } catch (error) {
            console.error('代理测试失败:', error)
            return false
        }
    }

    /**
     * 获取推荐的代理配置
     */
    static getRecommendedConfig(): ProxyConfig {
        return {
            enabled: true,
            type: 'cors-anywhere'
        }
    }

    /**
     * 创建代理请求的headers
     */
    static createProxyHeaders(originalHeaders: HeadersInit = {}, config: ProxyConfig): HeadersInit {
        const headers = new Headers(originalHeaders)

        // 为某些代理服务添加特殊headers
        if (config.enabled) {
            switch (config.type) {
                case 'cors-anywhere':
                    headers.set('X-Requested-With', 'XMLHttpRequest')
                    break
                case 'allorigins':
                    // AllOrigins 不需要特殊headers
                    break
            }
        }

        return headers
    }
}

export default CORSProxyManager