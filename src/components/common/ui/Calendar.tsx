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

export function Calendar({
  selected,
  onSelect,
  locale = 'zh-CN',
  className,
  initialFocus = false,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    // 如果有选中的日期，则显示该日期所在的月份
    if (selected instanceof Date) {
      return selected;
    }
    return new Date();
  });

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
    const today = new Date();
    if (onSelect) {
      onSelect(today);
    }
    setCurrentMonth(today);
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
    if (onSelect) {
      onSelect(date);
    }
  };

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

  // 生成年份选项（当前年份往前10年，共11年）
  const currentYear = currentMonth.getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 10 + i);

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
    <div className={cn('p-3', className)}>
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
                        year === currentYear
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
          const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
          const isSelectedDate = isDateSelected(date);
          const isTodayDate = isToday(date);

          return (
            <button
              key={index}
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
                  : isCurrentMonth &&
                      'hover:bg-neutral-100/60 dark:hover:bg-neutral-800/30',
                !isCurrentMonth && 'pointer-events-none opacity-50'
              )}
              disabled={!isCurrentMonth}
              tabIndex={isCurrentMonth && initialFocus ? 0 : -1}
              type="button"
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {/* 底部操作区 - 今天按钮 */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={selectToday}
          className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700"
          type="button"
        >
          今天
        </button>
      </div>
    </div>
  );
}
