/** Pure shared inventory amount parsing. */
const AMOUNT_REGEX = /\d+(?:\.\d+)?/;
const NEGATIVE_AMOUNT_REGEX = /-\s*\d/;

export function formatCoffeeBeanAmount(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
}

/** Keep persisted inventory at the same gram precision as notes and roasting. */
export function formatInventoryAmount(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

export const parseCoffeeBeanAmount = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  if (NEGATIVE_AMOUNT_REGEX.test(value)) {
    return null;
  }

  const match = value.match(AMOUNT_REGEX);
  if (!match) {
    return null;
  }

  const amount = Number.parseFloat(match[0]);
  return Number.isFinite(amount) ? amount : null;
};
