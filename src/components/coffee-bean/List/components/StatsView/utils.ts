import type { RoasterRatingStatsItem } from './types';

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
