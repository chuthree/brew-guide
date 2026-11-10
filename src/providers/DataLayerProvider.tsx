'use client';

/**
 * 数据层 Provider
 *
 * 在应用启动时初始化所有数据 Store
 * 确保组件渲染前数据已准备就绪
 */

import {
  useEffect,
  useCallback,
  useState,
  createContext,
  useContext,
  ReactNode,
} from 'react';
import {
  initializeDataLayer,
  getInitializationState,
} from '@/lib/core/dataLayer';
import {
  markCrashDiagnosticsReady,
  recordCrashCheckpoint,
  recordCrashError,
  installCrashDiagnostics,
  getCurrentCrashDiagnosticSession,
  getCrashDiagnosticReport,
} from '@/lib/app/crashDiagnostics';
import { detectAppRuntime } from '@/lib/app/runtime';
import { resolveStorageBackend } from '@/lib/data/runtime';
import dynamic from 'next/dynamic';
import { useStore } from 'zustand';
import { nativeMigrationGate } from '@/lib/data/nativeMigrationGate';

const NativeMigrationDrawer = dynamic(
  () => import('@/components/layout/NativeMigrationDrawer'),
  { ssr: false }
);

function retryInitialization() {
  window.location.reload();
}

interface DataLayerContextValue {
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
}

const DataLayerContext = createContext<DataLayerContextValue>({
  isInitialized: false,
  isInitializing: false,
  error: null,
});

export function useDataLayer() {
  return useContext(DataLayerContext);
}

interface DataLayerProviderProps {
  children: ReactNode;
}

export function DataLayerProvider({ children }: DataLayerProviderProps) {
  const migrationActive = useStore(
    nativeMigrationGate,
    state => state.phase !== 'idle'
  );
  const [nativeApp, setNativeApp] = useState<boolean | null>(null);
  const [diagnosticStatus, setDiagnosticStatus] = useState('');
  const [exportingDiagnostics, setExportingDiagnostics] = useState(false);
  const [state, setState] = useState<DataLayerContextValue>({
    isInitialized: false,
    isInitializing: true,
    error: null,
  });

  const exportDiagnostics = useCallback(async () => {
    if (exportingDiagnostics) return;
    setExportingDiagnostics(true);
    setDiagnosticStatus('');
    try {
      const { exportJsonFile } = await import('@/lib/utils/jsonExport');
      const [session, previousReport] = await Promise.all([
        getCurrentCrashDiagnosticSession().catch(() => null),
        getCrashDiagnosticReport().catch(() => null),
      ]);
      await exportJsonFile({
        jsonData: JSON.stringify(
          { error: state.error, session, previousReport },
          null,
          2
        ),
        fileName: 'brew-guide-startup-diagnostics.json',
        title: '导出启动诊断',
        dialogTitle: '导出启动诊断',
      });
    } catch {
      setDiagnosticStatus('诊断导出未完成，请重试。');
    } finally {
      setExportingDiagnostics(false);
    }
  }, [exportingDiagnostics, state.error]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const runtime = detectAppRuntime();
        setNativeApp(resolveStorageBackend(runtime) === 'native-sqlite');
        await installCrashDiagnostics().catch(error =>
          console.warn('启动诊断初始化失败:', error)
        );
        recordCrashCheckpoint('data-layer-provider:init:start');
        await initializeDataLayer();

        if (mounted) {
          const initState = getInitializationState();
          markCrashDiagnosticsReady({
            initialized: initState.isInitialized,
          });
          setState({
            isInitialized: initState.isInitialized,
            isInitializing: false,
            error: initState.error,
          });
        }
      } catch (error) {
        console.error('数据层初始化失败:', error);
        recordCrashError(error, 'data-layer-provider:init');
        if (mounted) {
          setState({
            isInitialized: false,
            isInitializing: false,
            error: error instanceof Error ? error.message : '初始化失败',
          });
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // Native apps must not load editable screens or connect cloud sync before the
  // user has backed up, approved and completed the storage upgrade.
  return (
    <DataLayerContext.Provider value={state}>
      {nativeApp === null || (nativeApp && !state.isInitialized) ? (
        !migrationActive && state.error ? (
          <div className="flex min-h-dvh items-center justify-center px-6 text-sm text-neutral-500 dark:text-neutral-400">
            <div className="space-y-4 text-center">
              <p role="alert">暂时无法加载数据，请再试一次。</p>
              <button type="button" onClick={retryInitialization}>
                重试
              </button>
              <button
                type="button"
                className="ml-6"
                disabled={exportingDiagnostics}
                onClick={exportDiagnostics}
              >
                {exportingDiagnostics ? '正在导出…' : '导出诊断'}
              </button>
              <p className="text-xs">
                重试仍失败时，请导出诊断并联系支持。请勿清除应用数据。
              </p>
              {diagnosticStatus && <p role="status">{diagnosticStatus}</p>}
            </div>
          </div>
        ) : null
      ) : (
        children
      )}
      {nativeApp && (
        <NativeMigrationDrawer
          onExportDiagnostics={exportDiagnostics}
          exportingDiagnostics={exportingDiagnostics}
          diagnosticStatus={diagnosticStatus}
        />
      )}
    </DataLayerContext.Provider>
  );
}
