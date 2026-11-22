'use client';

import { useEffect, useState } from 'react';
import { API_CONFIG } from '@/lib/api/shared/config';

const REQUEST_TIMEOUT_MS = 4_000;

interface GroupQr {
  imageDataUrl: string;
  expiresAt: number;
}

async function fetchGroupQr(signal: AbortSignal): Promise<GroupQr | null> {
  const response = await fetch(`${API_CONFIG.baseURL}/api/group-qr`, {
    signal,
    cache: 'no-store',
  });
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
  return code.expiresAt > Date.now() ? code : null;
}

export function useGroupQr(active: boolean): GroupQr | null {
  const [code, setCode] = useState<GroupQr | null>(null);

  useEffect(() => {
    if (!active) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      setCode(null);
    }, REQUEST_TIMEOUT_MS);

    void fetchGroupQr(controller.signal)
      .catch(() => null)
      .then(result => {
        if (!controller.signal.aborted) setCode(result);
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [active]);

  useEffect(() => {
    if (!code) return;
    const expiry = setTimeout(() => setCode(null), code.expiresAt - Date.now());
    return () => clearTimeout(expiry);
  }, [code]);

  return code;
}
