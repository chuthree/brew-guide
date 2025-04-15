import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomEquipment } from '@/lib/config';
import CustomEquipmentForm from './CustomEquipmentForm';
import { exportEquipment, copyToClipboard } from '@/lib/exportUtils'

interface CustomEquipmentFormModalProps {
    showForm: boolean;
    onClose: () => void;
    onSave: (equipment: CustomEquipment) => void;
    editingEquipment?: CustomEquipment;
}

const CustomEquipmentFormModal: React.FC<CustomEquipmentFormModalProps> = ({
    showForm,
    onClose,
    onSave,
    editingEquipment
}) => {
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
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.265 }}
                    className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            onClose();
                        }
                    }}
                >
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{
                            type: "tween",
                            ease: [0.33, 1, 0.68, 1], // cubic-bezier(0.33, 1, 0.68, 1) - easeOutCubic
                            duration: 0.265
                        }}
                        style={{
                            willChange: "transform"
                        }}
                        className="absolute inset-x-0 bottom-0 max-w-[500px] mx-auto max-h-[90vh] overflow-hidden rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl"
                    >
                        {/* 拖动条 */}
                        <div className="sticky top-0 z-10 flex justify-center py-2 bg-neutral-50 dark:bg-neutral-900">
                            <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                        </div>

                        {/* 表单内容 */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                type: "tween",
                                ease: "easeOut",
                                duration: 0.265,
                                delay: 0.05
                            }}
                            style={{
                                willChange: "opacity, transform"
                            }}
                            className="px-6 px-safe pb-6 pb-safe overflow-auto max-h-[calc(90vh-40px)]"
                        >
                            <div className="flex flex-col">
                                {/* 顶部标题 */}
                                <div className="flex items-center justify-between mt-3 mb-6">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="rounded-full p-2"
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
                                    <h3 className="text-base font-medium">
                                        {editingEquipment ? '编辑器具' : '添加器具'}
                                    </h3>
                                    <div className="w-8"></div>
                                </div>

                                {/* 表单内容 */}
                                <div className="mt-2">
                                    <CustomEquipmentForm
                                        onSave={(equipment) => {
                                            onSave(equipment);
                                            onClose();
                                        }}
                                        onCancel={onClose}
                                        initialEquipment={editingEquipment}
                                    />
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