import React from 'react';
import { motion } from 'framer-motion';
import { CustomEquipment } from '@/lib/core/config';
import { isEspressoMachine } from '@/lib/utils/equipmentUtils';

// 动画变体
const pageVariants = {
  initial: { opacity: 0 },
  in: { opacity: 1 },
  out: { opacity: 0 },
};

const pageTransition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.26,
};

interface ParamsStepProps {
  params: {
    coffee: string;
    water: string;
    ratio: string;
    grindSize: string;
    temp: string;
    // 意式机特有参数
    extractionTime?: number;
    liquidWeight?: string;
  };
  onCoffeeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRatioChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGrindSizeChange: (grindSize: string) => void;
  onTempChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  // 意式机特有参数的处理函数
  onExtractionTimeChange?: (value: number) => void;
  onLiquidWeightChange?: (value: string) => void;
  customEquipment?: CustomEquipment;
}

const ParamsStep: React.FC<ParamsStepProps> = ({
  params,
  onCoffeeChange,
  onRatioChange,
  onGrindSizeChange,
  onTempChange,
  onExtractionTimeChange,
  onLiquidWeightChange,
  customEquipment,
}) => {
  // 检查是否是意式机
  const isEspresso = customEquipment
    ? isEspressoMachine(customEquipment)
    : false;

  return (
    <motion.div
      key="params-step"
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className="mx-auto max-w-md space-y-10 pt-10 pb-20"
    >
      <div className="grid grid-cols-2 gap-6">
        {/* 咖啡粉量 */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            咖啡粉量
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder={isEspresso ? '例如：18' : '例如：15'}
              value={params.coffee.replace('g', '')}
              onChange={onCoffeeChange}
              onFocus={e => e.target.select()}
              className="w-full border-b border-neutral-300 bg-transparent py-2 outline-hidden focus:border-neutral-800 dark:border-neutral-700 dark:focus:border-neutral-400"
            />
            <span className="absolute right-0 bottom-2 text-neutral-500 dark:text-neutral-400">
              g
            </span>
          </div>
        </div>

        {/* 水粉比 */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            水粉比
          </label>
          <div className="relative">
            <span className="absolute bottom-2 left-0 text-neutral-500 dark:text-neutral-400">
              1:
            </span>
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder={isEspresso ? '例如：2' : '例如：15'}
              value={params.ratio.replace('1:', '')}
              onChange={onRatioChange}
              onFocus={e => e.target.select()}
              className="w-full border-b border-neutral-300 bg-transparent py-2 pl-6 outline-hidden focus:border-neutral-800 dark:border-neutral-700 dark:focus:border-neutral-400"
            />
          </div>
        </div>

        {/* 意式机特有字段 - 液重 */}
        {isEspresso && (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
              液重
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="例如：36"
                value={(params.liquidWeight || params.water).replace('g', '')}
                onChange={e => {
                  if (onLiquidWeightChange) {
                    onLiquidWeightChange(`${e.target.value}g`);
                  }
                }}
                onFocus={e => e.target.select()}
                className="w-full border-b border-neutral-300 bg-transparent py-2 outline-hidden focus:border-neutral-800 dark:border-neutral-700 dark:focus:border-neutral-400"
              />
              <span className="absolute right-0 bottom-2 text-neutral-500 dark:text-neutral-400">
                g
              </span>
            </div>
          </div>
        )}

        {/* 意式机特有字段 - 萃取时间 */}
        {isEspresso && (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
              萃取时间
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1"
                placeholder="例如：25"
                value={params.extractionTime || ''}
                onChange={e => {
                  if (onExtractionTimeChange) {
                    onExtractionTimeChange(parseInt(e.target.value) || 0);
                  }
                }}
                onFocus={e => e.target.select()}
                className="w-full border-b border-neutral-300 bg-transparent py-2 outline-hidden focus:border-neutral-800 dark:border-neutral-700 dark:focus:border-neutral-400"
              />
              <span className="absolute right-0 bottom-2 text-neutral-500 dark:text-neutral-400">
                秒
              </span>
            </div>
          </div>
        )}

        {/* 研磨度 */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            研磨度
          </label>
          <input
            type="text"
            value={params.grindSize || ''}
            onChange={e => onGrindSizeChange(e.target.value)}
            onFocus={e => e.target.select()}
            placeholder={
              isEspresso ? '例如：特细、浓缩咖啡级' : '例如：中细、特细、中粗等'
            }
            className="w-full border-b border-neutral-300 bg-transparent py-2 outline-hidden focus:border-neutral-800 dark:border-neutral-700 dark:focus:border-neutral-400"
          />
        </div>

        {/* 只在非意式机模式下显示水温字段 */}
        {!isEspresso && (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
              水温
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="例如：92"
                value={params.temp ? params.temp.replace('°C', '') : ''}
                onChange={onTempChange}
                onFocus={e => e.target.select()}
                className="w-full border-b border-neutral-300 bg-transparent py-2 outline-hidden focus:border-neutral-800 dark:border-neutral-700 dark:focus:border-neutral-400"
              />
              <span className="absolute right-0 bottom-2 text-neutral-500 dark:text-neutral-400">
                °C
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ParamsStep;
