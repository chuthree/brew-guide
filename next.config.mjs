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
      // SVGR 支持 - 将 SVG 转换为 React 组件
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },

  // 为兼容保留 webpack 配置，但添加空的 turbopack 配置以避免警告
  webpack: config => {
    // SVGR 配置 - 将 SVG 转换为 React 组件
    // 参考: https://react-svgr.com/docs/next/
    const fileLoaderRule = config.module.rules.find(rule =>
      rule.test?.test?.('.svg')
    );

    config.module.rules.push(
      // 使用 ?url 后缀时保持原有行为（作为 URL 导入）
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/,
      },
      // 其他 *.svg 导入转换为 React 组件
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] },
        use: [
          {
            loader: '@svgr/webpack',
            options: {
              svgoConfig: {
                plugins: [
                  {
                    name: 'preset-default',
                    params: {
                      overrides: {
                        // 保留 viewBox 以支持缩放
                        removeViewBox: false,
                        // 保留 currentColor 以支持颜色继承
                        convertColors: false,
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      }
    );

    // 修改原有的文件加载规则，忽略 *.svg
    if (fileLoaderRule) {
      fileLoaderRule.exclude = /\.svg$/i;
    }

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
