'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Drawer } from 'vaul';
import { motion, AnimatePresence, Transition } from 'framer-motion';
import { useModalHistory } from '@/lib/hooks/useModalHistory';
import { useThemeColor } from '@/lib/hooks/useThemeColor';

/**
 * Tailwind md 断点的像素值 (768px)
 */
export const MD_BREAKPOINT = 768;

/**
 * 统一动画规范
 * 基于 CSS transition 标准: 0.2s ease
 */
export const MODAL_TRANSITION: Transition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1.0],
};

/**
 * Hook: 监听是否为中等及以上屏幕 (md+)
 */
export function useIsMediumScreen(): boolean {
  const [isMedium, setIsMedium] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= MD_BREAKPOINT;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${MD_BREAKPOINT}px)`);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMedium(e.matches);
    };

    // 设置初始值
    setIsMedium(mediaQuery.matches);

    // 监听变化
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isMedium;
}

export interface ResponsiveModalProps {
  /** 控制模态框是否打开 */
  isOpen: boolean;
  /** 关闭模态框的回调 */
  onClose: () => void;
  /** 模态框内容，支持 render props 模式获取 isMediumScreen */
  children:
    | React.ReactNode
    | ((props: { isMediumScreen: boolean }) => React.ReactNode);
  /**
   * 模态框历史栈 ID（用于返回键管理）
   * 如果不传则自动生成唯一 ID
   */
  historyId?: string;
  /**
   * 退出动画完成后的回调
   * 适合在此时机清理数据，避免内容在动画播放时突然消失
   */
  onExitComplete?: () => void;
  /**
   * 抽屉最大宽度（仅 md+ 生效）
   * @default '480px'
   */
  drawerMaxWidth?: string;
  /**
   * 抽屉高度（仅 md+ 生效）
   * 可以是具体值如 '80vh' 或 'auto'
   * @default '85vh'
   */
  drawerHeight?: string;
  /**
   * 是否显示遮罩
   * @default true
   */
  showOverlay?: boolean;
  /**
   * 自定义类名（应用于内容容器）
   */
  className?: string;
}

// 暴露给父组件的方法
export interface ResponsiveModalHandle {
  /** 获取内容容器的 DOM 引用 */
  getContentRef: () => HTMLDivElement | null;
}

/**
 * 响应式模态框/抽屉组件
 *
 * 根据屏幕尺寸自动切换显示模式：
 * - md 以下（< 768px）：全屏模态框（从右侧滑入）
 * - md 以上（>= 768px）：底部抽屉（居中，限制最大宽度）
 *
 * ## 特性
 * - 自动响应屏幕尺寸变化
 * - 支持返回键/手势关闭
 * - 统一的动画规范
 * - 大屏幕抽屉支持拖拽关闭
 *
 * @example
 * ```tsx
 * <ResponsiveModal isOpen={isOpen} onClose={onClose}>
 *   <div className="p-6">
 *     <h2>标题</h2>
 *     <p>内容</p>
 *   </div>
 * </ResponsiveModal>
 * ```
 */
const ResponsiveModal = forwardRef<ResponsiveModalHandle, ResponsiveModalProps>(
  (
    {
      isOpen,
      onClose,
      children,
      historyId,
      onExitComplete,
      drawerMaxWidth = '480px',
      drawerHeight = '85vh',
      showOverlay = true,
      className = '',
    },
    ref
  ) => {
    const isMediumScreen = useIsMediumScreen();
    const contentRef = useRef<HTMLDivElement>(null);

    // 生成稳定的唯一 ID（如果未提供 historyId）
    const [autoId] = useState(
      () =>
        `responsive-modal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    );
    const modalId = historyId || autoId;

    // 暴露方法给父组件
    useImperativeHandle(
      ref,
      () => ({
        getContentRef: () => contentRef.current,
      }),
      []
    );

    // 同步顶部安全区颜色（用于 meta theme-color）
    useThemeColor({ useOverlay: showOverlay, enabled: isOpen });

    // 集成历史栈管理，支持返回键关闭
    useModalHistory({
      id: modalId,
      isOpen,
      onClose,
    });

    // 处理 Drawer 打开状态变化
    const handleOpenChange = useCallback(
      (open: boolean) => {
        if (!open) {
          onClose();
        }
      },
      [onClose]
    );

    // Drawer 动画结束回调
    const handleAnimationEnd = useCallback(
      (open: boolean) => {
        if (!open) {
          onExitComplete?.();
        }
      },
      [onExitComplete]
    );

    // 大屏幕：底部抽屉模式（居中，限制宽度）
    if (isMediumScreen) {
      return (
        <Drawer.Root
          open={isOpen}
          onAnimationEnd={handleAnimationEnd}
          dismissible={false}
        >
          <Drawer.Portal>
            {/* 背景遮罩 - 不响应点击 */}
            {showOverlay && (
              <Drawer.Overlay
                className="pointer-events-none fixed! inset-0 z-50 bg-black/50"
                style={{ position: 'fixed' }}
              />
            )}

            {/* 抽屉内容 - 居中显示，限制最大宽度 */}
            <Drawer.Content
              ref={contentRef}
              className={`fixed inset-x-0 bottom-0 z-50 mx-auto flex flex-col rounded-t-3xl bg-neutral-50 outline-none dark:bg-neutral-900 ${className}`}
              style={{
                maxWidth: drawerMaxWidth,
                height: drawerHeight,
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
              aria-describedby={undefined}
            >
              {/* 无障碍标题 - 视觉隐藏 */}
              <Drawer.Title className="sr-only">模态面板</Drawer.Title>

              {/* 内容区域 */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {typeof children === 'function'
                  ? children({ isMediumScreen: true })
                  : children}
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      );
    }

    // 小屏幕：全屏模态框模式
    return (
      <AnimatePresence onExitComplete={onExitComplete}>
        {isOpen && (
          <>
            {/* 背景遮罩 */}
            {showOverlay && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={MODAL_TRANSITION}
                className="fixed inset-0 z-50 bg-black/50"
                onClick={onClose}
              />
            )}

            {/* 全屏内容 */}
            <motion.div
              ref={contentRef}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{
                type: 'spring',
                damping: 30,
                stiffness: 300,
              }}
              className={`fixed inset-0 z-50 flex flex-col bg-neutral-50 dark:bg-neutral-900 ${className}`}
            >
              {typeof children === 'function'
                ? children({ isMediumScreen: false })
                : children}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }
);

ResponsiveModal.displayName = 'ResponsiveModal';

export default ResponsiveModal;
