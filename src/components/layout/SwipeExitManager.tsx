'use client';

import { useSwipeExit } from '@/lib/hooks/useSwipeExit';
import { SwipeExitHint } from '@/components/common/SwipeExitHint';

export default function SwipeExitManager() {
  const { swipeCount, showExitHint } = useSwipeExit({
    swipeThreshold: 80, // 侧滑距离阈值
    doubleSwipeTimeout: 2000, // 2秒内需要完成第二次侧滑
    edgeDetectionWidth: 50, // 从左边缘50px内开始的滑动才有效
    enableHapticFeedback: true, // 启用触觉反馈
    onSwipeDetected: () => {
      // 检测到侧滑手势
    },
    onExit: () => {
      // 准备退出应用
    },
  });

  return <SwipeExitHint show={showExitHint} swipeCount={swipeCount} />;
}