import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';

/** Canonical change-record shape shared by the app and MCP transactions. */
export function buildQuickDecrementRecord(
  bean: CoffeeBean,
  amount: number,
  timestamp = Date.now()
): Omit<BrewingNote, 'id'> & {
  coffeeBeanInfo: NonNullable<BrewingNote['coffeeBeanInfo']>;
} {
  return {
    timestamp,
    source: 'quick-decrement',
    quickDecrementAmount: amount,
    beanId: bean.id,
    equipment: '',
    method: '',
    coffeeBeanInfo: {
      name: bean.name || '',
      roastLevel: bean.roastLevel || '中度烘焙',
      roastDate: bean.roastDate,
      roaster: bean.roaster,
    },
    notes: '',
    rating: 0,
    taste: { acidity: 0, sweetness: 0, bitterness: 0, body: 0 },
    params: {
      coffee: `${amount}g`,
      water: '',
      ratio: '',
      grindSize: '',
      temp: '',
    },
    totalTime: 0,
  };
}

export function buildCapacityAdjustmentRecord(
  bean: CoffeeBean,
  originalAmount: number,
  newAmount: number,
  timestamp = Date.now()
): Omit<BrewingNote, 'id'> & {
  coffeeBeanInfo: NonNullable<BrewingNote['coffeeBeanInfo']>;
} {
  const changeAmount = newAmount - originalAmount;
  const { quickDecrementAmount: _amount, ...record } =
    buildQuickDecrementRecord(bean, Math.abs(changeAmount), timestamp);
  return {
    ...record,
    source: 'capacity-adjustment',
    notes: '容量调整(不计入统计)',
    changeRecord: {
      capacityAdjustment: {
        originalAmount,
        newAmount,
        changeAmount,
        changeType:
          changeAmount > 0 ? 'increase' : changeAmount < 0 ? 'decrease' : 'set',
      },
    },
  };
}

/** Inverse of the persisted stock effect, applied to current stock, never a snapshot. */
export function getCapacityAdjustmentReversal(
  note: Pick<BrewingNote, 'changeRecord'>
): number | null {
  const change = note.changeRecord?.capacityAdjustment?.changeAmount;
  return typeof change === 'number' && Number.isFinite(change) ? -change : null;
}
