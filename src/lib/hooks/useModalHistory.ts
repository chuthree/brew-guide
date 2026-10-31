import { useEffect, useRef } from 'react';
import {
  modalHistory,
  type ModalEntry,
  type ModalCloseEvent,
} from '@/lib/navigation/modalHistory';
import { skipNextPageExitTransition } from '@/lib/navigation/pageTransition';

export interface UseModalHistoryOptions {
  dismissible?: boolean;
  /**
   * 模态框唯一标识
   * 建议使用有意义的名称，如 'bean-detail', 'settings'
   */
  id: string;

  /**
   * 模态框是否打开
   */
  isOpen: boolean;

  /**
   * 关闭回调
   * 当用户点击返回或调用 modalHistory.back() 时触发
   * 组件应该在此回调中设置 isOpen = false，动画由组件自己通过状态控制
   */
  onClose: (event: ModalCloseEvent) => void;

  /**
   * 是否使用 replace 模式（可选）
   * 如果为 true，会替换栈顶而不是入栈
   * 适用于"从详情页进入编辑页"这类场景
   */
  replace?: boolean;

  /**
   * 系统历史返回时跳过页面退出转场。
   * 用于 iOS 手势返回已经提供交互动画的全屏页，避免 WebView 恢复后复播。
   */
  skipPageExitTransitionOnHistory?: boolean;
}

/**
 * 模态框历史栈管理 Hook
 *
 * 动画说明：历史栈管理器不处理动画延迟，组件应该通过自己的状态控制动画。
 * 当 onClose 被调用时，组件设置 isOpen = false，然后通过 useEffect 控制动画。
 *
 * @example
 * ```tsx
 * function MyModal({ isOpen, onClose }) {
 *   const [shouldRender, setShouldRender] = useState(false);
 *   const [isVisible, setIsVisible] = useState(false);
 *
 *   useModalHistory({
 *     id: 'my-modal',
 *     isOpen,
 *     onClose, // 直接调用，不需要延迟
 *   });
 *
 *   // 组件自己控制动画
 *   useEffect(() => {
 *     if (isOpen) {
 *       setShouldRender(true);
 *       setTimeout(() => setIsVisible(true), 10);
 *     } else {
 *       setIsVisible(false);
 *       setTimeout(() => setShouldRender(false), 350); // 动画时长
 *     }
 *   }, [isOpen]);
 *
 *   // ...
 * }
 * ```
 */
export function useModalHistory(options: UseModalHistoryOptions): void {
  const {
    dismissible = true,
    id,
    isOpen,
    onClose,
    replace = false,
    skipPageExitTransitionOnHistory = false,
  } = options;

  // 使用 ref 保存最新的回调
  const onCloseRef = useRef(onClose);
  // 标记是否是通过 popstate 关闭的
  const closedByPopstateRef = useRef(false);
  // 用于取消延迟清理的 timer
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 更新 ref
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // 注册/注销模态框
  useEffect(() => {
    // 取消之前的延迟清理（如果有）
    // 这处理 StrictMode 的情况：清理函数设置了延迟清理，但组件立即重新挂载
    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }

    let entry: ModalEntry | undefined;

    if (isOpen) {
      // 始终注册以刷新同 ID 历史层的回调，register 不会重复 push
      closedByPopstateRef.current = false;

      entry = {
        id,
        dismissible,
        onClose: event => {
          closedByPopstateRef.current = true;
          if (skipPageExitTransitionOnHistory && event.source === 'history') {
            skipNextPageExitTransition();
          }
          onCloseRef.current(event);
        },
      };

      if (replace) {
        modalHistory.replace(entry);
      } else {
        modalHistory.register(entry);
      }
    } else {
      // isOpen 为 false，需要清理
      if (!closedByPopstateRef.current && modalHistory.isOpen(id)) {
        modalHistory.close(id);
      }
      closedByPopstateRef.current = false;
    }

    // 清理函数
    return () => {
      // 使用延迟清理来处理 StrictMode 的情况
      if (entry && !closedByPopstateRef.current) {
        cleanupTimerRef.current = setTimeout(() => {
          modalHistory.close(id, true, entry);
          cleanupTimerRef.current = null;
        }, 0);
      }
    };
  }, [id, isOpen, replace, dismissible, skipPageExitTransitionOnHistory]);
}

/**
 * 多步骤模态框历史栈管理 Hook
 *
 * 专门用于多步骤表单（如咖啡豆编辑表单），每一步都会创建独立的历史记录。
 * 浏览器返回和表单内返回按钮行为完全一致。
 *
 * @example
 * ```tsx
 * function MultiStepForm({ isOpen, onClose }) {
 *   const [step, setStep] = useState(1);
 *
 *   useMultiStepModalHistory({
 *     id: 'my-form',
 *     isOpen,
 *     step,
 *     onStepChange: setStep,
 *     onClose,
 *   });
 *
 *   const handleNext = () => setStep(s => s + 1);
 *   const handleBack = () => {
 *     if (step > 1) {
 *       modalHistory.back(); // 这会触发 onStepChange
 *     } else {
 *       modalHistory.back(); // 这会触发 onClose
 *     }
 *   };
 *
 *   // ...
 * }
 * ```
 */
export interface UseMultiStepModalHistoryOptions {
  /** 模态框唯一标识 */
  id: string;
  /** 模态框是否打开 */
  isOpen: boolean;
  /** 当前步骤，从 1 开始 */
  step: number;
  /** 步骤变化回调，浏览器返回时会调用 */
  onStepChange: (step: number) => void;
  /** 关闭回调，在第一步返回时调用（组件自己控制动画） */
  onClose: (event: ModalCloseEvent) => void;
}

export function useMultiStepModalHistory(
  options: UseMultiStepModalHistoryOptions
): void {
  const { id, isOpen, step, onStepChange, onClose } = options;

  // 使用 ref 保存最新的回调
  const onCloseRef = useRef(onClose);
  const onStepChangeRef = useRef(onStepChange);
  // prevStepRef 初始化为 0，这样可以正确检测初始 step
  const prevStepRef = useRef(0);
  // 跟踪是否已打开过
  const wasOpenRef = useRef(false);
  // 标记是否是通过 popstate 关闭的
  const closedByPopstateRef = useRef(false);
  // 跟踪是否已完成初始化
  const isInitializedRef = useRef(false);

  // 更新 ref
  useEffect(() => {
    onCloseRef.current = onClose;
    onStepChangeRef.current = onStepChange;
  }, [onClose, onStepChange]);

  // 处理打开/关闭和步骤变化
  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      closedByPopstateRef.current = false;

      const prevStep = prevStepRef.current;

      // 步骤增加时，逐步补齐历史栈。
      // 这会处理：
      // 1) 初始打开时直接恢复到更深的步骤（如草稿恢复到第 3 步）
      // 2) 后续正常逐步前进
      if (step > prevStep) {
        for (let nextStep = prevStep + 1; nextStep <= step; nextStep += 1) {
          modalHistory.pushStep(
            id,
            nextStep,
            newStep => onStepChangeRef.current(newStep),
            event => {
              closedByPopstateRef.current = true;
              onCloseRef.current(event);
            }
          );
        }
      }

      prevStepRef.current = step;
      isInitializedRef.current = true;
    } else {
      // isOpen 变为 false
      if (wasOpenRef.current && !closedByPopstateRef.current) {
        // isOpen 从 true 变为 false，且不是通过 popstate 关闭的
        // 检查是否还有相关的历史条目（可能已经被 closeAllByPrefix 清理了）
        if (modalHistory.isOpen(id)) {
          modalHistory.closeAllByPrefix(id);
        }
      }
      // 重置状态
      wasOpenRef.current = false;
      prevStepRef.current = 0;
      isInitializedRef.current = false;
    }
  }, [id, isOpen, step]);

  // 更新回调引用（确保历史栈中的回调始终是最新的）
  useEffect(() => {
    if (!isOpen || !isInitializedRef.current) return;

    modalHistory.updateTopCallbacks(
      newStep => onStepChangeRef.current(newStep),
      event => {
        closedByPopstateRef.current = true;
        onCloseRef.current(event);
      }
    );
  }, [isOpen]);
}

// 导出 modalHistory 实例，方便组件直接使用
export { modalHistory };
