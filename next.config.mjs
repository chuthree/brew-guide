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
    // 优化图像配置以提升性能
    images: {
        unoptimized: true, // 静态导出模式需要
        domains: ['localhost'],
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
        // 添加图片格式优化
        formats: ['image/webp', 'image/avif'],
        // 预定义尺寸以减少布局偏移
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    },
    // 增加静态页面生成超时时间
    staticPageGenerationTimeout: 180,
    // 配置 webpack 以支持 CSV 文件和性能优化
    webpack: (config, { dev, isServer }) => {
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

        // 性能优化配置
        if (!dev && !isServer) {
            // 启用代码分割优化
            config.optimization = {
                ...config.optimization,
                splitChunks: {
                    ...config.optimization.splitChunks,
                    cacheGroups: {
                        ...config.optimization.splitChunks.cacheGroups,
                        // 将大型库单独打包
                        vendor: {
                            test: /[\\/]node_modules[\\/](react|react-dom|framer-motion|lucide-react)[\\/]/,
                            name: 'vendor',
                            chunks: 'all',
                        },
                        // 将UI组件库单独打包
                        ui: {
                            test: /[\\/]node_modules[\\/](@radix-ui|vaul)[\\/]/,
                            name: 'ui',
                            chunks: 'all',
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