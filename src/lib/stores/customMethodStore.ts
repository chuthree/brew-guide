/**
 * 自定义方案 Store
 *
 * 架构设计：
 * - 数据存储在 IndexedDB (customMethods 表)
 * - 按器具ID组织方案
 * - 通过 Zustand 管理内存状态
 * - 替代原来的 customMethods.ts Manager
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { db } from '@/lib/core/db';
import { type Method, type CustomEquipment } from '@/lib/core/config';
import { nanoid } from 'nanoid';

/**
 * 方案数据结构
 */
interface MethodsData {
  equipmentId: string;
  methods: Method[];
}

/**
 * 自定义方案 Store 状态接口
 */
interface CustomMethodStore {
  // 状态：按器具ID索引的方案
  methodsByEquipment: Record<string, Method[]>;
  isLoading: boolean;
  initialized: boolean;
  error: string | null;

  // 初始化
  loadMethods: () => Promise<void>;

  // 加载特定器具的方案
  loadMethodsForEquipment: (equipmentId: string) => Promise<Method[]>;

  // CRUD 操作
  addMethod: (
    equipmentId: string,
    method: Omit<Method, 'id'>
  ) => Promise<Method>;
  updateMethod: (
    equipmentId: string,
    methodId: string,
    updates: Partial<Method>
  ) => Promise<Method | null>;
  deleteMethod: (equipmentId: string, methodId: string) => Promise<boolean>;

  // 批量操作
  setMethodsForEquipment: (
    equipmentId: string,
    methods: Method[]
  ) => Promise<void>;
  deleteMethodsForEquipment: (equipmentId: string) => Promise<void>;

  // 查询
  getMethodById: (equipmentId: string, methodId: string) => Method | undefined;
  getMethodsForEquipment: (equipmentId: string) => Method[];

  // 刷新
  refreshMethods: () => Promise<void>;
}

/**
 * 生成方案 ID
 */
function generateMethodId(): string {
  return `method-${Date.now()}-${nanoid(7)}`;
}

/**
 * 确保方案有唯一ID
 */
function ensureMethodId(method: Method): Method {
  if (!method.id) {
    return { ...method, id: generateMethodId() };
  }
  return method;
}

/**
 * 去重方案（基于ID）
 */
function deduplicateMethods(methods: Method[]): Method[] {
  const seen = new Map<string, Method>();

  for (const method of methods) {
    const methodWithId = ensureMethodId(method);
    const key = methodWithId.id || methodWithId.name;
    // 如果已存在，优先保留有ID的
    if (!seen.has(key) || methodWithId.id) {
      seen.set(key, methodWithId);
    }
  }

  return Array.from(seen.values());
}

/**
 * 自定义方案 Store
 */
export const useCustomMethodStore = create<CustomMethodStore>()(
  subscribeWithSelector((set, get) => ({
    methodsByEquipment: {},
    isLoading: false,
    initialized: false,
    error: null,

    loadMethods: async () => {
      if (get().isLoading) return;

      set({ isLoading: true, error: null });

      try {
        // 从 IndexedDB 加载所有方案
        const methodsData = await db.customMethods.toArray();

        // 转换为记录格式
        const methodsByEquipment: Record<string, Method[]> = {};
        for (const item of methodsData) {
          methodsByEquipment[item.equipmentId] =
            item.methods.map(ensureMethodId);
        }

        set({ methodsByEquipment, isLoading: false, initialized: true });
      } catch (error) {
        console.error('[CustomMethodStore] loadMethods failed:', error);
        set({
          error: '加载自定义方案失败',
          isLoading: false,
          initialized: true,
        });
      }
    },

    loadMethodsForEquipment: async equipmentId => {
      try {
        // 先检查内存缓存
        const cached = get().methodsByEquipment[equipmentId];
        if (cached) return cached;

        // 从数据库加载
        const data = await db.customMethods.get(equipmentId);
        if (data && data.methods) {
          const methods = data.methods.map(ensureMethodId);

          set(state => ({
            methodsByEquipment: {
              ...state.methodsByEquipment,
              [equipmentId]: methods,
            },
          }));

          return methods;
        }

        return [];
      } catch (error) {
        console.error(
          '[CustomMethodStore] loadMethodsForEquipment failed:',
          error
        );
        return [];
      }
    },

    addMethod: async (equipmentId, methodData) => {
      const newMethod: Method = {
        ...methodData,
        id: generateMethodId(),
      } as Method;

      try {
        const currentMethods = get().methodsByEquipment[equipmentId] || [];
        const updatedMethods = [...currentMethods, newMethod];
        const uniqueMethods = deduplicateMethods(updatedMethods);

        await db.customMethods.put({
          equipmentId,
          methods: uniqueMethods,
        });

        set(state => ({
          methodsByEquipment: {
            ...state.methodsByEquipment,
            [equipmentId]: uniqueMethods,
          },
        }));

        // 触发变化事件
        dispatchMethodChanged(equipmentId, uniqueMethods);

        return newMethod;
      } catch (error) {
        console.error('[CustomMethodStore] addMethod failed:', error);
        throw error;
      }
    },

    updateMethod: async (equipmentId, methodId, updates) => {
      const currentMethods = get().methodsByEquipment[equipmentId] || [];
      const existingMethod = currentMethods.find(m => m.id === methodId);
      if (!existingMethod) return null;

      const updatedMethod: Method = {
        ...existingMethod,
        ...updates,
        id: methodId,
      };

      try {
        const updatedMethods = currentMethods.map(m =>
          m.id === methodId ? updatedMethod : m
        );

        await db.customMethods.put({
          equipmentId,
          methods: updatedMethods,
        });

        set(state => ({
          methodsByEquipment: {
            ...state.methodsByEquipment,
            [equipmentId]: updatedMethods,
          },
        }));

        // 触发变化事件
        dispatchMethodChanged(equipmentId, updatedMethods);

        return updatedMethod;
      } catch (error) {
        console.error('[CustomMethodStore] updateMethod failed:', error);
        throw error;
      }
    },

    deleteMethod: async (equipmentId, methodId) => {
      try {
        const currentMethods = get().methodsByEquipment[equipmentId] || [];
        const updatedMethods = currentMethods.filter(m => m.id !== methodId);

        if (updatedMethods.length > 0) {
          await db.customMethods.put({
            equipmentId,
            methods: updatedMethods,
          });
        } else {
          await db.customMethods.delete(equipmentId);
        }

        set(state => ({
          methodsByEquipment: {
            ...state.methodsByEquipment,
            [equipmentId]: updatedMethods,
          },
        }));

        // 触发变化事件
        dispatchMethodChanged(equipmentId, updatedMethods);

        return true;
      } catch (error) {
        console.error('[CustomMethodStore] deleteMethod failed:', error);
        return false;
      }
    },

    setMethodsForEquipment: async (equipmentId, methods) => {
      try {
        const methodsWithIds = methods.map(ensureMethodId);
        const uniqueMethods = deduplicateMethods(methodsWithIds);

        await db.customMethods.put({
          equipmentId,
          methods: uniqueMethods,
        });

        set(state => ({
          methodsByEquipment: {
            ...state.methodsByEquipment,
            [equipmentId]: uniqueMethods,
          },
        }));

        // 触发变化事件
        dispatchMethodChanged(equipmentId, uniqueMethods);
      } catch (error) {
        console.error(
          '[CustomMethodStore] setMethodsForEquipment failed:',
          error
        );
        throw error;
      }
    },

    deleteMethodsForEquipment: async equipmentId => {
      try {
        await db.customMethods.delete(equipmentId);

        set(state => {
          const newMethodsByEquipment = { ...state.methodsByEquipment };
          delete newMethodsByEquipment[equipmentId];
          return { methodsByEquipment: newMethodsByEquipment };
        });

        // 触发变化事件
        dispatchMethodChanged(equipmentId, []);
      } catch (error) {
        console.error(
          '[CustomMethodStore] deleteMethodsForEquipment failed:',
          error
        );
        throw error;
      }
    },

    getMethodById: (equipmentId, methodId) => {
      const methods = get().methodsByEquipment[equipmentId] || [];
      return methods.find(m => m.id === methodId);
    },

    getMethodsForEquipment: equipmentId => {
      return get().methodsByEquipment[equipmentId] || [];
    },

    refreshMethods: async () => {
      set({ initialized: false });
      await get().loadMethods();
    },
  }))
);

/**
 * 触发方案变化事件
 */
function dispatchMethodChanged(equipmentId: string, methods: Method[]): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('customMethodsChanged', {
        detail: { equipmentId },
      })
    );
    // 兼容旧事件
    window.dispatchEvent(
      new CustomEvent('customMethodDataChanged', {
        detail: { equipmentId, methods },
      })
    );
  }
}

/**
 * 获取 Store 实例（非 React 环境使用）
 */
export const getCustomMethodStore = () => useCustomMethodStore.getState();

/**
 * 便捷函数：加载所有方案（兼容旧 API）
 */
export async function loadCustomMethods(): Promise<Record<string, Method[]>> {
  const store = getCustomMethodStore();
  if (!store.initialized) {
    await store.loadMethods();
  }
  return store.methodsByEquipment;
}

/**
 * 便捷函数：加载特定器具的方案（兼容旧 API）
 */
export async function loadCustomMethodsForEquipment(
  equipmentId: string
): Promise<Method[]> {
  const store = getCustomMethodStore();
  return store.loadMethodsForEquipment(equipmentId);
}

/**
 * 便捷函数：保存或更新方案
 * 兼容旧的 saveCustomMethod 调用方式
 */
export async function saveMethod(
  equipmentId: string,
  method: Method,
  editingMethodId?: string
): Promise<Method> {
  const store = getCustomMethodStore();

  if (editingMethodId) {
    // 更新现有方案
    const updated = await store.updateMethod(
      equipmentId,
      editingMethodId,
      method
    );
    if (updated) return updated;
    // 如果找不到，作为新方案添加
  }

  // 如果方案已有ID，尝试更新
  if (method.id) {
    const existingMethods = store.getMethodsForEquipment(equipmentId);
    const exists = existingMethods.some(m => m.id === method.id);
    if (exists) {
      const updated = await store.updateMethod(equipmentId, method.id, method);
      if (updated) return updated;
    }
  }

  // 添加新方案
  return store.addMethod(equipmentId, method);
}

/**
 * 便捷函数：删除方案（兼容旧 API）
 */
export async function deleteCustomMethod(
  equipmentId: string,
  methodId: string
): Promise<boolean> {
  const store = getCustomMethodStore();
  return store.deleteMethod(equipmentId, methodId);
}

/**
 * 便捷函数：保存自定义方案（兼容旧 API 签名）
 */
export async function saveCustomMethod(
  arg1: Method | string,
  arg2: string | null | Method,
  _customMethods?: Record<string, Method[]>,
  editingMethod?: Method
): Promise<Method | null> {
  // 处理新旧两种调用方式
  let equipmentId: string;
  let method: Method;
  let editingId: string | undefined;

  if (typeof arg1 === 'string') {
    // 新方式: saveCustomMethod(equipmentId, method)
    equipmentId = arg1;
    method = arg2 as Method;
    editingId = editingMethod?.id;
  } else {
    // 旧方式: saveCustomMethod(method, selectedEquipment, customMethods, editingMethod)
    method = arg1;
    equipmentId = arg2 as string;
    editingId = editingMethod?.id;
  }

  if (!equipmentId) {
    console.error('[saveCustomMethod] 缺少器具ID');
    return null;
  }

  return saveMethod(equipmentId, method, editingId);
}

/**
 * 便捷函数：复制方案到另一个器具
 */
export async function copyMethodToEquipment(
  method: Method,
  targetEquipmentId: string
): Promise<Method> {
  const store = getCustomMethodStore();

  // 创建新方案（不保留原ID）
  const newMethod = { ...method };
  delete (newMethod as { id?: string }).id;

  return store.addMethod(targetEquipmentId, newMethod);
}

// ==================== 剪贴板/导出工具函数 ====================

/**
 * 复制冲煮方案到剪贴板
 */
export async function copyMethodToClipboard(
  method: Method,
  customEquipment?: CustomEquipment
): Promise<void> {
  try {
    const { methodToReadableText } = await import('@/lib/utils/jsonUtils');
    const text = methodToReadableText(method, customEquipment);

    // 尝试使用现代API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      // 降级方案
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  } catch (err) {
    throw err;
  }
}

/**
 * 导出器具配置为 JSON 文件
 */
export async function copyEquipmentToClipboard(
  equipment: CustomEquipment,
  methods?: Method[]
): Promise<void> {
  try {
    // 准备导出数据
    const exportData = {
      equipment: {
        ...equipment,
        customPourAnimations: equipment.customPourAnimations || [],
        id: equipment.id,
      },
      methods:
        methods && methods.length > 0
          ? methods.map(method => ({
              ...method,
              id: method.id,
            }))
          : [],
    };

    // 转换为JSON格式
    const jsonData = JSON.stringify(exportData, null, 2);

    // 创建 Blob 并下载为文件
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${equipment.name}_器具配置.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    throw err;
  }
}
