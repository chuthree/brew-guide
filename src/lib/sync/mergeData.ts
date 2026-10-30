import { omitDeviceSettings } from '@/lib/settings/deviceSettings';

type Data = Record<string, unknown>;
export interface SyncDocument {
  data: Data;
  [key: string]: unknown;
}

function isObject(value: unknown): value is Data {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

const recordCollections = new Set([
  'coffeeBeans',
  'brewingNotes',
  'customEquipments',
  'grinders',
]);

function records(value: unknown, path: string): Map<string, Data> {
  if (value === undefined) return new Map();
  if (!Array.isArray(value))
    throw new Error(`${path} 不是记录列表，已停止同步`);
  const result = new Map<string, Data>();
  for (const item of value) {
    if (
      !isObject(item) ||
      typeof item.id !== 'string' ||
      !item.id ||
      result.has(item.id)
    ) {
      throw new Error(`${path} 存在缺失或重复的记录 ID，已停止同步`);
    }
    result.set(item.id, item);
  }
  return result;
}

export function parseSyncDocument(content: string): SyncDocument {
  const document: unknown = JSON.parse(content);
  if (!isObject(document) || !isObject(document.data)) {
    throw new Error('同步文件格式无效，缺少 data 对象');
  }
  const data = { ...document.data };
  // 提醒开关和日程随本机保存，忽略旧云端文件中的副本。
  delete data.backupReminderSettings;
  for (const key of ['customMethodsByEquipment', 'customPresets']) {
    if (data[key] === undefined) data[key] = {};
    if (!isObject(data[key])) throw new Error(`${key} 格式无效`);
  }
  // 连接凭据与设备设置不参与合并，也不能被另一台设备覆盖。
  if (isObject(data.brewGuideSettings)) {
    const settings = omitDeviceSettings(data.brewGuideSettings);
    data.brewGuideSettings = settings;
  }
  for (const key of recordCollections) {
    if (data[key] === undefined)
      throw new Error(`同步文件缺少 ${key}，请先用当前版本重新上传完整备份`);
    records(data[key], key);
  }
  if (data.customMethodsByEquipment !== undefined) {
    if (!isObject(data.customMethodsByEquipment))
      throw new Error('自定义方案格式无效');
    for (const [key, value] of Object.entries(data.customMethodsByEquipment)) {
      records(value, `customMethodsByEquipment.${key}`);
    }
  }
  // 烘焙商配置已包含在设置中，避免旧兼容副本覆盖合并结果。
  if (
    isObject(data.brewGuideSettings) &&
    data.brewGuideSettings.roasterConfigs !== undefined
  ) {
    delete data.roasterConfigs;
  }
  return { ...document, data } as SyncDocument;
}

/** 三方合并：记录内部保持原子性，设置按字段合并。 */
export function mergeSyncData(
  base: Data | undefined,
  local: Data,
  remote: Data
) {
  const conflicts: string[] = [];
  const merge = (
    before: unknown,
    left: unknown,
    right: unknown,
    path: string
  ): unknown => {
    if (canonical(left) === canonical(right)) return left;
    if (base && canonical(left) === canonical(before)) return right;
    if (base && canonical(right) === canonical(before)) return left;

    const collection =
      recordCollections.has(path) ||
      /^customMethodsByEquipment\.[^.]+$/.test(path);
    if (collection) {
      const b = records(before, path),
        l = records(left, path),
        r = records(right, path);
      return [...new Set([...l.keys(), ...r.keys(), ...b.keys()])].flatMap(
        id => {
          const value = merge(
            b.get(id),
            l.get(id),
            r.get(id),
            `${path}[${id}]`
          );
          return value === undefined ? [] : [value];
        }
      );
    }
    if (!base && left === undefined) return right;
    if (!base && right === undefined) return left;
    // 不拆开同一条记录，以免把两个独立修改拼成未经用户确认的状态。
    if (
      !path.includes('[') &&
      isObject(left) &&
      isObject(right) &&
      (before === undefined || isObject(before))
    ) {
      const b = isObject(before) ? before : {};
      return Object.fromEntries(
        [
          ...new Set([
            ...Object.keys(b),
            ...Object.keys(left),
            ...Object.keys(right),
          ]),
        ].flatMap(key => {
          const value = merge(
            b[key],
            left[key],
            right[key],
            path ? `${path}.${key}` : key
          );
          return value === undefined ? [] : [[key, value]];
        })
      );
    }
    conflicts.push(path);
    return left;
  };
  return { data: merge(base, local, remote, '') as Data, conflicts };
}
