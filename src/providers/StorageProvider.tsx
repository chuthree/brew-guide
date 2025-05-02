'use client'

import { useEffect, useState } from 'react'
import { Storage } from '@/lib/core/storage'

/**
 * 存储系统初始化组件
 * 在应用启动时初始化IndexedDB和其他存储系统
 */
export default function StorageInit() {
  const [initialized, setInitialized] = useState(false)
  
  useEffect(() => {
    async function initStorage() {
      if (!initialized) {
        try {
          await Storage.initialize()
          setInitialized(true)
        } catch (error) {
          console.error('存储系统初始化失败:', error)
        }
      }
    }
    
    initStorage()
  }, [initialized])
  
  // 这个组件不会渲染任何内容，它只是初始化存储系统
  return null
} 