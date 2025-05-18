'use client'

import React, { useEffect, useRef } from 'react';

// 自适应文本区域组件
interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    value: string;
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    className?: string;
    placeholder?: string;
    readOnly?: boolean;
    style?: React.CSSProperties;
}

const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({
    value,
    onChange,
    className = "",
    placeholder,
    readOnly,
    style,
    ...props
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!textareaRef.current) return;

        const resizeTextarea = () => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            // 临时设置高度为 auto，以便scrollHeight能够正确计算
            textarea.style.height = 'auto';
            // 设置高度为scrollHeight
            textarea.style.height = `${textarea.scrollHeight}px`;
        };

        // 初始化高度
        resizeTextarea();

        // 添加窗口调整大小的事件监听器
        window.addEventListener('resize', resizeTextarea);
        
        // 监听键盘事件
        const handleKeyboardEvent = () => {
            // 重新调整大小
            setTimeout(resizeTextarea, 100);
        };
        
        // 添加键盘显示/隐藏相关事件
        window.addEventListener('keyboardWillShow', handleKeyboardEvent);
        window.addEventListener('keyboardDidShow', handleKeyboardEvent);
        window.addEventListener('keyboardWillHide', handleKeyboardEvent);
        window.addEventListener('keyboardDidHide', handleKeyboardEvent);

        // 清理函数
        return () => {
            window.removeEventListener('resize', resizeTextarea);
            window.removeEventListener('keyboardWillShow', handleKeyboardEvent);
            window.removeEventListener('keyboardDidShow', handleKeyboardEvent);
            window.removeEventListener('keyboardWillHide', handleKeyboardEvent);
            window.removeEventListener('keyboardDidHide', handleKeyboardEvent);
        };
    }, [value]);

    // 处理聚焦事件 - 确保输入框在键盘弹出时不会被顶到屏幕外
    const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
        // 设置一个短暂的延迟，等待键盘弹出
        setTimeout(() => {
            if (textareaRef.current) {
                // 检查是否在拟态框内
                const isInModal = Boolean(textareaRef.current.closest('.max-h-\\[85vh\\]'));
                
                if (isInModal) {
                    // 对拟态框内的文本区域使用不同的滚动策略
                    const modalContainer = textareaRef.current.closest('.max-h-\\[85vh\\]');
                    const formContainer = textareaRef.current.closest('.modal-form-container');
                    
                    if (modalContainer) {
                        // 首先滚动到顶部，避免容器被推到顶部太远
                        (modalContainer as HTMLElement).scrollTop = 0;
                        
                        // 保留内边距调整，但不执行滚动
                        setTimeout(() => {
                            // 如果有表单容器，确保它有足够的内边距
                            if (formContainer) {
                                const keyboardHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--keyboard-height') || '0');
                                if (keyboardHeight > 0) {
                                    (formContainer as HTMLElement).style.paddingBottom = `${keyboardHeight * 0.5 + 60}px`;
                                }
                            }
                        }, 100);
                    }
                } else {
                    // 对普通页面内的文本区域，移除默认滚动行为
                    // textareaRef.current.scrollIntoView({
                    //     behavior: 'smooth',
                    //     block: 'nearest',
                    // });
                    
                    // 不执行任何滚动操作，让系统自然处理
                }
            }
        }, 300);
        
        // 调用原始的onFocus处理程序（如果有）
        if (props.onFocus) {
            props.onFocus(e);
        }
    };

    // 处理失焦事件 - 恢复容器内边距
    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
        // 检查是否在拟态框内
        const isInModal = Boolean(textareaRef.current?.closest('.max-h-\\[85vh\\]'));
        
        if (isInModal) {
            // 恢复表单容器的内边距
            const formContainer = textareaRef.current?.closest('.modal-form-container');
            if (formContainer) {
                // 延迟恢复内边距，以便在键盘收起后执行
                setTimeout(() => {
                    (formContainer as HTMLElement).style.paddingBottom = '';
                }, 300);
            }
        }
        
        // 调用原始的onBlur处理程序（如果有）
        if (props.onBlur) {
            props.onBlur(e);
        }
    };

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            className={`w-full resize-none rounded-none bg-transparent outline-hidden transition-colors overflow-hidden ${className}`}
            placeholder={placeholder}
            readOnly={readOnly}
            rows={1}
            style={style}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
        />
    );
};

export default AutoResizeTextarea; 