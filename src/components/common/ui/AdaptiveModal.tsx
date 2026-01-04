'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Capacitor } from '@capacitor/core';
import { useModalHistory } from '@/lib/hooks/useModalHistory';
import { useThemeColor } from '@/lib/hooks/useThemeColor';
import { pageStackManager } from '@/lib/navigation/pageTransition';

/**
 * Tailwind md 断点的像素值 (768px)
 */
export const MD_BREAKPOINT = 768;

/**
 * iOS 风格全屏转场动画配置（小屏幕）
 * 使用与 BeanDetailModal/SettingPage 相同的 pageTransition 配置
 */
export const IOS_FULLSCREEN_TRANSITION = {
  duration: 350, // ms
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  initialX: '24px', // 初始偏移量
};

/**
 * 底部抽屉动画配置（大屏幕）
 * 使用与现有 NoteSteppedFormModal/BrewingNoteEditModal 相同的配置
 */
export const DRAWER_TRANSITION = {
  duration: 400, // ms
  easing: 'cubic-bezier(0.32, 0.72, 0, 1)', // 现有抽屉使用的缓动曲线
};

/**
 * 遮罩层动画配置
 */
export const OVERLAY_TRANSITION = {
  duration: 400, // ms - 与抽屉动画同步
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

export interface AdaptiveModalProps {
  /** 控制模态框是否打开 */
  isOpen: boolean;

  /** 关闭模态框的回调 */
  onClose: () => void;

  /**
   * 模态框内容
   * 支持 render props 模式获取当前模式信息
   */
  children:
    | React.ReactNode
    | ((props: {
        isMediumScreen: boolean;
        isFullscreen: boolean;
      }) => React.ReactNode);

  /**
   * 模态框历史栈 ID（用于返回键管理）
   * 如果不传则自动生成唯一 ID
   */
  historyId?: string;

  /**
   * 退出动画完成后的回调
   * 适合在此时机清理数据
   */
  onExitComplete?: () => void;

  /**
   * 抽屉最大宽度（仅 Drawer Mode 生效）
   * @default '480px'
   */
  drawerMaxWidth?: string;

  /**
   * 抽屉高度（仅 Drawer Mode 生效）
   * @default '85vh'
   */
  drawerHeight?: string;

  /**
   * 自定义类名（应用于内容容器）
   */
  className?: string;

  /**
   * 是否在 Drawer Mode 显示遮罩
   * @default true
   */
  showDrawerOverlay?: boolean;
}

export interface AdaptiveModalHandle {
  /** 获取内容容器的 DOM 引用 */
  getContentRef: () => HTMLDivElement | null;
}

/**
 * 统一响应式模态组件
 *
 * 根据屏幕尺寸自动切换显示模式：
 * - md 以下（< 768px）：全屏模式，iOS 风格转场动画
 * - md 以上（>= 768px）：底部抽屉模式，居中显示
 *
 * ## 特性
 * - 自动响应屏幕尺寸变化
 * - 支持返回键/手势关闭
 * - 模式切换时遮罩层平滑过渡
 * - iOS 输入框自动滚动到可见区域
 *
 * @example
 * ```tsx
 * <AdaptiveModal isOpen={isOpen} onClose={onClose}>
 *   <div className="p-6">
 *     <h2>标题</h2>
 *     <p>内容</p>
 *   </div>
 * </AdaptiveModal>
 * ```
 *
 * @example
 * ```tsx
 * // 使用 render props 获取当前模式
 * <AdaptiveModal isOpen={isOpen} onClose={onClose}>
 *   {({ isMediumScreen, isFullscreen }) => (
 *     <div className={isFullscreen ? 'pt-safe-top' : ''}>
 *       内容
 *     </div>
 *   )}
 * </AdaptiveModal>
 * ```
 */
const AdaptiveModal = forwardRef<AdaptiveModalHandle, AdaptiveModalProps>(
  (
    {
      isOpen,
      onClose,
      children,
      historyId,
      onExitComplete,
      drawerMaxWidth = '480px',
      drawerHeight = '85vh',
      className = '',
      showDrawerOverlay = true,
    },
    ref
  ) => {
    const isMediumScreen = useIsMediumScreen();
    const contentRef = useRef<HTMLDivElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    // 动画状态管理
    const [shouldRender, setShouldRender] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    // 遮罩层可见性（用于模式切换时的平滑过渡）
    const [overlayVisible, setOverlayVisible] = useState(false);

    // 平台检测
    const [isIOS, setIsIOS] = useState(false);

    // 跟踪上一次的屏幕模式，用于检测模式切换
    const prevMediumScreenRef = useRef(isMediumScreen);

    // 使用 ref 存储 onExitComplete 回调，避免在动画过程中因回调变化导致重新执行
    const onExitCompleteRef = useRef(onExitComplete);
    onExitCompleteRef.current = onExitComplete;

    // 生成稳定的唯一 ID（如果未提供 historyId）
    const [autoId] = useState(
      () =>
        `adaptive-modal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
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

    // 同步顶部安全区颜色（仅在遮罩层可见时）
    useThemeColor({
      useOverlay: overlayVisible,
      enabled: isOpen && overlayVisible,
    });

    // 集成历史栈管理，支持返回键关闭
    useModalHistory({
      id: modalId,
      isOpen,
      onClose,
    });

    // 检测平台
    useEffect(() => {
      if (Capacitor.isNativePlatform()) {
        const platform = Capacitor.getPlatform();
        setIsIOS(platform === 'ios');
      }
    }, []);

    // 通知 pageStackManager 以触发主页面动画（仅在全屏模式下）
    useEffect(() => {
      // 只在小屏幕（全屏模式）时通知主页面
      if (!isMediumScreen && isOpen) {
        pageStackManager.setModalOpen(true);
        return () => {
          pageStackManager.setModalOpen(false);
        };
      }
    }, [isOpen, isMediumScreen]);

    // 处理显示/隐藏动画
    useEffect(() => {
      if (isOpen) {
        setShouldRender(true);
        // 设置遮罩层可见性（仅在抽屉模式下显示）
        if (isMediumScreen && showDrawerOverlay) {
          setOverlayVisible(true);
        } else {
          setOverlayVisible(false);
        }
        const timer = setTimeout(() => setIsVisible(true), 10);
        return () => clearTimeout(timer);
      } else {
        setIsVisible(false);
        // 根据当前模式选择动画时长
        const animationDuration = isMediumScreen
          ? DRAWER_TRANSITION.duration
          : IOS_FULLSCREEN_TRANSITION.duration;
        const timer = setTimeout(() => {
          setShouldRender(false);
          setOverlayVisible(false);
          // 使用 ref 调用回调，确保调用的是最新的回调函数
          onExitCompleteRef.current?.();
        }, animationDuration);
        return () => clearTimeout(timer);
      }
    }, [isOpen, isMediumScreen, showDrawerOverlay]);

    // 处理模式切换时的遮罩层平滑过渡
    useEffect(() => {
      if (!isOpen) return;

      const prevMediumScreen = prevMediumScreenRef.current;

      if (prevMediumScreen !== isMediumScreen) {
        // 模式发生切换
        if (!prevMediumScreen && isMediumScreen) {
          // 从全屏切换到抽屉：渐显遮罩
          if (showDrawerOverlay) {
            setOverlayVisible(true);
          }
        } else if (prevMediumScreen && !isMediumScreen) {
          // 从抽屉切换到全屏：渐隐遮罩
          setOverlayVisible(false);
        }
      }

      prevMediumScreenRef.current = isMediumScreen;
    }, [isOpen, isMediumScreen, showDrawerOverlay]);

    // 监听输入框聚焦，确保在 iOS 上输入框可见
    useEffect(() => {
      if (!shouldRender) return;

      const modalElement = modalRef.current;
      if (!modalElement) return;

      const handleInputFocus = (e: Event) => {
        const target = e.target as HTMLElement;

        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT')
        ) {
          if (isIOS) {
            setTimeout(() => {
              target.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              });
            }, 300);
          }
        }
      };

      modalElement.addEventListener('focusin', handleInputFocus);

      return () => {
        modalElement.removeEventListener('focusin', handleInputFocus);
      };
    }, [shouldRender, isIOS]);

    // 处理遮罩层点击关闭
    const handleOverlayClick = useCallback(() => {
      onClose();
    }, [onClose]);

    // 渲染 children
    const renderChildren = () => {
      if (typeof children === 'function') {
        return children({
          isMediumScreen,
          isFullscreen: !isMediumScreen,
        });
      }
      return children;
    };

    if (!shouldRender) return null;

    // 大屏幕：底部抽屉模式
    if (isMediumScreen) {
      return (
        <>
          {/* 背景遮罩 */}
          {showDrawerOverlay && (
            <div
              className={`fixed inset-0 z-40 bg-black/50 transition-opacity`}
              style={{
                transitionDuration: `${OVERLAY_TRANSITION.duration}ms`,
                opacity: overlayVisible && isVisible ? 1 : 0,
              }}
              onClick={handleOverlayClick}
            />
          )}

          {/* 抽屉内容 */}
          <div
            ref={modalRef}
            className={`pb-safe-bottom fixed inset-x-0 bottom-0 z-50 mx-auto flex flex-col rounded-t-3xl bg-neutral-50 shadow-xl dark:bg-neutral-900 ${className}`}
            style={{
              maxWidth: drawerMaxWidth,
              height: drawerHeight,
              transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
              transition: `transform ${DRAWER_TRANSITION.duration}ms ${DRAWER_TRANSITION.easing}`,
            }}
          >
            <div
              ref={contentRef}
              className="flex h-full flex-col overflow-hidden"
            >
              {renderChildren()}
            </div>
          </div>
        </>
      );
    }

    // 小屏幕：全屏模式（iOS 风格转场）
    return (
      <div
        ref={modalRef}
        className={`pt-safe-top pb-safe-bottom fixed inset-0 z-50 flex flex-col bg-neutral-50 dark:bg-neutral-900 ${className}`}
        style={{
          transform: isVisible
            ? 'translate3d(0, 0, 0)'
            : `translate3d(${IOS_FULLSCREEN_TRANSITION.initialX}, 0, 0)`,
          opacity: isVisible ? 1 : 0,
          transition: `transform ${IOS_FULLSCREEN_TRANSITION.duration}ms ${IOS_FULLSCREEN_TRANSITION.easing}, opacity ${IOS_FULLSCREEN_TRANSITION.duration}ms ${IOS_FULLSCREEN_TRANSITION.easing}`,
          isolation: 'isolate',
        }}
      >
        <div ref={contentRef} className="flex h-full flex-col overflow-hidden">
          {renderChildren()}
        </div>
      </div>
    );
  }
);

AdaptiveModal.displayName = 'AdaptiveModal';

export default AdaptiveModal;
