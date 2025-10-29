/**
 * 状态持久化工具 - 用于保存和恢复用户界面状态
 * 支持跨页面、刷新后保持用户的筛选和视图选择
 */

// 应用前缀，避免与其他应用的localStorage键冲突
const APP_PREFIX = 'brew-guide';

/**
 * 检查localStorage是否可用（在服务器端渲染时不可用）
 */
const isLocalStorageAvailable = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const testKey = `${APP_PREFIX}:test`;
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch (_error) {
    return false;
  }
};

/**
 * 获取完整的存储键名
 * @param module 模块名称（如'coffee-beans', 'notes'等）
 * @param key 状态键名
 * @returns 格式化的完整键名
 */
const getStorageKey = (module: string, key: string): string => {
  return `${APP_PREFIX}:${module}:${key}`;
};

/**
 * 保存字符串值到localStorage
 * @param module 模块名称
 * @param key 状态键名
 * @param value 要保存的字符串值
 */
export const saveStringState = (
  module: string,
  key: string,
  value: string
): void => {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    localStorage.setItem(getStorageKey(module, key), value);
  } catch (error) {
    console.error(`无法保存状态 [${module}:${key}]`, error);
  }
};

/**
 * 读取字符串值
 * @param module 模块名称
 * @param key 状态键名
 * @param defaultValue 默认值（如果未找到）
 * @returns 存储的字符串值或默认值
 */
export const getStringState = (
  module: string,
  key: string,
  defaultValue: string = ''
): string => {
  if (!isLocalStorageAvailable()) {
    return defaultValue;
  }

  try {
    const value = localStorage.getItem(getStorageKey(module, key));
    return value !== null ? value : defaultValue;
  } catch (error) {
    console.error(`无法读取状态 [${module}:${key}]`, error);
    return defaultValue;
  }
};

/**
 * 保存数字值
 * @param module 模块名称
 * @param key 状态键名
 * @param value 要保存的数字值
 */
export const saveNumberState = (
  module: string,
  key: string,
  value: number
): void => {
  saveStringState(module, key, value.toString());
};

/**
 * 读取数字值
 * @param module 模块名称
 * @param key 状态键名
 * @param defaultValue 默认值（如果未找到或发生错误）
 * @returns 存储的数字值或默认值
 */
export const getNumberState = (
  module: string,
  key: string,
  defaultValue: number = 0
): number => {
  try {
    const value = getStringState(module, key, defaultValue.toString());
    return Number(value);
  } catch (_error) {
    return defaultValue;
  }
};

/**
 * 保存布尔值
 * @param module 模块名称
 * @param key 状态键名
 * @param value 要保存的布尔值
 */
export const saveBooleanState = (
  module: string,
  key: string,
  value: boolean
): void => {
  saveStringState(module, key, value.toString());
};

/**
 * 读取布尔值
 * @param module 模块名称
 * @param key 状态键名
 * @param defaultValue 默认值（如果未找到）
 * @returns 存储的布尔值或默认值
 */
export const getBooleanState = (
  module: string,
  key: string,
  defaultValue: boolean = false
): boolean => {
  const value = getStringState(module, key, '');
  return value === '' ? defaultValue : value === 'true';
};

/**
 * 保存JSON对象
 * @param module 模块名称
 * @param key 状态键名
 * @param value 要保存的对象
 */
export const saveObjectState = <T>(
  module: string,
  key: string,
  value: T
): void => {
  try {
    const jsonValue = JSON.stringify(value);
    saveStringState(module, key, jsonValue);
  } catch (error) {
    console.error(`无法保存对象状态 [${module}:${key}]`, error);
  }
};

/**
 * 读取JSON对象
 * @param module 模块名称
 * @param key 状态键名
 * @param defaultValue 默认值（如果未找到或解析失败）
 * @returns 解析后的对象或默认值
 */
export const getObjectState = <T>(
  module: string,
  key: string,
  defaultValue: T
): T => {
  try {
    const jsonValue = getStringState(module, key, '');
    if (!jsonValue) return defaultValue;
    return JSON.parse(jsonValue) as T;
  } catch (error) {
    console.error(`无法读取对象状态 [${module}:${key}]`, error);
    return defaultValue;
  }
};

/**
 * 清除特定模块的所有状态
 * @param module 模块名称
 */
const clearModuleState = (module: string): void => {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    const modulePrefix = `${APP_PREFIX}:${module}:`;
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(modulePrefix)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error(`无法清除模块状态 [${module}]`, error);
  }
};

/**
 * 清除特定状态
 * @param module 模块名称
 * @param key 状态键名
 */
const clearState = (module: string, key: string): void => {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    localStorage.removeItem(getStorageKey(module, key));
  } catch (error) {
    console.error(`无法清除状态 [${module}:${key}]`, error);
  }
};
