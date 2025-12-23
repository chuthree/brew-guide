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
  const [state, setState] = useState<DataLayerContextValue>({
    isInitialized: false,
    isInitializing: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await initializeDataLayer();

        if (mounted) {
          const initState = getInitializationState();
          setState({
            isInitialized: initState.isInitialized,
            isInitializing: false,
            error: initState.error,
          });
        }
      } catch (error) {
        console.error('数据层初始化失败:', error);
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

  // 不阻塞渲染，让组件自行处理加载状态
  return (
    <DataLayerContext.Provider value={state}>
      {children}
    </DataLayerContext.Provider>
  );
}
