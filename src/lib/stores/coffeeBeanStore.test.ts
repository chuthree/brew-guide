import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/core/db';
import { coffeeBeanRepository as dexieCoffeeBeanRepository } from '@/lib/data/adapters/dexie/coffeeBeanRepository';
import { coffeeBeanImageRepository as dexieCoffeeBeanImageRepository } from '@/lib/data/adapters/dexie/coffeeBeanImageRepository';
import { bindDexieRepositories } from '@/lib/data/dexieRuntime';
import { coffeeBeanRepository } from '@/lib/data/repositories';
import type { CoffeeBean } from '@/types/app';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';

vi.mock('@/lib/app/dataIntegrity', () => ({
  clearExpectedCoreDataDeletion: vi.fn(async () => {}),
  markExpectedCoreDataDeletionIfEmpty: vi.fn(async () => {}),
}));

const beans: CoffeeBean[] = [
  { id: 'bean-delete', timestamp: 10, name: 'Delete path' },
  { id: 'bean-remove', timestamp: 20, name: 'Remove path' },
];

describe('coffeeBeanStore image-aware deletion', () => {
  beforeEach(async () => {
    bindDexieRepositories();
    await Promise.all([
      db.coffeeBeans.clear(),
      db.coffeeBeanImages.clear(),
      db.coffeeBeanImageThumbnails.clear(),
    ]);
    useCoffeeBeanStore.setState({
      beans: [],
      isLoading: false,
      error: null,
      initialized: false,
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all([
      db.coffeeBeans.clear(),
      db.coffeeBeanImages.clear(),
      db.coffeeBeanImageThumbnails.clear(),
    ]);
  });

  it('deletes each bean together with its image and thumbnail records', async () => {
    await coffeeBeanRepository.upsertMany(beans);
    for (const bean of beans) {
      await db.coffeeBeanImages.put({
        beanId: bean.id,
        image: `original-${bean.id}`,
        updatedAt: bean.timestamp,
      });
      await db.coffeeBeanImageThumbnails.put({
        beanId: bean.id,
        imageThumbnail: `thumbnail-${bean.id}`,
        updatedAt: bean.timestamp,
      });
    }
    useCoffeeBeanStore.getState().setBeans(beans);

    expect(await useCoffeeBeanStore.getState().deleteBean('bean-delete')).toBe(
      true
    );
    await useCoffeeBeanStore.getState().removeBean('bean-remove');

    expect(useCoffeeBeanStore.getState().beans).toEqual([]);
    for (const bean of beans) {
      expect(await coffeeBeanRepository.get(bean.id)).toBeUndefined();
      expect(await db.coffeeBeanImages.get(bean.id)).toBeUndefined();
      expect(await db.coffeeBeanImageThumbnails.get(bean.id)).toBeUndefined();
    }
  });

  it('keeps loading beans when optional image diagnostics fail', async () => {
    await coffeeBeanRepository.upsertMany(beans);
    vi.spyOn(
      dexieCoffeeBeanImageRepository,
      'getRecordCounts'
    ).mockRejectedValue(new Error('image diagnostics unavailable'));

    await expect(
      useCoffeeBeanStore.getState().loadBeans()
    ).resolves.toBeUndefined();

    const store = useCoffeeBeanStore.getState();
    expect(store.beans.map(bean => bean.id)).toEqual(
      expect.arrayContaining(beans.map(bean => bean.id))
    );
    expect(store.beans).toHaveLength(beans.length);
    expect(store.error).toBeNull();
    expect(store.initialized).toBe(true);
    expect(store.isLoading).toBe(false);
  });

  it('coalesces duplicate load requests while a load is in progress', async () => {
    await coffeeBeanRepository.upsertMany(beans);
    let resolveRead!: (result: CoffeeBean[]) => void;
    const listSpy = vi
      .spyOn(dexieCoffeeBeanRepository, 'list')
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveRead = resolve;
          })
      );

    const firstLoad = useCoffeeBeanStore.getState().loadBeans();
    expect(listSpy).toHaveBeenCalledTimes(1);

    await useCoffeeBeanStore.getState().loadBeans();
    expect(listSpy).toHaveBeenCalledTimes(1);

    resolveRead(beans);
    await firstLoad;

    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(useCoffeeBeanStore.getState().beans).toHaveLength(beans.length);
    expect(useCoffeeBeanStore.getState().initialized).toBe(true);
    expect(useCoffeeBeanStore.getState().isLoading).toBe(false);
  });

  it('preserves an explicit refresh requested during a load', async () => {
    await coffeeBeanRepository.upsertMany(beans);
    let resolveRead!: (result: CoffeeBean[]) => void;
    const listSpy = vi
      .spyOn(dexieCoffeeBeanRepository, 'list')
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveRead = resolve;
          })
      );

    const firstLoad = useCoffeeBeanStore.getState().loadBeans();
    await useCoffeeBeanStore.getState().refreshBeans();
    resolveRead(beans);
    await firstLoad;

    await vi.waitFor(() => {
      expect(listSpy).toHaveBeenCalledTimes(2);
      expect(useCoffeeBeanStore.getState().isLoading).toBe(false);
      expect(useCoffeeBeanStore.getState().initialized).toBe(true);
    });
  });
});
