import { CoffeeBean } from '@/types/app';
import { calculateFlavorInfo } from './flavorPeriodUtils';

/**
 * 获取咖啡豆的赏味期信息
 */
export const getFlavorInfo = (
  bean: CoffeeBean
): { phase: string; remainingDays: number } => {
  // 处理在途状态
  if (bean.isInTransit) {
    return { phase: '在途', remainingDays: 0 };
  }

  // 处理冷冻状态
  if (bean.isFrozen) {
    return { phase: '冷冻', remainingDays: 0 };
  }

  // 没有烘焙日期的归为"其他"类别
  if (!bean.roastDate) {
    return { phase: '其他', remainingDays: 0 };
  }

  // 使用统一的赏味期计算工具
  const flavorInfo = calculateFlavorInfo(bean);

  return {
    phase: flavorInfo.phase,
    remainingDays: flavorInfo.remainingDays,
  };
};

/**
 * 获取阶段数值用于排序
 * 排序规则：衰退期 > 赏味期 > 冷冻 > 养豆期 > 在途 > 其他
 */
export const getPhaseValue = (phase: string): number => {
  switch (phase) {
    case '衰退期':
      return 0;
    case '赏味期':
      return 1;
    case '冷冻':
      return 2;
    case '养豆期':
      return 3;
    case '在途':
      return 4;
    default:
      return 5; // 其他未知状态
  }
};

/**
 * 计算咖啡豆已养豆天数（从烘焙日期到现在）
 */
export const getDaysFromRoast = (bean: CoffeeBean): number => {
  if (!bean.roastDate) return 0;
  const roastDate = new Date(bean.roastDate);
  const today = new Date();
  const diffTime = today.getTime() - roastDate.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * 统一的咖啡豆排序函数
 * 排序规则（从上到下）：
 * - 衰退期 → 越老越靠前
 * - 赏味期 → 快过期的优先
 * - 冷冻 → 越老越靠前
 * - 养豆期 → 快熟成的优先
 * - 在途 → 按日期排序
 * - 其他 → 无日期豆子，排最后
 */
export const sortBeansByFlavorPeriod = (beans: CoffeeBean[]): CoffeeBean[] => {
  return [...beans].sort((a, b) => {
    const { phase: phaseA, remainingDays: daysA } = getFlavorInfo(a);
    const { phase: phaseB, remainingDays: daysB } = getFlavorInfo(b);

    // 首先按照阶段分组排序
    if (phaseA !== phaseB) {
      const phaseValueA = getPhaseValue(phaseA);
      const phaseValueB = getPhaseValue(phaseB);
      return phaseValueA - phaseValueB;
    }

    // 如果阶段相同，根据不同阶段有不同的排序逻辑
    if (phaseA === '衰退期') {
      // 衰退期：超过养豆时间长的在上，养豆时间短的在下
      const daysFromRoastA = getDaysFromRoast(a);
      const daysFromRoastB = getDaysFromRoast(b);
      return daysFromRoastB - daysFromRoastA; // 降序，天数大的在前
    } else if (phaseA === '赏味期') {
      // 赏味期：剩余天数少的在上，剩余天数多的在下
      return daysA - daysB; // 升序，剩余天数少的在前
    } else if (phaseA === '冷冻') {
      // 冷冻：养豆时间长的在上，养豆时间短的在下
      const daysFromRoastA = getDaysFromRoast(a);
      const daysFromRoastB = getDaysFromRoast(b);
      return daysFromRoastB - daysFromRoastA; // 降序，天数大的在前
    } else if (phaseA === '养豆期') {
      // 养豆期：剩余养豆天数少的在上（即快要进入赏味期的在上）
      return daysA - daysB; // 升序，剩余天数少的在前
    } else if (phaseA === '在途') {
      // 在途：按烘焙日期排序，如果有的话（较新的在前）
      if (!a.roastDate || !b.roastDate) return 0;
      return new Date(b.roastDate).getTime() - new Date(a.roastDate).getTime();
    } else {
      // 其他未知状态：按烘焙日期排序
      if (!a.roastDate || !b.roastDate) return 0;
      return new Date(b.roastDate).getTime() - new Date(a.roastDate).getTime();
    }
  });
};

/**
 * 反向的咖啡豆排序函数（用于"从多到少"排序）
 * 排序规则与 sortBeansByFlavorPeriod 完全相反
 */
export const sortBeansByFlavorPeriodReverse = (
  beans: CoffeeBean[]
): CoffeeBean[] => {
  return [...beans].sort((a, b) => {
    const { phase: phaseA, remainingDays: daysA } = getFlavorInfo(a);
    const { phase: phaseB, remainingDays: daysB } = getFlavorInfo(b);

    // 首先按照阶段分组排序（保持原顺序）
    if (phaseA !== phaseB) {
      const phaseValueA = getPhaseValue(phaseA);
      const phaseValueB = getPhaseValue(phaseB);
      return phaseValueA - phaseValueB; // 保持分组顺序不变
    }

    // 如果阶段相同，根据不同阶段反转组内的排序逻辑
    if (phaseA === '衰退期') {
      // 衰退期：养豆时间短的在上
      const daysFromRoastA = getDaysFromRoast(a);
      const daysFromRoastB = getDaysFromRoast(b);
      return daysFromRoastA - daysFromRoastB; // 升序
    } else if (phaseA === '赏味期') {
      // 赏味期：剩余天数多的在上
      return daysB - daysA; // 降序
    } else if (phaseA === '冷冻') {
      // 冷冻：养豆时间短的在上
      const daysFromRoastA = getDaysFromRoast(a);
      const daysFromRoastB = getDaysFromRoast(b);
      return daysFromRoastA - daysFromRoastB; // 升序
    } else if (phaseA === '养豆期') {
      // 养豆期：剩余养豆天数多的在上
      return daysB - daysA; // 降序
    } else if (phaseA === '在途') {
      // 在途：按烘焙日期排序（旧的在前）
      if (!a.roastDate || !b.roastDate) return 0;
      return new Date(a.roastDate).getTime() - new Date(b.roastDate).getTime();
    } else {
      // 其他未知状态：按烘焙日期排序（旧的在前）
      if (!a.roastDate || !b.roastDate) return 0;
      return new Date(a.roastDate).getTime() - new Date(b.roastDate).getTime();
    }
  });
};
