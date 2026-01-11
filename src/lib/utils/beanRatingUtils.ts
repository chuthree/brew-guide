/**
 * 咖啡豆评分工具函数
 *
 * 用于计算咖啡豆的综合评分（基于关联笔记的评分）
 */

import { CoffeeBean, BrewingNoteData } from '@/types/app';
import { BrewingNote } from '@/lib/core/config';

// 支持两种笔记类型的联合类型
type NoteWithTaste = BrewingNoteData | BrewingNote;

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

/**
 * 计算咖啡豆所有笔记的平均风味评分
 * @param beanId 咖啡豆ID
 * @param notes 所有笔记数据
 * @returns 各维度的平均评分，如果没有笔记则返回 undefined
 */
export function calculateBeanAverageTasteRatings(
  beanId: string,
  notes: NoteWithTaste[]
): { ratings: Record<string, number>; noteCount: number } | undefined {
  // 筛选该咖啡豆有风味评分的笔记（至少有一个维度 > 0）
  const beanNotes = notes.filter(
    note =>
      note.beanId === beanId &&
      note.taste &&
      Object.values(note.taste).some(v => v > 0)
  );

  if (beanNotes.length === 0) {
    return undefined;
  }

  // 收集所有维度的评分（包括 0）
  const dimensionSums: Record<string, { sum: number; count: number }> = {};

  for (const note of beanNotes) {
    for (const [dimId, value] of Object.entries(note.taste)) {
      if (!dimensionSums[dimId]) {
        dimensionSums[dimId] = { sum: 0, count: 0 };
      }
      dimensionSums[dimId].sum += value;
      dimensionSums[dimId].count += 1;
    }
  }

  // 计算各维度平均分
  const averageRatings: Record<string, number> = {};
  for (const [dimId, data] of Object.entries(dimensionSums)) {
    averageRatings[dimId] = Math.round((data.sum / data.count) * 10) / 10;
  }

  return {
    ratings: averageRatings,
    noteCount: beanNotes.length,
  };
}
