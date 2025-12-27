/**
 * 备份管理器
 * 负责同步前的自动备份、历史记录维护和旧备份清理
 */

import type { IStorageClient } from './BaseSyncManager';
import type { BackupRecord } from '@/lib/s3/types';

const BACKUP_DIR = 'backups';
const MAX_BACKUPS = 5;

export class BackupManager {
  constructor(private serviceName: string) {}

  /**
   * 生成备份文件路径
   */
  generateBackupKey(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${BACKUP_DIR}/backup-${timestamp}.json`;
  }

  /**
   * 通过服务器端复制创建备份（不消耗客户端带宽）
   */
  async createBackupByCopy(
    client: IStorageClient,
    sourceKey: string,
    hash: string
  ): Promise<BackupRecord | null> {
    const backupKey = this.generateBackupKey();

    try {
      const success = await client.copyFile(sourceKey, backupKey);

      if (!success) {
        console.error(`❌ [${this.serviceName}] 备份复制失败`);
        return null;
      }

      console.warn(
        `✅ [${this.serviceName}] 备份创建成功（服务器端复制）: ${backupKey}`
      );
      return { timestamp: Date.now(), key: backupKey, hash };
    } catch (error) {
      console.error(`❌ [${this.serviceName}] 备份创建异常:`, error);
      return null;
    }
  }

  /**
   * 从服务器扫描备份文件列表
   */
  async listBackupsFromServer(client: IStorageClient): Promise<BackupRecord[]> {
    try {
      const files = await client.listFilesSimple(BACKUP_DIR);

      return files
        .filter(f => f.key.endsWith('.json') && f.key.includes('backup-'))
        .map(f => ({
          timestamp:
            f.lastModified?.getTime() || this.parseTimestampFromKey(f.key),
          key: f.key.startsWith(BACKUP_DIR) ? f.key : `${BACKUP_DIR}/${f.key}`,
          hash: '', // 从文件列表无法获取 hash
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error(`❌ [${this.serviceName}] 扫描备份目录失败:`, error);
      return [];
    }
  }

  /**
   * 从文件名解析时间戳
   * 格式: backup-2025-12-27T14-45-51-947Z.json
   */
  private parseTimestampFromKey(key: string): number {
    const match = key.match(/backup-(\d{4}-\d{2}-\d{2}T[\d-]+Z)\.json/);
    if (match) {
      const isoString = match[1].replace(
        /-(\d{2})-(\d{2})-(\d{3})Z/,
        ':$1:$2.$3Z'
      );
      const date = new Date(isoString);
      if (!isNaN(date.getTime())) return date.getTime();
    }
    return Date.now();
  }

  /**
   * 清理超出数量的旧备份
   */
  async cleanupOldBackups(client: IStorageClient): Promise<void> {
    const backups = await this.listBackupsFromServer(client);
    if (backups.length <= MAX_BACKUPS) return;

    const toDelete = backups.slice(0, backups.length - MAX_BACKUPS);

    for (const backup of toDelete) {
      try {
        await client.deleteFile(backup.key);
        console.warn(`🗑️ [${this.serviceName}] 已删除旧备份: ${backup.key}`);
      } catch (error) {
        console.error(
          `❌ [${this.serviceName}] 删除旧备份失败: ${backup.key}`,
          error
        );
      }
    }
  }

  /**
   * 执行备份流程（通过服务器端复制，主文件上传后调用）
   */
  async performBackupAfterUpload(
    client: IStorageClient,
    sourceKey: string,
    hash: string,
    lastBackupHash?: string
  ): Promise<boolean> {
    // 如果 hash 相同，跳过备份
    if (lastBackupHash && lastBackupHash === hash) {
      console.warn(`⏭️ [${this.serviceName}] 数据无变化，跳过备份`);
      return true;
    }

    const newBackup = await this.createBackupByCopy(client, sourceKey, hash);
    if (!newBackup) return false;

    await this.cleanupOldBackups(client);
    return true;
  }

  /**
   * 从备份恢复
   */
  async restoreBackup(
    client: IStorageClient,
    backupKey: string
  ): Promise<string | null> {
    try {
      const content = await client.downloadFile(backupKey);
      if (!content) {
        console.error(`❌ [${this.serviceName}] 备份文件不存在: ${backupKey}`);
        return null;
      }
      console.warn(`✅ [${this.serviceName}] 备份下载成功: ${backupKey}`);
      return content;
    } catch (error) {
      console.error(`❌ [${this.serviceName}] 备份恢复失败:`, error);
      return null;
    }
  }
}
