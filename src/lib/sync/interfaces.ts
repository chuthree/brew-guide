/**
 * 同步模块核心接口定义
 *
 * 所有同步服务提供商必须实现这些接口，确保行为一致性
 */

import type { SyncDirection, SyncProgress, CloudProvider } from './types';

/**
 * 同步配置基础接口
 */
export interface ISyncConfig {
  readonly provider: CloudProvider;
}

/**
 * Supabase 同步配置
 */
export interface ISupabaseConfig extends ISyncConfig {
  readonly provider: 'supabase';
  readonly url: string;
  readonly anonKey: string;
}

/**
 * S3 同步配置
 */
export interface IS3Config extends ISyncConfig {
  readonly provider: 's3';
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly bucketName: string;
  readonly prefix?: string;
  readonly endpoint?: string;
}

/**
 * WebDAV 同步配置
 */
export interface IWebDAVConfig extends ISyncConfig {
  readonly provider: 'webdav';
  readonly url: string;
  readonly username: string;
  readonly password: string;
  readonly remotePath?: string;
}

/**
 * 同步配置联合类型
 */
export type SyncConfig = ISupabaseConfig | IS3Config | IWebDAVConfig;

/**
 * 同步选项
 */
export interface ISyncOptions {
  direction: SyncDirection;
  onProgress?: (progress: SyncProgress) => void;
}

/**
 * 同步结果
 */
export interface ISyncResult {
  readonly success: boolean;
  readonly message: string;
  readonly uploadedCount: number;
  readonly downloadedCount: number;
  readonly errors: ReadonlyArray<string>;
  readonly debugLogs?: ReadonlyArray<string>;
}

/**
 * 同步管理器接口
 *
 * 所有同步服务提供商必须实现此接口
 */
export interface ISyncManager<TConfig extends ISyncConfig = ISyncConfig> {
  /**
   * 获取服务提供商标识
   */
  readonly provider: CloudProvider;

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean;

  /**
   * 初始化同步管理器
   *
   * @param config 同步配置
   * @returns 是否初始化成功
   */
  initialize(config: TConfig): Promise<boolean>;

  /**
   * 测试连接
   *
   * @returns 连接是否正常
   */
  testConnection(): Promise<boolean>;

  /**
   * 执行同步
   *
   * @param options 同步选项
   * @returns 同步结果
   */
  sync(options: ISyncOptions): Promise<ISyncResult>;

  /**
   * 断开连接并释放资源
   */
  disconnect(): void;
}

/**
 * 创建同步结果的工厂函数
 */
export function createSyncResult(
  partial: Partial<ISyncResult> & Pick<ISyncResult, 'success' | 'message'>
): ISyncResult {
  return {
    success: partial.success,
    message: partial.message,
    uploadedCount: partial.uploadedCount ?? 0,
    downloadedCount: partial.downloadedCount ?? 0,
    errors: partial.errors ?? [],
    debugLogs: partial.debugLogs,
  };
}

/**
 * 创建失败结果的快捷函数
 */
export function createFailureResult(
  message: string,
  errors: string[] = []
): ISyncResult {
  return createSyncResult({
    success: false,
    message,
    errors: errors.length > 0 ? errors : [message],
  });
}

/**
 * 创建成功结果的快捷函数
 */
export function createSuccessResult(
  message: string,
  counts: { uploaded?: number; downloaded?: number } = {}
): ISyncResult {
  return createSyncResult({
    success: true,
    message,
    uploadedCount: counts.uploaded ?? 0,
    downloadedCount: counts.downloaded ?? 0,
  });
}

/**
 * BaseSyncManager 适配器
 *
 * 将 S3/WebDAV 的 BaseSyncManager 适配到 ISyncManager 接口
 */
export class BaseSyncManagerAdapter implements ISyncManager {
  constructor(
    readonly provider: CloudProvider,
    private readonly manager: {
      sync(options: {
        preferredDirection?: 'upload' | 'download';
        onProgress?: (p: {
          phase: string;
          message: string;
          percentage: number;
        }) => void;
      }): Promise<{
        success: boolean;
        message: string;
        uploadedFiles: number;
        downloadedFiles: number;
        errors: string[];
        debugLogs?: string[];
      }>;
      testConnection?(): Promise<boolean>;
    }
  ) {}

  isInitialized(): boolean {
    return true;
  }

  async initialize(): Promise<boolean> {
    return true;
  }

  async testConnection(): Promise<boolean> {
    return this.manager.testConnection?.() ?? true;
  }

  async sync(options: ISyncOptions): Promise<ISyncResult> {
    const result = await this.manager.sync({
      preferredDirection: options.direction,
      onProgress: options.onProgress
        ? p =>
            options.onProgress!({
              phase: p.phase,
              message: p.message,
              percentage: p.percentage,
            })
        : undefined,
    });

    return {
      success: result.success,
      message: result.message,
      uploadedCount: result.uploadedFiles,
      downloadedCount: result.downloadedFiles,
      errors: result.errors,
      debugLogs: result.debugLogs,
    };
  }

  disconnect(): void {
    // BaseSyncManager 没有显式 disconnect
  }
}
