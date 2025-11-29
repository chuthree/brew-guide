import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Camera, Image as ImageIcon, X, CornerDownRight } from 'lucide-react';
import AutocompleteInput from '@/components/common/forms/AutocompleteInput';
import { ExtendedCoffeeBean } from '../types';
import { pageVariants, pageTransition } from '../constants';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/coffee-bean/ui/select';
import { DatePicker } from '@/components/common/ui/DatePicker';
import { captureImage } from '@/lib/utils/imageCapture';

interface BasicInfoProps {
  bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>;
  onBeanChange: (
    field: keyof Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>
  ) => (value: string) => void;
  onImageUpload: (file: File) => void;
  editingRemaining: string | null;
  validateRemaining: () => void;
  handleCapacityBlur?: () => void;
  toggleInTransitState: () => void;
  isEdit?: boolean;
  onRepurchase?: () => void;
}

// 判断是否为生豆
const isGreenBean = (
  bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>
): boolean => {
  return bean.beanState === 'green';
};

// 判断是否为烘焙模式（从生豆转换而来）
const isRoastingMode = (
  bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>
): boolean => {
  return !!bean.sourceGreenBeanId && bean.beanState === 'roasted';
};

const BasicInfo: React.FC<BasicInfoProps> = ({
  bean,
  onBeanChange,
  onImageUpload,
  editingRemaining,
  validateRemaining,
  handleCapacityBlur,
  toggleInTransitState,
  isEdit = false,
  onRepurchase,
}) => {
  // 处理容量和剩余容量的状态
  const [capacityValue, setCapacityValue] = useState('');
  const [remainingValue, setRemainingValue] = useState('');

  // 初始化和同步容量值
  useEffect(() => {
    setCapacityValue(bean.capacity || '');
    setRemainingValue(
      editingRemaining !== null ? editingRemaining : bean.remaining || ''
    );
  }, [bean.capacity, bean.remaining, editingRemaining]);

  // 处理日期变化 - 根据豆子状态决定更新哪个字段
  const handleDateChange = (date: Date) => {
    // 使用本地时间格式化为 YYYY-MM-DD，避免时区问题
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

    // 生豆使用 purchaseDate，熟豆使用 roastDate
    if (isGreenBean(bean)) {
      onBeanChange('purchaseDate')(formattedDate);
    } else {
      onBeanChange('roastDate')(formattedDate);
    }
  };

  // 解析日期字符串为Date对象 - 根据豆子状态获取对应日期
  const parseDisplayDate = (): Date | undefined => {
    const dateStr = isGreenBean(bean) ? bean.purchaseDate : bean.roastDate;
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

  // 获取日期标签和占位符文本
  const getDateLabelAndPlaceholder = () => {
    if (isGreenBean(bean)) {
      return { label: '购买日期', placeholder: '选择购买日期' };
    }
    return { label: '烘焙日期', placeholder: '选择烘焙日期' };
  };

  const { label: dateLabel, placeholder: datePlaceholder } =
    getDateLabelAndPlaceholder();

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

  // 处理图片选择逻辑 (相册或拍照)
  const handleImageSelect = async (source: 'camera' | 'gallery') => {
    try {
      // 获取图片（已经是base64格式）
      const result = await captureImage({ source });

      // 将 dataUrl 转换为 File 对象并传递给父组件处理
      const response = await fetch(result.dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `image.${result.format}`, {
        type: `image/${result.format}`,
      });

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
      className="mx-auto flex h-full max-w-md flex-col items-center justify-center space-y-8"
    >
      <div className="w-full space-y-2">
        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
          咖啡豆图片
        </label>
        {/* 笔记图片 */}
        <div className="flex w-full items-center gap-2">
          {bean.image ? (
            /* 有图片时：只显示图片 */
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-neutral-200/40 dark:bg-neutral-800/60">
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
                className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-800/80 text-white transition-colors hover:bg-red-500 dark:bg-neutral-200/80 dark:text-neutral-800 dark:hover:bg-red-500 dark:hover:text-white"
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
                className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded bg-neutral-200/40 transition-colors hover:bg-neutral-200/60 dark:bg-neutral-800/60 dark:hover:bg-neutral-800/80"
                title="拍照"
              >
                <Camera className="h-5 w-5 text-neutral-300 dark:text-neutral-600" />
              </button>

              {/* 相册框 */}
              <button
                type="button"
                onClick={() => handleImageSelect('gallery')}
                className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded bg-neutral-200/40 transition-colors hover:bg-neutral-200/60 dark:bg-neutral-800/60 dark:hover:bg-neutral-800/80"
                title="相册"
              >
                <ImageIcon className="h-5 w-5 text-neutral-300 dark:text-neutral-600" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="w-full space-y-2">
        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
          咖啡豆名称 <span className="text-red-500">*</span>{' '}
          <span className="ml-1 text-xs text-neutral-400 dark:text-neutral-500">
            (可用：{isGreenBean(bean) ? '生豆商' : '烘焙商'} 咖啡豆名称)
          </span>
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

      <div className="grid w-full grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {isRoastingMode(bean) ? '烘焙量(g)' : '库存量(g)'}
          </label>
          <div className="flex w-full items-center justify-start gap-2">
            <div className="flex-1">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={remainingValue}
                onChange={e => handleRemainingChange(e.target.value)}
                placeholder={isRoastingMode(bean) ? '同烘焙量' : '剩余量'}
                className="w-full border-b border-neutral-300 bg-transparent py-2 text-center outline-none dark:border-neutral-700"
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
                onChange={e => handleCapacityChange(e.target.value)}
                placeholder={isRoastingMode(bean) ? '烘焙量' : '总量'}
                className="w-full border-b border-neutral-300 bg-transparent py-2 text-center outline-none dark:border-neutral-700"
                onBlur={() => {
                  // 失焦时更新主表单的总量
                  onBeanChange('capacity')(capacityValue);

                  // 失焦时判断是否需要同步剩余量（烘焙模式或新增模式）
                  if (
                    capacityValue &&
                    (!remainingValue || remainingValue.trim() === '')
                  ) {
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
          {isEdit && onRepurchase && (
            <button
              type="button"
              onClick={onRepurchase}
              className="mt-1 flex items-center text-xs text-neutral-500 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
              title="续购"
            >
              <CornerDownRight className="mr-1 h-3 w-3" />
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
            placeholder={isRoastingMode(bean) ? '自动计算' : '例如：88'}
            clearable={false}
            suggestions={[]}
            inputType="number"
            inputMode="decimal"
            allowDecimal={true}
            maxDecimalPlaces={2}
          />
        </div>
      </div>

      <div className="grid w-full grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            烘焙度
          </label>
          <Select
            value={bean.roastLevel || ''}
            onValueChange={value => onBeanChange('roastLevel')(value)}
          >
            <SelectTrigger className="h-auto w-full rounded-none border-0 border-b border-neutral-300 bg-transparent px-0 py-2 text-base shadow-none placeholder:text-neutral-500 focus-within:border-neutral-800 data-[placeholder]:text-neutral-500 dark:border-neutral-700 dark:placeholder:text-neutral-400 dark:focus-within:border-neutral-400 dark:data-[placeholder]:text-neutral-400">
              <SelectValue placeholder="选择烘焙度" />
            </SelectTrigger>
            <SelectContent className="max-h-[40vh] overflow-y-auto rounded-lg border-neutral-200/70 bg-white/95 shadow-lg backdrop-blur-xs dark:border-neutral-800/70 dark:bg-neutral-900/95">
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
              {dateLabel}
            </label>
            {/* 在途状态按钮仅对熟豆显示 */}
            {!isGreenBean(bean) && (
              <button
                type="button"
                onClick={toggleInTransitState}
                className={`text-xs ${bean.isInTransit ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-600 dark:text-neutral-400'} underline`}
              >
                {bean.isInTransit ? '取消在途状态' : '设为在途'}
              </button>
            )}
          </div>
          <div className="relative flex w-full items-center justify-start">
            {bean.isInTransit && !isGreenBean(bean) ? (
              <div className="w-full border-b border-neutral-300 bg-transparent py-2 text-neutral-500 opacity-50 dark:border-neutral-700 dark:text-neutral-400">
                在途中...
              </div>
            ) : (
              <DatePicker
                date={parseDisplayDate()}
                onDateChange={handleDateChange}
                placeholder={datePlaceholder}
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
