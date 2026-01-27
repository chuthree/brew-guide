/**
 * 磨豆机状态管理 - 使用 Zustand + IndexedDB 实现
 *
 * 架构重构：
 * - 数据存储从 localStorage (brewGuideSettings) 迁移到 IndexedDB (grinders 表)
 * - 通过 Zustand 管理内存状态
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { db, Grinder } from '@/lib/core/db';
import { nanoid } from 'nanoid';

// 重新导出 Grinder 类型和历史记录类型
export type { Grinder, GrindSizeHistory } from '@/lib/core/db';

// 磨豆机状态接口
interface GrinderState {
  // 磨豆机列表
  grinders: Grinder[];

  // 是否已初始化
  initialized: boolean;

  // 加载状态
  isLoading: boolean;

  // 当前编辑的同步状态（用于保存时判断是否同步刻度）
  currentSyncState: {
    grinderId: string | null;
    isSyncEnabled: boolean;
  };

  // 初始化（从 IndexedDB 加载）
  initialize: () => Promise<void>;

  // CRUD 操作
  addGrinder: (grinder: Omit<Grinder, 'id'>) => Promise<Grinder>;
  updateGrinder: (id: string, updates: Partial<Grinder>) => Promise<void>;
  deleteGrinder: (id: string) => Promise<void>;

  // 批量操作
  setGrinders: (grinders: Grinder[]) => Promise<void>;

  // 更新磨豆机刻度（通过名称匹配）
  updateGrinderScaleByName: (name: string, scale: string) => Promise<void>;

  // 设置当前同步状态
  setSyncState: (grinderId: string | null, isSyncEnabled: boolean) => void;

  // 重置同步状态
  resetSyncState: () => void;

  // 刷新
  refreshGrinders: () => Promise<void>;
}

/**
 * 解析研磨度字符串，提取磨豆机名称和刻度
 * 支持格式: "磨豆机名 刻度" 或 "磨豆机名 · 刻度"（兼容旧格式）
 */
export function parseGrinderFromGrindSize(
  grindSize: string,
  grinderNames: string[]
): { grinderName: string; scale: string } | null {
  if (!grindSize || grinderNames.length === 0) return null;

  // 按名称长度降序排序，优先匹配较长的名称（避免 "C40" 匹配到 "C4"）
  const sortedNames = [...grinderNames].sort((a, b) => b.length - a.length);

  for (const name of sortedNames) {
    // 检查是否以磨豆机名开头
    if (grindSize.startsWith(name)) {
      // 获取剩余部分
      const remainder = grindSize.slice(name.length).trim();

      // 去掉可能的分隔符
      const scale = remainder.replace(/^[·\s]+/, '').trim();

      // 如果有刻度值，返回解析结果
      if (scale) {
        return { grinderName: name, scale };
      }
    }
  }

  return null;
}

/**
 * 磨豆机 Store
 */
export const useGrinderStore = create<GrinderState>()(
  subscribeWithSelector((set, get) => ({
    grinders: [],
    initialized: false,
    isLoading: false,
    currentSyncState: {
      grinderId: null,
      isSyncEnabled: true,
    },

    initialize: async () => {
      if (get().initialized || get().isLoading) return;

      set({ isLoading: true });

      try {
        // 从 IndexedDB 加载
        let grinders = await db.grinders.toArray();

        // 如果 IndexedDB 为空，尝试从 localStorage 迁移
        if (grinders.length === 0) {
          grinders = await migrateGrindersFromLocalStorage();
          if (grinders.length > 0) {
            await db.grinders.bulkPut(grinders);
            console.log(`已迁移 ${grinders.length} 个磨豆机到 IndexedDB`);
          }
        }

        set({ grinders, initialized: true, isLoading: false });
      } catch (error) {
        console.error('加载磨豆机数据失败:', error);
        set({ initialized: true, isLoading: false });
      }
    },

    addGrinder: async grinderData => {
      const newGrinder: Grinder = {
        ...grinderData,
        id: nanoid(),
      };

      try {
        await db.grinders.put(newGrinder);
        set(state => ({ grinders: [...state.grinders, newGrinder] }));

        // 触发变化事件
        dispatchGrinderChanged();

        return newGrinder;
      } catch (error) {
        console.error('添加磨豆机失败:', error);
        throw error;
      }
    },

    updateGrinder: async (id, updates) => {
      const { grinders } = get();
      const existing = grinders.find(g => g.id === id);
      if (!existing) return;

      const updated = { ...existing, ...updates };

      try {
        await db.grinders.put(updated);
        set(state => ({
          grinders: state.grinders.map(g => (g.id === id ? updated : g)),
        }));

        // 触发变化事件
        dispatchGrinderChanged();
      } catch (error) {
        console.error('更新磨豆机失败:', error);
        throw error;
      }
    },

    deleteGrinder: async id => {
      try {
        await db.grinders.delete(id);
        set(state => ({
          grinders: state.grinders.filter(g => g.id !== id),
        }));

        // 触发变化事件
        dispatchGrinderChanged();
      } catch (error) {
        console.error('删除磨豆机失败:', error);
        throw error;
      }
    },

    setGrinders: async grinders => {
      try {
        // 清空并重新写入
        await db.grinders.clear();
        if (grinders.length > 0) {
          await db.grinders.bulkPut(grinders);
        }
        set({ grinders });

        // 触发变化事件
        dispatchGrinderChanged();
      } catch (error) {
        console.error('设置磨豆机列表失败:', error);
        throw error;
      }
    },

    updateGrinderScaleByName: async (name, scale) => {
      const { grinders } = get();
      const grinder = grinders.find(
        g => g.name.toLowerCase() === name.toLowerCase()
      );

      if (grinder) {
        // 更新历史记录
        const history = grinder.grindSizeHistory || [];
        const newHistory = [
          { grindSize: scale, timestamp: Date.now() },
          ...history.filter(h => h.grindSize !== scale), // 去重
        ].slice(0, 10); // 最多保留10条

        await get().updateGrinder(grinder.id, {
          currentGrindSize: scale,
          grindSizeHistory: newHistory,
        });
      }
    },

    setSyncState: (grinderId, isSyncEnabled) => {
      set({
        currentSyncState: { grinderId, isSyncEnabled },
      });
    },

    resetSyncState: () => {
      set({
        currentSyncState: { grinderId: null, isSyncEnabled: true },
      });
    },

    refreshGrinders: async () => {
      set({ initialized: false });
      await get().initialize();
    },
  }))
);

/**
 * 从 localStorage 迁移磨豆机数据
 */
async function migrateGrindersFromLocalStorage(): Promise<Grinder[]> {
  try {
    if (typeof localStorage === 'undefined') return [];

    const settingsStr = localStorage.getItem('brewGuideSettings');
    if (!settingsStr) return [];

    let settings = JSON.parse(settingsStr);

    // 处理 Zustand persist 格式
    if (settings?.state?.settings) {
      settings = settings.state.settings;
    }

    if (settings.grinders && Array.isArray(settings.grinders)) {
      return settings.grinders;
    }

    return [];
  } catch (error) {
    console.error('迁移磨豆机数据失败:', error);
    return [];
  }
}

/**
 * 触发磨豆机变化事件
 */
function dispatchGrinderChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('grinderDataChanged'));
  }
}

/**
 * 获取 Store 实例（非 React 环境使用）
 */
export const getGrinderStore = () => useGrinderStore.getState();

/**
 * 同步磨豆机刻度
 * @param grindSize 研磨度字符串，如 "C40 24"
 * @param equipment 器具名称（可选）
 * @param method 冲煮方案名称（可选）
 * @param coffeeBean 咖啡豆名称（可选）
 * @returns 是否成功同步
 */
export async function syncGrinderScale(
  grindSize: string,
  equipment?: string,
  method?: string,
  coffeeBean?: string
): Promise<boolean> {
  const store = useGrinderStore.getState();

  // 确保已初始化
  if (!store.initialized) {
    await store.initialize();
  }

  // 检查当前同步状态，如果用户禁用了同步则跳过
  const { currentSyncState } = store;
  if (!currentSyncState.isSyncEnabled) {
    // 重置同步状态并返回
    store.resetSyncState();
    return false;
  }

  const grinderNames = store.grinders.map(g => g.name);
  const parsed = parseGrinderFromGrindSize(grindSize, grinderNames);

  if (parsed) {
    const grinder = store.grinders.find(
      g => g.name.toLowerCase() === parsed.grinderName.toLowerCase()
    );

    if (grinder) {
      // 更新历史记录，包含器具、方案和咖啡豆信息
      const history = grinder.grindSizeHistory || [];
      const newHistory = [
        {
          grindSize: parsed.scale,
          timestamp: Date.now(),
          equipment,
          method,
          coffeeBean,
        },
        ...history.filter(h => h.grindSize !== parsed.scale), // 去重
      ].slice(0, 3); // 最多保留3条

      await store.updateGrinder(grinder.id, {
        currentGrindSize: parsed.scale,
        grindSizeHistory: newHistory,
      });
    }

    // 重置同步状态
    store.resetSyncState();
    return true;
  }

  // 重置同步状态
  store.resetSyncState();
  return false;
}
