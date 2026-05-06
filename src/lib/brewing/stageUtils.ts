/**
 * Stage Utility Functions
 *
 * 提供冲煮步骤的计算工具函数，用于计时器显示和数据处理
 *
 * Requirements: 7.1, 7.2
 */

import type { Stage } from '../core/config';
import { parseWater } from './stageMigration';

export interface StageCumulativeData {
  cumulativeDuration: number;
  cumulativeWater: number;
}

export interface StageTimelineData {
  originalIndex: number;
  isWait: boolean;
  startTime: number;
  endTime: number | null;
  cumulativeWater: number;
  prevWaitIndex: number | null;
  pourStageNumber: number | null;
  hasDuration: boolean;
  isTimeless: boolean;
}

function isTimedStage(stage: Stage): boolean {
  return stage.pourType !== 'bypass' && stage.pourType !== 'beverage';
}

function isVisibleStage(stage: Stage): boolean {
  return stage.pourType !== 'wait';
}

function isWaterStage(stage: Stage): boolean {
  return stage.pourType !== 'wait';
}

function hasConfiguredDuration(stage: Stage): boolean {
  return isTimedStage(stage) && typeof stage.duration === 'number';
}

function hasConfiguredWater(stage: Stage): boolean {
  return isWaterStage(stage) && stage.water !== undefined && stage.water !== '';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeNonNegativeNumber(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeBoundarySeconds(value: number): number {
  return Math.round(normalizeNonNegativeNumber(value));
}

function findNextIndex(
  stages: Stage[],
  startIndex: number,
  predicate: (stage: Stage) => boolean
): number | null {
  for (let i = startIndex + 1; i < stages.length; i++) {
    if (predicate(stages[i])) {
      return i;
    }
  }
  return null;
}

/**
 * 构建阶段累计数据。
 *
 * 阶段模型内部保存增量值，累计模式和时间模式只应该使用该派生数据展示。
 */
export function buildStageCumulativeData(
  stages: Stage[]
): StageCumulativeData[] {
  if (!Array.isArray(stages) || stages.length === 0) {
    return [];
  }

  let cumulativeDuration = 0;
  let cumulativeWater = 0;

  return stages.map(stage => {
    if (isTimedStage(stage)) {
      cumulativeDuration += stage.duration || 0;
    }
    if (isWaterStage(stage)) {
      cumulativeWater += parseWater(stage.water);
    }

    return {
      cumulativeDuration,
      cumulativeWater,
    };
  });
}

/**
 * 构建绝对时间线数据。
 *
 * 时间模式不保存独立模型：开始时间、结束时间和等待间隔都从阶段增量
 * 派生，提交编辑时再回写为 duration / wait duration。
 */
export function buildStageTimelineData(stages: Stage[]): StageTimelineData[] {
  if (!Array.isArray(stages) || stages.length === 0) {
    return [];
  }

  const result: StageTimelineData[] = [];
  let currentTime = 0;
  let cumulativeWater = 0;
  let lastWaitIndex: number | null = null;
  let pourStageCount = 0;

  stages.forEach((stage, index) => {
    const hasDuration =
      typeof stage.duration === 'number' && stage.duration > 0;
    const isWait = stage.pourType === 'wait';
    const isTimeless = !isTimedStage(stage);

    if (isWait) {
      const startTime = currentTime;
      const duration = stage.duration || 0;
      const endTime = hasDuration ? currentTime + duration : null;

      if (hasDuration) {
        currentTime += duration;
      }

      result.push({
        originalIndex: index,
        isWait: true,
        startTime,
        endTime,
        cumulativeWater,
        prevWaitIndex: null,
        pourStageNumber: null,
        hasDuration,
        isTimeless: false,
      });

      lastWaitIndex = index;
      return;
    }

    pourStageCount++;

    if (isWaterStage(stage)) {
      cumulativeWater += parseWater(stage.water);
    }

    if (isTimeless) {
      result.push({
        originalIndex: index,
        isWait: false,
        startTime: currentTime,
        endTime: null,
        cumulativeWater,
        prevWaitIndex: lastWaitIndex,
        pourStageNumber: pourStageCount,
        hasDuration: false,
        isTimeless: true,
      });

      lastWaitIndex = null;
      return;
    }

    const startTime = currentTime;
    const duration = stage.duration || 0;
    const endTime = hasDuration ? currentTime + duration : null;

    if (hasDuration) {
      currentTime += duration;
    }

    result.push({
      originalIndex: index,
      isWait: false,
      startTime,
      endTime,
      cumulativeWater,
      prevWaitIndex: lastWaitIndex,
      pourStageNumber: pourStageCount,
      hasDuration,
      isTimeless: false,
    });

    lastWaitIndex = null;
  });

  return result;
}

function findTimelineEntry(
  timeline: StageTimelineData[],
  originalIndex: number
): StageTimelineData | null {
  return timeline.find(entry => entry.originalIndex === originalIndex) ?? null;
}

function findPreviousVisibleTimelineEntry(
  timeline: StageTimelineData[],
  originalIndex: number
): StageTimelineData | null {
  for (let i = timeline.length - 1; i >= 0; i--) {
    const entry = timeline[i];
    if (entry.originalIndex < originalIndex && !entry.isWait) {
      return entry;
    }
  }
  return null;
}

function findNextVisibleTimelineEntry(
  timeline: StageTimelineData[],
  originalIndex: number
): StageTimelineData | null {
  for (const entry of timeline) {
    if (entry.originalIndex > originalIndex && !entry.isWait) {
      return entry;
    }
  }
  return null;
}

function getTimelineEndBoundary(entry: StageTimelineData): number {
  return entry.endTime ?? entry.startTime;
}

function getImmediateWaitBeforeIndex(
  stages: Stage[],
  index: number
): number | null {
  const waitIndex = index - 1;
  return waitIndex >= 0 && stages[waitIndex]?.pourType === 'wait'
    ? waitIndex
    : null;
}

function getImmediateWaitAfterIndex(
  stages: Stage[],
  index: number
): number | null {
  const waitIndex = index + 1;
  return waitIndex < stages.length && stages[waitIndex]?.pourType === 'wait'
    ? waitIndex
    : null;
}

function createWaitStage(duration: number): Stage {
  return {
    duration,
    label: '等待',
    detail: '',
    pourType: 'wait',
  };
}

/**
 * 时间模式下编辑某个可见阶段的开始时间。
 *
 * 开始时间是“上一可见阶段结束”和“当前阶段结束”之间的边界。移动该边界
 * 时只调整前置等待和当前阶段时长，因此当前结束时间及后续时间保持不变。
 */
export function applyStageStartTimeEdit(
  stages: Stage[],
  index: number,
  targetStartTime: number
): Stage[] {
  if (!Array.isArray(stages) || index < 0 || index >= stages.length) {
    return stages;
  }

  const stage = stages[index];
  if (!isTimedStage(stage) || !isVisibleStage(stage)) {
    return stages;
  }

  const timeline = buildStageTimelineData(stages);
  const currentEntry = findTimelineEntry(timeline, index);
  if (!currentEntry) {
    return stages;
  }

  const previousEntry = findPreviousVisibleTimelineEntry(timeline, index);
  const previousBoundary = previousEntry
    ? getTimelineEndBoundary(previousEntry)
    : 0;
  const currentEnd = currentEntry.endTime;
  const maxStart = currentEnd ?? Number.POSITIVE_INFINITY;
  const nextStart = normalizeBoundarySeconds(
    clamp(targetStartTime, previousBoundary, maxStart)
  );
  const waitDuration = nextStart - previousBoundary;
  const previousWaitIndex = getImmediateWaitBeforeIndex(stages, index);
  const nextStages = [...stages];
  let currentIndex = index;

  if (previousWaitIndex !== null) {
    if (waitDuration > 0) {
      nextStages[previousWaitIndex] = {
        ...nextStages[previousWaitIndex],
        duration: waitDuration,
      };
    } else {
      nextStages.splice(previousWaitIndex, 1);
      currentIndex -= 1;
    }
  } else if (waitDuration > 0) {
    nextStages.splice(index, 0, createWaitStage(waitDuration));
    currentIndex += 1;
  }

  if (currentEnd !== null) {
    nextStages[currentIndex] = {
      ...nextStages[currentIndex],
      duration: currentEnd - nextStart,
    };
  }

  return nextStages;
}

/**
 * 时间模式下编辑某个可见阶段的结束时间。
 *
 * 结束时间是“当前阶段”和“下一可见阶段开始”之间的边界。只要新结束时间
 * 没有越过下一阶段开始时间，就通过调整后置等待保持后续绝对时间不变。
 */
export function applyStageEndTimeEdit(
  stages: Stage[],
  index: number,
  targetEndTime: number
): Stage[] {
  if (!Array.isArray(stages) || index < 0 || index >= stages.length) {
    return stages;
  }

  const stage = stages[index];
  if (!isTimedStage(stage) || !isVisibleStage(stage)) {
    return stages;
  }

  const timeline = buildStageTimelineData(stages);
  const currentEntry = findTimelineEntry(timeline, index);
  if (!currentEntry) {
    return stages;
  }

  const nextEntry = findNextVisibleTimelineEntry(timeline, index);
  const maxEnd = nextEntry?.startTime ?? Number.POSITIVE_INFINITY;
  const nextEnd = normalizeBoundarySeconds(
    clamp(targetEndTime, currentEntry.startTime, maxEnd)
  );
  const nextStages = [...stages];

  nextStages[index] = {
    ...nextStages[index],
    duration: nextEnd - currentEntry.startTime,
  };

  if (!nextEntry) {
    return nextStages;
  }

  const waitDuration = nextEntry.startTime - nextEnd;
  const nextWaitIndex = getImmediateWaitAfterIndex(nextStages, index);

  if (nextWaitIndex !== null) {
    if (waitDuration > 0) {
      nextStages[nextWaitIndex] = {
        ...nextStages[nextWaitIndex],
        duration: waitDuration,
      };
    } else {
      nextStages.splice(nextWaitIndex, 1);
    }
  } else if (waitDuration > 0) {
    nextStages.splice(index + 1, 0, createWaitStage(waitDuration));
  }

  return nextStages;
}

/**
 * 在累计模式下编辑某个阶段的结束时间。
 *
 * 累计值是有序边界：编辑当前边界时，优先在当前阶段和后一个已配置时间
 * 的阶段之间重新分配增量，从而保持后续累计时间不变。
 */
export function applyCumulativeDurationEdit(
  stages: Stage[],
  index: number,
  targetCumulativeDuration: number
): Stage[] {
  if (!Array.isArray(stages) || index < 0 || index >= stages.length) {
    return stages;
  }

  const stage = stages[index];
  if (!isTimedStage(stage)) {
    return stages;
  }

  const cumulativeData = buildStageCumulativeData(stages);
  const previousCumulative =
    index > 0 ? cumulativeData[index - 1]?.cumulativeDuration || 0 : 0;
  const nextIndex = findNextIndex(stages, index, hasConfiguredDuration);
  const maxCumulative =
    nextIndex === null
      ? Number.POSITIVE_INFINITY
      : cumulativeData[nextIndex]?.cumulativeDuration || previousCumulative;
  const nextCumulative =
    nextIndex === null
      ? null
      : cumulativeData[nextIndex]?.cumulativeDuration || previousCumulative;
  const safeTarget = normalizeNonNegativeNumber(targetCumulativeDuration);
  const nextTarget = Math.round(
    clamp(safeTarget, previousCumulative, maxCumulative)
  );

  const nextStages = [...stages];
  nextStages[index] = {
    ...stage,
    duration: nextTarget - previousCumulative,
  };

  if (nextIndex !== null && nextCumulative !== null) {
    nextStages[nextIndex] = {
      ...nextStages[nextIndex],
      duration: nextCumulative - nextTarget,
    };
  }

  return nextStages;
}

/**
 * 在累计模式下编辑某个阶段的累计水量。
 *
 * 与时间一致，累计水量编辑只移动当前边界；当后面存在已配置水量时，
 * 后续累计水量保持不变。
 */
export function applyCumulativeWaterEdit(
  stages: Stage[],
  index: number,
  targetCumulativeWater: number
): Stage[] {
  if (!Array.isArray(stages) || index < 0 || index >= stages.length) {
    return stages;
  }

  const stage = stages[index];
  if (!isWaterStage(stage)) {
    return stages;
  }

  const cumulativeData = buildStageCumulativeData(stages);
  const previousCumulative =
    index > 0 ? cumulativeData[index - 1]?.cumulativeWater || 0 : 0;
  const nextIndex = findNextIndex(stages, index, hasConfiguredWater);
  const maxCumulative =
    nextIndex === null
      ? Number.POSITIVE_INFINITY
      : cumulativeData[nextIndex]?.cumulativeWater || previousCumulative;
  const nextCumulative =
    nextIndex === null
      ? null
      : cumulativeData[nextIndex]?.cumulativeWater || previousCumulative;
  const safeTarget = normalizeNonNegativeNumber(targetCumulativeWater);
  const nextTarget = Math.round(
    clamp(safeTarget, previousCumulative, maxCumulative)
  );

  const nextStages = [...stages];
  nextStages[index] = {
    ...stage,
    water: String(nextTarget - previousCumulative),
  };

  if (nextIndex !== null && nextCumulative !== null) {
    nextStages[nextIndex] = {
      ...nextStages[nextIndex],
      water: String(nextCumulative - nextTarget),
    };
  }

  return nextStages;
}

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
