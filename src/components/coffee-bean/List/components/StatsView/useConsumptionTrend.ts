import { useState, useEffect } from 'react';
import { ExtendedCoffeeBean } from '../../types';
import { DateGroupingMode } from './types';
import { BrewingNote } from '@/lib/core/config';

export interface TrendDataPoint {
  label: string;
  date: string; // YYYY-MM-DD or YYYY-MM
  value: number;
}

export const useConsumptionTrend = (
  beans: ExtendedCoffeeBean[],
  dateGroupingMode: DateGroupingMode,
  selectedDate: string | null
) => {
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const calculateTrend = async () => {
      setIsLoading(true);

      // 如果是日模式且选中了具体日期，或者没有选中日期（全部），不显示趋势图
      if ((dateGroupingMode === 'day' && selectedDate) || !selectedDate) {
        setTrendData([]);
        setIsLoading(false);
        return;
      }

      try {
        const { Storage } = await import('@/lib/core/storage');
        const notesStr = await Storage.get('brewingNotes');
        if (!notesStr) {
          setTrendData([]);
          setIsLoading(false);
          return;
        }

        const notes: BrewingNote[] = JSON.parse(notesStr);
        if (!Array.isArray(notes)) {
          setTrendData([]);
          setIsLoading(false);
          return;
        }

        // 1. 确定时间范围和粒度
        let startDate: Date;
        let endDate: Date;
        let groupBy: 'day' | 'month' = 'day';

        if (dateGroupingMode === 'year') {
          // 选中年份：该年的 12 个月
          const year = parseInt(selectedDate);
          startDate = new Date(year, 0, 1);
          endDate = new Date(year, 11, 31);
          groupBy = 'month';
        } else if (dateGroupingMode === 'month') {
          // 选中月份：该月的所有天
          const [year, month] = selectedDate.split('-').map(Number);
          startDate = new Date(year, month - 1, 1);
          // 下个月第0天即本月最后一天
          endDate = new Date(year, month, 0);
          groupBy = 'day';
        } else {
          // 其他情况不处理（理论上已拦截）
          setTrendData([]);
          setIsLoading(false);
          return;
        } // 设置时间为当天的开始/结束
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        // 2. 初始化数据桶
        const dataMap = new Map<string, number>();
        const labels: string[] = [];
        const dates: string[] = [];

        if (groupBy === 'day') {
          const current = new Date(startDate);
          while (current <= endDate) {
            const y = current.getFullYear();
            const m = current.getMonth() + 1;
            const d = current.getDate();
            const key = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
            dataMap.set(key, 0);
            dates.push(key);
            // 标签简化：如果是每月1号显示月份，否则显示日期，或者根据数量决定
            // 这里先存完整日期，UI层决定如何显示label
            labels.push(`${m}/${d}`);
            current.setDate(current.getDate() + 1);
          }
        } else {
          // groupBy === 'month'
          const current = new Date(startDate);
          while (current <= endDate) {
            const y = current.getFullYear();
            const m = current.getMonth() + 1;
            const key = `${y}-${m.toString().padStart(2, '0')}`;
            dataMap.set(key, 0);
            dates.push(key);
            labels.push(`${m}月`);
            current.setMonth(current.getMonth() + 1);
          }
        }

        // 3. 过滤和聚合数据
        // 获取所有相关豆子的名称（如果需要过滤特定豆子的话，但通常趋势是看整体消耗）
        // 如果 beans 列表受筛选影响，这里也应该受影响吗？
        // StatsView 传入的 beans 是 filteredBeans。
        // 但是趋势图通常希望看到整体趋势，或者符合当前筛选条件的趋势。
        // 如果 filteredBeans 已经是根据时间筛选过的，那我们不能只用 filteredBeans，
        // 因为我们需要展示整个时间段的趋势，而 filteredBeans 可能只包含某一天的数据。
        // 所以我们应该基于所有 beans (传入组件的原始 beans) 或者忽略 beans 过滤，只看 notes。
        // 但是 notes 关联的 bean 必须存在于系统中。
        // 考虑到 StatsView 的 props: beans 是所有 beans 还是 filtered?
        // 在 index.tsx 中：
        // const filteredBeans = useMemo(...)
        // 传给 StatsCategories 的是 filteredBeans。
        // 但是 useConsumptionTrend 应该使用原始数据源 notes，并根据时间范围过滤。
        // 只要 note 关联的 bean 存在即可。

        const startTime = startDate.getTime();
        const endTime = endDate.getTime();

        notes.forEach(note => {
          if (note.timestamp < startTime || note.timestamp > endTime) return;
          if (note.source === 'capacity-adjustment') return;

          let amount = 0;
          if (note.source === 'quick-decrement' && note.quickDecrementAmount) {
            amount = note.quickDecrementAmount;
          } else if (note.params?.coffee) {
            const match = note.params.coffee.match(/(\d+(\.\d+)?)/);
            if (match) {
              amount = parseFloat(match[0]);
            }
          }

          if (amount > 0) {
            const date = new Date(note.timestamp);
            let key = '';
            if (groupBy === 'day') {
              const y = date.getFullYear();
              const m = date.getMonth() + 1;
              const d = date.getDate();
              key = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
            } else {
              const y = date.getFullYear();
              const m = date.getMonth() + 1;
              key = `${y}-${m.toString().padStart(2, '0')}`;
            }

            if (dataMap.has(key)) {
              dataMap.set(key, dataMap.get(key)! + amount);
            }
          }
        });

        // 4. 转换为数组
        const result: TrendDataPoint[] = dates.map((date, index) => ({
          date,
          label: labels[index],
          value: dataMap.get(date) || 0,
        }));

        setTrendData(result);
      } catch (error) {
        console.error('计算趋势数据失败:', error);
        setTrendData([]);
      } finally {
        setIsLoading(false);
      }
    };

    calculateTrend();
  }, [beans, dateGroupingMode, selectedDate]);

  return { trendData, isLoading };
};
