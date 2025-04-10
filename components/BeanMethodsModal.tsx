'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type CustomEquipment, type Method } from '@/lib/config'
import { CoffeeBean } from '@/app/types'
import { BeanMethod, BeanMethodManager } from '@/lib/beanMethodManager'
import { equipmentList, brewingMethods } from '@/lib/config'
import { loadCustomEquipments } from '@/lib/customEquipments'
import { loadCustomMethodsForEquipment } from '@/lib/customMethods'

interface BeanMethodsModalProps {
    showModal: boolean
    coffeeBean: CoffeeBean | null
    onClose: () => void
}

const BeanMethodsModal: React.FC<BeanMethodsModalProps> = ({
    showModal,
    coffeeBean,
    onClose
}) => {
    // 状态
    const [methods, setMethods] = useState<BeanMethod[]>([])
    const [loading, setLoading] = useState(true)
    const [customEquipments, setCustomEquipments] = useState<CustomEquipment[]>([])
    const [showAddForm, setShowAddForm] = useState(false)
    const [selectedEquipment, setSelectedEquipment] = useState<string>('')
    const [selectedMethod, setSelectedMethod] = useState<string>('')
    const [methodNotes, setMethodNotes] = useState('')
    const [availableMethods, setAvailableMethods] = useState<Method[]>([])
    const [editableParams, setEditableParams] = useState<{ coffee: string; water: string; grindSize: string; temp: string; } | null>(null)
    
    // 编辑状态
    const [editingMethodId, setEditingMethodId] = useState<string | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [hasSetEditParams, setHasSetEditParams] = useState(false) // 标记是否已在编辑模式设置过参数

    // 加载方案列表
    useEffect(() => {
        const loadMethods = async () => {
            if (!coffeeBean) return
            
            try {
                setLoading(true)
                const beanMethods = await BeanMethodManager.getBeanMethods(coffeeBean.id)
                setMethods(beanMethods)
            } catch (error) {
                console.error('加载咖啡豆方案失败:', error)
            } finally {
                setLoading(false)
            }
        }

        if (showModal) {
            loadMethods()
        }
    }, [showModal, coffeeBean])

    // 加载自定义器具
    useEffect(() => {
        const loadEquipments = async () => {
            try {
                const equipments = await loadCustomEquipments()
                setCustomEquipments(equipments)
            } catch (error) {
                console.error('加载自定义器具失败:', error)
            }
        }

        if (showModal) {
            loadEquipments()
        }
    }, [showModal])

    // 当选择器具时加载对应的方案列表
    useEffect(() => {
        const loadMethodsForEquipment = async () => {
            if (!selectedEquipment) {
                setAvailableMethods([])
                setSelectedMethod('') // Reset selected method when equipment changes
                return
            }

            try {
                // 获取预设方案
                const predefinedMethods = brewingMethods[selectedEquipment] || []
                
                // 获取自定义方案
                const customMethods = await loadCustomMethodsForEquipment(selectedEquipment)
                
                // 合并方案列表 (简单合并，允许重名)
                const combinedMethods = [...predefinedMethods, ...customMethods]
                
                setAvailableMethods(combinedMethods)
                
                // 如果是编辑模式且已有选定方法，不重置selectedMethod
                if (!isEditing) {
                    setSelectedMethod('') // 只在添加模式下重置选中的方案
                }
            } catch (error) {
                console.error('加载器具方案失败:', error)
                setAvailableMethods([])
                if (!isEditing) {
                    setSelectedMethod('')
                }
            }
        }

        loadMethodsForEquipment()
    }, [selectedEquipment, isEditing])

    // 当选择的方案改变时，加载其默认参数用于编辑
    useEffect(() => {
        // 如果是编辑模式并且已经设置过参数，则不重新加载默认参数
        if (isEditing && hasSetEditParams) {
            return;
        }
        
        if (selectedMethod && availableMethods.length > 0) {
            const methodDetails = availableMethods.find(m => m.name === selectedMethod)
            if (methodDetails) {
                setEditableParams({
                    coffee: methodDetails.params.coffee,
                    water: methodDetails.params.water,
                    grindSize: methodDetails.params.grindSize,
                    temp: methodDetails.params.temp
                })
            } else {
                setEditableParams(null) // Reset if method not found
            }
        } else {
            setEditableParams(null) // Reset if no method selected
        }
    }, [selectedMethod, availableMethods, isEditing, hasSetEditParams])

    // 获取器具名称
    const getEquipmentName = (equipmentId: string): string => {
        // 先在预设器具中查找
        const predefinedEquipment = equipmentList.find(e => e.id === equipmentId)
        if (predefinedEquipment) return predefinedEquipment.name

        // 再在自定义器具中查找
        const customEquipment = customEquipments.find(e => e.id === equipmentId)
        if (customEquipment) return customEquipment.name

        return '未知器具'
    }

    // 编辑方案
    const handleEditMethod = (method: BeanMethod) => {
        setEditingMethodId(method.id)
        setIsEditing(true)
        setSelectedEquipment(method.equipmentId)
        setSelectedMethod(method.methodId)
        setMethodNotes(method.notes || '')
        
        // 设置参数，若无自定义参数则从可用方法中找默认值
        if (method.params) {
            setEditableParams({
                coffee: method.params.coffee as string,
                water: method.params.water as string,
                grindSize: method.params.grindSize as string,
                temp: method.params.temp as string
            })
            setHasSetEditParams(true) // 标记已设置编辑参数
        }
        
        setShowAddForm(true)
    }

    // 删除方案
    const handleDeleteMethod = async (methodId: string) => {
        if (!window.confirm('确定要删除这个方案吗？')) return

        try {
            const success = await BeanMethodManager.deleteMethod(methodId)
            if (success) {
                setMethods(prev => prev.filter(m => m.id !== methodId))
            }
        } catch (error) {
            console.error('删除方案失败:', error)
        }
    }

    // 更新方案
    const handleUpdateMethod = async () => {
        if (!coffeeBean || !selectedEquipment || !selectedMethod || !editableParams || !editingMethodId) return

        try {
            const updatedMethod = await BeanMethodManager.updateMethod(editingMethodId, {
                beanId: coffeeBean.id,
                equipmentId: selectedEquipment,
                methodId: selectedMethod,
                notes: methodNotes,
                params: editableParams
            })

            if (updatedMethod) {
                // 更新本地状态中的方案列表
                setMethods(prev => prev.map(m => 
                    m.id === editingMethodId ? updatedMethod : m
                ))
                // 重置表单
                resetForm()
            }
        } catch (error) {
            console.error('更新方案失败:', error)
        }
    }

    // 添加方案
    const handleAddMethod = async () => {
        if (!coffeeBean || !selectedEquipment || !selectedMethod || !editableParams) return

        try {
            const newMethod = await BeanMethodManager.addMethod({
                beanId: coffeeBean.id,
                equipmentId: selectedEquipment,
                methodId: selectedMethod, 
                notes: methodNotes,
                params: editableParams // Pass the edited params
            })

            if (newMethod) {
                setMethods(prev => [...prev, newMethod])
                // 重置表单
                resetForm()
            }
        } catch (error) {
            console.error('添加方案失败:', error)
        }
    }
    
    // 重置表单状态
    const resetForm = () => {
        setSelectedEquipment('')
        setSelectedMethod('')
        setMethodNotes('')
        setEditableParams(null)
        setShowAddForm(false)
        setEditingMethodId(null)
        setIsEditing(false)
        setHasSetEditParams(false) // 重置编辑参数标记
    }

    return (
        <AnimatePresence>
            {showModal && (
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
                            ease: [0.33, 1, 0.68, 1],
                            duration: 0.265
                        }}
                        className="fixed inset-x-0 bottom-0 max-h-[85vh] overflow-hidden rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl"
                    >
                        {/* 拖动条 */}
                        <div className="sticky top-0 z-10 flex justify-center py-2 bg-neutral-50 dark:bg-neutral-900">
                            <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                        </div>

                        {/* 内容区域 */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                type: "tween",
                                ease: "easeOut",
                                duration: 0.265,
                                delay: 0.05
                            }}
                            className="px-6 px-safe pb-6 pb-safe overflow-auto max-h-[calc(85vh-40px)]"
                        >
                            <div className="flex flex-col">
                                <h3 className="text-lg text-center font-medium mt-3 mb-4">
                                    {isEditing ? '编辑方案' : '常用方案'}
                                </h3>
                                
                                {/* 方案列表 */}
                                {!showAddForm && (
                                    <div className="space-y-4">
                                        {loading ? (
                                            <div className="text-center text-sm text-neutral-500 dark:text-neutral-400">
                                                加载中...
                                            </div>
                                        ) : methods.length === 0 ? (
                                            <div className="text-center text-sm text-neutral-500 dark:text-neutral-400">
                                                还没有任何常用方案
                                            </div>
                                        ) : (
                                            methods.map(method => (
                                                <div
                                                    key={method.id}
                                                    className="p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800"
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="text-sm font-medium">
                                                                {getEquipmentName(method.equipmentId)}
                                                            </div>
                                                            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                                                {method.methodId}
                                                            </div>
                                                            {/* 显示参数信息 */}
                                                            {method.params && (
                                                                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                                                    {method.params.coffee}粉 / {method.params.water}水 / {method.params.grindSize} / {method.params.temp}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center space-x-3">
                                                            <button
                                                                onClick={() => handleEditMethod(method)}
                                                                className="text-xs text-blue-500 dark:text-blue-400"
                                                            >
                                                                编辑
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteMethod(method.id)}
                                                                className="text-xs text-red-500 dark:text-red-400"
                                                            >
                                                                删除
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {method.notes && (
                                                        <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">
                                                            {method.notes}
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}

                                {/* 添加/编辑方案表单 */}
                                {showAddForm && (
                                    <div className="space-y-4">
                                        {/* 选择器具 */}
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium">选择器具</label>
                                            <select
                                                value={selectedEquipment}
                                                onChange={(e) => setSelectedEquipment(e.target.value)}
                                                className="w-full p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-sm"
                                            >
                                                <option value="">请选择器具</option>
                                                {equipmentList.map(equipment => (
                                                    <option key={equipment.id} value={equipment.id}>
                                                        {equipment.name}
                                                    </option>
                                                ))}
                                                {customEquipments.map(equipment => (
                                                    <option key={equipment.id} value={equipment.id}>
                                                        {equipment.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* 选择方案 */}
                                        {selectedEquipment && (
                                            <div className="space-y-2">
                                                <label className="block text-sm font-medium">选择方案</label>
                                                <select
                                                    value={selectedMethod}
                                                    onChange={(e) => setSelectedMethod(e.target.value)}
                                                    className="w-full p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-sm"
                                                >
                                                    <option value="">请选择方案</option>
                                                    {availableMethods.map((method, index) => (
                                                        <option key={`${method.name}-${index}`} value={method.name}>
                                                            {method.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {/* 参数编辑区域 */}
                                        {editableParams && (
                                            <>
                                                <div className="grid grid-cols-2 gap-4 mt-4">
                                                    <div className="space-y-1">
                                                        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">粉量 (g)</label>
                                                        <input 
                                                            type="text" 
                                                            inputMode="decimal"
                                                            value={editableParams.coffee.replace('g', '')} 
                                                            onChange={(e) => {
                                                                const value = e.target.value.replace(/[^0-9.]/g, '');
                                                                setEditableParams(prev => prev ? { ...prev, coffee: `${value}g` } : null)
                                                            }}
                                                            className="w-full p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-sm"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">水量 (g)</label>
                                                        <input 
                                                            type="text" 
                                                            inputMode="decimal"
                                                            value={editableParams.water.replace('g', '')} 
                                                            onChange={(e) => {
                                                                const value = e.target.value.replace(/[^0-9.]/g, '');
                                                                setEditableParams(prev => prev ? { ...prev, water: `${value}g` } : null)
                                                            }}
                                                            className="w-full p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-sm"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                   <div className="space-y-1">
                                                        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">研磨度</label>
                                                        <input 
                                                            type="text" 
                                                            value={editableParams.grindSize} 
                                                            onChange={(e) => setEditableParams(prev => prev ? { ...prev, grindSize: e.target.value } : null)}
                                                            className="w-full p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-sm"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">温度 (°C)</label>
                                                        <input 
                                                            type="text" 
                                                            value={editableParams.temp.replace('°C', '')} 
                                                            onChange={(e) => {
                                                                const value = e.target.value.replace(/[^0-9.]/g, '');
                                                                setEditableParams(prev => prev ? { ...prev, temp: `${value}°C` } : null)
                                                            }}
                                                            className="w-full p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {/* 备注 */}
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium">备注（可选）</label>
                                            <textarea
                                                value={methodNotes}
                                                onChange={(e) => setMethodNotes(e.target.value)}
                                                className="w-full p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-sm"
                                                rows={3}
                                                placeholder="添加备注..."
                                            />
                                        </div>

                                        {/* 按钮组 */}
                                        <div className="flex space-x-3">
                                            <button
                                                onClick={resetForm}
                                                className="flex-1 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-lg text-sm font-medium"
                                            >
                                                取消
                                            </button>
                                            <button
                                                onClick={isEditing ? handleUpdateMethod : handleAddMethod}
                                                disabled={!selectedEquipment || !selectedMethod}
                                                className="flex-1 py-2 bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800 rounded-lg text-sm font-medium disabled:opacity-50"
                                            >
                                                {isEditing ? '保存修改' : '确认添加'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* 添加方案按钮 */}
                                {!showAddForm && (
                                    <button
                                        onClick={() => setShowAddForm(true)}
                                        className="mt-6 w-full py-2 bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800 rounded-full text-sm font-medium"
                                    >
                                        添加方案
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}

export default BeanMethodsModal 