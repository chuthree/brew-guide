import React, { useRef, useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import AutocompleteInput from '@/components/common/forms/AutocompleteInput';
import { CustomEquipment } from '@/lib/core/config';
import { Stage } from './types';
import {
  isEspressoMachine,
  getPourTypeName as _getPourTypeName,
} from '@/lib/utils/equipmentUtils';
import {
  calculateTotalDuration,
  calculateTotalWater,
} from '@/lib/brewing/stageUtils';

const PRESET_BEVERAGES = ['饮用水', '冰块', '纯牛奶', '厚椰乳', '燕麦奶'];

const pageVariants = {
  initial: { opacity: 0 },
  in: { opacity: 1 },
  out: { opacity: 0 },
};

const pageTransition = { duration: 0.26 };

interface StagesStepProps {
  stages: Stage[];
  totalWater: string;
  customEquipment: CustomEquipment;
  onStageChange: (
    index: number,
    field: keyof Stage,
    value: string | number
  ) => void;
  onPourTypeChange: (index: number, value: string) => void;
  toggleValveStatus: (index: number) => void;
  addStage: () => void;
  removeStage: (index: number) => void;
  formatTime: (seconds: number) => string;
  showWaterTooltip: number | null;
  setShowWaterTooltip: React.Dispatch<React.SetStateAction<number | null>>;
  stagesContainerRef: React.RefObject<HTMLDivElement | null>;
  newStageRef?: React.RefObject<HTMLDivElement | null>;
  coffeeDosage?: string;
  editingDuration: { index: number; value: string } | null;
  setEditingDuration: React.Dispatch<
    React.SetStateAction<{ index: number; value: string } | null>
  >;
  editingWater: { index: number; value: string } | null;
  setEditingWater: React.Dispatch<
    React.SetStateAction<{ index: number; value: string } | null>
  >;
}

const StagesStep: React.FC<StagesStepProps> = ({
  stages,
  totalWater,
  customEquipment,
  onStageChange,
  onPourTypeChange,
  toggleValveStatus,
  addStage,
  removeStage,
  formatTime,
  showWaterTooltip: _showWaterTooltip,
  setShowWaterTooltip: _setShowWaterTooltip,
  stagesContainerRef,
  newStageRef,
  coffeeDosage = '15g',
  editingDuration,
  setEditingDuration,
  editingWater,
  setEditingWater,
}) => {
  const innerNewStageRef = useRef<HTMLDivElement>(null);
  const [beverageSuggestions, setBeverageSuggestions] =
    useState<string[]>(PRESET_BEVERAGES);

  useEffect(() => {
    try {
      const savedSuggestions = localStorage.getItem('userBeverageSuggestions');
      if (savedSuggestions) {
        const parsedSuggestions = JSON.parse(savedSuggestions) as string[];
        setBeverageSuggestions(
          Array.from(new Set([...PRESET_BEVERAGES, ...parsedSuggestions]))
        );
      }
    } catch (error) {
      console.error('Failed to load beverage suggestions:', error);
    }
  }, []);

  const stageNumbers = useMemo(() => {
    const numbers: (number | null)[] = [];
    let currentStageNumber = 1;
    stages.forEach(stage => {
      if (stage.pourType === 'wait') {
        numbers.push(null);
      } else {
        numbers.push(currentStageNumber);
        currentStageNumber++;
      }
    });
    return numbers;
  }, [stages]);

  const handleBeverageChange = (index: number, value: string) => {
    onStageChange(index, 'label', value);
  };

  const handleRemoveBeverage = (value: string) => {
    if (PRESET_BEVERAGES.includes(value)) return;
    try {
      const savedSuggestions = localStorage.getItem('userBeverageSuggestions');
      if (savedSuggestions) {
        const userBeverages = JSON.parse(savedSuggestions) as string[];
        const updatedBeverages = userBeverages.filter(item => item !== value);
        localStorage.setItem(
          'userBeverageSuggestions',
          JSON.stringify(updatedBeverages)
        );
        setBeverageSuggestions(prev => prev.filter(item => item !== value));
      }
    } catch (error) {
      console.error('删除饮料名称失败:', error);
    }
  };

  const isCustomBeverage = (value: string) => !PRESET_BEVERAGES.includes(value);

  const formatEspressoTotalWater = () => {
    if (!stages || stages.length === 0) return '0g';
    const waterByName: Record<
      string,
      { label: string; water: number; count: number }
    > = {};

    stages.forEach(stage => {
      if (!stage.water) return;
      const waterValue =
        typeof stage.water === 'number'
          ? stage.water
          : parseInt(stage.water.toString().replace('g', '') || '0');
      if (waterValue <= 0) return;

      const displayLabel =
        stage.pourType === 'extraction'
          ? '萃取浓缩'
          : stage.label || (stage.pourType === 'beverage' ? '饮料' : '其他');
      const key = `${stage.pourType}_${displayLabel}`;

      if (waterByName[key]) {
        waterByName[key].water += waterValue;
        waterByName[key].count += 1;
      } else {
        waterByName[key] = { label: displayLabel, water: waterValue, count: 1 };
      }
    });

    const waterItems = Object.values(waterByName);
    if (waterItems.length === 0) return '0g';

    return waterItems
      .map(item => {
        const countSuffix = item.count > 1 ? `×${item.count}` : '';
        return `${item.water}g(${item.label}${countSuffix})`;
      })
      .join(' + ');
  };

  const calculateTotalTime = () => calculateTotalDuration(stages);
  const calculateCurrentWater = () => calculateTotalWater(stages);

  const getPourTypeOptions = () => {
    if (isEspressoMachine(customEquipment)) {
      return [
        { value: 'extraction', label: '萃取浓缩' },
        { value: 'beverage', label: '饮料' },
        { value: 'other', label: '其他' },
      ];
    }

    const options: { value: string; label: string }[] = [];

    if (
      customEquipment.customPourAnimations &&
      customEquipment.customPourAnimations.length > 0
    ) {
      customEquipment.customPourAnimations
        .filter(anim => !anim.isSystemDefault)
        .forEach(animation => {
          options.push({ value: animation.id, label: animation.name });
        });

      if (customEquipment.animationType !== 'custom') {
        customEquipment.customPourAnimations
          .filter(anim => anim.isSystemDefault && anim.pourType)
          .forEach(animation => {
            options.push({
              value: animation.pourType || '',
              label: animation.name,
            });
          });

        const defaultTypes = [
          { type: 'center', label: '中心注水' },
          { type: 'circle', label: '绕圈注水' },
          { type: 'ice', label: '添加冰块' },
          { type: 'bypass', label: 'Bypass' },
        ];
        defaultTypes.forEach(({ type, label }) => {
          if (
            !customEquipment.customPourAnimations?.some(
              a => a.pourType === type
            )
          ) {
            options.push({ value: type, label });
          }
        });
        options.push({ value: 'wait', label: '等待' });
        options.push({ value: 'other', label: '其他方式' });
      } else {
        options.push({ value: 'wait', label: '等待' });
        options.push({ value: 'other', label: '其他方式' });
      }
    } else {
      if (customEquipment.animationType === 'custom') {
        options.push({ value: 'wait', label: '等待' });
        options.push({ value: 'other', label: '其他方式' });
      } else {
        options.push({ value: 'center', label: '中心注水' });
        options.push({ value: 'circle', label: '绕圈注水' });
        options.push({ value: 'ice', label: '添加冰块' });
        options.push({ value: 'bypass', label: 'Bypass' });
        options.push({ value: 'wait', label: '等待' });
        options.push({ value: 'other', label: '其他方式' });
      }
    }

    return options;
  };

  const handleWaterBlur = (index: number, value: string) => {
    setEditingWater(null);
    if (!value.trim()) {
      onStageChange(index, 'water', '');
      return;
    }

    const totalWaterValue = parseInt(totalWater.replace('g', '') || '0');

    const percentMatch = value.match(/^(\d+(\.\d+)?)%$/);
    if (percentMatch) {
      const percentValue = parseFloat(percentMatch[1]);
      const calculatedWater =
        totalWaterValue > 0
          ? Math.round((percentValue / 100) * totalWaterValue)
          : Math.round(percentValue);
      onStageChange(index, 'water', `${calculatedWater}`);
      return;
    }

    const multipleMatch =
      value.match(/^(\d+(\.\d+)?)(倍|[xX])$/) ||
      value.match(/^[xX][\s]*(\d+(\.\d+)?)[\s]*$/);
    if (multipleMatch) {
      const multipleValue = parseFloat(multipleMatch[1]);
      const coffeeMatch = coffeeDosage.match(/(\d+(\.\d+)?)/);
      const coffeeAmount = coffeeMatch ? parseFloat(coffeeMatch[1]) : 15;
      onStageChange(
        index,
        'water',
        `${Math.round(multipleValue * coffeeAmount)}`
      );
      return;
    }

    const water = value.includes('.')
      ? Math.round(parseFloat(value))
      : parseInt(value) || 0;
    onStageChange(index, 'water', `${water}`);
  };

  const getWaterDisplayValue = (stage: Stage, index: number) => {
    if (editingWater && editingWater.index === index) return editingWater.value;
    if (!stage.water) return '';
    if (typeof stage.water === 'number') return String(stage.water);
    return String(parseInt((stage.water as string).replace('g', '')));
  };

  const getDurationDisplayValue = (stage: Stage, index: number) => {
    if (editingDuration && editingDuration.index === index)
      return editingDuration.value;
    return stage.duration ?? '';
  };

  const pourTypeOptions = getPourTypeOptions();
  const isEspresso = isEspressoMachine(customEquipment);
  const hasValve = customEquipment.hasValve;

  const getFieldVisibility = (pourType: string | undefined) => ({
    showLabel: pourType !== 'wait',
    showDuration: pourType !== 'bypass' && pourType !== 'beverage',
    showWater: pourType !== 'wait',
  });

  const cellClass =
    'text-xs leading-relaxed font-medium text-neutral-600 dark:text-neutral-400';

  return (
    <motion.div
      key="stages-step"
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className="relative mx-auto"
    >
      {/* 顶部固定导航 */}
      <div className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50 pt-2 pb-3 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-medium text-neutral-800 dark:text-neutral-200">
            冲煮步骤
          </h3>
          <button
            type="button"
            onClick={addStage}
            className="text-sm text-neutral-600 dark:text-neutral-400"
          >
            + 添加步骤
          </button>
        </div>
        <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <span>总时间: {formatTime(calculateTotalTime())}</span>
          <span className={isEspresso ? 'truncate' : ''}>
            总水量:{' '}
            {isEspresso
              ? formatEspressoTotalWater()
              : `${calculateCurrentWater()}/ ${parseInt(totalWater)} 克`}
          </span>
        </div>
        <div className="pointer-events-none absolute right-0 -bottom-6 left-0 h-6 bg-linear-to-b from-neutral-50 to-transparent dark:from-neutral-900" />
      </div>

      {/* 步骤列表 */}
      <div
        className="mt-4 divide-y divide-neutral-200/50 dark:divide-neutral-800/50"
        ref={stagesContainerRef}
      >
        {stages.map((stage, index) => {
          const { showLabel, showDuration, showWater } = getFieldVisibility(
            stage.pourType
          );
          const stageNumber = stageNumbers[index];
          const isWaitStage = stage.pourType === 'wait';

          return (
            <div
              key={index}
              ref={
                index === stages.length - 1
                  ? newStageRef || innerNewStageRef
                  : null
              }
              className="group py-2.5"
            >
              {/* 第一行：核心信息 */}
              <div className={`${cellClass} flex items-center gap-2`}>
                {/* 序号/删除 */}
                {stages.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeStage(index)}
                    className="w-4 shrink-0 text-neutral-300 tabular-nums hover:text-red-500 dark:text-neutral-600"
                    title="删除此步骤"
                  >
                    {isWaitStage ? '−' : stageNumber}
                  </button>
                ) : (
                  <span className="w-4 shrink-0 tabular-nums">
                    {isWaitStage ? '' : stageNumber}
                  </span>
                )}

                {/* 方式 */}
                <select
                  value={stage.pourType || ''}
                  onChange={e => onPourTypeChange(index, e.target.value)}
                  className="shrink-0 appearance-none bg-transparent outline-hidden"
                >
                  <option value="" disabled>
                    选择
                  </option>
                  {pourTypeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* 名称 */}
                {showLabel ? (
                  <div className="flex min-w-0 flex-1 items-center">
                    {hasValve && (
                      <button
                        type="button"
                        onClick={() => toggleValveStatus(index)}
                        className={`mr-1 shrink-0 ${
                          stage.valveStatus === 'open'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        [{stage.valveStatus === 'open' ? '开阀' : '关阀'}]
                      </button>
                    )}
                    {isEspresso && stage.pourType === 'beverage' ? (
                      <AutocompleteInput
                        value={stage.label}
                        onChange={value => handleBeverageChange(index, value)}
                        suggestions={beverageSuggestions}
                        placeholder="饮料"
                        className="min-w-0 flex-1 truncate bg-transparent outline-hidden"
                        onRemovePreset={handleRemoveBeverage}
                        isCustomPreset={isCustomBeverage}
                      />
                    ) : (
                      <input
                        type="text"
                        value={stage.label}
                        onChange={e =>
                          onStageChange(index, 'label', e.target.value)
                        }
                        placeholder="名称"
                        className="min-w-0 flex-1 truncate bg-transparent outline-hidden"
                      />
                    )}
                  </div>
                ) : (
                  <span className="min-w-0 flex-1" />
                )}

                {/* 时间 */}
                {showDuration ? (
                  <span className="shrink-0 tabular-nums">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={getDurationDisplayValue(stage, index)}
                      onChange={e => {
                        setEditingDuration({ index, value: e.target.value });
                        const val = parseInt(e.target.value) || 0;
                        if (val >= 0) onStageChange(index, 'duration', val);
                      }}
                      onBlur={() => setEditingDuration(null)}
                      placeholder="0"
                      className="w-8 bg-transparent text-right outline-hidden"
                    />
                    <span className="text-neutral-400">&quot;</span>
                  </span>
                ) : (
                  <span className="w-10 shrink-0" />
                )}

                {/* 水量 */}
                {showWater ? (
                  <span className="shrink-0 tabular-nums">
                    <input
                      type="text"
                      value={getWaterDisplayValue(stage, index)}
                      onChange={e => {
                        setEditingWater({ index, value: e.target.value });
                        if (!e.target.value.trim()) {
                          onStageChange(index, 'water', '');
                          return;
                        }
                        if (e.target.value.endsWith('%')) return;
                        const water = e.target.value.includes('.')
                          ? Math.round(parseFloat(e.target.value))
                          : parseInt(e.target.value) || 0;
                        onStageChange(index, 'water', `${water}`);
                      }}
                      onBlur={e => handleWaterBlur(index, e.target.value)}
                      onFocus={e => e.target.select()}
                      placeholder="0"
                      className="w-8 bg-transparent text-right outline-hidden"
                    />
                    <span className="text-neutral-400">g</span>
                  </span>
                ) : (
                  <span className="w-10 shrink-0" />
                )}
              </div>

              {/* 第二行：说明 */}
              <div className="mt-1 flex items-center gap-2 pl-6">
                <input
                  type="text"
                  value={stage.detail}
                  onChange={e => onStageChange(index, 'detail', e.target.value)}
                  placeholder="输入说明"
                  className={`${cellClass} min-w-0 flex-1 bg-transparent text-neutral-400 outline-hidden placeholder:text-neutral-300 dark:text-neutral-500 dark:placeholder:text-neutral-600`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部渐变 */}
      <div className="pointer-events-none sticky right-0 bottom-0 left-0 h-8 bg-linear-to-t from-neutral-50 to-transparent dark:from-neutral-900" />
    </motion.div>
  );
};

export default StagesStep;
