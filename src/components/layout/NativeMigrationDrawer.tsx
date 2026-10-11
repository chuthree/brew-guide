'use client';

import { useStore } from 'zustand';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import ArrowUpIcon from '@public/images/icons/ui/arrow-up.svg';
import {
  nativeMigrationGate,
  saveNativeMigrationBackup,
  confirmNativeMigration,
} from '@/lib/data/nativeMigrationGate';

function keepDrawerOpen() {
  return;
}

function retryUpgrade() {
  window.location.reload();
}

export default function NativeMigrationDrawer() {
  const { phase, error } = useStore(nativeMigrationGate);
  const busy = ['saving', 'migrating', 'cleaning'].includes(phase);
  const message = error
    ? phase === 'failed'
      ? '升级尚未完成，请再试一次。'
      : phase === 'ready'
        ? '暂时无法开始升级，请再试一次。'
        : error.startsWith('已取消备份')
          ? '已取消备份，请先保存备份再升级。'
          : '备份没有成功，请再试一次。'
    : phase === 'ready'
      ? '备份已保存。确认后开始升级，请暂时不要关闭应用。'
      : phase === 'saving'
        ? '正在备份，请选择保存位置。'
        : phase === 'migrating' || phase === 'cleaning'
          ? '正在升级你的数据，请暂时不要关闭应用。'
          : '这次更新需要升级你的本地数据。请先备份，完成后再确认升级。';

  return (
    <ActionDrawer
      isOpen={phase !== 'idle'}
      onClose={keepDrawerOpen}
      dismissible={false}
      disableHistory
    >
      <ActionDrawer.Icon icon={ArrowUpIcon} />
      <ActionDrawer.Content>
        <p
          role={error ? 'alert' : 'status'}
          aria-live="polite"
          className="text-neutral-500 dark:text-neutral-400"
        >
          {message}
        </p>
      </ActionDrawer.Content>
      <ActionDrawer.Actions>
        <ActionDrawer.SecondaryButton
          onClick={saveNativeMigrationBackup}
          disabled={busy || phase === 'failed'}
        >
          {phase === 'ready' ? '再次备份' : '备份数据'}
        </ActionDrawer.SecondaryButton>
        <ActionDrawer.PrimaryButton
          onClick={phase === 'failed' ? retryUpgrade : confirmNativeMigration}
          disabled={phase !== 'ready' && phase !== 'failed'}
        >
          {phase === 'failed' ? '重试升级' : '确认升级'}
        </ActionDrawer.PrimaryButton>
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
}
