import { format } from 'date-fns/format';
import { formatISO } from 'date-fns/formatISO';
import { startOfISOWeek } from 'date-fns/startOfISOWeek';

/**
 * 将各种格式的日期字符串标准化为 YYYY-MM-DD 格式
 * 支持以下格式：
 * - YYYY-MM-DD
 * - YYYY/MM/DD
 * - YYYY.MM.DD
 * - YYYY年MM月DD日
 *
 * @param dateStr 日期字符串
 * @returns 标准化后的日期字符串，如果无法解析则返回原始字符串
 */
export function normalizeDate(dateStr: string): string {
  if (!dateStr) return '';

  // 检查是否是中文日期格式，如"2023年5月1日"
  const chineseFormat = /(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(dateStr);
  if (chineseFormat) {
    const [_, year, month, day] = chineseFormat;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // 检查是否是斜杠分隔的格式，如"2023/5/1"
  const slashFormat = /(\d{4})\/(\d{1,2})\/(\d{1,2})/.exec(dateStr);
  if (slashFormat) {
    const [_, year, month, day] = slashFormat;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // 检查是否是点分隔的格式，如"2023.5.1"
  const dotFormat = /(\d{4})\.(\d{1,2})\.(\d{1,2})/.exec(dateStr);
  if (dotFormat) {
    const [_, year, month, day] = dotFormat;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // 尝试使用Date对象解析
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    // 解析失败，不处理
  }

  // 已经是YYYY-MM-DD格式或无法解析的格式，保持不变
  return dateStr;
}

/**
 * 将日期字符串解析为时间戳（毫秒）
 * 首先尝试标准化日期格式，然后再解析
 *
 * @param dateStr 日期字符串
 * @returns 解析后的时间戳，如果无法解析则返回 NaN
 */
export function parseDateToTimestamp(dateStr: string): number {
  if (!dateStr) return NaN;

  const normalizedDate = normalizeDate(dateStr);
  return Date.parse(normalizedDate);
}

/**
 * 格式化日期为本地字符串（中文格式）
 *
 * @param dateStr 日期字符串
 * @returns 格式化后的日期字符串，例如 "2023-05-01"
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '';

  try {
    const timestamp = parseDateToTimestamp(dateStr);
    if (isNaN(timestamp)) return dateStr;

    const date = new Date(timestamp);
    return date
      .toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      .replace(/\//g, '-');
  } catch {
    return dateStr;
  }
}

/**
 * 计算两个日期之间的天数差
 *
 * @param dateStr1 第一个日期字符串
 * @param dateStr2 第二个日期字符串（默认为今天）
 * @returns 天数差（正整数）
 */
function daysBetween(dateStr1: string, dateStr2?: string): number {
  if (!dateStr1) return 0;

  const timestamp1 = parseDateToTimestamp(dateStr1);
  if (isNaN(timestamp1)) return 0;

  const date1 = new Date(timestamp1);
  const date1WithoutTime = new Date(
    date1.getFullYear(),
    date1.getMonth(),
    date1.getDate()
  );

  let date2WithoutTime: Date;
  if (dateStr2) {
    const timestamp2 = parseDateToTimestamp(dateStr2);
    if (isNaN(timestamp2)) return 0;

    const date2 = new Date(timestamp2);
    date2WithoutTime = new Date(
      date2.getFullYear(),
      date2.getMonth(),
      date2.getDate()
    );
  } else {
    // 默认使用今天
    const today = new Date();
    date2WithoutTime = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
  }

  // 计算毫秒差，转换为天数
  const diffTime = Math.abs(
    date2WithoutTime.getTime() - date1WithoutTime.getTime()
  );
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export const DATE_GROUPING_LABELS = {
  year: '按年',
  month: '按月',
  week: '按周',
  day: '按日',
} as const;

export type DateGroupingMode = keyof typeof DATE_GROUPING_LABELS;
export const DATE_GROUPING_MODES = Object.keys(
  DATE_GROUPING_LABELS
) as DateGroupingMode[];

// 周分组用本地周一的日期作为键。
export const getDateKey = (
  date: Date,
  mode: DateGroupingMode
): string | null => {
  const periodDate = mode === 'week' ? startOfISOWeek(date) : date;
  if (Number.isNaN(periodDate.getTime())) return null;

  const key = formatISO(periodDate, { representation: 'date' });
  if (mode === 'year') return key.slice(0, 4);
  if (mode === 'month') return key.slice(0, 7);
  return key;
};

export interface TimeRange {
  startTime: number;
  endTime: number;
}

// 起点包含在内，终点为下一周期的本地零点。
export const getTimeRange = (
  dateKey: string | null,
  mode: DateGroupingMode
): TimeRange => {
  if (!dateKey) return { startTime: 0, endTime: Infinity };

  const [year, month, day] = dateKey.split('-').map(Number);
  if (mode === 'year') {
    return {
      startTime: new Date(year, 0, 1).getTime(),
      endTime: new Date(year + 1, 0, 1).getTime(),
    };
  }
  if (mode === 'month') {
    return {
      startTime: new Date(year, month - 1, 1).getTime(),
      endTime: new Date(year, month, 1).getTime(),
    };
  }

  const days = mode === 'week' ? 7 : 1;
  return {
    startTime: new Date(year, month - 1, day).getTime(),
    endTime: new Date(year, month - 1, day + days).getTime(),
  };
};

export const formatWeekLabel = (dateKey: string, now = new Date()): string => {
  const { startTime, endTime } = getTimeRange(dateKey, 'week');
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return dateKey;

  const currentWeekStart = startOfISOWeek(now).getTime();
  if (startTime === currentWeekStart) return '本周';
  if (endTime === currentWeekStart) return '上周';

  const start = new Date(startTime);
  const end = new Date(endTime - 1);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startFormat =
    sameYear && start.getFullYear() === now.getFullYear() ? 'M/d' : 'yyyy/M/d';
  const endFormat = sameYear ? 'M/d' : 'yyyy/M/d';
  return `${format(start, startFormat)}–${format(end, endFormat)}`;
};

const applyTimeOfDay = (targetDate: Date, sourceDate: Date): Date => {
  targetDate.setHours(
    sourceDate.getHours(),
    sourceDate.getMinutes(),
    sourceDate.getSeconds(),
    sourceDate.getMilliseconds()
  );
  return targetDate;
};

const getMonthDayCount = (year: number, monthIndex: number): number => {
  return new Date(year, monthIndex + 1, 0).getDate();
};

const getClampedDay = (
  year: number,
  monthIndex: number,
  preferredDay: number
): number => {
  return Math.min(preferredDay, getMonthDayCount(year, monthIndex));
};

const isValidYearMonth = (year: number, month: number): boolean => {
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    year > 0 &&
    month >= 1 &&
    month <= 12
  );
};

export const resolveSelectedDateTimestamp = (
  selectedDate: string,
  dateGroupingMode: DateGroupingMode,
  baseDate = new Date()
): number | null => {
  if (!selectedDate) return null;

  if (dateGroupingMode === 'day' || dateGroupingMode === 'week') {
    if (dateGroupingMode === 'day' && selectedDate === 'today') {
      return baseDate.getTime();
    }

    if (
      dateGroupingMode === 'day' &&
      (selectedDate === 'yesterday' || selectedDate === 'dayBeforeYesterday')
    ) {
      const offsetDays = selectedDate === 'yesterday' ? 1 : 2;
      const targetDate = new Date(baseDate);
      targetDate.setDate(targetDate.getDate() - offsetDays);
      return targetDate.getTime();
    }

    const [year, month, day] = selectedDate.split('-').map(Number);
    if (
      isValidYearMonth(year, month) &&
      Number.isInteger(day) &&
      day >= 1 &&
      day <= getMonthDayCount(year, month - 1)
    ) {
      return applyTimeOfDay(new Date(year, month - 1, day), baseDate).getTime();
    }

    return null;
  }

  if (dateGroupingMode === 'month') {
    const [year, month] = selectedDate.split('-').map(Number);
    if (isValidYearMonth(year, month)) {
      const monthIndex = month - 1;
      return applyTimeOfDay(
        new Date(
          year,
          monthIndex,
          getClampedDay(year, monthIndex, baseDate.getDate())
        ),
        baseDate
      ).getTime();
    }

    return null;
  }

  const year = Number(selectedDate);
  if (Number.isInteger(year) && year > 0) {
    const monthIndex = baseDate.getMonth();
    return applyTimeOfDay(
      new Date(
        year,
        monthIndex,
        getClampedDay(year, monthIndex, baseDate.getDate())
      ),
      baseDate
    ).getTime();
  }

  return null;
};
