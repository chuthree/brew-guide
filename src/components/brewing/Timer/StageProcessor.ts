import type { Stage } from '@/lib/core/config';
import type { ExpandedStage } from './types';
import { isLegacyFormat } from '@/lib/brewing/stageMigration';
import {
  calculateCumulativeTime,
  calculateCumulativeWater,
} from '@/lib/brewing/stageUtils';

/**
 * 检测是否为新格式数据
 * 新格式使用 duration 字段，旧格式使用 time 字段
 */
const isNewFormat = (stages: Stage[]): boolean => {
  if (!stages?.length) return false;
  // 如果是旧格式，返回 false
  if (isLegacyFormat(stages)) return false;
  // 检查是否有 duration 字段或者是 wait 类型
  return stages.some(
    stage => typeof stage.duration === 'number' || stage.pourType === 'wait'
  );
};

/**
 * 创建扩展阶段数组，将原始阶段的注水和等待部分拆分为独立阶段
 * 支持新旧两种数据格式：
 * - 新格式：使用 duration（阶段用时）和 water（阶段注水量），wait 作为独立 pourType
 * - 旧格式：使用 time（累计时间）和 pourTime（注水时间）
 */
export const createExpandedStages = (
  stages: Stage[] | undefined
): ExpandedStage[] => {
  if (!stages?.length) return [];

  const expandedStages: ExpandedStage[] = [];

  // 检查是否为意式咖啡方案 - 改进的检测逻辑
  const isEspressoMethod = stages.some(
    stage =>
      stage.pourType === 'extraction' ||
      stage.pourType === 'beverage' ||
      stage.label?.toLowerCase().includes('意式') ||
      stage.label?.toLowerCase().includes('espresso') ||
      stage.detail?.toLowerCase().includes('意式') ||
      stage.detail?.toLowerCase().includes('espresso')
  );

  // 如果是意式咖啡方案，使用特殊处理逻辑
  if (isEspressoMethod) {
    return createEspressoExpandedStages(stages);
  }

  // 检测数据格式
  const useNewFormat = isNewFormat(stages);

  if (useNewFormat) {
    // 新格式处理逻辑
    return createExpandedStagesFromNewFormat(stages);
  } else {
    // 旧格式处理逻辑（保持向后兼容）
    return createExpandedStagesFromLegacyFormat(stages);
  }
};

/**
 * 处理意式咖啡方案
 */
const createEspressoExpandedStages = (stages: Stage[]): ExpandedStage[] => {
  const expandedStages: ExpandedStage[] = [];

  // 先过滤出萃取类型的步骤，只有这些步骤参与计时
  const extractionStages = stages.filter(
    stage => stage.pourType === 'extraction'
  );

  // 处理萃取步骤，创建计时相关的阶段
  extractionStages.forEach((_stage, _index) => {
    // 支持新旧格式：优先使用 duration，否则使用 time
    const stageDuration = _stage.duration ?? _stage.time ?? 25;

    expandedStages.push({
      type: 'pour', // 萃取步骤标记为pour类型
      label: _stage.label || `萃取浓缩`,
      startTime: 0, // 萃取始终从0开始
      endTime: stageDuration, // 使用设定时间，默认25秒
      time: stageDuration, // 阶段持续时间
      pourTime: stageDuration, // 整个阶段都是萃取时间
      water: _stage.water || '',
      detail: _stage.detail || '',
      pourType: 'extraction',
      originalIndex: stages.indexOf(_stage), // 保留原始索引
    });
  });

  // 如果没有萃取步骤但标记为意式咖啡，创建一个默认萃取步骤
  if (expandedStages.length === 0) {
    // 尝试找出一个萃取步骤，如果没有则使用第一个步骤
    const extractionStage =
      stages.find(
        stage =>
          stage.pourType === 'extraction' ||
          stage.label?.toLowerCase().includes('萃取浓缩')
      ) || stages[0];

    if (extractionStage) {
      const stageDuration =
        extractionStage.duration ?? extractionStage.time ?? 25;

      expandedStages.push({
        type: 'pour',
        label: extractionStage.label || '萃取浓缩',
        startTime: 0,
        endTime: stageDuration,
        time: stageDuration,
        pourTime: stageDuration,
        water: extractionStage.water || '',
        detail: extractionStage.detail || '',
        pourType: 'extraction',
        originalIndex: stages.indexOf(extractionStage),
      });
    }
  }

  return expandedStages;
};

/**
 * 从新格式数据创建扩展阶段
 * 新格式特点：
 * - 使用 duration 表示阶段用时
 * - 使用 water 表示阶段注水量（非累计）
 * - wait 作为独立的 pourType
 */
const createExpandedStagesFromNewFormat = (
  stages: Stage[]
): ExpandedStage[] => {
  const expandedStages: ExpandedStage[] = [];
  let cumulativeTime = 0;
  let cumulativeWater = 0;

  stages.forEach((stage, index) => {
    // Bypass 类型的步骤不参与主要计时，跳过处理
    if (stage.pourType === 'bypass') {
      return;
    }

    const stageDuration = stage.duration || 0;
    const stageWater = parseFloat(stage.water || '0') || 0;
    const startTime = cumulativeTime;
    const endTime = cumulativeTime + stageDuration;

    // 等待阶段（pourType === 'wait'）
    if (stage.pourType === 'wait') {
      expandedStages.push({
        type: 'wait',
        label: stage.label || '等待',
        startTime,
        endTime,
        time: stageDuration,
        water: String(cumulativeWater), // 等待阶段水量保持不变
        detail: stage.detail || '',
        pourType: 'wait',
        valveStatus: stage.valveStatus,
        originalIndex: index,
      });
    } else {
      // 注水阶段
      cumulativeWater += stageWater;

      expandedStages.push({
        type: 'pour',
        label: stage.label || `阶段 ${index + 1}`,
        startTime,
        endTime,
        time: stageDuration,
        pourTime: stageDuration, // 新格式中整个阶段都是注水时间
        water: String(cumulativeWater), // 使用累计水量用于显示
        detail: stage.detail || '',
        pourType: stage.pourType,
        valveStatus: stage.valveStatus,
        originalIndex: index,
      });
    }

    cumulativeTime = endTime;
  });

  return expandedStages;
};

/**
 * 从旧格式数据创建扩展阶段（保持向后兼容）
 * 旧格式特点：
 * - 使用 time 表示累计时间
 * - 使用 pourTime 表示注水时间
 * - 等待时间通过 time - pourTime 计算
 */
const createExpandedStagesFromLegacyFormat = (
  stages: Stage[]
): ExpandedStage[] => {
  const expandedStages: ExpandedStage[] = [];

  stages.forEach((stage, index) => {
    // Bypass 类型的步骤不参与主要计时，跳过处理
    if (stage.pourType === 'bypass') {
      return;
    }

    const prevStageTime = index > 0 ? stages[index - 1].time || 0 : 0;
    const stageTime = stage.time || 0;
    const stagePourTime =
      stage.pourTime === 0
        ? 0
        : stage.pourTime || Math.floor((stageTime - prevStageTime) / 3);

    // 如果有注水阶段
    if (stagePourTime > 0) {
      // 添加注水阶段
      expandedStages.push({
        type: 'pour',
        label: stage.label || `阶段 ${index + 1}`,
        startTime: prevStageTime,
        endTime: prevStageTime + stagePourTime,
        time: stagePourTime,
        pourTime: stagePourTime,
        water: stage.water || '',
        detail: stage.detail || '',
        pourType: stage.pourType,
        valveStatus: stage.valveStatus,
        originalIndex: index,
      });

      // 计算等待时间
      const waitTime = stageTime - (prevStageTime + stagePourTime);

      // 只有当等待时间大于0时才添加等待阶段
      if (waitTime > 0) {
        expandedStages.push({
          type: 'wait',
          label: stage.label || `阶段 ${index + 1}`,
          startTime: prevStageTime + stagePourTime,
          endTime: stageTime,
          time: waitTime,
          water: stage.water || '',
          detail: stage.detail || '',
          pourType: stage.pourType,
          valveStatus: stage.valveStatus,
          originalIndex: index,
        });
      }
    } else {
      // 如果没有注水阶段，则整个阶段都是等待
      expandedStages.push({
        type: 'wait',
        label: stage.label || `阶段 ${index + 1}`,
        startTime: prevStageTime,
        endTime: stageTime,
        time: stageTime - prevStageTime,
        water: stage.water || '',
        detail: stage.detail || '',
        pourType: stage.pourType,
        valveStatus: stage.valveStatus,
        originalIndex: index,
      });
    }
  });

  return expandedStages;
};

/**
 * 获取当前阶段索引
 */
export const getCurrentStageIndex = (
  currentTime: number,
  expandedStages: ExpandedStage[]
): number => {
  if (expandedStages.length === 0) return -1;

  // 在扩展的阶段中查找当前阶段
  const expandedStageIndex = expandedStages.findIndex(
    stage => currentTime >= stage.startTime && currentTime <= stage.endTime
  );

  // 如果找不到合适的阶段但时间大于0，返回最后一个扩展阶段
  if (expandedStageIndex === -1 && currentTime > 0) {
    return expandedStages.length - 1;
  }

  return expandedStageIndex;
};

/**
 * 获取阶段进度百分比
 */
export const getStageProgress = (
  stageIndex: number,
  currentTime: number,
  expandedStages: ExpandedStage[]
): number => {
  if (stageIndex < 0 || expandedStages.length === 0) return 0;
  if (stageIndex >= expandedStages.length) return 0;

  const stage = expandedStages[stageIndex];
  if (!stage) return 0;

  if (currentTime < stage.startTime) return 0;
  if (currentTime > stage.endTime) return 100;

  return (
    ((currentTime - stage.startTime) / (stage.endTime - stage.startTime)) * 100
  );
};

/**
 * 计算当前水量
 */
export const calculateCurrentWater = (
  currentTime: number,
  currentStageIndex: number,
  expandedStages: ExpandedStage[]
): number => {
  if (currentTime === 0 || expandedStages.length === 0) return 0;

  if (currentStageIndex === -1) {
    return parseInt(expandedStages[expandedStages.length - 1].water);
  }

  const currentStage = expandedStages[currentStageIndex];
  const prevStageIndex = currentStageIndex > 0 ? currentStageIndex - 1 : -1;
  const prevStage = prevStageIndex >= 0 ? expandedStages[prevStageIndex] : null;

  const prevStageTime = currentStage.startTime;
  const prevStageWater =
    prevStage?.type === 'pour'
      ? parseInt(prevStage.water)
      : prevStageIndex > 0
        ? parseInt(expandedStages[prevStageIndex - 1].water)
        : 0;

  if (currentStage.type === 'wait') {
    // 等待阶段，水量已经达到目标
    return parseInt(currentStage.water);
  }

  const pourTime = currentStage.time;
  const timeInCurrentStage = currentTime - prevStageTime;
  const currentTargetWater = parseInt(currentStage.water);

  if (timeInCurrentStage <= pourTime) {
    const pourProgress = timeInCurrentStage / pourTime;
    return (
      prevStageWater + (currentTargetWater - prevStageWater) * pourProgress
    );
  }

  return currentTargetWater;
};
