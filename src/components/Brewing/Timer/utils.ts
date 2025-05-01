import { KeepAwake } from "@capacitor-community/keep-awake";

// 格式化时间函数
export const formatTime = (seconds: number, compact: boolean = false) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (compact) {
    return mins > 0
      ? `${mins}'${secs.toString().padStart(2, "0")}"`
      : `${secs}"`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// 检查是否支持KeepAwake
export const isKeepAwakeSupported = () => {
  try {
    return typeof KeepAwake !== "undefined";
  } catch {
    return false;
  }
};

// 处理屏幕常亮功能
export const handleScreenWake = async (isRunning: boolean, hasStartedOnce: boolean) => {
  if (!isKeepAwakeSupported()) {
    return;
  }

  try {
    if (isRunning) {
      await KeepAwake.keepAwake();
    } else if (!isRunning && hasStartedOnce) {
      await KeepAwake.allowSleep();
    }
  } catch {
    // 静默处理错误
  }
};

// 清理屏幕常亮功能
export const cleanupScreenWake = async () => {
  if (!isKeepAwakeSupported()) {
    return;
  }

  try {
    await KeepAwake.allowSleep();
  } catch {
    // 静默处理错误
  }
};

// 计算目标流速
export const calculateTargetFlowRate = (stage: any, expandedStages: any[]) => {
  if (!stage || stage.type !== "pour") return 0;
  
  const waterAmount = parseInt(stage.water);
  const prevStageIndex = expandedStages.findIndex(s => s.endTime === stage.startTime);
  const prevWater = prevStageIndex >= 0 ? parseInt(expandedStages[prevStageIndex].water) : 0;
  const targetWaterDiff = waterAmount - prevWater;
  
  if (stage.time <= 0) return 0;
  return targetWaterDiff / stage.time;
}; 