'use client';

import DataProgressDrawer from './DataProgressDrawer';
import DiagnosticDetails from './DiagnosticDetails';
import {
  useFirstSupabaseSync,
  clearFirstSupabaseSync,
  refreshCompletedFirstSync,
} from '@/lib/stores/firstSupabaseSync';
import { reloadApp } from '@/lib/app/reload';

export default function FirstSupabaseSyncDrawer() {
  const run = useFirstSupabaseSync(state => state.run);
  if (!run) return null;
  const complete = run.phase === 'complete',
    failed = run.phase === 'error';
  const retry = async () => {
    const { getRealtimeSyncService } = await import('@/lib/supabase/realtime');
    if (useFirstSupabaseSync.getState().run?.id === run.id)
      await getRealtimeSyncService().retryFirstSync();
  };
  return (
    <DataProgressDrawer
      isOpen
      title="首次同步"
      message={
        complete
          ? '首次同步已完成。请刷新应用，加载最新数据。'
          : failed
            ? '首次同步未完成'
            : `首次同步 ${run.percent}% · ${run.stage}`
      }
      action={complete ? '刷新应用' : failed ? '重试' : '同步中…'}
      onAction={
        complete
          ? () => refreshCompletedFirstSync(run.id, reloadApp)
          : failed
            ? retry
            : undefined
      }
      onCancel={failed ? clearFirstSupabaseSync : undefined}
    >
      {failed && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          上传 {run.uploaded}，下载 {run.downloaded}，本机移除 {run.removed}
        </p>
      )}
      {failed && run.error && <DiagnosticDetails value={run.error} />}
    </DataProgressDrawer>
  );
}
