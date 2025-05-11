import Dexie from 'dexie';
import { BrewingNote, Method, CustomEquipment } from './config';
import { CoffeeBean } from '@/types/app';

/**
 * 应用数据库类 - 使用Dexie.js包装IndexedDB
 */
export class BrewGuideDB extends Dexie {
  // 定义表
  brewingNotes!: Dexie.Table<BrewingNote, string>; // 冲煮笔记表，主键为id (string)
  coffeeBeans!: Dexie.Table<CoffeeBean, string>; // 咖啡豆表，主键为id (string)
  settings!: Dexie.Table<{ key: string; value: string }, string>; // 设置表，用于存储配置信息
  customEquipments!: Dexie.Table<CustomEquipment, string>; // 自定义器具表，主键为id (string)
  customMethods!: Dexie.Table<{ equipmentId: string; methods: Method[] }, string>; // 自定义方案表，按器具ID组织

  constructor() {
    super('BrewGuideDB');
    
    // 定义数据库结构
    // 版本1：基础结构
    this.version(1).stores({
      brewingNotes: 'id, timestamp, equipment, method', // 索引常用的查询字段
      settings: 'key' // 基于key的索引
    });
    
    // 版本2：添加coffeeBeans表
    this.version(2).stores({
      brewingNotes: 'id, timestamp, equipment, method', // 保持不变
      coffeeBeans: 'id, timestamp, name, type', // 新增咖啡豆表
      settings: 'key' // 保持不变
    });
    
    // 版本3：添加自定义器具和方案表
    this.version(3).stores({
      brewingNotes: 'id, timestamp, equipment, method', // 保持不变
      coffeeBeans: 'id, timestamp, name, type', // 保持不变
      settings: 'key', // 保持不变
      customEquipments: 'id, name', // 自定义器具表
      customMethods: 'equipmentId' // 自定义方案表，按器具ID组织
    });
  }
}

// 创建并导出数据库单例
export const db = new BrewGuideDB();

/**
 * 数据库相关工具方法
 */
export const dbUtils = {
  /**
   * 初始化数据库并准备使用
   * @returns 初始化承诺
   */
  async initialize(): Promise<void> {
    try {
      await db.open();
      console.log('数据库初始化成功');
      
      // 验证迁移状态与数据一致性
      const migrated = await db.settings.get('migrated');
      if (migrated && migrated.value === 'true') {
        // 检查数据是否实际存在
        const beansCount = await db.coffeeBeans.count();
        const notesCount = await db.brewingNotes.count();
        
        // 如果localStorage有数据但IndexedDB为空，可能是迁移失败了
        const hasLocalBeans = localStorage.getItem('coffeeBeans') !== null;
        const hasLocalNotes = localStorage.getItem('brewingNotes') !== null;
        
        if ((beansCount === 0 && hasLocalBeans) || (notesCount === 0 && hasLocalNotes)) {
          console.warn('检测到数据不一致：IndexedDB为空但localStorage有数据，将重置迁移状态');
          await db.settings.delete('migrated');
        }
      }
      
      // 输出存储信息，用于调试
      setTimeout(() => this.logStorageInfo(), 1000);
    } catch (error) {
      console.error('数据库初始化失败:', error);
      throw error;
    }
  },

  /**
   * 从localStorage迁移数据到IndexedDB
   * @returns 迁移是否成功
   */
  async migrateFromLocalStorage(): Promise<boolean> {
    try {
      // 检查是否已迁移
      const migrated = await db.settings.get('migrated');
      if (migrated && migrated.value === 'true') {
        // 验证数据是否实际存在
        const beansCount = await db.coffeeBeans.count();
        const notesCount = await db.brewingNotes.count();
        
        // 如果数据库为空但localStorage有数据，重置迁移标志强制重新迁移
        if ((beansCount === 0 || notesCount === 0) && 
            (localStorage.getItem('coffeeBeans') || localStorage.getItem('brewingNotes'))) {
          console.log('虽然标记为已迁移，但数据似乎丢失，重新执行迁移...');
          // 重置迁移标志
          await db.settings.delete('migrated');
        } else {
          return true; // 已经迁移完成
        }
      }

      let migrationSuccessful = true;

      // 迁移冲煮笔记
      const brewingNotesJson = localStorage.getItem('brewingNotes');
      if (brewingNotesJson) {
        try {
          const brewingNotes: BrewingNote[] = JSON.parse(brewingNotesJson);
          if (brewingNotes.length > 0) {
            // 使用批量添加以提高性能
            await db.brewingNotes.bulkPut(brewingNotes);
            // 验证迁移是否成功
            const migratedCount = await db.brewingNotes.count();
            if (migratedCount === brewingNotes.length) {
              console.log(`已迁移 ${brewingNotes.length} 条冲煮笔记`);
            } else {
              console.error(`迁移失败：应有 ${brewingNotes.length} 条笔记，但只迁移了 ${migratedCount} 条`);
              migrationSuccessful = false;
            }
          }
        } catch (e) {
          console.error('解析冲煮笔记数据失败:', e);
          migrationSuccessful = false;
        }
      }

      // 迁移咖啡豆数据
      const coffeeBeansJson = localStorage.getItem('coffeeBeans');
      if (coffeeBeansJson) {
        try {
          const coffeeBeans: CoffeeBean[] = JSON.parse(coffeeBeansJson);
          if (coffeeBeans.length > 0) {
            // 使用批量添加以提高性能
            await db.coffeeBeans.bulkPut(coffeeBeans);
            // 验证迁移是否成功
            const migratedCount = await db.coffeeBeans.count();
            if (migratedCount === coffeeBeans.length) {
              console.log(`已迁移 ${coffeeBeans.length} 条咖啡豆数据`);
            } else {
              console.error(`迁移失败：应有 ${coffeeBeans.length} 条咖啡豆数据，但只迁移了 ${migratedCount} 条`);
              migrationSuccessful = false;
            }
          }
        } catch (e) {
          console.error('解析咖啡豆数据失败:', e);
          migrationSuccessful = false;
        }
      }

      // 只有在所有数据成功迁移后才标记为已完成
      if (migrationSuccessful) {
        // or db.settings.put({ key: 'migrated', value: 'true' });
        await db.settings.put({ key: 'migrated', value: 'true' });
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
   * 清除数据库所有数据
   */
  async clearAllData(): Promise<void> {
    try {
      await db.brewingNotes.clear();
      await db.coffeeBeans.clear();
      await db.settings.clear();
      console.log('数据库已清空');
    } catch (error) {
      console.error('清空数据库失败:', error);
      throw error;
    }
  },

  /**
   * 记录当前存储信息，用于调试
   */
  async logStorageInfo(): Promise<void> {
    try {
      // 获取笔记数量和大小
      const noteCount = await db.brewingNotes.count();
      const notes = await db.brewingNotes.toArray();
      const notesJson = JSON.stringify(notes);
      const notesSizeInBytes = notesJson.length * 2; // 每个字符约占2字节
      const notesSizeInKB = Math.round(notesSizeInBytes / 1024);
      const notesSizeInMB = (notesSizeInKB / 1024).toFixed(2);
      
      // 获取咖啡豆数量和大小
      const beanCount = await db.coffeeBeans.count();
      const beans = await db.coffeeBeans.toArray();
      const beansJson = JSON.stringify(beans);
      const beansSizeInBytes = beansJson.length * 2; // 每个字符约占2字节
      const beansSizeInKB = Math.round(beansSizeInBytes / 1024);
      const beansSizeInMB = (beansSizeInKB / 1024).toFixed(2);
      
      console.log(`IndexedDB 存储信息:`);
      console.log(`- 笔记数量: ${noteCount}, 大小: ${notesSizeInBytes} 字节 (${notesSizeInKB} KB, ${notesSizeInMB} MB)`);
      console.log(`- 咖啡豆数量: ${beanCount}, 大小: ${beansSizeInBytes} 字节 (${beansSizeInKB} KB, ${beansSizeInMB} MB)`);
      console.log(`- 总大小: ${notesSizeInBytes + beansSizeInBytes} 字节 (${notesSizeInKB + beansSizeInKB} KB, ${(notesSizeInKB + beansSizeInKB) / 1024} MB)`);
      
      // localStorage大小估计
      try {
        let totalSize = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            const value = localStorage.getItem(key);
            totalSize += (key.length + (value?.length || 0)) * 2; // 每个字符约占2字节
          }
        }
        const lsSizeInKB = Math.round(totalSize / 1024);
        const lsSizeInMB = (lsSizeInKB / 1024).toFixed(2);
        
        console.log(`localStorage 存储信息:`);
        console.log(`- 估计大小: ${totalSize} 字节 (${lsSizeInKB} KB, ${lsSizeInMB} MB)`);
      } catch (e) {
        console.error('计算localStorage大小失败:', e);
      }
    } catch (error) {
      console.error('记录存储信息失败:', error);
    }
  }
}; 