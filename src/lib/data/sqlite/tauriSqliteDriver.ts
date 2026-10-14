import { createSqliteDriverCore } from './driverCore';
import type { SqliteDriver, SqlValue } from './driver';

let current: Promise<SqliteDriver> | null = null;

/** One native connection, shared by all repositories and transactions. */
export function openTauriSqliteDriver(): Promise<SqliteDriver> {
  if (typeof window === 'undefined' || !('__TAURI__' in window)) {
    return Promise.reject(new Error('Desktop SQLite requires Tauri'));
  }
  if (current) return current;
  const opening = (async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const command = (
      operation: string,
      sql?: string,
      params: readonly SqlValue[] = []
    ) => invoke('storage_sqlite', { request: { operation, sql, params } });
    await command('open');
    return createSqliteDriverCore(
      {
        execute: sql => command('execute', sql),
        run: (sql, params) => command('execute', sql, params),
        query: (sql, params) => command('query', sql, params),
        beginTransaction: () => command('begin'),
        commitTransaction: () => command('commit'),
        rollbackTransaction: () => command('rollback'),
        isTransactionActive: () => command('active') as Promise<boolean>,
      },
      async () => {
        await command('close');
        if (current === opening) current = null;
      }
    );
  })();
  current = opening;
  void opening.catch(() => {
    if (current === opening) current = null;
  });
  return opening;
}
