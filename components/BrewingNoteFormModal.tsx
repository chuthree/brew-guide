'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import BrewingNoteForm from '@/components/BrewingNoteForm'
import type { BrewingNoteData, CoffeeBean } from '@/app/types'
import { equipmentList, brewingMethods, type Method } from '@/lib/config'

interface BrewingNoteFormModalProps {
    showForm: boolean
    initialNote?: Partial<BrewingNoteData> & {
        coffeeBean?: CoffeeBean | null;
        id?: string;
    }
    onSave: (note: BrewingNoteData) => void
    onClose: () => void
    showOptimizationByDefault?: boolean
    onJumpToImport?: () => void
}

const BrewingNoteFormModal: React.FC<BrewingNoteFormModalProps> = ({
    showForm,
    initialNote,
    onSave,
    onClose,
    showOptimizationByDefault = false,
    onJumpToImport
}) => {
    // 添加滤杯和方案选择状态
    const [selectedEquipment, setSelectedEquipment] = useState<string>(initialNote?.equipment || '');
    const [selectedMethod, setSelectedMethod] = useState<string>(initialNote?.method || '');
    const [showNoteForm, setShowNoteForm] = useState(false);

    // 根据选择的滤杯生成可用的方案列表
    const availableMethods = selectedEquipment ? brewingMethods[selectedEquipment] || [] : [];

    // 根据选中的方案获取默认参数
    const getMethodParams = () => {
        if (selectedEquipment && selectedMethod) {
            const methodObj = availableMethods.find(m => m.name === selectedMethod);
            if (methodObj) {
                return {
                    coffee: methodObj.params.coffee,
                    water: methodObj.params.water,
                    ratio: methodObj.params.ratio,
                    grindSize: methodObj.params.grindSize,
                    temp: methodObj.params.temp
                };
            }
        }
        return {
            coffee: '15g',
            water: '225g',
            ratio: '1:15',
            grindSize: '中细',
            temp: '92°C'
        };
    };

    // 当选择滤杯变化时，重置方案
    useEffect(() => {
        if (selectedEquipment && availableMethods.length > 0 && !availableMethods.find(m => m.name === selectedMethod)) {
            setSelectedMethod(availableMethods[0].name);
        }
    }, [selectedEquipment, availableMethods, selectedMethod]);

    // 当modal打开时，初始化值
    useEffect(() => {
        if (showForm) {
            setSelectedEquipment(initialNote?.equipment || '');
            setSelectedMethod(initialNote?.method || '');
            setShowNoteForm(false);
        }
    }, [showForm, initialNote]);

    // 设置默认值，确保initialNote有必要的字段
    const getDefaultNote = (): Partial<BrewingNoteData> => {
        const params = getMethodParams();
        return {
            equipment: selectedEquipment,
            method: selectedMethod,
            coffeeBeanInfo: {
                name: initialNote?.coffeeBeanInfo?.name || '',
                roastLevel: initialNote?.coffeeBeanInfo?.roastLevel || '中度烘焙',
                roastDate: initialNote?.coffeeBeanInfo?.roastDate || ''
            },
            params: initialNote?.params || params,
            rating: initialNote?.rating || 3,
            taste: initialNote?.taste || {
                acidity: 3,
                sweetness: 3,
                bitterness: 3,
                body: 3
            },
            notes: initialNote?.notes || '',
            id: initialNote?.id
        };
    };

    // 处理继续按钮点击
    const handleContinue = () => {
        if (!selectedEquipment) {
            alert('请选择滤杯');
            return;
        }
        if (!selectedMethod) {
            alert('请选择冲煮方案');
            return;
        }
        setShowNoteForm(true);
    };

    // 返回选择滤杯和方案的界面
    const handleBack = () => {
        setShowNoteForm(false);
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
                            onClose()
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
                        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-hidden rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl"
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
                            className="px-6 px-safe pb-6 pb-safe overflow-auto max-h-[calc(85vh-40px)]"
                        >
                            <AnimatePresence mode="wait">
                                {!showNoteForm ? (
                                    <motion.div
                                        key="equipment-select"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="space-y-6 py-4"
                                    >
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
                                            <h3 className="text-base font-medium">创建冲煮笔记</h3>
                                            <div className="w-8"></div>
                                        </div>

                                        {/* 滤杯选择 */}
                                        <div className="space-y-2">
                                            <label className="block text-sm text-neutral-700 dark:text-neutral-300">
                                                选择滤杯
                                            </label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {equipmentList.map((equipment) => (
                                                    <motion.button
                                                        key={equipment.id}
                                                        type="button"
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        onClick={() => setSelectedEquipment(equipment.id)}
                                                        className={`p-3 rounded-md text-sm text-left transition ${selectedEquipment === equipment.id
                                                            ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800'
                                                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                                                            }`}
                                                    >
                                                        <div className="font-medium">{equipment.name}</div>
                                                        <div className="text-xs mt-1 line-clamp-1 opacity-80">
                                                            {equipment.description[0]}
                                                        </div>
                                                    </motion.button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 方案选择 */}
                                        {selectedEquipment && (
                                            <div className="space-y-2">
                                                <label className="block text-sm text-neutral-700 dark:text-neutral-300">
                                                    选择冲煮方案
                                                </label>
                                                <div className="space-y-2">
                                                    {availableMethods.length > 0 ? (
                                                        availableMethods.map((method) => (
                                                            <motion.button
                                                                key={method.name}
                                                                type="button"
                                                                whileHover={{ scale: 1.01 }}
                                                                whileTap={{ scale: 0.99 }}
                                                                onClick={() => setSelectedMethod(method.name)}
                                                                className={`w-full p-3 rounded-md text-sm text-left transition ${selectedMethod === method.name
                                                                    ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800'
                                                                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                                                                    }`}
                                                            >
                                                                <div className="font-medium">{method.name}</div>
                                                                <div className="text-xs mt-1 opacity-80 flex flex-wrap gap-1">
                                                                    <span>{method.params.coffee}</span>
                                                                    <span>·</span>
                                                                    <span>{method.params.water}</span>
                                                                    <span>·</span>
                                                                    <span>{method.params.ratio}</span>
                                                                    <span>·</span>
                                                                    <span>{method.params.grindSize}</span>
                                                                </div>
                                                            </motion.button>
                                                        ))
                                                    ) : (
                                                        <div className="text-sm text-neutral-500 dark:text-neutral-400 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-md">
                                                            没有可用的冲煮方案
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* 继续按钮 */}
                                        <div className="flex justify-end pt-4">
                                            <motion.button
                                                type="button"
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={handleContinue}
                                                className="px-6 py-3 bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800 rounded-full text-sm font-medium"
                                                disabled={!selectedEquipment || !selectedMethod}
                                            >
                                                继续
                                            </motion.button>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="note-form"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                    >
                                        <div className="flex items-center justify-between mt-3 mb-6">
                                            <button
                                                type="button"
                                                onClick={handleBack}
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
                                            <h3 className="text-base font-medium">冲煮笔记</h3>
                                            <div className="w-8"></div>
                                        </div>
                                        <BrewingNoteForm
                                            id={initialNote?.id}
                                            isOpen={true}
                                            onClose={onClose}
                                            onSave={(note) => {
                                                // 加入滤杯和方案信息
                                                const completeNote = {
                                                    ...note,
                                                    equipment: selectedEquipment,
                                                    method: selectedMethod
                                                };
                                                onSave(completeNote);
                                                // 不要关闭模态框，让调用者决定是否关闭
                                            }}
                                            initialData={getDefaultNote()}
                                            showOptimizationByDefault={showOptimizationByDefault}
                                            onJumpToImport={onJumpToImport}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default BrewingNoteFormModal 