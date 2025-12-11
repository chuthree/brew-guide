import React from 'react';
import { LucideIcon, ChevronRight } from 'lucide-react';
import SettingToggle from './atomic/SettingToggle';

export interface SettingItemData {
  icon?: LucideIcon;
  label: string;
  value?: string;
  placeholder?: string;
  onClick?: () => void;
  expandedContent?: React.ReactNode;
  isExpanded?: boolean;
  editable?: boolean;
  onSave?: (value: string) => void;
  type?: 'default' | 'switch';
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  description?: string;
}

interface SettingGroupProps {
  items: SettingItemData[];
  className?: string;
}

/**
 * 设置分组组件 - 符合 iOS 设计规范
 * 分割线从文字开始位置到右边缘，不包含左侧图标区域
 */
const SettingGroup: React.FC<SettingGroupProps> = ({
  items,
  className = '',
}) => {
  return (
    <div className={`px-6 pb-5 ${className}`}>
      <div className="overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800/40">
        {items.map((item, index) => {
          const Icon = item.icon;
          const isLast = index === items.length - 1;
          const {
            isExpanded,
            expandedContent,
            editable,
            onSave,
            placeholder,
            type,
            checked,
            onChange,
            description,
          } = item;
          const isSwitch = type === 'switch';
          const Container = editable || isSwitch ? 'div' : 'button';

          return (
            <div key={`${item.label}-${index}`}>
              <Container
                onClick={!editable && !isSwitch ? item.onClick : undefined}
                className="flex w-full items-stretch pr-3.5 pl-[7px] text-sm font-medium text-neutral-800 transition-colors dark:text-neutral-200"
              >
                <div
                  className={`flex items-center pr-[7px] ${!item.icon ? 'opacity-0' : ''}`}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-200/30 dark:bg-neutral-700/10">
                    {item.icon && (
                      <item.icon className="stroke-1.4 h-4 w-4 stroke-[1.5px] text-neutral-600 dark:text-neutral-300" />
                    )}
                  </div>
                </div>
                <div
                  className={`flex min-w-0 flex-1 items-center justify-between border-b py-3.5 ${
                    !isLast && !isExpanded
                      ? 'border-black/5 dark:border-white/5'
                      : 'border-transparent'
                  }`}
                >
                  <div className="flex flex-col items-start gap-0.5 overflow-hidden">
                    <span className="truncate leading-none">{item.label}</span>
                    {description && (
                      <span className="truncate text-xs font-normal text-neutral-400 dark:text-neutral-500">
                        {description}
                      </span>
                    )}
                  </div>
                  {editable ? (
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={e => onSave?.(e.currentTarget.textContent || '')}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      data-placeholder={placeholder}
                      className="ml-4 max-w-[150px] cursor-text text-right text-sm text-neutral-600 outline-none empty:before:text-neutral-400 empty:before:content-[attr(data-placeholder)] dark:text-neutral-300 dark:empty:before:text-neutral-500"
                      style={{ minHeight: '1.25em' }}
                    >
                      {item.value}
                    </div>
                  ) : isSwitch ? (
                    <SettingToggle
                      checked={checked || false}
                      onChange={onChange || (() => {})}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      {item.value && (
                        <span className="text-sm text-neutral-400 dark:text-neutral-500">
                          {item.value}
                        </span>
                      )}
                      <ChevronRight
                        className={`h-4 w-4 text-neutral-400/60 transition-transform duration-200 ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                      />
                    </div>
                  )}
                </div>
              </Container>

              {/* 展开内容区域 */}
              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  isExpanded
                    ? 'grid-rows-[1fr] opacity-100'
                    : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  {expandedContent && (
                    <div className="relative">
                      {expandedContent}
                      {!isLast && (
                        <div className="ml-[42px] border-b border-black/5 dark:border-white/5" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SettingGroup;
