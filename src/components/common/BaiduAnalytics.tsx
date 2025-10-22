'use client';

import { useEffect } from 'react';

// 百度统计组件
export function BaiduAnalytics() {
  useEffect(() => {
    // 只在客户端环境下加载百度统计
    if (typeof window !== 'undefined') {
      // 创建百度统计脚本
      const script = document.createElement('script');
      script.src =
        'https://hm.baidu.com/hm.js?1d5ab7c4016b8737328359797bfaac08';
      script.async = true;
      document.head.appendChild(script);

      // 初始化百度统计
      const initScript = document.createElement('script');
      initScript.innerHTML = `
        var _hmt = _hmt || [];
        // 添加单页应用支持
        _hmt.push(['_requirePlugin', 'UrlChangeTracker', {
          shouldTrackUrlChange: function (newPath, oldPath) {
            return newPath && oldPath;
          }
        }]);
      `;
      document.head.appendChild(initScript);

      // 清理函数
      return () => {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        if (initScript.parentNode) {
          initScript.parentNode.removeChild(initScript);
        }
      };
    }
  }, []);

  return null;
}
