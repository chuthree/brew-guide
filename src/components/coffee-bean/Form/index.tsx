'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { ExtendedCoffeeBean, BlendComponent, Step, StepConfig } from './types'
import BasicInfo from './components/BasicInfo'
import DetailInfo from './components/DetailInfo'
import FlavorInfo from './components/FlavorInfo'
import Complete from './components/Complete'
import { addCustomPreset, DEFAULT_ORIGINS, DEFAULT_PROCESSES, DEFAULT_VARIETIES } from './constants'
import { defaultSettings, type SettingsOptions } from '@/components/settings/Settings'
import { compressBase64Image } from '@/lib/utils/imageCapture'
import { getDefaultFlavorPeriodByRoastLevelSync } from '@/lib/utils/flavorPeriodUtils'

interface CoffeeBeanFormProps {
    onSave: (bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>) => void
    onCancel: () => void
    initialBean?: ExtendedCoffeeBean
}

const steps: StepConfig[] = [
    { id: 'basic', label: '基本信息' },
    { id: 'detail', label: '详细信息' },
    { id: 'flavor', label: '风味描述' },
    { id: 'complete', label: '完成' }
];

const CoffeeBeanForm: React.FC<CoffeeBeanFormProps> = ({
    onSave,
    onCancel,
    initialBean,
}) => {


    // 当前步骤状态
    const [currentStep, setCurrentStep] = useState<Step>('basic')
    const inputRef = useRef<HTMLInputElement>(null)

    // 添加一个状态来跟踪正在编辑的剩余容量输入
    const [editingRemaining, setEditingRemaining] = useState<string | null>(null);

    // 记录初始剩余容量，用于检测容量变动
    const initialRemainingRef = useRef<string>(initialBean?.remaining || '');

    // 添加拼配成分状态
    const [blendComponents, setBlendComponents] = useState<BlendComponent[]>(() => {
        if (initialBean && initialBean.blendComponents && initialBean.blendComponents.length > 0) {
            return initialBean.blendComponents;
        }
        
        // 如果没有拼配成分，创建一个空的成分用于单品豆
        // （移除了旧的 origin/process/variety 字段兼容性代码）
        
        // 默认创建一个空成分
        return [{
            origin: '',
            process: '',
            variety: ''
        }];
    });

    const [bean, setBean] = useState<Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>>(() => {
        if (initialBean) {
            const { id: _id, timestamp: _timestamp, ...beanData } = initialBean;

            if (!beanData.roastLevel) {
                beanData.roastLevel = '浅度烘焙';
            }

            // 确保有beanType字段，默认为手冲
            if (!beanData.beanType) {
                beanData.beanType = 'filter';
            }

            const needFlavorPeriodInit = !beanData.startDay && !beanData.endDay;

            if (needFlavorPeriodInit && beanData.roastLevel) {
                // 这里先设置默认值，后续会在useEffect中用自定义设置覆盖
                let startDay = 0;
                let endDay = 0;

                if (beanData.roastLevel.includes('浅')) {
                    startDay = 7;
                    endDay = 30;
                } else if (beanData.roastLevel.includes('深')) {
                    startDay = 14;
                    endDay = 60;
                } else {
                    startDay = 10;
                    endDay = 30;
                }

                beanData.startDay = startDay;
                beanData.endDay = endDay;
            }

            return beanData;
        }

        return {
            name: '',
            capacity: '',
            remaining: '',
            roastLevel: '浅度烘焙',
            roastDate: '',
            flavor: [],
            price: '',
            beanType: 'filter', // 默认为手冲
            notes: '',
            startDay: 0,
            endDay: 0,
            blendComponents: []
        };
    });

    // 定义额外的状态来跟踪风味标签输入
    const [flavorInput, setFlavorInput] = useState('');

    // 从设置中加载自定义赏味期设置
    useEffect(() => {
        const loadSettingsAndInitializeBean = async () => {
            try {
                const { Storage } = await import('@/lib/core/storage');
                const settingsStr = await Storage.get('brewGuideSettings')
                let settings: SettingsOptions = defaultSettings;

                if (settingsStr) {
                    settings = JSON.parse(settingsStr)
                }

                // 如果是新建咖啡豆且没有设置赏味期，使用自定义设置初始化
                if (!initialBean && bean.startDay === 0 && bean.endDay === 0 && bean.roastLevel) {
                    const customFlavorPeriod = settings.customFlavorPeriod || defaultSettings.customFlavorPeriod;
                    const { startDay, endDay } = getDefaultFlavorPeriodByRoastLevelSync(bean.roastLevel, customFlavorPeriod);

                    setBean(prev => ({
                        ...prev,
                        startDay,
                        endDay
                    }));
                }
            } catch (error) {
                console.error('加载设置失败:', error)
            }
        }

        loadSettingsAndInitializeBean()
    }, [bean.endDay, bean.roastLevel, bean.startDay, initialBean])

    // 自动聚焦输入框
    useEffect(() => {
        if (currentStep === 'basic' && inputRef.current) {
            inputRef.current.focus();
        }
    }, [currentStep]);

    // 验证剩余容量，确保不超过总容量（失焦时再次验证）
    const validateRemaining = useCallback(() => {
        setEditingRemaining(null);

        if (bean.capacity && bean.remaining) {
            const capacityNum = parseFloat(bean.capacity);
            const remainingNum = parseFloat(bean.remaining);

            if (!isNaN(capacityNum) && !isNaN(remainingNum) && remainingNum > capacityNum) {
                setBean(prev => ({
                    ...prev,
                    remaining: bean.capacity
                }));
            }
        }
    }, [bean.capacity, bean.remaining]);

    // 处理总量失焦时的同步逻辑（现在主要逻辑在BasicInfo组件中处理）
    const handleCapacityBlur = useCallback(() => {
        // 预留给其他可能的失焦处理逻辑
    }, []);

    // 获取当前步骤索引
    const getCurrentStepIndex = () => {
        return steps.findIndex(step => step.id === currentStep);
    };

    // 下一步
    const handleNextStep = () => {
        validateRemaining();

        const currentIndex = getCurrentStepIndex();
        if (currentIndex < steps.length - 1) {
            setCurrentStep(steps[currentIndex + 1].id);
        } else {
            handleSubmit();
        }
    };

    // 上一步/返回
    const handleBack = () => {
        validateRemaining();

        const currentIndex = getCurrentStepIndex();
        if (currentIndex > 0) {
            setCurrentStep(steps[currentIndex - 1].id);
        } else {
            onCancel();
        }
    };

    // 添加风味标签
    const handleAddFlavor = (flavorValue?: string) => {
        const value = flavorValue || flavorInput;
        if (!value.trim()) return;

        if (bean.flavor?.includes(value.trim())) {
            if (!flavorValue) setFlavorInput('');
            return;
        }

        setBean({
            ...bean,
            flavor: [...(bean.flavor || []), value.trim()]
        });
        if (!flavorValue) setFlavorInput('');
    };

    // 移除风味标签
    const handleRemoveFlavor = (flavor: string) => {
        setBean({
            ...bean,
            flavor: bean.flavor?.filter((f: string) => f !== flavor) || []
        });
    };

    // 处理输入变化
    const handleInputChange = (field: keyof Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>) => (value: string) => {
        const safeValue = String(value || '');

        if (field === 'capacity') {
            // 修改正则表达式以允许小数点
            const numericValue = safeValue.replace(/[^0-9.]/g, '');

            // 确保只有一个小数点
            const dotCount = (numericValue.match(/\./g) || []).length;
            let sanitizedValue = dotCount > 1 ?
                numericValue.substring(0, numericValue.lastIndexOf('.')) :
                numericValue;

            // 限制小数点后只能有一位数字
            const dotIndex = sanitizedValue.indexOf('.');
            if (dotIndex !== -1 && dotIndex < sanitizedValue.length - 2) {
                sanitizedValue = sanitizedValue.substring(0, dotIndex + 2);
            }

            // 更新总量，不实时同步剩余量
            setBean(prev => ({
                ...prev,
                capacity: sanitizedValue,
                // 总量清空时，剩余量也清空
                remaining: sanitizedValue.trim() === '' ? '' : prev.remaining
            }));
            setEditingRemaining(null);
        } else if (field === 'remaining') {
            // 修改正则表达式以允许小数点
            const numericValue = safeValue.replace(/[^0-9.]/g, '');
            
            // 确保只有一个小数点
            const dotCount = (numericValue.match(/\./g) || []).length;
            let sanitizedValue = dotCount > 1 ? 
                numericValue.substring(0, numericValue.lastIndexOf('.')) : 
                numericValue;
                
            // 限制小数点后只能有一位数字
            const dotIndex = sanitizedValue.indexOf('.');
            if (dotIndex !== -1 && dotIndex < sanitizedValue.length - 2) {
                sanitizedValue = sanitizedValue.substring(0, dotIndex + 2);
            }

            setEditingRemaining(sanitizedValue);

            if (bean.capacity && sanitizedValue.trim() !== '') {
                const capacityNum = parseFloat(bean.capacity);
                const remainingNum = parseFloat(sanitizedValue);

                if (!isNaN(capacityNum) && !isNaN(remainingNum)) {
                    if (remainingNum > capacityNum) {
                        setEditingRemaining(bean.capacity);
                        setBean(prev => ({
                            ...prev,
                            remaining: prev.capacity
                        }));
                        return;
                    }
                }
            }

            setBean(prev => ({
                ...prev,
                remaining: sanitizedValue
            }));
        } else if (field === 'roastLevel') {
            setBean(prev => ({
                ...prev,
                [field]: safeValue
            }));

            setTimeout(() => autoSetFlavorPeriod(), 100);
        } else {
            setBean(prev => ({
                ...prev,
                [field]: safeValue
            }));
        }
    };

    // 添加拼配成分处理函数
    const handleAddBlendComponent = () => {
        // 计算当前总百分比
        const totalPercentage = blendComponents.reduce(
            (sum, comp) => (comp.percentage ? sum + comp.percentage : sum), 
            0
        );
        
        // 如果不是第一个成分且总百分比已经达到100%，则不允许添加更多成分
        if (blendComponents.length > 1 && totalPercentage >= 100) {
            return;
        }
        
        setBlendComponents([
            ...blendComponents,
            {
                origin: '',
                process: '',
                variety: ''
            }
        ]);
    };

    const handleRemoveBlendComponent = (index: number) => {
        if (blendComponents.length <= 1) return;

        const newComponents = blendComponents.filter((_, i) => i !== index);
        setBlendComponents(newComponents);
    };

    const handleBlendComponentChange = (index: number, field: keyof BlendComponent, value: string | number) => {
        const newComponents = [...blendComponents];
        
        if (field === 'percentage') {
            if (value === '' || value === null || value === undefined) {
                delete newComponents[index].percentage;
            } else {
                // 将输入值转换为数字
                const numValue = typeof value === 'string' ? parseInt(value) || 0 : value;
                
                // 直接设置值，AutocompleteInput组件的maxValue属性会负责限制最大值
                newComponents[index].percentage = numValue;
            }
        } else {
            newComponents[index][field] = value as string;
        }

        setBlendComponents(newComponents);
    };

    // 创建容量调整记录的辅助函数
    const createCapacityAdjustmentRecord = async (originalAmount: number, newAmount: number) => {
        const changeAmount = newAmount - originalAmount;
        const timestamp = Date.now();
        const changeType = changeAmount > 0 ? 'increase' : changeAmount < 0 ? 'decrease' : 'set';

        // 简化备注内容
        const noteContent = '容量调整(不计入统计)';

        // 创建容量调整记录（简化版本，参考快捷扣除记录）
        const adjustmentRecord = {
            id: timestamp.toString(),
            timestamp,
            source: 'capacity-adjustment',
            beanId: initialBean!.id,
            equipment: '',
            method: '',
            coffeeBeanInfo: {
                name: initialBean!.name || '',
                roastLevel: initialBean!.roastLevel || '中度烘焙',
                roastDate: initialBean!.roastDate
            },
            notes: noteContent,
            rating: 0,
            taste: { acidity: 0, sweetness: 0, bitterness: 0, body: 0 },
            params: {
                coffee: `${Math.abs(changeAmount)}g`,
                water: '',
                ratio: '',
                grindSize: '',
                temp: ''
            },
            totalTime: 0,
            changeRecord: {
                capacityAdjustment: {
                    originalAmount,
                    newAmount,
                    changeAmount,
                    changeType
                }
            }
        };

        // 保存记录（参考快捷扣除记录的保存方式）
        const { Storage } = await import('@/lib/core/storage');
        const existingNotesStr = await Storage.get('brewingNotes');
        const existingNotes = existingNotesStr ? JSON.parse(existingNotesStr) : [];
        const updatedNotes = [adjustmentRecord, ...existingNotes];

        // 更新全局缓存
        try {
            const { globalCache } = await import('@/components/notes/List/globalCache');
            globalCache.notes = updatedNotes;

            const { calculateTotalCoffeeConsumption } = await import('@/components/notes/List/globalCache');
            globalCache.totalConsumption = calculateTotalCoffeeConsumption(updatedNotes);
        } catch (error) {
            console.error('更新全局缓存失败:', error);
        }

        await Storage.set('brewingNotes', JSON.stringify(updatedNotes));
        console.warn('容量调整记录创建成功:', noteContent);
    };

    // 提交表单
    const handleSubmit = async () => {
        validateRemaining();

        // 保存自定义的预设值
        blendComponents.forEach(component => {
            // 检查产地是否是自定义值
            if (component.origin && !DEFAULT_ORIGINS.includes(component.origin)) {
                addCustomPreset('origins', component.origin);
            }

            // 检查处理法是否是自定义值
            if (component.process && !DEFAULT_PROCESSES.includes(component.process)) {
                addCustomPreset('processes', component.process);
            }

            // 检查品种是否是自定义值
            if (component.variety && !DEFAULT_VARIETIES.includes(component.variety)) {
                addCustomPreset('varieties', component.variety);
            }
        });

        // 如果是编辑模式且容量发生变化，创建容量变动记录
        if (initialBean && initialBean.id) {
            try {
                const originalAmount = parseFloat(initialRemainingRef.current || '0');
                const newAmount = parseFloat(bean.remaining || '0');
                const changeAmount = newAmount - originalAmount;

                // 检查是否有有效的变化（避免微小的浮点数差异）
                if (!isNaN(originalAmount) && !isNaN(newAmount) && Math.abs(changeAmount) >= 0.01) {
                    await createCapacityAdjustmentRecord(originalAmount, newAmount);
                }
            } catch (error) {
                console.error('创建容量变动记录失败:', error);
                // 不阻止保存流程，只记录错误
            }
        }

        // 统一使用成分属性
        onSave({
            ...bean,
            blendComponents: blendComponents
        });
    };

    // 根据烘焙度自动设置赏味期参数
    const autoSetFlavorPeriod = async () => {
        let startDay = 0;
        let endDay = 0;

        try {
            // 从设置中获取自定义赏味期配置
            const { Storage } = await import('@/lib/core/storage');
            const settingsStr = await Storage.get('brewGuideSettings');
            let customFlavorPeriod = defaultSettings.customFlavorPeriod;

            if (settingsStr) {
                const settings: SettingsOptions = JSON.parse(settingsStr);
                customFlavorPeriod = settings.customFlavorPeriod || defaultSettings.customFlavorPeriod;
            }

            // 使用工具函数获取烘焙度对应的赏味期设置
            const flavorPeriod = getDefaultFlavorPeriodByRoastLevelSync(bean.roastLevel || '', customFlavorPeriod);
            startDay = flavorPeriod.startDay;
            endDay = flavorPeriod.endDay;
        } catch (error) {
            console.error('获取自定义赏味期设置失败，使用默认值:', error);
            // 使用工具函数获取默认值
            const flavorPeriod = getDefaultFlavorPeriodByRoastLevelSync(bean.roastLevel || '');
            startDay = flavorPeriod.startDay;
            endDay = flavorPeriod.endDay;
        }

        setBean(prev => ({
            ...prev,
            startDay,
            endDay,
            isFrozen: false // 设置赏味期时取消冰冻状态
        }));
    };

    // 切换冰冻状态
    const toggleFrozenState = () => {
        setBean(prev => ({
            ...prev,
            isFrozen: !prev.isFrozen
        }));
    };

    // 切换在途状态
    const toggleInTransitState = () => {
        setBean(prev => ({
            ...prev,
            isInTransit: !prev.isInTransit,
            // 设为在途时清空烘焙日期和赏味期设置
            roastDate: !prev.isInTransit ? '' : prev.roastDate,
            startDay: !prev.isInTransit ? 0 : prev.startDay,
            endDay: !prev.isInTransit ? 0 : prev.endDay,
            isFrozen: !prev.isInTransit ? false : prev.isFrozen
        }));
    };



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
                setBean(prev => ({ ...prev, image: compressedBase64 }));
            } catch (error) {
                // Log error in development only
                if (process.env.NODE_ENV === 'development') {
                    console.error('图片处理失败:', error);
                }
            }
        };

        reader.onerror = () => {
            // Log error in development only
            if (process.env.NODE_ENV === 'development') {
                console.error('文件读取失败');
            }
        };

        reader.readAsDataURL(file);
    };

    // 验证当前步骤是否可以进行下一步
    const isStepValid = () => {
        if (currentStep === 'basic') {
            return typeof bean.name === 'string' && bean.name.trim() !== '';
        }
        
        if (currentStep === 'detail') {
            // 确保有选择beanType(手冲/意式)
            return typeof bean.beanType === 'string' && (bean.beanType === 'filter' || bean.beanType === 'espresso');
        }
        
        return true;
    };

    // 渲染进度条
    const renderProgressBar = () => {
        const currentIndex = getCurrentStepIndex();
        const progress = ((currentIndex + 1) / steps.length) * 100;

        return (
            <div className="w-full h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div
                    className="h-full bg-neutral-800 dark:bg-neutral-200 transition-all duration-300 ease-in-out"
                    style={{ width: `${progress}%` }}
                />
            </div>
        );
    };

    // 渲染步骤内容
    const renderStepContent = () => {
        switch (currentStep) {
            case 'basic':
                return (
                    <BasicInfo
                        bean={bean}
                        onBeanChange={handleInputChange}
                        onImageUpload={handleImageUpload}
                        editingRemaining={editingRemaining}
                        validateRemaining={validateRemaining}
                        handleCapacityBlur={handleCapacityBlur}
                        toggleInTransitState={toggleInTransitState}
                        isEdit={!!initialBean}
                    />
                );

            case 'detail':
                return (
                    <DetailInfo
                        bean={bean}
                        onBeanChange={handleInputChange}
                        blendComponents={blendComponents}
                        onBlendComponentsChange={{
                            add: handleAddBlendComponent,
                            remove: handleRemoveBlendComponent,
                            change: handleBlendComponentChange
                        }}
                        autoSetFlavorPeriod={autoSetFlavorPeriod}
                        toggleFrozenState={toggleFrozenState}
                    />
                );

            case 'flavor':
                return (
                    <FlavorInfo
                        bean={bean}
                        flavorInput={flavorInput}
                        onFlavorInputChange={setFlavorInput}
                        onAddFlavor={handleAddFlavor}
                        onRemoveFlavor={handleRemoveFlavor}
                    />
                );

            case 'complete':
                return (
                    <Complete
                        bean={bean}
                        blendComponents={blendComponents}
                        isEdit={!!initialBean}
                    />
                );

            default:
                return null;
        }
    };

    const renderNextButton = () => {
        const isLastStep = getCurrentStepIndex() === steps.length - 1;
        const valid = isStepValid();
        const canSave = valid && ['basic', 'detail', 'flavor'].includes(currentStep);

        const springTransition = { stiffness: 500, damping: 25 };
        const buttonBaseClass = "rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100";

        return (
            <div className="modal-bottom-button flex items-center justify-center">
                <div className="flex items-center justify-center gap-2">
                    <AnimatePresence mode="popLayout">
                        {canSave && (
                            <motion.button
                                key="save-button"
                                type="button"
                                onClick={handleSubmit}
                                className={`${buttonBaseClass} flex items-center gap-2 px-4 py-3 shrink-0`}
                                title="快速保存"
                                initial={{ scale: 0.8, opacity: 0, x: 15 }}
                                animate={{ scale: 1, opacity: 1, x: 0 }}
                                exit={{ scale: 0.8, opacity: 0, x: 15 }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                transition={springTransition}
                            >
                                <Check className="w-4 h-4" strokeWidth="3" />
                                <span className="font-medium">完成</span>
                            </motion.button>
                        )}
                    </AnimatePresence>

                    <motion.button
                        layout
                        type="button"
                        onClick={handleNextStep}
                        disabled={!valid}
                        transition={springTransition}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`${buttonBaseClass} flex items-center justify-center ${!valid ? 'opacity-0 cursor-not-allowed' : ''} ${isLastStep ? 'px-6 py-3' : 'p-4'}`}
                    >
                        {isLastStep ? (
                            <span className="font-medium">完成</span>
                        ) : (
                            <ArrowRight className="w-4 h-4" strokeWidth="3" />
                        )}
                    </motion.button>
                </div>
            </div>
        );
    };

    // 钩子函数确保任何步骤切换时都验证剩余容量
    useEffect(() => {
        validateRemaining();
    }, [currentStep, validateRemaining]);

    return (
        <div className="flex flex-col">
            <div className="flex items-center justify-between mt-3 mb-6">
                <button type="button" onClick={handleBack} className="rounded-full">
                    <ArrowLeft className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
                </button>

                <div className="flex-1 px-4">
                    {renderProgressBar()}
                </div>

                <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    {getCurrentStepIndex() + 1}/{steps.length}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-4">
                <AnimatePresence mode="wait">
                    {renderStepContent()}
                </AnimatePresence>
            </div>

            {renderNextButton()}
        </div>
    );
};

export default CoffeeBeanForm; 