'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import CustomMethodForm from '@/components/CustomMethodForm'
import MethodImportModal from '@/components/MethodImportModal'
import type { Method } from '@/lib/config'
import type { SettingsOptions } from '@/components/Settings'

interface CustomMethodFormModalProps {
    showCustomForm: boolean
    showImportForm: boolean
    editingMethod?: Method
    selectedEquipment: string | null
    customMethods: Record<string, Method[]>
    onSaveCustomMethod: (method: Method) => void
    onCloseCustomForm: () => void
    onCloseImportForm: () => void
    settings: SettingsOptions
}

const CustomMethodFormModal: React.FC<CustomMethodFormModalProps> = ({
    showCustomForm,
    showImportForm,
    editingMethod,
    selectedEquipment,
    customMethods,
    onSaveCustomMethod,
    onCloseCustomForm,
    onCloseImportForm,
    settings
}) => {
    const [formData, setFormData] = useState<Partial<Method>>({})
    const [validationError, setValidationError] = useState<string | null>(null)

    // 根据表单数据保存自定义方法
    const handleSaveMethod = async () => {
        try {
            if (!formData.name) {
                setValidationError('请输入方案名称')
                return
            }

            if (!formData.params?.coffee || !formData.params?.water) {
                setValidationError('请输入咖啡粉量和水量')
                return
            }

            if (!formData.params.stages || formData.params.stages.length === 0) {
                setValidationError('至少需要添加一个阶段')
                return
            }

            // 确保所有必要属性都存在
            const method: Method = {
                id: formData.id || `method-${Date.now()}`, // 确保有唯一ID
                name: formData.name,
                params: {
                    coffee: formData.params.coffee,
                    water: formData.params.water,
                    ratio: formData.params.ratio,
                    grindSize: formData.params.grindSize,
                    temp: formData.params.temp,
                    videoUrl: formData.params.videoUrl || "",
                    roastLevel: formData.params.roastLevel,
                    stages: formData.params.stages
                }
            }

            // 调用父组件传入的保存方法
            console.log("[CustomMethodFormModal] 准备保存方法，ID:", method.id)
            onSaveCustomMethod(method)

            // 清除验证错误
            setValidationError(null)

            return method.id // 返回方法ID
        } catch (error) {
            console.error("保存方法时出错:", error)
            setValidationError('保存失败，请重试')
            return null
        }
    }

    return (
        <>
            {/* 自定义方案表单 */}
            <AnimatePresence>
                {showCustomForm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.265 }}
                        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                onCloseCustomForm()
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
                                <CustomMethodForm
                                    onSave={handleSaveMethod}
                                    onCancel={onCloseCustomForm}
                                    initialMethod={editingMethod}
                                    selectedEquipment={selectedEquipment}
                                    settings={settings}
                                />
                            </motion.div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 导入方案组件 - 使用新的MethodImportModal */}
            <MethodImportModal
                showForm={showImportForm}
                onImport={(method) => {
                    onSaveCustomMethod(method);
                    onCloseImportForm();
                }}
                onClose={onCloseImportForm}
                existingMethods={selectedEquipment && customMethods[selectedEquipment] ? customMethods[selectedEquipment] : []}
            />
        </>
    )
}

export default CustomMethodFormModal 