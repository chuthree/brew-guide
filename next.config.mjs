import nextPWA from '@ducanh2912/next-pwa';

// 检查当前环境
const isDev = process.env.NODE_ENV === 'development';

const pwaConfig = {
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: isDev,
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
};

// 创建基础配置
const nextConfig = {
    reactStrictMode: true,
    // 为 Capacitor 启用静态导出模式
    output: 'export',
    // 图像配置
    images: {
        unoptimized: true, // 静态导出模式需要
        domains: ['localhost'],
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
    // 增加静态页面生成超时时间
    staticPageGenerationTimeout: 180,
    // 配置 webpack 以支持 CSV 文件
    webpack: (config) => {
        // CSV 文件支持
        config.module.rules.push({
            test: /\.csv$/,
            use: [
                {
                    loader: 'csv-loader',
                    options: {
                        dynamicTyping: true,
                        header: false,
                        skipEmptyLines: true
                    }
                }
            ]
        });

        // 修复静态导出时的webpack运行时问题
        if (config.mode === 'production') {
            config.optimization = {
                ...config.optimization,
                splitChunks: {
                    ...config.optimization.splitChunks,
                    cacheGroups: {
                        ...config.optimization.splitChunks?.cacheGroups,
                        default: false,
                        vendors: false,
                        // 创建一个包含所有vendor代码的chunk
                        vendor: {
                            name: 'vendor',
                            chunks: 'all',
                            test: /node_modules/,
                            priority: 20
                        },
                        // 创建一个包含公共代码的chunk
                        common: {
                            name: 'common',
                            chunks: 'all',
                            minChunks: 2,
                            priority: 10,
                            reuseExistingChunk: true
                        }
                    }
                }
            };
        }

        return config;
    }
};

// 应用 PWA 配置
const withPWAConfig = nextPWA(pwaConfig);
// next-pwa 类型定义问题
export default withPWAConfig(nextConfig);