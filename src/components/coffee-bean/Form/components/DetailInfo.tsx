import React from 'react';
import { motion } from 'framer-motion';
import AutocompleteInput from '@/components/common/forms/AutocompleteInput';
import AutoResizeTextarea from '@/components/common/forms/AutoResizeTextarea';
import BlendComponents from './BlendComponents';
import { ExtendedCoffeeBean, BlendComponent } from '../types';
import { pageVariants, pageTransition } from '../constants';

interface DetailInfoProps {
    bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>;
    onBeanChange: (field: keyof Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>) => (value: string) => void;
    blendComponents: BlendComponent[];
    onBlendComponentsChange: {
        add: () => void;
        remove: (index: number) => void;
        change: (index: number, field: keyof BlendComponent, value: string | number) => void;
    };
    autoSetFlavorPeriod: () => void;
    toggleFrozenState: () => void;
}

// 咖啡豆类型选项
const BEAN_TYPES = [
    { value: 'filter', label: '手冲' },
    { value: 'espresso', label: '意式' },
];

const DetailInfo: React.FC<DetailInfoProps> = ({
    bean,
    onBeanChange,
    blendComponents,
    onBlendComponentsChange,
    autoSetFlavorPeriod,
    toggleFrozenState,
}) => {
    return (
        <motion.div
            key="detail-step"
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="space-y-8 max-w-md mx-auto flex flex-col items-center justify-center h-full"
        >
            <div className="grid grid-cols-1 gap-6 w-full">
                <div className="space-y-2">
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        咖啡豆类型
                    </label>
                    <div className="flex w-full border-b border-neutral-300 dark:border-neutral-700">
                        {BEAN_TYPES.map(type => (
                            <div
                                key={type.value}
                                className="w-1/2 relative py-2"
                                onClick={() => onBeanChange('beanType')(type.value)}
                            >
                                <button
                                    type="button"
                                    className={`w-full text-center transition-colors duration-200 ${
                                        bean.beanType === type.value
                                            ? 'text-neutral-800 dark:text-neutral-200'
                                            : 'text-neutral-500 dark:text-neutral-400'
                                    }`}
                                >
                                    {type.label}
                                </button>
                                {bean.beanType === type.value && (
                                    <div className="absolute -bottom-px left-0 w-full h-px bg-neutral-800 dark:bg-neutral-200"></div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <BlendComponents
                components={blendComponents}
                onAdd={onBlendComponentsChange.add}
                onRemove={onBlendComponentsChange.remove}
                onChange={onBlendComponentsChange.change}
            />

            <div className="space-y-4 w-full">
                <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        赏味期设置
                    </label>
                    <div className="flex space-x-2">
                        <button
                            type="button"
                            onClick={autoSetFlavorPeriod}
                            className="text-xs text-neutral-600 dark:text-neutral-400 underline"
                        >
                            按烘焙度重置
                        </button>
                        <button
                            type="button"
                            onClick={toggleFrozenState}
                            className={`text-xs ${bean.isFrozen ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-600 dark:text-neutral-400'} underline`}
                        >
                            {bean.isFrozen ? '取消冰冻状态' : '设为冰冻状态'}
                        </button>
                    </div>
                </div>
                {bean.isFrozen ? (
                    <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-md text-sm text-blue-800 dark:text-blue-200">
                        已设置为冰冻保存，冰冻状态下可随时饮用，无需设置养豆期和赏味期。
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="block text-xs text-neutral-500 dark:text-neutral-400">
                                    养豆期结束
                                </label>
                                <AutocompleteInput
                                    value={bean.startDay ? String(bean.startDay) : ''}
                                    onChange={onBeanChange('startDay')}
                                    placeholder="天数"
                                    unit="天"
                                    clearable={false}
                                    suggestions={[]}
                                    inputType="tel"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-xs text-neutral-500 dark:text-neutral-400">
                                    赏味期结束
                                </label>
                                <AutocompleteInput
                                    value={bean.endDay ? String(bean.endDay) : ''}
                                    onChange={onBeanChange('endDay')}
                                    placeholder="天数"
                                    unit="天"
                                    clearable={false}
                                    suggestions={[]}
                                    inputType="tel"
                                />
                            </div>
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                            <p>说明：{bean.startDay}天前为养豆期，{bean.startDay}-{bean.endDay}天为赏味期，{bean.endDay}天后赏味期结束</p>
                        </div>
                    </>
                )}
            </div>

            <div className="space-y-2 w-full">
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    备注
                </label>
                <AutoResizeTextarea
                    value={bean.notes || ''}
                    onChange={(e) => onBeanChange('notes')(e.target.value)}
                    placeholder="其他备注信息..."
                    className="w-full py-2 bg-transparent outline-hidden border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                />
            </div>
        </motion.div>
    );
};

export default DetailInfo; 