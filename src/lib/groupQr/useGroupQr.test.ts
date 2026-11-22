// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGroupQr } from './useGroupQr';

const firstImage = 'data:image/png;base64,AAAA';
const secondImage = 'data:image/png;base64,BBBB';
const response = (imageDataUrl: string, validFor: number) =>
  Response.json({ imageDataUrl, expiresAt: Date.now() + validFor });
const fetchMock = vi.fn();
const decode = vi.fn();

function Panel({ active }: { active: boolean }) {
  const code = useGroupQr(active);
  return createElement('div', null, code?.imageDataUrl ?? 'fallback');
}

describe('group QR client refresh', () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal(
      'Image',
      class {
        decode = decode;
      }
    );
    fetchMock.mockReset();
    decode.mockReset().mockResolvedValue(undefined);
    host = document.createElement('div');
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const render = (active = true) =>
    act(() => root.render(createElement(Panel, { active })));
  const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

  it('loads while expanded, retains the closing image, and refreshes on reopening', async () => {
    fetchMock.mockImplementationOnce(() => response(firstImage, 120_000));
    fetchMock.mockImplementationOnce(() => response(secondImage, 120_000));
    render(false);
    await tick(60_000);
    expect(fetchMock).not.toHaveBeenCalled();
    render();
    expect(host.textContent).toBe('fallback');
    await tick(1);
    expect(host.textContent).toBe(firstImage);
    await tick(60_000);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(host.textContent).toBe(firstImage);
    render(false);
    expect(host.textContent).toBe(firstImage);
    render();
    await tick(1);
    expect(host.textContent).toBe(secondImage);
    for (const [url, options] of fetchMock.mock.calls) {
      expect(new URL(url).pathname).toBe('/api/group-qr');
      expect(new URL(url).search).toBe('');
      expect(options.cache).toBe('no-store');
    }
    render(false);
    await tick(60_000);
    expect(host.textContent).toBe(secondImage);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops showing an expired image even while the panel stays open', async () => {
    fetchMock.mockImplementationOnce(() => response(firstImage, 4_000));
    render();
    await tick(1);
    expect(host.textContent).toBe(firstImage);
    await tick(4_000);
    expect(host.textContent).toBe('fallback');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the fallback if an image cannot be decoded', async () => {
    fetchMock.mockImplementationOnce(() => response(firstImage, 120_000));
    decode.mockRejectedValueOnce(new Error('Image failed'));
    render();
    await tick(1);
    expect(host.textContent).toBe('fallback');
  });

  it('ignores a request that resolves after timeout or unmount', async () => {
    let resolve!: (value: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>(done => {
          resolve = done;
        })
    );
    render();
    await tick(5_000);
    expect(fetchMock.mock.calls[0]?.[1].signal.aborted).toBe(true);
    await act(async () => resolve(response(firstImage, 120_000)));
    expect(host.textContent).toBe('fallback');
    act(() => root.render(null));
    await tick(120_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
