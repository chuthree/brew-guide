import Dexie from 'dexie';
import { BrewingNote, Method, CustomEquipment } from './config';
import { CoffeeBean } from '@/types/app';
import type {
  AppSettings,
  Grinder,
  RoasterFlavorPeriod,
} from '@/lib/data/models';
import type { PendingOperation } from '@/lib/supabase/realtime/types';
import {
  type CoffeeBeanImageRecord,
  type CoffeeBeanImageThumbnailRecord,
  splitCoffeeBeanImages,
} from '@/lib/coffee-beans/imageRecords';
import {
  type BrewingNoteImageRecord,
  type BrewingNoteImageThumbnailRecord,
  splitBrewingNoteImages,
} from '@/lib/notes/imageRecords';

const MAX_COFFEE_BEAN_THUMBNAIL_DATA_URL_CHARS = 512 * 1024;

const getUsableCoffeeBeanThumbnail = (
  thumbnail: string | undefined
): string | undefined =>
  thumbnail && thumbnail.length <= MAX_COFFEE_BEAN_THUMBNAIL_DATA_URL_CHARS
    ? thumbnail
    : undefined;

/**
 * 应用数据库类 - 使用Dexie.js包装IndexedDB
 *
 * 版本历史：
 * - v1: 基础结构 (brewingNotes, settings)
 * - v2: 添加 coffeeBeans 表
 * - v3: 添加 customEquipments, customMethods 表
 * - v4: 重构 - 添加 grinders, yearlyReports, appSettings 表，统一数据管理
 * - v7: 咖啡豆缩略图拆分到独立表，避免读取缩略图时反序列化原图
 * - v8: 为冲煮记录增加 beanId 索引，详情页按咖啡豆懒查询关联记录
 * - v9: 移除年度报告表
 * - v10: 冲煮记录图片拆到独立表，避免列表加载反序列化原图
 * - v11: 冲煮记录缩略图拆到独立表，避免图片流判断读取原图
 */
export class BrewGuideDB extends Dexie {
  // 核心数据表
  brewingNotes!: Dexie.Table<BrewingNote, string>;
  coffeeBeans!: Dexie.Table<CoffeeBean, string>;
  coffeeBeanImages!: Dexie.Table<CoffeeBeanImageRecord, string>;
  coffeeBeanImageThumbnails!: Dexie.Table<
    CoffeeBeanImageThumbnailRecord,
    string
  >;
  brewingNoteImages!: Dexie.Table<BrewingNoteImageRecord, string>;
  brewingNoteImageThumbnails!: Dexie.Table<
    BrewingNoteImageThumbnailRecord,
    string
  >;

  // 器具与方案表
  customEquipments!: Dexie.Table<CustomEquipment, string>;
  customMethods!: Dexie.Table<
    { equipmentId: string; methods: Method[] },
    string
  >;

  // 磨豆机表
  grinders!: Dexie.Table<Grinder, string>;

  // 应用设置表
  appSettings!: Dexie.Table<{ id: string; data: AppSettings }, string>;

  // 旧版设置表（兼容性保留）
  settings!: Dexie.Table<{ key: string; value: string }, string>;

  // 实时同步离线队列表
  pendingOperations!: Dexie.Table<PendingOperation, string>;

  constructor() {
    super('BrewGuideDB');

    // 版本1：基础结构
    this.version(1).stores({
      brewingNotes: 'id, timestamp, equipment, method',
      settings: 'key',
    });

    // 版本2：添加coffeeBeans表
    this.version(2).stores({
      brewingNotes: 'id, timestamp, equipment, method',
      coffeeBeans: 'id, timestamp, name, type',
      settings: 'key',
    });

    // 版本3：添加自定义器具和方案表
    this.version(3).stores({
      brewingNotes: 'id, timestamp, equipment, method',
      coffeeBeans: 'id, timestamp, name, type',
      settings: 'key',
      customEquipments: 'id, name',
      customMethods: 'equipmentId',
    });

    // 版本4：添加新表，统一数据管理
    this.version(4)
      .stores({
        brewingNotes: 'id, timestamp, equipment, method',
        coffeeBeans: 'id, timestamp, name, type',
        settings: 'key',
        customEquipments: 'id, name',
        customMethods: 'equipmentId',
        grinders: 'id, name',
        yearlyReports: 'id, year, createdAt',
        appSettings: 'id',
      })
      .upgrade(async () => {
        console.log('开始数据库 v4 升级迁移...');
        // 迁移将在数据库打开后通过 dbUtils.migrateToV4 完成
      });

    // 版本5：添加实时同步离线队列表
    this.version(5).stores({
      brewingNotes: 'id, timestamp, equipment, method',
      coffeeBeans: 'id, timestamp, name, type',
      settings: 'key',
      customEquipments: 'id, name',
      customMethods: 'equipmentId',
      grinders: 'id, name',
      yearlyReports: 'id, year, createdAt',
      appSettings: 'id',
      pendingOperations: 'id, table, recordId, timestamp',
    });

    // 版本6：咖啡豆图片从主记录拆分，降低日常加载内存
    this.version(6).stores({
      brewingNotes: 'id, timestamp, equipment, method',
      coffeeBeans: 'id, timestamp, name, type',
      coffeeBeanImages: 'beanId, updatedAt',
      settings: 'key',
      customEquipments: 'id, name',
      customMethods: 'equipmentId',
      grinders: 'id, name',
      yearlyReports: 'id, year, createdAt',
      appSettings: 'id',
      pendingOperations: 'id, table, recordId, timestamp',
    });

    // 版本7：缩略图独立存储，读取列表缩略图时不再加载原图 payload
    this.version(7).stores({
      brewingNotes: 'id, timestamp, equipment, method',
      coffeeBeans: 'id, timestamp, name, type',
      coffeeBeanImages: 'beanId, updatedAt',
      coffeeBeanImageThumbnails: 'beanId, updatedAt',
      settings: 'key',
      customEquipments: 'id, name',
      customMethods: 'equipmentId',
      grinders: 'id, name',
      yearlyReports: 'id, year, createdAt',
      appSettings: 'id',
      pendingOperations: 'id, table, recordId, timestamp',
    });

    // 版本8：详情页按 beanId 查询关联记录，避免为单个详情页加载全量笔记
    this.version(8).stores({
      brewingNotes:
        'id, timestamp, equipment, method, beanId, [beanId+timestamp]',
      coffeeBeans: 'id, timestamp, name, type',
      coffeeBeanImages: 'beanId, updatedAt',
      coffeeBeanImageThumbnails: 'beanId, updatedAt',
      settings: 'key',
      customEquipments: 'id, name',
      customMethods: 'equipmentId',
      grinders: 'id, name',
      yearlyReports: 'id, year, createdAt',
      appSettings: 'id',
      pendingOperations: 'id, table, recordId, timestamp',
    });

    // 版本9：移除年度报告表
    this.version(9).stores({
      brewingNotes:
        'id, timestamp, equipment, method, beanId, [beanId+timestamp]',
      coffeeBeans: 'id, timestamp, name, type',
      coffeeBeanImages: 'beanId, updatedAt',
      coffeeBeanImageThumbnails: 'beanId, updatedAt',
      settings: 'key',
      customEquipments: 'id, name',
      customMethods: 'equipmentId',
      grinders: 'id, name',
      yearlyReports: null,
      appSettings: 'id',
      pendingOperations: 'id, table, recordId, timestamp',
    });

    // 版本10：冲煮记录图片从主记录拆分，降低日常加载内存
    this.version(10).stores({
      brewingNotes:
        'id, timestamp, equipment, method, beanId, [beanId+timestamp]',
      brewingNoteImages: 'noteId, updatedAt',
      coffeeBeans: 'id, timestamp, name, type',
      coffeeBeanImages: 'beanId, updatedAt',
      coffeeBeanImageThumbnails: 'beanId, updatedAt',
      settings: 'key',
      customEquipments: 'id, name',
      customMethods: 'equipmentId',
      grinders: 'id, name',
      yearlyReports: null,
      appSettings: 'id',
      pendingOperations: 'id, table, recordId, timestamp',
    });

    // 版本11：冲煮记录缩略图独立存储，列表/图片流只读取缩略图
    this.version(11).stores({
      brewingNotes:
        'id, timestamp, equipment, method, beanId, [beanId+timestamp]',
      brewingNoteImages: 'noteId, updatedAt',
      brewingNoteImageThumbnails: 'noteId, updatedAt',
      coffeeBeans: 'id, timestamp, name, type',
      coffeeBeanImages: 'beanId, updatedAt',
      coffeeBeanImageThumbnails: 'beanId, updatedAt',
      settings: 'key',
      customEquipments: 'id, name',
      customMethods: 'equipmentId',
      grinders: 'id, name',
      yearlyReports: null,
      appSettings: 'id',
      pendingOperations: 'id, table, recordId, timestamp',
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
   */
  async initialize(): Promise<void> {
    try {
      await db.open();
      console.warn('数据库初始化成功');

      // v4 迁移：从 localStorage 迁移数据到新表
      await this.migrateToV4();

      // v6 迁移：将咖啡豆图片拆到独立表，避免主 Store 整表加载图片
      await this.migrateCoffeeBeanImages();

      // v10 迁移：将冲煮记录图片拆到独立表，避免笔记列表整表加载图片
      await this.migrateBrewingNoteImages();

      if (process.env.NODE_ENV === 'development') {
        setTimeout(() => this.logStorageInfo(), 1000);
      }
    } catch (error) {
      console.error('数据库初始化失败:', error);
      throw error;
    }
  },

  /**
   * v4 迁移：从 localStorage 迁移数据到新的 IndexedDB 表
   */
  async migrateToV4(): Promise<void> {
    try {
      // 检查是否已完成 v4 迁移
      const v4Migrated = await db.settings.get('v4_migrated');
      if (v4Migrated && v4Migrated.value === 'true') {
        // 即使已标记迁移完成，也要检查补充迁移（修复数据丢失问题）
        await this.migrateAppSettings();
        return;
      }

      console.warn('开始 v4 数据迁移...');

      // 1. 迁移磨豆机数据
      await this.migrateGrinders();

      // 2. 迁移应用设置
      await this.migrateAppSettings();

      // 标记 v4 迁移完成
      await db.settings.put({ key: 'v4_migrated', value: 'true' });
      console.log('v4 数据迁移完成');
    } catch (error) {
      console.error('v4 数据迁移失败:', error);
    }
  },

  /**
   * 迁移磨豆机数据
   */
  async migrateGrinders(): Promise<void> {
    try {
      if (typeof localStorage === 'undefined') return;

      // 检查是否已有数据
      const existingCount = await db.grinders.count();
      if (existingCount > 0) {
        console.log('磨豆机数据已存在，跳过迁移');
        return;
      }

      const settingsStr = localStorage.getItem('brewGuideSettings');
      if (!settingsStr) return;

      let settings = JSON.parse(settingsStr);

      // 处理 Zustand persist 格式
      if (settings?.state?.settings) {
        settings = settings.state.settings;
      }

      if (settings.grinders && Array.isArray(settings.grinders)) {
        await db.grinders.bulkPut(settings.grinders);
        console.log(`已迁移 ${settings.grinders.length} 个磨豆机到 IndexedDB`);
      }
    } catch (error) {
      console.error('迁移磨豆机数据失败:', error);
    }
  },

  /**
   * 迁移应用设置
   */
  async migrateAppSettings(): Promise<void> {
    try {
      if (typeof localStorage === 'undefined') return;

      // 检查是否已有数据
      const existing = await db.appSettings.get('main');

      // 即使已有设置，也要检查是否需要补充迁移遗漏的数据
      if (existing) {
        let needsUpdate = false;

        // 补充迁移 roaster-logos
        const roasterLogosStr = localStorage.getItem('roaster-logos');
        if (
          roasterLogosStr &&
          (!existing.data.roasterConfigs ||
            existing.data.roasterConfigs.length === 0)
        ) {
          try {
            const oldConfigs = JSON.parse(roasterLogosStr);
            if (Array.isArray(oldConfigs) && oldConfigs.length > 0) {
              existing.data.roasterConfigs = oldConfigs.map(
                (config: {
                  roasterName: string;
                  logoData?: string;
                  flavorPeriod?: RoasterFlavorPeriod;
                  updatedAt?: number;
                }) => ({
                  roasterName: config.roasterName,
                  logoData: config.logoData,
                  flavorPeriod: config.flavorPeriod,
                  updatedAt: config.updatedAt || Date.now(),
                })
              );
              needsUpdate = true;
              console.warn(
                `已补充迁移 ${existing.data.roasterConfigs.length} 个烘焙商配置`
              );
            }
          } catch {
            // 忽略解析错误
          }
        }

        // 补充迁移 customFlavorDimensions
        const flavorDimensionsStr = localStorage.getItem(
          'customFlavorDimensions'
        );
        if (
          flavorDimensionsStr &&
          (!existing.data.flavorDimensions ||
            existing.data.flavorDimensions.length === 0)
        ) {
          try {
            existing.data.flavorDimensions = JSON.parse(flavorDimensionsStr);
            needsUpdate = true;
            console.warn('已补充迁移自定义风味维度');
          } catch {
            // 忽略解析错误
          }
        }

        // 补充迁移 flavorDimensionHistoricalLabels
        const historicalLabelsStr = localStorage.getItem(
          'flavorDimensionHistoricalLabels'
        );
        if (
          historicalLabelsStr &&
          (!existing.data.flavorDimensionHistoricalLabels ||
            Object.keys(existing.data.flavorDimensionHistoricalLabels)
              .length === 0)
        ) {
          try {
            existing.data.flavorDimensionHistoricalLabels =
              JSON.parse(historicalLabelsStr);
            needsUpdate = true;
            console.warn('已补充迁移风味维度历史标签');
          } catch {
            // 忽略解析错误
          }
        }

        // 补充迁移 equipmentOrder
        const equipmentOrderStr = localStorage.getItem('equipmentOrder');
        if (
          equipmentOrderStr &&
          (!existing.data.equipmentOrder ||
            existing.data.equipmentOrder.length === 0)
        ) {
          try {
            const order = JSON.parse(equipmentOrderStr);
            existing.data.equipmentOrder = order.equipmentIds || [];
            needsUpdate = true;
            console.warn('已补充迁移器具排序');
          } catch {
            // 忽略解析错误
          }
        }

        if (needsUpdate) {
          await db.appSettings.put(existing);
        }
        return;
      }

      const settingsStr = localStorage.getItem('brewGuideSettings');
      if (!settingsStr) return;

      let settings = JSON.parse(settingsStr);

      // 处理 Zustand persist 格式
      if (settings?.state?.settings) {
        settings = settings.state.settings;
      }

      // 移除磨豆机数据（已单独迁移到 grinders 表）
      delete settings.grinders;

      // 迁移自定义风味维度（旧版本数据迁移）
      const flavorDimensionsStr = localStorage.getItem(
        'customFlavorDimensions'
      );
      if (flavorDimensionsStr) {
        try {
          settings.flavorDimensions = JSON.parse(flavorDimensionsStr);
        } catch {
          // 忽略解析错误
        }
      }

      // 迁移风味维度历史标签（旧版本数据迁移）
      const historicalLabelsStr = localStorage.getItem(
        'flavorDimensionHistoricalLabels'
      );
      if (historicalLabelsStr) {
        try {
          settings.flavorDimensionHistoricalLabels =
            JSON.parse(historicalLabelsStr);
        } catch {
          // 忽略解析错误
        }
      }

      // 迁移烘焙商配置（旧版本数据迁移）
      // 旧版本使用 'roaster-logos' 存储 RoasterConfig[]
      const roasterLogosStr = localStorage.getItem('roaster-logos');
      if (roasterLogosStr) {
        try {
          const oldConfigs = JSON.parse(roasterLogosStr);
          if (Array.isArray(oldConfigs) && oldConfigs.length > 0) {
            // 新版格式：直接使用 RoasterConfig[] 数组
            settings.roasterConfigs = oldConfigs.map(
              (config: {
                roasterName: string;
                logoData?: string;
                flavorPeriod?: RoasterFlavorPeriod;
                updatedAt?: number;
              }) => ({
                roasterName: config.roasterName,
                logoData: config.logoData,
                flavorPeriod: config.flavorPeriod,
                updatedAt: config.updatedAt || Date.now(),
              })
            );
            console.log(
              `已迁移 ${settings.roasterConfigs.length} 个烘焙商配置`
            );
          }
        } catch {
          // 忽略解析错误
        }
      }

      // 迁移器具排序
      const equipmentOrderStr = localStorage.getItem('equipmentOrder');
      if (equipmentOrderStr) {
        try {
          const order = JSON.parse(equipmentOrderStr);
          settings.equipmentOrder = order.equipmentIds || [];
        } catch {
          // 忽略解析错误
        }
      }

      await db.appSettings.put({ id: 'main', data: settings });
      console.log('已迁移应用设置到 IndexedDB');
    } catch (error) {
      console.error('迁移应用设置失败:', error);
    }
  },

  /**
   * v6 迁移：将咖啡豆内联图片拆分到独立表
   */
  async migrateCoffeeBeanImages(): Promise<void> {
    try {
      let migratedBeanCount = 0;
      let imageRecordCount = 0;

      await db.transaction(
        'rw',
        db.coffeeBeans,
        db.coffeeBeanImages,
        db.coffeeBeanImageThumbnails,
        async () => {
          await db.coffeeBeans.each(async bean => {
            const split = splitCoffeeBeanImages(bean);
            if (!split.imageRecord) {
              return;
            }

            const existingRecord = await db.coffeeBeanImages.get(bean.id);
            const imageThumbnail = getUsableCoffeeBeanThumbnail(
              existingRecord?.imageThumbnail
            );
            const backImageThumbnail = getUsableCoffeeBeanThumbnail(
              existingRecord?.backImageThumbnail
            );
            await db.coffeeBeanImages.put({
              ...split.imageRecord,
              imageThumbnail,
              backImageThumbnail,
            });
            if (imageThumbnail || backImageThumbnail) {
              await db.coffeeBeanImageThumbnails.put({
                beanId: bean.id,
                imageThumbnail,
                backImageThumbnail,
                updatedAt: existingRecord?.updatedAt || Date.now(),
              });
            }
            await db.coffeeBeans.put(split.bean);
            migratedBeanCount += 1;
          });

          imageRecordCount = await db.coffeeBeanImages.count();
        }
      );

      if (migratedBeanCount > 0) {
        console.warn(
          `已拆分 ${migratedBeanCount} 条咖啡豆图片记录，当前图片记录 ${imageRecordCount} 条`
        );
      }
    } catch (error) {
      console.error('拆分咖啡豆图片失败:', error);
    }
  },

  async migrateBrewingNoteImages(): Promise<void> {
    const migrated = await db.settings.get('brewingNoteImagesMigrated');
    if (migrated?.value === 'true') return;

    const noteIds = (await db.brewingNotes.toCollection().primaryKeys()).map(
      String
    );

    for (const noteId of noteIds) {
      const note = await db.brewingNotes.get(noteId);
      if (!note?.image && (!note?.images || note.images.length === 0)) {
        continue;
      }

      const split = splitBrewingNoteImages(note);
      await db.transaction(
        'rw',
        db.brewingNotes,
        db.brewingNoteImages,
        async () => {
          if (split.imageRecord) {
            await db.brewingNoteImages.put(split.imageRecord);
          }
          await db.brewingNotes.put(split.note);
        }
      );
    }

    await db.settings.put({ key: 'brewingNoteImagesMigrated', value: 'true' });
  },

  /**
   * 清除数据库数据
   */
  async clearAllData(): Promise<void> {
    try {
      await db.brewingNotes.clear();
      await db.brewingNoteImages.clear();
      await db.brewingNoteImageThumbnails.clear();
      await db.coffeeBeans.clear();
      await db.coffeeBeanImages.clear();
      await db.coffeeBeanImageThumbnails.clear();
      await db.customEquipments.clear();
      await db.customMethods.clear();
      await db.grinders.clear();
      await db.appSettings.clear();
      await db.settings.clear();
      console.warn('数据库已清空');
    } catch (error) {
      console.error('清空数据库失败:', error);
      throw error;
    }
  },

  /**
   * 记录当前存储信息
   */
  async logStorageInfo(): Promise<void> {
    try {
      const [
        noteCount,
        beanCount,
        grinderCount,
        equipmentCount,
        beanImageCount,
        beanThumbnailCount,
        noteImageCount,
        noteThumbnailCount,
      ] = await Promise.all([
        db.brewingNotes.count(),
        db.coffeeBeans.count(),
        db.grinders.count(),
        db.customEquipments.count(),
        db.coffeeBeanImages.count(),
        db.coffeeBeanImageThumbnails.count(),
        db.brewingNoteImages.count(),
        db.brewingNoteImageThumbnails.count(),
      ]);

      console.warn(`IndexedDB 存储信息:`);
      console.warn(`- 笔记数量: ${noteCount}`);
      console.warn(`- 咖啡豆数量: ${beanCount}`);
      console.warn(`- 咖啡豆图片数量: ${beanImageCount}`);
      console.warn(`- 咖啡豆缩略图数量: ${beanThumbnailCount}`);
      console.warn(`- 笔记图片数量: ${noteImageCount}`);
      console.warn(`- 笔记缩略图数量: ${noteThumbnailCount}`);
      console.warn(`- 磨豆机数量: ${grinderCount}`);
      console.warn(`- 自定义器具数量: ${equipmentCount}`);

      try {
        let keyCount = 0;
        for (let i = 0; i < localStorage.length; i++) {
          if (localStorage.key(i)) keyCount += 1;
        }

        console.warn(`localStorage 存储信息:`);
        console.warn(`- key 数量: ${keyCount}`);
      } catch (e) {
        console.error('计算localStorage大小失败:', e);
      }
    } catch (error) {
      console.error('记录存储信息失败:', error);
    }
  },
};
