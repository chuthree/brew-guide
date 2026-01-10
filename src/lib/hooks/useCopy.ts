'use client';

import { useState, useCallback, useMemo } from 'react';
import { copyToClipboard } from '@/lib/utils/exportUtils';
import { showToast } from '@/components/common/feedback/LightToast';
import hapticsUtils from '@/lib/ui/haptics';

interface UseCopyOptions {
  /** 复制成功时是否触发触觉反馈 */
  hapticFeedback?: boolean;
  /** 自定义成功提示文本 */
  successMessage?: string;
}

interface CopyFailureDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onExitComplete?: () => void;
  content: string;
}

interface UseCopyResult {
  /** 复制文本到剪贴板，失败时自动显示手动复制抽屉 */
  copyText: (text: string) => Promise<boolean>;
  /** 是否显示复制失败抽屉 */
  showFailureDrawer: boolean;
  /** 复制失败时的文本内容 */
  failureContent: string | null;
  /** 关闭复制失败抽屉 */
  closeFailureDrawer: () => void;
  /** CopyFailureDrawer 组件的 props，便于直接传递 */
  failureDrawerProps: CopyFailureDrawerProps;

  // 向后兼容的别名
  /** @deprecated 使用 showFailureDrawer 代替 */
  showFailureModal: boolean;
  /** @deprecated 使用 closeFailureDrawer 代替 */
  closeFailureModal: () => void;
}

/**
 * 统一的复制功能 Hook
 *
 * 提供可靠的剪贴板复制功能，当自动复制失败时会返回状态供组件显示手动复制抽屉。
 *
 * @example
 * ```tsx
 * import { useCopy } from '@/lib/hooks/useCopy';
 * import CopyFailureDrawer from '@/components/common/feedback/CopyFailureDrawer';
 *
 * function MyComponent() {
 *   const { copyText, failureDrawerProps } = useCopy();
 *
 *   return (
 *     <>
 *       <button onClick={() => copyText('要复制的文本')}>复制</button>
 *       <CopyFailureDrawer {...failureDrawerProps} />
 *     </>
 *   );
 * }
 * ```
 */
export function useCopy(options: UseCopyOptions = {}): UseCopyResult {
  const { hapticFeedback = false, successMessage = '已复制到剪贴板' } = options;

  const [showFailureDrawer, setShowFailureDrawer] = useState(false);
  const [failureContent, setFailureContent] = useState<string | null>(null);

  const copyText = useCallback(
    async (text: string): Promise<boolean> => {
      const result = await copyToClipboard(text);

      if (result.success) {
        showToast({
          type: 'success',
          title: successMessage,
          duration: 2000,
        });
        if (hapticFeedback) {
          hapticsUtils.light();
        }
        return true;
      } else {
        // 复制失败，保存内容并显示手动复制抽屉
        setFailureContent(result.content || text);
        setShowFailureDrawer(true);
        return false;
      }
    },
    [hapticFeedback, successMessage]
  );

  const closeFailureDrawer = useCallback(() => {
    setShowFailureDrawer(false);
    // 不立即清空 content，让动画完成后再清理
  }, []);

  const clearFailureContent = useCallback(() => {
    setFailureContent(null);
  }, []);

  // 便捷的 props 对象，可直接展开传递给 CopyFailureDrawer
  const failureDrawerProps = useMemo<CopyFailureDrawerProps>(
    () => ({
      isOpen: showFailureDrawer,
      onClose: closeFailureDrawer,
      onExitComplete: clearFailureContent,
      content: failureContent || '',
    }),
    [showFailureDrawer, closeFailureDrawer, clearFailureContent, failureContent]
  );

  return {
    copyText,
    showFailureDrawer,
    failureContent,
    closeFailureDrawer,
    failureDrawerProps,

    // 向后兼容
    showFailureModal: showFailureDrawer,
    closeFailureModal: closeFailureDrawer,
  };
}
