/**
 * S3 同步管理器 V2
 * 继承 BaseSyncManager，只实现 S3 特定逻辑
 */

import { S3Client, S3Config } from './s3Client';
import { MetadataManager } from './metadataManager';
import { BaseSyncManager, IMetadataManager } from '@/lib/sync/BaseSyncManager';

import type { SyncMetadataV2 } from './types';

/**
 * S3 元数据管理器适配器
 */
class S3MetadataManagerAdapter implements IMetadataManager {
  constructor(private manager: MetadataManager) {}

  async getRemoteMetadata(): Promise<SyncMetadataV2 | null> {
    return await this.manager.getRemoteMetadata();
  }

  async getLocalMetadata(): Promise<SyncMetadataV2 | null> {
    return await this.manager.getLocalMetadata();
  }

  async saveLocalMetadata(metadata: SyncMetadataV2): Promise<void> {
    await this.manager.saveLocalMetadata(metadata);
  }

  async saveRemoteMetadata(metadata: SyncMetadataV2): Promise<void> {
    await this.manager.saveRemoteMetadata(metadata);
  }
}

export class S3SyncManager extends BaseSyncManager {
  private config: S3Config | null = null;
  private s3Client: S3Client | null = null;
  private _initialized = false;

  getServiceName(): string {
    return 'S3';
  }

  isInitialized(): boolean {
    return this._initialized && this.client !== null;
  }

  /**
   * 初始化同步管理器
   */
  async initialize(
    config: S3Config,
    skipConnectionTest = false
  ): Promise<boolean> {
    if (this._initialized && this.config?.bucketName === config.bucketName) {
      return true;
    }

    try {
      this.config = config;
      this.s3Client = new S3Client(config);
      this.client = this.s3Client;
      this.deviceId = await this.getOrCreateDeviceId();

      const metadataManager = new MetadataManager(this.s3Client, this.deviceId);
      this.metadataManager = new S3MetadataManagerAdapter(metadataManager);

      if (!skipConnectionTest) {
        const connected = await this.s3Client.testConnection();
        if (!connected) {
          throw new Error('无法连接到 S3 服务');
        }
      }

      this._initialized = true;
      return true;
    } catch (error) {
      console.error('❌ S3 初始化失败:', error);
      this._initialized = false;
      return false;
    }
  }
}
