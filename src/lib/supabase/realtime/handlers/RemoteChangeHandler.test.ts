import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { SYNC_TABLES } from '../../syncOperations';
import type { RealtimeSyncTable } from '../types';

const mocks = vi.hoisted(() => ({
  brewingNoteRepository: { get: vi.fn() },
  coffeeBeanRepository: { get: vi.fn() },
  coffeeBeanPersistence: { deleteWithImages: vi.fn() },
  brewingNotePersistence: { deleteWithImages: vi.fn() },
  customEquipmentRepository: { get: vi.fn(), delete: vi.fn() },
  customMethodRepository: { get: vi.fn(), save: vi.fn(), delete: vi.fn() },
  notifyStoreDelete: vi.fn(),
  notifyStoreUpsert: vi.fn(),
}));

vi.mock('@/lib/data/repositories', () => ({
  brewingNoteRepository: mocks.brewingNoteRepository,
  coffeeBeanRepository: mocks.coffeeBeanRepository,
  coffeeBeanPersistence: mocks.coffeeBeanPersistence,
  brewingNotePersistence: mocks.brewingNotePersistence,
  customEquipmentRepository: mocks.customEquipmentRepository,
  customMethodRepository: mocks.customMethodRepository,
}));

vi.mock('./StoreNotifier', () => ({
  notifyStoreDelete: mocks.notifyStoreDelete,
  notifyStoreUpsert: mocks.notifyStoreUpsert,
}));

import { RemoteChangeHandler } from './RemoteChangeHandler';

const equipmentId = 'custom-equipment-1';

function tombstone(updatedAt: number, recordId = equipmentId) {
  const updatedAtIso = new Date(updatedAt).toISOString();
  return {
    eventType: 'UPDATE',
    new: {
      id: recordId,
      updated_at: updatedAtIso,
      deleted_at: updatedAtIso,
    },
    old: null,
  } as unknown as RealtimePostgresChangesPayload<Record<string, unknown>>;
}

describe('RemoteChangeHandler custom equipment tombstones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.brewingNoteRepository.get.mockResolvedValue(undefined);
    mocks.coffeeBeanRepository.get.mockResolvedValue(undefined);
    mocks.customEquipmentRepository.get.mockResolvedValue({
      id: equipmentId,
      timestamp: 1000,
    });
    mocks.customMethodRepository.get.mockResolvedValue({
      equipmentId,
      methods: [{ id: 'method-1' }],
    });
    mocks.customMethodRepository.save.mockResolvedValue(undefined);
    mocks.customEquipmentRepository.delete.mockResolvedValue(undefined);
    mocks.customMethodRepository.delete.mockResolvedValue(undefined);
    mocks.notifyStoreDelete.mockResolvedValue(undefined);
  });

  it('removes the associated methods when the remote equipment deletion wins', async () => {
    const handler = new RemoteChangeHandler();

    await expect(
      handler.handleChange(
        SYNC_TABLES.CUSTOM_EQUIPMENTS as RealtimeSyncTable,
        tombstone(2000),
        new Map()
      )
    ).resolves.toBe(true);

    expect(mocks.customEquipmentRepository.delete).toHaveBeenCalledWith(
      equipmentId
    );
    expect(mocks.customMethodRepository.delete).toHaveBeenCalledWith(
      equipmentId
    );
    expect(
      mocks.customMethodRepository.delete.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mocks.customEquipmentRepository.delete.mock.invocationCallOrder[0]
    );
    expect(mocks.notifyStoreDelete.mock.calls).toEqual([
      [SYNC_TABLES.CUSTOM_METHODS, equipmentId],
      [SYNC_TABLES.CUSTOM_EQUIPMENTS, equipmentId],
    ]);
  });

  it('preserves methods when the equipment is absent and deletion ordering cannot be compared', async () => {
    mocks.customEquipmentRepository.get.mockResolvedValue(undefined);
    const handler = new RemoteChangeHandler();

    await expect(
      handler.handleChange(
        SYNC_TABLES.CUSTOM_EQUIPMENTS as RealtimeSyncTable,
        tombstone(2000),
        new Map()
      )
    ).resolves.toBe(true);

    expect(mocks.customEquipmentRepository.delete).not.toHaveBeenCalled();
    expect(mocks.customMethodRepository.delete).not.toHaveBeenCalled();
    expect(mocks.notifyStoreDelete).not.toHaveBeenCalled();
  });

  it('preserves associated methods when the local equipment is newer', async () => {
    mocks.customEquipmentRepository.get.mockResolvedValue({
      id: equipmentId,
      timestamp: 3000,
    });
    const handler = new RemoteChangeHandler();

    await expect(
      handler.handleChange(
        SYNC_TABLES.CUSTOM_EQUIPMENTS as RealtimeSyncTable,
        tombstone(2000),
        new Map()
      )
    ).resolves.toBe(true);

    expect(mocks.customEquipmentRepository.delete).not.toHaveBeenCalled();
    expect(mocks.customMethodRepository.delete).not.toHaveBeenCalled();
    expect(mocks.notifyStoreDelete).not.toHaveBeenCalled();
  });
});

describe('RemoteChangeHandler custom method conflicts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.customMethodRepository.get.mockResolvedValue({
      equipmentId,
      methods: [{ id: 'method-1', timestamp: 3000 }],
    });
    mocks.customMethodRepository.save.mockResolvedValue(undefined);
    mocks.customMethodRepository.delete.mockResolvedValue(undefined);
  });

  it('preserves newer local methods when an older remote upsert arrives', async () => {
    const handler = new RemoteChangeHandler();

    await expect(
      handler.handleChange(
        SYNC_TABLES.CUSTOM_METHODS as RealtimeSyncTable,
        {
          eventType: 'UPDATE',
          new: {
            id: equipmentId,
            data: {
              equipmentId,
              methods: [{ id: 'method-1', timestamp: 2000, name: 'old' }],
            },
            updated_at: new Date(2500).toISOString(),
            deleted_at: null,
          },
          old: null,
        } as unknown as RealtimePostgresChangesPayload<Record<string, unknown>>,
        new Map()
      )
    ).resolves.toBe(true);

    expect(mocks.customMethodRepository.save).not.toHaveBeenCalled();
    expect(mocks.notifyStoreUpsert).not.toHaveBeenCalled();
  });

  it('accepts a newer remote method upsert', async () => {
    const handler = new RemoteChangeHandler();
    const remoteMethods = [{ id: 'method-1', timestamp: 3500, name: 'new' }];

    await expect(
      handler.handleChange(
        SYNC_TABLES.CUSTOM_METHODS as RealtimeSyncTable,
        {
          eventType: 'UPDATE',
          new: {
            id: equipmentId,
            data: { equipmentId, methods: remoteMethods },
            updated_at: new Date(4000).toISOString(),
            deleted_at: null,
          },
          old: null,
        } as unknown as RealtimePostgresChangesPayload<Record<string, unknown>>,
        new Map()
      )
    ).resolves.toBe(true);

    expect(mocks.customMethodRepository.save).toHaveBeenCalledWith({
      equipmentId,
      methods: remoteMethods,
    });
    expect(mocks.notifyStoreUpsert).toHaveBeenCalledWith(
      SYNC_TABLES.CUSTOM_METHODS,
      equipmentId,
      { equipmentId, methods: remoteMethods }
    );
  });

  it('preserves newer local methods when an older remote tombstone arrives', async () => {
    const handler = new RemoteChangeHandler();

    await expect(
      handler.handleChange(
        SYNC_TABLES.CUSTOM_METHODS as RealtimeSyncTable,
        tombstone(2500, equipmentId),
        new Map()
      )
    ).resolves.toBe(true);

    expect(mocks.customMethodRepository.delete).not.toHaveBeenCalled();
    expect(mocks.notifyStoreDelete).not.toHaveBeenCalled();
  });

  it('applies a newer remote method tombstone', async () => {
    const handler = new RemoteChangeHandler();

    await expect(
      handler.handleChange(
        SYNC_TABLES.CUSTOM_METHODS as RealtimeSyncTable,
        tombstone(4000, equipmentId),
        new Map()
      )
    ).resolves.toBe(true);

    expect(mocks.customMethodRepository.delete).toHaveBeenCalledWith(
      equipmentId
    );
    expect(mocks.notifyStoreDelete).toHaveBeenCalledWith(
      SYNC_TABLES.CUSTOM_METHODS,
      equipmentId
    );
  });
});
