import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import { invalid, McpToolError } from '@/lib/mcp/validation';
import { formatBeanDisplayName } from '@/lib/utils/beanVarietyUtils';

/** Local, structured diagnostics. Never relax inventory checks to make a preview succeed. */
export class HistoricalConversionConflict extends McpToolError {
  constructor(
    public readonly inventory: {
      capacityGrams: number;
      remainingGrams: number;
      convertedGrams: number;
      brewUsageGrams: number;
      brewCount: number;
    }
  ) {
    super(
      'INVALID_ARGUMENT',
      `Existing brew usage contradicts the historical conversion; reconcile records first. 总量 ${inventory.capacityGrams}g，剩余 ${inventory.remainingGrams}g，可迁移的已用量 ${inventory.convertedGrams}g，但 ${inventory.brewCount} 条冲煮笔记合计 ${inventory.brewUsageGrams}g。请先核对库存与笔记，不要自动修改或截断用量。`
    );
  }
}

/** Shared native/Web historical migration rules. No storage or UI side effects. */
export const conversionAmount = (n: number) =>
  String(Math.round(n * 1000) / 1000);
export function conversionGrams(value: unknown, label: string) {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' &&
          /^\d+(?:\.\d+)?(?:\s*g)?$/.test(value.trim())
        ? parseFloat(value)
        : NaN;
  if (
    !Number.isFinite(n) ||
    n < 0 ||
    n > 1_000_000 ||
    Math.abs(Number(conversionAmount(n)) - n) > 1e-9
  )
    invalid(
      `${label} must be a valid nonnegative gram amount with at most three decimals`
    );
  return n;
}
export function analyzeHistoricalConversion(
  original: CoffeeBean,
  beans: CoffeeBean[],
  all: BrewingNote[]
) {
  const id = original.id;
  if (
    (original.beanState ?? 'roasted') !== 'roasted' ||
    original.sourceGreenBeanId ||
    original.sourceGreenBeanIds?.length
  )
    invalid(
      'Only historical roasted beans without green provenance can be converted'
    );
  if (
    beans.some(
      b => b.sourceGreenBeanId === id || b.sourceGreenBeanIds?.includes(id)
    ) ||
    all.some(
      n =>
        n.changeRecord?.roastingRecord?.greenBeanId === id ||
        n.changeRecord?.roastingRecord?.inputs?.some(
          input => input.greenBeanId === id
        ) ||
        n.changeRecord?.roastingRecord?.roastedBeanId === id ||
        (n.beanId === id && n.source === 'roasting')
    )
  )
    invalid(
      'Existing roasting relationships must be resolved before this historical conversion'
    );
  const related = all
    .filter(n => n.beanId === id)
    .sort((a, b) => a.id.localeCompare(b.id));
  const records = related.filter(
    n => n.source === 'quick-decrement' || n.source === 'capacity-adjustment'
  );
  const brews = related.filter(n => !records.includes(n));
  const capacity = conversionGrams(original.capacity, 'Capacity'),
    remaining = conversionGrams(original.remaining, 'Remaining');
  if (remaining > capacity) invalid('Remaining inventory exceeds capacity');
  const input = Number(conversionAmount(capacity - remaining));
  const usage = Number(
    conversionAmount(
      brews.reduce(
        (sum, n) =>
          sum +
          (n.params?.coffee
            ? conversionGrams(n.params.coffee, 'Linked brew dose')
            : 0),
        0
      )
    )
  );
  if (usage > input || (input === 0 && brews.length > 0))
    throw new HistoricalConversionConflict({
      capacityGrams: capacity,
      remainingGrams: remaining,
      convertedGrams: input,
      brewUsageGrams: usage,
      brewCount: brews.length,
    });
  const copiedFields = new Set([
    'id',
    'timestamp',
    'beanState',
    'name',
    'roaster',
    'beanType',
    'roastLevel',
    'flavor',
    'notes',
    'brand',
    'blendComponents',
    'capacity',
    'remaining',
    'price',
    'roastDate',
    'sourceGreenBeanId',
  ]);
  const discardedMetadataFields = Object.entries(original)
    .filter(
      ([key, value]) =>
        !copiedFields.has(key) &&
        value !== undefined &&
        value !== null &&
        value !== ''
    )
    .map(([key]) => key)
    .sort();
  return {
    original,
    related,
    records,
    brews,
    capacity,
    remaining,
    input,
    usage,
    discardedMetadataFields,
  };
}
export function buildHistoricalConversionRecords(
  g: ReturnType<typeof analyzeHistoricalConversion>,
  now: number,
  newId: () => string
) {
  const o = g.original;
  const timestamp = Math.max(now, o.timestamp + 1);
  // Exact canonical migration field selection; derived inventory must not inherit
  // arbitrary old provenance, repurchase identifiers or stock history snapshots.
  const inherited = {
    name: o.name,
    roaster: o.roaster,
    beanType: o.beanType,
    roastLevel: o.roastLevel,
    flavor: o.flavor,
    notes: o.notes,
    brand: o.brand,
    blendComponents: o.blendComponents,
  };
  const green: CoffeeBean = {
    ...inherited,
    id: newId(),
    timestamp,
    beanState: 'green',
    capacity: o.capacity,
    remaining: o.remaining,
    price: o.price,
    purchaseDate: o.roastDate,
  };
  let roasted: CoffeeBean | undefined;
  let roastNote: BrewingNote | undefined;
  if (g.input > 0) {
    const price = parseFloat(o.price || '0');
    roasted = {
      ...inherited,
      id: newId(),
      timestamp,
      beanState: 'roasted',
      capacity: conversionAmount(g.input),
      remaining: conversionAmount(g.input - g.usage),
      roastDate: o.roastDate,
      price:
        Number.isFinite(price) && price > 0 && g.capacity > 0
          ? ((price / g.capacity) * g.input).toFixed(2)
          : undefined,
      sourceGreenBeanId: green.id,
    };
    roastNote = {
      id: newId(),
      timestamp,
      coffeeBeanInfo: {
        name: green.name,
        roastLevel: green.roastLevel || '未知',
        roastDate: green.purchaseDate,
        roaster: green.roaster,
      },
      rating: 0,
      taste: {},
      notes: `从熟豆转换：烘焙了 ${conversionAmount(g.input)}g 生豆 → ${formatBeanDisplayName(roasted)}`,
      source: 'roasting',
      beanId: green.id,
      changeRecord: {
        roastingRecord: {
          greenBeanId: green.id,
          greenBeanName: formatBeanDisplayName(green),
          roastedAmount: g.input,
          roastedBeanId: roasted.id,
          roastedBeanName: formatBeanDisplayName(roasted),
        },
      },
    };
  }
  const migratedNotes = g.brews.map(note => {
    return {
      ...note,
      beanId: roasted!.id,
      coffeeBeanInfo: {
        roastLevel: roasted!.roastLevel || '未知',
        ...note.coffeeBeanInfo,
        name: roasted!.name,
      },
      updatedAt: Math.max(timestamp, (note.updatedAt ?? note.timestamp) + 1),
    };
  });
  return { green, roasted, roastNote, migratedNotes, timestamp };
}
