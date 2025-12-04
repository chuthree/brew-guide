import { Storage } from '@/lib/core/storage';

const YEARLY_REPORTS_KEY = 'yearlyReports';

/**
 * 年度报告数据结构
 */
export interface SavedYearlyReport {
  id: string;
  year: number;
  username: string;
  content: string;
  createdAt: number;
}

/**
 * 年度报告存储管理
 */
export const YearlyReportStore = {
  /**
   * 获取所有保存的年度报告
   */
  async getAll(): Promise<SavedYearlyReport[]> {
    try {
      const data = await Storage.get(YEARLY_REPORTS_KEY);
      if (!data) return [];
      const reports = JSON.parse(data) as SavedYearlyReport[];
      // 按创建时间倒序排列
      return reports.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('获取年度报告列表失败:', error);
      return [];
    }
  },

  /**
   * 获取指定年份的最新报告
   */
  async getByYear(year: number): Promise<SavedYearlyReport | null> {
    const reports = await this.getAll();
    return reports.find(r => r.year === year) || null;
  },

  /**
   * 获取指定 ID 的报告
   */
  async getById(id: string): Promise<SavedYearlyReport | null> {
    const reports = await this.getAll();
    return reports.find(r => r.id === id) || null;
  },

  /**
   * 保存新的年度报告
   * 同一年份只保留最新的一份
   */
  async save(
    year: number,
    username: string,
    content: string
  ): Promise<SavedYearlyReport> {
    const reports = await this.getAll();

    // 生成唯一 ID
    const id = `report_${year}_${Date.now()}`;

    const newReport: SavedYearlyReport = {
      id,
      year,
      username,
      content,
      createdAt: Date.now(),
    };

    // 移除同年份的旧报告，保留不同年份的报告
    const filteredReports = reports.filter(r => r.year !== year);

    // 添加新报告
    filteredReports.unshift(newReport);

    // 保存
    await Storage.set(YEARLY_REPORTS_KEY, JSON.stringify(filteredReports));

    console.log(`✅ 年度报告已保存: ${year}年`);
    return newReport;
  },

  /**
   * 删除指定报告
   */
  async delete(id: string): Promise<boolean> {
    try {
      const reports = await this.getAll();
      const filteredReports = reports.filter(r => r.id !== id);

      if (filteredReports.length === reports.length) {
        return false; // 没有找到要删除的报告
      }

      await Storage.set(YEARLY_REPORTS_KEY, JSON.stringify(filteredReports));
      console.log(`✅ 年度报告已删除: ${id}`);
      return true;
    } catch (error) {
      console.error('删除年度报告失败:', error);
      return false;
    }
  },

  /**
   * 获取报告数量
   */
  async count(): Promise<number> {
    const reports = await this.getAll();
    return reports.length;
  },

  /**
   * 检查指定年份是否已有报告
   */
  async hasReportForYear(year: number): Promise<boolean> {
    const report = await this.getByYear(year);
    return report !== null;
  },
};
