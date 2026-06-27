import {
  getObjectState,
  getStringState,
  saveObjectState,
  saveStringState,
} from '@/lib/core/statePersistence';
import {
  PrintConfig,
  PrintIconPlacement,
  PrintIconSource,
  PresetSize,
} from './types';

const MODULE = 'bean-print';
const ICON_KEY = 'icon';
const ICON_SOURCE_KEY = 'iconSource';

export const DEFAULT_ICON_PLACEMENT: PrintIconPlacement = {
  x: 74,
  y: 24,
  size: 18,
};

export const ICON_PLACEMENT_LIMITS = {
  minSize: 6,
  maxSize: 45,
} as const;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const normalizePrintIconPlacement = (
  placement: Partial<PrintIconPlacement> | null | undefined
): PrintIconPlacement => ({
  x: clamp(placement?.x ?? DEFAULT_ICON_PLACEMENT.x, 0, 100),
  y: clamp(placement?.y ?? DEFAULT_ICON_PLACEMENT.y, 0, 100),
  size: clamp(
    placement?.size ?? DEFAULT_ICON_PLACEMENT.size,
    ICON_PLACEMENT_LIMITS.minSize,
    ICON_PLACEMENT_LIMITS.maxSize
  ),
});

// 默认配置
export const DEFAULT_CONFIG: PrintConfig = {
  width: 50,
  height: 80,
  orientation: 'landscape',
  fields: {
    name: true,
    nameSeparator: false,
    contentBottomAligned: true,
    origin: true,
    estate: false,
    roastLevel: true,
    roastDate: true,
    packDate: false,
    flavor: true,
    process: true,
    variety: true,
    notes: true,
    weight: false,
    icon: true,
  },
  margin: 3,
  fontSize: 13,
  titleFontSize: 17,
  fontWeight: 500,
  template: 'detailed',
  iconPlacement: DEFAULT_ICON_PLACEMENT,
};

// 默认预设尺寸
export const DEFAULT_PRESET_SIZES: PresetSize[] = [
  { label: '50×80', width: 50, height: 80 },
  { label: '40×30', width: 40, height: 30 },
  { label: '40×60', width: 40, height: 60 },
];

const normalizePrintConfig = (
  config: Partial<PrintConfig> | null | undefined
): PrintConfig => ({
  width: config?.width ?? DEFAULT_CONFIG.width,
  height: config?.height ?? DEFAULT_CONFIG.height,
  orientation: config?.orientation ?? DEFAULT_CONFIG.orientation,
  fields: {
    ...DEFAULT_CONFIG.fields,
    ...(config?.fields ?? {}),
  },
  margin: config?.margin ?? DEFAULT_CONFIG.margin,
  fontSize: config?.fontSize ?? DEFAULT_CONFIG.fontSize,
  titleFontSize: config?.titleFontSize ?? DEFAULT_CONFIG.titleFontSize,
  fontWeight: config?.fontWeight ?? DEFAULT_CONFIG.fontWeight,
  template: config?.template ?? DEFAULT_CONFIG.template,
  iconPlacement: normalizePrintIconPlacement(config?.iconPlacement),
});

// 配置读写
export const loadConfig = (): PrintConfig =>
  normalizePrintConfig(getObjectState(MODULE, 'config', DEFAULT_CONFIG));

export const saveConfig = (config: PrintConfig): void =>
  saveObjectState(MODULE, 'config', normalizePrintConfig(config));

// 图标读写
export const loadPrintIcon = (): string => getStringState(MODULE, ICON_KEY, '');

export const savePrintIcon = (icon: string): void =>
  saveStringState(MODULE, ICON_KEY, icon);

export const loadPrintIconSource = (): PrintIconSource => {
  const source = getStringState(MODULE, ICON_SOURCE_KEY, 'custom');
  return source === 'roaster' ? 'roaster' : 'custom';
};

export const savePrintIconSource = (source: PrintIconSource): void =>
  saveStringState(MODULE, ICON_SOURCE_KEY, source);

// 预设尺寸读写
export const loadPresetSizes = (): PresetSize[] =>
  getObjectState(MODULE, 'presetSizes', DEFAULT_PRESET_SIZES);

export const savePresetSizes = (sizes: PresetSize[]): void =>
  saveObjectState(MODULE, 'presetSizes', sizes);
