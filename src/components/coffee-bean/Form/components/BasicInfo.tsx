import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { CornerDownRight, Camera, Image as ImageIcon, X } from 'lucide-react';
import AutocompleteInput from '@/components/common/forms/AutocompleteInput';
import { ExtendedCoffeeBean } from '../types';
import { pageVariants, pageTransition } from '../constants';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/coffee-bean/ui/select';
import { DatePicker } from '@/components/common/ui/DatePicker';
import { captureImage } from '@/lib/utils/imageCapture';

interface BasicInfoProps {
    bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>;
    onBeanChange: (field: keyof Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>) => (value: string) => void;
    onImageUpload: (file: File) => void;
    editingRemaining: string | null;
    validateRemaining: () => void;
    handleCapacityBlur?: () => void;
    toggleInTransitState: () => void;
    isEdit?: boolean;
}

const BasicInfo: React.FC<BasicInfoProps> = ({
    bean,
    onBeanChange,
    onImageUpload,
    editingRemaining,
    validateRemaining,
    handleCapacityBlur,
    toggleInTransitState,
    isEdit = false,
}) => {
    // 处理容量和剩余容量的状态
    const [capacityValue, setCapacityValue] = useState('');
    const [remainingValue, setRemainingValue] = useState('');

    // 续购功能状态
    const [showRepurchase, setShowRepurchase] = useState(false);
    const [repurchaseWeight, setRepurchaseWeight] = useState('');
    const [repurchasePrice, setRepurchasePrice] = useState('');

    // 初始化和同步容量值
    useEffect(() => {
        setCapacityValue(bean.capacity || '');
        setRemainingValue(editingRemaining !== null ? editingRemaining : (bean.remaining || ''));
    }, [bean.capacity, bean.remaining, editingRemaining]);
    
    // 处理日期变化
    const handleDateChange = (date: Date) => {
        // 使用本地时间格式化为 YYYY-MM-DD，避免时区问题
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;
        onBeanChange('roastDate')(formattedDate);
    };

    // 解析日期字符串为Date对象
    const parseRoastDate = (dateStr: string | undefined): Date | undefined => {
        if (!dateStr) return undefined;
        // 如果是完整的日期格式 YYYY-MM-DD
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // 使用本地时间创建Date对象，避免时区偏移
            const [year, month, day] = dateStr.split('-').map(Number);
            return new Date(year, month - 1, day);
        }
        // 如果只是年份，返回undefined让DatePicker显示placeholder
        return undefined;
    };
    
    // 处理容量变化 - 只更新本地状态，不触发主表单更新
    const handleCapacityChange = (value: string) => {
        setCapacityValue(value);
        // 不再实时调用 onBeanChange，只在失焦时处理
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

    // 处理续购功能
    const handleRepurchaseToggle = () => {
        setShowRepurchase(!showRepurchase);
        if (showRepurchase) {
            // 关闭时清空续购数据
            setRepurchaseWeight('');
            setRepurchasePrice('');
        }
    };

    // 处理续购确认
    const handleRepurchaseConfirm = () => {
        if (!repurchaseWeight || !repurchasePrice) return;

        const currentCapacity = parseFloat(capacityValue) || 0;
        const currentRemaining = parseFloat(remainingValue) || 0;
        const currentPrice = parseFloat(bean.price || '0') || 0;

        const addWeight = parseFloat(repurchaseWeight);
        const addPrice = parseFloat(repurchasePrice);

        if (isNaN(addWeight) || isNaN(addPrice)) return;

        // 更新总量和剩余量
        const newCapacity = (currentCapacity + addWeight).toString();
        const newRemaining = (currentRemaining + addWeight).toString();
        const newPrice = (currentPrice + addPrice).toString();

        // 更新状态
        setCapacityValue(newCapacity);
        setRemainingValue(newRemaining);

        // 更新主表单数据
        onBeanChange('capacity')(newCapacity);
        onBeanChange('remaining')(newRemaining);
        onBeanChange('price')(newPrice);

        // 关闭续购界面并清空数据
        setShowRepurchase(false);
        setRepurchaseWeight('');
        setRepurchasePrice('');
    };

    // 处理图片选择逻辑 (相册或拍照)
    const handleImageSelect = async (source: 'camera' | 'gallery') => {
        try {
            // 获取图片（已经是base64格式）
            const result = await captureImage({ source });
            
            // 将 dataUrl 转换为 File 对象并传递给父组件处理
            const response = await fetch(result.dataUrl);
            const blob = await response.blob();
            const file = new File([blob], `image.${result.format}`, { type: `image/${result.format}` });
            
            // 使用传入的onImageUpload函数处理文件（父组件会进行压缩）
            onImageUpload(file);
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.error('打开相机/相册失败:', error);
            }
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
                {/* 笔记图片 */}
                <div className="flex items-center gap-2 w-full">
                    {bean.image ? (
                        /* 有图片时：只显示图片 */
                        <div className="w-16 h-16 rounded bg-neutral-200/40 dark:bg-neutral-800/60 overflow-hidden relative flex-shrink-0">
                            <Image
                                src={bean.image}
                                alt="咖啡豆图片"
                                className="object-cover"
                                fill
                                sizes="64px"
                            />
                            {/* 删除按钮 */}
                            <button
                                type="button"
                                onClick={() => onBeanChange('image')('')}
                                className="absolute top-1 right-1 w-5 h-5 bg-neutral-800/80 dark:bg-neutral-200/80 text-white dark:text-neutral-800 rounded-full flex items-center justify-center hover:bg-red-500 dark:hover:bg-red-500 dark:hover:text-white transition-colors"
                            >
                                <X className="h-2.5 w-2.5" />
                            </button>
                        </div>
                    ) : (
                        /* 无图片时：显示两个占位框 */
                        <>
                            {/* 拍照框 */}
                            <button
                                type="button"
                                onClick={() => handleImageSelect('camera')}
                                className="w-16 h-16 rounded bg-neutral-200/40 dark:bg-neutral-800/60 flex items-center justify-center hover:bg-neutral-200/60 dark:hover:bg-neutral-800/80 transition-colors flex-shrink-0"
                                title="拍照"
                            >
                                <Camera className="w-5 h-5 text-neutral-300 dark:text-neutral-600" />
                            </button>
                            
                            {/* 相册框 */}
                            <button
                                type="button"
                                onClick={() => handleImageSelect('gallery')}
                                className="w-16 h-16 rounded bg-neutral-200/40 dark:bg-neutral-800/60 flex items-center justify-center hover:bg-neutral-200/60 dark:hover:bg-neutral-800/80 transition-colors flex-shrink-0"
                                title="相册"
                            >
                                <ImageIcon className="w-5 h-5 text-neutral-300 dark:text-neutral-600" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="space-y-2 w-full">
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    咖啡豆名称 <span className="text-red-500">*</span> <span className='text-xs text-neutral-400 dark:text-neutral-500 ml-1'>(可用：烘焙商 咖啡豆名称)</span>
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
                        库存量(g)
                    </label>
                    <div className="flex items-center justify-start w-full gap-2">
                        <div className="flex-1">
                            <input
                                type="number"
                                inputMode="decimal"
                                step="0.1"
                                value={remainingValue}
                                onChange={(e) => handleRemainingChange(e.target.value)}
                                placeholder="剩余量"
                                className="bg-transparent outline-none w-full text-center border-b border-neutral-300 dark:border-neutral-700 py-2"
                                onBlur={validateRemaining}
                            />
                        </div>
                        <span className="text-neutral-300 dark:text-neutral-700">/</span>
                        <div className="flex-1">
                            <input
                                type="number"
                                inputMode="decimal"
                                step="0.1"
                                value={capacityValue}
                                onChange={(e) => handleCapacityChange(e.target.value)}
                                placeholder="总量"
                                className="bg-transparent outline-none w-full text-center border-b border-neutral-300 dark:border-neutral-700 py-2"
                                onBlur={() => {
                                    // 失焦时更新主表单的总量
                                    onBeanChange('capacity')(capacityValue);

                                    // 失焦时判断是否需要同步剩余量
                                    if (capacityValue && (!remainingValue || remainingValue.trim() === '')) {
                                        setRemainingValue(capacityValue);
                                        onBeanChange('remaining')(capacityValue);
                                    }

                                    // 调用主表单的失焦处理函数（用于其他逻辑）
                                    handleCapacityBlur?.();
                                }}
                            />
                        </div>
                    </div>

                    {/* 续购按钮 - 只在编辑模式下显示 */}
                    {isEdit && (
                        <button
                            type="button"
                            onClick={handleRepurchaseToggle}
                            className="flex items-center text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors mt-1"
                            title="续购"
                        >
                            <CornerDownRight className="w-3 h-3 mr-1" />
                            续购
                        </button>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        价格(¥)
                    </label>
                    <AutocompleteInput
                        value={bean.price || ''}
                        onChange={onBeanChange('price')}
                        placeholder="例如：88"
                        clearable={false}
                        suggestions={[]}
                        inputType="number"
                        inputMode="decimal"
                        allowDecimal={true}
                        maxDecimalPlaces={2}
                    />
                </div>
            </div>

            {/* 续购表单 */}
            <AnimatePresence>
                {showRepurchase && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="w-full space-y-4"
                    >
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                        续购重量(g)
                                    </label>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        step="0.1"
                                        value={repurchaseWeight}
                                        onChange={(e) => setRepurchaseWeight(e.target.value)}
                                        placeholder="例如：250"
                                        className="bg-transparent outline-none w-full text-left border-b border-neutral-300 dark:border-neutral-700 py-2 focus:border-neutral-800 dark:focus:border-neutral-400"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                        续购价格(¥)
                                    </label>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        step="0.01"
                                        value={repurchasePrice}
                                        onChange={(e) => setRepurchasePrice(e.target.value)}
                                        placeholder="例如：88"
                                        className="bg-transparent outline-none w-full text-left border-b border-neutral-300 dark:border-neutral-700 py-2 focus:border-neutral-800 dark:focus:border-neutral-400"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-start space-x-4 text-xs">
                                <span
                                    onClick={handleRepurchaseToggle}
                                    className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer underline transition-colors"
                                >
                                    取消
                                </span>
                                <span
                                    onClick={handleRepurchaseConfirm}
                                    className={`cursor-pointer underline transition-colors ${
                                        !repurchaseWeight || !repurchasePrice
                                            ? 'text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
                                            : 'text-neutral-800 dark:text-neutral-200 hover:text-neutral-600 dark:hover:text-neutral-400'
                                    }`}
                                >
                                    添加续购
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-2 gap-6 w-full">
                <div className="space-y-2">
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        烘焙度
                    </label>
                    <Select
                        value={bean.roastLevel || ''}
                        onValueChange={(value) => onBeanChange('roastLevel')(value)}
                    >
                        <SelectTrigger
                            className="w-full py-2 bg-transparent border-0 border-b border-neutral-300 dark:border-neutral-700 focus-within:border-neutral-800 dark:focus-within:border-neutral-400 shadow-none rounded-none h-auto px-0 text-base placeholder:text-neutral-500 dark:placeholder:text-neutral-400 data-[placeholder]:text-neutral-500 dark:data-[placeholder]:text-neutral-400"
                        >
                            <SelectValue 
                                placeholder="选择烘焙度" 
                            />
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
                        {bean.isInTransit ? (
                            <div className="w-full py-2 bg-transparent border-b border-neutral-300 dark:border-neutral-700 opacity-50 text-neutral-500 dark:text-neutral-400">
                                在途中...
                            </div>
                        ) : (
                            <DatePicker
                                date={parseRoastDate(bean.roastDate)}
                                onDateChange={handleDateChange}
                                placeholder="选择烘焙日期"
                                className="w-full"
                            />
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default BasicInfo; 