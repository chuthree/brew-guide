'use client';

import React, { useRef, useEffect } from 'react';
import { CoffeeBean } from '@/types/app';
import HighlightText from '@/components/common/ui/HighlightText';
import { normalizeDelimitedTextList } from '@/lib/utils/coffeeBeanUtils';
import TagAutocompleteInput from './TagAutocompleteInput';
import { useFlavorSuggestions } from '@/components/coffee-bean/Form/hooks/useCoffeeBeanFieldSuggestions';

interface FlavorNotesSectionProps {
  bean: CoffeeBean | null;
  tempBean: Partial<CoffeeBean>;
  isAddMode: boolean;
  searchQuery: string;
  handleUpdateField: (updates: Partial<CoffeeBean>) => Promise<void>;
}

const FlavorNotesSection: React.FC<FlavorNotesSectionProps> = ({
  bean,
  tempBean,
  isAddMode,
  searchQuery,
  handleUpdateField,
}) => {
  const notesRef = useRef<HTMLDivElement>(null);

  const currentFlavors = isAddMode ? tempBean.flavor || [] : bean?.flavor || [];
  const currentNotes = isAddMode ? tempBean.notes : bean?.notes;
  const flavorSuggestions = useFlavorSuggestions();

  // 初始化备注值
  useEffect(() => {
    if (bean?.notes && notesRef.current) {
      notesRef.current.innerText = bean.notes;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bean?.id]);

  // 处理备注内容变化
  const handleNotesInput = () => {
    if (notesRef.current) {
      const newContent = notesRef.current.innerText || '';
      handleUpdateField({ notes: newContent.trim() });
    }
  };

  const appendFlavors = (value: string) => {
    const nextItems = normalizeDelimitedTextList(value);
    if (nextItems.length === 0) return false;

    handleUpdateField({
      flavor: Array.from(new Set([...currentFlavors, ...nextItems])),
    });
    return true;
  };

  const replaceFlavor = (index: number, value: string) => {
    const remainingFlavors = currentFlavors.filter((_, i) => i !== index);
    const nextItems = normalizeDelimitedTextList(value).filter(
      item => !remainingFlavors.includes(item)
    );
    const nextFlavors = [...remainingFlavors];
    nextFlavors.splice(index, 0, ...nextItems);
    handleUpdateField({ flavor: nextFlavors });
  };

  const placeholder = currentFlavors.length === 0 ? '输入风味，逗号分隔' : '+ ';

  return (
    <>
      {/* 风味 */}
      {(isAddMode || (bean?.flavor && bean.flavor.length > 0)) && (
        <div className="flex items-start">
          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            风味
          </div>
          <div className="-mt-0.5 flex flex-1 flex-wrap items-center gap-1">
            {/* 已有的风味标签 */}
            {currentFlavors.map((flavor: string, index: number) => (
              <span
                key={flavor}
                contentEditable
                suppressContentEditableWarning
                onBlur={e => {
                  const newValue = e.currentTarget.textContent?.trim() || '';
                  if (newValue !== flavor) {
                    replaceFlavor(index, newValue);
                  }
                }}
                className="cursor-text bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700 outline-none dark:bg-neutral-800/40 dark:text-neutral-300"
              >
                {flavor}
              </span>
            ))}
            {/* 添加模式：输入框 */}
            {isAddMode && (
              <TagAutocompleteInput
                placeholder={placeholder}
                suggestions={flavorSuggestions.suggestions.filter(
                  flavor => !currentFlavors.includes(flavor)
                )}
                isCustomPreset={flavorSuggestions.isRemovableSuggestion}
                onRemovePreset={flavorSuggestions.removeSuggestion}
                onCommit={appendFlavors}
                onBackspaceEmpty={() => {
                  if (currentFlavors.length === 0) return undefined;

                  const lastFlavor = currentFlavors[currentFlavors.length - 1];
                  const newFlavors = currentFlavors.slice(0, -1);
                  handleUpdateField({ flavor: newFlavors });
                  return lastFlavor;
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* 备注 */}
      {(isAddMode || bean?.notes) && (
        <div className="flex items-start">
          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            备注
          </div>
          <div className="relative flex-1">
            {isAddMode && !tempBean.notes && (
              <span
                className="pointer-events-none absolute top-0 left-0 text-xs font-medium text-neutral-400 dark:text-neutral-500"
                data-placeholder="notes"
              >
                输入备注
              </span>
            )}
            <div
              ref={notesRef}
              contentEditable
              suppressContentEditableWarning
              onInput={e => {
                const placeholder =
                  e.currentTarget.parentElement?.querySelector(
                    '[data-placeholder="notes"]'
                  ) as HTMLElement;
                if (placeholder) {
                  placeholder.style.display = e.currentTarget.textContent
                    ? 'none'
                    : '';
                }
              }}
              onBlur={handleNotesInput}
              className="cursor-text text-xs font-medium whitespace-pre-wrap text-neutral-800 outline-none dark:text-neutral-100"
              style={{
                minHeight: '1.5em',
                wordBreak: 'break-word',
              }}
            >
              {(() => {
                if (!currentNotes) return '';
                if (searchQuery) {
                  return (
                    <HighlightText
                      text={currentNotes || ''}
                      highlight={searchQuery}
                      className="text-neutral-700 dark:text-neutral-300"
                    />
                  );
                }
                return currentNotes;
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FlavorNotesSection;
