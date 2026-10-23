import type { Grinder } from '@/lib/data/models';
import {
  normalizeCoffeeBeanName,
  normalizeCoffeeBeanRoaster,
} from '@/lib/utils/coffeeBeanUtils';
export function parseGrinderFromGrindSize(
  grindSize: string,
  grinderNames: string[]
): { grinderName: string; scale: string } | null {
  if (!grindSize || grinderNames.length === 0) return null;

  // 按名称长度降序排序，优先匹配较长的名称（避免 "C40" 匹配到 "C4"）
  const sortedNames = [...grinderNames].sort((a, b) => b.length - a.length);

  for (const name of sortedNames) {
    // 检查是否以磨豆机名开头
    if (grindSize.startsWith(name)) {
      // 获取剩余部分
      const remainder = grindSize.slice(name.length).trim();

      // 去掉可能的分隔符
      const scale = remainder.replace(/^[·\s]+/, '').trim();

      // 如果有刻度值，返回解析结果
      if (scale) {
        return { grinderName: name, scale };
      }
    }
  }

  return null;
}

export type GrinderCoffeeBeanContext =
  | string
  | {
      name?: string;
      roaster?: string;
    }
  | undefined;

const normalizeGrinderCoffeeBeanContext = (
  coffeeBean?: GrinderCoffeeBeanContext
) => {
  if (!coffeeBean) {
    return {
      coffeeBean: undefined,
      coffeeBeanName: undefined,
      coffeeBeanRoaster: undefined,
    };
  }

  if (typeof coffeeBean === 'string') {
    const legacyDisplayName = normalizeCoffeeBeanName(coffeeBean);
    return {
      coffeeBean: legacyDisplayName || undefined,
      coffeeBeanName: legacyDisplayName || undefined,
      coffeeBeanRoaster: undefined,
    };
  }

  const coffeeBeanName = normalizeCoffeeBeanName(coffeeBean.name);
  const coffeeBeanRoaster = normalizeCoffeeBeanRoaster(coffeeBean.roaster);

  return {
    coffeeBean: coffeeBeanName || undefined,
    coffeeBeanName: coffeeBeanName || undefined,
    coffeeBeanRoaster: coffeeBeanRoaster || undefined,
  };
};

/** Canonical note-save sync: deduplicate by scale and retain the latest three measured contexts. */
export function applyBrewGrinderScale(
  grinder: Grinder,
  scale: string,
  equipment?: string,
  method?: string,
  coffeeBean?: GrinderCoffeeBeanContext,
  timestamp = Date.now()
): Grinder {
  return {
    ...grinder,
    currentGrindSize: scale,
    grindSizeHistory: [
      {
        grindSize: scale,
        timestamp,
        equipment,
        method,
        ...normalizeGrinderCoffeeBeanContext(coffeeBean),
      },
      ...(grinder.grindSizeHistory ?? []).filter(
        entry => entry.grindSize !== scale
      ),
    ].slice(0, 3),
  };
}
