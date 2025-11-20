'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { ExtendedCoffeeBean } from './types';
import CoffeeBeanForm from './index';
import { useThemeColor } from '@/lib/hooks/useThemeColor';

interface CoffeeBeanFormModalProps {
  showForm: boolean;
  initialBean?: ExtendedCoffeeBean | null;
  onSave: (bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>) => void;
  onClose: () => void;
  onRepurchase?: () => void;
}

const CoffeeBeanFormModal: React.FC<CoffeeBeanFormModalProps> = ({
  showForm,
  initialBean,
  onSave,
  onClose,
  onRepurchase,
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
  const formRef = useRef<{ handleBackStep: () => boolean } | null>(null);

  // 处理显示/隐藏动画
  useEffect(() => {
    if (showForm) {
      setShouldRender(true);
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      // 不立即卸载 shouldRender，等动画完成后再卸载
      const timer = setTimeout(() => setShouldRender(false), 400);
      return () => clearTimeout(timer);
    }
  }, [showForm]);

  // 历史栈管理 - 支持硬件返回键和浏览器返回按钮
  useEffect(() => {
    if (!showForm) return;

    // 添加表单的历史记录
    window.history.pushState({ modal: 'bean-form' }, '');

    // 监听返回事件
    const handlePopState = () => {
      // 询问表单是否还有上一步
      if (formRef.current?.handleBackStep()) {
        // 表单内部处理了返回（返回上一步），重新添加历史记录
        window.history.pushState({ modal: 'bean-form' }, '');
      } else {
        // 表单已经在第一步，关闭模态框
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showForm, onClose]);

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
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-[400ms] ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* 抽屉内容 */}
      <div
        ref={modalRef}
        className={`fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85vh] max-w-[500px] overflow-auto rounded-t-2xl bg-neutral-50 shadow-xl transition-transform duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)] dark:bg-neutral-900 ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="pb-safe-bottom modal-form-container max-h-[calc(85vh-40px)] overflow-auto px-6">
          <CoffeeBeanForm
            key={`bean-form-${initialBean?.id || 'new'}`}
            ref={formRef}
            onSave={onSave}
            onCancel={onClose}
            initialBean={initialBean || undefined}
            onRepurchase={onRepurchase}
          />
        </div>
      </div>
    </>
  );
};

export default CoffeeBeanFormModal;
