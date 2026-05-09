import type { ExtendedCoffeeBean } from '../types';

export type InventoryVirtuosoBeanItem<
  TBean extends { id: string } = ExtendedCoffeeBean,
> = {
  type: 'bean';
  bean: TBean;
};

export type InventoryVirtuosoDividerItem = {
  type: 'divider';
};

export type InventoryVirtuosoItem<
  TBean extends { id: string } = ExtendedCoffeeBean,
> = InventoryVirtuosoBeanItem<TBean> | InventoryVirtuosoDividerItem;

export const INVENTORY_EMPTY_DIVIDER_KEY = 'divider:empty-beans';

export const getInventoryVirtuosoItemKey = <
  TBean extends { id: string } = ExtendedCoffeeBean,
>(
  _index: number,
  item: InventoryVirtuosoItem<TBean>
) =>
  item.type === 'bean' ? `bean:${item.bean.id}` : INVENTORY_EMPTY_DIVIDER_KEY;

export const buildInventoryVirtuosoData = <
  TBean extends { id: string } = ExtendedCoffeeBean,
>(
  filteredBeans: TBean[],
  emptyBeans: TBean[],
  showEmptyBeans: boolean
): InventoryVirtuosoItem<TBean>[] => {
  const items: InventoryVirtuosoItem<TBean>[] = filteredBeans.map(bean => ({
    type: 'bean',
    bean,
  }));

  if (showEmptyBeans && emptyBeans.length > 0 && filteredBeans.length > 0) {
    items.push({ type: 'divider' });
  }

  if (showEmptyBeans && emptyBeans.length > 0) {
    items.push(...emptyBeans.map(bean => ({ type: 'bean' as const, bean })));
  }

  return items;
};
