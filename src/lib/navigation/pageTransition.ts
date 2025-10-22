/**
 * iOS 风格页面转场动画管理
 * 
 * 实现类似 iOS 原生应用的页面转场效果：
 * - 父页面轻微左移并缩小
 * - 子页面从右侧稍微偏移的位置滑入
 * - 带有透明度渐变
 * - 使用流畅的缓动曲线
 */

import { useEffect, useState } from 'react';

export interface PageTransitionConfig {
  // 父页面动画配置
  parentTranslateX: string;  // 父页面左移距离，如 '-20%'
  parentScale: number;        // 父页面缩放比例，如 0.95
  parentOpacity: number;      // 父页面透明度，如 0.8
  
  // 子页面动画配置
  childInitialX: string;     // 子页面初始位置，如 '10%'
  
  // 动画时长和缓动
  duration: number;          // 毫秒
  easing: string;            // CSS 缓动函数
}

// iOS 风格的默认配置
// 使用 iOS 13+ 的官方转场参数
export const IOS_TRANSITION_CONFIG: PageTransitionConfig = {
  parentTranslateX: '-24px',   // 主页左移距离
  parentScale: 1,              // 不使用缩放，避免位置偏移
  parentOpacity: 0.9,          // 轻微降低透明度
  childInitialX: '24px',       // 子页面从相同的偏移距离开始（与主页左移距离一致）
  duration: 350,               // iOS 标准转场时长
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',  // Material Design 标准缓动 - 最平滑自然
};

// 可选配置方案（可以试试这些）:
// 1. iOS 原生风格: duration: 350, easing: 'cubic-bezier(0.36, 0, 0.66, -0.56)'
// 2. 更舒缓: duration: 400, easing: 'cubic-bezier(0.4, 0, 0.2, 1)'  
// 3. 弹性感: duration: 400, easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'

// 页面栈状态管理
class PageStackManager {
  private listeners: Set<(hasModal: boolean) => void> = new Set();
  private hasModalOpen = false;

  subscribe(listener: (hasModal: boolean) => void) {
    this.listeners.add(listener);
    // 立即通知当前状态
    listener(this.hasModalOpen);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setModalOpen(isOpen: boolean) {
    if (this.hasModalOpen !== isOpen) {
      this.hasModalOpen = isOpen;
      this.listeners.forEach(listener => listener(isOpen));
    }
  }

  getModalOpen() {
    return this.hasModalOpen;
  }
}

export const pageStackManager = new PageStackManager();

/**
 * 生成父页面的转场样式
 */
export function getParentPageStyle(
  hasModal: boolean,
  config: PageTransitionConfig = IOS_TRANSITION_CONFIG
): React.CSSProperties {
  return {
    transform: hasModal 
      ? `translateX(${config.parentTranslateX}) scale(${config.parentScale})`
      : 'translateX(0) scale(1)',
    opacity: hasModal ? config.parentOpacity : 1,
    transition: `transform ${config.duration}ms ${config.easing}, opacity ${config.duration}ms ${config.easing}`,
    willChange: 'transform, opacity',
    transformOrigin: 'center center',
  };
}

/**
 * 生成子页面的CSS类名
 */
export function getChildPageClassName(): string {
  const baseClasses = `
    fixed inset-0 z-50 flex flex-col bg-neutral-50 dark:bg-neutral-900 max-w-[500px] mx-auto
    will-change-transform
  `.trim();

  const transitionClasses = `
    transition-all
  `.trim();

  // 使用内联样式来设置 transition duration 和 easing
  return `${baseClasses} ${transitionClasses}`;
}

/**
 * 生成子页面的内联样式
 */
export function getChildPageStyle(
  isVisible: boolean,
  config: PageTransitionConfig = IOS_TRANSITION_CONFIG
): React.CSSProperties {
  return {
    // 使用 translate3d 开启硬件加速
    // 子页面初始位置：从右侧偏移 childInitialX 的位置滑入（而不是从 100% 开始）
    // 这个距离与父页面左移的距离相同，创造出轻微的"推入"效果
    transform: isVisible 
      ? 'translate3d(0, 0, 0)' 
      : `translate3d(${config.childInitialX}, 0, 0)`,
    // 从半透明渐变到完全不透明
    opacity: isVisible ? 1 : 0,
    transition: `transform ${config.duration}ms ${config.easing}, opacity ${config.duration}ms ${config.easing}`,
    // 确保使用独立的变换上下文，不受父容器影响
    isolation: 'isolate',
  };
}

/**
 * Hook: 监听是否有模态框打开
 */
export function useModalState(): boolean {
  const [hasModal, setHasModal] = useState(false);

  useEffect(() => {
    return pageStackManager.subscribe(setHasModal);
  }, []);

  return hasModal;
}
