'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { ExtendedCoffeeBean } from './types';
import CoffeeBeanForm from './index';
import { useThemeColor } from '@/lib/hooks/useThemeColor';
import {
  useMultiStepModalHistory,
  modalHistory,
} from '@/lib/hooks/useModalHistory';

interface CoffeeBeanFormModalProps {
  showForm: boolean;
  initialBean?: ExtendedCoffeeBean | null;
  onSave: (bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>) => void;
  onClose: () => void;
  onRepurchase?: () => void;
  initialBeanState?: 'green' | 'roasted';
  /** 识别时使用的原始图片 base64（用于在表单中显示） */
  recognitionImage?: string | null;
}

const CoffeeBeanFormModal: React.FC<CoffeeBeanFormModalProps> = ({
  showForm,
  initialBean,
  onSave,
  onClose,
  onRepurchase,
  initialBeanState,
  recognitionImage,
}) => {
  // 动画状态管理
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // 添加平台检测
  const [isIOS, setIsIOS] = useState(false);

  // 同步顶部安全区颜色
  useThemeColor({ useOverlay: true, enabled: showForm });

  // 添加对模态框的引用
  const modalRef = useRef<HTMLDivElement>(null);

  // 表单引用，用于调用表单的返回方法
  const formRef = useRef<{
    handleBackStep: () => boolean;
    goToStep: (step: number) => void;
    getCurrentStep: () => number;
  } | null>(null);

  // 当前步骤状态 - 用于历史栈管理
  const [currentStep, setCurrentStep] = useState(1);

  // 处理显示/隐藏动画
  useEffect(() => {
    if (showForm) {
      setShouldRender(true);
      setCurrentStep(1); // 重置步骤
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      // 不立即卸载 shouldRender，等动画完成后再卸载
      const timer = setTimeout(() => setShouldRender(false), 400);
      return () => clearTimeout(timer);
    }
  }, [showForm]);

  // 使用多步骤历史栈管理
  useMultiStepModalHistory({
    id: 'bean-form',
    isOpen: showForm,
    step: currentStep,
    onStepChange: step => {
      setCurrentStep(step);
      // 同步表单内部步骤
      formRef.current?.goToStep(step);
    },
    onClose,
  });

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

      // 确定是否为输入元素
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        // 对于iOS，需要特殊处理
        if (isIOS) {
          // 延迟一点以确保键盘完全弹出
          setTimeout(() => {
            target.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
          }, 300);
        }
      }
    };

    // 只在模态框内监听聚焦事件
    modalElement.addEventListener('focusin', handleInputFocus);

    return () => {
      modalElement.removeEventListener('focusin', handleInputFocus);
    };
  }, [shouldRender, isIOS]);

  if (!shouldRender) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-400 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* 抽屉内容 */}
      <div
        ref={modalRef}
        className={`fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[85vh] max-w-md flex-col overflow-hidden rounded-t-2xl bg-neutral-50 shadow-xl transition-transform duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)] dark:bg-neutral-900 ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="modal-form-container pb-safe-bottom flex h-full flex-col px-6">
          <CoffeeBeanForm
            key={`bean-form-${initialBean?.id || 'new'}-${initialBean?.name || ''}-${initialBeanState || 'roasted'}`}
            ref={formRef}
            onSave={onSave}
            onCancel={onClose}
            initialBean={initialBean || undefined}
            onRepurchase={onRepurchase}
            onStepChange={setCurrentStep}
            initialBeanState={initialBeanState}
            recognitionImage={recognitionImage}
          />
        </div>
      </div>
    </>
  );
};

export default CoffeeBeanFormModal;
