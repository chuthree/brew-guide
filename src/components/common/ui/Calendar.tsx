'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  isSameDay,
  isToday,
  startOfMonth,
  eachDayOfInterval,
  addDays,
  Locale,
} from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils/classNameUtils';
import * as Popover from '@radix-ui/react-popover';

export interface CalendarProps {
  mode?: 'single' | 'range' | 'multiple';
  selected?: Date | Date[] | { from: Date; to: Date };
  onSelect?: (date: Date) => void;
  locale?: string;
  className?: string;
  initialFocus?: boolean;
  showTimeInput?: boolean;
}

const getDaysOfWeek = (locale: Locale) => {
  const days = [];
  const now = new Date();

  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() - now.getDay() + i);
    days.push(format(date, 'EEE', { locale }));
  }

  return days;
};

type TimePart = 'hours' | 'minutes';

const formatTimePart = (value: number) => value.toString().padStart(2, '0');

const getTimeDraft = (date: Date) => ({
  hours: formatTimePart(date.getHours()),
  minutes: formatTimePart(date.getMinutes()),
});

export function Calendar({
  selected,
  onSelect,
  locale = 'zh-CN',
  className,
  initialFocus = false,
  showTimeInput = false,
}: CalendarProps) {
  const selectedDate = selected instanceof Date ? selected : undefined;
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    // 如果有选中的日期，则显示该日期所在的月份
    if (selectedDate) {
      return selectedDate;
    }
    return new Date();
  });
  const [activeTimePart, setActiveTimePart] = React.useState<TimePart | null>(
    null
  );
  const [timeDraft, setTimeDraft] = React.useState(() =>
    getTimeDraft(selectedDate ?? new Date())
  );

  React.useEffect(() => {
    if (activeTimePart || !selectedDate) return;
    setTimeDraft(getTimeDraft(selectedDate));
  }, [activeTimePart, selectedDate]);

  const localeObj = locale === 'zh-CN' ? zhCN : enUS;
  const daysOfWeek = getDaysOfWeek(localeObj);

  // 前进一个月
  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // 后退一个月
  const goToPrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  // 选择今天
  const selectToday = () => {
    const today = withSelectedTime(new Date());
    if (onSelect) {
      onSelect(today);
    }
    setCurrentMonth(today);
  };

  const withSelectedTime = (date: Date) => {
    if (!selectedDate) return date;

    const nextDate = new Date(date);
    nextDate.setHours(
      selectedDate.getHours(),
      selectedDate.getMinutes(),
      selectedDate.getSeconds(),
      selectedDate.getMilliseconds()
    );
    return nextDate;
  };

  // 获取当前月的天数
  const startDate = startOfMonth(currentMonth);

  // 获取完整的日历视图（包含上个月和下个月的部分日期）
  const firstDayOfMonth = startDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // 日历开始日期（可能是上个月的某天）
  const calendarStart = new Date(startDate);
  calendarStart.setDate(calendarStart.getDate() - firstDayOfMonth);

  // 获取42天（6周）的日期数组，确保日历视图完整
  const daysInCalendar = eachDayOfInterval({
    start: calendarStart,
    end: addDays(calendarStart, 41),
  });

  // 处理日期选择
  const handleDateSelect = (date: Date) => {
    const selectedDate = withSelectedTime(date);
    if (onSelect) {
      onSelect(selectedDate);
    }

    // 点击跨月日期时，同步切换到对应月份，行为与常见日历组件保持一致
    if (
      selectedDate.getMonth() !== currentMonth.getMonth() ||
      selectedDate.getFullYear() !== currentMonth.getFullYear()
    ) {
      setCurrentMonth(startOfMonth(selectedDate));
    }
  };

  const updateSelectedTime = (nextTime: Partial<Record<TimePart, string>>) => {
    if (!onSelect) return;

    const baseDate = selectedDate ?? new Date(currentMonth);
    const nextDate = new Date(baseDate);
    const hours = Number(nextTime.hours ?? timeDraft.hours);
    const minutes = Number(nextTime.minutes ?? timeDraft.minutes);

    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      nextDate.setHours(hours, minutes);
      onSelect(nextDate);
      setCurrentMonth(nextDate);
    }
  };

  const handleTimeChange =
    (part: TimePart) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value.replace(/\D/g, '').slice(0, 2);
      setTimeDraft(prevDraft => ({ ...prevDraft, [part]: value }));

      const maxValue = part === 'hours' ? 23 : 59;
      const numericValue = Number(value);
      if (value !== '' && numericValue <= maxValue) {
        updateSelectedTime({ [part]: value });
      }
    };

  const handleTimeBlur = (part: TimePart) => {
    const maxValue = part === 'hours' ? 23 : 59;
    const numericValue = Number(timeDraft[part]);
    const safeValue = Number.isNaN(numericValue)
      ? 0
      : Math.min(Math.max(numericValue, 0), maxValue);
    const formattedValue = formatTimePart(safeValue);

    setActiveTimePart(null);
    setTimeDraft(prevDraft => ({ ...prevDraft, [part]: formattedValue }));
    updateSelectedTime({ [part]: formattedValue });
  };

  const timeInputClass =
    'w-[2ch] bg-transparent p-0 text-center font-medium tabular-nums text-inherit outline-none placeholder:text-current';
  const footerControlClass =
    'rounded-md bg-neutral-100 px-3 py-1.5 text-xs text-neutral-800 transition-colors dark:bg-neutral-800 dark:text-white';

  // 检查日期是否被选中
  const isDateSelected = (date: Date): boolean => {
    if (!selected) return false;

    if (selected instanceof Date) {
      return isSameDay(date, selected);
    }

    if (Array.isArray(selected)) {
      return selected.some(selectedDate => isSameDay(date, selectedDate));
    }

    const { from, to } = selected as { from: Date; to: Date };
    if (from && to) {
      return date >= from && date <= to;
    }

    return false;
  };

  const [showYearPicker, setShowYearPicker] = React.useState(false);
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);

  // 生成年份选项
  // 基于实际当前年份，范围为前10年到后1年，同时确保包含显示月份的年份
  const actualCurrentYear = new Date().getFullYear();
  const displayYear = currentMonth.getFullYear();

  const years = React.useMemo(() => {
    // 基础范围：实际当前年份前10年到后1年
    let startYear = actualCurrentYear - 10;
    let endYear = actualCurrentYear + 1;

    // 如果显示的年份超出基础范围，则扩展范围
    if (displayYear < startYear) {
      startYear = displayYear;
    }
    if (displayYear > endYear) {
      endYear = displayYear;
    }

    return Array.from(
      { length: endYear - startYear + 1 },
      (_, i) => startYear + i
    );
  }, [actualCurrentYear, displayYear]);

  // 生成月份选项
  const monthNames =
    locale === 'zh-CN'
      ? [
          '1月',
          '2月',
          '3月',
          '4月',
          '5月',
          '6月',
          '7月',
          '8月',
          '9月',
          '10月',
          '11月',
          '12月',
        ]
      : [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];

  // 处理年份选择
  const handleYearSelect = (year: number) => {
    const newDate = new Date(currentMonth);
    newDate.setFullYear(year);
    setCurrentMonth(newDate);
    setShowYearPicker(false);
  };

  // 处理月份选择
  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(monthIndex);
    setCurrentMonth(newDate);
    setShowMonthPicker(false);
  };

  return (
    <div className={cn('', className)}>
      {/* 日历头部 - 月份导航 */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={goToPrevMonth}
          className="flex items-center justify-center rounded-md p-2 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
          aria-label="上个月"
          type="button"
        >
          <ChevronLeft className="icon-xs icon-secondary" />
        </button>

        <div className="flex items-center gap-1">
          {/* 年份选择器 */}
          <Popover.Root open={showYearPicker} onOpenChange={setShowYearPicker}>
            <Popover.Trigger asChild>
              <button
                className="flex items-center gap-1 rounded px-2 py-1 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-100 dark:text-white dark:hover:bg-neutral-800"
                type="button"
              >
                {currentMonth.getFullYear()}
                <ChevronDown className="h-3 w-3" />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className={cn(
                  'z-50 rounded-md border border-neutral-200/50 bg-white shadow-lg dark:border-neutral-800/50 dark:bg-neutral-900',
                  'max-h-64 overflow-y-auto',
                  'data-[state=open]:animate-in data-[state=closed]:animate-out',
                  'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
                )}
                sideOffset={4}
              >
                <div className="grid min-w-[200px] grid-cols-3 gap-1 p-2">
                  {years.map(year => (
                    <button
                      key={year}
                      onClick={() => handleYearSelect(year)}
                      className={cn(
                        'rounded px-3 py-2 text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800',
                        year === displayYear
                          ? 'bg-neutral-800 font-medium text-white dark:bg-white dark:text-neutral-900'
                          : 'text-neutral-800 dark:text-white'
                      )}
                      type="button"
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          <span className="text-sm font-medium text-neutral-800 dark:text-white">
            /
          </span>

          {/* 月份选择器 */}
          <Popover.Root
            open={showMonthPicker}
            onOpenChange={setShowMonthPicker}
          >
            <Popover.Trigger asChild>
              <button
                className="flex items-center gap-1 rounded px-2 py-1 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-100 dark:text-white dark:hover:bg-neutral-800"
                type="button"
              >
                {(currentMonth.getMonth() + 1).toString().padStart(2, '0')}
                <ChevronDown className="h-3 w-3" />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className={cn(
                  'z-50 rounded-md border border-neutral-200/50 bg-white shadow-lg dark:border-neutral-800/50 dark:bg-neutral-900',
                  'data-[state=open]:animate-in data-[state=closed]:animate-out',
                  'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
                )}
                sideOffset={4}
              >
                <div className="grid min-w-[200px] grid-cols-3 gap-1 p-2">
                  {monthNames.map((monthName, index) => (
                    <button
                      key={index}
                      onClick={() => handleMonthSelect(index)}
                      className={cn(
                        'rounded px-3 py-2 text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800',
                        index === currentMonth.getMonth()
                          ? 'bg-neutral-800 font-medium text-white dark:bg-white dark:text-neutral-900'
                          : 'text-neutral-800 dark:text-white'
                      )}
                      type="button"
                    >
                      {monthName}
                    </button>
                  ))}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>

        <button
          onClick={goToNextMonth}
          className="flex items-center justify-center rounded-md p-2 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
          aria-label="下个月"
          type="button"
        >
          <ChevronRight className="icon-xs icon-secondary" />
        </button>
      </div>

      {/* 星期几 */}
      <div className="mb-2 grid grid-cols-7">
        {daysOfWeek.map((day, index) => (
          <div
            key={index}
            className="text-center text-xs text-neutral-500 dark:text-neutral-400"
          >
            {day}
          </div>
        ))}
      </div>

      {/* 日期网格 */}
      <div className="grid grid-cols-7 gap-1">
        {daysInCalendar.map((date, index) => {
          const isCurrentMonth =
            date.getMonth() === currentMonth.getMonth() &&
            date.getFullYear() === currentMonth.getFullYear();
          const isSelectedDate = isDateSelected(date);
          const isTodayDate = isToday(date);

          return (
            <div key={index} className="flex items-center justify-center">
              <button
                onClick={() => handleDateSelect(date)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors',
                  isCurrentMonth
                    ? 'text-neutral-800 dark:text-white'
                    : 'text-neutral-400 dark:text-neutral-600',
                  isTodayDate &&
                    'border border-neutral-200/50 dark:border-neutral-700',
                  isSelectedDate
                    ? 'bg-neutral-800 text-white dark:bg-white dark:text-neutral-900'
                    : 'hover:bg-neutral-100/60 dark:hover:bg-neutral-800/30'
                )}
                tabIndex={initialFocus ? 0 : -1}
                type="button"
              >
                {date.getDate()}
              </button>
            </div>
          );
        })}
      </div>

      {/* 底部操作区 */}
      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={selectToday}
          className={cn(
            footerControlClass,
            'hover:bg-neutral-200 dark:hover:bg-neutral-700'
          )}
          type="button"
        >
          今天
        </button>
        {showTimeInput && (
          <div
            className={cn(
              footerControlClass,
              'flex items-center gap-0.5 font-medium tabular-nums'
            )}
            aria-label="选择时间"
          >
            <input
              aria-label="小时"
              className={timeInputClass}
              inputMode="numeric"
              maxLength={2}
              onBlur={() => handleTimeBlur('hours')}
              onChange={handleTimeChange('hours')}
              onFocus={event => {
                setActiveTimePart('hours');
                event.currentTarget.select();
              }}
              pattern="[0-9]*"
              type="text"
              value={timeDraft.hours}
            />
            <span aria-hidden="true">:</span>
            <input
              aria-label="分钟"
              className={timeInputClass}
              inputMode="numeric"
              maxLength={2}
              onBlur={() => handleTimeBlur('minutes')}
              onChange={handleTimeChange('minutes')}
              onFocus={event => {
                setActiveTimePart('minutes');
                event.currentTarget.select();
              }}
              pattern="[0-9]*"
              type="text"
              value={timeDraft.minutes}
            />
          </div>
        )}
      </div>
    </div>
  );
}
