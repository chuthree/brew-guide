'use client';

import { useEffect, useRef } from 'react';

/**
 * 开发工具组件
 * 仅在开发环境下启用 react-scan 和 stats.js
 */
export function DevTools() {
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 仅在开发环境下运行
    if (process.env.NODE_ENV !== 'development') return;

    let stats: InstanceType<typeof import('stats.js').default> | null = null;
    let animationId: number;

    // 初始化 react-scan
    const initReactScan = async () => {
      try {
        const { scan } = await import('react-scan');
        scan({
          enabled: true,
          log: true, // 在控制台输出渲染信息
        });
        console.log('✅ React Scan 已启用');
      } catch (error) {
        console.error('❌ React Scan 初始化失败:', error);
      }
    };

    // 初始化 stats.js
    const initStats = async () => {
      try {
        const Stats = (await import('stats.js')).default;
        stats = new Stats();
        stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
        stats.dom.style.cssText =
          'position:fixed;top:0;left:0;cursor:pointer;opacity:0.9;z-index:10000;';

        if (statsRef.current) {
          statsRef.current.appendChild(stats.dom);
        }

        // 动画循环更新 stats
        const animate = () => {
          stats?.begin();
          stats?.end();
          animationId = requestAnimationFrame(animate);
        };
        animationId = requestAnimationFrame(animate);

        console.log('✅ Stats.js 已启用 (点击面板切换显示模式)');
      } catch (error) {
        console.error('❌ Stats.js 初始化失败:', error);
      }
    };

    initReactScan();
    initStats();

    // 清理函数
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (stats && statsRef.current) {
        statsRef.current.removeChild(stats.dom);
      }
    };
  }, []);

  // 仅在开发环境下渲染
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return <div ref={statsRef} />;
}

export default DevTools;
