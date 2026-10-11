import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  LegacyMigrationSource,
  LegacySqliteMigrationPlan,
} from './sqlite/legacyMigrationPlan';
import type { SqliteDriver } from './sqlite/driver';

const mocks = vi.hoisted(() => ({
  exportDataAsJsonFile: vi.fn(),
  exportAllData: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('@/lib/utils/dataExportUtils', () => ({
  exportDataAsJsonFile: mocks.exportDataAsJsonFile,
}));
vi.mock('@/lib/core/dataManager', () => ({
  DataManager: { exportAllData: mocks.exportAllData },
}));
vi.mock('@capacitor/preferences', () => ({ Preferences: mocks }));
vi.mock('./legacy/legacyMigrationBackup', () => ({
  createLegacyMigrationBackupData: () => ({}),
}));

const source = {} as LegacyMigrationSource;
const plan = {
  rows: { coffeeBeans: [], brewingNotes: [] },
} as unknown as LegacySqliteMigrationPlan;

async function createLegacyDatabase() {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('BrewGuideDB', 1);
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}
async function legacyExists() {
  return (await indexedDB.databases()).some(db => db.name === 'BrewGuideDB');
}
function driver(status = 'completed', digest = 'approved-plan') {
  return {
    query: vi.fn(async () => [
      { status, details_json: JSON.stringify({ planSha256: digest }) },
    ]),
  } as unknown as SqliteDriver;
}

describe('Android migration backup and cleanup gate', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    mocks.exportAllData.mockResolvedValue('{"data":{}}');
    mocks.set.mockResolvedValue(undefined);
    mocks.remove.mockResolvedValue(undefined);
  });
  afterEach(async () => {
    await new Promise<void>(resolve => {
      const request = indexedDB.deleteDatabase('BrewGuideDB');
      request.onsuccess = () => resolve();
    });
  });

  it.each(['cancelled', 'native-share', 'activation-required'])(
    'does not unlock migration when backup returns %s',
    async mode => {
      const gate = await import('./nativeMigrationGate');
      const proceeded = vi.fn();
      void gate
        .requestNativeMigrationApproval(source, plan, 'approved-plan')
        .then(proceeded);
      await gate.confirmNativeMigration();
      mocks.exportDataAsJsonFile.mockResolvedValue({ mode });
      await gate.saveNativeMigrationBackup();
      await gate.confirmNativeMigration();
      expect(gate.nativeMigrationGate.getState().phase).toBe('backup');
      expect(proceeded).not.toHaveBeenCalled();
      expect(mocks.set).not.toHaveBeenCalled();
    }
  );

  it('requires saved backup and explicit confirmation, and ignores duplicate clicks', async () => {
    const gate = await import('./nativeMigrationGate');
    const proceeded = vi.fn();
    const waiting = gate
      .requestNativeMigrationApproval(source, plan, 'approved-plan')
      .then(proceeded);
    mocks.exportDataAsJsonFile.mockRejectedValueOnce(new Error('disk full'));
    await gate.saveNativeMigrationBackup();
    expect(gate.nativeMigrationGate.getState()).toMatchObject({
      phase: 'backup',
      error: 'disk full',
    });
    mocks.exportDataAsJsonFile.mockResolvedValue({ mode: 'android-document' });
    await Promise.all([
      gate.saveNativeMigrationBackup(),
      gate.saveNativeMigrationBackup(),
    ]);
    expect(mocks.exportDataAsJsonFile).toHaveBeenCalledTimes(2);
    expect(proceeded).not.toHaveBeenCalled();
    expect(gate.nativeMigrationGate.getState().phase).toBe('ready');
    await Promise.all([
      gate.confirmNativeMigration(),
      gate.confirmNativeMigration(),
    ]);
    await waiting;
    expect(proceeded).toHaveBeenCalledOnce();
    expect(mocks.set).toHaveBeenCalledExactlyOnceWith({
      key: 'native-sqlite-legacy-cleanup-approval',
      value: 'approved-plan',
    });
  });

  it('keeps migration paused if durable consent cannot be saved', async () => {
    const gate = await import('./nativeMigrationGate');
    const proceeded = vi.fn();
    void gate
      .requestNativeMigrationApproval(source, plan, 'approved-plan')
      .then(proceeded);
    mocks.exportDataAsJsonFile.mockResolvedValue({ mode: 'android-document' });
    await gate.saveNativeMigrationBackup();
    mocks.set.mockRejectedValueOnce(new Error('preferences write failed'));
    await gate.confirmNativeMigration();
    expect(proceeded).not.toHaveBeenCalled();
    expect(gate.nativeMigrationGate.getState()).toMatchObject({
      phase: 'ready',
      error: 'preferences write failed',
    });
    await gate.confirmNativeMigration();
    expect(proceeded).toHaveBeenCalledOnce();
  });

  it.each([
    ['failed', 'approved-plan'],
    ['completed', 'different-plan'],
  ])('keeps the source when the target is %s / %s', async (status, digest) => {
    await createLegacyDatabase();
    mocks.get.mockResolvedValue({ value: 'approved-plan' });
    const gate = await import('./nativeMigrationGate');
    await expect(
      gate.cleanupApprovedLegacyDatabase(driver(status, digest))
    ).rejects.toThrow('已保留旧数据');
    expect(await legacyExists()).toBe(true);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it('only deletes the approved database after the matching verified migration, including after restart', async () => {
    await createLegacyDatabase();
    mocks.get.mockResolvedValueOnce({ value: null });
    let gate = await import('./nativeMigrationGate');
    await gate.cleanupApprovedLegacyDatabase(driver());
    expect(await legacyExists()).toBe(true);
    vi.resetModules();
    gate = await import('./nativeMigrationGate');
    mocks.get.mockResolvedValue({ value: 'approved-plan' });
    await gate.cleanupApprovedLegacyDatabase(driver());
    expect(await legacyExists()).toBe(false);
    expect(mocks.remove).toHaveBeenCalledOnce();
  });

  it('retains data and cleanup consent while the legacy database is occupied, then retries safely', async () => {
    await createLegacyDatabase();
    const connection = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('BrewGuideDB');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    mocks.get.mockResolvedValue({ value: 'approved-plan' });
    const gate = await import('./nativeMigrationGate');
    try {
      await expect(
        gate.cleanupApprovedLegacyDatabase(driver())
      ).rejects.toThrow('旧数据库仍被占用');
      expect(await legacyExists()).toBe(true);
      expect(mocks.remove).not.toHaveBeenCalled();
    } finally {
      connection.close();
    }
    await gate.cleanupApprovedLegacyDatabase(driver());
    expect(await legacyExists()).toBe(false);
    expect(mocks.remove).toHaveBeenCalledOnce();
  });
});
