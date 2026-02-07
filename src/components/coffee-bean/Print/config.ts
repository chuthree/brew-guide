import { getObjectState, saveObjectState } from '@/lib/core/statePersistence';
import { PrintConfig, PresetSize } from './types';

const MODULE = 'bean-print';

// 默认配置
export const DEFAULT_CONFIG: PrintConfig = {
  width: 50,
  height: 80,
  orientation: 'landscape',
  fields: {
    name: true,
    origin: true,
    estate: false,
    roastLevel: true,
    roastDate: true,
    flavor: true,
    process: true,
    variety: true,
    notes: true,
    weight: false,
  },
  margin: 3,
  fontSize: 13,
  titleFontSize: 17,
  fontWeight: 500,
  template: 'detailed',
  brandName: '',
};

// 默认预设尺寸
export const DEFAULT_PRESET_SIZES: PresetSize[] = [
  { label: '50×80', width: 50, height: 80 },
  { label: '40×30', width: 40, height: 30 },
  { label: '40×60', width: 40, height: 60 },
];

// 配置读写
export const loadConfig = (): PrintConfig =>
  getObjectState(MODULE, 'config', DEFAULT_CONFIG);

export const saveConfig = (config: PrintConfig): void =>
  saveObjectState(MODULE, 'config', config);

// 预设尺寸读写
export const loadPresetSizes = (): PresetSize[] =>
  getObjectState(MODULE, 'presetSizes', DEFAULT_PRESET_SIZES);

export const savePresetSizes = (sizes: PresetSize[]): void =>
  saveObjectState(MODULE, 'presetSizes', sizes);
