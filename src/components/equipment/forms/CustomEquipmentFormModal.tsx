import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomEquipment, Method } from '@/lib/core/config';
import CustomEquipmentForm from './CustomEquipmentForm';
import { exportEquipment, copyToClipboard } from '@/lib/utils/exportUtils';
import { useThemeColor } from '@/lib/hooks/useThemeColor';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';

interface CustomEquipmentFormModalProps {
  showForm: boolean;
  onClose: () => void;
  onSave: (equipment: CustomEquipment, methods?: Method[]) => void;
  editingEquipment?: CustomEquipment;
  onImport?: () => void;
  /** 从导入模态框回填的数据 */
  pendingImportData?: {
    equipment: CustomEquipment;
    methods?: Method[];
  } | null;
  /** 清除待回填数据的回调 */
  onClearPendingImport?: () => void;
}

const CustomEquipmentFormModal: React.FC<CustomEquipmentFormModalProps> = ({
  showForm,
  onClose,
  onSave,
  editingEquipment,
  onImport,
  pendingImportData,
  onClearPendingImport,
}) => {
  // 用于回填的器具数据（来自导入或编辑）
  const [currentEquipment, setCurrentEquipment] = useState<
    CustomEquipment | undefined
  >(editingEquipment);
  // 待保存的方案数据（来自导入）
  const [pendingMethods, setPendingMethods] = useState<Method[] | undefined>(
    undefined
  );

  // 同步顶部安全区颜色
  useThemeColor({ useOverlay: true, enabled: showForm });

  // 处理导入数据回填
  useEffect(() => {
    if (pendingImportData && showForm) {
      setCurrentEquipment(pendingImportData.equipment);
      setPendingMethods(pendingImportData.methods);
      onClearPendingImport?.();
    }
  }, [pendingImportData, showForm, onClearPendingImport]);

  // 当 editingEquipment 变化时同步
  useEffect(() => {
    if (editingEquipment) {
      setCurrentEquipment(editingEquipment);
      setPendingMethods(undefined);
    }
  }, [editingEquipment]);

  // 当模态框关闭时重置状态
  useEffect(() => {
    if (!showForm) {
      setCurrentEquipment(undefined);
      setPendingMethods(undefined);
    }
  }, [showForm]);

  // 使用统一的历史栈管理
  // 子页面（绘制杯型、阀门、动画）在 CustomEquipmentForm 内部自己注册历史条目
  useModalHistory({
    id: 'equipment-form',
    isOpen: showForm,
    onClose: onClose,
  });

  // 处理关闭 - 使用统一历史栈
  const handleClose = () => {
    modalHistory.back();
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
          className="fixed inset-0 z-10 bg-black/50"
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
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
                    {currentEquipment ? '编辑器具' : '添加器具'}
                  </h3>
                  {/* 导入按钮 - 不再关闭当前模态框 */}
                  {!currentEquipment && onImport && (
                    <button
                      type="button"
                      onClick={() => {
                        onImport();
                        // 不再关闭当前模态框，保持层级结构
                      }}
                      className="px-3 py-1.5 text-sm text-neutral-600 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                    >
                      导入
                    </button>
                  )}
                  {(currentEquipment || !onImport) && (
                    <div className="w-8"></div>
                  )}
                </div>

                {/* 表单内容 */}
                <div className="mt-2">
                  {showForm && (
                    <CustomEquipmentForm
                      key={`equipment-form-${currentEquipment?.id || 'new'}-${pendingImportData ? 'imported' : 'manual'}`}
                      onSave={equipment => {
                        // 保存时传递待保存的方案
                        onSave(equipment, pendingMethods);
                        // 关闭模态框（会自动清理历史）
                        modalHistory.back();
                      }}
                      onCancel={handleClose}
                      initialEquipment={currentEquipment}
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
