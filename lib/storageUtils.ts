import { db, dbUtils } from './db';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

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
  'brewingNotes': StorageType.INDEXED_DB,
  'coffeeBeans': StorageType.INDEXED_DB, // 咖啡豆数据也使用IndexedDB存储
  
  // 其他小型配置数据使用Preferences
  // 如果有其他大数据量的键，可以添加到这里
};

/**
 * 获取指定键的存储类型
 * @param key 存储键名
 * @returns 存储类型
 */
export const getStorageType = (key: string): StorageType => {
  return STORAGE_TYPE_MAPPING[key] || StorageType.PREFERENCES;
};

/**
 * 存储工具类 - 封装IndexedDB和Preferences的访问
 */
export const StorageUtils = {
  /**
   * 初始化存储系统
   */
  async initialize(): Promise<void> {
    try {
      // 初始化IndexedDB数据库
      await dbUtils.initialize();
      
      // 尝试从localStorage迁移数据到IndexedDB
      if (!Capacitor.isNativePlatform()) {
        const migrationResult = await this.migrateFromLocalStorage();
        if (migrationResult) {
          console.log('数据迁移成功，准备清理localStorage中的大数据...');
          await this.cleanupLocalStorage();
        }
      }
      
      console.log('存储系统初始化完成');
    } catch (error) {
      console.error('存储系统初始化失败:', error);
      throw error;
    }
  },
  
  /**
   * 从localStorage迁移数据到IndexedDB
   * @returns 迁移是否成功
   */
  async migrateFromLocalStorage(): Promise<boolean> {
    try {
      // 检查是否已迁移完成
      const migrated = await db.settings.get('migrated');
      if (migrated && migrated.value === 'true') {
        console.log('数据已迁移完成，无需重复迁移');
        return true;
      }
      
      console.log('开始数据迁移...');
      
      // 从localStorage获取所有需要迁移到IndexedDB的大数据项
      for (const key in STORAGE_TYPE_MAPPING) {
        if (STORAGE_TYPE_MAPPING[key] === StorageType.INDEXED_DB) {
          const value = localStorage.getItem(key);
          if (value) {
            if (key === 'brewingNotes') {
              try {
                console.log(`正在迁移 ${key} 数据...`);
                const notes = JSON.parse(value);
                if (notes.length > 0) {
                  await db.brewingNotes.bulkPut(notes);
                  console.log(`成功迁移 ${notes.length} 条${key}数据`);
                }
              } catch (e) {
                console.error(`解析${key}数据失败:`, e);
              }
            } else if (key === 'coffeeBeans') {
              try {
                console.log(`正在迁移 ${key} 数据...`);
                const beans = JSON.parse(value);
                if (beans.length > 0) {
                  await db.coffeeBeans.bulkPut(beans);
                  console.log(`成功迁移 ${beans.length} 条${key}数据`);
                }
              } catch (e) {
                console.error(`解析${key}数据失败:`, e);
              }
            } else {
              // 处理其他类型的大数据
              await db.settings.put({ key, value });
              console.log(`成功迁移${key}数据`);
            }
          }
        }
      }
      
      // 标记为已完成迁移
      await db.settings.put({ key: 'migrated', value: 'true' });
      await db.settings.put({ key: 'migratedAt', value: new Date().toISOString() });
      console.log('数据迁移完成，已标记为已迁移');
      
      return true;
    } catch (error) {
      console.error('数据迁移失败:', error);
      return false;
    }
  },
  
  /**
   * 清理localStorage中的大数据项
   */
  async cleanupLocalStorage(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      return; // 原生平台不需要清理
    }
    
    try {
      // 遍历所有大数据键，从localStorage中移除
      for (const key in STORAGE_TYPE_MAPPING) {
        if (STORAGE_TYPE_MAPPING[key] === StorageType.INDEXED_DB) {
          // 检查数据是否已成功迁移到IndexedDB
          if (key === 'brewingNotes') {
            const count = await db.brewingNotes.count();
            if (count > 0) {
              localStorage.removeItem(key);
              console.log(`已从localStorage中清除${key}数据`);
            } else {
              console.log(`IndexedDB中${key}数据为空，不清除localStorage`);
            }
          } else if (key === 'coffeeBeans') {
            const count = await db.coffeeBeans.count();
            if (count > 0) {
              localStorage.removeItem(key);
              console.log(`已从localStorage中清除${key}数据`);
            } else {
              console.log(`IndexedDB中${key}数据为空，不清除localStorage`);
            }
          } else {
            const item = await db.settings.get(key);
            if (item) {
              localStorage.removeItem(key);
              console.log(`已从localStorage中清除${key}数据`);
            }
          }
        }
      }
    } catch (error) {
      console.error('清理localStorage失败:', error);
    }
  },
  
  /**
   * 根据存储类型保存数据
   * @param key 键名
   * @param value 值
   * @param type 存储类型，如果未指定则自动判断
   */
  async saveData(key: string, value: string, type?: StorageType): Promise<void> {
    const storageType = type || getStorageType(key);
    
    if (storageType === StorageType.INDEXED_DB) {
      // 对于大型数据，使用IndexedDB
      if (key === 'brewingNotes') {
        try {
          const notes = JSON.parse(value);
          // 清除现有数据并保存新数据
          await db.brewingNotes.clear();
          await db.brewingNotes.bulkPut(notes);
          
          // 触发自定义事件通知数据变更
          const storageEvent = new CustomEvent('storage:changed', {
            detail: { key, source: 'internal' }
          });
          window.dispatchEvent(storageEvent);
          
          // 同时触发 customStorageChange 事件，以确保所有组件都能收到通知
          const customEvent = new CustomEvent('customStorageChange', {
            detail: { key }
          });
          window.dispatchEvent(customEvent);
        } catch (error) {
          console.error('保存到IndexedDB失败:', error);
          throw error;
        }
      } else if (key === 'coffeeBeans') {
        try {
          const beans = JSON.parse(value);
          // 清除现有数据并保存新数据
          await db.coffeeBeans.clear();
          await db.coffeeBeans.bulkPut(beans);
          
          // 触发自定义事件通知数据变更
          const storageEvent = new CustomEvent('storage:changed', {
            detail: { key, source: 'internal' }
          });
          window.dispatchEvent(storageEvent);
          
          // 同时触发 customStorageChange 事件，以确保所有组件都能收到通知
          const customEvent = new CustomEvent('customStorageChange', {
            detail: { key }
          });
          window.dispatchEvent(customEvent);
        } catch (error) {
          console.error('保存咖啡豆数据到IndexedDB失败:', error);
          throw error;
        }
      } else {
        // 其他使用IndexedDB的键
        await db.settings.put({ key, value });
      }
    } else {
      // 对于小型数据，使用Preferences/localStorage
      if (Capacitor.isNativePlatform()) {
        await Preferences.set({ key, value });
      } else {
        localStorage.setItem(key, value);
        
        // 验证保存是否成功
        const saved = localStorage.getItem(key);
        if (saved !== value) {
          // 重试一次
          localStorage.setItem(key, value);
        }
        
        // 触发自定义事件
        const storageEvent = new CustomEvent('storage:changed', {
          detail: { key, source: 'internal' }
        });
        window.dispatchEvent(storageEvent);
        
        // 同时触发 customStorageChange 事件，以确保所有组件都能收到通知
        const customEvent = new CustomEvent('customStorageChange', {
          detail: { key }
        });
        window.dispatchEvent(customEvent);
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
          const notes = await db.brewingNotes.toArray();
          return notes.length > 0 ? JSON.stringify(notes) : '[]';
        } catch (error) {
          console.error('从IndexedDB获取数据失败:', error);
          return '[]';
        }
      } else if (key === 'coffeeBeans') {
        try {
          const beans = await db.coffeeBeans.toArray();
          return beans.length > 0 ? JSON.stringify(beans) : '[]';
        } catch (error) {
          console.error('从IndexedDB获取咖啡豆数据失败:', error);
          return '[]';
        }
      } else {
        // 其他使用IndexedDB的键
        const data = await db.settings.get(key);
        return data ? data.value : null;
      }
    } else {
      // 对于小型数据，从Preferences/localStorage获取
      if (Capacitor.isNativePlatform()) {
        const { value } = await Preferences.get({ key });
        return value;
      } else {
        return localStorage.getItem(key);
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
        await db.brewingNotes.clear();
      } else if (key === 'coffeeBeans') {
        await db.coffeeBeans.clear();
      } else {
        // 其他使用IndexedDB的键
        await db.settings.delete(key);
      }
    } else {
      // 对于小型数据，从Preferences/localStorage删除
      if (Capacitor.isNativePlatform()) {
        await Preferences.remove({ key });
      } else {
        localStorage.removeItem(key);
      }
    }
  },
  
  /**
   * 清除所有存储数据
   */
  async clearAllData(): Promise<void> {
    // 清除IndexedDB数据
    await dbUtils.clearAllData();
    
    // 清除Preferences/localStorage数据
    if (Capacitor.isNativePlatform()) {
      await Preferences.clear();
    } else {
      localStorage.clear();
    }
  }
}; 