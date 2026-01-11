/**
 * 咖啡豆评分工具函数
 *
 * 用于计算咖啡豆的综合评分（基于关联笔记的评分）
 */

import { CoffeeBean, BrewingNoteData } from '@/types/app';

export interface BeanRatingInfo {
  // 最终使用的评分值（手动优先，否则用自动计算）
  rating: number;
  // 是否为自动计算的评分
  isAutoCalculated: boolean;
  // 手动评分（用户在榜单中设置的）
  manualRating?: number;
  // 自动计算的评分（基于笔记）
  autoRating?: number;
  // 参与计算的笔记数量
  noteCount: number;
}

/**
 * 计算咖啡豆基于笔记的平均评分
 * @param beanId 咖啡豆ID
 * @param notes 所有笔记数据
 * @returns 平均评分，如果没有有效评分则返回 undefined
 */
export function calculateBeanAutoRating(
  beanId: string,
  notes: BrewingNoteData[]
): { rating: number; noteCount: number } | undefined {
  // 筛选该咖啡豆的有效评分笔记
  const beanNotes = notes.filter(
    note => note.beanId === beanId && note.rating > 0
  );

  if (beanNotes.length === 0) {
    return undefined;
  }

  // 计算平均分
  const totalRating = beanNotes.reduce((sum, note) => sum + note.rating, 0);
  const avgRating = totalRating / beanNotes.length;

  // 保留一位小数
  return {
    rating: Math.round(avgRating * 10) / 10,
    noteCount: beanNotes.length,
  };
}

/**
 * 获取咖啡豆的完整评分信息
 * @param bean 咖啡豆
 * @param notes 所有笔记数据
 * @returns 评分信息
 */
export function getBeanRatingInfo(
  bean: CoffeeBean,
  notes: BrewingNoteData[]
): BeanRatingInfo {
  const manualRating =
    bean.overallRating && bean.overallRating > 0
      ? bean.overallRating
      : undefined;
  const autoResult = calculateBeanAutoRating(bean.id, notes);

  // 手动评分优先
  if (manualRating !== undefined) {
    return {
      rating: manualRating,
      isAutoCalculated: false,
      manualRating,
      autoRating: autoResult?.rating,
      noteCount: autoResult?.noteCount ?? 0,
    };
  }

  // 使用自动计算的评分
  if (autoResult) {
    return {
      rating: autoResult.rating,
      isAutoCalculated: true,
      autoRating: autoResult.rating,
      noteCount: autoResult.noteCount,
    };
  }

  // 没有任何评分
  return {
    rating: 0,
    isAutoCalculated: false,
    noteCount: 0,
  };
}

/**
 * 格式化评分显示
 * @param ratingInfo 评分信息
 * @returns 格式化的评分字符串，如 "+4.5" 或 "≈+3.5"
 */
export function formatBeanRating(ratingInfo: BeanRatingInfo): string {
  if (ratingInfo.rating === 0) {
    return '';
  }

  const prefix = ratingInfo.isAutoCalculated ? '≈+' : '+';
  return `${prefix}${ratingInfo.rating}`;
}

/**
 * 判断咖啡豆是否有评分（手动或自动）
 */
export function hasBeanRating(
  bean: CoffeeBean,
  notes: BrewingNoteData[]
): boolean {
  // 有手动评分
  if (bean.overallRating && bean.overallRating > 0) {
    return true;
  }
  // 有自动计算的评分
  const autoResult = calculateBeanAutoRating(bean.id, notes);
  return autoResult !== undefined;
}
