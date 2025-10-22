'use client';

import { Storage } from '@/lib/core/storage';

/**
 * 备份提醒周期选项（天数）
 */
export const BACKUP_REMINDER_INTERVALS = {
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 30,
  NEVER: -1,
} as const;

export type BackupReminderInterval =
  (typeof BACKUP_REMINDER_INTERVALS)[keyof typeof BACKUP_REMINDER_INTERVALS];

/**
 * 备份提醒类型
 */
export type BackupReminderType =
  | 'hasDataNeverBackedUp'
  | 'firstTimeAfterDays'
  | 'periodicReminder';

/**
 * 备份提醒设置接口
 */
export interface BackupReminderSettings {
  enabled: boolean;
  interval: BackupReminderInterval;
  lastReminderDate: string | null;
  nextReminderDate: string | null;
  firstUseDate: string | null;
  hasShownFirstReminder: boolean;
  lastBackupDate: string | null; // 上次备份日期
  hasEverBackedUp: boolean; // 是否曾经备份过
}

/**
 * 默认备份提醒设置
 */
export const DEFAULT_BACKUP_REMINDER_SETTINGS: BackupReminderSettings = {
  enabled: true,
  interval: BACKUP_REMINDER_INTERVALS.WEEKLY,
  lastReminderDate: null,
  nextReminderDate: null,
  firstUseDate: null,
  hasShownFirstReminder: false,
  lastBackupDate: null,
  hasEverBackedUp: false,
};

/**
 * 备份提醒工具类
 */
export class BackupReminderUtils {
  private static readonly STORAGE_KEY = 'backupReminderSettings';
  private static readonly FIRST_REMINDER_DAYS = 7; // 首次使用7天后提醒
  private static readonly MIN_DATA_FOR_BACKUP = 3; // 至少有3条数据才提醒备份

  /**
   * 获取备份提醒设置
   */
  static async getSettings(): Promise<BackupReminderSettings> {
    try {
      const settingsStr = await Storage.get(this.STORAGE_KEY);
      if (settingsStr) {
        const settings = JSON.parse(settingsStr) as BackupReminderSettings;
        // 确保设置包含所有必需的字段
        return {
          ...DEFAULT_BACKUP_REMINDER_SETTINGS,
          ...settings,
        };
      }
      return DEFAULT_BACKUP_REMINDER_SETTINGS;
    } catch (error) {
      console.error('获取备份提醒设置失败:', error);
      return DEFAULT_BACKUP_REMINDER_SETTINGS;
    }
  }

  /**
   * 检查用户是否有值得备份的数据
   */
  static async hasSignificantData(): Promise<boolean> {
    try {
      // 检查冲煮笔记数量
      const brewingNotesStr = await Storage.get('brewingNotes');
      const brewingNotes = brewingNotesStr ? JSON.parse(brewingNotesStr) : [];
      const notesCount = Array.isArray(brewingNotes) ? brewingNotes.length : 0;

      // 检查咖啡豆数量
      const coffeeBeansStr = await Storage.get('coffeeBeans');
      const coffeeBeans = coffeeBeansStr ? JSON.parse(coffeeBeansStr) : [];
      const beansCount = Array.isArray(coffeeBeans) ? coffeeBeans.length : 0;

      // 检查自定义器具数量
      const customEquipmentsStr = await Storage.get('customEquipments');
      const customEquipments = customEquipmentsStr
        ? JSON.parse(customEquipmentsStr)
        : [];
      const equipmentsCount = Array.isArray(customEquipments)
        ? customEquipments.length
        : 0;

      // 总数据量达到阈值才认为有意义
      const totalDataCount = notesCount + beansCount + equipmentsCount;
      return totalDataCount >= this.MIN_DATA_FOR_BACKUP;
    } catch (error) {
      console.error('检查用户数据失败:', error);
      return false;
    }
  }

  /**
   * 保存备份提醒设置
   */
  static async saveSettings(settings: BackupReminderSettings): Promise<void> {
    try {
      await Storage.set(this.STORAGE_KEY, JSON.stringify(settings));

      // 触发设置变更事件
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('backupReminderSettingsChanged', {
            detail: { settings },
          })
        );
      }
    } catch (error) {
      console.error('保存备份提醒设置失败:', error);
      throw error;
    }
  }

  /**
   * 初始化首次使用
   */
  static async initializeFirstUse(): Promise<void> {
    const settings = await this.getSettings();

    // 如果还没有记录首次使用日期，则记录当前日期
    if (!settings.firstUseDate) {
      const now = new Date().toISOString();
      const updatedSettings: BackupReminderSettings = {
        ...settings,
        firstUseDate: now,
        nextReminderDate: this.calculateNextReminderDate(
          now,
          this.FIRST_REMINDER_DAYS
        ),
      };

      await this.saveSettings(updatedSettings);
    }
  }

  /**
   * 检查是否需要显示备份提醒
   */
  static async shouldShowReminder(): Promise<boolean> {
    const settings = await this.getSettings();

    // 如果提醒被禁用，不显示
    if (!settings.enabled) {
      return false;
    }

    const now = new Date();
    const hasData = await this.hasSignificantData();

    // 优先级1: 检查有数据但从未备份过的情况
    if (hasData && !settings.hasEverBackedUp) {
      // 如果有数据但从未备份过，立即提醒
      return true;
    }

    // 优先级2: 检查首次使用提醒（仅在有数据的情况下）
    if (!settings.hasShownFirstReminder && settings.firstUseDate && hasData) {
      const firstUseDate = new Date(settings.firstUseDate);
      const daysSinceFirstUse = Math.floor(
        (now.getTime() - firstUseDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceFirstUse >= this.FIRST_REMINDER_DAYS) {
        return true;
      }
    }

    // 优先级3: 检查定期提醒（仅在有数据的情况下）
    if (hasData && settings.nextReminderDate) {
      const nextReminderDate = new Date(settings.nextReminderDate);
      return now >= nextReminderDate;
    }

    return false;
  }

  /**
   * 标记提醒已显示，并计算下次提醒时间
   */
  static async markReminderShown(): Promise<void> {
    const settings = await this.getSettings();
    const now = new Date().toISOString();

    const updatedSettings: BackupReminderSettings = {
      ...settings,
      lastReminderDate: now,
      hasShownFirstReminder: true,
      nextReminderDate:
        settings.interval > 0
          ? this.calculateNextReminderDate(now, settings.interval)
          : null,
    };

    await this.saveSettings(updatedSettings);
  }

  /**
   * 标记用户已完成备份
   */
  static async markBackupCompleted(): Promise<void> {
    const settings = await this.getSettings();
    const now = new Date().toISOString();

    const updatedSettings: BackupReminderSettings = {
      ...settings,
      lastBackupDate: now,
      hasEverBackedUp: true,
      lastReminderDate: now,
      hasShownFirstReminder: true,
      nextReminderDate:
        settings.interval > 0
          ? this.calculateNextReminderDate(now, settings.interval)
          : null,
    };

    await this.saveSettings(updatedSettings);
  }

  /**
   * 获取当前应该显示的提醒类型
   */
  static async getReminderType(): Promise<BackupReminderType | null> {
    const settings = await this.getSettings();

    if (!settings.enabled) {
      return null;
    }

    const now = new Date();
    const hasData = await this.hasSignificantData();

    // 优先级1: 有数据但从未备份过
    if (hasData && !settings.hasEverBackedUp) {
      return 'hasDataNeverBackedUp';
    }

    // 优先级2: 首次使用提醒
    if (!settings.hasShownFirstReminder && settings.firstUseDate && hasData) {
      const firstUseDate = new Date(settings.firstUseDate);
      const daysSinceFirstUse = Math.floor(
        (now.getTime() - firstUseDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceFirstUse >= this.FIRST_REMINDER_DAYS) {
        return 'firstTimeAfterDays';
      }
    }

    // 优先级3: 定期提醒
    if (hasData && settings.nextReminderDate) {
      const nextReminderDate = new Date(settings.nextReminderDate);
      if (now >= nextReminderDate) {
        return 'periodicReminder';
      }
    }

    return null;
  }

  /**
   * 计算下次提醒日期
   */
  private static calculateNextReminderDate(
    fromDate: string,
    intervalDays: number
  ): string {
    const date = new Date(fromDate);
    date.setDate(date.getDate() + intervalDays);
    return date.toISOString();
  }

  /**
   * 更新提醒间隔
   */
  static async updateInterval(interval: BackupReminderInterval): Promise<void> {
    const settings = await this.getSettings();
    const now = new Date().toISOString();

    const updatedSettings: BackupReminderSettings = {
      ...settings,
      interval,
      nextReminderDate:
        interval > 0 ? this.calculateNextReminderDate(now, interval) : null,
    };

    await this.saveSettings(updatedSettings);
  }

  /**
   * 启用或禁用备份提醒
   */
  static async setEnabled(enabled: boolean): Promise<void> {
    const settings = await this.getSettings();
    const updatedSettings: BackupReminderSettings = {
      ...settings,
      enabled,
    };

    await this.saveSettings(updatedSettings);
  }

  /**
   * 获取下次提醒的友好显示文本
   */
  static async getNextReminderText(): Promise<string> {
    const settings = await this.getSettings();

    if (!settings.enabled) {
      return '备份提醒已禁用';
    }

    if (!settings.nextReminderDate) {
      return '无下次提醒';
    }

    const nextDate = new Date(settings.nextReminderDate);
    const now = new Date();
    const diffTime = nextDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // 格式化具体日期
    const currentYear = now.getFullYear();
    const nextYear = nextDate.getFullYear();

    const dateOptions: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
    };

    // 如果不是当年，添加年份
    if (nextYear !== currentYear) {
      dateOptions.year = 'numeric';
    }

    const dateStr = nextDate.toLocaleDateString('zh-CN', dateOptions);

    if (diffDays <= 0) {
      return '应该提醒';
    } else if (diffDays === 1) {
      return `明天（${dateStr}）`;
    } else if (diffDays <= 7) {
      return `${diffDays}天后（${dateStr}）`;
    } else {
      return dateStr;
    }
  }

  /**
   * 获取间隔选项的显示文本
   */
  static getIntervalText(interval: BackupReminderInterval): string {
    switch (interval) {
      case BACKUP_REMINDER_INTERVALS.WEEKLY:
        return '每周';
      case BACKUP_REMINDER_INTERVALS.BIWEEKLY:
        return '每两周';
      case BACKUP_REMINDER_INTERVALS.MONTHLY:
        return '每月';
      case BACKUP_REMINDER_INTERVALS.NEVER:
        return '从不';
      default:
        return '自定义';
    }
  }

  /**
   * 重置备份提醒设置
   */
  static async resetSettings(): Promise<void> {
    await this.saveSettings(DEFAULT_BACKUP_REMINDER_SETTINGS);
  }

  /**
   * 重置备份状态（保留其他设置，仅重置备份相关状态）
   */
  static async resetBackupStatus(): Promise<void> {
    const settings = await this.getSettings();
    const resetSettings: BackupReminderSettings = {
      ...settings,
      lastReminderDate: null,
      nextReminderDate: null,
      lastBackupDate: null,
      hasEverBackedUp: false,
      hasShownFirstReminder: false,
    };

    await this.saveSettings(resetSettings);
  }
}
