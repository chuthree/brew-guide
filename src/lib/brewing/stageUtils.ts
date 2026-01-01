/**
 * Stage Utility Functions
 *
 * 提供冲煮步骤的计算工具函数，用于计时器显示和数据处理
 *
 * Requirements: 7.1, 7.2
 */

import type { Stage } from '../core/config';
import { parseWater } from './stageMigration';

/**
 * 计算累计时间（用于显示）
 *
 * 从第一个阶段到指定索引（包含）的所有阶段 duration 之和
 *
 * @param stages 阶段数组
 * @param upToIndex 计算到的索引（包含该索引）
 * @returns 累计时间（秒）
 */
export function calculateCumulativeTime(
  stages: Stage[],
  upToIndex: number
): number {
  if (!Array.isArray(stages) || stages.length === 0) {
    return 0;
  }

  const endIndex = Math.min(upToIndex, stages.length - 1);
  let cumulativeTime = 0;

  for (let i = 0; i <= endIndex; i++) {
    const stage = stages[i];
    // duration 可能不存在（bypass/beverage 类型），默认为 0
    cumulativeTime += stage.duration || 0;
  }

  return cumulativeTime;
}

/**
 * 计算累计水量（用于显示）
 *
 * 从第一个阶段到指定索引（包含）的所有阶段 water 之和
 * 等待阶段（pourType === 'wait'）不计入水量
 *
 * @param stages 阶段数组
 * @param upToIndex 计算到的索引（包含该索引）
 * @returns 累计水量（克）
 */
export function calculateCumulativeWater(
  stages: Stage[],
  upToIndex: number
): number {
  if (!Array.isArray(stages) || stages.length === 0) {
    return 0;
  }

  const endIndex = Math.min(upToIndex, stages.length - 1);
  let cumulativeWater = 0;

  for (let i = 0; i <= endIndex; i++) {
    const stage = stages[i];
    // 等待阶段不计入水量
    if (stage.pourType === 'wait') {
      continue;
    }
    cumulativeWater += parseWater(stage.water);
  }

  return cumulativeWater;
}

/**
 * 计算总时长
 *
 * 所有阶段 duration 之和
 *
 * @param stages 阶段数组
 * @returns 总时长（秒）
 */
export function calculateTotalDuration(stages: Stage[]): number {
  if (!Array.isArray(stages) || stages.length === 0) {
    return 0;
  }

  return stages.reduce((total, stage) => total + (stage.duration || 0), 0);
}

/**
 * 计算总水量
 *
 * 所有非等待阶段的 water 之和
 *
 * @param stages 阶段数组
 * @returns 总水量（克）
 */
export function calculateTotalWater(stages: Stage[]): number {
  if (!Array.isArray(stages) || stages.length === 0) {
    return 0;
  }

  return stages.reduce((total, stage) => {
    // 等待阶段不计入水量
    if (stage.pourType === 'wait') {
      return total;
    }
    return total + parseWater(stage.water);
  }, 0);
}

/**
 * 获取阶段开始时间
 *
 * 计算指定阶段的开始时间（前面所有阶段的 duration 之和）
 *
 * @param stages 阶段数组
 * @param index 阶段索引
 * @returns 开始时间（秒）
 */
export function getStageStartTime(stages: Stage[], index: number): number {
  if (!Array.isArray(stages) || stages.length === 0 || index < 0) {
    return 0;
  }

  if (index === 0) {
    return 0;
  }

  // 开始时间 = 前面所有阶段的累计时间
  return calculateCumulativeTime(stages, index - 1);
}

/**
 * 获取阶段结束时间
 *
 * 计算指定阶段的结束时间（包含该阶段的累计时间）
 *
 * @param stages 阶段数组
 * @param index 阶段索引
 * @returns 结束时间（秒）
 */
export function getStageEndTime(stages: Stage[], index: number): number {
  if (!Array.isArray(stages) || stages.length === 0 || index < 0) {
    return 0;
  }

  return calculateCumulativeTime(stages, index);
}

/**
 * 根据当前时间获取当前阶段索引
 *
 * @param stages 阶段数组
 * @param currentTime 当前时间（秒）
 * @returns 当前阶段索引，如果超出所有阶段则返回最后一个阶段的索引
 */
export function getCurrentStageIndex(
  stages: Stage[],
  currentTime: number
): number {
  if (!Array.isArray(stages) || stages.length === 0) {
    return 0;
  }

  let accumulatedTime = 0;

  for (let i = 0; i < stages.length; i++) {
    const stageDuration = stages[i].duration || 0;
    accumulatedTime += stageDuration;

    if (currentTime < accumulatedTime) {
      return i;
    }
  }

  // 如果超出所有阶段，返回最后一个阶段的索引
  return stages.length - 1;
}

/**
 * 获取阶段内的相对时间
 *
 * @param stages 阶段数组
 * @param index 阶段索引
 * @param currentTime 当前总时间（秒）
 * @returns 阶段内的相对时间（秒）
 */
export function getTimeWithinStage(
  stages: Stage[],
  index: number,
  currentTime: number
): number {
  const startTime = getStageStartTime(stages, index);
  const endTime = getStageEndTime(stages, index);

  // 确保时间在阶段范围内
  const clampedTime = Math.max(startTime, Math.min(currentTime, endTime));

  return clampedTime - startTime;
}

/**
 * 获取阶段进度百分比
 *
 * @param stages 阶段数组
 * @param index 阶段索引
 * @param currentTime 当前总时间（秒）
 * @returns 进度百分比 (0-1)
 */
export function getStageProgress(
  stages: Stage[],
  index: number,
  currentTime: number
): number {
  if (
    !Array.isArray(stages) ||
    stages.length === 0 ||
    index < 0 ||
    index >= stages.length
  ) {
    return 0;
  }

  const stage = stages[index];
  const duration = stage.duration || 0;

  if (duration === 0) {
    return 1; // bypass/beverage 类型没有 duration，视为完成
  }

  const timeWithin = getTimeWithinStage(stages, index, currentTime);
  return Math.min(1, timeWithin / duration);
}
