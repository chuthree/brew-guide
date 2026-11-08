/** Shared native/Web read-only analytics; no storage or writes. */
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import type { AppSettings } from '@/lib/data/models';
import { calculateEstimatedCupsFromWeights } from '@/lib/settings/estimatedCupDose';
import { buildRecordStatistics } from '@/lib/statistics/recordMetrics';
import { calculateFlavorInfo } from '@/lib/utils/flavorPeriodUtils';
import { parseCoffeeBeanAmount } from '@/lib/coffee-beans/amount';
import { noteDose } from './noteInput';
import { invalid } from './validation';
export function buildBusinessStatistics(
  beans: CoffeeBean[],
  notes: BrewingNote[],
  settings: AppSettings,
  args: Record<string, unknown>
) {
  const from = args.from ? Date.parse(String(args.from)) : -Infinity;
  const to = args.to ? Date.parse(String(args.to)) : Infinity;
  if (from > to) invalid('from must not exceed to');
  const selected = notes.filter(n => n.timestamp >= from && n.timestamp < to);
  const counts = {
    brewing: 0,
    quickConsumption: 0,
    capacityAdjustment: 0,
    roasting: 0,
  };
  for (const note of selected) {
    if (note.source === 'capacity-adjustment') counts.capacityAdjustment++;
    else if (note.source === 'quick-decrement') counts.quickConsumption++;
    else if (String(note.source).includes('roast')) counts.roasting++;
    else counts.brewing++;
  }
  const inventory = ['green', 'roasted'].map(state => {
    const matching = beans.filter(b => (b.beanState ?? 'roasted') === state);
    return {
      state,
      beanCount: matching.length,
      capacityGrams: matching.reduce(
        (sum, b) => sum + (parseCoffeeBeanAmount(b.capacity) ?? 0),
        0
      ),
      remainingGrams: matching.reduce(
        (sum, b) => sum + (parseCoffeeBeanAmount(b.remaining) ?? 0),
        0
      ),
    };
  });
  return {
    inventory,
    estimatedCups: calculateEstimatedCupsFromWeights(
      beans
        .filter(b => b.beanState !== 'green')
        .map(b => ({
          beanType: b.beanType,
          remainingWeight: parseCoffeeBeanAmount(b.remaining) ?? 0,
        })),
      settings.estimatedCupDoseSettings
    ),
    records: counts,
    totalRecords: selected.length,
    metrics: buildRecordStatistics(beans, notes, {
      from: args.from ? from : undefined,
      to: args.to ? to : undefined,
      groupBy: args.groupBy as 'day' | 'month' | undefined,
    }),
    scope:
      'Current inventory plus original-app record consumption/cost rules; quick consumption is included in usage but not ordinary brewing count.',
    from: args.from ?? null,
    to: args.to ?? null,
  };
}

export function buildBusinessInventorySummary(
  beans: CoffeeBean[],
  notes: BrewingNote[],
  days = 30,
  includeNotes = true
) {
  const recent = notes.filter(
    note =>
      !note.source &&
      note.timestamp >= Date.now() - days * 86_400_000 &&
      note.timestamp <= Date.now()
  );
  const rated = recent.filter(note => note.rating > 0);
  const phases: Record<string, number> = {};
  for (const bean of beans) {
    if (
      bean.beanState === 'green' ||
      (parseCoffeeBeanAmount(bean.remaining) ?? 0) <= 0
    )
      continue;
    const phase = calculateFlavorInfo(bean).phase;
    phases[phase] = (phases[phase] ?? 0) + 1;
  }
  return {
    asOf: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    beans: {
      total: beans.length,
      inStock: beans.filter(
        bean => (parseCoffeeBeanAmount(bean.remaining) ?? 0) > 0
      ).length,
      roastedRemainingGrams: beans
        .filter(bean => bean.beanState !== 'green')
        .reduce(
          (sum, bean) => sum + (parseCoffeeBeanAmount(bean.remaining) ?? 0),
          0
        ),
      greenRemainingGrams: beans
        .filter(bean => bean.beanState === 'green')
        .reduce(
          (sum, bean) => sum + (parseCoffeeBeanAmount(bean.remaining) ?? 0),
          0
        ),
      flavorPeriodCounts: phases,
    },
    ...(includeNotes
      ? {
          recentBrews: {
            days,
            count: recent.length,
            coffeeGrams: recent.reduce((sum, note) => sum + noteDose(note), 0),
            averageRating: rated.length
              ? rated.reduce((sum, note) => sum + note.rating, 0) / rated.length
              : null,
          },
        }
      : {}),
  };
}
