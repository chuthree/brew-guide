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

  /**
   * 获取服务名称（用于日志标识）
   */
  getServiceName(): string {
    return 'WebDAV';
  }

  /**
   * 初始化同步管理器
   * @param config - WebDAV 配置对象
   * @returns 初始化是否成功
   */
  async initialize(config: WebDAVConfig): Promise<boolean> {
    try {
      // 参数验证
      if (!config) {
        throw new Error('WebDAV 配置不能为空');
      }

      if (!config.url || !config.username || !config.password) {
        throw new Error('WebDAV 配置缺少必要字段: url, username, password');
      }

      // 保存配置
      this.config = config;

      // 初始化 WebDAV 客户端
      this.webdavClient = new WebDAVClient(config);
      this.client = this.webdavClient;

      // 生成或获取设备 ID
      this.deviceId = await this.getOrCreateDeviceId();

      console.log(`📱 [WebDAV] 设备 ID: ${this.deviceId}`);

      // 初始化元数据管理器
      const metadataManager = new MetadataManager(
        this.webdavClient,
        this.deviceId
      );
      this.metadataManager = new WebDAVMetadataManagerAdapter(metadataManager);

      // 测试连接
      console.log(`🔗 [WebDAV] 正在测试连接到 ${config.url}...`);
      const connected = await this.webdavClient.testConnection();

      if (!connected) {
        throw new Error('无法连接到 WebDAV 服务，请检查配置和网络');
      }

      console.log(`✅ [WebDAV] 连接成功`);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ WebDAV 同步管理器初始化失败:', errorMsg);

      // 清理状态
      this.config = null;
      this.webdavClient = null;
      this.client = null;
      this.metadataManager = null;

      return false;
    }
  }
}
