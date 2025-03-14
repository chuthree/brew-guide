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
    output: 'standalone',
    experimental: {
        // 启用 CSS 优化
        optimizeCss: true,
    },
    // 增加静态页面生成超时时间
    staticPageGenerationTimeout: 180,
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
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
            }
        ]
    }
};

export default withPWA(nextConfig); 