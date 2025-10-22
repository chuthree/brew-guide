import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomEquipment } from '@/lib/core/config';
import CustomEquipmentForm, {
  CustomEquipmentFormHandle,
} from './CustomEquipmentForm';
import { exportEquipment, copyToClipboard } from '@/lib/utils/exportUtils';

interface CustomEquipmentFormModalProps {
  showForm: boolean;
  onClose: () => void;
  onSave: (equipment: CustomEquipment) => void;
  editingEquipment?: CustomEquipment;
  onImport?: () => void;
}

const CustomEquipmentFormModal: React.FC<CustomEquipmentFormModalProps> = ({
  showForm,
  onClose,
  onSave,
  editingEquipment,
  onImport,
}) => {
  const formRef = useRef<CustomEquipmentFormHandle | null>(null);

  // 历史栈管理 - 支持多步骤表单的硬件返回键和浏览器返回按钮
  useEffect(() => {
    if (!showForm) {
      // 模态框关闭时，确保清理历史栈中的模态框状态
      if (window.history.state?.modal === 'equipment-form') {
        window.history.replaceState(null, '');
      }
      return;
    }

    window.history.pushState({ modal: 'equipment-form' }, '');

    // 监听返回事件
    const handlePopState = () => {
      // 询问表单是否还有上一步
      if (formRef.current?.handleBackStep()) {
        // 表单内部处理了返回（返回上一步），重新添加历史记录
        window.history.pushState({ modal: 'equipment-form' }, '');
      } else {
        // 表单已经在第一步，关闭表单
        onClose();

        // 不再自动关闭器具列表，让用户手动控制返回到器具列表
        // 移除这些逻辑可以让用户从添加器具表单返回时回到器具列表，而不是直接退出整个器具管理
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showForm, onClose]);

  // 处理关闭
  const handleClose = () => {
    // 如果历史栈中有我们添加的条目，触发返回
    if (window.history.state?.modal === 'equipment-form') {
      window.history.back();
    } else {
      // 否则直接关闭
      onClose();
    }
  };

  const _handleExport = async (equipment: CustomEquipment) => {
    try {
      const exportData = exportEquipment(equipment);
      const success = await copyToClipboard(exportData);
      if (success) {
        alert('器具数据已复制到剪贴板');
      } else {
        alert('复制失败，请重试');
      }
    } catch (_error) {
      alert('导出失败，请重试');
    }
  };

  return (
    <AnimatePresence>
      {showForm && (
        <motion.div
          data-modal="equipment-form"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.265 }}
          className="fixed inset-0 z-50 bg-black/30"
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'tween',
              ease: [0.33, 1, 0.68, 1], // cubic-bezier(0.33, 1, 0.68, 1) - easeOutCubic
              duration: 0.265,
            }}
            style={{
              willChange: 'transform',
            }}
            className="absolute inset-x-0 bottom-0 mx-auto max-h-[90vh] max-w-[500px] overflow-hidden rounded-t-2xl bg-neutral-50 shadow-xl dark:bg-neutral-900"
          >
            {/* 拖动条 */}
            <div className="sticky top-0 z-10 flex justify-center bg-neutral-50 py-2 dark:bg-neutral-900">
              <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
            </div>

            {/* 表单内容 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                type: 'tween',
                ease: 'easeOut',
                duration: 0.265,
                delay: 0.05,
              }}
              style={{
                willChange: 'opacity, transform',
              }}
              className="pb-safe-bottom max-h-[calc(90vh-40px)] overflow-auto px-6"
            >
              <div className="flex flex-col">
                {/* 顶部标题 */}
                <div className="mt-3 mb-6 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="-m-3 rounded-full p-3"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="text-neutral-800 dark:text-neutral-200"
                    >
                      <path
                        d="M19 12H5M5 12L12 19M5 12L12 5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <h3 className="ml-6 text-base font-medium">
                    {editingEquipment ? '编辑器具' : '添加器具'}
                  </h3>
                  {/* 导入按钮 */}
                  {!editingEquipment && onImport && (
                    <button
                      type="button"
                      onClick={() => {
                        onImport();
                        handleClose(); // 关闭当前添加器具模态框
                      }}
                      className="px-3 py-1.5 text-sm text-neutral-600 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                    >
                      导入
                    </button>
                  )}
                  {(editingEquipment || !onImport) && (
                    <div className="w-8"></div>
                  )}
                </div>

                {/* 表单内容 */}
                <div className="mt-2">
                  {showForm && (
                    <CustomEquipmentForm
                      key={`equipment-form-${editingEquipment?.id || 'new'}-${Date.now()}`}
                      ref={formRef}
                      onSave={equipment => {
                        onSave(equipment);
                        // 保存成功后直接关闭，不通过历史栈返回
                        // 避免触发 popstate 事件导致表单返回上一步
                        onClose();
                      }}
                      onCancel={handleClose}
                      initialEquipment={editingEquipment}
                    />
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CustomEquipmentFormModal;
