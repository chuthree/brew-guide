import React from 'react';
import { makeSettingRowSearchId } from '../settingsSearch';
import { useSettingSearchHighlight } from './SettingSearchHighlightContext';

interface SettingRowProps {
  label?: string; // 改为可选
  labelSuffix?: React.ReactNode;
  required?: boolean;
  description?: string;
  error?: string;
  errorId?: string;
  children: React.ReactNode;
  isLast?: boolean;
  className?: string;
  vertical?: boolean; // 是否垂直布局（用于复杂控件）
  isSubSetting?: boolean; // 是否为子设置项（显示半透明横杆前缀）
  expandControl?: boolean; // 让控件使用标签右侧的剩余空间
  disabled?: boolean;
  settingId?: string;
  onClick?: () => void;
}

/**
 * 设置行组件 - 统一的设置项样式
 * 与 SettingItem 保持一致的设计语言
 * 分割线从文字开始位置到右边缘
 */
const SettingRow: React.FC<SettingRowProps> = ({
  label,
  labelSuffix,
  required = false,
  description,
  error,
  errorId,
  children,
  isLast = false,
  className = '',
  vertical = false,
  isSubSetting = false,
  expandControl = false,
  disabled = false,
  settingId,
  onClick,
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
        data-setting-row=""
        data-settings-search-id={resolvedSettingId || undefined}
        className={`flex w-full flex-col px-3.5 transition-colors duration-200 ${
          isHighlighted ? 'bg-neutral-200/70 dark:bg-neutral-700/45' : ''
        } ${className}`}
      >
        <div
          className={`setting-row-body flex min-w-0 flex-col ${
            !isLast ? 'setting-divider' : ''
          }`}
        >
          {label && (
            <div className="mb-3">
              <span className="text-sm leading-5 font-medium wrap-anywhere text-neutral-800 dark:text-neutral-200">
                {label}
                {required && (
                  <sup
                    aria-hidden="true"
                    className="ml-0.5 text-xs text-red-500"
                  >
                    *
                  </sup>
                )}
              </span>
              {description && (
                <span className="mt-1.5 block text-xs font-normal wrap-anywhere text-neutral-500 dark:text-neutral-400">
                  {description}
                </span>
              )}
            </div>
          )}
          <div className="w-full min-w-0">{children}</div>
          {error && (
            <p
              id={errorId}
              role="alert"
              className="mt-2 text-xs wrap-anywhere text-red-600 dark:text-red-400"
            >
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  const RowContent = onClick ? 'button' : 'div';

  return (
    <div
      ref={rowRef}
      data-setting-row=""
      data-settings-search-id={resolvedSettingId || undefined}
      className={`flex w-full ${error ? 'flex-col' : 'items-stretch'} px-3.5 transition-colors duration-200 ${
        isHighlighted ? 'bg-neutral-200/70 dark:bg-neutral-700/45' : ''
      } ${className}`}
    >
      <RowContent
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        disabled={onClick ? disabled : undefined}
        className={`setting-row-body flex min-w-0 flex-1 items-center justify-between gap-4 text-left ${
          onClick
            ? 'cursor-pointer transition-opacity active:opacity-70 disabled:cursor-not-allowed disabled:opacity-40'
            : ''
        } ${!isLast && !error ? 'setting-divider' : ''}`}
      >
        {label && (
          <div
            className={`flex min-w-0 flex-col ${expandControl ? 'max-w-[50%] shrink-0' : 'flex-1'}`}
          >
            <span className="flex min-w-0 items-center text-sm leading-5 font-medium text-neutral-800 dark:text-neutral-200">
              {isSubSetting && (
                <span className="mr-1.5 inline-block text-neutral-500 opacity-50 dark:text-neutral-400">
                  —
                </span>
              )}
              <span className="min-w-0 wrap-anywhere">{label}</span>
              {required && (
                <sup
                  aria-hidden="true"
                  className="relative -top-0.5 ml-0.5 shrink-0 text-xs text-red-500"
                >
                  *
                </sup>
              )}
              {labelSuffix && <span className="shrink-0">{labelSuffix}</span>}
            </span>
            {description && (
              <span className="mt-1.5 text-xs font-normal wrap-anywhere text-neutral-500 dark:text-neutral-400">
                {description}
              </span>
            )}
          </div>
        )}
        <div
          className={`setting-control flex min-w-0 items-center ${expandControl || !label ? 'flex-1' : 'max-w-[60%] shrink-0'}`}
        >
          {children}
        </div>
      </RowContent>
      {error && (
        <p
          id={errorId}
          role="alert"
          className={`pb-2.5 text-xs wrap-anywhere text-red-600 dark:text-red-400 ${!isLast ? 'setting-divider' : ''}`}
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default SettingRow;
