'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronRight } from 'lucide-react';
import { SettingsOptions } from './Settings';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import {
  BackupReminderSettings,
  BackupReminderUtils,
  BACKUP_REMINDER_INTERVALS,
  BackupReminderInterval,
} from '@/lib/utils/backupReminderUtils';
import hapticsUtils from '@/lib/ui/haptics';
import SettingPage from './atomic/SettingPage';
import SettingSelect from './atomic/SettingSelect';
import SettingNotice from './atomic/SettingNotice';
import { getBooleanState, saveBooleanState } from '@/lib/core/statePersistence';
import {
  SettingSection,
  SettingRow,
  SettingToggle,
  useScrollToHighlightedSetting,
} from './atomic';
import { S3SyncSection } from './data-settings/S3SyncSection';
import { WebDAVSyncSection } from './data-settings/WebDAVSyncSection';
import { SupabaseSyncSection } from './data-settings/SupabaseSyncSection';
import { DataManagementSection } from './data-settings/DataManagementSection';
import WebDAVTutorialModal from './data-settings/WebDAVTutorialModal';
import { detectAppRuntime } from '@/lib/app/runtime';
import { resolveStorageBackend } from '@/lib/data/runtime';
import PersistentStorageManager, {
  isPersistentStorageSupported,
  isPWAMode,
} from '@/lib/utils/persistentStorage';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import {
  type CloudSyncType,
  type S3SyncSettings,
  type WebDAVSyncSettings,
  type SupabaseSyncSettings,
  normalizeS3Settings,
  normalizeWebDAVSettings,
  normalizeSupabaseSettings,
} from '@/lib/hooks/useCloudSyncSettings';
import {
  type ManualSyncProvider,
  getCloudProviderLabel,
  getConnectedManualSyncProvider,
  getResolvedActiveSyncType,
  getSelectedManualSyncProvider,
  getSupabaseBackupProvider,
  isPullToSyncEnabled,
} from '@/lib/sync/settings';
import { makeSettingRowSearchId } from './settingsSearch';

interface DataSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
  onDataChange?: () => void;
}

function canUsePullToSync(): boolean {
  if (typeof window === 'undefined') return false;

  const hasTouchPoints =
    typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  return hasTouchPoints || hasCoarsePointer;
}

const DataSettings: React.FC<DataSettingsProps> = ({
  settings: _settings,
  onClose,
  handleChange: _handleChange,
  onDataChange,
}) => {
  // 使用 settingsStore 获取设置
  const settings = useSettingsStore(state => state.settings) as SettingsOptions;
  const updateSettings = useSettingsStore(state => state.updateSettings);

  // 使用 settingsStore 的 handleChange
  const handleChange = React.useCallback(
    async <K extends keyof SettingsOptions>(
      key: K,
      value: SettingsOptions[K]
    ) => {
      await updateSettings({ [key]: value } as any);
    },
    [updateSettings]
  );

  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // 动画状态
  const [isVisible, setIsVisible] = useState(false);

  // 云同步设置
  const [s3Settings, setS3Settings] = useState<S3SyncSettings>(() =>
    normalizeS3Settings(settings.s3Sync)
  );
  const [webdavSettings, setWebDAVSettings] = useState<WebDAVSyncSettings>(() =>
    normalizeWebDAVSettings(settings.webdavSync)
  );
  const [supabaseSettings, setSupabaseSettings] =
    useState<SupabaseSyncSettings>(() =>
      normalizeSupabaseSettings(settings.supabaseSync)
    );

  // 备份提醒设置
  const [backupReminderSettings, setBackupReminderSettings] =
    useState<BackupReminderSettings | null>(null);
  const [nextReminderText, setNextReminderText] = useState('');

  // 持久化存储状态
  const [isPersisted, setIsPersisted] = useState<boolean | null>(null);
  const storageNoticeId = isPersistentStorageSupported()
    ? 'storage-browser-mode'
    : 'storage-unsupported';
  const [isStorageNoticeDismissed, setIsStorageNoticeDismissed] = useState(() =>
    getBooleanState('setting-notices', storageNoticeId)
  );
  const [isRequestingPersist, setIsRequestingPersist] = useState(false);
  const [usesBrowserStorage] = useState(
    () => resolveStorageBackend(detectAppRuntime()) === 'dexie'
  );
  const [isPWA] = useState(() => usesBrowserStorage && isPWAMode());
  const [supportsPullToSync, setSupportsPullToSync] = useState(false);

  // 云同步类型选择
  // WebDAV 教程弹窗
  const [showWebDAVTutorial, setShowWebDAVTutorial] = useState(false);

  // 云同步类型：使用本地 state 管理，确保 UI 即时响应
  const [activeSyncType, setActiveSyncType] = useState<CloudSyncType>(() => {
    return getResolvedActiveSyncType(settings);
  });
  const [supabaseBackupProvider, setSupabaseBackupProvider] =
    useState<ManualSyncProvider>(() => getSupabaseBackupProvider(settings));

  // syncType 直接使用本地 state
  const syncType = activeSyncType;

  const resolvedSyncSettings: SettingsOptions = {
    ...settings,
    activeSyncType: syncType,
    supabaseBackupProvider,
    s3Sync: s3Settings,
    webdavSync: webdavSettings,
    supabaseSync: supabaseSettings,
  };

  // 关闭处理函数（带动画）
  const handleCloseWithAnimation = React.useCallback(() => {
    setIsVisible(false);
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));
    setTimeout(() => {
      onCloseRef.current();
    }, 350);
  }, []);

  // 使用统一的历史栈管理系统
  useModalHistory({
    id: 'data-settings',
    isOpen: true, // 子设置页面挂载即为打开状态
    onClose: handleCloseWithAnimation,
    skipPageExitTransitionOnHistory: true,
  });

  // 动画初始化（入场动画）
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });
  }, []);

  useEffect(() => {
    const updatePullToSyncSupport = () => {
      setSupportsPullToSync(canUsePullToSync());
    };

    updatePullToSyncSupport();

    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(pointer: coarse)');
    mediaQuery.addEventListener('change', updatePullToSyncSupport);

    return () => {
      mediaQuery.removeEventListener('change', updatePullToSyncSupport);
    };
  }, []);

  // 加载持久化存储状态
  useEffect(() => {
    const loadStorageStatus = async () => {
      // 原生 SQLite 不使用浏览器持久化权限，此处不判断其初始化状态。
      if (!usesBrowserStorage) return;

      try {
        const persisted = await PersistentStorageManager.checkPersisted();
        setIsPersisted(persisted);
      } catch (error) {
        console.error('加载存储状态失败:', error);
      }
    };

    loadStorageStatus();
  }, [usesBrowserStorage]);

  // 加载备份提醒设置
  useEffect(() => {
    const loadBackupReminderSettings = async () => {
      try {
        const reminderSettings = await BackupReminderUtils.getSettings();
        setBackupReminderSettings(reminderSettings);
        const nextText = await BackupReminderUtils.getNextReminderText();
        setNextReminderText(nextText);
      } catch (error) {
        console.error('加载备份提醒设置失败:', error);
      }
    };
    loadBackupReminderSettings();
  }, []);

  // 仅在组件首次加载时从 settings 中读取配置
  // 之后的更新都通过本地状态管理，避免被 settings 覆盖

  // 关闭处理
  const handleClose = () => {
    modalHistory.back();
  };

  // S3 设置变更处理 - 使用 ref 避免竞态问题
  const s3SettingsRef = useRef(s3Settings);

  useEffect(() => {
    s3SettingsRef.current = s3Settings;
  }, [s3Settings]);

  const handleS3SettingChange = <K extends keyof S3SyncSettings>(
    key: K,
    value: S3SyncSettings[K]
  ) => {
    const newS3Settings: S3SyncSettings = {
      ...s3SettingsRef.current,
      [key]: value,
    };

    // 只有当修改配置参数（非 enabled、lastConnectionSuccess、enablePullToSync）时才清除连接状态
    if (
      key !== 'enabled' &&
      key !== 'lastConnectionSuccess' &&
      key !== 'enablePullToSync'
    ) {
      newS3Settings.lastConnectionSuccess = false;
    }

    // 更新 ref 以便下次调用使用最新状态
    s3SettingsRef.current = newS3Settings;
    setS3Settings(newS3Settings);
    handleChange('s3Sync', newS3Settings);
  };

  // WebDAV 设置变更处理 - 使用函数式更新避免状态竞态
  const webdavSettingsRef = useRef(webdavSettings);

  useEffect(() => {
    webdavSettingsRef.current = webdavSettings;
  }, [webdavSettings]);

  const handleWebDAVSettingChange = <K extends keyof WebDAVSyncSettings>(
    key: K,
    value: WebDAVSyncSettings[K]
  ) => {
    const newWebDAVSettings: WebDAVSyncSettings = {
      ...webdavSettingsRef.current,
      [key]: value,
    };

    // 只有当修改配置参数（非 enabled、lastConnectionSuccess、enablePullToSync）时才清除连接状态
    if (
      key !== 'enabled' &&
      key !== 'lastConnectionSuccess' &&
      key !== 'enablePullToSync'
    ) {
      newWebDAVSettings.lastConnectionSuccess = false;
    }

    // 更新 ref 以便下次调用使用最新状态
    webdavSettingsRef.current = newWebDAVSettings;
    setWebDAVSettings(newWebDAVSettings);
    handleChange('webdavSync', newWebDAVSettings);
  };

  // Supabase 设置变更处理
  const supabaseSettingsRef = useRef(supabaseSettings);

  useEffect(() => {
    supabaseSettingsRef.current = supabaseSettings;
  }, [supabaseSettings]);

  const handleSupabaseSettingChange = <K extends keyof SupabaseSyncSettings>(
    key: K,
    value: SupabaseSyncSettings[K]
  ) => {
    const newSupabaseSettings: SupabaseSyncSettings = {
      ...supabaseSettingsRef.current,
      [key]: value,
    };

    // 只有当修改配置参数（非 enabled 和 lastConnectionSuccess）时才清除连接状态
    if (key !== 'enabled' && key !== 'lastConnectionSuccess') {
      newSupabaseSettings.lastConnectionSuccess = false;
    }

    // 更新 ref 以便下次调用使用最新状态
    supabaseSettingsRef.current = newSupabaseSettings;
    setSupabaseSettings(newSupabaseSettings);
    handleChange('supabaseSync', newSupabaseSettings);
  };

  /**
   * 切换云同步类型
   * 同时更新对应服务的 enabled 状态，确保 StorageProvider 能正确识别
   */
  const switchSyncType = useCallback(
    (type: CloudSyncType) => {
      setActiveSyncType(type);

      (async () => {
        const nextBackupProvider: ManualSyncProvider =
          type === 'supabase' &&
          (syncType === 's3' || syncType === 'webdav') &&
          supabaseBackupProvider === 'none'
            ? syncType
            : supabaseBackupProvider;

        // 如果之前是 Supabase，现在切走，断开连接
        if (syncType === 'supabase' && type !== 'supabase') {
          try {
            const [{ getRealtimeSyncService }, { useSyncStatusStore }] =
              await Promise.all([
                import('@/lib/supabase/realtime'),
                import('@/lib/stores/syncStatusStore'),
              ]);
            await getRealtimeSyncService().disconnect();

            useSyncStatusStore.setState({
              realtimeStatus: 'disconnected',
              realtimeEnabled: false,
              pendingChangesCount: 0,
              isInitialSyncing: false,
            });
          } catch (e) {
            console.error('断开同步连接失败:', e);
          }
        }

        // 如果切换到 Supabase，确保其 enabled 为 true
        if (type === 'supabase') {
          const newSettings = { ...supabaseSettingsRef.current, enabled: true };
          supabaseSettingsRef.current = newSettings;
          setSupabaseSettings(newSettings);
          await handleChange('supabaseSync', newSettings);

          if (nextBackupProvider !== supabaseBackupProvider) {
            setSupabaseBackupProvider(nextBackupProvider);
            await handleChange('supabaseBackupProvider', nextBackupProvider);
          }
        }
        // 如果切换到 S3
        else if (type === 's3') {
          const newSettings = { ...s3SettingsRef.current, enabled: true };
          s3SettingsRef.current = newSettings;
          setS3Settings(newSettings);
          await handleChange('s3Sync', newSettings);
        }
        // 如果切换到 WebDAV
        else if (type === 'webdav') {
          const newSettings = { ...webdavSettingsRef.current, enabled: true };
          webdavSettingsRef.current = newSettings;
          setWebDAVSettings(newSettings);
          await handleChange('webdavSync', newSettings);
        }

        await handleChange('activeSyncType', type);
      })();

      if (settings.hapticFeedback) {
        hapticsUtils.light();
      }
    },
    [syncType, supabaseBackupProvider, settings.hapticFeedback, handleChange]
  );

  const switchSupabaseBackupProvider = useCallback(
    (provider: ManualSyncProvider) => {
      setSupabaseBackupProvider(provider);

      void (async () => {
        if (provider === 's3') {
          const newSettings = { ...s3SettingsRef.current, enabled: true };
          s3SettingsRef.current = newSettings;
          setS3Settings(newSettings);
          await handleChange('s3Sync', newSettings);
        } else if (provider === 'webdav') {
          const newSettings = { ...webdavSettingsRef.current, enabled: true };
          webdavSettingsRef.current = newSettings;
          setWebDAVSettings(newSettings);
          await handleChange('webdavSync', newSettings);
        }

        await handleChange('supabaseBackupProvider', provider);
      })();

      if (settings.hapticFeedback) {
        hapticsUtils.light();
      }
    },
    [handleChange, settings.hapticFeedback]
  );

  const selectedManualSyncType =
    getSelectedManualSyncProvider(resolvedSyncSettings);
  const isManualSyncConnected =
    getConnectedManualSyncProvider(resolvedSyncSettings) !== 'none';
  const isManualPullToSyncEnabled = isPullToSyncEnabled(resolvedSyncSettings);
  const showWebDAVTutorialEntry =
    selectedManualSyncType === 'webdav' &&
    !webdavSettings.lastConnectionSuccess;
  const showPullToSync = supportsPullToSync && isManualSyncConnected;

  const handlePullToSyncSettingChange = (enabled: boolean) => {
    if (selectedManualSyncType === 's3') {
      handleS3SettingChange('enablePullToSync', enabled);
    } else if (selectedManualSyncType === 'webdav') {
      handleWebDAVSettingChange('enablePullToSync', enabled);
    }

    if (settings.hapticFeedback) {
      hapticsUtils.light();
    }
  };

  const renderManualSyncSection = () => {
    if (selectedManualSyncType === 's3') {
      return (
        <S3SyncSection
          settings={s3Settings}
          renderContent={renderManualSyncContent}
          isLast={!showWebDAVTutorialEntry && !showPullToSync}
          enabled={true}
          hapticFeedback={settings.hapticFeedback}
          onSettingChange={handleS3SettingChange}
          onSyncComplete={onDataChange}
          onEnable={() =>
            syncType === 'supabase'
              ? switchSupabaseBackupProvider('s3')
              : switchSyncType('s3')
          }
        />
      );
    }

    if (selectedManualSyncType === 'webdav') {
      return (
        <WebDAVSyncSection
          settings={webdavSettings}
          renderContent={renderManualSyncContent}
          isLast={!showWebDAVTutorialEntry && !showPullToSync}
          enabled={true}
          hapticFeedback={settings.hapticFeedback}
          onSettingChange={handleWebDAVSettingChange}
          onSyncComplete={onDataChange}
          onEnable={() =>
            syncType === 'supabase'
              ? switchSupabaseBackupProvider('webdav')
              : switchSyncType('webdav')
          }
        />
      );
    }

    return null;
  };

  // 备份提醒设置变更
  const handleBackupReminderChange = async (enabled: boolean) => {
    try {
      await BackupReminderUtils.setEnabled(enabled);
      const updatedSettings = await BackupReminderUtils.getSettings();
      setBackupReminderSettings(updatedSettings);
      const nextText = await BackupReminderUtils.getNextReminderText();
      setNextReminderText(nextText);
      if (settings.hapticFeedback) hapticsUtils.light();
    } catch (error) {
      console.error('更新备份提醒设置失败:', error);
    }
  };

  const handleBackupIntervalChange = async (
    interval: BackupReminderInterval
  ) => {
    try {
      await BackupReminderUtils.updateInterval(interval);
      const updatedSettings = await BackupReminderUtils.getSettings();
      setBackupReminderSettings(updatedSettings);
      const nextText = await BackupReminderUtils.getNextReminderText();
      setNextReminderText(nextText);
      if (settings.hapticFeedback) hapticsUtils.light();
    } catch (error) {
      console.error('更新备份提醒间隔失败:', error);
    }
  };

  // 请求持久化存储
  const handleRequestPersist = async () => {
    if (!usesBrowserStorage || !isPWA || !isPersistentStorageSupported()) {
      return;
    }

    setIsRequestingPersist(true);
    try {
      const granted = await PersistentStorageManager.requestPersist();
      setIsPersisted(granted);

      if (settings.hapticFeedback) {
        hapticsUtils.light();
      }
    } catch (error) {
      console.error('请求持久化存储失败:', error);
    } finally {
      setIsRequestingPersist(false);
    }
  };

  useScrollToHighlightedSetting(
    `${syncType}:${supabaseBackupProvider}:${backupReminderSettings?.enabled ?? false}:${isPersisted}:${isManualSyncConnected}`
  );

  const manualSyncControls = (
    <>
      {showWebDAVTutorialEntry && (
        <SettingRow
          label="引导式配置"
          onClick={() => setShowWebDAVTutorial(true)}
          isLast={!showPullToSync}
        >
          <ChevronRight className="size-4 text-neutral-400 dark:text-neutral-500" />
        </SettingRow>
      )}
      {showPullToSync && (
        <SettingRow label="下拉同步" isLast>
          <SettingToggle
            checked={isManualPullToSyncEnabled}
            onChange={handlePullToSyncSettingChange}
            ariaLabel="下拉同步"
          />
        </SettingRow>
      )}
    </>
  );

  const cloudServiceRow = (
    <SettingRow
      label="同步服务"
      settingId={makeSettingRowSearchId('同步服务')}
      className="min-h-11"
      isLast={syncType === 'none'}
    >
      <SettingSelect
        value={syncType}
        options={[
          { value: 'none', label: getCloudProviderLabel('none') },
          { value: 'webdav', label: getCloudProviderLabel('webdav') },
          { value: 's3', label: getCloudProviderLabel('s3') },
          { value: 'supabase', label: getCloudProviderLabel('supabase') },
        ]}
        onChange={switchSyncType}
        ariaLabel="同步服务"
      />
    </SettingRow>
  );
  const backupServiceRow = (
    <SettingRow
      label="备份服务"
      settingId={makeSettingRowSearchId('备份服务')}
      className="min-h-11"
      isLast={supabaseBackupProvider === 'none'}
    >
      <SettingSelect
        value={supabaseBackupProvider}
        options={[
          { value: 'none', label: getCloudProviderLabel('none') },
          { value: 'webdav', label: getCloudProviderLabel('webdav') },
          { value: 's3', label: getCloudProviderLabel('s3') },
        ]}
        onChange={switchSupabaseBackupProvider}
        ariaLabel="备份服务"
      />
    </SettingRow>
  );
  const renderManualSyncContent = (
    configuration: React.ReactNode,
    actions: React.ReactNode
  ) => (
    <>
      <SettingSection
        title={syncType === 'supabase' ? '手动备份' : '云同步'}
        className={syncType === 'supabase' || showStorageNotice ? '' : '-mt-4'}
        contentShape="card"
      >
        {syncType === 'supabase' ? backupServiceRow : cloudServiceRow}
        {configuration}
        {manualSyncControls}
      </SettingSection>
      {actions && <SettingSection title="同步操作">{actions}</SettingSection>}
    </>
  );

  const showStorageNotice =
    usesBrowserStorage &&
    isPersisted === false &&
    !isStorageNoticeDismissed &&
    (!isPersistentStorageSupported() || !isPWA);

  return (
    <SettingPage title="数据与备份" isVisible={isVisible} onClose={handleClose}>
      {showStorageNotice && (
        <SettingNotice
          id={storageNoticeId}
          className="-mt-4"
          level="important"
          message={
            !isPersistentStorageSupported()
              ? '当前环境不支持持久化存储，请使用支持此功能的新版浏览器。'
              : '当前浏览器模式未提供持久化存储，请添加到主屏幕后打开应用。'
          }
          onClose={() => {
            saveBooleanState('setting-notices', storageNoticeId, true);
            setIsStorageNoticeDismissed(true);
          }}
        />
      )}
      {syncType === 's3' || syncType === 'webdav' ? (
        renderManualSyncSection()
      ) : (
        <SettingSection
          title="云同步"
          className={showStorageNotice ? undefined : '-mt-4'}
          contentShape={syncType === 'none' ? 'capsule' : 'card'}
        >
          {cloudServiceRow}
          {syncType === 'supabase' && (
            <SupabaseSyncSection
              settings={supabaseSettings}
              enabled={true}
              hapticFeedback={settings.hapticFeedback}
              onSettingChange={handleSupabaseSettingChange}
              onSyncComplete={onDataChange}
              onEnable={() => switchSyncType('supabase')}
            />
          )}
        </SettingSection>
      )}

      {syncType === 'supabase' &&
        (supabaseBackupProvider === 'none' ? (
          <SettingSection title="手动备份">{backupServiceRow}</SettingSection>
        ) : (
          renderManualSyncSection()
        ))}

      {isPersisted === false && isPWA && isPersistentStorageSupported() && (
        <SettingSection title="数据持久化">
          <SettingRow label="持久化存储" isLast>
            <SettingToggle
              checked={isRequestingPersist}
              onChange={() => void handleRequestPersist()}
              disabled={isRequestingPersist}
              ariaLabel="持久化存储"
            />
          </SettingRow>
        </SettingSection>
      )}

      {backupReminderSettings && (
        <SettingSection
          title="备份提醒"
          footer={backupReminderSettings.enabled ? nextReminderText : undefined}
        >
          <SettingRow label="备份提醒" isLast={!backupReminderSettings.enabled}>
            <SettingToggle
              checked={backupReminderSettings.enabled}
              onChange={handleBackupReminderChange}
              ariaLabel="备份提醒"
            />
          </SettingRow>
          {backupReminderSettings.enabled && (
            <SettingRow label="提醒频率" isSubSetting isLast>
              <SettingSelect
                value={backupReminderSettings.interval.toString()}
                options={[
                  {
                    value: BACKUP_REMINDER_INTERVALS.WEEKLY.toString(),
                    label: '每周',
                  },
                  {
                    value: BACKUP_REMINDER_INTERVALS.BIWEEKLY.toString(),
                    label: '每两周',
                  },
                  {
                    value: BACKUP_REMINDER_INTERVALS.MONTHLY.toString(),
                    label: '每月',
                  },
                ]}
                onChange={value =>
                  handleBackupIntervalChange(
                    parseInt(value) as BackupReminderInterval
                  )
                }
                ariaLabel="备份提醒频率"
              />
            </SettingRow>
          )}
        </SettingSection>
      )}

      {/* 数据管理设置组 */}
      <DataManagementSection onDataChange={onDataChange} />

      {/* WebDAV 配置教程 */}
      <WebDAVTutorialModal
        proxyUrl={webdavSettings.proxyUrl}
        onProxyChange={value => handleWebDAVSettingChange('proxyUrl', value)}
        isOpen={showWebDAVTutorial}
        onClose={() => setShowWebDAVTutorial(false)}
        onComplete={(config: {
          url: string;
          username: string;
          password: string;
        }) => {
          // 更新 WebDAV 配置（不修改 enabled，只更新配置和连接状态）
          const newWebDAVSettings: WebDAVSyncSettings = {
            ...webdavSettings,
            url: config.url,
            username: config.username,
            password: config.password,
            lastConnectionSuccess: true,
          };

          // 立即更新本地 state
          setWebDAVSettings(newWebDAVSettings);
          webdavSettingsRef.current = newWebDAVSettings;

          if (syncType !== 'supabase') {
            setActiveSyncType('webdav');
          }

          // 异步持久化
          if (syncType !== 'supabase') {
            handleChange('activeSyncType', 'webdav');
          } else {
            handleChange('supabaseBackupProvider', 'webdav');
          }
          handleChange('webdavSync', newWebDAVSettings);

          if (settings.hapticFeedback) hapticsUtils.light();
        }}
      />
    </SettingPage>
  );
};

export default DataSettings;
