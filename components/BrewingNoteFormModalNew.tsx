'use client'

import React, { useState, useEffect } from 'react'
import BrewingNoteForm from '@/components/BrewingNoteForm'
import type { BrewingNoteData, CoffeeBean } from '@/app/types'
import { equipmentList, brewingMethods } from '@/lib/config'
import SteppedFormModal, { Step } from '@/components/SteppedFormModal'
import { type Method, type CustomEquipment } from '@/lib/config'
import { Storage } from '@/lib/storage'
import { CoffeeBeanManager } from '@/lib/coffeeBeanManager'
import { loadCustomEquipments } from '@/lib/customEquipments'

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

    // 添加器具和方案选择状态
    const [selectedEquipment, setSelectedEquipment] = useState<string>(initialNote?.equipment || '');
    const [selectedMethod, setSelectedMethod] = useState<string>(initialNote?.method || '');
    const [methodType, setMethodType] = useState<'common' | 'custom'>('common');
    const [customMethods, setCustomMethods] = useState<Method[]>([]);
    const [customEquipments, setCustomEquipments] = useState<CustomEquipment[]>([]);

    // 添加本地状态以管理输入值
    const [coffeeAmount, setCoffeeAmount] = useState<string>('15');
    const [ratioAmount, setRatioAmount] = useState<string>('15');
    const [waterAmount, setWaterAmount] = useState<string>('225g');

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

    // 加载自定义器具列表
    useEffect(() => {
        const fetchCustomEquipments = async () => {
            try {
                const equipments = await loadCustomEquipments();
                setCustomEquipments(equipments);
            } catch (error) {
                console.error('加载自定义器具失败:', error);
            }
        };

        // 当表单显示时加载自定义器具列表
        if (showForm) {
            fetchCustomEquipments();
        }
    }, [showForm]);

    // 根据选择的器具和方案类型生成可用的方案列表
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

                    // 检查是否是按设备分组的对象格式
                    if (typeof parsedData === 'object' && !Array.isArray(parsedData)) {
                        // 如果有选择的设备，则获取对应设备的方案
                        if (selectedEquipment && parsedData[selectedEquipment]) {
                            setCustomMethods(parsedData[selectedEquipment]);
                        } else {
                            // 如果没有选择设备或没有对应设备的方案，设置为空数组
                            setCustomMethods([]);
                        }
                    } else {
                        // 处理旧版扁平数组格式
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
                }
            } catch (error) {
                console.error('加载自定义方案失败:', error);
                // 出错时设置为空数组
                setCustomMethods([]);
            }
        };

        fetchCustomMethods();
    }, [selectedEquipment]);

    // 当表单打开状态变化时初始化值
    useEffect(() => {
        if (showForm) {
            // 打开表单时，初始化咖啡豆选择状态
            // 如果initialNote中有coffeeBean则使用，否则默认为null（不选择）
            setSelectedCoffeeBean(initialNote?.coffeeBean || null);

            // 打开表单时，初始化值
            const equipment = initialNote?.equipment || '';
            setSelectedEquipment(equipment);

            // 如果有设备，加载该设备的自定义方案
            if (equipment) {
                const loadCustomMethods = async () => {
                    try {
                        const customMethodsStr = await Storage.get('customMethods');
                        if (customMethodsStr) {
                            const parsedData = JSON.parse(customMethodsStr);
                            if (typeof parsedData === 'object' && !Array.isArray(parsedData) && parsedData[equipment]) {
                                setCustomMethods(parsedData[equipment]);
                            } else {
                                setCustomMethods([]);
                            }
                        }
                    } catch (error) {
                        console.error('初始化自定义方案失败:', error);
                        setCustomMethods([]);
                    }
                };

                loadCustomMethods().then(() => {
                    setSelectedMethod(initialNote?.method || '');

                    // 判断初始方案是通用方案还是自定义方案
                    if (equipment && initialNote?.method) {
                        // 检查是否在通用方案中
                        const isCommonMethod = brewingMethods[equipment]?.some(
                            m => m.name === initialNote.method
                        );

                        // 检查当前loadCustomMethods加载的自定义方案中是否包含初始方案
                        // 避免使用外部的customMethods状态，而是使用函数内部的方案列表
                        const isCustomMethod = (loadedMethods: Method[]) => {
                            return loadedMethods.some(
                                m => m.id === initialNote.method || m.name === initialNote.method
                            );
                        };

                        // 获取加载的自定义方案并判断
                        const checkCustomMethods = async () => {
                            const customMethodsStr = await Storage.get('customMethods');
                            let methodsToCheck: Method[] = [];

                            if (customMethodsStr) {
                                const parsedData = JSON.parse(customMethodsStr);
                                if (typeof parsedData === 'object' && !Array.isArray(parsedData) && parsedData[equipment]) {
                                    methodsToCheck = parsedData[equipment];
                                }
                            }

                            if (methodsToCheck.length > 0 && isCustomMethod(methodsToCheck)) {
                                setMethodType('custom');
                            } else if (isCommonMethod) {
                                setMethodType('common');
                            } else {
                                setMethodType('common'); // 默认为通用方案
                            }
                        };

                        // 执行检查
                        checkCustomMethods();
                    } else {
                        setMethodType('common'); // 默认为通用方案
                    }
                });
            } else {
                setSelectedMethod(initialNote?.method || '');
                setMethodType('common'); // 默认为通用方案
            }
        }
        // 从依赖数组中移除brewingMethods，因为它是一个常量
    }, [showForm, initialNote]);

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

    // 处理器具选择
    const handleEquipmentSelect = (equipmentId: string) => {
        if (equipmentId === selectedEquipment) return; // 如果选择的是同一个器具，不做任何处理

        // 设置新的器具选择
        setSelectedEquipment(equipmentId);

        // 检查是否是自定义预设器具
        const customEquipment = customEquipments.find(e => e.id === equipmentId);
        const isCustomPresetEquipment = customEquipment?.animationType === 'custom';

        // 如果是自定义预设器具，强制设置为自定义方案模式
        if (isCustomPresetEquipment) {
            setMethodType('custom');
        }

        // 检查通用方案是否可用
        const commonMethodsAvailable = !isCustomPresetEquipment && brewingMethods[equipmentId]?.length > 0;

        // 加载该设备的自定义方案 - 使用新的API loadCustomMethodsForEquipment
        const loadCustomMethods = async () => {
            try {
                // 直接使用设备ID加载方案，而不是依赖自定义方法对象
                const methodsModule = await import('@/lib/customMethods');
                const methods = await methodsModule.loadCustomMethodsForEquipment(equipmentId);
                if (methods && methods.length > 0) {
                    setCustomMethods(methods);
                    return true;
                }
                
                // 如果直接通过ID找不到方案，检查旧版存储
                const customMethodsStr = await Storage.get('customMethods');
                if (customMethodsStr) {
                    const parsedData = JSON.parse(customMethodsStr);
                    if (typeof parsedData === 'object' && !Array.isArray(parsedData) && parsedData[equipmentId]) {
                        setCustomMethods(parsedData[equipmentId]);
                        return parsedData[equipmentId].length > 0;
                    }
                }
                
                // 如果都没找到，清空当前自定义方案
                setCustomMethods([]);
                return false;
            } catch (error) {
                console.error('加载设备自定义方案失败:', error);
                setCustomMethods([]);
                return false;
            }
        };

        // 异步加载自定义方案并更新UI
        loadCustomMethods().then(customMethodsAvailable => {
            // 如果是自定义预设器具，只能使用自定义方案
            if (isCustomPresetEquipment) {
                if (customMethodsAvailable && customMethods.length > 0) {
                    setSelectedMethod(customMethods[0]?.id || customMethods[0]?.name || '');
                } else {
                    setSelectedMethod('');
                }
                return;
            }

            // 保持当前的方案类型，只在必要时切换
            if (methodType === 'common') {
                // 如果当前是通用方案模式
                if (commonMethodsAvailable) {
                    // 选择第一个通用方案
                    setSelectedMethod(brewingMethods[equipmentId][0].name);
                } else if (customMethodsAvailable && customMethods.length > 0) {
                    // 如果没有通用方案但有自定义方案，切换到自定义方案
                    setMethodType('custom');
                    setSelectedMethod(customMethods[0]?.id || customMethods[0]?.name || '');
                } else {
                    // 如果都没有，清空选择
                    setSelectedMethod('');
                }
            } else {
                // 当前是自定义方案模式
                if (customMethodsAvailable && customMethods.length > 0) {
                    // 选择第一个自定义方案
                    setSelectedMethod(customMethods[0]?.id || customMethods[0]?.name || '');
                } else if (commonMethodsAvailable) {
                    // 如果没有自定义方案但有通用方案，切换到通用方案
                    setMethodType('common');
                    setSelectedMethod(brewingMethods[equipmentId][0].name);
                } else {
                    // 如果都没有，清空选择
                    setSelectedMethod('');
                }
            }
        });
    };

    // 切换方案类型
    const handleMethodTypeChange = (type: 'common' | 'custom') => {
        // 检查是否是自定义预设器具
        if (selectedEquipment) {
            const customEquipment = customEquipments.find(e => e.id === selectedEquipment);
            const isCustomPresetEquipment = customEquipment?.animationType === 'custom';

            // 如果是自定义预设器具，只能使用自定义方案
            if (isCustomPresetEquipment && type === 'common') {
                console.log('自定义预设器具仅支持自定义方案');
                return;
            }
        }

        // 只有当类型实际变化时才执行操作
        if (type !== methodType) {
            setMethodType(type);

            // 确保有选择的器具
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
                    setSelectedMethod(customMethods[0]?.id || customMethods[0]?.name || '');
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
        // 检查是否是新建笔记还是编辑现有笔记
        const isNewNote = !initialNote?.id;
        
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
            // 只在编辑现有笔记时传递ID
            ...(isNewNote ? {} : { id: initialNote?.id })
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
        // 获取方案名称而非ID
        let methodName = selectedMethod;
        if (methodType === 'custom' && selectedMethod) {
            // 查找自定义方案获取其名称
            const methodObj = availableMethods.find(m =>
                m.id === selectedMethod || m.name === selectedMethod
            );
            if (methodObj) {
                methodName = methodObj.name;
            }
        }

        // 创建要保存的完整笔记
        const completeNote: BrewingNoteData = {
            ...note,
            equipment: selectedEquipment,
            method: methodName
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

        // 先保存笔记
        onSave(completeNote);
        
        // 保存完成后关闭表单
        handleClose();
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
            setSelectedMethod(methodType === 'common' ? method.name : (method.id || method.name));
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
            setSelectedMethod(methodType === 'common' ? method.name : (method.id || method.name));
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
            let method;
            
            if (methodType === 'common') {
                const methods = brewingMethods[selectedEquipment] || [];
                method = methods.find(m => m.name === selectedMethod);
            } else {
                method = customMethods.find(m => m.id === selectedMethod || m.name === selectedMethod);
            }
            
            if (method) {
                initMethodParams(method);
            }
        }
    }, [selectedMethod, selectedEquipment, methodType]);

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

    // 步骤2：选择器具内容
    const equipmentStepContent = (
        <div className="space-y-6 py-4">
            <div className="space-y-2">
                <label className="block text-sm text-neutral-700 dark:text-neutral-300">
                    选择器具
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {/* 标准器具列表 */}
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
                                {equipment.description}
                            </div>
                        </button>
                    ))}
                    
                    {/* 自定义器具列表 */}
                    {customEquipments.map((equipment) => (
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
                                {equipment.description || '自定义器具'}
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
                        : 'text-neutral-500 dark:text-neutral-400'
                        }`}
                >
                    通用方案
                </button>
                <span className="mx-3 text-neutral-300 dark:text-neutral-600 text-xs">|</span>
                <button
                    onClick={() => handleMethodTypeChange('custom')}
                    className={`text-[13px] transition-colors ${methodType === 'custom'
                        ? 'text-neutral-800 dark:text-neutral-100 font-medium'
                        : 'text-neutral-500 dark:text-neutral-400'
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
                                    className={`w-full p-3 rounded-md text-sm text-left transition ${
                                        ((methodType === 'common' && selectedMethod === method.name) ||
                                         (methodType === 'custom' && (selectedMethod === method.id || selectedMethod === method.name)))
                                            ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800'
                                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                                    }`}
                                    onClick={() => {
                                        setSelectedMethod(methodType === 'common' ? method.name : (method.id || method.name));
                                        initMethodParams(method);
                                    }}
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
                                    {((methodType === 'common' && selectedMethod === method.name) ||
                                        (methodType === 'custom' && (selectedMethod === method.id || selectedMethod === method.name))) && (
                                        <div 
                                            className="mt-3 pt-3 border-t border-neutral-300 dark:border-neutral-600"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="text-xs font-medium mb-2 text-white dark:text-neutral-800">
                                                调整参数
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 mt-1">
                                                <div>
                                                    <label className="block text-[10px] tracking-widest text-white dark:text-neutral-800 mb-1 opacity-80">
                                                        咖啡粉量 (g)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={coffeeAmount}
                                                        onChange={(e) => handleCoffeeAmountChange(e.target.value, method)}
                                                        className="w-full border border-neutral-300 dark:border-neutral-700 bg-neutral-700/50 dark:bg-white/50 p-1.5 text-[11px] rounded-md outline-none text-white dark:text-neutral-800"
                                                        placeholder="15"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] tracking-widest text-white dark:text-neutral-800 mb-1 opacity-80">
                                                        水粉比 (1:X)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={ratioAmount}
                                                        onChange={(e) => handleRatioAmountChange(e.target.value, method)}
                                                        className="w-full border border-neutral-300 dark:border-neutral-700 bg-neutral-700/50 dark:bg-white/50 p-1.5 text-[11px] rounded-md outline-none text-white dark:text-neutral-800"
                                                        placeholder="15"
                                                    />
                                                </div>
                                            </div>
                                            <div className="mt-2 flex items-center gap-1 text-[10px] text-white dark:text-neutral-800 opacity-80">
                                                <span>计算出的水量:</span>
                                                <span className="font-medium">{waterAmount}</span>
                                            </div>
                                        </div>
                                    )}
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
                        请先选择器具
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
            label: '选择器具',
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