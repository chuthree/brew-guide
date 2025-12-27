/**
 * 统一的同步管理器基类
 * S3 和 WebDAV 都继承此类，确保逻辑完全一致
 *
 * 当前仅支持强制上传/下载模式，不支持增量同步
 */

import { Storage } from '@/lib/core/storage';
import {
  createFilesMetadataFromData,
  generateDeviceId,
  safeJsonParse,
} from '@/lib/s3/utils';

import type {
  SyncResult,
  SyncMetadataV2,
  FileMetadata,
  SyncOptions,
  BackupRecord,
} from '@/lib/s3/types';
import { BackupManager } from './BackupManager';

/**
 * 存储客户端接口 - S3 和 WebDAV 客户端都需要实现这个接口
 */
export interface IStorageClient {
  testConnection(): Promise<boolean>;
  uploadFile(
    key: string,
    content: string
  ): Promise<boolean | { success: false; error: string }>;
  downloadFile(key: string): Promise<string | null>;
  deleteFile(key: string): Promise<boolean>;
  fileExists(key: string): Promise<boolean>;
  listFilesSimple(
    prefix: string
  ): Promise<{ key: string; lastModified?: Date }[]>;
  copyFile(source: string, destination: string): Promise<boolean>;
}

/**
 * 元数据管理器接口
 */
export interface IMetadataManager {
  getRemoteMetadata(): Promise<SyncMetadataV2 | null>;
  getLocalMetadata(): Promise<SyncMetadataV2 | null>;
  saveLocalMetadata(metadata: SyncMetadataV2): Promise<void>;
  saveRemoteMetadata(metadata: SyncMetadataV2): Promise<void>;
}

/**
 * 同步管理器基类
 */
export abstract class BaseSyncManager {
  protected client: IStorageClient | null = null;
  protected metadataManager: IMetadataManager | null = null;
  protected syncInProgress = false;
  protected deviceId: string = '';
  private backupManager: BackupManager | null = null;

  /**
   * 子类需要实现：初始化客户端和元数据管理器
   */
  abstract initialize(config: unknown): Promise<boolean>;

  /**
   * 子类需要实现：获取服务名称（用于日志）
   */
  abstract getServiceName(): string;

  /**
   * 获取备份管理器（延迟初始化）
   */
  private getBackupManager(): BackupManager {
    if (!this.backupManager) {
      this.backupManager = new BackupManager(this.getServiceName());
    }
    return this.backupManager;
  }

  /**
   * 执行同步（仅支持强制上传/下载）
   */
  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    if (this.syncInProgress) {
      return this.createErrorResult('同步正在进行中', [
        '同步正在进行中，请稍后再试',
      ]);
    }

    if (!this.client || !this.metadataManager) {
      return this.createErrorResult('同步管理器未初始化', [
        `${this.getServiceName()} 同步管理器未正确初始化`,
      ]);
    }

    this.syncInProgress = true;
    const debugLogs: string[] = [];
    const addLog = (msg: string) => {
      debugLogs.push(`[${new Date().toISOString()}] ${msg}`);
      console.warn(`📝 [${this.getServiceName()}] ${msg}`);
    };

    const result: SyncResult = {
      success: false,
      message: '',
      uploadedFiles: 0,
      downloadedFiles: 0,
      errors: [],
      debugLogs: [],
    };

    try {
      addLog(`开始同步，方向: ${options.preferredDirection || 'auto'}`);

      // 获取远程元数据（用于备份历史）
      const remoteMetadata = await this.metadataManager.getRemoteMetadata();

      if (options.preferredDirection === 'upload') {
        await this.performUpload(result, options, remoteMetadata, addLog);
      } else if (options.preferredDirection === 'download') {
        await this.performDownload(result, remoteMetadata, addLog);
      } else {
        result.message = '请指定同步方向（上传或下载）';
        result.errors.push('未指定同步方向');
      }

      result.debugLogs = debugLogs;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      addLog(`同步异常: ${errorMsg}`);
      result.errors.push(`同步失败: ${errorMsg}`);
      result.message = '同步失败';
      result.debugLogs = debugLogs;
    } finally {
      this.syncInProgress = false;
    }

    return result;
  }

  /**
   * 执行上传
   */
  private async performUpload(
    result: SyncResult,
    _options: SyncOptions,
    remoteMetadata: SyncMetadataV2 | null,
    addLog: (msg: string) => void
  ): Promise<void> {
    addLog('执行强制上传');

    // 获取本地数据
    const content = await this.getFileContent('brew-guide-data.json');
    if (!content) {
      result.message = '上传失败：本地没有可上传的数据';
      result.errors.push('获取本地数据失败');
      return;
    }

    const { calculateHash } = await import('@/lib/s3/utils');
    const hash = await calculateHash(content);

    // 1. 先上传主文件
    addLog('正在上传主文件...');
    const uploadResult = await this.client!.uploadFile(
      'brew-guide-data.json',
      content
    );
    if (uploadResult !== true) {
      const errorDetail =
        typeof uploadResult === 'object' ? uploadResult.error : '未知错误';
      result.errors.push(`上传失败: ${errorDetail}`);
      result.message = '上传失败';
      return;
    }
    result.uploadedFiles = 1;
    addLog('主文件上传成功');

    // 2. 通过服务器端复制创建备份（不消耗客户端带宽）
    addLog('正在创建备份（服务器端复制）...');
    const lastBackupHash = remoteMetadata?.backupHistory?.slice(-1)[0]?.hash;
    await this.getBackupManager().performBackupAfterUpload(
      this.client!,
      'brew-guide-data.json',
      hash,
      lastBackupHash
    );

    // 3. 更新元数据
    const localFilesMetadata = await this.getLocalFilesMetadata();
    await this.updateMetadataAfterSync(localFilesMetadata);
    addLog('元数据更新完成');

    result.success = true;
    result.message = `已上传 ${result.uploadedFiles} 个文件`;
  }

  /**
   * 执行下载
   */
  private async performDownload(
    result: SyncResult,
    remoteMetadata: SyncMetadataV2 | null,
    addLog: (msg: string) => void
  ): Promise<void> {
    addLog('执行强制下载');

    if (!remoteMetadata || Object.keys(remoteMetadata.files).length === 0) {
      result.message = '下载失败：云端没有数据';
      result.success = false;
      return;
    }

    // 下载文件
    for (const [key] of Object.entries(remoteMetadata.files)) {
      try {
        addLog(`正在下载: ${key}`);
        const content = await this.client!.downloadFile(key);
        if (!content) {
          result.errors.push(`下载 ${key} 失败`);
          continue;
        }
        await this.saveFileContent(key, content);
        result.downloadedFiles++;
        addLog(`下载成功: ${key}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`下载 ${key} 失败: ${errorMsg}`);
      }
    }

    // 更新元数据
    await this.updateMetadataAfterSync(remoteMetadata.files);
    addLog('元数据更新完成');

    result.success = result.errors.length === 0;
    result.message = `已下载 ${result.downloadedFiles} 个文件`;
  }

  /**
   * 更新同步后的元数据
   */
  private async updateMetadataAfterSync(
    files: Record<string, FileMetadata>
  ): Promise<void> {
    if (!this.metadataManager) return;

    try {
      const metadata: SyncMetadataV2 = {
        version: '2.0.0',
        lastSyncTime: Date.now(),
        deviceId: this.deviceId,
        files,
        deletedFiles: [],
      };

      await this.metadataManager.saveLocalMetadata(metadata);
      await this.metadataManager.saveRemoteMetadata(metadata);
    } catch (error) {
      console.error(`❌ [${this.getServiceName()}] 更新元数据失败:`, error);
    }
  }

  /**
   * 获取本地文件元数据
   */
  protected async getLocalFilesMetadata(): Promise<
    Record<string, FileMetadata>
  > {
    try {
      const { DataManager } = await import('@/lib/core/dataManager');
      const fullExportString = await DataManager.exportAllData();
      const exportDataObj = safeJsonParse(fullExportString, {});
      const dataMap: Record<string, unknown> = {
        'brew-guide-data.json': exportDataObj,
      };
      return await createFilesMetadataFromData(dataMap);
    } catch (error) {
      console.error(`${this.getServiceName()} 获取本地文件元数据失败:`, error);
      return {};
    }
  }

  /**
   * 获取文件内容
   */
  protected async getFileContent(key: string): Promise<string | null> {
    try {
      if (key === 'brew-guide-data.json' || key === 'brew-guide-data') {
        const { DataManager } = await import('@/lib/core/dataManager');
        return await DataManager.exportAllData();
      }
      return await Storage.get(key);
    } catch (error) {
      console.error(`获取文件 ${key} 内容失败:`, error);
      return null;
    }
  }

  /**
   * 保存文件内容
   */
  protected async saveFileContent(key: string, content: string): Promise<void> {
    if (key === 'brew-guide-data.json' || key === 'brew-guide-data') {
      const { DataManager } = await import('@/lib/core/dataManager');
      await DataManager.importAllData(content);
    } else {
      await Storage.set(key, content);
    }
  }

  /**
   * 获取或创建设备 ID
   */
  protected async getOrCreateDeviceId(): Promise<string> {
    let deviceId = await Storage.get('device-id');
    if (!deviceId) {
      deviceId = await generateDeviceId();
      await Storage.set('device-id', deviceId);
    }
    return deviceId;
  }

  /**
   * 创建错误结果
   */
  private createErrorResult(message: string, errors: string[]): SyncResult {
    return {
      success: false,
      message,
      uploadedFiles: 0,
      downloadedFiles: 0,
      errors,
    };
  }

  /**
   * 获取最后同步时间
   */
  async getLastSyncTime(): Promise<Date | null> {
    if (!this.metadataManager) return null;
    const metadata = await this.metadataManager.getLocalMetadata();
    return metadata?.lastSyncTime ? new Date(metadata.lastSyncTime) : null;
  }

  /**
   * 检查同步状态
   */
  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  /**
   * 获取可用备份列表（直接从服务器扫描）
   */
  async listBackups(): Promise<BackupRecord[]> {
    if (!this.client) return [];
    return this.getBackupManager().listBackupsFromServer(this.client);
  }

  /**
   * 从备份恢复数据
   */
  async restoreFromBackup(backupKey: string): Promise<boolean> {
    if (!this.client) {
      console.error(`❌ [${this.getServiceName()}] 恢复失败：客户端未初始化`);
      return false;
    }

    const content = await this.getBackupManager().restoreBackup(
      this.client,
      backupKey
    );
    if (!content) return false;

    try {
      await this.saveFileContent('brew-guide-data.json', content);
      console.warn(
        `✅ [${this.getServiceName()}] 数据已从备份恢复: ${backupKey}`
      );
      return true;
    } catch (error) {
      console.error(`❌ [${this.getServiceName()}] 恢复数据失败:`, error);
      return false;
    }
  }
}
