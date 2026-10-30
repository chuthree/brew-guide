/**
 * 统一的同步管理器基类
 * S3 和 WebDAV 都继承此类，确保逻辑完全一致
 *
 * 支持三方合并同步，并保留手动上传/下载
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
import { formatSyncDiagnostic, type SyncDiagnostic } from './types';
import { canonical, mergeSyncData, parseSyncDocument } from './mergeData';

let cloudOperationInProgress = false;

/**
 * 存储客户端接口 - S3 和 WebDAV 客户端都需要实现这个接口
 */
export interface IStorageClient {
  testConnection(): Promise<boolean>;
  getLastDiagnostic?(): SyncDiagnostic | null;
  clearDiagnostic?(): void;
  uploadFile(
    key: string,
    content: string,
    expectedEtag?: string | null
  ): Promise<boolean | { success: false; error: string }>;
  readSyncFile(key: string): Promise<{ content: string; etag: string } | null>;
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
  protected baselineKey = '';
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
   * 执行同步或手动覆盖
   */
  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    if (cloudOperationInProgress) {
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
    cloudOperationInProgress = true;
    const debugLogs: string[] = [];
    const addLog = (msg: string) => {
      debugLogs.push(`[${new Date().toISOString()}] ${msg}`);
      console.warn(`📝 [${this.getServiceName()}] ${msg}`);
    };
    const addLogLines = (lines: string[]) => {
      lines.forEach(line => {
        debugLogs.push(line ? `[${new Date().toISOString()}] ${line}` : '');
      });
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
      this.client.clearDiagnostic?.();
      addLog(`开始同步，方向: ${options.preferredDirection || 'auto'}`);

      // 获取远程元数据（用于备份历史）
      const remoteMetadata = await this.metadataManager.getRemoteMetadata();

      if (options.preferredDirection === 'upload') {
        await this.performUpload(result, options, remoteMetadata, addLog);
      } else if (options.preferredDirection === 'download') {
        await this.performDownload(result, remoteMetadata, addLog);
      } else {
        await this.performMerge(result, addLog);
      }

      this.appendResultDiagnostics(result, addLogLines);
      result.debugLogs = debugLogs;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      result.success = false;
      addLog(`同步异常: ${errorMsg}`);
      result.errors.push(`同步失败: ${errorMsg}`);
      result.message = errorMsg;
      this.appendResultDiagnostics(result, addLogLines);
      result.debugLogs = debugLogs;
    } finally {
      this.syncInProgress = false;
      cloudOperationInProgress = false;
    }

    return result;
  }

  protected async setSyncTarget(target: string[]): Promise<void> {
    const { calculateHash } = await import('@/lib/s3/utils');
    this.baselineKey = `cloud-sync-base-v1:${await calculateHash(JSON.stringify(target))}`;
  }

  private async performMerge(
    result: SyncResult,
    addLog: (message: string) => void
  ): Promise<void> {
    const key = 'brew-guide-data.json';
    const localContent = await this.getFileContent(key);
    if (!localContent) throw new Error('无法读取本地数据');
    const local = parseSyncDocument(localContent);
    const baseline = await Storage.get(this.baselineKey);
    const base = baseline ? parseSyncDocument(baseline) : undefined;
    const remoteFile = await this.client!.readSyncFile(key);
    if (!remoteFile && base)
      throw new Error('云端同步文件已被删除，请先确认云端目录或使用手动上传');
    const remote = remoteFile
      ? parseSyncDocument(remoteFile.content)
      : undefined;
    const merged = remote
      ? mergeSyncData(base?.data, local.data, remote.data)
      : { data: local.data, conflicts: [] };
    if (merged.conflicts.length) {
      result.conflict = true;
      result.message = `发现 ${merged.conflicts.length} 项冲突，未覆盖任何数据。请在设置的同步日志中查看记录并处理后重试`;
      result.errors = merged.conflicts.map(path => {
        const match = path.match(/^([^[]+)\[([^\]]+)\]$/);
        const labels: Record<string, string> = {
          coffeeBeans: '咖啡豆',
          brewingNotes: '冲煮记录',
          customEquipments: '器具',
          grinders: '磨豆机',
        };
        const rows = match ? local.data[match[1]] : undefined;
        const record = Array.isArray(rows)
          ? rows.find(row => row.id === match?.[2])
          : undefined;
        const label =
          match && labels[match[1]]
            ? `${labels[match[1]]}「${record?.name || match[2]}」`
            : path;
        return `双方独立修改或删除了：${label}（${path}）`;
      });
      return;
    }
    const content = JSON.stringify({ ...local, data: merged.data });
    const upload = !remote || canonical(remote.data) !== canonical(merged.data);
    const download = canonical(local.data) !== canonical(merged.data);

    // 保存两侧原始快照，导入中断时仍可通过现有备份历史恢复。
    if (upload || download) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      for (const [side, snapshot] of [
        ['local', localContent],
        ['remote', remoteFile?.content],
      ] as const) {
        if (!snapshot) continue;
        const backup = await this.client!.uploadFile(
          `backups/backup-${stamp}-${side}-${crypto.randomUUID()}.json`,
          snapshot
        );
        if (backup !== true) throw new Error('同步前备份失败，未覆盖数据');
      }
      const latest = await this.getFileContent(key);
      if (
        !latest ||
        canonical(parseSyncDocument(latest).data) !== canonical(local.data)
      ) {
        throw new Error('同步期间本地数据发生变化，请重试');
      }
    }
    if (upload) {
      // 用独立对象确认服务/代理确实执行条件头，不能默默退化为覆盖。
      const probeKey = `.brew-guide-sync-check-${crypto.randomUUID()}`;
      const probe = await this.client!.uploadFile(
        probeKey,
        '{}',
        '"missing-version"'
      );
      const supportsConditions =
        probe !== true && this.client!.getLastDiagnostic?.()?.status === 412;
      if (probe === true) await this.client!.deleteFile(probeKey);
      if (!supportsConditions)
        throw new Error(
          '云存储或代理未确认支持条件写入，已停止同步；可继续使用手动上传、下载'
        );
      this.client!.clearDiagnostic?.();
      addLog('使用云端版本校验写入合并结果');
      const uploaded = await this.client!.uploadFile(
        key,
        content,
        remoteFile?.etag ?? null
      );
      if (uploaded !== true) {
        throw new Error(
          `合并写入失败，云端可能已被其他设备更新，请重试：${typeof uploaded === 'object' ? uploaded.error : '请求失败'}`
        );
      }
      result.uploadedFiles = 1;
    }
    if (download) {
      const { DataManager } = await import('@/lib/core/dataManager');
      const imported = await DataManager.importAllData(content, {
        preserveDeviceSettings: true,
        expectedSyncData: local.data,
      });
      if (!imported.success)
        throw new Error(`${imported.message}；同步前数据保留在备份历史中`);
      result.downloadedFiles = 1;
    }
    await Storage.set(this.baselineKey, content);
    const files = await createFilesMetadataFromData({
      [key]: JSON.parse(content),
    });
    if (!(await this.updateMetadataAfterSync(files, addLog))) {
      throw new Error('数据已同步，但同步状态保存失败，请重试');
    }
    result.success = true;
    result.message = upload || download ? '数据同步完成' : '数据已是最新';
    if (upload || download)
      await this.getBackupManager().cleanupOldBackups(this.client!);
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
      const errorMsg = `上传 brew-guide-data.json 失败: ${errorDetail}`;
      result.errors.push(errorMsg);
      result.message = errorMsg;
      return;
    }
    result.uploadedFiles = 1;
    addLog('主文件上传成功');

    // 2. 通过服务器端复制创建备份（不消耗客户端带宽）
    addLog('正在创建备份（服务器端复制）...');
    const lastBackupHash = remoteMetadata?.backupHistory?.slice(-1)[0]?.hash;
    const backupCreated =
      await this.getBackupManager().performBackupAfterUpload(
        this.client!,
        'brew-guide-data.json',
        hash,
        lastBackupHash
      );
    if (!backupCreated) {
      const warning = '备份创建失败，主文件已上传，将继续更新同步元数据';
      result.warnings = [...(result.warnings ?? []), warning];
      addLog(warning);
    }

    // 3. 更新元数据
    const localFilesMetadata = await this.getLocalFilesMetadata();
    const metadataUpdated = await this.updateMetadataAfterSync(
      localFilesMetadata,
      addLog
    );
    if (!metadataUpdated) {
      result.message = '上传失败：主文件已上传，但同步元数据更新失败';
      result.errors.push(
        '同步元数据更新失败，云端主文件可能已写入，请查看请求诊断后重试上传'
      );
      return;
    }
    addLog('元数据更新完成');

    result.success = true;
    result.message = `已上传 ${result.uploadedFiles} 个文件`;
    await Storage.set(this.baselineKey, content);
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
        if (key === 'brew-guide-data.json' || key === 'brew-guide-data') {
          await Storage.set(this.baselineKey, content);
        }
        result.downloadedFiles++;
        addLog(`下载成功: ${key}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`下载 ${key} 失败: ${errorMsg}`);
      }
    }

    // 更新元数据
    const metadataUpdated = await this.updateMetadataAfterSync(
      remoteMetadata.files,
      addLog
    );
    if (metadataUpdated) {
      addLog('元数据更新完成');
    } else {
      result.errors.push('同步元数据更新失败，本地数据已写入但同步状态未保存');
    }

    result.success = result.errors.length === 0;
    result.message = result.success
      ? `已下载 ${result.downloadedFiles} 个文件`
      : `下载完成但有 ${result.errors.length} 个错误`;
  }

  /**
   * 更新同步后的元数据
   */
  private async updateMetadataAfterSync(
    files: Record<string, FileMetadata>,
    addLog?: (msg: string) => void
  ): Promise<boolean> {
    if (!this.metadataManager) return false;

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
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ [${this.getServiceName()}] 更新元数据失败:`, error);
      addLog?.(`元数据更新失败: ${errorMsg}`);
      return false;
    }
  }

  /**
   * 获取本地文件元数据
   */
  protected async getLocalFilesMetadata(): Promise<
    Record<string, FileMetadata>
  > {
    try {
      const fullExportString = await this.getFileContent(
        'brew-guide-data.json'
      );
      if (!fullExportString) return {};
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
        return await DataManager.exportAllData({
          excludeDeviceSettings: true,
          strict: true,
        });
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
      const imported = await DataManager.importAllData(content, {
        preserveDeviceSettings: true,
      });
      if (!imported.success) throw new Error(imported.message);
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

  private appendResultDiagnostics(
    result: SyncResult,
    addLogLines: (lines: string[]) => void
  ): void {
    if (!result.success && result.message) {
      addLogLines(['', '--- 同步结果 ---', result.message]);
    }

    if (result.errors.length > 0) {
      addLogLines([
        '',
        `--- 错误详情 (${result.errors.length} 项) ---`,
        ...result.errors.map((error, index) => `${index + 1}. ${error}`),
      ]);
    }

    if (result.warnings && result.warnings.length > 0) {
      addLogLines([
        '',
        `--- 警告 (${result.warnings.length} 项) ---`,
        ...result.warnings.map((warning, index) => `${index + 1}. ${warning}`),
      ]);
    }

    if (
      !result.success ||
      result.errors.length > 0 ||
      result.warnings?.length
    ) {
      const diagnostic = this.client?.getLastDiagnostic?.() ?? null;
      const diagnosticLines = formatSyncDiagnostic(diagnostic);
      if (diagnosticLines.length > 0) {
        addLogLines(['', ...diagnosticLines]);
      }
    }
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
    if (!this.client || cloudOperationInProgress) {
      console.error(`❌ [${this.getServiceName()}] 恢复失败：客户端未初始化`);
      return false;
    }

    cloudOperationInProgress = true;
    try {
      const content = await this.getBackupManager().restoreBackup(
        this.client,
        backupKey
      );
      if (!content) return false;
      await this.saveFileContent('brew-guide-data.json', content);
      console.warn(
        `✅ [${this.getServiceName()}] 数据已从备份恢复: ${backupKey}`
      );
      return true;
    } catch (error) {
      console.error(`❌ [${this.getServiceName()}] 恢复数据失败:`, error);
      return false;
    } finally {
      cloudOperationInProgress = false;
    }
  }
}
