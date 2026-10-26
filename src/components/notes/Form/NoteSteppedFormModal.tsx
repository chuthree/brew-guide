'use client';

import React, {
  ReactNode,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from 'react';
import { ArrowLeft, ArrowRight, Search, X, Shuffle } from 'lucide-react';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { showToast } from '@/components/common/feedback/LightToast';
import AdaptiveModal from '@/components/common/ui/AdaptiveModal';
import { useInputFocus } from '@/lib/hooks/useInputFocus';
import { COFFEE_BEAN_SEARCH_OR_CREATE_PLACEHOLDER } from '@/components/coffee-bean/ui/coffeeBeanSelectionText';
import { useLongPress } from '@/lib/hooks/useLongPress';

export interface Step {
  id: string;
  label: string;
  content:
    | ReactNode
    | ((searchQuery: string, closeSearch: () => void) => ReactNode);
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

    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [highlightedBeanId, setHighlightedBeanId] = useState<string | null>(
      null
    );
    const { inputRef: searchInputRef, activateAndFocus } =
      useInputFocus<HTMLInputElement>(isSearching);

    const allBeans = useCoffeeBeanStore(state => state.beans);

    useEffect(() => {
      setIsSearching(false);
      setSearchQuery('');
      setHighlightedBeanId(null);
    }, [currentStepIndex, showForm]);

    // 当 showForm 变化时重置步骤
    useEffect(() => {
      if (showForm && currentStep === undefined) {
        setCurrentStepIndex(initialStep);
      }
    }, [currentStep, showForm, initialStep, setCurrentStepIndex]);

    // 处理退出动画完成后的清理
    const handleExitComplete = useCallback(() => {
      if (!preserveState) {
        if (currentStep === undefined) {
          setCurrentStepIndex(initialStep);
        }
        setIsSearching(false);
        setSearchQuery('');
        setHighlightedBeanId(null);
      }
    }, [currentStep, preserveState, initialStep, setCurrentStepIndex]);

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
    const isMethodStep = currentStepContent?.id === 'method';
    const isSearchableStep = isCoffeeBeanStep || isMethodStep;

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
      activateAndFocus(() => {
        setIsSearching(true);
      });
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

    const randomBeanPressHandlers = useLongPress({
      onClick: () => handleRandomBean(false),
      onLongPress: () => handleRandomBean(true),
    });

    // 为咖啡豆选择器添加搜索参数
    const contentWithSearchProps =
      isCoffeeBeanStep && currentStepContent?.content
        ? React.cloneElement(
            currentStepContent.content as React.ReactElement<{
              searchQuery?: string;
              highlightedBeanId?: string | null;
            }>,
            {
              searchQuery,
              highlightedBeanId,
            }
          )
        : typeof currentStepContent?.content === 'function'
          ? currentStepContent.content(searchQuery, handleCloseSearch)
          : currentStepContent?.content;

    const isLastStep = currentStepIndex === steps.length - 1;
    const isValid = currentStepContent?.isValid !== false;

    return (
      <AdaptiveModal
        isOpen={showForm}
        onClose={onClose}
        historyId="note-stepped-form"
        onExitComplete={handleExitComplete}
        drawerMaxWidth="448px"
        drawerHeight="90vh"
      >
        {({ isMediumScreen }) => (
          <div
            data-note-stepped-form-modal="true"
            className={`flex h-full flex-col overflow-hidden px-6 ${isMediumScreen ? 'pt-4' : 'pt-2'}`}
          >
            {/* 顶部导航栏 */}
            <div className="mb-6 flex shrink-0 items-center justify-between">
              <button
                type="button"
                onClick={handleBack}
                className="-m-3 cursor-pointer rounded-full p-3"
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
              className={`min-h-0 flex-1 pb-4 ${isCoffeeBeanStep ? 'overflow-hidden' : 'overflow-y-auto'}`}
            >
              {currentStepContent && (
                <div className="flex h-full flex-col">
                  {contentWithSearchProps}
                </div>
              )}
            </div>

            {/* 底部按钮区域 */}
            <div className="flex items-center justify-center gap-2 pt-3">
              {/* 搜索输入框 */}
              {isValid && isSearchableStep && isSearching && (
                <div className="flex min-w-0 items-center gap-2">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={
                      isMethodStep
                        ? '搜索或新建方案'
                        : COFFEE_BEAN_SEARCH_OR_CREATE_PLACEHOLDER
                    }
                    aria-label={
                      isMethodStep ? '搜索或新建方案' : '搜索或新建咖啡豆'
                    }
                    className="w-48 min-w-0 rounded-full border-none bg-neutral-100 px-5 py-[14px] text-sm font-medium text-neutral-800 placeholder-neutral-400 outline-hidden dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500"
                    autoComplete="off"
                    onKeyDown={e => e.key === 'Escape' && handleCloseSearch()}
                  />
                  <button
                    type="button"
                    onClick={handleCloseSearch}
                    aria-label="关闭搜索"
                    className={`${buttonBaseClass} shrink-0 p-4`}
                  >
                    <X className="h-4 w-4" strokeWidth="3" />
                  </button>
                </div>
              )}

              {/* 下一步/完成按钮 */}
              {isValid && !(isSearchableStep && isSearching) && (
                <button
                  type="button"
                  onClick={isSearchableStep ? handleSearchClick : handleNext}
                  className={`${buttonBaseClass} flex items-center justify-center ${isLastStep && !isCoffeeBeanStep ? 'px-6 py-3' : 'px-5 py-3'}`}
                >
                  {isLastStep && !isCoffeeBeanStep ? (
                    <span className="font-medium">保存笔记</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {isSearchableStep ? '搜索与新建' : '下一步'}
                      </span>
                      {isSearchableStep ? (
                        <Search className="h-4 w-4" strokeWidth="3" />
                      ) : (
                        <ArrowRight className="h-4 w-4" strokeWidth="3" />
                      )}
                    </div>
                  )}
                </button>
              )}

              {isValid && isMethodStep && !isSearching && (
                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="下一步"
                  className={`${buttonBaseClass} flex shrink-0 items-center justify-center p-4`}
                >
                  <ArrowRight className="h-4 w-4" strokeWidth="3" />
                </button>
              )}

              {/* 随机选择按钮 */}
              {isValid && isCoffeeBeanStep && !isSearching && (
                <button
                  type="button"
                  {...randomBeanPressHandlers}
                  className={`${buttonBaseClass} flex items-center justify-center p-4`}
                >
                  <Shuffle className="h-4 w-4" strokeWidth="3" />
                </button>
              )}
            </div>
          </div>
        )}
      </AdaptiveModal>
    );
  }
);

NoteSteppedFormModal.displayName = 'NoteSteppedFormModal';

export default NoteSteppedFormModal;
