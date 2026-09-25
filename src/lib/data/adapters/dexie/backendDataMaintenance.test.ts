import 'fake-indexeddb/auto';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { CoffeeBean } from '@/types/app';
import type { AppSettings } from '@/lib/data/models';
import type { BrewingNote, CustomEquipment, Method } from '@/lib/core/config';
import type { PendingOperation } from '@/lib/supabase/realtime/types';
import { db } from '@/lib/core/db';
import { StorageUtils } from '@/lib/core/storageUtils';
import {
  configureRepositories,
  type DataRepositories,
} from '@/lib/data/repositories';
import { dexieBackendDataMaintenance } from './backendDataMaintenance';

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  preferencesClear: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mocks.isNativePlatform },
}));
vi.mock('@capacitor/preferences', () => ({
  Preferences: { clear: mocks.preferencesClear },
}));

const note: BrewingNote = {
  id: 'note-1',
  timestamp: 1,
  rating: 4,
  taste: {},
  notes: 'note',
};
const bean = { id: 'bean-1', timestamp: 1, name: 'bean' } as CoffeeBean;
const equipment = {
  id: 'equipment-1',
  name: 'equipment',
  animationType: 'v60',
  isCustom: true,
} as CustomEquipment;
const pendingOperation: PendingOperation = {
  id: 'pending-1',
  table: 'coffee_beans',
  type: 'upsert',
  recordId: bean.id,
  data: bean,
  timestamp: 1,
  retryCount: 0,
};

const seedDatabase = async (): Promise<void> => {
  await db.brewingNotes.put(note);
  await db.brewingNoteImages.put({
    noteId: note.id,
    image: 'data:image/jpeg;base64,note',
    images: ['data:image/jpeg;base64,note'],
    updatedAt: 1,
  });
  await db.brewingNoteImageThumbnails.put({
    noteId: note.id,
    imageThumbnail: 'data:image/jpeg;base64,note-thumb',
    updatedAt: 1,
  });
  await db.coffeeBeans.put(bean);
  await db.coffeeBeanImages.put({
    beanId: bean.id,
    image: 'data:image/jpeg;base64,bean',
    backImage: 'data:image/jpeg;base64,bean-back',
    updatedAt: 1,
  });
  await db.coffeeBeanImageThumbnails.put({
    beanId: bean.id,
    imageThumbnail: 'data:image/jpeg;base64,bean-thumb',
    updatedAt: 1,
  });
  await db.customEquipments.put(equipment);
  await db.customMethods.put({
    equipmentId: equipment.id,
    methods: [] as Method[],
  });
  await db.grinders.put({ id: 'grinder-1', name: 'grinder' });
  await db.appSettings.put({
    id: 'app-settings',
    data: {} as AppSettings,
  });
  await db.settings.put({ key: 'legacy-setting', value: 'legacy' });
  await db.pendingOperations.put({ ...pendingOperation });
};

const countDatabaseRows = async () =>
  Promise.all([
    db.brewingNotes.count(),
    db.brewingNoteImages.count(),
    db.brewingNoteImageThumbnails.count(),
    db.coffeeBeans.count(),
    db.coffeeBeanImages.count(),
    db.coffeeBeanImageThumbnails.count(),
    db.customEquipments.count(),
    db.customMethods.count(),
    db.grinders.count(),
    db.appSettings.count(),
    db.settings.count(),
    db.pendingOperations.count(),
  ]);

describe('Dexie backend data maintenance', () => {
  beforeAll(() => {
    configureRepositories({
      backendDataMaintenance: dexieBackendDataMaintenance,
    } as unknown as DataRepositories);
  });

  beforeEach(async () => {
    if (db.isOpen()) db.close();
    await db.delete();
    await db.open();
    await seedDatabase();
    mocks.isNativePlatform.mockReturnValue(false);
    mocks.preferencesClear.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (db.isOpen()) db.close();
    await db.delete();
  });

  it('clears the same database tables through StorageUtils and retains the pending queue', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await StorageUtils.clearAllData();

    expect(db.isOpen()).toBe(true);
    expect(await countDatabaseRows()).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
    ]);
    expect(await db.pendingOperations.get(pendingOperation.id)).toEqual(
      pendingOperation
    );
    expect(warn).toHaveBeenCalledWith('数据库已清空');
    expect(mocks.preferencesClear).not.toHaveBeenCalled();
  });

  it('preserves the old failure when the Dexie database was explicitly closed', async () => {
    db.close();
    expect(db.isOpen()).toBe(false);
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(StorageUtils.clearAllData()).rejects.toMatchObject({
      name: 'DatabaseClosedError',
    });

    await db.open();
    expect(await countDatabaseRows()).toEqual([
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    ]);
    expect(logError).toHaveBeenCalledOnce();
    expect(mocks.preferencesClear).not.toHaveBeenCalled();
  });

  it('stops at a mid-sequence failure without rolling back earlier clears', async () => {
    const error = new Error('injected coffeeBeanImages clear failure');
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failingClear = vi
      .spyOn(db.coffeeBeanImages, 'clear')
      .mockImplementation(() => {
        throw error;
      });
    const laterClears = [
      vi.spyOn(db.coffeeBeanImageThumbnails, 'clear'),
      vi.spyOn(db.customEquipments, 'clear'),
      vi.spyOn(db.customMethods, 'clear'),
      vi.spyOn(db.grinders, 'clear'),
      vi.spyOn(db.appSettings, 'clear'),
      vi.spyOn(db.settings, 'clear'),
    ];
    mocks.isNativePlatform.mockReturnValue(true);

    await expect(StorageUtils.clearAllData()).rejects.toBe(error);

    const counts = await countDatabaseRows();
    expect(counts).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(failingClear).toHaveBeenCalledOnce();
    laterClears.forEach(clear => expect(clear).not.toHaveBeenCalled());
    expect(await db.pendingOperations.get(pendingOperation.id)).toEqual(
      pendingOperation
    );
    expect(logError).toHaveBeenCalledWith('清空数据库失败:', error);
    expect(mocks.preferencesClear).not.toHaveBeenCalled();
  });
});
