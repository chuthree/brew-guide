'use client';

import { useCallback, useEffect } from 'react';
import type { CoffeeBean } from '@/types/app';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';

/**
 * 冲煮界面专用的咖啡豆数据 Hook
 * 直接从 Zustand Store 获取数据，保持数据一致性
 */
export const useCoffeeBeanData = () => {
  const beans = useCoffeeBeanStore(state => state.beans);
  const isLoading = useCoffeeBeanStore(state => state.isLoading);
  const initialized = useCoffeeBeanStore(state => state.initialized);
  const loadBeans = useCoffeeBeanStore(state => state.loadBeans);

  // 初始化时确保数据已加载
  useEffect(() => {
    if (!initialized && !isLoading) {
      loadBeans();
    }
  }, [initialized, isLoading, loadBeans]);

  // 根据 ID 查找咖啡豆
  const findBeanById = useCallback(
    (id: string): CoffeeBean | null => {
      return beans.find(bean => bean.id === id) || null;
    },
    [beans]
  );

  // 根据名称查找咖啡豆
  const findBeanByName = useCallback(
    (name: string): CoffeeBean | null => {
      return beans.find(bean => bean.name === name) || null;
    },
    [beans]
  );

  // 获取可用的咖啡豆（过滤掉用完的和在途的）
  const getAvailableBeans = useCallback(() => {
    return beans.filter(bean => {
      if (bean.isInTransit) return false;
      if (!bean.capacity || bean.capacity === '0' || bean.capacity === '0g')
        return true;
      const remaining =
        typeof bean.remaining === 'string'
          ? parseFloat(bean.remaining)
          : Number(bean.remaining);
      return remaining > 0;
    });
  }, [beans]);

  return {
    beans,
    isLoading,
    error: null,
    loadBeans,
    findBeanById,
    findBeanByName,
    getAvailableBeans,
    totalBeans: beans.length,
    availableBeans: getAvailableBeans(),
    isCacheValid: initialized,
  };
};

/**
 * 清除全局缓存（已废弃，保留兼容性）
 */
export const clearGlobalBeanCache = () => {
  // Store 自动管理，无需手动清除
};
