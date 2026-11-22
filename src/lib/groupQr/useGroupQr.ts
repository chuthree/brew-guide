'use client';

import { useEffect, useState } from 'react';
import { API_CONFIG } from '@/lib/api/shared/config';

const REQUEST_TIMEOUT_MS = 4_000;
const REFRESH_MS = 60_000;

interface GroupQr {
  imageDataUrl: string;
  expiresAt: number;
}

async function fetchGroupQr(signal: AbortSignal): Promise<GroupQr | null> {
  const response = await fetch(
    `${API_CONFIG.baseURL}/api/group-qr?fresh=${Date.now()}`,
    { signal, cache: 'no-store', credentials: 'same-origin' }
  );
  if (!response.ok) return null;
  const code = await response.json();
  if (
    typeof code?.imageDataUrl !== 'string' ||
    !/^data:image\/(png|jpeg);base64,/.test(code.imageDataUrl) ||
    !Number.isSafeInteger(code.expiresAt) ||
    code.expiresAt <= Date.now()
  ) {
    return null;
  }

  // Change the caption only after the same image can actually be displayed.
  const image = new Image();
  image.src = code.imageDataUrl;
  await image.decode();
  return code;
}

export function useGroupQr(): GroupQr | null {
  const [code, setCode] = useState<GroupQr | null>(null);

  useEffect(() => {
    let cancelRequest: (() => void) | undefined;
    let expiry: ReturnType<typeof setTimeout> | undefined;

    const refresh = async () => {
      cancelRequest?.();
      setCode(current =>
        current && current.expiresAt > Date.now() ? current : null
      );
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
        setCode(null);
      }, REQUEST_TIMEOUT_MS);
      cancelRequest = () => {
        controller.abort();
        clearTimeout(timeout);
      };

      let result: GroupQr | null = null;
      try {
        result = await fetchGroupQr(controller.signal);
      } catch {
        // Keep the bundled personal QR as the offline/failed-request state.
      } finally {
        clearTimeout(timeout);
      }
      if (controller.signal.aborted) return;

      clearTimeout(expiry);
      const remaining = (result?.expiresAt ?? 0) - Date.now();
      setCode(remaining > 0 ? result : null);
      if (remaining > 0) {
        expiry = setTimeout(() => {
          setCode(null);
          void refresh();
        }, remaining);
      }
    };

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const initial = setTimeout(refresh, 0);
    const interval = setInterval(refreshIfVisible, REFRESH_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      cancelRequest?.();
      clearTimeout(initial);
      clearTimeout(expiry);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, []);

  return code;
}
