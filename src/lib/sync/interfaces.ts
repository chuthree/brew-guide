/** S3/WebDAV 手动同步的选项、结果与适配器。 */

import type { SyncDirection, SyncProgress } from './types';
import type { BaseSyncManager } from './BaseSyncManager';

export interface ISyncOptions {
  direction: SyncDirection;
  onProgress?: (progress: SyncProgress) => void;
}

export interface ISyncResult {
  readonly success: boolean;
  readonly message: string;
  readonly uploadedCount: number;
  readonly downloadedCount: number;
  readonly errors: ReadonlyArray<string>;
  readonly debugLogs?: ReadonlyArray<string>;
}

export interface ISyncManager {
  sync(options: ISyncOptions): Promise<ISyncResult>;
}

export function createFailureResult(
  message: string,
  errors: string[] = []
): ISyncResult {
  return {
    success: false,
    message,
    uploadedCount: 0,
    downloadedCount: 0,
    errors: errors.length > 0 ? errors : [message],
    debugLogs: undefined,
  };
}

/** 将底层同步结果转换为界面使用的格式。 */
export class BaseSyncManagerAdapter implements ISyncManager {
  constructor(private readonly manager: Pick<BaseSyncManager, 'sync'>) {}

  async sync(options: ISyncOptions): Promise<ISyncResult> {
    const result = await this.manager.sync({
      preferredDirection: options.direction,
      onProgress: options.onProgress,
    });

    return {
      success: result.success,
      message: result.message,
      uploadedCount: result.uploadedFiles,
      downloadedCount: result.downloadedFiles,
      errors: result.errors,
      debugLogs: result.debugLogs,
    };
  }
}
