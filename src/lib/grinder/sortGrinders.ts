import type { Grinder } from '@/lib/data/models';

const collator = new Intl.Collator('zh-CN', { numeric: true });

const numericScale = (scale: string) => {
  const value = Number.parseFloat(scale);
  return Number.isFinite(value) ? value : Infinity;
};

export function sortGrinders(grinders: readonly Grinder[]): Grinder[] {
  return [...grinders].sort((left, right) => {
    const leftScale = left.currentGrindSize?.trim() || '';
    const rightScale = right.currentGrindSize?.trim() || '';

    return (
      collator.compare(left.name, right.name) ||
      Number(!leftScale) - Number(!rightScale) ||
      numericScale(leftScale) - numericScale(rightScale) ||
      collator.compare(leftScale, rightScale) ||
      left.id.localeCompare(right.id)
    );
  });
}
