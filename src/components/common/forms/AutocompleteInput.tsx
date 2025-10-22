'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/classNameUtils';
import { X } from 'lucide-react';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions: string[];
  label?: string;
  className?: string;
  required?: boolean;
  unit?: string;
  clearable?: boolean;
  matchStartsWith?: boolean; // 是否只匹配开头
  onBlur?: () => void;
  containerClassName?: string;
  inputType?: 'text' | 'number' | 'tel' | 'email'; // 新增输入框类型属性
  inputMode?:
    | 'text'
    | 'decimal'
    | 'numeric'
    | 'tel'
    | 'search'
    | 'email'
    | 'url'; // 新增输入模式属性
  disabled?: boolean; // 添加禁用属性
  maxValue?: number; // 添加最大值属性，用于限制数字输入
  allowDecimal?: boolean; // 新增：是否允许小数点输入
  maxDecimalPlaces?: number; // 新增：小数点后最多允许的位数
  // 新增：自定义预设标记和预设删除功能
  isCustomPreset?: (value: string) => boolean;
  onRemovePreset?: (value: string) => void;
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  placeholder = '',
  suggestions = [],
  label,
  className,
  required = false,
  unit,
  clearable = false,
  matchStartsWith = false,
  onBlur,
  containerClassName,
  inputType = 'text', // 默认为text类型
  inputMode, // 输入模式
  disabled = false, // 默认为不禁用
  maxValue,
  allowDecimal = false, // 新增：默认不允许小数点
  maxDecimalPlaces = 2, // 新增：默认小数点后最多2位
  // 新增：自定义预设标记和预设删除功能
  isCustomPreset = () => false,
  onRemovePreset,
}) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [justSelected, setJustSelected] = useState(false); // 跟踪用户是否刚选择过建议项
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 当外部value变化时更新内部state
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // 过滤建议列表
  useEffect(() => {
    if (!inputValue.trim()) {
      setFilteredSuggestions(suggestions.slice(0, 10));
      return;
    }

    const lowerCaseInput = inputValue.toLowerCase();
    const filtered = suggestions
      .filter(suggestion => {
        const lowerCaseSuggestion = suggestion.toLowerCase();
        return matchStartsWith
          ? lowerCaseSuggestion.startsWith(lowerCaseInput)
          : lowerCaseSuggestion.includes(lowerCaseInput);
      })
      .slice(0, 10);

    setFilteredSuggestions(filtered);
  }, [inputValue, suggestions, matchStartsWith]);

  // 处理点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    // 移动端touch事件特殊处理
    function handleTouchOutside(event: TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleTouchOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleTouchOutside);
    };
  }, []);

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;

    // 对数字类型输入进行处理
    if (inputType === 'tel' || inputType === 'number') {
      if (allowDecimal) {
        // 允许小数点的情况
        // 1. 移除所有非数字和非小数点字符
        let filteredValue = newValue.replace(/[^0-9.]/g, '');

        // 2. 确保只有一个小数点
        const dotIndex = filteredValue.indexOf('.');
        if (dotIndex !== -1) {
          const beforeDot = filteredValue.substring(0, dotIndex + 1);
          const afterDot = filteredValue
            .substring(dotIndex + 1)
            .replace(/\./g, '');

          // 3. 限制小数点后位数
          const limitedAfterDot =
            maxDecimalPlaces > 0
              ? afterDot.substring(0, maxDecimalPlaces)
              : afterDot;

          filteredValue = beforeDot + limitedAfterDot;
        }

        // 4. 如果设置了maxValue，限制输入的最大值
        if (
          maxValue !== undefined &&
          filteredValue !== '' &&
          filteredValue !== '.'
        ) {
          const numValue = parseFloat(filteredValue);
          if (numValue > maxValue) {
            newValue = maxValue.toString();
          } else {
            newValue = filteredValue;
          }
        } else {
          // 5. 如果只输入了小数点，自动补充为"0."
          if (filteredValue === '.') {
            filteredValue = '0.';
          }
          newValue = filteredValue;
        }
      } else {
        // 原有逻辑：不允许小数点的情况
        const numericValue = newValue.replace(/[^0-9]/g, '');

        if (maxValue !== undefined && numericValue !== '') {
          const numValue = parseInt(numericValue);
          if (numValue > maxValue) {
            newValue = maxValue.toString();
          } else {
            newValue = numericValue;
          }
        } else {
          newValue = numericValue;
        }
      }
    }

    setInputValue(newValue);
    setJustSelected(false); // 用户输入时，重置选择状态

    // 立即调用onChange以确保父组件及时获取新值
    onChange(newValue);

    if (newValue.trim()) {
      setOpen(true);
    }
  };

  // 处理选择建议
  const handleSelectSuggestion = (selectedValue: string) => {
    setInputValue(selectedValue);
    onChange(selectedValue);
    setOpen(false);
    setFilteredSuggestions([]); // 清空过滤后的建议列表
    setJustSelected(true); // 标记用户刚选择过建议项

    // 防止选择后立即失焦导致值丢失
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  };

  // 处理失去焦点
  const handleBlur = () => {
    // 延迟关闭下拉菜单，避免点击选项时错过点击事件
    setTimeout(() => {
      // 检查当前文档焦点是否在下拉菜单内，避免点击下拉菜单项时立即关闭
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(document.activeElement) &&
        document.activeElement !== inputRef.current
      ) {
        setOpen(false);
        onChange(inputValue); // 确保更新外部值
        onBlur?.();
      }
    }, 150);
  };

  // 处理清除
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setInputValue('');
    onChange('');
    setOpen(false);
    inputRef.current?.focus();
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue) {
      onChange(inputValue);
      setOpen(false);
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (
      e.key === 'ArrowDown' &&
      !open &&
      filteredSuggestions.length > 0
    ) {
      setOpen(true);
    }
  };

  // 处理聚焦
  const handleFocus = () => {
    // 如果用户刚选择过建议项，则不打开下拉菜单
    if (justSelected) {
      setJustSelected(false);
      return;
    }

    // 否则，如果有建议项，则打开下拉菜单
    if (filteredSuggestions.length > 0) {
      setOpen(true);
    }
  };

  // 处理标签点击
  const handleLabelClick = (e: React.MouseEvent) => {
    e.preventDefault();
    inputRef.current?.focus();
  };

  // 阻止下拉菜单的触摸事件传播
  const handleDropdownTouch = (e: React.TouchEvent) => {
    e.stopPropagation();
  };

  // 阻止滑动默认行为
  const handleTouchMove = (e: React.TouchEvent) => {
    if (open) {
      e.stopPropagation();
    }
  };

  // 处理下拉菜单项点击
  const handleItemClick = (suggestion: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleSelectSuggestion(suggestion);
  };

  // 新增：处理删除预设
  const handleRemovePreset = (suggestion: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 如果当前值等于要删除的预设值，清空输入框
    if (inputValue === suggestion) {
      setInputValue('');
      onChange('');
    }

    // 调用外部删除函数
    onRemovePreset?.(suggestion);
  };

  return (
    <div
      ref={containerRef}
      className={cn('space-y-2', containerClassName)}
      onTouchMove={handleTouchMove}
    >
      {label && (
        <label
          onClick={handleLabelClick}
          className="block cursor-pointer text-xs font-medium text-neutral-500 dark:text-neutral-400"
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative">
        <div className="relative w-full">
          <input
            ref={inputRef}
            type={inputType}
            inputMode={
              inputMode ||
              (inputType === 'number' || inputType === 'tel'
                ? allowDecimal
                  ? 'decimal'
                  : 'numeric'
                : 'text')
            }
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'w-full border-b border-neutral-300 bg-transparent py-2 outline-hidden focus:border-neutral-800 dark:border-neutral-700 dark:focus:border-neutral-400',
              disabled && 'cursor-not-allowed opacity-60',
              className
            )}
          />
          {unit && !clearable && (
            <span className="absolute right-0 bottom-2 text-neutral-500 dark:text-neutral-400">
              {unit}
            </span>
          )}
          {unit && clearable && (
            <span className="absolute right-6 bottom-2 text-neutral-500 dark:text-neutral-400">
              {unit}
            </span>
          )}
          {clearable && inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-0 bottom-2 z-51 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {open && filteredSuggestions.length > 0 && (
          <div
            ref={dropdownRef}
            onTouchStart={handleDropdownTouch}
            className="absolute right-0 left-0 z-50 mt-1 max-h-[200px] overflow-auto rounded-md border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
          >
            <ul className="py-1">
              {filteredSuggestions.map((suggestion, index) => (
                <li
                  key={index}
                  className="flex cursor-pointer items-center justify-between px-3 py-3 text-sm hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                  onClick={e => handleItemClick(suggestion, e)}
                  onTouchStart={e => e.stopPropagation()}
                >
                  <span>{suggestion}</span>

                  {/* 如果是自定义预设且提供了删除函数，显示删除按钮 */}
                  {isCustomPreset(suggestion) && onRemovePreset && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation(); // 阻止点击事件冒泡到li元素
                        handleRemovePreset(suggestion, e);
                      }}
                      className="ml-2 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutocompleteInput;
