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
  // 添加平台检测
  const [isIOS, setIsIOS] = useState(false);

  // 同步顶部安全区颜色
  useThemeColor({ useOverlay: true, enabled: showForm });

  // 添加对模态框的引用
  const modalRef = useRef<HTMLDivElement>(null);

  // 表单引用，用于调用表单的返回方法
  const formRef = useRef<{ handleBackStep: () => boolean } | null>(null);

  // 历史栈管理 - 支持硬件返回键和浏览器返回按钮
  useEffect(() => {
    if (!showForm) return;

    // 如果历史栈中有 bean-detail 记录，用 replaceState 替换它
    // 注意：侧滑时可能仍会短暂看到详情页，这是浏览器机制限制
    if (window.history.state?.modal === 'bean-detail') {
      window.history.replaceState({ modal: 'bean-form' }, '');
    } else {
      // 添加表单的历史记录
      window.history.pushState({ modal: 'bean-form' }, '');
    }

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
    if (!showForm) return;

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
  }, [showForm, isIOS]);

  // 处理关闭
  const handleClose = () => {
    // 如果历史栈中有我们添加的条目，触发返回
    if (window.history.state?.modal === 'bean-form') {
      window.history.back();
    } else {
      // 否则直接关闭
      onClose();
    }
  };

  return (
    <div
      className={`fixed inset-0 transition-all duration-300 ${
        showForm
          ? 'pointer-events-auto bg-black/50 opacity-100'
          : 'pointer-events-none opacity-0'
      } `}
    >
      <div
        ref={modalRef}
        className={`absolute inset-x-0 bottom-0 mx-auto max-h-[85vh] max-w-[500px] overflow-auto rounded-t-2xl bg-neutral-50 shadow-xl transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] dark:bg-neutral-900 ${showForm ? 'translate-y-0' : 'translate-y-full'} `}
      >
        <div className="pb-safe-bottom modal-form-container max-h-[calc(85vh-40px)] overflow-auto px-6">
          {showForm && (
            <CoffeeBeanForm
              key={`bean-form-${initialBean?.id || 'new'}-${Date.now()}`}
              ref={formRef}
              onSave={onSave}
              onCancel={handleClose}
              initialBean={initialBean || undefined}
              onRepurchase={onRepurchase}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CoffeeBeanFormModal;
