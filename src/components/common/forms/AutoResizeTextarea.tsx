'use client'

import React, { useRef, useEffect } from 'react';

// 自适应文本区域组件
interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    value: string;
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    className?: string;
    placeholder?: string;
    readOnly?: boolean;
    style?: React.CSSProperties;
    minRows?: number;
    maxRows?: number;
}

const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({
    value,
    onChange,
    className = "",
    placeholder,
    readOnly,
    style,
    minRows = 1,
    maxRows = 10,
    ...props
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // 自动调整高度的函数
    const adjustHeight = () => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        // 重置高度以获取正确的scrollHeight
        textarea.style.height = 'auto';

        // 计算行高
        const computedStyle = window.getComputedStyle(textarea);
        const lineHeight = parseInt(computedStyle.lineHeight) || 20;

        // 计算最小和最大高度
        const minHeight = lineHeight * minRows;
        const maxHeight = lineHeight * maxRows;

        // 获取内容高度
        const scrollHeight = textarea.scrollHeight;

        // 设置新高度，限制在最小和最大值之间
        const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
        textarea.style.height = `${newHeight}px`;

        // 如果内容超过最大高度，显示滚动条
        if (scrollHeight > maxHeight) {
            textarea.style.overflowY = 'auto';
        } else {
            textarea.style.overflowY = 'hidden';
        }
    };

    // 当value变化时调整高度
    useEffect(() => {
        adjustHeight();
    }, [value, minRows, maxRows]);

    // 处理输入变化
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (onChange) {
            onChange(e);
        }
        // 延迟调整高度，确保value已更新
        setTimeout(adjustHeight, 0);
    };

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            className={`w-full resize-none rounded-none bg-transparent outline-hidden transition-colors ${className}`}
            placeholder={placeholder}
            readOnly={readOnly}
            style={{
                overflowX: 'hidden',
                ...style
            }}
            {...props}
        />
    );
};

export default AutoResizeTextarea;