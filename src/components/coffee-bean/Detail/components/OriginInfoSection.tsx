'use client';

import React, { useCallback, useState } from 'react';
import { CoffeeBean } from '@/types/app';
import { BEAN_TYPES } from '../types';
import BlendComponentTagRows from './BlendComponentTagRows';
import { updateBlendComponentsDelimitedField } from '@/lib/utils/coffeeBeanUtils';
import {
  getComponentConfiguredValues,
  type BeanFieldId,
} from '@/lib/coffee-beans/beanFields';
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
  fieldIds: BeanFieldId[];
  bean: CoffeeBean | null;
  tempBean: Partial<CoffeeBean>;
  isAddMode: boolean;
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
  fieldIds,
  bean,
  tempBean,
  isAddMode,
  handleUpdateField,
  handleRoastLevelSelect,
}) => {
  const flavorPeriodDayInputClass =
    'w-10 bg-neutral-100 px-1.5 py-0.5 text-center text-xs font-medium text-neutral-700 placeholder:text-neutral-400 outline-none dark:bg-neutral-800/40 dark:text-neutral-300 dark:placeholder:text-neutral-500';

  const currentBean = isAddMode ? tempBean : bean;
  const roastLevelSuggestions = useRoastLevelSuggestions();
  const components = currentBean?.blendComponents ?? [];
  const displayFields =
    components.length <= 1
      ? getComponentConfiguredValues(components[0], fieldIds)
      : [];
  const roastLevel = currentBean?.roastLevel || '';

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

  const handleFlavorPeriodDayChange = (
    field: 'startDay' | 'endDay',
    value: string
  ) => {
    const numericValue = value.replace(/\D/g, '');

    handleUpdateField({
      [field]: numericValue ? parseInt(numericValue, 10) : undefined,
    });
  };

  if (!isAddMode && !displayFields.length && !roastLevel) {
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
          fieldIds={fieldIds}
          components={components}
          onChange={handleBlendComponentUpdate}
        />
      )}

      {!isAddMode &&
        displayFields.map(({ id, label, value }) => (
          <div key={`${bean?.id}-${id}`} className="flex items-start">
            <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {label}
            </div>
            <div className="relative flex-1">
              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={event => {
                  const nextValue =
                    event.currentTarget.textContent?.trim() || '';
                  if (nextValue !== value) {
                    handleBlendComponentUpdate(0, id, nextValue);
                  }
                }}
                className="cursor-text text-xs font-medium text-neutral-800 outline-none dark:text-neutral-100"
                style={{ minHeight: '1.25em' }}
              >
                {value}
              </div>
            </div>
          </div>
        ))}

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
