'use client';

import { useEffect } from 'react';
import { initCapacitor } from './capacitor';

export default function CapacitorInit() {
    useEffect(() => {
        // 在客户端组件挂载后初始化 Capacitor
        initCapacitor();
    }, []);

    // 这个组件不渲染任何内容
    return null;
} 