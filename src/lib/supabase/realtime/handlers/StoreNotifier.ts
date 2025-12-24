/**
 * Store 通知器
 *
 * 职责：当远程数据变更时，通知对应的 Zustand Store 更新状态
 *
 * 设计原则：
 * - Store 是 UI 状态的唯一来源
 * - 远程变更必须通过 Store 通知 UI，而不是直接触发事件
 */

import { db } from '@/lib/core/db';
import { SYNC_TABLES } from '../../syncOperations';
import type { RealtimeSyncTable } from '../types';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote, CustomEquipment, Method } from '@/lib/core/config';

/**
 * 通知 Store 删除记录
 */
export async function notifyStoreDelete(
  table: RealtimeSyncTable,
  recordId: string
): Promise<void> {
  try {
    if (table === SYNC_TABLES.COFFEE_BEANS) {
      const { useCoffeeBeanStore } = await import(
        '@/lib/stores/coffeeBeanStore'
      );
      useCoffeeBeanStore.setState(s => ({
        beans: s.beans.filter(b => b.id !== recordId),
      }));
    } else if (table === SYNC_TABLES.BREWING_NOTES) {
      const { useBrewingNoteStore } = await import(
        '@/lib/stores/brewingNoteStore'
      );
      useBrewingNoteStore.setState(s => ({
        notes: s.notes.filter(n => n.id !== recordId),
      }));
    } else if (table === SYNC_TABLES.CUSTOM_EQUIPMENTS) {
      const { useCustomEquipmentStore } = await import(
        '@/lib/stores/customEquipmentStore'
      );
      useCustomEquipmentStore.setState(s => ({
        equipments: s.equipments.filter(e => e.id !== recordId),
      }));
    } else if (table === SYNC_TABLES.CUSTOM_METHODS) {
      const { useCustomMethodStore } = await import(
        '@/lib/stores/customMethodStore'
      );
      useCustomMethodStore.setState(s => {
        const updated = { ...s.methodsByEquipment };
        delete updated[recordId];
        return { methodsByEquipment: updated };
      });
    }
  } catch (error) {
    console.error(`[StoreNotifier] 通知删除失败 ${table}/${recordId}:`, error);
  }
}

/**
 * 通知 Store 更新/插入记录
 */
export async function notifyStoreUpsert(
  table: RealtimeSyncTable,
  recordId: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    if (table === SYNC_TABLES.COFFEE_BEANS) {
      const { useCoffeeBeanStore } = await import(
        '@/lib/stores/coffeeBeanStore'
      );
      const bean = data as unknown as CoffeeBean;
      useCoffeeBeanStore.setState(s => {
        const exists = s.beans.some(b => b.id === recordId);
        return {
          beans: exists
            ? s.beans.map(b => (b.id === recordId ? bean : b))
            : [...s.beans, bean],
        };
      });
    } else if (table === SYNC_TABLES.BREWING_NOTES) {
      const { useBrewingNoteStore } = await import(
        '@/lib/stores/brewingNoteStore'
      );
      const note = data as unknown as BrewingNote;
      useBrewingNoteStore.setState(s => {
        const exists = s.notes.some(n => n.id === recordId);
        return {
          notes: exists
            ? s.notes.map(n => (n.id === recordId ? note : n))
            : [...s.notes, note],
        };
      });
    } else if (table === SYNC_TABLES.CUSTOM_EQUIPMENTS) {
      const { useCustomEquipmentStore } = await import(
        '@/lib/stores/customEquipmentStore'
      );
      const equipment = data as unknown as CustomEquipment;
      useCustomEquipmentStore.setState(s => {
        const exists = s.equipments.some(e => e.id === recordId);
        return {
          equipments: exists
            ? s.equipments.map(e => (e.id === recordId ? equipment : e))
            : [...s.equipments, equipment],
        };
      });
    } else if (table === SYNC_TABLES.CUSTOM_METHODS) {
      const { useCustomMethodStore } = await import(
        '@/lib/stores/customMethodStore'
      );
      const methodData = data as { equipmentId?: string; methods?: Method[] };
      useCustomMethodStore.setState(s => ({
        methodsByEquipment: {
          ...s.methodsByEquipment,
          [recordId]: methodData.methods || [],
        },
      }));
    }
  } catch (error) {
    console.error(`[StoreNotifier] 通知更新失败 ${table}/${recordId}:`, error);
  }
}

/**
 * 从 IndexedDB 刷新所有 Store
 */
export async function refreshAllStores(): Promise<void> {
  try {
    await Promise.all([
      (async () => {
        const { useCoffeeBeanStore } = await import(
          '@/lib/stores/coffeeBeanStore'
        );
        const beans = await db.coffeeBeans.toArray();
        useCoffeeBeanStore.setState({ beans });
      })(),
      (async () => {
        const { useBrewingNoteStore } = await import(
          '@/lib/stores/brewingNoteStore'
        );
        const notes = await db.brewingNotes.toArray();
        useBrewingNoteStore.setState({ notes });
      })(),
      (async () => {
        const { useCustomEquipmentStore } = await import(
          '@/lib/stores/customEquipmentStore'
        );
        const equipments = await db.customEquipments.toArray();
        useCustomEquipmentStore.setState({ equipments });
      })(),
      (async () => {
        const { useCustomMethodStore } = await import(
          '@/lib/stores/customMethodStore'
        );
        const methodsData = await db.customMethods.toArray();
        const methodsByEquipment: Record<string, Method[]> = {};
        for (const item of methodsData) {
          methodsByEquipment[item.equipmentId] = item.methods;
        }
        useCustomMethodStore.setState({
          methodsByEquipment,
          initialized: true,
        });
      })(),
    ]);
  } catch (error) {
    console.error('[StoreNotifier] 刷新所有 Store 失败:', error);
  }
}

/**
 * 刷新设置相关 Store
 */
export async function refreshSettingsStores(): Promise<void> {
  try {
    const { useSettingsStore } = await import('@/lib/stores/settingsStore');
    await useSettingsStore.getState().loadSettings();
    const { useGrinderStore } = await import('@/lib/stores/grinderStore');
    await useGrinderStore.getState().refreshGrinders();
  } catch (error) {
    console.error('[StoreNotifier] 刷新设置 Store 失败:', error);
  }
}
