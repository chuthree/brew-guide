import nextPWA from '@ducanh2912/next-pwa';

// 检查当前环境
const isDev = process.env.NODE_ENV === 'development';

const pwaConfig = {
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: isDev,
    // 强制清理过期缓存
    cleanupOutdatedCaches: true,
    // 添加更多构建排除项以避免缓存问题
    buildExcludes: [
        /app-build-manifest\.json$/,
        /_buildManifest\.js$/,
        /_ssgManifest\.js$/,
        /middleware-manifest\.json$/,
        /middleware-runtime\.js$/,
        /chunk-map\.json$/,
        /server-reference-manifest\.json$/,
        /next-font-manifest\.json$/
    ],
    runtimeCaching: [
        // HTML 页面使用 NetworkFirst 策略，确保获取最新内容
        {
            urlPattern: /^https?:\/\/.*\/(.*\.html)?$/,
            handler: 'NetworkFirst',
            options: {
                cacheName: 'html-cache',
                networkTimeoutSeconds: 5,
                expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 12 * 60 * 60 // 12 hours
                },
                cacheableResponse: {
                    statuses: [0, 200]
                }
            }
        },
        // 根路径特殊处理
        {
            urlPattern: /^https?:\/\/[^\/]+\/?$/,
            handler: 'NetworkFirst',
            options: {
                cacheName: 'root-cache',
                networkTimeoutSeconds: 3,
                expiration: {
                    maxEntries: 5,
                    maxAgeSeconds: 6 * 60 * 60 // 6 hours
                },
                cacheableResponse: {
                    statuses: [0, 200]
                }
            }
        },
        // JavaScript chunks 使用 NetworkFirst 策略确保最新代码
        {
            urlPattern: /\/_next\/static\/chunks\/.+\.js$/i,
            handler: 'NetworkFirst',
            options: {
                cacheName: 'js-chunks',
                networkTimeoutSeconds: 8,
                expiration: {
                    maxEntries: 150,
                    maxAgeSeconds: 12 * 60 * 60 // 12 hours
                },
                cacheableResponse: {
                    statuses: [0, 200]
                }
            }
        },
        // 运行时文件特殊处理
        {
            urlPattern: /\/_next\/static\/chunks\/runtime\..*\.js$/i,
            handler: 'NetworkFirst',
            options: {
                cacheName: 'runtime-chunks',
                networkTimeoutSeconds: 3,
                expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 6 * 60 * 60 // 6 hours
                },
                cacheableResponse: {
                    statuses: [0, 200]
                }
            }
        },
        // 其他静态资源仍使用 CacheFirst
        {
            urlPattern: /\/_next\/static\/(?!chunks\/).*/i,
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
            // 优化代码分割配置，而不是完全禁用
            config.optimization = {
                ...config.optimization,
                splitChunks: {
                    chunks: 'all',
                    cacheGroups: {
                        default: {
                            minChunks: 2,
                            priority: -20,
                            reuseExistingChunk: true
                        },
                        vendor: {
                            test: /[\\/]node_modules[\\/]/,
                            name: 'vendors',
                            priority: -10,
                            chunks: 'all'
                        }
                    }
                },
                // 使用单独的运行时chunk，但确保正确加载
                runtimeChunk: {
                    name: 'runtime'
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