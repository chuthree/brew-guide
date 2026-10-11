import { createStore } from 'zustand/vanilla';
import type { SqliteDriver } from './sqlite/driver';
import type {
  LegacyMigrationSource,
  LegacySqliteMigrationPlan,
} from './sqlite/legacyMigrationPlan';
import { createLegacyMigrationBackupData } from './legacy/legacyMigrationBackup';

const CLEANUP_APPROVAL_KEY = 'native-sqlite-legacy-cleanup-approval';

type Phase =
  | 'idle'
  | 'backup'
  | 'saving'
  | 'ready'
  | 'migrating'
  | 'cleaning'
  | 'failed';

export const nativeMigrationGate = createStore<{
  phase: Phase;
  error: string | null;
}>(() => ({ phase: 'idle', error: null }));

let pending: {
  source: LegacyMigrationSource;
  plan: LegacySqliteMigrationPlan;
  digest: string;
  resolve: () => void;
} | null = null;

export function requestNativeMigrationApproval(
  source: LegacyMigrationSource,
  plan: LegacySqliteMigrationPlan,
  digest: string
): Promise<void> {
  return new Promise(resolve => {
    pending = { source, plan, digest, resolve };
    nativeMigrationGate.setState({
      phase: 'backup',
      error: null,
    });
  });
}

export async function saveNativeMigrationBackup(): Promise<void> {
  const approval = pending;
  if (
    !approval ||
    !['backup', 'ready'].includes(nativeMigrationGate.getState().phase)
  )
    return;
  nativeMigrationGate.setState({ phase: 'saving', error: null });
  try {
    const [{ DataManager }, { exportDataAsJsonFile }] = await Promise.all([
      import('@/lib/core/dataManager'),
      import('@/lib/utils/dataExportUtils'),
    ]);
    const jsonData = await DataManager.exportAllData({
      snapshot: createLegacyMigrationBackupData(approval.source, approval.plan),
    });
    const result = await exportDataAsJsonFile(jsonData, {
      returnIncompleteResult: true,
    });
    // Sharing a file is not proof of saving it. Only the Android document
    // plugin's successful file write unlocks this destructive upgrade.
    if (result.mode !== 'android-document') {
      nativeMigrationGate.setState({
        phase: 'backup',
        error:
          result.mode === 'cancelled'
            ? '已取消备份，保存备份后才能升级。'
            : '尚未确认备份文件已保存，请重试。',
      });
      return;
    }
    nativeMigrationGate.setState({ phase: 'ready' });
  } catch (error) {
    nativeMigrationGate.setState({ phase: 'backup', error: describe(error) });
  }
}

export async function confirmNativeMigration(): Promise<void> {
  const approval = pending;
  if (!approval || nativeMigrationGate.getState().phase !== 'ready') return;
  nativeMigrationGate.setState({ phase: 'migrating', error: null });
  try {
    const { Preferences } = await import('@capacitor/preferences');
    // Durable consent lets startup finish cleanup if the app closes after
    // the verified SQLite commit but before IndexedDB deletion.
    await Preferences.set({
      key: CLEANUP_APPROVAL_KEY,
      value: approval.digest,
    });
    approval.resolve();
    pending = null;
  } catch (error) {
    nativeMigrationGate.setState({ phase: 'ready', error: describe(error) });
  }
}

export async function cleanupApprovedLegacyDatabase(
  driver: SqliteDriver
): Promise<void> {
  const { Preferences } = await import('@capacitor/preferences');
  const { value } = await Preferences.get({ key: CLEANUP_APPROVAL_KEY });
  if (!value) return;
  const rows = await driver.query(
    'SELECT status, details_json FROM migration_state WHERE id = ?',
    ['legacy-dexie-import-v1']
  );
  const row = rows[0];
  if (
    row?.status !== 'completed' ||
    typeof row.details_json !== 'string' ||
    JSON.parse(row.details_json).planSha256 !== value
  ) {
    throw new Error('升级校验尚未完成，已保留旧数据。');
  }
  nativeMigrationGate.setState({ phase: 'cleaning', error: null });
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('BrewGuideDB');
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error('旧数据库清理失败'));
    request.onblocked = () =>
      reject(new Error('旧数据库仍被占用，请关闭应用后重试升级。'));
  });
  await Preferences.remove({ key: CLEANUP_APPROVAL_KEY });
}

export function finishNativeMigration(error?: unknown): void {
  if (nativeMigrationGate.getState().phase === 'idle') return;
  nativeMigrationGate.setState(
    error
      ? { phase: 'failed', error: describe(error) }
      : { phase: 'idle', error: null }
  );
}

function describe(error: unknown): string {
  return error instanceof Error
    ? error.message
    : '升级失败，请关闭应用后重试。';
}
