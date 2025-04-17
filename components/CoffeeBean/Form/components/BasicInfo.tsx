import React from 'react';
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
                <div className="relative aspect-square w-32 mx-auto">
                    <div className="absolute inset-0 rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 overflow-hidden">
                        {bean.image ? (
                            <div className="relative w-full h-full">
                                <Image
                                    src={bean.image}
                                    alt="咖啡豆图片"
                                    fill
                                    className="object-cover"
                                />
                                <button
                                    type="button"
                                    className="absolute top-2 right-2 p-1.5 bg-neutral-800/50 hover:bg-neutral-800/70 rounded-full text-neutral-100"
                                    onClick={() => onBeanChange('image')('')}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            onImageUpload(file);
                                        }
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-neutral-400 dark:text-neutral-600 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span className="text-xs text-neutral-500 dark:text-neutral-400">点击上传图片</span>
                                </div>
                            </>
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
                            max={new Date().toISOString().split('T')[0]}
                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                        />
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default BasicInfo; 