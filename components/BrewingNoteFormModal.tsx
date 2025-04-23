'use client'

import React, { useState, useEffect, useMemo } from 'react'
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
}

const BrewingNoteFormModal: React.FC<BrewingNoteFormModalProps> = ({
    showForm,
    initialNote,
    onSave,
    onClose,
    showOptimizationByDefault = false
}) => {
    // 添加器具和方案选择状态
    const [selectedEquipment, setSelectedEquipment] = useState<string>(initialNote?.equipment || '');
    const [selectedMethod, setSelectedMethod] = useState<string>(initialNote?.method || '');
    const [showNoteForm, setShowNoteForm] = useState(false);
    
    // 添加本地状态以管理输入值
    const [coffeeAmount, setCoffeeAmount] = useState<string>('15');
    const [ratioAmount, setRatioAmount] = useState<string>('15');
    const [waterAmount, setWaterAmount] = useState<string>('225g');

    // 使用useMemo包装availableMethods的初始化
    const availableMethods = useMemo(() => {
        if (!selectedEquipment) return []
        return brewingMethods[selectedEquipment] || []
    }, [selectedEquipment])

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

    // 当选择器具变化时，重置方案
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
            alert('请选择器具');
            return;
        }
        if (!selectedMethod) {
            alert('请选择冲煮方案');
            return;
        }
        setShowNoteForm(true);
    };

    // 返回选择器具和方案的界面
    const handleBack = () => {
        setShowNoteForm(false);
    };

    // 处理咖啡粉量变化
    const handleCoffeeAmountChange = (value: string, method: Method) => {
        if (value === '' || !isNaN(Number(value))) {
            setCoffeeAmount(value);
            
            // 更新方法参数
            method.params.coffee = `${value}g`;
            
            // 计算并更新水量
            if (value && ratioAmount) {
                const coffeeValue = parseFloat(value);
                const ratioValue = parseFloat(ratioAmount);
                
                if (!isNaN(coffeeValue) && !isNaN(ratioValue) && coffeeValue > 0) {
                    const waterValue = coffeeValue * ratioValue;
                    // 四舍五入到整数
                    const roundedWaterValue = Math.round(waterValue);
                    method.params.water = `${roundedWaterValue}g`;
                    setWaterAmount(`${roundedWaterValue}g`);
                }
            }
            
            // 强制重新渲染
            setSelectedMethod(method.name);
        }
    };

    // 处理水粉比变化
    const handleRatioAmountChange = (value: string, method: Method) => {
        if (value === '' || !isNaN(Number(value))) {
            setRatioAmount(value);
            
            // 更新方法参数
            method.params.ratio = `1:${value}`;
            
            // 计算并更新水量
            if (coffeeAmount && value) {
                const coffeeValue = parseFloat(coffeeAmount);
                const ratioValue = parseFloat(value);
                
                if (!isNaN(coffeeValue) && !isNaN(ratioValue) && coffeeValue > 0) {
                    const waterValue = coffeeValue * ratioValue;
                    // 四舍五入到整数
                    const roundedWaterValue = Math.round(waterValue);
                    method.params.water = `${roundedWaterValue}g`;
                    setWaterAmount(`${roundedWaterValue}g`);
                }
            }
            
            // 强制重新渲染
            setSelectedMethod(method.name);
        }
    };

    // 初始化一个方法的参数到本地状态
    const initMethodParams = (method: Method) => {
        const coffeeValue = extractNumber(method.params.coffee);
        const ratioValue = extractRatioNumber(method.params.ratio);
        
        setCoffeeAmount(coffeeValue);
        setRatioAmount(ratioValue);
        setWaterAmount(method.params.water);
    };

    // 当选择方法发生变化时，初始化参数
    useEffect(() => {
        if (selectedMethod && selectedEquipment) {
            const methods = brewingMethods[selectedEquipment] || [];
            const method = methods.find(m => m.name === selectedMethod);
            
            if (method) {
                initMethodParams(method);
            }
        }
    }, [selectedMethod, selectedEquipment]);

    return (
        <AnimatePresence>
            {showForm && (
                <div className="fixed inset-0 z-[100]">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.265 }}
                        className="fixed inset-0 bg-black/30 backdrop-blur-sm"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                onClose()
                            }
                        }}
                    />
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
                        className="fixed inset-x-0 bottom-0 max-h-[85vh] overflow-hidden rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl"
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
                            className="px-6  pb-safe-bottom overflow-auto max-h-[calc(85vh-40px)]"
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

                                        {/* 器具选择 */}
                                        <div className="space-y-2">
                                            <label className="block text-sm text-neutral-700 dark:text-neutral-300">
                                                选择器具
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
                                                            ? 'bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800'
                                                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                                                            }`}
                                                    >
                                                        <div className="font-medium">{equipment.name}</div>
                                                        <div className="text-xs mt-1 line-clamp-1 opacity-80">
                                                            {equipment.description}
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
                                                                onClick={() => {
                                                                    setSelectedMethod(method.name);
                                                                    initMethodParams(method);
                                                                }}
                                                                className={`w-full p-3 rounded-md text-sm text-left transition ${selectedMethod === method.name
                                                                    ? 'bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800'
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
                                                                
                                                                {/* 在选中的方案中直接显示参数调整功能 */}
                                                                {selectedMethod === method.name && (
                                                                    <div 
                                                                        className="mt-3 pt-3 border-t border-neutral-300 dark:border-neutral-600"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <div className="text-xs font-medium mb-2 text-neutral-100 dark:text-neutral-800">
                                                                            调整参数
                                                                        </div>
                                                                        <div className="grid grid-cols-2 gap-3 mt-1">
                                                                            <div>
                                                                                <label className="block text-[10px] tracking-widest text-neutral-100 dark:text-neutral-800 mb-1 opacity-80">
                                                                                    咖啡粉量 (g)
                                                                                </label>
                                                                                <input
                                                                                    type="number"
                                                                                    value={coffeeAmount}
                                                                                    onChange={(e) => handleCoffeeAmountChange(e.target.value, method)}
                                                                                    className="w-full border border-neutral-300 dark:border-neutral-700 bg-neutral-700/50 dark:bg-white/50 p-1.5 text-[11px] rounded-md outline-none text-neutral-100 dark:text-neutral-800"
                                                                                    placeholder="15"
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <label className="block text-[10px] tracking-widest text-neutral-100 dark:text-neutral-800 mb-1 opacity-80">
                                                                                    水粉比 (1:X)
                                                                                </label>
                                                                                <input
                                                                                    type="number"
                                                                                    value={ratioAmount}
                                                                                    onChange={(e) => handleRatioAmountChange(e.target.value, method)}
                                                                                    className="w-full border border-neutral-300 dark:border-neutral-700 bg-neutral-700/50 dark:bg-white/50 p-1.5 text-[11px] rounded-md outline-none text-neutral-100 dark:text-neutral-800"
                                                                                    placeholder="15"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <div className="mt-2 flex items-center gap-1 text-[10px] text-neutral-100 dark:text-neutral-800 opacity-80">
                                                                            <span>计算出的水量:</span>
                                                                            <span className="font-medium">{waterAmount}</span>
                                                                        </div>
                                                                    </div>
                                                                )}
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
                                                className="px-6 py-3 bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800 rounded-full text-sm font-medium"
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
                                                // 加入器具和方案信息
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
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}

// 辅助函数：提取数字部分
function extractNumber(str: string): string {
    const match = str.match(/(\d+(\.\d+)?)/);
    return match ? match[0] : '';
}

// 辅助函数：从水粉比中提取数字部分
function extractRatioNumber(ratio: string): string {
    const match = ratio.match(/1:(\d+(\.\d+)?)/);
    return match ? match[1] : '';
}

export default BrewingNoteFormModal 