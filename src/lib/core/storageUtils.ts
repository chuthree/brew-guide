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
  'customEquipments': StorageType.INDEXED_DB, // 添加自定义器具到IndexedDB存储
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
export const StorageUtils = {
  /**
   * 初始化存储系统
   */
  async initialize(): Promise<void> {
    try {
      // 初始化IndexedDB数据库
      await dbUtils.initialize();
      
      let migrationResult = false;
      
      // 基于平台选择正确的迁移方法
      if (Capacitor.isNativePlatform()) {
        // 移动端：从Preferences迁移
        console.log('检测到移动端环境，准备从Preferences迁移数据...');
        migrationResult = await this.migrateFromPreferences();
        if (migrationResult) {
          console.log('移动端数据迁移成功，数据已保存到IndexedDB');
          // 注意：暂时不清理Preferences中的数据，以防万一
        }
      } else {
        // 网页端：从localStorage迁移
        console.log('检测到网页端环境，准备从localStorage迁移数据...');
        migrationResult = await this.migrateFromLocalStorage();
        if (migrationResult) {
          console.log('数据迁移成功，准备清理localStorage中的大数据...');
          await this.cleanupLocalStorage();
        }
      }
      
      // 迁移自定义器具数据
      await this.migrateCustomEquipments();
      
      // 迁移自定义方案数据
      await this.migrateCustomMethods();
      
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
        // 验证数据是否实际存在
        const beansCount = await db.coffeeBeans.count();
        const notesCount = await db.brewingNotes.count();
        
        // 如果数据库为空但localStorage有数据，重置迁移标志强制重新迁移
        // 检查是否在客户端环境
        const hasLocalStorageData = typeof window !== 'undefined' &&
          (localStorage.getItem('coffeeBeans') || localStorage.getItem('brewingNotes'));

        if ((beansCount === 0 || notesCount === 0) && hasLocalStorageData) {
          console.log('虽然标记为已迁移，但数据似乎丢失，重新执行迁移...');
          // 重置迁移标志
          await db.settings.delete('migrated');
        } else {
          console.log('数据已迁移完成，无需重复迁移');
          return true;
        }
      }
      
      console.log('开始数据迁移...');
      let migrationSuccessful = true;
      
      // 从localStorage获取所有需要迁移到IndexedDB的大数据项
      // 检查是否在客户端环境
      if (typeof window === 'undefined') {
        console.log('不在客户端环境，跳过localStorage迁移');
        return false;
      }

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
                  // 验证迁移是否成功
                  const migratedCount = await db.brewingNotes.count();
                  if (migratedCount === notes.length) {
                    console.log(`成功迁移 ${notes.length} 条${key}数据`);
                  } else {
                    console.error(`迁移失败：应有 ${notes.length} 条数据，但只迁移了 ${migratedCount} 条`);
                    migrationSuccessful = false;
                  }
                }
              } catch (e) {
                console.error(`解析${key}数据失败:`, e);
                migrationSuccessful = false;
              }
            } else if (key === 'coffeeBeans') {
              try {
                console.log(`正在迁移 ${key} 数据...`);
                const beans = JSON.parse(value);
                if (beans.length > 0) {
                  await db.coffeeBeans.bulkPut(beans);
                  // 验证迁移是否成功
                  const migratedCount = await db.coffeeBeans.count();
                  if (migratedCount === beans.length) {
                    console.log(`成功迁移 ${beans.length} 条${key}数据`);
                  } else {
                    console.error(`迁移失败：应有 ${beans.length} 条数据，但只迁移了 ${migratedCount} 条`);
                    migrationSuccessful = false;
                  }
                }
              } catch (e) {
                console.error(`解析${key}数据失败:`, e);
                migrationSuccessful = false;
              }
            } else {
              // 处理其他类型的大数据
              await db.settings.put({ key, value });
              console.log(`成功迁移${key}数据`);
            }
          }
        }
      }
      
      // 只有在所有数据成功迁移后才标记为已完成
      if (migrationSuccessful) {
        await db.settings.put({ key: 'migrated', value: 'true' });
        await db.settings.put({ key: 'migratedAt', value: new Date().toISOString() });
        console.log('数据迁移完成，已标记为已迁移');
        return true;
      } else {
        console.error('数据迁移过程中发生错误，未标记为已迁移');
        return false;
      }
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
            // 只有在IndexedDB中确实有数据，且localStorage中也有此数据时才清除
            // 检查是否在客户端环境
            const localData = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
            if (count > 0 && localData && typeof window !== 'undefined') {
              localStorage.removeItem(key);
              console.log(`已从localStorage中清除${key}数据`);
            } else {
              console.log(`IndexedDB中${key}数据为空或localStorage无此数据，不清除localStorage`);
            }
          } else if (key === 'coffeeBeans') {
            const count = await db.coffeeBeans.count();
            // 只有在IndexedDB中确实有数据，且localStorage中也有此数据时才清除
            // 检查是否在客户端环境
            const localData = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
            if (count > 0 && localData && typeof window !== 'undefined') {
              localStorage.removeItem(key);
              console.log(`已从localStorage中清除${key}数据`);
            } else {
              console.log(`IndexedDB中${key}数据为空或localStorage无此数据，不清除localStorage`);
            }
          } else {
            const item = await db.settings.get(key);
            // 检查是否在客户端环境
            const hasLocalData = typeof window !== 'undefined' && localStorage.getItem(key);
            if (item && hasLocalData) {
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
   * 从Capacitor Preferences迁移数据到IndexedDB
   * @returns 迁移是否成功
   */
  async migrateFromPreferences(): Promise<boolean> {
    try {
      // 检查是否已迁移完成
      const migrated = await db.settings.get('migrated');
      if (migrated && migrated.value === 'true') {
        // 验证数据是否实际存在
        const beansCount = await db.coffeeBeans.count();
        const notesCount = await db.brewingNotes.count();
        
        // 获取Preferences中的数据以检查是否有数据需要迁移
        const hasPreferencesBeans = await this.hasPreferencesData('coffeeBeans');
        const hasPreferencesNotes = await this.hasPreferencesData('brewingNotes');
        
        // 如果数据库为空但Preferences有数据，重置迁移标志强制重新迁移
        if ((beansCount === 0 && hasPreferencesBeans) || (notesCount === 0 && hasPreferencesNotes)) {
          console.log('虽然标记为已迁移，但数据似乎丢失，重新执行迁移...');
          // 重置迁移标志
          await db.settings.delete('migrated');
        } else {
          console.log('数据已迁移完成，无需重复迁移');
          return true;
        }
      }
      
      console.log('开始从Preferences迁移数据到IndexedDB...');
      let migrationSuccessful = true;
      
      // 从Preferences获取所有需要迁移到IndexedDB的大数据项
      for (const key in STORAGE_TYPE_MAPPING) {
        if (STORAGE_TYPE_MAPPING[key] === StorageType.INDEXED_DB) {
          console.log(`检查Preferences是否有${key}数据...`);
          const { value } = await Preferences.get({ key });
          
          if (value) {
            console.log(`从Preferences中找到${key}数据，准备迁移...`);
            if (key === 'brewingNotes') {
              try {
                console.log(`正在迁移 ${key} 数据...`);
                const notes = JSON.parse(value);
                if (notes.length > 0) {
                  await db.brewingNotes.bulkPut(notes);
                  // 验证迁移是否成功
                  const migratedCount = await db.brewingNotes.count();
                  if (migratedCount === notes.length) {
                    console.log(`成功迁移 ${notes.length} 条${key}数据`);
                  } else {
                    console.error(`迁移失败：应有 ${notes.length} 条数据，但只迁移了 ${migratedCount} 条`);
                    migrationSuccessful = false;
                  }
                } else {
                  console.log(`${key}数据为空数组，无需迁移`);
                }
              } catch (e) {
                console.error(`解析${key}数据失败:`, e);
                migrationSuccessful = false;
              }
            } else if (key === 'coffeeBeans') {
              try {
                console.log(`正在迁移 ${key} 数据...`);
                const beans = JSON.parse(value);
                if (beans.length > 0) {
                  await db.coffeeBeans.bulkPut(beans);
                  // 验证迁移是否成功
                  const migratedCount = await db.coffeeBeans.count();
                  if (migratedCount === beans.length) {
                    console.log(`成功迁移 ${beans.length} 条${key}数据`);
                  } else {
                    console.error(`迁移失败：应有 ${beans.length} 条数据，但只迁移了 ${migratedCount} 条`);
                    migrationSuccessful = false;
                  }
                } else {
                  console.log(`${key}数据为空数组，无需迁移`);
                }
              } catch (e) {
                console.error(`解析${key}数据失败:`, e);
                migrationSuccessful = false;
              }
            } else {
              // 处理其他类型的大数据
              await db.settings.put({ key, value });
              console.log(`成功迁移${key}数据`);
            }
          } else {
            console.log(`Preferences中没有找到${key}数据`);
          }
        }
      }
      
      // 只有在所有数据成功迁移后才标记为已完成
      if (migrationSuccessful) {
        await db.settings.put({ key: 'migrated', value: 'true' });
        await db.settings.put({ key: 'migratedAt', value: new Date().toISOString() });
        console.log('数据迁移完成，已标记为已迁移');
        return true;
      } else {
        console.error('数据迁移过程中发生错误，未标记为已迁移');
        return false;
      }
    } catch (error) {
      console.error('数据迁移失败:', error);
      return false;
    }
  },
  
  /**
   * 检查Preferences中是否存在指定键的数据
   * @param key 键名
   * @returns 是否存在数据
   */
  async hasPreferencesData(key: string): Promise<boolean> {
    try {
      const { value } = await Preferences.get({ key });
      if (!value) return false;
      
      try {
        const data = JSON.parse(value);
        return Array.isArray(data) && data.length > 0;
      } catch {
        return false;
      }
    } catch {
      return false;
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
        // 检查是否在客户端环境
        if (typeof window !== 'undefined') {
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
    // 清除IndexedDB数据
    await dbUtils.clearAllData();
    
    // 清除Preferences/localStorage数据
    if (Capacitor.isNativePlatform()) {
      await Preferences.clear();
    } else {
      // 检查是否在客户端环境
      if (typeof window !== 'undefined') {
        localStorage.clear();
      }
    }
  },
  
  /**
   * 迁移自定义器具数据到IndexedDB
   */
  async migrateCustomEquipments(): Promise<boolean> {
    try {
      // 检查IndexedDB中是否已有数据
      const equipmentCount = await db.customEquipments.count();
      if (equipmentCount > 0) {
        console.log(`[migrateCustomEquipments] IndexedDB中已有${equipmentCount}个自定义器具，无需迁移`);
        return true;
      }
      
      // 从localStorage/Preferences读取数据
      const equipmentsJson = await this.getData('customEquipments', StorageType.PREFERENCES);
      if (!equipmentsJson) {
        console.log(`[migrateCustomEquipments] 未找到自定义器具数据，不需要迁移`);
        return false;
      }
      
      // 解析数据
      const equipments = JSON.parse(equipmentsJson);
      if (!Array.isArray(equipments) || equipments.length === 0) {
        console.log(`[migrateCustomEquipments] 自定义器具数据为空或格式错误，不需要迁移`);
        return false;
      }
      
      console.log(`[migrateCustomEquipments] 找到${equipments.length}个自定义器具，准备迁移到IndexedDB`);
      
      // 保存到IndexedDB
      await db.customEquipments.bulkPut(equipments);
      
      // 验证迁移
      const migratedCount = await db.customEquipments.count();
      if (migratedCount === equipments.length) {
        console.log(`[migrateCustomEquipments] 成功迁移${migratedCount}个自定义器具到IndexedDB`);
        return true;
      } else {
        console.warn(`[migrateCustomEquipments] 迁移不完全：应有${equipments.length}个，实际只有${migratedCount}个`);
        return false;
      }
    } catch (error) {
      console.error(`[migrateCustomEquipments] 迁移自定义器具失败:`, error);
      return false;
    }
  },
  
  /**
   * 迁移自定义方案数据到IndexedDB
   */
  async migrateCustomMethods(): Promise<boolean> {
    try {
      // 检查IndexedDB中是否已有数据
      const methodCount = await db.customMethods.count();
      if (methodCount > 0) {
        console.log(`[migrateCustomMethods] IndexedDB中已有${methodCount}组自定义方案，无需迁移`);
        return true;
      }
      
      // 获取所有键
      const keys = await this.getStorageKeys();
      
      // 筛选方案相关的键
      const methodKeys = keys.filter(key => key.startsWith('customMethods_'));
      if (methodKeys.length === 0) {
        console.log(`[migrateCustomMethods] 未找到任何自定义方案数据，不需要迁移`);
        return false;
      }
      
      console.log(`[migrateCustomMethods] 找到${methodKeys.length}个自定义方案键，准备迁移到IndexedDB`);
      
      // 逐个迁移方案数据
      let successCount = 0;
      for (const key of methodKeys) {
        try {
          // 从键名中提取设备ID
          const equipmentId = key.replace('customMethods_', '');
          
          // 读取数据
          const methodsJson = await this.getData(key, StorageType.PREFERENCES);
          if (!methodsJson) continue;
          
          // 解析数据
          const methods = JSON.parse(methodsJson);
          if (!Array.isArray(methods) || methods.length === 0) continue;
          
          // 保存到IndexedDB
          await db.customMethods.put({
            equipmentId,
            methods
          });
          
          console.log(`[migrateCustomMethods] 成功迁移设备${equipmentId}的${methods.length}个方案到IndexedDB`);
          successCount++;
        } catch (e) {
          console.error(`[migrateCustomMethods] 迁移方案${key}失败:`, e);
        }
      }
      
      if (successCount > 0) {
        console.log(`[migrateCustomMethods] 总共成功迁移了${successCount}组方案数据`);
        return true;
      } else {
        console.warn(`[migrateCustomMethods] 未能成功迁移任何方案数据`);
        return false;
      }
    } catch (error) {
      console.error(`[migrateCustomMethods] 迁移自定义方案失败:`, error);
      return false;
    }
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
}; 