import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import { invalid } from '@/lib/mcp/validation';
import { formatCoffeeBeanAmount, parseCoffeeBeanAmount } from './amount';

/** The form and business tools treat package size and untouched stock together. */
export const getCapacityChangeUpdates = (
  previousCapacity: unknown,
  previousRemaining: string | undefined,
  nextCapacity: string,
  syncWhenFull = true
): { capacity: string; remaining: string | undefined } => {
  if (!nextCapacity.trim()) return { capacity: nextCapacity, remaining: '' };
  if (!syncWhenFull)
    return { capacity: nextCapacity, remaining: previousRemaining };

  const previousCapacityAmount = parseCoffeeBeanAmount(previousCapacity);
  const shouldSyncRemaining =
    !previousRemaining?.trim() ||
    (previousCapacityAmount !== null &&
      previousCapacityAmount === parseCoffeeBeanAmount(previousRemaining));
  return {
    capacity: nextCapacity,
    remaining: shouldSyncRemaining ? nextCapacity : previousRemaining,
  };
};

type CapacityState = {
  capacity?: unknown;
  remaining?: unknown;
  capacityGrams?: unknown;
  remainingGrams?: unknown;
};
const missing = (value: unknown) =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && !value.trim());
const storedValue = (before: CapacityState, field: 'capacity' | 'remaining') =>
  Object.hasOwn(before, field) ? before[field] : before[`${field}Grams`];
const exactGrams = (value: unknown): number | null => {
  if (missing(value)) return null;
  const amount =
    typeof value === 'number'
      ? value
      : typeof value === 'string' &&
          /^\d+(?:\.\d+)?(?:\s*g)?$/i.test(value.trim())
        ? Number.parseFloat(value)
        : NaN;
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000)
    invalid('Existing bean weight is invalid; correct it in the app first');
  return amount;
};

/** Deterministic plan shared by approval and the version-checked write. */
export function getBeanCapacityUpdate(
  before: CapacityState,
  requestedCapacity: unknown
) {
  if (requestedCapacity === undefined) return undefined;
  if (
    typeof requestedCapacity !== 'number' ||
    !Number.isFinite(requestedCapacity) ||
    requestedCapacity < 0 ||
    requestedCapacity > 1_000_000
  )
    invalid('Capacity must be between 0 and 1000000 grams');
  const capacity = formatCoffeeBeanAmount(requestedCapacity);
  if (Number(capacity) !== requestedCapacity)
    invalid('Capacity requires at most one decimal place');
  const previousCapacity = exactGrams(storedValue(before, 'capacity'));
  const previousRemaining = exactGrams(storedValue(before, 'remaining'));
  const updates = getCapacityChangeUpdates(
    previousCapacity,
    previousRemaining === null ? undefined : String(previousRemaining),
    capacity
  );
  const remaining = updates.remaining!;
  if (Number(remaining) > requestedCapacity)
    invalid('Capacity cannot be less than remaining stock');
  return {
    capacity,
    remaining,
    previousRemaining,
    inventoryInitialized: previousRemaining === null,
    remainingChanged: previousRemaining !== Number(remaining),
  };
}

/** Unknown stock must never be reconstructed from package size after use. */
export function assertBeanCapacityHistory(
  before: CoffeeBean,
  beans: readonly CoffeeBean[],
  notes: readonly BrewingNote[]
): void {
  const id = before.id;
  if (
    before.sourceGreenBeanId ||
    before.sourceGreenBeanIds?.length ||
    beans.some(
      bean =>
        bean.sourceGreenBeanId === id || bean.sourceGreenBeanIds?.includes(id)
    ) ||
    notes.some(note => {
      const roasting = note.changeRecord?.roastingRecord;
      return (
        note.beanId === id ||
        roasting?.greenBeanId === id ||
        roasting?.roastedBeanId === id ||
        roasting?.inputs?.some(input => input.greenBeanId === id)
      );
    })
  )
    invalid(
      'Cannot fill unknown stock from capacity when linked history or roasting relationships exist. Correct the actual inventory in the app first; nothing was changed.'
    );
}
