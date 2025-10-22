import type { ExpandedStage } from './types';
import { playSound } from './Audio';
import type { AudioState } from './Audio';

/**
 * 计时器回调接口
 */
export interface TimerCallbacks {
  onTick: (updater: (currentTime: number) => number) => void;
  onComplete: () => void;
  onHaptic?: (type: string) => void;
}

/**
 * 处理主计时器的每一秒更新
 */
export const handleTimerTick = (
  currentTime: number,
  expandedStages: ExpandedStage[],
  audioState: AudioState,
  notificationSoundEnabled: boolean,
  hapticEnabled: boolean,
  hapticCallback?: (type: string) => void
): {
  newTime: number;
  isCompleted: boolean;
} => {
  const newTime = currentTime + 1;
  const lastStageIndex = expandedStages.length - 1;

  if (lastStageIndex < 0) {
    return { newTime, isCompleted: false };
  }

  let shouldPlayDing = false;
  let shouldPlayStart = false;
  let shouldNotifyPourEnd = false;
  let shouldPreNotifyPourEnd = false;

  for (let index = 0; index < expandedStages.length; index++) {
    // 阶段开始时播放提示音
    if (newTime === expandedStages[index].startTime) {
      shouldPlayDing = true;
    }

    // 阶段即将结束时播放提示音
    if (
      newTime === expandedStages[index].endTime - 2 ||
      newTime === expandedStages[index].endTime - 1
    ) {
      shouldPlayStart = true;
    }

    // 注水阶段特殊处理
    if (expandedStages[index].type === 'pour') {
      const pourEndTime = expandedStages[index].endTime;

      // 注水阶段结束时
      if (newTime === pourEndTime) {
        shouldNotifyPourEnd = true;
      }

      // 注水阶段即将结束时
      if (newTime === pourEndTime - 2 || newTime === pourEndTime - 1) {
        shouldPreNotifyPourEnd = true;
      }
    }
  }

  if (shouldPlayDing) {
    playSound('ding', audioState, notificationSoundEnabled);
  }

  if (shouldPlayStart) {
    playSound('start', audioState, notificationSoundEnabled);
  }

  if (shouldPreNotifyPourEnd) {
    playSound('start', audioState, notificationSoundEnabled);
  }

  if (shouldNotifyPourEnd) {
    playSound('ding', audioState, notificationSoundEnabled);
    if (hapticEnabled && hapticCallback) {
      hapticCallback('medium');
    }
  }

  // 检查是否完成所有阶段
  const isCompleted = newTime > expandedStages[lastStageIndex].endTime;

  // 如果完成了所有阶段，返回最后阶段的结束时间
  if (isCompleted) {
    return {
      newTime: expandedStages[lastStageIndex].endTime,
      isCompleted: true,
    };
  }

  return { newTime, isCompleted: false };
};

/**
 * 启动主计时器并返回计时器ID
 */
export const startMainTimer = (
  expandedStages: ExpandedStage[],
  audioState: AudioState,
  notificationSoundEnabled: boolean,
  hapticEnabled: boolean,
  callbacks: TimerCallbacks
): NodeJS.Timeout => {
  return setInterval(() => {
    callbacks.onTick((currentTime: number) => {
      const { newTime, isCompleted } = handleTimerTick(
        currentTime,
        expandedStages,
        audioState,
        notificationSoundEnabled,
        hapticEnabled,
        callbacks.onHaptic
      );

      if (isCompleted) {
        // 这里不直接处理，而是通过回调，让组件处理停止计时器等逻辑
        callbacks.onComplete();
      }

      return newTime;
    });
  }, 1000);
};
