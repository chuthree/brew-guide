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

// 模拟光标组件 - 模仿 iOS 原生光标闪烁效果
// iOS 光标特点：~1s 周期，使用 ease-in-out 缓动，平滑淡入淡出
const Cursor = () => (
  <motion.span
    initial={{ opacity: 1 }}
    animate={{ opacity: [1, 1, 0, 0, 1] }}
    transition={{
      duration: 1,
      repeat: Infinity,
      ease: 'easeInOut',
      times: [0, 0.5, 0.55, 0.95, 1], // 530ms 可见，淡出 50ms，保持隐藏 400ms，淡入 50ms
    }}
    className="pointer-events-none -ml-px h-4 w-0.5 rounded-[1px] bg-[#007AFF] dark:bg-[#0A84FF]"
  />
);

/**
 * 磨豆机刻度指示器
 * - 单个磨豆机：长按编辑刻度
 * - 多个磨豆机：点击展开选择列表，长按编辑
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
  const [hasBeenFocused, setHasBeenFocused] = useState(false);

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

      // 检测是否为触摸设备
      // 如果是非触摸设备（桌面端），focus 通常会成功显示原生光标，所以直接标记为已聚焦，不显示模拟光标
      // 如果是触摸设备（iOS/Android），自动 focus 可能不会显示光标/键盘，所以保持 hasBeenFocused 为 false，显示模拟光标
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (!isTouch) {
        setHasBeenFocused(true);
      }
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

  // 开始长按
  const startLongPress = useCallback(
    (grinder: Grinder) => {
      isLongPressRef.current = false;
      longPressTimerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        haptic('medium');
        setEditingGrinderId(grinder.id);
        setEditValue(grinder.currentGrindSize || '');
        setHasBeenFocused(false);
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
    } else if (grinders.length > 1) {
      haptic('light');
      setShowSelector(true);
    }
  }, [showSelector, editingGrinderId, grinders.length, haptic, closeEdit]);

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
    setHasBeenFocused(true);
  }, []);

  // 处理输入变化
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditValue(e.target.value);
      setHasBeenFocused(true);
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
                    !isGrinderEditing && startLongPress(grinder)
                  }
                  onMouseUp={endLongPress}
                  onMouseLeave={endLongPress}
                  onTouchStart={() =>
                    !isGrinderEditing && startLongPress(grinder)
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
                      {!hasBeenFocused && <Cursor />}
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
              {!hasBeenFocused && <Cursor />}
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
