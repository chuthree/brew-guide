'use client';

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { CoffeeBean } from '@/types/app';
import HighlightText from '@/components/common/ui/HighlightText';
import { BEAN_TYPES } from '../types';
import BlendComponentTagRows from './BlendComponentTagRows';
import { updateBlendComponentsDelimitedField } from '@/lib/utils/coffeeBeanUtils';
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

interface OriginInfoSectionProps {
  bean: CoffeeBean | null;
  tempBean: Partial<CoffeeBean>;
  isAddMode: boolean;
  searchQuery: string;
  showEstateField: boolean;
  showRegionField: boolean;
  showLotField: boolean;
  showBatchField: boolean;
  showStationField: boolean;
  showAltitudeField: boolean;
  showSeasonField: boolean;
  showAgtronField: boolean;
  handleUpdateField: (updates: Partial<CoffeeBean>) => Promise<void>;
  handleRoastLevelSelect: (level: string) => void;
}

interface InlineRoastLevelSelectProps {
  value: string;
  placeholder: string;
  suggestions: string[];
  onChange: (value: string) => void;
}

const InlineRoastLevelSelect: React.FC<InlineRoastLevelSelectProps> = ({
  value,
  placeholder,
  suggestions,
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

  return (
    <>
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
  showRegionField,
  showLotField,
  showBatchField,
  showStationField,
  showAltitudeField,
  showSeasonField,
  showAgtronField,
  handleUpdateField,
  handleRoastLevelSelect,
}) => {
  const flavorPeriodDayInputClass =
    'w-10 bg-neutral-100 px-1.5 py-0.5 text-center text-xs font-medium text-neutral-700 placeholder:text-neutral-400 outline-none dark:bg-neutral-800/40 dark:text-neutral-300 dark:placeholder:text-neutral-500';

  const originRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const estateRef = useRef<HTMLDivElement>(null);
  const lotRef = useRef<HTMLDivElement>(null);
  const batchRef = useRef<HTMLDivElement>(null);
  const stationRef = useRef<HTMLDivElement>(null);
  const altitudeRef = useRef<HTMLDivElement>(null);
  const seasonRef = useRef<HTMLDivElement>(null);
  const processRef = useRef<HTMLDivElement>(null);
  const varietyRef = useRef<HTMLDivElement>(null);
  const agtronRef = useRef<HTMLDivElement>(null);
  const currentBean = isAddMode ? tempBean : bean;
  const roastLevelSuggestions = useRoastLevelSuggestions();
  const components =
    currentBean?.blendComponents && currentBean.blendComponents.length > 0
      ? currentBean.blendComponents
      : [{ origin: '', region: '', estate: '', lot: '', batch: '', station: '', altitude: '', season: '', process: '', variety: '', agtron: '' }];
  const isMultipleBlend =
    currentBean?.blendComponents && currentBean.blendComponents.length > 1;
  const firstComponent = currentBean?.blendComponents?.[0];

  // 获取当前值
  const origin = firstComponent?.origin || '';
  const region = firstComponent?.region || '';
  const estate = firstComponent?.estate || '';
  const lot = firstComponent?.lot || '';
  const batch = firstComponent?.batch || '';
  const station = firstComponent?.station || '';
  const altitude = firstComponent?.altitude || '';
  const season = firstComponent?.season || '';
  const process = firstComponent?.process || '';
  const variety = firstComponent?.variety || '';
  const agtron = firstComponent?.agtron || '';
  const roastLevel = currentBean?.roastLevel || '';
  const shouldShowEstateField =
    showEstateField || components.some(component => component.estate?.trim());
  const shouldShowRegionField =
    showRegionField || components.some(component => component.region?.trim());
  const shouldShowLotField =
    showLotField || components.some(component => component.lot?.trim());
  const shouldShowBatchField =
    showBatchField || components.some(component => component.batch?.trim());
  const shouldShowProcessingStationField =
    showStationField || components.some(component => component.station?.trim());
  const shouldShowAltitudeField =
    showAltitudeField || components.some(component => component.altitude?.trim());
  const shouldShowSeasonField =
    showSeasonField || components.some(component => component.season?.trim());
  const shouldShowAgtronField =
    showAgtronField || components.some(component => component.agtron?.trim());

  // 初始化成分值
  useEffect(() => {
    if (firstComponent) {
      if (originRef.current && firstComponent.origin) {
        originRef.current.textContent = firstComponent.origin;
      }
      if (regionRef.current && firstComponent.region) {
        regionRef.current.textContent = firstComponent.region;
      }
      if (estateRef.current && firstComponent.estate) {
        estateRef.current.textContent = firstComponent.estate;
      }
      if (lotRef.current && firstComponent.lot) {
        lotRef.current.textContent = firstComponent.lot;
      }
      if (batchRef.current && firstComponent.batch) {
        batchRef.current.textContent = firstComponent.batch;
      }
      if (stationRef.current && firstComponent.station) {
        stationRef.current.textContent = firstComponent.station;
      }
      if (altitudeRef.current && firstComponent.altitude) {
        altitudeRef.current.textContent = firstComponent.altitude;
      }
      if (seasonRef.current && firstComponent.season) {
        seasonRef.current.textContent = firstComponent.season;
      }
      if (processRef.current && firstComponent.process) {
        processRef.current.textContent = firstComponent.process;
      }
      if (varietyRef.current && firstComponent.variety) {
        varietyRef.current.textContent = firstComponent.variety;
      }
      if (agtronRef.current && firstComponent.agtron) {
        agtronRef.current.textContent = firstComponent.agtron;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bean?.id]);

  // 处理成分编辑
  const handleBlendComponentUpdate = (
    index: number,
    field: 'origin' | 'region' | 'estate' | 'lot' | 'batch' | 'station' | 'altitude' | 'season' | 'process' | 'variety' | 'agtron',
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

  const handleOriginInput = () => {
    if (originRef.current) {
      handleBlendComponentUpdate(
        0,
        'origin',
        originRef.current.textContent || ''
      );
    }
  };

  const handleRegionInput = () => {
    if (regionRef.current) {
      handleBlendComponentUpdate(
        0,
        'region',
        regionRef.current.textContent || ''
      );
    }
  };

  const handleEstateInput = () => {
    if (estateRef.current) {
      handleBlendComponentUpdate(
        0,
        'estate',
        estateRef.current.textContent || ''
      );
    }
  };

  const handleLotInput = () => {
    if (lotRef.current) {
      handleBlendComponentUpdate(
        0,
        'lot',
        lotRef.current.textContent || ''
      );
    }
  };

  const handleBatchInput = () => {
    if (batchRef.current) {
      handleBlendComponentUpdate(
        0,
        'batch',
        batchRef.current.textContent || ''
      );
    }
  };

  const handleProcessingStationInput = () => {
    if (stationRef.current) {
      handleBlendComponentUpdate(
        0,
        'station',
        stationRef.current.textContent || ''
      );
    }
  };

  const handleAltitudeInput = () => {
    if (altitudeRef.current) {
      handleBlendComponentUpdate(
        0,
        'altitude',
        altitudeRef.current.textContent || ''
      );
    }
  };

  const handleSeasonInput = () => {
    if (seasonRef.current) {
      handleBlendComponentUpdate(
        0,
        'season',
        seasonRef.current.textContent || ''
      );
    }
  };

  const handleProcessInput = () => {
    if (processRef.current) {
      handleBlendComponentUpdate(
        0,
        'process',
        processRef.current.textContent || ''
      );
    }
  };

  const handleVarietyInput = () => {
    if (varietyRef.current) {
      handleBlendComponentUpdate(
        0,
        'variety',
        varietyRef.current.textContent || ''
      );
    }
  };

  const handleAgtronInput = () => {
    if (agtronRef.current) {
      handleBlendComponentUpdate(
        0,
        'agtron',
        agtronRef.current.textContent || ''
      );
    }
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

  // 单品豆且有成分信息时显示可编辑区域
  if (isMultipleBlend && !isAddMode) return null;

  // 查看模式下至少有一个字段有值才显示；添加模式下总是显示
  if (!isAddMode && !origin && !region && !estate && !lot && !batch && !station && !altitude && !season && !process && !variety && !roastLevel) {
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
          showRegionField={shouldShowRegionField}
          showLotField={shouldShowLotField}
          showBatchField={shouldShowBatchField}
          showStationField={shouldShowProcessingStationField}
          showAltitudeField={shouldShowAltitudeField}
          showSeasonField={shouldShowSeasonField}
          showAgtronField={shouldShowAgtronField}
          onChange={handleBlendComponentUpdate}
        />
      )}

      {/* 产地 */}
      {!isAddMode && origin && (
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

      {/* 产区 */}
      {!isAddMode && region && (
        <div className="flex items-start">
          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            产区
          </div>
          <div className="relative flex-1">
            {isAddMode && !region && (
              <span
                className="pointer-events-none absolute top-0 left-0 text-xs font-medium text-neutral-400 dark:text-neutral-500"
                data-placeholder="region"
              >
                输入产区
              </span>
            )}
            <div
              ref={regionRef}
              contentEditable
              suppressContentEditableWarning
              onInput={e => {
                const placeholder =
                  e.currentTarget.parentElement?.querySelector(
                    '[data-placeholder="region"]'
                  ) as HTMLElement;
                if (placeholder) {
                  placeholder.style.display = e.currentTarget.textContent
                    ? 'none'
                    : '';
                }
              }}
              onBlur={handleRegionInput}
              className="cursor-text text-xs font-medium text-neutral-800 outline-none dark:text-neutral-100"
              style={{ minHeight: '1.25em' }}
            >
              {region}
            </div>
          </div>
        </div>
      )}

      {/* 庄园 */}
      {!isAddMode && estate && (
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

      {/* 地块 */}
      {!isAddMode && shouldShowLotField && lot && (
        <div className="flex items-start">
          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            地块
          </div>
          <div className="relative flex-1">
            <div
              ref={lotRef}
              contentEditable
              suppressContentEditableWarning
              onBlur={handleLotInput}
              className="cursor-text text-xs font-medium text-neutral-800 outline-none dark:text-neutral-100"
              style={{ minHeight: '1.25em' }}
            >
              {lot}
            </div>
          </div>
        </div>
      )}

      {/* 批次 */}
      {!isAddMode && shouldShowBatchField && batch && (
        <div className="flex items-start">
          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            批次
          </div>
          <div className="relative flex-1">
            <div
              ref={batchRef}
              contentEditable
              suppressContentEditableWarning
              onBlur={handleBatchInput}
              className="cursor-text text-xs font-medium text-neutral-800 outline-none dark:text-neutral-100"
              style={{ minHeight: '1.25em' }}
            >
              {batch}
            </div>
          </div>
        </div>
      )}

      {/* 处理站 */}
      {!isAddMode && shouldShowProcessingStationField && station && (
        <div className="flex items-start">
          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            处理站
          </div>
          <div className="relative flex-1">
            <div
              ref={stationRef}
              contentEditable
              suppressContentEditableWarning
              onBlur={handleProcessingStationInput}
              className="cursor-text text-xs font-medium text-neutral-800 outline-none dark:text-neutral-100"
              style={{ minHeight: '1.25em' }}
            >
              {station}
            </div>
          </div>
        </div>
      )}

      {/* 处理法 */}
      {!isAddMode && process && (
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
      {!isAddMode && variety && (
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

      {/* 海拔 */}
      {!isAddMode && altitude && (
        <div className="flex items-start">
          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            海拔
          </div>
          <div className="relative flex-1">
            {isAddMode && !altitude && (
              <span
                className="pointer-events-none absolute top-0 left-0 text-xs font-medium text-neutral-400 dark:text-neutral-500"
                data-placeholder="altitude"
              >
                输入海拔
              </span>
            )}
            <div
              ref={altitudeRef}
              contentEditable
              suppressContentEditableWarning
              onInput={e => {
                const placeholder =
                  e.currentTarget.parentElement?.querySelector(
                    '[data-placeholder="altitude"]'
                  ) as HTMLElement;
                if (placeholder) {
                  placeholder.style.display = e.currentTarget.textContent
                    ? 'none'
                    : '';
                }
              }}
              onBlur={handleAltitudeInput}
              className="cursor-text text-xs font-medium text-neutral-800 outline-none dark:text-neutral-100"
              style={{ minHeight: '1.25em' }}
            >
              {altitude}
            </div>
          </div>
        </div>
      )}

      {/* 产季 */}
      {!isAddMode && season && (
        <div className="flex items-start">
          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            产季
          </div>
          <div className="relative flex-1">
            {isAddMode && !season && (
              <span
                className="pointer-events-none absolute top-0 left-0 text-xs font-medium text-neutral-400 dark:text-neutral-500"
                data-placeholder="season"
              >
                输入产季
              </span>
            )}
            <div
              ref={seasonRef}
              contentEditable
              suppressContentEditableWarning
              onInput={e => {
                const placeholder =
                  e.currentTarget.parentElement?.querySelector(
                    '[data-placeholder="season"]'
                  ) as HTMLElement;
                if (placeholder) {
                  placeholder.style.display = e.currentTarget.textContent
                    ? 'none'
                    : '';
                }
              }}
              onBlur={handleSeasonInput}
              className="cursor-text text-xs font-medium text-neutral-800 outline-none dark:text-neutral-100"
              style={{ minHeight: '1.25em' }}
            >
              {season}
            </div>
          </div>
        </div>
      )}

      {/* Agtron值 */}
      {!isAddMode && shouldShowAgtronField && agtron && (
        <div className="flex items-start">
          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Agtron值
          </div>
          <div className="relative flex-1">
            <div
              ref={agtronRef}
              contentEditable
              suppressContentEditableWarning
              onBlur={handleAgtronInput}
              className="cursor-text text-xs font-medium text-neutral-800 outline-none dark:text-neutral-100"
              style={{ minHeight: '1.25em' }}
            >
              {agtron}
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
          <InlineRoastLevelSelect
            value={roastLevel}
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
                  value={currentBean?.startDay ?? ''}
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
                  value={currentBean?.endDay ?? ''}
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
