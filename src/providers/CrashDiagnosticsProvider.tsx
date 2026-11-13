'use client';

import { useEffect } from 'react';
import {
  installCrashDiagnostics,
  recordCrashCheckpoint,
} from '@/lib/app/crashDiagnostics';

export default function CrashDiagnosticsProvider() {
  useEffect(() => {
    void installCrashDiagnostics();
    recordCrashCheckpoint('client:provider-mounted');
  }, []);

  return null;
}
