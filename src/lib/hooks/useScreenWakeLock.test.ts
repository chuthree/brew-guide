// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { retainScreenWakeLock, useScreenWakeLock } from './useScreenWakeLock';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { detectAppRuntime } from '@/lib/app/runtime';

vi.mock('@/lib/app/runtime', () => ({
  detectAppRuntime: vi.fn(() => ({ runtime: 'web' })),
}));
vi.mock('@capacitor-community/keep-awake', () => ({
  KeepAwake: { keepAwake: vi.fn(), allowSleep: vi.fn() },
}));
function sentinel() {
  const result = Object.assign(new EventTarget(), {
    released: false,
    release: vi.fn(async () => {
      result.released = true;
      result.dispatchEvent(new Event('release'));
    }),
  });
  return result;
}
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it('releases a late browser acquisition after component unmount', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const lock = sentinel();
  let grant!: () => void;
  const request = vi.fn(
    () =>
      new Promise(resolve => {
        grant = () => resolve(lock);
      })
  );
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: { request },
  });
  function Consumer() {
    useScreenWakeLock(true);
    return null;
  }
  const root = createRoot(document.createElement('div'));
  await act(async () => root.render(createElement(Consumer)));
  expect(request).toHaveBeenCalledOnce();
  act(() => root.unmount());
  grant();
  await tick();
  expect(lock.release).toHaveBeenCalledOnce();
});

it('shares locks, reacquires on visible system release, and stays idle when hidden or finished', async () => {
  const locks = [sentinel(), sentinel(), sentinel()];
  const request = vi
    .fn()
    .mockResolvedValueOnce(locks[0])
    .mockResolvedValueOnce(locks[1])
    .mockResolvedValueOnce(locks[2]);
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: { request },
  });
  const visibility = (value: string) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  };
  visibility('visible');
  const a = retainScreenWakeLock(),
    b = retainScreenWakeLock();
  await tick();
  a();
  a();
  expect(locks[0].release).not.toHaveBeenCalled();
  await locks[0].release();
  await tick();
  expect(request).toHaveBeenCalledTimes(2);
  visibility('hidden');
  await tick();
  expect(locks[1].release).toHaveBeenCalledOnce();
  visibility('visible');
  await tick();
  b();
  await tick();
  visibility('visible');
  await tick();
  expect(locks[2].release).toHaveBeenCalledOnce();
  expect(request).toHaveBeenCalledTimes(3);
});

it('does not block work when denied and releases the native lease after the last user', async () => {
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: { request: vi.fn().mockRejectedValue(new Error('denied')) },
  });
  const denied = retainScreenWakeLock();
  await tick();
  denied();
  await tick();
  vi.mocked(detectAppRuntime).mockReturnValueOnce({
    runtime: 'capacitor',
  } as ReturnType<typeof detectAppRuntime>);
  const first = retainScreenWakeLock(),
    second = retainScreenWakeLock();
  await tick();
  first();
  await tick();
  expect(KeepAwake.keepAwake).toHaveBeenCalledOnce();
  expect(KeepAwake.allowSleep).not.toHaveBeenCalled();
  second();
  await tick();
  expect(KeepAwake.allowSleep).toHaveBeenCalledOnce();
});
