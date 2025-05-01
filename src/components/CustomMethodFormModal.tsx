'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import CustomMethodForm from '@/components/CustomMethodForm'
import MethodImportModal from '@/components/MethodImportModal'
import { Method, CustomEquipment } from '@/lib/config'
import { loadCustomEquipments } from '@/lib/customEquipments'
import { SettingsOptions } from '@/components/Settings'
import { v4 as uuidv4 } from 'uuid'
import { exportMethod, copyToClipboard } from '@/lib/exportUtils'

// Use SettingsOptions as SettingsType
type SettingsType = SettingsOptions;

interface CustomMethodFormModalProps {
    showCustomForm: boolean
    showImportForm: boolean
    editingMethod?: Method
    selectedEquipment: string | null
    customMethods: Record<string, Method[]>
    onSaveCustomMethod: (method: Method) => void
    onCloseCustomForm: () => void
    onCloseImportForm: () => void
    _onEditMethod: (method: Method) => void
    _onDeleteMethod: (method: Method) => void
    _settings: SettingsType
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
    _onEditMethod,
    _onDeleteMethod,
    _settings
}) => {
    const [_formData, setFormData] = useState<Partial<Method>>({})
    const [_validationError, setValidationError] = useState<string | null>(null)
    const [_customEquipments, setCustomEquipments] = useState<CustomEquipment[]>([])
    const [currentCustomEquipment, setCurrentCustomEquipment] = useState<CustomEquipment | null>(null)
    const [isLoadingEquipments, setIsLoadingEquipments] = useState<boolean>(false)

    // 加载自定义器具 - 优化为仅在首次挂载和选择新器具时加载
    useEffect(() => {
        const fetchCustomEquipments = async () => {
            if (!showCustomForm) return; // 不显示表单时不加载
            
            setIsLoadingEquipments(true);
            try {
                console.log("[CustomMethodFormModal] 开始加载自定义器具...");
                const equipments = await loadCustomEquipments();
                console.log(`[CustomMethodFormModal] 加载了 ${equipments.length} 个自定义器具`);
                setCustomEquipments(equipments);
                
                // 直接在这里设置currentCustomEquipment，避免依赖另一个useEffect
                if (selectedEquipment) {
                    // 首先检查是否是自定义器具
                    const customEquipment = equipments.find(
                        e => e.id === selectedEquipment || e.name === selectedEquipment
                    );
                    
                    if (customEquipment) {
                        console.log(`[CustomMethodFormModal] 找到匹配的自定义器具: ${customEquipment.name}`);
                        setCurrentCustomEquipment(customEquipment);
                    } else {
                        // 如果不是自定义器具，创建一个虚拟的自定义器具对象，基于标准器具
                        const virtualCustomEquipment: CustomEquipment = {
                            id: selectedEquipment,
                            name: selectedEquipment,
                            description: '标准器具',
                            isCustom: true,
                            animationType: getAnimationTypeFromEquipmentId(selectedEquipment),
                            hasValve: selectedEquipment === 'CleverDripper'
                        };
                        console.log(`[CustomMethodFormModal] 创建了虚拟自定义器具: ${virtualCustomEquipment.name}`);
                        setCurrentCustomEquipment(virtualCustomEquipment);
                    }
                }
            } catch (error) {
                console.error('[CustomMethodFormModal] 加载自定义器具失败:', error);
            } finally {
                setIsLoadingEquipments(false);
            }
        };

        fetchCustomEquipments();
    }, [selectedEquipment, showCustomForm]); // 只在selectedEquipment或showCustomForm变化时重新加载

    // 根据标准器具ID获取动画类型
    const getAnimationTypeFromEquipmentId = (equipmentId: string | null): "v60" | "kalita" | "origami" | "clever" | "custom" => {
        if (!equipmentId) return "custom";
        
        switch (equipmentId) {
            case 'V60':
                return 'v60';
            case 'Kalita':
                return 'kalita';
            case 'Origami':
                return 'origami';
            case 'CleverDripper':
                return 'clever';
            default:
                return 'custom';
        }
    };

    // 根据表单数据保存自定义方法
    const handleSaveMethod = async (method: Method) => {
        try {
            // 检查必要字段
            if (!method.name) {
                setValidationError('请输入方案名称');
                return null;
            }

            if (!method.params?.coffee || !method.params?.water) {
                setValidationError('请输入咖啡粉量和水量');
                return null;
            }

            if (!method.params.stages || method.params.stages.length === 0) {
                setValidationError('至少需要添加一个阶段');
                return null;
            }

            // 确保有唯一ID
            const methodWithId: Method = {
                ...method,
                id: method.id || uuidv4()
            };

            // 直接调用父组件的保存方法并传递完整的方法对象
            onSaveCustomMethod(methodWithId);

            // 清除数据和错误
            setFormData({});
            setValidationError(null);

            // 关闭表单
            onCloseCustomForm();

            return methodWithId.id;
        } catch (error) {
            console.error('保存方案失败:', error);
            setValidationError('保存失败，请重试');
            return null;
        }
    }

    // 在 CustomMethodFormModal 组件内添加导出功能
    const _handleExport = async (method: Method) => {
        try {
            const exportData = exportMethod(method);
            const success = await copyToClipboard(exportData);
            if (success) {
                alert('方案数据已复制到剪贴板');
            } else {
                alert('复制失败，请重试');
            }
        } catch (error) {
            console.error('导出方案失败:', error);
            alert('导出失败，请重试');
        }
    };

    return (
        <>
            {/* 自定义方案表单 - 只在设备信息加载完成后显示 */}
            <AnimatePresence>
                {showCustomForm && !isLoadingEquipments && currentCustomEquipment && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.265 }}
                        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                onCloseCustomForm();
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
                            className="absolute inset-x-0 bottom-0 max-w-[500px] mx-auto h-full overflow-hidden  bg-neutral-50 dark:bg-neutral-900 shadow-xl pt-safe-top"
                        >

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
                                className="px-6 overflow-auto"
                            >
                                <CustomMethodForm
                                    onSave={handleSaveMethod}
                                    onBack={onCloseCustomForm}
                                    initialMethod={editingMethod}
                                    customEquipment={currentCustomEquipment}
                                />
                            </motion.div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 加载中状态 */}
            <AnimatePresence>
                {showCustomForm && isLoadingEquipments && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.265 }}
                        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center"
                    >
                        <div className="bg-white dark:bg-neutral-800 p-6 rounded-lg max-w-md w-full mx-4 text-center">
                            <div className="inline-block w-8 h-8 border-4 border-neutral-300 dark:border-neutral-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mb-3"></div>
                            <p className="text-neutral-700 dark:text-neutral-300">
                                正在加载器具信息...
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 如果表单打开但没有获取到器具信息，显示错误消息 */}
            <AnimatePresence>
                {showCustomForm && !isLoadingEquipments && !currentCustomEquipment && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.265 }}
                        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                onCloseCustomForm();
                            }
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            className="bg-white dark:bg-neutral-800 p-6 rounded-lg max-w-md w-full mx-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-medium mb-2 text-red-600 dark:text-red-400">
                                无法创建方案
                            </h3>
                            <p className="mb-4 text-neutral-700 dark:text-neutral-300">
                                未能找到有效的器具信息。请先选择一个器具，然后再尝试创建方案。
                            </p>
                            <button
                                onClick={onCloseCustomForm}
                                className="w-full py-2 bg-neutral-200 dark:bg-neutral-700 rounded-md text-neutral-800 dark:text-neutral-200"
                            >
                                关闭
                            </button>
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
                customEquipment={currentCustomEquipment || undefined}
            />
        </>
    )
}

export default CustomMethodFormModal 