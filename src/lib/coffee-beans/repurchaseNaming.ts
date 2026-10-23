import type { CoffeeBean } from '@/types/app';
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
