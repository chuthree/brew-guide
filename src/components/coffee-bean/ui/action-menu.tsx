'use client';

import React, {
  useRef,
  useEffect,
  useLayoutEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import { cn } from '@/lib/utils/classNameUtils';
import { AnimatePresence, motion } from 'framer-motion';
import { MoreHorizontal } from 'lucide-react';

const MORPH_EASE = [0.23, 1, 0.32, 1] as const;

export interface ActionMenuItem {
  id: string;
  label: string;
  onClick: () => void;
  color?: 'default' | 'success' | 'danger' | 'warning' | 'info';
  renderContent?: ReactNode;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  onClose?: () => void;
  className?: string;
  triggerClassName?: string;
  triggerChildren?: ReactNode;
  menuClassName?: string;
  showAnimation?: boolean;
  useMorphingAnimation?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onStop?: (e: React.MouseEvent) => void;
}

const ActionMenu: React.FC<ActionMenuProps> = ({
  items,
  onClose,
  className,
  triggerClassName,
  triggerChildren,
  menuClassName,
  showAnimation = false,
  useMorphingAnimation = false,
  isOpen,
  onOpenChange,
  onStop,
}) => {
  // 状态管理
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const [useDropdown, setUseDropdown] = useState(false);

  // 引用管理
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const horizontalMenuRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(true);

  const updateMenuLayout = useCallback(() => {
    const container = menuRef.current;
    const content = horizontalMenuRef.current;
    if (!container || !content) return;

    let left = 8;
    let right = document.documentElement.clientWidth - 8;
    let branch: HTMLElement = container;
    for (
      let parent = container.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent);
      // 横向展开只能占用弹性标题的空间，不能挤走返回和其他操作按钮。
      if (style.display === 'flex' && style.flexDirection === 'row') {
        const flexibleSiblings = Array.from(parent.children).filter(
          sibling =>
            sibling !== branch && Number(getComputedStyle(sibling).flexGrow) > 0
        );
        if (flexibleSiblings.length > 0) {
          const flexibleSpace = flexibleSiblings.reduce(
            (width, sibling) => width + sibling.getBoundingClientRect().width,
            0
          );
          left = Math.max(
            left,
            container.getBoundingClientRect().left - flexibleSpace
          );
        }
      }
      if (style.overflowX !== 'visible') {
        const bounds = parent.getBoundingClientRect();
        left = Math.max(left, bounds.left + 8);
        right = Math.min(right, bounds.right - 8);
      }
      branch = parent;
    }
    const availableWidth =
      Math.min(container.getBoundingClientRect().right, right) - left;
    // 按横排的 px-3 按钮、px-1 容器和 gap-0.5 计算，避免竖排宽度影响判断。
    const horizontalWidth = Array.from(content.children).reduce(
      (width, button) =>
        width +
        (button.firstElementChild?.getBoundingClientRect().width ?? 0) +
        24,
      8 + Math.max(0, content.children.length - 1) * 2
    );
    setUseDropdown(horizontalWidth > availableWidth);
  }, []);

  useLayoutEffect(() => {
    if (!useMorphingAnimation || !open) return;
    updateMenuLayout();
    const observer = new ResizeObserver(updateMenuLayout);
    if (horizontalMenuRef.current) observer.observe(horizontalMenuRef.current);
    if (menuRef.current?.parentElement) {
      observer.observe(menuRef.current.parentElement);
    }
    window.addEventListener('resize', updateMenuLayout);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateMenuLayout);
    };
  }, [useMorphingAnimation, open, updateMenuLayout]);

  // 组件挂载状态管理
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // 安全的状态更新
  const setOpen = useCallback(
    (value: boolean) => {
      if (!isMounted.current) return;

      setInternalOpen(value);
      onOpenChange?.(value);

      if (!value) {
        onClose?.();
      }
    },
    [onOpenChange, onClose]
  );

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!isMounted.current) return;

      const target = event.target as Node;
      const isInMenu = menuRef.current && menuRef.current.contains(target);
      const isOnTrigger =
        triggerRef.current && triggerRef.current.contains(target);

      // 检查是否点击了其他 ActionMenu 的触发按钮
      const isOtherActionMenuTrigger =
        (target as Element).closest?.('.action-menu-container') &&
        !menuRef.current?.contains(target);

      if (!isInMenu && !isOnTrigger) {
        // 如果点击了其他 ActionMenu，延迟关闭以允许新菜单打开
        if (isOtherActionMenuTrigger) {
          setTimeout(() => {
            if (isMounted.current) {
              setOpen(false);
            }
          }, 0);
        } else {
          setOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [open, setOpen]);

  // 事件处理
  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStop?.(e);
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    handleStop(e);
    setOpen(!open);
  };

  const handleItemClick = (e: React.MouseEvent, onClick: () => void) => {
    handleStop(e);
    onClick();
    setOpen(false);
  };

  // 样式生成函数
  const getColorClassName = (color: ActionMenuItem['color']) => {
    const colorMap = {
      success: 'text-emerald-600 dark:text-emerald-500',
      danger: 'text-red-500 dark:text-red-400',
      warning: 'text-amber-500 dark:text-amber-400',
      info: 'text-blue-400 dark:text-blue-500',
      default: 'text-neutral-600 dark:text-neutral-300',
    };
    return colorMap[color || 'default'];
  };

  // 渲染触发器内容
  const renderTriggerContent = () => {
    return (
      triggerChildren || (
        <MoreHorizontal className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
      )
    );
  };

  // 渲染菜单内容
  const menuContent = (
    <div className="py-1">
      {items.map(item => (
        <button
          type="button"
          key={item.id}
          onClick={e => handleItemClick(e, item.onClick)}
          className={cn(
            'relative w-full px-3 py-1.5 text-left text-xs font-medium',
            getColorClassName(item.color)
          )}
        >
          {item.renderContent || item.label}
        </button>
      ))}
    </div>
  );

  // 变形动画渲染
  if (useMorphingAnimation) {
    return (
      <div
        className={cn('action-menu-container relative h-8', className)}
        ref={menuRef}
      >
        <motion.div
          onClick={handleStop}
          className={cn(
            'relative flex items-center justify-center overflow-hidden',
            triggerClassName,
            useDropdown && 'z-50'
          )}
          initial={false}
          animate={{
            width: open ? 'auto' : '2rem',
            height: open && useDropdown ? 'auto' : '2rem',
            borderRadius: open && useDropdown ? '0.75rem' : '1rem',
          }}
          transition={{
            duration: open ? 0.24 : 0.18,
            ease: MORPH_EASE,
          }}
        >
          {/* 圆形按钮 - 展开时淡出 */}
          <motion.button
            ref={triggerRef}
            onClick={handleTriggerClick}
            className="absolute top-0 right-0 flex h-8 w-8 items-center justify-center"
            initial={false}
            animate={{
              opacity: open ? 0 : 1,
            }}
            transition={{
              duration: open ? 0.1 : 0.14,
              ease: MORPH_EASE,
            }}
            style={{
              pointerEvents: open ? 'none' : 'auto',
            }}
          >
            {renderTriggerContent()}
          </motion.button>

          {/* 展开的菜单 - 收起时淡出 */}
          <motion.div
            ref={horizontalMenuRef}
            className={cn(
              'flex w-max shrink-0 gap-0.5 px-1',
              useDropdown ? 'flex-col items-stretch py-1' : 'items-center'
            )}
            inert={!open}
            initial={false}
            animate={{
              opacity: open ? 1 : 0,
            }}
            transition={{
              duration: open ? 0.18 : 0.1,
              delay: open ? 0.05 : 0,
              ease: MORPH_EASE,
            }}
            style={{
              pointerEvents: open ? 'auto' : 'none',
            }}
          >
            {(useDropdown ? [...items].reverse() : items).map(item => (
              <button
                type="button"
                key={item.id}
                onClick={e => handleItemClick(e, item.onClick)}
                className={cn(
                  'h-8 shrink-0 rounded-lg px-3 text-xs font-medium whitespace-nowrap',
                  useDropdown && 'text-left',
                  'transition-colors hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50',
                  getColorClassName(item.color)
                )}
              >
                <span className="inline-block">
                  {item.renderContent || item.label}
                </span>
              </button>
            ))}
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn('action-menu-container relative', className)}>
      {showAnimation ? (
        <AnimatePresence mode="wait">
          {/* 触发按钮 */}
          <motion.button
            ref={triggerRef}
            key="more-button"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.26 }}
            onClick={handleTriggerClick}
            className={cn(
              'flex h-7 w-7 items-center justify-center text-xs text-neutral-500 dark:text-neutral-400',
              triggerClassName
            )}
          >
            {renderTriggerContent()}
          </motion.button>

          {/* 菜单 */}
          {open && (
            <motion.div
              key="action-buttons"
              initial={{ opacity: 0, scale: 0.9, x: 10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.26 }}
              className={cn(
                'absolute top-6 right-0 z-50 min-w-[100px] overflow-hidden rounded-lg border border-neutral-200/70 bg-white/95 shadow-lg backdrop-blur-xs dark:border-neutral-800/70 dark:bg-neutral-900/95',
                menuClassName
              )}
              ref={menuRef}
              onClick={handleStop}
            >
              {menuContent}
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        <>
          {/* 无动画触发按钮 */}
          <button
            type="button"
            ref={triggerRef}
            onClick={handleTriggerClick}
            className={cn(
              'flex h-[16.5] items-center justify-center text-xs text-neutral-600 dark:text-neutral-400',
              triggerClassName
            )}
          >
            {renderTriggerContent()}
          </button>

          {/* 无动画菜单 */}
          {open && (
            <div
              ref={menuRef}
              className={cn(
                'absolute top-6 right-0 z-50 min-w-[100px] overflow-hidden rounded-lg border border-neutral-200/70 bg-white/95 shadow-lg backdrop-blur-xs dark:border-neutral-800/70 dark:bg-neutral-900/95',
                menuClassName
              )}
              onClick={handleStop}
            >
              {menuContent}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ActionMenu;
