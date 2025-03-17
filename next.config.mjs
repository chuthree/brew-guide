// 检查当前环境
const isDev = process.env.NODE_ENV === 'development';

// 配置 PWA
import nextPWA from 'next-pwa';

// 仅在生产环境中启用 PWA
const withPWA = isDev
    ? (config) => config // 开发环境中不启用 PWA
    : nextPWA({
        dest: 'public',
        register: true,
        skipWaiting: true,
        disable: false,
        buildExcludes: [
            /app-build-manifest\.json$/,
            /_buildManifest\.js$/,
            /_ssgManifest\.js$/,
            /middleware-manifest\.json$/,
            /middleware-runtime\.js$/
        ],
        runtimeCaching: [
            {
                urlPattern: /^https?.*/,
                handler: 'NetworkFirst',
                options: {
                    cacheName: 'offline-cache',
                    networkTimeoutSeconds: 10,
                    expiration: {
                        maxEntries: 200,
                        maxAgeSeconds: 24 * 60 * 60 // 24 hours
                    },
                    cacheableResponse: {
                        statuses: [0, 200]
                    }
                }
            },
            {
                urlPattern: /\/$/,
                handler: 'NetworkFirst',
                options: {
                    cacheName: 'html-cache',
                    networkTimeoutSeconds: 10,
                    expiration: {
                        maxEntries: 10,
                        maxAgeSeconds: 24 * 60 * 60 // 24 hours
                    },
                    cacheableResponse: {
                        statuses: [0, 200]
                    }
                }
            },
            {
                urlPattern: /\/_next\/static\/.*/i,
                handler: 'CacheFirst',
                options: {
                    cacheName: 'static-resources',
                    expiration: {
                        maxEntries: 200,
                        maxAgeSeconds: 24 * 60 * 60 * 30 // 30 days
                    },
                    cacheableResponse: {
                        statuses: [0, 200]
                    }
                }
            },
            {
                urlPattern: /\/_next\/image\?url=.+/i,
                handler: 'CacheFirst',
                options: {
                    cacheName: 'next-image',
                    expiration: {
                        maxEntries: 100,
                        maxAgeSeconds: 24 * 60 * 60 // 24 hours
                    },
                    cacheableResponse: {
                        statuses: [0, 200]
                    }
                }
            },
            {
                urlPattern: /\.(?:mp3)$/i,
                handler: 'CacheFirst',
                options: {
                    cacheName: 'audio',
                    expiration: {
                        maxEntries: 10,
                        maxAgeSeconds: 24 * 60 * 60 * 30 // 30 days
                    },
                    cacheableResponse: {
                        statuses: [0, 200]
                    }
                }
            },
            {
                urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
                handler: 'CacheFirst',
                options: {
                    cacheName: 'images',
                    expiration: {
                        maxEntries: 100,
                        maxAgeSeconds: 24 * 60 * 60 * 30 // 30 days
                    },
                    cacheableResponse: {
                        statuses: [0, 200]
                    }
                }
            }
        ]
    });

/** @type {import('next').NextConfig} */
const nextConfig = {
    devIndicators: false,
    reactStrictMode: true,
    // 为 Capacitor 启用静态导出模式
    output: 'export',
    // 禁用图像优化，因为在静态导出模式下不支持
    images: {
        unoptimized: true,
        domains: ['localhost'],
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
    experimental: {
        // 启用 CSS 优化
        optimizeCss: true,
    },
    // 增加静态页面生成超时时间
    staticPageGenerationTimeout: 180,
    // 注意：在静态导出模式下，headers 配置不会自动生效
    // 但我们保留这个配置，以便在非静态导出模式下使用
    // 如果您需要这些 headers，请考虑在部署时通过服务器配置添加它们
    /* 
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=()'
                    },
                    {
                        key: 'Cache-Control',
                        value: isDev
                            ? 'no-store, must-revalidate'
                            : 'public, max-age=3600, must-revalidate'
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff'
                    }
                ]
            },
            // 添加正确的 MIME 类型配置
            {
                source: '/_next/static/chunks/(.*)',
                headers: [
                    {
                        key: 'Content-Type',
                        value: 'application/javascript'
                    }
                ]
            },
            {
                source: '/manifest.json',
                headers: [
                    {
                        key: 'Content-Type',
                        value: 'application/manifest+json'
                    }
                ]
            }
        ]
    }
    */
};

export default withPWA(nextConfig); 