import type { Stage } from "@/lib/core/config";
import type { ExpandedStage } from "./types";

/**
 * 创建扩展阶段数组，将原始阶段的注水和等待部分拆分为独立阶段
 */
export const createExpandedStages = (stages: Stage[] | undefined): ExpandedStage[] => {
  if (!stages?.length) return [];

  const expandedStages: ExpandedStage[] = [];
  
  // 检查是否为意式咖啡方案 - 改进的检测逻辑
  const isEspressoMethod = stages.some(stage => 
    stage.pourType === 'extraction' || 
    stage.pourType === 'beverage' ||
    stage.label?.toLowerCase().includes('意式') || 
    stage.label?.toLowerCase().includes('espresso') ||
    stage.detail?.toLowerCase().includes('意式') || 
    stage.detail?.toLowerCase().includes('espresso')
  );

  // 如果是意式咖啡方案，使用特殊处理逻辑
  if (isEspressoMethod) {
    // 先过滤出萃取类型的步骤，只有这些步骤参与计时
    const extractionStages = stages.filter(stage => stage.pourType === 'extraction');
    
    // 处理萃取步骤，创建计时相关的阶段
    extractionStages.forEach((stage, index) => {
      expandedStages.push({
        type: "pour", // 萃取步骤标记为pour类型
        label: stage.label || `萃取浓缩`,
        startTime: 0, // 萃取始终从0开始
        endTime: stage.time || 25, // 使用设定时间，默认25秒
        time: stage.time || 25, // 阶段持续时间
        pourTime: stage.time || 25, // 整个阶段都是萃取时间
        water: stage.water || "",
        detail: stage.detail || "",
        pourType: "extraction",
        originalIndex: stages.indexOf(stage), // 保留原始索引
      });
    });
    
    // 如果没有萃取步骤但标记为意式咖啡，创建一个默认萃取步骤
    if (expandedStages.length === 0) {
      // 尝试找出一个萃取步骤，如果没有则使用第一个步骤
      const extractionStage = stages.find(stage => 
        stage.pourType === 'extraction' || 
        stage.label?.toLowerCase().includes('萃取浓缩')
      ) || stages[0];
      
      if (extractionStage) {
        expandedStages.push({
          type: "pour",
          label: extractionStage.label || "萃取浓缩",
          startTime: 0,
          endTime: extractionStage.time || 25,
          time: extractionStage.time || 25,
          pourTime: extractionStage.time || 25,
          water: extractionStage.water || "",
          detail: extractionStage.detail || "",
          pourType: "extraction",
          originalIndex: stages.indexOf(extractionStage),
        });
      }
    }
    
    // 添加饮料步骤作为信息性显示，但不计入计时器
    const beverageStages = stages.filter(stage => stage.pourType === 'beverage');
    beverageStages.forEach(stage => {
      // 饮料步骤不添加到expandedStages中，因为它们不参与计时
      // 这些步骤会在界面上显示，但不会影响计时器
    });
  } else {
    // 常规方案处理逻辑
    stages.forEach((stage, index) => {
      const prevStageTime = index > 0 ? (stages[index - 1].time || 0) : 0;
      const stageTime = stage.time || 0;
      const stagePourTime =
        stage.pourTime === 0
          ? 0
          : stage.pourTime || Math.floor((stageTime - prevStageTime) / 3);

      // 如果有注水阶段
      if (stagePourTime > 0) {
        // 添加注水阶段
        expandedStages.push({
          type: "pour",
          label: stage.label || `阶段 ${index + 1}`,
          startTime: prevStageTime,
          endTime: prevStageTime + stagePourTime,
          time: stagePourTime,
          pourTime: stagePourTime,
          water: stage.water || "",
          detail: stage.detail || "",
          pourType: stage.pourType,
          valveStatus: stage.valveStatus,
          originalIndex: index,
        });

        // 添加等待阶段
        expandedStages.push({
          type: "wait",
          label: stage.label || `阶段 ${index + 1}`,
          startTime: prevStageTime + stagePourTime,
          endTime: stageTime,
          time: stageTime - (prevStageTime + stagePourTime),
          water: stage.water || "",
          detail: stage.detail || "",
          pourType: stage.pourType,
          valveStatus: stage.valveStatus,
          originalIndex: index,
        });
      } else {
        // 如果没有注水阶段，则整个阶段都是等待
        expandedStages.push({
          type: "wait",
          label: stage.label || `阶段 ${index + 1}`,
          startTime: prevStageTime,
          endTime: stageTime,
          time: stageTime - prevStageTime,
          water: stage.water || "",
          detail: stage.detail || "",
          pourType: stage.pourType,
          valveStatus: stage.valveStatus,
          originalIndex: index,
        });
      }
    });
  }

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