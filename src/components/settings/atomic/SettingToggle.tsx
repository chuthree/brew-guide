import React, { useState, useEffect } from 'react';

interface SettingToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * 设置开关组件 - iOS 风格的切换开关
 * 符合新设计语言的开关控件
 */
const SettingToggle: React.FC<SettingToggleProps> = ({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
}) => {
  // 使用内部状态实现即时响应（乐观更新）
  const [localChecked, setLocalChecked] = useState(checked);

  // 当外部 props 改变时，同步内部状态
  useEffect(() => {
    setLocalChecked(checked);
  }, [checked]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    // 立即更新内部状态，提供即时反馈
    setLocalChecked(newValue);

    // 使用 requestAnimationFrame 确保 UI 渲染优先于逻辑处理
    requestAnimationFrame(() => {
      onChange(newValue);
    });
  };

  return (
    <label className="setting-control relative inline-flex w-12 shrink-0 cursor-pointer items-center">
      <input
        type="checkbox"
        aria-label={ariaLabel}
        checked={localChecked}
        onChange={handleChange}
        disabled={disabled}
        className="peer sr-only"
      />
      <div className="absolute inset-0 rounded-full bg-neutral-200 transition-colors duration-200 peer-checked:bg-neutral-600 peer-focus-visible:ring-2 peer-focus-visible:ring-neutral-400 peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-7 after:rounded-full after:bg-white after:transition-transform after:duration-200 after:content-[''] peer-checked:after:translate-x-4 dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
    </label>
  );
};

export default SettingToggle;
