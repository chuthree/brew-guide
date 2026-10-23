/**
 * 器具列表管理的自定义Hook
 * 统一管理器具列表的加载、排序和事件订阅逻辑，避免重复代码
 */

import { useMemo } from 'react';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { type CustomEquipment, type Equipment } from '@/lib/core/config';
import { equipmentUtils } from '@/lib/equipment/equipmentUtils';
import type { SettingsOptions } from '@/lib/data/models';

export interface UseEquipmentListOptions {
  customEquipments: CustomEquipment[];
  settings?: SettingsOptions;
  transformItems?: <T extends { id: string; name: string; isCustom?: boolean }>(
    items: T[]
  ) => T[];
}

export interface UseEquipmentListReturn<
  T extends { id: string; name: string; isCustom?: boolean } =
    | Equipment
    | CustomEquipment,
> {
  allEquipments: T[];
  isLoading: boolean;
  error: string | null;
}

const EMPTY_IDS: string[] = [];

// Equipment data is already in memory. Derive it during render instead of
// clearing/loading a second copy through effects and event subscriptions.
export function useEquipmentList<
  T extends { id: string; name: string; isCustom?: boolean } =
    | Equipment
    | CustomEquipment,
>({
  customEquipments,
  settings,
  transformItems,
}: UseEquipmentListOptions): UseEquipmentListReturn<T> {
  const equipmentIds = useSettingsStore(
    state => state.settings.equipmentOrder ?? EMPTY_IDS
  );
  const hiddenIds = useSettingsStore(
    state => state.settings.hiddenEquipments ?? EMPTY_IDS
  );
  const nameOverrides = settings?.equipmentNameOverrides;
  const filterHidden = Boolean(settings);

  const allEquipments = useMemo(() => {
    const sorted = equipmentUtils.getAllEquipments(
      customEquipments,
      { equipmentIds },
      nameOverrides
    );
    const visible = filterHidden
      ? sorted.filter(equipment => !hiddenIds.includes(equipment.id))
      : sorted;
    return (transformItems ? transformItems(visible) : visible) as T[];
  }, [customEquipments, equipmentIds, hiddenIds, nameOverrides, filterHidden, transformItems]);

  return { allEquipments, isLoading: false, error: null };
}
