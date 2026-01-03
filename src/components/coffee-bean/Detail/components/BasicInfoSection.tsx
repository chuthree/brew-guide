'use client';

import React, { useRef, useEffect } from 'react';
import { CoffeeBean } from '@/types/app';
import { DatePicker } from '@/components/common/ui/DatePicker';
import HighlightText from '@/components/common/ui/HighlightText';
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
  showBeanInfoDivider: boolean;
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
  showBeanInfoDivider,
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
  const capacityInputRef = useRef<HTMLInputElement>(null);
  const remainingInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  const currentBean = isAddMode ? tempBean : bean;
  const isGreenBeanType = currentBean?.beanState === 'green';
  const flavorInfo = getFlavorInfo(bean);

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
    }
  }, [editingCapacity]);

  useEffect(() => {
    if (editingRemaining && remainingInputRef.current) {
      remainingInputRef.current.focus();
    }
  }, [editingRemaining]);

  useEffect(() => {
    if (editingPrice && priceInputRef.current) {
      priceInputRef.current.focus();
    }
  }, [editingPrice]);

  return (
    <>
      {/* 基础信息区域 */}
      <div className="space-y-3">
        {/* 名称 - 添加模式可编辑 */}
        <div id="bean-detail-title" className="flex items-start">
          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            名称
          </div>
          {isAddMode ? (
            <input
              type="text"
              value={tempBean.name || ''}
              onChange={e => handleUpdateField({ name: e.target.value })}
              placeholder="输入咖啡豆名称"
              className="flex-1 bg-transparent text-xs font-medium text-neutral-800 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
            />
          ) : (
            <div className="text-xs font-medium text-neutral-800 dark:text-neutral-100">
              {searchQuery ? (
                <HighlightText
                  text={bean?.name || ''}
                  highlight={searchQuery}
                />
              ) : (
                bean?.name
              )}
            </div>
          )}
        </div>

        {/* 容量/剩余量 */}
        {(isAddMode || (currentBean?.capacity && currentBean?.remaining)) && (
          <div className="flex items-start">
            <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              容量
            </div>
            <div className="flex items-center gap-1 text-xs font-medium">
              {/* 剩余量 */}
              {editingRemaining ? (
                <input
                  ref={remainingInputRef}
                  type="number"
                  inputMode="decimal"
                  defaultValue={currentBean?.remaining || ''}
                  onBlur={e => handleRemainingBlur(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleRemainingBlur(e.currentTarget.value);
                    }
                  }}
                  className="w-12 bg-neutral-100 px-1 text-center text-xs font-medium text-neutral-800 outline-none dark:bg-neutral-800 dark:text-neutral-100"
                />
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
                <input
                  ref={capacityInputRef}
                  type="number"
                  inputMode="decimal"
                  defaultValue={currentBean?.capacity || ''}
                  onBlur={e => handleCapacityBlur(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleCapacityBlur(e.currentTarget.value);
                    }
                  }}
                  className="w-12 bg-neutral-100 px-1 text-center text-xs font-medium text-neutral-800 outline-none dark:bg-neutral-800 dark:text-neutral-100"
                />
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
                <input
                  ref={priceInputRef}
                  type="number"
                  inputMode="decimal"
                  defaultValue={currentBean?.price || ''}
                  onBlur={e => handlePriceBlur(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handlePriceBlur(e.currentTarget.value);
                    }
                  }}
                  className="w-16 bg-neutral-100 px-1 text-center text-xs font-medium text-neutral-800 outline-none dark:bg-neutral-800 dark:text-neutral-100"
                />
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
                <>
                  <span className="text-neutral-800 dark:text-neutral-100">
                    元
                  </span>
                  {currentBean?.capacity && (
                    <span className="text-neutral-500 dark:text-neutral-400">
                      (
                      {(
                        parseFloat(currentBean.price) /
                        parseFloat(currentBean.capacity)
                      ).toFixed(2)}{' '}
                      元/克)
                    </span>
                  )}
                </>
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

        {/* 冷冻状态（非添加模式下，冷冻时显示） */}
        {!isAddMode && bean?.isFrozen && (
          <div className="flex items-start">
            <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              状态
            </div>
            <div className="text-xs font-medium text-neutral-800 dark:text-neutral-100">
              冷冻
            </div>
          </div>
        )}
      </div>

      {/* 虚线分割线 */}
      {showBeanInfoDivider && (
        <div className="border-t border-dashed border-neutral-200/70 dark:border-neutral-800/70"></div>
      )}
    </>
  );
};

export default BasicInfoSection;
