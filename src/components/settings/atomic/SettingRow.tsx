import React from 'react';
import { makeSettingRowSearchId } from '../settingsSearch';
import { useSettingSearchHighlight } from './SettingSearchHighlightContext';

interface SettingRowProps {
  label?: string; // 改为可选
  description?: string;
  children: React.ReactNode;
  isLast?: boolean;
  className?: string;
  vertical?: boolean; // 是否垂直布局（用于复杂控件）
  isSubSetting?: boolean; // 是否为子设置项（显示半透明横杆前缀）
  settingId?: string;
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
  isSubSetting = false,
  settingId,
}) => {
  const { highlightedSettingId } = useSettingSearchHighlight();
  const resolvedSettingId =
    settingId || (label ? makeSettingRowSearchId(label) : null);
  const isHighlighted =
    !!resolvedSettingId && highlightedSettingId === resolvedSettingId;
  const rowRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!isHighlighted) return;

    window.setTimeout(() => {
      rowRef.current?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
    }, 120);
  }, [isHighlighted]);

  if (vertical) {
    return (
      <div
        ref={rowRef}
        data-settings-search-id={resolvedSettingId || undefined}
        className={`flex w-full flex-col transition-colors duration-200 ${
          isHighlighted ? 'bg-neutral-200/70 dark:bg-neutral-700/45' : ''
        } ${className}`}
      >
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
                <span className="mt-1.5 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                  {description}
                </span>
              )}
            </div>
          )}
          <div className="w-full leading-none">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rowRef}
      data-settings-search-id={resolvedSettingId || undefined}
      className={`flex w-full items-stretch px-3.5 transition-colors duration-200 ${
        isHighlighted ? 'bg-neutral-200/70 dark:bg-neutral-700/45' : ''
      } ${className}`}
    >
      <div
        className={`flex min-w-0 flex-1 items-center justify-between py-3.5 ${
          !isLast ? 'border-b border-black/5 dark:border-white/5' : ''
        }`}
      >
        {label && (
          <div className="mr-4 flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm leading-none font-medium text-neutral-800 dark:text-neutral-200">
              {isSubSetting && (
                <span className="mr-1.5 inline-block text-neutral-500 opacity-50 dark:text-neutral-400">
                  —
                </span>
              )}
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
