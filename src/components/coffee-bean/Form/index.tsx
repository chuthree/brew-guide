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

// 二次压缩函数：将base64图片再次压缩，包含Canvas渲染失败检测
function compressBase64(base64: string, quality = 0.8, maxWidth = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // 计算base64字符串大小（近似值）
      const approximateSizeInBytes = base64.length * 0.75;

      // 如果图片小于200kb，直接返回原图，不进行压缩
      if (approximateSizeInBytes <= 200 * 1024) {
        resolve(base64);
        return;
      }

      const img = new Image();

      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };

      const imgLoadTimeout = setTimeout(() => {
        reject(new Error('图片加载超时'));
      }, 10000);

      img.onload = () => {
        clearTimeout(imgLoadTimeout);

        try {
          let width = img.width;
          let height = img.height;

          // 缩放尺寸
          if (width > maxWidth) {
            height = height * (maxWidth / width);
            width = maxWidth;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('无法获取canvas上下文');
          }

          ctx.drawImage(img, 0, 0, width, height);

          try {
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);

            // 检测Canvas渲染失败的情况
            const compressionRatio = ((base64.length - compressedBase64.length) / base64.length * 100);
            const compressedSizeKB = Math.round(compressedBase64.length * 0.75 / 1024);

            // 如果压缩率超过97%且最终文件小于50KB，很可能是Canvas渲染失败
            if (compressionRatio > 97 && compressedSizeKB < 50) {
              // 返回原图，避免使用损坏的压缩结果
              resolve(base64);
              return;
            }

            resolve(compressedBase64);
          } catch (toDataURLError) {
            reject(toDataURLError);
          }
        } catch (canvasError) {
          reject(canvasError);
        }
      };

      img.src = base64;

      if (img.complete) {
        clearTimeout(imgLoadTimeout);
        img.onload?.(new Event('load'));
      }
    } catch (error) {
      reject(error);
    }
  });
}

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
    // 简单模式状态 - 从设置中读取
    const [isSimpleMode, setIsSimpleMode] = useState(false)

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
        
        // 如果是单品且有传统的产地/处理法/品种属性，则使用这些属性创建一个成分
        if (initialBean && (initialBean.origin || initialBean.process || initialBean.variety)) {
            return [{
                origin: initialBean.origin || '',
                process: initialBean.process || '',
                variety: initialBean.variety || ''
            }];
        }
        
        // 默认创建一个空成分
        return [{
            origin: '',
            process: '',
            variety: ''
        }];
    });

    const [bean, setBean] = useState<Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>>(() => {
        if (initialBean) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, timestamp, ...beanData } = initialBean;

            if (!beanData.roastLevel) {
                beanData.roastLevel = '浅度烘焙';
            }

            // 确保有beanType字段，默认为手冲
            if (!beanData.beanType) {
                beanData.beanType = 'filter';
            }

            const needFlavorPeriodInit = !beanData.startDay && !beanData.endDay;

            if (needFlavorPeriodInit && beanData.roastLevel) {
                let startDay = 0;
                let endDay = 0;

                if (beanData.roastLevel.includes('浅')) {
                    startDay = 7;
                    endDay = 30;
                } else if (beanData.roastLevel.includes('深')) {
                    startDay = 14;
                    endDay = 30;
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

    // 从设置中加载简单模式状态
    useEffect(() => {
        const loadSimpleModeFromSettings = async () => {
            try {
                const { Storage } = await import('@/lib/core/storage');
                const settingsStr = await Storage.get('brewGuideSettings')
                if (settingsStr) {
                    const settings: SettingsOptions = JSON.parse(settingsStr)
                    setIsSimpleMode(settings.simpleBeanFormMode ?? defaultSettings.simpleBeanFormMode)
                } else {
                    setIsSimpleMode(defaultSettings.simpleBeanFormMode)
                }
            } catch (error) {
                console.error('加载简单模式设置失败:', error)
                setIsSimpleMode(defaultSettings.simpleBeanFormMode)
            }
        }

        loadSimpleModeFromSettings()
    }, [])

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

        // 简单模式直接提交
        if (isSimpleMode) {
            handleSubmit();
            return;
        }

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
            flavor: bean.flavor?.filter(f => f !== flavor) || []
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
        console.log('容量调整记录创建成功:', noteContent);
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
    const autoSetFlavorPeriod = () => {
        let startDay = 0;
        let endDay = 0;

        if (bean.roastLevel?.includes('浅')) {
            startDay = 7;
            endDay = 30;
        } else if (bean.roastLevel?.includes('深')) {
            startDay = 14;
            endDay = 60;
        } else {
            startDay = 10;
            endDay = 30;
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

    // 切换简单模式并保存到设置
    const handleSimpleModeToggle = async (newSimpleMode: boolean) => {
        setIsSimpleMode(newSimpleMode)

        try {
            // 获取当前设置
            const { Storage } = await import('@/lib/core/storage');
            const settingsStr = await Storage.get('brewGuideSettings')
            let settings: SettingsOptions = defaultSettings

            if (settingsStr) {
                settings = { ...defaultSettings, ...JSON.parse(settingsStr) }
            }

            // 更新简单模式设置
            const newSettings = { ...settings, simpleBeanFormMode: newSimpleMode }

            // 保存到存储
            await Storage.set('brewGuideSettings', JSON.stringify(newSettings))

            // 触发设置变更事件
            window.dispatchEvent(new CustomEvent('storageChange', {
                detail: { key: 'brewGuideSettings' }
            }))
        } catch (error) {
            console.error('保存简单模式设置失败:', error)
        }
    };

    // 处理图片上传
    const handleImageUpload = async (file: File) => {
        try {
            // 检查文件类型
            if (!file.type.startsWith('image/')) {
                return;
            }
            
            // 直接读取文件为base64
            const reader = new FileReader();
            
            // 设置超时处理，防止移动设备上FileReader挂起
            const readerTimeout = setTimeout(() => {
                // 尝试使用URL.createObjectURL作为备选方案
                try {
                    const objectUrl = URL.createObjectURL(file);
                    setBean(prev => ({
                        ...prev,
                        image: objectUrl
                    }));
                    // 清理URL对象
                    setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
                } catch {
                    // 备选方案失败，静默处理
                }
            }, 5000);
            
            reader.onloadend = async () => {
                clearTimeout(readerTimeout);
                try {
                    const originalBase64 = reader.result as string;

                    if (!originalBase64 || typeof originalBase64 !== 'string') {
                        return;
                    }

                    try {
                        // 使用canvas方法进行压缩
                        const compressedBase64 = await compressBase64(originalBase64, 0.5, 800);

                        // 更新状态
                        setBean(prev => ({
                            ...prev,
                            image: compressedBase64
                        }));
                    } catch {
                        // 如果压缩失败，使用原始图片
                        setBean(prev => ({
                            ...prev,
                            image: originalBase64
                        }));
                    }
                } catch {
                    // 如果处理失败，尝试使用URL.createObjectURL
                    try {
                        const objectUrl = URL.createObjectURL(file);
                        setBean(prev => ({
                            ...prev,
                            image: objectUrl
                        }));
                        // 清理URL对象
                        setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
                    } catch {
                        // URL.createObjectURL失败，静默处理
                    }
                }
            };
            
            reader.onerror = () => {
                clearTimeout(readerTimeout);
                // 如果读取出错，尝试使用URL.createObjectURL
                try {
                    const objectUrl = URL.createObjectURL(file);
                    setBean(prev => ({
                        ...prev,
                        image: objectUrl
                    }));
                    // 清理URL对象
                    setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
                } catch {
                    // URL.createObjectURL失败，静默处理
                }
            };

            reader.readAsDataURL(file);
        } catch {
            // 图片处理失败，静默处理
        }
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
        // 简单模式只显示基本信息
        if (isSimpleMode) {
            return (
                <BasicInfo
                    bean={bean}
                    onBeanChange={handleInputChange}
                    onImageUpload={handleImageUpload}
                    editingRemaining={editingRemaining}
                    validateRemaining={validateRemaining}
                    handleCapacityBlur={handleCapacityBlur}
                    toggleInTransitState={toggleInTransitState}
                    isSimpleMode={true}
                    isEdit={!!initialBean}
                />
            );
        }

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
                        isSimpleMode={false}
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
        const canSave = valid && ['basic', 'detail', 'flavor'].includes(currentStep) && !isSimpleMode;

        const springTransition = { type: "spring", stiffness: 500, damping: 25 };
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
                        className={`${buttonBaseClass} flex items-center justify-center ${!valid ? 'opacity-0 cursor-not-allowed' : ''} ${isLastStep || isSimpleMode ? 'px-6 py-3' : 'p-4'}`}
                    >
                        {isLastStep || isSimpleMode ? (
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

                {!isSimpleMode && (
                    <div className="flex-1 px-4">
                        {renderProgressBar()}
                    </div>
                )}

                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isSimpleMode}
                            onChange={(e) => handleSimpleModeToggle(e.target.checked)}
                            className="sr-only"
                        />
                        <div className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${isSimpleMode ? 'bg-neutral-800 dark:bg-neutral-200' : 'bg-neutral-300 dark:bg-neutral-600'}`}>
                            <div className={`absolute top-0.5 w-3 h-3 bg-white dark:bg-neutral-800 rounded-full transition-transform duration-200 ${isSimpleMode ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                        </div>
                        <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">简单</span>
                    </label>

                    {!isSimpleMode && (
                        <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                            {getCurrentStepIndex() + 1}/{steps.length}
                        </div>
                    )}
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