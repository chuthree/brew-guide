import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Method, CustomEquipment } from '@/lib/core/config';
import { copyMethodToClipboard } from '@/lib/managers/customMethods';
import { showToast } from '../../common/feedback/LightToast';
import { useThemeColor } from '@/lib/hooks/useThemeColor';

interface MethodShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  method: Method;
  customEquipment?: CustomEquipment;
}

const MethodShareModal: React.FC<MethodShareModalProps> = ({
  isOpen,
  onClose,
  method,
  customEquipment,
}) => {
  const [isSharing, setIsSharing] = useState(false);

  // 同步顶部安全区颜色
  useThemeColor({ useOverlay: true, enabled: isOpen });

  // 处理文字分享
  const handleTextShare = async () => {
    try {
      setIsSharing(true);
      await copyMethodToClipboard(method, customEquipment);
      showToast({
        type: 'success',
        title: '已复制到剪贴板',
        duration: 2000,
      });
      onClose();
    } catch (_error) {
      showToast({
        type: 'error',
        title: '复制失败，请重试',
        duration: 2000,
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.265 }}
          className="fixed inset-0 z-50 bg-black/50"
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'tween',
              ease: [0.33, 1, 0.68, 1], // easeOutCubic
              duration: 0.265,
            }}
            style={{
              willChange: 'transform',
            }}
            className="absolute inset-x-0 bottom-0 mx-auto max-h-[85vh] max-w-[500px] overflow-auto rounded-t-2xl bg-neutral-50 shadow-xl dark:bg-neutral-900"
          >
            {/* 拖动条 */}
            <div className="sticky top-0 z-10 flex justify-center bg-neutral-50 py-2 dark:bg-neutral-900">
              <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
            </div>

            {/* 内容 */}
            <div className="pb-safe-bottom px-6">
              {/* 标题栏 */}
              <div className="mb-2 flex items-center justify-between py-4">
                <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
                  分享 {method.name}
                </h3>
                <button
                  onClick={onClose}
                  className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M18 6L6 18M6 6L18 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>

              {/* 方案信息 */}
              <div className="mb-6">
                <div className="rounded-lg bg-neutral-100/60 p-4 dark:bg-neutral-800/30">
                  <div className="mb-1 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    {method.name}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    将生成方案文字说明并复制到剪贴板
                  </div>
                </div>
              </div>

              {/* 按钮 */}
              <button
                onClick={handleTextShare}
                disabled={isSharing}
                className={`w-full rounded-lg px-4 py-2.5 transition-colors ${
                  isSharing
                    ? 'cursor-not-allowed bg-neutral-400 text-neutral-300 dark:bg-neutral-700 dark:text-neutral-500'
                    : 'bg-neutral-800 text-neutral-100 hover:opacity-80 dark:bg-neutral-200 dark:text-neutral-800'
                }`}
              >
                {isSharing ? '复制中...' : '复制到剪贴板'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MethodShareModal;
