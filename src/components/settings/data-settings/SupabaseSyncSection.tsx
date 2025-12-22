'use client';

/**
 * Supabase 同步配置组件
 *
 * 2025-12-21 重构：
 * - 简化为纯手动同步
 * - 使用共享 Hook 和组件减少代码重复
 *
 * 2025-12-22 优化：
 * - 添加错误详情抽屉，显示详细同步错误日志
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  simpleSyncService,
  type SyncResult,
} from '@/lib/supabase/simpleSyncService';
import { SUPABASE_SETUP_SQL } from '@/lib/supabase';
import { useSyncSection } from '@/lib/hooks/useSyncSection';
import { buildSyncErrorLogs } from '@/lib/sync/types';
import { SettingsOptions } from '../Settings';
import { Upload, Download, ExternalLink } from 'lucide-react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import DataAlertIcon from '@public/images/icons/ui/data-alert.svg';
import { SyncHeaderButton, SyncDebugDrawer } from './shared';

type SupabaseSyncSettings = NonNullable<SettingsOptions['supabaseSync']>;

interface SupabaseSyncSectionProps {
  settings: SupabaseSyncSettings;
  enabled: boolean;
  hapticFeedback: boolean;
  onSettingChange: <K extends keyof SupabaseSyncSettings>(
    key: K,
    value: SupabaseSyncSettings[K]
  ) => void;
  onSyncComplete?: () => void;
  onEnable?: () => void;
}

export const SupabaseSyncSection: React.FC<SupabaseSyncSectionProps> = ({
  settings,
  enabled,
  hapticFeedback,
  onSettingChange,
  onSyncComplete,
  onEnable,
}) => {
  // ============================================
  // 使用共享 Hook
  // ============================================

  const {
    status,
    setStatus,
    error,
    setError,
    expanded,
    setExpanded,
    isSyncing,
    setIsSyncing,
    debugLogs,
    setDebugLogs,
    showDebugDrawer,
    setShowDebugDrawer,
    textAreaRef: debugTextAreaRef,
    copySuccess: debugCopySuccess,
    handleCopyLogs,
    handleSelectAll,
    getStatusColor,
    getStatusText,
    notifyCloudSyncStatusChange,
    triggerHaptic,
  } = useSyncSection(enabled, { hapticFeedback, onSyncComplete });

  // ============================================
  // Supabase 特有状态
  // ============================================

  const [showAnonKey, setShowAnonKey] = useState(false);
  const [showSQLDrawer, setShowSQLDrawer] = useState(false);
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // ============================================
  // 状态初始化（不自动连接，连接在用户操作时按需建立）
  // ============================================

  useEffect(() => {
    if (!enabled) {
      setStatus('disconnected');
      setError('');
      return;
    }

    const isConfigComplete = settings.url && settings.anonKey;
    if (!isConfigComplete) {
      setStatus('disconnected');
      return;
    }

    // 如果之前成功连接过，显示为已连接状态
    setStatus(settings.lastConnectionSuccess ? 'connected' : 'disconnected');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, settings.lastConnectionSuccess]);

  // ============================================
  // 连接和同步操作
  // ============================================

  const testConnection = async () => {
    if (!settings.url || !settings.anonKey) {
      setError('请填写完整的配置信息');
      setStatus('error');
      return;
    }

    setStatus('connecting');
    setError('');

    try {
      const initialized = simpleSyncService.initialize({
        url: settings.url,
        anonKey: settings.anonKey,
      });

      if (!initialized) {
        setStatus('error');
        setError('初始化失败：请检查 URL 格式');
        return;
      }

      const connected = await simpleSyncService.testConnection();

      if (connected) {
        setStatus('connected');
        onSettingChange('lastConnectionSuccess', true);
        notifyCloudSyncStatusChange();
        triggerHaptic('light');
      } else {
        setStatus('error');
        setError('连接失败：请检查配置和网络，并确保已执行 SQL 初始化脚本');
      }
    } catch (err) {
      setStatus('error');
      setError(`连接失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const performSync = async (direction: 'upload' | 'download') => {
    if (isSyncing) {
      setError('同步正在进行中');
      return;
    }

    // 下载需要确认
    if (direction === 'download') {
      setShowDownloadConfirm(true);
      return;
    }

    await executeSync(direction);
  };

  const executeSync = async (direction: 'upload' | 'download') => {
    setIsSyncing(true);
    setError('');
    setDebugLogs([]); // 清空之前的日志

    try {
      // 按需建立连接
      if (status !== 'connected') {
        const initialized = simpleSyncService.initialize({
          url: settings.url,
          anonKey: settings.anonKey,
        });
        if (!initialized) {
          setStatus('error');
          const errorMsg = '初始化失败，请检查配置';
          setError(errorMsg);
          setDebugLogs(
            buildSyncErrorLogs('Supabase', direction, errorMsg, [
              'Supabase URL 格式可能不正确',
            ])
          );
          setIsSyncing(false);
          return;
        }
        const connected = await simpleSyncService.testConnection();
        if (!connected) {
          setStatus('error');
          const errorMsg = '连接失败，请检查配置';
          setError(errorMsg);
          setDebugLogs(
            buildSyncErrorLogs('Supabase', direction, errorMsg, [
              '请确认 Supabase URL 和 Anon Key 正确',
              '请确认已执行 SQL 初始化脚本',
            ])
          );
          setIsSyncing(false);
          return;
        }
        setStatus('connected');
        onSettingChange('lastConnectionSuccess', true);
      }

      const result: SyncResult =
        direction === 'upload'
          ? await simpleSyncService.uploadAllData()
          : await simpleSyncService.downloadAllData();

      const { showToast } = await import(
        '@/components/common/feedback/LightToast'
      );

      if (result.success) {
        if (result.uploaded > 0 && direction === 'upload') {
          showToast({
            type: 'success',
            title: `已上传 ${result.uploaded} 项到云端`,
            duration: 2500,
          });
        } else if (result.downloaded > 0 && direction === 'download') {
          showToast({
            type: 'success',
            title: `已从云端下载 ${result.downloaded} 项，即将重启...`,
            duration: 2500,
          });
          setTimeout(() => window.location.reload(), 2500);
        } else {
          showToast({
            type: 'info',
            title: '数据已是最新，无需同步',
            duration: 2000,
          });
        }

        triggerHaptic('medium');
        onSyncComplete?.();
      } else {
        setError(result.message);
        setDebugLogs(
          buildSyncErrorLogs(
            'Supabase',
            direction,
            result.message,
            result.errors
          )
        );
        showToast({
          type: 'error',
          title: result.message,
          duration: 3000,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '同步失败';
      const errorStack = err instanceof Error ? err.stack : undefined;
      setError(errorMsg);
      setDebugLogs(
        buildSyncErrorLogs('Supabase', direction, errorMsg, [
          errorStack || errorMsg,
        ])
      );

      const { showToast } = await import(
        '@/components/common/feedback/LightToast'
      );
      showToast({
        type: 'error',
        title: `同步失败: ${errorMsg}`,
        duration: 3000,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // ============================================
  // 辅助函数
  // ============================================

  const handleCopySQL = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
      setCopySuccess(true);
      triggerHaptic('light');
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      textAreaRef.current?.select();
    }
  };

  // ============================================
  // UI 渲染
  // ============================================

  return (
    <div className="ml-0 space-y-3">
      {/* 头部按钮 */}
      <SyncHeaderButton
        serviceName="Supabase"
        enabled={enabled}
        status={status}
        expanded={expanded}
        statusColor={getStatusColor()}
        statusText={getStatusText()}
        onClick={() => {
          if (!enabled && onEnable) {
            onEnable();
          }
          setExpanded(!expanded);
        }}
      />

      {/* 配置表单 */}
      {enabled && expanded && (
        <div className="space-y-3 rounded bg-neutral-100 p-4 dark:bg-neutral-800">
          {/* Supabase URL */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Supabase URL
            </label>
            <input
              type="url"
              value={settings.url}
              onChange={e => onSettingChange('url', e.target.value)}
              placeholder="https://xxx.supabase.co"
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
            />
          </div>

          {/* Anon Key */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Anon Key
            </label>
            <div className="relative">
              <input
                type={showAnonKey ? 'text' : 'password'}
                value={settings.anonKey}
                onChange={e => onSettingChange('anonKey', e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR..."
                className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 pr-10 text-sm focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
              />
              <button
                type="button"
                onClick={() => setShowAnonKey(!showAnonKey)}
                className="absolute top-1/2 right-2 -translate-y-1/2 transform p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {showAnonKey ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464m1.414 1.414L8.464 8.464m5.656 5.656L15.536 15.536m-1.414-1.414L15.536 15.536"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* SQL 脚本按钮 */}
          <button
            onClick={() => setShowSQLDrawer(true)}
            className="flex w-full items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          >
            <span>查看初始化 SQL 脚本</span>
            <ExternalLink className="h-4 w-4" />
          </button>

          {/* 错误信息 */}
          {error && (
            <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              {debugLogs.length > 0 && (
                <button
                  onClick={() => setShowDebugDrawer(true)}
                  className="mt-2 text-xs font-medium text-red-700 underline hover:text-red-800 dark:text-red-300 dark:hover:text-red-200"
                >
                  查看详细日志
                </button>
              )}
            </div>
          )}

          {/* 测试连接按钮 */}
          <button
            onClick={testConnection}
            disabled={status === 'connecting'}
            className="w-full rounded-md bg-neutral-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-900 disabled:bg-neutral-400 dark:bg-neutral-700 dark:hover:bg-neutral-600"
          >
            {status === 'connecting' ? '连接中...' : '测试连接'}
          </button>
        </div>
      )}

      {/* 同步按钮 */}
      {enabled && status === 'connected' && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => performSync('upload')}
            disabled={isSyncing}
            className="flex items-center justify-center gap-2 rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            <Upload className={`h-4 w-4 ${isSyncing ? 'animate-pulse' : ''}`} />
            <span>上传</span>
          </button>
          <button
            onClick={() => performSync('download')}
            disabled={isSyncing}
            className="flex items-center justify-center gap-2 rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            <Download
              className={`h-4 w-4 ${isSyncing ? 'animate-pulse' : ''}`}
            />
            <span>下载</span>
          </button>
        </div>
      )}

      {/* SQL 脚本抽屉 */}
      <ActionDrawer
        isOpen={showSQLDrawer}
        onClose={() => setShowSQLDrawer(false)}
        historyId="supabase-sql-drawer"
      >
        <ActionDrawer.Icon icon={DataAlertIcon} />
        <ActionDrawer.Content>
          <p className="mb-3 text-neutral-500 dark:text-neutral-400">
            请在 Supabase 项目的{' '}
            <span className="text-neutral-800 dark:text-neutral-200">
              SQL Editor
            </span>{' '}
            中执行以下脚本来创建所需的数据表。
          </p>
          <textarea
            ref={textAreaRef}
            readOnly
            onClick={() => textAreaRef.current?.select()}
            value={SUPABASE_SETUP_SQL}
            className="h-48 w-full resize-none rounded-md border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs leading-relaxed text-neutral-700 focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          />
        </ActionDrawer.Content>
        <ActionDrawer.Actions>
          <ActionDrawer.SecondaryButton onClick={() => setShowSQLDrawer(false)}>
            关闭
          </ActionDrawer.SecondaryButton>
          <ActionDrawer.PrimaryButton onClick={handleCopySQL}>
            {copySuccess ? '已复制' : '复制脚本'}
          </ActionDrawer.PrimaryButton>
        </ActionDrawer.Actions>
      </ActionDrawer>

      {/* 下载确认抽屉 */}
      <ActionDrawer
        isOpen={showDownloadConfirm}
        onClose={() => setShowDownloadConfirm(false)}
        historyId="supabase-download-confirm"
      >
        <ActionDrawer.Icon icon={DataAlertIcon} />
        <ActionDrawer.Content>
          <p className="mb-2 text-base font-medium text-neutral-800 dark:text-neutral-200">
            ⚠️ 数据覆盖警告
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            下载操作将用云端数据完全覆盖本地数据，此操作不可撤销。
          </p>
          <p className="mt-2 text-sm font-medium text-red-500 dark:text-red-400">
            请确保您已备份重要数据！
          </p>
        </ActionDrawer.Content>
        <ActionDrawer.Actions>
          <ActionDrawer.SecondaryButton
            onClick={() => setShowDownloadConfirm(false)}
          >
            取消
          </ActionDrawer.SecondaryButton>
          <ActionDrawer.PrimaryButton
            onClick={() => {
              setShowDownloadConfirm(false);
              executeSync('download');
            }}
          >
            确认下载
          </ActionDrawer.PrimaryButton>
        </ActionDrawer.Actions>
      </ActionDrawer>

      {/* 同步日志抽屉 */}
      <SyncDebugDrawer
        isOpen={showDebugDrawer}
        onClose={() => setShowDebugDrawer(false)}
        logs={debugLogs}
        textAreaRef={debugTextAreaRef}
        copySuccess={debugCopySuccess}
        onCopy={handleCopyLogs}
        onSelectAll={handleSelectAll}
        title="Supabase 同步"
      />
    </div>
  );
};

export default SupabaseSyncSection;
