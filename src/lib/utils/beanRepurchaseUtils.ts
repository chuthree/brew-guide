/**
 * 咖啡豆续购工具函数
 * 处理咖啡豆续购时的编号递增和数据复制
 */

import { CoffeeBean } from '@/types/app';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';

/**
 * 从咖啡豆名称中提取基础名称和编号
 * @param name 咖啡豆名称
 * @returns { baseName: 基础名称, number: 编号 (如果有) }
 */
export function parseBeanName(name: string): {
  baseName: string;
  number: number | null;
} {
  const nameWithNumberPattern = /^(.+?)\s*#(\d+)$/;
  const match = name.match(nameWithNumberPattern);

  if (match) {
    return {
      baseName: match[1].trim(),
      number: parseInt(match[2], 10),
    };
  }

  return {
    baseName: name,
    number: null,
  };
}

/**
 * 获取下一个可用的编号
 * @param baseName 基础名称
 * @param allBeans 所有咖啡豆列表
 * @returns 下一个可用的编号
 */
export function getNextAvailableNumber(
  baseName: string,
  allBeans: CoffeeBean[]
): number {
  let maxNumber = 1;

  // 查找所有相关的咖啡豆（基础名称相同的）
  allBeans.forEach(bean => {
    const { baseName: beanBaseName, number } = parseBeanName(bean.name);

    // 如果基础名称匹配
    if (beanBaseName === baseName) {
      if (number !== null && number > maxNumber) {
        maxNumber = number;
      }
    }
  });

  // 返回最大编号 + 1
  return maxNumber + 1;
}

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
  // 从 Store 获取所有咖啡豆以检测编号
  const allBeans = useCoffeeBeanStore.getState().beans;

  // 解析当前咖啡豆名称
  const { baseName } = parseBeanName(bean.name);

  // 获取下一个可用编号
  const nextNumber = getNextAvailableNumber(baseName, allBeans);

  // 复制所有数据，只修改名称、剩余量和烘焙日期
  const newBeanData: Omit<CoffeeBean, 'id' | 'timestamp'> = {
    ...bean,
    // 更新名称编号
    name: `${baseName} #${nextNumber}`,
    // 剩余量改为总量
    remaining: bean.capacity || '',
    // 清除烘焙日期
    roastDate: '',
  };

  // 移除 id 和 timestamp（不应该被复制）
  delete (newBeanData as any).id;
  delete (newBeanData as any).timestamp;

  return newBeanData;
}
