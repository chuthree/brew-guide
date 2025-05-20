'use client'

import React from 'react';

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
    return (
        <textarea
            value={value}
            onChange={onChange}
            className={`w-full resize-none rounded-none bg-transparent outline-hidden transition-colors ${className}`}
            placeholder={placeholder}
            readOnly={readOnly}
            rows={3}
            style={style}
            {...props}
        />
    );
};

export default AutoResizeTextarea; 