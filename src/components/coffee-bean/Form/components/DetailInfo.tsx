import React from 'react';
import { motion } from 'framer-motion';
import AutocompleteInput from '@/components/common/forms/AutocompleteInput';
import AutoResizeTextarea from '@/components/common/forms/AutoResizeTextarea';
import BlendComponents from './BlendComponents';
import { ExtendedCoffeeBean, BlendComponent } from '../types';
import { pageVariants, pageTransition } from '../constants';

interface DetailInfoProps {
  bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>;
  onBeanChange: (
    field: keyof Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>
  ) => (value: string) => void;
  blendComponents: BlendComponent[];
  onBlendComponentsChange: {
    add: () => void;
    remove: (index: number) => void;
    change: (
      index: number,
      field: keyof BlendComponent,
      value: string | number
    ) => void;
  };
  autoSetFlavorPeriod: () => void;
  toggleFrozenState: () => void;
}

// 咖啡豆类型选项
const BEAN_TYPES = [
  { value: 'filter', label: '手冲' },
  { value: 'espresso', label: '意式' },
  { value: 'omni', label: '全能' },
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
      className="mx-auto flex h-full max-w-md flex-col items-center justify-center space-y-8"
    >
      <div className="grid w-full grid-cols-1 gap-6">
        <div className="space-y-2">
          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            咖啡豆类型
          </label>
          <div className="flex w-full border-b border-neutral-300 dark:border-neutral-700">
            {BEAN_TYPES.map(type => (
              <div
                key={type.value}
                className="relative flex-1 py-2"
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
                  <div className="absolute -bottom-px left-0 h-px w-full bg-neutral-800 dark:bg-neutral-200"></div>
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

      {!bean.isInTransit && !bean.isFrozen && (
        <div className="w-full space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
              赏味期设置
            </label>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => autoSetFlavorPeriod()}
                className="text-xs text-neutral-600 underline dark:text-neutral-400"
              >
                按烘焙度重置
              </button>
              <button
                type="button"
                onClick={toggleFrozenState}
                className="text-xs text-neutral-600 underline dark:text-neutral-400"
              >
                设为冷冻状态
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs text-neutral-500 dark:text-neutral-400">
                养豆期结束 (天)
              </label>
              <AutocompleteInput
                value={bean.startDay ? String(bean.startDay) : ''}
                onChange={onBeanChange('startDay')}
                placeholder="天数"
                clearable={false}
                suggestions={[]}
                inputType="tel"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-neutral-500 dark:text-neutral-400">
                赏味期结束 (天)
              </label>
              <AutocompleteInput
                value={bean.endDay ? String(bean.endDay) : ''}
                onChange={onBeanChange('endDay')}
                placeholder="天数"
                clearable={false}
                suggestions={[]}
                inputType="tel"
              />
            </div>
          </div>
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            <p>
              说明：{bean.startDay}天前为养豆期，{bean.startDay}-{bean.endDay}
              天为赏味期，{bean.endDay}天后赏味期结束
            </p>
          </div>
        </div>
      )}

      {bean.isFrozen && !bean.isInTransit && (
        <div className="w-full space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
              状态设置
            </label>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={toggleFrozenState}
                className="text-xs text-neutral-600 underline dark:text-neutral-400"
              >
                取消冷冻状态
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full space-y-2">
        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
          备注
        </label>
        <AutoResizeTextarea
          value={bean.notes || ''}
          onChange={e => onBeanChange('notes')(e.target.value)}
          placeholder="其他备注信息..."
          className="w-full border-b border-neutral-300 bg-transparent py-2 outline-hidden focus:border-neutral-800 dark:border-neutral-700 dark:focus:border-neutral-400"
          minRows={2}
          maxRows={8}
        />
      </div>
    </motion.div>
  );
};

export default DetailInfo;
