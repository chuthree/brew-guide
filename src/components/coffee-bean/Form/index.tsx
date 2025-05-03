'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { ExtendedCoffeeBean, BlendComponent, Step, StepConfig } from './types'
import BasicInfo from './components/BasicInfo'
import DetailInfo from './components/DetailInfo'
import FlavorInfo from './components/FlavorInfo'
import Complete from './components/Complete'

// 二次压缩函数：将base64图片再次压缩
function compressBase64(base64: string, quality = 0.7, maxWidth = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      console.log('compressBase64开始, quality:', quality, 'maxWidth:', maxWidth);
      
      const img = new Image();
      
      // 添加错误处理
      img.onerror = (err) => {
        console.error('图片加载失败:', err);
        reject(new Error('图片加载失败'));
      };
      
      // 设置图片加载超时
      const imgLoadTimeout = setTimeout(() => {
        console.warn('图片加载超时');
        reject(new Error('图片加载超时'));
      }, 10000); // 10秒超时
      
      img.onload = () => {
        clearTimeout(imgLoadTimeout);
        console.log('图片加载成功, 原始尺寸:', img.width, 'x', img.height);
        
        try {
          let width = img.width;
          let height = img.height;

          // 缩放尺寸
          if (width > maxWidth) {
            height = height * (maxWidth / width);
            width = maxWidth;
          }
          
          console.log('缩放后尺寸:', width, 'x', height);

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            console.error('无法获取canvas上下文');
            throw new Error('无法获取canvas上下文');
          }
          
          // 绘制图片到Canvas
          ctx.drawImage(img, 0, 0, width, height);

          // 转换成新的Base64，使用较低的质量以确保在移动设备上也能运行良好
          try {
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            console.log('压缩成功, 原始base64长度:', base64.length, '压缩后长度:', compressedBase64.length);
            resolve(compressedBase64);
          } catch (toDataURLError) {
            console.error('toDataURL失败:', toDataURLError);
            reject(toDataURLError);
          }
        } catch (canvasError) {
          console.error('Canvas处理失败:', canvasError);
          reject(canvasError);
        }
      };
      
      // 设置图片源并开始加载
      console.log('设置图片源...');
      img.src = base64;
      
      // 对于已经缓存的图片，onload可能不会触发，所以检查complete属性
      if (img.complete) {
        console.log('图片已缓存，立即处理');
        clearTimeout(imgLoadTimeout);
        img.onload?.(new Event('load'));
      }
    } catch (error) {
      console.error('compressBase64整体错误:', error);
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
    // 当前步骤状态
    const [currentStep, setCurrentStep] = useState<Step>('basic')
    const inputRef = useRef<HTMLInputElement>(null)

    // 添加一个状态来跟踪正在编辑的剩余容量输入
    const [editingRemaining, setEditingRemaining] = useState<string | null>(null);

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
            origin: '',
            process: '',
            variety: '',
            price: '',
            type: '单品',
            beanType: 'filter', // 默认为手冲
            notes: '',
            startDay: 0,
            endDay: 0,
            blendComponents: []
        };
    });

    // 定义额外的状态来跟踪风味标签输入
    const [flavorInput, setFlavorInput] = useState('');

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
            const sanitizedValue = dotCount > 1 ? 
                numericValue.substring(0, numericValue.lastIndexOf('.')) : 
                numericValue;

            if (sanitizedValue.trim() !== '') {
                setBean(prev => ({
                    ...prev,
                    capacity: sanitizedValue,
                    remaining: sanitizedValue
                }));
                setEditingRemaining(null);
            } else {
                setBean(prev => ({
                    ...prev,
                    capacity: '',
                    remaining: ''
                }));
                setEditingRemaining(null);
            }
        } else if (field === 'remaining') {
            // 修改正则表达式以允许小数点
            const numericValue = safeValue.replace(/[^0-9.]/g, '');
            
            // 确保只有一个小数点
            const dotCount = (numericValue.match(/\./g) || []).length;
            const sanitizedValue = dotCount > 1 ? 
                numericValue.substring(0, numericValue.lastIndexOf('.')) : 
                numericValue;

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
        
        // 如果总百分比已经达到100%，则不允许添加更多成分
        if (totalPercentage >= 100) {
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

    // 提交表单
    const handleSubmit = () => {
        validateRemaining();

        // 根据blendComponents的数量自动判断是单品还是拼配
        const isBlend = blendComponents.length > 1;
        const beanType = isBlend ? '拼配' : '单品';

        // 统一使用成分属性，不管是单品还是拼配
        onSave({
            ...bean,
            type: beanType,
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
            endDay
        }));
    };

    // 处理图片上传
    const handleImageUpload = async (file: File) => {
        try {
            console.log('开始处理图片上传:', file.name, file.type, file.size);
            
            // 检查文件类型
            if (!file.type.startsWith('image/')) {
                console.error('文件类型不是图片:', file.type);
                return;
            }
            
            // 直接读取文件为base64
            const reader = new FileReader();
            
            // 设置超时处理，防止移动设备上FileReader挂起
            const readerTimeout = setTimeout(() => {
                console.warn('FileReader读取超时，可能是移动设备兼容性问题');
                // 尝试使用URL.createObjectURL作为备选方案
                try {
                    const objectUrl = URL.createObjectURL(file);
                    setBean(prev => ({
                        ...prev,
                        image: objectUrl
                    }));
                    // 清理URL对象
                    setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
                } catch (urlError) {
                    console.error('备选方案也失败了:', urlError);
                }
            }, 5000);
            
            reader.onloadend = async () => {
                clearTimeout(readerTimeout);
                try {
                    console.log('FileReader加载完成');
                    const originalBase64 = reader.result as string;
                    
                    if (!originalBase64 || typeof originalBase64 !== 'string') {
                        console.error('FileReader读取结果无效:', originalBase64);
                        return;
                    }
                    
                    console.log('读取到base64数据，长度:', originalBase64.length);
                    
                    try {
                        // 使用canvas方法进行压缩
                        console.log('开始压缩图片...');
                        const compressedBase64 = await compressBase64(originalBase64, 0.5, 800);
                        console.log('图片压缩完成，新base64长度:', compressedBase64.length);
                        
                        // 更新状态
                        setBean(prev => ({
                            ...prev,
                            image: compressedBase64
                        }));
                    } catch (compressError) {
                        console.error('图片压缩失败:', compressError);
                        // 如果压缩失败，使用原始图片
                        console.log('使用原始图片作为备选');
                        setBean(prev => ({
                            ...prev,
                            image: originalBase64
                        }));
                    }
                } catch (error) {
                    console.error('onloadend回调中处理失败:', error);
                    // 如果处理失败，尝试使用URL.createObjectURL
                    try {
                        const objectUrl = URL.createObjectURL(file);
                        setBean(prev => ({
                            ...prev,
                            image: objectUrl
                        }));
                        // 清理URL对象
                        setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
                    } catch (urlError) {
                        console.error('URL.createObjectURL也失败了:', urlError);
                    }
                }
            };
            
            reader.onerror = (error) => {
                clearTimeout(readerTimeout);
                console.error('FileReader读取出错:', error);
                // 如果读取出错，尝试使用URL.createObjectURL
                try {
                    const objectUrl = URL.createObjectURL(file);
                    setBean(prev => ({
                        ...prev,
                        image: objectUrl
                    }));
                    // 清理URL对象
                    setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
                } catch (urlError) {
                    console.error('URL.createObjectURL也失败了:', urlError);
                }
            };
            
            console.log('开始调用readAsDataURL...');
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('图片处理整体失败:', error);
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
        switch (currentStep) {
            case 'basic':
                return (
                    <BasicInfo
                        bean={bean}
                        onBeanChange={handleInputChange}
                        onImageUpload={handleImageUpload}
                        editingRemaining={editingRemaining}
                        validateRemaining={validateRemaining}
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

    // 渲染下一步按钮
    const renderNextButton = () => {
        const isLastStep = getCurrentStepIndex() === steps.length - 1;
        const valid = isStepValid();
        const canSave = valid && (currentStep === 'basic' || currentStep === 'detail' || currentStep === 'flavor');

        return (
            <div className="modal-bottom-button flex items-center justify-center">
                <div className="flex items-center justify-center gap-2">
                    <AnimatePresence mode="popLayout">
                        {canSave && (
                            <motion.button
                                key="save-button"
                                type="button"
                                onClick={handleSubmit}
                                className="bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800 rounded-full p-2 flex-shrink-0"
                                title="快速保存"
                                initial={{ scale: 0, opacity: 0, x: 30 }}
                                animate={{ scale: 1, opacity: 1, x: 0 }}
                                exit={{ scale: 0, opacity: 0, x: 30 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 500,
                                    damping: 25
                                }}
                            >
                                <Check className="w-4 h-4" strokeWidth="3" />
                            </motion.button>
                        )}
                    </AnimatePresence>
                    <motion.button
                        layout
                        type="button"
                        onClick={handleNextStep}
                        disabled={!valid}
                        transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 25
                        }}
                        className={`
                            flex items-center justify-center rounded-full
                            ${!valid ? 'opacity-0 cursor-not-allowed' : ''}
                            ${isLastStep
                                ? 'bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800 px-6 py-3'
                                : 'bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800 p-4'
                            }
                        `}
                    >
                        {isLastStep ? (
                            <span className="font-medium">完成</span>
                        ) : (
                            <div className="flex items-center relative">
                                <motion.div 
                                    className="h-0.5 bg-neutral-200 dark:bg-neutral-800"
                                    animate={{ 
                                        width: canSave ? "3.5rem" : "5.5rem" 
                                    }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 500,
                                        damping: 25
                                    }}
                                ></motion.div>
                                <div className="absolute -right-1 transform translate-x-0">
                                    <ArrowRight className="w-5 h-5 text-neutral-200 dark:text-neutral-800" />
                                </div>
                            </div>
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
            {/* 顶部导航栏 */}
            <div className="flex items-center justify-between mt-3 mb-6">
                <button
                    type="button"
                    onClick={handleBack}
                    className="rounded-full"
                >
                    <ArrowLeft className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
                </button>
                <div className="w-full px-4">
                    {renderProgressBar()}
                </div>
                <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    {getCurrentStepIndex() + 1}/{steps.length}
                </div>
            </div>

            {/* 步骤内容 */}
            <div className="flex-1 overflow-y-auto pb-4">
                <AnimatePresence mode="wait">
                    {renderStepContent()}
                </AnimatePresence>
            </div>

            {/* 下一步按钮 */}
            {renderNextButton()}
        </div>
    );
};

export default CoffeeBeanForm; 