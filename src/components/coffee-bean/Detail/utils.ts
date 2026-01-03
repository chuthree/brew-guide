'use client';

import { CoffeeBean } from '@/types/app';
import { parseDateToTimestamp } from '@/lib/utils/dateUtils';
import { calculateFlavorInfo } from '@/lib/utils/flavorPeriodUtils';

// 工具函数：格式化数字显示
export const formatNumber = (value: string | undefined): string =>
  !value
    ? '0'
    : Number.isInteger(parseFloat(value))
      ? Math.floor(parseFloat(value)).toString()
      : value;

// 工具函数：格式化日期显示
export const formatDateString = (dateStr: string): string => {
  try {
    const timestamp = parseDateToTimestamp(dateStr);
    const date = new Date(timestamp);
    const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;

    // 计算已过天数
    const today = new Date();
    const todayDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const roastDateOnly = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
    const daysSinceRoast = Math.ceil(
      (todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24)
    );

    // 如果是今天或未来日期，不显示天数
    if (daysSinceRoast <= 0) {
      return formattedDate;
    }

    return `${formattedDate} (已养豆 ${daysSinceRoast} 天)`;
  } catch {
    return dateStr;
  }
};

// 工具函数：计算赏味期信息
export const getFlavorInfo = (bean: CoffeeBean | null) => {
  if (!bean) return { phase: '未知', status: '未知状态' };

  const flavorInfo = calculateFlavorInfo(bean);
  return {
    phase: flavorInfo.phase,
    status: flavorInfo.status || '未知状态',
  };
};

// 解析日期字符串为Date对象
export const parseDateString = (
  dateStr: string | undefined
): Date | undefined => {
  if (!dateStr) return undefined;
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return undefined;
};

// 计算输入框宽度的函数
export const calcInputWidth = (text: string, fallback: string): string => {
  const displayText = text || fallback;
  // 每个中文字符约 2ch，英文约 1ch，额外加 1ch 余量
  let len = 0;
  for (let i = 0; i < displayText.length; i++) {
    len += displayText.charCodeAt(i) > 127 ? 2 : 1;
  }
  return `${len + 1}ch`;
};
