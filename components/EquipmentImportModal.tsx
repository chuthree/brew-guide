'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type CustomEquipment } from '@/lib/config'

interface EquipmentImportModalProps {
    showForm: boolean
    onImport: (equipment: CustomEquipment) => void
    onClose: () => void
    existingEquipments?: CustomEquipment[]
}

const EquipmentImportModal: React.FC<EquipmentImportModalProps> = ({
    showForm,
    onImport,
    onClose,
    existingEquipments = []
}) => {
    // 导入数据的状态
    const [importData, setImportData] = useState('');
    const [error, setError] = useState<string | null>(null);

    // 监听showForm变化，当表单关闭时清除输入框内容
    useEffect(() => {
        if (!showForm) {
            setImportData('');
            setError(null);
        }
    }, [showForm]);

    // 关闭并清除输入
    const handleClose = () => {
        setImportData('');
        setError(null);
        onClose();
    };

    // 处理导入数据
    const handleImport = () => {
        if (!importData) {
            setError('请输入要导入的数据');
            return;
        }

        try {
            // 尝试从文本中提取数据
            import('@/lib/jsonUtils').then(async ({ extractJsonFromText }) => {
                setError(null);
                // 解析导入数据
                const data = extractJsonFromText(importData);
                const equipment = data as unknown as CustomEquipment;

                if (!equipment) {
                    setError('无法从输入中提取有效数据');
                    return;
                }

                // 验证器具对象是否有必要的字段
                if (!equipment.name) {
                    setError('器具缺少名称');
                    return;
                }

                // 验证动画类型
                if (!equipment.animationType || !['v60', 'kalita', 'origami', 'clever', 'custom'].includes(equipment.animationType)) {
                    setError('器具动画类型无效');
                    return;
                }

                // 检查是否已存在同名器具
                const existingEquipment = existingEquipments.find(e => e.name === equipment.name);
                if (existingEquipment) {
                    setError(`已存在同名器具"${equipment.name}"，请修改后再导入`);
                    return;
                }

                // 确保equipment对象完全符合CustomEquipment接口
                const validEquipment: CustomEquipment = {
                    id: equipment.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: equipment.name,
                    description: equipment.description || '',
                    isCustom: true,
                    animationType: equipment.animationType,
                    hasValve: equipment.hasValve || false,
                    customShapeSvg: equipment.customShapeSvg,
                    customValveSvg: equipment.customValveSvg,
                    customValveOpenSvg: equipment.customValveOpenSvg,
                };

                // 导入器具
                onImport(validEquipment);
                // 导入成功后清空输入框和错误信息
                setImportData('');
                setError(null);
                // 关闭模态框
                handleClose();
            }).catch(err => {
                setError('解析数据失败: ' + (err instanceof Error ? err.message : '未知错误'));
            });
        } catch (err) {
            setError('导入失败: ' + (err instanceof Error ? err.message : '未知错误'));
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
                            handleClose();
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
                        className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-hidden rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl"
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
                                        onClick={handleClose}
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
                                    <h3 className="text-base font-medium">导入器具</h3>
                                    <div className="w-8"></div>
                                </div>

                                {/* 表单内容 */}
                                <div className="space-y-4 mt-2">
                                    <div className="flex flex-col space-y-2">
                                        <p className="text-xs text-neutral-500 dark:text-neutral-500">
                                            粘贴器具数据（支持分享的文本格式或JSON格式）：
                                        </p>
                                        <p className="text-xs text-neutral-500 dark:text-neutral-500">
                                            支持常见复制格式，如Markdown代码块、掐头掐尾的JSON。系统会自动提取有效数据。
                                        </p>
                                    </div>
                                    <textarea
                                        className="w-full h-40 p-3 border border-neutral-300 dark:border-neutral-700 rounded-md bg-transparent focus:border-neutral-800 dark:focus:border-neutral-400 focus:outline-none text-neutral-800 dark:text-neutral-200"
                                        placeholder='支持粘贴分享的文本或各种JSON格式，如{"name":"自定义V60","animationType":"v60",...} 或带有代码块的JSON'
                                        value={importData}
                                        onChange={(e) => setImportData(e.target.value)}
                                    />
                                    {error && (
                                        <div className="text-sm text-red-500 dark:text-red-400">
                                            {error}
                                        </div>
                                    )}
                                    <div className="flex justify-end space-x-3 my-4">
                                        <button
                                            onClick={handleClose}
                                            className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-md text-sm"
                                        >
                                            取消
                                        </button>
                                        <button
                                            onClick={handleImport}
                                            className="px-4 py-2 bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800 rounded-md text-sm"
                                        >
                                            导入
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default EquipmentImportModal 