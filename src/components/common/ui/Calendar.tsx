"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths, isSameDay, isToday, startOfMonth, eachDayOfInterval, addDays, Locale } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils/classNameUtils";

export interface CalendarProps {
  mode?: "single" | "range" | "multiple";
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
    days.push(format(date, "EEE", { locale }));
  }
  
  return days;
};

export function Calendar({
  selected,
  onSelect,
  locale = "zh-CN",
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
  
  const localeObj = locale === "zh-CN" ? zhCN : enUS;
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
      return selected.some((selectedDate) => isSameDay(date, selectedDate));
    }

    const { from, to } = selected as { from: Date; to: Date };
    if (from && to) {
      return date >= from && date <= to;
    }

    return false;
  };

  return (
    <div className={cn("p-3", className)}>
      {/* 日历头部 - 月份导航 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevMonth}
          className="p-2 hover:opacity-80 flex items-center justify-center"
          aria-label="上个月"
        >
          <ChevronLeft className="icon-xs icon-secondary" />
        </button>
        <h2 className="text-sm font-medium">
          {format(currentMonth, "yyyy/MM", { locale: localeObj })}
        </h2>
        <button
          onClick={goToNextMonth}
          className="p-2 hover:opacity-80 flex items-center justify-center"
          aria-label="下个月"
        >
          <ChevronRight className="icon-xs icon-secondary" />
        </button>
      </div>

      {/* 星期几 */}
      <div className="grid grid-cols-7 mb-2">
        {daysOfWeek.map((day, index) => (
          <div key={index} className="text-center text-xs text-neutral-500 dark:text-neutral-400">
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
                "flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors",
                isCurrentMonth 
                  ? "text-neutral-800 dark:text-white" 
                  : "text-neutral-400 dark:text-neutral-600",
                isTodayDate && "border border-neutral-200 dark:border-neutral-700",
                isSelectedDate 
                  ? "bg-neutral-800 text-white dark:bg-white dark:text-neutral-900" 
                  : isCurrentMonth && "hover:bg-neutral-100/60 dark:hover:bg-neutral-800/30",
                !isCurrentMonth && "pointer-events-none opacity-50"
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
          className="text-xs px-3 py-1.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-white hover:opacity-80 transition-opacity"
          type="button"
        >
          今天
        </button>
      </div>
    </div>
  );
} 