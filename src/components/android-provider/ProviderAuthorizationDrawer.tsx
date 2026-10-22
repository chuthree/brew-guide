'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PluginListenerHandle } from '@capacitor/core';
import Image from 'next/image';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { showToast } from '@/components/common/feedback/LightToast';
import {
  isAndroidProviderAvailable,
  providerAccess,
  type PendingProviderAuthorization,
} from '@/lib/android-provider/client';
import {
  describeRequestedProviderScopes,
  isValidProviderAuthorization,
  providerAuthorizationOutcomeMessage,
} from '@/lib/android-provider/permissionPresentation';
import {
  refreshProviderAccessState,
  publishProviderAccessState,
} from '@/lib/android-provider/accessState';
import ProviderAppIcon from './ProviderAppIcon';
import { modalHistory } from '@/lib/navigation/modalHistory';
import { installProviderConsentHistory } from '@/lib/android-provider/consentHistory';

/** Globally mounted overlay: never opens Settings or replaces an in-progress page. */
export default function ProviderAuthorizationDrawer() {
  const [pending, setPending] = useState<PendingProviderAuthorization | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const resolving = useRef(false);
  const mounted = useRef(false);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    if (!isAndroidProviderAvailable() || resolving.current) return;
    const version = ++generation.current;
    try {
      const result = await providerAccess.getPendingAuthorization();
      if (
        mounted.current &&
        version === generation.current &&
        !resolving.current
      ) {
        setPending(result.pending);
        setExpired(!!result.pending && result.pending.expiresAt <= Date.now());
        setError('');
      }
      await refreshProviderAccessState();
    } catch {
      // A failed read must never present a fabricated caller or enable approval.
      if (mounted.current && version === generation.current) {
        setPending(null);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!isAndroidProviderAvailable())
      return () => {
        mounted.current = false;
      };
    let listener: PluginListenerHandle | undefined;
    let disposed = false;
    void providerAccess
      .addListener('authorizationRequested', () => {
        void refresh();
      })
      .then(handle => {
        if (disposed) void handle.remove();
        else {
          listener = handle;
          void refresh();
        }
      })
      .catch(() => {
        void refresh();
      });
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      mounted.current = false;
      void listener?.remove();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    if (!pending) return;
    const remaining = pending.expiresAt - Date.now();
    // Timer also prevents an already-open consent from staying enabled after expiry.
    const timer = setTimeout(() => setExpired(true), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [pending]);

  const valid = !expired && isValidProviderAuthorization(pending);
  const resolve = useCallback(
    async (decision: 'approve' | 'cancel') => {
      if (!pending || resolving.current || (decision === 'approve' && !valid))
        return;
      resolving.current = true;
      generation.current++;
      setBusy(true);
      setError('');
      let completed = false;
      try {
        const outcome = await providerAccess.resolveAuthorization({
          requestId: pending.requestId,
          decision,
        });
        if (mounted.current) {
          // Native consumes every terminal result, not only approval.
          setPending(null);
          completed = true;
          const message = providerAuthorizationOutcomeMessage(
            decision,
            outcome.status
          );
          if (message) showToast({ type: 'error', title: message });
        }
        // A state refresh failure must not relabel confirmed approval as failure.
        await providerAccess
          .getState()
          .then(publishProviderAccessState)
          .catch(() => {});
      } catch (cause) {
        if (mounted.current)
          setError(
            cause instanceof Error
              ? cause.message
              : '暂时无法处理申请，请重试。'
          );
        // Native Back may have already cancelled and consumed this request while
        // its event was suppressed by our in-flight guard. Reconcile that race.
        try {
          const current = await providerAccess.getPendingAuthorization();
          if (mounted.current) {
            setPending(current.pending);
            if (!current.pending) {
              completed = true;
              showToast({
                type: 'error',
                title: '申请已结束，请返回调用应用查看结果。',
              });
            }
          }
        } catch {
          /* Retain the inline error and allow a retry. */
        }
      } finally {
        resolving.current = false;
        if (mounted.current) setBusy(false);
        if (completed) void refresh();
      }
    },
    [pending, valid, refresh]
  );
  const approve = useCallback(() => {
    void resolve('approve');
  }, [resolve]);
  const cancel = useCallback(() => {
    void resolve('cancel');
  }, [resolve]);

  const cancelRef = useRef(cancel);
  useEffect(() => {
    cancelRef.current = cancel;
  }, [cancel]);
  const isOpen = !!pending;
  const present = useCallback(() => {
    return installProviderConsentHistory(modalHistory, () =>
      cancelRef.current()
    );
  }, []);

  return (
    <ActionDrawer
      isOpen={isOpen}
      title="应用数据授权"
      priority={0}
      disableHistory
      onPresent={present}
      onClose={cancel}
      historyId="provider-authorization"
      dismissible={!busy}
    >
      {pending && (
        <>
          <ActionDrawer.Content>
            <div className="mb-5 flex items-center justify-center gap-5">
              <ProviderAppIcon
                iconDataUrl={pending.caller.iconDataUrl}
                label={pending.caller.label}
                size={56}
                className="border border-black/5 dark:border-white/5"
              />
              <div className="flex items-center gap-1.5" aria-hidden="true">
                <span className="size-1.5 rounded-full bg-neutral-400" />
                <span className="size-1.5 rounded-full bg-neutral-400" />
                <span className="size-1.5 rounded-full bg-neutral-400" />
              </div>
              <Image
                src="/images/icons/app/icon-192x192-contained.png"
                alt="Brew Guide"
                width={56}
                height={56}
                className="shrink-0 rounded-xl border border-black/5 object-contain dark:border-white/5"
              />
            </div>
            <h2 className="text-center text-lg leading-relaxed font-medium">
              <span className="block">允许“{pending.caller.label}”访问</span>
              <span className="block">Brew Guide 数据？</span>
            </h2>
            <p className="mt-1 text-center text-xs break-all text-neutral-500">
              {pending.caller.packageName}
            </p>
            <ul className="my-5 divide-y divide-black/5 overflow-hidden rounded-xl bg-neutral-100 px-4 text-sm dark:divide-white/5 dark:bg-neutral-800">
              {describeRequestedProviderScopes(pending.scopes).map(scope => (
                <li
                  key={scope.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <span>{scope.label}</span>
                  <span className="shrink-0 text-neutral-500">
                    {pending.scopes[scope.id] === 'edit'
                      ? '查看与编辑'
                      : '仅查看'}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-neutral-500">
              {Object.values(pending.scopes).includes('edit') &&
                '查看与编辑包含新增、修改和删除。'}
              请仅向你信任的应用授予权限。你可以随时在“设置 ＞
              授权管理”中调整或撤销授权。
            </p>
            {(error || !valid) && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {error || '申请已失效，请返回调用应用重新申请。'}
              </p>
            )}
          </ActionDrawer.Content>
          <ActionDrawer.Actions>
            <ActionDrawer.SecondaryButton onClick={cancel} disabled={busy}>
              取消
            </ActionDrawer.SecondaryButton>
            <ActionDrawer.PrimaryButton
              onClick={approve}
              disabled={!valid || busy}
            >
              {busy ? '处理中…' : '允许'}
            </ActionDrawer.PrimaryButton>
          </ActionDrawer.Actions>
        </>
      )}
    </ActionDrawer>
  );
}
