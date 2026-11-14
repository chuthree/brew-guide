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
import { initializeDataLayer } from '@/lib/core/dataLayer';
import {
  markCrashDiagnosticsReady,
  recordCrashCheckpoint,
  recordCrashError,
  installCrashDiagnostics,
} from '@/lib/app/crashDiagnostics';
import { detectAppRuntime } from '@/lib/app/runtime';
import { resolveStorageBackend } from '@/lib/data/runtime';
import dynamic from 'next/dynamic';
import FatalErrorScreen from '@/components/common/feedback/FatalErrorScreen';

const NativeMigrationDrawer = dynamic(
  () => import('@/components/layout/NativeMigrationDrawer'),
  { ssr: false }
);

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
  const [nativeApp, setNativeApp] = useState<boolean | null>(null);
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
        setNativeApp(resolveStorageBackend(runtime) === 'native-sqlite');
        await installCrashDiagnostics().catch(error =>
          console.warn('启动诊断初始化失败:', error)
        );
        recordCrashCheckpoint('data-layer-provider:init:start');
        await initializeDataLayer();

        if (mounted) {
          markCrashDiagnosticsReady({
            initialized: true,
          });
          setState({
            isInitialized: true,
            isInitializing: false,
            error: null,
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
      {state.error !== null ? (
        <FatalErrorScreen
          title="无法读取本地数据"
          description="Brew Guide 启动时遇到问题。你可以尝试导出数据副本，或将诊断信息发给开发者以获取协助。"
          error={state.error}
        />
      ) : nativeApp === null || (nativeApp && !state.isInitialized) ? null : (
        children
      )}
      {nativeApp && <NativeMigrationDrawer />}
    </DataLayerContext.Provider>
  );
}
