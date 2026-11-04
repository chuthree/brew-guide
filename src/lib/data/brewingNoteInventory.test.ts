import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/core/db';
import type { BrewingNote } from '@/lib/core/config';
import type { CoffeeBean } from '@/types/app';
import type { AppSettings } from './models';
import type { DataRepositories } from './repositories';
import type { NativeImageFileStore } from './images/nativeImageFileStore';
import {
  brewingNotePersistence,
  brewingNoteImageRepository,
} from './adapters/dexie/brewingNoteImageRepository';
import { coffeeBeanRepository } from './adapters/dexie/coffeeBeanRepository';
import { brewingNoteRepository } from './adapters/dexie/brewingNoteRepository';
import { appSettingsRepository } from './adapters/dexie/settingsRepository';
import { offlineQueueRepository } from './adapters/dexie/offlineQueueRepository';
import { createSqliteRuntimeRepositories } from './sqlite/runtimeRepositories';
import { createNodeSqliteTestDatabase } from './sqlite/repositories/testing/nodeSqliteTestDriver';
import type { SqliteDriver } from './sqlite/driver';

type InventoryRepositories = Pick<
  DataRepositories,
  | 'brewingNotePersistence'
  | 'brewingNoteImageRepository'
  | 'coffeeBeanRepository'
  | 'brewingNoteRepository'
  | 'appSettingsRepository'
  | 'offlineQueueRepository'
>;

const bean = (id = 'bean'): CoffeeBean => ({
  id,
  name: id,
  timestamp: 1,
  capacity: '100',
  remaining: '100',
});
const note = (id = 'note', amount = 15): BrewingNote => ({
  id,
  timestamp: 10,
  beanId: 'bean',
  params: { coffee: `${amount}g` },
  notes: '',
  rating: 0,
  taste: {},
});
const settings = {
  activeSyncType: 'supabase',
  supabaseSync: {
    enabled: true,
    url: 'https://example.supabase.co',
    anonKey: 'test',
  },
} as AppSettings;

describe.each(['dexie', 'sqlite'] as const)(
  'note inventory transactions (%s)',
  backend => {
    let repositories: InventoryRepositories;
    let close: () => Promise<void>;
    let failOutbox: boolean;

    beforeEach(async () => {
      failOutbox = false;
      if (backend === 'dexie') {
        await db.open();
        await Promise.all(db.tables.map(table => table.clear()));
        repositories = {
          brewingNotePersistence,
          brewingNoteImageRepository,
          coffeeBeanRepository,
          brewingNoteRepository,
          appSettingsRepository,
          offlineQueueRepository,
        };
        const failCreating = () => {
          if (failOutbox) throw new Error('Injected outbox failure');
        };
        db.pendingOperations.hook('creating', failCreating);
        close = async () => {
          db.pendingOperations.hook('creating').unsubscribe(failCreating);
          await db.delete();
        };
      } else {
        const database = await createNodeSqliteTestDatabase();
        const driver: SqliteDriver = {
          execute: (...args) => database.driver.execute(...args),
          query: (...args) => database.driver.query(...args),
          close: () => database.driver.close(),
          transaction: work =>
            database.driver.transaction(tx =>
              work({
                query: (...args) => tx.query(...args),
                execute: (sql, params) => {
                  if (
                    failOutbox &&
                    sql.includes('INSERT INTO pending_operations')
                  )
                    throw new Error('Injected outbox failure');
                  return tx.execute(sql, params);
                },
              })
            ),
        };
        const objects = new Map<string, Uint8Array>();
        const files: NativeImageFileStore = {
          write: async (key, bytes) => {
            objects.set(key, bytes.slice());
          },
          read: async key => {
            const bytes = objects.get(key);
            if (!bytes) throw new Error('Missing image');
            return bytes.slice();
          },
          delete: async key => {
            objects.delete(key);
          },
          exists: async key => objects.has(key),
          listObjectKeys: async () => [...objects.keys()],
        };
        repositories = createSqliteRuntimeRepositories(driver, files);
        close = database.close;
      }
      await repositories.coffeeBeanRepository.save(bean());
      await repositories.appSettingsRepository.save(settings);
    });

    afterEach(async () => {
      await close();
    });

    it('deducts once for simultaneous retries of the same note ID', async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          repositories.brewingNotePersistence.saveWithInventory(note())
        )
      );
      expect(results.filter(result => !result.unchanged)).toHaveLength(1);
      expect(
        (await repositories.coffeeBeanRepository.get('bean'))?.remaining
      ).toBe('85');
      expect(await repositories.brewingNoteRepository.count()).toBe(1);
      expect(await repositories.offlineQueueRepository.count()).toBe(2);
    });

    it('computes different concurrent notes against the latest stock', async () => {
      await Promise.all([
        repositories.brewingNotePersistence.saveWithInventory(
          note('first', 15)
        ),
        repositories.brewingNotePersistence.saveWithInventory(
          note('second', 20)
        ),
      ]);
      expect(
        (await repositories.coffeeBeanRepository.get('bean'))?.remaining
      ).toBe('65');
      expect(await repositories.brewingNoteRepository.count()).toBe(2);
      expect(await repositories.offlineQueueRepository.count()).toBe(3);
    });

    it('rolls back note, stock, images and outbox, then safely retries', async () => {
      const input = { ...note(), images: ['data:image/png;base64,AQID'] };
      failOutbox = true;
      await expect(
        repositories.brewingNotePersistence.saveWithInventory(input)
      ).rejects.toThrow('Injected outbox failure');
      expect(
        (await repositories.coffeeBeanRepository.get('bean'))?.remaining
      ).toBe('100');
      expect(await repositories.brewingNoteRepository.count()).toBe(0);
      expect(
        await repositories.brewingNoteImageRepository.getImages(input.id)
      ).toEqual([]);
      expect(await repositories.offlineQueueRepository.count()).toBe(0);
      failOutbox = false;
      await repositories.brewingNotePersistence.saveWithInventory(input);
      expect(
        (await repositories.coffeeBeanRepository.get('bean'))?.remaining
      ).toBe('85');
    });

    it('edits only the usage difference and rejects stale edits', async () => {
      const created = (
        await repositories.brewingNotePersistence.saveWithInventory(note())
      ).note!;
      const edited = { ...created, params: { coffee: '20g' } };
      await repositories.brewingNotePersistence.saveWithInventory(edited, {
        expectedUpdatedAt: created.updatedAt,
      });
      await expect(
        repositories.brewingNotePersistence.saveWithInventory(edited, {
          expectedUpdatedAt: created.updatedAt,
        })
      ).rejects.toThrow('记录已被其他操作更新');
      expect(
        (await repositories.coffeeBeanRepository.get('bean'))?.remaining
      ).toBe('80');
    });

    it('moves usage between beans and restores stock only once when deleting', async () => {
      await repositories.coffeeBeanRepository.save(bean('other'));
      const created = (
        await repositories.brewingNotePersistence.saveWithInventory(note())
      ).note!;
      const moved = (
        await repositories.brewingNotePersistence.saveWithInventory(
          { ...created, beanId: 'other' },
          { expectedUpdatedAt: created.updatedAt }
        )
      ).note!;
      expect(
        (await repositories.coffeeBeanRepository.get('bean'))?.remaining
      ).toBe('100');
      expect(
        (await repositories.coffeeBeanRepository.get('other'))?.remaining
      ).toBe('85');
      await repositories.brewingNotePersistence.deleteWithInventory(moved.id, {
        expectedRecord: moved,
      });
      await repositories.brewingNotePersistence.deleteWithInventory(moved.id, {
        expectedRecord: moved,
      });
      expect(
        (await repositories.coffeeBeanRepository.get('other'))?.remaining
      ).toBe('100');
      expect(await repositories.brewingNoteRepository.count()).toBe(0);
    });

    it('records the actual quick decrement and keeps its retry idempotent', async () => {
      await repositories.coffeeBeanRepository.save({
        ...bean(),
        remaining: '8',
      });
      const input: BrewingNote = {
        ...note('quick', 50),
        source: 'quick-decrement',
        quickDecrementAmount: 50,
      };
      const saved = (
        await repositories.brewingNotePersistence.saveWithInventory(input)
      ).note!;
      await repositories.brewingNotePersistence.saveWithInventory(input);
      expect(saved.quickDecrementAmount).toBe(8);
      expect(saved.params?.coffee).toBe('8g');
      expect(
        (await repositories.coffeeBeanRepository.get('bean'))?.remaining
      ).toBe('0');
      await repositories.brewingNotePersistence.deleteWithInventory(saved.id);
      expect(
        (await repositories.coffeeBeanRepository.get('bean'))?.remaining
      ).toBe('8');
    });

    it('creates a pending bean in the same transaction as its first note', async () => {
      const newBean = { ...bean('new'), capacity: '15g', remaining: '15' };
      const input = { ...note(), beanId: newBean.id };
      await repositories.brewingNotePersistence.saveWithInventory(input, {
        newBean,
      });
      await repositories.brewingNotePersistence.saveWithInventory(input, {
        newBean,
      });
      expect(
        (await repositories.coffeeBeanRepository.get('new'))?.remaining
      ).toBe('0');
      expect(await repositories.brewingNoteRepository.count()).toBe(1);
    });
    it('keeps an updated outbox entry when an older upload completes or fails', async () => {
      await repositories.offlineQueueRepository.add({
        id: 'upload',
        table: 'coffee_beans',
        type: 'upsert',
        recordId: 'bean',
        timestamp: 1,
        retryCount: 0,
      });
      await repositories.offlineQueueRepository.update('upload', {
        timestamp: 2,
      });
      await repositories.offlineQueueRepository.delete('upload', 1);
      await repositories.offlineQueueRepository.update(
        'upload',
        { retryCount: 3 },
        1
      );
      expect(
        await repositories.offlineQueueRepository.get('upload')
      ).toMatchObject({ timestamp: 2, retryCount: 0 });
      await repositories.offlineQueueRepository.delete('upload', 2);
      expect(await repositories.offlineQueueRepository.count()).toBe(0);
    });
  }
);
