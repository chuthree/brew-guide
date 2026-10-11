import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/core/db';
import { bindDexieRepositories } from '@/lib/data/dexieRuntime';
import {
  customEquipmentRepository,
  customMethodRepository,
} from '@/lib/data/repositories';
import type { CustomEquipment, Method } from '@/lib/core/config';
import { useCustomEquipmentStore } from '@/lib/stores/customEquipmentStore';
import { useCustomMethodStore } from '@/lib/stores/customMethodStore';
import { localChangeListener } from '@/lib/supabase/realtime/handlers/LocalChangeListener';

const equipment: CustomEquipment = {
  id: 'custom-v60-shared',
  name: 'Custom V60',
  animationType: 'v60',
  isCustom: true,
};

const method: Method = {
  id: 'method-1',
  name: 'Morning brew',
  params: {
    coffee: '15g',
    water: '225g',
    ratio: '1:15',
    grindSize: 'medium-fine',
    temp: '92°C',
    stages: [{ label: 'Bloom', water: '30', duration: 30, detail: '' }],
  },
};

describe('customEquipmentStore', () => {
  beforeEach(async () => {
    localChangeListener.stop();
    vi.stubGlobal('window', new EventTarget());
    bindDexieRepositories();
    await Promise.all([db.customEquipments.clear(), db.customMethods.clear()]);
    useCustomEquipmentStore.setState({
      equipments: [],
      isLoading: false,
      initialized: false,
      error: null,
    });
    useCustomMethodStore.setState({
      methodsByEquipment: {},
      isLoading: false,
      initialized: false,
      error: null,
    });
  });

  afterEach(async () => {
    localChangeListener.stop();
    await Promise.all([db.customEquipments.clear(), db.customMethods.clear()]);
    vi.unstubAllGlobals();
  });

  it('deletes an equipment and its associated methods through the application store operation', async () => {
    const syncChanges: Array<{
      table: string;
      action: string;
      recordId: string;
      data?: Record<string, unknown>;
    }> = [];
    localChangeListener.start(
      (table, action, recordId, data) =>
        syncChanges.push({ table, action, recordId, data }),
      () => {}
    );

    await customEquipmentRepository.save(equipment);
    await customMethodRepository.save({
      equipmentId: equipment.id,
      methods: [method],
    });
    useCustomEquipmentStore.setState({
      equipments: [equipment],
      isLoading: false,
      initialized: true,
      error: null,
    });
    useCustomMethodStore.setState({
      methodsByEquipment: { [equipment.id]: [method] },
      isLoading: false,
      initialized: true,
      error: null,
    });

    const deleted = await useCustomEquipmentStore
      .getState()
      .deleteEquipment(equipment.id);

    expect(deleted).toBe(true);
    expect(useCustomEquipmentStore.getState().equipments).toEqual([]);
    expect(
      useCustomMethodStore.getState().methodsByEquipment
    ).not.toHaveProperty(equipment.id);
    expect(await customEquipmentRepository.get(equipment.id)).toBeUndefined();
    expect(await customMethodRepository.get(equipment.id)).toBeUndefined();

    expect(syncChanges).toEqual([
      {
        table: 'custom_methods',
        action: 'delete',
        recordId: equipment.id,
        data: { equipmentId: equipment.id, methods: [] },
      },
      {
        table: 'custom_equipments',
        action: 'delete',
        recordId: equipment.id,
        data: { id: equipment.id },
      },
    ]);
  });
});
