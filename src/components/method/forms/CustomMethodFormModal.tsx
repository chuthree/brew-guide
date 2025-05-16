'use client'

import React, { useState, useEffect } from 'react'
import CustomMethodForm from '@/components/method/forms/CustomMethodForm'
import MethodImportModal from '@/components/method/import/MethodImportModal'
import { Method, CustomEquipment } from '@/lib/core/config'
import { loadCustomEquipments } from '@/lib/managers/customEquipments'
import { v4 as uuidv4 } from 'uuid'

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
    onCloseImportForm,
}) => {
    const [validationError, setValidationError] = useState<string | null>(null)
    const [customEquipments, setCustomEquipments] = useState<CustomEquipment[]>([])
    const [currentCustomEquipment, setCurrentCustomEquipment] = useState<CustomEquipment | null>(null)

    // 加载自定义器具 - 优化为仅在首次挂载和选择新器具时加载
    useEffect(() => {
        const fetchCustomEquipments = async () => {
            if (!showCustomForm) return; // 不显示表单时不加载
            
            try {
                const equipments = await loadCustomEquipments();
                setCustomEquipments(equipments);
                
                // 直接在这里设置currentCustomEquipment，避免依赖另一个useEffect
                if (selectedEquipment) {
                    // 首先检查是否是自定义器具
                    const customEquipment = equipments.find(
                        e => e.id === selectedEquipment || e.name === selectedEquipment
                    );
                    
                    if (customEquipment) {
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
                        setCurrentCustomEquipment(virtualCustomEquipment);
                    }
                }
            } catch (error) {
                console.error('[CustomMethodFormModal] 加载自定义器具失败:', error);
            }
        };

        fetchCustomEquipments();
    }, [selectedEquipment, showCustomForm]); // 只在selectedEquipment或showCustomForm变化时重新加载

    // 根据标准器具ID获取动画类型
    const getAnimationTypeFromEquipmentId = (equipmentId: string | null): "v60" | "kalita" | "origami" | "clever" | "custom" | "espresso" => {
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
            case 'Espresso':
                return 'espresso';
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

            // 清除错误
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

    return (
        <>
            {/* 自定义方案表单 - 只在设备信息加载完成后显示 */}
            {showCustomForm && currentCustomEquipment && (
                <div className="fixed inset-0 z-50 inset-x-0 bottom-0 max-w-[500px] mx-auto h-full overflow-hidden bg-neutral-50 dark:bg-neutral-900 px-6 pt-safe-top pb-safe-bottom flex flex-col">
                    <CustomMethodForm
                        onSave={handleSaveMethod}
                        onBack={onCloseCustomForm}
                        initialMethod={editingMethod}
                        customEquipment={currentCustomEquipment}
                    />
                </div>
            )}

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