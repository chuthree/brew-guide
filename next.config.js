const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === 'development',
    buildExcludes: [/app-build-manifest\.json$/],
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
})

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
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
                        value: 'public, max-age=3600, must-revalidate'
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff'
                    }
                ]
            }
        ]
    }
}

module.exports = withPWA(nextConfig) 