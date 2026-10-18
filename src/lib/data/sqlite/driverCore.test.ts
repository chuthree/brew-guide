import { describe, expect, it, vi } from 'vitest';
import type { SqliteConnectionPort, SqliteExecutor } from './driver';
import { createSqliteDriverCore } from './driverCore';

function changes(count = 1): unknown {
  return { changes: { changes: count } };
}

function makeConnection(overrides: Partial<SqliteConnectionPort> = {}) {
  const calls: string[] = [];
  let active = false;
  const connection: SqliteConnectionPort = {
    execute: async (sql, transaction) => {
      calls.push(`execute:${sql}:${transaction}`);
      return changes();
    },
    run: async (sql, _params, transaction) => {
      calls.push(`run:${sql}:${transaction}`);
      return changes();
    },
    query: async sql => {
      calls.push(`query:${sql}`);
      return { values: [] };
    },
    beginTransaction: async () => {
      calls.push('begin');
      active = true;
      return changes();
    },
    commitTransaction: async () => {
      calls.push('commit');
      active = false;
      return changes();
    },
    rollbackTransaction: async () => {
      calls.push('rollback');
      active = false;
      return changes();
    },
    isTransactionActive: async () => active,
    ...overrides,
  };
  return { connection, calls };
}

function makeDriver(
  overrides: Partial<SqliteConnectionPort> = {},
  closeConnection = vi.fn(async () => undefined)
) {
  const fake = makeConnection(overrides);
  return {
    ...fake,
    closeConnection,
    driver: createSqliteDriverCore(fake.connection, closeConnection),
  };
}

describe('SQLite driver core', () => {
  it.each([
    ['boolean', true],
    ['undefined', undefined],
    ['Date', new Date(0)],
    ['object', { value: 1 }],
    ['array', [1]],
    ['Blob', new Blob(['x'])],
    ['ArrayBuffer', new ArrayBuffer(1)],
    ['BigInt', BigInt(1)],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
  ])('rejects %s SQL parameters', async (_label, invalid) => {
    const { driver } = makeDriver();
    await expect(
      driver.execute('SELECT ?', [invalid] as never)
    ).rejects.toThrow(/SQL parameter 0/);
  });

  it('accepts strings, finite fractions, safe integers, and null', async () => {
    const { driver, calls } = makeDriver();
    await driver.execute('INSERT INTO t VALUES (?, ?, ?, ?)', [
      'abc',
      12,
      1.5,
      null,
    ]);
    expect(calls).toContain('run:INSERT INTO t VALUES (?, ?, ?, ?):false');
  });

  it('normalizes native query rows and rejects values outside SqlValue', async () => {
    const { driver } = makeDriver({
      query: async () => ({
        values: [
          {
            text: 'abc',
            integer: 42,
            real: 1.5,
            nullable: null,
          },
        ],
      }),
    });
    await expect(driver.query('SELECT * FROM t')).resolves.toEqual([
      { text: 'abc', integer: 42, real: 1.5, nullable: null },
    ]);

    const invalidDriver = makeDriver({
      query: async () => ({ values: [{ flag: true }] }),
    }).driver;
    await expect(invalidDriver.query('SELECT flag FROM t')).rejects.toThrow(
      /not a string, finite number, or null/
    );

    const unsafeDriver = makeDriver({
      query: async () => ({ values: [{ value: Number.MAX_SAFE_INTEGER + 1 }] }),
    }).driver;
    await expect(unsafeDriver.query('SELECT value FROM t')).rejects.toThrow(
      /unsafe integer/
    );
  });

  it('requires one SQL statement while allowing semicolons in a string literal', async () => {
    const { driver } = makeDriver();
    await driver.execute("INSERT INTO t VALUES ('a;b')");
    await expect(
      driver.execute('DELETE FROM t; DELETE FROM t')
    ).rejects.toThrow(/multiple SQL statements/);
  });

  it('rejects negative plugin changes values rather than reporting success', async () => {
    const { driver } = makeDriver({
      execute: async () => changes(-1),
    });
    await expect(driver.execute('PRAGMA user_version')).rejects.toThrow(
      /invalid changes count: -1/
    );
  });

  it('uses the same connection and disables per-statement transactions inside a transaction', async () => {
    const { driver, calls } = makeDriver();
    await driver.transaction(async tx => {
      await tx.execute('INSERT INTO t VALUES (?)', ['a']);
      await tx.execute('CREATE TABLE t2 (id TEXT)');
      await tx.query('SELECT * FROM t');
    });

    expect(calls).toEqual([
      'begin',
      'run:INSERT INTO t VALUES (?):false',
      'execute:CREATE TABLE t2 (id TEXT):false',
      'query:SELECT * FROM t',
      'commit',
    ]);
  });

  it('rolls back and rethrows the original work error', async () => {
    const original = new Error('write failed');
    const run = makeDriver({
      run: async () => {
        throw original;
      },
    });
    await expect(
      run.driver.transaction(tx => tx.execute('INSERT INTO t VALUES (?)', [1]))
    ).rejects.toBe(original);
    expect(run.calls).toContain('rollback');
  });

  it('preserves the original error and appends a rollback diagnostic', async () => {
    const original = new Error('work failed');
    const { driver } = makeDriver({
      run: async () => {
        throw original;
      },
      rollbackTransaction: async () => {
        throw new Error('native rollback failed');
      },
    });
    await expect(
      driver.transaction(tx => tx.execute('INSERT INTO t VALUES (?)', [1]))
    ).rejects.toBe(original);
    expect(original.message).toContain('native rollback failed');
    expect(original).toHaveProperty('rollbackDiagnostic');
  });

  it('rejects nested transactions', async () => {
    const { driver } = makeDriver();
    await driver.transaction(async () => {
      await expect(driver.transaction(async () => undefined)).rejects.toThrow(
        'nested transaction not supported'
      );
    });
  });

  it('serializes concurrent writes and queues global operations behind an active transaction', async () => {
    let writesInFlight = 0;
    let maximumWritesInFlight = 0;
    const { driver } = makeDriver({
      run: async sql => {
        writesInFlight += 1;
        maximumWritesInFlight = Math.max(maximumWritesInFlight, writesInFlight);
        await new Promise(resolve =>
          setTimeout(resolve, sql.includes('first') ? 20 : 0)
        );
        writesInFlight -= 1;
        return changes();
      },
    });

    await Promise.all([
      driver.execute('INSERT INTO t VALUES (?) /* first */', [1]),
      driver.execute('INSERT INTO t VALUES (?) /* second */', [2]),
    ]);
    expect(maximumWritesInFlight).toBe(1);

    let releaseTransaction: (() => void) | undefined;
    let markTransactionEntered: (() => void) | undefined;
    const transactionEntered = new Promise<void>(resolve => {
      markTransactionEntered = resolve;
    });
    const transaction = driver.transaction(async () => {
      markTransactionEntered?.();
      await new Promise<void>(resolve => {
        releaseTransaction = resolve;
      });
    });
    await transactionEntered;
    const queuedWrite = driver.execute('INSERT INTO t VALUES (?)', [3]);
    const queuedRead = driver.query('SELECT 1');
    releaseTransaction?.();
    await transaction;
    await expect(queuedWrite).resolves.toEqual({ changes: 1 });
    await expect(queuedRead).resolves.toEqual([]);
  });

  it('expires the callback-scoped transaction executor after commit', async () => {
    const { driver } = makeDriver();
    let savedExecutor: SqliteExecutor | undefined;
    await driver.transaction(async tx => {
      savedExecutor = tx;
    });
    expect(savedExecutor).toBeDefined();
    await expect(savedExecutor!.query('SELECT 1')).rejects.toThrow(
      'transaction executor is no longer active'
    );
  });

  it('closes idempotently and rejects use after close', async () => {
    const closeConnection = vi.fn(async () => undefined);
    const { driver } = makeDriver({}, closeConnection);
    await driver.close();
    await driver.close();
    expect(closeConnection).toHaveBeenCalledTimes(1);
    await expect(driver.query('SELECT 1')).rejects.toThrow('driver is closed');
  });
});
