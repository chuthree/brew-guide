'use client';

import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export default function DebugLogger() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const isNative = Capacitor.isNativePlatform();
  
  useEffect(() => {
    // 覆盖原始console方法
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    // 添加新日志
    const addLog = (type: string, ...args: any[]) => {
      const log = `[${type}] ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : arg
      ).join(' ')}`;
      
      setLogs(prev => {
        const newLogs = [log, ...prev];
        // 保留最新的20条日志
        return newLogs.slice(0, 20);
      });
    };
    
    // 重写console方法
    console.log = (...args) => {
      originalLog.apply(console, args);
      addLog('LOG', ...args);
    };
    
    console.error = (...args) => {
      originalError.apply(console, args);
      addLog('ERROR', ...args);
    };
    
    console.warn = (...args) => {
      originalWarn.apply(console, args);
      addLog('WARN', ...args);
    };
    
    // 清理函数
    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);
  
  // 仅在开发模式或移动端显示
  const shouldShow = isVisible && (process.env.NODE_ENV === 'development' || isNative);
  if (!shouldShow) {
    return null;
  }
  
  return (
    <div className="fixed bottom-0 left-0 right-0 max-h-72 overflow-auto bg-neutral-100 dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 z-50 p-2 text-xs font-mono">
      <div className="flex justify-between items-center mb-1">
        <h3 className="font-bold">Debug Logs {isNative ? '(移动端)' : '(网页端)'}</h3>
        <div className="flex gap-2">
          <button onClick={() => setLogs([])} className="px-2 py-1 text-xs bg-blue-500 text-white rounded">
            清除
          </button>
          <button onClick={() => setIsVisible(false)} className="px-2 py-1 text-xs bg-red-500 text-white rounded">
            关闭
          </button>
        </div>
      </div>
      <div className="space-y-1">
        {logs.map((log, i) => (
          <div key={i} className={`p-1 ${
            log.includes('[ERROR]') ? 'text-red-500' : 
            log.includes('[WARN]') ? 'text-yellow-500' : 'text-neutral-400 dark:text-neutral-300'
          }`}>
            {log}
          </div>
        ))}
      </div>
    </div>
  );
} 