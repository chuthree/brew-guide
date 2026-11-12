import type { CoffeeBean } from '@/types/app';
import {
  formatWeekLabel,
  getDateKey,
  normalizeDate,
  type DateGroupingMode,
} from '@/lib/utils/dateUtils';
import { getBeanRoasterName } from '@/lib/utils/coffeeBeanUtils';

export type RankingFilterMode = 'type' | 'date' | 'roaster';
export type RankingDateGroupingMode = DateGroupingMode;

interface RankingFilterOptions {
  filterMode: RankingFilterMode;
  beanType: 'all' | 'espresso' | 'filter' | 'omni';
  dateGroupingMode: RankingDateGroupingMode;
  selectedDate: string | null;
  selectedRoaster: string | null;
}

export const getRankingDateKey = (
  bean: CoffeeBean,
  groupingMode: RankingDateGroupingMode
): string | null => {
  if (!bean.roastDate) return null;

  const rawMatch =
    /^(\d{4})(?:-|\/|\.|年)(\d{1,2})(?:-|\/|\.|月)(\d{1,2})(?:日)?$/.exec(
      bean.roastDate.trim()
    );
  const normalized = rawMatch
    ? `${rawMatch[1]}-${rawMatch[2].padStart(2, '0')}-${rawMatch[3].padStart(2, '0')}`
    : normalizeDate(bean.roastDate);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  if (groupingMode === 'year') return year;
  if (groupingMode === 'month') return `${year}-${month}`;
  if (groupingMode === 'week') {
    return getDateKey(
      new Date(Number(year), Number(month) - 1, Number(day)),
      'week'
    );
  }
  return `${year}-${month}-${day}`;
};

export const getRankingRoaster = (bean: CoffeeBean): string | null => {
  const roaster = getBeanRoasterName(bean).trim();
  return roaster && roaster !== '未知烘焙商' ? roaster : null;
};

export const matchesRankingFilter = (
  bean: CoffeeBean,
  options: RankingFilterOptions
): boolean => {
  if (options.beanType !== 'all' && bean.beanType !== options.beanType)
    return false;

  if (options.filterMode === 'type') return true;

  if (options.filterMode === 'date') {
    return (
      options.selectedDate === null ||
      getRankingDateKey(bean, options.dateGroupingMode) === options.selectedDate
    );
  }

  return (
    options.selectedRoaster === null ||
    getRankingRoaster(bean) === options.selectedRoaster
  );
};

export const getRankingDates = (
  beans: CoffeeBean[],
  groupingMode: RankingDateGroupingMode
): string[] =>
  Array.from(
    new Set(
      beans.flatMap(bean => {
        const date = getRankingDateKey(bean, groupingMode);
        return date ? [date] : [];
      })
    )
  ).sort((left, right) => right.localeCompare(left));

export const getRankingRoasters = (beans: CoffeeBean[]): string[] => {
  const counts = new Map<string, number>();

  for (const bean of beans) {
    const roaster = getRankingRoaster(bean);
    if (roaster) counts.set(roaster, (counts.get(roaster) || 0) + 1);
  }

  return Array.from(counts)
    .sort(
      ([leftName, leftCount], [rightName, rightCount]) =>
        rightCount - leftCount || leftName.localeCompare(rightName, 'zh-CN')
    )
    .map(([roaster]) => roaster);
};

export const formatRankingDateLabel = (
  dateKey: string,
  groupingMode: RankingDateGroupingMode,
  now = new Date()
): string => {
  if (groupingMode === 'week') return formatWeekLabel(dateKey, now);

  const [yearText, monthText, dayText] = dateKey.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (groupingMode === 'year') {
    return year === now.getFullYear() ? '今年' : `${year}年`;
  }

  if (groupingMode === 'month') {
    if (year === now.getFullYear()) {
      return month === now.getMonth() + 1 ? '本月' : `${month}月`;
    }
    return `${year}年${month}月`;
  }

  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const targetUtc = Date.UTC(year, month - 1, day);
  const dayDifference = Math.round((todayUtc - targetUtc) / 86_400_000);

  if (dayDifference === 0) return '今天';
  if (dayDifference === 1) return '昨天';
  if (dayDifference === 2) return '前天';
  return year === now.getFullYear()
    ? `${month}/${day}`
    : `${year}/${month}/${day}`;
};
