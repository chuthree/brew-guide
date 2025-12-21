/**
 * 同步配置组件共享 Hook
 *
 * 为 S3SyncSection、WebDAVSyncSection、SupabaseSyncSection 提供统一的状态管理
 * 减少三个组件中的重复代码
 */

import { useState, useRef, useCallback } from 'react';
import type { ConnectionStatus, SyncProgress } from '@/lib/sync/types';
import hapticsUtils from '@/lib/ui/haptics';

export interface UseSyncSectionOptions {
  /** 是否启用触觉反馈 */
  hapticFeedback: boolean;
  /** 同步完成回调 */
  onSyncComplete?: () => void;
}

export interface UseSyncSectionReturn {
  // 连接状态
  status: ConnectionStatus;
  setStatus: (status: ConnectionStatus) => void;
  error: string;
  setError: (error: string) => void;

  // UI 状态
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;

  // 同步状态
  isSyncing: boolean;
  setIsSyncing: (syncing: boolean) => void;
  syncProgress: SyncProgress | null;
  setSyncProgress: (progress: SyncProgress | null) => void;

  // 调试日志
  debugLogs: string[];
  setDebugLogs: (logs: string[]) => void;
  showDebugDrawer: boolean;
  setShowDebugDrawer: (show: boolean) => void;
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
  copySuccess: boolean;
  handleCopyLogs: () => Promise<void>;
  handleSelectAll: () => void;

  // 工具函数
  getStatusColor: () => string;
  getStatusText: () => string;
  notifyCloudSyncStatusChange: () => void;
  triggerHaptic: (type: 'light' | 'medium') => void;
}

/**
 * 同步配置组件共享 Hook
 */
export function useSyncSection(
  enabled: boolean,
  options: UseSyncSectionOptions
): UseSyncSectionReturn {
  const { hapticFeedback } = options;

  // ============================================
  // 连接状态
  // ============================================
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string>('');

  // ============================================
  // UI 状态
  // ============================================
  const [expanded, setExpanded] = useState(false);

  // ============================================
  // 同步状态
  // ============================================
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);

  // ============================================
  // 调试日志
  // ============================================
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebugDrawer, setShowDebugDrawer] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  // 复制日志到剪贴板
  const handleCopyLogs = useCallback(async () => {
    const logText = debugLogs.join('\n');
    try {
      await navigator.clipboard.writeText(logText);
      setCopySuccess(true);
      if (hapticFeedback) {
        hapticsUtils.light();
      }
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // 降级方案：选中文本框内容
      textAreaRef.current?.select();
    }
  }, [debugLogs, hapticFeedback]);

  // 全选文本框内容
  const handleSelectAll = useCallback(() => {
    textAreaRef.current?.select();
  }, []);

  // ============================================
  // 状态显示
  // ============================================

  const getStatusColor = useCallback(() => {
    if (!enabled) return 'bg-neutral-300 dark:bg-neutral-600';
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500 animate-pulse';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-neutral-300 dark:bg-neutral-600';
    }
  }, [enabled, status]);

  const getStatusText = useCallback(() => {
    if (!enabled) return '点击启用';
    switch (status) {
      case 'connected':
        return '已连接';
      case 'connecting':
        return '连接中...';
      case 'error':
        return '连接失败';
      default:
        return '未配置';
    }
  }, [enabled, status]);

  // ============================================
  // 工具函数
  // ============================================

  const notifyCloudSyncStatusChange = useCallback(() => {
    window.dispatchEvent(new CustomEvent('cloudSyncStatusChange'));
  }, []);

  const triggerHaptic = useCallback(
    (type: 'light' | 'medium') => {
      if (hapticFeedback) {
        hapticsUtils[type]();
      }
    },
    [hapticFeedback]
  );

  return {
    // 连接状态
    status,
    setStatus,
    error,
    setError,

    // UI 状态
    expanded,
    setExpanded,

    // 同步状态
    isSyncing,
    setIsSyncing,
    syncProgress,
    setSyncProgress,

    // 调试日志
    debugLogs,
    setDebugLogs,
    showDebugDrawer,
    setShowDebugDrawer,
    textAreaRef,
    copySuccess,
    handleCopyLogs,
    handleSelectAll,

    // 工具函数
    getStatusColor,
    getStatusText,
    notifyCloudSyncStatusChange,
    triggerHaptic,
  };
}
