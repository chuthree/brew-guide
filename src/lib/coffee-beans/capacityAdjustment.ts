import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import {
  buildCapacityAdjustmentRecord,
  getCapacityAdjustmentReversal,
} from './inventoryRecords';
import { useBrewingNoteStore } from '@/lib/stores/brewingNoteStore';
import {
  getCoffeeBeanStore,
  increaseBeanRemaining,
  updateBeanRemaining,
} from '@/lib/stores/coffeeBeanStore';

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

export const getCapacityChangeUpdates = (
  previousCapacity: unknown,
  previousRemaining: string | undefined,
  nextCapacity: string,
  syncWhenFull = true
): { capacity: string; remaining: string | undefined } => {
  if (!nextCapacity.trim()) return { capacity: nextCapacity, remaining: '' };
  if (!syncWhenFull) {
    return { capacity: nextCapacity, remaining: previousRemaining };
  }

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

export async function createCapacityAdjustmentRecord(
  bean: CoffeeBean,
  originalAmount: number,
  newAmount: number
): Promise<BrewingNote> {
  return useBrewingNoteStore
    .getState()
    .addNote(buildCapacityAdjustmentRecord(bean, originalAmount, newAmount));
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

export async function addBeanWithInitialCapacityAdjustmentRecord(
  beanData: Omit<CoffeeBean, 'id' | 'timestamp'>
): Promise<CoffeeBean> {
  const store = getCoffeeBeanStore();
  const bean = await store.addBean(beanData);
  await createCapacityAdjustmentRecordIfNeeded(
    bean,
    bean.capacity,
    bean.remaining
  );
  return bean;
}

export async function updateBeanWithCapacityAdjustmentRecord(
  beanId: string,
  updates: Partial<CoffeeBean>
): Promise<CoffeeBean | null> {
  const store = getCoffeeBeanStore();
  const bean = store.getBeanById(beanId);
  if (!bean) return null;

  const updatedBean = await store.updateBean(beanId, updates);
  if (!updatedBean) return null;

  if ('remaining' in updates) {
    await createCapacityAdjustmentRecordIfNeeded(
      bean,
      bean.remaining,
      updatedBean.remaining
    );
  }

  return updatedBean;
}

export async function applyCapacityAdjustmentDelta(
  beanId: string | undefined,
  delta: number
): Promise<CoffeeBean | null> {
  if (!beanId || !Number.isFinite(delta)) return null;
  if (Math.abs(delta) < MIN_CAPACITY_CHANGE) return null;

  return delta > 0
    ? increaseBeanRemaining(beanId, delta)
    : updateBeanRemaining(beanId, Math.abs(delta));
}

export async function revertCapacityAdjustmentRecord(
  note: Pick<BrewingNote, 'beanId' | 'changeRecord'>
): Promise<CoffeeBean | null> {
  const delta = getCapacityAdjustmentReversal(note);
  return delta !== null
    ? applyCapacityAdjustmentDelta(note.beanId, delta)
    : null;
}
