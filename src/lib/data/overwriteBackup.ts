import { create } from 'zustand';
import { readBackupStream } from './backupStream';
import { syncDataEqual } from '@/lib/sync/mergeData';
import { exportDataAsJsonFile } from '@/lib/utils/dataExportUtils';
import { OverwriteStop } from './overwriteStop';

const collections = {
  coffeeBeans: '咖啡豆',
  brewingNotes: '笔记',
  customEquipments: '器具',
  grinders: '磨豆机',
};

function recordTime(row: unknown): number {
  if (!row || typeof row !== 'object') return 0;
  const value =
    'updatedAt' in row
      ? row.updatedAt
      : 'timestamp' in row
        ? row.timestamp
        : undefined;
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= Date.now()
    ? value
    : 0;
}

// An inconsistent embedded record date invalidates the backup's age claim.
// Missing per-record dates are common in legacy backups with a dated export.
function incomingTime(row: unknown): number {
  if (!row || typeof row !== 'object') return 0;
  let latest = 0;
  for (const key of ['timestamp', 'updatedAt'] as const) {
    if (!Object.hasOwn(row, key)) continue;
    const value = (row as Record<string, unknown>)[key];
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
      return Infinity;
    latest = Math.max(latest, value);
  }
  return latest;
}

function exportTime(value: unknown): number {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value
    )
  )
    return 0;
  const date = new Date(value.slice(0, 10) + 'T00:00:00Z');
  if (
    !Number.isFinite(date.getTime()) ||
    !date.toISOString().startsWith(value.slice(0, 10))
  )
    return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) && time > 0 && time <= Date.now() ? time : 0;
}

export async function isOlderOverwrite(
  local: Record<string, unknown>,
  input: string | Blob,
  presetKeys: readonly string[]
) {
  let newestAffected = 0;
  let newestIncoming = 0;
  const remaining = new Map<string, Map<string, unknown>>();
  const nonempty = new Set<string>();
  for (const key of Object.keys(collections)) {
    const rows = local[key];
    if (!Array.isArray(rows)) throw new Error('无法清点本机记录');
    remaining.set(key, new Map(rows.map(row => [row.id, row])));
  }
  function compare(previous: unknown, incoming: unknown) {
    newestIncoming = Math.max(newestIncoming, incomingTime(incoming));
    if (!syncDataEqual(previous, incoming))
      newestAffected = Math.max(newestAffected, recordTime(previous));
  }
  function inspect(key: string, row: Record<string, unknown>) {
    if (typeof row?.id !== 'string') throw new Error('备份记录缺少 ID');
    nonempty.add(key);
    const previous = remaining.get(key)!;
    compare(previous.get(row.id), row);
    previous.delete(row.id);
  }
  let document:
    | { exportDate?: unknown; data?: Record<string, unknown> }
    | undefined;
  if (typeof input === 'string') document = JSON.parse(input);
  else {
    for await (const event of readBackupStream(input)) {
      if (event.section === 'document') document = event.value;
      else inspect(event.section, event.value);
    }
  }
  const data = document?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('备份缺少有效的 data 字段');
  const raw = data.brewGuideSettings as
    | { state?: { settings?: Record<string, unknown> }; grinders?: unknown }
    | undefined;
  const legacy = raw?.state?.settings ?? raw;
  if (!Object.hasOwn(data, 'grinders') && Array.isArray(legacy?.grinders))
    data.grinders = legacy.grinders.filter(
      row => row && typeof row === 'object' && row.id && row.name
    );
  for (const [key, label] of Object.entries(collections)) {
    if (!Object.hasOwn(data, key)) continue;
    const rows = data[key];
    if (!Array.isArray(rows)) throw new Error(`${label}备份格式无效`);
    if (
      typeof input === 'string' ||
      (key !== 'coffeeBeans' && key !== 'brewingNotes')
    )
      for (const row of rows) inspect(key, row);
    const removed = remaining.get(key)!;
    if (removed.size && !nonempty.has(key))
      throw new OverwriteStop(`备份里没有${label}，未更改本机数据`);
    for (const row of removed.values()) compare(row, undefined);
  }
  for (const [key, label] of [
    ['customMethodsByEquipment', '自定义方案'],
    ['customPresets', '自定义预设'],
  ]) {
    if (!Object.hasOwn(data, key)) continue;
    const entries = (value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error(`${label}格式无效`);
      const rows = new Map<string, unknown>();
      for (const [group, items] of Object.entries(value)) {
        if (key === 'customPresets' && !presetKeys.includes(group)) continue;
        if (!Array.isArray(items)) throw new Error(`${label}格式无效`);
        for (const [i, item] of items.entries()) {
          const id = typeof item === 'string' ? item : (item?.id ?? i);
          const composite = JSON.stringify([group, id]);
          if (rows.has(composite)) throw new Error(`${label}中含重复记录`);
          rows.set(composite, item);
        }
      }
      return rows;
    };
    const before = entries(local[key] ?? {}),
      after = entries(data[key]);
    if (before.size && !after.size)
      throw new OverwriteStop(`备份里没有${label}，未更改本机数据`);
    for (const [id, value] of before) compare(value, after.get(id));
    for (const value of after.values())
      newestIncoming = Math.max(newestIncoming, incomingTime(value));
  }
  const exported = exportTime(document?.exportDate);
  return (
    exported > 0 && newestIncoming <= exported && exported < newestAffected
  );
}

interface Confirmation {
  older: boolean;
  confirm(): void;
  cancel(): void;
}
export const useOverwriteConfirmation = create<{
  pending: Confirmation | null;
}>(() => ({ pending: null }));

export function confirmAndExportBackup(
  older: boolean,
  snapshot: string
): Promise<boolean> {
  if (useOverwriteConfirmation.getState().pending)
    throw new Error('已有覆盖操作等待确认');
  return new Promise((resolve, reject) => {
    let answered = false;
    const close = () => {
      answered = true;
      useOverwriteConfirmation.setState({ pending: null });
    };
    useOverwriteConfirmation.setState({
      pending: {
        older,
        cancel() {
          if (!answered) {
            close();
            resolve(false);
          }
        },
        confirm() {
          if (answered) return;
          close();
          // Invoke the platform saver within the confirmation click on iOS.
          void exportDataAsJsonFile(snapshot, { returnIncompleteResult: true })
            .then(result => {
              if (result.mode === 'activation-required')
                throw new Error('保存备份需要用户操作，请重试');
              resolve(result.mode !== 'cancelled');
            })
            .catch(reject);
        },
      },
    });
  });
}
