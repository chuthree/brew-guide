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
            className="flex flex-col items-center justify-center pt-10 space-y-8 text-center relative"
        >
            <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <Check className="w-8 h-8 text-neutral-800 dark:text-neutral-200" />
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
                <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                    <span className="text-sm text-neutral-500 dark:text-neutral-400 flex-shrink-0">咖啡豆名称</span>
                    <span className="text-sm font-medium truncate ml-4 max-w-[60%] text-right">{bean.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                    <span className="text-sm text-neutral-500 dark:text-neutral-400 flex-shrink-0">类型</span>
                    <span className="text-sm font-medium truncate ml-4 max-w-[60%] text-right">{bean.type}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                    <span className="text-sm text-neutral-500 dark:text-neutral-400 flex-shrink-0">总容量</span>
                    <span className="text-sm font-medium truncate ml-4 max-w-[60%] text-right">{bean.capacity}g</span>
                </div>
                <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                    <span className="text-sm text-neutral-500 dark:text-neutral-400 flex-shrink-0">烘焙度</span>
                    <span className="text-sm font-medium truncate ml-4 max-w-[60%] text-right">{bean.roastLevel}</span>
                </div>
                {bean.type === '单品' && bean.origin && (
                    <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                        <span className="text-sm text-neutral-500 dark:text-neutral-400 flex-shrink-0">产地</span>
                        <span className="text-sm font-medium truncate ml-4 max-w-[60%] text-right">{bean.origin}</span>
                    </div>
                )}
                {bean.type === '单品' && bean.process && (
                    <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                        <span className="text-sm text-neutral-500 dark:text-neutral-400 flex-shrink-0">处理法</span>
                        <span className="text-sm font-medium truncate ml-4 max-w-[60%] text-right">{bean.process}</span>
                    </div>
                )}
                {bean.type === '单品' && bean.variety && (
                    <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                        <span className="text-sm text-neutral-500 dark:text-neutral-400 flex-shrink-0">品种</span>
                        <span className="text-sm font-medium truncate ml-4 max-w-[60%] text-right">{bean.variety}</span>
                    </div>
                )}
                {bean.flavor && bean.flavor.length > 0 && (
                    <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                        <span className="text-sm text-neutral-500 dark:text-neutral-400 flex-shrink-0">风味</span>
                        <span className="text-sm font-medium truncate ml-4 max-w-[60%] text-right">{bean.flavor.join(', ')}</span>
                    </div>
                )}
                <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                    <span className="text-sm text-neutral-500 dark:text-neutral-400 flex-shrink-0">赏味期</span>
                    <span className="text-sm font-medium truncate ml-4 max-w-[60%] text-right">{bean.startDay}-{bean.endDay}天</span>
                </div>
                {bean.type === '拼配' && blendComponents.length > 0 && (
                    <div className="flex flex-col py-2 border-b border-neutral-200 dark:border-neutral-700">
                        <div className="flex justify-between mb-2">
                            <span className="text-sm text-neutral-500 dark:text-neutral-400 flex-shrink-0">拼配成分</span>
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 flex-shrink-0">
                                {blendComponents.some(comp => comp.percentage !== undefined) ? '比例' : ''}
                            </span>
                        </div>
                        <div className="space-y-3">
                            {blendComponents.map((comp, index) => (
                                <div key={index} className="text-left">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium truncate max-w-[70%]">成分 #{index + 1}</span>
                                        {comp.percentage !== undefined && (
                                            <span className="text-sm font-medium flex-shrink-0">{comp.percentage}%</span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {comp.origin && (
                                            <span className="inline-block px-2 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 rounded-full truncate max-w-[90%]">
                                                {comp.origin}
                                            </span>
                                        )}
                                        {comp.process && (
                                            <span className="inline-block px-2 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 rounded-full truncate max-w-[90%]">
                                                {comp.process}
                                            </span>
                                        )}
                                        {comp.variety && (
                                            <span className="inline-block px-2 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 rounded-full truncate max-w-[90%]">
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