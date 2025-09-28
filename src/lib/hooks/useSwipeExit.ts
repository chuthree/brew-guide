'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export interface SwipeExitOptions {
  /** 侧滑距离阈值，超过这个距离才算有效侧滑 (px) */
  swipeThreshold?: number;
  /** 两次侧滑之间的时间间隔限制 (ms) */
  doubleSwipeTimeout?: number;
  /** 边缘侧滑检测区域宽度 (px) */
  edgeDetectionWidth?: number;
  /** 是否启用触觉反馈 */
  enableHapticFeedback?: boolean;
  /** 侧滑成功时的回调 */
  onSwipeDetected?: () => void;
  /** 退出应用时的回调 */
  onExit?: () => void;
}

export const useSwipeExit = (options: SwipeExitOptions = {}) => {
  const {
    swipeThreshold = 100,
    doubleSwipeTimeout = 2000,
    edgeDetectionWidth = 50,
    enableHapticFeedback = true,
    onSwipeDetected,
    onExit,
  } = options;

  const [swipeCount, setSwipeCount] = useState(0);
  const [showExitHint, setShowExitHint] = useState(false);
  
  const lastSwipeTime = useRef<number>(0);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const isEdgeSwipe = useRef<boolean>(false);

  const resetSwipeCount = useCallback(() => {
    setSwipeCount(0);
    setShowExitHint(false);
  }, []);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    const touch = event.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    touchStartTime.current = Date.now();
    
    // 检测是否从屏幕左边缘开始滑动
    isEdgeSwipe.current = touch.clientX <= edgeDetectionWidth;
  }, [edgeDetectionWidth]);

  const handleTouchEnd = useCallback((event: TouchEvent) => {
    if (!isEdgeSwipe.current) return;

    const touch = event.changedTouches[0];
    const touchEndX = touch.clientX;
    const touchEndY = touch.clientY;
    const touchEndTime = Date.now();

    const deltaX = touchEndX - touchStartX.current;
    const deltaY = Math.abs(touchEndY - touchStartY.current);
    const swipeDuration = touchEndTime - touchStartTime.current;

    // 检测是否为有效的右滑手势
    const isValidSwipe = 
      deltaX > swipeThreshold && // 向右滑动距离足够
      deltaY < swipeThreshold && // 垂直方向移动不能太大
      swipeDuration < 500; // 滑动速度不能太慢

    if (isValidSwipe) {
      const currentTime = Date.now();
      
      // 检查是否在时间窗口内
      if (currentTime - lastSwipeTime.current <= doubleSwipeTimeout) {
        // 第二次侧滑 - 退出应用
        if (enableHapticFeedback) {
          Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
        }
        
        onExit?.();
        if (Capacitor.isNativePlatform()) {
          App.exitApp();
        }
      } else {
        // 第一次侧滑
        setSwipeCount(1);
        setShowExitHint(true);
        lastSwipeTime.current = currentTime;
        
        if (enableHapticFeedback) {
          Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
        }
        
        onSwipeDetected?.();
        
        // 设置超时重置
        setTimeout(() => {
          resetSwipeCount();
        }, doubleSwipeTimeout);
      }
    }
  }, [swipeThreshold, doubleSwipeTimeout, enableHapticFeedback, onSwipeDetected, onExit, resetSwipeCount]);

  useEffect(() => {
    // 只在原生平台启用
    if (!Capacitor.isNativePlatform()) return;

    let backButtonListener: Awaited<ReturnType<typeof App.addListener>> | null = null;

    // 监听硬件返回键
    const setupBackButtonListener = async () => {
      backButtonListener = await App.addListener('backButton', () => {
        // 阻止默认行为，我们只通过侧滑退出
        return;
      });
    };

    setupBackButtonListener();

    // 添加触摸事件监听
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      if (backButtonListener) {
        backButtonListener.remove();
      }
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);

  return {
    swipeCount,
    showExitHint,
    resetSwipeCount,
  };
};