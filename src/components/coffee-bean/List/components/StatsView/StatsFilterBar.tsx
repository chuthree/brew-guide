'use client';

import React, { useState, useRef, useEffect } from 'react';
import { AlignLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { DateGroupingMode, CalculationMode } from './types';

export const DATE_GROUPING_LABELS: Record<DateGroupingMode, string> = {
  year: '按年',
  month: '按月',
  day: '按日',
};

export const CALCULATION_MODE_LABELS: Record<CalculationMode, string> = {
  natural: '按照自然日',
  coffee: '按照咖啡日',
};

// Apple风格动画配置
const FILTER_ANIMATION = {
  initial: {
    height: 0,
    opacity: 0,
    y: -10,
  },
  animate: {
    height: 'auto',
    opacity: 1,
    y: 0,
  },
  exit: {
    height: 0,
    opacity: 0,
    y: -10,
  },
  transition: {
    duration: 0.35,
    opacity: {
      duration: 0.25,
    },
  },
};

// 日期格式化函数
const formatDateLabel = (
  dateStr: string,
  groupingMode: DateGroupingMode
): string => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  if (groupingMode === 'year') {
    const year = parseInt(dateStr, 10);
    if (year === currentYear) {
      return '今年';
    }
    return `${year}年`;
  } else if (groupingMode === 'month') {
    const [year, month] = dateStr.split('-');
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);

    if (yearNum === currentYear) {
      if (monthNum === currentMonth) {
        return '本月';
      }
      return `${monthNum}月`;
    }
    return `${year}年${monthNum}月`;
  } else {
    const [year, month, day] = dateStr.split('-');
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);

    // 计算日期差
    const targetDate = new Date(yearNum, monthNum - 1, dayNum);
    const todayDate = new Date(currentYear, currentMonth - 1, currentDay);
    const diffTime = todayDate.getTime() - targetDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays === 2) return '前天';

    if (yearNum === currentYear) {
      return `${monthNum}/${dayNum}`;
    } else {
      return `${year}/${monthNum}/${dayNum}`;
    }
  }
};

// 可复用的标签按钮组件
interface TabButtonProps {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  dataTab?: string;
}

const TabButton: React.FC<TabButtonProps> = ({
  isActive,
  onClick,
  children,
  className = '',
  dataTab,
}) => (
  <button
    onClick={onClick}
    className={`relative pb-1.5 text-xs font-medium whitespace-nowrap ${
      isActive
        ? 'text-neutral-800 dark:text-neutral-100'
        : 'text-neutral-600 hover:opacity-80 dark:text-neutral-400'
    } ${className}`}
    data-tab={dataTab}
  >
    <span className="relative">{children}</span>
    {isActive && (
      <span className="absolute bottom-0 left-0 h-px w-full bg-neutral-800 dark:bg-white"></span>
    )}
  </button>
);

// 筛选按钮组件
interface FilterButtonProps {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

const FilterButton: React.FC<FilterButtonProps> = ({
  isActive,
  onClick,
  children,
  className = '',
  disabled = false,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
      isActive
        ? 'bg-neutral-300/30 text-neutral-800 dark:bg-neutral-600/50 dark:text-neutral-200'
        : 'bg-neutral-200/30 text-neutral-400 dark:bg-neutral-800/50 dark:text-neutral-400'
    } ${disabled ? 'cursor-not-allowed opacity-40' : ''} ${className}`}
  >
    {children}
  </button>
);

interface StatsFilterBarProps {
  dateGroupingMode: DateGroupingMode;
  onDateGroupingModeChange: (mode: DateGroupingMode) => void;
  selectedDate: string | null;
  onDateClick: (date: string | null) => void;
  availableDates: string[];
  calculationMode: CalculationMode;
  onCalculationModeChange: (mode: CalculationMode) => void;
  dateRangeLabel?: string;
}

const StatsFilterBar: React.FC<StatsFilterBarProps> = ({
  dateGroupingMode,
  onDateGroupingModeChange,
  selectedDate,
  onDateClick,
  availableDates,
  calculationMode,
  onCalculationModeChange,
  dateRangeLabel,
}) => {
  // 筛选展开栏状态
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const filterExpandRef = useRef<HTMLDivElement>(null);

  // 滚动容器引用
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);

  // 监听滚动事件以控制阴影显示
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      setShowLeftShadow(scrollContainerRef.current.scrollLeft > 2);
    }
  };

  // 添加滚动事件监听
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      handleScroll();
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);

  // 处理筛选展开栏
  const handleFilterToggle = () => {
    setIsFilterExpanded(!isFilterExpanded);
  };

  // 点击外部关闭筛选展开栏
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterExpandRef.current &&
        !filterExpandRef.current.contains(event.target as Node)
      ) {
        setIsFilterExpanded(false);
      }
    };

    if (isFilterExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterExpanded]);

  return (
    <div className="relative pt-6" ref={filterExpandRef}>
      {/* 时间范围文案 */}
      {dateRangeLabel && (
        <div className="mb-6 flex items-center justify-between px-6">
          <div className="text-xs font-medium tracking-wide break-words text-neutral-800 dark:text-neutral-100">
            {dateRangeLabel}
          </div>
        </div>
      )}

      {/* 整个分类栏容器 */}
      <div className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="relative px-6">
          <div className="relative flex items-center">
            {/* 固定在左侧的"全部"和筛选按钮 */}
            <div className="relative z-10 flex shrink-0 items-center bg-neutral-50 pr-3 dark:bg-neutral-900">
              <TabButton
                isActive={selectedDate === null}
                onClick={() => onDateClick(null)}
                className="mr-1"
                dataTab="all"
              >
                全部
              </TabButton>

              {/* 筛选图标按钮 */}
              <button
                onClick={handleFilterToggle}
                className="mr-1 flex items-center pb-1.5 text-xs font-medium text-neutral-400 dark:text-neutral-600"
              >
                <AlignLeft size={12} color="currentColor" />
              </button>

              {/* 左侧固定按钮的右侧渐变遮罩 */}
              <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-5 bg-linear-to-r from-transparent to-neutral-50 dark:to-neutral-900"></div>
            </div>

            {/* 中间滚动区域 */}
            <div className="relative flex-1 overflow-hidden">
              {/* 左侧渐变阴影 */}
              {showLeftShadow && (
                <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-6 bg-linear-to-r from-neutral-50/95 to-transparent dark:from-neutral-900/95"></div>
              )}

              <div
                ref={scrollContainerRef}
                className="flex overflow-x-auto"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch',
                }}
                onScroll={handleScroll}
              >
                <style jsx>{`
                  div::-webkit-scrollbar {
                    display: none;
                  }
                `}</style>

                {/* 日期选项 */}
                {availableDates.map(date => (
                  <TabButton
                    key={date}
                    isActive={selectedDate === date}
                    onClick={() => onDateClick(date)}
                    className="mr-3"
                    dataTab={date}
                  >
                    {formatDateLabel(date, dateGroupingMode)}
                  </TabButton>
                ))}
              </div>

              {/* 右侧渐变阴影 */}
              <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-6 bg-linear-to-l from-neutral-50/95 to-transparent dark:from-neutral-900/95"></div>
            </div>
          </div>
        </div>

        {/* 展开式筛选栏 */}
        <AnimatePresence>
          {isFilterExpanded && (
            <>
              {/* 固定的半透明分割线 */}
              <div className="border-t border-neutral-200/50 dark:border-neutral-700/50"></div>

              <motion.div
                initial={FILTER_ANIMATION.initial}
                animate={FILTER_ANIMATION.animate}
                exit={FILTER_ANIMATION.exit}
                transition={FILTER_ANIMATION.transition}
                className="overflow-hidden"
                style={{ willChange: 'height, opacity, transform' }}
              >
                <div className="px-6 py-4">
                  <div className="space-y-4">
                    {/* 时间分组 */}
                    <div>
                      <div className="mb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        时间分组
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <FilterButton
                          isActive={dateGroupingMode === 'year'}
                          onClick={() => onDateGroupingModeChange('year')}
                        >
                          {DATE_GROUPING_LABELS.year}
                        </FilterButton>
                        <FilterButton
                          isActive={dateGroupingMode === 'month'}
                          onClick={() => onDateGroupingModeChange('month')}
                        >
                          {DATE_GROUPING_LABELS.month}
                        </FilterButton>
                        <FilterButton
                          isActive={dateGroupingMode === 'day'}
                          onClick={() => onDateGroupingModeChange('day')}
                        >
                          {DATE_GROUPING_LABELS.day}
                        </FilterButton>
                      </div>
                    </div>

                    {/* 计算方式 */}
                    <div>
                      <div className="mb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        计算方式
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <FilterButton
                          isActive={calculationMode === 'natural'}
                          onClick={() => onCalculationModeChange('natural')}
                        >
                          {CALCULATION_MODE_LABELS.natural}
                        </FilterButton>
                        <FilterButton
                          isActive={calculationMode === 'coffee'}
                          onClick={() => onCalculationModeChange('coffee')}
                        >
                          {CALCULATION_MODE_LABELS.coffee}
                        </FilterButton>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default StatsFilterBar;
