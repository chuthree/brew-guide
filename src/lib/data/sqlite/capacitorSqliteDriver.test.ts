import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  platform: 'ios',
  close: vi.fn(),
  connection: {
    isDBOpen: vi.fn(),
    open: vi.fn(),
    execute: vi.fn(),
    run: vi.fn(),
    query: vi.fn(),
    beginTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    rollbackTransaction: vi.fn(),
    isTransactionActive: vi.fn(),
  },
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => mocks.platform },
}));
vi.mock('@capacitor-community/sqlite', () => ({
  CapacitorSQLite: {},
  SQLiteConnection: class {
    checkConnectionsConsistency = async () => ({ result: true });
    isConnection = async () => ({ result: false });
    createConnection = async () => mocks.connection;
    closeConnection = mocks.close;
  },
}));

beforeEach(() => {
  vi.resetModules();
  mocks.connection.isDBOpen.mockResolvedValue({ result: true });
  mocks.connection.execute.mockResolvedValue({ changes: { changes: 0 } });
  mocks.connection.run.mockResolvedValue({ changes: { changes: 1 } });
  mocks.connection.query.mockResolvedValue({
    values: [{ value: '原始数据', optional: null }],
  });
  for (const method of [
    'beginTransaction',
    'commitTransaction',
    'rollbackTransaction',
  ] as const) {
    mocks.connection[method].mockResolvedValue({ changes: { changes: 0 } });
  }
  mocks.connection.isTransactionActive.mockResolvedValue({ result: true });
  mocks.close.mockResolvedValue(undefined);
});
afterEach(() => vi.clearAllMocks());

describe.each(['ios'])(
  '%s Capacitor SQLite connection',
  platform => {
    it('shares one connection and preserves bridge parameters, commit and rollback semantics', async () => {
      mocks.platform = platform;
      const { openCapacitorSqliteDriver } =
        await import('./capacitorSqliteDriver');
      const [driver, second] = await Promise.all([
        openCapacitorSqliteDriver(),
        openCapacitorSqliteDriver(),
      ]);
      expect(driver).toBe(second);
      await driver.execute('CREATE TABLE test (value TEXT)');
      await driver.execute('INSERT INTO test VALUES (?)', ['原始数据']);
      expect(mocks.connection.execute).toHaveBeenCalledWith(
        'CREATE TABLE test (value TEXT)\n;',
        false,
        true
      );
      expect(mocks.connection.run).toHaveBeenCalledWith(
        'INSERT INTO test VALUES (?)',
        ['原始数据'],
        false,
        'no',
        true
      );
      await expect(driver.query('SELECT * FROM test')).resolves.toEqual([
        { value: '原始数据', optional: null },
      ]);
      expect(mocks.connection.query).toHaveBeenCalledWith(
        'SELECT * FROM test',
        [],
        true
      );
      await driver.transaction(tx => tx.execute('DELETE FROM test'));
      expect(mocks.connection.execute).toHaveBeenLastCalledWith(
        'DELETE FROM test\n;',
        false,
        true
      );
      expect(mocks.connection.commitTransaction).toHaveBeenCalledOnce();
      const error = new Error('failed during transaction');
      await expect(
        driver.transaction(async tx => {
          await tx.execute('DELETE FROM test');
          throw error;
        })
      ).rejects.toBe(error);
      expect(mocks.connection.rollbackTransaction).toHaveBeenCalledOnce();
      await driver.close();
      expect(mocks.close).toHaveBeenCalledWith('brew-guide', false);
      await expect(driver.query('SELECT * FROM test')).rejects.toThrow(
        'closed'
      );
      expect(await openCapacitorSqliteDriver()).not.toBe(driver);
    });

    it('closes a failed open and allows a subsequent retry', async () => {
      mocks.platform = platform;
      mocks.connection.isDBOpen.mockRejectedValueOnce(
        new Error('disk unavailable')
      );
      const { openCapacitorSqliteDriver } =
        await import('./capacitorSqliteDriver');
      await expect(openCapacitorSqliteDriver()).rejects.toThrow(
        'disk unavailable'
      );
      expect(mocks.close).toHaveBeenCalledOnce();
      await expect(openCapacitorSqliteDriver()).resolves.toBeDefined();
    });
  }
);

it.each(['web', 'electron'])(
  'rejects %s before opening any native connection',
  async platform => {
    mocks.platform = platform;
    const { openCapacitorSqliteDriver } =
      await import('./capacitorSqliteDriver');
    await expect(openCapacitorSqliteDriver()).rejects.toThrow(
      'only available on Capacitor Android or iOS'
    );
    expect(mocks.connection.isDBOpen).not.toHaveBeenCalled();
  }
);
