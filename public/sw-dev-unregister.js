// 简化的开发环境Service Worker清理脚本
(function() {
  // 仅在开发环境执行
  if (typeof window === 'undefined' || 
      typeof navigator === 'undefined' ||
      !('serviceWorker' in navigator) ||
      (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')) {
    return;
  }

  console.log('[开发模式] 清理Service Worker缓存');

  window.addEventListener('load', async function() {
    try {
      // 清理Service Worker注册
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
      
      // 清理所有缓存
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      
      console.log('[开发模式] Service Worker和缓存已清理');
    } catch (error) {
      console.error('[开发模式] 清理失败:', error);
    }
  });
})(); 