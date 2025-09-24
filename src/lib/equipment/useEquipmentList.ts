/**
 * 器具列表管理的自定义Hook
 * 统一管理器具列表的加载、排序和事件订阅逻辑，避免重复代码
 */

import { useState, useEffect, useCallback } from 'react'
import { equipmentList, type CustomEquipment } from '@/lib/core/config'

export interface UseEquipmentListOptions {
  customEquipments: CustomEquipment[]
  transformItems?: <T extends { id: string; name: string; isCustom?: boolean }>(items: T[]) => T[]
}

export interface UseEquipmentListReturn<T = any> {
  allEquipments: T[]
  isLoading: boolean
  error: string | null
}

/**
 * 器具列表管理Hook
 * 处理器具列表的加载、排序和实时更新
 */
export function useEquipmentList<T = any>({
  customEquipments,
  transformItems
}: UseEquipmentListOptions): UseEquipmentListReturn<T> {
  const [allEquipments, setAllEquipments] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 加载和排序器具列表
  const loadSortedEquipments = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const { loadEquipmentOrder } = await import('@/lib/managers/customEquipments')
      const { equipmentUtils } = await import('@/lib/equipment/equipmentUtils')
      
      const equipmentOrder = await loadEquipmentOrder()
      const sortedEquipments = equipmentUtils.getAllEquipments(customEquipments, equipmentOrder)
      
      // 应用转换函数（如果提供）
      const finalEquipments = transformItems 
        ? transformItems(sortedEquipments)
        : sortedEquipments
      
      setAllEquipments(finalEquipments as T[])
    } catch (err) {
      console.error('加载器具排序失败:', err)
      setError(err instanceof Error ? err.message : '加载失败')
      
      // 使用默认排序作为回退
      const defaultEquipments = [
        ...equipmentList.map((eq) => ({ ...eq, isCustom: false })),
        ...customEquipments
      ]
      
      const finalEquipments = transformItems 
        ? transformItems(defaultEquipments)
        : defaultEquipments
      
      setAllEquipments(finalEquipments as T[])
    } finally {
      setIsLoading(false)
    }
  }, [customEquipments, transformItems])

  // 处理器具排序更新事件
  const handleEquipmentOrderUpdate = useCallback(async () => {
    try {
      const { loadEquipmentOrder } = await import('@/lib/managers/customEquipments')
      const { equipmentUtils } = await import('@/lib/equipment/equipmentUtils')
      
      const equipmentOrder = await loadEquipmentOrder()
      const sortedEquipments = equipmentUtils.getAllEquipments(customEquipments, equipmentOrder)
      
      const finalEquipments = transformItems 
        ? transformItems(sortedEquipments)
        : sortedEquipments
      
      setAllEquipments(finalEquipments as T[])
    } catch (err) {
      console.error('更新器具排序失败:', err)
      setError(err instanceof Error ? err.message : '更新失败')
    }
  }, [customEquipments, transformItems])

  // 初始化加载
  useEffect(() => {
    loadSortedEquipments()
  }, [loadSortedEquipments])

  // 订阅器具排序更新事件
  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    
    const setupEventListener = async () => {
      try {
        const { equipmentEventBus } = await import('@/lib/equipment/equipmentEventBus')
        unsubscribe = equipmentEventBus.subscribe(handleEquipmentOrderUpdate)
      } catch (err) {
        console.error('设置器具排序事件监听失败:', err)
      }
    }
    
    setupEventListener()
    
    return () => {
      unsubscribe?.()
    }
  }, [handleEquipmentOrderUpdate])

  return {
    allEquipments,
    isLoading,
    error
  }
}