import { describe, expect, it } from 'vitest';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import {
  buildRecordStatistics,
  calculateNoteCost,
  parseNoteConsumption,
} from './recordMetrics';
const beans: CoffeeBean[] = [
  {
    id: 'a',
    name: 'A',
    roaster: 'R',
    capacity: '100',
    remaining: '70',
    price: '¥20',
    timestamp: 1,
    beanState: 'roasted',
    beanType: 'filter',
  },
  {
    id: 'g',
    name: 'Green',
    capacity: '500',
    remaining: '400',
    price: '50',
    timestamp: 1,
    beanState: 'green',
  },
];
const note = (
  id: string,
  timestamp: number,
  extra: Partial<BrewingNote>
): BrewingNote =>
  ({ id, timestamp, rating: 0, taste: {}, notes: '', ...extra }) as BrewingNote;
describe('shared app and MCP statistics metrics', () => {
  it('shares amount and price semantics and separates roasting from consumption', () => {
    const notes = [
      note('brew', 1000, { beanId: 'a', params: { coffee: '10g' } as never }),
      note('quick', 2000, {
        beanId: 'a',
        source: 'quick-decrement',
        quickDecrementAmount: 5,
      }),
      note('adjust', 3000, {
        beanId: 'a',
        source: 'capacity-adjustment',
        params: { coffee: '50g' } as never,
      }),
      note('roast', 4000, {
        source: 'roasting',
        changeRecord: {
          roastingRecord: { greenBeanId: 'g', roastedAmount: 100 },
        } as never,
      }),
    ];
    const report = buildRecordStatistics(beans, notes, { from: 0, to: 5000 });
    expect(report.consumption).toMatchObject({
      grams: 15,
      cost: 3,
      pricedGrams: 15,
      validRecords: 2,
      fallbackFromInventory: false,
    });
    expect(report.roasting).toMatchObject({
      grams: 100,
      cost: 10,
      validRecords: 1,
    });
    expect(report.trend[0]).toMatchObject({
      consumptionGrams: 15,
      consumptionCost: 3,
      roastedGrams: 100,
      roastingCost: 10,
    });
    expect(parseNoteConsumption(notes[2])).toBe(0);
    expect(calculateNoteCost(10, beans[0])).toBe(2);
  });
  it('uses exclusive end and never invents historical fallback consumption', () => {
    const notes = [
      note('brew', 1000, { beanId: 'a', params: { coffee: '10g' } as never }),
    ];
    expect(
      buildRecordStatistics(beans, notes, { from: 0, to: 1000 }).consumption
        .grams
    ).toBe(0);
    expect(buildRecordStatistics(beans, [], {}).consumption).toMatchObject({
      grams: 30,
      cost: 6,
      fallbackFromInventory: true,
    });
    expect(
      buildRecordStatistics(beans, [], { from: 1 }).consumption
    ).toMatchObject({ grams: 0, cost: 0, fallbackFromInventory: false });
  });
  it('falls back to canonical bean identity when missing beanId and reports unknown prices', () => {
    const report = buildRecordStatistics(beans, [
      note('legacy', 1000, {
        coffeeBeanInfo: { name: 'A', roaster: 'R', roastLevel: 'Medium' },
        params: { coffee: '10g' } as never,
      }),
      note('unknown', 2000, { params: { coffee: '5g' } as never }),
    ]);
    expect(report.consumption).toMatchObject({
      grams: 15,
      cost: 2,
      pricedGrams: 10,
    });
    expect(report.byType.unknown.consumptionGrams).toBe(5);
  });
});
