import { describe, expect, it } from 'vitest';
import type { BrewingNote } from '@/lib/core/config';
import type { CoffeeBean } from '@/types/app';
import { buildRecordStatistics } from './recordMetrics';
const bean: CoffeeBean = {
  id: 'b',
  name: 'B',
  timestamp: 1,
  capacity: '100',
  remaining: '70',
  price: '20',
  beanState: 'roasted',
};
const make = (
  id: string,
  at: number,
  source?: BrewingNote['source']
): BrewingNote =>
  ({
    id,
    timestamp: at,
    source,
    beanId: 'b',
    params: { coffee: '10g' },
    notes: '',
    rating: 0,
    taste: {},
  }) as BrewingNote;
describe('statistics time and source boundaries', () => {
  it('includes the start, excludes the end, and groups in local calendar months', () => {
    const jan = new Date(2026, 0, 31, 12).getTime(),
      feb = new Date(2026, 1, 1, 12).getTime(),
      end = new Date(2026, 2, 1, 12).getTime();
    const result = buildRecordStatistics(
      [bean],
      [make('a', jan), make('b', feb), make('end', end)],
      { from: jan, to: end, groupBy: 'month' }
    );
    expect(result.consumption.grams).toBe(20);
    expect(result.trend.map(t => t.period)).toEqual(['2026-01', '2026-02']);
  });
  it('does not report capacity corrections as consumption or synthesize missing periods', () => {
    const r = buildRecordStatistics(
      [bean],
      [make('adjust', 100, 'capacity-adjustment')],
      { from: 1, to: 1000 }
    );
    expect(r.consumption.grams).toBe(0);
    expect(r.trend).toEqual([]);
  });
  it('reports pure roasting separately from brew consumption without price assumptions', () => {
    const green: CoffeeBean = {
      ...bean,
      id: 'g',
      beanState: 'green',
      price: undefined,
    };
    const roast = {
      ...make('roast', 100, 'roasting'),
      changeRecord: { roastingRecord: { greenBeanId: 'g', roastedAmount: 30 } },
    } as BrewingNote;
    const r = buildRecordStatistics([green], [roast], { from: 1, to: 1000 });
    expect(r.roasting).toMatchObject({ grams: 30, cost: 0, validRecords: 1 });
    expect(r.consumption.grams).toBe(0);
  });
});
