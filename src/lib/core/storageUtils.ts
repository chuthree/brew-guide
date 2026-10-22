import { coordinateStoreActions } from '@/lib/data/storeMutationBoundary';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import {
  brewingNoteImageRepository,
  brewingNotePersistence,
  backendDataMaintenance,
  coffeeBeanImageRepository,
  coffeeBeanPersistence,
  legacySettingsRepository,
} from '@/lib/data/repositories';
import { normalizeCoffeeBeans } from '@/lib/utils/coffeeBeanUtils';

/**
 * 存储分类常量，用于决定不同数据的存储方式
 */
export enum StorageType {
  // 大型数据，使用IndexedDB存储
  INDEXED_DB = 'indexedDB',
  // 小型偏好设置，根据平台使用localStorage或Capacitor Preferences
  PREFERENCES = 'preferences',
}

/**
 * 存储分类配置，指定不同键应该使用的存储类型
 */
const STORAGE_TYPE_MAPPING: Record<string, StorageType> = {
  // 大数据量的键使用IndexedDB
  brewingNotes: StorageType.INDEXED_DB,
  coffeeBeans: StorageType.INDEXED_DB, // 咖啡豆数据也使用IndexedDB存储
  customEquipments: StorageType.INDEXED_DB, // 自定义器具使用IndexedDB存储
  // 对于自定义方案，由于键名是动态的(customMethods_[equipmentId])，
  // 我们将在getStorageType函数中处理这种模式

  // 其他小型配置数据使用Preferences
  // 如果有其他大数据量的键，可以添加到这里
};

/**
 * 获取指定键的存储类型
 * @param key 存储键名
 * @returns 存储类型
 */
export const getStorageType = (key: string): StorageType => {
  // 直接在映射中找到的键
  if (STORAGE_TYPE_MAPPING[key]) {
    return STORAGE_TYPE_MAPPING[key];
  }

  // 处理自定义方案的键模式 (customMethods_[equipmentId])
  if (key.startsWith('customMethods_')) {
    return StorageType.INDEXED_DB;
  }

  // 默认使用Preferences
  return StorageType.PREFERENCES;
};

/**
 * 存储工具类 - 封装IndexedDB和Preferences的访问
 */
export const StorageUtils = coordinateStoreActions(
  {
    /**
     * 初始化存储系统
     */
    async initialize(): Promise<void> {
      try {
        const runtimeInitialization = await import('@/lib/data/runtime').then(
          ({ initializeDataRuntime }) => initializeDataRuntime()
        );
        if (runtimeInitialization.status !== 'ready') {
          throw new Error(
            `Data backend "${runtimeInitialization.backend}" is not implemented: ${runtimeInitialization.reason}`
          );
        }

        if (process.env.NODE_ENV === 'development') {
          console.warn('存储系统初始化完成');
        }
      } catch (error) {
        // Log error in development only
        if (process.env.NODE_ENV === 'development') {
          console.error('存储系统初始化失败:', error);
        }
        throw error;
      }
    },

    /**
     * 根据存储类型保存数据
     * @param key 键名
     * @param value 值
     * @param type 存储类型，如果未指定则自动判断
     */
    async saveData(
      key: string,
      value: string,
      type?: StorageType
    ): Promise<void> {
      const storageType = type || getStorageType(key);

      if (storageType === StorageType.INDEXED_DB) {
        if (key === 'brewingNotes' || key === 'coffeeBeans') {
          throw new Error(
            `${key} 不支持通过 Storage.set 写入，请使用 DataManager 的显式导入流程`
          );
        }

        // 其他使用IndexedDB的键
        await legacySettingsRepository.set(key, value);
      } else {
        // 对于小型数据，使用Preferences/localStorage
        if (Capacitor.isNativePlatform()) {
          await Preferences.set({ key, value });
          // 移动端也需要派发事件，确保数据同步
          if (typeof window !== 'undefined') {
            const storageEvent = new CustomEvent('storage:changed', {
              detail: { key, source: 'internal' },
            });
            window.dispatchEvent(storageEvent);
          }
        } else {
          // 检查是否在客户端环境
          if (typeof window !== 'undefined') {
            localStorage.setItem(key, value);

            // 验证保存是否成功
            const saved = localStorage.getItem(key);
            if (saved !== value) {
              // 重试一次
              localStorage.setItem(key, value);
            }

            // 同步触发事件，确保数据一致性
            const storageEvent = new CustomEvent('storage:changed', {
              detail: { key, source: 'internal' },
            });
            window.dispatchEvent(storageEvent);

            const customEvent = new CustomEvent('customStorageChange', {
              detail: { key },
            });
            window.dispatchEvent(customEvent);
          }
        }
      }
    },

    /**
     * 根据存储类型获取数据
     * @param key 键名
     * @param type 存储类型，如果未指定则自动判断
     * @returns 存储的值，如果不存在则返回null
     */
    async getData(key: string, type?: StorageType): Promise<string | null> {
      const storageType = type || getStorageType(key);

      if (storageType === StorageType.INDEXED_DB) {
        // 对于大型数据，从IndexedDB获取
        if (key === 'brewingNotes') {
          try {
            const notes = await brewingNoteImageRepository.exportAll();
            return JSON.stringify(notes);
          } catch (error) {
            console.error('从IndexedDB获取数据失败:', error);
            throw error;
          }
        } else if (key === 'coffeeBeans') {
          try {
            const beans = normalizeCoffeeBeans(
              await coffeeBeanImageRepository.exportAll(),
              {
                ensureFlavorArray: true,
              }
            );
            return JSON.stringify(beans);
          } catch (error) {
            console.error('从IndexedDB获取咖啡豆数据失败:', error);
            throw error;
          }
        } else {
          // 其他使用IndexedDB的键
          const data = await legacySettingsRepository.get(key);
          return data ?? null;
        }
      } else {
        // 对于小型数据，从Preferences/localStorage获取
        if (Capacitor.isNativePlatform()) {
          const { value } = await Preferences.get({ key });
          return value;
        } else {
          // 检查是否在客户端环境
          if (typeof window !== 'undefined') {
            return localStorage.getItem(key);
          } else {
            return null;
          }
        }
      }
    },

    /**
     * 根据存储类型删除数据
     * @param key 键名
     * @param type 存储类型，如果未指定则自动判断
     */
    async removeData(key: string, type?: StorageType): Promise<void> {
      const storageType = type || getStorageType(key);

      if (storageType === StorageType.INDEXED_DB) {
        // 对于大型数据，从IndexedDB删除
        if (key === 'brewingNotes') {
          await brewingNotePersistence.clearWithImages();
        } else if (key === 'coffeeBeans') {
          await coffeeBeanPersistence.clearWithImages();
        } else {
          // 其他使用IndexedDB的键
          await legacySettingsRepository.delete(key);
        }
      } else {
        // 对于小型数据，从Preferences/localStorage删除
        if (Capacitor.isNativePlatform()) {
          await Preferences.remove({ key });
        } else {
          // 检查是否在客户端环境
          if (typeof window !== 'undefined') {
            localStorage.removeItem(key);
          }
        }
      }
    },

    /**
     * 清除所有存储数据
     */
    async clearAllData(): Promise<void> {
      const { withAndroidProviderReset } =
        await import('@/lib/provider/resetBoundary');
      return withAndroidProviderReset(async () => {
        const { isDesktopMcpAvailable } = await import('@/lib/mcp/client');
        if (isDesktopMcpAvailable()) {
          const { stopDesktopMcpForDataReset } =
            await import('@/lib/mcp/bridge');
          await stopDesktopMcpForDataReset();
        }
        // Clear database data through the selected backend before local settings.
        await backendDataMaintenance.clearAllData();
        if (isDesktopMcpAvailable()) {
          const { clearMcpLocalHistory } = await import('@/lib/mcp/storage');
          await clearMcpLocalHistory();
        }

        // 清除Preferences/localStorage数据
        if (Capacitor.isNativePlatform()) {
          await Preferences.clear();
        } else {
          // 检查是否在客户端环境
          if (typeof window !== 'undefined') {
            localStorage.clear();
          }
        }
      });
    },

    /**
     * 获取存储中的所有键
     */
    async getStorageKeys(): Promise<string[]> {
      try {
        if (Capacitor.isNativePlatform()) {
          // 在原生平台上使用 Capacitor Preferences API
          const { keys } = await Preferences.keys();
          return keys;
        } else {
          // 在 Web 平台上使用 localStorage
          // 检查是否在客户端环境
          if (typeof window !== 'undefined') {
            return Object.keys(localStorage);
          } else {
            return [];
          }
        }
      } catch (e) {
        console.error('获取存储键失败:', e);
        return [];
      }
    },
  },
  ['saveData', 'removeData']
);
