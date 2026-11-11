import { useCallback, useState } from 'react';
import type { ISyncResult } from '@/lib/sync/interfaces';

export function useSyncDiagnostics() {
  const [debugLogs, setDebugLogs] = useState<readonly string[]>([]);
  const [showDebugDrawer, setShowDebugDrawer] = useState(false);

  const showSyncFailure = useCallback(
    (result: Pick<ISyncResult, 'message' | 'errors' | 'debugLogs'>) => {
      setDebugLogs(
        result.debugLogs?.length
          ? result.debugLogs
          : [...new Set([result.message, ...result.errors])]
      );
      setShowDebugDrawer(true);
    },
    []
  );

  return {
    debugLogs,
    setDebugLogs,
    showDebugDrawer,
    setShowDebugDrawer,
    showSyncFailure,
  };
}
