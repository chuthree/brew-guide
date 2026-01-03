'use client';

import React, { useRef, useState, useEffect } from 'react';
import { CoffeeBean } from '@/types/app';
import HighlightText from '@/components/common/ui/HighlightText';
import { ROAST_LEVELS, BEAN_TYPES } from '../types';

interface OriginInfoSectionProps {
  bean: CoffeeBean | null;
  tempBean: Partial<CoffeeBean>;
  isAddMode: boolean;
  searchQuery: string;
  showEstateField: boolean;
  handleUpdateField: (updates: Partial<CoffeeBean>) => Promise<void>;
  handleRoastLevelSelect: (level: string) => void;
}

const OriginInfoSection: React.FC<OriginInfoSectionProps> = ({
  bean,
  tempBean,
  isAddMode,
  searchQuery,
  showEstateField,
  handleUpdateField,
  handleRoastLevelSelect,
}) => {
  const originRef = useRef<HTMLDivElement>(null);
  const estateRef = useRef<HTMLDivElement>(null);
  const processRef = useRef<HTMLDivElement>(null);
  const varietyRef = useRef<HTMLDivElement>(null);
  const roastLevelRef = useRef<HTMLDivElement>(null);

  const [showRoastLevelDropdown, setShowRoastLevelDropdown] = useState(false);

  const currentBean = isAddMode ? tempBean : bean;
  const isMultipleBlend =
    currentBean?.blendComponents && currentBean.blendComponents.length > 1;
  const firstComponent = currentBean?.blendComponents?.[0];

  // 获取当前值
  const origin = firstComponent?.origin || '';
  const estate = firstComponent?.estate || '';
  const process = firstComponent?.process || '';
  const variety = firstComponent?.variety || '';
  const roastLevel = currentBean?.roastLevel || '';

  // 初始化成分值
  useEffect(() => {
    if (firstComponent) {
      if (originRef.current && firstComponent.origin) {
        originRef.current.textContent = firstComponent.origin;
      }
      if (estateRef.current && firstComponent.estate) {
        estateRef.current.textContent = firstComponent.estate;
      }
      if (processRef.current && firstComponent.process) {
        processRef.current.textContent = firstComponent.process;
      }
      if (varietyRef.current && firstComponent.variety) {
        varietyRef.current.textContent = firstComponent.variety;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bean?.id]);

  // 点击外部关闭烘焙度下拉
  useEffect(() => {
    if (!showRoastLevelDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        roastLevelRef.current &&
        !roastLevelRef.current.contains(e.target as Node)
      ) {
        setShowRoastLevelDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRoastLevelDropdown]);

  // 处理成分编辑
  const handleBlendComponentUpdate = (
    field: 'origin' | 'estate' | 'process' | 'variety',
    value: string
  ) => {
    if (!currentBean?.blendComponents) return;

    const updatedComponents = [...currentBean.blendComponents];

    if (updatedComponents.length === 0) {
      updatedComponents.push({ [field]: value });
    } else {
      updatedComponents[0] = {
        ...updatedComponents[0],
        [field]: value.trim(),
      };
    }

    handleUpdateField({ blendComponents: updatedComponents });
  };

  const handleOriginInput = () => {
    if (originRef.current) {
      handleBlendComponentUpdate('origin', originRef.current.textContent || '');
    }
  };

  const handleEstateInput = () => {
    if (estateRef.current) {
      handleBlendComponentUpdate('estate', estateRef.current.textContent || '');
    }
  };

  const handleProcessInput = () => {
    if (processRef.current) {
      handleBlendComponentUpdate(
        'process',
        processRef.current.textContent || ''
      );
    }
  };

  const handleVarietyInput = () => {
    if (varietyRef.current) {
      handleBlendComponentUpdate(
        'variety',
        varietyRef.current.textContent || ''
      );
    }
  };

  const handleRoastLevelClick = (level: string) => {
    setShowRoastLevelDropdown(false);
    handleRoastLevelSelect(level);
  };

  // 单品豆且有成分信息时显示可编辑区域
  if (isMultipleBlend && !isAddMode) return null;

  // 查看模式下至少有一个字段有值才显示；添加模式下总是显示
  if (!isAddMode && !origin && !estate && !process && !variety && !roastLevel) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* 咖啡豆类型 - 添加模式下显示 */}
      {isAddMode && (
        <div className="flex items-start">
          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            类型
          </div>
          <div className="flex items-center gap-2">
            {BEAN_TYPES.map(type => (
              <span
                key={type.value}
                onClick={() => handleUpdateField({ beanType: type.value })}
                className={`cursor-pointer px-1.5 py-0.5 text-xs font-medium ${
                  currentBean?.beanType === type.value
                    ? 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                    : 'bg-neutral-100/70 text-neutral-400 dark:bg-neutral-800/70 dark:text-neutral-500'
                }`}
              >
                {type.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 产地 */}
      {(isAddMode || origin) && (
        <div className="flex items-start">
          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            产地
          </div>
          <div className="relative flex-1">
            {isAddMode && !origin && (
              <span
                className="pointer-events-none absolute top-0 left-0 text-xs font-medium text-neutral-400 dark:text-neutral-500"
                data-placeholder="origin"
              >
                输入产地
              </span>
            )}
            <div
              ref={originRef}
              contentEditable
              suppressContentEditableWarning
              onInput={e => {
                const placeholder =
                  e.currentTarget.parentElement?.querySelector(
                    '[data-placeholder="origin"]'
                  ) as HTMLElement;
                if (placeholder) {
                  placeholder.style.display = e.currentTarget.textContent
                    ? 'none'
                    : '';
                }
              }}
              onBlur={handleOriginInput}
              className="cursor-text text-xs font-medium text-neutral-800 outline-none dark:text-neutral-100"
              style={{ minHeight: '1.25em' }}
            >
              {searchQuery ? (
                <HighlightText text={origin} highlight={searchQuery} />
              ) : (
                origin
              )}
            </div>
          </div>
        </div>
      )}

      {/* 庄园 */}
      {((isAddMode && (showEstateField || estate)) ||
        (!isAddMode && estate)) && (
        <div className="flex items-start">
          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            庄园
          </div>
          <div className="relative flex-1">
            {isAddMode && !estate && (
              <span
                className="pointer-events-none absolute top-0 left-0 text-xs font-medium text-neutral-400 dark:text-neutral-500"
                data-placeholder="estate"
              >
                输入庄园
              </span>
            )}
            <div
              ref={estateRef}
              contentEditable
              suppressContentEditableWarning
              onInput={e => {
                const placeholder =
                  e.currentTarget.parentElement?.querySelector(
                    '[data-placeholder="estate"]'
                  ) as HTMLElement;
                if (placeholder) {
                  placeholder.style.display = e.currentTarget.textContent
                    ? 'none'
                    : '';
                }
              }}
              onBlur={handleEstateInput}
              className="cursor-text text-xs font-medium text-neutral-800 outline-none dark:text-neutral-100"
              style={{ minHeight: '1.25em' }}
            >
              {estate}
            </div>
          </div>
        </div>
      )}

      {/* 处理法 */}
      {(isAddMode || process) && (
        <div className="flex items-start">
          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            处理法
          </div>
          <div className="relative flex-1">
            {isAddMode && !process && (
              <span
                className="pointer-events-none absolute top-0 left-0 text-xs font-medium text-neutral-400 dark:text-neutral-500"
                data-placeholder="process"
              >
                输入处理法
              </span>
            )}
            <div
              ref={processRef}
              contentEditable
              suppressContentEditableWarning
              onInput={e => {
                const placeholder =
                  e.currentTarget.parentElement?.querySelector(
                    '[data-placeholder="process"]'
                  ) as HTMLElement;
                if (placeholder) {
                  placeholder.style.display = e.currentTarget.textContent
                    ? 'none'
                    : '';
                }
              }}
              onBlur={handleProcessInput}
              className="cursor-text text-xs font-medium text-neutral-800 outline-none dark:text-neutral-100"
              style={{ minHeight: '1.25em' }}
            >
              {process}
            </div>
          </div>
        </div>
      )}

      {/* 品种 */}
      {(isAddMode || variety) && (
        <div className="flex items-start">
          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            品种
          </div>
          <div className="relative flex-1">
            {isAddMode && !variety && (
              <span
                className="pointer-events-none absolute top-0 left-0 text-xs font-medium text-neutral-400 dark:text-neutral-500"
                data-placeholder="variety"
              >
                输入品种
              </span>
            )}
            <div
              ref={varietyRef}
              contentEditable
              suppressContentEditableWarning
              onInput={e => {
                const placeholder =
                  e.currentTarget.parentElement?.querySelector(
                    '[data-placeholder="variety"]'
                  ) as HTMLElement;
                if (placeholder) {
                  placeholder.style.display = e.currentTarget.textContent
                    ? 'none'
                    : '';
                }
              }}
              onBlur={handleVarietyInput}
              className="cursor-text text-xs font-medium text-neutral-800 outline-none dark:text-neutral-100"
              style={{ minHeight: '1.25em' }}
            >
              {variety}
            </div>
          </div>
        </div>
      )}

      {/* 烘焙度 */}
      {(isAddMode || roastLevel) && (
        <div className="flex items-start">
          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            烘焙度
          </div>
          <div ref={roastLevelRef} className="relative inline-flex">
            <span
              onClick={() => setShowRoastLevelDropdown(!showRoastLevelDropdown)}
              className={`cursor-pointer text-xs font-medium ${
                isAddMode && !roastLevel
                  ? 'text-neutral-400 dark:text-neutral-500'
                  : 'text-neutral-800 dark:text-neutral-100'
              }`}
            >
              {roastLevel || (isAddMode ? '选择烘焙度' : '')}
            </span>
            {showRoastLevelDropdown && (
              <div className="absolute top-full left-0 z-50 mt-1 min-w-[100px] rounded border border-neutral-200/50 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
                {ROAST_LEVELS.map(level => (
                  <div
                    key={level}
                    onClick={() => handleRoastLevelClick(level)}
                    className={`cursor-pointer px-3 py-1.5 text-xs font-medium transition-colors ${
                      level === roastLevel
                        ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100'
                        : 'text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-700/50'
                    }`}
                  >
                    {level}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 赏味期设置 - 添加模式下显示 */}
      {isAddMode && (
        <div className="flex items-center">
          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            赏味期
          </div>
          <div className="flex items-center gap-2">
            {currentBean?.isFrozen ? (
              <span
                onClick={() => handleUpdateField({ isFrozen: false })}
                className="cursor-pointer bg-neutral-100 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
              >
                冷冻
              </span>
            ) : (
              <>
                <input
                  type="number"
                  inputMode="numeric"
                  value={currentBean?.startDay ?? ''}
                  onChange={e =>
                    handleUpdateField({
                      startDay: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder="天数"
                  className="w-10 bg-neutral-100 px-1.5 py-0.5 text-center text-xs font-medium text-neutral-700 outline-none dark:bg-neutral-800 dark:text-neutral-300"
                />
                <span className="text-xs text-neutral-400">~</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={currentBean?.endDay ?? ''}
                  onChange={e =>
                    handleUpdateField({
                      endDay: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder="天数"
                  className="w-10 bg-neutral-100 px-1.5 py-0.5 text-center text-xs font-medium text-neutral-700 outline-none dark:bg-neutral-800 dark:text-neutral-300"
                />
                <span className="text-xs text-neutral-400">天</span>
                <div className="mx-1 h-3 w-px bg-neutral-200 dark:bg-neutral-700" />
                <span
                  onClick={() => handleUpdateField({ isFrozen: true })}
                  className="cursor-pointer bg-neutral-100/70 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-neutral-400 dark:bg-neutral-800/70 dark:text-neutral-500"
                >
                  冷冻
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OriginInfoSection;
