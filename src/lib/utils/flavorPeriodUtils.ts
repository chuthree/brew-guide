import { CoffeeBean } from '@/types/app';
import {
  defaultSettings,
  type SettingsOptions,
} from '@/components/settings/Settings';
import { extractRoasterFromName } from '@/lib/utils/beanVarietyUtils';
import RoasterLogoManager from '@/lib/managers/RoasterLogoManager';

// 赏味期信息接口
export interface FlavorInfo {
  phase: string;
  remainingDays: number;
  status?: string;
}

// 预设值常量
const PRESET_VALUES = {
  light: { startDay: 7, endDay: 60 },
  medium: { startDay: 10, endDay: 60 },
  dark: { startDay: 14, endDay: 90 },
};

// 根据烘焙度选择对应的配置类型
const selectPeriodByRoastLevel = (
  roastLevel: string | undefined | null,
  periods: { light: any; medium: any; dark: any }
) => {
  const roastLevelStr = typeof roastLevel === 'string' ? roastLevel : '';
  if (roastLevelStr.includes('浅')) return periods.light;
  if (roastLevelStr.includes('深')) return periods.dark;
  return periods.medium;
};

// 检查配置是否有效（至少有一个非0值）
const isValidPeriod = (period: { startDay: number; endDay: number }) => {
  return period.startDay > 0 || period.endDay > 0;
};

// 获取自定义赏味期设置
export const getCustomFlavorPeriodSettings = async () => {
  try {
    const { Storage } = await import('@/lib/core/storage');
    const settingsStr = await Storage.get('brewGuideSettings');

    if (settingsStr) {
      const settings: SettingsOptions = JSON.parse(settingsStr);
      return settings.customFlavorPeriod || defaultSettings.customFlavorPeriod;
    }

    return defaultSettings.customFlavorPeriod;
  } catch (error) {
    console.error('获取自定义赏味期设置失败:', error);
    return defaultSettings.customFlavorPeriod;
  }
};

// 根据烘焙度获取默认赏味期参数
export const getDefaultFlavorPeriodByRoastLevel = async (
  roastLevel: string | undefined | null,
  roasterName?: string
) => {
  const customFlavorPeriod = await getCustomFlavorPeriodSettings();

  // 如果提供了有效的烘焙商名称，尝试获取烘焙商特定的配置
  if (roasterName && roasterName !== '未知烘焙商') {
    const roasterConfig =
      await RoasterLogoManager.getConfigByRoaster(roasterName);
    if (roasterConfig?.flavorPeriod) {
      const specificPeriod = selectPeriodByRoastLevel(
        roastLevel,
        roasterConfig.flavorPeriod
      );
      if (isValidPeriod(specificPeriod)) {
        // 获取全局默认预设和硬编码预设作为回退
        const globalPeriod = selectPeriodByRoastLevel(
          roastLevel,
          customFlavorPeriod!
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

  // 使用全局自定义配置或预设值
  const selectedPeriod = selectPeriodByRoastLevel(
    roastLevel,
    customFlavorPeriod!
  );
  const presetPeriod = selectPeriodByRoastLevel(roastLevel, PRESET_VALUES);

  return {
    startDay: selectedPeriod.startDay || presetPeriod.startDay,
    endDay: selectedPeriod.endDay || presetPeriod.endDay,
  };
};

// 同步版本的赏味期参数获取
export const getDefaultFlavorPeriodByRoastLevelSync = (
  roastLevel: string | undefined | null,
  customFlavorPeriod?: SettingsOptions['customFlavorPeriod'],
  roasterName?: string
) => {
  // 如果提供了有效的烘焙商名称，尝试获取烘焙商特定的配置
  if (roasterName && roasterName !== '未知烘焙商') {
    const roasterConfig =
      RoasterLogoManager.getConfigByRoasterSync(roasterName);
    if (roasterConfig?.flavorPeriod) {
      const specificPeriod = selectPeriodByRoastLevel(
        roastLevel,
        roasterConfig.flavorPeriod
      );
      if (isValidPeriod(specificPeriod)) {
        // 获取全局默认预设和硬编码预设作为回退
        const flavorPeriod =
          customFlavorPeriod || defaultSettings.customFlavorPeriod;
        const globalPeriod = selectPeriodByRoastLevel(
          roastLevel,
          flavorPeriod!
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

  // 使用全局自定义配置或预设值
  const flavorPeriod = customFlavorPeriod || defaultSettings.customFlavorPeriod;
  const selectedPeriod = selectPeriodByRoastLevel(roastLevel, flavorPeriod!);
  const presetPeriod = selectPeriodByRoastLevel(roastLevel, PRESET_VALUES);

  return {
    startDay: selectedPeriod.startDay || presetPeriod.startDay,
    endDay: selectedPeriod.endDay || presetPeriod.endDay,
  };
};

// 计算咖啡豆的赏味期信息
export const calculateFlavorInfo = (
  bean: CoffeeBean,
  customFlavorPeriod?: SettingsOptions['customFlavorPeriod']
): FlavorInfo => {
  // 处理特殊状态
  if (bean.isInTransit) {
    return { phase: '在途', remainingDays: 0, status: '在途中' };
  }

  if (bean.isFrozen) {
    return { phase: '冷冻', remainingDays: 0, status: '冷冻保存' };
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

  // 优先使用自定义赏味期参数，如果没有则根据烘焙度计算
  let startDay = bean.startDay || 0;
  let endDay = bean.endDay || 0;

  // 如果没有自定义值，则根据烘焙度设置默认值
  if (startDay === 0 && endDay === 0) {
    const roasterName = extractRoasterFromName(bean.name);
    const defaultPeriod = getDefaultFlavorPeriodByRoastLevelSync(
      bean.roastLevel || '',
      customFlavorPeriod,
      roasterName
    );
    startDay = defaultPeriod.startDay;
    endDay = defaultPeriod.endDay;
  }

  // 判断当前阶段
  if (daysSinceRoast < startDay) {
    // 养豆期
    return {
      phase: '养豆期',
      remainingDays: startDay - daysSinceRoast,
      status: `还需养豆 ${startDay - daysSinceRoast} 天`,
    };
  } else if (daysSinceRoast <= endDay) {
    // 赏味期
    return {
      phase: '赏味期',
      remainingDays: endDay - daysSinceRoast,
      status: `剩余 ${endDay - daysSinceRoast} 天`,
    };
  } else {
    // 衰退期
    return {
      phase: '衰退期',
      remainingDays: 0,
      status: '已过赏味期',
    };
  }
};
