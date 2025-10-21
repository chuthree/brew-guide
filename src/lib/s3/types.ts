/**
 * S3 同步相关的类型定义
 * 参考 remotely-save 的最佳实践
 */

/**
 * 文件元数据 - 用于追踪单个文件的状态
 */
export interface FileMetadata {
    /** 文件路径/键名 */
    key: string
    /** 文件大小（字节） */
    size: number
    /** 最后修改时间（Unix 时间戳，毫秒） */
    mtimeCli: number
    /** 内容哈希值（SHA-256） */
    hash: string
    /** 最后同步时间 */
    syncedAt?: number
    /** 是否已删除 */
    deleted?: boolean
}

/**
 * 同步元数据 V2 - 文件级别追踪
 */
export interface SyncMetadataV2 {
    /** 元数据版本 */
    version: '2.0.0'
    /** 最后同步时间 */
    lastSyncTime: number
    /** 设备 ID */
    deviceId: string
    /** 文件列表（键名 -> 元数据） */
    files: Record<string, FileMetadata>
    /** 已删除的文件列表 */
    deletedFiles?: string[]
}

/**
 * 旧版本同步元数据 - 用于兼容
 */
export interface SyncMetadataV1 {
    version?: '1.0.0' | string
    lastSyncTime: number
    deviceId: string
    files?: string[]
    dataHash?: string
}

/**
 * 通用同步元数据类型
 */
export type SyncMetadata = SyncMetadataV2 | SyncMetadataV1

/**
 * 同步计划 - 描述需要执行的同步操作
 */
export interface SyncPlan {
    /** 需要上传到远程的文件 */
    upload: FileMetadata[]
    /** 需要从远程下载的文件 */
    download: FileMetadata[]
    /** 需要在本地删除的文件 */
    deleteLocal: FileMetadata[]
    /** 需要在远程删除的文件 */
    deleteRemote: FileMetadata[]
    /** 冲突的文件 */
    conflicts: FileMetadata[]
    /** 无需操作的文件 */
    unchanged: FileMetadata[]
}

/**
 * 同步方向
 */
export type SyncDirection = 'upload' | 'download' | 'none' | 'conflict'

/**
 * 冲突解决策略
 */
export enum ConflictStrategy {
    /** 保留更新的版本（基于修改时间） */
    KEEP_NEWER = 'newer',
    /** 保留更大的文件 */
    KEEP_LARGER = 'larger',
    /** 保留本地版本 */
    KEEP_LOCAL = 'local',
    /** 保留远程版本 */
    KEEP_REMOTE = 'remote',
    /** 保留两者并重命名 */
    KEEP_BOTH = 'both',
    /** 手动解决（返回错误让用户选择） */
    MANUAL = 'manual'
}

/**
 * 同步选项
 */
export interface SyncOptions {
    /** 首选同步方向 */
    preferredDirection?: 'auto' | 'upload' | 'download'
    /** 冲突解决策略 */
    conflictStrategy?: ConflictStrategy
    /** 是否自动解决冲突 */
    autoResolve?: boolean
    /** 是否执行干运行（只计划不执行） */
    dryRun?: boolean
    /** 同步保护选项 */
    protection?: SyncProtectionOptions
    /** 进度回调 */
    onProgress?: (progress: SyncProgress) => void
}

/**
 * 同步进度信息
 */
export interface SyncProgress {
    /** 当前阶段 */
    phase: 'preparing' | 'uploading' | 'downloading' | 'finalizing'
    /** 当前文件名 */
    currentFile?: string
    /** 已完成数量 */
    completed: number
    /** 总数量 */
    total: number
    /** 进度百分比 (0-100) */
    percentage: number
    /** 阶段描述 */
    message: string
}

/**
 * 同步保护选项
 */
export interface SyncProtectionOptions {
    /** 最大删除文件比例（0-1），超过则警告 */
    maxDeletePercent?: number
    /** 最大删除文件数量，超过则警告 */
    maxDeleteCount?: number
    /** 是否在同步前备份 */
    backupBeforeSync?: boolean
}

/**
 * 同步结果
 */
export interface SyncResult {
    /** 是否成功 */
    success: boolean
    /** 结果消息 */
    message: string
    /** 上传的文件数 */
    uploadedFiles: number
    /** 下载的文件数 */
    downloadedFiles: number
    /** 删除的文件数 */
    deletedFiles?: number
    /** 错误列表 */
    errors: string[]
    /** 警告列表 */
    warnings?: string[]
    /** 是否存在冲突 */
    conflict?: boolean
    /** 远程元数据（用于冲突解决） */
    remoteMetadata?: SyncMetadata | null
    /** 同步计划（用于预览） */
    plan?: SyncPlan
}

/**
 * 文件变更类型
 */
export enum FileChangeType {
    /** 新增 */
    ADDED = 'added',
    /** 修改 */
    MODIFIED = 'modified',
    /** 删除 */
    DELETED = 'deleted',
    /** 冲突 */
    CONFLICT = 'conflict',
    /** 未变更 */
    UNCHANGED = 'unchanged'
}

/**
 * 文件变更记录
 */
export interface FileChange {
    /** 文件键名 */
    key: string
    /** 变更类型 */
    type: FileChangeType
    /** 同步方向（仅对 MODIFIED 类型有意义） */
    direction?: 'upload' | 'download'
    /** 本地元数据 */
    local?: FileMetadata
    /** 远程元数据 */
    remote?: FileMetadata
    /** 基准元数据（上次同步时的状态） */
    base?: FileMetadata
}

/**
 * 同步状态
 */
export interface SyncStatus {
    /** 是否正在同步 */
    inProgress: boolean
    /** 最后同步时间 */
    lastSyncTime: Date | null
    /** 最后同步结果 */
    lastResult: SyncResult | null
    /** 是否需要同步 */
    needsSync: boolean
}
