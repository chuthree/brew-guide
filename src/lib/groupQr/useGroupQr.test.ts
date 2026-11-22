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

function Panel() {
  return createElement('div', null, useGroupQr()?.imageDataUrl ?? 'fallback');
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
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
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

  const render = () => act(() => root.render(createElement(Panel)));
  const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

  it('loads only when mounted, switches images while open, and reloads on reopening', async () => {
    fetchMock.mockImplementationOnce(() => response(firstImage, 120_000));
    fetchMock.mockImplementationOnce(() => response(secondImage, 120_000));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect(fetchMock).not.toHaveBeenCalled();
    render();
    expect(host.textContent).toBe('fallback');
    await tick(1);
    expect(host.textContent).toBe(firstImage);
    await tick(60_000);
    expect(host.textContent).toBe(secondImage);
    expect(fetchMock.mock.calls[0]?.[0]).not.toBe(fetchMock.mock.calls[1]?.[0]);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      cache: 'no-store',
      credentials: 'same-origin',
    });
    act(() => root.render(null));
    render();
    expect(host.textContent).toBe('fallback');
    await tick(1);
    expect(host.textContent).toBe('fallback');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('stops showing an expired image even while the panel stays open', async () => {
    fetchMock.mockImplementationOnce(() => response(firstImage, 4_000));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    render();
    await tick(1);
    expect(host.textContent).toBe(firstImage);
    await tick(4_000);
    expect(host.textContent).toBe('fallback');
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
