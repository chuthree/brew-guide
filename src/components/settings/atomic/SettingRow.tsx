import React from 'react';

interface SettingRowProps {
  label?: string; // 改为可选
  description?: string;
  children: React.ReactNode;
  isLast?: boolean;
  className?: string;
  vertical?: boolean; // 是否垂直布局（用于复杂控件）
}

/**
 * 设置行组件 - 统一的设置项样式
 * 与 SettingItem 保持一致的设计语言
 * 分割线从文字开始位置到右边缘
 */
const SettingRow: React.FC<SettingRowProps> = ({
  label,
  description,
  children,
  isLast = false,
  className = '',
  vertical = false,
}) => {
  if (vertical) {
    return (
      <div className={`flex w-full flex-col ${className}`}>
        <div
          className={`flex flex-col p-3.5 ${
            !isLast ? 'border-b border-black/5 dark:border-white/5' : ''
          }`}
        >
          {label && (
            <div className="mb-3">
              <span className="text-sm leading-none font-medium text-neutral-800 dark:text-neutral-200">
                {label}
              </span>
              {description && (
                <span className="mt-1.5 block text-xs text-neutral-500 dark:text-neutral-400">
                  {description}
                </span>
              )}
            </div>
          )}
          <div className="w-full">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex w-full items-stretch px-4 text-sm font-medium ${className}`}
    >
      <div
        className={`flex min-w-0 flex-1 items-center justify-between py-3.5 ${
          !isLast ? 'border-b border-black/5 dark:border-white/5' : ''
        }`}
      >
        {label && (
          <div className="mr-4 flex min-w-0 flex-1 flex-col">
            <span className="truncate leading-none text-neutral-800 dark:text-neutral-200">
              {label}
            </span>
            {description && (
              <span className="mt-1.5 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                {description}
              </span>
            )}
          </div>
        )}
        <div className="flex shrink-0 items-center">{children}</div>
      </div>
    </div>
  );
};

export default SettingRow;
