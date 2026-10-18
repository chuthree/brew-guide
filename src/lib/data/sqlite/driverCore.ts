import type {
  SqlRow,
  SqliteConnectionPort,
  SqliteDriver,
  SqliteExecutor,
  SqlValue,
} from './driver';

export class SqliteDriverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SqliteDriverError';
  }
}

function assertSingleStatement(sql: string): void {
  if (!sql.trim()) throw new SqliteDriverError('SQL statement is empty');

  let quote: "'" | '"' | '`' | ']' | null = null;
  let lineComment = false;
  let blockComment = false;
  let terminated = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (char === quote) {
        if (quote !== ']' && next === quote) {
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (terminated) {
      if (/\s/.test(char)) continue;
      if (char === '-' && next === '-') {
        lineComment = true;
        index += 1;
        continue;
      }
      if (char === '/' && next === '*') {
        blockComment = true;
        index += 1;
        continue;
      }
      throw new SqliteDriverError('multiple SQL statements are not supported');
    }

    if (char === '-' && next === '-') {
      lineComment = true;
      index += 1;
    } else if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
    } else if (char === "'") {
      quote = "'";
    } else if (char === '"') {
      quote = '"';
    } else if (char === '`') {
      quote = '`';
    } else if (char === '[') {
      quote = ']';
    } else if (char === ';') {
      terminated = true;
    }
  }

  if (quote || blockComment) {
    throw new SqliteDriverError(
      'SQL statement contains an unterminated quote or comment'
    );
  }
}

function validateParams(params: readonly SqlValue[] = []): SqlValue[] {
  if (!Array.isArray(params)) {
    throw new SqliteDriverError('SQL parameters must be an array');
  }

  return params.map((value, index) => {
    if (value === null || typeof value === 'string') return value;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new SqliteDriverError(
        `SQL parameter ${index} must be a string, finite number, or null`
      );
    }
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      throw new SqliteDriverError(
        `SQL parameter ${index} is an unsafe integer`
      );
    }
    return value;
  });
}

function normalizeChanges(result: unknown, operation: string): number {
  if (!result || typeof result !== 'object') {
    throw new SqliteDriverError(`${operation} returned an invalid result`);
  }
  const changes = (result as { changes?: unknown }).changes;
  if (!changes || typeof changes !== 'object') {
    throw new SqliteDriverError(`${operation} returned no changes result`);
  }
  const count = (changes as { changes?: unknown }).changes;
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
    throw new SqliteDriverError(
      `${operation} returned an invalid changes count: ${String(count)}`
    );
  }
  return count;
}

function normalizeQueryRows(result: unknown): SqlRow[] {
  if (!result || typeof result !== 'object') {
    throw new SqliteDriverError('query returned an invalid result');
  }
  const values = (result as { values?: unknown }).values;
  if (!Array.isArray(values)) {
    throw new SqliteDriverError('query result does not contain a values array');
  }

  return values.map((candidate, rowIndex) => {
    if (
      candidate === null ||
      typeof candidate !== 'object' ||
      Array.isArray(candidate)
    ) {
      throw new SqliteDriverError(`query row ${rowIndex} is not an object`);
    }

    const row: Record<string, SqlValue> = {};
    for (const [key, value] of Object.entries(candidate)) {
      if (value === null || typeof value === 'string') {
        row[key] = value;
        continue;
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
          throw new SqliteDriverError(
            `query row ${rowIndex}.${key} is an unsafe integer`
          );
        }
        row[key] = value;
        continue;
      }
      throw new SqliteDriverError(
        `query row ${rowIndex}.${key} is not a string, finite number, or null`
      );
    }
    return row;
  });
}

class AsyncMutex {
  private tail: Promise<void> = Promise.resolve();

  async runExclusive<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release = (): void => undefined;
    this.tail = new Promise<void>(resolve => {
      release = resolve;
    });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }
}

function appendRollbackDiagnostic(
  original: unknown,
  diagnostic: unknown
): never {
  const diagnosticText =
    diagnostic instanceof Error ? diagnostic.message : String(diagnostic);
  if (original instanceof Error) {
    original.message = `${original.message}; rollback diagnostic: ${diagnosticText}`;
    Object.defineProperty(original, 'rollbackDiagnostic', {
      configurable: true,
      value: diagnostic,
    });
    throw original;
  }
  throw new SqliteDriverError(
    `${String(original)}; rollback diagnostic: ${diagnosticText}`
  );
}

/**
 * Adds validation, serialized access, and explicit transaction orchestration
 * around a platform driver's single native connection.
 */
export function createSqliteDriverCore(
  connection: SqliteConnectionPort,
  closeConnection: () => Promise<void>
): SqliteDriver {
  const mutex = new AsyncMutex();
  let closed = false;
  let transactionActive = false;

  const assertOpen = (): void => {
    if (closed) throw new SqliteDriverError('SQLite driver is closed');
  };

  const executeOnConnection = async (
    sql: string,
    params: readonly SqlValue[] = []
  ): Promise<{ changes: number }> => {
    assertSingleStatement(sql);
    const values = validateParams(params);
    const result =
      values.length > 0
        ? await connection.run(sql, values, false)
        : await connection.execute(sql, false);
    return { changes: normalizeChanges(result, 'SQL execution') };
  };

  const queryOnConnection = async (
    sql: string,
    params: readonly SqlValue[] = []
  ): Promise<SqlRow[]> => {
    assertSingleStatement(sql);
    const values = validateParams(params);
    return normalizeQueryRows(await connection.query(sql, values));
  };

  const createTransactionExecutor = (): {
    executor: SqliteExecutor;
    expire: () => void;
  } => {
    let active = true;
    return {
      executor: {
        execute: async (sql, params) => {
          if (!active) {
            throw new SqliteDriverError(
              'transaction executor is no longer active'
            );
          }
          return executeOnConnection(sql, params);
        },
        query: async (sql, params) => {
          if (!active) {
            throw new SqliteDriverError(
              'transaction executor is no longer active'
            );
          }
          return queryOnConnection(sql, params);
        },
      },
      expire: () => {
        active = false;
      },
    };
  };

  // Ordinary driver calls queue behind transactions. Transaction callbacks
  // must use their scoped executor.
  return {
    execute: (sql, params) =>
      mutex.runExclusive(async () => {
        assertOpen();
        return executeOnConnection(sql, params);
      }),
    query: (sql, params) =>
      mutex.runExclusive(async () => {
        assertOpen();
        return queryOnConnection(sql, params);
      }),
    transaction: async work => {
      if (transactionActive) {
        throw new SqliteDriverError('nested transaction not supported');
      }
      return mutex.runExclusive(async () => {
        assertOpen();
        if (transactionActive) {
          throw new SqliteDriverError('nested transaction not supported');
        }
        transactionActive = true;
        let began = false;
        let expireTransactionExecutor = (): void => undefined;
        try {
          const beginResult = await connection.beginTransaction();
          began = true;
          normalizeChanges(beginResult, 'beginTransaction');
          const transactionExecutor = createTransactionExecutor();
          expireTransactionExecutor = transactionExecutor.expire;
          const value = await work(transactionExecutor.executor);
          // Expire the callback-scoped executor before attempting to commit.
          expireTransactionExecutor();
          normalizeChanges(
            await connection.commitTransaction(),
            'commitTransaction'
          );
          began = false;
          return value;
        } catch (originalError) {
          expireTransactionExecutor();
          try {
            const active = await connection.isTransactionActive();
            if (typeof active !== 'boolean') {
              throw new SqliteDriverError(
                'isTransactionActive returned a non-boolean result'
              );
            }
            if (began && active) {
              normalizeChanges(
                await connection.rollbackTransaction(),
                'rollbackTransaction'
              );
            }
          } catch (rollbackDiagnostic) {
            appendRollbackDiagnostic(originalError, rollbackDiagnostic);
          }
          throw originalError;
        } finally {
          transactionActive = false;
        }
      });
    },
    close: () => {
      if (transactionActive) {
        return Promise.reject(
          new SqliteDriverError(
            'cannot close SQLite driver during a transaction'
          )
        );
      }
      return mutex.runExclusive(async () => {
        if (closed) return;
        await closeConnection();
        closed = true;
      });
    },
  };
}
