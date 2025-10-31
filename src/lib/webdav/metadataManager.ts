/**
 * WebDAV 元数据管理器
 * 负责管理同步元数据的读取和保存
 * 复用 S3 的三路合并逻辑
 */

import type { SyncMetadataV2 } from './types';
import { Storage } from '@/lib/core/storage';
import WebDAVClient from './webdavClient';
import { safeJsonParse } from './utils';

const METADATA_KEY = 'webdav-sync-metadata';
const METADATA_REMOTE_KEY = 'sync-metadata.json';

export class MetadataManager {
  private client: WebDAVClient;
  private deviceId: string;

  constructor(client: WebDAVClient, deviceId: string) {
    this.client = client;
    this.deviceId = deviceId;
  }

  /**
   * 获取本地元数据（上次同步时的本地状态）
   */
  async getLocalMetadata(): Promise<SyncMetadataV2 | null> {
    try {
      const metadataStr = await Storage.get(METADATA_KEY);
      if (!metadataStr) {
        return null;
      }

      const metadata = safeJsonParse<SyncMetadataV2 | null>(metadataStr, null);

      // 验证元数据格式
      if (
        !metadata ||
        !metadata.version ||
        !metadata.files ||
        typeof metadata.files !== 'object'
      ) {
        console.warn('本地元数据格式无效，将被忽略');
        return null;
      }

      return metadata;
    } catch (error) {
      console.error('获取本地元数据失败:', error);
      return null;
    }
  }

  /**
   * 获取远程元数据
   */
  async getRemoteMetadata(): Promise<SyncMetadataV2 | null> {
    try {
      // 检查文件是否存在
      const exists = await this.client.fileExists(METADATA_REMOTE_KEY);
      if (!exists) {
        console.log('远程元数据文件不存在，可能是首次同步');
        return null;
      }

      // 下载元数据文件
      const content = await this.client.downloadFile(METADATA_REMOTE_KEY);
      if (!content) {
        console.warn('远程元数据文件为空');
        return null;
      }

      const metadata = safeJsonParse<SyncMetadataV2 | null>(content, null);

      // 验证元数据格式
      if (
        !metadata ||
        !metadata.version ||
        !metadata.files ||
        typeof metadata.files !== 'object'
      ) {
        console.warn('远程元数据格式无效，将被忽略');
        return null;
      }

      return metadata;
    } catch (error) {
      console.error('获取远程元数据失败:', error);
      return null;
    }
  }

  /**
   * 保存本地元数据
   */
  async saveLocalMetadata(metadata: SyncMetadataV2): Promise<void> {
    try {
      await Storage.set(METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error('保存本地元数据失败:', error);
      throw error;
    }
  }

  /**
   * 保存远程元数据
   */
  async saveRemoteMetadata(metadata: SyncMetadataV2): Promise<void> {
    try {
      const content = JSON.stringify(metadata, null, 2);
      const success = await this.client.uploadFile(
        METADATA_REMOTE_KEY,
        content
      );

      if (!success) {
        throw new Error('上传元数据失败');
      }
    } catch (error) {
      console.error('保存远程元数据失败:', error);
      throw error;
    }
  }

  /**
   * 创建新的元数据对象
   */
  createMetadata(files: SyncMetadataV2['files']): SyncMetadataV2 {
    return {
      version: '2.0.0',
      lastSyncTime: Date.now(),
      deviceId: this.deviceId,
      files,
      deletedFiles: [],
    };
  }

  /**
   * 清除本地元数据
   */
  async clearLocalMetadata(): Promise<void> {
    try {
      await Storage.remove(METADATA_KEY);
    } catch (error) {
      console.error('清除本地元数据失败:', error);
    }
  }
}

export default MetadataManager;
