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
        
        // 对 brewing-form应用特殊处理
        const brewingHistoryComponent = document.getElementById('brewing-history-component');
        if (brewingHistoryComponent) {
          brewingHistoryComponent.style.paddingBottom = `${info.keyboardHeight + 80}px`;
        }
        
        // 防止嵌套滚动问题
        preventNestedScrolling();
        
        // 使用 CSS 设置全局样式 - 移除可能导致文字放大的设置
        keyboardStyle.innerHTML = `
          
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
            margin-bottom: ${info.keyboardHeight + 40}px;
          }
          
          /* 设置键盘空间调整器高度 */
          .keyboard-spacer {
            height: ${info.keyboardHeight + 40}px !important;
          }
          
          /* 设置可调整内容的底部内边距 */
          .keyboard-adjustable-content {
            padding-bottom: ${info.keyboardHeight + 40}px !important;
          }
          
          /* 处理拟态框内的表单 */
          .fixed.inset-0.z-50 {
            padding-bottom: 0 !important;
          }
          
          /* 处理拟态框内的滚动容器 */
          .max-h-\\[85vh\\].overflow-auto {
            max-height: calc(85vh - ${info.keyboardHeight}px) !important;
            transform: translateY(-${info.keyboardHeight * 0.6}px);
            transition: transform 0.3s ease;
          }
          
          /* 处理拟态框内的表单内容容器 */
          .max-h-\\[calc\\(85vh-40px\\)\\] {
            max-height: calc(85vh - ${info.keyboardHeight}px - 40px) !important;
            padding-bottom: ${info.keyboardHeight + 20}px !important;
          }
          
          /* 确保拟态框中的输入区域可见 */
          .max-h-\\[85vh\\] .overflow-auto:has(input:focus),
          .max-h-\\[85vh\\] .overflow-auto:has(textarea:focus),
          .max-h-\\[85vh\\] .overflow-auto:has(select:focus) {
            padding-bottom: ${info.keyboardHeight + 40}px !important;
          }
          
          /* 处理模态框底部按钮 */
          .modal-bottom-button {
            position: fixed !important;
            bottom: ${info.keyboardHeight + 16}px !important;
            left: 0;
            right: 0;
            z-index: 60;
            background: var(--background, #fafafa);
            padding: 8px 16px;
            margin: 0 !important;
            box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.05);
          }
          
          /* 对于传统使用 sticky bottom-4 的组件保持兼容 */
          .keyboard-is-open .sticky.bottom-4:not(.modal-bottom-button) {
            position: fixed !important;
            bottom: ${info.keyboardHeight + 16}px !important;
            left: 0;
            right: 0;
            z-index: 60;
            margin: 0 !important;
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
            // 确保输入元素可见，但不要将其滚动到中央位置，而是仅确保在视口中
            (activeElement as HTMLElement).scrollIntoView({ 
              behavior: 'smooth',
              block: 'nearest'
            });
            
            // 检查是否在拟态框内
            const isInModal = Boolean(activeElement.closest('.max-h-\\[85vh\\]'));
            if (isInModal) {
              // 为拟态框应用特殊处理
              const modalElement = activeElement.closest('.max-h-\\[85vh\\]');
              if (modalElement) {
                // 确保内容不会被推到视口外
                (modalElement as HTMLElement).scrollTop = 0;
                
                // 延迟再次滚动到聚焦元素
                setTimeout(() => {
                  (activeElement as HTMLElement).scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                  });
                }, 100);
              }
            }
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
        
        // 重置 brewing-form样式
        const brewingHistoryComponent = document.getElementById('brewing-history-component');
        if (brewingHistoryComponent) {
          brewingHistoryComponent.style.paddingBottom = '';
        }
        
        // 重置底部按钮样式
        const stickyButtons = document.querySelectorAll('.sticky.bottom-4, .modal-bottom-button');
        stickyButtons.forEach((button) => {
          (button as HTMLElement).style.position = '';
          (button as HTMLElement).style.bottom = '';
          (button as HTMLElement).style.left = '';
          (button as HTMLElement).style.right = '';
          (button as HTMLElement).style.zIndex = '';
          (button as HTMLElement).style.margin = '';
          (button as HTMLElement).style.boxShadow = '';
          (button as HTMLElement).style.background = '';
          (button as HTMLElement).style.padding = '';
        });
        
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