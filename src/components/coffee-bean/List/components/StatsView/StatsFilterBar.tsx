'use client';

import React, { useState, useRef, useEffect } from 'react';
import { AlignLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { DateGroupingMode } from './types';
import YearlyReviewDrawer from './YearlyReviewDrawer';

export const DATE_GROUPING_LABELS: Record<DateGroupingMode, string> = {
  year: '按年统计',
  month: '按月统计',
  day: '按日统计',
};

// 短标签用于筛选按钮
const DATE_GROUPING_SHORT_LABELS: Record<DateGroupingMode, string> = {
  year: '按年',
  month: '按月',
  day: '按日',
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

// 时间分组模式循环顺序
const DATE_GROUPING_ORDER: DateGroupingMode[] = ['month', 'day', 'year'];

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

// 下划线动画配置 - 使用 spring 动画实现丝滑效果
const UNDERLINE_TRANSITION = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 35,
  mass: 1,
};

// 可复用的标签按钮组件
interface TabButtonProps {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  dataTab?: string;
  layoutId?: string;
}

const TabButton: React.FC<TabButtonProps> = ({
  isActive,
  onClick,
  children,
  className = '',
  dataTab,
  layoutId = 'stats-tab-underline',
}) => (
  <button
    onClick={onClick}
    className={`relative pb-1.5 text-xs font-medium whitespace-nowrap ${
      isActive
        ? 'text-neutral-800 dark:text-neutral-100'
        : 'text-neutral-600 dark:text-neutral-400'
    } ${className}`}
    data-tab={dataTab}
  >
    <span className="relative">{children}</span>
    {isActive && (
      <motion.span
        layoutId={layoutId}
        className="absolute inset-x-0 bottom-0 h-px bg-neutral-800 dark:bg-white"
        transition={UNDERLINE_TRANSITION}
      />
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
      disabled
        ? 'cursor-not-allowed bg-neutral-200/30 text-neutral-400 opacity-30 dark:bg-neutral-800/50 dark:text-neutral-400'
        : isActive
          ? 'bg-neutral-300/30 text-neutral-800 dark:bg-neutral-600/50 dark:text-neutral-200'
          : 'bg-neutral-200/30 text-neutral-400 dark:bg-neutral-800/50 dark:text-neutral-400'
    } ${className}`}
  >
    {children}
  </button>
);

// 获取可用的时间分组模式（如果只有一年数据，则排除按年统计）
const getAvailableGroupingModes = (
  availableDates: string[],
  currentMode: DateGroupingMode
): DateGroupingMode[] => {
  // 从 availableDates 提取所有唯一年份
  const years = new Set<string>();
  for (const date of availableDates) {
    // 支持 year: "2024", month: "2024-01", day: "2024-01-01" 格式
    const yearPart = date.substring(0, 4);
    if (/^\d{4}$/.test(yearPart)) {
      years.add(yearPart);
    }
  }

  // 如果只有一年数据，则不提供按年统计模式
  if (years.size <= 1) {
    return DATE_GROUPING_ORDER.filter(mode => mode !== 'year');
  }

  return DATE_GROUPING_ORDER;
};

// 检查是否只有一年数据（用于禁用按年按钮）
const hasOnlyOneYear = (availableDates: string[]): boolean => {
  const years = new Set<string>();
  for (const date of availableDates) {
    const yearPart = date.substring(0, 4);
    if (/^\d{4}$/.test(yearPart)) {
      years.add(yearPart);
    }
  }
  return years.size <= 1;
};

interface StatsFilterBarProps {
  dateGroupingMode: DateGroupingMode;
  onDateGroupingModeChange: (mode: DateGroupingMode) => void;
  selectedDate: string | null;
  onDateClick: (date: string | null) => void;
  availableDates: string[];
  dateRangeLabel?: string;
  // 生豆/熟豆切换相关
  beanStateType?: 'roasted' | 'green';
  onBeanStateTypeChange?: (type: 'roasted' | 'green') => void;
  showBeanStateSwitch?: boolean; // 是否显示切换（当同时有生豆和熟豆时）
}

const StatsFilterBar: React.FC<StatsFilterBarProps> = ({
  dateGroupingMode,
  onDateGroupingModeChange,
  selectedDate,
  onDateClick,
  availableDates,
  dateRangeLabel,
  beanStateType = 'roasted',
  onBeanStateTypeChange,
  showBeanStateSwitch = false,
}) => {
  // 筛选展开栏状态
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const filterExpandRef = useRef<HTMLDivElement>(null);

  // 年度回顾抽屉状态
  const [isYearlyReviewOpen, setIsYearlyReviewOpen] = useState(false);

  // 监听外部打开年度回顾的事件
  useEffect(() => {
    const handleOpenYearlyReview = () => {
      setIsYearlyReviewOpen(true);
    };

    window.addEventListener('openYearlyReview', handleOpenYearlyReview);
    return () => {
      window.removeEventListener('openYearlyReview', handleOpenYearlyReview);
    };
  }, []);

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
    <div className="relative pt-6 md:pt-0" ref={filterExpandRef}>
      {/* 时间范围文案 - 可点击切换时间分组 */}
      {dateRangeLabel && (
        <div className="mb-6 flex items-center justify-between px-6">
          <button
            onClick={() => {
              const availableModes = getAvailableGroupingModes(
                availableDates,
                dateGroupingMode
              );
              const currentIndex = availableModes.indexOf(dateGroupingMode);
              const nextIndex = (currentIndex + 1) % availableModes.length;
              onDateGroupingModeChange(availableModes[nextIndex]);
            }}
            className="text-left leading-none"
          >
            <span className="text-xs leading-none font-medium tracking-wide text-neutral-800 underline decoration-neutral-300 underline-offset-2 dark:text-neutral-100 dark:decoration-neutral-600">
              {DATE_GROUPING_LABELS[dateGroupingMode]}
            </span>
            <span className="text-xs leading-none font-medium tracking-wide text-neutral-800 dark:text-neutral-100">
              ，数据周期 {dateRangeLabel}
            </span>
          </button>
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
                  {/* 统计类型（生豆/熟豆） */}
                  {showBeanStateSwitch && onBeanStateTypeChange && (
                    <div className="mb-4">
                      <div className="mb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        统计类型
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <FilterButton
                          isActive={beanStateType === 'roasted'}
                          onClick={() => onBeanStateTypeChange('roasted')}
                        >
                          熟豆
                        </FilterButton>
                        <FilterButton
                          isActive={beanStateType === 'green'}
                          onClick={() => onBeanStateTypeChange('green')}
                        >
                          生豆
                        </FilterButton>
                      </div>
                    </div>
                  )}

                  {/* 时间分组 */}
                  <div className="mb-4">
                    <div className="mb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      时间分组
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <FilterButton
                        isActive={dateGroupingMode === 'year'}
                        onClick={() => onDateGroupingModeChange('year')}
                        disabled={hasOnlyOneYear(availableDates)}
                      >
                        {DATE_GROUPING_SHORT_LABELS.year}
                      </FilterButton>
                      <FilterButton
                        isActive={dateGroupingMode === 'month'}
                        onClick={() => onDateGroupingModeChange('month')}
                      >
                        {DATE_GROUPING_SHORT_LABELS.month}
                      </FilterButton>
                      <FilterButton
                        isActive={dateGroupingMode === 'day'}
                        onClick={() => onDateGroupingModeChange('day')}
                      >
                        {DATE_GROUPING_SHORT_LABELS.day}
                      </FilterButton>
                    </div>
                  </div>

                  {/* 更多功能 */}
                  <div>
                    <div className="mb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      更多
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <FilterButton
                        isActive={false}
                        onClick={() => setIsYearlyReviewOpen(true)}
                      >
                        年度回顾
                      </FilterButton>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* 年度回顾抽屉 */}
      <YearlyReviewDrawer
        isOpen={isYearlyReviewOpen}
        onClose={() => setIsYearlyReviewOpen(false)}
      />
    </div>
  );
};

export default StatsFilterBar;
