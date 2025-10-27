/**
 * 自定义风味维度管理器
 * 提供风味评分维度的增删改查功能
 */

import { Storage } from '@/lib/core/storage';

// 风味维度接口
export interface FlavorDimension {
  id: string;
  label: string;
  order: number;
  isDefault: boolean;
}

// 默认风味维度
export const DEFAULT_FLAVOR_DIMENSIONS: FlavorDimension[] = [
  { id: 'acidity', label: '酸度', order: 0, isDefault: true },
  { id: 'sweetness', label: '甜度', order: 1, isDefault: true },
  { id: 'bitterness', label: '苦度', order: 2, isDefault: true },
  { id: 'body', label: '口感', order: 3, isDefault: true },
];

const STORAGE_KEY = 'customFlavorDimensions';
const HISTORICAL_LABELS_KEY = 'flavorDimensionHistoricalLabels';

// 🔥 添加内存缓存以避免重复读取存储
let dimensionsCache: FlavorDimension[] | null = null;
let historicalLabelsCache: Record<string, string> | null = null;

/**
 * 自定义风味维度管理器
 */
export const CustomFlavorDimensionsManager = {
  /**
   * 获取所有风味维度（带缓存）
   */
  async getFlavorDimensions(): Promise<FlavorDimension[]> {
    // 🔥 如果缓存存在，直接返回
    if (dimensionsCache !== null) {
      return dimensionsCache;
    }

    try {
      const stored = await Storage.get(STORAGE_KEY);
      if (stored) {
        const dimensions = JSON.parse(stored) as FlavorDimension[];
        // 按order排序
        dimensionsCache = dimensions.sort((a, b) => a.order - b.order);
        return dimensionsCache;
      }
      dimensionsCache = DEFAULT_FLAVOR_DIMENSIONS;
      return dimensionsCache;
    } catch (error) {
      console.error('获取风味维度失败:', error);
      dimensionsCache = DEFAULT_FLAVOR_DIMENSIONS;
      return dimensionsCache;
    }
  },

  /**
   * 获取历史维度标签映射（带缓存）
   */
  async getHistoricalLabels(): Promise<Record<string, string>> {
    // 🔥 如果缓存存在，直接返回
    if (historicalLabelsCache !== null) {
      return { ...historicalLabelsCache }; // 返回副本以防止外部修改
    }

    try {
      const stored = await Storage.get(HISTORICAL_LABELS_KEY);
      historicalLabelsCache = stored ? JSON.parse(stored) : {};
      return { ...historicalLabelsCache };
    } catch (error) {
      console.error('获取历史维度标签失败:', error);
      historicalLabelsCache = {};
      return {};
    }
  },

  /**
   * 保存历史维度标签
   */
  async saveHistoricalLabels(labels: Record<string, string>): Promise<void> {
    try {
      await Storage.set(HISTORICAL_LABELS_KEY, JSON.stringify(labels));
      // 🔥 清除缓存，下次读取时会重新加载
      historicalLabelsCache = null;
    } catch (error) {
      console.error('保存历史维度标签失败:', error);
    }
  },

  /**
   * 保存风味维度
   */
  async saveFlavorDimensions(dimensions: FlavorDimension[]): Promise<void> {
    try {
      // 更新历史标签映射
      const historicalLabels = await this.getHistoricalLabels();
      dimensions.forEach(dimension => {
        historicalLabels[dimension.id] = dimension.label;
      });
      await this.saveHistoricalLabels(historicalLabels);

      await Storage.set(STORAGE_KEY, JSON.stringify(dimensions));
      
      // 🔥 清除缓存，下次读取时会重新加载
      dimensionsCache = null;

      // 触发自定义事件通知其他组件
      window.dispatchEvent(
        new CustomEvent('flavorDimensionsChanged', {
          detail: { dimensions },
        })
      );
    } catch (error) {
      console.error('保存风味维度失败:', error);
      throw error;
    }
  },

  /**
   * 添加新的风味维度
   */
  async addFlavorDimension(label: string): Promise<FlavorDimension> {
    const dimensions = await this.getFlavorDimensions();
    const maxOrder = Math.max(...dimensions.map(d => d.order), -1);

    const newDimension: FlavorDimension = {
      id: `custom_${Date.now()}`,
      label,
      order: maxOrder + 1,
      isDefault: false,
    };

    dimensions.push(newDimension);
    await this.saveFlavorDimensions(dimensions);

    return newDimension;
  },

  /**
   * 更新风味维度
   */
  async updateFlavorDimension(
    id: string,
    updates: Partial<Pick<FlavorDimension, 'label'>>
  ): Promise<void> {
    const dimensions = await this.getFlavorDimensions();
    const index = dimensions.findIndex(d => d.id === id);

    if (index === -1) {
      throw new Error('风味维度不存在');
    }

    // 不允许修改默认维度的ID，但可以修改label
    dimensions[index] = { ...dimensions[index], ...updates };
    await this.saveFlavorDimensions(dimensions);
  },

  /**
   * 删除风味维度（不能删除默认维度）
   */
  async deleteFlavorDimension(id: string): Promise<void> {
    const dimensions = await this.getFlavorDimensions();
    const dimension = dimensions.find(d => d.id === id);

    if (!dimension) {
      throw new Error('风味维度不存在');
    }

    if (dimension.isDefault) {
      throw new Error('不能删除默认风味维度');
    }

    // 在删除之前，确保标签已保存到历史记录中
    const historicalLabels = await this.getHistoricalLabels();
    historicalLabels[id] = dimension.label;
    await this.saveHistoricalLabels(historicalLabels);

    const filtered = dimensions.filter(d => d.id !== id);
    await this.saveFlavorDimensions(filtered);
  },

  /**
   * 重新排序风味维度
   */
  async reorderFlavorDimensions(dimensionIds: string[]): Promise<void> {
    const dimensions = await this.getFlavorDimensions();

    // 根据新的顺序重新设置order值
    const reordered = dimensionIds.map((id, index) => {
      const dimension = dimensions.find(d => d.id === id);
      if (!dimension) {
        throw new Error(`风味维度 ${id} 不存在`);
      }
      return { ...dimension, order: index };
    });

    await this.saveFlavorDimensions(reordered);
  },

  /**
   * 重置为默认风味维度
   */
  async resetToDefault(): Promise<void> {
    await this.saveFlavorDimensions([...DEFAULT_FLAVOR_DIMENSIONS]);
  },

  /**
   * 创建兼容旧格式的风味评分对象
   */
  createEmptyTasteRatings(
    dimensions: FlavorDimension[]
  ): Record<string, number> {
    const ratings: Record<string, number> = {};
    dimensions.forEach(dimension => {
      ratings[dimension.id] = 0;
    });
    return ratings;
  },

  /**
   * 获取维度标签（支持历史标签查找）
   */
  async getDimensionLabel(id: string): Promise<string> {
    // 首先尝试从当前维度中查找
    const dimensions = await this.getFlavorDimensions();
    const currentDimension = dimensions.find(d => d.id === id);
    if (currentDimension) {
      return currentDimension.label;
    }

    // 如果当前维度中没有，从历史标签中查找
    const historicalLabels = await this.getHistoricalLabels();
    if (historicalLabels[id]) {
      return historicalLabels[id];
    }

    // 如果历史标签中也没有，返回人性化的默认标签
    if (id.startsWith('custom_')) {
      return '已删除的风味维度';
    }

    return id;
  },

  /**
   * 从旧的风味评分格式迁移到新格式
   * 这确保了向后兼容性
   */
  migrateTasteRatings(
    oldRatings: Record<string, number>,
    dimensions: FlavorDimension[]
  ): Record<string, number> {
    const newRatings: Record<string, number> = {};

    // 先设置所有维度的默认值
    dimensions.forEach(dimension => {
      newRatings[dimension.id] = 0;
    });

    // 然后用旧数据覆盖存在的维度
    Object.entries(oldRatings).forEach(([key, value]) => {
      if (dimensions.some(d => d.id === key)) {
        newRatings[key] = value;
      }
    });

    return newRatings;
  },

  /**
   * 清除缓存（用于强制重新加载数据）
   */
  clearCache(): void {
    dimensionsCache = null;
    historicalLabelsCache = null;
  },
};
