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
import { ExternalLink, Wifi, WifiOff, RefreshCw, Clock } from 'lucide-react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import DataAlertIcon from '@public/images/icons/ui/data-alert.svg';
import { SyncHeaderButton } from './shared';
import { useSyncStatusStore } from '@/lib/stores/syncStatusStore';
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

  // 实时同步状态
  const { realtimeStatus, pendingChangesCount } = useSyncStatusStore();

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
    return settings.lastConnectionSuccess ? 'connected' : 'disconnected';
  };

  const status = getDisplayStatus();

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-amber-500';
      case 'error':
        return 'bg-red-500';
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

          <button
            onClick={() => setShowSQLDrawer(true)}
            className="flex w-full items-center justify-between rounded-md border border-neutral-200/50 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          >
            <span>查看初始化 SQL 脚本</span>
            <ExternalLink className="h-4 w-4" />
          </button>

          {error && (
            <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* 实时同步状态和控制 */}
          <div className="rounded-md border border-neutral-200/50 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {realtimeStatus === 'connected' ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : realtimeStatus === 'connecting' || isConnecting ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-neutral-400" />
                )}
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  实时同步
                </span>
              </div>
              <span
                className={`text-xs font-medium ${
                  realtimeStatus === 'connected'
                    ? 'text-green-600 dark:text-green-400'
                    : realtimeStatus === 'connecting' || isConnecting
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-neutral-500'
                }`}
              >
                {realtimeStatus === 'connected'
                  ? '已连接'
                  : realtimeStatus === 'connecting' || isConnecting
                    ? '连接中...'
                    : realtimeStatus === 'error'
                      ? '连接失败'
                      : '未连接'}
              </span>
            </div>

            {pendingChangesCount > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <Clock className="h-3.5 w-3.5" />
                <span>{pendingChangesCount} 个变更待同步</span>
              </div>
            )}

            {realtimeStatus === 'connected' && pendingChangesCount === 0 && (
              <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                本地变更将自动同步到云端
              </p>
            )}

            {realtimeStatus !== 'connected' &&
              realtimeStatus !== 'connecting' &&
              !isConnecting && (
                <button
                  onClick={connectRealtimeSync}
                  className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                >
                  {settings.url && settings.anonKey ? '连接' : '请先填写配置'}
                </button>
              )}
          </div>
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
