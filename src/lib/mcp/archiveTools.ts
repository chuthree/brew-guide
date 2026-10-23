/** Local archive authoring only. Does not generate reports or contact a provider. */
import { nanoid } from 'nanoid';
import type { SqliteExecutor } from '@/lib/data/sqlite/driver';
import {
  listHistoricalYearlyReports,
  saveHistoricalYearlyReport,
  deleteHistoricalYearlyReport,
} from '@/lib/data/sqlite/repositories/historicalYearlyReport';
import type { Schema } from './toolDefinitions';
import { invalid, McpToolError, validate } from './validation';
import { recordVersion } from './validation';
import { localHistoryGeneration, type MutationWork } from './storage';
type Args = Record<string, unknown>;
const obj = (
  properties: Record<string, Schema>,
  required: string[] = []
): Schema => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const id: Schema = { type: 'string', minLength: 1, maxLength: 128 };
const version: Schema = { type: 'string', minLength: 64, maxLength: 64 };
const write = {
  requestId: { type: 'string', minLength: 8, maxLength: 128 } as Schema,
  expectedVersion: version,
};
export const archiveDefinitions: Array<{
  name: string;
  description: string;
  schema: Schema;
  write?: boolean;
  destructive?: boolean;
}> = [
  {
    name: 'list_historical_reports',
    description:
      'Read paginated local yearly report archive summaries; version covers the full collection.',
    schema: obj({
      year: { type: 'integer', minimum: 1, maximum: 9999 },
      offset: { type: 'integer', minimum: 0 },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
    }),
  },
  {
    name: 'get_historical_report',
    description:
      'Read a saved local report and its preserved extension metadata; no report generation or external services.',
    schema: obj({ id }, ['id']),
  },
  {
    name: 'upsert_historical_report',
    description:
      'Create or edit a local archived report. Omit id to create; supplied id must exist. expectedVersion is collection version on create and item version on edit. extraJson replaces extension metadata only when provided.',
    write: true,
    schema: obj(
      {
        ...write,
        id,
        year: { type: 'integer', minimum: 1, maximum: 9999 },
        username: { type: 'string', maxLength: 128 },
        content: { type: 'string', maxLength: 500000 },
        extraJson: { type: 'string', maxLength: 65536 },
      },
      ['requestId', 'expectedVersion', 'year', 'username', 'content']
    ),
  },
  {
    name: 'preview_delete_historical_report',
    description: 'Preview deletion of one local archived report.',
    schema: obj({ id }, ['id']),
  },
  {
    name: 'delete_historical_report',
    description:
      'Delete only the previewed archived report, never its source coffee records.',
    write: true,
    destructive: true,
    schema: obj({ ...write, id, confirmationToken: version }, [
      'requestId',
      'expectedVersion',
      'id',
      'confirmationToken',
    ]),
  },
];
const previews = new Map<
  string,
  { id: string; version: string; generation: number; expires: number }
>();
function check(name: string, args: Args) {
  const d = archiveDefinitions.find(d => d.name === name);
  if (!d) throw new McpToolError('NOT_FOUND', 'Unknown archive tool');
  validate(args, d.schema);
}
function find(reports: Args[], id: unknown): Args {
  const item = reports.find(r => r.id === id);
  if (!item) throw new McpToolError('NOT_FOUND', 'Archived report not found');
  return item;
}
function extra(value: unknown): Args {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(value));
  } catch {
    invalid('extraJson must be valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    invalid('extraJson must encode an object');
  const reserved = new Set(['id', 'year', 'username', 'content', 'createdAt']);
  if (Object.keys(parsed).some(k => reserved.has(k)))
    invalid('extraJson cannot override canonical fields');
  function walk(v: unknown, depth: number) {
    if (depth > 20) invalid('Extension nesting is too deep');
    if (v && typeof v === 'object')
      for (const [k, c] of Object.entries(v)) {
        if (['__proto__', 'constructor', 'prototype'].includes(k))
          invalid('Unsafe extension key');
        walk(c, depth + 1);
      }
    else if (typeof v === 'number' && !Number.isFinite(v))
      invalid('Extension numbers must be finite');
  }
  walk(parsed, 0);
  return parsed as Args;
}
export async function readArchiveTool(
  tx: SqliteExecutor,
  name: string,
  args: Args
): Promise<Args> {
  check(name, args);
  const reports = await listHistoricalYearlyReports(tx);
  if (name === 'list_historical_reports') {
    const items = reports.filter(
      r => args.year === undefined || r.year === args.year
    );
    const offset = Number(args.offset ?? 0),
      limit = Number(args.limit ?? 50);
    return {
      version: await recordVersion(reports),
      total: items.length,
      items: await Promise.all(
        items.slice(offset, offset + limit).map(async r => ({
          id: r.id,
          year: r.year,
          username: r.username,
          createdAt: r.createdAt,
          version: await recordVersion(r),
        }))
      ),
      offset,
      limit,
    };
  }
  const item = find(reports, args.id),
    v = await recordVersion(item);
  if (name === 'get_historical_report') return { item, version: v };
  if (name !== 'preview_delete_historical_report')
    throw new McpToolError('NOT_FOUND', 'Unknown archive read tool');
  const token = await recordVersion({
    nonce: nanoid(),
    id: item.id,
    version: v,
  });
  if (previews.size >= 500) previews.delete(previews.keys().next().value!);
  previews.set(token, {
    id: String(item.id),
    version: v,
    generation: localHistoryGeneration,
    expires: Date.now() + 300000,
  });
  return {
    item,
    version: v,
    confirmationToken: token,
    expiresInSeconds: 300,
    impact: { reportsDeleted: 1, sourceRecordsChanged: 0 },
  };
}
export async function mutateArchiveTool(
  tx: SqliteExecutor,
  name: string,
  args: Args
): Promise<MutationWork<Args>> {
  check(name, args);
  const reports = await listHistoricalYearlyReports(tx);
  const before = args.id === undefined ? null : find(reports, args.id);
  if (args.expectedVersion !== (await recordVersion(before ?? reports)))
    throw new McpToolError(
      'CONFLICT',
      'Archived report changed; read it again'
    );
  if (name === 'delete_historical_report') {
    const p = previews.get(String(args.confirmationToken));
    if (
      !p ||
      p.id !== args.id ||
      p.version !== args.expectedVersion ||
      p.generation !== localHistoryGeneration ||
      p.expires < Date.now()
    )
      throw new McpToolError(
        'CONFIRMATION_REQUIRED',
        'Get a fresh archive deletion preview'
      );
    await deleteHistoricalYearlyReport(tx, String(args.id));
    return {
      result: { deleted: true, id: args.id },
      changes: [
        {
          entity: 'historical_report',
          id: String(args.id),
          before,
          after: null,
        },
      ],
      summary: 'Deleted local archived report',
    };
  }
  if (name !== 'upsert_historical_report')
    throw new McpToolError('NOT_FOUND', 'Unknown archive mutation tool');
  const after = {
    ...(args.extraJson === undefined ? (before ?? {}) : extra(args.extraJson)),
    id: before?.id ?? nanoid(),
    year: args.year,
    username: args.username,
    content: args.content,
    createdAt: before?.createdAt ?? Date.now(),
  };
  await saveHistoricalYearlyReport(tx, after);
  return {
    result: { item: after, version: await recordVersion(after) },
    changes: [
      { entity: 'historical_report', id: String(after.id), before, after },
    ],
    summary: before
      ? 'Updated local archived report'
      : 'Created local archived report',
  };
}
