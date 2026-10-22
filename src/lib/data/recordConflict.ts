import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import { stripCoffeeBeanImages } from '@/lib/coffee-beans/imageRecords';
import { stripBrewingNoteImages } from '@/lib/notes/imageRecords';
import { normalizeCoffeeBean } from '@/lib/utils/coffeeBeanUtils';
import { normalizeBrewingNote } from '@/lib/notes/cleanup';

export class RecordConflictError extends Error {
  constructor() {
    super('记录已被其他操作更新，请重新打开后再保存。');
    this.name = 'RecordConflictError';
  }
}

function stableSnapshot(value: unknown): string {
  if (value === null || typeof value !== 'object')
    return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableSnapshot).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter(key => record[key] !== undefined)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableSnapshot(record[key])}`)
    .join(',')}}`;
}

/** Compare the same normalized subject data that stores expose, excluding images. */
export function coffeeBeanSnapshot(
  bean: CoffeeBean | undefined
): string | undefined {
  return bean
    ? stableSnapshot(
        normalizeCoffeeBean(stripCoffeeBeanImages(bean), {
          ensureFlavorArray: true,
        })
      )
    : undefined;
}

export function brewingNoteSnapshot(
  note: BrewingNote | undefined
): string | undefined {
  return note
    ? stableSnapshot(normalizeBrewingNote(stripBrewingNoteImages(note)).note)
    : undefined;
}

/** Must be called inside the actual backend write transaction. */
export function assertRecordUnchanged(
  current: string | undefined,
  expected: string | undefined
): void {
  if (expected !== undefined && current !== expected)
    throw new RecordConflictError();
}
