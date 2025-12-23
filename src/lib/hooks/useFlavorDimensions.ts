import { useState, useEffect } from 'react';
import { FlavorDimension, DEFAULT_FLAVOR_DIMENSIONS } from '@/lib/core/db';
import {
  getFlavorDimensionsSync,
  getHistoricalLabelsSync,
} from '@/lib/stores/settingsStore';

/**
 * 自定义Hook：获取评分维度数据
 */
export const useFlavorDimensions = () => {
  const [dimensions, setDimensions] = useState<FlavorDimension[]>(() =>
    getFlavorDimensionsSync()
  );
  const [historicalLabels, setHistoricalLabels] = useState<
    Record<string, string>
  >(() => getHistoricalLabelsSync());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 初始化加载
    setDimensions(getFlavorDimensionsSync());
    setHistoricalLabels(getHistoricalLabelsSync());

    const handleFlavorDimensionsChange = (event: CustomEvent) => {
      const { dimensions: newDimensions } = event.detail;
      setDimensions(newDimensions);
      // 同时更新历史标签
      setHistoricalLabels(getHistoricalLabelsSync());
    };

    // 监听评分维度变化
    window.addEventListener(
      'flavorDimensionsChanged',
      handleFlavorDimensionsChange as EventListener
    );

    return () => {
      window.removeEventListener(
        'flavorDimensionsChanged',
        handleFlavorDimensionsChange as EventListener
      );
    };
  }, []);

  /**
   * 根据维度ID获取维度标签（支持历史标签）
   */
  const getDimensionLabel = (id: string): string => {
    // 首先尝试从当前维度中查找
    const currentDimension = dimensions.find(d => d.id === id);
    if (currentDimension) {
      return currentDimension.label;
    }

    // 如果当前维度中没有，从历史标签中查找
    if (historicalLabels[id]) {
      return historicalLabels[id];
    }

    // 如果历史标签中也没有，返回人性化的默认标签
    if (id.startsWith('custom_')) {
      return '已删除的评分维度';
    }

    return id;
  };

  /**
   * 获取所有有效的风味评分（当至少有一个评分大于0时，返回所有评分）
   */
  const getValidTasteRatings = (
    taste: Record<string, number>
  ): Array<{ id: string; label: string; value: number }> => {
    // 检查是否有任何评分大于0
    const hasAnyRating = Object.values(taste).some(value => value > 0);

    // 如果没有任何评分大于0，返回空数组
    if (!hasAnyRating) {
      return [];
    }

    // 如果至少有一个评分大于0，返回所有评分（包括为0的）
    const validRatings = Object.entries(taste)
      .filter(([_, value]) => value >= 0)
      .map(([id, value]) => ({
        id,
        label: getDimensionLabel(id),
        value,
      }));

    // 按照当前维度的order进行排序
    return validRatings.sort((a, b) => {
      const dimA = dimensions.find(d => d.id === a.id);
      const dimB = dimensions.find(d => d.id === b.id);

      // 获取order值，如果维度不存在则使用999作为默认值
      const orderA = dimA?.order ?? 999;
      const orderB = dimB?.order ?? 999;

      // 如果order相同，按标签字母顺序排序
      if (orderA === orderB) {
        return a.label.localeCompare(b.label);
      }

      return orderA - orderB;
    });
  };

  return {
    dimensions,
    loading,
    getDimensionLabel,
    getValidTasteRatings,
    historicalLabels,
  };
};
