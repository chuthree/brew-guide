import React, { useRef, useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Sigma, Hash } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/coffee-bean/ui/select';

const PRESET_BEVERAGES = ['饮用水', '冰块', '纯牛奶', '厚椰乳', '燕麦奶'];
const CUMULATIVE_MODE_STORAGE_KEY = 'stagesStepCumulativeMode';

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
  // 累计模式相关
  useCumulativeMode?: boolean;
  onCumulativeModeChange?: (value: boolean) => void;
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
  useCumulativeMode: externalCumulativeMode,
  onCumulativeModeChange,
}) => {
  const innerNewStageRef = useRef<HTMLDivElement>(null);
  const [beverageSuggestions, setBeverageSuggestions] =
    useState<string[]>(PRESET_BEVERAGES);

  // 累计模式状态（如果外部没有控制，则使用内部状态，带持久化）
  const [internalCumulativeMode, setInternalCumulativeMode] = useState(() => {
    // 初始化时从 localStorage 读取
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(CUMULATIVE_MODE_STORAGE_KEY);
        return saved === 'true';
      } catch {
        return false;
      }
    }
    return false;
  });
  const useCumulativeMode = externalCumulativeMode ?? internalCumulativeMode;
  const handleCumulativeModeChange = (value: boolean) => {
    if (onCumulativeModeChange) {
      onCumulativeModeChange(value);
    } else {
      setInternalCumulativeMode(value);
      // 持久化到 localStorage
      try {
        localStorage.setItem(CUMULATIVE_MODE_STORAGE_KEY, String(value));
      } catch (error) {
        console.error('Failed to save cumulative mode:', error);
      }
    }
  };

  // 计算累计时长和水量
  const cumulativeData = useMemo(() => {
    const result: { cumulativeDuration: number; cumulativeWater: number }[] = [];
    let totalDuration = 0;
    let totalWaterAmount = 0;

    stages.forEach(stage => {
      // 累计时长（排除 bypass 和 beverage）
      if (stage.pourType !== 'bypass' && stage.pourType !== 'beverage') {
        totalDuration += stage.duration || 0;
      }
      // 累计水量（排除 wait）
      if (stage.pourType !== 'wait') {
        const waterValue = stage.water
          ? typeof stage.water === 'number'
            ? stage.water
            : parseInt(stage.water.toString().replace('g', '') || '0')
          : 0;
        totalWaterAmount += waterValue;
      }
      result.push({
        cumulativeDuration: totalDuration,
        cumulativeWater: totalWaterAmount,
      });
    });

    return result;
  }, [stages]);

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
      let calculatedWater =
        totalWaterValue > 0
          ? Math.round((percentValue / 100) * totalWaterValue)
          : Math.round(percentValue);
      // 累计模式下需要减去前面阶段的水量
      if (useCumulativeMode && index > 0) {
        const previousCumulative = cumulativeData[index - 1]?.cumulativeWater || 0;
        calculatedWater = Math.max(0, calculatedWater - previousCumulative);
      }
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
      let calculatedWater = Math.round(multipleValue * coffeeAmount);
      // 累计模式下需要减去前面阶段的水量
      if (useCumulativeMode && index > 0) {
        const previousCumulative = cumulativeData[index - 1]?.cumulativeWater || 0;
        calculatedWater = Math.max(0, calculatedWater - previousCumulative);
      }
      onStageChange(index, 'water', `${calculatedWater}`);
      return;
    }

    let water = value.includes('.')
      ? Math.round(parseFloat(value))
      : parseInt(value) || 0;
    // 累计模式下，输入的是累计值，需要转换为独立值
    if (useCumulativeMode && index > 0) {
      const previousCumulative = cumulativeData[index - 1]?.cumulativeWater || 0;
      water = Math.max(0, water - previousCumulative);
    }
    onStageChange(index, 'water', `${water}`);
  };

  const getWaterDisplayValue = (stage: Stage, index: number) => {
    if (editingWater && editingWater.index === index) return editingWater.value;
    if (!stage.water) return useCumulativeMode ? String(cumulativeData[index]?.cumulativeWater || 0) : '';
    const independentValue = typeof stage.water === 'number'
      ? stage.water
      : parseInt((stage.water as string).replace('g', '') || '0');
    // 累计模式显示累计值
    if (useCumulativeMode) {
      return String(cumulativeData[index]?.cumulativeWater || independentValue);
    }
    return String(independentValue);
  };

  // 格式化时长显示（支持分秒格式）
  const formatDurationDisplay = (seconds: number): string => {
    if (!seconds) return '';
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return secs === 0 ? `${mins}′` : `${mins}′${secs}″`;
    }
    return `${seconds}″`;
  };

  const getDurationDisplayValue = (stage: Stage, index: number) => {
    // 编辑状态显示纯数字
    if (editingDuration && editingDuration.index === index)
      return editingDuration.value;
    // 非编辑状态显示格式化时间
    const seconds = useCumulativeMode
      ? cumulativeData[index]?.cumulativeDuration || 0
      : stage.duration || 0;
    return formatDurationDisplay(seconds);
  };

  // 获取当前秒数（用于聚焦时设置编辑值）
  const getDurationSeconds = (stage: Stage, index: number): number => {
    return useCumulativeMode
      ? cumulativeData[index]?.cumulativeDuration || 0
      : stage.duration || 0;
  };

  // 处理时长变更（支持累计模式）
  const handleDurationChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    setEditingDuration({ index, value });
    let val = parseInt(value) || 0;
    // 累计模式下，输入的是累计值，需要转换为独立值
    if (useCumulativeMode && index > 0) {
      const previousCumulative = cumulativeData[index - 1]?.cumulativeDuration || 0;
      val = Math.max(0, val - previousCumulative);
    }
    onStageChange(index, 'duration', val);
  };

  // 处理水量变更（支持累计模式）
  const handleWaterChange = (index: number, value: string) => {
    setEditingWater({ index, value });
    if (!value.trim()) {
      onStageChange(index, 'water', '');
      return;
    }
    if (value.endsWith('%')) return;
    let water = value.includes('.')
      ? Math.round(parseFloat(value))
      : parseInt(value) || 0;
    // 累计模式下，输入的是累计值，需要转换为独立值
    if (useCumulativeMode && index > 0) {
      const previousCumulative = cumulativeData[index - 1]?.cumulativeWater || 0;
      water = Math.max(0, water - previousCumulative);
    }
    onStageChange(index, 'water', `${water}`);
  };

  const pourTypeOptions = getPourTypeOptions();
  const isEspresso = isEspressoMachine(customEquipment);
  const hasValve = customEquipment.hasValve;

  const getFieldVisibility = (pourType: string | undefined) => ({
    showLabel: pourType !== 'wait',
    showDuration: pourType !== 'bypass' && pourType !== 'beverage',
    showWater: pourType !== 'wait',
  });

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
      <div className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50 py-2.5 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs font-medium text-neutral-600 dark:text-neutral-400">
            <span className="text-neutral-900 dark:text-neutral-100">
              总时间: {formatTime(calculateTotalTime())}
            </span>
            <span className="h-3 w-px bg-neutral-300 dark:bg-neutral-700" />
            <span
              className={`${
                isEspresso ? 'truncate max-w-[150px]' : ''
              } text-neutral-900 dark:text-neutral-100`}
            >
              总水量:{' '}
              {isEspresso
                ? formatEspressoTotalWater()
                : `${calculateCurrentWater()}/${parseInt(totalWater) || 0}g`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* 累计/独立模式切换 */}
            <button
              type="button"
              onClick={() => handleCumulativeModeChange(!useCumulativeMode)}
              className="flex items-center gap-0.5 text-xs font-medium text-neutral-900 hover:text-neutral-700 dark:text-neutral-100 dark:hover:text-neutral-300"
              title={useCumulativeMode ? '当前：累计模式（点击切换为独立模式）' : '当前：独立模式（点击切换为累计模式）'}
            >
              {useCumulativeMode ? (
                <><Sigma className="h-3 w-3" /> 累计</>
              ) : (
                <><Hash className="h-3 w-3" /> 独立</>
              )}
            </button>
            <span className="h-3 w-px bg-neutral-300 dark:bg-neutral-700" />
            <button
              type="button"
              onClick={addStage}
              className="text-xs font-medium text-neutral-900 hover:text-neutral-700 dark:text-neutral-100 dark:hover:text-neutral-300"
            >
              + 添加步骤
            </button>
          </div>
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
              <div className="flex items-center gap-2 text-xs font-medium leading-relaxed text-neutral-900 dark:text-neutral-100">
                {/* 序号/删除 */}
                {stages.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeStage(index)}
                    className="w-4 shrink-0 text-neutral-400 tabular-nums hover:text-red-500 dark:text-neutral-500"
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
                <span className="shrink-0">
                  <span className="text-neutral-500 dark:text-neutral-500">[</span>
                  <Select
                    value={stage.pourType || ''}
                    onValueChange={value => onPourTypeChange(index, value)}
                  >
                    <SelectTrigger variant="minimal" className="inline-flex w-auto border-none p-0 shadow-none focus:ring-0">
                      <SelectValue placeholder="选择" />
                    </SelectTrigger>
                    <SelectContent>
                      {pourTypeOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-neutral-500 dark:text-neutral-500">]</span>
                </span>

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
                        className="min-w-0 flex-1 truncate border-none bg-transparent py-0 outline-hidden placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
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
                        className="min-w-0 flex-1 truncate bg-transparent outline-hidden placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
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
                      type="text"
                      inputMode="numeric"
                      value={getDurationDisplayValue(stage, index)}
                      onChange={e => handleDurationChange(index, e.target.value)}
                      onFocus={() => {
                        const seconds = getDurationSeconds(stage, index);
                        setEditingDuration({ index, value: seconds ? String(seconds) : '' });
                      }}
                      onBlur={() => setEditingDuration(null)}
                      placeholder="0″"
                      className="w-12 bg-transparent text-right outline-hidden placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
                    />
                    {editingDuration?.index === index && (
                      <span className="text-neutral-500 dark:text-neutral-500">″</span>
                    )}
                  </span>
                ) : (
                  <span className="w-14 shrink-0" />
                )}

                {/* 水量 */}
                {showWater ? (
                  <span className="shrink-0 tabular-nums">
                    <input
                      type="text"
                      value={getWaterDisplayValue(stage, index)}
                      onChange={e => handleWaterChange(index, e.target.value)}
                      onBlur={e => handleWaterBlur(index, e.target.value)}
                      placeholder="0"
                      className="w-8 bg-transparent text-right outline-hidden placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
                    />
                    <span className="text-neutral-500 dark:text-neutral-500">
                      g
                    </span>
                  </span>
                ) : (
                  <span className="w-10 shrink-0" />
                )}
              </div>

              {/* 第二行：说明 */}
              <div className="mt-1 flex items-start gap-2 pl-6">
                <textarea
                  value={stage.detail}
                  onChange={e => onStageChange(index, 'detail', e.target.value)}
                  placeholder="输入说明"
                  className="field-sizing-content min-w-0 flex-1 resize-none bg-transparent text-xs font-medium leading-relaxed text-neutral-500 outline-hidden placeholder:text-neutral-400 dark:text-neutral-400 dark:placeholder:text-neutral-600"
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
