import React, { useRef, useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sigma, Hash, Clock } from 'lucide-react';
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
const DISPLAY_MODE_STORAGE_KEY = 'stagesStepDisplayMode';

// 显示模式：independent(独立) / cumulative(累计) / time(时间)
type DisplayMode = 'independent' | 'cumulative' | 'time';

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
  removeStages?: (indices: number[]) => void;
  insertStage?: (index: number, stage: Stage) => void;
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
  displayMode?: DisplayMode;
  onDisplayModeChange?: (value: DisplayMode) => void;
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
  removeStages,
  insertStage,
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
  displayMode: externalDisplayMode,
  onDisplayModeChange,
  useCumulativeMode: externalCumulativeMode,
  onCumulativeModeChange,
}) => {
  const innerNewStageRef = useRef<HTMLDivElement>(null);
  const [beverageSuggestions, setBeverageSuggestions] =
    useState<string[]>(PRESET_BEVERAGES);

  // 显示模式状态
  const [internalDisplayMode, setInternalDisplayMode] = useState<DisplayMode>(
    () => {
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem(DISPLAY_MODE_STORAGE_KEY);
          if (
            saved === 'independent' ||
            saved === 'cumulative' ||
            saved === 'time'
          ) {
            return saved;
          }
          const oldSaved = localStorage.getItem('stagesStepCumulativeMode');
          if (oldSaved === 'true') return 'cumulative';
        } catch {
          return 'independent';
        }
      }
      return 'independent';
    }
  );

  const displayMode: DisplayMode =
    externalDisplayMode ??
    (externalCumulativeMode ? 'cumulative' : undefined) ??
    internalDisplayMode;

  const useCumulativeMode = displayMode === 'cumulative';
  const useTimeMode = displayMode === 'time';

  const handleDisplayModeChange = (newMode: DisplayMode) => {
    if (onDisplayModeChange) {
      onDisplayModeChange(newMode);
    } else if (onCumulativeModeChange) {
      onCumulativeModeChange(newMode === 'cumulative');
    } else {
      setInternalDisplayMode(newMode);
      try {
        localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, newMode);
      } catch (error) {
        console.error('Failed to save display mode:', error);
      }
    }
  };

  const cycleDisplayMode = () => {
    const nextMode: DisplayMode =
      displayMode === 'independent'
        ? 'cumulative'
        : displayMode === 'cumulative'
          ? 'time'
          : 'independent';
    handleDisplayModeChange(nextMode);
  };

  // 计算累计时长和水量
  const cumulativeData = useMemo(() => {
    const result: { cumulativeDuration: number; cumulativeWater: number }[] =
      [];
    let totalDuration = 0;
    let totalWaterAmount = 0;

    stages.forEach(stage => {
      if (stage.pourType !== 'bypass' && stage.pourType !== 'beverage') {
        totalDuration += stage.duration || 0;
      }
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

  // 时间模式数据
  // 时间模式下隐藏"等待"步骤（等待时间通过开始/结束时间推算）
  // 但保留所有其他步骤类型，包括 bypass 和 beverage
  const timeModeData = useMemo(() => {
    const result: {
      originalIndex: number;
      isWait: boolean;
      startTime: number;
      endTime: number | null; // null 表示未设置（新步骤）
      cumulativeWater: number;
      prevWaitIndex: number | null;
      pourStageNumber: number | null;
      hasDuration: boolean; // 是否有设置 duration
      isTimeless: boolean; // 是否是无时间步骤（bypass/beverage）
    }[] = [];

    let currentTime = 0;
    let cumulativeWater = 0;
    let lastWaitIndex: number | null = null;
    let pourStageCount = 0;

    stages.forEach((stage, index) => {
      const hasDuration = stage.duration !== undefined && stage.duration > 0;
      const isTimeless =
        stage.pourType === 'bypass' || stage.pourType === 'beverage';

      if (stage.pourType === 'wait') {
        // 等待步骤：在时间模式下仍然记录，但渲染时会简化显示
        const startTime = currentTime;
        const duration = stage.duration || 0;
        const endTime = hasDuration ? currentTime + duration : null;
        if (hasDuration) currentTime = currentTime + duration;

        result.push({
          originalIndex: index,
          isWait: true,
          startTime,
          endTime,
          cumulativeWater,
          prevWaitIndex: null,
          pourStageNumber: null,
          hasDuration,
          isTimeless: false,
        });

        lastWaitIndex = index;
      } else if (isTimeless) {
        // bypass/beverage 步骤：没有时间概念，但需要显示
        pourStageCount++;
        const waterValue = stage.water
          ? typeof stage.water === 'number'
            ? stage.water
            : parseInt(stage.water.toString().replace('g', '') || '0')
          : 0;
        cumulativeWater += waterValue;

        result.push({
          originalIndex: index,
          isWait: false,
          startTime: currentTime, // 使用当前时间点
          endTime: null, // 无时间步骤没有结束时间
          cumulativeWater,
          prevWaitIndex: lastWaitIndex,
          pourStageNumber: pourStageCount,
          hasDuration: false,
          isTimeless: true,
        });

        lastWaitIndex = null;
      } else {
        // 普通注水步骤
        pourStageCount++;
        const startTime = currentTime;
        const duration = stage.duration || 0;
        const endTime = hasDuration ? currentTime + duration : null;
        if (hasDuration) currentTime = currentTime + duration;

        const waterValue = stage.water
          ? typeof stage.water === 'number'
            ? stage.water
            : parseInt(stage.water.toString().replace('g', '') || '0')
          : 0;
        cumulativeWater += waterValue;

        result.push({
          originalIndex: index,
          isWait: false,
          startTime,
          endTime,
          cumulativeWater,
          prevWaitIndex: lastWaitIndex,
          pourStageNumber: pourStageCount,
          hasDuration,
          isTimeless: false,
        });

        lastWaitIndex = null;
      }
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

    // 只显示萃取步骤的液重
    const extractionStage = stages.find(
      stage => stage.pourType === 'extraction'
    );
    if (!extractionStage || !extractionStage.water) return '0g';

    const waterValue =
      typeof extractionStage.water === 'number'
        ? extractionStage.water
        : parseInt(extractionStage.water.toString().replace('g', '') || '0');

    return `${waterValue}g`;
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
      if (useCumulativeMode && index > 0) {
        const previousCumulative =
          cumulativeData[index - 1]?.cumulativeWater || 0;
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
      if (useCumulativeMode && index > 0) {
        const previousCumulative =
          cumulativeData[index - 1]?.cumulativeWater || 0;
        calculatedWater = Math.max(0, calculatedWater - previousCumulative);
      }
      onStageChange(index, 'water', `${calculatedWater}`);
      return;
    }

    let water = value.includes('.')
      ? Math.round(parseFloat(value))
      : parseInt(value) || 0;
    if (useCumulativeMode && index > 0) {
      const previousCumulative =
        cumulativeData[index - 1]?.cumulativeWater || 0;
      water = Math.max(0, water - previousCumulative);
    }
    onStageChange(index, 'water', `${water}`);
  };

  const getWaterDisplayValue = (stage: Stage, index: number) => {
    if (editingWater && editingWater.index === index) return editingWater.value;
    // 如果没有设置水量，显示空（不预设）
    if (!stage.water) return '';
    const independentValue =
      typeof stage.water === 'number'
        ? stage.water
        : parseInt((stage.water as string).replace('g', '') || '0');
    if (useCumulativeMode) {
      return String(cumulativeData[index]?.cumulativeWater || independentValue);
    }
    return String(independentValue);
  };

  const formatDurationDisplay = (seconds: number): string => {
    if (!seconds) return '';
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}′${String(secs).padStart(2, '0')}″`;
    }
    return `${seconds}″`;
  };

  const parseTimeToSeconds = (mins: number, secs: number): number => {
    return mins * 60 + secs;
  };

  // 时间模式：处理开始时间编辑完成（直接从 DOM 读取值）
  const handleTimeModeStartBlurWithValues = (
    timeModeIndex: number,
    mins: number,
    secs: number
  ) => {
    const timeData = timeModeData[timeModeIndex];
    if (!timeData || timeData.isWait) return;

    const newStartTime = parseTimeToSeconds(mins, secs);

    // 找到上一个注水阶段
    let prevPourTimeData: typeof timeData | null = null;
    for (let i = timeModeIndex - 1; i >= 0; i--) {
      if (!timeModeData[i].isWait) {
        prevPourTimeData = timeModeData[i];
        break;
      }
    }
    // 上一个注水阶段的结束时间（如果没有设置 duration，则用 startTime）
    const minStartTime = prevPourTimeData
      ? (prevPourTimeData.endTime ?? prevPourTimeData.startTime)
      : 0;

    // 验证：新开始时间不能小于上一个注水阶段的结束时间
    if (newStartTime < minStartTime) return;

    // 验证：如果当前步骤有结束时间，新开始时间不能大于等于结束时间
    if (timeData.endTime !== null && newStartTime >= timeData.endTime) return;

    // 计算需要的等待时间
    const requiredWaitDuration = newStartTime - minStartTime;

    if (requiredWaitDuration === 0) {
      // 不需要等待时间，删除已有的等待阶段
      if (timeData.prevWaitIndex !== null) {
        removeStage(timeData.prevWaitIndex);
      }
    } else if (timeData.prevWaitIndex !== null) {
      // 已有等待阶段，更新其时长
      onStageChange(timeData.prevWaitIndex, 'duration', requiredWaitDuration);
    } else if (insertStage) {
      // 没有等待阶段，需要插入一个新的
      const newWaitStage: Stage = {
        duration: requiredWaitDuration,
        label: '等待',
        detail: '',
        pourType: 'wait',
      };
      insertStage(timeData.originalIndex, newWaitStage);
    }
  };

  // 时间模式：处理结束时间编辑完成（直接从 DOM 读取值）
  const handleTimeModeEndBlurWithValues = (
    timeModeIndex: number,
    mins: number,
    secs: number
  ) => {
    const timeData = timeModeData[timeModeIndex];
    if (!timeData) return;

    const newEndTime = parseTimeToSeconds(mins, secs);

    // 结束时间必须大于开始时间
    if (newEndTime <= timeData.startTime) return;

    // 计算新的 duration
    const newDuration = newEndTime - timeData.startTime;
    onStageChange(timeData.originalIndex, 'duration', newDuration);
  };

  // 时间模式：获取水量显示值（累计值）
  const getTimeModeWaterDisplayValue = (
    stage: Stage,
    timeModeIndex: number
  ): string => {
    const timeData = timeModeData[timeModeIndex];
    if (!timeData || timeData.isWait) return '';

    if (editingWater && editingWater.index === timeData.originalIndex) {
      return editingWater.value;
    }
    // 如果当前阶段没有设置水量，显示空（不预设）
    if (!stage.water) return '';
    return String(timeData.cumulativeWater || 0);
  };

  // 时间模式：处理水量变更
  const handleTimeModeWaterChange = (timeModeIndex: number, value: string) => {
    const timeData = timeModeData[timeModeIndex];
    if (!timeData || timeData.isWait) return;

    setEditingWater({ index: timeData.originalIndex, value });

    if (!value.trim()) {
      onStageChange(timeData.originalIndex, 'water', '');
      return;
    }
    if (value.endsWith('%')) return;

    const inputCumulative = value.includes('.')
      ? Math.round(parseFloat(value))
      : parseInt(value) || 0;

    let prevCumulative = 0;
    for (let i = timeModeIndex - 1; i >= 0; i--) {
      if (!timeModeData[i].isWait) {
        prevCumulative = timeModeData[i].cumulativeWater || 0;
        break;
      }
    }

    const independentWater = Math.max(0, inputCumulative - prevCumulative);
    onStageChange(timeData.originalIndex, 'water', `${independentWater}`);
  };

  // 时间模式：处理水量失焦
  const handleTimeModeWaterBlur = (timeModeIndex: number, value: string) => {
    setEditingWater(null);

    const timeData = timeModeData[timeModeIndex];
    if (!timeData || timeData.isWait) return;

    if (!value.trim()) {
      onStageChange(timeData.originalIndex, 'water', '');
      return;
    }

    const totalWaterValue = parseInt(totalWater.replace('g', '') || '0');

    let prevCumulative = 0;
    for (let i = timeModeIndex - 1; i >= 0; i--) {
      if (!timeModeData[i].isWait) {
        prevCumulative = timeModeData[i].cumulativeWater || 0;
        break;
      }
    }

    const percentMatch = value.match(/^(\d+(\.\d+)?)%$/);
    if (percentMatch) {
      const percentValue = parseFloat(percentMatch[1]);
      const calculatedCumulative =
        totalWaterValue > 0
          ? Math.round((percentValue / 100) * totalWaterValue)
          : Math.round(percentValue);
      const independentWater = Math.max(
        0,
        calculatedCumulative - prevCumulative
      );
      onStageChange(timeData.originalIndex, 'water', `${independentWater}`);
      return;
    }

    const multipleMatch =
      value.match(/^(\d+(\.\d+)?)(倍|[xX])$/) ||
      value.match(/^[xX][\s]*(\d+(\.\d+)?)[\s]*$/);
    if (multipleMatch) {
      const multipleValue = parseFloat(multipleMatch[1]);
      const coffeeMatch = coffeeDosage.match(/(\d+(\.\d+)?)/);
      const coffeeAmount = coffeeMatch ? parseFloat(coffeeMatch[1]) : 15;
      const calculatedCumulative = Math.round(multipleValue * coffeeAmount);
      const independentWater = Math.max(
        0,
        calculatedCumulative - prevCumulative
      );
      onStageChange(timeData.originalIndex, 'water', `${independentWater}`);
      return;
    }

    const inputCumulative = value.includes('.')
      ? Math.round(parseFloat(value))
      : parseInt(value) || 0;
    const independentWater = Math.max(0, inputCumulative - prevCumulative);
    onStageChange(timeData.originalIndex, 'water', `${independentWater}`);
  };

  // 时间模式：删除阶段
  const handleTimeModeRemoveStage = (timeModeIndex: number) => {
    const timeData = timeModeData[timeModeIndex];
    if (!timeData) return;

    const indicesToRemove: number[] = [timeData.originalIndex];

    if (!timeData.isWait && timeData.prevWaitIndex !== null) {
      indicesToRemove.push(timeData.prevWaitIndex);
    }

    if (removeStages) {
      removeStages(indicesToRemove);
    } else {
      indicesToRemove.sort((a, b) => b - a);
      indicesToRemove.forEach(idx => {
        removeStage(idx);
      });
    }
  };

  const getDurationDisplayValue = (stage: Stage, index: number) => {
    if (editingDuration && editingDuration.index === index)
      return editingDuration.value;
    // 如果没有设置时长，显示空（不预设）
    if (!stage.duration) return '';
    const seconds = useCumulativeMode
      ? cumulativeData[index]?.cumulativeDuration || 0
      : stage.duration || 0;
    return formatDurationDisplay(seconds);
  };

  const getDurationSeconds = (stage: Stage, index: number): number => {
    // 如果没有设置时长，返回 0
    if (!stage.duration) return 0;
    return useCumulativeMode
      ? cumulativeData[index]?.cumulativeDuration || 0
      : stage.duration || 0;
  };

  const handleDurationChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    setEditingDuration({ index, value });
    let val = parseInt(value) || 0;
    if (useCumulativeMode && index > 0) {
      const previousCumulative =
        cumulativeData[index - 1]?.cumulativeDuration || 0;
      val = Math.max(0, val - previousCumulative);
    }
    onStageChange(index, 'duration', val);
  };

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
    if (useCumulativeMode && index > 0) {
      const previousCumulative =
        cumulativeData[index - 1]?.cumulativeWater || 0;
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
                isEspresso ? 'max-w-[150px] truncate' : ''
              } text-neutral-900 dark:text-neutral-100`}
            >
              {isEspresso ? '浓缩液重' : '总水量'}:{' '}
              {isEspresso
                ? formatEspressoTotalWater()
                : `${calculateCurrentWater()}/${parseInt(totalWater) || 0}g`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* 显示模式切换 */}
            <button
              type="button"
              onClick={cycleDisplayMode}
              className="flex items-center gap-0.5 text-xs font-medium text-neutral-900 hover:text-neutral-700 dark:text-neutral-100 dark:hover:text-neutral-300"
              title={
                displayMode === 'independent'
                  ? '当前：独立模式（点击切换为累计模式）'
                  : displayMode === 'cumulative'
                    ? '当前：累计模式（点击切换为时间模式）'
                    : '当前：时间模式（点击切换为独立模式）'
              }
            >
              {displayMode === 'cumulative' ? (
                <>
                  <Sigma className="h-3 w-3" /> 累计
                </>
              ) : displayMode === 'time' ? (
                <>
                  <Clock className="h-3 w-3" /> 时间
                </>
              ) : (
                <>
                  <Hash className="h-3 w-3" /> 独立
                </>
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
        {useTimeMode
          ? // 时间模式
            timeModeData.map((timeData, timeModeIndex) => {
              const stage = stages[timeData.originalIndex];

              // 等待阶段：简化的一行显示
              if (timeData.isWait) {
                const waitDuration =
                  timeData.endTime !== null
                    ? timeData.endTime - timeData.startTime
                    : 0;
                return (
                  <div
                    key={timeData.originalIndex}
                    ref={
                      timeData.originalIndex === stages.length - 1
                        ? newStageRef || innerNewStageRef
                        : null
                    }
                    className="group py-1.5"
                  >
                    <div className="flex items-center gap-2 text-xs leading-relaxed text-neutral-400 dark:text-neutral-500">
                      {timeModeData.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleTimeModeRemoveStage(timeModeIndex)
                          }
                          className="w-4 shrink-0 tabular-nums hover:text-red-500"
                          title="删除等待"
                        >
                          −
                        </button>
                      ) : (
                        <span className="w-4 shrink-0" />
                      )}
                      <span className="text-neutral-400 dark:text-neutral-500">
                        等待 {formatDurationDisplay(waitDuration)}
                      </span>
                    </div>
                  </div>
                );
              }

              // 注水阶段
              const { showLabel, showWater } = getFieldVisibility(
                stage.pourType
              );
              const stageNumber = timeData.pourStageNumber;

              return (
                <div
                  key={timeData.originalIndex}
                  ref={
                    timeData.originalIndex === stages.length - 1
                      ? newStageRef || innerNewStageRef
                      : null
                  }
                  className="group py-2.5"
                >
                  {/* 第一行：核心信息 */}
                  <div className="flex items-center gap-2 text-xs leading-relaxed font-medium text-neutral-900 dark:text-neutral-100">
                    {/* 序号/删除 */}
                    {timeModeData.filter(d => !d.isWait).length > 1 ? (
                      <button
                        type="button"
                        onClick={() => handleTimeModeRemoveStage(timeModeIndex)}
                        className="w-4 shrink-0 text-neutral-400 tabular-nums hover:text-red-500 dark:text-neutral-500"
                        title="删除此步骤"
                      >
                        {stageNumber}
                      </button>
                    ) : (
                      <span className="w-4 shrink-0 tabular-nums">
                        {stageNumber}
                      </span>
                    )}

                    {/* 方式 */}
                    <span className="shrink-0">
                      <span className="text-neutral-500 dark:text-neutral-500">
                        [
                      </span>
                      <Select
                        value={stage.pourType || ''}
                        onValueChange={value =>
                          onPourTypeChange(timeData.originalIndex, value)
                        }
                      >
                        <SelectTrigger
                          variant="minimal"
                          className="inline-flex w-auto border-none p-0 shadow-none focus:ring-0"
                        >
                          <SelectValue placeholder="选择" />
                        </SelectTrigger>
                        <SelectContent>
                          {pourTypeOptions
                            .filter(opt => opt.value !== 'wait')
                            .map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <span className="text-neutral-500 dark:text-neutral-500">
                        ]
                      </span>
                    </span>

                    {/* 名称 */}
                    {showLabel ? (
                      <div className="flex min-w-0 flex-1 items-center">
                        {hasValve && (
                          <button
                            type="button"
                            onClick={() =>
                              toggleValveStatus(timeData.originalIndex)
                            }
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
                            onChange={value =>
                              handleBeverageChange(
                                timeData.originalIndex,
                                value
                              )
                            }
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
                              onStageChange(
                                timeData.originalIndex,
                                'label',
                                e.target.value
                              )
                            }
                            placeholder="名称"
                            className="min-w-0 flex-1 truncate bg-transparent outline-hidden placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
                          />
                        )}
                      </div>
                    ) : (
                      <span className="min-w-0 flex-1" />
                    )}

                    {/* 时间：开始-结束格式，无感输入 */}
                    {/* 对于无时间步骤（bypass/beverage），不显示时间输入 */}
                    {timeData.isTimeless ? (
                      <span className="w-24 shrink-0" />
                    ) : (
                      <span className="flex shrink-0 items-center tabular-nums">
                        {/* 开始时间 */}
                        <span
                          className="flex items-center"
                          onBlur={e => {
                            if (!e.currentTarget.contains(e.relatedTarget)) {
                              const spans =
                                e.currentTarget.querySelectorAll(
                                  '[contenteditable]'
                                );
                              const mins = parseInt(
                                spans[0]?.textContent || '0'
                              );
                              const secs = parseInt(
                                spans[1]?.textContent || '0'
                              );
                              // 自动进位
                              const totalSecs = mins * 60 + secs;
                              const newMins = Math.floor(totalSecs / 60);
                              const newSecs = totalSecs % 60;
                              if (spans[0])
                                spans[0].textContent = String(newMins);
                              if (spans[1])
                                spans[1].textContent = String(newSecs).padStart(
                                  2,
                                  '0'
                                );
                              handleTimeModeStartBlurWithValues(
                                timeModeIndex,
                                newMins,
                                newSecs
                              );
                            }
                          }}
                        >
                          <span
                            contentEditable
                            suppressContentEditableWarning
                            inputMode="numeric"
                            onInput={e => {
                              const text = e.currentTarget.textContent || '';
                              const val = text.replace(/\D/g, '');
                              if (val !== text) {
                                e.currentTarget.textContent = val;
                              }
                            }}
                            className="min-w-[0.5em] cursor-text text-right outline-none hover:text-neutral-600 dark:hover:text-neutral-300"
                          >
                            {Math.floor(timeData.startTime / 60)}
                          </span>
                          <span className="text-neutral-500">′</span>
                          <span
                            contentEditable
                            suppressContentEditableWarning
                            inputMode="numeric"
                            onInput={e => {
                              const text = e.currentTarget.textContent || '';
                              const val = text.replace(/\D/g, '');
                              if (val !== text) {
                                e.currentTarget.textContent = val;
                              }
                            }}
                            className="min-w-[1em] cursor-text text-right outline-none hover:text-neutral-600 dark:hover:text-neutral-300"
                          >
                            {String(timeData.startTime % 60).padStart(2, '0')}
                          </span>
                          <span className="text-neutral-500">″</span>
                        </span>

                        <span className="mx-0.5 text-neutral-400">-</span>

                        {/* 结束时间 */}
                        <span
                          className="flex items-center"
                          onBlur={e => {
                            if (!e.currentTarget.contains(e.relatedTarget)) {
                              const spans =
                                e.currentTarget.querySelectorAll(
                                  '[contenteditable]'
                                );
                              const mins = parseInt(
                                spans[0]?.textContent || '0'
                              );
                              const secs = parseInt(
                                spans[1]?.textContent || '0'
                              );
                              // 自动进位
                              const totalSecs = mins * 60 + secs;
                              const newMins = Math.floor(totalSecs / 60);
                              const newSecs = totalSecs % 60;
                              if (spans[0])
                                spans[0].textContent = String(newMins);
                              if (spans[1])
                                spans[1].textContent = String(newSecs).padStart(
                                  2,
                                  '0'
                                );
                              handleTimeModeEndBlurWithValues(
                                timeModeIndex,
                                newMins,
                                newSecs
                              );
                            }
                          }}
                        >
                          <span
                            contentEditable
                            suppressContentEditableWarning
                            inputMode="numeric"
                            data-placeholder="0"
                            onInput={e => {
                              const text = e.currentTarget.textContent || '';
                              const val = text.replace(/\D/g, '');
                              if (val !== text) {
                                e.currentTarget.textContent = val;
                              }
                            }}
                            className={`min-w-[0.5em] cursor-text text-right outline-none empty:text-neutral-400 empty:before:content-[attr(data-placeholder)] hover:text-neutral-600 dark:empty:text-neutral-600 dark:hover:text-neutral-300`}
                          >
                            {timeData.endTime !== null
                              ? Math.floor(timeData.endTime / 60)
                              : ''}
                          </span>
                          <span className="text-neutral-500">′</span>
                          <span
                            contentEditable
                            suppressContentEditableWarning
                            inputMode="numeric"
                            data-placeholder="00"
                            onInput={e => {
                              const text = e.currentTarget.textContent || '';
                              const val = text.replace(/\D/g, '');
                              if (val !== text) {
                                e.currentTarget.textContent = val;
                              }
                            }}
                            className={`min-w-[1em] cursor-text text-right outline-none empty:text-neutral-400 empty:before:content-[attr(data-placeholder)] hover:text-neutral-600 dark:empty:text-neutral-600 dark:hover:text-neutral-300`}
                          >
                            {timeData.endTime !== null
                              ? String(timeData.endTime % 60).padStart(2, '0')
                              : ''}
                          </span>
                          <span className="text-neutral-500">″</span>
                        </span>
                      </span>
                    )}

                    {/* 水量（累计值） */}
                    {showWater ? (
                      <span className="shrink-0 tabular-nums">
                        <input
                          type="text"
                          value={getTimeModeWaterDisplayValue(
                            stage,
                            timeModeIndex
                          )}
                          onChange={e =>
                            handleTimeModeWaterChange(
                              timeModeIndex,
                              e.target.value
                            )
                          }
                          onBlur={e =>
                            handleTimeModeWaterBlur(
                              timeModeIndex,
                              e.target.value
                            )
                          }
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
                      onChange={e =>
                        onStageChange(
                          timeData.originalIndex,
                          'detail',
                          e.target.value
                        )
                      }
                      placeholder="输入说明"
                      className="field-sizing-content min-w-0 flex-1 resize-none bg-transparent text-xs leading-relaxed font-medium text-neutral-500 outline-hidden placeholder:text-neutral-400 dark:text-neutral-400 dark:placeholder:text-neutral-600"
                    />
                  </div>
                </div>
              );
            })
          : // 独立/累计模式
            stages.map((stage, index) => {
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
                  <div className="flex items-center gap-2 text-xs leading-relaxed font-medium text-neutral-900 dark:text-neutral-100">
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
                      <span className="text-neutral-500 dark:text-neutral-500">
                        [
                      </span>
                      <Select
                        value={stage.pourType || ''}
                        onValueChange={value => onPourTypeChange(index, value)}
                      >
                        <SelectTrigger
                          variant="minimal"
                          className="inline-flex w-auto border-none p-0 shadow-none focus:ring-0"
                        >
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
                      <span className="text-neutral-500 dark:text-neutral-500">
                        ]
                      </span>
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
                            onChange={value =>
                              handleBeverageChange(index, value)
                            }
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
                      <span
                        className="flex shrink-0 items-center tabular-nums"
                        onBlur={e => {
                          if (!e.currentTarget.contains(e.relatedTarget)) {
                            const spans =
                              e.currentTarget.querySelectorAll(
                                '[contenteditable]'
                              );
                            const hasMins = spans.length === 2;
                            const mins = hasMins
                              ? parseInt(spans[0]?.textContent || '0')
                              : 0;
                            const secs = parseInt(
                              spans[hasMins ? 1 : 0]?.textContent || '0'
                            );
                            // 自动进位
                            let totalSecs = mins * 60 + secs;
                            if (useCumulativeMode && index > 0) {
                              const previousCumulative =
                                cumulativeData[index - 1]?.cumulativeDuration ||
                                0;
                              totalSecs = Math.max(
                                0,
                                totalSecs - previousCumulative
                              );
                            }
                            onStageChange(index, 'duration', totalSecs);
                          }
                        }}
                      >
                        {(() => {
                          const seconds = getDurationSeconds(stage, index);
                          const hasDuration = !!stage.duration; // 当前步骤是否有设置时长
                          // 累计模式：如果前面累计已>=60秒，当前也显示分钟格式
                          const cumulativeSecs = useCumulativeMode
                            ? cumulativeData[index]?.cumulativeDuration || 0
                            : seconds;
                          const showMins = useCumulativeMode
                            ? cumulativeSecs >= 60 ||
                              (index > 0 &&
                                (cumulativeData[index - 1]
                                  ?.cumulativeDuration || 0) >= 60)
                            : seconds >= 60;
                          const displaySecs = hasDuration
                            ? useCumulativeMode
                              ? cumulativeSecs
                              : seconds
                            : 0;
                          const mins = Math.floor(displaySecs / 60);
                          const secs = displaySecs % 60;
                          return (
                            <>
                              {showMins && (
                                <>
                                  <span
                                    contentEditable
                                    suppressContentEditableWarning
                                    inputMode="numeric"
                                    data-placeholder="0"
                                    onInput={e => {
                                      const text =
                                        e.currentTarget.textContent || '';
                                      const val = text.replace(/\D/g, '');
                                      if (val !== text) {
                                        e.currentTarget.textContent = val;
                                      }
                                    }}
                                    className="min-w-[0.5em] cursor-text text-right outline-none empty:text-neutral-400 empty:before:content-[attr(data-placeholder)] hover:text-neutral-600 dark:empty:text-neutral-600 dark:hover:text-neutral-300"
                                  >
                                    {hasDuration ? mins : ''}
                                  </span>
                                  <span className="text-neutral-500">′</span>
                                </>
                              )}
                              <span
                                contentEditable
                                suppressContentEditableWarning
                                inputMode="numeric"
                                data-placeholder={showMins ? '00' : '0'}
                                onInput={e => {
                                  const text =
                                    e.currentTarget.textContent || '';
                                  const val = text.replace(/\D/g, '');
                                  if (val !== text) {
                                    e.currentTarget.textContent = val;
                                  }
                                }}
                                className={`min-w-[${showMins ? '1em' : '0.5em'}] cursor-text text-right outline-none empty:text-neutral-400 empty:before:content-[attr(data-placeholder)] hover:text-neutral-600 dark:empty:text-neutral-600 dark:hover:text-neutral-300`}
                              >
                                {hasDuration
                                  ? showMins
                                    ? String(secs).padStart(2, '0')
                                    : secs
                                  : ''}
                              </span>
                              <span className="text-neutral-500">″</span>
                            </>
                          );
                        })()}
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
                          onChange={e =>
                            handleWaterChange(index, e.target.value)
                          }
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
                      onChange={e =>
                        onStageChange(index, 'detail', e.target.value)
                      }
                      placeholder="输入说明"
                      className="field-sizing-content min-w-0 flex-1 resize-none bg-transparent text-xs leading-relaxed font-medium text-neutral-500 outline-hidden placeholder:text-neutral-400 dark:text-neutral-400 dark:placeholder:text-neutral-600"
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
