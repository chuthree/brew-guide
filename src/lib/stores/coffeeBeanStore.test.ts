import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/core/db';
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
});
