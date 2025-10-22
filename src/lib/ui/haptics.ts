'use client';

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * 触感反馈类型
 */
export enum HapticFeedbackType {
  /** 轻触反馈 - 用于普通UI元素点击 */
  LIGHT = 'light',
  /** 中等触感 - 用于重要操作确认 */
  MEDIUM = 'medium',
  /** 重触感 - 用于关键操作完成 */
  HEAVY = 'heavy',
  /** 成功通知 */
  SUCCESS = 'success',
  /** 警告通知 */
  WARNING = 'warning',
  /** 错误通知 */
  ERROR = 'error',
}

/**
 * 检查设备是否支持触感反馈
 * @returns 返回一个Promise<boolean>，表示设备是否支持触感反馈
 */
export const isHapticsSupported = async (): Promise<boolean> => {
  return Capacitor.isPluginAvailable('Haptics');
};

/**
 * 提供触感反馈功能
 *
 * @param type 触感类型
 * @returns 返回一个Promise
 */
export const impactFeedback = async (
  type: HapticFeedbackType = HapticFeedbackType.LIGHT
): Promise<void> => {
  try {
    switch (type) {
      case HapticFeedbackType.LIGHT:
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      case HapticFeedbackType.MEDIUM:
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case HapticFeedbackType.HEAVY:
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case HapticFeedbackType.SUCCESS:
        await Haptics.notification({ type: NotificationType.Success });
        break;
      case HapticFeedbackType.WARNING:
        await Haptics.notification({ type: NotificationType.Warning });
        break;
      case HapticFeedbackType.ERROR:
        await Haptics.notification({ type: NotificationType.Error });
        break;
      default:
        await Haptics.impact({ style: ImpactStyle.Light });
    }
  } catch {
    // 静默失败，不影响用户体验
  }
};

/**
 * 震动反馈
 *
 * @param duration 震动持续时间（毫秒）
 */
export const vibrate = async (duration: number = 100): Promise<void> => {
  try {
    await Haptics.vibrate({ duration });
  } catch {
    // 静默失败，不影响用户体验
  }
};

/**
 * 多次震动
 *
 * @param count 震动次数
 * @param duration 每次震动持续时间
 * @param interval 震动间隔时间
 */
export const vibrateMultiple = async (
  count: number = 3,
  duration: number = 100,
  interval: number = 100
): Promise<void> => {
  try {
    for (let i = 0; i < count; i++) {
      await Haptics.vibrate({ duration });
      if (i < count - 1) {
        // 最后一次震动后不需要等待
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  } catch {
    // 静默失败，不影响用户体验
  }
};

/**
 * 开始选择触感反馈
 */
export const selectionStart = async (): Promise<void> => {
  try {
    await Haptics.selectionStart();
  } catch {
    // 错误处理
  }
};

/**
 * 选择变化触感反馈
 */
export const selectionChanged = async (): Promise<void> => {
  try {
    await Haptics.selectionChanged();
  } catch {
    // 错误处理
  }
};

/**
 * 结束选择触感反馈
 */
export const selectionEnd = async (): Promise<void> => {
  try {
    await Haptics.selectionEnd();
  } catch {
    // 错误处理
  }
};

/**
 * 为了兼容现有代码，提供与旧函数名对应的别名
 */
export const hapticFeedback = impactFeedback;

// 导出所有函数作为默认导出
const hapticsUtils = {
  isSupported: isHapticsSupported,
  impact: impactFeedback,
  light: () => impactFeedback(HapticFeedbackType.LIGHT),
  medium: () => impactFeedback(HapticFeedbackType.MEDIUM),
  heavy: () => impactFeedback(HapticFeedbackType.HEAVY),
  success: () => impactFeedback(HapticFeedbackType.SUCCESS),
  warning: () => impactFeedback(HapticFeedbackType.WARNING),
  error: () => impactFeedback(HapticFeedbackType.ERROR),
  vibrate,
  vibrateMultiple,
  selectionStart,
  selectionChanged,
  selectionEnd,
};

export default hapticsUtils;
