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
    const isNative = Capacitor.isNativePlatform();
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    // 设置平台相关的类名
    if (isNative) {
      const platform = Capacitor.getPlatform();
      if (platform === 'android') {
        document.documentElement.classList.add('android-device');
      } else if (platform === 'ios') {
        document.documentElement.classList.add('ios-device');
      }

      // 确保键盘不会禁用页面滚动
      Keyboard.setScroll({ isDisabled: false });
    } else if (isIOS) {
      // 网页版 iOS 也添加类名
      document.documentElement.classList.add('ios-web');
    }

    // 监听输入框聚焦事件
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (isInputElement(target)) {
        // 原生平台立即滚动，网页版等待键盘弹出
        if (isNative) {
          setTimeout(() => {
            scrollToFocusedInput(target);
          }, 300);
        }
      }
    };

    // iOS 网页版：监听 visualViewport resize 事件（键盘弹出时触发）
    const handleViewportResize = () => {
      const activeElement = document.activeElement as HTMLElement;
      if (isInputElement(activeElement)) {
        // 键盘完全弹出后滚动一次即可
        setTimeout(() => scrollToFocusedInput(activeElement), 100);
      }
    };

    // 监听键盘显示事件（原生平台）
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
      if (!inputElement) return;

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

      // iOS 网页版特殊处理：使用 window.scrollTo
      if (isIOS && !isNative) {
        // 触发重排，让浏览器重新计算布局
        void inputElement.offsetHeight;

        // 使用 window.scrollTo 确保页面滚动
        const rect = inputElement.getBoundingClientRect();
        const scrollTop =
          window.pageYOffset || document.documentElement.scrollTop;
        const targetY = rect.top + scrollTop - window.innerHeight / 3;

        window.scrollTo({
          top: Math.max(0, targetY),
          behavior: 'smooth',
        });
        return; // iOS 网页版只用 window.scrollTo，不再执行下面的 scrollIntoView
      }

      // 原生平台和其他浏览器使用 scrollIntoView
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
      } else {
        // 默认处理
        inputElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    };

    // 添加事件监听
    document.addEventListener('focusin', handleFocusIn);

    if (isNative) {
      window.addEventListener('keyboardDidShow', handleKeyboardDidShow);
    }

    // iOS 网页版：监听 visualViewport（这是关键！）
    if (isIOS && !isNative && window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
    }

    // 清理事件监听
    return () => {
      document.removeEventListener('focusin', handleFocusIn);

      if (isNative) {
        window.removeEventListener('keyboardDidShow', handleKeyboardDidShow);
      }

      if (isIOS && !isNative && window.visualViewport) {
        window.visualViewport.removeEventListener(
          'resize',
          handleViewportResize
        );
      }
    };
  }, []);

  // 这个组件不渲染任何UI
  return null;
};

export default KeyboardManager;
