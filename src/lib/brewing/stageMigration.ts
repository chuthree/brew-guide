/**
 * Stage Migration Service
 *
 * 负责将旧版冲煮步骤数据格式转换为新版格式
 *
 * 旧版格式：使用累计时间(time)和注水时间(pourTime)
 * 新版格式：使用阶段用时(duration)和阶段注水量(water)，等待作为独立的pourType
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import type { Stage, PourType } from '../core/config';

/**
 * 旧版 Stage 接口（用于迁移）
 */
export interface LegacyStage {
  time: number; // 累计时间（秒）
  pourTime?: number; // 注水时间（秒）
  label: string;
  water: string; // 累计水量（带单位，如 "30g"）
  detail: string;
  pourType?: PourType;
  valveStatus?: 'open' | 'closed';
}

/**
 * 解析水量字符串，提取数值
 * @param water 水量字符串，如 "30g" 或 "30"
 * @returns 水量数值
 */
export function parseWater(water: string | undefined): number {
  if (!water) return 0;
  const match = water.match(/^(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * 检测是否为旧版数据格式
 *
 * 旧版格式特征：
 * - 存在 time 字段（累计时间）
 * - 可能存在 pourTime 字段
 * - 不存在 duration 字段
 *
 * @param stages 待检测的 stages 数组
 * @returns 是否为旧版格式
 */
export function isLegacyFormat(stages: unknown[]): boolean {
  if (!Array.isArray(stages) || stages.length === 0) {
    return false;
  }

  // 检查第一个有效的 stage
  for (const stage of stages) {
    if (typeof stage !== 'object' || stage === null) {
      continue;
    }

    const s = stage as Record<string, unknown>;

    // 如果存在 duration 字段，说明是新格式
    if ('duration' in s && typeof s.duration === 'number') {
      return false;
    }

    // 如果存在 time 字段，说明是旧格式
    if ('time' in s && typeof s.time === 'number') {
      return true;
    }
  }

  // 默认认为是新格式（空数组或无法判断的情况）
  return false;
}

/**
 * 将旧版 stages 转换为新版格式
 *
 * 转换规则：
 * 1. 累计时间转换为阶段用时：duration = time - prevTime
 * 2. 累计水量转换为阶段水量：water = currentWater - prevWater
 * 3. 如果 stageDuration > pourTime，创建独立的等待阶段
 * 4. 保留所有其他属性（label, detail, pourType, valveStatus）
 *
 * @param legacyStages 旧版 stages 数组
 * @returns 新版 stages 数组
 */
export function migrateStages(legacyStages: LegacyStage[]): Stage[] {
  if (!Array.isArray(legacyStages) || legacyStages.length === 0) {
    return [];
  }

  const newStages: Stage[] = [];
  let prevCumulativeTime = 0;
  let prevCumulativeWater = 0;

  for (let i = 0; i < legacyStages.length; i++) {
    const legacy = legacyStages[i];

    // 处理缺失的 time 字段
    const currentTime =
      typeof legacy.time === 'number' ? legacy.time : prevCumulativeTime + 30;

    // 计算阶段时长
    const stageDuration = Math.max(0, currentTime - prevCumulativeTime);

    // 计算阶段水量
    const currentWater = parseWater(legacy.water);
    const stageWater = Math.max(0, currentWater - prevCumulativeWater);

    // 获取注水时间，默认等于阶段时长
    const pourTime =
      typeof legacy.pourTime === 'number' ? legacy.pourTime : stageDuration;

    // 计算等待时间
    const waitTime = Math.max(0, stageDuration - pourTime);

    // 确定注水方式
    const pourType = legacy.pourType || 'circle';

    // 处理特殊情况：bypass 和 beverage 类型没有 duration
    const isBypassOrBeverage = pourType === 'bypass' || pourType === 'beverage';

    // 添加注水阶段（如果有注水时间或者是 bypass/beverage 类型）
    if (pourTime > 0 || isBypassOrBeverage) {
      const newStage: Stage = {
        pourType,
        label: legacy.label,
        water: String(stageWater),
        detail: legacy.detail || '',
      };

      // bypass 和 beverage 类型不需要 duration
      if (!isBypassOrBeverage) {
        newStage.duration = pourTime;
      }

      // 保留阀门状态
      if (legacy.valveStatus) {
        newStage.valveStatus = legacy.valveStatus;
      }

      newStages.push(newStage);
    }

    // 添加等待阶段（如果有等待时间且不是 bypass/beverage）
    if (waitTime > 0 && !isBypassOrBeverage) {
      newStages.push({
        pourType: 'wait',
        label: '等待',
        duration: waitTime,
        detail: '',
      });
    }

    // 更新累计值
    prevCumulativeTime = currentTime;
    prevCumulativeWater = currentWater;
  }

  return newStages;
}

/**
 * 将新版 stages 转换为旧版格式（用于导出兼容）
 *
 * 转换规则：
 * 1. 阶段用时累加为累计时间
 * 2. 阶段水量累加为累计水量
 * 3. 等待阶段合并到前一个注水阶段的等待时间中
 *
 * @param stages 新版 stages 数组
 * @returns 旧版 stages 数组
 */
export function toLegacyFormat(stages: Stage[]): LegacyStage[] {
  if (!Array.isArray(stages) || stages.length === 0) {
    return [];
  }

  const legacyStages: LegacyStage[] = [];
  let cumulativeTime = 0;
  let cumulativeWater = 0;

  let pendingPourStage: {
    stage: Stage;
    pourTime: number;
    startTime: number;
  } | null = null;

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const duration = stage.duration || 0;
    const stageWater = parseWater(stage.water);

    if (stage.pourType === 'wait') {
      // 等待阶段：累加时间到 pending 的注水阶段
      if (pendingPourStage) {
        cumulativeTime += duration;
      } else {
        // 如果没有前置注水阶段，创建一个空的等待记录
        cumulativeTime += duration;
        legacyStages.push({
          time: cumulativeTime,
          pourTime: 0,
          label: stage.label || '等待',
          water: `${cumulativeWater}g`,
          detail: stage.detail || '',
          pourType: 'other',
        });
      }
    } else {
      // 非等待阶段：先处理之前 pending 的阶段
      if (pendingPourStage) {
        legacyStages.push({
          time: cumulativeTime,
          pourTime: pendingPourStage.pourTime,
          label: pendingPourStage.stage.label,
          water: `${cumulativeWater}g`,
          detail: pendingPourStage.stage.detail || '',
          pourType: pendingPourStage.stage.pourType,
          valveStatus: pendingPourStage.stage.valveStatus,
        });
        pendingPourStage = null;
      }

      // 累加水量
      cumulativeWater += stageWater;

      // bypass 和 beverage 没有 duration，直接添加
      if (stage.pourType === 'bypass' || stage.pourType === 'beverage') {
        legacyStages.push({
          time: cumulativeTime,
          label: stage.label,
          water: `${cumulativeWater}g`,
          detail: stage.detail || '',
          pourType: stage.pourType,
          valveStatus: stage.valveStatus,
        });
      } else {
        // 普通注水阶段：记录为 pending，等待可能的后续等待阶段
        cumulativeTime += duration;
        pendingPourStage = {
          stage,
          pourTime: duration,
          startTime: cumulativeTime - duration,
        };
      }
    }
  }

  // 处理最后一个 pending 的阶段
  if (pendingPourStage) {
    legacyStages.push({
      time: cumulativeTime,
      pourTime: pendingPourStage.pourTime,
      label: pendingPourStage.stage.label,
      water: `${cumulativeWater}g`,
      detail: pendingPourStage.stage.detail || '',
      pourType: pendingPourStage.stage.pourType,
      valveStatus: pendingPourStage.stage.valveStatus,
    });
  }

  return legacyStages;
}

/**
 * 自动迁移 stages 数组（如果需要）
 *
 * 检测格式并在必要时进行迁移，如果已经是新格式则直接返回
 *
 * @param stages stages 数组（可能是新格式或旧格式）
 * @returns 新格式的 stages 数组
 */
export function autoMigrateStages(stages: unknown[]): Stage[] {
  if (!Array.isArray(stages) || stages.length === 0) {
    return [];
  }

  if (isLegacyFormat(stages)) {
    return migrateStages(stages as LegacyStage[]);
  }

  // 已经是新格式，直接返回
  return stages as Stage[];
}
