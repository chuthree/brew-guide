import React from 'react';

interface SettingPillInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  suffix?: string;
  minChars?: number;
}

/**
 * 胶囊输入框组件
 * 用于在设置行右侧展示紧凑的数值输入控件
 */
const SettingPillInput: React.FC<SettingPillInputProps> = ({
  value,
  onChange,
  onBlur,
  onKeyDown,
  placeholder,
  inputMode = 'text',
  suffix,
  minChars = 2,
}) => {
  const inputSize = Math.max(value.length, minChars);

  return (
    <div className="relative inline-flex h-0 items-center">
      <div className="absolute top-1/2 right-0 flex h-6 -translate-y-1/2 items-center rounded-full bg-neutral-200/60 px-3 dark:bg-neutral-700/60">
        <input
          type="text"
          inputMode={inputMode}
          size={inputSize}
          value={value}
          onChange={event => onChange(event.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-auto min-w-[2ch] bg-transparent text-right text-sm text-neutral-800 placeholder:text-neutral-500 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-400"
        />
        {suffix && (
          <span className="ml-1 shrink-0 text-sm text-neutral-500 dark:text-neutral-300">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
};

export default SettingPillInput;
