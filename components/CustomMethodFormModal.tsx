'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import CustomMethodForm from '@/components/CustomMethodForm'
import ImportMethodForm from '@/components/ImportMethodForm'
import { type Method } from '@/lib/config'

interface CustomMethodFormModalProps {
    showCustomForm: boolean
    showImportForm: boolean
    editingMethod?: Method
    selectedEquipment: string | null
    customMethods: Record<string, Method[]>
    onSaveCustomMethod: (method: Method) => void
    onCloseCustomForm: () => void
    onCloseImportForm: () => void
}

const CustomMethodFormModal: React.FC<CustomMethodFormModalProps> = ({
    showCustomForm,
    showImportForm,
    editingMethod,
    selectedEquipment,
    customMethods,
    onSaveCustomMethod,
    onCloseCustomForm,
    onCloseImportForm
}) => {
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
                                    onSave={onSaveCustomMethod}
                                    onCancel={onCloseCustomForm}
                                    initialMethod={editingMethod}
                                />
                            </motion.div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 导入方案表单 */}
            <AnimatePresence>
                {showImportForm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.265 }}
                        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                onCloseImportForm()
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
                            className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-hidden rounded-t-2xl shadow-xl bg-neutral-50 dark:bg-neutral-900"
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
                                <ImportMethodForm
                                    onSave={(method) => {
                                        onSaveCustomMethod(method)
                                        onCloseImportForm()
                                    }}
                                    onCancel={onCloseImportForm}
                                    existingMethods={selectedEquipment && customMethods[selectedEquipment] ? customMethods[selectedEquipment] : []}
                                />
                            </motion.div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}

export default CustomMethodFormModal 