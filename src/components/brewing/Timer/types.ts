import type { Method } from '@/lib/core/config';
import type { SettingsOptions } from '@/components/settings/Settings';
import type { BrewingNoteData, CoffeeBean } from '@/types/app';
import { LayoutSettings } from './Settings';

// 扩展阶段类型
export type ExpandedStage = {
  type: 'pour' | 'wait';
  label: string;
  startTime: number;
  endTime: number;
  time: number;
  pourTime?: number;
  water: string;
  detail: string;
  pourType?: string;
  valveStatus?: 'open' | 'closed';
  originalIndex: number;
};

// 计时器组件属性接口
export interface BrewingTimerProps {
  currentBrewingMethod: Method | null;
  onTimerComplete?: () => void;
  onStatusChange?: (status: { isRunning: boolean }) => void;
  onStageChange?: (status: {
    currentStage: number;
    progress: number;
    isWaiting: boolean;
  }) => void;
  onComplete?: (isComplete: boolean, totalTime?: number) => void;
  onCountdownChange?: (time: number | null) => void;
  onExpandedStagesChange?: (stages: ExpandedStage[]) => void;
  settings: SettingsOptions;
  selectedEquipment: string | null;
  isCoffeeBrewed?: boolean;
  layoutSettings?: LayoutSettings;
}

// 笔记表单初始数据类型
export type NoteFormInitialData = Partial<BrewingNoteData> & {
  coffeeBean?: CoffeeBean | null;
};
