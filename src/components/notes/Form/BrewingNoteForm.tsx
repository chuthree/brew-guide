'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

import type { BrewingNoteData, CoffeeBean } from '@/types/app'
import AutoResizeTextarea from '@/components/common/forms/AutoResizeTextarea'
import NoteFormHeader from '@/components/notes/ui/NoteFormHeader'
import { captureImage, compressBase64Image } from '@/lib/utils/imageCapture'
import { equipmentList, commonMethods, type Method, type CustomEquipment } from '@/lib/core/config'
import { loadCustomEquipments } from '@/lib/managers/customEquipments'
import { loadCustomMethods } from '@/lib/managers/customMethods'
import { formatGrindSize, hasSpecificGrindScale, getGrindScaleUnit } from '@/lib/utils/grindUtils'
import { SettingsOptions } from '@/components/settings/Settings'

interface TasteRatings {
    acidity: number;
    sweetness: number;
    bitterness: number;
    body: number;
}

interface FormData {
    coffeeBeanInfo: {
        name: string;
        roastLevel: string;
    };
    image?: string;
    rating: number;
    taste: TasteRatings;
    notes: string;
}

interface BrewingNoteFormProps {
    id?: string;
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: BrewingNoteData) => void;
    initialData: Partial<BrewingNoteData> & {
        coffeeBean?: CoffeeBean | null;
    };
    inBrewPage?: boolean;
    showSaveButton?: boolean;
    onSaveSuccess?: () => void;
    hideHeader?: boolean;
    onTimestampChange?: (timestamp: Date) => void;
    settings?: SettingsOptions; // 添加可选的设置参数
}



// 标准化烘焙度值
const normalizeRoastLevel = (roastLevel?: string): string => {
    if (!roastLevel) return '中度烘焙';
    if (roastLevel.endsWith('烘焙')) return roastLevel;

    const roastMap: Record<string, string> = {
        '极浅': '极浅烘焙',
        '浅度': '浅度烘焙',
        '中浅': '中浅烘焙',
        '中度': '中度烘焙',
        '中深': '中深烘焙',
        '深度': '深度烘焙'
    };

    // 直接匹配或包含匹配
    return roastMap[roastLevel] ||
           Object.entries(roastMap).find(([key]) => roastLevel.includes(key))?.[1] ||
           '中度烘焙';
};

// 获取初始咖啡豆信息
const getInitialCoffeeBeanInfo = (initialData: BrewingNoteFormProps['initialData']) => {
    const beanInfo = initialData.coffeeBean || initialData.coffeeBeanInfo;
    return {
        name: beanInfo?.name || '',
        roastLevel: normalizeRoastLevel(beanInfo?.roastLevel)
    };
};

// 通用滑块样式
const SLIDER_STYLES = `relative h-px w-full appearance-none bg-neutral-300 dark:bg-neutral-600 cursor-pointer touch-none
[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-solid
[&::-webkit-slider-thumb]:border-neutral-300 [&::-webkit-slider-thumb]:bg-neutral-50
dark:[&::-webkit-slider-thumb]:border-neutral-600 dark:[&::-webkit-slider-thumb]:bg-neutral-900
[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:appearance-none
[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-solid
[&::-moz-range-thumb]:border-neutral-300 [&::-moz-range-thumb]:bg-neutral-50
dark:[&::-moz-range-thumb]:border-neutral-600 dark:[&::-moz-range-thumb]:bg-neutral-900`;

const BrewingNoteForm: React.FC<BrewingNoteFormProps> = ({
    id,
    isOpen,
    onClose,
    onSave,
    initialData,
    inBrewPage = false,
    showSaveButton = true,
    onSaveSuccess,
    hideHeader = false,
    onTimestampChange,
    settings,
}) => {

    const [formData, setFormData] = useState<FormData>({
        coffeeBeanInfo: getInitialCoffeeBeanInfo(initialData),
        image: typeof initialData.image === 'string' ? initialData.image : '',
        rating: initialData?.rating || 3,
        taste: {
            acidity: initialData?.taste?.acidity || 0,
            sweetness: initialData?.taste?.sweetness || 0,
            bitterness: initialData?.taste?.bitterness || 0,
            body: initialData?.taste?.body || 0
        },
        notes: initialData?.notes || ''
    });

    // 添加时间戳状态管理
    const [timestamp, setTimestamp] = useState<Date>(
        initialData.timestamp ? new Date(initialData.timestamp) : new Date()
    );

    // 监听initialData.timestamp的变化，同步更新内部状态
    useEffect(() => {
        if (initialData.timestamp) {
            setTimestamp(new Date(initialData.timestamp));
        }
    }, [initialData.timestamp]);

    // 处理时间戳变化，同时通知外部组件
    const handleTimestampChange = (newTimestamp: Date) => {
        setTimestamp(newTimestamp);
        onTimestampChange?.(newTimestamp);
    };
    
    // 添加方案参数状态 - 分离数值和单位
    const [methodParams, setMethodParams] = useState({
        coffee: initialData?.params?.coffee || '15g',
        water: initialData?.params?.water || '225g',
        ratio: initialData?.params?.ratio || '1:15',
        grindSize: initialData?.params?.grindSize || '中细',
        temp: initialData?.params?.temp || '92°C',
    });

    // 提取纯数字值的辅助函数
    const extractNumericValue = (param: string): string => {
        const match = param.match(/(\d+(\.\d+)?)/);
        return match ? match[0] : '';
    };

    // 分离的数值状态（用于输入框显示）
    const [numericValues, setNumericValues] = useState(() => ({
        coffee: extractNumericValue(initialData?.params?.coffee || '15g'),
        water: extractNumericValue(initialData?.params?.water || '225g'),
        temp: extractNumericValue(initialData?.params?.temp || '92°C'),
        ratio: extractNumericValue(initialData?.params?.ratio?.split(':')[1] || '15')
    }));

    // 添加器具和方案选择相关状态
    const [availableEquipments, setAvailableEquipments] = useState<(typeof equipmentList[0] | CustomEquipment)[]>([]);
    const [availableMethods, setAvailableMethods] = useState<Method[]>([]);
    const [customMethods, setCustomMethods] = useState<Record<string, Method[]>>({});
    const [showEquipmentMethodSelector, setShowEquipmentMethodSelector] = useState(false);
    const [selectedEquipment, setSelectedEquipment] = useState(initialData.equipment || '');
    const [selectedMethod, setSelectedMethod] = useState(initialData.method || '');
    
    const formRef = useRef<HTMLFormElement>(null);
    const [currentSliderValue, setCurrentSliderValue] = useState<number | null>(null);

    // 通用滑块触摸处理
    const createSliderHandlers = (
        updateFn: (value: number) => void,
        min: number = 0,
        max: number = 5,
        step: number = 1
    ) => ({
        onTouchStart: (value: number) => (e: React.TouchEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setCurrentSliderValue(value);
        },
        onTouchMove: (e: React.TouchEvent) => {
            if (currentSliderValue === null) return;

            const touch = e.touches[0];
            const target = e.currentTarget as HTMLInputElement;
            const rect = target.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
            const newValue = min + Math.round(percentage * (max - min) / step) * step;

            if (newValue !== currentSliderValue) {
                updateFn(newValue);
                setCurrentSliderValue(newValue);
            }
        },
        onTouchEnd: () => setCurrentSliderValue(null)
    });
    
    // 加载器具和方案数据
    useEffect(() => {
        const loadEquipmentsAndMethods = async () => {
            try {
                // 加载自定义器具
                const customEquips = await loadCustomEquipments();

                // 合并所有器具
                const allEquipments = [
                    ...equipmentList.map(eq => ({ ...eq, isCustom: false })),
                    ...customEquips
                ];
                setAvailableEquipments(allEquipments);

                // 加载自定义方案
                const customMethods = await loadCustomMethods();
                setCustomMethods(customMethods);

                // 如果有选中的器具，加载对应的方案
                if (initialData.equipment) {
                    const equipmentMethods = customMethods[initialData.equipment] || [];
                    const commonEquipmentMethods = commonMethods[initialData.equipment] || [];
                    setAvailableMethods([...equipmentMethods, ...commonEquipmentMethods]);
                }
            } catch (error) {
                // Log error in development only
                if (process.env.NODE_ENV === 'development') {
                    console.error('加载器具和方案数据失败:', error);
                }
            }
        };

        loadEquipmentsAndMethods();
    }, [initialData.equipment]);

    // 事件监听
    useEffect(() => {
        const handleGlobalTouchEnd = () => setCurrentSliderValue(null);

        const handleMethodParamsChange = (e: CustomEvent) => {
            if (e.detail?.params) {
                const params = e.detail.params;
                setMethodParams(prev => ({
                    coffee: params.coffee || prev.coffee,
                    water: params.water || prev.water,
                    ratio: params.ratio || prev.ratio,
                    grindSize: params.grindSize || prev.grindSize,
                    temp: params.temp || prev.temp
                }));
            }
        };

        // 点击外部区域关闭下拉选择器
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('[data-equipment-method-selector]')) {
                setShowEquipmentMethodSelector(false);
            }
        };

        document.addEventListener('touchend', handleGlobalTouchEnd);
        document.addEventListener('methodParamsChanged', handleMethodParamsChange as EventListener);
        document.addEventListener('click', handleClickOutside);

        return () => {
            document.removeEventListener('touchend', handleGlobalTouchEnd);
            document.removeEventListener('methodParamsChanged', handleMethodParamsChange as EventListener);
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    // 使用useRef保存上一次的initialData，用于比较变化
    const prevInitialDataRef = useRef<typeof initialData>(initialData);
    
    // Update form data when initialData changes
    useEffect(() => {
        // 检查咖啡豆信息变化
        const prevCoffeeBean = prevInitialDataRef.current.coffeeBean;
        const currentCoffeeBean = initialData.coffeeBean;
        
        const hasCoffeeBeanChanged = 
            (prevCoffeeBean?.id !== currentCoffeeBean?.id) || 
            (prevCoffeeBean?.name !== currentCoffeeBean?.name) ||
            (!prevCoffeeBean && currentCoffeeBean) ||
            (prevCoffeeBean && !currentCoffeeBean);
            
        const prevCoffeeBeanInfo = prevInitialDataRef.current.coffeeBeanInfo;
        const currentCoffeeBeanInfo = initialData.coffeeBeanInfo;
        
        const hasCoffeeBeanInfoChanged = 
            (prevCoffeeBeanInfo?.name !== currentCoffeeBeanInfo?.name) ||
            (prevCoffeeBeanInfo?.roastLevel !== currentCoffeeBeanInfo?.roastLevel) ||
            (!prevCoffeeBeanInfo && currentCoffeeBeanInfo) ||
            (prevCoffeeBeanInfo && !currentCoffeeBeanInfo);
            
        // 只有当咖啡豆信息真的变化时，才更新表单数据
        if (hasCoffeeBeanChanged || hasCoffeeBeanInfoChanged) {
            const updatedCoffeeBeanInfo = currentCoffeeBean
                ? {
                    name: currentCoffeeBean.name || '',
                    roastLevel: normalizeRoastLevel(currentCoffeeBean.roastLevel || '中度烘焙'),
                }
                : currentCoffeeBeanInfo
                    ? {
                        name: currentCoffeeBeanInfo.name || '',
                        roastLevel: normalizeRoastLevel(currentCoffeeBeanInfo.roastLevel || '中度烘焙'),
                    }
                    : {
                        name: '',
                        roastLevel: '中度烘焙'
                    };
            
            setFormData(prev => ({
                ...prev,
                coffeeBeanInfo: updatedCoffeeBeanInfo
            }));
        }
        
        // 检查其他字段变化
        const hasOtherDataChanged = 
            (prevInitialDataRef.current.rating !== initialData.rating) ||
            (prevInitialDataRef.current.notes !== initialData.notes) ||
            (prevInitialDataRef.current.image !== initialData.image) ||
            JSON.stringify(prevInitialDataRef.current.taste) !== JSON.stringify(initialData.taste);
            
        if (hasOtherDataChanged) {
            setFormData(prev => ({
                ...prev,
                image: typeof initialData.image === 'string' ? initialData.image : prev.image,
                rating: initialData.rating || prev.rating,
                taste: {
                    acidity: initialData.taste?.acidity ?? prev.taste.acidity,
                    sweetness: initialData.taste?.sweetness ?? prev.taste.sweetness,
                    bitterness: initialData.taste?.bitterness ?? prev.taste.bitterness,
                    body: initialData.taste?.body ?? prev.taste.body
                },
                notes: initialData.notes || prev.notes
            }));
        }
        
        // 检查方法参数变化
        const hasParamsChanged = JSON.stringify(prevInitialDataRef.current.params) !== JSON.stringify(initialData.params);

        if (hasParamsChanged && initialData.params) {
            setMethodParams(initialData.params);
            // 同步更新数值状态
            const updateNumericValues = (params: typeof initialData.params) => ({
                coffee: extractNumericValue(params?.coffee || '15g'),
                water: extractNumericValue(params?.water || '225g'),
                temp: extractNumericValue(params?.temp || '92°C'),
                ratio: extractNumericValue(params?.ratio?.split(':')[1] || '15')
            });
            setNumericValues(updateNumericValues(initialData.params));
        }
        
        // 更新引用
        prevInitialDataRef.current = initialData;
    }, [initialData]);

    // 创建评分更新函数
    const updateRating = (value: number) => {
        setFormData(prev => ({ ...prev, rating: value }));
    };

    const updateTasteRating = (key: keyof TasteRatings) => (value: number) => {
        setFormData(prev => ({
            ...prev,
            taste: { ...prev.taste, [key]: value }
        }));
    };

    // 创建滑块处理器
    const ratingHandlers = createSliderHandlers(updateRating, 1, 5, 0.5);
    const tasteHandlers = (key: keyof TasteRatings) =>
        createSliderHandlers(updateTasteRating(key), 0, 5, 1);

    // 计算水量
    const calculateWater = (coffee: string, ratio: string): string => {
        const coffeeValue = parseFloat(coffee.match(/(\d+(\.\d+)?)/)?.[0] || '0');
        const ratioValue = parseFloat(ratio.match(/1:(\d+(\.\d+)?)/)?.[1] || '0');

        if (coffeeValue > 0 && ratioValue > 0) {
            return `${Math.round(coffeeValue * ratioValue)}g`;
        }
        return methodParams.water;
    };

    // 数值输入验证
    const validateNumericInput = (value: string): boolean => {
        return /^$|^[0-9]*\.?[0-9]*$/.test(value);
    };

    // 处理咖啡粉量变化
    const handleCoffeeChange = (value: string) => {
        if (!validateNumericInput(value)) return;

        setNumericValues(prev => ({ ...prev, coffee: value }));

        const coffeeWithUnit = value ? `${value}g` : '';
        setMethodParams(prev => ({
            ...prev,
            coffee: coffeeWithUnit,
            water: calculateWater(coffeeWithUnit, prev.ratio)
        }));
    };

    // 处理水粉比变化
    const handleRatioChange = (value: string) => {
        if (!validateNumericInput(value)) return;

        setNumericValues(prev => ({ ...prev, ratio: value }));

        const ratioWithFormat = value ? `1:${value}` : '1:15';
        setMethodParams(prev => ({
            ...prev,
            ratio: ratioWithFormat,
            water: calculateWater(prev.coffee, ratioWithFormat)
        }));
    };

    // 处理温度变化
    const handleTempChange = (value: string) => {
        if (!validateNumericInput(value)) return;

        setNumericValues(prev => ({ ...prev, temp: value }));

        const tempWithUnit = value ? `${value}°C` : '';
        setMethodParams(prev => ({
            ...prev,
            temp: tempWithUnit
        }));
    };

    // 处理器具选择
    const handleEquipmentSelect = async (equipmentId: string) => {
        try {
            // 更新选中的器具
            setSelectedEquipment(equipmentId);

            // 加载该器具的方案
            const equipmentMethods = customMethods[equipmentId] || [];
            const commonEquipmentMethods = commonMethods[equipmentId] || [];
            const allMethods = [...equipmentMethods, ...commonEquipmentMethods];
            setAvailableMethods(allMethods);

            // 如果有方案，默认选择第一个并更新参数
            if (allMethods.length > 0) {
                const firstMethod = allMethods[0];
                // 优先使用方案名称，只有在名称不存在时才使用ID
                const methodIdentifier = firstMethod.name || firstMethod.id || '';
                setSelectedMethod(methodIdentifier);
                setMethodParams({
                    coffee: firstMethod.params.coffee,
                    water: firstMethod.params.water,
                    ratio: firstMethod.params.ratio,
                    grindSize: firstMethod.params.grindSize,
                    temp: firstMethod.params.temp,
                });
            } else {
                setSelectedMethod('');
            }

            setShowEquipmentMethodSelector(false);
        } catch (error) {
            // Log error in development only
            if (process.env.NODE_ENV === 'development') {
                console.error('选择器具失败:', error);
            }
        }
    };

    // 处理方案选择
    const handleMethodSelect = (methodIdentifier: string) => {
        try {
            // 优先通过名称查找，然后通过ID查找
            const selectedMethodObj = availableMethods.find(m =>
                m.name === methodIdentifier || m.id === methodIdentifier
            );
            if (selectedMethodObj) {
                // 更新选中的方案，优先使用名称
                const methodToStore = selectedMethodObj.name || selectedMethodObj.id || '';
                setSelectedMethod(methodToStore);

                // 只更新方案参数，不保存
                setMethodParams({
                    coffee: selectedMethodObj.params.coffee,
                    water: selectedMethodObj.params.water,
                    ratio: selectedMethodObj.params.ratio,
                    grindSize: selectedMethodObj.params.grindSize,
                    temp: selectedMethodObj.params.temp,
                });

                // 同步更新数值状态
                const updateNumericValues = (params: typeof selectedMethodObj.params) => ({
                    coffee: extractNumericValue(params.coffee || '15g'),
                    water: extractNumericValue(params.water || '225g'),
                    temp: extractNumericValue(params.temp || '92°C'),
                    ratio: extractNumericValue(params.ratio?.split(':')[1] || '15')
                });
                setNumericValues(updateNumericValues(selectedMethodObj.params));
            }
            setShowEquipmentMethodSelector(false);
        } catch (error) {
            // Log error in development only
            if (process.env.NODE_ENV === 'development') {
                console.error('选择方案失败:', error);
            }
        }
    };

    // 获取当前器具名称
    const getCurrentEquipmentName = () => {
        const equipment = availableEquipments.find(eq => eq.id === selectedEquipment);
        return equipment?.name || selectedEquipment || '未知器具';
    };

    // 获取当前方案名称
    const getCurrentMethodName = () => {
        // 优先通过名称查找，然后通过ID查找
        const method = availableMethods.find(m =>
            m.name === selectedMethod || m.id === selectedMethod
        );
        return method?.name || selectedMethod || '未知方案';
    };

    // Inside the component, add a new state for showing/hiding flavor ratings
    const [showFlavorRatings, setShowFlavorRatings] = useState(() => {
        // 初始化时检查是否有任何风味评分大于0
        const hasTasteValues = initialData?.taste && (
            (initialData.taste.acidity > 0) || 
            (initialData.taste.sweetness > 0) || 
            (initialData.taste.bitterness > 0) || 
            (initialData.taste.body > 0)
        );
        
        // 如果有风味评分，默认展开
        return hasTasteValues || false;
    });
    
    // 监听风味评分变化
    useEffect(() => {
        // 检查任何风味评分是否大于0
        const hasTasteValues = 
            formData.taste.acidity > 0 || 
            formData.taste.sweetness > 0 || 
            formData.taste.bitterness > 0 || 
            formData.taste.body > 0;
        
        // 如果有任何风味评分大于0，自动展开风味评分区域
        if (hasTasteValues && !showFlavorRatings) {
            setShowFlavorRatings(true);
        }
    }, [formData.taste, showFlavorRatings]);

    // 处理图片上传
    const handleImageUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();

        reader.onload = async () => {
            try {
                const base64 = reader.result as string;
                if (!base64) return;

                const compressedBase64 = await compressBase64Image(base64, {
                    maxSizeMB: 0.1, // 100KB
                    maxWidthOrHeight: 1200,
                    initialQuality: 0.8
                });
                setFormData(prev => ({ ...prev, image: compressedBase64 }));
            } catch (error) {
                // Log error in development only
                if (process.env.NODE_ENV === 'development') {
                    console.error('图片处理失败:', error);
                }
                // 降级使用原始文件
                const objectUrl = URL.createObjectURL(file);
                setFormData(prev => ({ ...prev, image: objectUrl }));
                setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
            }
        };

        reader.onerror = () => {
            // Log error in development only
            if (process.env.NODE_ENV === 'development') {
                console.error('文件读取失败');
            }
            const objectUrl = URL.createObjectURL(file);
            setFormData(prev => ({ ...prev, image: objectUrl }));
            setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
        };

        reader.readAsDataURL(file);
    };
    
    // 处理图片选择
    const handleImageSelect = async (source: 'camera' | 'gallery') => {
        try {
            const result = await captureImage({ source });

            // 将 dataUrl 转换为 File 对象
            const response = await fetch(result.dataUrl);
            const blob = await response.blob();
            const file = new File([blob], `image.${result.format}`, { type: `image/${result.format}` });

            // 处理图片上传
            handleImageUpload(file);
        } catch (error) {
            // Log error in development only
            if (process.env.NODE_ENV === 'development') {
                console.error('打开相机/相册失败:', error);
            }
        }
    };

    // 保存笔记的处理函数
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // 编辑笔记时同步咖啡豆容量（容量调整记录除外）
        if (initialData.id && initialData.beanId && initialData.source !== 'capacity-adjustment') {
            try {
                const { CapacitySyncManager, CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager');

                const oldCoffeeAmount = CapacitySyncManager.extractCoffeeAmount(initialData.params?.coffee || '0g');
                const newCoffeeAmount = CapacitySyncManager.extractCoffeeAmount(methodParams.coffee);
                const amountDiff = newCoffeeAmount - oldCoffeeAmount;

                if (Math.abs(amountDiff) > 0.01) {
                    if (amountDiff > 0) {
                        await CoffeeBeanManager.updateBeanRemaining(initialData.beanId, amountDiff);
                    } else {
                        await CoffeeBeanManager.increaseBeanRemaining(initialData.beanId, Math.abs(amountDiff));
                    }
                }
            } catch (error) {
                console.error('同步咖啡豆容量失败:', error);
            }
        }

        // 创建完整的笔记数据
        const noteData: BrewingNoteData = {
            id: id || Date.now().toString(),
            // 使用当前的时间戳状态
            timestamp: timestamp.getTime(),
            ...formData,
            equipment: selectedEquipment || initialData.equipment,
            method: selectedMethod || initialData.method,
            params: {
                // 使用当前的方案参数
                coffee: methodParams.coffee,
                water: methodParams.water,
                ratio: methodParams.ratio,
                grindSize: methodParams.grindSize,
                temp: methodParams.temp
            },
            totalTime: initialData.totalTime,
            // 确保保留beanId，这是与咖啡豆的关联字段
            beanId: initialData.beanId,
            // 保留容量调整记录的特殊属性
            ...(initialData.source === 'capacity-adjustment' ? {
                source: initialData.source,
                changeRecord: initialData.changeRecord
            } : {}),
            // 保留快捷扣除记录的特殊属性
            ...(initialData.source === 'quick-decrement' ? {
                source: initialData.source,
                quickDecrementAmount: initialData.quickDecrementAmount
            } : {})
        };

        try {
            // 保存笔记
            onSave(noteData);

            // 如果提供了保存成功的回调，则调用它
            if (onSaveSuccess) {
                onSaveSuccess();
            }
        } catch (error) {
            // Log error in development only
            if (process.env.NODE_ENV === 'development') {
                console.error('保存笔记时出错:', error);
            }
            alert('保存笔记时出错，请重试');
        }
    }

    if (!isOpen) return null

    // 动态设置容器 padding，在冲煮页面时不需要额外 padding
    // 当hideHeader为true时，添加足够的顶部边距，确保表单内容不会位于导航栏下面
    const containerClassName = `relative flex flex-col ${!inBrewPage ? 'p-6 pt-6' : ''} ${hideHeader ? 'pt-6' : ''} h-full overflow-y-auto overscroll-contain`;

    return (
        <form 
            id={id} 
            ref={formRef}
            onSubmit={handleSubmit}
            className={containerClassName}
        >
            {/* 根据hideHeader属性决定是否显示头部 */}
            {!hideHeader && (
                <div className="shrink-0 mb-4">
                    <NoteFormHeader
                        isEditMode={!!initialData?.id}
                        onBack={onClose}
                        onSave={() => formRef.current?.requestSubmit()}
                        showSaveButton={showSaveButton}
                        timestamp={timestamp}
                        onTimestampChange={handleTimestampChange}
                    />
                </div>
            )}

            {/* Form content - 更新内容区域样式以确保正确滚动 */}
            <div className="grow space-y-6 pb-20">
                {/* 笔记图片 */}
                <div className="space-y-2 w-full">
                    <div className="text-xs font-medium  tracking-widest text-neutral-500 dark:text-neutral-400 mb-3">
                        {(initialData.coffeeBean || (initialData.id && formData.coffeeBeanInfo.name)) ? (
                            // 显示选择的咖啡豆信息，直接在标题后面
                            <>咖啡豆信息 · {formData.coffeeBeanInfo.name || '未知咖啡豆'}</>
                        ) : (
                            // 只显示标题
                            '咖啡豆信息'
                        )}
                    </div>
                    <div className="flex items-center justify-center relative">
                        <div className="w-32 h-32 rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-700 flex flex-col items-center justify-center overflow-hidden relative">
                            {formData.image ? (
                                <div className="relative w-full h-full">
                                    <Image
                                        src={formData.image}
                                        alt="笔记图片"
                                        className="object-contain"
                                        fill
                                        sizes="(max-width: 768px) 100vw, 300px"
                                    />
                                    {/* 操作按钮组 */}
                                    <div className="absolute top-1 right-1 flex space-x-1">
                                        {/* 删除按钮 */}
                                        <button
                                            type="button"
                                            className="w-6 h-6 bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800 rounded-full flex items-center justify-center shadow-md hover:bg-red-500 dark:hover:bg-red-500 dark:hover:text-white transition-colors z-10"
                                            onClick={() => setFormData(prev => ({...prev, image: ''}))}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-between h-full w-full">
                                    <div className="flex-1 flex flex-col items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-neutral-400 dark:text-neutral-600 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span className="text-xs text-neutral-500 dark:text-neutral-400">选择图片</span>
                                        <span className="text-[9px] text-neutral-400 dark:text-neutral-500 mt-1">200kb以上将自动压缩</span>
                                    </div>
                                    
                                    {/* 图片上传按钮组 */}
                                    <div className="flex w-full mt-auto">
                                        <button
                                            type="button"
                                            onClick={() => handleImageSelect('camera')}
                                            className="flex-1 py-1 text-xs text-neutral-600 dark:text-neutral-400 border-t-2 border-r-2 border-dashed border-neutral-300 dark:border-neutral-700"
                                        >
                                            <span className="flex items-center justify-center">
                                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                拍照
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleImageSelect('gallery')}
                                            className="flex-1 py-1 text-xs text-neutral-600 dark:text-neutral-400 border-t-2 border-dashed border-neutral-300 dark:border-neutral-700"
                                        >
                                            <span className="flex items-center justify-center">
                                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                相册
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 咖啡豆信息 */}
                <div className="space-y-4">
                    {/* 只有在新建笔记且没有选择咖啡豆时才显示输入框 */}
                    {!initialData.coffeeBean && !initialData.id && (
                        <div className="grid gap-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <input
                                        type="text"
                                        value={formData.coffeeBeanInfo.name}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                coffeeBeanInfo: {
                                                    ...formData.coffeeBeanInfo,
                                                    name: e.target.value,
                                                },
                                            })
                                        }
                                        className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-hidden transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                        placeholder="咖啡豆名称"
                                    />
                                </div>
                                <div>
                                    <select
                                        value={formData.coffeeBeanInfo.roastLevel}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                coffeeBeanInfo: {
                                                    ...formData.coffeeBeanInfo,
                                                    roastLevel: e.target.value,
                                                },
                                            })
                                        }
                                        className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-hidden transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 text-neutral-800 dark:text-neutral-300"
                                    >
                                        <option value="极浅烘焙">极浅烘焙</option>
                                        <option value="浅度烘焙">浅度烘焙</option>
                                        <option value="中浅烘焙">中浅烘焙</option>
                                        <option value="中度烘焙">中度烘焙</option>
                                        <option value="中深烘焙">中深烘焙</option>
                                        <option value="深度烘焙">深度烘焙</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 添加方案参数编辑 - 只在编辑记录时显示 */}
                {initialData?.id && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between" data-equipment-method-selector>
                        <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400 flex-1 min-w-0 mr-3">
                            <span className="truncate block">
                                方案参数 · {getCurrentEquipmentName()}_{getCurrentMethodName()}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowEquipmentMethodSelector(!showEquipmentMethodSelector)}
                            className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400 underline hover:text-neutral-700 dark:hover:text-neutral-300 flex-shrink-0"
                        >
                            [ 选择 ]
                        </button>
                    </div>

                    {/* 器具和方案选择下拉框 */}
                    {showEquipmentMethodSelector && (
                        <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 space-y-4 bg-neutral-50 dark:bg-neutral-900" data-equipment-method-selector>
                            {/* 器具选择 */}
                            <div className="space-y-2">
                                <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                                    选择器具
                                </div>
                                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                                    {availableEquipments.map((equipment) => (
                                        <button
                                            key={equipment.id}
                                            type="button"
                                            onClick={() => handleEquipmentSelect(equipment.id)}
                                            className={`text-xs p-2 rounded border text-left ${
                                                selectedEquipment === equipment.id
                                                    ? 'border-neutral-800 dark:border-white bg-neutral-100 dark:bg-neutral-800'
                                                    : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500'
                                            }`}
                                        >
                                            {equipment.name}
                                            {'isCustom' in equipment && equipment.isCustom && (
                                                <span className="ml-1 text-neutral-400 dark:text-neutral-500">(自定义)</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 方案选择 */}
                            {availableMethods.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                                        选择方案
                                    </div>
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {availableMethods.map((method) => {
                                            // 优先使用名称作为标识符
                                            const methodIdentifier = method.name || method.id || '';
                                            return (
                                                <button
                                                    key={method.id || method.name}
                                                    type="button"
                                                    onClick={() => handleMethodSelect(methodIdentifier)}
                                                    className={`w-full text-xs p-2 rounded border text-left ${
                                                        selectedMethod === methodIdentifier
                                                            ? 'border-neutral-800 dark:border-white bg-neutral-100 dark:bg-neutral-800'
                                                            : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500'
                                                    }`}
                                                >
                                                    {method.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="grid grid-cols-4 gap-6">
                        <div className="relative">
                            <input
                                type="text"
                                inputMode="decimal"
                                value={numericValues.coffee}
                                onChange={(e) => handleCoffeeChange(e.target.value)}
                                className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-hidden transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none pr-4"
                                placeholder="15"
                            />
                            <span className="absolute right-0 bottom-2 text-xs text-neutral-400 dark:text-neutral-500">g</span>
                        </div>
                        <div className="relative overflow-hidden">
                            <div className="flex items-center">
                                <span className="text-xs text-neutral-400 dark:text-neutral-500 mr-1 flex-shrink-0">1:</span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={numericValues.ratio}
                                    onChange={(e) => handleRatioChange(e.target.value)}
                                    className="flex-1 min-w-0 border-b border-neutral-200 bg-transparent py-2 text-xs outline-hidden transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                    placeholder="15"
                                />
                            </div>
                        </div>
                        <div>
                            <input
                                type="text"
                                value={settings ? formatGrindSize(methodParams.grindSize, settings.grindType) : methodParams.grindSize}
                                onChange={(e) => setMethodParams({...methodParams, grindSize: e.target.value})}
                                className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-hidden transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                placeholder={settings && hasSpecificGrindScale(settings.grindType) ? `8${getGrindScaleUnit(settings.grindType)}` : '中细'}
                            />
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                inputMode="decimal"
                                value={numericValues.temp}
                                onChange={(e) => handleTempChange(e.target.value)}
                                className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-hidden transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none pr-8"
                                placeholder="92"
                            />
                            <span className="absolute right-0 bottom-2 text-xs text-neutral-400 dark:text-neutral-500">°C</span>
                        </div>
                    </div>
                </div>
                )}

                {/* 风味评分 */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="text-xs font-medium  tracking-widest text-neutral-500 dark:text-neutral-400">
                            风味评分
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowFlavorRatings(!showFlavorRatings)}
                            className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400"
                        >
                            [ {showFlavorRatings ? '收起' : '展开'} ]
                        </button>
                    </div>
                    
                    {showFlavorRatings && (
                        <div className="grid grid-cols-2 gap-8">
                            {Object.entries(formData.taste).map(([key, value]) => (
                                <div key={key} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs font-medium  tracking-widest text-neutral-500 dark:text-neutral-400">
                                            {
                                                {
                                                    acidity: '酸度',
                                                    sweetness: '甜度',
                                                    bitterness: '苦度',
                                                    body: '口感',
                                                }[key]
                                            }
                                        </div>
                                        <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                                            [ {value || 0} ]
                                        </div>
                                    </div>
                                    <div className="relative py-4 -my-4">
                                        <input
                                            type="range"
                                            min="0"
                                            max="5"
                                            step="1"
                                            value={value || 0}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    taste: {
                                                        ...formData.taste,
                                                        [key]: parseInt(e.target.value),
                                                    },
                                                })
                                            }
                                            onTouchStart={tasteHandlers(key as keyof TasteRatings).onTouchStart(value)}
                                            onTouchMove={tasteHandlers(key as keyof TasteRatings).onTouchMove}
                                            onTouchEnd={tasteHandlers(key as keyof TasteRatings).onTouchEnd}
                                            className={SLIDER_STYLES}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 总体评分 */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="text-xs font-medium  tracking-widest text-neutral-500 dark:text-neutral-400">
                            总体评分
                        </div>
                        <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                            [ {formData.rating.toFixed(1)} ]
                        </div>
                    </div>
                    <div className="relative py-3">
                        <div className="relative py-4 -my-4">
                            <input
                                type="range"
                                min="1"
                                max="5"
                                step="0.5"
                                value={formData.rating}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        rating: parseFloat(e.target.value),
                                    })
                                }
                                onTouchStart={ratingHandlers.onTouchStart(formData.rating)}
                                onTouchMove={ratingHandlers.onTouchMove}
                                onTouchEnd={ratingHandlers.onTouchEnd}
                                className={SLIDER_STYLES}
                            />
                        </div>
                    </div>
                </div>

                {/* 笔记 */}
                <div className="space-y-4">
                    <div className="text-xs font-medium  tracking-widest text-neutral-500 dark:text-neutral-400">
                        笔记
                    </div>
                    <AutoResizeTextarea
                        value={formData.notes}
                        onChange={(e) =>
                            setFormData({
                                ...formData,
                                notes: e.target.value,
                            })
                        }
                        className="text-xs font-medium border-b border-neutral-200 focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 pb-4"
                        placeholder="记录一下这次冲煮的感受、改进点等..."
                        minRows={3}
                        maxRows={10}
                    />
                </div>
            </div>
        </form>
    )
}

export default BrewingNoteForm 