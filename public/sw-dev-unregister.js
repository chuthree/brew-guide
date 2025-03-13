// 在开发环境中卸载 Service Worker
(function () {
    // 确保代码在浏览器环境中运行
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    // 检查是否在开发环境
    if ('serviceWorker' in navigator &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        console.log('开发环境：准备卸载 Service Worker');

        // 添加页面加载事件，确保在页面完全加载后执行
        window.addEventListener('load', function () {
            // 卸载所有 Service Worker
            navigator.serviceWorker.getRegistrations().then(function (registrations) {
                if (registrations.length === 0) {
                    console.log('没有找到已注册的 Service Worker');
                } else {
                    for (let registration of registrations) {
                        registration.unregister().then(function (success) {
                            if (success) {
                                console.log('成功卸载 Service Worker:', registration.scope);
                                // 强制刷新页面以应用更改
                                if (window.sessionStorage.getItem('sw_unregistered') !== 'true') {
                                    window.sessionStorage.setItem('sw_unregistered', 'true');
                                    window.location.reload(true);
                                }
                            } else {
                                console.log('无法卸载 Service Worker:', registration.scope);
                            }
                        });
                    }
                }
            }).catch(function (err) {
                console.error('卸载 Service Worker 时出错:', err);
            });

            // 清除所有缓存
            if ('caches' in window) {
                caches.keys().then(function (cacheNames) {
                    if (cacheNames.length === 0) {
                        console.log('没有找到缓存');
                    } else {
                        return Promise.all(
                            cacheNames.map(function (cacheName) {
                                console.log('正在删除缓存:', cacheName);
                                return caches.delete(cacheName).then(function (success) {
                                    console.log('缓存删除' + (success ? '成功' : '失败') + ':', cacheName);
                                });
                            })
                        );
                    }
                }).catch(function (err) {
                    console.error('删除缓存时出错:', err);
                });
            }
        });

        // 禁用浏览器的应用缓存
        if (window.applicationCache) {
            window.applicationCache.addEventListener('updateready', function () {
                window.applicationCache.swapCache();
                console.log('应用缓存已更新');
            });
        }
    }
})(); 