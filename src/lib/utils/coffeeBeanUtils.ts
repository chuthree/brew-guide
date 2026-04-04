/**
 * 咖啡豆相关工具函数
 */

import type {
  CoffeeBean,
  PendingCoffeeBean,
  SelectableCoffeeBean,
} from '@/types/app';

const FLAVOR_SPLIT_REGEX = /[\n,，、;；]+/;

type BeanIdentityLike = {
  id?: string | null;
  name?: string | null;
  roaster?: string | null;
  timestamp?: number | null;
};

const normalizeBeanText = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const isExcludedLegacyRoasterToken = (value: string): boolean => {
  const lowerCased = value.toLowerCase();
  const excludeWords = ['豆', 'bean', 'beans', '手冲', '意式', '咖啡豆', 'coffee'];
  return excludeWords.includes(lowerCased);
};

const getDisplayNameCandidates = (bean: BeanIdentityLike): string[] => {
  const name = normalizeCoffeeBeanName(bean.name);
  const roaster = normalizeCoffeeBeanRoaster(bean.roaster);

  if (!name) {
    return [];
  }

  if (!roaster) {
    return [name];
  }

  return Array.from(
    new Set([name, `${roaster} ${name}`, `${roaster}/${name}`])
  );
};

/**
 * 类型守卫：判断是否为待创建的咖啡豆
 * 待创建的咖啡豆没有 id，且有 isPending 标记
 */
export function isPendingCoffeeBean(
  bean: SelectableCoffeeBean | null | undefined
): bean is PendingCoffeeBean {
  if (!bean) return false;
  return 'isPending' in bean && bean.isPending === true && !bean.id;
}

/**
 * 类型守卫：判断是否为已持久化的咖啡豆
 */
export function isPersistedCoffeeBean(
  bean: SelectableCoffeeBean | null | undefined
): bean is CoffeeBean {
  if (!bean) return false;
  return typeof bean.id === 'string' && bean.id.length > 0;
}

/**
 * 创建一个待创建的咖啡豆对象
 * @param name 咖啡豆名称
 */
export function createPendingBean(name: string): PendingCoffeeBean {
  return {
    name: name.trim(),
    isPending: true,
  };
}

/**
 * 从冲煮参数中提取咖啡用量（克）
 * @param coffeeParam 咖啡参数字符串，如 "15g" 或 "15"
 * @returns 提取的数值，如果无法解析则返回 0
 */
export function extractCoffeeAmount(coffeeParam: string | undefined): number {
  if (!coffeeParam) return 0;
  const match = coffeeParam.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * 将任意格式的风味字段规范为字符串数组
 */
export function normalizeFlavorList(flavor: unknown): string[] {
  if (Array.isArray(flavor)) {
    return flavor
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean);
  }

  if (typeof flavor === 'string') {
    const normalized = flavor.trim();
    if (!normalized) return [];

    return normalized
      .split(FLAVOR_SPLIT_REGEX)
      .map(item => item.trim())
      .filter(Boolean);
  }

  if (flavor && typeof flavor === 'object') {
    const entries = Object.entries(flavor as Record<string, unknown>);
    const isArrayLikeObject =
      entries.length > 0 && entries.every(([key]) => /^\d+$/.test(key));

    if (isArrayLikeObject) {
      return normalizeFlavorList(entries.map(([, value]) => value));
    }
  }

  return [];
}

/**
 * 规范化咖啡豆名称
 */
export function normalizeCoffeeBeanName(name: unknown): string {
  return normalizeBeanText(name);
}

/**
 * 规范化烘焙商名称
 */
export function normalizeCoffeeBeanRoaster(roaster: unknown): string {
  return normalizeBeanText(roaster);
}

/**
 * 从旧版“烘焙商 + 名称”字符串中提取烘焙商
 */
export function extractRoasterFromDisplayName(
  beanName: string,
  separator: ' ' | '/' = ' '
): string | null {
  const trimmedName = normalizeCoffeeBeanName(beanName);
  if (!trimmedName) {
    return null;
  }

  const parts =
    separator === '/' ? trimmedName.split('/') : trimmedName.split(/\s+/);

  if (parts.length <= 1) {
    return null;
  }

  const firstPart = normalizeCoffeeBeanName(parts[0]);
  if (!firstPart || isExcludedLegacyRoasterToken(firstPart)) {
    return null;
  }

  return firstPart;
}

/**
 * 从旧版“烘焙商 + 名称”字符串中移除烘焙商
 */
export function removeRoasterFromDisplayName(
  beanName: string,
  separator: ' ' | '/' = ' '
): string {
  const trimmedName = normalizeCoffeeBeanName(beanName);
  if (!trimmedName) {
    return '';
  }

  const parts =
    separator === '/' ? trimmedName.split('/') : trimmedName.split(/\s+/);

  if (parts.length <= 1) {
    return trimmedName;
  }

  const firstPart = normalizeCoffeeBeanName(parts[0]);
  if (!firstPart || isExcludedLegacyRoasterToken(firstPart)) {
    return trimmedName;
  }

  const remainingParts = parts.slice(1);
  return separator === '/'
    ? remainingParts.join('/')
    : remainingParts.join(' ');
}

export const extractRoasterFromName = extractRoasterFromDisplayName;

export const removeRoasterFromName = removeRoasterFromDisplayName;

/**
 * 获取咖啡豆当前应使用的烘焙商名称
 * 优先使用独立字段，缺失时再回退到旧版组合名称解析。
 */
export function getBeanRoasterName(
  bean: Pick<BeanIdentityLike, 'name' | 'roaster'> | null | undefined,
  separator: ' ' | '/' = ' '
): string {
  if (!bean) {
    return '';
  }

  return (
    normalizeCoffeeBeanRoaster(bean.roaster) ||
    extractRoasterFromDisplayName(normalizeCoffeeBeanName(bean.name), separator) ||
    ''
  );
}

/**
 * 比较两个咖啡豆身份是否一致
 * 优先比较 roaster + name，缺少 roaster 时退化为 name。
 */
export function isSameCoffeeBeanIdentity(
  left: Pick<BeanIdentityLike, 'name' | 'roaster'> | null | undefined,
  right: Pick<BeanIdentityLike, 'name' | 'roaster'> | null | undefined
): boolean {
  if (!left || !right) {
    return false;
  }

  const leftName = normalizeCoffeeBeanName(left.name);
  const rightName = normalizeCoffeeBeanName(right.name);
  if (!leftName || !rightName || leftName !== rightName) {
    return false;
  }

  const leftRoaster = getBeanRoasterName(left);
  const rightRoaster = getBeanRoasterName(right);

  if (!leftRoaster && !rightRoaster) {
    return true;
  }

  return leftRoaster === rightRoaster;
}

/**
 * 按“id -> roaster+name -> name/displayName”查找咖啡豆
 */
export function findCoffeeBeanByIdentity<T extends BeanIdentityLike>(
  beans: T[],
  target: BeanIdentityLike | null | undefined
): T | null {
  if (!target) {
    return null;
  }

  if (target.id) {
    const matchedById = beans.find(bean => bean.id === target.id);
    if (matchedById) {
      return matchedById;
    }
  }

  const targetName = normalizeCoffeeBeanName(target.name);
  if (!targetName) {
    return null;
  }

  const targetRoaster = getBeanRoasterName(target);
  if (targetRoaster) {
    const matchedByIdentity = beans.find(
      bean =>
        normalizeCoffeeBeanName(bean.name) === targetName &&
        getBeanRoasterName(bean) === targetRoaster
    );
    if (matchedByIdentity) {
      return matchedByIdentity;
    }
  }

  const matchedByName = beans.find(
    bean => normalizeCoffeeBeanName(bean.name) === targetName
  );
  if (matchedByName) {
    return matchedByName;
  }

  const targetDisplayName = normalizeCoffeeBeanName(target.name);
  if (!targetDisplayName) {
    return null;
  }

  const displayMatches = beans
    .filter(bean =>
      getDisplayNameCandidates(bean).includes(targetDisplayName)
    )
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  return displayMatches[0] || null;
}

/**
 * 按显示名称查找咖啡豆
 */
export function findCoffeeBeanByDisplayName<T extends BeanIdentityLike>(
  beans: T[],
  displayName: string
): T | null {
  const normalizedDisplayName = normalizeCoffeeBeanName(displayName);
  if (!normalizedDisplayName) {
    return null;
  }

  const matches = beans
    .filter(bean =>
      getDisplayNameCandidates(bean).includes(normalizedDisplayName)
    )
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  return matches[0] || null;
}

/**
 * 判断风味字段是否需要修复
 */
export function hasInvalidFlavorValue(flavor: unknown): boolean {
  if (flavor === undefined) return false;
  if (!Array.isArray(flavor)) return true;

  const normalized = normalizeFlavorList(flavor);
  if (normalized.length !== flavor.length) return true;

  return normalized.some((item, index) => item !== flavor[index]);
}

/**
 * 规范化咖啡豆对象，避免历史或导入数据中的异常字段导致界面报错
 */
export function normalizeCoffeeBean<
  T extends { flavor?: unknown; name?: unknown; roaster?: unknown },
>(
  bean: T,
  options?: { ensureFlavorArray?: boolean }
): T {
  const hasRoasterField = Object.prototype.hasOwnProperty.call(bean, 'roaster');
  const hasNameField = Object.prototype.hasOwnProperty.call(bean, 'name');
  const shouldNormalizeFlavor =
    bean.flavor !== undefined || options?.ensureFlavorArray;

  if (!hasRoasterField && !hasNameField && !shouldNormalizeFlavor) {
    return bean;
  }

  const normalizedBean = {
    ...bean,
  } as T & {
    name?: string;
    roaster?: string | undefined;
    flavor?: string[];
  };

  if (hasNameField) {
    normalizedBean.name = normalizeCoffeeBeanName(bean.name);
  }

  if (hasRoasterField) {
    normalizedBean.roaster = normalizeCoffeeBeanRoaster(bean.roaster) || undefined;
  }

  if (shouldNormalizeFlavor) {
    normalizedBean.flavor = normalizeFlavorList(bean.flavor);
  }

  return normalizedBean;
}

/**
 * 批量规范化咖啡豆数据
 */
export function normalizeCoffeeBeans<T extends { flavor?: unknown }>(
  beans: T[],
  options?: { ensureFlavorArray?: boolean }
): T[] {
  return beans.map(bean => normalizeCoffeeBean(bean, options));
}
