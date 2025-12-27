'use client';

import React, {
  ReactNode,
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from 'react';
import { Capacitor } from '@capacitor/core';
import { ArrowLeft, ArrowRight, Search, X, Shuffle } from 'lucide-react';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { showToast } from '@/components/common/feedback/LightToast';
import { useModalHistory } from '@/lib/hooks/useModalHistory';
import { useThemeColor } from '@/lib/hooks/useThemeColor';

export interface Step {
  id: string;
  label: string;
  content: ReactNode;
  isValid?: boolean;
}

interface NoteSteppedFormModalProps {
  showForm: boolean;
  onClose: () => void;
  onComplete: () => void;
  steps: Step[];
  initialStep?: number;
  preserveState?: boolean;
  onStepChange?: (index: number) => void;
  currentStep?: number;
  setCurrentStep?: React.Dispatch<React.SetStateAction<number>>;
  onRandomBean?: (isLongPress?: boolean) => void;
}

export interface NoteSteppedFormHandle {
  handleBackStep: () => boolean;
}

const NoteSteppedFormModal = forwardRef<
  NoteSteppedFormHandle,
  NoteSteppedFormModalProps
>(
  (
    {
      showForm,
      onClose,
      onComplete,
      steps,
      initialStep = 0,
      preserveState = false,
      onStepChange,
      currentStep,
      setCurrentStep,
      onRandomBean,
    },
    ref
  ) => {
    const [internalStepIndex, setInternalStepIndex] = useState(initialStep);
    const currentStepIndex =
      currentStep !== undefined ? currentStep : internalStepIndex;
    const setCurrentStepIndex = setCurrentStep || setInternalStepIndex;

    // 动画状态管理
    const [shouldRender, setShouldRender] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    // 平台检测
    const [isIOS, setIsIOS] = useState(false);

    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [highlightedBeanId, setHighlightedBeanId] = useState<string | null>(
      null
    );
    const [scrollContainer, setScrollContainer] =
      useState<HTMLDivElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    // callback ref: DOM 挂载时更新 state，触发重新渲染
    const contentScrollRefCallback = useCallback(
      (node: HTMLDivElement | null) => {
        setScrollContainer(node);
      },
      []
    );

    const allBeans = useCoffeeBeanStore(state => state.beans);

    // 同步顶部安全区颜色
    useThemeColor({ useOverlay: true, enabled: showForm });

    // 历史栈管理
    useModalHistory({ id: 'note-stepped-form', isOpen: showForm, onClose });

    // 处理显示/隐藏动画
    useEffect(() => {
      if (showForm) {
        setShouldRender(true);
        setCurrentStepIndex(initialStep);
        const timer = setTimeout(() => setIsVisible(true), 10);
        return () => clearTimeout(timer);
      } else {
        setIsVisible(false);
        const timer = setTimeout(() => {
          setShouldRender(false);
          if (!preserveState) {
            setCurrentStepIndex(initialStep);
            setIsSearching(false);
            setSearchQuery('');
            setHighlightedBeanId(null);
          }
        }, 400);
        return () => clearTimeout(timer);
      }
    }, [showForm, initialStep, preserveState, setCurrentStepIndex]);

    // 检测平台
    useEffect(() => {
      if (Capacitor.isNativePlatform()) {
        const platform = Capacitor.getPlatform();
        setIsIOS(platform === 'ios');
      }
    }, []);

    // 监听输入框聚焦，确保在iOS上输入框可见
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

    useImperativeHandle(
      ref,
      () => ({
        handleBackStep: () => {
          if (currentStepIndex > 0) {
            const newIndex = currentStepIndex - 1;
            setCurrentStepIndex(newIndex);
            onStepChange?.(newIndex);
            setIsSearching(false);
            setSearchQuery('');
            setHighlightedBeanId(null);
            return true;
          }
          return false;
        },
      }),
      [currentStepIndex, setCurrentStepIndex, onStepChange]
    );

    const currentStepContent = steps[currentStepIndex];
    const progress = ((currentStepIndex + 1) / steps.length) * 100;
    const isCoffeeBeanStep = currentStepContent?.id === 'coffeeBean';

    const handleBack = () => {
      setIsSearching(false);
      setSearchQuery('');
      setHighlightedBeanId(null);
      onClose();
    };

    const handleNext = () => {
      if (currentStepIndex < steps.length - 1) {
        const newIndex = currentStepIndex + 1;
        setCurrentStepIndex(newIndex);
        onStepChange?.(newIndex);
        setIsSearching(false);
        setSearchQuery('');
        setHighlightedBeanId(null);
      } else {
        onComplete();
      }
    };

    const handleSearchClick = () => {
      setIsSearching(true);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    };

    const handleCloseSearch = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setIsSearching(false);
      setSearchQuery('');
    };

    const buttonBaseClass =
      'rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100';

    // 随机选择咖啡豆
    const handleRandomBean = (isLongPress = false) => {
      if (onRandomBean) {
        onRandomBean(isLongPress);
        return;
      }

      const availableBeans = allBeans.filter(bean => {
        if (bean.isInTransit) return false;
        if (!bean.capacity || bean.capacity === '0' || bean.capacity === '0g')
          return true;
        return parseFloat(bean.remaining || '0') > 0;
      });

      if (availableBeans.length > 0) {
        const randomBean =
          availableBeans[Math.floor(Math.random() * availableBeans.length)];
        setHighlightedBeanId(randomBean.id);
        setTimeout(() => setHighlightedBeanId(null), 4000);
      } else {
        showToast({ type: 'info', title: '没有可用的咖啡豆', duration: 2000 });
      }
    };

    // 为咖啡豆选择器添加搜索参数
    const contentWithSearchProps = React.useMemo(() => {
      if (!isCoffeeBeanStep) return currentStepContent?.content;
      return React.cloneElement(
        currentStepContent.content as React.ReactElement<{
          searchQuery?: string;
          highlightedBeanId?: string | null;
          scrollParentRef?: HTMLElement;
        }>,
        {
          searchQuery,
          highlightedBeanId,
          scrollParentRef: scrollContainer || undefined,
        }
      );
    }, [
      currentStepContent?.content,
      isCoffeeBeanStep,
      searchQuery,
      highlightedBeanId,
      scrollContainer,
    ]);

    const isLastStep = currentStepIndex === steps.length - 1;
    const isValid = currentStepContent?.isValid !== false;

    if (!shouldRender) return null;

    return (
      <>
        {/* 背景遮罩 */}
        <div
          className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-400 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
          onClick={onClose}
        />

        {/* 抽屉内容 */}
        <div
          ref={modalRef}
          className={`fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[90vh] max-w-md flex-col rounded-t-3xl bg-white shadow-xl transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] dark:bg-neutral-900 ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
        >
          <div className="pb-safe-bottom flex h-full flex-col overflow-hidden px-6 pt-4">
            {/* 顶部导航栏 */}
            <div className="mb-6 flex shrink-0 items-center justify-between">
              <button
                type="button"
                onClick={handleBack}
                className="-m-3 rounded-full p-3"
              >
                <ArrowLeft className="h-5 w-5 text-neutral-800 dark:text-neutral-200" />
              </button>
              <div className="w-full px-4">
                <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                  <div
                    className="h-full bg-neutral-800 transition-all duration-300 ease-in-out dark:bg-neutral-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                {currentStepIndex + 1}/{steps.length}
              </div>
            </div>

            {/* 步骤内容 */}
            <div
              className="min-h-0 flex-1 overflow-y-auto pb-4"
              ref={contentScrollRefCallback}
            >
              {currentStepContent && (
                <div className="space-y-6">{contentWithSearchProps}</div>
              )}
            </div>

            {/* 底部按钮区域 */}
            <div className="modal-bottom-button flex items-center justify-center">
              <div className="flex items-center justify-center gap-2">
                {/* 搜索输入框 */}
                {isValid && isCoffeeBeanStep && isSearching && (
                  <div className="flex items-center gap-2">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="搜索咖啡豆名称..."
                      className="w-48 rounded-full border-none bg-neutral-100 px-5 py-[14px] text-sm font-medium text-neutral-800 placeholder-neutral-400 outline-hidden dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500"
                      autoComplete="off"
                      onKeyDown={e => e.key === 'Escape' && handleCloseSearch()}
                    />
                    <button
                      type="button"
                      onClick={handleCloseSearch}
                      className={`${buttonBaseClass} shrink-0 p-4`}
                    >
                      <X className="h-4 w-4" strokeWidth="3" />
                    </button>
                  </div>
                )}

                {/* 下一步/完成按钮 */}
                {isValid && !(isCoffeeBeanStep && isSearching) && (
                  <button
                    type="button"
                    onClick={isCoffeeBeanStep ? handleSearchClick : handleNext}
                    className={`${buttonBaseClass} flex items-center justify-center ${isLastStep && !isCoffeeBeanStep ? 'px-6 py-3' : 'px-5 py-3'}`}
                  >
                    {isLastStep && !isCoffeeBeanStep ? (
                      <span className="font-medium">保存笔记</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {isCoffeeBeanStep ? '搜索' : '下一步'}
                        </span>
                        {isCoffeeBeanStep ? (
                          <Search className="h-4 w-4" strokeWidth="3" />
                        ) : (
                          <ArrowRight className="h-4 w-4" strokeWidth="3" />
                        )}
                      </div>
                    )}
                  </button>
                )}

                {/* 随机选择按钮 */}
                {isValid && isCoffeeBeanStep && !isSearching && (
                  <button
                    type="button"
                    onClick={() => handleRandomBean(false)}
                    className={`${buttonBaseClass} flex items-center justify-center p-4`}
                  >
                    <Shuffle className="h-4 w-4" strokeWidth="3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }
);

NoteSteppedFormModal.displayName = 'NoteSteppedFormModal';

export default NoteSteppedFormModal;
