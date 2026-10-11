'use client';

/**
 * 数据层 Provider
 *
 * 在应用启动时初始化所有数据 Store
 * 确保组件渲染前数据已准备就绪
 */

import {
  useEffect,
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
} from '@/lib/app/crashDiagnostics';
import { detectAppRuntime } from '@/lib/app/runtime';
import dynamic from 'next/dynamic';

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
  const [nativeAndroid, setNativeAndroid] = useState<boolean | null>(null);
  const [state, setState] = useState<DataLayerContextValue>({
    isInitialized: false,
    isInitializing: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const runtime = detectAppRuntime();
        setNativeAndroid(
          runtime.runtime === 'capacitor' &&
            runtime.capacitorPlatform === 'android'
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

  // Android must not load editable screens or connect cloud sync before the
  // user has backed up, approved and completed the storage upgrade.
  return (
    <DataLayerContext.Provider value={state}>
      {nativeAndroid === null || (nativeAndroid && !state.isInitialized) ? (
        <div className="flex min-h-dvh items-center justify-center px-6 text-sm text-neutral-500 dark:text-neutral-400">
          {state.error ? (
            <div className="space-y-4 text-center">
              <p role="alert">暂时无法加载数据，请再试一次。</p>
              <button type="button" onClick={retryInitialization}>
                重试
              </button>
            </div>
          ) : (
            <p role="status">正在准备本地数据…</p>
          )}
        </div>
      ) : (
        children
      )}
      {nativeAndroid && <NativeMigrationDrawer />}
    </DataLayerContext.Provider>
  );
}
