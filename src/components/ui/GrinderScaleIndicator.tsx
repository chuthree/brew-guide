'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGrinderStore } from '@/lib/stores/grinderStore';
import hapticsUtils from '@/lib/ui/haptics';
import GrindSizeDrawer from './GrindSizeDrawer';

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

/**
 * 磨豆机刻度指示器
 * - 点击：打开研磨度抽屉
 */
const GrinderScaleIndicator: React.FC<GrinderScaleIndicatorProps> = ({
  visible = true,
  hapticFeedback = true,
}) => {
  const { grinders, initialized, initialize } = useGrinderStore();
  const [selectedGrinderId, setSelectedGrinderId] = useState<string | null>(
    null
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // 初始化 store
  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized, initialize]);

  // 默认选中第一个磨豆机
  useEffect(() => {
    if (grinders.length > 0 && !selectedGrinderId) {
      setSelectedGrinderId(grinders[0].id);
    } else if (
      selectedGrinderId &&
      !grinders.find(g => g.id === selectedGrinderId)
    ) {
      setSelectedGrinderId(grinders[0]?.id ?? null);
    }
  }, [grinders, selectedGrinderId]);

  // 当前选中的磨豆机
  const selectedGrinder = useMemo(
    () => grinders.find(g => g.id === selectedGrinderId) ?? grinders[0] ?? null,
    [grinders, selectedGrinderId]
  );

  // 处理按钮点击
  const handleClick = () => {
    if (hapticFeedback) hapticsUtils.light();
    setIsDrawerOpen(true);
  };

  // 关闭抽屉
  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  // 处理磨豆机切换
  const handleGrinderChange = (grinderId: string) => {
    setSelectedGrinderId(grinderId);
  };

  // 没有磨豆机或不显示时返回 null
  if (!visible || !selectedGrinder) return null;

  const scaleText = selectedGrinder.currentGrindSize || '-';

  return (
    <>
      {/* 刻度指示按钮 */}
      <motion.button
        onClick={handleClick}
        className={`${BUTTON_BASE_CLASS} flex h-12.5 w-12.5 cursor-pointer items-center justify-center font-medium text-neutral-800 dark:text-neutral-100`}
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
        initialGrinderId={selectedGrinderId || undefined}
        onGrinderChange={handleGrinderChange}
      />
    </>
  );
};

export default GrinderScaleIndicator;
