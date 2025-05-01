import React, { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import AutocompleteInput from '@/components/AutocompleteInput';
import { ExtendedCoffeeBean } from '../types';
import { pageVariants, pageTransition } from '../constants';

interface BasicInfoProps {
    bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>;
    onBeanChange: (field: keyof Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>) => (value: string) => void;
    onImageUpload: (file: File) => void;
    editingRemaining: string | null;
    validateRemaining: () => void;
}

const BasicInfo: React.FC<BasicInfoProps> = ({
    bean,
    onBeanChange,
    onImageUpload,
    editingRemaining,
    validateRemaining,
}) => {
    // 添加loading状态跟踪图片添加过程
    const [isUploading, setIsUploading] = useState(false);

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
                    // 设置上传状态
                    setIsUploading(true);
                    
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

            // 设置添加状态
            setIsUploading(true);

            // 使用传入的onImageUpload函数处理文件
            onImageUpload(file);

            // 注意：由于onImageUpload是异步的，我们在合适的时机需要重置loading状态
            // 但由于无法确定何时完成，添加一个超时保底重置loading状态
            setTimeout(() => {
                setIsUploading(false);
            }, 5000); // 5秒后重置状态
        } catch (error) {
            console.error('图片添加失败:', error);
            setIsUploading(false);
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
                                <div className="absolute inset-0 bg-black bg-opacity-30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-white text-xs font-medium">点击预览</span>
                                </div>
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
                                    {isUploading ? (
                                        <div className="flex flex-col items-center justify-center">
                                            <svg className="animate-spin h-5 w-5 text-neutral-500 dark:text-neutral-400 mb-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span className="text-xs text-neutral-500 dark:text-neutral-400">处理中...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-neutral-400 dark:text-neutral-600 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span className="text-xs text-neutral-500 dark:text-neutral-400">选择图片</span>
                                        </>
                                    )}
                                </div>
                                
                                {/* 图片上传按钮组 */}
                                <div className="flex w-full mt-auto">
                                    <button
                                        type="button"
                                        onClick={() => handleImageSelect('camera')}
                                        disabled={isUploading}
                                        className="flex-1 py-1 text-xs text-neutral-600 dark:text-neutral-400 border-t border-r border-neutral-300 dark:border-neutral-700"
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
                                        disabled={isUploading}
                                        className="flex-1 py-1 text-xs text-neutral-600 dark:text-neutral-400 border-t border-neutral-300 dark:border-neutral-700"
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
                        容量
                    </label>
                    <AutocompleteInput
                        value={bean.capacity || ''}
                        onChange={onBeanChange('capacity')}
                        placeholder="例如：100"
                        unit="g"
                        clearable={false}
                        suggestions={[]}
                        inputType="tel"
                    />
                </div>

                <div className="space-y-2">
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        剩余容量
                    </label>
                    <AutocompleteInput
                        value={editingRemaining !== null ? editingRemaining : (bean.remaining || '')}
                        onChange={onBeanChange('remaining')}
                        placeholder="例如：100"
                        unit="g"
                        clearable={false}
                        suggestions={[]}
                        inputType="tel"
                        onBlur={validateRemaining}
                    />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-6 w-full">
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
                        inputType="tel"
                    />
                </div>

                <div className="space-y-2">
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        烘焙度
                    </label>
                    <select
                        value={bean.roastLevel || '浅度烘焙'}
                        onChange={(e) => onBeanChange('roastLevel')(e.target.value)}
                        className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400 appearance-none"
                    >
                        <option value="极浅烘焙">极浅烘焙</option>
                        <option value="浅度烘焙">浅度烘焙</option>
                        <option value="中浅烘焙">中浅烘焙</option>
                        <option value="中度烘焙">中度烘焙</option>
                        <option value="中深烘焙">中深烘焙</option>
                        <option value="深度烘焙">深度烘焙</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        烘焙日期
                    </label>
                    <div 
                        className="relative w-full cursor-pointer"
                        onClick={() => {
                            const dateInput = document.getElementById('bean-roast-date');
                            if (dateInput) {
                                (dateInput as HTMLInputElement & { showPicker: () => void }).showPicker();
                            }
                        }}
                    >
                        <div className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus-within:border-neutral-800 dark:focus-within:border-neutral-400">
                            <div className="flex items-center justify-between">
                                <span className={`${!bean.roastDate ? 'text-neutral-500' : ''}`}>
                                    {bean.roastDate ? new Date(bean.roastDate).toLocaleDateString('zh-CN') : '点击选择'}
                                </span>
                            </div>
                        </div>
                        <input
                            id="bean-roast-date"
                            type="date"
                            value={bean.roastDate || ''}
                            onChange={(e) => onBeanChange('roastDate')(e.target.value)}
                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                        />
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default BasicInfo; 