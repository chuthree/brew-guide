'use client';

import React from 'react';
import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';
import TabButton from '@/components/common/ui/TabButton';
import {
  ListFilterBar,
  ListHeaderSummary,
} from '@/components/common/ui/ListFilterBar';
import {
  FilterButton,
  FilterPanel,
  FilterPanelTrigger,
} from '@/components/common/ui/FilterPanel';
import { useFilterPanel } from '@/lib/hooks/useFilterPanel';
import { DATE_GROUPING_MODES, type DateGroupingMode } from './types';
import { DATE_GROUPING_LABELS, formatWeekLabel } from '@/lib/utils/dateUtils';
import {
  useNavigationSwipe,
  type NavigationSwipeControl,
} from '@/lib/navigation/navigationSwipe';

export const getNextDateGroupingMode = (
  currentMode: DateGroupingMode
): DateGroupingMode => {
  const currentIndex = DATE_GROUPING_MODES.indexOf(currentMode);
  const nextIndex = (currentIndex + 1) % DATE_GROUPING_MODES.length;
  return DATE_GROUPING_MODES[nextIndex];
};

// 日期格式化函数
const formatDateLabel = (
  dateStr: string,
  groupingMode: DateGroupingMode,
  now: Date
): string => {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

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
  } else if (groupingMode === 'week') {
    return formatWeekLabel(dateStr, now);
  } else {
    const [year, month, day] = dateStr.split('-');
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);

    // 计算日期差
    const targetDate = new Date(yearNum, monthNum - 1, dayNum);
    const diffDays = differenceInCalendarDays(now, targetDate);

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

// 筛选按钮组件
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
  navigationToggleControl?: React.ReactNode;
  navigationSwipeControl?: NavigationSwipeControl;
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
  navigationToggleControl,
  navigationSwipeControl,
}) => {
  const {
    isOpen: isFilterExpanded,
    handleTriggerClick,
    interactionProps,
    panelProps,
  } = useFilterPanel();
  const navigationSwipeHandlers = useNavigationSwipe(navigationSwipeControl);
  const now = new Date();

  return (
    <div
      className={`relative ${
        navigationSwipeControl?.isCollapsed ? 'pt-0' : 'pt-6'
      } md:pt-0`}
      {...navigationSwipeHandlers}
      {...interactionProps}
    >
      {/* 时间范围文案 - 可点击切换时间分组和豆子类型 */}
      <ListHeaderSummary navigation={navigationToggleControl}>
        <div className="text-left leading-none">
          <button
            type="button"
            onClick={() =>
              onDateGroupingModeChange(
                getNextDateGroupingMode(dateGroupingMode)
              )
            }
            className="text-xs leading-none font-medium tracking-wide text-neutral-800 underline decoration-neutral-300 underline-offset-2 dark:text-neutral-100 dark:decoration-neutral-600"
          >
            {DATE_GROUPING_LABELS[dateGroupingMode]}统计
          </button>
          {showBeanStateSwitch && onBeanStateTypeChange && (
            <>
              <span className="text-xs leading-none font-medium tracking-wide text-neutral-800 dark:text-neutral-100">
                ，
              </span>
              <button
                type="button"
                onClick={() =>
                  onBeanStateTypeChange(
                    beanStateType === 'roasted' ? 'green' : 'roasted'
                  )
                }
                className="text-xs leading-none font-medium tracking-wide text-neutral-800 underline decoration-neutral-300 underline-offset-2 dark:text-neutral-100 dark:decoration-neutral-600"
              >
                {beanStateType === 'roasted' ? '咖啡豆' : '生豆'}
              </button>
            </>
          )}
          {dateRangeLabel && (
            <span className="text-xs leading-none font-medium tracking-wide text-neutral-800 dark:text-neutral-100">
              {showBeanStateSwitch && onBeanStateTypeChange ? '' : '，'}
              数据周期 {dateRangeLabel}
            </span>
          )}
        </div>
      </ListHeaderSummary>

      {/* 整个分类栏容器 */}
      <ListFilterBar
        leading={
          <>
            <TabButton
              isActive={selectedDate === null}
              onClick={() => onDateClick(null)}
              className="mr-1"
              dataTab="all"
            >
              全部
            </TabButton>

            {/* 筛选图标按钮 */}
            <FilterPanelTrigger
              panelId={panelProps.id}
              isOpen={isFilterExpanded}
              onClick={handleTriggerClick}
            />
          </>
        }
        tabs={availableDates.map(date => (
          <TabButton
            key={date}
            isActive={selectedDate === date}
            onClick={() => onDateClick(date)}
            className="mr-3"
            dataTab={date}
          >
            {formatDateLabel(date, dateGroupingMode, now)}
          </TabButton>
        ))}
      >
        <FilterPanel {...panelProps}>
          {/* 统计类型（生豆/熟豆） */}
          {showBeanStateSwitch && onBeanStateTypeChange && (
            <div>
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
          <div>
            <div className="mb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
              时间分组
            </div>
            <div
              role="group"
              aria-label="时间分组"
              className="flex flex-wrap items-center gap-2"
            >
              {DATE_GROUPING_MODES.map(mode => (
                <FilterButton
                  key={mode}
                  isActive={dateGroupingMode === mode}
                  onClick={() => onDateGroupingModeChange(mode)}
                >
                  {DATE_GROUPING_LABELS[mode]}
                </FilterButton>
              ))}
            </div>
          </div>
        </FilterPanel>
      </ListFilterBar>
    </div>
  );
};

export default StatsFilterBar;
