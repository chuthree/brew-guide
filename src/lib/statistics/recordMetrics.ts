import type { BrewingNote } from '@/lib/core/config';
import type { CoffeeBean } from '@/types/app';
import { findCoffeeBeanByIdentity } from '@/lib/utils/coffeeBeanUtils';

/** 解析数字字段（处理字符串如 "100g" 或 "¥50"） */
export const parseNum = (value: string | number | undefined | null): number => {
  if (value === undefined || value === null) return 0;
  const parsed = parseFloat(value.toString().replace(/[^\d.]/g, ''));
  return isNaN(parsed) ? 0 : parsed;
};

/** 解析笔记中的咖啡消耗量 */
export const parseNoteConsumption = (note: BrewingNote): number => {
  if (note.source === 'capacity-adjustment') return 0;
  if (note.source === 'quick-decrement' && note.quickDecrementAmount) {
    return note.quickDecrementAmount;
  }
  if (note.params?.coffee) {
    const match = note.params.coffee.match(/(\d+(\.\d+)?)/);
    if (match) return parseFloat(match[0]);
  }
  return 0;
};

/** 根据笔记查找对应的咖啡豆（优先 beanId，降级到名称） */
export const findBeanForNote = (
  note: BrewingNote,
  beans: CoffeeBean[]
): CoffeeBean | null => {
  if (note.beanId) {
    const bean = beans.find(b => b.id === note.beanId);
    if (bean) return bean;
  }
  return findCoffeeBeanByIdentity(beans, note.coffeeBeanInfo);
};

/** 计算笔记的花费 */
export const calculateNoteCost = (
  amount: number,
  bean: CoffeeBean | null
): number => {
  if (!bean?.price || !bean?.capacity) return 0;
  const price = parseNum(bean.price);
  const capacity = parseNum(bean.capacity);
  if (capacity <= 0) return 0;
  return (amount * price) / capacity;
};

/** 判断咖啡豆是否具备可用于克价计算的价格与容量 */
export const hasBeanPrice = (bean: CoffeeBean | null): boolean => {
  if (!bean?.price || !bean?.capacity) return false;
  return parseNum(bean.price) > 0 && parseNum(bean.capacity) > 0;
};

/** Headless report uses the same amount/identity/cost rules as both app statistics views. */
export function buildRecordStatistics(
  beans: CoffeeBean[],
  notes: BrewingNote[],
  options: { from?: number; to?: number; groupBy?: 'day' | 'month' } = {}
) {
  const from = options.from ?? 0;
  const to = options.to ?? Infinity;
  const roasted = beans.filter(b => b.beanState !== 'green');
  const green = beans.filter(b => b.beanState === 'green');
  const allTime = options.from === undefined && options.to === undefined;
  const trend = new Map<
    string,
    {
      period: string;
      consumptionGrams: number;
      consumptionCost: number;
      roastedGrams: number;
      roastingCost: number;
    }
  >();
  let consumption = 0,
    cost = 0,
    pricedGrams = 0,
    validNotes = 0,
    roastedGrams = 0,
    roastingCost = 0,
    validRoasts = 0;
  const byType = Object.fromEntries(
    ['espresso', 'filter', 'omni', 'unknown'].map(type => [
      type,
      { consumptionGrams: 0, cost: 0, roastedGrams: 0, roastingCost: 0 },
    ])
  );
  for (const note of notes) {
    if (
      !note.timestamp ||
      note.timestamp < from ||
      note.timestamp >= to ||
      note.source === 'capacity-adjustment'
    )
      continue;
    const date = new Date(note.timestamp);
    const period =
      options.groupBy === 'month'
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const bucket = trend.get(period) ?? {
      period,
      consumptionGrams: 0,
      consumptionCost: 0,
      roastedGrams: 0,
      roastingCost: 0,
    };
    if (note.source === 'roasting') {
      const record = note.changeRecord?.roastingRecord;
      const amount = record?.roastedAmount ?? 0;
      if (amount <= 0) continue;
      const bean = green.find(b => b.id === record?.greenBeanId) ?? null;
      const amountCost = calculateNoteCost(amount, bean);
      roastedGrams += amount;
      roastingCost += amountCost;
      validRoasts++;
      bucket.roastedGrams += amount;
      bucket.roastingCost += amountCost;
      const type =
        bean?.beanType && bean.beanType in byType ? bean.beanType : 'unknown';
      byType[type].roastedGrams += amount;
      byType[type].roastingCost += amountCost;
    } else {
      const amount = parseNoteConsumption(note);
      if (amount <= 0) continue;
      const bean = findBeanForNote(note, roasted);
      const amountCost = calculateNoteCost(amount, bean);
      consumption += amount;
      cost += amountCost;
      validNotes++;
      if (hasBeanPrice(bean)) pricedGrams += amount;
      bucket.consumptionGrams += amount;
      bucket.consumptionCost += amountCost;
      const type =
        bean?.beanType && bean.beanType in byType ? bean.beanType : 'unknown';
      byType[type].consumptionGrams += amount;
      byType[type].cost += amountCost;
    }
    trend.set(period, bucket);
  }
  const consumptionFallback = allTime && validNotes === 0;
  const roastingFallback = allTime && validRoasts === 0;
  for (const [list, fallback, isGreen] of [
    [roasted, consumptionFallback, false],
    [green, roastingFallback, true],
  ] as const) {
    if (!fallback) continue;
    for (const bean of list) {
      const amount = Math.max(
        0,
        parseNum(bean.capacity) - parseNum(bean.remaining)
      );
      const amountCost = calculateNoteCost(amount, bean);
      const type =
        bean.beanType && bean.beanType in byType ? bean.beanType : 'unknown';
      if (isGreen) {
        roastedGrams += amount;
        roastingCost += amountCost;
        byType[type].roastedGrams += amount;
        byType[type].roastingCost += amountCost;
      } else {
        consumption += amount;
        cost += amountCost;
        if (hasBeanPrice(bean)) pricedGrams += amount;
        byType[type].consumptionGrams += amount;
        byType[type].cost += amountCost;
      }
    }
  }
  return {
    consumption: {
      grams: consumption,
      cost,
      pricedGrams,
      validRecords: validNotes,
      fallbackFromInventory: consumptionFallback,
    },
    roasting: {
      grams: roastedGrams,
      cost: roastingCost,
      validRecords: validRoasts,
      fallbackFromInventory: roastingFallback,
    },
    byType,
    trend: [...trend.values()].sort((a, b) => a.period.localeCompare(b.period)),
    metadata: {
      range: 'start inclusive, end exclusive',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      costBasis:
        'current bean price/capacity; unknown prices contribute zero cost',
      quickConsumptionIncluded: true,
      capacityAdjustmentsExcluded: true,
      trendContainsObservedPeriodsOnly: true,
    },
  };
}
