import type { SqliteDriver } from '@/lib/data/sqlite/driver';
import type { NativeImageFileStore } from '@/lib/data/images/nativeImageFileStore';
import type { MutationChange } from '@/lib/mcp/storage';
import type { RealtimeSyncTable } from '@/lib/supabase/realtime/types';
import { createSqliteImageDataServices } from '@/lib/data/sqlite/imageDataServices';
import { createSqliteOfflineQueueRepository } from '@/lib/data/sqlite/repositories/offlineQueue';
import { getCoffeeBean } from '@/lib/data/sqlite/repositories/coffeeBean';
import { getBrewingNote } from '@/lib/data/sqlite/repositories/brewingNote';
import { createSqliteCustomEquipmentRepository } from '@/lib/data/sqlite/repositories/customEquipment';
import { createSqliteCustomMethodRepository } from '@/lib/data/sqlite/repositories/customMethod';

/**
 * Convert the native durable outbox to the application's real sync queue, with
 * current image payloads, inside the same database transaction as acknowledgment.
 * Never acknowledge an event-dispatch promise: event listeners aren't awaitable.
 */
export async function materializeProviderPublication(
  driver: SqliteDriver,
  fileStore: NativeImageFileStore,
  publicationId: string,
  markSettingsDirty: () => void
): Promise<MutationChange[]> {
  return driver.transaction(async tx => {
    const rows = await tx.query(
      'SELECT changes_json FROM provider_publications WHERE id = ?',
      [publicationId]
    );
    if (!rows.length) return [];
    const changes = JSON.parse(
      String(rows[0].changes_json)
    ) as MutationChange[];
    const scoped: SqliteDriver = {
      ...tx,
      transaction: work => work(tx),
      close: async () => undefined,
    };
    const queue = createSqliteOfflineQueueRepository(scoped);
    const images = createSqliteImageDataServices(scoped, fileStore);
    for (const change of changes) {
      let table: RealtimeSyncTable;
      let data: unknown;
      if (change.entity === 'bean') {
        table = 'coffee_beans';
        const current = await getCoffeeBean(tx, change.id);
        data = current
          ? await images.coffeeBeanImageRepository.mergeBean(current)
          : undefined;
      } else if (change.entity === 'brew_note') {
        table = 'brewing_notes';
        const current = await getBrewingNote(tx, change.id);
        data = current
          ? await images.brewingNoteImageRepository.mergeNote(current)
          : undefined;
      } else if (change.entity === 'equipment') {
        table = 'custom_equipments';
        data = await createSqliteCustomEquipmentRepository(scoped).get(
          change.id
        );
      } else if (change.entity === 'method') {
        table = 'custom_methods';
        data = await createSqliteCustomMethodRepository(scoped).get(change.id);
      } else {
        // Settings and grinders use the existing settings dirty/upload mechanism.
        // Set the durable marker before acknowledging; a false positive is safe.
        if (change.entity === 'settings' || change.entity === 'grinder')
          markSettingsDirty();
        continue;
      }
      const existing = await queue.findByTarget(table, change.id);
      const type = data === undefined ? 'delete' : 'upsert';
      const timestamp = Date.now();
      if (existing.length) {
        await queue.update(existing[0].id, {
          type,
          data,
          timestamp,
          retryCount: 0,
          lastError: undefined,
          failedAt: undefined,
        });
      } else {
        await queue.add({
          id: `provider:${publicationId}:${change.entity}:${change.id}`,
          table,
          recordId: change.id,
          type,
          data,
          timestamp,
          retryCount: 0,
        });
      }
    }
    await tx.execute('DELETE FROM provider_publications WHERE id = ?', [
      publicationId,
    ]);
    return changes;
  });
}
