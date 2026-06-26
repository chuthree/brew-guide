import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CoffeeBean } from '@/types/app';
import { FlavorPeriodStatus } from '@/lib/utils/beanVarietyUtils';
import {
  buildBeanListRecords,
  createBeanInventorySnapshot,
  type BeanInventorySnapshotOptions,
} from './beanListPipeline';

const baseOptions: BeanInventorySnapshotOptions = {
  filterMode: 'flavorPeriod',
  selectedVariety: null,
  selectedOrigin: null,
  selectedProcessingMethod: null,
  selectedFlavorPeriod: null,
  selectedRoaster: null,
  selectedBeanGroupId: null,
  selectedBeanType: 'all',
  selectedBeanState: 'roasted',
  showEmptyBeans: true,
};

const buildBean = (bean: Partial<CoffeeBean>): CoffeeBean => ({
  id: 'bean',
  timestamp: 1,
  name: 'Test Bean',
  roastDate: '2026-06-01',
  startDay: 7,
  endDay: 60,
  capacity: '100',
  remaining: '50',
  beanState: 'roasted',
  ...bean,
});

const createSnapshot = (
  beans: CoffeeBean[],
  options: Partial<BeanInventorySnapshotOptions> = {}
) =>
  createBeanInventorySnapshot(buildBeanListRecords(beans), {
    ...baseOptions,
    ...options,
  });

describe('beanListPipeline', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps empty beans out of flavor period categories', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-20T12:00:00'));

    const availableOptimal = buildBean({
      id: 'available-optimal',
      remaining: '25',
    });
    const emptyOptimal = buildBean({
      id: 'empty-optimal',
      remaining: '0',
    });
    const emptyFrozen = buildBean({
      id: 'empty-frozen',
      remaining: '0',
      isFrozen: true,
    });

    const allSnapshot = createSnapshot([
      availableOptimal,
      emptyOptimal,
      emptyFrozen,
    ]);
    expect(allSnapshot.availableFlavorPeriods).toEqual([
      FlavorPeriodStatus.OPTIMAL,
    ]);
    expect(allSnapshot.emptyBeans.map(bean => bean.id)).toEqual([
      'empty-optimal',
      'empty-frozen',
    ]);

    const optimalSnapshot = createSnapshot(
      [availableOptimal, emptyOptimal, emptyFrozen],
      { selectedFlavorPeriod: FlavorPeriodStatus.OPTIMAL }
    );
    expect(optimalSnapshot.filteredBeans.map(bean => bean.id)).toEqual([
      'available-optimal',
    ]);
    expect(optimalSnapshot.emptyBeans).toEqual([]);
  });
});
