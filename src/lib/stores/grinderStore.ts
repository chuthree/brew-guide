/**
 * 磨豆机状态管理 - 使用 Zustand 实现跨组件实时同步
 */

import { create } from 'zustand';
import { Storage } from '@/lib/core/storage';

// 磨豆机接口
export interface Grinder {
  id: string;
  name: string;
  currentGrindSize?: string;
}

// 磨豆机状态接口
interface GrinderState {
  // 磨豆机列表
  grinders: Grinder[];

  // 是否已初始化
  initialized: boolean;

  // 当前编辑的同步状态（用于保存时判断是否同步刻度）
  currentSyncState: {
    grinderId: string | null;
    isSyncEnabled: boolean;
  };

  // 设置磨豆机列表
  setGrinders: (grinders: Grinder[]) => void;

  // 添加磨豆机
  addGrinder: (grinder: Grinder) => void;

  // 更新磨豆机
  updateGrinder: (id: string, updates: Partial<Grinder>) => void;

  // 删除磨豆机
  deleteGrinder: (id: string) => void;

  // 更新磨豆机刻度（通过名称匹配）
  updateGrinderScaleByName: (name: string, scale: string) => void;

  // 设置当前同步状态
  setSyncState: (grinderId: string | null, isSyncEnabled: boolean) => void;

  // 重置同步状态
  resetSyncState: () => void;

  // 初始化（从 storage 加载）
  initialize: () => Promise<void>;

  // 持久化到 storage
  persist: () => Promise<void>;
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
export const useGrinderStore = create<GrinderState>((set, get) => ({
  grinders: [],
  initialized: false,
  currentSyncState: {
    grinderId: null,
    isSyncEnabled: true,
  },

  setGrinders: (grinders: Grinder[]) => {
    set({ grinders });
    get().persist();
  },

  addGrinder: (grinder: Grinder) => {
    set(state => ({
      grinders: [...state.grinders, grinder],
    }));
    get().persist();
  },

  updateGrinder: (id: string, updates: Partial<Grinder>) => {
    set(state => ({
      grinders: state.grinders.map(g =>
        g.id === id ? { ...g, ...updates } : g
      ),
    }));
    get().persist();
  },

  deleteGrinder: (id: string) => {
    set(state => ({
      grinders: state.grinders.filter(g => g.id !== id),
    }));
    get().persist();
  },

  updateGrinderScaleByName: (name: string, scale: string) => {
    const { grinders } = get();
    const grinder = grinders.find(
      g => g.name.toLowerCase() === name.toLowerCase()
    );

    if (grinder) {
      set(state => ({
        grinders: state.grinders.map(g =>
          g.id === grinder.id ? { ...g, currentGrindSize: scale } : g
        ),
      }));
      get().persist();
    }
  },

  setSyncState: (grinderId: string | null, isSyncEnabled: boolean) => {
    set({
      currentSyncState: { grinderId, isSyncEnabled },
    });
  },

  resetSyncState: () => {
    set({
      currentSyncState: { grinderId: null, isSyncEnabled: true },
    });
  },

  initialize: async () => {
    if (get().initialized) return;

    try {
      const settingsStr = await Storage.get('brewGuideSettings');
      if (settingsStr) {
        const settings = JSON.parse(settingsStr);
        if (settings.grinders && Array.isArray(settings.grinders)) {
          set({ grinders: settings.grinders, initialized: true });
          return;
        }
      }
    } catch (error) {
      console.error('加载磨豆机数据失败:', error);
    }

    set({ initialized: true });
  },

  persist: async () => {
    try {
      const settingsStr = await Storage.get('brewGuideSettings');
      const settings = settingsStr ? JSON.parse(settingsStr) : {};
      settings.grinders = get().grinders;
      await Storage.set('brewGuideSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('保存磨豆机数据失败:', error);
    }
  },
}));

// 导出便捷函数

/**
 * 同步磨豆机刻度
 * @param grindSize 研磨度字符串，如 "C40 24"
 * @returns 是否成功同步
 */
export async function syncGrinderScale(grindSize: string): Promise<boolean> {
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
    store.updateGrinderScaleByName(parsed.grinderName, parsed.scale);
    // 重置同步状态
    store.resetSyncState();
    return true;
  }

  // 重置同步状态
  store.resetSyncState();
  return false;
}
