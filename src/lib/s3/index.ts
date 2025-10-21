/**
 * S3 同步模块统一导出
 */

// 默认导出 V2（新版本）
export { S3SyncManager as default } from './syncManagerV2'
export { S3SyncManager as S3SyncManagerV2 } from './syncManagerV2'

// 其他模块
export { MetadataManager } from './metadataManager'
export { SyncPlanner } from './syncPlanner'

// 工具函数
export * from './utils'

// 类型定义
export * from './types'

// S3 客户端
export { default as S3Client } from './s3Client'
export type { S3Config, S3File } from './s3Client'
