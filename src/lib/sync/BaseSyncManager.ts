/**
 * 统一的同步管理器基类
 * S3 和 WebDAV 都继承此类，确保逻辑完全一致
 */

import { Storage } from '@/lib/core/storage';
import { SyncPlanner } from '@/lib/s3/syncPlanner';
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
  SyncPlan,
  ConflictStrategy,
} from '@/lib/s3/types';

/**
 * 存储客户端接口 - S3 和 WebDAV 客户端都需要实现这个接口
 */
export interface IStorageClient {
  testConnection(): Promise<boolean>;
  uploadFile(key: string, content: string): Promise<boolean>;
  downloadFile(key: string): Promise<string | null>;
  deleteFile(key: string): Promise<boolean>;
  fileExists(key: string): Promise<boolean>;
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
  protected syncPlanner: SyncPlanner;
  protected syncInProgress = false;
  protected deviceId: string = '';

  // 缓存机制 - 避免重复获取元数据
  private remoteMetadataCache: {
    data: SyncMetadataV2 | null;
    timestamp: number;
  } | null = null;
  private localMetadataCache: {
    data: SyncMetadataV2 | null;
    timestamp: number;
  } | null = null;
  private readonly METADATA_CACHE_TTL = 5000; // 5秒缓存有效期

  constructor() {
    this.syncPlanner = new SyncPlanner();
  }

  /**
   * 子类需要实现：初始化客户端和元数据管理器
   */
  abstract initialize(config: unknown): Promise<boolean>;

  /**
   * 子类需要实现：获取服务名称（用于日志）
   */
  abstract getServiceName(): string;

  /**
   * 获取远程元数据（带缓存）
   * @param useCache - 是否使用缓存，false时强制刷新
   * @returns 远程元数据或null
   */
  private async getCachedRemoteMetadata(
    useCache = true
  ): Promise<SyncMetadataV2 | null> {
    if (!this.metadataManager) {
      console.warn(`⚠️ [${this.getServiceName()}] metadataManager未初始化`);
      return null;
    }

    const now = Date.now();

    // 如果缓存有效，直接返回
    if (
      useCache &&
      this.remoteMetadataCache &&
      now - this.remoteMetadataCache.timestamp < this.METADATA_CACHE_TTL
    ) {
      console.log(`📦 [${this.getServiceName()}] 使用远程元数据缓存`);
      return this.remoteMetadataCache.data;
    }

    // 获取新数据并缓存
    try {
      const data = await this.metadataManager.getRemoteMetadata();
      this.remoteMetadataCache = { data, timestamp: now };
      return data;
    } catch (error) {
      console.error(`❌ [${this.getServiceName()}] 获取远程元数据失败:`, error);
      // 缓存失效时返回null而不是抛出异常
      this.remoteMetadataCache = null;
      return null;
    }
  }

  /**
   * 获取本地元数据（带缓存）
   * @param useCache - 是否使用缓存，false时强制刷新
   * @returns 本地元数据或null
   */
  private async getCachedLocalMetadata(
    useCache = true
  ): Promise<SyncMetadataV2 | null> {
    if (!this.metadataManager) {
      console.warn(`⚠️ [${this.getServiceName()}] metadataManager未初始化`);
      return null;
    }

    const now = Date.now();

    // 如果缓存有效，直接返回
    if (
      useCache &&
      this.localMetadataCache &&
      now - this.localMetadataCache.timestamp < this.METADATA_CACHE_TTL
    ) {
      console.log(`📦 [${this.getServiceName()}] 使用本地元数据缓存`);
      return this.localMetadataCache.data;
    }

    // 获取新数据并缓存
    try {
      const data = await this.metadataManager.getLocalMetadata();
      this.localMetadataCache = { data, timestamp: now };
      return data;
    } catch (error) {
      console.error(`❌ [${this.getServiceName()}] 获取本地元数据失败:`, error);
      // 缓存失效时返回null而不是抛出异常
      this.localMetadataCache = null;
      return null;
    }
  }

  /**
   * 清除元数据缓存
   * 在同步开始/完成/失败时调用，确保数据一致性
   */
  private clearMetadataCache(): void {
    console.log(`🧹 [${this.getServiceName()}] 清除元数据缓存`);
    this.remoteMetadataCache = null;
    this.localMetadataCache = null;
  }

  /**
   * 检查是否需要同步
   */
  async needsSync(): Promise<boolean> {
    try {
      if (!this.metadataManager) return false;

      const localFilesMetadata = await this.getLocalFilesMetadata();
      const remoteMetadata = await this.getCachedRemoteMetadata();

      if (!remoteMetadata) {
        console.log(
          `🔍 [${this.getServiceName()} needsSync] 没有远程元数据，需要同步`
        );
        return true;
      }

      const baseMetadata = await this.getCachedLocalMetadata();

      console.log(`🔍 [${this.getServiceName()} needsSync] 元数据状态:`, {
        本地文件数: Object.keys(localFilesMetadata).length,
        远程文件数: Object.keys(remoteMetadata.files).length,
        基准文件数: baseMetadata ? Object.keys(baseMetadata.files).length : 0,
        有基准元数据: !!baseMetadata,
        基准最后同步: baseMetadata?.lastSyncTime
          ? new Date(baseMetadata.lastSyncTime).toLocaleString('zh-CN')
          : '无',
      });

      const plan = this.syncPlanner.calculateSyncPlan(
        localFilesMetadata,
        remoteMetadata,
        baseMetadata
      );

      const needSync =
        plan.upload.length > 0 ||
        plan.download.length > 0 ||
        plan.deleteLocal.length > 0 ||
        plan.deleteRemote.length > 0 ||
        plan.conflicts.length > 0;

      console.log(`🔍 [${this.getServiceName()} needsSync] 同步计划:`, {
        需要同步: needSync,
        上传: plan.upload.length,
        下载: plan.download.length,
        本地删除: plan.deleteLocal.length,
        远程删除: plan.deleteRemote.length,
        冲突: plan.conflicts.length,
      });

      return needSync;
    } catch (error) {
      console.error(`${this.getServiceName()} 检查同步状态时出错:`, error);
      return false;
    }
  }

  /**
   * 获取同步方向和计划（不执行同步）
   */
  async getSyncDirection(): Promise<{
    needsSync: boolean;
    direction: 'upload' | 'download' | 'both' | null;
    plan?: SyncPlan;
  }> {
    try {
      if (!this.metadataManager) {
        return { needsSync: false, direction: null };
      }

      const localFilesMetadata = await this.getLocalFilesMetadata();
      const remoteMetadata = await this.getCachedRemoteMetadata();

      if (!remoteMetadata) {
        return { needsSync: true, direction: 'upload' };
      }

      const baseMetadata = await this.getCachedLocalMetadata();

      const plan = this.syncPlanner.calculateSyncPlan(
        localFilesMetadata,
        remoteMetadata,
        baseMetadata
      );

      const hasUploads = plan.upload.length > 0 || plan.deleteRemote.length > 0;
      const hasDownloads =
        plan.download.length > 0 || plan.deleteLocal.length > 0;
      const needsSync = hasUploads || hasDownloads || plan.conflicts.length > 0;

      let direction: 'upload' | 'download' | 'both' | null = null;
      if (hasUploads && hasDownloads) {
        direction = 'both';
      } else if (hasUploads) {
        direction = 'upload';
      } else if (hasDownloads) {
        direction = 'download';
      }

      return { needsSync, direction, plan };
    } catch (error) {
      console.error(`${this.getServiceName()} 获取同步方向时出错:`, error);
      return { needsSync: false, direction: null };
    }
  }

  /**
   * 执行同步
   */
  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        message: '同步正在进行中',
        uploadedFiles: 0,
        downloadedFiles: 0,
        errors: ['同步正在进行中，请稍后再试'],
      };
    }

    if (!this.client || !this.metadataManager) {
      return {
        success: false,
        message: '同步管理器未初始化',
        uploadedFiles: 0,
        downloadedFiles: 0,
        errors: [`${this.getServiceName()} 同步管理器未正确初始化`],
      };
    }

    this.syncInProgress = true;
    const startTime = Date.now();

    // 🔧 清除缓存，确保同步使用最新数据
    this.clearMetadataCache();

    const result: SyncResult = {
      success: false,
      message: '',
      uploadedFiles: 0,
      downloadedFiles: 0,
      deletedFiles: 0,
      errors: [],
      warnings: [],
    };

    try {
      options.onProgress?.({
        phase: 'preparing',
        completed: 0,
        total: 100,
        percentage: 0,
        message: '正在准备同步...',
      });

      // 1. 获取本地文件元数据
      const localFilesMetadata = await this.getLocalFilesMetadata();

      options.onProgress?.({
        phase: 'preparing',
        completed: 20,
        total: 100,
        percentage: 20,
        message: '正在扫描本地文件...',
      });

      // 2. 获取远程元数据（不使用缓存）
      const remoteMetadata = await this.getCachedRemoteMetadata(false);

      options.onProgress?.({
        phase: 'preparing',
        completed: 40,
        total: 100,
        percentage: 40,
        message: '正在获取远程数据...',
      });

      // 3. 获取基准元数据（不使用缓存）
      const baseMetadata = await this.getCachedLocalMetadata(false);

      console.log(`📊 ${this.getServiceName()} 同步状态:`, {
        本地文件数: Object.keys(localFilesMetadata).length,
        远程文件数: remoteMetadata
          ? Object.keys(remoteMetadata.files).length
          : 0,
        有基准元数据: !!baseMetadata,
      });

      // 4. 如果指定了同步方向，直接执行
      if (options.preferredDirection === 'upload') {
        console.log(
          `⬆️ [${this.getServiceName()}] 执行强制上传，文件数: ${Object.keys(localFilesMetadata).length}`
        );
        await this.uploadAllFiles(localFilesMetadata, result, options);
        await this.updateMetadataAfterSync(localFilesMetadata);
        result.message = `已上传 ${result.uploadedFiles} 个文件`;
        result.success = result.errors.length === 0;
        return result;
      }

      if (options.preferredDirection === 'download') {
        console.log(`⬇️ [${this.getServiceName()}] 执行强制下载`);
        if (remoteMetadata) {
          console.log(
            `⬇️ [${this.getServiceName()}] 远程文件数: ${Object.keys(remoteMetadata.files).length}`
          );
          await this.downloadAllFiles(remoteMetadata.files, result, options);
          await this.updateMetadataAfterSync(remoteMetadata.files);
          result.message = `已下载 ${result.downloadedFiles} 个文件`;
          result.success = result.errors.length === 0;
          return result;
        } else {
          console.warn(
            `⚠️ [${this.getServiceName()}] 下载失败：没有远程元数据`
          );
          result.message = '下载失败：云端没有数据';
          result.success = false;
          return result;
        }
      }

      // 5. 计算同步计划
      options.onProgress?.({
        phase: 'preparing',
        completed: 60,
        total: 100,
        percentage: 60,
        message: '正在计算同步计划...',
      });

      const plan = this.syncPlanner.calculateSyncPlan(
        localFilesMetadata,
        remoteMetadata,
        baseMetadata
      );

      const summary = this.syncPlanner.generatePlanSummary(plan);

      console.log('📋 同步计划:', {
        上传: plan.upload.length,
        下载: plan.download.length,
        冲突: plan.conflicts.length,
        摘要: summary,
      });

      // 6. 检查冲突
      if (
        plan.conflicts.length > 0 &&
        options.conflictStrategy === ('manual' as ConflictStrategy)
      ) {
        result.conflict = true;
        result.plan = plan;
        result.remoteMetadata = remoteMetadata;
        result.message = `发现 ${plan.conflicts.length} 个冲突，需要手动解决`;
        result.warnings?.push(result.message);
        return result;
      }

      // 7. 如果没有任何操作需要执行，但仍需更新元数据
      // 🔧 关键修复：即使没有操作，也要更新本地元数据
      if (
        plan.upload.length === 0 &&
        plan.download.length === 0 &&
        plan.deleteLocal.length === 0 &&
        plan.deleteRemote.length === 0 &&
        plan.conflicts.length === 0
      ) {
        await this.updateMetadataAfterSync(localFilesMetadata);
        result.success = true;
        result.message = '数据已是最新，无需同步';
        return result;
      }

      // 8. 干运行模式
      if (options.dryRun) {
        result.plan = plan;
        result.message = `同步预览: ${summary}`;
        result.success = true;
        return result;
      }

      // 9. 执行同步计划
      await this.executeSyncPlan(plan, result, options);

      // 10. 更新元数据
      options.onProgress?.({
        phase: 'finalizing',
        completed: 95,
        total: 100,
        percentage: 95,
        message: '正在更新元数据...',
      });

      // 🔧 关键修复：同步后重新获取本地文件元数据
      const updatedLocalFiles = await this.getLocalFilesMetadata();
      await this.updateMetadataAfterSync(updatedLocalFiles);

      // 清除元数据缓存，确保下次同步使用最新数据
      this.clearMetadataCache();

      // 11. 生成结果
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      result.success = result.errors.length === 0;
      result.message = result.success
        ? `同步完成 (${duration}s): ${summary}`
        : `同步部分完成，遇到 ${result.errors.length} 个错误`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      result.errors.push(`同步失败: ${errorMessage}`);
      result.message = '同步失败';
      console.error(`\n❌ ${this.getServiceName()} 同步过程中发生错误:`, error);

      // 错误情况也要清除缓存
      this.clearMetadataCache();
    } finally {
      this.syncInProgress = false;
    }

    return result;
  }

  /**
   * 获取本地文件元数据
   * 🔧 关键修复：排除动态字段后再计算哈希
   */
  protected async getLocalFilesMetadata(): Promise<
    Record<string, FileMetadata>
  > {
    try {
      // 使用 DataManager 导出完整数据
      const { DataManager } = await import('@/lib/core/dataManager');
      const fullExportString = await DataManager.exportAllData();
      const exportDataObj = safeJsonParse(fullExportString, {});

      // 构建数据映射
      const dataMap: Record<string, unknown> = {
        'brew-guide-data.json': exportDataObj,
      };

      // 创建文件元数据（会自动排除动态字段）
      const filesMetadata = await createFilesMetadataFromData(dataMap);

      return filesMetadata;
    } catch (error) {
      console.error(`${this.getServiceName()} 获取本地文件元数据失败:`, error);
      return {};
    }
  }

  /**
   * 上传所有本地文件
   * @throws 不抛出异常，错误记录在result中
   */
  protected async uploadAllFiles(
    localFiles: Record<string, FileMetadata>,
    result: SyncResult,
    options: SyncOptions = {}
  ): Promise<void> {
    if (!this.client) {
      result.errors.push('客户端未初始化');
      return;
    }

    const files = Object.entries(localFiles);
    const totalFiles = files.length;
    let completedFiles = 0;

    for (const [key, metadata] of files) {
      try {
        const content = await this.getFileContent(key);
        if (!content) {
          result.errors.push(`获取 ${key} 内容失败`);
          completedFiles++;
          continue;
        }

        options.onProgress?.({
          phase: 'uploading',
          completed: completedFiles,
          total: totalFiles,
          percentage: Math.round((completedFiles / totalFiles) * 100),
          message: `正在上传数据...`,
        });

        const success = await this.client.uploadFile(key, content);
        if (success) {
          result.uploadedFiles = (result.uploadedFiles || 0) + 1;
          console.log(`✅ [${this.getServiceName()}] 上传成功: ${key}`);
        } else {
          result.errors.push(`上传 ${key} 失败`);
          console.error(`❌ [${this.getServiceName()}] 上传失败: ${key}`);
        }

        completedFiles++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`上传 ${key} 时出错: ${errorMsg}`);
        console.error(`❌ [${this.getServiceName()}] 上传 ${key} 失败:`, error);
        completedFiles++;
      }
    }
  }

  /**
   * 下载所有远程文件
   * @throws 不抛出异常，错误记录在result中
   */
  protected async downloadAllFiles(
    remoteFiles: Record<string, FileMetadata>,
    result: SyncResult,
    options: SyncOptions = {}
  ): Promise<void> {
    if (!this.client) {
      result.errors.push('客户端未初始化');
      return;
    }

    const files = Object.entries(remoteFiles);
    const totalFiles = files.length;
    let completedFiles = 0;

    for (const [key, metadata] of files) {
      try {
        options.onProgress?.({
          phase: 'downloading',
          completed: completedFiles,
          total: totalFiles,
          percentage: Math.round((completedFiles / totalFiles) * 100),
          message: `正在下载数据...`,
        });

        const content = await this.client.downloadFile(key);
        if (!content) {
          result.errors.push(`下载 ${key} 失败`);
          console.error(`❌ [${this.getServiceName()}] 下载失败: ${key}`);
          completedFiles++;
          continue;
        }

        await this.saveFileContent(key, content);
        result.downloadedFiles = (result.downloadedFiles || 0) + 1;
        console.log(`✅ [${this.getServiceName()}] 下载成功: ${key}`);

        completedFiles++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`下载 ${key} 时出错: ${errorMsg}`);
        console.error(`❌ [${this.getServiceName()}] 下载 ${key} 失败:`, error);
        completedFiles++;
      }
    }
  }

  /**
   * 执行同步计划
   * @throws 不抛出异常，错误记录在result中
   */
  protected async executeSyncPlan(
    plan: SyncPlan,
    result: SyncResult,
    options: SyncOptions
  ): Promise<void> {
    if (!this.client) {
      result.errors.push('客户端未初始化');
      return;
    }

    const totalOperations =
      plan.upload.length +
      plan.download.length +
      plan.deleteLocal.length +
      plan.deleteRemote.length;
    let completedOperations = 0;

    // 1. 上传文件
    for (const file of plan.upload) {
      try {
        const content = await this.getFileContent(file.key);
        if (!content) {
          result.errors.push(`获取 ${file.key} 内容失败`);
          completedOperations++;
          continue;
        }

        const success = await this.client.uploadFile(file.key, content);
        if (success) {
          result.uploadedFiles = (result.uploadedFiles || 0) + 1;
        } else {
          result.errors.push(`上传 ${file.key} 失败`);
        }

        completedOperations++;
        options.onProgress?.({
          phase: 'uploading',
          completed: completedOperations,
          total: totalOperations,
          percentage: Math.round((completedOperations / totalOperations) * 100),
          message: `正在上传 ${file.key}...`,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`上传 ${file.key} 时出错: ${errorMsg}`);
        console.error(
          `❌ [${this.getServiceName()}] 上传 ${file.key} 失败:`,
          error
        );
        completedOperations++;
      }
    }

    // 2. 下载文件
    for (const file of plan.download) {
      try {
        const content = await this.client.downloadFile(file.key);
        if (!content) {
          result.errors.push(`下载 ${file.key} 失败`);
          completedOperations++;
          continue;
        }

        await this.saveFileContent(file.key, content);
        result.downloadedFiles = (result.downloadedFiles || 0) + 1;

        completedOperations++;
        options.onProgress?.({
          phase: 'downloading',
          completed: completedOperations,
          total: totalOperations,
          percentage: Math.round((completedOperations / totalOperations) * 100),
          message: `正在下载 ${file.key}...`,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`下载 ${file.key} 时出错: ${errorMsg}`);
        console.error(
          `❌ [${this.getServiceName()}] 下载 ${file.key} 失败:`,
          error
        );
        completedOperations++;
      }
    }

    // 3. 删除远程文件
    for (const file of plan.deleteRemote) {
      try {
        const success = await this.client.deleteFile(file.key);
        if (success) {
          result.deletedFiles = (result.deletedFiles || 0) + 1;
        } else {
          result.errors.push(`删除远程 ${file.key} 失败`);
        }
        completedOperations++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`删除远程 ${file.key} 时出错: ${errorMsg}`);
        console.error(
          `❌ [${this.getServiceName()}] 删除远程 ${file.key} 失败:`,
          error
        );
        completedOperations++;
      }
    }

    // 4. 删除本地文件
    for (const file of plan.deleteLocal) {
      try {
        await Storage.remove(file.key);
        result.deletedFiles = (result.deletedFiles || 0) + 1;
        completedOperations++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`删除本地 ${file.key} 时出错: ${errorMsg}`);
        console.error(
          `❌ [${this.getServiceName()}] 删除本地 ${file.key} 失败:`,
          error
        );
        completedOperations++;
      }
    }
  }

  /**
   * 更新同步后的元数据
   * @throws 错误会被记录但不会传播
   */
  protected async updateMetadataAfterSync(
    localFiles: Record<string, FileMetadata>
  ): Promise<void> {
    if (!this.metadataManager) {
      console.warn(
        `⚠️ [${this.getServiceName()}] metadataManager未初始化，跳过元数据更新`
      );
      return;
    }

    try {
      const metadata: SyncMetadataV2 = {
        version: '2.0.0',
        lastSyncTime: Date.now(),
        deviceId: this.deviceId,
        files: localFiles,
        deletedFiles: [],
      };

      await this.metadataManager.saveLocalMetadata(metadata);
      await this.metadataManager.saveRemoteMetadata(metadata);

      console.log(
        `✅ [${this.getServiceName()}] 元数据更新成功，文件数: ${Object.keys(localFiles).length}`
      );
    } catch (error) {
      console.error(`❌ [${this.getServiceName()}] 更新元数据失败:`, error);
      // 不抛出异常，避免影响同步流程
    }
  }

  /**
   * 获取文件内容（用于上传）
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
   * 保存文件内容(下载后)
   */
  protected async saveFileContent(key: string, content: string): Promise<void> {
    try {
      if (key === 'brew-guide-data.json' || key === 'brew-guide-data') {
        const { DataManager } = await import('@/lib/core/dataManager');
        await DataManager.importAllData(content);
      } else {
        await Storage.set(key, content);
      }
    } catch (error) {
      console.error(`保存文件 ${key} 失败:`, error);
      throw error;
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
}
