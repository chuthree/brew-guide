'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

/**
 * 键盘管理器组件
 * 负责添加平台类名和处理输入框聚焦
 */
const KeyboardManager: React.FC = () => {
  useEffect(() => {
    // 仅在原生平台上处理键盘事件
    if (!Capacitor.isNativePlatform()) return;

    // 设置平台相关的类名
    const platform = Capacitor.getPlatform();
    if (platform === 'android') {
      document.documentElement.classList.add('android-device');
    } else if (platform === 'ios') {
      document.documentElement.classList.add('ios-device');
    }

    // 确保键盘不会禁用页面滚动
    Keyboard.setScroll({ isDisabled: false });

    // 监听输入框聚焦事件
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (isInputElement(target)) {
        // 延迟执行，等待键盘完全打开
        setTimeout(() => {
          scrollToFocusedInput(target);
        }, 300);
      }
    };

    // 监听键盘显示事件
    const handleKeyboardDidShow = () => {
      const activeElement = document.activeElement as HTMLElement;
      if (isInputElement(activeElement)) {
        scrollToFocusedInput(activeElement);
      }
    };

    // 确定元素是否为输入框
    const isInputElement = (element: HTMLElement) => {
      return (
        element &&
        (element.tagName === 'INPUT' ||
          element.tagName === 'TEXTAREA' ||
          element.tagName === 'SELECT' ||
          element.isContentEditable)
      );
    };

    // 滚动到聚焦的输入框
    const scrollToFocusedInput = (inputElement: HTMLElement) => {
      // 查找包含该输入框的表单或可滚动容器
      const modal = inputElement.closest(
        '.modal-form-container, .max-h-\\[85vh\\]'
      );
      const form = inputElement.closest('form');
      const scrollContainer = inputElement.closest(
        '.overflow-auto, .overflow-y-auto'
      );

      // 判断是否在模态框中
      const isInModal = !!modal;

      // 滚动到输入框
      if (isInModal) {
        // 模态框中的特殊处理
        inputElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      } else if (form) {
        // 表单中的处理
        inputElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      } else if (scrollContainer) {
        // 一般滚动容器中的处理
        inputElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    };

    // 添加事件监听
    document.addEventListener('focusin', handleFocusIn);
    window.addEventListener('keyboardDidShow', handleKeyboardDidShow);

    // 清理事件监听
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('keyboardDidShow', handleKeyboardDidShow);
    };
  }, []);

  // 这个组件不渲染任何UI
  return null;
};

export default KeyboardManager;
