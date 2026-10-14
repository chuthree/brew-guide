import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe('Desktop SQLite bridge', () => {
  it('keeps native imports and commands out of browsers', async () => {
    const { openTauriSqliteDriver } = await import('./tauriSqliteDriver');
    await expect(openTauriSqliteDriver()).rejects.toThrow('requires Tauri');
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('shares one connection, sends bound parameters, and rolls back failed work', async () => {
    vi.stubGlobal('window', { __TAURI__: {} });
    const operations: string[] = [];
    mocks.invoke.mockImplementation(async (_command, { request }) => {
      operations.push(request.operation);
      if (request.operation === 'query')
        return { values: [{ id: '保留', count: 3, empty: null }] };
      if (request.operation === 'active') return true;
      return { changes: { changes: 0 } };
    });
    const { openTauriSqliteDriver } = await import('./tauriSqliteDriver');
    const [driver, concurrent] = await Promise.all([
      openTauriSqliteDriver(),
      openTauriSqliteDriver(),
    ]);
    expect(driver).toBe(concurrent);
    await driver.transaction(async tx => {
      await tx.execute('INSERT INTO records VALUES (?)', ['引号 ? ;']);
      await expect(tx.query('SELECT * FROM records')).resolves.toEqual([
        { id: '保留', count: 3, empty: null },
      ]);
    });
    expect(mocks.invoke).toHaveBeenCalledWith('storage_sqlite', {
      request: {
        operation: 'execute',
        sql: 'INSERT INTO records VALUES (?)',
        params: ['引号 ? ;'],
      },
    });
    expect(operations).toEqual(['open', 'begin', 'execute', 'query', 'commit']);
    const error = new Error('transaction failed');
    await expect(
      driver.transaction(async tx => {
        await tx.execute('DELETE FROM records');
        throw error;
      })
    ).rejects.toBe(error);
    expect(operations.slice(-4)).toEqual([
      'begin',
      'execute',
      'active',
      'rollback',
    ]);
    await driver.close();
    expect(operations.at(-1)).toBe('close');
    expect(await openTauriSqliteDriver()).not.toBe(driver);
  });

  it('retries an unavailable native connection without caching rejection', async () => {
    vi.stubGlobal('window', { __TAURI__: {} });
    mocks.invoke
      .mockRejectedValueOnce(new Error('disk unavailable'))
      .mockResolvedValue(undefined);
    const { openTauriSqliteDriver } = await import('./tauriSqliteDriver');
    await expect(openTauriSqliteDriver()).rejects.toThrow('disk unavailable');
    await expect(openTauriSqliteDriver()).resolves.toBeDefined();
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
  });
});
