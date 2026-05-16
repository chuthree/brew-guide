import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import { useBrewingNoteStore } from '@/lib/stores/brewingNoteStore';

const AMOUNT_REGEX = /\d+(?:\.\d+)?/;
const NEGATIVE_AMOUNT_REGEX = /-\s*\d/;
const MIN_CAPACITY_CHANGE = 0.01;

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

export const isOptionalCoffeeBeanAmount = (value: unknown): boolean => {
  if (typeof value === 'string' && !value.trim()) {
    return true;
  }

  if (value === undefined || value === null) {
    return true;
  }

  return parseCoffeeBeanAmount(value) !== null;
};

export async function createCapacityAdjustmentRecord(
  bean: CoffeeBean,
  originalAmount: number,
  newAmount: number
): Promise<BrewingNote> {
  const changeAmount = newAmount - originalAmount;
  const timestamp = Date.now();
  const changeType =
    changeAmount > 0 ? 'increase' : changeAmount < 0 ? 'decrease' : 'set';

  const noteContent = '容量调整(不计入统计)';
  const adjustmentRecord: Omit<BrewingNote, 'id'> = {
    timestamp,
    source: 'capacity-adjustment',
    beanId: bean.id,
    equipment: '',
    method: '',
    coffeeBeanInfo: {
      name: bean.name || '',
      roastLevel: bean.roastLevel || '中度烘焙',
      roastDate: bean.roastDate,
      roaster: bean.roaster,
    },
    notes: noteContent,
    rating: 0,
    taste: { acidity: 0, sweetness: 0, bitterness: 0, body: 0 },
    params: {
      coffee: `${Math.abs(changeAmount)}g`,
      water: '',
      ratio: '',
      grindSize: '',
      temp: '',
    },
    totalTime: 0,
    changeRecord: {
      capacityAdjustment: {
        originalAmount,
        newAmount,
        changeAmount,
        changeType,
      },
    },
  };

  return useBrewingNoteStore.getState().addNote(adjustmentRecord);
}

export async function createCapacityAdjustmentRecordIfNeeded(
  bean: CoffeeBean,
  previousRemaining: unknown,
  nextRemaining: unknown
): Promise<BrewingNote | null> {
  const originalAmount = parseCoffeeBeanAmount(previousRemaining);
  const newAmount = parseCoffeeBeanAmount(nextRemaining);

  if (originalAmount === null || newAmount === null) {
    return null;
  }

  const changeAmount = newAmount - originalAmount;
  if (Math.abs(changeAmount) < MIN_CAPACITY_CHANGE) {
    return null;
  }

  return createCapacityAdjustmentRecord(bean, originalAmount, newAmount);
}
