'use client';

import { Storage } from '@/lib/core/storage';

/**
 * 年度回顾提醒设置接口
 */
export interface YearlyReviewReminderSettings {
  /** 已查看的年度回顾年份列表 */
  viewedYears: number[];
  /** 上次提醒日期 */
  lastReminderDate: string | null;
  /** 是否已点击"看过了"跳过当前年份 */
  skippedYears: number[];
}

/**
 * 默认年度回顾提醒设置
 */
export const DEFAULT_YEARLY_REVIEW_REMINDER_SETTINGS: YearlyReviewReminderSettings =
  {
    viewedYears: [],
    lastReminderDate: null,
    skippedYears: [],
  };

/**
 * 年度回顾提醒工具类
 *
 * 用于检测是否应该显示年度回顾提醒弹窗。
 *
 * 显示条件（必须全部满足）：
 * 1. 当前年份的年度回顾未查看过
 * 2. 咖啡豆数量 >= 5（包括用完的）
 * 3. 有冲煮记录（包括快捷记录）
 * 4. 没有其他弹窗正在显示（如备份提醒）
 */
export class YearlyReviewReminderUtils {
  private static readonly STORAGE_KEY = 'yearlyReviewReminderSettings';
  private static readonly MIN_BEANS_COUNT = 5;

  /**
   * 获取年度回顾提醒设置
   */
  static async getSettings(): Promise<YearlyReviewReminderSettings> {
    try {
      const settingsStr = await Storage.get(this.STORAGE_KEY);
      if (settingsStr) {
        const settings = JSON.parse(
          settingsStr
        ) as YearlyReviewReminderSettings;
        return {
          ...DEFAULT_YEARLY_REVIEW_REMINDER_SETTINGS,
          ...settings,
        };
      }
      return DEFAULT_YEARLY_REVIEW_REMINDER_SETTINGS;
    } catch (error) {
      console.error('获取年度回顾提醒设置失败:', error);
      return DEFAULT_YEARLY_REVIEW_REMINDER_SETTINGS;
    }
  }

  /**
   * 保存年度回顾提醒设置
   */
  static async saveSettings(
    settings: YearlyReviewReminderSettings
  ): Promise<void> {
    try {
      await Storage.set(this.STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('保存年度回顾提醒设置失败:', error);
    }
  }

  /**
   * 检查是否有足够的咖啡豆数据
   * 需要至少 5 个咖啡豆（包括用完的）
   */
  static async hasEnoughBeans(): Promise<boolean> {
    try {
      const coffeeBeansStr = await Storage.get('coffeeBeans');
      const coffeeBeans = coffeeBeansStr ? JSON.parse(coffeeBeansStr) : [];
      const beansCount = Array.isArray(coffeeBeans) ? coffeeBeans.length : 0;
      return beansCount >= this.MIN_BEANS_COUNT;
    } catch (error) {
      console.error('检查咖啡豆数量失败:', error);
      return false;
    }
  }

  /**
   * 检查是否有冲煮记录（包括快捷记录）
   */
  static async hasBrewingNotes(): Promise<boolean> {
    try {
      const brewingNotesStr = await Storage.get('brewingNotes');
      const brewingNotes = brewingNotesStr ? JSON.parse(brewingNotesStr) : [];
      const notesCount = Array.isArray(brewingNotes) ? brewingNotes.length : 0;
      return notesCount > 0;
    } catch (error) {
      console.error('检查冲煮记录失败:', error);
      return false;
    }
  }

  /**
   * 检查2025年是否已生成过年度报告
   * 如果已生成，说明用户肯定已经看过年度回顾了
   */
  static async hasGeneratedCurrentYearReport(): Promise<boolean> {
    try {
      const yearlyReportsStr = await Storage.get('yearlyReports');
      if (!yearlyReportsStr) {
        return false;
      }
      const yearlyReports = JSON.parse(yearlyReportsStr);
      // yearlyReports 是一个对象，键是年份字符串
      return (
        yearlyReports &&
        typeof yearlyReports === 'object' &&
        yearlyReports['2025']
      );
    } catch (error) {
      console.error('检查年度报告失败:', error);
      return false;
    }
  }

  /**
   * 检查2025年是否已查看过年度回顾
   */
  static async hasViewedCurrentYearReview(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.viewedYears.includes(2025);
  }

  /**
   * 检查2025年是否已跳过年度回顾提醒
   */
  static async hasSkippedCurrentYearReminder(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.skippedYears.includes(2025);
  }

  /**
   * 检查是否需要显示年度回顾提醒
   *
   * @returns 是否需要显示提醒
   */
  static async shouldShowReminder(): Promise<boolean> {
    try {
      // 检查是否已生成过当前年份的年度报告（说明用户已经完整看过年度回顾）
      const hasReport = await this.hasGeneratedCurrentYearReport();
      if (hasReport) {
        return false;
      }

      // 检查是否已查看过当前年份的年度回顾
      const hasViewed = await this.hasViewedCurrentYearReview();
      if (hasViewed) {
        return false;
      }

      // 检查是否已跳过当前年份的提醒
      const hasSkipped = await this.hasSkippedCurrentYearReminder();
      if (hasSkipped) {
        return false;
      }

      // 检查咖啡豆数量是否足够
      const hasEnoughBeans = await this.hasEnoughBeans();
      if (!hasEnoughBeans) {
        return false;
      }

      // 检查是否有冲煮记录
      const hasNotes = await this.hasBrewingNotes();
      if (!hasNotes) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('检查年度回顾提醒失败:', error);
      return false;
    }
  }

  /**
   * 标记2025年的年度回顾已查看
   */
  static async markAsViewed(): Promise<void> {
    const settings = await this.getSettings();

    if (!settings.viewedYears.includes(2025)) {
      settings.viewedYears.push(2025);
    }

    await this.saveSettings(settings);
  }

  /**
   * 标记2025年的年度回顾提醒已跳过（点击"看过了"）
   */
  static async markAsSkipped(): Promise<void> {
    const settings = await this.getSettings();

    if (!settings.skippedYears.includes(2025)) {
      settings.skippedYears.push(2025);
    }

    settings.lastReminderDate = new Date().toISOString();
    await this.saveSettings(settings);
  }

  /**
   * 获取年度回顾的年份（固定为2025）
   */
  static getCurrentYear(): number {
    return 2025;
  }
}
