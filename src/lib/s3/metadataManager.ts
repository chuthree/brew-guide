/**
 * 同步元数据管理器
 * 负责本地和远程元数据的读取、更新和版本迁移
 */

import { Storage } from '@/lib/core/storage';
import type { S3Client } from './s3Client';
import type {
  SyncMetadata,
  SyncMetadataV1,
  SyncMetadataV2,
  FileMetadata,
} from './types';
import { safeJsonParse } from './utils';

const METADATA_KEY = 's3-sync-metadata';
const METADATA_REMOTE_KEY = 'sync-metadata.json';

export class MetadataManager {
  constructor(private client: S3Client | null) {}

  /**
   * 获取本地元数据
   */
  async getLocalMetadata(): Promise<SyncMetadataV2 | null> {
    try {
      const stored = await Storage.get(METADATA_KEY);
      if (!stored) return null;

      const metadata = safeJsonParse<SyncMetadata | null>(stored, null);
      if (!metadata) return null;

      // 如果是旧版本，迁移到新版本
      if (this.isV1Metadata(metadata)) {
        return this.migrateV1ToV2(metadata);
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
    if (!this.client) return null;

    try {
      const content = await this.client.downloadFile(METADATA_REMOTE_KEY);
      if (!content) return null;

      const metadata = safeJsonParse<SyncMetadata | null>(content, null);
      if (!metadata) return null;

      // 🔍 临时启用详细日志用于调试
      console.warn('📥 远程元数据详情:', {
        版本: 'version' in metadata ? metadata.version : 'V1',
        最后同步: new Date(metadata.lastSyncTime).toLocaleString(),
        设备ID: metadata.deviceId,
        文件数:
          'files' in metadata && typeof metadata.files === 'object'
            ? Object.keys(metadata.files).length
            : Array.isArray(metadata.files)
              ? metadata.files.length
              : 0,
        文件列表:
          'files' in metadata && typeof metadata.files === 'object'
            ? Object.keys(metadata.files)
            : metadata.files,
      });

      // 如果是旧版本，迁移到新版本
      if (this.isV1Metadata(metadata)) {
        const migrated = this.migrateV1ToV2(metadata);
        console.warn('📦 V1→V2 迁移完成:', {
          迁移后文件: Object.keys(migrated.files),
        });
        return migrated;
      }

      return metadata;
    } catch (error) {
      console.warn('获取远程元数据失败:', error);
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
    if (!this.client) {
      throw new Error('S3 客户端未初始化');
    }

    try {
      const content = JSON.stringify(metadata, null, 2);
      const uploadResult = await this.client.uploadFile(
        METADATA_REMOTE_KEY,
        content
      );

      // 处理新的返回格式：boolean 或 { success: false; error: string }
      const success = uploadResult === true;
      const errorDetail =
        typeof uploadResult === 'object' && uploadResult.error
          ? uploadResult.error
          : null;

      if (!success) {
        throw new Error(errorDetail || '上传元数据失败');
      }
    } catch (error) {
      console.error('保存远程元数据失败:', error);
      throw error;
    }
  }

  /**
   * 判断是否为 V1 版本元数据
   */
  private isV1Metadata(metadata: SyncMetadata): metadata is SyncMetadataV1 {
    return (
      !metadata.version ||
      metadata.version === '1.0.0' ||
      ('dataHash' in metadata && typeof metadata.dataHash === 'string')
    );
  }

  /**
   * 将 V1 元数据迁移到 V2
   */
  private migrateV1ToV2(v1: SyncMetadataV1): SyncMetadataV2 {
    const files: Record<string, FileMetadata> = {};

    // 如果 V1 有文件列表，尝试转换
    if (v1.files && Array.isArray(v1.files)) {
      v1.files.forEach(fileName => {
        const key = fileName.replace(/\.json$/i, '');
        files[key] = {
          key,
          size: 0, // V1 不记录大小
          mtimeCli: v1.lastSyncTime, // 使用同步时间作为修改时间
          hash: v1.dataHash || '', // 使用整体哈希或空字符串
          syncedAt: v1.lastSyncTime,
        };
      });
    }

    return {
      version: '2.0.0',
      lastSyncTime: v1.lastSyncTime,
      deviceId: v1.deviceId,
      files,
      deletedFiles: [],
    };
  }
}
