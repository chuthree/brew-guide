/**
 * WebDAV 同步管理器
 * 继承 BaseSyncManager，只实现 WebDAV 特定逻辑
 *
 * 职责：
 * 1. 初始化 WebDAV 客户端和元数据管理器
 * 2. 提供服务名称标识
 * 3. 其他同步逻辑由 BaseSyncManager 统一处理
 */

import { WebDAVClient } from './webdavClient';
import type { WebDAVConfig } from './types';
import { MetadataManager } from './metadataManager';
import { BaseSyncManager, IMetadataManager } from '@/lib/sync/BaseSyncManager';

import type { SyncMetadataV2 } from './types';

/**
 * WebDAV 元数据管理器适配器
 * 将 WebDAV 的 MetadataManager 适配到 BaseSyncManager 的接口
 */
class WebDAVMetadataManagerAdapter implements IMetadataManager {
  constructor(private manager: MetadataManager) {
    if (!manager) {
      throw new Error('MetadataManager 不能为 null');
    }
  }

  async getRemoteMetadata(): Promise<SyncMetadataV2 | null> {
    return await this.manager.getRemoteMetadata();
  }

  async getLocalMetadata(): Promise<SyncMetadataV2 | null> {
    return await this.manager.getLocalMetadata();
  }

  async saveLocalMetadata(metadata: SyncMetadataV2): Promise<void> {
    if (!metadata) {
      throw new Error('metadata 不能为 null');
    }
    await this.manager.saveLocalMetadata(metadata);
  }

  async saveRemoteMetadata(metadata: SyncMetadataV2): Promise<void> {
    if (!metadata) {
      throw new Error('metadata 不能为 null');
    }
    await this.manager.saveRemoteMetadata(metadata);
  }
}

export class WebDAVSyncManager extends BaseSyncManager {
  private config: WebDAVConfig | null = null;
  private webdavClient: WebDAVClient | null = null;
  private _initialized = false;
  private lastError: string | null = null;

  /**
   * 获取服务名称（用于日志标识）
   */
  getServiceName(): string {
    return 'WebDAV';
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this._initialized && this.client !== null;
  }

  getLastError(): string | null {
    return this.lastError || this.webdavClient?.getLastError() || null;
  }

  /**
   * 初始化同步管理器
   * @param config - WebDAV 配置对象
   * @param skipConnectionTest - 跳过连接测试（用于已验证过的连接）
   * @returns 初始化是否成功
   */
  async initialize(
    config: WebDAVConfig,
    skipConnectionTest = false
  ): Promise<boolean> {
    // 如果已初始化且配置相同，直接返回
    if (this._initialized && this.config?.url === config.url) {
      return true;
    }

    try {
      this.lastError = null;

      if (!config?.url || !config.username || !config.password) {
        throw new Error('WebDAV 配置缺少必要字段');
      }

      this.config = config;
      this.webdavClient = new WebDAVClient(config);
      this.client = this.webdavClient;
      this.deviceId = await this.getOrCreateDeviceId();

      console.warn(`📱 [WebDAV] 设备 ID: ${this.deviceId}`);

      const metadataManager = new MetadataManager(
        this.webdavClient,
        this.deviceId
      );
      this.metadataManager = new WebDAVMetadataManagerAdapter(metadataManager);

      // 仅在需要时测试连接
      if (!skipConnectionTest) {
        console.warn(`🔗 [WebDAV] 正在测试连接到 ${config.url}...`);
        const connected = await this.webdavClient.testConnection();
        if (!connected) {
          throw new Error(
            this.webdavClient.getLastError() || '无法连接到 WebDAV 服务'
          );
        }
        console.warn(`✅ [WebDAV] 连接成功`);
      }

      this._initialized = true;
      return true;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      console.error('❌ WebDAV 初始化失败:', error);
      this.config = null;
      this.webdavClient = null;
      this.client = null;
      this.metadataManager = null;
      this._initialized = false;
      return false;
    }
  }
}
