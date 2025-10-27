import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { ExtendedCoffeeBean, BlendComponent } from '../types';
import { pageVariants, pageTransition } from '../constants';

interface CompleteProps {
  bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>;
  blendComponents: BlendComponent[];
  isEdit: boolean;
}

const Complete: React.FC<CompleteProps> = ({
  bean,
  blendComponents,
  isEdit,
}) => {
  return (
    <motion.div
      key="complete-step"
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className="relative flex flex-col items-center justify-center space-y-8 pt-10 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
        <Check className="h-8 w-8 text-neutral-800 dark:text-neutral-200" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-medium text-neutral-800 dark:text-neutral-200">
          {isEdit ? '咖啡豆编辑完成' : '咖啡豆添加完成'}
        </h3>
        <p className="text-neutral-600 dark:text-neutral-400">
          你的咖啡豆信息已经准备就绪
        </p>
      </div>
      <div className="w-full space-y-4">
        <div className="flex justify-between border-b border-neutral-200 py-2 dark:border-neutral-700">
          <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
            咖啡豆名称
          </span>
          <span className="ml-4 max-w-[60%] truncate text-right text-sm font-medium">
            {bean.name}
          </span>
        </div>
        {!!bean.capacity && (
          <div className="flex justify-between border-b border-neutral-200 py-2 dark:border-neutral-700">
            <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
              库存量
            </span>
            <span className="ml-4 max-w-[60%] truncate text-right text-sm font-medium">
              {bean.remaining || bean.capacity}g / {bean.capacity}g
            </span>
          </div>
        )}
        {!!bean.price && (
          <div className="flex justify-between border-b border-neutral-200 py-2 dark:border-neutral-700">
            <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
              价格
            </span>
            <span className="ml-4 max-w-[60%] truncate text-right text-sm font-medium">
              ¥{bean.price}
            </span>
          </div>
        )}
        {!!bean.roastLevel && (
          <div className="flex justify-between border-b border-neutral-200 py-2 dark:border-neutral-700">
            <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
              烘焙度
            </span>
            <span className="ml-4 max-w-[60%] truncate text-right text-sm font-medium">
              {bean.roastLevel}
            </span>
          </div>
        )}
        {!!bean.roastDate && !bean.isInTransit && (
          <div className="flex justify-between border-b border-neutral-200 py-2 dark:border-neutral-700">
            <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
              烘焙日期
            </span>
            <span className="ml-4 max-w-[60%] truncate text-right text-sm font-medium">
              {bean.roastDate}
            </span>
          </div>
        )}
        {!!bean.isInTransit && (
          <div className="flex justify-between border-b border-neutral-200 py-2 dark:border-neutral-700">
            <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
              状态
            </span>
            <span className="ml-4 max-w-[60%] truncate text-right text-sm font-medium">
              在途中
            </span>
          </div>
        )}
        {!!bean.beanType && (
          <div className="flex justify-between border-b border-neutral-200 py-2 dark:border-neutral-700">
            <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
              咖啡豆类型
            </span>
            <span className="ml-4 max-w-[60%] truncate text-right text-sm font-medium">
              {bean.beanType === 'filter'
                ? '手冲'
                : bean.beanType === 'espresso'
                  ? '意式'
                  : bean.beanType === 'omni'
                    ? '全能'
                    : bean.beanType}
            </span>
          </div>
        )}
        {blendComponents && blendComponents.length > 0 && (
          <div className="flex justify-between border-b border-neutral-200 py-2 dark:border-neutral-700">
            <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
              咖啡豆成分
            </span>
            <div className="ml-4 flex max-w-[60%] flex-col items-end gap-1 text-right text-sm font-medium">
              {blendComponents.map((comp, index) => {
                // 构建成分文本：产地 · 处理法 · 品种
                const componentParts = [
                  comp.origin,
                  comp.process,
                  comp.variety,
                ].filter(Boolean);
                const componentText =
                  componentParts.length > 0 ? componentParts.join(' · ') : '—';

                return (
                  <span key={index} className="flex items-center gap-2">
                    <span className="truncate">{componentText}</span>
                    {blendComponents.length > 1 &&
                      comp.percentage !== undefined && (
                        <span className="shrink-0 text-neutral-500 dark:text-neutral-400">
                          {comp.percentage}%
                        </span>
                      )}
                  </span>
                );
              })}
            </div>
          </div>
        )}
        {!bean.isInTransit &&
          !bean.isFrozen &&
          !!bean.startDay &&
          !!bean.endDay && (
            <div className="flex justify-between border-b border-neutral-200 py-2 dark:border-neutral-700">
              <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
                赏味期
              </span>
              <span className="ml-4 max-w-[60%] truncate text-right text-sm font-medium">
                {bean.startDay}-{bean.endDay}天
              </span>
            </div>
          )}
        {!!bean.isFrozen && (
          <div className="flex justify-between border-b border-neutral-200 py-2 dark:border-neutral-700">
            <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
              状态
            </span>
            <span className="ml-4 max-w-[60%] truncate text-right text-sm font-medium">
              冷冻中
            </span>
          </div>
        )}
        {bean.flavor && bean.flavor.length > 0 && (
          <div className="flex justify-between border-b border-neutral-200 py-2 dark:border-neutral-700">
            <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
              风味
            </span>
            <span className="ml-4 max-w-[60%] truncate text-right text-sm font-medium">
              {bean.flavor.join(', ')}
            </span>
          </div>
        )}
        {bean.notes && bean.notes.trim() && (
          <div className="flex justify-between border-b border-neutral-200 py-2 dark:border-neutral-700">
            <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
              备注
            </span>
            <span className="ml-4 max-w-[60%] text-right text-sm font-medium">
              {bean.notes}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Complete;
