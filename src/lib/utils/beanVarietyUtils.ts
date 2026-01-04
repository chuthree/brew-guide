/**
 * 咨啡豆品种相关的工具函数
 * 统一处理新旧数据格式的品种信息获取
 */

import type { CoffeeBean } from '@/types/app';
import { calculateFlavorInfo } from './flavorPeriodUtils';

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
    process?: string;
    variety?: string;
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
        varieties.push(component.variety!.trim());
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
 * @returns 排序后的唯一处理法数组
 */
const _extractUniqueProcesses = (beans: CoffeeBean[]): string[] => {
  const processesSet = new Set<string>();

  beans.forEach(bean => {
    const processes = getBeanProcesses(bean);
    processes.forEach(process => processesSet.add(process));
  });

  return Array.from(processesSet).sort();
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
const _beanHasProcess = (
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
        origins.push(component.origin!.trim());
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
        processes.push(component.process!.trim());
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
        estates.push(component.estate!.trim());
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
        flavors.push(flavor.trim());
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
 * 优先使用 roaster 字段，否则从名称中提取
 * @param bean 咖啡豆对象
 * @param settings 烘焙商相关设置
 * @returns 烘焙商名称
 */
export const getRoasterName = (
  bean: CoffeeBean,
  settings: RoasterSettings
): string => {
  // 如果启用了烘焙商字段且有值，直接返回
  if (settings.roasterFieldEnabled && bean.roaster) {
    return bean.roaster;
  }

  // 否则从名称中提取
  return extractRoasterFromName(bean.name, settings.roasterSeparator);
};

/**
 * 格式化咖啡豆显示名称
 * 根据设置和分隔符格式化显示
 * @param bean 咖啡豆对象
 * @param settings 烘焙商相关设置
 * @returns 格式化后的显示名称
 */
export const formatBeanDisplayName = (
  bean: CoffeeBean,
  settings: RoasterSettings
): string => {
  // 如果未启用烘焙商字段或没有 roaster 字段值，直接返回名称
  if (!settings.roasterFieldEnabled || !bean.roaster) {
    return bean.name;
  }

  // 根据分隔符设置格式化显示
  const separator = settings.roasterSeparator === '/' ? '/' : ' ';
  return `${bean.roaster}${separator}${bean.name}`;
};

/**
 * 从咖啡豆名称中提取烘焙商名称
 * 假设烘焙商名称在咖啡豆名称的最前面，用分隔符分隔
 * @param beanName 咖啡豆名称
 * @param separator 分隔符，默认为空格，支持 "/" 分隔符
 * @returns 烘焙商名称，如果无法识别则返回"未知烘焙商"
 */
export const extractRoasterFromName = (
  beanName: string,
  separator: ' ' | '/' = ' '
): string => {
  if (!beanName || typeof beanName !== 'string') {
    return '未知烘焙商';
  }

  const trimmedName = beanName.trim();
  if (!trimmedName) {
    return '未知烘焙商';
  }

  // 根据分隔符分割名称
  const parts =
    separator === '/' ? trimmedName.split('/') : trimmedName.split(/\s+/);

  // 如果只有一个词，可能整个就是烘焙商名称，或者没有烘焙商信息
  if (parts.length === 1) {
    // 如果名称很短（可能是简称），直接作为烘焙商
    if (parts[0].length <= 6) {
      return parts[0];
    }
    // 如果名称较长，可能是完整的咖啡豆描述，没有单独的烘焙商
    return '未知烘焙商';
  }

  // 取第一个词作为烘焙商
  const firstPart = parts[0];

  // 过滤掉一些明显不是烘焙商的词（但保留包含"咖啡"的烘焙商名称）
  const excludeWords = ['豆', 'bean', 'beans', '手冲', '意式', '咖啡豆'];
  // 只过滤完全匹配或者是纯粹的描述词，不过滤包含"咖啡"的烘焙商名称
  if (
    excludeWords.some(word => firstPart.toLowerCase() === word.toLowerCase()) ||
    firstPart.toLowerCase() === 'coffee'
  ) {
    return '未知烘焙商';
  }

  return firstPart;
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
  if (!beanName || typeof beanName !== 'string') {
    return beanName || '';
  }

  const trimmedName = beanName.trim();
  if (!trimmedName) {
    return '';
  }

  // 根据分隔符分割名称
  const parts =
    separator === '/' ? trimmedName.split('/') : trimmedName.split(/\s+/);

  // 如果只有一个词，无法分离烘焙商和名称
  if (parts.length === 1) {
    return trimmedName;
  }

  // 检查第一个词是否是烘焙商（使用与 extractRoasterFromName 相同的逻辑）
  const firstPart = parts[0];
  const excludeWords = ['豆', 'bean', 'beans', '手冲', '意式', '咖啡豆'];

  // 如果第一个词是排除词，则整个名称都是咖啡豆名称
  if (
    excludeWords.some(word => firstPart.toLowerCase() === word.toLowerCase()) ||
    firstPart.toLowerCase() === 'coffee'
  ) {
    return trimmedName;
  }

  // 移除第一个词（烘焙商），返回剩余部分
  const remainingParts = parts.slice(1);
  return separator === '/'
    ? remainingParts.join('/')
    : remainingParts.join(' ');
};

/**
 * 从咖啡豆数组中提取所有唯一的烘焙商
 * @param beans 咖啡豆数组
 * @param settings 烘焙商相关设置（可选）
 * @returns 按数量排序的唯一烘焙商数组（数量多的在前）
 */
export const extractUniqueRoasters = (
  beans: ExtendedCoffeeBean[],
  settings?: RoasterSettings
): string[] => {
  const roasterCount = new Map<string, number>();

  // 统计每个烘焙商的咖啡豆数量
  beans.forEach(bean => {
    let roaster: string;

    // 如果启用了烘焙商字段，优先使用 roaster 字段
    if (settings?.roasterFieldEnabled && bean.roaster) {
      roaster = bean.roaster;
    } else {
      // 否则从名称中提取
      roaster = extractRoasterFromName(bean.name, settings?.roasterSeparator);
    }

    roasterCount.set(roaster, (roasterCount.get(roaster) || 0) + 1);
  });

  // 按数量排序，数量多的在前，"未知烘焙商"放在最后
  const roasters = Array.from(roasterCount.entries())
    .sort((a, b) => {
      // "未知烘焙商"始终排在最后
      if (a[0] === '未知烘焙商') return 1;
      if (b[0] === '未知烘焙商') return -1;

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
 * @param settings 烘焙商相关设置（可选）
 * @returns 是否属于该烘焙商
 */
export const beanHasRoaster = (
  bean: ExtendedCoffeeBean,
  roaster: string,
  settings?: RoasterSettings
): boolean => {
  let beanRoaster: string;

  // 如果启用了烘焙商字段，优先检查 roaster 字段
  if (settings?.roasterFieldEnabled && bean.roaster) {
    beanRoaster = bean.roaster;
  } else {
    // 否则从名称中提取
    beanRoaster = extractRoasterFromName(bean.name, settings?.roasterSeparator);
  }

  return beanRoaster === roaster;
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
 * 根据当前设置动态组合 roaster 和 name
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

  // 如果未启用烘焙商字段或没有 roaster 值，直接返回名称
  if (!settings?.roasterFieldEnabled || !beanInfo.roaster) {
    return beanInfo.name;
  }

  // 根据分隔符设置格式化显示
  const separator = settings.roasterSeparator === '/' ? '/' : ' ';
  return `${beanInfo.roaster}${separator}${beanInfo.name}`;
};
