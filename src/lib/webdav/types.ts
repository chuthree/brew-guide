/**
 * WebDAV 同步相关的类型定义
 * 复用 S3 的文件元数据和同步逻辑，保持架构一致性
 */

import type {
  FileMetadata,
  SyncMetadataV2,
  SyncPlan,
  SyncOptions,
  SyncProgress,
  SyncResult,
  ConflictStrategy,
  FileChangeType,
} from '@/lib/s3/types';

/**
 * WebDAV 配置
 */
export interface WebDAVConfig {
  /** WebDAV 服务器地址 */
  url: string;
  /** 用户名 */
  username: string;
  /** 密码 */
  password: string;
  /** 远程目录路径 */
  remotePath: string;
  /** 是否使用 CORS 代理（浏览器环境下跨域访问时需要） */
  useProxy?: boolean;
}

/**
 * WebDAV 文件信息
 */
export interface WebDAVFile {
  /** 文件路径 */
  filename: string;
  /** 文件名（不含路径） */
  basename: string;
  /** 最后修改时间 */
  lastmod: string;
  /** 文件大小（字节） */
  size: number;
  /** 文件类型 */
  type: 'file' | 'directory';
  /** ETag */
  etag?: string;
}

// 导出 S3 中已定义的类型，保持一致性
export type {
  FileMetadata,
  SyncMetadataV2,
  SyncPlan,
  SyncOptions,
  SyncProgress,
  SyncResult,
  ConflictStrategy,
  FileChangeType,
};
