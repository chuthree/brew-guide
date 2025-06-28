'use client';

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import type { BrewingStep } from '@/lib/hooks/useBrewingState';
import hapticsUtils from '@/lib/ui/haptics';

interface SwipeBackGestureProps {
  activeBrewingStep: BrewingStep;
  isTimerRunning?: boolean;
  showComplete?: boolean;
  navigateToStep: (step: BrewingStep, options?: {
    force?: boolean;
    resetParams?: boolean;
    preserveStates?: string[];
    preserveCoffeeBean?: boolean;
    preserveEquipment?: boolean;
    preserveMethod?: boolean;
  }) => void;
  disabled?: boolean;
  hasCoffeeBeans?: boolean;
}

const SwipeBackGesture: React.FC<SwipeBackGestureProps> = ({
  activeBrewingStep,
  isTimerRunning = false,
  showComplete = false,
  navigateToStep,
  disabled = false,
  hasCoffeeBeans = false
}) => {
  const [isActive, setIsActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchCurrentRef = useRef<{ x: number; y: number } | null>(null);
  const isNative = Capacitor.isNativePlatform();

  // 滑动阈值：屏幕宽度的30%
  const THRESHOLD_PERCENTAGE = 0.3;
  // 边缘宽度：屏幕左侧20dp内视为边缘开始
  const EDGE_ZONE_WIDTH = 20;

  // 以下步骤支持返回导航
  const NAVIGABLE_STEPS = useMemo(() => ({
    'brewing': 'method', // 从注水步骤返回到方案步骤
    'method': 'coffeeBean', // 从方案步骤返回到咖啡豆步骤
    'coffeeBean': null, // 咖啡豆步骤是第一步，没有返回步骤
    'notes': 'brewing' // 从记录步骤返回到注水步骤
  } as Record<BrewingStep, BrewingStep | null>), []);

  // 确定当前步骤是否可以返回，以及应返回到哪个步骤
  const getBackStep = useCallback((): BrewingStep | null => {
    // 如果当前是方案步骤且没有咖啡豆，则不允许返回到咖啡豆步骤
    if (activeBrewingStep === 'method' && !hasCoffeeBeans) {
      return null;
    }
    return NAVIGABLE_STEPS[activeBrewingStep];
  }, [activeBrewingStep, hasCoffeeBeans, NAVIGABLE_STEPS]);

  // 重置手势状态
  const resetGesture = useCallback(() => {
    setIsActive(false);
    setProgress(0);
    touchStartRef.current = null;
    touchCurrentRef.current = null;
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // 如果禁用了滑动或计时器正在运行且未完成，不处理手势
    if (disabled || (isTimerRunning && !showComplete)) {
      return;
    }

    // 获取第一个触摸点
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    // 只有当触摸开始位置在屏幕左侧边缘时才启用滑动返回
    if (x <= EDGE_ZONE_WIDTH) {
      // 记录起始位置和时间
      touchStartRef.current = { x, y, time: Date.now() };
      touchCurrentRef.current = { x, y };

      // 获取目标步骤，如果没有可返回的步骤，不启用滑动
      const backStep = getBackStep();
      if (backStep) {
        setIsActive(true);
        setProgress(0);
      }
    }
  }, [disabled, isTimerRunning, showComplete, getBackStep]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isActive || !touchStartRef.current || !touchCurrentRef.current) {
      return;
    }

    // 获取当前触摸位置
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    // 更新当前位置
    touchCurrentRef.current = { x, y };

    // 计算水平方向的滑动距离
    const deltaX = x - touchStartRef.current.x;

    // 计算垂直方向的滑动距离，如果垂直滑动过大，取消水平滑动
    const deltaY = Math.abs(y - touchStartRef.current.y);
    if (deltaY > 50 && deltaY > deltaX * 0.8) {
      // 如果垂直滑动幅度过大，认为是垂直滚动，取消滑动手势
      resetGesture();
      return;
    }

    // 只处理向右滑动（正向deltaX）
    if (deltaX > 0) {
      // 计算滑动进度，受屏幕宽度和阈值影响
      const screenWidth = window.innerWidth;
      const thresholdWidth = screenWidth * THRESHOLD_PERCENTAGE;
      const newProgress = Math.min(deltaX / thresholdWidth, 1);

      // 更新进度状态
      setProgress(newProgress);

      // 在接近触发阈值时提供轻微触感反馈
      if (newProgress >= 0.9 && progress < 0.9) {
        hapticsUtils.light();
      }
    }
  }, [isActive, progress, resetGesture]);

  const handleTouchEnd = useCallback(() => {
    if (!isActive || !touchStartRef.current || !touchCurrentRef.current) {
      return;
    }

    // 计算最终滑动距离和速度
    const deltaX = touchCurrentRef.current.x - touchStartRef.current.x;
    const deltaTime = Date.now() - touchStartRef.current.time;
    const velocity = deltaX / deltaTime; // 像素/毫秒

    // 获取返回目标步骤
    const backStep = getBackStep();

    // 滑动完成的条件：
    // 1. 滑动距离达到阈值
    // 2. 或者滑动速度快（快速滑动即使距离不够也触发）
    // 3. 有可返回的步骤
    const screenWidth = window.innerWidth;
    const thresholdWidth = screenWidth * THRESHOLD_PERCENTAGE;
    const isFastSwipe = velocity > 0.5; // 快速滑动阈值：0.5像素/毫秒

    if ((deltaX >= thresholdWidth || isFastSwipe) && backStep) {
      // 触发返回操作
      hapticsUtils.medium(); // 提供中等强度的触感反馈

      // 处理从注水步骤返回到方案步骤的特殊情况
      if (activeBrewingStep === 'brewing' && backStep === 'method') {
        // 设置特殊标记，确保可以正常导航
        localStorage.setItem("fromMethodToBrewing", "true");

        // 使用navigateToStep返回到前一个步骤
        navigateToStep(backStep, {
          force: true,
          preserveStates: ["all"],
          preserveCoffeeBean: true,
          preserveEquipment: true,
          preserveMethod: true
        });
      } else {
        // 特殊处理：从记录步骤返回到注水步骤
        if (activeBrewingStep === 'notes' && backStep === 'brewing') {
          // 触发brewing:reset事件，确保计时器状态正确重置
          window.dispatchEvent(new CustomEvent("brewing:reset"));
        }

        // 其他步骤的返回导航
        navigateToStep(backStep, {
          preserveCoffeeBean: true,
          preserveEquipment: activeBrewingStep !== 'method',
          preserveMethod: activeBrewingStep === 'notes'
        });
      }
    } else {
      // 没有达到滑动阈值，重置手势状态
      hapticsUtils.light(); // 提供轻微触感反馈，表明取消操作
    }

    // 重置手势状态
    resetGesture();
  }, [isActive, activeBrewingStep, getBackStep, navigateToStep, resetGesture]);

  // 添加触摸事件监听
  useEffect(() => {
    if (isNative) {
      document.addEventListener('touchstart', handleTouchStart, { passive: true });
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      document.addEventListener('touchcancel', resetGesture);

      return () => {
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('touchcancel', resetGesture);
      };
    }
  }, [isNative, handleTouchStart, handleTouchMove, handleTouchEnd, resetGesture]);

  // 如果不是原生平台，不显示任何内容
  if (!isNative || !getBackStep()) {
    return null;
  }

  return (
    <AnimatePresence>
      {isActive && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            className="fixed inset-0 bg-black pointer-events-none z-999"
            initial={{ opacity: 0 }}
            animate={{ opacity: progress * 0.25 }}
            exit={{ opacity: 0 }}
          />

          {/* 返回指示器 */}
          <motion.div
            className="fixed left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center z-1000 pointer-events-none"
            initial={{ opacity: 0, x: -20 }}
            animate={{
              opacity: Math.min(progress * 1.5, 1),
              x: progress * 40 - 20,
              scale: 0.8 + progress * 0.2
            }}
            exit={{ opacity: 0, x: -20 }}
          >
            <ArrowLeft className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SwipeBackGesture;