'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { showToast } from '@/components/common/feedback/LightToast';
import {
  configureMcp,
  getMcpConnectionConfig,
  getMcpStatus,
  isDesktopMcpAvailable,
} from '@/lib/mcp/client';
import { MCP_DOMAIN_LABELS } from '@/lib/mcp/permissions';
import type { McpDomain, McpConfig, McpStatus } from '@/lib/mcp/types';
import { copyToClipboard } from '@/lib/utils/exportUtils';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import {
  deriveNavigationSettings,
  type MainNavigationTab,
} from '@/lib/navigation/navigationSettings';
import SettingRow from './atomic/SettingRow';
import SettingSection from './atomic/SettingSection';
import SettingToggle from './atomic/SettingToggle';
import SettingSelect from './atomic/SettingSelect';
import {
  accessLevelOptions,
  updateScopeAccess,
  EDIT_ACCESS_DESCRIPTION,
  type AccessSelection,
} from '@/lib/permissions/presentation';
import SettingInput from './atomic/SettingInput';
import { SettingPageLayoutProvider } from './atomic/SettingPageLayoutContext';
import { SyncHeaderButton } from './data-settings/shared/SyncHeaderButton';
import PageStackDrawer, {
  useDrawerPageStack,
} from '@/components/common/ui/PageStackDrawer';
import { ChevronRight } from 'lucide-react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import DataAlertIcon from '@public/images/icons/ui/data-alert.svg';
import {
  useSettingSearchHighlight,
  useScrollToHighlightedSetting,
} from './atomic/SettingSearchHighlightContext';
import { makeSettingRowSearchId } from './settingsSearch';

const domainOptions: {
  value: McpDomain;
  label: string;
  module?: MainNavigationTab;
}[] = [
  { value: 'brewing', label: MCP_DOMAIN_LABELS.brewing, module: 'brewing' },
  { value: 'beans', label: MCP_DOMAIN_LABELS.beans, module: 'coffeeBean' },
  { value: 'notes', label: MCP_DOMAIN_LABELS.notes, module: 'notes' },
  { value: 'settings', label: MCP_DOMAIN_LABELS.settings },
];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function McpSettingsSection() {
  const [available] = useState(isDesktopMcpAvailable);
  return available ? <DesktopMcpSettings /> : null;
}

function DesktopMcpSettings() {
  const navigationSettings = useSettingsStore(
    state => state.settings.navigationSettings
  );
  const { visibleTabs } = deriveNavigationSettings(navigationSettings);
  const [status, setStatus] = useState<McpStatus | null>(null);
  const [port, setPort] = useState('');
  const [pending, setPending] = useState(true);
  const [error, setError] = useState('');
  const [confirmRotation, setConfirmRotation] = useState(false);
  const [toggleRevision, setToggleRevision] = useState(0);
  const mounted = useRef(false);
  const busy = useRef(true);
  const [configExpanded, setConfigExpanded] = useState<boolean | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const configRef = useRef<HTMLTextAreaElement>(null);
  const openConfig = useCallback(() => setShowConfig(true), []);
  const closeConfig = useCallback(() => setShowConfig(false), []);
  const selectConfig = useCallback(() => configRef.current?.select(), []);
  const [dismissedSearchId, setDismissedSearchId] = useState<string | null>(
    null
  );
  const { highlightedSettingId } = useSettingSearchHighlight();
  const advancedSearch = ['数据范围', '本机端口', '重置连接密钥'].some(
    label => makeSettingRowSearchId(label) === highlightedSettingId
  );
  const configSearch =
    advancedSearch ||
    makeSettingRowSearchId('连接配置') === highlightedSettingId;
  const expanded = configExpanded ?? configSearch;
  const advancedOpen =
    showAdvanced ||
    (advancedSearch && dismissedSearchId !== highlightedSettingId);
  useScrollToHighlightedSetting(`${advancedOpen}:${status?.enabled}`);
  const closeAdvanced = useCallback(() => {
    setShowAdvanced(false);
    setDismissedSearchId(highlightedSettingId);
    setConfirmRotation(false);
  }, [highlightedSettingId, setConfirmRotation]);
  const drawerStack = useDrawerPageStack(
    'settings',
    advancedOpen,
    'mcp-settings-drawer',
    closeAdvanced
  );
  const openAdvanced = useCallback(() => setShowAdvanced(true), []);
  const toggleConfig = useCallback(
    () => setConfigExpanded(!expanded),
    [expanded]
  );

  useEffect(() => {
    let disposed = false;
    mounted.current = true;
    void getMcpStatus()
      .then(next => {
        if (disposed || !mounted.current) return;
        setStatus(next);
        setPort(String(next.port));
      })
      .catch(cause => {
        if (!disposed && mounted.current) setError(getErrorMessage(cause));
      })
      .finally(() => {
        if (disposed) return;
        busy.current = false;
        if (mounted.current) setPending(false);
      });
    return () => {
      disposed = true;
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const next = await getMcpStatus();
      if (!mounted.current) return;
      setStatus(next);
      setPort(String(next.port));
    } catch (cause) {
      if (mounted.current) setError(getErrorMessage(cause));
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }, []);

  const update = useCallback(
    async (changes: Partial<McpConfig>, rotateToken = false) => {
      if (!status || busy.current) return;
      busy.current = true;
      setPending(true);
      setError('');
      try {
        const config: McpConfig = {
          enabled: status.enabled,
          port: status.port,
          scopes: status.scopes,
          ...changes,
        };
        const next = await configureMcp(config, rotateToken);
        if (!mounted.current) return;
        setStatus(next);
        setPort(String(next.port));
        if (rotateToken) {
          setConfirmRotation(false);
          showToast({
            type: 'success',
            title: '连接密钥已重置，请重新配置 MCP 客户端',
          });
        }
      } catch (cause) {
        if (!mounted.current) return;
        setError(getErrorMessage(cause));
        // A failed bind may still have saved the configuration. Read back the
        // native state so the switches reflect the actual permissions.
        try {
          const next = await getMcpStatus();
          if (!mounted.current) return;
          setStatus(next);
          setPort(String(next.port));
        } catch {
          // Keep the original error available for the user to retry.
        }
      } finally {
        busy.current = false;
        if (mounted.current) {
          setPending(false);
          // SettingToggle keeps its own optimistic state. Remount after every
          // attempt so a rejected change always rolls back visibly.
          setToggleRevision(revision => revision + 1);
        }
      }
    },
    [status, setConfirmRotation]
  );

  const savePort = useCallback(() => {
    const value = Number(port);
    if (
      !/^\d+$/.test(port) ||
      !Number.isInteger(value) ||
      value < 1024 ||
      value > 65535
    ) {
      setError('端口请输入 1024 到 65535 之间的整数');
      return;
    }
    void update({ port: value });
  }, [port, update]);

  const copy = useCallback(async (value: string, label: string) => {
    const result = await copyToClipboard(value);
    if (!mounted.current) return;
    showToast({
      type: result.success ? 'success' : 'error',
      title: result.success ? `${label}已复制` : '复制失败，请稍后重试',
    });
  }, []);

  const running = status?.running === true;
  const disabled = pending || !status;
  const serviceError = error || status?.lastError;
  const statusText = pending
    ? '处理中…'
    : running
      ? '已开启'
      : status?.enabled
        ? '未运行'
        : '已关闭';

  const handleEnableChange = useCallback(
    (enabled: boolean) => {
      void update({ enabled });
    },
    [update]
  );
  const handleRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);
  const handlePortChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setPort(event.target.value);
    },
    []
  );
  const handlePortKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') savePort();
    },
    [savePort]
  );
  const scopes = status?.scopes ?? {};
  const visibleDomainOptions = domainOptions
    .filter(
      option =>
        !option.module || visibleTabs[option.module] || scopes[option.value]
    )
    .map(option => ({
      ...option,
      onChange: (level: AccessSelection) => {
        void update({ scopes: updateScopeAccess(scopes, option.value, level) });
      },
    }));
  const handlePortBlur = useCallback(() => {
    if (status && port !== String(status.port)) savePort();
  }, [port, status, savePort]);
  const handleCopyConfig = useCallback(() => {
    if (status) void copy(getMcpConnectionConfig(status), 'MCP 配置');
  }, [status, copy]);
  const handleCancelRotation = useCallback(() => {
    setConfirmRotation(false);
  }, [setConfirmRotation]);
  const handleConfirmRotation = useCallback(() => {
    void update({}, true);
  }, [update]);
  const handleRequestRotation = useCallback(() => {
    setConfirmRotation(true);
  }, [setConfirmRotation]);

  const connectionStatus = pending
    ? 'connecting'
    : running
      ? 'connected'
      : serviceError
        ? 'error'
        : 'disconnected';
  const statusColor = pending
    ? 'bg-yellow-500'
    : running
      ? 'bg-green-500'
      : serviceError
        ? 'bg-red-500'
        : 'bg-neutral-300 dark:bg-neutral-600';

  return (
    <>
      <SettingSection
        title="MCP 连接"
        contentShape="card"
        footer="仅限本机客户端，使用时需保持桌面应用运行。查询内容会交给所连接的模型服务处理。"
      >
        <SettingRow label="启用 MCP 连接" isLast={!status?.enabled}>
          <SettingToggle
            key={`enabled-${toggleRevision}`}
            checked={status?.enabled ?? false}
            disabled={disabled}
            onChange={handleEnableChange}
            ariaLabel="启用 MCP 连接"
          />
        </SettingRow>
        {status?.enabled ? (
          <>
            <SyncHeaderButton
              serviceName="MCP"
              enabled={status.enabled}
              status={connectionStatus}
              expanded={expanded}
              statusColor={statusColor}
              statusText={statusText}
              isLast={!expanded}
              onClick={toggleConfig}
            />
            {expanded ? (
              <>
                <SettingRow
                  label="连接配置"
                  isSubSetting
                  onClick={openConfig}
                  disabled={!running || pending}
                >
                  {null}
                </SettingRow>
                <SettingRow
                  label="更多设置"
                  isSubSetting
                  onClick={openAdvanced}
                  isLast
                >
                  <ChevronRight className="size-4 text-neutral-400 dark:text-neutral-500" />
                </SettingRow>
              </>
            ) : null}
          </>
        ) : null}
        {serviceError ? (
          <div
            role="alert"
            className="px-3.5 py-3 text-xs text-red-600 dark:text-red-400"
          >
            {serviceError}
          </div>
        ) : null}
      </SettingSection>

      {serviceError ? (
        <SettingSection title="连接操作" contentShape="card">
          <SettingRow
            label="刷新连接状态"
            onClick={handleRefresh}
            disabled={pending}
          >
            {null}
          </SettingRow>
        </SettingSection>
      ) : null}

      <ActionDrawer
        isOpen={showConfig}
        onClose={closeConfig}
        historyId="mcp-connection-config-drawer"
      >
        <ActionDrawer.Icon icon={DataAlertIcon} />
        <ActionDrawer.Content>
          <p className="mb-3 text-neutral-500 dark:text-neutral-400">
            将以下配置添加到 MCP
            客户端。配置包含连接密钥，请只交给信任的本机客户端。
          </p>
          <textarea
            ref={configRef}
            aria-label="MCP 连接配置"
            readOnly
            spellCheck={false}
            onClick={selectConfig}
            value={status ? getMcpConnectionConfig(status) : ''}
            className="h-48 w-full resize-none rounded-md border border-neutral-200/50 bg-neutral-50 p-3 font-mono text-xs leading-relaxed text-neutral-700 focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          />
        </ActionDrawer.Content>
        <ActionDrawer.Actions>
          <ActionDrawer.SecondaryButton onClick={closeConfig}>
            关闭
          </ActionDrawer.SecondaryButton>
          <ActionDrawer.PrimaryButton
            onClick={handleCopyConfig}
            disabled={!running || pending}
          >
            复制配置
          </ActionDrawer.PrimaryButton>
        </ActionDrawer.Actions>
      </ActionDrawer>

      <PageStackDrawer
        isOpen={advancedOpen}
        title="MCP 设置"
        activeKey="settings"
        canGoBack={false}
        onCancel={closeAdvanced}
        onBack={drawerStack.back}
        onDone={drawerStack.back}
        historyId="mcp-settings-drawer"
      >
        <SettingPageLayoutProvider mode="overlay">
          <div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">
            <SettingSection
              title="数据范围"
              contentShape="card"
              footer={`${EDIT_ACCESS_DESCRIPTION} 设置不含账号密钥、同步配置和 MCP 权限。`}
            >
              <div data-settings-search-id={makeSettingRowSearchId('数据范围')}>
                {visibleDomainOptions.map((option, index) => (
                  <SettingRow
                    key={option.value}
                    label={option.label}
                    isLast={index === visibleDomainOptions.length - 1}
                  >
                    <SettingSelect
                      value={scopes[option.value] ?? 'none'}
                      options={accessLevelOptions}
                      disabled={disabled}
                      ariaLabel={`MCP ${option.label}访问权限`}
                      onChange={option.onChange}
                    />
                  </SettingRow>
                ))}
              </div>
            </SettingSection>
            <SettingSection
              title="连接"
              footer="更改端口或重置密钥后，需重新复制配置到客户端。"
            >
              <SettingRow label="本机端口" expandControl>
                <SettingInput
                  inputMode="numeric"
                  aria-label="MCP 本机端口"
                  value={port}
                  onChange={handlePortChange}
                  onKeyDown={handlePortKeyDown}
                  onBlur={handlePortBlur}
                  disabled={disabled}
                  maxLength={5}
                />
              </SettingRow>
            </SettingSection>
            <SettingSection
              title="操作"
              footer={
                confirmRotation ? '确认重置后，现有连接将立即失效。' : undefined
              }
            >
              <SettingRow
                label={confirmRotation ? '确认重置密钥' : '重置连接密钥'}
                settingId={makeSettingRowSearchId('重置连接密钥')}
                onClick={
                  confirmRotation
                    ? handleConfirmRotation
                    : handleRequestRotation
                }
                disabled={disabled}
              >
                {null}
              </SettingRow>
              {confirmRotation ? (
                <SettingRow
                  label="取消重置"
                  onClick={handleCancelRotation}
                  disabled={pending}
                >
                  {null}
                </SettingRow>
              ) : null}
            </SettingSection>
            {serviceError ? (
              <p
                role="alert"
                className="px-9.5 pb-5 text-xs break-words text-red-600 dark:text-red-400"
              >
                {serviceError}
              </p>
            ) : null}
          </div>
        </SettingPageLayoutProvider>
      </PageStackDrawer>
    </>
  );
}
