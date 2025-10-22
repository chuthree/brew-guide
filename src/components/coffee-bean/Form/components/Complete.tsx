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
        <div className="flex justify-between border-b border-neutral-200 py-2 dark:border-neutral-700">
          <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
            类型
          </span>
          <span className="ml-4 max-w-[60%] truncate text-right text-sm font-medium">
            {blendComponents.length > 1 ? '拼配' : '单品'}
          </span>
        </div>
        <div className="flex justify-between border-b border-neutral-200 py-2 dark:border-neutral-700">
          <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
            用途
          </span>
          <span className="ml-4 max-w-[60%] truncate text-right text-sm font-medium">
            {bean.beanType === 'filter' ? '手冲' : '意式'}
          </span>
        </div>
        <div className="flex justify-between border-b border-neutral-200 py-2 dark:border-neutral-700">
          <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
            总容量
          </span>
          <span className="ml-4 max-w-[60%] truncate text-right text-sm font-medium">
            {bean.capacity}g
          </span>
        </div>
        <div className="flex justify-between border-b border-neutral-200 py-2 dark:border-neutral-700">
          <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
            烘焙度
          </span>
          <span className="ml-4 max-w-[60%] truncate text-right text-sm font-medium">
            {bean.roastLevel}
          </span>
        </div>
        {/* 单品豆信息从 blendComponents 获取 */}
        {blendComponents.length === 1 && blendComponents[0].origin && (
          <div className="flex justify-between border-b border-neutral-200 py-2 dark:border-neutral-700">
            <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
              产地
            </span>
            <span className="ml-4 max-w-[60%] truncate text-right text-sm font-medium">
              {blendComponents[0].origin}
            </span>
          </div>
        )}
        {blendComponents.length === 1 && blendComponents[0].process && (
          <div className="flex justify-between border-b border-neutral-200 py-2 dark:border-neutral-700">
            <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
              处理法
            </span>
            <span className="ml-4 max-w-[60%] truncate text-right text-sm font-medium">
              {blendComponents[0].process}
            </span>
          </div>
        )}
        {blendComponents.length === 1 && blendComponents[0].variety && (
          <div className="flex justify-between border-b border-neutral-200 py-2 dark:border-neutral-700">
            <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
              品种
            </span>
            <span className="ml-4 max-w-[60%] truncate text-right text-sm font-medium">
              {blendComponents[0].variety}
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
        <div className="flex justify-between border-b border-neutral-200 py-2 dark:border-neutral-700">
          <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
            赏味期
          </span>
          <span className="ml-4 max-w-[60%] truncate text-right text-sm font-medium">
            {bean.startDay}-{bean.endDay}天
          </span>
        </div>
        {blendComponents.length > 0 && (
          <div className="flex flex-col border-b border-neutral-200 py-2 dark:border-neutral-700">
            <div className="mb-2 flex justify-between">
              <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
                咖啡豆成分
              </span>
              <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
                {blendComponents.length > 1 &&
                blendComponents.some(comp => comp.percentage !== undefined)
                  ? '比例'
                  : ''}
              </span>
            </div>
            <div className="space-y-3">
              {blendComponents.map((comp, index) => (
                <div key={index} className="text-left">
                  <div className="flex items-center justify-between">
                    <span className="max-w-[70%] truncate text-sm font-medium">
                      成分 #{index + 1}
                    </span>
                    {blendComponents.length > 1 &&
                      comp.percentage !== undefined && (
                        <span className="shrink-0 text-sm font-medium">
                          {comp.percentage}%
                        </span>
                      )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {comp.origin && (
                      <span className="inline-block max-w-[90%] truncate rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">
                        {comp.origin}
                      </span>
                    )}
                    {comp.process && (
                      <span className="inline-block max-w-[90%] truncate rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">
                        {comp.process}
                      </span>
                    )}
                    {comp.variety && (
                      <span className="inline-block max-w-[90%] truncate rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">
                        {comp.variety}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Complete;
