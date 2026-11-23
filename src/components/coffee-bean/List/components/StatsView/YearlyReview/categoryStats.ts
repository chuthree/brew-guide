import type { CoffeeBean } from '@/types/app';
import {
  getBeanCountries,
  getBeanOriginSummaries,
  getBeanProcesses,
  getBeanVarieties,
} from '@/lib/utils/beanVarietyUtils';

const categoryValues = {
  origin: (bean: CoffeeBean) => {
    const countries = getBeanCountries(bean);
    return countries.length ? countries : getBeanOriginSummaries(bean);
  },
  variety: getBeanVarieties,
  process: getBeanProcesses,
};

export function rankBeanCategories(
  beans: CoffeeBean[],
  category: keyof typeof categoryValues
) {
  const counts = new Map<
    string,
    { name: string; count: number; image?: string }
  >();
  for (const bean of beans) {
    for (const name of new Set(categoryValues[category](bean))) {
      const item = counts.get(name) ?? { name, count: 0 };
      item.count += 1;
      item.image ||= bean.image;
      counts.set(name, item);
    }
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}
