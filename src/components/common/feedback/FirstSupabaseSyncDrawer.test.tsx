// @vitest-environment jsdom
import { act, type ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { reloadApp } from '@/lib/app/reload';
import {
  clearFirstSupabaseSync,
  countFirstSyncTransfer,
  finishFirstSupabaseSync,
  refreshCompletedFirstSync,
  startFirstSupabaseSync,
  useFirstSupabaseSync,
} from '@/lib/stores/firstSupabaseSync';
import { useSyncStatusStore } from '@/lib/stores/syncStatusStore';
import FirstSupabaseSyncDrawer from './FirstSupabaseSyncDrawer';
import type DataProgressDrawer from './DataProgressDrawer';

vi.mock('@/lib/app/reload', () => ({ reloadApp: vi.fn() }));
vi.mock('./DataProgressDrawer', () => ({
  default: ({
    message,
    children,
    onCancel,
    onAction,
    action,
  }: ComponentProps<typeof DataProgressDrawer>) => (
    <div>
      {message}
      {children}
      {onCancel && <button onClick={onCancel}>取消</button>}
      <button disabled={!onAction} onClick={onAction}>
        {action}
      </button>
    </div>
  ),
}));

afterEach(() => {
  clearFirstSupabaseSync();
  useSyncStatusStore.getState().reset();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it('keeps acknowledged results through a retry and a route remount until one explicit refresh', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  let root = createRoot(container);
  await act(async () => root.render(<FirstSupabaseSyncDrawer />));
  expect(container.textContent).toBe('');
  let first!: symbol;
  act(() => {
    useSyncStatusStore
      .getState()
      .startSupabaseSyncProgress('initial-sync', '同步', [
        { id: 'coffee_beans', label: '咖啡豆' },
        { id: 'brewing_notes', label: '笔记' },
      ]);
    first = startFirstSupabaseSync()!;
    countFirstSyncTransfer(first, 'downloaded', 211);
    countFirstSyncTransfer(first, 'removed', 3);
    useSyncStatusStore.getState().updateSupabaseSyncTask('brewing_notes', {
      status: 'error',
      error:
        'PGRST204\nhttps://example.test/private\nAuthorization: Bearer fake-token',
    });
    finishFirstSupabaseSync(first, 'error', '同步未完成');
    useSyncStatusStore.getState().reset();
  });
  expect(container.textContent).toContain('首次同步未完成');
  expect(container.querySelector('p')?.textContent).toBe(
    '上传 0，下载 211，本机移除 3'
  );
  expect(container.querySelectorAll('button')).toHaveLength(2);
  const diagnostic = container.querySelector('textarea');
  expect(diagnostic?.readOnly).toBe(true);
  expect(diagnostic?.value).toContain('笔记：PGRST204');
  expect(diagnostic?.value).not.toMatch(/example\.test|fake-token|合成A/);
  expect(container.querySelector('p')?.textContent).not.toContain('PGRST204');
  let second!: symbol;
  act(() => {
    second = startFirstSupabaseSync()!;
  });
  expect(container.querySelector('textarea')).toBeNull();
  act(() => {
    countFirstSyncTransfer(first, 'uploaded', 1);
    countFirstSyncTransfer(second, 'downloaded', 1);
    finishFirstSupabaseSync(second, 'complete');
    useSyncStatusStore.getState().reset();
    root.unmount();
  });
  expect(reloadApp).not.toHaveBeenCalled();
  root = createRoot(container);
  await act(async () => root.render(<FirstSupabaseSyncDrawer />));
  expect(container.querySelector('p')).toBeNull();
  expect(container.textContent).toContain(
    '首次同步已完成。请刷新应用，加载最新数据。'
  );
  expect(container.querySelector('textarea')).toBeNull();
  expect(container.querySelectorAll('button')).toHaveLength(1);
  expect(container.querySelector('button')?.textContent).toBe('刷新应用');
  act(() => {
    container.querySelector('button')!.click();
    refreshCompletedFirstSync(second, reloadApp);
  });
  expect(reloadApp).toHaveBeenCalledOnce();
  expect(useFirstSupabaseSync.getState().run).toBeNull();
  act(() => root.unmount());
});

it('dismisses a failed run without refreshing or accepting its late completion', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  const root = createRoot(container);
  const first = startFirstSupabaseSync()!;
  finishFirstSupabaseSync(first, 'error');
  await act(async () => root.render(<FirstSupabaseSyncDrawer />));
  act(() => container.querySelector('button')!.click());
  finishFirstSupabaseSync(first, 'complete');
  expect(container.textContent).toBe('');
  expect(reloadApp).not.toHaveBeenCalled();
  act(() => root.unmount());
});
