import type { CoffeeBeanGroup } from '@/lib/core/db';
import type { CoffeeBean } from '@/types/app';

export const getSortedCoffeeBeanGroups = (
  groups?: CoffeeBeanGroup[]
): CoffeeBeanGroup[] =>
  [...(groups || [])].sort((a, b) => {
    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return (a.createdAt ?? 0) - (b.createdAt ?? 0);
  });

export const normalizeCoffeeBeanGroups = (
  groups?: CoffeeBeanGroup[],
  beans?: CoffeeBean[]
): CoffeeBeanGroup[] => {
  const validBeanIds = beans ? new Set(beans.map(bean => bean.id)) : null;

  return getSortedCoffeeBeanGroups(groups).map((group, index) => {
    const uniqueBeanIds = Array.from(new Set(group.beanIds || []));

    return {
      ...group,
      beanIds: validBeanIds
        ? uniqueBeanIds.filter(beanId => validBeanIds.has(beanId))
        : uniqueBeanIds,
      order: group.order ?? index,
      createdAt: group.createdAt ?? Date.now(),
      updatedAt: group.updatedAt ?? Date.now(),
    };
  });
};

export const getAvailableCoffeeBeanGroups = (
  groups: CoffeeBeanGroup[] | undefined,
  beans: CoffeeBean[]
): CoffeeBeanGroup[] => {
  if (!beans.length) return [];

  const beanIds = new Set(beans.map(bean => bean.id));
  return getSortedCoffeeBeanGroups(groups).filter(group =>
    (group.beanIds || []).some(beanId => beanIds.has(beanId))
  );
};

export const beanBelongsToGroup = (
  bean: CoffeeBean,
  group: CoffeeBeanGroup | undefined
): boolean => Boolean(group?.beanIds?.includes(bean.id));
