import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import AutocompleteInput from '@/components/common/forms/AutocompleteInput';
import { ExtendedCoffeeBean } from '../types';
import { pageVariants, pageTransition } from '../constants';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/coffee-bean/ui/select';
import { InputOTP, InputOTPSlot } from '@/components/common/ui/input-otp';
import { REGEXP_ONLY_DIGITS } from 'input-otp';

interface BasicInfoProps {
    bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>;
    onBeanChange: (field: keyof Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>) => (value: string) => void;
    onImageUpload: (file: File) => void;
    editingRemaining: string | null;
    validateRemaining: () => void;
    toggleInTransitState: () => void;
}

const BasicInfo: React.FC<BasicInfoProps> = ({
    bean,
    onBeanChange,
    onImageUpload,
    editingRemaining,
    validateRemaining,
    toggleInTransitState,
}) => {
    // 处理容量和剩余容量的状态
    const [capacityValue, setCapacityValue] = useState('');
    const [remainingValue, setRemainingValue] = useState('');
    
    // 初始化和同步容量值
    useEffect(() => {
        setCapacityValue(bean.capacity || '');
        setRemainingValue(editingRemaining !== null ? editingRemaining : (bean.remaining || ''));
    }, [bean.capacity, bean.remaining, editingRemaining]);
    
    // 自动填充年份
    useEffect(() => {
        if (!bean.roastDate) {
            const currentYear = new Date().getFullYear().toString();
            onBeanChange('roastDate')(currentYear);
        }
    }, [bean.roastDate, onBeanChange]);
    
    // 处理容量变化
    const handleCapacityChange = (value: string) => {
        setCapacityValue(value);
        onBeanChange('capacity')(value);
        // 如果剩余容量为空或者剩余容量大于总容量，则同步剩余容量
        if (!remainingValue || (parseFloat(value) < parseFloat(remainingValue))) {
            setRemainingValue(value);
            onBeanChange('remaining')(value);
        }
    };
    
    // 处理剩余容量变化
    const handleRemainingChange = (value: string) => {
        // 确保剩余容量不大于总容量
        if (capacityValue && parseFloat(value) > parseFloat(capacityValue)) {
            value = capacityValue;
        }
        setRemainingValue(value);
        onBeanChange('remaining')(value);
    };

    // 处理图片选择逻辑 (相册或拍照)
    const handleImageSelect = (source: 'camera' | 'gallery') => {
        try {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            
            // 根据来源设置不同的capture属性
            if (source === 'camera') {
                fileInput.setAttribute('capture', 'environment');
            }
            
            fileInput.onchange = (e) => {
                const input = e.target as HTMLInputElement;
                if (!input.files || input.files.length === 0) return;
                
                const file = input.files[0];
                if (file.type.startsWith('image/')) {
                    // 先预览一下图片，以便用户知道已经选择了图片
                    const tempUrl = URL.createObjectURL(file);
                    // 临时设置图片预览
                    onBeanChange('image')(tempUrl);
                    // 然后正常处理添加
                    handleFileSelect(file);
                    // 释放URL对象
                    setTimeout(() => URL.revokeObjectURL(tempUrl), 5000);
                }
            };
            fileInput.click();
        } catch (error) {
            console.error('打开相机/相册失败:', error);
        }
    };

    // 处理直接选择文件添加
    const handleFileSelect = (file: File) => {
        try {
            // 检查文件类型
            if (!file.type.startsWith('image/')) {
                console.error('不支持的文件类型:', file.type);
                return;
            }

            console.log('选择的文件信息:', {
                name: file.name,
                type: file.type,
                size: file.size,
            });

            // 使用传入的onImageUpload函数处理文件
            onImageUpload(file);
        } catch (error) {
            console.error('图片添加失败:', error);
        }
    };

    return (
        <motion.div
            key="basic-step"
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="space-y-8 max-w-md mx-auto flex flex-col items-center justify-center h-full"
        >
            <div className="space-y-2 w-full">
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    咖啡豆图片
                </label>
                <div className="flex items-center justify-center relative">
                    <div className="w-32 h-32 rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-700 flex flex-col items-center justify-center overflow-hidden relative">
                        {bean.image ? (
                            <div className="relative w-full h-full">
                                <Image
                                    src={bean.image}
                                    alt="咖啡豆图片"
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
                                        onClick={() => onBeanChange('image')('')}
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

            <div className="space-y-2 w-full">
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    咖啡豆名称 <span className="text-red-500">*</span>
                </label>
                <AutocompleteInput
                    value={bean.name || ''}
                    onChange={onBeanChange('name')}
                    placeholder="输入咖啡豆名称"
                    suggestions={[]}
                    required
                    clearable
                    inputMode="text"
                    onBlur={() => {
                        if (!bean.name?.trim()) {
                            onBeanChange('name')('未命名咖啡豆');
                        }
                    }}
                />
            </div>

            <div className="grid grid-cols-2 gap-6 w-full">
                <div className="space-y-2">
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        剩余量 / 总量 (g)
                    </label>
                    <div className="flex items-center justify-start w-full">
                        <div className="flex items-center border-b border-neutral-300 dark:border-neutral-700 py-2 w-full">
                            <input
                                type="number"
                                inputMode="decimal"
                                step="0.1"
                                value={remainingValue}
                                onChange={(e) => handleRemainingChange(e.target.value)}
                                placeholder="剩余"
                                className="bg-transparent outline-none w-1/2 text-center"
                                onBlur={validateRemaining}
                            />
                            <span className="text-neutral-500 dark:text-neutral-400 px-1">/</span>
                            <input
                                type="number"
                                inputMode="decimal"
                                step="0.1"
                                value={capacityValue}
                                onChange={(e) => handleCapacityChange(e.target.value)}
                                placeholder="总量"
                                className="bg-transparent outline-none w-1/2 text-center"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        价格
                    </label>
                    <AutocompleteInput
                        value={bean.price || ''}
                        onChange={onBeanChange('price')}
                        placeholder="例如：88"
                        unit="¥"
                        clearable={false}
                        suggestions={[]}
                        inputType="number"
                        inputMode="decimal"
                        allowDecimal={true}
                        maxDecimalPlaces={2}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6 w-full">
                <div className="space-y-2">
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        烘焙度
                    </label>
                    <Select
                        value={bean.roastLevel || '浅度烘焙'}
                        onValueChange={(value) => onBeanChange('roastLevel')(value)}
                    >
                        <SelectTrigger 
                            className="w-full py-2 bg-transparent border-0 border-b border-neutral-300 dark:border-neutral-700 focus-within:border-neutral-800 dark:focus-within:border-neutral-400 shadow-none rounded-none h-auto px-0 text-base"
                        >
                            <SelectValue placeholder="选择烘焙度" />
                        </SelectTrigger>
                        <SelectContent 
                            className="max-h-[40vh] overflow-y-auto border-neutral-200/70 dark:border-neutral-800/70 shadow-lg backdrop-blur-xs bg-white/95 dark:bg-neutral-900/95 rounded-lg"
                        >
                            <SelectItem value="极浅烘焙">极浅烘焙</SelectItem>
                            <SelectItem value="浅度烘焙">浅度烘焙</SelectItem>
                            <SelectItem value="中浅烘焙">中浅烘焙</SelectItem>
                            <SelectItem value="中度烘焙">中度烘焙</SelectItem>
                            <SelectItem value="中深烘焙">中深烘焙</SelectItem>
                            <SelectItem value="深度烘焙">深度烘焙</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                            烘焙日期
                        </label>
                        <button
                            type="button"
                            onClick={toggleInTransitState}
                            className={`text-xs ${bean.isInTransit ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-600 dark:text-neutral-400'} underline`}
                        >
                            {bean.isInTransit ? '取消在途状态' : '设为在途'}
                        </button>
                    </div>
                    <div className="flex items-center justify-start w-full relative">
                        <InputOTP
                            maxLength={8}
                            value={bean.isInTransit ? '' : (bean.roastDate?.replace(/-/g, '') || '')}
                            onChange={(value) => {
                                if (bean.isInTransit) return; // 在途状态下禁止输入

                                if (value.length === 8) {
                                    // 格式化为 YYYY-MM-DD
                                    const year = value.substring(0, 4);
                                    const month = value.substring(4, 6);
                                    const day = value.substring(6, 8);
                                    const formattedDate = `${year}-${month}-${day}`;
                                    onBeanChange('roastDate')(formattedDate);
                                } else if (value.length === 0) {
                                    // 如果清空了输入，则重置
                                    onBeanChange('roastDate')('');
                                } else {
                                    // 如果不是完整日期，只保存当前输入
                                    onBeanChange('roastDate')(value ? value : '');
                                }
                            }}
                            pattern={REGEXP_ONLY_DIGITS}
                            containerClassName="justify-between"
                            disabled={bean.isInTransit}
                        >
                            <InputOTPSlot index={0} className={bean.isInTransit ? 'opacity-50' : ''} />
                            <InputOTPSlot index={1} className={bean.isInTransit ? 'opacity-50' : ''} />
                            <InputOTPSlot index={2} className={bean.isInTransit ? 'opacity-50' : ''} />
                            <InputOTPSlot index={3} className={bean.isInTransit ? 'opacity-50' : ''} />
                            <span className={`text-neutral-500 dark:text-neutral-400 border-b border-neutral-300 dark:border-neutral-700 h-[40px] flex items-center px-0.5 ${bean.isInTransit ? 'opacity-50' : ''}`}>-</span>
                            <InputOTPSlot index={4} className={bean.isInTransit ? 'opacity-50' : ''} />
                            <InputOTPSlot index={5} className={bean.isInTransit ? 'opacity-50' : ''} />
                            <span className={`text-neutral-500 dark:text-neutral-400 border-b border-neutral-300 dark:border-neutral-700 h-[40px] flex items-center px-0.5 ${bean.isInTransit ? 'opacity-50' : ''}`}>-</span>
                            <InputOTPSlot index={6} className={bean.isInTransit ? 'opacity-50' : ''} />
                            <InputOTPSlot index={7} className={bean.isInTransit ? 'opacity-50' : ''} />
                        </InputOTP>
                        {bean.isInTransit && (
                            <div className="absolute inset-0 flex items-center  pointer-events-none">
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default BasicInfo; 