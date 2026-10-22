import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CoffeeBean } from '@/types/app';
import { FlavorPeriodStatus } from '@/lib/utils/beanVarietyUtils';
import {
  buildBeanListRecords,
  createBeanInventorySnapshot,
  searchBeanRecords,
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

  it('sorts flavor period categories by fixed availability priority instead of count', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-20T12:00:00'));

    const frozenBean = buildBean({
      id: 'frozen',
      isFrozen: true,
      remaining: '20',
    });
    const declineBean = buildBean({
      id: 'decline',
      roastDate: '2026-03-01',
      remaining: '20',
    });
    const inTransitBean = buildBean({
      id: 'in-transit',
      isInTransit: true,
      remaining: '20',
    });
    const unknownBean = buildBean({
      id: 'unknown',
      roastDate: '',
      remaining: '20',
    });
    const optimalBeans = [
      buildBean({ id: 'optimal-1', remaining: '20' }),
      buildBean({ id: 'optimal-2', remaining: '20' }),
    ];
    const agingBeans = [
      buildBean({
        id: 'aging-1',
        roastDate: '2026-06-18',
        remaining: '20',
      }),
      buildBean({
        id: 'aging-2',
        roastDate: '2026-06-18',
        remaining: '20',
      }),
      buildBean({
        id: 'aging-3',
        roastDate: '2026-06-18',
        remaining: '20',
      }),
    ];

    const snapshot = createSnapshot([
      ...agingBeans,
      ...optimalBeans,
      frozenBean,
      declineBean,
      inTransitBean,
      unknownBean,
    ]);

    expect(snapshot.availableFlavorPeriods).toEqual([
      FlavorPeriodStatus.OPTIMAL,
      FlavorPeriodStatus.DECLINE,
      FlavorPeriodStatus.AGING,
      FlavorPeriodStatus.FROZEN,
      FlavorPeriodStatus.IN_TRANSIT,
      FlavorPeriodStatus.UNKNOWN,
    ]);
  });

  it('can search all categories without widening bean type', () => {
    const currentCategoryBean = buildBean({
      id: 'current-filter',
      name: 'Current Filter Bean',
      beanType: 'filter',
      blendComponents: [{ variety: 'Typica' }],
    });
    const matchingFilterBean = buildBean({
      id: 'matching-filter',
      name: '121 Filter Bean',
      beanType: 'filter',
      blendComponents: [{ variety: 'Bourbon' }],
    });
    const matchingEspressoBean = buildBean({
      id: 'matching-espresso',
      name: '121 Espresso Bean',
      beanType: 'espresso',
      blendComponents: [{ variety: 'Bourbon' }],
    });
    const beans = [
      currentCategoryBean,
      matchingFilterBean,
      matchingEspressoBean,
    ];

    const currentCategorySnapshot = createSnapshot(beans, {
      filterMode: 'variety',
      selectedVariety: 'Typica',
      selectedBeanType: 'filter',
    });
    expect(
      searchBeanRecords(currentCategorySnapshot.filteredRecords, '121')
    ).toEqual([]);

    const allCategorySnapshot = createSnapshot(beans, {
      filterMode: 'variety',
      selectedVariety: null,
      selectedBeanType: 'filter',
    });
    expect(
      searchBeanRecords(allCategorySnapshot.filteredRecords, '121').map(
        record => record.bean.id
      )
    ).toEqual(['matching-filter']);
  });

  it('keeps empty beans searchable in the current category while hidden', () => {
    const emptyBean = buildBean({
      id: 'empty-search-result',
      name: 'Archived Typica',
      remaining: '0',
      blendComponents: [{ variety: 'Typica' }],
    });
    const otherCategoryBean = buildBean({
      id: 'other-empty-search-result',
      name: 'Archived Bourbon',
      remaining: '0',
      blendComponents: [{ variety: 'Bourbon' }],
    });
    const snapshot = createSnapshot([emptyBean, otherCategoryBean], {
      filterMode: 'variety',
      selectedVariety: 'Typica',
      showEmptyBeans: false,
    });

    expect(snapshot.emptyRecords).toEqual([]);
    expect(
      searchBeanRecords(snapshot.searchableEmptyRecords, 'Archived').map(
        record => record.bean.id
      )
    ).toEqual(['empty-search-result']);
  });

  it('searches structured bean component fields and legacy origin', () => {
    const structuredBean = buildBean({
      id: 'structured',
      name: 'Structured Bean',
      blendComponents: [
        {
          country: '埃塞俄比亚',
          region: '西达摩',
          estate: '博纳',
          processingStation: '沃卡',
          altitude: '2100m',
          process: '水洗',
          batch: 'A12',
        },
      ],
    });
    const legacyBean = buildBean({
      id: 'legacy',
      name: 'Legacy Bean',
      blendComponents: [{ origin: '哥伦比亚 蕙兰' }],
    });
    const snapshot = createSnapshot([structuredBean, legacyBean]);

    expect(
      searchBeanRecords(snapshot.filteredRecords, '博纳').map(
        record => record.bean.id
      )
    ).toEqual(['structured']);
    expect(
      searchBeanRecords(snapshot.filteredRecords, '沃卡').map(
        record => record.bean.id
      )
    ).toEqual(['structured']);
    expect(
      searchBeanRecords(snapshot.filteredRecords, '蕙兰').map(
        record => record.bean.id
      )
    ).toEqual(['legacy']);
  });

  it('keeps origin filtering on the legacy origin field only', () => {
    const structuredBean = buildBean({
      id: 'structured',
      blendComponents: [{ origin: '旧产地', country: '埃塞俄比亚' }],
    });
    const legacyBean = buildBean({
      id: 'legacy',
      blendComponents: [{ origin: '埃塞俄比亚 西达摩' }],
    });
    const snapshot = createSnapshot([structuredBean, legacyBean], {
      filterMode: 'origin',
      selectedOrigin: '埃塞俄比亚',
    });

    expect(snapshot.filteredBeans.map(bean => bean.id)).toEqual([]);
    expect(snapshot.availableOrigins).toEqual(['埃塞俄比亚 西达摩', '旧产地']);
  });

  it('uses enabled structured field values as independent category values', () => {
    const structuredBean = buildBean({
      id: 'structured',
      blendComponents: [
        {
          origin: '旧产地',
          country: '埃塞俄比亚',
          region: '耶加雪菲',
          estate: '班驰玛吉',
          processingStation: '沃卡',
          altitude: '1200',
        },
      ],
    });
    const snapshot = createSnapshot([structuredBean], {
      filterMode: 'country',
      selectedOrigin: '埃塞俄比亚',
    });

    expect(snapshot.filteredBeans.map(bean => bean.id)).toEqual(['structured']);
    expect(snapshot.availableBeanFieldValues.origin).toEqual(['旧产地']);
    expect(snapshot.availableBeanFieldValues.country).toEqual(['埃塞俄比亚']);
    expect(snapshot.availableBeanFieldValues.region).toEqual(['耶加雪菲']);
    expect(snapshot.availableBeanFieldValues.estate).toEqual(['班驰玛吉']);
    expect(snapshot.availableBeanFieldValues.processingStation).toEqual([
      '沃卡',
    ]);
    expect(snapshot.availableBeanFieldValues.altitude).toEqual(['1200']);

    const stationSnapshot = createSnapshot([structuredBean], {
      filterMode: 'processingStation',
      selectedOrigin: '沃卡',
    });
    expect(stationSnapshot.filteredBeans.map(bean => bean.id)).toEqual([
      'structured',
    ]);
  });
});

it('searches each variety from one multi-valued component without creating blend rows', () => {
  const bean = buildBean({
    blendComponents: [
      { origin: 'Ethiopia', variety: ['SL28/34', '74110', '74112'] },
    ],
  });
  const records = buildBeanListRecords([bean]);
  for (const query of ['SL28/34', '74110', '74112']) {
    expect(searchBeanRecords(records, query)).toHaveLength(1);
  }
  expect(bean.blendComponents).toHaveLength(1);
});
