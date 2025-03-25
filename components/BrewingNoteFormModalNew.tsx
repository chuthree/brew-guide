'use client'

import React, { useState, useEffect } from 'react'
import BrewingNoteForm from '@/components/BrewingNoteForm'
import type { BrewingNoteData, CoffeeBean } from '@/app/types'
import { equipmentList, brewingMethods } from '@/lib/config'
import SteppedFormModal, { Step } from '@/components/SteppedFormModal'
import { type Method } from '@/lib/config'
import { Storage } from '@/lib/storage'
import { CoffeeBeanManager } from '@/lib/coffeeBeanManager'

interface BrewingNoteFormModalNewProps {
    showForm: boolean
    initialNote?: Partial<BrewingNoteData> & {
        coffeeBean?: CoffeeBean | null;
        id?: string;
    }
    onSave: (note: BrewingNoteData) => void
    onClose: () => void
    showOptimizationByDefault?: boolean
    skipToLastStep?: boolean
}

const BrewingNoteFormModalNew: React.FC<BrewingNoteFormModalNewProps> = ({
    showForm,
    initialNote,
    onSave,
    onClose,
    showOptimizationByDefault = false,
    skipToLastStep = false
}) => {
    // 添加咖啡豆选择状态
    const [selectedCoffeeBean, setSelectedCoffeeBean] = useState<CoffeeBean | null>(initialNote?.coffeeBean || null);
    const [coffeeBeans, setCoffeeBeans] = useState<CoffeeBean[]>([]);

    // 添加滤杯和方案选择状态
    const [selectedEquipment, setSelectedEquipment] = useState<string>(initialNote?.equipment || '');
    const [selectedMethod, setSelectedMethod] = useState<string>(initialNote?.method || '');
    const [methodType, setMethodType] = useState<'common' | 'custom'>('common');
    const [customMethods, setCustomMethods] = useState<Method[]>([]);

    // 处理关闭，确保重置所有状态
    const handleClose = () => {
        // 重置所有状态
        setSelectedCoffeeBean(null);
        setSelectedEquipment('');
        setSelectedMethod('');
        setMethodType('common');
        // 调用原始的onClose函数
        onClose();
    };

    // 加载咖啡豆列表
    useEffect(() => {
        const loadCoffeeBeans = async () => {
            try {
                const beans = await CoffeeBeanManager.getAllBeans();
                setCoffeeBeans(beans);
            } catch (error) {
                console.error('加载咖啡豆失败:', error);
            }
        };

        // 当表单显示时加载咖啡豆列表
        if (showForm) {
            loadCoffeeBeans();
        }
    }, [showForm]);

    // 根据选择的滤杯和方案类型生成可用的方案列表
    const availableMethods = selectedEquipment ?
        (methodType === 'common' ? brewingMethods[selectedEquipment] || [] :
            customMethods) : [];

    // 加载自定义方案
    useEffect(() => {
        const fetchCustomMethods = async () => {
            try {
                // 从localStorage加载自定义方案
                const customMethodsStr = await Storage.get('customMethods');
                if (customMethodsStr) {
                    const parsedData = JSON.parse(customMethodsStr);
                    // 确保解析的数据是数组
                    const methods = Array.isArray(parsedData) ? parsedData : [];

                    // 过滤出与当前选择设备相关的方案
                    const filteredMethods = methods.filter(
                        method => {
                            // 检查是否有适用于当前设备的方法
                            if (method && method.id && typeof method.params === 'object') {
                                return method.params.coffee && method.name;
                            }
                            return false;
                        }
                    );
                    setCustomMethods(filteredMethods);
                }
            } catch (error) {
                console.error('加载自定义方案失败:', error);
                // 出错时设置为空数组
                setCustomMethods([]);
            }
        };

        fetchCustomMethods();
    }, []);

    // 当表单打开状态变化时初始化值
    useEffect(() => {
        if (showForm) {
            // 打开表单时，初始化咖啡豆选择状态
            // 如果initialNote中有coffeeBean则使用，否则默认为null（不选择）
            setSelectedCoffeeBean(initialNote?.coffeeBean || null);

            // 打开表单时，初始化值
            const equipment = initialNote?.equipment || '';
            setSelectedEquipment(equipment);
            setSelectedMethod(initialNote?.method || '');

            // 判断初始方案是通用方案还是自定义方案
            if (equipment && initialNote?.method) {
                // 检查是否在通用方案中
                const isCommonMethod = brewingMethods[equipment]?.some(
                    m => m.name === initialNote.method
                );

                // 检查是否在自定义方案中
                const isCustomMethod = customMethods.some(
                    m => m.id === initialNote.method || m.name === initialNote.method
                );

                if (isCustomMethod) {
                    setMethodType('custom');
                } else if (isCommonMethod) {
                    setMethodType('common');
                } else {
                    setMethodType('common'); // 默认为通用方案
                }
            } else {
                setMethodType('common'); // 默认为通用方案
            }
        }
        // 从依赖数组中移除brewingMethods，因为它是一个常量
    }, [showForm, initialNote, customMethods]);

    // 根据选中的方案获取默认参数
    const getMethodParams = () => {
        if (selectedEquipment && selectedMethod) {
            const methodObj = availableMethods.find(m =>
                methodType === 'common' ? m.name === selectedMethod : m.id === selectedMethod);
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

    // 处理滤杯选择
    const handleEquipmentSelect = (equipmentId: string) => {
        if (equipmentId === selectedEquipment) return; // 如果选择的是同一个滤杯，不做任何处理

        // 设置新的滤杯选择
        setSelectedEquipment(equipmentId);

        // 检查通用方案是否可用
        const commonMethodsAvailable = brewingMethods[equipmentId]?.length > 0;
        // 检查自定义方案是否可用
        const customMethodsAvailable = customMethods.length > 0;

        // 保持当前的方案类型，只在必要时切换
        if (methodType === 'common') {
            // 如果当前是通用方案模式
            if (commonMethodsAvailable) {
                // 选择第一个通用方案
                setSelectedMethod(brewingMethods[equipmentId][0].name);
            } else if (customMethodsAvailable) {
                // 如果没有通用方案但有自定义方案，切换到自定义方案
                setMethodType('custom');
                setSelectedMethod(customMethods[0].id || '');
            } else {
                // 如果都没有，清空选择
                setSelectedMethod('');
            }
        } else {
            // 当前是自定义方案模式
            if (customMethodsAvailable) {
                // 选择第一个自定义方案
                setSelectedMethod(customMethods[0].id || '');
            } else if (commonMethodsAvailable) {
                // 如果没有自定义方案但有通用方案，切换到通用方案
                setMethodType('common');
                setSelectedMethod(brewingMethods[equipmentId][0].name);
            } else {
                // 如果都没有，清空选择
                setSelectedMethod('');
            }
        }
    };

    // 切换方案类型
    const handleMethodTypeChange = (type: 'common' | 'custom') => {
        // 只有当类型实际变化时才执行操作
        if (type !== methodType) {
            setMethodType(type);

            // 确保有选择的滤杯
            if (!selectedEquipment) return;

            // 当切换方案类型时，根据新类型重置选中的方案
            if (type === 'common') {
                // 切换到通用方案
                if (brewingMethods[selectedEquipment]?.length > 0) {
                    setSelectedMethod(brewingMethods[selectedEquipment][0].name);
                } else {
                    setSelectedMethod(''); // 没有通用方案，清空选择
                }
            } else {
                // 切换到自定义方案
                if (customMethods.length > 0) {
                    setSelectedMethod(customMethods[0].id || '');
                } else {
                    setSelectedMethod(''); // 没有自定义方案，清空选择
                }
            }
        }
    };

    // 计算咖啡粉量
    const getCoffeeAmount = () => {
        if (selectedMethod && availableMethods.length > 0) {
            const method = availableMethods.find(m => {
                return methodType === 'common' ?
                    m.name === selectedMethod :
                    (m.id === selectedMethod || m.name === selectedMethod);
            });

            if (method && method.params.coffee) {
                const match = method.params.coffee.match(/(\d+(\.\d+)?)/);
                if (match) {
                    return parseFloat(match[0]);
                }
            }
        }
        return 0;
    };

    // 设置默认值，确保initialNote有必要的字段
    const getDefaultNote = (): Partial<BrewingNoteData> => {
        const params = getMethodParams();
        return {
            equipment: selectedEquipment,
            method: selectedMethod,
            coffeeBean: selectedCoffeeBean,
            coffeeBeanInfo: selectedCoffeeBean ? {
                name: selectedCoffeeBean.name || '',
                roastLevel: selectedCoffeeBean.roastLevel || '中度烘焙',
                roastDate: selectedCoffeeBean.roastDate || ''
            } : {
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

    // 当方案选择完成后，准备冲煮笔记表单
    const handleStepComplete = () => {
        // 在点击"完成"按钮时，手动触发表单提交
        const form = document.querySelector('form');
        if (form) {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
    };

    // 处理保存笔记，减少咖啡豆剩余量
    const handleSaveNote = (note: BrewingNoteData) => {
        // 创建要保存的完整笔记
        const completeNote: BrewingNoteData = {
            ...note,
            equipment: selectedEquipment,
            method: selectedMethod
        };

        // 只有当选择了咖啡豆时才减少剩余量和记录详细信息
        if (selectedCoffeeBean?.id) {
            // 记录咖啡豆关联信息，使用索引签名
            completeNote["beanId"] = selectedCoffeeBean.id;
            completeNote["coffeeBean"] = selectedCoffeeBean;

            // 减少咖啡豆剩余量
            const coffeeAmount = getCoffeeAmount();
            if (coffeeAmount > 0) {
                CoffeeBeanManager.updateBeanRemaining(selectedCoffeeBean.id, coffeeAmount)
                    .catch(error => console.error('减少咖啡豆剩余量失败:', error));
            }
        }

        // 关闭表单后调用onSave回调函数
        // 关闭表单很重要，防止重复提交
        handleClose();

        // 保存笔记
        onSave(completeNote);
    };

    // 步骤1: 选择咖啡豆内容
    const coffeeBeanStepContent = (
        <div className="space-y-6 py-4">
            <div className="space-y-2">
                <label className="block text-sm text-neutral-700 dark:text-neutral-300">
                    选择咖啡豆
                </label>
                <div className="space-y-2">
                    {/* 添加不选择咖啡豆的选项 */}
                    <button
                        type="button"
                        onClick={() => setSelectedCoffeeBean(null)}
                        className={`w-full p-3 rounded-md text-sm text-left transition ${selectedCoffeeBean === null
                            ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                            }`}
                    >
                        <div className="font-medium">不选择咖啡豆</div>
                        <div className="text-xs mt-1 opacity-80">
                            不记录咖啡豆信息，也不会减少咖啡豆剩余量
                        </div>
                    </button>

                    {coffeeBeans.length > 0 ? (
                        coffeeBeans.map((bean) => (
                            <button
                                key={bean.id}
                                type="button"
                                onClick={() => setSelectedCoffeeBean(bean)}
                                className={`w-full p-3 rounded-md text-sm text-left transition ${selectedCoffeeBean?.id === bean.id
                                    ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800'
                                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                                    }`}
                            >
                                <div className="font-medium">{bean.name}</div>
                                <div className="text-xs mt-1 opacity-80 flex flex-wrap gap-1">
                                    <span>{bean.roastLevel || '未知烘焙度'}</span>
                                    <span>·</span>
                                    <span>剩余: {bean.remaining}g</span>
                                    {bean.roastDate && (
                                        <>
                                            <span>·</span>
                                            <span>烘焙日期: {bean.roastDate}</span>
                                        </>
                                    )}
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="text-sm text-neutral-500 dark:text-neutral-400 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-md">
                            没有可用的咖啡豆，请先添加咖啡豆
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // 步骤2：选择滤杯内容
    const equipmentStepContent = (
        <div className="space-y-6 py-4">
            <div className="space-y-2">
                <label className="block text-sm text-neutral-700 dark:text-neutral-300">
                    选择滤杯
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {equipmentList.map((equipment) => (
                        <button
                            key={equipment.id}
                            type="button"
                            onClick={() => handleEquipmentSelect(equipment.id)}
                            className={`p-3 rounded-md text-sm text-left transition ${selectedEquipment === equipment.id
                                ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                                }`}
                        >
                            <div className="font-medium">{equipment.name}</div>
                            <div className="text-xs mt-1 line-clamp-1 opacity-80">
                                {equipment.description[0]}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    // 步骤2：选择冲煮方案内容
    const methodStepContent = (
        <div className="space-y-6 py-4">
            {/* 方案类型选择器 */}
            <div className="flex justify-start items-center mb-4 border-b border-neutral-200 dark:border-neutral-800 pb-2">
                <button
                    onClick={() => handleMethodTypeChange('common')}
                    className={`text-[13px] transition-colors ${methodType === 'common'
                        ? 'text-neutral-800 dark:text-neutral-100 font-medium'
                        : 'text-neutral-400 dark:text-neutral-500'
                        }`}
                >
                    通用方案
                </button>
                <span className="mx-3 text-neutral-300 dark:text-neutral-600 text-xs">|</span>
                <button
                    onClick={() => handleMethodTypeChange('custom')}
                    className={`text-[13px] transition-colors ${methodType === 'custom'
                        ? 'text-neutral-800 dark:text-neutral-100 font-medium'
                        : 'text-neutral-400 dark:text-neutral-500'
                        }`}
                >
                    自定义方案
                </button>
            </div>

            <div className="space-y-2">
                <label className="block text-sm text-neutral-700 dark:text-neutral-300">
                    选择{methodType === 'common' ? '通用' : '自定义'}冲煮方案
                </label>
                {selectedEquipment ? (
                    <div className="space-y-2">
                        {availableMethods.length > 0 ? (
                            availableMethods.map((method) => (
                                <button
                                    key={methodType === 'common' ? method.name : (method.id || method.name)}
                                    type="button"
                                    onClick={() => setSelectedMethod(methodType === 'common' ? method.name : (method.id || method.name))}
                                    className={`w-full p-3 rounded-md text-sm text-left transition ${(methodType === 'common' && selectedMethod === method.name) ||
                                        (methodType === 'custom' && (selectedMethod === method.id || selectedMethod === method.name))
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
                                </button>
                            ))
                        ) : (
                            <div className="text-sm text-neutral-500 dark:text-neutral-400 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-md">
                                {methodType === 'common' ? '没有可用的通用冲煮方案' : '没有可用的自定义冲煮方案'}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-sm text-neutral-500 dark:text-neutral-400 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-md">
                        请先选择滤杯
                    </div>
                )}
            </div>
        </div>
    );

    // 步骤3：冲煮笔记表单内容
    const noteFormStepContent = (
        <div>
            <BrewingNoteForm
                id={initialNote?.id}
                isOpen={true}
                onClose={() => { }} // 不提供关闭功能，由模态框控制
                onSave={handleSaveNote}
                initialData={getDefaultNote()}
                showOptimizationByDefault={showOptimizationByDefault}
            />
        </div>
    );

    // 定义步骤
    const steps: Step[] = [
        {
            id: 'coffeeBean',
            label: '选择咖啡豆',
            content: coffeeBeanStepContent,
            isValid: true // 咖啡豆选择为可选，所以总是有效
        },
        {
            id: 'equipment',
            label: '选择滤杯',
            content: equipmentStepContent,
            isValid: !!selectedEquipment
        },
        {
            id: 'method',
            label: '选择方案',
            content: methodStepContent,
            isValid: !!selectedMethod
        },
        {
            id: 'note-form',
            label: '冲煮笔记',
            content: noteFormStepContent,
            isValid: true
        }
    ];

    // 获取表单标题
    const getFormTitle = () => {
        if (skipToLastStep) {
            if (showOptimizationByDefault) {
                return "优化冲煮参数";
            }
            return initialNote?.id ? "编辑冲煮笔记" : "创建冲煮笔记";
        }
        return "创建冲煮笔记";
    };

    return (
        <SteppedFormModal
            showForm={showForm}
            onClose={handleClose}
            onComplete={handleStepComplete}
            steps={steps}
            initialStep={skipToLastStep ? steps.length - 1 : 0}
            title={getFormTitle()}
            preserveState={false}
        />
    );
};

export default BrewingNoteFormModalNew; 