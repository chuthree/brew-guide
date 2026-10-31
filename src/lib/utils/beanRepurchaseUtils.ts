/**
 * 咖啡豆续购工具函数
 * 处理咖啡豆续购时的编号递增和数据复制
 */

import { CoffeeBean } from '@/types/app';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { coffeeBeanImageRepository } from '@/lib/data/repositories';

import {
  parseBeanName,
  getNextAvailableNumber,
} from '@/lib/coffee-beans/repurchaseNaming';
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

  // 解析当前咖啡豆名称
  const { baseName } = parseBeanName(sourceBean.name);

  // 获取下一个可用编号
  const nextNumber = getNextAvailableNumber(baseName, allBeans);

  // 复制基础数据，仅保留适合续购继承的字段
  // 评分属于上一次购买的历史记录，不应随新批次继承
  const {
    id: _id,
    timestamp: _timestamp,
    overallRating: _overallRating,
    ratingNotes: _ratingNotes,
    sourceGreenBeanId: _sourceGreenBeanId,
    sourceGreenBeanIds: _sourceGreenBeanIds,
    ...repurchaseSourceBean
  } = sourceBean;

  const newBeanData: Omit<CoffeeBean, 'id' | 'timestamp'> = {
    ...repurchaseSourceBean,
    // 更新名称编号
    name: `${baseName} #${nextNumber}`,
    // 剩余量改为总量
    remaining: sourceBean.capacity || '',
    // 清除烘焙日期
    roastDate: '',
  };

  return newBeanData;
}
