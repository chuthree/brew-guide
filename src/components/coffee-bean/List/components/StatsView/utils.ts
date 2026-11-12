import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';
import { eachDayOfInterval } from 'date-fns/eachDayOfInterval';
import { eachMonthOfInterval } from 'date-fns/eachMonthOfInterval';
import { getDateKey, type TimeRange } from '@/lib/utils/dateUtils';
import type { RoasterRatingStatsItem, TrendDataPoint } from './types';

export { getDateKey, getTimeRange } from '@/lib/utils/dateUtils';

// 按本地日历计数，包含起止两天。
export const calculateDaysBetween = (startTime: number, endTime: number) =>
  Math.max(1, differenceInCalendarDays(endTime, startTime) + 1);

export const buildTrendData = (
  { startTime, endTime }: TimeRange,
  groupBy: 'day' | 'month',
  values: ReadonlyMap<string, number>
): TrendDataPoint[] => {
  if (!(startTime < endTime) || !Number.isFinite(endTime)) return [];

  const interval = { start: startTime, end: endTime - 1 };
  const dates =
    groupBy === 'day'
      ? eachDayOfInterval(interval)
      : eachMonthOfInterval(interval);

  return dates.flatMap(date => {
    const key = getDateKey(date, groupBy);
    if (!key) return [];
    const month = date.getMonth() + 1;
    const label =
      groupBy === 'day' ? `${month}/${date.getDate()}` : `${month}月`;
    return [{ date: key, label, value: values.get(key) ?? 0 }];
  });
};

// 格式化数字，保留2位小数
export const formatNumber = (num: number): string => {
  if (!isFinite(num)) return '0';
  const rounded = Math.round(num * 100) / 100;
  return rounded
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');
};

// 按有评分的咖啡豆等权平均，避免冲煮次数影响烘焙商评分。
export const buildRoasterRatingStats = (
  beans: { roasterName: string; averageRating: number }[]
): RoasterRatingStatsItem[] => {
  const groups = new Map<string, { total: number; count: number }>();
  for (const bean of beans) {
    const name = bean.roasterName.trim();
    if (
      !name ||
      !Number.isFinite(bean.averageRating) ||
      bean.averageRating <= 0
    ) {
      continue;
    }
    const group = groups.get(name) ?? { total: 0, count: 0 };
    group.total += bean.averageRating;
    group.count += 1;
    groups.set(name, group);
  }

  return Array.from(groups, ([roasterName, group]) => ({
    roasterName,
    averageRating: group.total / group.count,
    beanCount: group.count,
  })).sort(
    (a, b) =>
      b.averageRating - a.averageRating ||
      b.beanCount - a.beanCount ||
      a.roasterName.localeCompare(b.roasterName)
  );
};
