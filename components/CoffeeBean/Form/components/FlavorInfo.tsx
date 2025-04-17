import React from 'react';
import { motion } from 'framer-motion';
import AutocompleteInput from '@/components/AutocompleteInput';
import { ExtendedCoffeeBean } from '../types';
import { pageVariants, pageTransition, FLAVOR_TAGS, FLAVOR_CATEGORIES } from '../constants';

interface FlavorInfoProps {
    bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>;
    flavorInput: string;
    onFlavorInputChange: (value: string) => void;
    onAddFlavor: () => void;
    onRemoveFlavor: (flavor: string) => void;
}

const FlavorInfo: React.FC<FlavorInfoProps> = ({
    bean,
    flavorInput,
    onFlavorInputChange,
    onAddFlavor,
    onRemoveFlavor,
}) => {
    return (
        <motion.div
            key="flavor-step"
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="space-y-8 max-w-md mx-auto flex flex-col items-center justify-center h-full"
        >
            <div className="space-y-2 w-full">
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    已选风味标签
                </label>
                <div className="flex flex-wrap gap-2 pb-2">
                    {bean.flavor && bean.flavor.length > 0 ? (
                        bean.flavor.map((flavor, index) => (
                            <div
                                key={index}
                                className="flex items-center bg-neutral-200 dark:bg-neutral-800 rounded-full px-3 py-1"
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
                        <div className="text-neutral-500 dark:text-neutral-400 text-sm py-1 border-b border-neutral-300 dark:border-neutral-700 w-full">
                            尚未添加风味标签
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-2 w-full">
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    添加风味标签
                </label>
                <div className="flex items-center w-full">
                    <div className="flex-1 border-b border-neutral-300 dark:border-neutral-700">
                        <AutocompleteInput
                            value={flavorInput}
                            onChange={onFlavorInputChange}
                            placeholder="例如：柑橘"
                            suggestions={FLAVOR_TAGS.filter(tag => !bean.flavor?.includes(tag))}
                            className="w-full border-none"
                            onBlur={() => flavorInput.trim() && onAddFlavor()}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={onAddFlavor}
                        className="ml-3 h-[36px] px-4 flex items-center justify-center text-xs font-medium bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800 rounded-full"
                    >
                        添加
                    </button>
                </div>
            </div>

            <div className="space-y-4 w-full">
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    常用风味标签
                </label>

                {Object.entries(FLAVOR_CATEGORIES).map(([category, tags]) => (
                    <div key={category} className="space-y-2">
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            {category}
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {tags.map((flavor) => (
                                <button
                                    key={flavor}
                                    type="button"
                                    onClick={() => {
                                        if (bean.flavor?.includes(flavor)) {
                                            onRemoveFlavor(flavor);
                                        } else {
                                            onFlavorInputChange(flavor);
                                            onAddFlavor();
                                        }
                                    }}
                                    className={`rounded-full px-3 py-1 text-xs ${
                                        bean.flavor?.includes(flavor)
                                            ? 'bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800'
                                            : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                                    }`}
                                >
                                    {bean.flavor?.includes(flavor) ? `${flavor} ×` : flavor}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};

export default FlavorInfo; 