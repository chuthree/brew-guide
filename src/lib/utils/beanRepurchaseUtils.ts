/**
 * 咖啡豆续购工具函数
 * 处理咖啡豆续购时的编号递增和数据复制
 */

import { CoffeeBean } from '@/types/app';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { coffeeBeanImageRepository } from '@/lib/data/repositories';

import { buildRepurchaseBean } from '@/lib/coffee-beans/repurchase';
export {
  parseBeanName,
  getNextAvailableNumber,
} from '@/lib/coffee-beans/repurchaseNaming';

/**
 * 创建续购咖啡豆数据
 * 复制原有咖啡豆信息，只做两个改动：
 * 1. 剩余量改为总量
 * 2. 清除烘焙日期
 * @param bean 原咖啡豆数据
 * @returns 新的咖啡豆数据（不含 id 和 timestamp）
 */
export async function createRepurchaseBean(
  bean: CoffeeBean
): Promise<Omit<CoffeeBean, 'id' | 'timestamp'>> {
  const sourceBean = bean.id
    ? await coffeeBeanImageRepository.mergeBean(bean)
    : bean;
  // 从 Store 获取所有咖啡豆以检测编号
  const allBeans = useCoffeeBeanStore.getState().beans;

  return buildRepurchaseBean(sourceBean, allBeans);
}
