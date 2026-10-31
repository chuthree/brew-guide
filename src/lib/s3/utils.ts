/**
 * 同步相关的工具函数
 */

import type { FileMetadata } from './types';

/**
 * 计算字符串或 ArrayBuffer 的 SHA-256 哈希值
 */
export async function calculateHash(
  data: string | ArrayBuffer
): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      '云同步需要 Web Crypto，请使用 HTTPS 地址或原生应用；手机通过局域网 HTTP 地址访问时无法同步'
    );
  }
  const buffer =
    typeof data === 'string'
      ? new TextEncoder().encode(data)
      : new Uint8Array(data);

  const hashBuffer = await subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 为本地数据创建文件元数据
 * 这里解决了原来的 bug：不再包含动态的 exportDate
 */
export async function createFileMetadata(
  key: string,
  content: string,
  mtimeCli?: number
): Promise<FileMetadata> {
  const hash = await calculateHash(content);
  const size = new TextEncoder().encode(content).length;

  return {
    key,
    size,
    mtimeCli: mtimeCli || Date.now(),
    hash,
    syncedAt: Date.now(),
  };
}

/**
 * 从导出的数据对象创建文件元数据映射
 * 关键修复：排除动态字段（exportDate, timestamp 等）后再计算哈希
 */
export async function createFilesMetadataFromData(
  dataMap: Record<string, unknown>
): Promise<Record<string, FileMetadata>> {
  const filesMetadata: Record<string, FileMetadata> = {};

  for (const [key, value] of Object.entries(dataMap)) {
    try {
      // 如果是完整的导出对象，只取 data 字段计算哈希
      let dataForHash = value;

      if (
        typeof value === 'object' &&
        value !== null &&
        'data' in value &&
        'exportDate' in value
      ) {
        // 这是完整的导出格式，只使用 data 字段
        dataForHash = (value as { data: unknown }).data;
      }

      // 规范化数据以获得稳定的哈希值
      const normalizedData = normalizeDataForHash(dataForHash);
      const content = JSON.stringify(normalizedData);

      filesMetadata[key] = await createFileMetadata(key, content);
    } catch (error) {
      console.error(`创建文件 ${key} 的元数据失败:`, error);
    }
  }

  return filesMetadata;
}

/**
 * 规范化数据以获得稳定的哈希值
 * 关键：移除所有动态时间戳、排序键名
 */
export function normalizeDataForHash(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => normalizeDataForHash(item));
  }

  // 对象类型
  const obj = data as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};

  // 需要排除的动态字段
  const excludeFields = new Set([
    'exportDate',
    'timestamp',
    'lastModified',
    'syncedAt',
    'lastSyncTime',
    '_timestamp', // 任何以 _ 开头的时间戳字段
    'updatedAt',
    'createdAt',
  ]);

  // 获取所有键并排序
  const keys = Object.keys(obj)
    .filter(key => !excludeFields.has(key))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  // 递归规范化每个值
  for (const key of keys) {
    normalized[key] = normalizeDataForHash(obj[key]);
  }

  return normalized;
}

/**
 * 生成设备指纹 ID
 */
export async function generateDeviceId(): Promise<string> {
  try {
    // 尝试从多个来源收集设备特征
    const features: string[] = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
      new Date().getTimezoneOffset().toString(),
      navigator.hardwareConcurrency?.toString() || '',
      navigator.maxTouchPoints?.toString() || '',
    ];

    // 如果支持 Canvas 指纹
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(0, 0, 100, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('Device fingerprint', 2, 2);
        features.push(canvas.toDataURL());
      }
    } catch {
      // Canvas 指纹可能被阻止
    }

    const fingerprint = features.join('|');
    const hash = await calculateHash(fingerprint);

    return `device-${hash.substring(0, 16)}`;
  } catch (error) {
    console.error('生成设备 ID 失败:', error);
    // 后备方案：随机 ID
    return `device-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
  }
}

/**
 * 安全的 JSON 解析
 */
export function safeJsonParse<T = unknown>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
