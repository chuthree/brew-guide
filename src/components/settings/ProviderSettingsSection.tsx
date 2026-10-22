'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import ProviderAppIcon from '@/components/android-provider/ProviderAppIcon';
import {
  publishProviderAccessState,
  useProviderAccessState,
} from '@/lib/android-provider/accessState';
import {
  providerAccess,
  isAndroidProviderAvailable,
  type ProviderAccessState,
  type ProviderCaller,
} from '@/lib/android-provider/client';
import type { DataDomain } from '@/lib/permissions/access';
import {
  accessLevelOptions,
  updateScopeAccess,
  EDIT_ACCESS_DESCRIPTION,
  type AccessSelection,
} from '@/lib/permissions/presentation';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { deriveNavigationSettings } from '@/lib/navigation/navigationSettings';
import { visibleProviderScopes } from '@/lib/android-provider/permissionPresentation';
import SettingSection from './atomic/SettingSection';
import SettingRow from './atomic/SettingRow';
import SettingSelect from './atomic/SettingSelect';
import { SettingPageLayoutProvider } from './atomic/SettingPageLayoutContext';
import PageStackDrawer, {
  useDrawerPageStack,
} from '@/components/common/ui/PageStackDrawer';

function ProviderCallerRow({
  caller,
  onSelect,
}: {
  caller: ProviderCaller;
  onSelect: (key: string) => void;
}) {
  const open = useCallback(() => onSelect(caller.key), [caller.key, onSelect]);
  return (
    <SettingRow
      label={caller.label}
      description={caller.packageName}
      onClick={open}
    >
      <ProviderAppIcon
        iconDataUrl={caller.iconDataUrl}
        label={caller.label}
        size={32}
      />
      <span className="ml-3 text-xs text-neutral-500">
        {!caller.identityCurrent
          ? '身份已变化'
          : Object.keys(caller.scopes).length
            ? '已授权'
            : '待授权'}
      </span>
      <ChevronRight className="ml-2 size-4 text-neutral-400" />
    </SettingRow>
  );
}

function ProviderScopeControls({
  scope,
  caller,
  busy,
  onChange,
}: {
  scope: ReturnType<typeof visibleProviderScopes>[number];
  caller: ProviderCaller;
  busy: boolean;
  onChange: (
    caller: ProviderCaller,
    domain: DataDomain,
    level: AccessSelection
  ) => void;
}) {
  const change = useCallback(
    (level: AccessSelection) => onChange(caller, scope.id, level),
    [caller, scope.id, onChange]
  );
  return (
    <SettingSection title={scope.label} contentShape="card">
      <SettingRow label="访问权限" isLast>
        <SettingSelect
          value={caller.scopes[scope.id] ?? 'none'}
          options={accessLevelOptions}
          ariaLabel={`${scope.label}访问权限`}
          disabled={busy || !caller.identityCurrent}
          onChange={change}
        />
      </SettingRow>
    </SettingSection>
  );
}

export function ProviderSettingsSection() {
  const [available] = useState(isAndroidProviderAvailable);
  return available ? <AndroidProviderSettings /> : null;
}

function AndroidProviderSettings() {
  const navigation = useSettingsStore(
    state => state.settings.navigationSettings
  );
  const { visibleTabs } = deriveNavigationSettings(navigation);
  const state = useProviderAccessState(value => value.state);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(true);
  const inFlight = useRef(false);
  const close = useCallback(() => setSelectedKey(null), []);
  const drawer = useDrawerPageStack(
    'permissions',
    selectedKey !== null,
    'provider-permissions',
    close
  );
  const selected = state?.callers.find(item => item.key === selectedKey);

  const perform = useCallback(
    async (operation: () => Promise<ProviderAccessState>) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError('');
      try {
        const next = await operation();
        publishProviderAccessState(next);
      } catch (cause) {
        if (active.current)
          setError(cause instanceof Error ? cause.message : String(cause));
        try {
          const next = await providerAccess.getState();
          publishProviderAccessState(next);
        } catch {
          /* Preserve the first error; refresh remains available. */
        }
      } finally {
        inFlight.current = false;
        if (active.current) {
          setBusy(false);
        }
      }
    },
    []
  );
  const refresh = useCallback(() => {
    void perform(() => providerAccess.getState());
  }, [perform]);
  useEffect(() => {
    active.current = true;
    void Promise.resolve().then(() => {
      if (active.current) refresh();
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active.current = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const change = useCallback(
    (caller: ProviderCaller, domain: DataDomain, level: AccessSelection) => {
      if (!state || !caller.identityCurrent) return;
      const next = updateScopeAccess(caller.scopes, domain, level);
      void perform(() =>
        providerAccess.grant({
          key: caller.key,
          scopes: next,
          expectedRevision: state.revision,
        })
      );
    },
    [state, perform]
  );
  const revokeSelected = useCallback(() => {
    if (!state || !selected) return;
    void perform(() =>
      providerAccess.revoke({
        key: selected.key,
        expectedRevision: state.revision,
      })
    );
  }, [state, selected, perform]);
  const visibleScopes = visibleProviderScopes(visibleTabs, selected?.scopes);

  return (
    <>
      <SettingSection
        title="已申请的应用"
        footer="管理其他应用的数据访问权限。撤销后，该应用将无法继续访问。"
        contentShape="card"
      >
        {state?.callers.map(caller => (
          <ProviderCallerRow
            key={caller.key}
            caller={caller}
            onSelect={setSelectedKey}
          />
        ))}
        {state && state.callers.length === 0 && (
          <div className="px-3.5 py-3 text-xs text-neutral-500">
            暂无应用请求。第三方应用发起访问申请后，会显示在这里。
          </div>
        )}
        <SettingRow
          label="刷新应用列表"
          onClick={refresh}
          disabled={busy}
          isLast
        >
          {null}
        </SettingRow>
        {error && selectedKey === null && (
          <p role="alert" className="px-3.5 py-3 text-xs text-red-600">
            {error}
          </p>
        )}
      </SettingSection>
      <PageStackDrawer
        isOpen={selectedKey !== null}
        title={selected?.label || '应用授权'}
        activeKey="permissions"
        canGoBack={false}
        onCancel={close}
        onBack={drawer.back}
        onDone={drawer.back}
        historyId="provider-permissions"
      >
        <SettingPageLayoutProvider mode="embedded">
          {selected && (
            <>
              <SettingSection title="调用应用" contentShape="card">
                <SettingRow
                  label={selected.packageName}
                  description={`UID ${selected.uid}`}
                  isLast
                >
                  {null}
                </SettingRow>
                {!selected.identityCurrent && (
                  <p className="px-3.5 py-3 text-xs text-red-600">
                    应用已卸载或身份发生变化，原授权不可使用。请移除后重新申请。
                  </p>
                )}
              </SettingSection>
              <p className="px-3.5 py-3 text-xs text-neutral-500">
                {EDIT_ACCESS_DESCRIPTION}
              </p>
              {visibleScopes.map(scope => (
                <ProviderScopeControls
                  key={scope.id}
                  scope={scope}
                  caller={selected}
                  busy={busy}
                  onChange={change}
                />
              ))}
              <SettingSection contentShape="card">
                <SettingRow
                  label="撤销授权并移除"
                  disabled={busy}
                  isLast
                  onClick={revokeSelected}
                >
                  {null}
                </SettingRow>
              </SettingSection>
            </>
          )}
          {!selected && (
            <p className="p-4 text-sm text-neutral-500">此应用已移除。</p>
          )}
          {error && (
            <p role="alert" className="px-3.5 py-3 text-xs text-red-600">
              {error}
            </p>
          )}
        </SettingPageLayoutProvider>
      </PageStackDrawer>
    </>
  );
}
