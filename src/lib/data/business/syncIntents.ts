import { nanoid } from 'nanoid';
import type { BrewGuideDB } from '@/lib/core/db';
import type { BusinessChange } from './types';

/** Persist existing realtime queue intents in the same transaction as the command. */
export async function queueBusinessSyncIntents(
  database: BrewGuideDB,
  changes: BusinessChange[]
): Promise<void> {
  const settings = (await database.appSettings.get('main'))?.data;
  if (
    !settings?.supabaseSync?.enabled ||
    (settings.activeSyncType && settings.activeSyncType !== 'supabase')
  )
    return;
  const tables = {
    bean: 'coffee_beans',
    brew_note: 'brewing_notes',
    equipment: 'custom_equipments',
    method: 'custom_methods',
  } as const;
  for (const change of changes) {
    if (!(change.entity in tables)) continue;
    const table = tables[change.entity as keyof typeof tables];
    const existing = await database.pendingOperations
      .where({ table, recordId: change.id })
      .and(current => current.type === 'upsert' || current.type === 'delete')
      .toArray();
    const recordClock = (value: unknown) => {
      if (!value || typeof value !== 'object') return 0;
      const row = value as { timestamp?: unknown; updatedAt?: unknown };
      return Math.max(
        0,
        ...[row.timestamp, row.updatedAt].filter(
          (clock): clock is number =>
            typeof clock === 'number' && Number.isFinite(clock)
        )
      );
    };
    const timestamp = Math.max(
      Date.now(),
      recordClock(change.before) + 1,
      recordClock(change.after),
      ...existing.map(operation => operation.timestamp).filter(Number.isFinite)
    );
    await database.pendingOperations.bulkDelete(
      existing.map(operation => operation.id)
    );
    await database.pendingOperations.add({
      id: nanoid(),
      table,
      recordId: change.id,
      type: change.after === null ? 'delete' : 'upsert',
      timestamp,
      retryCount: 0,
    });
  }
}
