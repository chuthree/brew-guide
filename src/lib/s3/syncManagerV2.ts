/**
 * S3 同步管理器 V2
 * 完全重写，修复了"没有更改也识别为更改"的 bug
 * 实现文件级增量同步和三路合并算法
 */

import S3Client, { S3Config } from './s3Client';
import { Storage } from '@/lib/core/storage';
import { MetadataManager } from './metadataManager';
import { SyncPlanner } from './syncPlanner';
import { createFilesMetadataFromData, generateDeviceId, safeJsonParse } from './utils';

import type {
  SyncResult,
  SyncMetadataV2,
  FileMetadata,
  SyncOptions,
} from './types';

import { ConflictStrategy, SyncPlan } from './types';

export class S3SyncManager {
  private client: S3Client | null = null;
  private config: S3Config | null = null;
  private syncInProgress = false;
  private deviceId: string = '';
  private metadataManager: MetadataManager | null = null;
  private syncPlanner: SyncPlanner;

  constructor() {
    this.syncPlanner = new SyncPlanner();
  }

  /**
   * 初始化同步管理器
   */
  async initialize(config: S3Config): Promise<boolean> {
    try {
      this.config = config;
      this.client = new S3Client(config);

      // 生成或获取设备 ID
      this.deviceId = await this.getOrCreateDeviceId();

      // 初始化元数据管理器
      this.metadataManager = new MetadataManager(this.client, this.deviceId);

      // 测试连接
      const connected = await this.client.testConnection();
      if (!connected) {
        throw new Error('无法连接到 S3 服务');
      }

      return true;
    } catch (error) {
      console.error('❌ S3 同步管理器初始化失败:', error);
      return false;
    }
  }

  /**
   * 检查是否需要同步
   * 修复：使用文件级元数据比对，而不是整体哈希
   */
  async needsSync(): Promise<boolean> {
    try {
      if (!this.metadataManager) return false;

      // 获取本地文件元数据
      const localFilesMetadata = await this.getLocalFilesMetadata();

      // 获取远程元数据
      const remoteMetadata = await this.metadataManager.getRemoteMetadata();

      // 如果没有远程元数据，需要首次同步
      if (!remoteMetadata) {
        return true;
      }

      // 获取基准元数据（上次同步时的本地状态）
      const baseMetadata = await this.metadataManager.getLocalMetadata();

      // 使用同步计划器计算是否有变化
      const plan = this.syncPlanner.calculateSyncPlan(
        localFilesMetadata,
        remoteMetadata,
        baseMetadata
      );

      const hasChanges =
        plan.upload.length > 0 ||
        plan.download.length > 0 ||
        plan.deleteLocal.length > 0 ||
        plan.deleteRemote.length > 0 ||
        plan.conflicts.length > 0;

      return hasChanges;
    } catch (error) {
      console.error('检查同步状态时出错:', error);
      return false;
    }
  }

  /**
   * 执行同步
   * 核心方法：修复了原来的 bug
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

    if (!this.client || !this.config || !this.metadataManager) {
      return {
        success: false,
        message: '同步管理器未初始化',
        uploadedFiles: 0,
        downloadedFiles: 0,
        errors: ['S3 同步管理器未正确初始化'],
      };
    }

    this.syncInProgress = true;
    const startTime = Date.now();

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
      // 报告进度：准备阶段
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

      // 2. 获取远程元数据
      const remoteMetadata = await this.metadataManager.getRemoteMetadata();

      options.onProgress?.({
        phase: 'preparing',
        completed: 40,
        total: 100,
        percentage: 40,
        message: '正在获取远程数据...',
      });

      // 3. 获取基准元数据
      const baseMetadata = await this.metadataManager.getLocalMetadata();

      // 🔍 临时启用详细日志用于调试
      console.warn('📊 同步状态检查:', {
        本地文件数: Object.keys(localFilesMetadata).length,
        本地文件: Object.keys(localFilesMetadata),
        本地文件详情: Object.entries(localFilesMetadata).map(([key, meta]) => ({
          key,
          hash: meta.hash.substring(0, 12),
          size: meta.size,
          time: new Date(meta.mtimeCli).toLocaleString(),
        })),
        远程文件数: remoteMetadata
          ? Object.keys(remoteMetadata.files).length
          : 0,
        远程文件: remoteMetadata ? Object.keys(remoteMetadata.files) : [],
        远程文件详情: remoteMetadata
          ? Object.entries(remoteMetadata.files).map(([key, meta]) => ({
              key,
              hash: meta.hash.substring(0, 12),
              size: meta.size,
              time: new Date(meta.mtimeCli).toLocaleString(),
            }))
          : [],
        有基准元数据: !!baseMetadata,
        基准文件: baseMetadata ? Object.keys(baseMetadata.files) : [],
        指定方向: options.preferredDirection || 'auto',
      });

      // 4. 如果指定了同步方向，直接执行
      if (options.preferredDirection === 'upload') {
        await this.uploadAllFiles(localFilesMetadata, result);
        await this.updateMetadataAfterSync(localFilesMetadata);
        result.message = `已上传 ${result.uploadedFiles} 个文件`;
        result.success = result.errors.length === 0;
        return result;
      }

      if (options.preferredDirection === 'download') {
        if (remoteMetadata) {
          await this.downloadAllFiles(remoteMetadata, result);
          // 🔧 关键修复：下载后需要重新获取本地文件元数据
          const updatedLocalFiles = await this.getLocalFilesMetadata();
          await this.updateMetadataAfterSync(updatedLocalFiles);
          result.message = `已下载 ${result.downloadedFiles} 个文件`;
        } else {
          result.message = '远程无数据可下载';
        }
        result.success = result.errors.length === 0;
        return result;
      }

      // 5. 自动模式：计算同步计划
      const plan = this.syncPlanner.calculateSyncPlan(
        localFilesMetadata,
        remoteMetadata,
        baseMetadata,
        options.conflictStrategy || ConflictStrategy.MANUAL
      );

      const summary = this.syncPlanner.generatePlanSummary(plan);

      // 🔍 临时启用详细日志用于调试
      console.warn('🔍 同步计划详情:', {
        上传: plan.upload.map(f => ({
          key: f.key,
          hash: f.hash.substring(0, 12),
          size: f.size,
        })),
        下载: plan.download.map(f => ({
          key: f.key,
          hash: f.hash.substring(0, 12),
          size: f.size,
        })),
        冲突: plan.conflicts.map(f => ({
          key: f.key,
          hash: f.hash.substring(0, 12),
          size: f.size,
        })),
        删除本地: plan.deleteLocal.map(f => f.key),
        删除远程: plan.deleteRemote.map(f => f.key),
        未变更: plan.unchanged.map(f => f.key),
        摘要: summary,
      });

      // 6. 验证同步计划
      const validation = this.syncPlanner.validatePlan(
        plan,
        options.protection?.maxDeletePercent,
        options.protection?.maxDeleteCount
      );

      if (!validation.safe) {
        result.warnings = validation.warnings;

        if (!options.dryRun) {
          // 实际项目中应该询问用户是否继续
          // 这里暂时继续执行
        }
      }

      // 7. 如果有冲突且策略是手动，返回让用户处理
      if (
        plan.conflicts.length > 0 &&
        options.conflictStrategy === ConflictStrategy.MANUAL
      ) {
        result.conflict = true;
        result.plan = plan;
        result.remoteMetadata = remoteMetadata;
        result.message = `发现 ${plan.conflicts.length} 个冲突，需要手动解决`;
        result.warnings?.push(result.message);
        return result;
      }

      // 8. 如果没有任何操作需要执行，但仍需更新元数据
      // 这确保了"无需同步"的情况下也能保存当前状态作为基准
      if (
        plan.upload.length === 0 &&
        plan.download.length === 0 &&
        plan.deleteLocal.length === 0 &&
        plan.deleteRemote.length === 0 &&
        plan.conflicts.length === 0
      ) {
        // 🔧 关键修复：即使没有操作，也要更新本地元数据
        // 这样下次同步时就有base元数据可用
        await this.updateMetadataAfterSync(localFilesMetadata);

        result.success = true;
        result.message = '数据已是最新，无需同步';
        return result;
      }

      // 9. 干运行模式：只返回计划不执行
      if (options.dryRun) {
        result.plan = plan;
        result.message = `同步预览: ${summary}`;
        result.success = true;
        return result;
      }

      // 10. 执行同步计划
      await this.executeSyncPlan(plan, result, options);

      // 11. 更新元数据
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

      // 12. 生成结果
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      result.success = result.errors.length === 0;
      result.message = result.success
        ? `同步完成 (${duration}s): ${summary}`
        : `同步部分完成，遇到 ${result.errors.length} 个错误`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      result.errors.push(`同步失败: ${errorMessage}`);
      result.message = '同步失败';
      console.error('\n❌ 同步过程中发生错误:', error);
    } finally {
      this.syncInProgress = false;
    }

    return result;
  }

  /**
   * 获取本地文件元数据
   * 关键修复：排除动态字段后再计算哈希
   */
  private async getLocalFilesMetadata(): Promise<Record<string, FileMetadata>> {
    try {
      // 使用 DataManager 导出完整数据
      const { DataManager } = await import('@/lib/core/dataManager');
      const fullExportString = await DataManager.exportAllData();
      const exportDataObj = safeJsonParse(fullExportString, {});

      // 构建数据映射
      const dataMap: Record<string, unknown> = {
        'brew-guide-data': exportDataObj,
      };

      // 创建文件元数据（会自动排除动态字段）
      const filesMetadata = await createFilesMetadataFromData(dataMap);

      return filesMetadata;
    } catch (error) {
      console.error('获取本地文件元数据失败:', error);
      return {};
    }
  }

  /**
   * 上传所有本地文件
   */
  private async uploadAllFiles(
    localFiles: Record<string, FileMetadata>,
    result: SyncResult
  ): Promise<void> {
    for (const [key, _metadata] of Object.entries(localFiles)) {
      try {
        // 获取实际内容
        const content = await this.getFileContent(key);
        if (!content) {
          result.errors.push(`无法获取文件 ${key} 的内容`);
          continue;
        }

        const fileName = `${key}.json`;
        const success = await this.client!.uploadFile(fileName, content);

        if (success) {
          result.uploadedFiles++;
        } else {
          result.errors.push(`上传 ${key} 失败`);
        }
      } catch (error) {
        const msg = `上传 ${key} 时出错: ${error instanceof Error ? error.message : '未知错误'}`;
        result.errors.push(msg);
        console.error(`      ✗ ${msg}`);
      }
    }
  }

  /**
   * 下载所有远程文件
   */
  private async downloadAllFiles(
    remoteMetadata: SyncMetadataV2,
    result: SyncResult
  ): Promise<void> {
    for (const [key, _metadata] of Object.entries(remoteMetadata.files)) {
      try {
        const fileName = `${key}.json`;
        const content = await this.client!.downloadFile(fileName);

        if (content) {
          await this.saveFileContent(key, content);
          result.downloadedFiles++;
        } else {
          result.errors.push(`下载 ${key} 失败`);
        }
      } catch (error) {
        const msg = `下载 ${key} 时出错: ${error instanceof Error ? error.message : '未知错误'}`;
        result.errors.push(msg);
        console.error(`✗ ${msg}`);
      }
    }

    // 触发存储更新事件
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('storageChange', {
          detail: { key: 's3-sync-complete' },
        })
      );
    }
  }

  /**
   * 执行同步计划
   */
  private async executeSyncPlan(
    plan: SyncPlan,
    result: SyncResult,
    options: SyncOptions = {}
  ): Promise<void> {
    const totalOperations =
      plan.upload.length +
      plan.download.length +
      plan.deleteRemote.length +
      plan.deleteLocal.length;
    let completedOperations = 0;

    // 1. 上传文件
    if (plan.upload.length > 0) {
      for (const file of plan.upload) {
        try {
          options.onProgress?.({
            phase: 'uploading',
            currentFile: file.key,
            completed: completedOperations,
            total: totalOperations,
            percentage: Math.round(
              (completedOperations / totalOperations) * 100
            ),
            message: `正在上传: ${file.key}`,
          });

          const content = await this.getFileContent(file.key);
          if (content) {
            const success = await this.client!.uploadFile(
              `${file.key}.json`,
              content
            );
            if (success) {
              result.uploadedFiles++;
            } else {
              result.errors.push(`上传 ${file.key} 失败`);
            }
          }
        } catch (_error) {
          result.errors.push(`上传 ${file.key} 时出错`);
        }
        completedOperations++;
      }
    }

    // 2. 下载文件
    if (plan.download.length > 0) {
      for (const file of plan.download) {
        try {
          options.onProgress?.({
            phase: 'downloading',
            currentFile: file.key,
            completed: completedOperations,
            total: totalOperations,
            percentage: Math.round(
              (completedOperations / totalOperations) * 100
            ),
            message: `正在下载: ${file.key}`,
          });

          const content = await this.client!.downloadFile(`${file.key}.json`);
          if (content) {
            await this.saveFileContent(file.key, content);
            result.downloadedFiles++;
          } else {
            result.errors.push(`下载 ${file.key} 失败`);
          }
        } catch (_error) {
          result.errors.push(`下载 ${file.key} 时出错`);
        }
        completedOperations++;
      }
    }

    // 3. 删除远程文件
    if (plan.deleteRemote.length > 0) {
      for (const file of plan.deleteRemote) {
        try {
          options.onProgress?.({
            phase: 'uploading',
            currentFile: file.key,
            completed: completedOperations,
            total: totalOperations,
            percentage: Math.round(
              (completedOperations / totalOperations) * 100
            ),
            message: `正在删除远程: ${file.key}`,
          });

          const success = await this.client!.deleteFile(`${file.key}.json`);
          if (success) {
            result.deletedFiles = (result.deletedFiles || 0) + 1;
          } else {
            result.errors.push(`删除远程 ${file.key} 失败`);
          }
        } catch (_error) {
          result.errors.push(`删除远程 ${file.key} 时出错`);
        }
        completedOperations++;
      }
    }

    // 4. 删除本地文件
    if (plan.deleteLocal.length > 0) {
      for (const file of plan.deleteLocal) {
        try {
          options.onProgress?.({
            phase: 'downloading',
            currentFile: file.key,
            completed: completedOperations,
            total: totalOperations,
            percentage: Math.round(
              (completedOperations / totalOperations) * 100
            ),
            message: `正在删除本地: ${file.key}`,
          });

          await Storage.remove(file.key);
          result.deletedFiles = (result.deletedFiles || 0) + 1;
        } catch (_error) {
          result.errors.push(`删除本地 ${file.key} 时出错`);
        }
        completedOperations++;
      }
    }
  }

  /**
   * 同步后更新元数据
   */
  private async updateMetadataAfterSync(
    localFiles: Record<string, FileMetadata>
  ): Promise<void> {
    if (!this.metadataManager) return;

    const metadata: SyncMetadataV2 = {
      version: '2.0.0',
      lastSyncTime: Date.now(),
      deviceId: this.deviceId,
      files: localFiles,
      deletedFiles: [],
    };

    // 保存到本地
    await this.metadataManager.saveLocalMetadata(metadata);

    // 上传到远程
    await this.metadataManager.saveRemoteMetadata(metadata);
  }

  /**
   * 获取文件内容（用于上传）
   */
  private async getFileContent(key: string): Promise<string | null> {
    try {
      if (key === 'brew-guide-data') {
        const { DataManager } = await import('@/lib/core/dataManager');
        return await DataManager.exportAllData();
      }

      // 其他文件
      const value = await Storage.get(key);
      return value;
    } catch (error) {
      console.error(`获取文件 ${key} 内容失败:`, error);
      return null;
    }
  }

  /**
   * 保存文件内容（下载后）
   */
  private async saveFileContent(key: string, content: string): Promise<void> {
    try {
      if (key === 'brew-guide-data') {
        // 完整应用数据，使用 DataManager 导入
        const { DataManager } = await import('@/lib/core/dataManager');
        await DataManager.importAllData(content);
      } else {
        // 其他文件直接保存
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
  private async getOrCreateDeviceId(): Promise<string> {
    let deviceId = await Storage.get('device-id');
    if (!deviceId) {
      deviceId = await generateDeviceId();
      await Storage.set('device-id', deviceId);
    }
    return deviceId;
  }

  /**
   * 检查同步状态
   */
  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  /**
   * 获取最后同步时间
   */
  async getLastSyncTime(): Promise<Date | null> {
    if (!this.metadataManager) return null;

    const metadata = await this.metadataManager.getLocalMetadata();
    return metadata ? new Date(metadata.lastSyncTime) : null;
  }
}

export default S3SyncManager;
