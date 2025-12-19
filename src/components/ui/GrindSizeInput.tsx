'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useMemo,
} from 'react';
import { Link2, Unlink, Undo2 } from 'lucide-react';
import { useGrinderStore, type Grinder } from '@/lib/stores/grinderStore';
import {
  useFloating,
  autoUpdate,
  offset,
  shift,
  useDismiss,
  useRole,
  useListNavigation,
  useInteractions,
  useTransitionStyles,
  FloatingPortal,
} from '@floating-ui/react';

/**
 * 自定义 Hook：检测移动端虚拟键盘的隐藏/显示
 * 使用 visualViewport API 监听视口大小变化来推断键盘状态
 * 当视口高度恢复到接近屏幕高度时，认为键盘已收起
 */
const useVirtualKeyboardDismiss = (isOpen: boolean, onDismiss: () => void) => {
  const initialHeightRef = useRef<number | null>(null);
  const isKeyboardVisibleRef = useRef(false);

  useEffect(() => {
    // 仅在移动端且下拉菜单打开时启用
    if (!isOpen || typeof window === 'undefined') return;

    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    // 记录初始视口高度（键盘未弹出时的高度）
    if (initialHeightRef.current === null) {
      initialHeightRef.current = visualViewport.height;
    }

    const handleResize = () => {
      const currentHeight = visualViewport.height;
      const initialHeight = initialHeightRef.current ?? window.innerHeight;

      // 键盘弹出：视口高度明显减小（超过 100px，排除浏览器地址栏变化等小幅度变化）
      const keyboardThreshold = 100;
      const isKeyboardNowVisible =
        initialHeight - currentHeight > keyboardThreshold;

      // 检测键盘收起：之前键盘可见，现在高度恢复
      if (isKeyboardVisibleRef.current && !isKeyboardNowVisible) {
        // 键盘刚刚收起，关闭下拉菜单
        onDismiss();
      }

      isKeyboardVisibleRef.current = isKeyboardNowVisible;

      // 更新初始高度（当键盘完全收起时）
      if (
        !isKeyboardNowVisible &&
        currentHeight > (initialHeightRef.current ?? 0)
      ) {
        initialHeightRef.current = currentHeight;
      }
    };

    visualViewport.addEventListener('resize', handleResize);

    return () => {
      visualViewport.removeEventListener('resize', handleResize);
    };
  }, [isOpen, onDismiss]);
};

interface GrindSizeInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  /** 获取当前选中的磨豆机ID和同步状态，用于保存时同步刻度 */
  onSyncStateChange?: (
    grinderId: string | null,
    isSyncEnabled: boolean
  ) => void;
  /** 是否自适应内容宽度（用于导航栏等场景） */
  autoWidth?: boolean;
  /** 默认同步开关状态（由设置控制），默认为 true */
  defaultSyncEnabled?: boolean;
  /** 下拉菜单位置，默认为 'bottom'，可选 'right' 避免遮挡下方元素 */
  dropdownPlacement?: 'bottom' | 'right';
}

/** 暴露给外部的方法 */
export interface GrindSizeInputRef {
  /** 获取当前同步信息 */
  getSyncInfo: () => { grinderId: string | null; isSyncEnabled: boolean };
  /** 重置同步状态（保存后调用） */
  resetSyncState: () => void;
}

/** 选项类型 */
type OptionItem = {
  value: string;
  label: string;
  type: 'selected-grinder' | 'grinder' | 'restore';
  grinderId?: string;
};

/** 计算文本宽度：中文字符按2倍计算，英文字符按1倍计算 */
const calculateTextWidth = (str: string): number => {
  let width = 0;
  for (const char of str) {
    // 检测中文字符（包括中文标点）
    width += /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(char) ? 2 : 1;
  }
  return Math.max(width, 2);
};

/** 格式化磨豆机显示文本 */
const formatGrinderOption = (grinder: Grinder): string =>
  grinder.currentGrindSize
    ? `${grinder.name} ${grinder.currentGrindSize}`
    : grinder.name;

/**
 * 研磨度输入组件
 * - 支持直接输入和磨豆机快捷选项
 * - 使用 @floating-ui/react 实现精确定位
 * - 支持键盘导航和同步状态管理
 */
const GrindSizeInput = forwardRef<GrindSizeInputRef, GrindSizeInputProps>(
  (
    {
      value,
      onChange,
      placeholder = '例如：中细',
      className = '',
      inputClassName = '',
      onSyncStateChange,
      autoWidth = false,
      defaultSyncEnabled = true,
      dropdownPlacement = 'bottom',
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [initialValue] = useState(() => value);
    const [selectedGrinderId, setSelectedGrinderId] = useState<string | null>(
      null
    );
    const [isSyncEnabled, setIsSyncEnabled] = useState(defaultSyncEnabled);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<Array<HTMLButtonElement | null>>([]);

    const { grinders, initialized, initialize, setSyncState } =
      useGrinderStore();

    // 关闭下拉菜单的回调（用于虚拟键盘收起检测）
    const handleDismiss = useCallback(() => {
      setIsOpen(false);
    }, []);

    // 监听移动端虚拟键盘收起
    useVirtualKeyboardDismiss(isOpen, handleDismiss);

    // Floating UI 配置
    const { refs, floatingStyles, context } = useFloating({
      open: isOpen,
      onOpenChange: setIsOpen,
      middleware: [offset(4), shift({ padding: 8 })],
      whileElementsMounted: autoUpdate,
      placement: dropdownPlacement === 'right' ? 'right-start' : 'bottom-start',
    });

    const { getReferenceProps, getFloatingProps, getItemProps } =
      useInteractions([
        useDismiss(context),
        useRole(context, { role: 'listbox' }),
        useListNavigation(context, {
          listRef,
          activeIndex,
          onNavigate: setActiveIndex,
          virtual: true,
          loop: true,
        }),
      ]);

    // 过渡动画配置：使用 floating-ui 的 useTransitionStyles
    // 参考 https://jakub.kr/components/exit-animations - 退出动画使用较小的位移值
    const { isMounted, styles: transitionStyles } = useTransitionStyles(
      context,
      {
        duration: {
          open: 200,
          close: 150,
        },
        initial: {
          opacity: 0,
          transform: 'translateY(-8px)',
          filter: 'blur(4px)',
        },
        close: {
          opacity: 0,
          transform: 'translateY(-12px)',
          filter: 'blur(4px)',
        },
      }
    );

    // 暴露方法给外部
    useImperativeHandle(
      ref,
      () => ({
        getSyncInfo: () => ({ grinderId: selectedGrinderId, isSyncEnabled }),
        resetSyncState: () => {
          setIsSyncEnabled(defaultSyncEnabled);
          setSyncState(null, defaultSyncEnabled);
        },
      }),
      [selectedGrinderId, isSyncEnabled, setSyncState, defaultSyncEnabled]
    );

    // 初始化 store
    useEffect(() => {
      if (!initialized) initialize();
    }, [initialized, initialize]);

    // 初始化时自动匹配磨豆机
    useEffect(() => {
      if (
        !initialized ||
        grinders.length === 0 ||
        selectedGrinderId !== null ||
        !value
      )
        return;

      // 按名称长度降序排序，优先匹配较长的名称
      const matchedGrinder = [...grinders]
        .sort((a, b) => b.name.length - a.name.length)
        .find(g => value.startsWith(g.name));

      if (matchedGrinder) {
        setSelectedGrinderId(matchedGrinder.id);
        setSyncState(matchedGrinder.id, defaultSyncEnabled);
      }
    }, [
      initialized,
      grinders,
      value,
      selectedGrinderId,
      setSyncState,
      defaultSyncEnabled,
    ]);

    // 构建选项列表（使用 useMemo 缓存）
    const allOptions = useMemo<OptionItem[]>(() => {
      const options: OptionItem[] = [];

      // 1. 当前选中的磨豆机
      if (selectedGrinderId) {
        const selected = grinders.find(g => g.id === selectedGrinderId);
        if (selected?.currentGrindSize) {
          options.push({
            value: formatGrinderOption(selected),
            label: formatGrinderOption(selected),
            type: 'selected-grinder',
            grinderId: selected.id,
          });
        }
      }

      // 2. 其他磨豆机
      grinders.forEach(g => {
        if (g.currentGrindSize && g.id !== selectedGrinderId) {
          options.push({
            value: formatGrinderOption(g),
            label: formatGrinderOption(g),
            type: 'grinder',
            grinderId: g.id,
          });
        }
      });

      // 3. 还原选项
      if (
        initialValue &&
        initialValue !== value &&
        !options.some(o => o.value === initialValue)
      ) {
        options.push({
          value: initialValue,
          label: initialValue,
          type: 'restore',
        });
      }

      return options;
    }, [grinders, selectedGrinderId, initialValue, value]);

    // 处理选项点击
    const handleOptionClick = useCallback(
      (option: OptionItem, event?: React.MouseEvent) => {
        if (option.type === 'selected-grinder') {
          // 点击已选中的磨豆机 -> 切换同步状态（不关闭面板）
          event?.preventDefault();
          event?.stopPropagation();
          const newSyncState = !isSyncEnabled;
          setIsSyncEnabled(newSyncState);
          setSyncState(selectedGrinderId, newSyncState);
          onSyncStateChange?.(selectedGrinderId, newSyncState);
          // 保持输入框聚焦，防止面板关闭
          inputRef.current?.focus();
        } else {
          // 选择新选项 - 使用默认同步状态
          onChange(option.value);
          setSelectedGrinderId(option.grinderId || null);
          setIsSyncEnabled(defaultSyncEnabled);
          setIsOpen(false);
          setSyncState(option.grinderId || null, defaultSyncEnabled);
          onSyncStateChange?.(option.grinderId || null, defaultSyncEnabled);
          // 保持输入框聚焦状态
          inputRef.current?.focus();
        }
      },
      [
        isSyncEnabled,
        selectedGrinderId,
        onChange,
        onSyncStateChange,
        setSyncState,
        defaultSyncEnabled,
      ]
    );

    // 处理输入框聚焦
    const handleFocus = useCallback(() => setIsOpen(true), []);

    // 处理键盘事件
    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (
          event.key === 'Enter' &&
          activeIndex != null &&
          allOptions[activeIndex]
        ) {
          event.preventDefault();
          handleOptionClick(allOptions[activeIndex]);
        }
      },
      [activeIndex, allOptions, handleOptionClick]
    );

    // 用于测量文本实际宽度的隐藏元素
    const measureRef = useRef<HTMLSpanElement>(null);
    const [measuredWidth, setMeasuredWidth] = useState<number | undefined>(
      undefined
    );

    // 测量实际文本宽度
    useEffect(() => {
      if (!autoWidth || !measureRef.current) return;
      const text = value || placeholder;
      measureRef.current.textContent = text;
      // 获取实际渲染宽度，加上一点 padding
      const width = measureRef.current.offsetWidth + 4;
      setMeasuredWidth(width);
    }, [autoWidth, value, placeholder]);

    return (
      <div className={`relative ${className}`}>
        {/* 隐藏的测量元素，继承输入框的字体样式 */}
        {autoWidth && (
          <span
            ref={measureRef}
            className={inputClassName}
            style={{
              position: 'absolute',
              visibility: 'hidden',
              whiteSpace: 'pre',
              height: 0,
              overflow: 'hidden',
            }}
            aria-hidden="true"
          />
        )}
        <input
          ref={node => {
            inputRef.current = node;
            refs.setReference(node);
          }}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClassName}
          style={
            autoWidth && measuredWidth ? { width: measuredWidth } : undefined
          }
          aria-autocomplete="list"
          aria-expanded={isOpen}
          {...getReferenceProps({
            onFocus: handleFocus,
            onKeyDown: handleKeyDown,
          })}
        />

        {/* 下拉面板 */}
        {isMounted && allOptions.length > 0 && (
          <FloatingPortal>
            <div
              ref={refs.setFloating}
              style={{ ...floatingStyles, zIndex: 9999 }}
              {...getFloatingProps()}
            >
              {/* 内部容器用于过渡动画，避免与定位 transform 冲突 */}
              <div style={transitionStyles} className="flex flex-col gap-1.5">
                {/* 选中的磨豆机 - 胶囊形状独立显示 */}
                {allOptions
                  .filter(o => o.type === 'selected-grinder')
                  .map((option, index) => (
                    <button
                      key={option.grinderId}
                      ref={node => {
                        listRef.current[index] = node;
                      }}
                      type="button"
                      role="option"
                      aria-selected={activeIndex === index}
                      tabIndex={activeIndex === index ? 0 : -1}
                      onMouseDown={e => {
                        // 阻止 mousedown 导致输入框失去焦点
                        e.preventDefault();
                      }}
                      {...getItemProps({
                        onClick: e => handleOptionClick(option, e),
                      })}
                      className="inline-flex cursor-pointer items-center gap-1.5 self-start rounded-full border border-neutral-200/60 bg-white/90 px-2.5 py-1 text-xs text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-sm transition-colors dark:border-neutral-700/60 dark:bg-neutral-800/90 dark:text-neutral-400"
                    >
                      {isSyncEnabled ? (
                        <Link2 className="h-3 w-3 shrink-0" />
                      ) : (
                        <Unlink className="h-3 w-3 shrink-0 opacity-50" />
                      )}
                      <span
                        className={`whitespace-nowrap ${isSyncEnabled ? '' : 'opacity-50'}`}
                      >
                        {option.label}
                      </span>
                    </button>
                  ))}

                {/* 其他选项列表 */}
                {allOptions.filter(o => o.type !== 'selected-grinder').length >
                  0 && (
                  <div className="max-h-40 overflow-y-auto rounded-2xl border border-neutral-200/60 bg-white/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-sm dark:border-neutral-700/60 dark:bg-neutral-800/90">
                    {allOptions
                      .map((option, originalIndex) => ({
                        option,
                        originalIndex,
                      }))
                      .filter(
                        ({ option }) => option.type !== 'selected-grinder'
                      )
                      .map(({ option, originalIndex }) => (
                        <button
                          key={option.grinderId ?? `restore-${originalIndex}`}
                          ref={node => {
                            listRef.current[originalIndex] = node;
                          }}
                          type="button"
                          role="option"
                          tabIndex={-1}
                          {...getItemProps({
                            onClick: () => handleOptionClick(option),
                          })}
                          className="flex w-full cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-left text-xs text-neutral-600 dark:text-neutral-400"
                        >
                          {option.type === 'restore' && (
                            <Undo2 className="h-3 w-3 shrink-0" />
                          )}
                          <span className="whitespace-nowrap">
                            {option.label}
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </FloatingPortal>
        )}
      </div>
    );
  }
);

GrindSizeInput.displayName = 'GrindSizeInput';

export default GrindSizeInput;
