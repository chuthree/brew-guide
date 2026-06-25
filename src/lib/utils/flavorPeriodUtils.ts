import { CoffeeBean } from '@/types/app';
import { type SettingsOptions } from '@/lib/core/db';
import {
  defaultSettings,
  getRoasterConfigSync,
  getSettingsStore,
} from '@/lib/stores/settingsStore';

// 赏味期信息接口
export interface FlavorInfo {
  phase: string;
  remainingDays: number;
  status?: string;
}

type FlavorPeriodDayValue = number | string | null | undefined;
type FlavorPeriodValue = {
  startDay?: FlavorPeriodDayValue;
  endDay?: FlavorPeriodDayValue;
};
type FlavorPeriodMap = {
  light?: FlavorPeriodValue;
  medium?: FlavorPeriodValue;
  dark?: FlavorPeriodValue;
};

const PRESET_VALUES = {
  light: { startDay: 7, endDay: 60 },
  medium: { startDay: 10, endDay: 60 },
  dark: { startDay: 14, endDay: 90 },
};

export const normalizeFlavorPeriodDay = (
  value: FlavorPeriodDayValue
): number => {
  const day = Number(value);
  return Number.isFinite(day) && day > 0 ? day : 0;
};

const normalizePeriod = (
  period: FlavorPeriodValue | undefined
): { startDay: number; endDay: number } => ({
  startDay: normalizeFlavorPeriodDay(period?.startDay),
  endDay: normalizeFlavorPeriodDay(period?.endDay),
});

// 根据烘焙度选择对应的配置类型
const selectPeriodByRoastLevel = (
  roastLevel: string | undefined | null,
  periods: FlavorPeriodMap | undefined
) => {
  const roastLevelStr = typeof roastLevel === 'string' ? roastLevel : '';
  if (roastLevelStr.includes('浅')) return normalizePeriod(periods?.light);
  if (roastLevelStr.includes('深')) return normalizePeriod(periods?.dark);
  return normalizePeriod(periods?.medium);
};

const isValidPeriod = (period: { startDay: number; endDay: number }) =>
  period.startDay > 0 || period.endDay > 0;

const resolvePeriodWithPreset = (
  roastLevel: string | undefined | null,
  periodMap: FlavorPeriodMap | undefined
) => {
  const selectedPeriod = selectPeriodByRoastLevel(roastLevel, periodMap);
  const presetPeriod = selectPeriodByRoastLevel(roastLevel, PRESET_VALUES);

  return {
    startDay: selectedPeriod.startDay || presetPeriod.startDay,
    endDay: selectedPeriod.endDay || presetPeriod.endDay,
  };
};

// 获取赏味期设置
export const getFlavorPeriodSettings = (): {
  customFlavorPeriod: SettingsOptions['customFlavorPeriod'];
} => {
  try {
    const settings = getSettingsStore().settings;
    return {
      customFlavorPeriod:
        (settings.customFlavorPeriod as SettingsOptions['customFlavorPeriod']) ||
        defaultSettings.customFlavorPeriod,
    };
  } catch (error) {
    console.error('获取赏味期设置失败:', error);
    return {
      customFlavorPeriod: defaultSettings.customFlavorPeriod,
    };
  }
};

// 获取自定义赏味期设置（保持向后兼容）
export const getCustomFlavorPeriodSettings = () => {
  const settings = getFlavorPeriodSettings();
  return settings.customFlavorPeriod;
};

// 根据烘焙度获取默认赏味期参数
export const getDefaultFlavorPeriodByRoastLevel = (
  roastLevel: string | undefined | null,
  roasterName?: string
) => {
  const flavorSettings = getFlavorPeriodSettings();
  const { customFlavorPeriod } = flavorSettings;

  // 如果提供了有效的烘焙商名称，尝试获取烘焙商特定的配置
  if (roasterName && roasterName !== '未知烘焙商') {
    const roasterConfig = getRoasterConfigSync(roasterName);

    // 使用烘焙商的简单设置
    if (roasterConfig?.flavorPeriod) {
      const specificPeriod = selectPeriodByRoastLevel(
        roastLevel,
        roasterConfig.flavorPeriod
      );
      if (isValidPeriod(specificPeriod)) {
        const globalPeriod = selectPeriodByRoastLevel(
          roastLevel,
          customFlavorPeriod
        );
        const presetPeriod = selectPeriodByRoastLevel(
          roastLevel,
          PRESET_VALUES
        );

        return {
          startDay:
            specificPeriod.startDay ||
            globalPeriod.startDay ||
            presetPeriod.startDay,
          endDay:
            specificPeriod.endDay || globalPeriod.endDay || presetPeriod.endDay,
        };
      }
    }
  }

  return resolvePeriodWithPreset(roastLevel, customFlavorPeriod);
};

// 同步版本的赏味期参数获取
export const getDefaultFlavorPeriodByRoastLevelSync = (
  roastLevel: string | undefined | null,
  customFlavorPeriod?: SettingsOptions['customFlavorPeriod'],
  roasterName?: string
) => {
  let effectiveCustomFlavorPeriod = customFlavorPeriod;

  if (effectiveCustomFlavorPeriod === undefined) {
    try {
      if (typeof window !== 'undefined') {
        // 使用 settingsStore 同步获取设置
        const storeSettings = getSettingsStore().settings;
        effectiveCustomFlavorPeriod =
          (storeSettings.customFlavorPeriod as SettingsOptions['customFlavorPeriod']) ||
          defaultSettings.customFlavorPeriod;
      }
    } catch {
      // 静默处理错误，使用默认值
    }
  }

  // 确保有默认值
  effectiveCustomFlavorPeriod =
    effectiveCustomFlavorPeriod || defaultSettings.customFlavorPeriod;

  // 如果提供了有效的烘焙商名称，尝试获取烘焙商特定的配置
  if (roasterName && roasterName !== '未知烘焙商') {
    const roasterConfig = getRoasterConfigSync(roasterName);

    // 使用烘焙商的简单设置
    if (roasterConfig?.flavorPeriod) {
      const specificPeriod = selectPeriodByRoastLevel(
        roastLevel,
        roasterConfig.flavorPeriod
      );
      if (isValidPeriod(specificPeriod)) {
        const globalPeriod = selectPeriodByRoastLevel(
          roastLevel,
          effectiveCustomFlavorPeriod
        );
        const presetPeriod = selectPeriodByRoastLevel(
          roastLevel,
          PRESET_VALUES
        );

        return {
          startDay:
            specificPeriod.startDay ||
            globalPeriod.startDay ||
            presetPeriod.startDay,
          endDay:
            specificPeriod.endDay || globalPeriod.endDay || presetPeriod.endDay,
        };
      }
    }
  }

  return resolvePeriodWithPreset(roastLevel, effectiveCustomFlavorPeriod);
};

// 计算咖啡豆的赏味期信息
export const calculateFlavorInfo = (
  bean: CoffeeBean,
  _customFlavorPeriod?: SettingsOptions['customFlavorPeriod']
): FlavorInfo => {
  // 处理特殊状态
  if (bean.isInTransit) {
    return { phase: '在途', remainingDays: 0, status: '在途中' };
  }

  if (bean.isFrozen) {
    return { phase: '冷冻', remainingDays: 0, status: '冷冻' };
  }

  if (!bean.roastDate) {
    return { phase: '未知', remainingDays: 0, status: '未设置烘焙日期' };
  }

  // 计算天数差
  const today = new Date();
  const roastDate = new Date(bean.roastDate);
  const todayDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const roastDateOnly = new Date(
    roastDate.getFullYear(),
    roastDate.getMonth(),
    roastDate.getDate()
  );
  const daysSinceRoast = Math.ceil(
    (todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24)
  );

  const startDay = normalizeFlavorPeriodDay(bean.startDay);
  const endDay = normalizeFlavorPeriodDay(bean.endDay);

  // 判断当前阶段
  if (startDay > 0 && daysSinceRoast < startDay) {
    // 养豆期
    return {
      phase: '养豆期',
      remainingDays: startDay - daysSinceRoast,
      status: `还需养豆 ${startDay - daysSinceRoast} 天`,
    };
  } else if (endDay > 0 && daysSinceRoast <= endDay) {
    // 赏味期
    return {
      phase: '赏味期',
      remainingDays: endDay - daysSinceRoast,
      status: `剩余 ${endDay - daysSinceRoast} 天`,
    };
  } else if (endDay > 0) {
    // 衰退期
    return {
      phase: '衰退期',
      remainingDays: 0,
      status: '已过赏味期',
    };
  }

  return { phase: '未知', remainingDays: 0 };
};
