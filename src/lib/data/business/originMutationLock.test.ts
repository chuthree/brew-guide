import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  hasCrossTabMutationLock,
  WEB_BUSINESS_MUTATION_LOCK,
  withOriginMutationLock,
} from './originMutationLock';
const runtime = vi.hoisted(() => ({ runtime: 'web', capacitorPlatform: null }));
vi.mock('@/lib/app/runtime', () => ({ detectAppRuntime: () => runtime }));
import { withDataMutation } from '@/lib/data/mutationCoordinator';
afterEach(() => {
  vi.unstubAllGlobals();
  runtime.runtime = 'web';
});

describe('origin-wide Web mutation lock', () => {
  it('uses the same exclusive origin lock for independent callers', async () => {
    let tail = Promise.resolve();
    const request = vi.fn(
      (_name: string, _options: unknown, callback: () => Promise<unknown>) => {
        const result = tail.then(callback);
        tail = result.then(
          () => {},
          () => {}
        );
        return result;
      }
    );
    vi.stubGlobal('navigator', { locks: { request } });
    const order: string[] = [];
    let release!: () => void;
    const first = withOriginMutationLock(async () => {
      order.push('first starts');
      await new Promise<void>(resolve => {
        release = resolve;
      });
      order.push('first ends');
    });
    const second = withOriginMutationLock(async () => {
      order.push('second');
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(order).toEqual(['first starts']);
    release();
    await Promise.all([first, second]);
    expect(order).toEqual(['first starts', 'first ends', 'second']);
    expect(request).toHaveBeenCalledWith(
      WEB_BUSINESS_MUTATION_LOCK,
      { mode: 'exclusive' },
      expect.any(Function)
    );
  });

  it('does not run without the lock if an advertised lock manager rejects', async () => {
    vi.stubGlobal('navigator', {
      locks: {
        request: vi.fn(async () => {
          throw new Error('lock denied');
        }),
      },
    });
    const work = vi.fn(async () => 'unsafe fallback');
    await expect(withOriginMutationLock(work)).rejects.toThrow('lock denied');
    expect(work).not.toHaveBeenCalled();
  });

  it('reports unsupported browsers and retains the existing local behavior', async () => {
    vi.stubGlobal('navigator', {});
    expect(hasCrossTabMutationLock()).toBe(false);
    expect(await withOriginMutationLock(async () => 7)).toBe(7);
  });

  it('uses origin locking only for Dexie storage, preserving bundled native behavior', async () => {
    const request = vi.fn(async (_name, _options, work) => work());
    vi.stubGlobal('navigator', { locks: { request } });
    await withDataMutation(async () => 'web');
    expect(request).toHaveBeenCalledOnce();
    runtime.runtime = 'tauri';
    await withDataMutation(async () => 'native');
    expect(request).toHaveBeenCalledOnce();
  });
});
