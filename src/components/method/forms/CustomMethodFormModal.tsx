'use client'

import React, { useState, useEffect } from 'react'
import CustomMethodForm, { CustomMethodFormHandle } from '@/components/method/forms/CustomMethodForm'
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
    const [_validationError, setValidationError] = useState<string | null>(null)
    const [_customEquipments, setCustomEquipments] = useState<CustomEquipment[]>([])
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

            // 保存成功后直接关闭表单，不通过历史栈返回
            // 直接调用父组件的关闭回调，避免触发 popstate 事件导致表单返回上一步
            onCloseCustomForm();

            return methodWithId.id;
        } catch (error) {
            console.error('保存方案失败:', error);
            setValidationError('保存失败，请重试');
            return null;
        }
    }

    // 创建表单引用，用于调用表单的返回方法
    const formRef = React.useRef<CustomMethodFormHandle | null>(null)

    // 自定义方案表单历史栈管理 - 支持硬件返回键和浏览器返回按钮
    useEffect(() => {
        if (!showCustomForm) {
            // 模态框关闭时，确保清理历史栈中的模态框状态
            if (window.history.state?.modal === 'custom-method-form') {
                window.history.replaceState(null, '')
            }
            return
        }

        // 添加表单的历史记录
        window.history.pushState({ modal: 'custom-method-form' }, '')

        // 监听返回事件
        const handlePopState = () => {
            // 设置全局标识，表示模态框正在处理返回事件
            window.__modalHandlingBack = true;
            
            // 询问表单是否还有上一步
            const canGoBack = formRef.current?.handleBackStep()
            if (canGoBack) {
                // 表单内部处理了返回（返回上一步），重新添加历史记录
                window.history.pushState({ modal: 'custom-method-form' }, '')
            } else {
                // 表单已经在第一步，直接调用父组件关闭回调（避免双重历史栈操作）
                // 这里直接调用父组件传入的 onCloseCustomForm，而不是 handleCloseCustomForm
                onCloseCustomForm()
            }
            
            // 清除标识（延迟清除，确保其他事件处理器能看到）
            setTimeout(() => {
                window.__modalHandlingBack = false;
            }, 50);
        }

        window.addEventListener('popstate', handlePopState)

        return () => {
            window.removeEventListener('popstate', handlePopState)
        }
    }, [showCustomForm, onCloseCustomForm])

    // 导入方案模态框历史栈管理
    useEffect(() => {
        if (!showImportForm) {
            // 模态框关闭时，确保清理历史栈中的模态框状态
            if (window.history.state?.modal === 'method-import-form') {
                window.history.replaceState(null, '')
            }
            return
        }

        // 如果历史栈中有自定义方案表单记录，用 replaceState 替换它
        if (window.history.state?.modal === 'custom-method-form') {
            window.history.replaceState({ modal: 'method-import-form' }, '')
        } else {
            // 添加导入表单的历史记录
            window.history.pushState({ modal: 'method-import-form' }, '')
        }

        const handlePopState = () => {
            window.__modalHandlingBack = true;
            onCloseImportForm();
            setTimeout(() => {
                window.__modalHandlingBack = false;
            }, 50);
        }
        window.addEventListener('popstate', handlePopState)

        return () => window.removeEventListener('popstate', handlePopState)
    }, [showImportForm, onCloseImportForm])

    // 处理自定义方案表单关闭
    const handleCloseCustomForm = () => {
        // 如果历史栈中有我们添加的条目，触发返回
        if (window.history.state?.modal === 'custom-method-form') {
            window.history.back()
        } else {
            // 否则直接关闭
            onCloseCustomForm()
        }
    }

    // 处理导入表单关闭
    const handleCloseImportForm = () => {
        // 如果历史栈中有我们添加的条目，触发返回
        if (window.history.state?.modal === 'method-import-form') {
            window.history.back()
        } else {
            // 否则直接关闭
            onCloseImportForm()
        }
    }

    return (
        <>
            {/* 自定义方案表单 - 只在设备信息加载完成后显示 */}
            {showCustomForm && currentCustomEquipment && (
                <div data-modal="custom-method-form" className="fixed inset-0 z-50 inset-x-0 bottom-0 max-w-[500px] mx-auto h-full overflow-hidden bg-neutral-50 dark:bg-neutral-900 px-6 pt-safe-top pb-safe-bottom flex flex-col">
                    <CustomMethodForm
                        ref={formRef}
                        onSave={handleSaveMethod}
                        onBack={handleCloseCustomForm}
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
                    // 不在这里关闭，让MethodImportModal内部的handleImport来处理关闭
                    // handleCloseImportForm();
                }}
                onClose={handleCloseImportForm}
                existingMethods={selectedEquipment && customMethods[selectedEquipment] ? customMethods[selectedEquipment] : []}
                customEquipment={currentCustomEquipment || undefined}
            />
        </>
    )
}

export default CustomMethodFormModal