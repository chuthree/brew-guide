import React from 'react';

interface SettingInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password' | 'email' | 'number';
  className?: string;
  disabled?: boolean;
}

/**
 * 设置输入框组件
 * 统一的输入框样式，用于 settings 页面
 */
const SettingInput: React.FC<SettingInputProps> = ({
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
  disabled = false,
}) => {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full rounded-lg bg-neutral-100 px-3 py-2 text-right text-sm outline-none transition-colors placeholder:text-neutral-400 focus:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:focus:bg-neutral-700 ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      } ${className}`}
    />
  );
};

export default SettingInput;
