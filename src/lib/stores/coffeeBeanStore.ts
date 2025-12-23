import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { CoffeeBean } from '@/types/app';
import { db } from '@/lib/core/db';
import { nanoid } from 'nanoid';

interface CoffeeBeanStore {
  beans: CoffeeBean[];
  isLoading: boolean;
  error: string | null;
  initialized: boolean;

  loadBeans: () => Promise<void>;
  addBean: (bean: Omit<CoffeeBean, 'id' | 'timestamp'>) => Promise<CoffeeBean>;
  updateBean: (
    id: string,
    updates: Partial<CoffeeBean>
  ) => Promise<CoffeeBean | null>;
  deleteBean: (id: string) => Promise<boolean>;
  setBeans: (beans: CoffeeBean[]) => void;
  upsertBean: (bean: CoffeeBean) => Promise<void>;
  removeBean: (id: string) => Promise<void>;
  getBeanById: (id: string) => CoffeeBean | undefined;
  refreshBeans: () => Promise<void>;
}

export const useCoffeeBeanStore = create<CoffeeBeanStore>()(
  subscribeWithSelector((set, get) => ({
    beans: [],
    isLoading: false,
    error: null,
    initialized: false,

    loadBeans: async () => {
      if (get().isLoading) return;

      set({ isLoading: true, error: null });
      try {
        const beans = await db.coffeeBeans.toArray();
        set({ beans, isLoading: false, initialized: true });
      } catch (error) {
        console.error('[CoffeeBeanStore] loadBeans failed:', error);
        set({ error: 'Failed to load', isLoading: false, initialized: true });
      }
    },

    addBean: async beanData => {
      const newBean: CoffeeBean = {
        ...beanData,
        id: nanoid(),
        timestamp: Date.now(),
      } as CoffeeBean;

      try {
        await db.coffeeBeans.put(newBean);
        set(state => ({ beans: [...state.beans, newBean] }));

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('coffeeBeanDataChanged', {
              detail: { action: 'create', beanId: newBean.id, bean: newBean },
            })
          );
        }
        return newBean;
      } catch (error) {
        console.error('[CoffeeBeanStore] addBean failed:', error);
        throw error;
      }
    },

    updateBean: async (id, updates) => {
      const { beans } = get();
      const existingBean = beans.find(b => b.id === id);
      if (!existingBean) return null;

      const updatedBean: CoffeeBean = {
        ...existingBean,
        ...updates,
        id,
        timestamp: Date.now(),
      };

      try {
        await db.coffeeBeans.put(updatedBean);
        set(state => ({
          beans: state.beans.map(b => (b.id === id ? updatedBean : b)),
        }));

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('coffeeBeanDataChanged', {
              detail: { action: 'update', beanId: id, bean: updatedBean },
            })
          );
        }
        return updatedBean;
      } catch (error) {
        console.error('[CoffeeBeanStore] updateBean failed:', error);
        throw error;
      }
    },

    deleteBean: async id => {
      try {
        await db.coffeeBeans.delete(id);
        set(state => ({
          beans: state.beans.filter(b => b.id !== id),
        }));

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('coffeeBeanDataChanged', {
              detail: { action: 'delete', beanId: id },
            })
          );
        }
        return true;
      } catch (error) {
        console.error('[CoffeeBeanStore] deleteBean failed:', error);
        return false;
      }
    },

    setBeans: beans => {
      set({ beans, initialized: true });
    },

    upsertBean: async bean => {
      try {
        await db.coffeeBeans.put(bean);
        set(state => {
          const exists = state.beans.some(b => b.id === bean.id);
          if (exists) {
            return {
              beans: state.beans.map(b => (b.id === bean.id ? bean : b)),
            };
          } else {
            return { beans: [...state.beans, bean] };
          }
        });
      } catch (error) {
        console.error('[CoffeeBeanStore] upsertBean failed:', error);
      }
    },

    removeBean: async id => {
      try {
        await db.coffeeBeans.delete(id);
        set(state => ({ beans: state.beans.filter(b => b.id !== id) }));
      } catch (error) {
        console.error('[CoffeeBeanStore] removeBean failed:', error);
      }
    },

    getBeanById: id => {
      return get().beans.find(b => b.id === id);
    },

    refreshBeans: async () => {
      set({ initialized: false });
      await get().loadBeans();
    },
  }))
);

export const getCoffeeBeanStore = () => useCoffeeBeanStore.getState();

// ==================== 便捷工具函数 ====================

/**
 * 格式化数值，对于整数不显示小数部分，非整数保留一位小数
 */
function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(1);
}

/**
 * 容量同步管理器 - 处理笔记与咖啡豆之间的双向数据同步
 */
export const CapacitySyncManager = {
  /**
   * 从笔记参数中提取咖啡粉量（纯数字）
   * @param coffeeParam 咖啡参数（如"15g"或"15"）
   * @returns 纯数字值
   */
  extractCoffeeAmount(coffeeParam: string): number {
    if (!coffeeParam) return 0;
    const match = coffeeParam.match(/(\d+(\.\d+)?)/);
    return match ? parseFloat(match[0]) : 0;
  },

  /**
   * 格式化咖啡参数为带单位的字符串
   * @param amount 数量
   * @param unit 单位（默认为'g'）
   * @returns 格式化后的字符串
   */
  formatCoffeeParam(amount: number | string, unit: string = 'g'): string {
    const numAmount =
      typeof amount === 'number' ? amount : parseFloat(String(amount));
    if (isNaN(numAmount)) return `0${unit}`;
    return `${formatNumber(numAmount)}${unit}`;
  },
};

/**
 * 更新咖啡豆剩余量（减少）
 * @param id 咖啡豆ID
 * @param usedAmount 使用的咖啡量(g)
 * @returns 更新后的咖啡豆对象，如果不存在则返回null
 */
export async function updateBeanRemaining(
  id: string,
  usedAmount: number
): Promise<CoffeeBean | null> {
  try {
    if (!id) return null;
    if (isNaN(usedAmount) || usedAmount <= 0) return null;

    const store = getCoffeeBeanStore();
    const bean = store.getBeanById(id);
    if (!bean) {
      // 尝试从DB加载
      const dbBean = await db.coffeeBeans.get(id);
      if (!dbBean) return null;

      const currentRemaining = dbBean.remaining
        ? parseFloat(dbBean.remaining)
        : 0;
      const newRemaining = Math.max(0, currentRemaining - usedAmount);
      const formattedNewRemaining = formatNumber(newRemaining);

      const updatedBean = {
        ...dbBean,
        remaining: formattedNewRemaining,
        timestamp: Date.now(),
      };
      await db.coffeeBeans.put(updatedBean);
      return updatedBean;
    }

    const currentRemaining = bean.remaining ? parseFloat(bean.remaining) : 0;
    const newRemaining = Math.max(0, currentRemaining - usedAmount);
    const formattedNewRemaining = formatNumber(newRemaining);

    const result = await store.updateBean(id, {
      remaining: formattedNewRemaining,
    });
    return result;
  } catch (error) {
    console.error('更新咖啡豆剩余量失败:', error);
    return null;
  }
}

/**
 * 增加咖啡豆剩余量（用于删除笔记时恢复容量）
 * @param id 咖啡豆ID
 * @param restoreAmount 要恢复的咖啡量(g)
 * @returns 更新后的咖啡豆对象，如果不存在则返回null
 */
export async function increaseBeanRemaining(
  id: string,
  restoreAmount: number
): Promise<CoffeeBean | null> {
  try {
    if (!id || typeof id !== 'string' || id.trim() === '') return null;
    if (
      typeof restoreAmount !== 'number' ||
      isNaN(restoreAmount) ||
      restoreAmount <= 0
    )
      return null;

    const store = getCoffeeBeanStore();
    let bean = store.getBeanById(id);

    if (!bean) {
      // 尝试从DB加载
      bean = (await db.coffeeBeans.get(id)) ?? undefined;
      if (!bean) return null;
    }

    // 转换为数字计算
    let currentRemaining = 0;
    if (bean.remaining) {
      const remainingStr =
        typeof bean.remaining === 'string'
          ? bean.remaining.replace(/[^\d.-]/g, '')
          : String(bean.remaining);
      currentRemaining = parseFloat(remainingStr);
      if (isNaN(currentRemaining)) currentRemaining = 0;
    }

    // 增加剩余量
    let finalRemaining = currentRemaining + restoreAmount;

    // 如果有总容量限制，确保不超过总容量
    if (bean.capacity) {
      const capacityStr =
        typeof bean.capacity === 'string'
          ? bean.capacity.replace(/[^\d.-]/g, '')
          : String(bean.capacity);
      const totalCapacity = parseFloat(capacityStr);

      if (
        !isNaN(totalCapacity) &&
        totalCapacity > 0 &&
        finalRemaining > totalCapacity
      ) {
        finalRemaining = totalCapacity;
      }
    }

    const formattedNewRemaining = formatNumber(finalRemaining);
    const result = await store.updateBean(id, {
      remaining: formattedNewRemaining,
    });
    return result;
  } catch (error) {
    console.error('恢复咖啡豆剩余量失败:', error);
    return null;
  }
}

/**
 * 获取所有已评分的咖啡豆
 */
export async function getRatedBeans(): Promise<CoffeeBean[]> {
  const store = getCoffeeBeanStore();
  const beans =
    store.beans.length > 0 ? store.beans : await db.coffeeBeans.toArray();
  return beans.filter(bean => bean.overallRating && bean.overallRating > 0);
}

/**
 * 获取特定类型的已评分咖啡豆
 */
export async function getRatedBeansByType(
  type: 'espresso' | 'filter' | 'omni'
): Promise<CoffeeBean[]> {
  const ratedBeans = await getRatedBeans();
  return ratedBeans.filter(bean => bean.beanType === type);
}

/**
 * 根据名称获取咖啡豆
 */
export async function getBeanByName(name: string): Promise<CoffeeBean | null> {
  const store = getCoffeeBeanStore();
  const beans =
    store.beans.length > 0 ? store.beans : await db.coffeeBeans.toArray();
  return beans.find(bean => bean.name === name) || null;
}
