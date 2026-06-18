'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  defaultSettings,
  SettingsOptions,
} from '@/components/settings/Settings';
import { cn } from '@/lib/utils/classNameUtils';
import { CoffeeBean } from '@/types/app';
import { BrewingNoteData } from '@/types/app';
import hapticsUtils from '@/lib/ui/haptics';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { resolveSelectedDateTimestamp } from '@/lib/utils/dateUtils';
import {
  getDateGroupingModePreference,
  getFilterModePreference,
  getSelectedDatePreference,
} from '@/components/notes/List/globalCache';

const POPOVER_EASE_OUT: [number, number, number, number] = [
  0.23,
  1,
  0.32,
  1,
];
const POPOVER_ENTER_TRANSITION = {
  opacity: { duration: 0.16, ease: POPOVER_EASE_OUT },
  y: { duration: 0.14, ease: POPOVER_EASE_OUT },
  scale: { duration: 0.14, ease: POPOVER_EASE_OUT },
};
const POPOVER_EXIT_TRANSITION = {
  opacity: { duration: 0.12, ease: POPOVER_EASE_OUT },
  y: { duration: 0.12, ease: POPOVER_EASE_OUT },
  scale: { duration: 0.1, ease: POPOVER_EASE_OUT },
};

interface RemainingEditorProps {
  position?: { x: number; y: number } | null;
  targetElement?: HTMLElement | null;
  onQuickDecrement: (amount: number) => void;
  onCancel: () => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  coffeeBean?: CoffeeBean; // 添加咖啡豆对象属性，用于创建笔记
  readOnly?: boolean;
}

const RemainingEditor: React.FC<RemainingEditorProps> = ({
  position,
  targetElement,
  onQuickDecrement,
  onCancel,
  isOpen,
  onOpenChange,
  className,
  coffeeBean,
  readOnly = false,
}) => {
  // 状态管理
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const [positionStyle, setPositionStyle] = useState<React.CSSProperties>({});
  const [customValue, setCustomValue] = useState<string>('');

  // 引用管理
  const popoverRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(false);
  const safeTargetRef = useRef<HTMLElement | null>(null);
  const _isExiting = useRef(false);

  // 组件挂载和卸载处理
  useEffect(() => {
    isMounted.current = true;
    safeTargetRef.current = targetElement || null;

    // 清理函数
    return () => {
      isMounted.current = false;
    };
  }, [targetElement]);

  // 更新开关状态
  const setOpen = useCallback(
    (value: boolean) => {
      if (!isMounted.current) return;

      setInternalOpen(value);
      onOpenChange?.(value);

      if (!value) {
        onCancel();
      }
    },
    [onOpenChange, onCancel]
  );

  // 从 settingsStore 获取设置
  const storeSettings = useSettingsStore(state => state.settings);
  const settings = storeSettings as SettingsOptions;
  const isGreenBean = coffeeBean?.beanState === 'green';

  const rawDecrementValues = useMemo(() => {
    if (isGreenBean) {
      return settings.greenBeanRoastPresets?.length
        ? settings.greenBeanRoastPresets
        : defaultSettings.greenBeanRoastPresets;
    }

    return settings.decrementPresets?.length
      ? settings.decrementPresets
      : defaultSettings.decrementPresets;
  }, [isGreenBean, settings.decrementPresets, settings.greenBeanRoastPresets]);

  const enableAllOption = isGreenBean
    ? (settings.enableAllGreenBeanRoastOption ??
      defaultSettings.enableAllGreenBeanRoastOption)
    : (settings.enableAllDecrementOption ??
      defaultSettings.enableAllDecrementOption);

  const enableCustomInput = isGreenBean
    ? (settings.enableCustomGreenBeanRoastInput ??
      defaultSettings.enableCustomGreenBeanRoastInput)
    : (settings.enableCustomDecrementInput ??
      defaultSettings.enableCustomDecrementInput);

  const hapticEnabled =
    settings.hapticFeedback ?? defaultSettings.hapticFeedback;

  const remainingAmount = useMemo(() => {
    if (!coffeeBean) return null;

    const parsed = parseFloat(coffeeBean.remaining || '0');
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }, [coffeeBean]);

  const decrementOptions = useMemo(() => {
    const seen = new Set<string>();

    return rawDecrementValues.reduce<number[]>((options, value) => {
      if (!Number.isFinite(value) || value <= 0) return options;

      const normalizedValue =
        remainingAmount === null ? value : Math.min(value, remainingAmount);
      if (normalizedValue <= 0) return options;

      const key = normalizedValue.toFixed(1);
      if (seen.has(key)) return options;

      seen.add(key);
      options.push(normalizedValue);
      return options;
    }, []);
  }, [rawDecrementValues, remainingAmount]);

  const formatDecrementLabel = useCallback((value: number) => {
    return Number.isInteger(value) ? value.toString() : value.toFixed(1);
  }, []);

  const showAllButton =
    enableAllOption && remainingAmount !== null && remainingAmount > 0;

  // 添加键盘事件处理
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isMounted.current) {
        event.preventDefault();
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, setOpen]);

  // 计算和更新位置
  const updatePosition = useCallback(() => {
    if (!isMounted.current) return;

    if (position) {
      setPositionStyle({
        left: `${position.x}px`,
        top: `${position.y}px`,
      });
      return;
    }

    const safeTarget = safeTargetRef.current;

    if (safeTarget && document.body.contains(safeTarget)) {
      try {
        const rect = safeTarget.getBoundingClientRect();

        const DROPDOWN_WIDTH = 120;
        const DROPDOWN_HEIGHT = 40;
        const WINDOW_WIDTH = window.innerWidth;
        const WINDOW_HEIGHT = window.innerHeight;
        const SAFE_PADDING = 10;

        let top = rect.bottom + 8;
        let left = rect.left;

        if (left + DROPDOWN_WIDTH > WINDOW_WIDTH - SAFE_PADDING) {
          left = Math.max(
            SAFE_PADDING,
            WINDOW_WIDTH - DROPDOWN_WIDTH - SAFE_PADDING
          );
        }

        if (top + DROPDOWN_HEIGHT > WINDOW_HEIGHT - SAFE_PADDING) {
          top = rect.top - DROPDOWN_HEIGHT - 8;
        }

        if (isMounted.current) {
          setPositionStyle({
            left: `${left}px`,
            top: `${top}px`,
          });
        }
      } catch (error) {
        console.error('计算位置时出错:', error);
        if (isMounted.current) {
          setPositionStyle({
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          });
        }
      }
    }
  }, [position]);

  // 实时更新位置
  useEffect(() => {
    if (!open) return;

    updatePosition();

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, targetElement, position, updatePosition]);

  // 添加点击外部关闭功能
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!isMounted.current) return;

      const isInMenu =
        popoverRef.current && popoverRef.current.contains(event.target as Node);
      const safeTarget = safeTargetRef.current;
      const isOnTarget =
        safeTarget &&
        document.body.contains(safeTarget) &&
        safeTarget.contains(event.target as Node);

      if (!isInMenu && !isOnTarget) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [open, setOpen]);

  // 阻止事件冒泡
  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const getAutoNoteTimestamp = (fallbackTimestamp: number) => {
    const settings = storeSettings as SettingsOptions;
    if (
      !settings.syncNewNoteDateWithSelectedDate ||
      !settings.syncQuickDecrementDateWithSelectedDate ||
      getFilterModePreference() !== 'date'
    ) {
      return fallbackTimestamp;
    }

    const selectedDate = getSelectedDatePreference();
    if (!selectedDate) {
      return fallbackTimestamp;
    }

    const baseDate = new Date(fallbackTimestamp);
    return (
      resolveSelectedDateTimestamp(
        selectedDate,
        getDateGroupingModePreference(),
        baseDate
      ) ?? baseDate.getTime()
    );
  };

  // 创建自动笔记 - 根据实际扣除量创建变动记录
  const createAutoNote = async (actualAmount: number) => {
    if (!coffeeBean || !isMounted.current) return;

    const processingTimestamp = Date.now();
    const noteTimestamp = getAutoNoteTimestamp(processingTimestamp);

    try {
      // 创建一个默认的笔记数据
      const newNote: BrewingNoteData = {
        id: processingTimestamp.toString(),
        timestamp: noteTimestamp,
        source: 'quick-decrement',
        quickDecrementAmount: actualAmount, // 使用实际扣除量
        beanId: coffeeBean.id,
        equipment: '', // 添加空的equipment字段，避免显示"未知器具"
        method: '', // 添加空的method字段
        coffeeBeanInfo: {
          name: coffeeBean.name || '',
          roastLevel: coffeeBean.roastLevel || '中度烘焙',
          roastDate: coffeeBean.roastDate,
          roaster: coffeeBean.roaster,
        },
        notes: '快捷扣除',
        rating: 0,
        taste: { acidity: 0, sweetness: 0, bitterness: 0, body: 0 },
        params: {
          coffee: `${actualAmount}g`, // 使用实际扣除量
          water: '',
          ratio: '',
          grindSize: '',
          temp: '',
        },
        totalTime: 0, // 添加totalTime字段，快捷扣除记录没有时间概念
      };

      if (!isMounted.current) return;

      // 🔥 使用 Zustand store 保存笔记
      const { useBrewingNoteStore } =
        await import('@/lib/stores/brewingNoteStore');
      await useBrewingNoteStore.getState().addNote(newNote as any);
    } catch (error) {
      console.error('创建快捷扣除笔记失败:', error);
    }
  };

  // 执行快捷扣除（统一逻辑）
  const performQuickDecrement = async (value: number) => {
    if (!isMounted.current || !coffeeBean) return;
    if (readOnly) {
      setOpen(false);
      setCustomValue('');
      return;
    }

    try {
      const currentRemaining = remainingAmount ?? 0;
      if (currentRemaining <= 0) return;

      setOpen(false);
      const actualDecrementAmount = Math.min(value, currentRemaining);
      onQuickDecrement(actualDecrementAmount);
      await createAutoNote(actualDecrementAmount);
      if (hapticEnabled) {
        hapticsUtils.light().catch(() => {
          // 静默处理触觉反馈错误
        });
      }
    } catch (error) {
      console.error('快捷扣除操作失败:', error);
    }
  };

  // 预设扣除点击
  const handleDecrementClick = async (e: React.MouseEvent, value: number) => {
    e.stopPropagation();
    await performQuickDecrement(value);
  };

  // ALL 扣除点击
  const handleAllClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentRemaining = remainingAmount ?? 0;
    if (currentRemaining > 0) {
      await performQuickDecrement(currentRemaining);
    }
  };

  // 自定义输入应用
  const handleCustomApply = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const num = parseFloat(customValue);
    if (!isNaN(num) && num > 0) {
      await performQuickDecrement(num);
      setCustomValue('');
    }
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {open && (
        <motion.div
          key="remaining-editor-popover"
          ref={popoverRef}
          initial={{ opacity: 0, y: -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{
            opacity: 0,
            y: -2,
            scale: 0.985,
            transition: POPOVER_EXIT_TRANSITION,
          }}
          transition={POPOVER_ENTER_TRANSITION}
          className={cn(
            'fixed z-10 max-w-xs rounded-lg bg-white p-1 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_2px_-1px_rgba(0,0,0,0.06),0px_2px_4px_0px_rgba(0,0,0,0.04)] dark:bg-neutral-800 dark:shadow-[0px_0px_0px_1px_rgba(255,255,255,0.06),0px_1px_2px_-1px_rgba(255,255,255,0.05),0px_2px_4px_0px_rgba(255,255,255,0.03)]',
            className
          )}
          style={positionStyle}
          onClick={handleStop}
        >
          <div className="flex flex-wrap items-center gap-1">
            {/* 预设值按钮 */}
            {decrementOptions.map(value => (
              <button
                key={value}
                className="h-6 rounded-sm bg-neutral-100 px-2 text-[10px] text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600"
                onClick={e => handleDecrementClick(e, value)}
              >
                -{formatDecrementLabel(value)}
              </button>
            ))}

            {/* ALL按钮 */}
            {showAllButton && (
              <button
                className="h-6 rounded-sm bg-neutral-100 px-2 text-[10px] text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600"
                onClick={handleAllClick}
              >
                ALL
              </button>
            )}

            {/* 自定义输入 - 连体设计 */}
            {enableCustomInput && (
              <div className="flex h-6 overflow-hidden rounded-sm bg-neutral-100 dark:bg-neutral-700">
                <input
                  type="text"
                  inputMode="decimal"
                  className="h-full w-12 rounded-none bg-transparent px-1 text-center text-[10px] text-neutral-800 focus:ring-1 focus:ring-neutral-400 focus:outline-none dark:text-neutral-200"
                  placeholder="15.5"
                  value={customValue}
                  onClick={handleStop}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9.]/g, '');
                    const dotCount = (raw.match(/\./g) || []).length;
                    let sanitized =
                      dotCount > 1
                        ? raw.substring(0, raw.lastIndexOf('.'))
                        : raw;
                    const dotIndex = sanitized.indexOf('.');
                    if (dotIndex !== -1 && dotIndex < sanitized.length - 2) {
                      sanitized = sanitized.substring(0, dotIndex + 2);
                    }
                    setCustomValue(sanitized);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleCustomApply();
                    }
                  }}
                />
                <button
                  className="flex h-full w-6 items-center justify-center bg-neutral-200 text-[10px] text-neutral-800 transition-colors hover:bg-neutral-300 disabled:opacity-40 dark:bg-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-500"
                  disabled={
                    !customValue ||
                    isNaN(parseFloat(customValue)) ||
                    parseFloat(customValue) <= 0
                  }
                  onClick={handleCustomApply}
                  title="确认扣除"
                >
                  ✓
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RemainingEditor;
