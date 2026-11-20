// 格式化时间函数
export const formatTime = (seconds: number, compact: boolean = false) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (compact) {
    return mins > 0
      ? `${mins}'${secs.toString().padStart(2, '0')}"`
      : `${secs}"`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// 计算目标流速
export const calculateTargetFlowRate = (
  stage: unknown,
  expandedStages: unknown[]
) => {
  // 类型守卫检查
  if (!stage || typeof stage !== 'object' || stage === null) return 0;

  const stageObj = stage as Record<string, unknown>;
  if (stageObj.type !== 'pour') return 0;

  const waterAmount = parseInt(String(stageObj.water || '0'));
  const prevStageIndex = expandedStages.findIndex((s: unknown) => {
    if (!s || typeof s !== 'object' || s === null) return false;
    const sObj = s as Record<string, unknown>;
    return sObj.endTime === stageObj.startTime;
  });

  const prevWater =
    prevStageIndex >= 0
      ? parseInt(
          String(
            (expandedStages[prevStageIndex] as Record<string, unknown>).water ||
              '0'
          )
        )
      : 0;
  const targetWaterDiff = waterAmount - prevWater;

  const time = Number(stageObj.time || 0);
  if (time <= 0) return 0;
  return targetWaterDiff / time;
};
