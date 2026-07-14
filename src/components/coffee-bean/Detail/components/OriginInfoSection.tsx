'use client';

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { CoffeeBean } from '@/types/app';
import HighlightText from '@/components/common/ui/HighlightText';
import { BEAN_TYPES } from '../types';
import BlendComponentTagRows from './BlendComponentTagRows';
import { updateBlendComponentsDelimitedField } from '@/lib/utils/coffeeBeanUtils';
import { hasStructuredOriginFields } from '@/lib/coffee-beans/beanFields';
import { useRoastLevelSuggestions } from '@/components/coffee-bean/Form/hooks/useCoffeeBeanFieldSuggestions';
import SuggestionDropdown, {
  SUGGESTION_DROPDOWN_Z_INDEX,
} from '@/components/common/forms/SuggestionDropdown';
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { X } from 'lucide-react';

interface OriginInfoSectionProps {
  bean: CoffeeBean | null;
  tempBean: Partial<CoffeeBean>;
  isAddMode: boolean;
  searchQuery: string;
  showEstateField: boolean;
  handleUpdateField: (updates: Partial<CoffeeBean>) => Promise<void>;
  handleRoastLevelSelect: (level: string) => void;
}

interface InlineRoastLevelSelectProps {
  value: string;
  placeholder: string;
  suggestions: string[];
  clearable: boolean;
  onChange: (value: string) => void;
}

const InlineRoastLevelSelect: React.FC<InlineRoastLevelSelectProps> = ({
  value,
  placeholder,
  suggestions,
  clearable,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-start',
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'listbox' });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    dismiss,
    role,
  ]);

  const handleSelect = useCallback(
    (selectedValue: string) => {
      onChange(selectedValue);
      setOpen(false);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onChange('');
    setOpen(false);
  }, [onChange]);

  return (
    <>
      <div className="flex min-w-0 items-center gap-1.5">
        <button
          ref={refs.setReference}
          type="button"
          className="block min-h-[1.25em] max-w-full cursor-pointer bg-transparent p-0 text-left text-xs font-medium text-neutral-800 outline-none dark:text-neutral-100"
          {...getReferenceProps({
            onClick: () => setOpen(current => !current),
            onKeyDown: event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setOpen(current => !current);
              }
            },
          })}
        >
          {value || (
            <span className="text-neutral-400 dark:text-neutral-500">
              {placeholder}
            </span>
          )}
        </button>
        {value && clearable ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="清除烘焙度"
            className="text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {open && suggestions.length > 0 && (
        <FloatingPortal>
          <SuggestionDropdown
            ref={refs.setFloating}
            suggestions={suggestions}
            onSelect={handleSelect}
            style={{
              ...floatingStyles,
              zIndex: SUGGESTION_DROPDOWN_Z_INDEX,
              minWidth: 128,
              width:
                refs.reference.current?.getBoundingClientRect().width ??
                undefined,
            }}
            {...getFloatingProps()}
          />
        </FloatingPortal>
      )}
    </>
  );
};

const OriginInfoSection: React.FC<OriginInfoSectionProps> = ({
  bean,
  tempBean,
  isAddMode,
  searchQuery,
  showEstateField,
  handleUpdateField,
  handleRoastLevelSelect,
}) => {
  const flavorPeriodDayInputClass =
    'w-10 bg-neutral-100 px-1.5 py-0.5 text-center text-xs font-medium text-neutral-700 placeholder:text-neutral-400 outline-none dark:bg-neutral-800/40 dark:text-neutral-300 dark:placeholder:text-neutral-500';

  const originRef = useRef<HTMLDivElement>(null);
  const countryRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const estateRef = useRef<HTMLDivElement>(null);
  const processingStationRef = useRef<HTMLDivElement>(null);
  const altitudeRef = useRef<HTMLDivElement>(null);
  const processRef = useRef<HTMLDivElement>(null);
  const batchRef = useRef<HTMLDivElement>(null);
  const varietyRef = useRef<HTMLDivElement>(null);
  const currentBean = isAddMode ? tempBean : bean;
  const roastLevelSuggestions = useRoastLevelSuggestions();
  const components =
    currentBean?.blendComponents && currentBean.blendComponents.length > 0
      ? currentBean.blendComponents
      : [
          {
            origin: '',
            estate: '',
            processingStation: '',
            process: '',
            variety: '',
          },
        ];
  const isMultipleBlend =
    currentBean?.blendComponents && currentBean.blendComponents.length > 1;
  const firstComponent = currentBean?.blendComponents?.[0];

  // 获取当前值
  const origin = firstComponent?.origin || '';
  const hasStructuredOrigin = hasStructuredOriginFields(firstComponent);
  const legacyOrigin = hasStructuredOrigin ? '' : origin;
  const country = firstComponent?.country || '';
  const region = firstComponent?.region || '';
  const estate = firstComponent?.estate || '';
  const processingStation = firstComponent?.processingStation || '';
  const altitude = firstComponent?.altitude || '';
  const process = firstComponent?.process || '';
  const batch = firstComponent?.batch || '';
  const variety = firstComponent?.variety || '';
  const roastLevel = currentBean?.roastLevel || '';
  const shouldShowEstateField =
    showEstateField || components.some(component => component.estate?.trim());

  // 初始化成分值
  useEffect(() => {
    if (firstComponent) {
      if (originRef.current && firstComponent.origin) {
        originRef.current.textContent = firstComponent.origin;
      }
      if (countryRef.current && firstComponent.country) {
        countryRef.current.textContent = firstComponent.country;
      }
      if (regionRef.current && firstComponent.region) {
        regionRef.current.textContent = firstComponent.region;
      }
      if (estateRef.current && firstComponent.estate) {
        estateRef.current.textContent = firstComponent.estate;
      }
      if (processingStationRef.current && firstComponent.processingStation) {
        processingStationRef.current.textContent =
          firstComponent.processingStation;
      }
      if (altitudeRef.current && firstComponent.altitude) {
        altitudeRef.current.textContent = firstComponent.altitude;
      }
      if (processRef.current && firstComponent.process) {
        processRef.current.textContent = firstComponent.process;
      }
      if (batchRef.current && firstComponent.batch) {
        batchRef.current.textContent = firstComponent.batch;
      }
      if (varietyRef.current && firstComponent.variety) {
        varietyRef.current.textContent = firstComponent.variety;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bean?.id]);

  // 处理成分编辑
  const handleBlendComponentUpdate = (
    index: number,
    field: Exclude<
      keyof NonNullable<CoffeeBean['blendComponents']>[number],
      'percentage'
    >,
    value: string
  ) => {
    const updatedComponents = updateBlendComponentsDelimitedField(
      currentBean?.blendComponents,
      index,
      field,
      value
    );

    handleUpdateField({ blendComponents: updatedComponents });
  };

  const handleComponentTextInput = (
    field: Exclude<
      keyof NonNullable<CoffeeBean['blendComponents']>[number],
      'percentage'
    >,
    fieldRef: React.RefObject<HTMLDivElement | null>
  ) => {
    if (fieldRef.current) {
      handleBlendComponentUpdate(0, field, fieldRef.current.textContent || '');
    }
  };

  const handleOriginInput = () => {
    handleComponentTextInput('origin', originRef);
  };

  const handleCountryInput = () => {
    handleComponentTextInput('country', countryRef);
  };

  const handleRegionInput = () => {
    handleComponentTextInput('region', regionRef);
  };

  const handleEstateInput = () => {
    handleComponentTextInput('estate', estateRef);
  };

  const handleProcessingStationInput = () => {
    handleComponentTextInput('processingStation', processingStationRef);
  };

  const handleAltitudeInput = () => {
    handleComponentTextInput('altitude', altitudeRef);
  };

  const handleProcessInput = () => {
    handleComponentTextInput('process', processRef);
  };

  const handleVarietyInput = () => {
    handleComponentTextInput('variety', varietyRef);
  };

  const handleBatchInput = () => {
    handleComponentTextInput('batch', batchRef);
  };

  const handleFlavorPeriodDayChange = (
    field: 'startDay' | 'endDay',
    value: string
  ) => {
    const numericValue = value.replace(/\D/g, '');

    handleUpdateField({
      [field]: numericValue ? parseInt(numericValue, 10) : undefined,
    });
  };

  const renderEditableInfoRow = ({
    label,
    value,
    fieldRef,
    onBlur,
    editable = true,
  }: {
    label: string;
    value: string;
    fieldRef?: React.RefObject<HTMLDivElement | null>;
    onBlur?: () => void;
    editable?: boolean;
  }) => {
    if (isAddMode || !value) return null;

    return (
      <div className="flex items-start">
        <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {label}
        </div>
        <div className="relative flex-1">
          <div
            ref={fieldRef}
            contentEditable={editable}
            suppressContentEditableWarning
            onBlur={onBlur}
            className={`text-xs font-medium text-neutral-800 outline-none dark:text-neutral-100 ${
              editable ? 'cursor-text' : ''
            }`}
            style={{ minHeight: '1.25em' }}
          >
            {searchQuery ? (
              <HighlightText text={value} highlight={searchQuery} />
            ) : (
              value
            )}
          </div>
        </div>
      </div>
    );
  };

  // 单品豆且有成分信息时显示可编辑区域
  if (isMultipleBlend && !isAddMode) return null;

  // 查看模式下至少有一个字段有值才显示；添加模式下总是显示
  if (
    !isAddMode &&
    !legacyOrigin &&
    !country &&
    !region &&
    !estate &&
    !processingStation &&
    !altitude &&
    !process &&
    !batch &&
    !variety &&
    !roastLevel
  ) {
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

      {isAddMode && (
        <BlendComponentTagRows
          components={components}
          showEstateField={shouldShowEstateField}
          onChange={handleBlendComponentUpdate}
        />
      )}

      {renderEditableInfoRow({
        label: '产地',
        value: legacyOrigin,
        fieldRef: originRef,
        onBlur: handleOriginInput,
      })}
      {renderEditableInfoRow({
        label: '产国',
        value: country,
        fieldRef: countryRef,
        onBlur: handleCountryInput,
      })}
      {renderEditableInfoRow({
        label: '产区',
        value: region,
        fieldRef: regionRef,
        onBlur: handleRegionInput,
      })}
      {renderEditableInfoRow({
        label: '庄园',
        value: estate,
        fieldRef: estateRef,
        onBlur: handleEstateInput,
      })}
      {renderEditableInfoRow({
        label: '处理站',
        value: processingStation,
        fieldRef: processingStationRef,
        onBlur: handleProcessingStationInput,
      })}
      {renderEditableInfoRow({
        label: '海拔',
        value: altitude,
        fieldRef: altitudeRef,
        onBlur: handleAltitudeInput,
      })}
      {renderEditableInfoRow({
        label: '处理法',
        value: process,
        fieldRef: processRef,
        onBlur: handleProcessInput,
      })}
      {renderEditableInfoRow({
        label: '批次',
        value: batch,
        fieldRef: batchRef,
        onBlur: handleBatchInput,
      })}
      {renderEditableInfoRow({
        label: '品种',
        value: variety,
        fieldRef: varietyRef,
        onBlur: handleVarietyInput,
      })}

      {/* 烘焙度 */}
      {(isAddMode || roastLevel) && (
        <div className="flex items-start">
          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            烘焙度
          </div>
          <InlineRoastLevelSelect
            value={roastLevel}
            clearable={isAddMode}
            onChange={handleRoastLevelSelect}
            placeholder="选择烘焙度"
            suggestions={roastLevelSuggestions.suggestions}
          />
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
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={
                    currentBean?.startDay ? String(currentBean.startDay) : ''
                  }
                  onChange={e =>
                    handleFlavorPeriodDayChange('startDay', e.target.value)
                  }
                  placeholder="天数"
                  className={flavorPeriodDayInputClass}
                />
                <span className="text-xs text-neutral-400">~</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={currentBean?.endDay ? String(currentBean.endDay) : ''}
                  onChange={e =>
                    handleFlavorPeriodDayChange('endDay', e.target.value)
                  }
                  placeholder="天数"
                  className={flavorPeriodDayInputClass}
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
