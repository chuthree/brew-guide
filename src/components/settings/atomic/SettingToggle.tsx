import React from 'react';

interface SettingToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/**
 * 设置开关组件 - iOS 风格的切换开关
 * 符合新设计语言的开关控件
 */
const SettingToggle: React.FC<SettingToggleProps> = ({
  checked,
  onChange,
  disabled = false,
}) => {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        disabled={disabled}
        className="peer sr-only"
      />
      <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
    </label>
  );
};

export default SettingToggle;
