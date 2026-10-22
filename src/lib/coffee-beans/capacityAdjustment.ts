import {
  coordinateStoreActions,
  callStoreActionInMutation,
} from '@/lib/data/storeMutationBoundary';
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

import { parseCoffeeBeanAmount } from './amount';
export { parseCoffeeBeanAmount } from './amount';
const MIN_CAPACITY_CHANGE = 0.01;

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

async function createCapacityAdjustmentRecordInMutation(
  bean: CoffeeBean,
  originalAmount: number,
  newAmount: number
): Promise<BrewingNote> {
  return callStoreActionInMutation(
    useBrewingNoteStore.getState().addNote,
    buildCapacityAdjustmentRecord(bean, originalAmount, newAmount)
  );
}

async function createCapacityAdjustmentRecordIfNeededInMutation(
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

  return createCapacityAdjustmentRecordInMutation(
    bean,
    originalAmount,
    newAmount
  );
}

async function addBeanWithInitialCapacityAdjustmentRecordInMutation(
  beanData: Omit<CoffeeBean, 'id' | 'timestamp'>
): Promise<CoffeeBean> {
  const store = getCoffeeBeanStore();
  const bean = await callStoreActionInMutation(store.addBean, beanData);
  await createCapacityAdjustmentRecordIfNeededInMutation(
    bean,
    bean.capacity,
    bean.remaining
  );
  return bean;
}

async function updateBeanWithCapacityAdjustmentRecordInMutation(
  beanId: string,
  updates: Partial<CoffeeBean>
): Promise<CoffeeBean | null> {
  const store = getCoffeeBeanStore();
  const bean = store.getBeanById(beanId);
  if (!bean) return null;

  const updatedBean = await callStoreActionInMutation(
    store.updateBean,
    beanId,
    updates
  );
  if (!updatedBean) return null;

  if ('remaining' in updates) {
    await createCapacityAdjustmentRecordIfNeededInMutation(
      bean,
      bean.remaining,
      updatedBean.remaining
    );
  }

  return updatedBean;
}

async function applyCapacityAdjustmentDeltaInMutation(
  beanId: string | undefined,
  delta: number
): Promise<CoffeeBean | null> {
  if (!beanId || !Number.isFinite(delta)) return null;
  if (Math.abs(delta) < MIN_CAPACITY_CHANGE) return null;

  return delta > 0
    ? callStoreActionInMutation(increaseBeanRemaining, beanId, delta)
    : callStoreActionInMutation(updateBeanRemaining, beanId, Math.abs(delta));
}

async function revertCapacityAdjustmentRecordInMutation(
  note: Pick<BrewingNote, 'beanId' | 'changeRecord'>
): Promise<CoffeeBean | null> {
  const delta = getCapacityAdjustmentReversal(note);
  return delta !== null
    ? applyCapacityAdjustmentDeltaInMutation(note.beanId, delta)
    : null;
}

export const {
  createCapacityAdjustmentRecord,
  createCapacityAdjustmentRecordIfNeeded,
  addBeanWithInitialCapacityAdjustmentRecord,
  updateBeanWithCapacityAdjustmentRecord,
  applyCapacityAdjustmentDelta,
  revertCapacityAdjustmentRecord,
} = coordinateStoreActions(
  {
    createCapacityAdjustmentRecord: createCapacityAdjustmentRecordInMutation,
    createCapacityAdjustmentRecordIfNeeded:
      createCapacityAdjustmentRecordIfNeededInMutation,
    addBeanWithInitialCapacityAdjustmentRecord:
      addBeanWithInitialCapacityAdjustmentRecordInMutation,
    updateBeanWithCapacityAdjustmentRecord:
      updateBeanWithCapacityAdjustmentRecordInMutation,
    applyCapacityAdjustmentDelta: applyCapacityAdjustmentDeltaInMutation,
    revertCapacityAdjustmentRecord: revertCapacityAdjustmentRecordInMutation,
  },
  [
    'createCapacityAdjustmentRecord',
    'createCapacityAdjustmentRecordIfNeeded',
    'addBeanWithInitialCapacityAdjustmentRecord',
    'updateBeanWithCapacityAdjustmentRecord',
    'applyCapacityAdjustmentDelta',
    'revertCapacityAdjustmentRecord',
  ]
);
