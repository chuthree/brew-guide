import React from 'react';
import AutocompleteInput from '@/components/common/forms/AutocompleteInput';
import { BlendComponent } from '../types';
import { ORIGINS, PROCESSES, VARIETIES } from '../constants';

interface BlendComponentsProps {
    components: BlendComponent[];
    onAdd: () => void;
    onRemove: (index: number) => void;
    onChange: (index: number, field: keyof BlendComponent, value: string | number) => void;
}

const BlendComponents: React.FC<BlendComponentsProps> = ({
    components,
    onAdd,
    onRemove,
    onChange,
}) => {
    return (
        <div className="space-y-5 w-full">
            <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    咖啡豆成分
                </label>
                <button
                    type="button"
                    onClick={onAdd}
                    className="text-xs px-3 py-1 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                >
                    添加成分
                </button>
            </div>

            <div className="space-y-4">
                {components.map((component, index) => (
                    <div
                        key={index}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                成分 #{index + 1}
                            </span>
                            {components.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => onRemove(index)}
                                    className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                                >
                                    移除
                                </button>
                            )}
                        </div>

                        {components.length > 1 && (
                            <div className="space-y-1 mb-3">
                                <label className="block text-xs text-neutral-500 dark:text-neutral-400">
                                    比例 (可选)
                                </label>
                                <AutocompleteInput
                                    value={component.percentage !== undefined ? component.percentage.toString() : ''}
                                    onChange={(value) => onChange(index, 'percentage', value)}
                                    placeholder="0-100"
                                    unit="%"
                                    inputType="tel"
                                    clearable={true}
                                    suggestions={[]}
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-3">
                            <AutocompleteInput
                                label="产地"
                                value={component.origin || ''}
                                onChange={(value) => onChange(index, 'origin', value)}
                                placeholder="产地"
                                suggestions={ORIGINS}
                                clearable
                            />

                            <AutocompleteInput
                                label="处理法"
                                value={component.process || ''}
                                onChange={(value) => onChange(index, 'process', value)}
                                placeholder="处理法"
                                suggestions={PROCESSES}
                                clearable
                            />

                            <AutocompleteInput
                                label="品种"
                                value={component.variety || ''}
                                onChange={(value) => onChange(index, 'variety', value)}
                                placeholder="品种"
                                suggestions={VARIETIES}
                                clearable
                            />
                        </div>
                    </div>
                ))}
            </div>

            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                <p>提示：单一成分为单品咖啡豆，多种成分为拼配咖啡豆。比例为可选项，如需添加请确保各成分比例总和为100%</p>
            </div>
        </div>
    );
};

export default BlendComponents; 