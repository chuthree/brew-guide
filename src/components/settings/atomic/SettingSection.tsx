import React from 'react';

interface SettingSectionProps {
  title?: string | React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * 设置分组区域组件 - 统一的设置分组样式
 * 包含标题和内容区域，符合 iOS 设计规范
 */
const SettingSection: React.FC<SettingSectionProps> = ({
  title,
  children,
  className = '',
}) => {
  return (
    <div className={`px-6 pb-5 ${className}`}>
      {title && (
        <div className="mb-3">
          {typeof title === 'string' ? (
            <h3 className="text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
              {title}
            </h3>
          ) : (
            title
          )}
        </div>
      )}
      <div className="overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800/40">
        {children}
      </div>
    </div>
  );
};

export default SettingSection;
