import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  announceBusinessHistoryInvalidation,
  subscribeBusinessHistoryInvalidation,
} from './maintenance';
class TestChannel {
  static instances: TestChannel[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  closed = false;
  constructor(readonly name: string) {
    TestChannel.instances.push(this);
  }
  postMessage(data: unknown) {
    for (const peer of TestChannel.instances)
      if (peer !== this && !peer.closed && peer.name === this.name)
        peer.onmessage?.({ data });
  }
  close() {
    this.closed = true;
  }
}
function testWindow(channels = true) {
  const target = Object.assign(new EventTarget(), {
    BroadcastChannel: channels ? TestChannel : undefined,
    localStorage: { setItem: vi.fn() },
  });
  vi.stubGlobal('window', target);
  return target;
}
afterEach(() => {
  vi.unstubAllGlobals();
  TestChannel.instances = [];
});

describe('cross-tab history invalidation signals', () => {
  it('coalesces local, BroadcastChannel and storage notifications of one revision', () => {
    const target = testWindow();
    const callback = vi.fn();
    const cleanup = subscribeBusinessHistoryInvalidation(callback);
    announceBusinessHistoryInvalidation();
    expect(callback).toHaveBeenCalledOnce();
    const [key, newValue] = target.localStorage.setItem.mock.calls[0];
    target.dispatchEvent(
      Object.assign(new Event('storage'), { key, newValue })
    );
    expect(callback).toHaveBeenCalledOnce();
    cleanup();
    announceBusinessHistoryInvalidation();
    expect(callback).toHaveBeenCalledOnce();
  });

  it('receives a revision sent by another channel and closes on unmount', () => {
    testWindow();
    const callback = vi.fn();
    const cleanup = subscribeBusinessHistoryInvalidation(callback);
    const receiver = TestChannel.instances[0];
    const other = new TestChannel(receiver.name);
    other.postMessage({ revision: 'other-tab-reset' });
    expect(callback).toHaveBeenCalledOnce();
    cleanup();
    expect(receiver.closed).toBe(true);
    other.postMessage({ revision: 'later-reset' });
    expect(callback).toHaveBeenCalledOnce();
  });

  it('uses storage signals without BroadcastChannel and ignores malformed values', () => {
    const target = testWindow(false);
    const callback = vi.fn();
    const cleanup = subscribeBusinessHistoryInvalidation(callback);
    announceBusinessHistoryInvalidation();
    const [key] = target.localStorage.setItem.mock.calls[0];
    target.dispatchEvent(
      Object.assign(new Event('storage'), { key, newValue: '{bad' })
    );
    target.dispatchEvent(
      Object.assign(new Event('storage'), {
        key,
        newValue: '{"revision":"remote"}',
      })
    );
    expect(callback).toHaveBeenCalledTimes(2);
    cleanup();
  });
});
