import type { SqliteDriver } from '@/lib/data/sqlite/driver';
import { host } from './host';
export const driver: SqliteDriver = {
  async query(sql, params = []) {
    return host('sql.query', { sql, params });
  },
  async execute(sql, params = []) {
    return host('sql.execute', { sql, params });
  },
  async transaction(work) {
    host('sql.begin');
    try {
      const value = await work(driver);
      host('sql.commit');
      return value;
    } catch (error) {
      host('sql.rollback');
      throw error;
    }
  },
  async close() {},
};
export async function openTauriSqliteDriver() {
  return driver;
}
