/**
 * 咨啡豆品种相关的工具函数
 * 统一处理新旧数据格式的品种信息获取
 */

import type { CoffeeBean } from '@/types/app';
import { calculateFlavorInfo } from './flavorPeriodUtils';
import {
  extractRoasterFromDisplayName,
  formatCoffeeBeanDisplayName,
  getBeanNameWithoutRoaster,
  getBeanRoasterName,
  normalizeDelimitedTextList,
  removeRoasterFromDisplayName,
} from './coffeeBeanUtils';

/**
 * 检查文本是否为有效值
 * @param text 要检查的文本
 * @returns 是否为有效的真实数据（非空、非undefined、非null）
 */
const isValidText = (text: string | undefined | null): boolean => {
  return Boolean(text && typeof text === 'string' && text.trim() !== '');
};

// 扩展咖啡豆类型，包含blendComponents
export interface ExtendedCoffeeBean extends CoffeeBean {
  blendComponents?: {
    percentage?: number;
    origin?: string;
    region?: string;
    estate?: string;
    lot?: string;
    batch?: string;
    station?: string;
    altitude?: string;
    season?: string;
    process?: string;
    variety?: string;
    agtron?: string;
  }[];
}

/**
 * 获取咖啡豆的所有品种信息
 * 从blendComponents获取品种信息
 * @param bean 咖啡豆对象
 * @returns 品种数组，如果没有品种信息则返回空数组
 */
export const getBeanVarieties = (bean: CoffeeBean): string[] => {
  const varieties: string[] = [];

  // 从blendComponents获取品种信息
  if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
    bean.blendComponents.forEach(component => {
      if (isValidText(component.variety)) {
        varieties.push(...normalizeDelimitedTextList(component.variety));
      }
    });
  }

  // 去重并返回
  return Array.from(new Set(varieties));
};

/**
 * 获取咖啡豆的主要品种（第一个品种）
 * @param bean 咖啡豆对象
 * @returns 主要品种名称，如果没有则返回null
 */
const _getBeanPrimaryVariety = (bean: ExtendedCoffeeBean): string | null => {
  const varieties = getBeanVarieties(bean);
  return varieties.length > 0 ? varieties[0] : null;
};

/**
 * 检查咖啡豆是否包含指定品种
 * @param bean 咖啡豆对象
 * @param variety 要检查的品种名称
 * @returns 是否包含该品种
 */
export const beanHasVariety = (
  bean: ExtendedCoffeeBean,
  variety: string
): boolean => {
  const varieties = getBeanVarieties(bean);
  return varieties.includes(variety);
};

/**
 * 获取咖啡豆的品种显示文本
 * 如果有多个品种，用"、"连接；如果没有品种，返回null
 * @param bean 咖啡豆对象
 * @returns 品种显示文本或null
 */
const _getBeanVarietyDisplay = (bean: ExtendedCoffeeBean): string | null => {
  const varieties = getBeanVarieties(bean);
  return varieties.length > 0 ? varieties.join('、') : null;
};

/**
 * 从咖啡豆数组中提取所有唯一的品种
 * @param beans 咖啡豆数组
 * @returns 按数量排序的唯一品种数组（数量多的在前）
 */
export const extractUniqueVarieties = (
  beans: ExtendedCoffeeBean[]
): string[] => {
  const varietyCount = new Map<string, number>();

  // 统计每个品种的咖啡豆数量
  beans.forEach(bean => {
    const varieties = getBeanVarieties(bean);
    varieties.forEach(variety => {
      varietyCount.set(variety, (varietyCount.get(variety) || 0) + 1);
    });
  });

  // 按数量排序，数量多的在前
  const varieties = Array.from(varietyCount.entries())
    .sort((a, b) => {
      // 按数量降序排列
      if (a[1] !== b[1]) {
        return b[1] - a[1];
      }

      // 数量相同时按名称字母顺序排列
      return a[0].localeCompare(b[0], 'zh-CN');
    })
    .map(entry => entry[0]);

  return varieties;
};

/**
 * 从咖啡豆数组中提取所有唯一的产地
 * @param beans 咖啡豆数组
 * @returns 按数量排序的唯一产地数组（数量多的在前）
 */
export const extractUniqueOrigins = (beans: CoffeeBean[]): string[] => {
  const originCount = new Map<string, number>();

  // 统计每个产地的咖啡豆数量
  beans.forEach(bean => {
    const origins = getBeanOrigins(bean);
    origins.forEach(origin => {
      originCount.set(origin, (originCount.get(origin) || 0) + 1);
    });
  });

  // 按数量排序，数量多的在前
  const origins = Array.from(originCount.entries())
    .sort((a, b) => {
      // 按数量降序排列
      if (a[1] !== b[1]) {
        return b[1] - a[1];
      }

      // 数量相同时按名称字母顺序排列
      return a[0].localeCompare(b[0], 'zh-CN');
    })
    .map(entry => entry[0]);

  return origins;
};

/**
 * 从咖啡豆数组中提取所有唯一的处理法
 * @param beans 咖啡豆数组
 * @returns 按数量排序的唯一处理法数组（数量多的在前）
 */
export const extractUniqueProcesses = (beans: CoffeeBean[]): string[] => {
  const processCount = new Map<string, number>();

  // 统计每个处理法的咖啡豆数量
  beans.forEach(bean => {
    const processes = getBeanProcesses(bean);
    processes.forEach(process => {
      processCount.set(process, (processCount.get(process) || 0) + 1);
    });
  });

  // 按数量排序，数量多的在前
  const processes = Array.from(processCount.entries())
    .sort((a, b) => {
      // 按数量降序排列
      if (a[1] !== b[1]) {
        return b[1] - a[1];
      }

      // 数量相同时按名称字母顺序排列
      return a[0].localeCompare(b[0], 'zh-CN');
    })
    .map(entry => entry[0]);

  return processes;
};

/**
 * 检查咖啡豆是否包含指定产地
 * @param bean 咖啡豆对象
 * @param origin 要检查的产地名称
 * @returns 是否包含该产地
 */
export const beanHasOrigin = (bean: CoffeeBean, origin: string): boolean => {
  const origins = getBeanOrigins(bean);
  return origins.includes(origin);
};

/**
 * 检查咖啡豆是否包含指定处理法
 * @param bean 咖啡豆对象
 * @param process 要检查的处理法名称
 * @returns 是否包含该处理法
 */
export const beanHasProcess = (
  bean: ExtendedCoffeeBean,
  process: string
): boolean => {
  const processes = getBeanProcesses(bean);
  return processes.includes(process);
};

/**
 * 获取咖啡豆的产地信息
 * 从blendComponents获取产地信息
 * @param bean 咖啡豆对象
 * @returns 产地数组
 */
export const getBeanOrigins = (bean: CoffeeBean): string[] => {
  const origins: string[] = [];

  // 从blendComponents获取产地信息
  if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
    bean.blendComponents.forEach(component => {
      if (isValidText(component.origin)) {
        origins.push(...normalizeDelimitedTextList(component.origin));
      }
    });
  }

  // 去重并返回
  return Array.from(new Set(origins));
};

/**
 * 获取咖啡豆的处理法信息
 * 从blendComponents获取处理法信息
 * @param bean 咖啡豆对象
 * @returns 处理法数组
 */
export const getBeanProcesses = (bean: CoffeeBean): string[] => {
  const processes: string[] = [];

  // 从blendComponents获取处理法信息
  if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
    bean.blendComponents.forEach(component => {
      if (isValidText(component.process)) {
        processes.push(...normalizeDelimitedTextList(component.process));
      }
    });
  }

  // 去重并返回
  return Array.from(new Set(processes));
};

/**
 * 获取咖啡豆的庄园信息
 * 从blendComponents获取庄园信息
 * @param bean 咖啡豆对象
 * @returns 庄园数组
 */
export const getBeanEstates = (bean: CoffeeBean): string[] => {
  const estates: string[] = [];

  // 从blendComponents获取庄园信息
  if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
    bean.blendComponents.forEach(component => {
      if (isValidText(component.estate)) {
        estates.push(...normalizeDelimitedTextList(component.estate));
      }
    });
  }

  // 去重并返回
  return Array.from(new Set(estates));
};

/**
 * 从咖啡豆数组中提取所有唯一的庄园
 * @param beans 咖啡豆数组
 * @returns 按数量排序的唯一庄园数组（数量多的在前）
 */
export const extractUniqueEstates = (beans: CoffeeBean[]): string[] => {
  const estateCount = new Map<string, number>();

  // 统计每个庄园的咖啡豆数量
  beans.forEach(bean => {
    const estates = getBeanEstates(bean);
    estates.forEach(estate => {
      estateCount.set(estate, (estateCount.get(estate) || 0) + 1);
    });
  });

  // 按数量排序，数量多的在前
  const estates = Array.from(estateCount.entries())
    .sort((a, b) => {
      // 按数量降序排列
      if (a[1] !== b[1]) {
        return b[1] - a[1];
      }

      // 数量相同时按名称字母顺序排列
      return a[0].localeCompare(b[0], 'zh-CN');
    })
    .map(entry => entry[0]);

  return estates;
};

/**
 * 获取咖啡豆的地块信息
 * 从blendComponents获取地块信息
 * @param bean 咖啡豆对象
 * @returns 地块数组
 */
export const getBeanLots = (bean: CoffeeBean): string[] => {
  const lots: string[] = [];

  if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
    bean.blendComponents.forEach(component => {
      if (isValidText(component.lot)) {
        lots.push(...normalizeDelimitedTextList(component.lot));
      }
    });
  }

  return Array.from(new Set(lots));
};

/**
 * 从咖啡豆数组中提取所有唯一的地块
 * @param beans 咖啡豆数组
 * @returns 按数量排序的唯一地块数组（数量多的在前）
 */
export const extractUniqueLots = (beans: CoffeeBean[]): string[] => {
  const lotCount = new Map<string, number>();

  beans.forEach(bean => {
    const lots = getBeanLots(bean);
    lots.forEach(lot => {
      lotCount.set(lot, (lotCount.get(lot) || 0) + 1);
    });
  });

  const lots = Array.from(lotCount.entries())
    .sort((a, b) => {
      if (a[1] !== b[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0], 'zh-CN');
    })
    .map(entry => entry[0]);

  return lots;
};

/**
 * 获取咖啡豆的批次信息
 * 从blendComponents获取批次信息
 * @param bean 咖啡豆对象
 * @returns 批次数组
 */
export const getBeanBatches = (bean: CoffeeBean): string[] => {
  const batches: string[] = [];

  if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
    bean.blendComponents.forEach(component => {
      if (isValidText(component.batch)) {
        batches.push(...normalizeDelimitedTextList(component.batch));
      }
    });
  }

  return Array.from(new Set(batches));
};

/**
 * 从咖啡豆数组中提取所有唯一的批次
 * @param beans 咖啡豆数组
 * @returns 按数量排序的唯一批次数组（数量多的在前）
 */
export const extractUniqueBatches = (beans: CoffeeBean[]): string[] => {
  const batchCount = new Map<string, number>();

  beans.forEach(bean => {
    const batches = getBeanBatches(bean);
    batches.forEach(batch => {
      batchCount.set(batch, (batchCount.get(batch) || 0) + 1);
    });
  });

  const batches = Array.from(batchCount.entries())
    .sort((a, b) => {
      if (a[1] !== b[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0], 'zh-CN');
    })
    .map(entry => entry[0]);

  return batches;
};

/**
 * 获取咖啡豆的处理站信息
 * 从blendComponents获取处理站信息
 * @param bean 咖啡豆对象
 * @returns 处理站数组
 */
export const getBeanStations = (bean: CoffeeBean): string[] => {
  const stations: string[] = [];

  if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
    bean.blendComponents.forEach(component => {
      if (isValidText(component.station)) {
        stations.push(...normalizeDelimitedTextList(component.station));
      }
    });
  }

  return Array.from(new Set(stations));
};

/**
 * 从咖啡豆数组中提取所有唯一的处理站
 * @param beans 咖啡豆数组
 * @returns 按数量排序的唯一处理站数组（数量多的在前）
 */
export const extractUniqueStations = (beans: CoffeeBean[]): string[] => {
  const stationCount = new Map<string, number>();

  beans.forEach(bean => {
    const stations = getBeanStations(bean);
    stations.forEach(station => {
      stationCount.set(station, (stationCount.get(station) || 0) + 1);
    });
  });

  const stations = Array.from(stationCount.entries())
    .sort((a, b) => {
      if (a[1] !== b[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0], 'zh-CN');
    })
    .map(entry => entry[0]);

  return stations;
};

/**
 * 获取咖啡豆的产区信息
 * 从blendComponents获取产区信息
 * @param bean 咖啡豆对象
 * @returns 产区数组
 */
export const getBeanRegions = (bean: CoffeeBean): string[] => {
  const regions: string[] = [];

  if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
    bean.blendComponents.forEach(component => {
      if (isValidText(component.region)) {
        regions.push(...normalizeDelimitedTextList(component.region));
      }
    });
  }

  return Array.from(new Set(regions));
};

/**
 * 获取咖啡豆的海拔信息
 * 从blendComponents获取海拔信息
 * @param bean 咖啡豆对象
 * @returns 海拔数组
 */
export const getBeanAltitudes = (bean: CoffeeBean): string[] => {
  const altitudes: string[] = [];

  if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
    bean.blendComponents.forEach(component => {
      if (isValidText(component.altitude)) {
        altitudes.push(...normalizeDelimitedTextList(component.altitude));
      }
    });
  }

  return Array.from(new Set(altitudes));
};

/**
 * 获取咖啡豆的产季信息
 * 从blendComponents获取产季信息
 * @param bean 咖啡豆对象
 * @returns 产季数组
 */
export const getBeanSeasons = (bean: CoffeeBean): string[] => {
  const seasons: string[] = [];

  if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
    bean.blendComponents.forEach(component => {
      if (isValidText(component.season)) {
        seasons.push(...normalizeDelimitedTextList(component.season));
      }
    });
  }

  return Array.from(new Set(seasons));
};

/**
 * 从咖啡豆数组中提取所有唯一的产区
 * @param beans 咖啡豆数组
 * @returns 按数量排序的唯一产区数组（数量多的在前）
 */
export const extractUniqueRegions = (beans: CoffeeBean[]): string[] => {
  const regionCount = new Map<string, number>();

  beans.forEach(bean => {
    const regions = getBeanRegions(bean);
    regions.forEach(region => {
      regionCount.set(region, (regionCount.get(region) || 0) + 1);
    });
  });

  const regions = Array.from(regionCount.entries())
    .sort((a, b) => {
      if (a[1] !== b[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0], 'zh-CN');
    })
    .map(entry => entry[0]);

  return regions;
};

/**
 * 从咖啡豆数组中提取所有唯一的海拔
 * @param beans 咖啡豆数组
 * @returns 按数量排序的唯一海拔数组（数量多的在前）
 */
export const extractUniqueAltitudes = (beans: CoffeeBean[]): string[] => {
  const altitudeCount = new Map<string, number>();

  beans.forEach(bean => {
    const altitudes = getBeanAltitudes(bean);
    altitudes.forEach(altitude => {
      altitudeCount.set(altitude, (altitudeCount.get(altitude) || 0) + 1);
    });
  });

  const altitudes = Array.from(altitudeCount.entries())
    .sort((a, b) => {
      if (a[1] !== b[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0], 'zh-CN');
    })
    .map(entry => entry[0]);

  return altitudes;
};

/**
 * 从咖啡豆数组中提取所有唯一的产季
 * @param beans 咖啡豆数组
 * @returns 按数量排序的唯一产季数组（数量多的在前）
 */
export const extractUniqueSeasons = (beans: CoffeeBean[]): string[] => {
  const seasonCount = new Map<string, number>();

  beans.forEach(bean => {
    const seasons = getBeanSeasons(bean);
    seasons.forEach(season => {
      seasonCount.set(season, (seasonCount.get(season) || 0) + 1);
    });
  });

  const seasons = Array.from(seasonCount.entries())
    .sort((a, b) => {
      if (a[1] !== b[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0], 'zh-CN');
    })
    .map(entry => entry[0]);

  return seasons;
};

/**
 * 获取咖啡豆的Agtron值信息
 * 从blendComponents获取Agtron值信息
 * @param bean 咖啡豆对象
 * @returns Agtron值数组
 */
export const getBeanAgtrons = (bean: CoffeeBean): string[] => {
  const agtrons: string[] = [];

  if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
    bean.blendComponents.forEach(component => {
      if (isValidText(component.agtron)) {
        agtrons.push(...normalizeDelimitedTextList(component.agtron));
      }
    });
  }

  return Array.from(new Set(agtrons));
};

/**
 * 从咖啡豆数组中提取所有唯一的Agtron值
 * @param beans 咖啡豆数组
 * @returns 按数量排序的唯一Agtron值数组（数量多的在前）
 */
export const extractUniqueAgtrons = (beans: CoffeeBean[]): string[] => {
  const agtronCount = new Map<string, number>();

  beans.forEach(bean => {
    const agtrons = getBeanAgtrons(bean);
    agtrons.forEach(agtron => {
      agtronCount.set(agtron, (agtronCount.get(agtron) || 0) + 1);
    });
  });

  const agtrons = Array.from(agtronCount.entries())
    .sort((a, b) => {
      if (a[1] !== b[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0], 'zh-CN');
    })
    .map(entry => entry[0]);

  return agtrons;
};

/**
 * 获取咖啡豆的风味标签
 * @param bean 咖啡豆对象
 * @returns 风味标签数组
 */
export const getBeanFlavors = (bean: CoffeeBean): string[] => {
  const flavors: string[] = [];

  // 从flavor字段获取风味信息
  if (bean.flavor && Array.isArray(bean.flavor)) {
    bean.flavor.forEach(flavor => {
      if (isValidText(flavor)) {
        flavors.push(...normalizeDelimitedTextList(flavor));
      }
    });
  }

  // 去重并返回
  return Array.from(new Set(flavors));
};

// 旧格式转换函数已移除，因为已经统一使用 blendComponents 结构

/**
 * 赏味期状态枚举 - 与现有系统保持一致
 */
export enum FlavorPeriodStatus {
  AGING = 'aging', // 养豆期
  OPTIMAL = 'optimal', // 赏味期
  DECLINE = 'decline', // 衰退期
  FROZEN = 'frozen', // 冷冻
  IN_TRANSIT = 'in_transit', // 在途
  UNKNOWN = 'unknown', // 未知（没有烘焙日期）
}

/**
 * 赏味期状态显示名称
 */
export const FLAVOR_PERIOD_LABELS: Record<FlavorPeriodStatus, string> = {
  [FlavorPeriodStatus.AGING]: '养豆期',
  [FlavorPeriodStatus.OPTIMAL]: '赏味期',
  [FlavorPeriodStatus.DECLINE]: '衰退期',
  [FlavorPeriodStatus.FROZEN]: '冷冻',
  [FlavorPeriodStatus.IN_TRANSIT]: '在途',
  [FlavorPeriodStatus.UNKNOWN]: '未知',
};

/**
 * 计算咖啡豆的赏味期状态 - 与现有系统保持一致
 * @param bean 咖啡豆对象
 * @returns 赏味期状态
 */
export const getBeanFlavorPeriodStatus = (
  bean: ExtendedCoffeeBean
): FlavorPeriodStatus => {
  // 使用统一的赏味期计算工具
  const flavorInfo = calculateFlavorInfo(bean);

  // 将阶段名称映射到枚举值
  switch (flavorInfo.phase) {
    case '在途':
      return FlavorPeriodStatus.IN_TRANSIT;
    case '冷冻':
      return FlavorPeriodStatus.FROZEN;
    case '养豆期':
      return FlavorPeriodStatus.AGING;
    case '赏味期':
      return FlavorPeriodStatus.OPTIMAL;
    case '衰退期':
      return FlavorPeriodStatus.DECLINE;
    default:
      return FlavorPeriodStatus.UNKNOWN;
  }
};

/**
 * 检查咖啡豆是否属于指定的赏味期状态
 * @param bean 咖啡豆对象
 * @param status 要检查的赏味期状态
 * @returns 是否属于该状态
 */
export const beanHasFlavorPeriodStatus = (
  bean: ExtendedCoffeeBean,
  status: FlavorPeriodStatus
): boolean => {
  return getBeanFlavorPeriodStatus(bean) === status;
};

/**
 * 从咖啡豆数组中提取所有存在的赏味期状态
 * @param beans 咖啡豆数组
 * @returns 存在的赏味期状态数组
 */
export const extractAvailableFlavorPeriodStatuses = (
  beans: ExtendedCoffeeBean[]
): FlavorPeriodStatus[] => {
  const statusesSet = new Set<FlavorPeriodStatus>();

  beans.forEach(bean => {
    const status = getBeanFlavorPeriodStatus(bean);
    statusesSet.add(status);
  });

  // 按优先级排序：冷冻 > 赏味期 > 养豆期 > 衰退期 > 未知 > 在途
  const priorityOrder = [
    FlavorPeriodStatus.FROZEN,
    FlavorPeriodStatus.OPTIMAL,
    FlavorPeriodStatus.AGING,
    FlavorPeriodStatus.DECLINE,
    FlavorPeriodStatus.UNKNOWN,
    FlavorPeriodStatus.IN_TRANSIT,
  ];

  return priorityOrder.filter(status => statusesSet.has(status));
};

/**
 * 烘焙商相关设置接口
 */
export interface RoasterSettings {
  roasterFieldEnabled?: boolean;
  roasterSeparator?: ' ' | '/';
}

/**
 * 获取烘焙商名称
 * 优先使用 roaster 字段，否则返回空字符串
 * @param bean 咖啡豆对象
 * @param _settings 烘焙商相关设置（保留参数以保持API兼容性）
 * @returns 烘焙商名称
 */
export const getRoasterName = (
  bean: CoffeeBean,
  _settings?: RoasterSettings
): string => {
  return getBeanRoasterName(bean);
};

/**
 * 格式化咖啡豆显示名称
 * 始终使用 roaster + name 组合显示（如果有 roaster）
 * @param bean 咖啡豆对象
 * @param settings 烘焙商相关设置
 * @returns 格式化后的显示名称
 */
export const formatBeanDisplayName = (
  bean: CoffeeBean,
  settings?: RoasterSettings
): string => {
  // 只有开启独立输入时才使用用户设置的分隔符，否则使用空格
  const separator =
    settings?.roasterFieldEnabled && settings?.roasterSeparator === '/'
      ? '/'
      : ' ';
  return formatCoffeeBeanDisplayName(bean, separator);
};

/**
 * 获取不含烘焙商前缀的咖啡豆名称
 * 用于烘焙商已经单独展示的场景。
 * @param bean 咖啡豆对象
 * @param settings 烘焙商相关设置
 * @returns 不含烘焙商的咖啡豆名称
 */
export const formatBeanNameWithoutRoaster = (
  bean: CoffeeBean,
  settings?: RoasterSettings
): string => {
  const separator =
    settings?.roasterFieldEnabled && settings?.roasterSeparator === '/'
      ? '/'
      : ' ';
  return getBeanNameWithoutRoaster(bean, separator);
};

/**
 * 从咖啡豆名称中提取烘焙商名称
 * 假设烘焙商名称在咖啡豆名称的最前面，用分隔符分隔
 * @param beanName 咖啡豆名称
 * @param separator 分隔符，默认为空格，支持 "/" 分隔符
 * @returns 烘焙商名称，如果无法识别则返回 null
 */
export const extractRoasterFromName = (
  beanName: string,
  separator: ' ' | '/' = ' '
): string | null => {
  return extractRoasterFromDisplayName(beanName, separator);
};

/**
 * 从咖啡豆名称中移除烘焙商部分，返回纯咖啡豆名称
 * @param beanName 完整的咖啡豆名称（包含烘焙商）
 * @param separator 分隔符，默认为空格
 * @returns 移除烘焙商后的咖啡豆名称
 */
export const removeRoasterFromName = (
  beanName: string,
  separator: ' ' | '/' = ' '
): string => {
  return removeRoasterFromDisplayName(beanName, separator);
};

/**
 * 从咖啡豆数组中提取所有唯一的烘焙商
 * @param beans 咖啡豆数组
 * @param _settings 烘焙商相关设置（保留参数以保持API兼容性）
 * @returns 按数量排序的唯一烘焙商数组（数量多的在前）
 */
export const extractUniqueRoasters = (
  beans: ExtendedCoffeeBean[],
  _settings?: RoasterSettings
): string[] => {
  const roasterCount = new Map<string, number>();

  // 统计每个烘焙商的咖啡豆数量
  beans.forEach(bean => {
    const roaster = getBeanRoasterName(bean);
    if (roaster) {
      roasterCount.set(roaster, (roasterCount.get(roaster) || 0) + 1);
    }
  });

  // 按数量排序，数量多的在前
  const roasters = Array.from(roasterCount.entries())
    .sort((a, b) => {
      // 按数量降序排列
      if (a[1] !== b[1]) {
        return b[1] - a[1];
      }
      // 数量相同时按名称字母顺序排列
      return a[0].localeCompare(b[0], 'zh-CN');
    })
    .map(entry => entry[0]);

  return roasters;
};

/**
 * 检查咖啡豆是否属于指定的烘焙商
 * @param bean 咖啡豆对象
 * @param roaster 要检查的烘焙商名称
 * @param _settings 烘焙商相关设置（保留参数以保持API兼容性）
 * @returns 是否属于该烘焙商
 */
export const beanHasRoaster = (
  bean: ExtendedCoffeeBean,
  roaster: string,
  settings?: RoasterSettings
): boolean => {
  return getRoasterName(bean, settings) === roaster;
};

/**
 * 获取咖啡豆显示用的首字母
 * 优先使用烘焙商首字母，如果没有烘焙商则使用名称首字母
 * @param bean 咖啡豆对象（可以是完整对象或部分对象）
 * @returns 首字母，如果都没有则返回 '豆'
 */
export const getBeanDisplayInitial = (
  bean: { name?: string; roaster?: string } | null | undefined
): string => {
  if (!bean) return '豆';

  // 优先使用烘焙商首字母
  const roaster = getBeanRoasterName(bean);
  if (roaster) {
    return roaster.charAt(0);
  }

  // 其次使用名称首字母
  if (bean.name && bean.name.trim()) {
    return bean.name.trim().charAt(0);
  }

  return '豆';
};

/**
 * 笔记中咖啡豆信息的接口
 */
export interface NoteCoffeeBeanInfo {
  name: string;
  roaster?: string;
}

/**
 * 格式化笔记中的咖啡豆显示名称
 * 始终使用 roaster + name 组合显示（如果有 roaster）
 * @param beanInfo 笔记中存储的咖啡豆信息
 * @param settings 烘焙商相关设置
 * @returns 格式化后的显示名称
 */
export const formatNoteBeanDisplayName = (
  beanInfo: NoteCoffeeBeanInfo | undefined | null,
  settings?: RoasterSettings
): string => {
  if (!beanInfo?.name) {
    return '';
  }

  // 如果没有 roaster 值，直接返回名称
  if (!beanInfo.roaster) {
    return beanInfo.name;
  }

  // 只有开启独立输入时才使用用户设置的分隔符，否则使用空格
  const separator =
    settings?.roasterFieldEnabled && settings?.roasterSeparator === '/'
      ? '/'
      : ' ';
  return `${beanInfo.roaster}${separator}${beanInfo.name}`;
};
