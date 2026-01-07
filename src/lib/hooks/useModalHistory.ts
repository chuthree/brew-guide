import { useEffect, useRef } from 'react';
import { modalHistory, ModalEntry } from '@/lib/navigation/modalHistory';

export interface UseModalHistoryOptions {
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
  onClose: () => void;

  /**
   * 是否使用 replace 模式（可选）
   * 如果为 true，会替换栈顶而不是入栈
   * 适用于"从详情页进入编辑页"这类场景
   */
  replace?: boolean;
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
  const { id, isOpen, onClose, replace = false } = options;

  // 使用 ref 保存最新的回调，避免重复注册
  const onCloseRef = useRef(onClose);
  // 跟踪上一次的 isOpen 状态，用于检测是否是主动关闭
  const wasOpenRef = useRef(false);
  // 标记是否是通过 popstate 关闭的
  const closedByPopstateRef = useRef(false);

  // 更新 ref
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // 注册/注销模态框
  useEffect(() => {
    if (isOpen) {
      // 打开时注册
      wasOpenRef.current = true;
      closedByPopstateRef.current = false;

      const entry: ModalEntry = {
        id,
        onClose: () => {
          // 标记为通过 popstate 关闭
          closedByPopstateRef.current = true;
          onCloseRef.current();
        },
      };

      // 根据模式选择注册方式
      if (replace) {
        modalHistory.replace(entry);
      } else {
        modalHistory.register(entry);
      }

      // 清理函数：组件卸载时清理历史栈
      return () => {
        // 组件卸载时，如果还在栈中，需要清理
        if (modalHistory.isOpen(id) && !closedByPopstateRef.current) {
          modalHistory.close(id);
        }
        wasOpenRef.current = false;
      };
    } else if (wasOpenRef.current && !closedByPopstateRef.current) {
      // isOpen 从 true 变为 false，且不是通过 popstate 关闭的
      // 这意味着是主动关闭（如表单提交、点击关闭按钮直接设置 isOpen=false）
      // 需要清理浏览器历史
      modalHistory.close(id);
      wasOpenRef.current = false;
    } else if (wasOpenRef.current && closedByPopstateRef.current) {
      // 通过 popstate 关闭的，只重置标志
      wasOpenRef.current = false;
    }
  }, [id, isOpen, replace]);
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
  onClose: () => void;
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

      // 步骤增加时，推入新历史
      // 这会处理：1) 初始打开时的第一步；2) 后续步骤增加
      if (step > prevStep) {
        modalHistory.pushStep(
          id,
          step,
          newStep => onStepChangeRef.current(newStep),
          () => {
            closedByPopstateRef.current = true;
            onCloseRef.current();
          }
        );
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
      () => {
        closedByPopstateRef.current = true;
        onCloseRef.current();
      }
    );
  }, [isOpen]);
}

// 导出 modalHistory 实例，方便组件直接使用
export { modalHistory };
