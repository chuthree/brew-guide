'use client';

import React, { useRef, useEffect } from 'react';
import { CoffeeBean } from '@/types/app';
import HighlightText from '@/components/common/ui/HighlightText';
import { calcInputWidth } from '../utils';

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

  const placeholder = currentFlavors.length === 0 ? '输入风味，空格分隔' : '+ ';

  return (
    <>
      {/* 风味 */}
      {(isAddMode || (bean?.flavor && bean.flavor.length > 0)) && (
        <div className="flex items-start">
          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            风味
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-1">
            {/* 已有的风味标签 */}
            {currentFlavors.map((flavor: string, index: number) => (
              <span
                key={index}
                contentEditable
                suppressContentEditableWarning
                onBlur={e => {
                  const newValue = e.currentTarget.textContent?.trim() || '';
                  if (newValue !== flavor) {
                    const newFlavors = [...currentFlavors];
                    if (newValue === '') {
                      newFlavors.splice(index, 1);
                    } else {
                      newFlavors[index] = newValue;
                    }
                    handleUpdateField({ flavor: newFlavors });
                  }
                }}
                className="cursor-text bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700 outline-none dark:bg-neutral-800/40 dark:text-neutral-300"
              >
                {flavor}
              </span>
            ))}
            {/* 添加模式：输入框 */}
            {isAddMode && (
              <input
                type="text"
                placeholder={placeholder}
                onInput={e => {
                  const input = e.currentTarget;
                  input.style.width = calcInputWidth(input.value, placeholder);
                }}
                onKeyDown={e => {
                  if (e.nativeEvent.isComposing) return;

                  const input = e.currentTarget;
                  const value = input.value.trim();

                  if (e.key === ' ' || e.key === 'Enter') {
                    if (value) {
                      e.preventDefault();
                      handleUpdateField({
                        flavor: [...currentFlavors, value],
                      });
                      input.value = '';
                      input.style.width = calcInputWidth('', '+');
                    }
                  }

                  if (
                    e.key === 'Backspace' &&
                    !value &&
                    currentFlavors.length > 0
                  ) {
                    e.preventDefault();
                    const lastFlavor =
                      currentFlavors[currentFlavors.length - 1];
                    const newFlavors = currentFlavors.slice(0, -1);
                    handleUpdateField({ flavor: newFlavors });
                    input.value = lastFlavor;
                    input.style.width = calcInputWidth(lastFlavor, '+');
                  }
                }}
                onBlur={e => {
                  const input = e.currentTarget;
                  const value = input.value.trim();
                  if (value) {
                    handleUpdateField({
                      flavor: [...currentFlavors, value],
                    });
                    input.value = '';
                  }
                  const newPlaceholder =
                    currentFlavors.length === 0 && !value
                      ? '输入风味，空格分隔'
                      : '+ ';
                  input.style.width = calcInputWidth('', newPlaceholder);
                }}
                className="bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700 placeholder:text-neutral-400 focus:outline-none dark:bg-neutral-800 dark:text-neutral-300 dark:placeholder:text-neutral-500"
                style={{ width: calcInputWidth('', placeholder) }}
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
