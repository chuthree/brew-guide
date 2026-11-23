import { create } from 'zustand';
import { sanitizeDiagnosticText } from '@/lib/feedback/sanitizeDiagnosticText';
import { useSyncStatusStore, type SupabaseSyncTask } from './syncStatusStore';

export type FirstSyncCount = 'uploaded' | 'downloaded' | 'removed';

interface FirstSync {
  id: symbol;
  phase: 'running' | 'error' | 'complete';
  percent: number;
  stage: string;
  uploaded: number;
  downloaded: number;
  removed: number;
  error?: string;
}

export const useFirstSupabaseSync = create<{ run: FirstSync | null }>(() => ({
  run: null,
}));
let unsubscribe: (() => void) | undefined;

function fraction(task: SupabaseSyncTask) {
  if (task.status === 'success') return 1;
  const n = Math.min(1, (task.completed ?? 0) / Math.max(1, task.total ?? 1));
  if (task.status === 'writing' || task.status === 'verifying')
    return 0.7 + n * 0.28;
  if (task.status === 'uploading' || task.status === 'downloading')
    return 0.1 + n * 0.58;
  return task.status === 'pending' ? 0 : 0.05;
}

export function startFirstSupabaseSync(): symbol | undefined {
  const previous = useFirstSupabaseSync.getState().run;
  if (previous && previous.phase !== 'error') return;
  const id = Symbol();
  useFirstSupabaseSync.setState({
    run: {
      id,
      phase: 'running',
      percent: 0,
      stage: '正在准备同步',
      uploaded: previous?.uploaded ?? 0,
      downloaded: previous?.downloaded ?? 0,
      removed: previous?.removed ?? 0,
    },
  });
  unsubscribe = useSyncStatusStore.subscribe(
    state => state.supabaseSyncProgress,
    ({ tasks }) => {
      const run = useFirstSupabaseSync.getState().run;
      if (!run || run.id !== id) return;
      const active = tasks.find(task =>
        [
          'preparing',
          'fetching',
          'downloading',
          'uploading',
          'writing',
          'verifying',
        ].includes(task.status)
      );
      const percent = Math.min(
        99,
        Math.floor(
          (100 * tasks.reduce((sum, item) => sum + fraction(item), 0)) /
            Math.max(1, tasks.length)
        )
      );
      useFirstSupabaseSync.setState({
        run: {
          ...run,
          percent: Math.max(run.percent, percent),
          stage: active ? `正在同步${active.label}` : run.stage,
        },
      });
    },
    { fireImmediately: true }
  );
  return id;
}

export function finishFirstSupabaseSync(
  id: symbol | undefined,
  phase: 'complete' | 'error',
  failure?: string
) {
  const run = useFirstSupabaseSync.getState().run;
  if (!run || id !== run.id || run.phase !== 'running') return;
  unsubscribe?.();
  unsubscribe = undefined;
  // Snapshot only the failed tasks: later syncs can replace the live progress.
  // Never include item names, settings, successful task detail or request bodies.
  const error =
    phase === 'error'
      ? sanitizeDiagnosticText(
          useSyncStatusStore
            .getState()
            .supabaseSyncProgress.tasks.filter(task => task.error)
            .map(task => `${task.label}：${task.error}`)
            .join('\n\n') ||
            failure ||
            ''
        ).slice(0, 12000)
      : undefined;
  useFirstSupabaseSync.setState({
    run: {
      ...run,
      phase,
      error,
      percent: phase === 'complete' ? 100 : run.percent,
    },
  });
}

export function countFirstSyncTransfer(
  id: symbol | undefined,
  field: FirstSyncCount,
  count: number
) {
  const run = useFirstSupabaseSync.getState().run;
  if (run && run.id === id && run.phase === 'running' && count > 0)
    useFirstSupabaseSync.setState({
      run: { ...run, [field]: run[field] + count },
    });
}

export function clearFirstSupabaseSync() {
  unsubscribe?.();
  unsubscribe = undefined;
  useFirstSupabaseSync.setState({ run: null });
}

export function refreshCompletedFirstSync(id: symbol, refresh: () => void) {
  const run = useFirstSupabaseSync.getState().run;
  if (run?.id !== id || run.phase !== 'complete') return;
  clearFirstSupabaseSync();
  refresh();
}
