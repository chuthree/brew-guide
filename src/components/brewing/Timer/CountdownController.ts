import type { AudioState } from './Audio';
import { playSound } from './Audio';

/**
 * 倒计时回调接口
 */
export interface CountdownCallbacks {
  onTick: (updater: (prev: number | null) => number | null) => void;
  onComplete: () => void;
  onStatusChange?: (status: {
    isRunning: boolean;
    time: number | null;
  }) => void;
}

/**
 * 倒计时状态接口
 */
export interface CountdownState {
  timerId: NodeJS.Timeout | null;
  currentTime: number | null;
  isRunning: boolean;
  prevTime: number | null;
}

/**
 * 创建初始倒计时状态
 */
export const createInitialCountdownState = (): CountdownState => ({
  timerId: null,
  currentTime: null,
  isRunning: false,
  prevTime: null,
});

/**
 * 启动倒计时
 * @param seconds 倒计时秒数
 * @param audioState 音频状态
 * @param notificationSoundEnabled 是否启用通知声音
 * @param callbacks 回调函数集合
 * @returns 计时器ID和清理函数
 */
export const startCountdown = (
  seconds: number,
  audioState: AudioState,
  notificationSoundEnabled: boolean,
  callbacks: CountdownCallbacks
): {
  timerId: NodeJS.Timeout;
  cleanup: () => void;
} => {
  // 播放开始音效
  playSound('start', audioState, notificationSoundEnabled);

  // 创建倒计时计时器
  const timerId = setInterval(() => {
    callbacks.onTick(prev => {
      if (prev === null) return null;
      if (prev <= 1) {
        // 倒计时结束
        clearInterval(timerId);

        // 通知倒计时完成
        setTimeout(() => {
          if (notificationSoundEnabled) {
            playSound('ding', audioState, true);
          }
          callbacks.onComplete();
        }, 0);

        // 通知状态变化
        if (callbacks.onStatusChange) {
          callbacks.onStatusChange({ isRunning: false, time: 0 });
        }

        return 0;
      }

      const newTime = prev - 1;

      // 通知状态变化
      if (callbacks.onStatusChange) {
        callbacks.onStatusChange({ isRunning: true, time: newTime });
      }

      return newTime;
    });
  }, 1000);

  // 返回计时器ID和清理函数
  return {
    timerId,
    cleanup: () => {
      clearInterval(timerId);
    },
  };
};

/**
 * 停止倒计时
 * @param timerId 计时器ID
 */
export const stopCountdown = (timerId: NodeJS.Timeout | null): void => {
  if (timerId) {
    clearInterval(timerId);
  }
};

/**
 * 重置倒计时状态
 * @param state 要更新的倒计时状态
 * @returns 重置后的倒计时状态
 */
export const resetCountdownState = (state: CountdownState): CountdownState => {
  // 先清除定时器
  if (state.timerId) {
    clearInterval(state.timerId);
  }

  // 返回重置后的状态
  return {
    timerId: null,
    currentTime: null,
    isRunning: false,
    prevTime: null,
  };
};

/**
 * 更新倒计时状态
 * @param state 当前倒计时状态
 * @param updates 要更新的字段
 * @returns 更新后的状态
 */
export const updateCountdownState = (
  state: CountdownState,
  updates: Partial<CountdownState>
): CountdownState => {
  return { ...state, ...updates };
};
