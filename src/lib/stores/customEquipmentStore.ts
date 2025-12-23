/**
 * 自定义器具 Store
 *
 * 架构设计：
 * - 数据存储在 IndexedDB (customEquipments 表)
 * - 通过 Zustand 管理内存状态
 * - 替代原来的 customEquipments.ts Manager
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { db } from '@/lib/core/db';
import { type CustomEquipment, type Method } from '@/lib/core/config';
import { nanoid } from 'nanoid';

/**
 * 自定义器具 Store 状态接口
 */
interface CustomEquipmentStore {
  // 状态
  equipments: CustomEquipment[];
  isLoading: boolean;
  initialized: boolean;
  error: string | null;

  // 初始化
  loadEquipments: () => Promise<void>;

  // CRUD 操作
  addEquipment: (
    equipment: Omit<CustomEquipment, 'id' | 'isCustom'>
  ) => Promise<CustomEquipment>;
  updateEquipment: (
    id: string,
    updates: Partial<CustomEquipment>
  ) => Promise<CustomEquipment | null>;
  deleteEquipment: (id: string) => Promise<boolean>;

  // 批量操作
  setEquipments: (equipments: CustomEquipment[]) => void;
  upsertEquipment: (equipment: CustomEquipment) => Promise<void>;

  // 查询
  getEquipmentById: (id: string) => CustomEquipment | undefined;

  // 刷新
  refreshEquipments: () => Promise<void>;
}

/**
 * 生成自定义器具 ID
 */
function generateEquipmentId(animationType: string): string {
  return `custom-${animationType}-${Date.now()}-${nanoid(7)}`;
}

/**
 * 自定义器具 Store
 */
export const useCustomEquipmentStore = create<CustomEquipmentStore>()(
  subscribeWithSelector((set, get) => ({
    equipments: [],
    isLoading: false,
    initialized: false,
    error: null,

    loadEquipments: async () => {
      if (get().isLoading) return;

      set({ isLoading: true, error: null });

      try {
        // 从 IndexedDB 加载
        let equipments = await db.customEquipments.toArray();

        // 如果 IndexedDB 为空，尝试从 localStorage 迁移
        if (equipments.length === 0) {
          equipments = await migrateFromLocalStorage();
          if (equipments.length > 0) {
            await db.customEquipments.bulkPut(equipments);
            console.log(`已迁移 ${equipments.length} 个自定义器具到 IndexedDB`);
          }
        }

        set({ equipments, isLoading: false, initialized: true });
      } catch (error) {
        console.error('[CustomEquipmentStore] loadEquipments failed:', error);
        set({
          error: '加载自定义器具失败',
          isLoading: false,
          initialized: true,
        });
      }
    },

    addEquipment: async equipmentData => {
      const newEquipment: CustomEquipment = {
        ...equipmentData,
        id: generateEquipmentId(equipmentData.animationType),
        isCustom: true,
      } as CustomEquipment;

      try {
        await db.customEquipments.put(newEquipment);
        set(state => ({ equipments: [...state.equipments, newEquipment] }));

        // 触发变化事件
        dispatchEquipmentChanged('create', newEquipment);

        return newEquipment;
      } catch (error) {
        console.error('[CustomEquipmentStore] addEquipment failed:', error);
        throw error;
      }
    },

    updateEquipment: async (id, updates) => {
      const { equipments } = get();
      const existingEquipment = equipments.find(e => e.id === id);
      if (!existingEquipment) return null;

      const updatedEquipment: CustomEquipment = {
        ...existingEquipment,
        ...updates,
        id,
        isCustom: true,
      };

      try {
        await db.customEquipments.put(updatedEquipment);
        set(state => ({
          equipments: state.equipments.map(e =>
            e.id === id ? updatedEquipment : e
          ),
        }));

        // 触发变化事件
        dispatchEquipmentChanged('update', updatedEquipment);

        return updatedEquipment;
      } catch (error) {
        console.error('[CustomEquipmentStore] updateEquipment failed:', error);
        throw error;
      }
    },

    deleteEquipment: async id => {
      try {
        // 同时删除关联的方案
        await db.customMethods.delete(id);
        await db.customEquipments.delete(id);

        set(state => ({
          equipments: state.equipments.filter(e => e.id !== id),
        }));

        // 触发变化事件
        dispatchEquipmentChanged('delete', { id } as CustomEquipment);

        return true;
      } catch (error) {
        console.error('[CustomEquipmentStore] deleteEquipment failed:', error);
        return false;
      }
    },

    setEquipments: equipments => {
      set({ equipments, initialized: true });
    },

    upsertEquipment: async equipment => {
      try {
        const equipmentWithFlag = { ...equipment, isCustom: true as const };
        await db.customEquipments.put(equipmentWithFlag);

        set(state => {
          const exists = state.equipments.some(e => e.id === equipment.id);
          if (exists) {
            return {
              equipments: state.equipments.map(e =>
                e.id === equipment.id ? equipmentWithFlag : e
              ),
            };
          } else {
            return { equipments: [...state.equipments, equipmentWithFlag] };
          }
        });
      } catch (error) {
        console.error('[CustomEquipmentStore] upsertEquipment failed:', error);
      }
    },

    getEquipmentById: id => {
      return get().equipments.find(e => e.id === id);
    },

    refreshEquipments: async () => {
      set({ initialized: false });
      await get().loadEquipments();
    },
  }))
);

/**
 * 触发器具变化事件
 */
function dispatchEquipmentChanged(
  action: 'create' | 'update' | 'delete',
  equipment: CustomEquipment
): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('customEquipmentDataChanged', {
        detail: { action, equipmentId: equipment.id, equipment },
      })
    );
  }
}

/**
 * 从 localStorage 迁移数据
 */
async function migrateFromLocalStorage(): Promise<CustomEquipment[]> {
  try {
    if (typeof localStorage === 'undefined') return [];

    // 尝试从 Storage 加载
    const { Storage } = await import('@/lib/core/storage');
    const savedEquipments = await Storage.get('customEquipments');

    if (savedEquipments) {
      return JSON.parse(savedEquipments) as CustomEquipment[];
    }

    return [];
  } catch (error) {
    console.error('迁移自定义器具数据失败:', error);
    return [];
  }
}

/**
 * 获取 Store 实例（非 React 环境使用）
 */
export const getCustomEquipmentStore = () => useCustomEquipmentStore.getState();

/**
 * 检查器具名称是否可用
 */
export function isEquipmentNameAvailable(
  name: string,
  currentId?: string
): boolean {
  const store = getCustomEquipmentStore();
  return !store.equipments.some(e => e.name === name && e.id !== currentId);
}

/**
 * 便捷函数：加载器具（兼容旧 API）
 */
export async function loadCustomEquipments(): Promise<CustomEquipment[]> {
  const store = getCustomEquipmentStore();
  if (!store.initialized) {
    await store.loadEquipments();
  }
  return store.equipments;
}

/**
 * 便捷函数：保存器具（兼容旧 API）
 */
export async function saveCustomEquipment(
  equipment: CustomEquipment,
  methods?: Method[]
): Promise<void> {
  const store = getCustomEquipmentStore();

  if (equipment.id && store.equipments.some(e => e.id === equipment.id)) {
    // 更新现有器具
    await store.updateEquipment(equipment.id, equipment);
  } else {
    // 创建新器具
    const newEquipment = await store.addEquipment(equipment);
    equipment.id = newEquipment.id;
  }

  // 如果提供了方案，保存方案
  if (methods && methods.length > 0 && equipment.id) {
    const { useCustomMethodStore } = await import(
      '@/lib/stores/customMethodStore'
    );
    const methodStore = useCustomMethodStore.getState();
    await methodStore.setMethodsForEquipment(equipment.id, methods);
  }
}

/**
 * 便捷函数：删除器具（兼容旧 API）
 */
export async function deleteCustomEquipment(id: string): Promise<void> {
  const store = getCustomEquipmentStore();
  await store.deleteEquipment(id);
}

/**
 * 便捷函数：添加器具及其方案
 */
export async function addEquipmentWithMethods(
  equipment: Omit<CustomEquipment, 'id' | 'isCustom'>,
  methods?: Method[]
): Promise<CustomEquipment> {
  const store = getCustomEquipmentStore();
  const newEquipment = await store.addEquipment(equipment);

  if (methods && methods.length > 0) {
    // 动态导入以避免循环依赖
    const { useCustomMethodStore } = await import(
      '@/lib/stores/customMethodStore'
    );
    const methodStore = useCustomMethodStore.getState();
    await methodStore.setMethodsForEquipment(newEquipment.id, methods);
  }

  return newEquipment;
}
