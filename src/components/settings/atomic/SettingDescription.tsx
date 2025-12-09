import React from 'react';

interface SettingDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * 设置描述文字组件 - 统一的辅助说明文字样式
 * 用于在设置分组下方显示说明文字
 */
const SettingDescription: React.FC<SettingDescriptionProps> = ({
  children,
  className = '',
}) => {
  return (
    <p
      className={`-mt-2 px-6 pb-4 text-xs text-neutral-500 dark:text-neutral-400 ${className}`}
    >
      {children}
    </p>
  );
};

export default SettingDescription;
