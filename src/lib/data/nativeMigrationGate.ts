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

export async function requestNativeMigrationApproval(
  source: LegacyMigrationSource,
  plan: LegacySqliteMigrationPlan,
  digest: string
): Promise<void> {
  // A restart may resume the exact migration whose backup and consent were
  // already saved. A changed source must go through backup and consent again.
  if ((await readCleanupApproval()) === digest) return;
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
    // Native savers resolve only after a confirmed file write, never a share.
    if (
      !['android-document', 'ios-document', 'tauri-document'].includes(
        result.mode
      )
    ) {
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
    // Durable consent lets startup finish cleanup if the app closes after
    // the verified SQLite commit but before IndexedDB deletion.
    await writeCleanupApproval(approval.digest);
    approval.resolve();
    pending = null;
  } catch (error) {
    nativeMigrationGate.setState({ phase: 'ready', error: describe(error) });
  }
}

export async function cleanupApprovedLegacyDatabase(
  driver: SqliteDriver,
  verifyBeforeCleanup: (digest: string) => Promise<void>
): Promise<void> {
  const value = await readCleanupApproval();
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
  await verifyBeforeCleanup(value);
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('BrewGuideDB');
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error('旧数据库清理失败'));
    request.onblocked = () =>
      reject(new Error('旧数据库仍被占用，请关闭应用后重试升级。'));
  });
  // Some WebKit filesystem failures can still report deletion success. Probe
  // a fresh connection; abort creation so verification never leaves a new DB.
  await new Promise<void>((resolve, reject) => {
    let absent = false;
    const request = indexedDB.open('BrewGuideDB');
    request.onupgradeneeded = () => {
      absent = true;
      request.transaction!.abort();
    };
    request.onerror = () =>
      absent
        ? resolve()
        : reject(request.error ?? new Error('无法确认旧数据库已清理'));
    request.onsuccess = () => {
      request.result.close();
      reject(new Error('旧数据库尚未清理，已保留授权，请重启后重试。'));
    };
    request.onblocked = () =>
      reject(new Error('旧数据库清理验证被占用，请重启后重试。'));
  });
  await writeCleanupApproval(null);
}

async function readCleanupApproval(): Promise<string | null> {
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string | null>('migration_cleanup_approval', {
      operation: 'get',
    });
  }
  const { Preferences } = await import('@capacitor/preferences');
  return (await Preferences.get({ key: CLEANUP_APPROVAL_KEY })).value;
}

async function writeCleanupApproval(value: string | null): Promise<void> {
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('migration_cleanup_approval', {
      operation: value === null ? 'remove' : 'set',
      value,
    });
    return;
  }
  const { Preferences } = await import('@capacitor/preferences');
  if (value === null) await Preferences.remove({ key: CLEANUP_APPROVAL_KEY });
  else await Preferences.set({ key: CLEANUP_APPROVAL_KEY, value });
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
