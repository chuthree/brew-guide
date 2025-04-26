import type { ExpandedStage } from "./types";
import type { AudioState } from "./Audio";
import { startMainTimer } from "./TimerController";
import { 
  startCountdown, 
  stopCountdown,
  CountdownState, 
  createInitialCountdownState
} from "./CountdownController";

/**
 * 计时器管理器状态
 */
export interface TimerManagerState {
  // 主计时器相关
  mainTimerId: NodeJS.Timeout | null;
  currentTime: number;
  isRunning: boolean;
  hasStartedOnce: boolean;
  isCompleted: boolean;
  
  // 倒计时相关
  countdown: CountdownState;
  
  // 其他状态
  showComplete: boolean;
  waterAmount: number;
  skipButtonVisible: boolean;
}

/**
 * 计时器事件回调接口
 */
export interface TimerEventCallbacks {
  onTimerStatus?: (status: { isRunning: boolean }) => void;
  onTimeUpdate?: (time: number) => void;
  onStageChange?: (status: { 
    currentStage: number;
    progress: number; 
    isWaiting: boolean;
  }) => void;
  onCountdownChange?: (time: number | null) => void;
  onComplete?: (totalTime: number) => void;
  onWaterAmountChange?: (amount: number) => void;
  onSkipButtonVisibilityChange?: (visible: boolean) => void;
  onHaptic?: (type: string) => void;
}

/**
 * 创建初始计时管理器状态
 */
export const createInitialTimerManagerState = (): TimerManagerState => ({
  mainTimerId: null,
  currentTime: 0,
  isRunning: false,
  hasStartedOnce: false,
  isCompleted: false,
  countdown: createInitialCountdownState(),
  showComplete: false,
  waterAmount: 0,
  skipButtonVisible: false
});

/**
 * 停止主计时器并清除状态
 */
export const stopMainTimer = (timerId: NodeJS.Timeout | null): void => {
  if (timerId) {
    clearInterval(timerId);
  }
};

/**
 * 启动计时器
 * @param state 当前计时器状态
 * @param expandedStages 扩展阶段数组
 * @param audioState 音频状态
 * @param settings 设置
 * @param callbacks 回调函数
 * @returns 更新后的状态
 */
export const startTimer = (
  state: TimerManagerState,
  expandedStages: ExpandedStage[],
  audioState: AudioState,
  settings: {
    notificationSound: boolean;
    hapticFeedback: boolean;
  },
  callbacks: TimerEventCallbacks
): TimerManagerState => {
  // 如果已经在运行中，则不做任何操作
  if (state.isRunning) {
    return state;
  }

  // 如果冲煮已完成，先重置所有状态
  if (state.showComplete || state.isCompleted) {
    const resetState = resetTimer(state, expandedStages, callbacks);
    
    // 延迟启动计时器，确保状态已完全重置
    setTimeout(() => {
      if (callbacks.onHaptic) {
        callbacks.onHaptic("medium");
      }
      
      // 派发倒计时变化事件
      window.dispatchEvent(
        new CustomEvent("brewing:countdownChange", {
          detail: { remainingTime: 3 },
        })
      );
      
      // 通知状态变化
      window.dispatchEvent(
        new CustomEvent("brewing:timerStatus", {
          detail: { isRunning: true, status: "running" },
        })
      );
    }, 100);
    
    // 启动倒计时
    const { timerId } = startCountdown(
      3, 
      audioState,
      settings.notificationSound,
      {
        onTick: (updater) => {
          const newValue = updater(3);
          if (callbacks.onCountdownChange) {
            callbacks.onCountdownChange(newValue);
          }
        },
        onComplete: () => {
          // 倒计时完成后启动主计时器
          const newTimerId = startMainTimer(
            expandedStages,
            audioState,
            settings.notificationSound,
            settings.hapticFeedback,
            {
              onTick: (updater) => {
                const newTime = updater(0);
                if (callbacks.onTimeUpdate) {
                  callbacks.onTimeUpdate(newTime);
                }
              },
              onComplete: () => {
                if (callbacks.onComplete) {
                  callbacks.onComplete(resetState.currentTime);
                }
              },
              onHaptic: callbacks.onHaptic
            }
          );
          
          // 更新状态
          window.dispatchEvent(
            new CustomEvent("brewing:mainTimerStarted", {
              detail: { timerId: newTimerId },
            })
          );
        },
        onStatusChange: (status) => {
          // 通知倒计时状态变化
          if (callbacks.onCountdownChange) {
            callbacks.onCountdownChange(status.time);
          }
        }
      }
    );
    
    // 返回更新后的状态
    return {
      ...resetState,
      isRunning: true,
      hasStartedOnce: true,
      countdown: {
        ...resetState.countdown,
        timerId,
        currentTime: 3,
        isRunning: true
      }
    };
  }

  // 常规启动逻辑
  if (callbacks.onHaptic) {
    callbacks.onHaptic("medium");
  }
  
  // 通知运行状态变化
  if (callbacks.onTimerStatus) {
    callbacks.onTimerStatus({ isRunning: true });
  }
  
  window.dispatchEvent(
    new CustomEvent("brewing:timerStatus", {
      detail: { isRunning: true, status: "running" },
    })
  );

  // 首次启动或者重新启动但时间为0时，启动倒计时
  if (!state.hasStartedOnce || state.currentTime === 0) {
    // 启动倒计时
    const { timerId } = startCountdown(
      3, 
      audioState,
      settings.notificationSound,
      {
        onTick: (updater) => {
          const newValue = updater(3);
          if (callbacks.onCountdownChange) {
            callbacks.onCountdownChange(newValue);
          }
        },
        onComplete: () => {
          // 倒计时完成后启动主计时器
          const newTimerId = startMainTimer(
            expandedStages,
            audioState,
            settings.notificationSound,
            settings.hapticFeedback,
            {
              onTick: (updater) => {
                const newTime = updater(0);
                if (callbacks.onTimeUpdate) {
                  callbacks.onTimeUpdate(newTime);
                }
              },
              onComplete: () => {
                if (callbacks.onComplete) {
                  callbacks.onComplete(state.currentTime);
                }
              },
              onHaptic: callbacks.onHaptic
            }
          );
          
          // 更新状态
          window.dispatchEvent(
            new CustomEvent("brewing:mainTimerStarted", {
              detail: { timerId: newTimerId },
            })
          );
        },
        onStatusChange: (status) => {
          // 通知倒计时状态变化
          if (callbacks.onCountdownChange) {
            callbacks.onCountdownChange(status.time);
          }
        }
      }
    );
    
    // 返回更新后的状态
    return {
      ...state,
      isRunning: true,
      hasStartedOnce: true,
      countdown: {
        ...state.countdown,
        timerId,
        currentTime: 3,
        isRunning: true
      }
    };
  } else {
    // 直接启动主计时器
    const newTimerId = startMainTimer(
      expandedStages,
      audioState,
      settings.notificationSound,
      settings.hapticFeedback,
      {
        onTick: (updater) => {
          const newTime = updater(state.currentTime);
          if (callbacks.onTimeUpdate) {
            callbacks.onTimeUpdate(newTime);
          }
        },
        onComplete: () => {
          if (callbacks.onComplete) {
            callbacks.onComplete(state.currentTime);
          }
        },
        onHaptic: callbacks.onHaptic
      }
    );
    
    // 返回更新后的状态
    return {
      ...state,
      mainTimerId: newTimerId,
      isRunning: true
    };
  }
};

/**
 * 暂停计时器
 * @param state 当前计时器状态
 * @param callbacks 回调函数
 * @returns 更新后的状态
 */
export const pauseTimer = (
  state: TimerManagerState,
  callbacks: TimerEventCallbacks
): TimerManagerState => {
  // 如果正在倒计时
  if (state.countdown.isRunning && state.countdown.timerId) {
    stopCountdown(state.countdown.timerId);
  }
  
  // 如果主计时器在运行
  if (state.mainTimerId) {
    stopMainTimer(state.mainTimerId);
  }
  
  // 触发触感回调
  if (callbacks.onHaptic) {
    callbacks.onHaptic("light");
  }
  
  // 通知运行状态变化
  if (callbacks.onTimerStatus) {
    callbacks.onTimerStatus({ isRunning: false });
  }
  
  // 派发事件
  window.dispatchEvent(
    new CustomEvent("brewing:timerStatus", {
      detail: { isRunning: false, status: "paused" },
    })
  );
  
  // 返回更新后的状态
  return {
    ...state,
    mainTimerId: null,
    isRunning: false,
    countdown: {
      ...state.countdown,
      timerId: null,
      isRunning: false
    }
  };
};

/**
 * 重置计时器
 * @param state 当前计时器状态
 * @param expandedStages 扩展阶段数组
 * @param callbacks 回调函数
 * @returns 更新后的状态
 */
export const resetTimer = (
  state: TimerManagerState,
  expandedStages: ExpandedStage[],
  callbacks: TimerEventCallbacks
): TimerManagerState => {
  // 如果正在倒计时
  if (state.countdown.isRunning && state.countdown.timerId) {
    stopCountdown(state.countdown.timerId);
  }
  
  // 如果主计时器在运行
  if (state.mainTimerId) {
    stopMainTimer(state.mainTimerId);
  }
  
  // 触发触感回调
  if (callbacks.onHaptic) {
    callbacks.onHaptic("warning");
  }
  
  // 通知状态变化
  if (callbacks.onTimerStatus) {
    callbacks.onTimerStatus({ isRunning: false });
  }
  
  if (callbacks.onTimeUpdate) {
    callbacks.onTimeUpdate(0);
  }
  
  if (callbacks.onCountdownChange) {
    callbacks.onCountdownChange(null);
  }
  
  if (callbacks.onWaterAmountChange) {
    callbacks.onWaterAmountChange(0);
  }
  
  // 派发重置事件
  window.dispatchEvent(new CustomEvent("brewing:reset"));
  
  // 手动触发一次事件，确保其他组件知道倒计时已结束
  window.dispatchEvent(
    new CustomEvent("brewing:countdownChange", {
      detail: { remainingTime: null },
    })
  );
  
  // 返回重置后的状态
  return {
    ...state,
    mainTimerId: null,
    currentTime: 0,
    isRunning: false,
    hasStartedOnce: false,
    isCompleted: false,
    countdown: createInitialCountdownState(),
    showComplete: false,
    waterAmount: 0,
    skipButtonVisible: false
  };
};

/**
 * 跳过当前阶段
 * @param state 当前计时器状态
 * @param expandedStages 扩展阶段数组
 * @param callbacks 回调函数
 * @returns 更新后的状态
 */
export const skipCurrentStage = (
  state: TimerManagerState,
  expandedStages: ExpandedStage[],
  callbacks: TimerEventCallbacks
): TimerManagerState => {
  if (!expandedStages.length) {
    return state;
  }
  
  // 获取最后一个阶段的结束时间
  const lastStage = expandedStages[expandedStages.length - 1];
  if (!lastStage) {
    return state;
  }
  
  // 如果主计时器在运行
  if (state.mainTimerId) {
    stopMainTimer(state.mainTimerId);
  }
  
  // 如果正在倒计时
  if (state.countdown.isRunning && state.countdown.timerId) {
    stopCountdown(state.countdown.timerId);
  }
  
  // 通知状态变化
  if (callbacks.onTimerStatus) {
    callbacks.onTimerStatus({ isRunning: false });
  }
  
  if (callbacks.onTimeUpdate) {
    callbacks.onTimeUpdate(lastStage.endTime);
  }
  
  // 添加短暂延迟，模拟正常完成过程
  setTimeout(() => {
    // 触发完成回调
    if (callbacks.onComplete) {
      callbacks.onComplete(lastStage.endTime);
    }
    
    // 派发完成事件
    window.dispatchEvent(
      new CustomEvent("brewing:complete", {
        detail: { skipped: true, totalTime: lastStage.endTime },
      })
    );
  }, 300);
  
  // 返回更新后的状态
  return {
    ...state,
    mainTimerId: null,
    currentTime: lastStage.endTime,
    isRunning: false,
    isCompleted: true,
    showComplete: true,
    countdown: createInitialCountdownState(),
    skipButtonVisible: false
  };
};

/**
 * 更新计时器状态
 * @param state 当前计时器状态
 * @param updates 要更新的字段
 * @returns 更新后的状态
 */
export const updateTimerState = (
  state: TimerManagerState,
  updates: Partial<TimerManagerState>
): TimerManagerState => {
  return { ...state, ...updates };
}; 