// Next.js 配置
// PWA Service Worker 由 scripts/generate-sw.mjs 在构建后生成（使用 Google Workbox）

const nextConfig = {
  reactStrictMode: true,
  // 启用 React Compiler
  reactCompiler: true,
  // 为 Capacitor 启用静态导出模式
  output: 'export',
  // 图像配置
  images: {
    unoptimized: true, // 静态导出模式需要
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // 增加静态页面生成超时时间
  staticPageGenerationTimeout: 180,

  // Turbopack 配置
  turbopack: {
    rules: {
      // CSV 文件支持
      '*.csv': {
        loaders: ['csv-loader'],
        as: '*.js',
      },
    },
  },

  // 为兼容保留 webpack 配置，但添加空的 turbopack 配置以避免警告
  webpack: config => {
    // CSV 文件支持
    config.module.rules.push({
      test: /\.csv$/,
      use: [
        {
          loader: 'csv-loader',
          options: {
            dynamicTyping: true,
            header: false,
            skipEmptyLines: true,
          },
        },
      ],
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
              reuseExistingChunk: true,
            },
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: -10,
              chunks: 'all',
            },
          },
        },
        // 使用单独的运行时chunk，但确保正确加载
        runtimeChunk: {
          name: 'runtime',
        },
      };
    }

    return config;
  },
};

export default nextConfig;
