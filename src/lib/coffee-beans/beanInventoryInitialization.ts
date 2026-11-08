import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import { invalid, McpToolError } from '@/lib/mcp/validation';

const missing = (value: unknown) =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && !value.trim());

// Do not treat malformed amounts as missing, or extract a number from arbitrary text.
const grams = (value: unknown): number | null => {
  const amount =
    typeof value === 'number'
      ? value
      : typeof value === 'string' &&
          /^\d+(?:\.\d+)?(?:\s*g)?$/i.test(value.trim())
        ? Number.parseFloat(value)
        : NaN;
  return Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000
    ? amount
    : null;
};

/** Raw storage values take precedence over a parsed view, including invalid text. */
export const getBeanRemainingValue = (before: {
  remaining?: unknown;
  remainingGrams?: unknown;
}) =>
  Object.prototype.hasOwnProperty.call(before, 'remaining')
    ? before.remaining
    : before.remainingGrams;

/** Capacity alone must not silently choose whether unknown stock is initialized. */
export function assertBeanInventoryChoice(
  before: { remaining?: unknown; remainingGrams?: unknown },
  requestedCapacity: unknown,
  choice: unknown
): void {
  const remaining = getBeanRemainingValue(before);
  if (
    requestedCapacity !== undefined &&
    missing(remaining) &&
    choice !== true &&
    choice !== false
  )
    throw new McpToolError(
      'INVENTORY_CHOICE_REQUIRED',
      'Remaining stock is unknown. Explicitly set initializeRemainingFromCapacity to true to initialize it from capacity, or false to keep it unknown.'
    );
}

function assertCanInitializeBeanInventory(
  before: CoffeeBean,
  beans: readonly CoffeeBean[],
  notes: readonly BrewingNote[]
): void {
  if (!missing(before.remaining))
    invalid(
      'Inventory is already set; initialization cannot replace it, including zero'
    );
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
      'Inventory initialization requires no linked history or roasting relationships'
    );
}

/** Call only for explicit initialization, using records read inside the write transaction. */
export function getInitializedBeanRemaining(
  before: CoffeeBean,
  requestedCapacity: unknown,
  savedCapacity: string | undefined,
  beans: readonly CoffeeBean[],
  notes: readonly BrewingNote[]
): string {
  if (
    typeof requestedCapacity !== 'number' ||
    !Number.isFinite(requestedCapacity) ||
    requestedCapacity <= 0 ||
    requestedCapacity > 1_000_000
  )
    invalid('Initializing inventory requires an explicit positive capacity');
  if (grams(savedCapacity) !== requestedCapacity)
    invalid(
      'Initial capacity must be exactly representable at the supported gram precision'
    );
  if (!missing(before.capacity) && grams(before.capacity) !== requestedCapacity)
    invalid(
      'Initial capacity must be missing or equal to the supplied capacity'
    );
  assertCanInitializeBeanInventory(before, beans, notes);

  // Unknown stock is not zero. Do not invent a reversible 0 -> capacity adjustment.
  return savedCapacity!;
}

/** Exact assignment is safe without an old amount; a delta or consumption is not. */
export function getAssignedBeanRemaining(
  before: CoffeeBean,
  request: {
    remainingGrams?: unknown;
    deltaGrams?: unknown;
    recordType?: unknown;
  },
  savedRemaining: string,
  beans: readonly CoffeeBean[],
  notes: readonly BrewingNote[]
): string {
  const requested = request.remainingGrams;
  if (
    request.deltaGrams !== undefined ||
    request.recordType === 'quick-decrement' ||
    typeof requested !== 'number' ||
    !Number.isFinite(requested) ||
    requested < 0 ||
    requested > 1_000_000
  )
    invalid(
      'Unknown inventory requires exact remainingGrams, not a delta or quick decrement'
    );
  if (grams(savedRemaining) !== requested)
    invalid(
      'Remaining stock must be exactly representable at the supported gram precision'
    );
  const capacity = grams(before.capacity);
  if (capacity === null || requested > capacity)
    invalid(
      'Initializing inventory requires a valid capacity at least equal to remaining stock'
    );
  assertCanInitializeBeanInventory(before, beans, notes);
  // The operation receipt captures unknown -> known; no reversible delta exists.
  return savedRemaining;
}
