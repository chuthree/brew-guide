'use client';

import React, { useState } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import FlightTakeoffIcon from '@public/images/icons/ui/flight-takeoff.svg';
import { YearlyReviewReminderUtils } from '@/lib/utils/yearlyReviewReminderUtils';
import { showToast } from '@/components/common/feedback/LightToast';

interface YearlyReviewReminderDrawerProps {
  /** 控制弹窗是否打开 */
  isOpen: boolean;
  /** 关闭弹窗的回调 */
  onClose: () => void;
  /** 点击"去看看"的回调 */
  onGoToReview: () => void;
}

/**
 * 年度回顾提醒弹窗
 *
 * 在应用启动时检测并提醒用户查看年度回顾报告。
 *
 * 基于 ActionDrawer 组件构建，提供两个操作：
 * - 不看：需要二次确认后跳过当前年份的提醒
 * - 去看看：跳转到年度回顾页面
 */
const YearlyReviewReminderDrawer: React.FC<YearlyReviewReminderDrawerProps> = ({
  isOpen,
  onClose,
  onGoToReview,
}) => {
  const currentYear = YearlyReviewReminderUtils.getCurrentYear();
  // 是否处于确认状态
  const [isConfirming, setIsConfirming] = useState(false);

  /**
   * 处理"不看"按钮点击
   */
  const handleSkip = async () => {
    if (!isConfirming) {
      // 第一次点击，进入确认状态
      setIsConfirming(true);
      return;
    }
    // 第二次点击，真正跳过
    await YearlyReviewReminderUtils.markAsSkipped();
    onClose();
    showToast({ title: '好吧 QAQ' });
  };

  /**
   * 处理"去看看"按钮点击
   */
  const handleGoToReview = async () => {
    // 标记为已查看
    await YearlyReviewReminderUtils.markAsViewed();
    onClose();
    onGoToReview();
  };

  /**
   * 重置确认状态（当弹窗关闭时）
   */
  const handleExitComplete = () => {
    setIsConfirming(false);
  };

  return (
    <ActionDrawer
      isOpen={isOpen}
      onClose={onClose}
      historyId="yearly-review-reminder"
      onExitComplete={handleExitComplete}
    >
      <ActionDrawer.Icon icon={FlightTakeoffIcon} />
      <ActionDrawer.Content>
        <p className="text-neutral-500 dark:text-neutral-400">
          你的{' '}
          <span className="text-neutral-800 dark:text-neutral-200">
            {currentYear} 年度回顾
          </span>{' '}
          已经准备好啦，快去看看这一年你喝了多少咖啡，有哪些精彩瞬间吧！
        </p>
      </ActionDrawer.Content>
      <ActionDrawer.Actions>
        <ActionDrawer.SecondaryButton onClick={handleSkip}>
          {isConfirming ? '真不看看嘛 QAQ' : '不看'}
        </ActionDrawer.SecondaryButton>
        <ActionDrawer.PrimaryButton onClick={handleGoToReview}>
          去看看
        </ActionDrawer.PrimaryButton>
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
};

export default YearlyReviewReminderDrawer;
