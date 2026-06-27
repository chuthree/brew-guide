'use client';

/**
 * Supabase 同步配置组件
 *
 * 功能：
 * 1. 配置 Supabase URL 和 Anon Key
 * 2. 测试连接
 * 3. 显示实时同步状态
 *
 * 注意：移除了手动上传/下载按钮，改为全自动实时同步
 */

import React, { useState, useRef, useEffect } from 'react';
import { SUPABASE_SETUP_SQL } from '@/lib/supabase';
import { SettingsOptions } from '../Settings';
import { ExternalLink, Eye, EyeOff } from 'lucide-react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import DataAlertIcon from '@public/images/icons/ui/data-alert.svg';
import { SyncHeaderButton } from './shared/SyncHeaderButton';
import {
  useSyncStatusStore,
  type SupabaseSyncProgress,
  type SupabaseSyncTask,
  type SupabaseSyncTaskStatus,
} from '@/lib/stores/syncStatusStore';
import { getRealtimeSyncService } from '@/lib/supabase/realtime';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

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

const TASK_STATUS_LABELS: Record<SupabaseSyncTaskStatus, string> = {
  pending: '等待',
  preparing: '准备',
  fetching: '检查',
  uploading: '上传',
  downloading: '下载',
  writing: '写入',
  verifying: '校验',
  queued: '已排队',
  success: '完成',
  warning: '待处理',
  error: '失败',
};

function getTaskProgressPercent(task: SupabaseSyncTask): number | null {
  if (!task.total || task.total <= 0) return null;
  const completed = task.completed ?? 0;
  return Math.min(100, Math.max(0, Math.round((completed / task.total) * 100)));
}

function getTaskProgressUnits(task: SupabaseSyncTask) {
  if (task.total && task.total > 0) {
    return {
      completed: Math.min(task.completed ?? 0, task.total),
      total: task.total,
    };
  }

  return {
    completed: task.status === 'success' ? 1 : 0,
    total: 1,
  };
}

function getOverallProgressPercent(tasks: SupabaseSyncTask[]): number | null {
  if (tasks.length === 0) return null;

  const totals = tasks.reduce(
    (acc, task) => {
      const units = getTaskProgressUnits(task);
      return {
        completed: acc.completed + units.completed,
        total: acc.total + units.total,
      };
    },
    { completed: 0, total: 0 }
  );

  if (totals.total <= 0) return null;
  return Math.min(
    100,
    Math.max(0, Math.round((totals.completed / totals.total) * 100))
  );
}

const SupabaseSyncProgressPanel: React.FC<{
  progress: SupabaseSyncProgress;
  pendingChangesCount: number;
}> = ({ progress, pendingChangesCount }) => {
  const visibleProgressTasks = progress.tasks.filter(
    task =>
      progress.active ||
      task.status === 'error' ||
      task.status === 'warning' ||
      task.status === 'queued'
  );
  const hasOfflineQueueTask = visibleProgressTasks.some(
    task => task.id === 'offline_queue'
  );
  const showProgressPanel =
    progress.active ||
    visibleProgressTasks.length > 0 ||
    pendingChangesCount > 0;
  const overallPercent = progress.active
    ? getOverallProgressPercent(visibleProgressTasks)
    : null;
  const panelTitle = progress.active
    ? `同步进度${overallPercent !== null ? ` ${overallPercent}%` : ''}`
    : pendingChangesCount > 0
      ? '待同步变更'
      : '上次同步未完成';
  const panelMessage = progress.active
    ? `${progress.message || '正在同步 Supabase 数据'}，请不要离开应用或关闭窗口。`
    : progress.message;

  if (!showProgressPanel) return null;

  return (
    <div className="rounded-md bg-white p-3 shadow-[0_0_0_1px_rgba(0,0,0,0.06)] dark:bg-neutral-900 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
      <div className="space-y-1">
        <p className="text-sm font-medium text-neutral-800 tabular-nums dark:text-neutral-100">
          {panelTitle}
        </p>
        {panelMessage && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {panelMessage}
          </p>
        )}
      </div>

      {overallPercent !== null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            className="h-full rounded-full bg-neutral-800 transition-[width] duration-300 dark:bg-neutral-200"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
      )}

      {visibleProgressTasks.length > 0 && (
        <div className="mt-3 space-y-2">
          {visibleProgressTasks.map(task => {
            const percent = getTaskProgressPercent(task);
            const detail = task.error || task.detail;
            const taskLine = `${task.label} · ${TASK_STATUS_LABELS[task.status]}${
              percent !== null ? ` ${percent}%` : ''
            }`;

            return (
              <div
                key={task.id}
                className="space-y-1.5 rounded-md bg-neutral-50 p-2.5 dark:bg-neutral-950/40"
              >
                <p className="text-xs font-medium text-neutral-800 tabular-nums dark:text-neutral-100">
                  {taskLine}
                </p>
                {detail && (
                  <p className="text-xs break-words text-neutral-500 dark:text-neutral-400">
                    {detail}
                  </p>
                )}

                {percent !== null && progress.active && (
                  <div className="h-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-neutral-800 transition-[width] duration-300 dark:bg-neutral-200"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pendingChangesCount > 0 && !hasOfflineQueueTask && (
        <p className="mt-3 rounded-md bg-neutral-50 p-2 text-xs text-neutral-600 dark:bg-neutral-950/40 dark:text-neutral-400">
          {pendingChangesCount} 个变更待同步
        </p>
      )}
    </div>
  );
};

export const SupabaseSyncSection: React.FC<SupabaseSyncSectionProps> = ({
  settings,
  enabled,
  hapticFeedback,
  onSettingChange,
  onEnable,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [showSQLDrawer, setShowSQLDrawer] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [error, setError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const { realtimeStatus, pendingChangesCount, supabaseSyncProgress } =
    useSyncStatusStore();

  const triggerHaptic = (style: 'light' | 'medium' = 'light') => {
    if (hapticFeedback) {
      Haptics.impact({
        style: style === 'light' ? ImpactStyle.Light : ImpactStyle.Medium,
      }).catch(() => {});
    }
  };

  // 根据实时同步状态确定显示状态
  const getDisplayStatus = () => {
    if (!enabled) return 'disconnected';
    if (isConnecting) return 'connecting';
    if (realtimeStatus === 'connected') return 'connected';
    if (realtimeStatus === 'connecting') return 'connecting';
    if (realtimeStatus === 'error') return 'error';
    return 'disconnected';
  };

  const status = getDisplayStatus();
  const visibleError =
    error && status !== 'connected' && !supabaseSyncProgress.active
      ? error
      : '';

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
      case 'error':
        return 'bg-neutral-500';
      default:
        return 'bg-neutral-300 dark:bg-neutral-600';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return '已连接';
      case 'connecting':
        return '连接中...';
      case 'error':
        return '连接失败';
      default:
        return '未连接';
    }
  };

  // 连接/重连实时同步服务
  const connectRealtimeSync = async () => {
    if (!settings.url || !settings.anonKey) {
      setError('请填写完整的配置信息');
      return;
    }

    setIsConnecting(true);
    setError('');

    try {
      const service = getRealtimeSyncService();
      const connected = await service.connect({
        url: settings.url,
        anonKey: settings.anonKey,
        enableOfflineQueue: true,
      });

      if (connected) {
        onSettingChange('lastConnectionSuccess', true);
        triggerHaptic('medium');
      } else {
        setError('连接失败：请检查配置和网络，并确保已执行 SQL 初始化脚本');
      }
    } catch (err) {
      setError(`连接失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setIsConnecting(false);
    }
  };

  // 当配置完整且启用时，自动连接
  useEffect(() => {
    if (
      enabled &&
      settings.url &&
      settings.anonKey &&
      realtimeStatus === 'disconnected'
    ) {
      // 延迟一点避免频繁连接
      const timer = setTimeout(() => {
        connectRealtimeSync();
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, settings.url, settings.anonKey]);

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

  return (
    <div className="ml-0 space-y-3">
      <SyncHeaderButton
        serviceName="Supabase"
        enabled={enabled}
        status={status}
        expanded={expanded}
        statusColor={getStatusColor()}
        statusText={getStatusText()}
        onClick={() => {
          if (!enabled && onEnable) onEnable();
          setExpanded(!expanded);
        }}
      />

      {enabled && expanded && (
        <div className="space-y-3 rounded bg-neutral-100 p-4 dark:bg-neutral-800">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Supabase URL
            </label>
            <input
              type="url"
              value={settings.url}
              onChange={e => onSettingChange('url', e.target.value)}
              placeholder="https://xxx.supabase.co"
              className="w-full rounded-md border border-neutral-200/50 bg-neutral-50 px-3 py-2 text-sm focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
            />
          </div>

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
                className="w-full rounded-md border border-neutral-200/50 bg-neutral-50 px-3 py-2 pr-10 text-sm focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
              />
              <button
                type="button"
                onClick={() => setShowAnonKey(!showAnonKey)}
                className="absolute top-1/2 right-2 -translate-y-1/2 transform p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                {showAnonKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowSQLDrawer(true)}
            className="flex w-full items-center justify-between rounded-md border border-neutral-200/50 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          >
            <span>查看初始化 SQL 脚本</span>
            <ExternalLink className="h-4 w-4" />
          </button>

          {visibleError && (
            <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
              <p className="text-xs text-red-600 dark:text-red-400">
                {visibleError}
              </p>
            </div>
          )}

          <SupabaseSyncProgressPanel
            progress={supabaseSyncProgress}
            pendingChangesCount={pendingChangesCount}
          />
        </div>
      )}

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
            className="h-48 w-full resize-none rounded-md border border-neutral-200/50 bg-neutral-50 p-3 font-mono text-xs leading-relaxed text-neutral-700 focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
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
    </div>
  );
};
