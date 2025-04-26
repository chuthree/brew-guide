import type { MutableRefObject } from "react";

/**
 * 计时器控制函数的回调接口
 */
export interface TimerControlCallbacks {
  // 触发触感反馈 - 修改类型为更通用的
  triggerHaptic: (type: any) => void;
  // 清除计时器和状态
  clearTimerAndStates: () => void;
  // 设置计时器运行状态
  setIsRunning: (isRunning: boolean) => void;
  // 设置当前时间
  setCurrentTime: (time: number) => void;
  // 设置显示完成状态
  setShowComplete: (show: boolean) => void;
  // 设置当前水量
  setCurrentWaterAmount: (amount: number) => void;
  // 设置倒计时时间
  setCountdownTime: (time: number | null) => void;
  // 设置是否已开始一次
  setHasStartedOnce: (hasStarted: boolean) => void;
  // 设置是否已完成
  setIsCompleted: (isCompleted: boolean) => void;
  // 设置笔记表单初始数据
  setNoteFormInitialData: (data: any | null) => void;
  // 设置显示笔记表单
  setShowNoteForm: (show: boolean) => void;
  // 启动倒计时
  startCountdown: (seconds: number) => void;
  // 启动主计时器
  startMainTimer: () => void;
}

/**
 * 重置计时器
 */
export const resetTimer = (
  callbacks: TimerControlCallbacks,
  countdownTimeRef: MutableRefObject<NodeJS.Timeout | null>
) => {
  // 触发触感反馈
  callbacks.triggerHaptic("warning");
  
  // 清除计时器状态
  callbacks.clearTimerAndStates();
  callbacks.setIsRunning(false);
  callbacks.setCurrentTime(0);
  callbacks.setShowComplete(false);
  callbacks.setCurrentWaterAmount(0);

  // 重置倒计时
  callbacks.setCountdownTime(null);
  // 重置倒计时状态引用
  if (countdownTimeRef && typeof countdownTimeRef === 'object') {
    countdownTimeRef.current = null;
  }

  // 通知其他组件倒计时已结束
  window.dispatchEvent(
    new CustomEvent("brewing:countdownChange", {
      detail: { remainingTime: null },
    })
  );

  callbacks.setHasStartedOnce(false);
  callbacks.setIsCompleted(false);

  // 清除笔记进度标记和保存的表单数据
  localStorage.setItem("brewingNoteInProgress", "false");
  callbacks.setNoteFormInitialData(null);

  // 关闭笔记表单
  callbacks.setShowNoteForm(false);

  // 触发重置事件
  const event = new CustomEvent("brewing:reset");
  window.dispatchEvent(event);
};

/**
 * 暂停计时器
 */
export const pauseTimer = (
  callbacks: TimerControlCallbacks
) => {
  callbacks.triggerHaptic("light");
  callbacks.clearTimerAndStates();
  callbacks.setIsRunning(false);
};

/**
 * 启动计时器
 */
export const startTimer = (
  isRunning: boolean,
  currentMethod: any | null,
  hasStartedOnce: boolean,
  currentTime: number,
  showComplete: boolean,
  isCompleted: boolean,
  isCoffeeBrewed: boolean,
  callbacks: TimerControlCallbacks
) => {
  if (!isRunning && currentMethod) {
    // 如果冲煮已完成，先重置所有状态
    if (showComplete || isCompleted || isCoffeeBrewed) {
      // 先重置
      resetTimer(callbacks, { current: null });

      // 通知所有组件冲煮已经重置
      window.dispatchEvent(new CustomEvent("brewing:reset"));

      // 延迟启动计时器，确保状态已完全重置
      setTimeout(() => {
        callbacks.triggerHaptic("medium");
        callbacks.setIsRunning(true);

        // 启动倒计时
        callbacks.startCountdown(3);
        callbacks.setHasStartedOnce(true);
      }, 100);

      return;
    }

    // 常规启动逻辑
    callbacks.triggerHaptic("medium");
    callbacks.setIsRunning(true);

    if (!hasStartedOnce || currentTime === 0) {
      // 启动倒计时
      callbacks.startCountdown(3);
      callbacks.setHasStartedOnce(true);
    } else {
      callbacks.startMainTimer();
    }
  }
}; 