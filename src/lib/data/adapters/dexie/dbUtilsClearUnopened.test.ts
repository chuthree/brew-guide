import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('dbUtils.clearAllData before the database is opened', () => {
  let openedDatabases: Array<{ close: () => void }> = [];

  afterEach(async () => {
    openedDatabases.forEach(database => database.close());
    openedDatabases = [];

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('BrewGuideDB');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Database deletion blocked'));
    });
  });

  it('implicitly opens the current BrewGuideDB schema before clearing', async () => {
    vi.resetModules();
    const { BrewGuideDB, db, dbUtils } = await import('@/lib/core/db');
    const writer = new BrewGuideDB();
    openedDatabases = [db, writer];

    expect(db.isOpen()).toBe(false);
    expect(writer.isOpen()).toBe(false);

    await writer.open();
    await writer.coffeeBeans.put({
      id: 'bean-1',
      timestamp: 1,
      name: 'bean',
    });
    await writer.settings.put({ key: 'legacy-setting', value: 'value' });

    expect(db.isOpen()).toBe(false);
    expect(await writer.coffeeBeans.count()).toBe(1);

    await dbUtils.clearAllData();

    expect(db.isOpen()).toBe(true);
    expect(await writer.coffeeBeans.count()).toBe(0);
    expect(await writer.settings.count()).toBe(0);
    expect(await writer.pendingOperations.count()).toBe(0);
  });

  it('creates the current BrewGuideDB if clear runs while no database exists', async () => {
    vi.resetModules();
    const { db, dbUtils } = await import('@/lib/core/db');
    openedDatabases = [db];

    expect(await Dexie.exists('BrewGuideDB')).toBe(false);
    expect(db.isOpen()).toBe(false);

    await dbUtils.clearAllData();

    expect(await Dexie.exists('BrewGuideDB')).toBe(true);
    expect(db.isOpen()).toBe(true);
    expect(db.verno).toBe(11);
    expect(db.tables.map(table => table.name).sort()).toEqual(
      [
        'appSettings',
        'brewingNoteImageThumbnails',
        'brewingNoteImages',
        'brewingNotes',
        'coffeeBeanImageThumbnails',
        'coffeeBeanImages',
        'coffeeBeans',
        'customEquipments',
        'customMethods',
        'grinders',
        'pendingOperations',
        'settings',
      ].sort()
    );
  });
});
