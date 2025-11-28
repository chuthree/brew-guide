'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useGrinderStore, type Grinder } from '@/lib/stores/grinderStore';
import hapticsUtils from '@/lib/ui/haptics';

interface GrinderScaleIndicatorProps {
  /** 是否显示 */
  visible?: boolean;
  /** 是否启用触感反馈 */
  hapticFeedback?: boolean;
  /** 点击回调（用于多个磨豆机时的选择） */
  onSelect?: (grinder: Grinder) => void;
}

// 常量提取到组件外部
const SPRING_TRANSITION = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
};

const LONG_PRESS_DURATION = 500;

const BUTTON_BASE_CLASS =
  'rounded-full border border-neutral-200 dark:border-neutral-700/50 bg-neutral-100 dark:bg-neutral-800';

// 字体大小映射
const FONT_SIZE_MAP = [
  'text-base',
  'text-base',
  'text-sm',
  'text-xs',
  'text-[10px]',
  'text-[8px]',
];
const getFontSize = (len: number) =>
  FONT_SIZE_MAP[Math.min(len, 5)] || 'text-[8px]';

/**
 * 磨豆机刻度指示器
 * - 点击：编辑刻度
 * - 长按：切换磨豆机（多个磨豆机时展开选择列表）
 */
const GrinderScaleIndicator: React.FC<GrinderScaleIndicatorProps> = ({
  visible = true,
  hapticFeedback = true,
  onSelect,
}) => {
  const { grinders, initialized, initialize, updateGrinder } =
    useGrinderStore();

  // 状态
  const [selectedGrinderId, setSelectedGrinderId] = useState<string | null>(
    null
  );
  const [showSelector, setShowSelector] = useState(false);
  const [editingGrinderId, setEditingGrinderId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  // 初始化 store
  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized, initialize]);

  // 默认选中第一个磨豆机
  useEffect(() => {
    if (grinders.length > 0 && !selectedGrinderId) {
      setSelectedGrinderId(grinders[0].id);
    } else if (
      selectedGrinderId &&
      !grinders.find(g => g.id === selectedGrinderId)
    ) {
      setSelectedGrinderId(grinders[0]?.id ?? null);
    }
  }, [grinders, selectedGrinderId]);

  // 当前选中的磨豆机
  const selectedGrinder = useMemo(
    () => grinders.find(g => g.id === selectedGrinderId) ?? grinders[0] ?? null,
    [grinders, selectedGrinderId]
  );

  // 聚焦输入框并将光标移到末尾
  useEffect(() => {
    if (editingGrinderId && inputRef.current) {
      const input = inputRef.current;
      input.focus();
      // 将光标移到末尾
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }
  }, [editingGrinderId]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  // 触感反馈
  const haptic = useCallback(
    (type: 'light' | 'medium') => {
      if (hapticFeedback) hapticsUtils[type]();
    },
    [hapticFeedback]
  );

  // 开始长按（主按钮 - 用于展开选择列表）
  const startLongPress = useCallback(
    (_grinder: Grinder) => {
      isLongPressRef.current = false;
      longPressTimerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        haptic('medium');
        // 长按时展开选择列表（多个磨豆机时）
        if (grinders.length > 1) {
          setShowSelector(true);
        }
      }, LONG_PRESS_DURATION);
    },
    [haptic, grinders.length]
  );

  // 开始长按（选项列表 - 用于编辑刻度）
  const startOptionLongPress = useCallback(
    (grinder: Grinder) => {
      isLongPressRef.current = false;
      longPressTimerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        haptic('medium');
        // 长按时进入编辑模式
        setEditingGrinderId(grinder.id);
        setEditValue(grinder.currentGrindSize || '');
      }, LONG_PRESS_DURATION);
    },
    [haptic]
  );

  // 结束长按
  const endLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // 延迟重置，让 onClick 能检测到长按状态
    setTimeout(() => {
      isLongPressRef.current = false;
    }, 0);
  }, []);

  // 关闭编辑（保存）
  const closeEdit = useCallback(() => {
    if (isLongPressRef.current) return;

    // 保存编辑值
    if (editingGrinderId && editValue.trim()) {
      updateGrinder(editingGrinderId, { currentGrindSize: editValue.trim() });
    }
    haptic('light');
    setEditingGrinderId(null);
    setEditValue('');
  }, [editingGrinderId, editValue, updateGrinder, haptic]);

  // 处理主按钮点击
  const handleMainClick = useCallback(() => {
    if (isLongPressRef.current) return;

    if (showSelector) {
      haptic('light');
      setShowSelector(false);
    } else if (editingGrinderId) {
      closeEdit();
    } else {
      // 点击时进入编辑模式
      haptic('light');
      setEditingGrinderId(selectedGrinder?.id ?? null);
      setEditValue(selectedGrinder?.currentGrindSize || '');
    }
  }, [showSelector, editingGrinderId, selectedGrinder, haptic, closeEdit]);

  // 处理选项点击
  const handleOptionClick = useCallback(
    (grinder: Grinder) => {
      if (isLongPressRef.current) return;
      haptic('light');
      setSelectedGrinderId(grinder.id);
      setShowSelector(false);
      onSelect?.(grinder);
    },
    [haptic, onSelect]
  );

  // 处理输入键盘事件
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        closeEdit();
      }
    },
    [closeEdit]
  );

  // 处理输入框点击
  const handleInputClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // 处理输入变化
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditValue(e.target.value);
    },
    []
  );

  // 没有磨豆机或不显示时返回 null
  if (!visible || !selectedGrinder) return null;

  const scaleText = selectedGrinder.currentGrindSize || '-';
  const isEditing = editingGrinderId === selectedGrinder.id;
  const inputWidth = `${Math.max(editValue.length, 1)}ch`;

  return (
    <div className="flex items-center gap-2 select-none">
      {/* 磨豆机选择列表 */}
      <AnimatePresence mode="popLayout">
        {showSelector && grinders.length > 1 && (
          <motion.div
            key="selector"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={SPRING_TRANSITION}
            className="flex items-center gap-1.5"
          >
            {grinders.map(grinder => {
              const isGrinderEditing = editingGrinderId === grinder.id;
              const isSelected = grinder.id === selectedGrinderId;

              return (
                <motion.div
                  key={grinder.id}
                  className={`${BUTTON_BASE_CLASS} flex cursor-pointer items-center gap-1 px-4.5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors ${
                    isSelected
                      ? 'text-neutral-800 dark:text-neutral-100'
                      : 'text-neutral-400 dark:text-neutral-500'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={isGrinderEditing ? {} : { scale: 0.98 }}
                  transition={SPRING_TRANSITION}
                  onMouseDown={() =>
                    !isGrinderEditing && startOptionLongPress(grinder)
                  }
                  onMouseUp={endLongPress}
                  onMouseLeave={endLongPress}
                  onTouchStart={() =>
                    !isGrinderEditing && startOptionLongPress(grinder)
                  }
                  onTouchEnd={endLongPress}
                  onClick={() =>
                    !isGrinderEditing && handleOptionClick(grinder)
                  }
                >
                  <span className="max-w-20 truncate">{grinder.name}</span>
                  <span>·</span>
                  {isGrinderEditing ? (
                    <div className="flex items-center">
                      <input
                        ref={inputRef}
                        type="text"
                        value={editValue}
                        onChange={handleInputChange}
                        onKeyDown={handleInputKeyDown}
                        onClick={handleInputClick}
                        className="min-w-[1ch] bg-transparent text-center outline-none"
                        style={{ width: inputWidth }}
                      />
                    </div>
                  ) : (
                    <span>{grinder.currentGrindSize || '-'}</span>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 编辑输入框 - 单磨豆机或未展开选择器时 */}
      <AnimatePresence>
        {isEditing && !showSelector && (
          <motion.div
            key="edit"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={SPRING_TRANSITION}
            className={`${BUTTON_BASE_CLASS} flex items-center gap-2 px-4 py-3 text-sm font-medium text-neutral-800 dark:text-neutral-100`}
          >
            <span className="max-w-20 truncate">{selectedGrinder.name}</span>
            <span>·</span>
            <div className="flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                onClick={handleInputClick}
                className="min-w-[1ch] bg-transparent text-center outline-none"
                style={{ width: inputWidth }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 刻度指示按钮 */}
      <motion.button
        onClick={handleMainClick}
        onMouseDown={() =>
          !showSelector && !editingGrinderId && startLongPress(selectedGrinder)
        }
        onMouseUp={endLongPress}
        onMouseLeave={endLongPress}
        onTouchStart={() =>
          !showSelector && !editingGrinderId && startLongPress(selectedGrinder)
        }
        onTouchEnd={endLongPress}
        className={`${BUTTON_BASE_CLASS} flex h-12.5 w-12.5 cursor-pointer items-center justify-center font-medium text-neutral-800 dark:text-neutral-100`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={SPRING_TRANSITION}
      >
        {showSelector || isEditing ? (
          <X className="h-4 w-4" strokeWidth={3} />
        ) : (
          <span
            className={`${getFontSize(scaleText.length)} leading-none font-semibold`}
          >
            {scaleText}
          </span>
        )}
      </motion.button>
    </div>
  );
};

export default GrinderScaleIndicator;
