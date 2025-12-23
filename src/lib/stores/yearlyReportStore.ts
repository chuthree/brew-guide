/**
 * 年度报告 Store
 *
 * 架构重构：
 * - 从 localStorage 迁移到 IndexedDB (yearlyReports 表)
 * - 改为 Zustand Store 实现
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { db, YearlyReport } from '@/lib/core/db';
import { nanoid } from 'nanoid';

// 重新导出类型
export type { YearlyReport } from '@/lib/core/db';

// 兼容旧类型名
export type SavedYearlyReport = YearlyReport;

/**
 * 年度报告 Store 状态接口
 */
interface YearlyReportStoreState {
  // 状态
  reports: YearlyReport[];
  isLoading: boolean;
  initialized: boolean;
  error: string | null;

  // 初始化
  loadReports: () => Promise<void>;

  // CRUD 操作
  saveReport: (
    year: number,
    username: string,
    content: string
  ) => Promise<YearlyReport>;
  deleteReport: (id: string) => Promise<boolean>;

  // 查询
  getReportByYear: (year: number) => YearlyReport | undefined;
  getReportById: (id: string) => YearlyReport | undefined;

  // 批量操作
  setReports: (reports: YearlyReport[]) => void;
  upsertReport: (report: YearlyReport) => Promise<void>;

  // 刷新
  refreshReports: () => Promise<void>;
}

/**
 * 年度报告 Zustand Store
 */
export const useYearlyReportStore = create<YearlyReportStoreState>()(
  subscribeWithSelector((set, get) => ({
    reports: [],
    isLoading: false,
    initialized: false,
    error: null,

    loadReports: async () => {
      if (get().isLoading) return;

      set({ isLoading: true, error: null });

      try {
        // 从 IndexedDB 加载
        let reports = await db.yearlyReports.toArray();

        // 如果 IndexedDB 为空，尝试从 localStorage 迁移
        if (reports.length === 0) {
          reports = await migrateFromLocalStorage();
          if (reports.length > 0) {
            await db.yearlyReports.bulkPut(reports);
            console.log(`已迁移 ${reports.length} 份年度报告到 IndexedDB`);
          }
        }

        // 按创建时间倒序排列
        reports.sort((a, b) => b.createdAt - a.createdAt);

        set({ reports, isLoading: false, initialized: true });
      } catch (error) {
        console.error('[YearlyReportStore] loadReports failed:', error);
        set({
          error: '加载年度报告失败',
          isLoading: false,
          initialized: true,
        });
      }
    },

    saveReport: async (year, username, content) => {
      const id = `report_${year}_${Date.now()}`;
      const newReport: YearlyReport = {
        id,
        year,
        username,
        content,
        createdAt: Date.now(),
      };

      try {
        // 删除同年份的旧报告
        const existingReports = get().reports;
        const oldReport = existingReports.find(r => r.year === year);
        if (oldReport) {
          await db.yearlyReports.delete(oldReport.id);
        }

        // 保存新报告
        await db.yearlyReports.put(newReport);

        // 更新状态
        const filteredReports = existingReports.filter(r => r.year !== year);
        const updatedReports = [newReport, ...filteredReports].sort(
          (a, b) => b.createdAt - a.createdAt
        );
        set({ reports: updatedReports });

        return newReport;
      } catch (error) {
        console.error('[YearlyReportStore] saveReport failed:', error);
        throw error;
      }
    },

    deleteReport: async id => {
      try {
        await db.yearlyReports.delete(id);
        set(state => ({
          reports: state.reports.filter(r => r.id !== id),
        }));
        return true;
      } catch (error) {
        console.error('[YearlyReportStore] deleteReport failed:', error);
        return false;
      }
    },

    getReportByYear: year => {
      return get().reports.find(r => r.year === year);
    },

    getReportById: id => {
      return get().reports.find(r => r.id === id);
    },

    setReports: reports => {
      set({ reports, initialized: true });
    },

    upsertReport: async report => {
      try {
        await db.yearlyReports.put(report);

        set(state => {
          const exists = state.reports.some(r => r.id === report.id);
          if (exists) {
            return {
              reports: state.reports
                .map(r => (r.id === report.id ? report : r))
                .sort((a, b) => b.createdAt - a.createdAt),
            };
          } else {
            return {
              reports: [report, ...state.reports].sort(
                (a, b) => b.createdAt - a.createdAt
              ),
            };
          }
        });
      } catch (error) {
        console.error('[YearlyReportStore] upsertReport failed:', error);
      }
    },

    refreshReports: async () => {
      set({ initialized: false });
      await get().loadReports();
    },
  }))
);

/**
 * 从 localStorage 迁移数据
 */
async function migrateFromLocalStorage(): Promise<YearlyReport[]> {
  try {
    if (typeof localStorage === 'undefined') return [];

    const reportsStr = localStorage.getItem('yearlyReports');
    if (!reportsStr) return [];

    return JSON.parse(reportsStr) as YearlyReport[];
  } catch (error) {
    console.error('迁移年度报告数据失败:', error);
    return [];
  }
}

/**
 * 获取 Store 实例（非 React 环境使用）
 */
export const getYearlyReportStore = () => useYearlyReportStore.getState();
