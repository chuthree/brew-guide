export type SqlValue = string | number | null;

export type SqlRow = Readonly<Record<string, SqlValue>>;

export interface SqliteExecutor {
  execute(
    sql: string,
    params?: readonly SqlValue[]
  ): Promise<{ changes: number }>;

  query(sql: string, params?: readonly SqlValue[]): Promise<SqlRow[]>;
}

export interface SqliteDriver extends SqliteExecutor {
  transaction<T>(work: (tx: SqliteExecutor) => Promise<T>): Promise<T>;

  close(): Promise<void>;
}

/** The narrow connection surface used by the platform-neutral driver core. */
export interface SqliteConnectionPort {
  execute(sql: string, transaction: boolean): Promise<unknown>;
  run(
    sql: string,
    params: readonly SqlValue[],
    transaction: boolean
  ): Promise<unknown>;
  query(sql: string, params: readonly SqlValue[]): Promise<unknown>;
  beginTransaction(): Promise<unknown>;
  commitTransaction(): Promise<unknown>;
  rollbackTransaction(): Promise<unknown>;
  isTransactionActive(): Promise<boolean>;
}
