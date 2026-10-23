import {
  decodeHistoricalYearlyReport,
  encodeHistoricalYearlyReport,
} from '../codecs';
import type { HistoricalYearlyReportRow } from '../schemaV1';
import type { SqliteExecutor } from '../driver';
export async function listHistoricalYearlyReports(
  tx: SqliteExecutor
): Promise<Record<string, unknown>[]> {
  return (
    await tx.query(
      'SELECT id,year,username,content,created_at_ms,extra_json FROM historical_yearly_reports ORDER BY year DESC,created_at_ms DESC,id ASC'
    )
  ).map(row =>
    decodeHistoricalYearlyReport(row as unknown as HistoricalYearlyReportRow)
  );
}
export async function saveHistoricalYearlyReport(
  tx: SqliteExecutor,
  report: Record<string, unknown>
): Promise<void> {
  const r = encodeHistoricalYearlyReport(report);
  await tx.execute(
    `INSERT INTO historical_yearly_reports (id,year,username,content,created_at_ms,extra_json) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET year=excluded.year,username=excluded.username,content=excluded.content,created_at_ms=excluded.created_at_ms,extra_json=excluded.extra_json`,
    [r.id, r.year, r.username, r.content, r.created_at_ms, r.extra_json]
  );
}
export async function deleteHistoricalYearlyReport(
  tx: SqliteExecutor,
  id: string
): Promise<void> {
  await tx.execute('DELETE FROM historical_yearly_reports WHERE id = ?', [id]);
}
