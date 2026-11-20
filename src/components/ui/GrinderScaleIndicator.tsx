'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGrinderStore } from '@/lib/stores/grinderStore';
import { useLongPress } from '@/lib/hooks/useLongPress';
import hapticsUtils from '@/lib/ui/haptics';
import GrindSizeDrawer from './GrindSizeDrawer';
import type { WheelPointer } from './GrinderScaleWheel';

interface GrinderScaleIndicatorProps {
  /** 是否显示 */
  visible?: boolean;
  /** 是否启用触感反馈 */
  hapticFeedback?: boolean;
}

// 常量提取到组件外部
const SPRING_TRANSITION = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
};

const BUTTON_BASE_CLASS =
  'rounded-full border border-neutral-200/50 dark:border-neutral-700/50 bg-neutral-100 dark:bg-neutral-800';
const SELECTED_GRINDER_STORAGE_KEY =
  'brew-guide:grinder-scale-indicator:selectedGrinderId';

// 字体大小映射
const FONT_SIZE_MAP = [
  'text-base',
  'text-base',
  'text-sm',
  'text-xs',
  'text-[10px]',
  'text-[8px]',
];
const getFontSize = (len: number) =>
  FONT_SIZE_MAP[Math.min(len, 5)] || 'text-[8px]';

const saveSelectedGrinderId = (grinderId: string | null) => {
  if (typeof window === 'undefined') return;

  if (grinderId) {
    localStorage.setItem(SELECTED_GRINDER_STORAGE_KEY, grinderId);
    return;
  }

  localStorage.removeItem(SELECTED_GRINDER_STORAGE_KEY);
};

/**
 * 磨豆机刻度指示器
 * 点击打开轮盘，长按可接着拖动。
 */
const GrinderScaleIndicator: React.FC<GrinderScaleIndicatorProps> = ({
  visible = true,
  hapticFeedback = true,
}) => {
  const { grinders, initialized, initialize } = useGrinderStore();
  const [selectedGrinderId, setSelectedGrinderId] = useState<string | null>(
    () =>
      typeof window === 'undefined'
        ? null
        : localStorage.getItem(SELECTED_GRINDER_STORAGE_KEY)
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [quickSession, setQuickSession] = useState(0);
  const [openingPointer, setOpeningPointer] = useState<WheelPointer | null>(
    null
  );
  const pressStart = useRef<(WheelPointer & { clientY: number }) | null>(null);
  const longPressStarted = useRef(false);
  const movedBeforeOpening = useRef(false);

  // 初始化 store
  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized, initialize]);

  // 清理已经不存在的持久化选择，默认显示仍回退到第一台磨豆机
  useEffect(() => {
    if (
      initialized &&
      selectedGrinderId &&
      !grinders.some(grinder => grinder.id === selectedGrinderId)
    ) {
      saveSelectedGrinderId(null);
    }
  }, [grinders, initialized, selectedGrinderId]);

  // 当前选中的磨豆机
  const selectedGrinder = useMemo(
    () => grinders.find(g => g.id === selectedGrinderId) ?? grinders[0] ?? null,
    [grinders, selectedGrinderId]
  );

  const openWheel = (pointer: WheelPointer | null = null) => {
    if (hapticFeedback) hapticsUtils.light();
    setOpeningPointer(pointer);
    setQuickSession(session => session + 1);
    setIsDrawerOpen(true);
  };

  const pressHandlers = useLongPress({
    onClick: () => openWheel(),
    onLongPress: () => {
      longPressStarted.current = true;
      openWheel(pressStart.current);
    },
  });

  const endPress = () => {
    pressHandlers.onPointerUp();
    pressStart.current = null;
    setOpeningPointer(null);
  };

  // 关闭抽屉
  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  // 处理磨豆机切换
  const handleGrinderChange = (grinderId: string) => {
    setSelectedGrinderId(grinderId);
    saveSelectedGrinderId(grinderId);
  };

  // 没有磨豆机或不显示时返回 null
  if (!visible || !selectedGrinder) return null;

  const scaleText = selectedGrinder.currentGrindSize || '-';

  return (
    <>
      {/* 刻度指示按钮 */}
      <motion.button
        type="button"
        aria-label={`${selectedGrinder.name} 研磨刻度 ${scaleText}`}
        aria-haspopup="dialog"
        onPointerDown={event => {
          if (!event.isPrimary || event.button !== 0) return;
          pressStart.current = {
            pointerId: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY,
          };
          movedBeforeOpening.current = false;
          longPressStarted.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
          pressHandlers.onPointerDown(event);
        }}
        onPointerMove={event => {
          const start = pressStart.current;
          if (start?.pointerId !== event.pointerId || longPressStarted.current)
            return;
          if (
            Math.hypot(
              event.clientX - start.clientX,
              event.clientY - start.clientY
            ) > 8
          ) {
            movedBeforeOpening.current = true;
            endPress();
          }
        }}
        onPointerUp={event => {
          if (event.isPrimary) endPress();
        }}
        onPointerCancel={event => {
          if (event.isPrimary) endPress();
        }}
        onLostPointerCapture={event => {
          if (event.pointerId === pressStart.current?.pointerId) endPress();
        }}
        onContextMenu={event => event.preventDefault()}
        onClick={event => {
          if (event.detail === 0) openWheel();
          else if (!movedBeforeOpening.current) pressHandlers.onClick(event);
        }}
        className={`${BUTTON_BASE_CLASS} flex h-12.5 w-12.5 cursor-pointer touch-none items-center justify-center font-medium text-neutral-800 select-none dark:text-neutral-100`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={SPRING_TRANSITION}
      >
        <span
          className={`${getFontSize(scaleText.length)} leading-none font-semibold`}
        >
          {scaleText}
        </span>
      </motion.button>

      {/* 研磨度抽屉 */}
      <GrindSizeDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        initialGrinderId={selectedGrinder.id}
        onGrinderChange={handleGrinderChange}
        quickSession={quickSession}
        openingPointer={openingPointer}
        hapticFeedback={hapticFeedback}
      />
    </>
  );
};

export default GrinderScaleIndicator;
