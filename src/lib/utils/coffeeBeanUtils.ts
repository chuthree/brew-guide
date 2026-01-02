/**
 * 咖啡豆相关工具函数
 */

import type {
  CoffeeBean,
  PendingCoffeeBean,
  SelectableCoffeeBean,
} from '@/types/app';

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
