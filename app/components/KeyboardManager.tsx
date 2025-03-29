'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { Keyboard, type KeyboardInfo } from '@capacitor/keyboard'

export function KeyboardManager() {
  useEffect(() => {
    // 仅在原生应用环境中运行
    if (!Capacitor.isNativePlatform()) return

    // 获取平台信息
    const platform = Capacitor.getPlatform()
    
    // 存储监听器引用
    const subscriptions: Array<{ remove: () => void }> = []

    // 标记是否应用了键盘处理修复
    let isKeyboardHandlingApplied = false;

    // 添加全局样式元素
    const keyboardStyle = document.createElement('style');
    document.querySelector('head')?.appendChild(keyboardStyle);

    // 防止嵌套滚动问题的辅助函数
    const preventNestedScrolling = () => {
      // 寻找所有嵌套滚动容器
      const nestedScrollContainers = document.querySelectorAll('.overflow-y-auto .overflow-y-auto, .overflow-auto .overflow-auto');
      
      // 临时禁用内部滚动容器
      nestedScrollContainers.forEach((container) => {
        (container as HTMLElement).style.overflow = 'visible';
      });
      
      // 延迟后恢复 
      setTimeout(() => {
        nestedScrollContainers.forEach((container) => {
          (container as HTMLElement).style.overflow = '';
        });
      }, 500);
    };

    // 处理键盘将要显示事件
    const handleKeyboardWillShow = async (info: KeyboardInfo) => {
      // 更改：同时支持iOS和Android平台
      if (platform === 'ios' || platform === 'android') {
        // 设置键盘高度变量
        document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
        
        // 标记键盘已打开
        document.body.classList.add('keyboard-is-open');
        
        // 对 brewing-history-component 应用特殊处理
        const brewingHistoryComponent = document.getElementById('brewing-history-component');
        if (brewingHistoryComponent) {
          brewingHistoryComponent.style.paddingBottom = `${info.keyboardHeight + 150}px`;
        }
        
        // 防止嵌套滚动问题
        preventNestedScrolling();
        
        // 使用 CSS 设置全局样式 - 移除可能导致文字放大的设置
        keyboardStyle.innerHTML = `
          .brewing-note-form {
            padding-bottom: ${info.keyboardHeight + 100}px !important;
          }
          
          /* 禁用所有嵌套容器的滚动 */
          .overflow-y-auto .overflow-y-auto,
          .overflow-auto .overflow-auto {
            overflow: visible !important;
          }
          
          /* 让顶层容器处理滚动 */
          body.keyboard-is-open {
            padding-bottom: ${info.keyboardHeight}px;
          }
          
          /* 在表单上添加足够的空间 */
          form {
            margin-bottom: ${info.keyboardHeight}px;
          }
          
          /* 设置键盘空间调整器高度 */
          .keyboard-spacer {
            height: ${info.keyboardHeight + 120}px !important;
          }
          
          /* 设置可调整内容的底部内边距 */
          .keyboard-adjustable-content {
            padding-bottom: ${info.keyboardHeight + 100}px !important;
          }
        `;
        
        // 处理当前聚焦的输入元素
        const activeElement = document.activeElement;
        if (activeElement && (
          activeElement.tagName === 'INPUT' || 
          activeElement.tagName === 'TEXTAREA' || 
          activeElement.getAttribute('contenteditable') === 'true'
        )) {
          // 等待UI更新
          setTimeout(() => {
            // 确保输入元素可见
            (activeElement as HTMLElement).scrollIntoView({ 
              behavior: 'smooth',
              block: 'center'
            });
          }, 150);
        }

        isKeyboardHandlingApplied = true;
      }
    };

    // 处理键盘将要隐藏事件
    const handleKeyboardWillHide = () => {
      // 更改：同时支持iOS和Android平台
      if ((platform === 'ios' || platform === 'android') && isKeyboardHandlingApplied) {
        // 移除键盘打开标记
        document.body.classList.remove('keyboard-is-open');
        
        // 重置键盘高度
        document.documentElement.style.setProperty('--keyboard-height', '0px');
        
        // 清除样式
        keyboardStyle.innerHTML = '';
        
        // 重置 brewing-history-component 样式
        const brewingHistoryComponent = document.getElementById('brewing-history-component');
        if (brewingHistoryComponent) {
          brewingHistoryComponent.style.paddingBottom = '';
        }
        
        // 重置标记
        isKeyboardHandlingApplied = false;
      }
    };

    // 类型转换辅助函数
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const asEventListener = (fn: any): EventListener => fn as EventListener;

    // 设置事件监听器
    const setupListeners = async () => {
      // 根据平台选择适当的事件
      if (platform === 'ios' || platform === 'android') {
        const keyboardWillShowListener = await Keyboard.addListener(
          'keyboardWillShow',
          handleKeyboardWillShow
        );
        
        const keyboardWillHideListener = await Keyboard.addListener(
          'keyboardWillHide',
          handleKeyboardWillHide
        );
        
        // 添加额外事件用于Android平台
        const keyboardDidShowListener = await Keyboard.addListener(
          'keyboardDidShow',
          handleKeyboardWillShow
        );
        
        const keyboardDidHideListener = await Keyboard.addListener(
          'keyboardDidHide',
          handleKeyboardWillHide
        );
        
        subscriptions.push(keyboardWillShowListener);
        subscriptions.push(keyboardWillHideListener);
        subscriptions.push(keyboardDidShowListener);
        subscriptions.push(keyboardDidHideListener);
        
        // 添加 window 级事件处理，提高兼容性
        window.addEventListener('keyboardWillShow', asEventListener(handleKeyboardWillShow));
        window.addEventListener('keyboardWillHide', asEventListener(handleKeyboardWillHide));
        window.addEventListener('keyboardDidShow', asEventListener(handleKeyboardWillShow));
        window.addEventListener('keyboardDidHide', asEventListener(handleKeyboardWillHide));
      }
    };

    setupListeners();

    // 处理点击隐藏键盘
    const handleDocumentClick = (event: MouseEvent) => {
      if (platform === 'ios' || platform === 'android') {
        const target = event.target as HTMLElement;
        const isInputElement = 
          target.tagName === 'INPUT' || 
          target.tagName === 'TEXTAREA' || 
          target.getAttribute('contenteditable') === 'true';
        
        // 检查目标元素不是输入相关元素
        if (!isInputElement && 
            !target.closest('input') && 
            !target.closest('textarea') && 
            !target.closest('[contenteditable="true"]') &&
            !target.closest('[role="combobox"]') &&
            !target.closest('select')) {
          Keyboard.hide();
        }
      }
    };
    
    document.addEventListener('click', handleDocumentClick);

    // 清理函数
    return () => {
      subscriptions.forEach(subscription => subscription.remove());
      document.removeEventListener('click', handleDocumentClick);
      
      // 移除所有事件监听器
      window.removeEventListener('keyboardWillShow', asEventListener(handleKeyboardWillShow));
      window.removeEventListener('keyboardWillHide', asEventListener(handleKeyboardWillHide));
      window.removeEventListener('keyboardDidShow', asEventListener(handleKeyboardWillShow));
      window.removeEventListener('keyboardDidHide', asEventListener(handleKeyboardWillHide));
      
      // 移除样式元素
      keyboardStyle.remove();
    };
  }, []);

  // 此组件不渲染任何UI元素
  return null;
} 