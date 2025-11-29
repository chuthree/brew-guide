/**
 * Service Worker 生成脚本
 * 使用 Google Workbox 官方工具生成 Service Worker
 *
 * 文档参考:
 * - Workbox: https://developer.chrome.com/docs/workbox
 * - generateSW API: https://developer.chrome.com/docs/workbox/reference/workbox-build#method-generateSW
 *
 * 运行时机: next build 之后执行
 */

import { generateSW } from 'workbox-build';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

async function buildSW() {
  const outDir = join(rootDir, 'out');

  console.log('📦 Generating Service Worker with Workbox...');

  try {
    const { count, size, warnings } = await generateSW({
      // 输出目录
      swDest: join(outDir, 'sw.js'),

      // 扫描的目录
      globDirectory: outDir,

      // 要预缓存的文件模式
      // 预缓存 = 构建时确定的静态资源，安装 SW 时立即下载并缓存
      globPatterns: [
        // Next.js 静态资源（带哈希的文件，内容不变）
        '_next/static/**/*.{js,css,woff,woff2}',
        // 静态图片
        'images/**/*.{png,jpg,jpeg,svg,ico,webp}',
        // 音频文件
        'sounds/*.mp3',
        // 数据文件
        'data/*.csv',
        // PWA 必需文件
        'manifest.json',
        // HTML 页面（静态导出的页面）
        '*.html',
      ],

      // 忽略的文件
      globIgnores: [
        '**/node_modules/**',
        'sw.js',
        'workbox-*.js',
        // 不缓存 SEO 文件，这些文件不影响用户体验
        'robots.txt',
        'sitemap.xml',
        '*.txt',
      ],

      // 跳过等待，新 SW 立即激活（用户下次访问即可获得新版本）
      skipWaiting: true,

      // 立即控制所有客户端
      clientsClaim: true,

      // 清理旧版本缓存
      cleanupOutdatedCaches: true,

      // 离线后备页面（可选，如果需要自定义离线页面）
      // offlineFallback: '/offline.html',

      // 运行时缓存策略
      // 运行时缓存 = 用户访问时才缓存的资源
      runtimeCaching: [
        // ============================================
        // 页面导航 - NetworkFirst（网络优先）
        // 确保用户总是获得最新内容，离线时使用缓存
        // ============================================
        {
          urlPattern: ({ request }) => request.mode === 'navigate',
          handler: 'NetworkFirst',
          options: {
            cacheName: 'pages',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 24 * 60 * 60, // 1天
            },
            networkTimeoutSeconds: 3, // 3秒超时后使用缓存
          },
        },

        // ============================================
        // 第三方字体 - CacheFirst（缓存优先）
        // 字体文件不常变化，优先使用缓存提升性能
        // ============================================
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-webfonts',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 365 * 24 * 60 * 60, // 1年
            },
            cacheableResponse: {
              statuses: [0, 200], // 缓存 opaque 响应和成功响应
            },
          },
        },
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'google-fonts-stylesheets',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 7 * 24 * 60 * 60, // 7天
            },
          },
        },

        // ============================================
        // 静态资源 - StaleWhileRevalidate（先用缓存，后台更新）
        // 平衡性能和新鲜度
        // ============================================
        {
          urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2)$/i,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'static-font-assets',
            expiration: {
              maxEntries: 20,
              maxAgeSeconds: 30 * 24 * 60 * 60, // 30天
            },
          },
        },
        {
          urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp|avif)$/i,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'static-image-assets',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 30 * 24 * 60 * 60, // 30天
            },
          },
        },
        {
          urlPattern: /\.(?:css)$/i,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'static-style-assets',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 7 * 24 * 60 * 60, // 7天
            },
          },
        },

        // ============================================
        // JS 文件 - 区分 Next.js 静态和其他
        // ============================================
        // Next.js 带哈希的 JS - CacheFirst（内容由哈希保证不变）
        {
          urlPattern: /\/_next\/static\/.+\.js$/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'next-static-js-assets',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 365 * 24 * 60 * 60, // 1年（哈希变了就是新文件）
            },
          },
        },
        // 其他 JS 文件
        {
          urlPattern: /\.(?:js)$/i,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'static-js-assets',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 7 * 24 * 60 * 60,
            },
          },
        },

        // ============================================
        // 媒体文件 - CacheFirst + Range Requests
        // 音视频文件大，优先用缓存；支持 Range 请求（断点续传）
        // ============================================
        {
          urlPattern: /\.(?:mp3|wav|ogg)$/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'static-audio-assets',
            expiration: {
              maxEntries: 30,
              maxAgeSeconds: 30 * 24 * 60 * 60,
            },
            rangeRequests: true,
          },
        },
        {
          urlPattern: /\.(?:mp4|webm)$/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'static-video-assets',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 30 * 24 * 60 * 60,
            },
            rangeRequests: true,
          },
        },

        // ============================================
        // 数据文件 - NetworkFirst
        // 数据可能更新，优先获取最新，离线时用缓存
        // ============================================
        {
          urlPattern: /\.(?:json|xml|csv)$/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'static-data-assets',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 24 * 60 * 60,
            },
            networkTimeoutSeconds: 3,
          },
        },

        // ============================================
        // 跨域请求 - NetworkFirst（保守策略）
        // ============================================
        {
          urlPattern: ({ sameOrigin }) => !sameOrigin,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'cross-origin',
            networkTimeoutSeconds: 5,
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 60 * 60, // 1小时
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
      ],

      // 忽略 URL 参数（常见的追踪参数）
      ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^gclid$/, /^_ga$/],
    });

    // 输出警告
    if (warnings.length > 0) {
      console.warn('⚠️  Workbox warnings:');
      warnings.forEach(warning => console.warn('  -', warning));
    }

    console.log(`✅ Service Worker generated successfully!`);
    console.log(
      `   📁 Precached ${count} files (${(size / 1024 / 1024).toFixed(2)} MB)`
    );
  } catch (error) {
    console.error('❌ Failed to generate Service Worker:', error);
    process.exit(1);
  }
}

buildSW();
