import { Capacitor } from '@capacitor/core';
import {
  providerDatabase,
  setAndroidMutationPreparation,
} from '@/lib/data/sqlite/providerSqliteDriver';
import {
  openCapacitorSqliteDriver,
  SQLITE_DATABASE_NAME,
} from '@/lib/data/sqlite/capacitorSqliteDriver';
import { createCapacitorImageFileStore } from '@/lib/data/images/capacitorImageFileStore';
import { materializeProviderPublication } from './publicationQueue';
import { withDataMutation } from '@/lib/data/mutationCoordinator';

let initialized: Promise<void> | undefined;
let refreshTail = Promise.resolve();

export function initializeAndroidProviderBridge(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return Promise.resolve();
  if (initialized) return initialized;
  initialized = (async () => {
    const fileStore = await createCapacitorImageFileStore();
    setAndroidMutationPreparation(async session => {
      const pending = await providerDatabase.command({
        database: SQLITE_DATABASE_NAME,
        operation: 'pendingPublications',
        session,
      });
      if (!pending.publications?.length) return;
      const driver = await openCapacitorSqliteDriver();
      const { publishMcpChanges } = await import('@/lib/mcp/tools');
      for (const row of pending.publications) {
        // Refresh caches before any UI action reads them. The same native owner
        // excludes Provider writes throughout projection, sync enqueue and work.
        await publishMcpChanges(JSON.parse(row.changes_json), driver, 'remote');
        const changes = await materializeProviderPublication(
          driver,
          fileStore,
          row.id,
          () => {
            localStorage.setItem('brew-guide:realtime-sync:settingsDirty', '1');
          }
        );
        if (
          changes.some(
            change =>
              change.entity === 'settings' || change.entity === 'grinder'
          )
        ) {
          window.dispatchEvent(
            new CustomEvent('settingsChanged', { detail: { source: 'local' } })
          );
        }
      }
    });
    const refresh = () => {
      refreshTail = refreshTail
        .catch(() => undefined)
        .then(() =>
          // Acquiring the mutation boundary runs the same preparation hook as a
          // normal foreground action, without exposing a re-entrant bypass.
          withDataMutation(async () => undefined)
        );
      return refreshTail;
    };
    await providerDatabase.addListener('providerDataChanged', () => {
      void refresh().catch(() =>
        console.error('ContentProvider 数据更新待下次恢复')
      );
    });
    const { App } = await import('@capacitor/app');
    await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive)
        void refresh().catch(() =>
          console.error('ContentProvider 数据恢复失败')
        );
    });
    await refresh();
  })();
  void initialized.catch(() => {
    initialized = undefined;
  });
  return initialized;
}
