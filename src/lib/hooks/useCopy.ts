'use client';

import { useState, useCallback } from 'react';
import { copyToClipboard } from '@/lib/utils/exportUtils';
import { showToast } from '@/components/common/feedback/LightToast';
import hapticsUtils from '@/lib/ui/haptics';

interface UseCopyOptions {
  hapticFeedback?: boolean;
}

interface UseCopyResult {
  copyText: (text: string) => Promise<void>;
  showFailureModal: boolean;
  failureContent: string | null;
  closeFailureModal: () => void;
}

export function useCopy(options: UseCopyOptions = {}): UseCopyResult {
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [failureContent, setFailureContent] = useState<string | null>(null);

  const copyText = useCallback(
    async (text: string) => {
      const result = await copyToClipboard(text);

      if (result.success) {
        showToast({
          type: 'success',
          title: '已复制到剪贴板',
          duration: 2000,
        });
        if (options.hapticFeedback) {
          hapticsUtils.light();
        }
      } else {
        setFailureContent(result.content || text);
        setShowFailureModal(true);
      }
    },
    [options.hapticFeedback]
  );

  const closeFailureModal = useCallback(() => {
    setShowFailureModal(false);
    setFailureContent(null);
  }, []);

  return {
    copyText,
    showFailureModal,
    failureContent,
    closeFailureModal,
  };
}
