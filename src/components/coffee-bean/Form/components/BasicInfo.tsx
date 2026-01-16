import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Camera,
  Image as ImageIcon,
  X,
  CornerDownRight,
  Plus,
} from 'lucide-react';
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
  onBackImageUpload?: (file: File) => void;
  editingRemaining: string | null;
  validateRemaining: () => void;
  handleCapacityBlur?: () => void;
  toggleInTransitState: () => void;
  isEdit?: boolean;
  onRepurchase?: () => void;
  /** 识别时使用的原始图片 base64（用于在表单中显示） */
  recognitionImage?: string | null;
  /** 容量变化时的回调，用于触发类型推断 */
  onCapacityChange?: (capacity: string) => void;
  /** 烘焙商图标（自动从烘焙商名称匹配获取） */
  roasterLogo?: string | null;
  /** 是否启用烘焙商字段 */
  roasterFieldEnabled?: boolean;
  /** 烘焙商建议列表 */
  roasterSuggestions?: string[];
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

// 辅助函数：格式化数字，去除末尾多余的0
const formatDecimal = (num: number, decimals: number = 1): string => {
  return parseFloat(num.toFixed(decimals)).toString();
};

const BasicInfo: React.FC<BasicInfoProps> = ({
  bean,
  onBeanChange,
  onImageUpload,
  onBackImageUpload,
  editingRemaining,
  validateRemaining,
  handleCapacityBlur,
  toggleInTransitState,
  isEdit = false,
  onRepurchase,
  recognitionImage,
  onCapacityChange,
  roasterLogo,
  roasterFieldEnabled = false,
  roasterSuggestions = [],
}) => {
  // 处理容量和剩余容量的状态
  const [capacityValue, setCapacityValue] = useState('');
  const [remainingValue, setRemainingValue] = useState('');
  // 处理脱水率状态
  const [moistureLoss, setMoistureLoss] = useState('');
  const [isMoistureFocused, setIsMoistureFocused] = useState(false);
  // 追踪剩余量输入框是否正在输入（用于延迟计算脱水率和烘焙度）
  const [isRemainingFocused, setIsRemainingFocused] = useState(false);

  // 根据脱水率推断烘焙度
  const getRoastLevelFromMoistureLoss = (loss: number): string | null => {
    if (loss >= 8 && loss <= 10) return '极浅烘焙';
    if (loss > 10 && loss <= 13) return '浅度烘焙';
    if (loss > 13 && loss <= 16) return '中度烘焙';
    if (loss > 16 && loss < 18) return '中深烘焙';
    if (loss >= 18) return '深度烘焙';
    return null;
  };

  // 计算脱水率并更新烘焙度的核心函数
  // 在失焦时调用，避免输入过程中频繁触发
  // 只有当烘焙度为空时才自动设置，已有值则不覆盖
  const calculateAndUpdateMoistureLoss = (
    capacity: string,
    remaining: string
  ) => {
    if (!capacity || !remaining) return;

    const cap = parseFloat(capacity);
    const rem = parseFloat(remaining);

    if (cap > 0 && !isNaN(rem)) {
      const loss = ((cap - rem) / cap) * 100;
      setMoistureLoss(formatDecimal(loss));

      // 只有当烘焙度为空时才自动设置，用户已设置则不覆盖
      if (!bean.roastLevel) {
        const suggestedRoastLevel = getRoastLevelFromMoistureLoss(loss);
        if (suggestedRoastLevel) {
          onBeanChange('roastLevel')(suggestedRoastLevel);
        }
      }
    }
  };

  // 初始化和同步容量值
  useEffect(() => {
    setCapacityValue(bean.capacity || '');
    setRemainingValue(
      editingRemaining !== null ? editingRemaining : bean.remaining || ''
    );
  }, [bean.capacity, bean.remaining, editingRemaining]);

  // 判断是否为烘焙模式（用于 useEffect 依赖）
  const isInRoastingMode = isRoastingMode(bean);

  // 同步脱水率显示：仅在非编辑状态下同步显示
  // 注意：这里只更新显示值，不触发烘焙度设置（烘焙度在失焦时设置）
  useEffect(() => {
    // 如果用户正在输入脱水率或剩余量，不要覆盖
    if (isMoistureFocused || isRemainingFocused) return;

    // 仅在烘焙模式下执行
    if (!isInRoastingMode) return;

    if (capacityValue && remainingValue && parseFloat(capacityValue) > 0) {
      const cap = parseFloat(capacityValue);
      const rem = parseFloat(remainingValue);
      const loss = ((cap - rem) / cap) * 100;
      setMoistureLoss(formatDecimal(loss));
    } else {
      setMoistureLoss('');
    }
  }, [
    capacityValue,
    remainingValue,
    isMoistureFocused,
    isRemainingFocused,
    isInRoastingMode,
  ]);

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

  // 处理剩余容量变化 - 只更新本地状态，不触发烘焙度计算
  const handleRemainingChange = (value: string) => {
    // 确保剩余容量不大于总容量
    if (capacityValue && parseFloat(value) > parseFloat(capacityValue)) {
      value = capacityValue;
    }
    setRemainingValue(value);
    onBeanChange('remaining')(value);
    // 注意：不在这里计算烘焙度，等失焦时再计算
  };

  // 处理剩余容量输入框失焦 - 此时才计算脱水率和烘焙度
  const handleRemainingBlur = () => {
    setIsRemainingFocused(false);

    // 仅在烘焙模式下计算
    if (isInRoastingMode) {
      calculateAndUpdateMoistureLoss(capacityValue, remainingValue);
    }
  };

  // 处理脱水率手动输入变化 - 只更新本地状态
  const handleMoistureChange = (value: string) => {
    setMoistureLoss(value);

    const loss = parseFloat(value);
    const cap = parseFloat(capacityValue);

    // 根据脱水率反算熟豆量（实时更新，方便用户看到效果）
    if (!isNaN(loss) && !isNaN(cap) && cap > 0) {
      const newRem = cap * (1 - loss / 100);
      const newRemStr = formatDecimal(newRem);
      setRemainingValue(newRemStr);
      onBeanChange('remaining')(newRemStr);
    }
    // 注意：不在这里设置烘焙度，等失焦时再设置
  };

  // 处理脱水率输入框失焦 - 此时才设置烘焙度
  const handleMoistureBlur = () => {
    setIsMoistureFocused(false);

    // 只有当烘焙度为空时才自动设置
    if (!bean.roastLevel) {
      const loss = parseFloat(moistureLoss);
      if (!isNaN(loss)) {
        const suggestedRoastLevel = getRoastLevelFromMoistureLoss(loss);
        if (suggestedRoastLevel) {
          onBeanChange('roastLevel')(suggestedRoastLevel);
        }
      }
    }
  };

  // 处理图片选择逻辑 (相册或拍照)
  const handleImageSelect = async (
    source: 'camera' | 'gallery',
    imageType: 'front' | 'back' = 'front'
  ) => {
    try {
      // 获取图片（已经是base64格式）
      const result = await captureImage({ source });

      // 将 dataUrl 转换为 File 对象并传递给父组件处理
      const response = await fetch(result.dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `image.${result.format}`, {
        type: `image/${result.format}`,
      });

      // 根据类型使用不同的回调函数处理文件（父组件会进行压缩）
      if (imageType === 'back' && onBackImageUpload) {
        onBackImageUpload(file);
      } else {
        onImageUpload(file);
      }
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
        {/* 图片选择区 - 多种状态，烘焙商图标仅用于显示，不存储到数据 */}
        <div className="flex w-full items-end gap-2">
          {bean.image && bean.backImage ? (
            /* 状态: 用户正面图 + 用户背面图 */
            <>
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-neutral-200/40 dark:bg-neutral-800/60">
                <Image
                  src={bean.image}
                  alt="咖啡豆正面"
                  className="object-cover"
                  fill
                  sizes="64px"
                />
                <button
                  type="button"
                  onClick={() => onBeanChange('image')('')}
                  className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-800/80 text-white transition-colors hover:bg-red-500 dark:bg-neutral-200/80 dark:text-neutral-800 dark:hover:bg-red-500 dark:hover:text-white"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-neutral-200/40 dark:bg-neutral-800/60">
                <Image
                  src={bean.backImage}
                  alt="咖啡豆背面"
                  className="object-cover"
                  fill
                  sizes="64px"
                />
                <button
                  type="button"
                  onClick={() => onBeanChange('backImage')('')}
                  className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-800/80 text-white transition-colors hover:bg-red-500 dark:bg-neutral-200/80 dark:text-neutral-800 dark:hover:bg-red-500 dark:hover:text-white"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            </>
          ) : bean.image && !bean.backImage ? (
            /* 状态: 用户正面图 + 添加背面按钮 */
            <>
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-neutral-200/40 dark:bg-neutral-800/60">
                <Image
                  src={bean.image}
                  alt="咖啡豆正面"
                  className="object-cover"
                  fill
                  sizes="64px"
                />
                <button
                  type="button"
                  onClick={() => onBeanChange('image')('')}
                  className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-800/80 text-white transition-colors hover:bg-red-500 dark:bg-neutral-200/80 dark:text-neutral-800 dark:hover:bg-red-500 dark:hover:text-white"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleImageSelect('gallery', 'back')}
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-neutral-200/40 transition-colors hover:bg-neutral-200/60 dark:bg-neutral-800/60 dark:hover:bg-neutral-800/80"
                title="添加背面图片"
              >
                <ImageIcon className="h-5 w-5 text-neutral-300 dark:text-neutral-600" />
              </button>
            </>
          ) : !bean.image && roasterLogo ? (
            /* 状态: 烘焙商图标作为底图（半透明，提示可替换） */
            <>
              <div
                className="relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded bg-neutral-200/40 dark:bg-neutral-800/60"
                onClick={() => handleImageSelect('gallery', 'front')}
                title="点击替换为自定义图片"
              >
                <Image
                  src={roasterLogo}
                  alt="烘焙商图标"
                  className="object-cover opacity-40"
                  fill
                  sizes="64px"
                />
                {/* 居中的相册图标，始终显示 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="h-5 w-5 text-neutral-400 dark:text-neutral-500" />
                </div>
              </div>
              {bean.backImage ? (
                /* 有背面图 */
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-neutral-200/40 dark:bg-neutral-800/60">
                  <Image
                    src={bean.backImage}
                    alt="咖啡豆背面"
                    className="object-cover"
                    fill
                    sizes="64px"
                  />
                  <button
                    type="button"
                    onClick={() => onBeanChange('backImage')('')}
                    className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-800/80 text-white transition-colors hover:bg-red-500 dark:bg-neutral-200/80 dark:text-neutral-800 dark:hover:bg-red-500 dark:hover:text-white"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ) : (
                /* 无背面图，显示添加按钮 */
                <button
                  type="button"
                  onClick={() => handleImageSelect('gallery', 'back')}
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-neutral-200/40 transition-colors hover:bg-neutral-200/60 dark:bg-neutral-800/60 dark:hover:bg-neutral-800/80"
                  title="添加背面图片"
                >
                  <ImageIcon className="h-5 w-5 text-neutral-300 dark:text-neutral-600" />
                </button>
              )}
            </>
          ) : !bean.image && bean.backImage ? (
            /* 状态: 无正面图 + 有用户背面图 */
            <>
              <button
                type="button"
                onClick={() => handleImageSelect('gallery', 'front')}
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-neutral-200/40 transition-colors hover:bg-neutral-200/60 dark:bg-neutral-800/60 dark:hover:bg-neutral-800/80"
                title="添加正面图片"
              >
                <ImageIcon className="h-5 w-5 text-neutral-300 dark:text-neutral-600" />
              </button>
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-neutral-200/40 dark:bg-neutral-800/60">
                <Image
                  src={bean.backImage}
                  alt="咖啡豆背面"
                  className="object-cover"
                  fill
                  sizes="64px"
                />
                <button
                  type="button"
                  onClick={() => onBeanChange('backImage')('')}
                  className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-800/80 text-white transition-colors hover:bg-red-500 dark:bg-neutral-200/80 dark:text-neutral-800 dark:hover:bg-red-500 dark:hover:text-white"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            </>
          ) : (
            /* 状态: 无任何图片 → 拍照 + 相册 */
            <>
              <button
                type="button"
                onClick={() => handleImageSelect('camera', 'front')}
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-neutral-200/40 transition-colors hover:bg-neutral-200/60 dark:bg-neutral-800/60 dark:hover:bg-neutral-800/80"
                title="拍照"
              >
                <Camera className="h-5 w-5 text-neutral-300 dark:text-neutral-600" />
              </button>
              <button
                type="button"
                onClick={() => handleImageSelect('gallery', 'front')}
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-neutral-200/40 transition-colors hover:bg-neutral-200/60 dark:bg-neutral-800/60 dark:hover:bg-neutral-800/80"
                title="从相册选择"
              >
                <ImageIcon className="h-5 w-5 text-neutral-300 dark:text-neutral-600" />
              </button>
            </>
          )}

          {/* 识别图片（如果有且无自定义正面图和烘焙商图标） - 点击使用此图片作为正面 */}
          {recognitionImage && !bean.image && !roasterLogo && (
            <button
              type="button"
              onClick={() => onBeanChange('image')(recognitionImage)}
              className="group relative h-16 w-16 shrink-0 overflow-hidden rounded bg-neutral-200/40 transition-colors dark:bg-neutral-800/60"
              title="使用识别图片作为正面"
            >
              <Image
                src={recognitionImage}
                alt="识别图片"
                className="object-cover"
                fill
                sizes="64px"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/40">
                <Plus className="h-6 w-6 text-white drop-shadow-md" />
              </div>
            </button>
          )}
        </div>
      </div>

      {/* 烘焙商和咖啡豆名称 */}
      {roasterFieldEnabled ? (
        /* 启用独立输入：两个并排的输入框 */
        <div className="grid w-full grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
              烘焙商
            </label>
            <AutocompleteInput
              value={bean.roaster || ''}
              onChange={onBeanChange('roaster')}
              placeholder="烘焙商名称"
              suggestions={roasterSuggestions}
              clearable
              inputMode="text"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
              咖啡豆名称 <span className="text-red-500">*</span>
            </label>
            <AutocompleteInput
              value={bean.name || ''}
              onChange={onBeanChange('name')}
              placeholder="咖啡豆名称"
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
        </div>
      ) : (
        /* 关闭独立输入：单个输入框，用户输入完整名称 */
        <div className="w-full space-y-2">
          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            咖啡豆名称 <span className="text-red-500">*</span>{' '}
            <span className="ml-1 text-xs text-neutral-400 dark:text-neutral-500">
              (格式：{isGreenBean(bean) ? '生豆商' : '烘焙商'} 咖啡豆名称)
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
      )}

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
                onFocus={() => setIsRemainingFocused(true)}
                onBlur={() => {
                  handleRemainingBlur();
                  validateRemaining();
                }}
                placeholder={isRoastingMode(bean) ? '熟豆量' : '剩余量'}
                className="w-full border-b border-neutral-300 bg-transparent py-2 text-center outline-none dark:border-neutral-700"
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
                placeholder={isRoastingMode(bean) ? '生豆量' : '总量'}
                className="w-full border-b border-neutral-300 bg-transparent py-2 text-center outline-none dark:border-neutral-700"
                onBlur={() => {
                  // 失焦时更新主表单的总量
                  onBeanChange('capacity')(capacityValue);

                  // 失焦时判断是否需要同步剩余量
                  // 烘焙模式下不自动同步，让用户手动输入实际熟豆量
                  if (
                    !isRoastingMode(bean) &&
                    capacityValue &&
                    (!remainingValue || remainingValue.trim() === '')
                  ) {
                    setRemainingValue(capacityValue);
                    onBeanChange('remaining')(capacityValue);
                  }

                  // 烘焙模式下，如果已有剩余量，计算脱水率和烘焙度
                  if (isRoastingMode(bean) && remainingValue) {
                    calculateAndUpdateMoistureLoss(
                      capacityValue,
                      remainingValue
                    );
                  }

                  // 触发容量变化回调，用于类型推断
                  onCapacityChange?.(capacityValue);

                  // 调用主表单的失焦处理函数（用于其他逻辑）
                  handleCapacityBlur?.();
                }}
              />
            </div>
          </div>

          {/* 续购按钮 - 只在编辑模式下显示，且不在烘焙模式下显示 */}
          {isEdit && onRepurchase && !isRoastingMode(bean) && (
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
            {isRoastingMode(bean) ? '脱水率' : '价格(¥)'}
          </label>
          {isRoastingMode(bean) ? (
            <div className="relative w-full">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={moistureLoss}
                onChange={e => handleMoistureChange(e.target.value)}
                onFocus={() => setIsMoistureFocused(true)}
                onBlur={handleMoistureBlur}
                placeholder="自动计算"
                className="w-full border-b border-neutral-300 bg-transparent py-2 text-left outline-none dark:border-neutral-700"
              />
              <span className="absolute top-2 right-0 text-neutral-500">%</span>
            </div>
          ) : (
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
          )}
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
            <SelectTrigger className="h-auto w-full rounded-none border-0 border-b border-neutral-300 bg-transparent px-0 py-2 text-base shadow-none placeholder:text-neutral-500 focus-within:border-neutral-800/50 data-[placeholder]:text-neutral-500 dark:border-neutral-700 dark:placeholder:text-neutral-400 dark:focus-within:border-neutral-400 dark:data-[placeholder]:text-neutral-400">
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
