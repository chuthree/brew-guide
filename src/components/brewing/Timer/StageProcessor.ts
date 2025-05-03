import type { Stage } from "@/lib/core/config";
import type { ExpandedStage } from "./types";

/**
 * 创建扩展阶段数组，将原始阶段的注水和等待部分拆分为独立阶段
 */
export const createExpandedStages = (stages: Stage[] | undefined): ExpandedStage[] => {
  if (!stages?.length) return [];

  const expandedStages: ExpandedStage[] = [];

  stages.forEach((stage, index) => {
    const prevStageTime = index > 0 ? stages[index - 1].time : 0;
    const stagePourTime =
      stage.pourTime === 0
        ? 0
        : stage.pourTime || Math.floor((stage.time - prevStageTime) / 3);

    // 如果有注水时间，添加一个注水阶段
    if (stagePourTime > 0) {
      // 创建注水阶段
      expandedStages.push({
        type: "pour",
        label: stage.label,
        startTime: prevStageTime,
        endTime: prevStageTime + stagePourTime,
        time: stagePourTime,
        pourTime: stagePourTime,
        water: stage.water,
        detail: stage.detail,
        pourType: stage.pourType,
        valveStatus: stage.valveStatus,
        originalIndex: index,
      });

      // 只有当注水结束时间小于阶段结束时间时，才添加等待阶段
      if (prevStageTime + stagePourTime < stage.time) {
        // 创建等待阶段
        expandedStages.push({
          type: "wait",
          label: "等待",
          startTime: prevStageTime + stagePourTime,
          endTime: stage.time,
          time: stage.time - (prevStageTime + stagePourTime),
          water: stage.water, // 水量与前一阶段相同
          detail: "保持耐心，等待咖啡萃取",
          pourType: stage.pourType, // 保留注水类型以便视觉一致性
          valveStatus: stage.valveStatus,
          originalIndex: index,
        });
      }
    } else {
      // 如果没有注水时间，只添加一个等待阶段
      // 当pourTime明确设为0时，保留原始标签，否则使用默认"等待"标签
      expandedStages.push({
        type: "wait",
        label: stage.pourTime === 0 ? stage.label : "等待",
        startTime: prevStageTime,
        endTime: stage.time,
        time: stage.time - prevStageTime,
        water: stage.water,
        detail:
          stage.pourTime === 0 ? stage.detail : "保持耐心，等待咖啡萃取",
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
    (stage) => currentTime >= stage.startTime && currentTime <= stage.endTime
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
    ((currentTime - stage.startTime) / (stage.endTime - stage.startTime)) *
    100
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
  const prevStage =
    prevStageIndex >= 0 ? expandedStages[prevStageIndex] : null;

  const prevStageTime = currentStage.startTime;
  const prevStageWater =
    prevStage?.type === "pour"
      ? parseInt(prevStage.water)
      : prevStageIndex > 0
      ? parseInt(expandedStages[prevStageIndex - 1].water)
      : 0;

  if (currentStage.type === "wait") {
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