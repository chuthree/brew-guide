/**
 * 同步配置组件共享 Hook
 *
 * 为 S3SyncSection、WebDAVSyncSection 提供统一的状态管理
 */

import { useState, useCallback } from 'react';
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

    // 工具函数
    getStatusColor,
    getStatusText,
    notifyCloudSyncStatusChange,
    triggerHaptic,
  };
}
