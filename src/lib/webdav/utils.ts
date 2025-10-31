/**
 * WebDAV 同步工具函数
 * 复用 S3 的工具函数，保持一致性
 */

export {
  calculateHash,
  createFileMetadata,
  createFilesMetadataFromData,
  normalizeDataForHash,
  areFilesEqual,
  generateDeviceId,
  safeJsonParse,
  deepClone,
} from '@/lib/s3/utils';
