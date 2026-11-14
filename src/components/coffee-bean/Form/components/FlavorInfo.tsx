import React from 'react';
import { motion } from 'framer-motion';
import AutocompleteInput from '@/components/common/forms/AutocompleteInput';
import { ExtendedCoffeeBean } from '../types';
import { pageVariants, pageTransition } from '../constants';
import { useFlavorSuggestions } from '../hooks/useCoffeeBeanFieldSuggestions';

interface FlavorInfoProps {
  bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>;
  flavorInput: string;
  onFlavorInputChange: (value: string) => void;
  onAddFlavor: (flavorValue?: string) => void;
  onRemoveFlavor: (flavor: string) => void;
}

const FlavorInfo: React.FC<FlavorInfoProps> = ({
  bean,
  flavorInput,
  onFlavorInputChange,
  onAddFlavor,
  onRemoveFlavor,
}) => {
  const flavorSuggestions = useFlavorSuggestions();

  return (
    <motion.div
      key="flavor-step"
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className="mx-auto flex h-full max-w-md flex-col items-center justify-center space-y-8 pb-48"
    >
      <div className="w-full space-y-2">
        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
          已选风味标签
        </label>
        <div className="flex flex-wrap gap-2 pb-2">
          {bean.flavor && bean.flavor.length > 0 ? (
            bean.flavor.map((flavor: string) => (
              <div
                key={flavor}
                className="flex items-center rounded-full bg-neutral-200 px-3 py-1 dark:bg-neutral-800"
              >
                <span className="text-xs">{flavor}</span>
                <button
                  type="button"
                  onClick={() => onRemoveFlavor(flavor)}
                  className="ml-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                >
                  ×
                </button>
              </div>
            ))
          ) : (
            <div className="w-full border-b border-neutral-300 py-1 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
              尚未添加风味标签
            </div>
          )}
        </div>
      </div>

      <div className="w-full space-y-2">
        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
          添加风味标签
        </label>
        <div className="flex w-full items-center">
          <div className="flex-1 border-b border-neutral-300 dark:border-neutral-700">
            <AutocompleteInput
              value={flavorInput}
              onChange={onFlavorInputChange}
              placeholder="例如：柑橘, 花香"
              suggestions={flavorSuggestions.suggestions.filter(
                tag => !bean.flavor?.includes(tag)
              )}
              isCustomPreset={flavorSuggestions.isRemovableSuggestion}
              onRemovePreset={flavorSuggestions.removeSuggestion}
              className="w-full border-none"
              onSuggestionSelect={onAddFlavor}
              suggestionSelectMode="commit"
              onBlur={() => flavorInput.trim() && onAddFlavor()}
              onEnter={() => flavorInput.trim() && onAddFlavor()}
            />
          </div>
          <button
            type="button"
            onClick={() => onAddFlavor()}
            className="ml-3 flex h-[36px] items-center justify-center rounded-full bg-neutral-800 px-4 text-xs font-medium text-neutral-100 dark:bg-neutral-200 dark:text-neutral-800"
          >
            添加
          </button>
        </div>
      </div>

    </motion.div>
  );
};

export default FlavorInfo;
