import type { BrewingNote } from '@/lib/core/config';
import type { CoffeeBean } from '@/types/app';
import {
  formatInventoryAmount,
  parseCoffeeBeanAmount,
} from '@/lib/coffee-beans/amount';
import { RecordConflictError } from '@/lib/data/recordConflict';
import { nanoid } from 'nanoid';
import type { AppSettings } from '@/lib/data/models';
import type { PendingOperation } from '@/lib/supabase/realtime/types';

export interface BrewingNoteSaveOptions {
  expectedUpdatedAt?: number;
  newBean?: CoffeeBean;
  initializeBeanId?: string;
}

export interface BrewingNoteInventoryChanges {
  note?: BrewingNote;
  beans: CoffeeBean[];
  created: boolean;
  unchanged?: boolean;
  deletedAt?: number;
}

/** The outbox is committed together with the note, images and stock. */
export function inventorySyncOperations(
  changes: BrewingNoteInventoryChanges,
  noteId: string,
  settings: AppSettings | undefined
): PendingOperation[] {
  if (
    changes.unchanged ||
    !settings?.supabaseSync?.enabled ||
    (settings.activeSyncType && settings.activeSyncType !== 'supabase')
  )
    return [];
  const timestamp = Date.now();
  return [
    ...changes.beans.map(bean => ({
      table: 'coffee_beans' as const,
      recordId: bean.id,
      type: 'upsert' as const,
    })),
    {
      table: 'brewing_notes' as const,
      recordId: noteId,
      type: changes.note ? ('upsert' as const) : ('delete' as const),
    },
  ].map(operation => ({
    ...operation,
    id: nanoid(),
    timestamp: changes.note
      ? timestamp
      : Math.max(timestamp, changes.deletedAt ?? 0),
    retryCount: 0,
  }));
}

function stockEffect(note: BrewingNote | undefined): number {
  if (!note?.beanId) return 0;
  if (note.source === 'roasting') {
    throw new Error('请使用烘焙流程修改烘焙记录');
  }
  if (note.source === 'capacity-adjustment') {
    const change = note.changeRecord?.capacityAdjustment?.changeAmount;
    if (typeof change !== 'number' || !Number.isFinite(change)) {
      throw new Error('容量调整记录无效，请重新打开后再保存');
    }
    return change;
  }
  return -(
    parseCoffeeBeanAmount(
      note.source === 'quick-decrement'
        ? (note.quickDecrementAmount ?? note.params?.coffee)
        : note.params?.coffee
    ) ?? 0
  );
}

/** Read and compute inside the backend transaction; publish only after commit. */
export async function prepareBrewingNoteInventory(
  next: BrewingNote | undefined,
  previous: BrewingNote | undefined,
  getBean: (id: string) => Promise<CoffeeBean | undefined>,
  options: BrewingNoteSaveOptions = {}
): Promise<BrewingNoteInventoryChanges> {
  if (next && previous && options.expectedUpdatedAt === undefined) {
    // A create retry keeps its original ID and must never apply stock twice.
    return { note: previous, beans: [], created: false, unchanged: true };
  }
  if (
    options.expectedUpdatedAt !== undefined &&
    (!previous ||
      (previous.updatedAt ?? previous.timestamp) !== options.expectedUpdatedAt)
  ) {
    throw new RecordConflictError();
  }

  const now = Date.now();
  let note = next
    ? {
        ...next,
        updatedAt: Math.max(
          now,
          (previous?.updatedAt ?? previous?.timestamp ?? 0) + 1
        ),
      }
    : undefined;
  const beans = new Map<string, CoffeeBean>();
  for (const id of new Set([previous?.beanId, note?.beanId])) {
    if (!id) continue;
    let bean = await getBean(id);
    if (!bean && options.newBean?.id === id) bean = options.newBean;
    if (bean) beans.set(id, bean);
  }

  const changedBeans = new Map<string, CoffeeBean>();
  if (note?.beanId && !previous && options.initializeBeanId === note.beanId) {
    const bean = beans.get(note.beanId);
    if (!bean) throw new Error('咖啡豆不存在，请重新选择');
    const amount = -stockEffect(note);
    const initialized = {
      ...bean,
      capacity: amount > 0 ? `${formatInventoryAmount(amount)}g` : '',
      remaining: formatInventoryAmount(amount),
    };
    beans.set(bean.id, initialized);
    changedBeans.set(bean.id, initialized);
  }
  if (note?.beanId && options.newBean?.id === note.beanId) {
    changedBeans.set(note.beanId, beans.get(note.beanId)!);
  }

  if (note?.source === 'quick-decrement') {
    const bean = note.beanId ? beans.get(note.beanId) : undefined;
    if (!bean) throw new Error('咖啡豆不存在，请重新选择');
    const available =
      (parseCoffeeBeanAmount(bean.remaining) ?? 0) -
      (previous?.beanId === bean.id ? stockEffect(previous) : 0);
    const amount = Math.min(-stockEffect(note), available);
    if (amount <= 0) throw new Error('当前咖啡豆剩余量不足，无法扣除');
    note = {
      ...note,
      quickDecrementAmount: amount,
      params: { ...note.params, coffee: `${formatInventoryAmount(amount)}g` },
    };
  }

  const deltas = new Map<string, number>();
  if (previous?.beanId) deltas.set(previous.beanId, -stockEffect(previous));
  if (note?.beanId) {
    deltas.set(note.beanId, (deltas.get(note.beanId) ?? 0) + stockEffect(note));
  }
  for (const [id, delta] of deltas) {
    if (Math.abs(delta) < 0.000001) continue;
    const bean = beans.get(id);
    if (!bean) {
      if (id === note?.beanId) throw new Error('咖啡豆不存在，请重新选择');
      continue;
    }
    const remaining = parseCoffeeBeanAmount(bean.remaining);
    if (remaining === null && bean.remaining?.trim()) {
      throw new Error('咖啡豆剩余量无效，请先修正库存');
    }
    let amount = Math.max(0, (remaining ?? 0) + delta);
    const capacity = parseCoffeeBeanAmount(bean.capacity);
    if (delta > 0 && capacity !== null && capacity > 0) {
      amount = Math.min(amount, capacity);
    }
    changedBeans.set(id, {
      ...bean,
      remaining: formatInventoryAmount(amount),
      timestamp: Math.max(now, bean.timestamp + 1),
    });
  }
  return {
    note,
    beans: [...changedBeans.values()],
    created: !previous,
    ...(!note &&
      previous && {
        deletedAt: Math.max(
          now,
          (previous.updatedAt ?? previous.timestamp) + 1
        ),
      }),
  };
}
