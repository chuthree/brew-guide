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
        
        // 清理函数
        return () => {
            window.removeEventListener('resize', resizeTextarea);
        };
    }, [value]);

    // 简化的聚焦事件处理
    const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
        // 调用原始的onFocus处理程序（如果有）
        if (props.onFocus) {
            props.onFocus(e);
        }
    };

    // 简化的失焦事件处理
    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
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