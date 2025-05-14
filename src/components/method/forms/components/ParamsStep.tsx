import React from 'react';
import { motion } from 'framer-motion';
import { formatGrindSize } from '@/lib/utils/grindUtils';
import { Grinder, availableGrinders } from '@/lib/core/config';
import { SettingsOptions } from '@/components/settings/Settings';

// 添加动画变体
const pageVariants = {
  initial: {
    opacity: 0,
  },
  in: {
    opacity: 1,
  },
  out: {
    opacity: 0,
  }
};

const pageTransition = {
  type: "tween",
  ease: "anticipate",
  duration: 0.26
};

interface ParamsStepProps {
  params: {
    coffee: string;
    water: string;
    ratio: string;
    grindSize: string;
    temp: string;
  };
  onCoffeeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRatioChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGrindSizeChange: (grindSize: string) => void;
  onTempChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  settings: SettingsOptions;
}

const ParamsStep: React.FC<ParamsStepProps> = ({ 
  params, 
  onCoffeeChange, 
  onRatioChange, 
  onGrindSizeChange,
  onTempChange,
  settings 
}) => {
  // Find the selected grinder based on settings
  const selectedGrinder = availableGrinders.find((g: Grinder) => g.id === settings.grindType);
  const grinderName = selectedGrinder ? selectedGrinder.name : '通用';
  const showSpecificGrindInfo = selectedGrinder && selectedGrinder.id !== 'generic' && selectedGrinder.grindSizes;

  return (
    <motion.div
      key="params-step"
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className="space-y-10 max-w-md mx-auto pt-10 pb-20"
    >
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            咖啡粉量
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder='例如：15'
              value={params.coffee.replace('g', '')}
              onChange={onCoffeeChange}
              onFocus={(e) => e.target.select()}
              className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
            />
            <span className="absolute right-0 bottom-2 text-neutral-500 dark:text-neutral-400">g</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            水粉比
          </label>
          <div className="relative">
            <span className="absolute left-0 bottom-2 text-neutral-500 dark:text-neutral-400">1:</span>
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder='例如：15'
              value={params.ratio.replace('1:', '')}
              onChange={onRatioChange}
              onFocus={(e) => e.target.select()}
              className="w-full py-2 pl-6 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            研磨度 {grinderName !== '通用' && <span className="text-xs text-neutral-400">({grinderName})</span>}
          </label>
          <input
            type="text"
            value={params.grindSize || ''}
            onChange={(e) => onGrindSizeChange(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder={
              // Provide example based on selected grinder
              selectedGrinder?.id === "phanci_pro"
                ? "例如：中细、特细 (可自动转为对应格数)"
                : "例如：中细、特细、中粗等"
            }
            className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
          />
          {params.grindSize && showSpecificGrindInfo && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              参考{grinderName}刻度：{formatGrindSize(params.grindSize, settings.grindType)}
            </p>
          )}

          {/* 研磨度参考提示 */}
          {!params.grindSize && (
            <div className="mt-1 text-xs space-y-1">
              <p className="text-neutral-500 dark:text-neutral-400">研磨度参考 (可自由输入):</p>
              {selectedGrinder && selectedGrinder.grindSizes ? (
                // Show specific hints if available
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {Object.entries(selectedGrinder.grindSizes)
                    .filter(([key]) => {
                      // 只显示粗细度类型，而不是冲煮器具名称
                      const basicKeywords = ['极细', '特细', '细', '中细', '中细偏粗', '中粗', '粗', '特粗'];
                      return basicKeywords.includes(key);
                    })
                    .map(([key, value]) => (
                      <p key={key} className="text-neutral-500 dark:text-neutral-400">· {key}: {value}</p>
                    ))
                  }
                </div>
              ) : (
                // Show generic hints
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <p className="text-neutral-500 dark:text-neutral-400">· 极细 特细</p>
                  <p className="text-neutral-500 dark:text-neutral-400">· 细</p>
                  <p className="text-neutral-500 dark:text-neutral-400">· 中细</p>
                  <p className="text-neutral-500 dark:text-neutral-400">· 中粗 粗</p>
                </div>
              )}
            </div>
          )}
        </div>

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
              placeholder='例如：92'
              value={params.temp ? params.temp.replace('°C', '') : ''}
              onChange={onTempChange}
              onFocus={(e) => e.target.select()}
              className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
            />
            <span className="absolute right-0 bottom-2 text-neutral-500 dark:text-neutral-400">°C</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ParamsStep; 