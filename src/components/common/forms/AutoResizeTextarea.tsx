'use client';

import React from 'react';
import { cn } from '@/lib/utils/classNameUtils';

interface AutoResizeTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
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
  className = '',
  placeholder,
  readOnly,
  style,
  minRows = 1,
  maxRows = 10,
  ...props
}) => {
  // 根据内容行数计算实际行数，但不超过 maxRows
  const contentRows = value
    ? Math.min(value.split('\n').length, maxRows)
    : minRows;
  const rows = Math.max(contentRows, minRows);

  return (
    <textarea
      value={value}
      onChange={onChange}
      className={cn(
        'w-full resize-none rounded-none bg-transparent outline-hidden transition-colors',
        className
      )}
      placeholder={placeholder}
      readOnly={readOnly}
      rows={rows}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      style={{
        ...style,
      }}
      {...props}
    />
  );
};

export default AutoResizeTextarea;
