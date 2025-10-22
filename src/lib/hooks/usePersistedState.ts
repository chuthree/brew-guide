import { useState, useEffect, useCallback } from 'react';
import {
  getStringState,
  saveStringState,
  getBooleanState,
  saveBooleanState,
  getNumberState,
  saveNumberState,
  getObjectState,
  saveObjectState,
} from '../core/statePersistence';

/**
 * 通用持久化状态Hook，自动从localStorage加载并保存状态
 * @param moduleName 模块名称，用于隔离不同功能的状态
 * @param key 状态键名
 * @param initialValue 初始值/默认值
 * @returns 状态值和设置函数，类似useState
 */
export function usePersistedState<T>(
  moduleName: string,
  key: string,
  initialValue: T
): [T, (value: T | ((prevValue: T) => T)) => void] {
  // 使用lazy初始化，确保初次加载时使用默认值
  // 而不是在服务器端渲染时尝试读取localStorage
  const [value, setValue] = useState<T>(() => {
    // 在客户端运行时，尝试从localStorage读取
    // 服务器端渲染时不执行这部分代码
    if (typeof window !== 'undefined') {
      return loadState();
    }
    return initialValue;
  });

  // 辅助函数，根据类型加载状态
  const loadState = useCallback((): T => {
    const type = typeof initialValue;
    if (type === 'string') {
      return getStringState(
        moduleName,
        key,
        initialValue as string
      ) as unknown as T;
    } else if (type === 'boolean') {
      return getBooleanState(
        moduleName,
        key,
        initialValue as boolean
      ) as unknown as T;
    } else if (type === 'number') {
      return getNumberState(
        moduleName,
        key,
        initialValue as number
      ) as unknown as T;
    } else {
      return getObjectState(moduleName, key, initialValue);
    }
  }, [moduleName, key, initialValue]);

  // 保存状态的函数
  const saveState = useCallback(
    (newValue: T) => {
      const type = typeof newValue;
      if (type === 'string') {
        saveStringState(moduleName, key, newValue as string);
      } else if (type === 'boolean') {
        saveBooleanState(moduleName, key, newValue as boolean);
      } else if (type === 'number') {
        saveNumberState(moduleName, key, newValue as number);
      } else {
        saveObjectState(moduleName, key, newValue);
      }
    },
    [moduleName, key]
  );

  // 更新函数，处理值和函数更新器两种情况
  const setAndPersistValue = (newValueOrUpdater: T | ((prevValue: T) => T)) => {
    setValue(prevValue => {
      const newValue =
        typeof newValueOrUpdater === 'function'
          ? (newValueOrUpdater as (prevValue: T) => T)(prevValue)
          : newValueOrUpdater;

      // 保存到localStorage
      saveState(newValue);

      return newValue;
    });
  };

  // 初始加载时执行一次保存，确保默认值被存储
  // 仅在客户端执行
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 这样确保在客户端渲染时加载一次正确的值
      const storedValue = loadState();
      if (storedValue !== value) {
        setValue(storedValue);
      } else {
        // 如果没有存储的值，则保存当前默认值
        saveState(value);
      }
    }
  }, [loadState, saveState, value]);

  return [value, setAndPersistValue];
}
