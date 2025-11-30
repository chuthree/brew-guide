/**
 * PWA 持久化存储工具
 *
 * 提供 Storage API 的持久化存储功能，包括：
 * - 请求持久化存储权限
 * - 检查持久化状态
 * - 获取存储配额和使用情况
 * - 格式化存储大小显示
 */

export interface StorageEstimate {
  /** 总配额（字节） */
  quota: number;
  /** 已使用（字节） */
  usage: number;
  /** 使用百分比 */
  usagePercent: number;
  /** 格式化的配额字符串 */
  quotaFormatted: string;
  /** 格式化的已使用字符串 */
  usageFormatted: string;
  /** 格式化的可用空间字符串 */
  availableFormatted: string;
}

/**
 * 检查浏览器是否支持 Storage API
 */
export function isStorageApiSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    typeof navigator.storage !== 'undefined'
  );
}

/**
 * 检查浏览器是否支持持久化存储
 */
export function isPersistentStorageSupported(): boolean {
  return (
    isStorageApiSupported() &&
    typeof navigator.storage.persist === 'function' &&
    typeof navigator.storage.persisted === 'function'
  );
}

/**
 * 检查是否在 PWA 独立模式下运行
 */
export function isPWAMode(): boolean {
  // 检查是否在独立模式下运行（已添加到主屏幕）
  if (typeof window === 'undefined') return false;

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isInWebAppiOS = (window.navigator as any).standalone === true;
  const isInWebAppChrome = window.matchMedia(
    '(display-mode: minimal-ui)'
  ).matches;

  return isStandalone || isInWebAppiOS || isInWebAppChrome;
}

/**
 * 检查当前是否已开启持久化存储
 */
export async function isPersisted(): Promise<boolean> {
  if (!isPersistentStorageSupported()) {
    return false;
  }

  try {
    return await navigator.storage.persisted();
  } catch (error) {
    console.error('检查持久化状态失败:', error);
    return false;
  }
}

/**
 * 请求持久化存储权限
 *
 * 注意：浏览器可能会根据以下因素自动授予或拒绝：
 * - 用户与应用的交互频率
 * - 应用是否已安装为 PWA
 * - 网站的使用情况
 *
 * @returns 是否成功开启持久化存储
 */
export async function requestPersist(): Promise<boolean> {
  if (!isPersistentStorageSupported()) {
    throw new Error('当前浏览器不支持持久化存储');
  }

  try {
    const isPersisted = await navigator.storage.persist();
    return isPersisted;
  } catch (error) {
    console.error('请求持久化存储失败:', error);
    throw error;
  }
}

/**
 * 获取存储配额和使用情况
 */
export async function getStorageEstimate(): Promise<StorageEstimate | null> {
  if (!isStorageApiSupported() || !navigator.storage.estimate) {
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    const quota = estimate.quota || 0;
    const usage = estimate.usage || 0;
    const usagePercent = quota > 0 ? (usage / quota) * 100 : 0;
    const available = quota - usage;

    return {
      quota,
      usage,
      usagePercent,
      quotaFormatted: formatBytes(quota),
      usageFormatted: formatBytes(usage),
      availableFormatted: formatBytes(available),
    };
  } catch (error) {
    console.error('获取存储估算失败:', error);
    return null;
  }
}

/**
 * 格式化字节数为人类可读的字符串
 *
 * @param bytes 字节数
 * @param decimals 小数位数，默认 2
 * @returns 格式化后的字符串，如 "1.5 GB"
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 持久化存储管理器
 */
export class PersistentStorageManager {
  private static instance: PersistentStorageManager;
  private persistedCache: boolean | null = null;
  private storageEstimateCache: StorageEstimate | null = null;
  private lastCheckTime: number = 0;
  private readonly CACHE_DURATION = 10000; // 10秒缓存

  private constructor() {}

  static getInstance(): PersistentStorageManager {
    if (!PersistentStorageManager.instance) {
      PersistentStorageManager.instance = new PersistentStorageManager();
    }
    return PersistentStorageManager.instance;
  }

  /**
   * 检查持久化状态（带缓存）
   */
  async checkPersisted(forceRefresh: boolean = false): Promise<boolean> {
    const now = Date.now();
    if (
      !forceRefresh &&
      this.persistedCache !== null &&
      now - this.lastCheckTime < this.CACHE_DURATION
    ) {
      return this.persistedCache;
    }

    this.persistedCache = await isPersisted();
    this.lastCheckTime = now;
    return this.persistedCache;
  }

  /**
   * 获取存储估算（带缓存）
   */
  async getEstimate(
    forceRefresh: boolean = false
  ): Promise<StorageEstimate | null> {
    const now = Date.now();
    if (
      !forceRefresh &&
      this.storageEstimateCache !== null &&
      now - this.lastCheckTime < this.CACHE_DURATION
    ) {
      return this.storageEstimateCache;
    }

    this.storageEstimateCache = await getStorageEstimate();
    this.lastCheckTime = now;
    return this.storageEstimateCache;
  }

  /**
   * 请求持久化并刷新缓存
   */
  async requestPersist(): Promise<boolean> {
    const result = await requestPersist();
    this.persistedCache = result;
    this.lastCheckTime = Date.now();
    return result;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.persistedCache = null;
    this.storageEstimateCache = null;
    this.lastCheckTime = 0;
  }
}

export default PersistentStorageManager.getInstance();
