'use client';

import React, { useRef, useEffect } from 'react';
import { CoffeeBean } from '@/types/app';
import { DatePicker } from '@/components/common/ui/DatePicker';
import HighlightText from '@/components/common/ui/HighlightText';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { formatBeanDisplayName } from '@/lib/utils/beanVarietyUtils';
import {
  formatNumber,
  formatDateString,
  parseDateString,
  getFlavorInfo,
} from '../utils';

interface BasicInfoSectionProps {
  bean: CoffeeBean | null;
  tempBean: Partial<CoffeeBean>;
  isAddMode: boolean;
  isGreenBean: boolean;
  searchQuery: string;
  editingCapacity: boolean;
  editingRemaining: boolean;
  editingPrice: boolean;
  setEditingCapacity: (editing: boolean) => void;
  setEditingRemaining: (editing: boolean) => void;
  setEditingPrice: (editing: boolean) => void;
  handleUpdateField: (updates: Partial<CoffeeBean>) => Promise<void>;
  handleCapacityBlur: (value: string) => void;
  handleRemainingBlur: (value: string) => void;
  handlePriceBlur: (value: string) => void;
  handleDateChange: (date: Date, field: 'roastDate' | 'purchaseDate') => void;
}

const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({
  bean,
  tempBean,
  isAddMode,
  isGreenBean,
  searchQuery,
  editingCapacity,
  editingRemaining,
  editingPrice,
  setEditingCapacity,
  setEditingRemaining,
  setEditingPrice,
  handleUpdateField,
  handleCapacityBlur,
  handleRemainingBlur,
  handlePriceBlur,
  handleDateChange,
}) => {
  const capacityInputRef = useRef<HTMLDivElement>(null);
  const remainingInputRef = useRef<HTMLDivElement>(null);
  const priceInputRef = useRef<HTMLDivElement>(null);

  // 获取烘焙商字段设置
  const roasterFieldEnabled = useSettingsStore(
    state => state.settings.roasterFieldEnabled
  );
  const roasterSeparator = useSettingsStore(
    state => state.settings.roasterSeparator
  );
  const roasterSettings = {
    roasterFieldEnabled,
    roasterSeparator,
  };

  const currentBean = isAddMode ? tempBean : bean;
  const isGreenBeanType = currentBean?.beanState === 'green';
  const flavorInfo = getFlavorInfo(bean);

  // 获取格式化后的显示名称
  const displayName = bean ? formatBeanDisplayName(bean, roasterSettings) : '';

  // 日期相关
  const dateField = isGreenBeanType ? 'purchaseDate' : 'roastDate';
  const dateLabel = isGreenBeanType ? '购买日期' : '烘焙日期';
  const dateValue = isGreenBeanType
    ? currentBean?.purchaseDate
    : currentBean?.roastDate;

  // 聚焦输入框
  useEffect(() => {
    if (editingCapacity && capacityInputRef.current) {
      capacityInputRef.current.focus();
      // 将光标移到末尾
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(capacityInputRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editingCapacity]);

  useEffect(() => {
    if (editingRemaining && remainingInputRef.current) {
      remainingInputRef.current.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(remainingInputRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editingRemaining]);

  useEffect(() => {
    if (editingPrice && priceInputRef.current) {
      priceInputRef.current.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(priceInputRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editingPrice]);

  return (
    <>
      {/* 标题区域 */}
      <div>
        {isAddMode ? (
          <input
            id="bean-detail-title"
            type="text"
            value={tempBean.name || ''}
            onChange={e => handleUpdateField({ name: e.target.value })}
            placeholder="输入咖啡豆名称"
            className="w-full border-b border-dashed border-neutral-300 bg-transparent pb-1 text-sm font-medium text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-neutral-600 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400"
          />
        ) : (
          <h2
            id="bean-detail-title"
            className="text-sm font-medium text-neutral-800 dark:text-neutral-100"
          >
            {searchQuery ? (
              <HighlightText text={displayName} highlight={searchQuery} />
            ) : (
              displayName
            )}
          </h2>
        )}
      </div>

      {/* 基础信息区域 */}
      <div className="space-y-3">
        {/* 容量/剩余量 */}
        {(isAddMode || (currentBean?.capacity && currentBean?.remaining)) && (
          <div className="flex items-start">
            <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              容量
            </div>
            <div className="flex items-center gap-1 text-xs font-medium">
              {/* 剩余量 */}
              {editingRemaining ? (
                <div
                  ref={remainingInputRef}
                  contentEditable
                  suppressContentEditableWarning
                  inputMode="decimal"
                  onBlur={e => {
                    handleRemainingBlur(e.currentTarget.textContent || '');
                    setEditingRemaining(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleRemainingBlur(e.currentTarget.textContent || '');
                      setEditingRemaining(false);
                    }
                  }}
                  className="min-w-[1ch] cursor-text text-xs font-medium text-neutral-800 outline-none dark:text-neutral-100"
                >
                  {currentBean?.remaining || ''}
                </div>
              ) : (
                <span
                  onClick={() => setEditingRemaining(true)}
                  className={`cursor-pointer ${
                    currentBean?.remaining
                      ? 'text-neutral-800 dark:text-neutral-100'
                      : 'text-neutral-400 dark:text-neutral-500'
                  }`}
                >
                  {currentBean?.remaining
                    ? formatNumber(currentBean.remaining)
                    : isAddMode
                      ? '剩余'
                      : '0'}
                </span>
              )}
              <span className="text-neutral-400 dark:text-neutral-500">/</span>
              {/* 总容量 */}
              {editingCapacity ? (
                <div
                  ref={capacityInputRef}
                  contentEditable
                  suppressContentEditableWarning
                  inputMode="decimal"
                  onBlur={e => {
                    handleCapacityBlur(e.currentTarget.textContent || '');
                    setEditingCapacity(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCapacityBlur(e.currentTarget.textContent || '');
                      setEditingCapacity(false);
                    }
                  }}
                  className="min-w-[1ch] cursor-text text-xs font-medium text-neutral-800 outline-none dark:text-neutral-100"
                >
                  {currentBean?.capacity || ''}
                </div>
              ) : (
                <span
                  onClick={() => setEditingCapacity(true)}
                  className={`cursor-pointer ${
                    currentBean?.capacity
                      ? 'text-neutral-800 dark:text-neutral-100'
                      : 'text-neutral-400 dark:text-neutral-500'
                  }`}
                >
                  {currentBean?.capacity
                    ? formatNumber(currentBean.capacity)
                    : isAddMode
                      ? '总量'
                      : '0'}
                </span>
              )}
              <span className="text-neutral-800 dark:text-neutral-100">克</span>
            </div>
          </div>
        )}

        {/* 价格 */}
        {(isAddMode || currentBean?.price) && (
          <div className="flex items-start">
            <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              价格
            </div>
            <div className="flex items-center gap-1 text-xs font-medium">
              {editingPrice ? (
                <div
                  ref={priceInputRef}
                  contentEditable
                  suppressContentEditableWarning
                  inputMode="decimal"
                  onBlur={e => {
                    handlePriceBlur(e.currentTarget.textContent || '');
                    setEditingPrice(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handlePriceBlur(e.currentTarget.textContent || '');
                      setEditingPrice(false);
                    }
                  }}
                  className="min-w-[1ch] cursor-text text-xs font-medium text-neutral-800 outline-none dark:text-neutral-100"
                >
                  {currentBean?.price || ''}
                </div>
              ) : (
                <span
                  onClick={() => setEditingPrice(true)}
                  className={`cursor-pointer ${
                    currentBean?.price
                      ? 'text-neutral-800 dark:text-neutral-100'
                      : 'text-neutral-400 dark:text-neutral-500'
                  }`}
                >
                  {currentBean?.price || (isAddMode ? '输入' : '')}
                </span>
              )}
              {currentBean?.price && (
                <span className="text-neutral-800 dark:text-neutral-100">
                  元
                  {currentBean?.capacity &&
                    ` (${(parseFloat(currentBean.price) / parseFloat(currentBean.capacity)).toFixed(2)} 元/克)`}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 日期 */}
        {(isAddMode || dateValue || currentBean?.isInTransit) && (
          <div className="flex items-start">
            <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {dateLabel}
            </div>
            <div className="flex items-center gap-2 text-xs font-medium">
              {!isAddMode && currentBean?.isInTransit ? (
                <span className="whitespace-nowrap text-neutral-800 dark:text-neutral-100">
                  在途
                </span>
              ) : isAddMode && bean?.isInTransit ? (
                <span
                  onClick={() => handleUpdateField({ isInTransit: false })}
                  className="cursor-pointer bg-neutral-100 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                >
                  在途
                </span>
              ) : (
                <>
                  {dateValue ? (
                    isAddMode ? (
                      <DatePicker
                        date={parseDateString(dateValue)}
                        onDateChange={date => handleDateChange(date, dateField)}
                        placeholder={`选择${dateLabel}`}
                        className="[&_button]:border-0 [&_button]:py-0 [&_button]:text-xs [&_button]:font-medium"
                        displayFormat="yyyy-MM-dd"
                      />
                    ) : (
                      <span className="whitespace-nowrap text-neutral-800 dark:text-neutral-100">
                        {formatDateString(dateValue)}
                      </span>
                    )
                  ) : (
                    <DatePicker
                      date={parseDateString(dateValue)}
                      onDateChange={date => handleDateChange(date, dateField)}
                      placeholder={`选择${dateLabel}`}
                      className="[&_button]:border-0 [&_button]:py-0 [&_button]:text-xs [&_button]:font-medium"
                    />
                  )}
                  {/* 添加模式：在途状态选项 */}
                  {isAddMode && (
                    <>
                      <div className="mx-1 h-3 w-px bg-neutral-200 dark:bg-neutral-700" />
                      <span
                        onClick={() => handleUpdateField({ isInTransit: true })}
                        className="cursor-pointer bg-neutral-100/50 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-neutral-400 dark:bg-neutral-800/50 dark:text-neutral-500"
                      >
                        在途
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* 赏味期（仅熟豆且有烘焙日期时显示，添加模式下不显示因为下面有设置） */}
        {!isGreenBeanType && flavorInfo && !isAddMode && (
          <div className="flex items-start">
            <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              赏味期
            </div>
            <div className="text-xs font-medium text-neutral-800 dark:text-neutral-100">
              {flavorInfo.status}
            </div>
          </div>
        )}
      </div>

      {/* 虚线分割线 */}
      <div className="border-t border-dashed border-neutral-200/70 dark:border-neutral-800/70"></div>
    </>
  );
};

export default BasicInfoSection;
