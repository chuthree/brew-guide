'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  simpleSyncService,
  type SyncResult,
} from '@/lib/supabase/simpleSyncService';
import { SUPABASE_SETUP_SQL } from '@/lib/supabase';
import { useSyncStatusStore } from '@/lib/stores/syncStatusStore';
import hapticsUtils from '@/lib/ui/haptics';
import { SettingsOptions } from '../Settings';
import { ChevronRight, ExternalLink } from 'lucide-react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import DataAlertIcon from '@public/images/icons/ui/data-alert.svg';

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
}) => {
  // 全局同步状态 Store
  const setSyncProvider = useSyncStatusStore(state => state.setProvider);
  const setSyncSuccess = useSyncStatusStore(state => state.setSyncSuccess);
  const setSyncError = useSyncStatusStore(state => state.setSyncError);
  const resetSyncStatus = useSyncStatusStore(state => state.reset);

  // 连接状态
  const [status, setStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
  const [error, setError] = useState<string>('');
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // 同步状态
  const [isSyncing, setIsSyncing] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<
    'connected' | 'disconnected'
  >('disconnected');

  // SQL 脚本抽屉
  const [showSQLDrawer, setShowSQLDrawer] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // 初始化标记
  const initRef = useRef(false);

  // 同步全局状态
  useEffect(() => {
    if (enabled && status === 'connected') {
      setSyncProvider('supabase');
      // 如果已连接，确保全局状态也是 success（而不是停留在 syncing）
      setSyncSuccess();
    } else if (!enabled) {
      resetSyncStatus();
    }
  }, [enabled, status, setSyncProvider, setSyncSuccess, resetSyncStatus]);

  // 初始化连接
  useEffect(() => {
    if (!enabled) {
      setStatus('disconnected');
      setError('');
      simpleSyncService.disconnect();
      initRef.current = false;
      return;
    }

    if (!settings.url || !settings.anonKey) {
      setStatus('disconnected');
      return;
    }

    // 避免重复初始化
    if (initRef.current && simpleSyncService.isInitialized()) {
      setStatus('connected');
      setRealtimeStatus(simpleSyncService.getRealtimeStatus());
      return;
    }

    const connect = async () => {
      setStatus('connecting');
      setError('');

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
        initRef.current = true;

        // 启动实时同步
        if (settings.realtimeEnabled) {
          simpleSyncService.startRealtimeSync();
          simpleSyncService.startLocalChangeListeners();
          setRealtimeStatus('connected');
        }

        window.dispatchEvent(new CustomEvent('cloudSyncStatusChange'));
        console.log('✅ [Supabase] 连接成功');
      } else {
        setStatus('error');
        setError('连接失败：请检查配置和网络，并确保已执行 SQL 初始化脚本');
        onSettingChange('lastConnectionSuccess', false);
      }
    };

    connect();

    // 清理函数：组件卸载时执行（无论 enabled 是什么值）
    return () => {
      // 不再需要条件判断，因为如果 enabled 为 true，这个组件会继续存在
      // 只有当组件真正卸载时（enabled 变为 false）才会执行这里
    };
  }, [
    enabled,
    settings.url,
    settings.anonKey,
    settings.realtimeEnabled,
    onSettingChange,
  ]);

  // 监控实时状态
  useEffect(() => {
    if (status !== 'connected') return;

    const interval = setInterval(() => {
      setRealtimeStatus(simpleSyncService.getRealtimeStatus());
    }, 3000);

    return () => clearInterval(interval);
  }, [status]);

  // 切换实时同步
  const toggleRealtime = () => {
    if (settings.realtimeEnabled) {
      simpleSyncService.stopRealtimeSync();
      simpleSyncService.stopLocalChangeListeners();
      onSettingChange('realtimeEnabled', false);
      setRealtimeStatus('disconnected');
    } else {
      simpleSyncService.startRealtimeSync();
      simpleSyncService.startLocalChangeListeners();
      onSettingChange('realtimeEnabled', true);
      setRealtimeStatus('connected');
    }

    if (hapticFeedback) hapticsUtils.light();
  };

  // 执行同步
  const performSync = async (direction: 'upload' | 'download' | 'full') => {
    if (status !== 'connected' || isSyncing) return;

    setIsSyncing(true);
    setError('');

    try {
      let result: SyncResult;

      if (direction === 'upload') {
        result = await simpleSyncService.uploadAllData();
      } else if (direction === 'download') {
        result = await simpleSyncService.downloadAllData();
      } else {
        result = await simpleSyncService.fullSync();
      }

      const { showToast } = await import(
        '@/components/common/feedback/LightToast'
      );

      if (result.success) {
        if (result.uploaded > 0 || result.downloaded > 0) {
          showToast({
            type: 'success',
            title: result.message,
            duration: 2500,
          });
        } else {
          showToast({
            type: 'info',
            title: '数据已是最新',
            duration: 2000,
          });
        }

        if (hapticFeedback) hapticsUtils.medium();
        onSyncComplete?.();
      } else {
        setError(result.message);
        showToast({
          type: 'error',
          title: result.message,
          duration: 3000,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '同步失败';
      setError(msg);
    } finally {
      setIsSyncing(false);
    }
  };

  // 测试连接
  const testConnection = async () => {
    if (!settings.url || !settings.anonKey) {
      setError('请填写完整的配置信息');
      return;
    }

    setStatus('connecting');
    setError('');

    const initialized = simpleSyncService.initialize({
      url: settings.url,
      anonKey: settings.anonKey,
    });

    if (!initialized) {
      setStatus('error');
      setError('初始化失败');
      setSyncError('初始化失败');
      return;
    }

    const connected = await simpleSyncService.testConnection();

    if (connected) {
      setStatus('connected');
      setSyncProvider('supabase');
      onSettingChange('lastConnectionSuccess', true);
      initRef.current = true;

      if (hapticFeedback) hapticsUtils.light();
      window.dispatchEvent(new CustomEvent('cloudSyncStatusChange'));

      // 连接成功后自动下载云端数据
      setIsSyncing(true);
      try {
        const result = await simpleSyncService.downloadAllData();

        const { showToast } = await import(
          '@/components/common/feedback/LightToast'
        );

        if (result.success && result.downloaded > 0) {
          showToast({
            type: 'success',
            title: `已同步 ${result.downloaded} 条数据`,
            duration: 2000,
          });
          setSyncSuccess();
          onSyncComplete?.();
        } else if (result.success) {
          showToast({
            type: 'info',
            title: '数据已是最新',
            duration: 2000,
          });
          setSyncSuccess();
        } else {
          // 下载有错误
          showToast({
            type: 'error',
            title: result.message,
            duration: 3000,
          });
          setSyncError(result.message);
        }
      } catch (err) {
        console.error('自动下载失败:', err);
        const errorMsg = err instanceof Error ? err.message : '下载失败';
        setSyncError(errorMsg);
      } finally {
        setIsSyncing(false);
      }
    } else {
      setStatus('error');
      setError('连接失败：请检查配置');
    }
  };

  // 复制 SQL
  const handleCopySQL = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
      setCopySuccess(true);
      if (hapticFeedback) hapticsUtils.light();
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      textAreaRef.current?.select();
    }
  };

  // 状态颜色
  const getStatusColor = () => {
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
  };

  // 状态文本
  const getStatusText = () => {
    if (!enabled) return '点击启用';
    switch (status) {
      case 'connected':
        return realtimeStatus === 'connected' ? '实时同步中' : '已连接';
      case 'connecting':
        return '连接中...';
      case 'error':
        return '连接失败';
      default:
        return '未配置';
    }
  };

  return (
    <div className="space-y-3">
      {/* 展开/收起按钮 */}
      <button
        onClick={() => {
          setExpanded(!expanded);
          if (hapticFeedback) hapticsUtils.light();
        }}
        className="flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
      >
        <div className="flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full ${getStatusColor()}`} />
          <span>Supabase 配置</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {getStatusText()}
          </span>
          <ChevronRight
            className={`h-4 w-4 text-neutral-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        </div>
      </button>

      {/* 展开内容 */}
      {expanded && (
        <div className="space-y-4 rounded bg-neutral-100 p-4 dark:bg-neutral-800">
          {/* URL 输入 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Supabase URL
            </label>
            <input
              type="url"
              value={settings.url}
              onChange={e => onSettingChange('url', e.target.value)}
              placeholder="https://xxx.supabase.co"
              className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-200"
            />
          </div>

          {/* Anon Key 输入 */}
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
                className="w-full rounded border border-neutral-300 bg-white px-3 py-2 pr-16 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-200"
              />
              <button
                onClick={() => setShowAnonKey(!showAnonKey)}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
              >
                {showAnonKey ? '隐藏' : '显示'}
              </button>
            </div>
          </div>

          {/* SQL 脚本按钮 */}
          <button
            onClick={() => setShowSQLDrawer(true)}
            className="flex w-full items-center justify-between rounded bg-neutral-200 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
          >
            <span>查看初始化 SQL 脚本</span>
            <ExternalLink className="h-4 w-4" />
          </button>

          {/* 测试连接按钮 */}
          <button
            onClick={testConnection}
            disabled={status === 'connecting'}
            className="w-full rounded bg-neutral-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-200 dark:text-neutral-800 dark:hover:bg-neutral-300"
          >
            {status === 'connecting' ? '连接中...' : '测试连接'}
          </button>

          {/* 错误信息 */}
          {error && (
            <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {/* 已连接时显示同步选项 */}
          {status === 'connected' && (
            <>
              {/* 分割线 */}
              <div className="border-t border-neutral-200 dark:border-neutral-700" />

              {/* 实时同步开关 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                    实时同步
                  </span>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={settings.realtimeEnabled}
                    onChange={toggleRealtime}
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-green-500 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700" />
                </label>
              </div>

              {/* 同步按钮组 */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => performSync('upload')}
                  disabled={isSyncing}
                  className="flex flex-col items-center gap-1 rounded bg-neutral-200 px-3 py-3 text-neutral-700 transition-colors hover:bg-neutral-300 disabled:opacity-50 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
                >
                  <span className="text-xs">上传</span>
                </button>
                <button
                  onClick={() => performSync('download')}
                  disabled={isSyncing}
                  className="flex flex-col items-center gap-1 rounded bg-neutral-200 px-3 py-3 text-neutral-700 transition-colors hover:bg-neutral-300 disabled:opacity-50 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
                >
                  <span className="text-xs">下载</span>
                </button>
                <button
                  onClick={() => performSync('full')}
                  disabled={isSyncing}
                  className="flex flex-col items-center gap-1 rounded bg-neutral-200 px-3 py-3 text-neutral-700 transition-colors hover:bg-neutral-300 disabled:opacity-50 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
                >
                  <span className="text-xs">完整同步</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* SQL 脚本抽屉 */}
      <ActionDrawer
        isOpen={showSQLDrawer}
        onClose={() => setShowSQLDrawer(false)}
      >
        <ActionDrawer.Icon icon={DataAlertIcon} />
        <ActionDrawer.Content>
          <p className="mb-2 text-base font-medium text-neutral-800 dark:text-neutral-200">
            初始化 SQL 脚本
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            请在 Supabase 项目的 SQL Editor 中执行以下脚本来创建所需的数据表
          </p>
          <div className="mt-4 max-h-48 overflow-auto rounded bg-neutral-100 p-3 dark:bg-neutral-700">
            <textarea
              ref={textAreaRef}
              readOnly
              value={SUPABASE_SETUP_SQL}
              className="h-full w-full resize-none bg-transparent font-mono text-xs text-neutral-700 outline-none dark:text-neutral-300"
              rows={10}
            />
          </div>
        </ActionDrawer.Content>
        <ActionDrawer.Actions>
          <ActionDrawer.SecondaryButton onClick={() => setShowSQLDrawer(false)}>
            关闭
          </ActionDrawer.SecondaryButton>
          <ActionDrawer.PrimaryButton onClick={handleCopySQL}>
            {copySuccess ? <>已复制</> : <>复制脚本</>}
          </ActionDrawer.PrimaryButton>
        </ActionDrawer.Actions>
      </ActionDrawer>
    </div>
  );
};

export default SupabaseSyncSection;
