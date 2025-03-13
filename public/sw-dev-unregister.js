// 在开发环境中卸载 Service Worker
(function () {
    // 确保代码在浏览器环境中运行
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    if ('serviceWorker' in navigator &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        console.log('开发环境：准备卸载 Service Worker');

        navigator.serviceWorker.getRegistrations().then(function (registrations) {
            if (registrations.length === 0) {
                console.log('没有找到已注册的 Service Worker');
                return;
            }

            for (let registration of registrations) {
                registration.unregister();
                console.log('已卸载 Service Worker');
            }
        }).catch(function (err) {
            console.error('卸载 Service Worker 时出错:', err);
        });

        // 清除缓存
        if ('caches' in window) {
            caches.keys().then(function (cacheNames) {
                if (cacheNames.length === 0) {
                    console.log('没有找到缓存');
                    return;
                }

                cacheNames.forEach(function (cacheName) {
                    caches.delete(cacheName);
                    console.log('已删除缓存:', cacheName);
                });
            }).catch(function (err) {
                console.error('删除缓存时出错:', err);
            });
        }
    }
})(); 